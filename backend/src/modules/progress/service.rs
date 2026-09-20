use serde_json::{json, Map, Value};
use sqlx::PgPool;

use crate::core::error::{ApiError, ApiResult};
use crate::modules::orders::model::{OrderLineDto, OrderSearchQuery};
use crate::modules::orders::service::{self as orders_service, OrderHeaderRow};

use super::model::{ProcedureSlotDto, ProceduresDto, ProceduresInput, ProgressUpdateInput};

/// 工序槽总数。旧版是**写死的 15**（服务端 `buildProgressText` 里
/// `for (let i = 1; i <= 15; i++)`，前端 `GetProcedures` 也是 15 个扁平槽）。
/// 新版沿用 15 —— 库里没配的槽返回空名，**不省略**，这样前端拿到的一定是 15 项。
const SLOT_COUNT: usize = 15;

/// 槽号（1-based）→ `'工序N'`。前端与服务端都用这个拼法，别在别处再写一遍。
pub fn slot_name(i: usize) -> String {
    format!("工序{i}")
}

/// 读某租户的工序名清单。
///
/// **返回恒为 15 项**（库里没配的给空名），顺序按槽号 —— 见 `ProceduresDto` 的注释。
///
/// ⚠️ **15 槽一视同仁，没有哪个槽特殊**。旧版「设置工序」弹窗会硬把 `工序10` 排掉
/// （因为 Progress 侧把「回款」硬编码进那个槽），新版那两处特判一起去掉了 ——
/// 见迁移 `0021_progress.sql` 头注、`docs/2026-09-19-qrscanner-analysis.md` §8.3 第 1 条。
pub async fn get_procedures(pool: &PgPool, tenant_id: i64) -> ApiResult<ProceduresDto> {
    // 只取有名字的，剩下的在下面补空 —— 这样「库里一行都没有」也能返回 15 个空槽。
    let rows: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT slot, name, color FROM procedures WHERE tenant_id = $1 AND name <> ''",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;

    let find = |slot: &str| rows.iter().find(|(s, _, _)| s == slot).cloned();

    let slots = (1..=SLOT_COUNT)
        .map(|i| {
            let s = slot_name(i);
            let (name, color) = match find(&s) {
                Some((_, n, c)) => (n, c),
                None => (String::new(), String::new()),
            };
            ProcedureSlotDto {
                slot: s,
                name,
                color,
            }
        })
        .collect();

    Ok(ProceduresDto { slots })
}

