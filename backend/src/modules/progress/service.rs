use serde_json::{json, Map, Value};
use sqlx::PgPool;

use crate::core::error::ApiResult;
use crate::modules::orders::model::OrderLineDto;
use crate::modules::orders::service::{self as orders_service, OrderHeaderRow};

use super::model::{ProcedureSlotDto, ProceduresDto};

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
pub async fn get_procedures(pool: &PgPool, tenant_id: i64) -> ApiResult<ProceduresDto> {
    // 只取有名字的，剩下的在下面补空 —— 这样「库里一行都没有」也能返回 15 个空槽。
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT slot, name FROM procedures WHERE tenant_id = $1 AND name <> ''",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;

    let find = |slot: &str| rows.iter().find(|(s, _)| s == slot).map(|(_, n)| n.clone());

    let slots = (1..=SLOT_COUNT)
        .map(|i| {
            let s = slot_name(i);
            let name = find(&s).unwrap_or_default();
            ProcedureSlotDto { slot: s, name }
        })
        .collect();

    Ok(ProceduresDto { slots })
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
