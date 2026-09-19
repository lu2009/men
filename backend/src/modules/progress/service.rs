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
    let rows: Vec<(String, String, String)> =
        sqlx::query_as("SELECT slot, name, color FROM procedures WHERE tenant_id = $1 AND name <> ''")
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
pub async fn set_procedures(
    pool: &PgPool,
    tenant_id: i64,
    req: &ProceduresInput,
) -> ApiResult<()> {
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
    let Some(n) = slot.strip_prefix("工序") else { return false };
    n.parse::<usize>().map(|i| (1..=SLOT_COUNT).contains(&i)).unwrap_or(false)
}

/// 更新若干行的某个工序槽。
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
) -> ApiResult<u64> {
    if !valid_slot(&req.slot) {
        return Err(ApiError::bad_request(&format!(
            "槽名不对：{}（应为 工序1 .. 工序{SLOT_COUNT}）",
            req.slot
        )));
    }
    if req.line_ids.is_empty() {
        return Err(ApiError::bad_request("没有要更新的行"));
    }

    // `jsonb_set(target, '{槽名}', 新值, true)` —— 第四个参数 true = 键不存在就建。
    let r = sqlx::query(
        "UPDATE order_lines \
         SET procedure_slots = jsonb_set(procedure_slots, ARRAY[$1], to_jsonb($2::text), true), \
             updated_at = now() \
         WHERE tenant_id = $3 AND id = ANY($4)",
    )
    .bind(&req.slot)
    .bind(&req.value)
    .bind(tenant_id)
    .bind(&req.line_ids)
    .execute(pool)
    .await?;

    Ok(r.rows_affected())
}

// ===== /Qrscanner：标签数据 =====
//
// ⚠️ **没有「扫码查单」端点**（旧版 `param1=getScanQRcode`）：它是一条**纯过滤**接口
// （拿单号去 `row['单号']` 做 trim 后精确匹配，见 `progress.service.ts:511`），
// 而 `GET /v1/progress` 已经把全量门行连 `单号` 一起给了前端 ⇒ 前端**客户端过滤**即可，
// 再开一条端点就是重复造。`label_data` 之所以仍然落在服务端：它要按单号**反查**
// （前端手里没有「单号 → 行」的索引，只有全量行）。

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