/// `POST /v1/procedures` —— 整体 upsert 本租户的工序清单（名字 + 颜色）。
///
/// ## 语义
///
/// 请求里给的每个槽，按 **`(tenant_id, slot)`** 冲突键 upsert；
/// **没提到的槽一个都不动**（不删行、不清空）—— 这条是**有意选的**：
/// 旧版 `SetProcedures` 传的是「恒 15 键」的全量对象，新版若照抄「先清后写」，
/// 一个只发了改动槽的调用方就会把其余槽**静默清空**。只 upsert 更安全，
/// 而「清空某个槽的名字」这条路上照样成立（发 `name: ""` 即可，`GET` 反正一律返回 15 项）。
///
/// `slot` 必须在 `工序1`..`工序15` 内 —— 野槽名 **400**，且**整笔不落库**。
/// 旧版不校验这个（前端传什么就写什么键），是旧版的漏洞，不照抄。
///
/// ## 一次事务
///
/// 校验先全部做完再开事务；写入在同一个事务里，**要么全成要么全不成**。
/// 旧版是「逐个 `findFirst` 再 update/create」，按 `orderIndex` 找不到还会按 `name` 兜底查，
/// 同名不同槽时会**误合并**——新版有 `UNIQUE(tenant_id, slot)`，直接 `ON CONFLICT` 干净。
///
/// ## ⚠️ 不照抄旧版的三处（见 `docs/2026-09-19-qrscanner-analysis.md` §8.3）
///
/// 1. **15 槽一视同仁**：不排 `工序10`（旧版弹窗把它排掉，是给「回款」让路）。
/// 2. **颜色进库**：旧版存 localStorage `procedure_name_color_map`（键=工序名 ⇒ 改名丢色、不分租户）。
/// 3. **只有一把租户键 `tenant_id`**（从登录态取）——旧版这里按 `registrant`、业务接口按 `ds`。
pub async fn set_procedures(pool: &PgPool, tenant_id: i64, req: &ProceduresInput) -> ApiResult<()> {
    if req.slots.is_empty() {
        // 「saved: true」而实际什么都没存，是句假话 —— 空请求按 400 处理（与 `update_progress` 同口径）。
        return Err(ApiError::bad_request("没有要保存的工序槽"));
    }
    // 先把全体的槽名校验完，任何一个不合法 ⇒ 整笔不落库。
    for s in &req.slots {
        if !valid_slot(&s.slot) {
            return Err(ApiError::bad_request(&format!(
                "槽名不对：{}（应为 工序1 .. 工序{SLOT_COUNT}）",
                s.slot
            )));
        }
    }

    let mut tx = pool.begin().await?;
    for s in &req.slots {
        // 槽号（1..15）就是排序号 —— 旧版 `GetProcedures` 也是按它升序拼的。
        // 上面已经 `valid_slot` 过，这里的 `unwrap_or(0)` 走不到。
        let sort_order: i32 = s
            .slot
            .strip_prefix("工序")
            .and_then(|n| n.parse().ok())
            .unwrap_or(0);
        sqlx::query(
            "INSERT INTO procedures (tenant_id, slot, name, color, sort_order) \
             VALUES ($1, $2, $3, $4, $5) \
             ON CONFLICT (tenant_id, slot) DO UPDATE SET \
                 name = EXCLUDED.name, color = EXCLUDED.color, \
                 sort_order = EXCLUDED.sort_order, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(&s.slot)
        .bind(s.name.trim())
        .bind(s.color.trim())
        .bind(sort_order)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(())
}

// ===== 生产进度主体（`GET /v1/progress`）=====

/// 从行里取 `'工序N'` 的值，没有/非串/全空白 ⇒ 空串。
fn slot_of(slots: &Value, i: usize) -> String {
    slots
        .get(slot_name(i))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string()
}

/// **「生产进度」串** = 15 槽里非空的按序用 `➞` 连接。
///
/// 逐字照抄旧服务端 `buildProgressText`（`progress.service.ts:123`）：
/// `for (let i = 1; i <= 15; i++)` 收非空 → `join('➞')`。
/// ⚠️ 分隔符是 **`➞`（U+279E，粗体箭头）**，不是 `->`、也不是普通箭头。
pub fn build_progress_text(slots: &Value) -> String {
    (1..=SLOT_COUNT)
        .map(|i| slot_of(slots, i))
        .filter(|v| !v.is_empty())
        .collect::<Vec<_>>()
        .join("➞")
}

/// 一行 `progressData`。
///
/// 字段与兜底值逐条对照旧服务端 `enrichDoorRow` + `progressRowFromDoorRow`，
/// 清单见 `docs/2026-09-19-progress-analysis.md` §11。
///
/// ⚠️ **新版没有来源的 7 个字段**（旧版有）：`procedureName` / `procedureStatus` /
/// `打单人` / `打单操作` / `加价项目原始数据` / `封板高` / `洞尺`。
/// 这里按**旧版的兜底值**给（`''` / `null` / `'null'` / `0`），**不假装有数据**。
fn build_row(header: &OrderHeaderRow, line: &OrderLineDto) -> Value {
    let slots = &line.procedure_slots;

    // 行自身的字段原样摊平（旧版的 `...row`）—— 用我们自己的 `OrderLineDto` 序列化。
    let mut out: Map<String, Value> = match serde_json::to_value(line) {
        Ok(Value::Object(m)) => m,
        _ => Map::new(),
    };

    // 15 个 `工序N` **一定都在**（缺的补 null）—— 旧版 `enrichDoorRow` 里那句
    // `for (let i = 1; i <= 15; i++) if (!(key in output)) output[key] = null`。
    // 前端读 `row.工序5` 才不会 undefined。
    for i in 1..=SLOT_COUNT {
        let v = slots.get(slot_name(i)).cloned().unwrap_or(Value::Null);
        out.insert(slot_name(i), v);
    }

    let s = |v: &str| Value::String(v.to_string());

    out.insert("生产进度".into(), s(&build_progress_text(slots)));

    // —— 旧版有、新版暂无来源的（按旧版兜底值给，不假装有数据）——
    out.insert("procedureName".into(), s("")); //  旧版: row.procedureName || row.工序 || ''
    out.insert("procedureStatus".into(), Value::Null); // 旧版: ?? row.生产进度 ?? null
    out.insert("打单人".into(), Value::Null);
    out.insert("打单操作".into(), s(""));
    out.insert("加价项目原始数据".into(), s("null")); // ⚠️ 四字母字符串 'null'，不是 null
    out.insert("封板高".into(), json!(0)); // ⚠️ 数字 0，不是 ''
    out.insert("洞尺".into(), s(""));
    out.insert("扫码日期".into(), Value::Null); // 旧版也只在 /Qrscanner 用

    // —— 取得到的 ——
    // `单号` 是**行级**（每樘门一个），不是回执单号 —— 别搞混，见 order-no-semantics 文档。
    out.insert("单号".into(), s(&line.line_no));
    out.insert("回执单号".into(), s(&header.receipt_no));
    out.insert("客户".into(), s(&header.client_name));
    // ⚠️ 旧版这一格的兜底是**数字 0**；我们有值就给串（前端按串渲染）。
    out.insert("客户编号".into(), s(&header.client_code));
    out.insert("日期".into(), s(&header.order_date));
    out.insert("业务员".into(), s(&header.salesperson));
    out.insert("备注".into(), s(&header.remark));
    out.insert("安装地址".into(), s(&header.install_address));
    out.insert("orderNo".into(), s(&header.receipt_no));

    // ⚠️ 旧版还把**整个订单对象**挂在行上（前端有地方读 `row.order.xxx`）。
    //    新版只给前端真正会用到的那几个 —— 若以后发现别处要读，再往这里加。
    out.insert(
        "order".into(),
        json!({
            "id": header.id,
            "receipt_no": header.receipt_no,
            "client_name": header.client_name,
            "client_code": header.client_code,
        }),
    );

    Value::Object(out)
}

/// `GET /v1/progress` —— 本租户全量进度行。
///
/// ⚠️ **一次拉全量、不分页**，与旧版一致（旧版也是拉全量、前端自己筛选/分页，
/// 它确实不重新请求 —— 见 `-analysis.md` §4.1）。数据量大了两边一起改。
pub async fn get_progress(pool: &PgPool, tenant_id: i64) -> ApiResult<Value> {
    let orders = orders_service::list_with_lines(pool, tenant_id).await?;
    let mut progress_data: Vec<Value> = Vec::new();
    for (header, lines) in &orders {
        for line in lines {
            progress_data.push(build_row(header, line));
        }
    }
    Ok(json!({ "progressData": progress_data }))
}

/// `GET /v1/progress/more` —— 「查询更多」：按客户 / 安装地址 / 日期范围**再取一批进度行**。
///
/// 对应旧版 `param1=getMoreProgress&param2={ds}&param3={客户}&param4={地址}&param5={起}&param6={止}`
/// （`progress.service.ts:324`，前端调用点 `legacy/js/Progress-f4bdef35.js@118671`）。
///
/// ## 与 `GET /v1/progress` 的差别只有「筛掉哪些订单」
///
/// 旧版两个函数除了 `where` 以外**逐行相同**：都是
/// `order.findMany({where, include:{client}})` → 逐单 `buildProgressRowsForOrder` → 摊平成 `progressData`。
/// 所以这里**复用 `build_row`**（同一个函数），返回结构也与 `get_progress` 同构 ——
/// 前端一套 `ProgressRowDto` 吃两条接口。
///
/// ## 两处**有意偏离**旧版
///
/// 1. **地址筛的是订单上的 `安装地址`，不是客户档案里的 `address`。**
///    旧版写的是 `where.client = { address: { contains: address } }` —— 拿**客户档案**的地址筛，
///    却在行里显示 `customerInfo['安装地址'] ?? customerInfo['地址'] ?? client.address`
///    （`progress.service.ts:159`）。档案地址与订单地址不一致时，用户会看到「按某地址搜出来的行
///    显示的是别的地址」。新版筛**显示出来的那一格**（`orders.install_address`），
///    与 Home 的「查询更多」（`orders::service::search`）同口径。
/// 2. **不把 `ds` 传进 URL** —— 租户从登录态取，见迁移 `0021` 头注（只有一把键 `tenant_id`）。
///
/// ## 空筛选 = 全量
///
/// 旧版 `if (customer)` / `if (address)` / `if (startDate || endDate)` 都是**有才加条件**，
/// 全空时就是 `getProgress` 的结果。新版照做：四个条件都空 ⇒ 与 `GET /v1/progress` 同一批行。
///
/// ⚠️ **不做「结果集合并」**。旧版把返回行**并进**已有行集 `K2`（`Bo` 置真、`xo` 存结果集，
/// 之后搜索只在 `xo` 上做，见 `-analysis.md` §2.2 第 3 条）—— 那是**前端**的事，
/// 本接口只负责取数，与 Home 的「查询更多」一致（`Home.vue` 的 `submitQuery` 里合并）。
pub async fn get_more_progress(
    pool: &PgPool,
    tenant_id: i64,
    q: &OrderSearchQuery,
) -> ApiResult<Value> {
    let pairs = orders_service::list_with_lines_filtered(
        pool,
        tenant_id,
        q.client_name.as_deref(),
        q.install_address.as_deref(),
        q.start_date.as_deref(),
        q.end_date.as_deref(),
    )
    .await?;

    let mut progress_data: Vec<Value> = Vec::new();
    for (header, lines) in &pairs {
        for line in lines {
            progress_data.push(build_row(header, line));
        }
    }
    Ok(json!({ "progressData": progress_data }))
}

// ===== 写：更新进度 =====

/// `slot` 必须是 `工序1`..`工序15` 之一。
///
/// 旧版**不校验**这个（前端传什么就写什么键），于是能往行上写出 `{"foo": "..."}` 这种野键。
/// 新版**卡住**：槽号越界或格式不对直接 400 —— 见 `-analysis.md` §10「有意偏离」。
fn valid_slot(slot: &str) -> bool {
    let Some(n) = slot.strip_prefix("工序") else {
        return false;
    };
    n.parse::<usize>()
        .map(|i| (1..=SLOT_COUNT).contains(&i))
        .unwrap_or(false)
}

/// `POST /v1/progress/update` 的结果。
pub struct UpdateOutcome {
    /// 实际写掉的行数。
    pub updated: u64,
    /// 请求里 `line_nos` 中**本租户内一行都没对上**的那些（trim + 去重后原样回）。
    ///
    /// ★ **字段名照旧版**：`progress.service.ts:598` 那个 `failed` Set，语义逐字相同
    /// （「这些 ref 一个都没匹配上」），前端 `api.updateProgress` 按 `failed` 读。
    /// ⚠️ 只统计 `line_nos` —— `line_ids` 是调用方从服务端拿的，对不上属于调用方自己的 bug，
    /// 不在这里兜。
    pub failed: Vec<String>,
}

/// 更新若干行的某个工序槽。
///
/// ## 收「行 id」**也**收「行级单号」
///
/// 旧版 `updataProgress`（`progress.service.ts:599`）的 body 是**一组 ref**，
/// `normalizeRefs` + `rowRefs` 两边都会去认 id / 单号 / 回执单号 / orderNo —— 也就是说
/// **调用方给 id 或给单号都行**。新版沿用这个「二选一」，但收窄成两个**各自明确**的字段：
///
/// · `line_ids`：`order_lines.id`
/// · `line_nos`：**行级单号** `order_lines.line_no`（`12-26/09/19`），即二维码里装的那个
///
/// 两个都给 ⇒ **取并集**。两个都空 ⇒ 400。
///
/// ★ 为什么必须有 `line_nos`：`/Qrscanner` 的「确认」手里**只有扫出来的单号**
/// （`POST /v1/progress/update` 收的是行 id），而它又**不能**再去拉全量自己建
/// 「单号 → 行 id」的表 —— 那是把整厂门行发给车间工人的手机（见本文件
/// 「扫码查单 + 扫码统计」那一节）。让服务端按单号解析，省掉一次往返，也不多暴露一行数据。
///
/// ⚠️ **有意比旧版窄**：旧版把 `回执单号` / `orderNo` 也当成能匹配的 ref ⇒ 传一个**订单号**
/// 会把那张单**所有行**一起改掉。那是旧版的脚枪（同一个字段两种粒度），新版**只认行级单号**，
/// 传回执单号 ⇒ 一个都匹配不上、进 `failed`。真要对整单操作，应当显式列出行 id。
///
/// ## 语义：**一律覆盖**
///
/// 旧版是 `slot == '工序10' ? mergePrintStatus(旧值, 新值) : 新值` —— **只有工序10 合并**，
/// 其余 14 槽覆盖。那个特判和「前端把『回款』硬塞进工序10」是耦合的，
/// 实测能写出 `工序10="回款_回款_李四_2026-09-20"` 的脏数据。
/// 新版**两处一起去掉**（见 `-analysis.md` §10）⇒ 这里就是覆盖，没有例外。
///
/// ## 没做的两件（旧版有）
///
/// · **不写 `扫码员工`/`扫码日期`** —— 旧版 `parseScanMarker(新值)` 命中时会顺带写这两个字段，
///   我们新模型里没有它们（全仓只有 `/Qrscanner` 用）。
/// · **不落 `progress` 记录表** —— 旧版还会 upsert 一张 `progress` 表给统计用；我们还没做看板，
///   等做看板时再定要不要。
///
/// ## 也不重算「生产进度」串
///
/// 旧版写完会 `withProgressText()` 把串**存回行**。我们**读的时候现算**
/// （`build_progress_text`）—— 存的串会跟槽不同步，现算不会。这是**有意偏离**。
pub async fn update_progress(
    pool: &PgPool,
    tenant_id: i64,
    req: &ProgressUpdateInput,
) -> ApiResult<UpdateOutcome> {
    if !valid_slot(&req.slot) {
        return Err(ApiError::bad_request(&format!(
            "槽名不对：{}（应为 工序1 .. 工序{SLOT_COUNT}）",
            req.slot
        )));
    }

    // 请求里的单号：trim + 去空 + 去重（旧版 `normalizeRefs` 也是先 trim 再 `new Set`）。
    let wanted_nos: Vec<String> = {
        let mut v: Vec<String> = req
            .line_nos
            .iter()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        v.sort();
        v.dedup();
        v
    };

    if req.line_ids.is_empty() && wanted_nos.is_empty() {
        return Err(ApiError::bad_request(
            "没有要更新的行（line_ids 与 line_nos 至少给一个）",
        ));
    }

    // 单号 → 行 id。**一个单号可能命中多行**（旧版同样按 ref 命中所有行，不去重取首个），
    // 所以这里把命中的 id 全收进来 —— 只取第一条会让「同号两行」的另一行静默漏改。
    let mut ids: Vec<i64> = req.line_ids.clone();
    let mut failed: Vec<String> = Vec::new();
    if !wanted_nos.is_empty() {
        let found: Vec<(String, i64)> = sqlx::query_as(
            "SELECT btrim(line_no), id FROM order_lines \
             WHERE tenant_id = $1 AND btrim(line_no) = ANY($2)",
        )
        .bind(tenant_id)
        .bind(&wanted_nos)
        .fetch_all(pool)
        .await?;

        // 先把命中的单号挑出来（`found` 随即被消费掉，所以不能借用它）。
        let hit: std::collections::HashSet<String> =
            found.iter().map(|(no, _)| no.clone()).collect();
        ids.extend(found.into_iter().map(|(_, id)| id));
        failed = wanted_nos
            .iter()
            .filter(|no| !hit.contains(no.as_str()))
            .cloned()
            .collect();
    }

    if ids.is_empty() {
        // 给了单号但一个都没解析出来（且没给 id）⇒ **400**，不是「200 + updated:0」。
        // 逐字对齐旧版 `progress.service.ts:655`：
        //   `if (failed.size > 0 && totalUpdated === 0) return { code: 400, … }`
        // 旧版把「一个 ref 都不存在」当**输入有问题**、把「部分命中」当正常结果 ——
        // 新版沿用这个划分（也与本端点「空入参 400」同口径）。
        // ⚠️ 上一版 handler 的注释曾写成「一律 200」，与这里不符，已改正（2026-09-19）。
        return Err(ApiError::bad_request("没有要更新的行"));
    }

    // `jsonb_set(target, '{槽名}', 新值, true)` —— 第四个参数 true = 键不存在就建。
    // ⚠️ 租户隔离在 WHERE 里：`line_ids` 是调用方能随便造的，不能靠上面那次解析兜。
    let r = sqlx::query(
        "UPDATE order_lines \
         SET procedure_slots = jsonb_set(procedure_slots, ARRAY[$1], to_jsonb($2::text), true), \
             updated_at = now() \
         WHERE tenant_id = $3 AND id = ANY($4)",
    )
    .bind(&req.slot)
    .bind(&req.value)
    .bind(tenant_id)
    .bind(&ids)
    .execute(pool)
    .await?;

    Ok(UpdateOutcome {
        updated: r.rows_affected(),
        failed,
    })
}

// ===== /Qrscanner：标签数据 =====

/// `POST /v1/scan/labels` —— 标签云打印要的数据。
///
/// 对应旧版 `param1=getLabelData`（`progress.service.ts:490`）。
///
/// ## ★ 匹配口径：按**行级单号**，**不照抄旧版的订单级 `orderNo`**
///
/// 旧版这个接口**自相矛盾**：前端传上来的 `refs` 是**行级** `单号`（二维码里装的就是它，
/// 见分析文档 §3.1），可服务端却拿它去 **`orderNo`（订单号）** 上过滤 ——
///
/// ```ts
/// prisma.order.findMany({ where: { databaseName, orderNo: { in: wanted } } })
///   .then(orders => orders.flatMap(o => doorRowsFromSpecs(parseSpecs(o.doorSpecs)).map(labelRow)))
/// ```
///
/// 于是：① 绝大多数情况下**一个订单号都不等于某个行级单号** ⇒ 打不出标签；
/// ② 万一撞上了，返回的是**那张单的全部行**（不是选中的那几行）⇒ 多打。
/// 同一份源码里的 `getScanQrCode` 用的却是 `row['单号']`（行级）—— **两个接口自己都对不上**。
///
/// 新版统一到**行级**（`order_lines.line_no`，`orders::service::find_lines_by_no`）。
/// 理由：**打印出来的二维码，扫出来应当还是同一件事** —— 码里装的是行级单号，
/// 那么「按码打标签」也必须按行级单号找行，否则扫码链路首尾不是同一个键。
///
/// ## 返回结构：整行，不是旧版 `labelRow` 的 18 个中文键投影
///
/// 与 `GET /v1/progress` 用**同一个 `build_row`** ⇒ 前端一套 `ProgressRowDto` 吃两条接口。
/// 理由：
/// · 旧版那 18 个键（单号/型材/门洞宽/…）是「当时那个打印模板恰好用到的字段」的快照，
///   不是业务边界；新版前端要自己算**标签张数**（旧版 `za`：按 `扇数` 查表 × `数量`、
///   按 `亮窗总高`/`墙厚` 加数、再叠一堆租户名硬编码），算张数要读的字段比 18 个只多不少。
/// · 投影的键是**中文**，而新版全栈统一用英文键（`profile`/`door_width`…）
///   —— `Progress.vue` 的文件头已经写明这条口径。多一套中文键 = 多一个真相源。
///
/// ⚠️ **旧版 `labelRow` 里根本没有 `套线单价`**，所以旧版 `za` 那句
/// `Number(t3["套线单价"]||0) > 0 && (l3 += p2)`（移门的 `diao_tabs.add`）**永远是 false**
/// —— 是条死分支。新版若照抄「按 `套线单价` 加张数」，必须自己决定这个字段从哪来，
/// 别以为旧版在算它。
///
/// ## 不做的事
///
/// · **不做云打印。** 旧版这条链路的后半截是 `transitPrintSingle(templateId, rows, …)`
///   —— 那是**打印服务**（走 hiprint socket 推给客户端），不是数据接口。本模块只负责给数据。
/// · 与旧版一样：**空入参返回空列表**（不是 400）—— 旧版 `wanted.length === 0` 时
///   返回 `{code:200, data:[]}`；这是读接口，空 = 没有东西可打，不是调用方的错。
///   前端本来也先判 `et2.length > 0`（「没有选中的单号可打印」）。
pub async fn label_data(pool: &PgPool, tenant_id: i64, line_nos: &[String]) -> ApiResult<Value> {
    let pairs = orders_service::find_lines_by_no(pool, tenant_id, line_nos).await?;
    let rows: Vec<Value> = pairs.iter().map(|(h, l)| build_row(h, l)).collect();
    Ok(json!({ "rows": rows }))
}

// ===== /Qrscanner：扫码查单 + 扫码统计（两条**窄**接口）=====
//
// ## 为什么这两条要单独开，而不是「前端拉全量自己筛」
//
// 第一版把这两件事做成了「前端拉 `GET /v1/progress` 全量、客户端过滤」。**那是错的**：
// `/Qrscanner` 是**装在车间工人自己手机上**的页面，拉全量等于把**整厂**的门行
// （客户名、金额、安装地址）发到每一台扫码手机里，而工人这一次只该看到**他扫到的那几行**。
//
// 旧版正是窄的：扫码一次 = 请求一次 = 只回命中的行（`getScanQRcode`）、
// 统计一次 = 只回范围内的行（`getProcessCounts`）。这两条接口就是**回到旧版那个形状**。
//
// ## 与 `GET /v1/progress` 的关系
//
// 行结构**完全同构**（同一个 [`build_row`]），只是多了「现推」出来的 `扫码日期`（见下）。
// 前端一套 `ProgressRowDto` 吃三条接口。

/// 一行上的「扫码员工 / 扫码日期」。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScanMarker {
    /// 值里中间那一段（旧版 `parseScanMarker` 的 `m[1]`，**不去空白**）。
    pub employee: String,
    /// 值里末段，恒为 `YYYY-MM-DD`。定长零填充 ⇒ 字符串比较与日期比较等价。
    pub date: String,
}

/// JS 正则里 `.` **不匹配**的四个行终止符。
///
/// 逐字对齐 JS 语义：`.` = 「除行终止符外的任意字符」。不照抄这一条的话，
/// 「员工名里带换行」的值我们会匹配、旧版不匹配 —— 是分叉，不是简化。
fn is_js_line_terminator(c: char) -> bool {
    matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}')
}

/// `YYYY-MM-DD` 的**形状**（只查形状，不查是不是真日子 → 见 [`is_calendar_date`]）。
fn is_ymd_shape(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b.iter().enumerate().all(|(i, c)| {
            if i == 4 || i == 7 {
                true
            } else {
                c.is_ascii_digit()
            }
        })
}

fn is_leap(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn days_in_month(y: i32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap(y) => 29,
        2 => 28,
        _ => 0,
    }
}

/// `YYYY-MM-DD` 且**是个真日子**。
///
/// 旧版走的是 JS `new Date(str)` + `parseDate`：ISO 形状但日子越界（`2026-02-31`）
/// 会得到 `Invalid Date` ⇒ `parseDate` 回 `null` ⇒ 400。这里逐条对齐那个结果。
///
/// ⚠️ **有意比旧版严**：非零填充的 `2026-9-19` 旧版会走 JS 的非 ISO 兜底解析
/// （按**本地时区**解释，再 `toISOString()` 转回 UTC ⇒ 东八区会**倒退一天**），
/// 这里直接判非法。前端 `ymdOf()` 发出来的本来就是零填充的，那条兜底只会帮倒忙。
fn is_calendar_date(s: &str) -> bool {
    if !is_ymd_shape(s) {
        return false;
    }
    let y: i32 = s[0..4].parse().unwrap_or(0);
    let m: u32 = s[5..7].parse().unwrap_or(0);
    let d: u32 = s[8..10].parse().unwrap_or(0);
    d >= 1 && d <= days_in_month(y, m)
}

/// 从一段工序槽值里解析「扫码员工 / 扫码日期」—— 旧版 `parseScanMarker`
/// （`progress.service.ts:116`）的**手写等价实现**。
///
/// 原正则逐字是：
///
/// ```ts
/// String(value ?? '').trim().match(/_(.+)_(\d{4}-\d{2}-\d{2})$/)
/// ```
///
/// ★ **要两个下划线**才匹配，这一条决定了整个看板的口径：
/// · `/Qrscanner` 提交的值 = `工序名_员工名_日期`（两个下划线）→ **匹配**；
/// · `/Progress` 页提交的值 = `工序名_日期`（一个下划线）→ **不匹配**。
/// ⇒ **扫码统计的是「扫码页干过的活」，不是「任何一次进度写入」**（分析文档 §8.6-(b)）。
///
/// ## 为什么手写而不是引 `regex` 依赖
///
/// 锚在末尾的这条正则，能匹配的形态是**唯一**的：`.+` 贪婪 ⇒ 中间段一定取到
/// **最后一个** `_` 之前。所以「先认尾部 `_YYYY-MM-DD`、再从左往右找第一个
/// 能让中间段非空且不含行终止符的 `_`」与正则**逐例等价**（含
/// `a_b_c_王五_2026-09-20` 这种中间带下划线的），不值得为它多背一个依赖。
/// 等价性由下面 `parse_scan_marker_matches_legacy_regex` 那张逐例表钉住。
///
/// ⚠️ `trim` 用的是 Rust 的 `char::is_whitespace`（Unicode `White_Space`），
/// 与 JS 的 `String.prototype.trim` 只差 `U+FEFF` 这类零宽字符 —— 实际数据到不了那儿。
pub fn parse_scan_marker(value: &Value) -> Option<ScanMarker> {
    let text = match value {
        Value::String(s) => s.trim(),
        // 旧版 `String(value ?? '')` 对 null/undefined 给 `''`（不匹配）。
        // 其余类型（数字/对象）旧版会先转成字符串再匹配，但本表的槽**只可能是
        // 字符串或 null**（`update_progress` 绑的是 `$2::text`）⇒ 一律当无标记。
        _ => return None,
    };

    let bytes = text.as_bytes();
    // 最短也要 `_` + 中间段(≥1) + `_` + 日期(10) = 12 字节。
    if bytes.len() < 12 {
        return None;
    }
    // 日期前面那个 `_`。它在字节串里的位置是唯一的：日期必须**贴着串尾**。
    let sep = bytes.len() - 11;
    if bytes[sep] != b'_' {
        return None;
    }
    // `bytes[sep] == b'_'` 是 ASCII ⇒ `sep + 1` 一定是字符边界。
    let date = &text[sep + 1..];
    if !is_ymd_shape(date) {
        return None;
    }

    // 正则从**最左**能匹配的起点开始 ⇒ 第一个「中间段非空且不含行终止符」的 `_`。
    for (i, c) in text[..sep].char_indices() {
        if c != '_' {
            continue;
        }
        let employee = &text[i + 1..sep];
        if employee.is_empty() || employee.chars().any(is_js_line_terminator) {
            continue;
        }
        return Some(ScanMarker {
            employee: employee.to_string(),
            date: date.to_string(),
        });
    }
    None
}

/// 从一整行的 15 个槽里**现推**这一行的「扫码员工 / 扫码日期」（旧版没有这一步 ——
/// 它是把这些值**存**在门行上的）。
///
/// 口径：**取日期最大的那条**，员工取同一条的中间段。
/// `YYYY-MM-DD` 定长零填充 ⇒ 字符串比较即日期比较。
///
/// ⚠️ 与旧版「最后一次写入的解析结果」在**乱序写入 / 补录**时会分叉
/// （补录一条旧工序，旧版会把 `扫码日期` 倒退回去，现推不会）—— 这是**有意选择**，
/// 理由见 `docs/2026-09-19-qrscanner-analysis.md` §8.6-(b)：加列只在「下一次写入」时
/// 才被填上，历史行永远是空；而槽里的值本来就带着员工和日期。
pub fn derive_scan_marker(slots: &Value) -> Option<ScanMarker> {
    let mut best: Option<ScanMarker> = None;
    for i in 1..=SLOT_COUNT {
        let Some(m) = parse_scan_marker(&slots.get(slot_name(i)).cloned().unwrap_or(Value::Null))
        else {
            continue;
        };
        // 严格大于 ⇒ 并列时保留**槽号小的**那条（与前端 `deriveScanMarker` 一致）。
        if best.as_ref().map(|b| m.date > b.date).unwrap_or(true) {
            best = Some(m);
        }
    }
    best
}

/// 旧版 `getProcessCounts` 里 `operatorName === '1'` 那个哨兵值 = **全部员工**。
pub const ALL_EMPLOYEES: &str = "1";

/// 日期标签 → `[起, 止]`（闭区间）—— 旧版 `resolveDateLabel`（`progress.service.ts:526`）。
///
/// 三个档位的口径逐字照抄：`当天` = 今天~今天；`本周` = **周一**~今天；
/// `本月` = 月初~今天。其余标签**原样透传**（旧版 `default` 分支），即当成 `"起,止"` 用。
///
/// ⚠️ `本周` 的起点是**周一** —— 旧版那句 `today.getDay() || 7` 把周日算 7、
/// 周一算 1。传入的三个锚点由 SQL 的 `ISODOW` 给出（同样是周一=1）。
fn resolve_date_label(label: &str, today: &str, week_start: &str, month_start: &str) -> String {
    match label {
        "当天" => format!("{today},{today}"),
        "本周" => format!("{week_start},{today}"),
        "本月" => format!("{month_start},{today}"),
        other => other.to_string(),
    }
}

/// 「今天 / 本周一 / 本月初」三个锚点，**从数据库取**。
///
/// 为什么不自己算：本后端没有日期库（`Cargo.toml` 里没 chrono），而**库本身就是
/// 这个系统的时间基准** —— `order_date` 的默认值就是 `CURRENT_DATE`（`orders/service.rs`
/// 多处），财务的「近 N 天」也用它。看板跟着同一个时钟走，才不会出现
/// 「订单日期按库算、扫码统计按进程算」这种一天之内的口径撕裂。
///
/// `EXTRACT(ISODOW …)` 与旧版 `getDay() || 7` 同口径：周一=1 … 周日=7。
///
/// **时区**：`CURRENT_DATE` 取的是**库会话的时区**。本服务已把每条连接的会话时区
/// 设成 `DB_TIMEZONE`（默认 `Asia/Shanghai`），见 `core/db.rs` —— 所以这里的
/// `当天` 就是**北京的当天**，凌晨 00:00 翻篇。库本身的时区（可能是 UTC）**不再相关**。
/// 在这里自己 `now()` 减 8 小时反而会造出**第三个**时间基准，不要那么干。
async fn date_anchors(pool: &PgPool) -> ApiResult<(String, String, String)> {
    let row: (String, String, String) = sqlx::query_as(
        "SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD'), \
                to_char(CURRENT_DATE - (EXTRACT(ISODOW FROM CURRENT_DATE)::int - 1), 'YYYY-MM-DD'), \
                to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-DD')",
    )
    .fetch_one(pool)
    .await?;
    Ok(row)
}

/// 构造一行扫码接口的返回行 = [`build_row`] + **现推出来的 `扫码日期`**。
///
/// 只有 `扫码日期`，**不给 `扫码员工`**：旧版行上确实两个键都有，但 `扫码员工`
/// **从来没上过屏**（`docs/2026-09-19-qrscanner-analysis.md` §8.6-(b) 的表，两个
/// 前端 chunk 里 0 命中），它只作服务端的筛选键 —— 筛已经在服务端做完了，
/// 再发一份给手机没有用处。行里没标记时 `扫码日期` 保持 `build_row` 的 `null`。
fn scan_row(header: &OrderHeaderRow, line: &OrderLineDto) -> Value {
    let mut v = build_row(header, line);
    if let (Some(m), Value::Object(map)) = (derive_scan_marker(&line.procedure_slots), &mut v) {
        map.insert("扫码日期".into(), Value::String(m.date));
    }
    v
}

/// `GET /v1/scan/qrcode` —— 扫码 / 手动查单：**只回命中这个单号的那几行**。
///
/// 对应旧版 `param1=getScanQRcode&param3={扫到的文本}`（`progress.service.ts:511`，
/// 派发点 `legacy-dispatch.ts:789`）。
///
/// ## 匹配口径
///
/// 拿 `code` 去**行级单号**（`order_lines.line_no`，也就是二维码里装的那个）上
/// **trim 后精确相等** —— 逐字照抄旧版的 `wantedSet.has(String(row['单号']).trim())`，
/// 不是 `includes`、不是前缀。落库查询见 `orders::service::find_lines_by_no`。
///
/// `code` 允许**逗号分隔**（旧版 REST 路由 `GET /progress/qrcode?orderNo=a,b` 就是拆逗号，
/// 见 `progress.routes.ts:56`；dispatch 那条只传单个值）—— 两条路在旧版里都有，取并集。
///
/// ## 三种输入 / 两种出口
///
/// | 情况 | 返回 |
/// |---|---|
/// | `code` 为空/全空白 | **200 + 空列表**（旧版 `wanted.length === 0` 那一支） |
/// | 有 `code` 但一行都没命中 | **404 `未找到相关订单`**（旧版 `{code:404,…}`，前端走 error 分支） |
/// | 命中 | 200 + 命中的行 |
///
/// ⚠️ 「空入参给 200 而不是 400」与 [`label_data`] 同口径：这是**读**接口，
/// 「没有东西可查」不是调用方的错。前端本来也先判空（`if (!wanted) return`）。
///
/// ⚠️ 404 的**响应体形状**与旧版不同：旧版是 `{code:404,message:'未找到相关订单'}`，
/// 新版全站统一 `{"error":{"code":"not_found","message":"…"}}` —— 状态码与那句话照抄，
/// 信封跟着本项目的统一约定走。
pub async fn scan_qrcode(pool: &PgPool, tenant_id: i64, code: &str) -> ApiResult<Value> {
    let wanted: Vec<String> = code
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    if wanted.is_empty() {
        return Ok(json!({ "rows": [] }));
    }

    let pairs = orders_service::find_lines_by_no(pool, tenant_id, &wanted).await?;
    if pairs.is_empty() {
        return Err(ApiError::not_found("未找到相关订单"));
    }
    let rows: Vec<Value> = pairs.iter().map(|(h, l)| scan_row(h, l)).collect();
    Ok(json!({ "rows": rows }))
}

/// `GET /v1/scan/stats` —— 扫码统计：**只回范围内的行**。
///
/// 对应旧版 `param1=getProcessCounts&param3={员工}&param4={当天|本周|本月|"起,止"}`
/// （`progress.service.ts:558`，派发点 `legacy-dispatch.ts:790`）。
///
/// ## 筛法（逐条对旧版 `:583-589`）
///
/// 逐行**现推**扫码标记（见 [`derive_scan_marker`]）：
/// 1. **没有标记的行一律不进** —— `continue`。这一条是本看板与 `/Progress` 看板
///    最大的口径差别：它只统计**扫码页干过的活**（正则要两个下划线，见
///    [`parse_scan_marker`]）。
/// 2. 日期不在 `[起, 止]` 闭区间 → 不进（`YYYY-MM-DD` 直接比字符串，等价于比日期）。
/// 3. `employee != "1"` 时，标记里的员工名（trim 后）不等于 `employee` → 不进。
///    旧版比较的是**存进 `扫码员工`**那一格的值，且读出来先 `.trim()`（`:585`），
///    所以这里也对齐「两边都 trim 过」；旧版那句 `|| row['员工']` 兜底拿的是另一个
///    键（前端从来没写过），新版模型里没有它，不做。
///
/// ## 两处**有意偏离**
///
/// 1. **缺参数是 400，不是旧版的 500。** 旧版 `!operatorName || !dateRange` 时回的是
///    `{__statusCode:500, __html:true, message:'missing params'}` —— 一段给浏览器看的
///    裸 HTML 错误。那是运维事故现场，不是契约。
/// 2. **日期非法是 400 + 中文原因**，状态码与旧版一致（旧版 `:400`），只是把
///    Go 风格的 `time data '…' does not match format '%Y-%m-%d'` 换成说人话的提示。
/// 3. **`起,止` 只切一刀**（`splitn(2)`）：`a,b,c` 会被当成「止 = `b,c`」⇒ 400。
///    旧版是 `split(',')` 后只取前两段、**把多余的静默丢掉**，一个手滑就查了个别的区间
///    还不报错。三段的输入是调用方的 bug，宁可让它响。
///
/// ## SQL 拉全租户、但**返回**是窄的
///
/// 筛法要用到「15 槽取日期最大那条」这个逻辑，塞进 SQL 只会把同一个口径写成两份。
/// 所以照旧 `list_with_lines` 全取、在 Rust 里筛 —— **发到手机上的只有命中行**，
/// 这正是本次要修的那件事。（数据量真上来了再谈下推，那时两边一起改。）
pub async fn scan_stats(
    pool: &PgPool,
    tenant_id: i64,
    employee: &str,
    range: &str,
) -> ApiResult<Value> {
    let employee = employee.trim();
    let range = range.trim();
    if employee.is_empty() {
        return Err(ApiError::bad_request(
            "缺少 employee 参数（员工名；1 = 全部员工）",
        ));
    }
    if range.is_empty() {
        return Err(ApiError::bad_request(
            "缺少 range 参数（当天 / 本周 / 本月 / 起,止）",
        ));
    }

    let (today, week_start, month_start) = date_anchors(pool).await?;
    let resolved = resolve_date_label(range, &today, &week_start, &month_start);
    let mut parts = resolved.splitn(2, ',');
    let start = parts.next().unwrap_or("").trim().to_string();
    // 旧版 `parseDate(endText || startText)`：只给一个日期时起止同一天。
    let end = parts.next().unwrap_or("").trim();
    let end = if end.is_empty() {
        start.clone()
    } else {
        end.to_string()
    };

    if !is_calendar_date(&start) || !is_calendar_date(&end) {
        return Err(ApiError::bad_request(&format!(
            "获取扫码统计数据异常: 日期 `{resolved}` 不是 YYYY-MM-DD 格式"
        )));
    }

    let orders = orders_service::list_with_lines(pool, tenant_id).await?;
    let mut progress_data: Vec<Value> = Vec::new();
    for (header, lines) in &orders {
        for line in lines {
            let Some(m) = derive_scan_marker(&line.procedure_slots) else {
                continue;
            };
            // 旧版 `const scanDate = parseDate(row['扫码日期']); if (!scanDate) continue;`
            // —— 标记里那个日期**本身得是个真日子**（`2026-13-45` 这种形状对、
            // 日子非法，JS `new Date` 给 Invalid Date）。少了这一步，脏数据会被
            // 字符串比较放进某个区间里，与旧版分叉。
            if !is_calendar_date(&m.date) {
                continue;
            }
            if m.date < start || m.date > end {
                continue;
            }
            if employee != ALL_EMPLOYEES && m.employee.trim() != employee {
                continue;
            }
            progress_data.push(scan_row(header, line));
        }
    }
    Ok(json!({ "progressData": progress_data }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn slots(pairs: &[(&str, &str)]) -> Value {
        let mut m = Map::new();
        for (k, v) in pairs {
            m.insert((*k).to_string(), Value::String((*v).to_string()));
        }
        Value::Object(m)
    }

    /// [`parse_scan_marker`] 与旧版正则**逐例**等价。
    ///
    /// 右边那一列是拿旧服务端源码里那个正则
    /// （`/_(.+)_(\d{4}-\d{2}-\d{2})$/`，`progress.service.ts:118`）**在 node 里真跑出来**的，
    /// 不是照着读一遍写下来的。前 8 条与 `docs/qrscanner-scan-logiccheck.mjs` 的夹具同一批
    /// （那份差分台比的是「旧版真代码 vs 前端 `scanStats.ts`」，这份比的是「旧版真代码 vs 本函数」）。
    #[test]
    fn parse_scan_marker_matches_legacy_regex() {
        let cases: &[(&str, Option<(&str, &str)>)] = &[
            ("下料_李四_2026-09-19", Some(("李四", "2026-09-19"))),
            // 一个下划线（/Progress 页提交的形状）→ 不匹配
            ("下料_2026-09-19", None),
            // ★ 员工名里的**普通空格**：`.+` 匹配（换 `\S+` 就不匹配了）
            ("下料_李 四_2026-09-19", Some(("李 四", "2026-09-19"))),
            // 中间段为空 → `.+` 要至少一个字符
            ("__2026-09-19", None),
            ("_2026-09-19", None),
            ("_李四_2026-09-19", Some(("李四", "2026-09-19"))),
            ("下料__2026-09-19", None),
            // 月份不是两位 → 不匹配
            ("下料_李四_2026-9-19", None),
            // 尾部空白：先 trim → 匹配
            ("下料_李四_2026-09-19 ", Some(("李四", "2026-09-19"))),
            ("　下料_李四_2026-09-19　", Some(("李四", "2026-09-19"))),
            // 中间段可以带下划线：`(.+)` 贪婪 ⇒ 取**最后**一个 `_` 之前
            ("a_b_c_王五_2026-09-20", Some(("b_c_王五", "2026-09-20"))),
            (
                "a_2026-09-19_2026-09-20_2026-09-21",
                Some(("2026-09-19_2026-09-20", "2026-09-21")),
            ),
            (
                "下料_李四_2026-09-19_2026-09-20",
                Some(("李四_2026-09-19", "2026-09-20")),
            ),
            ("x_下料_李四_2026-09-19", Some(("下料_李四", "2026-09-19"))),
            // 全角空格是 `.` 能匹配的普通字符（**不是**行终止符）
            ("下料_　_2026-09-19", Some(("　", "2026-09-19"))),
            // ★ 四个行终止符：JS 的 `.` 一个都不匹配 ⇒ 整串不匹配
            ("下料_李\n四_2026-09-19", None),
            ("下料_李\r四_2026-09-19", None),
            ("下料_李\u{2028}四_2026-09-19", None),
            ("下料_李\u{2029}四_2026-09-19", None),
            // 日期不贴着串尾
            ("下料_李四_2026-09-19x", None),
            ("下料_李四_2026-09-19_2026-09-19 张", None),
            ("下料_李四_\n2026-09-19", None),
            // 形状对但日子非法 —— 本函数**照样匹配**（等价于旧正则）；
            // 「是不是真日子」是 `getProcessCounts` 那边的另一道检查，见 `is_calendar_date`
            ("下料_李四_2026-13-45", Some(("李四", "2026-13-45"))),
            ("下料_李四_2026-02-31", Some(("李四", "2026-02-31"))),
            ("", None),
            ("2026-09-19", None),
            ("x_2026-01-01", None),
        ];

        for (input, want) in cases {
            let got = parse_scan_marker(&Value::String((*input).to_string()));
            let want = want.map(|(e, d)| ScanMarker {
                employee: e.to_string(),
                date: d.to_string(),
            });
            assert_eq!(got, want, "输入 {input:?}");
        }

        // 非字符串的槽值：null / 数字 / 对象一律当「没有标记」
        // （旧版 `String(value ?? '')` 对 null 给 `''`；数字那类在本表根本写不进来）
        for v in [Value::Null, json!(0), json!({ "a": 1 }), json!(["x"])] {
            assert_eq!(parse_scan_marker(&v), None, "非字符串槽值 {v}");
        }
    }

    /// 现推取**日期最大**的那条；并列时保留**槽号小的**（与前端 `deriveScanMarker` 一致）。
    #[test]
    fn derive_scan_marker_takes_the_latest_date() {
        // 乱序写入：槽 2 是较早的日期，槽 9 是最新的 → 取槽 9
        let s = slots(&[
            ("工序2", "下料_李四_2026-09-10"),
            ("工序9", "组装_王五_2026-09-18"),
            ("工序1", "下料_张三_2026-09-15"),
        ]);
        assert_eq!(
            derive_scan_marker(&s),
            Some(ScanMarker {
                employee: "王五".into(),
                date: "2026-09-18".into()
            })
        );

        // 同一天的两条：严格大于 ⇒ 先遇到的那个（槽号小的）留下
        let s = slots(&[
            ("工序5", "组装_王五_2026-09-18"),
            ("工序3", "下料_李四_2026-09-18"),
        ]);
        assert_eq!(
            derive_scan_marker(&s),
            Some(ScanMarker {
                employee: "李四".into(),
                date: "2026-09-18".into()
            })
        );

        // 一个标记都没有（/Progress 页写的那种单下划线值不算）
        let s = slots(&[("工序1", "下料_2026-09-19"), ("工序2", "")]);
        assert_eq!(derive_scan_marker(&s), None);
        assert_eq!(derive_scan_marker(&Value::Object(Map::new())), None);
        // 空槽是 `null` 也照样不炸
        assert_eq!(derive_scan_marker(&json!({ "工序1": null })), None);
    }

    /// 日期标签 → 起止区间（旧版 `resolveDateLabel`）。
    #[test]
    fn resolve_date_label_matches_legacy() {
        let (today, mon, first) = ("2026-09-19", "2026-09-14", "2026-09-01");
        assert_eq!(
            resolve_date_label("当天", today, mon, first),
            "2026-09-19,2026-09-19"
        );
        assert_eq!(
            resolve_date_label("本周", today, mon, first),
            "2026-09-14,2026-09-19"
        );
        assert_eq!(
            resolve_date_label("本月", today, mon, first),
            "2026-09-01,2026-09-19"
        );
        // 其它标签原样透传（旧版 `default` 分支）—— 由下面那步再拆成「起,止」
        assert_eq!(
            resolve_date_label("2026-01-01,2026-02-02", today, mon, first),
            "2026-01-01,2026-02-02"
        );
        assert_eq!(
            resolve_date_label("2026-01-01", today, mon, first),
            "2026-01-01"
        );
    }

    /// `YYYY-MM-DD` 的形状 + 真日子；旧版是 `new Date(str)` + `parseDate`（非法 → 400）。
    #[test]
    fn date_validation_matches_legacy_parse_date() {
        for ok in [
            "2026-09-19",
            "2024-02-29",
            "2000-02-29",
            "0000-01-01",
            "2026-12-31",
        ] {
            assert!(is_calendar_date(ok), "{ok} 应当合法");
        }
        for bad in [
            "2026-02-30", // 形状对、日子越界（JS `new Date` 给 Invalid Date）
            "2026-02-31",
            "2026-13-01", // 月份越界
            "2026-00-10",
            "2026-09-00",
            "1900-02-29", // 1900 不是闰年（百年不闰）
            "2026-9-19",  // 非零填充（旧版会走 JS 的兜底解析并**倒退一天**，有意判非法）
            "2026/09/19",
            "2026-09-19 ",
            "",
            "今天",
            "2026-09-19T00:00:00Z",
        ] {
            assert!(!is_calendar_date(bad), "{bad} 应当非法");
        }
    }
}
