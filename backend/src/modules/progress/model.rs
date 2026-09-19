// 生产进度（旧版 `/Progress` 页）的传输结构。
// 逆向见 docs/2026-09-19-progress-{analysis,server,shell}.md。

use serde::Serialize;

/// 一户租户的工序名清单 —— **15 个扁平槽**。
///
/// 旧版 `GetProcedures` 返回的就是这个形状（`{工序1:"下料", 工序2:"组装", …}`），
/// 前端拿到后**丢掉空槽、按槽号排序**。
///
/// ⚠️ 旧版这张表按 **`registrant`** 查（配置表的租户键），业务表按 `ds` 查 ——
/// 两把键、列名都叫 `database_name`，传错**不报错只静默降级**（15 槽全空）。
/// 新版只有一把 `tenant_id`，见迁移 `0021_progress.sql` 的头注。
#[derive(Debug, Serialize)]
pub struct ProcedureSlotDto {
    /// `'工序1'` .. `'工序15'`
    pub slot: String,
    pub name: String,
}

/// `GET /v1/procedures` 的返回：按槽号排好序的数组。
///
/// 之所以给数组而不是 `{工序1:…}` 这种对象：JSON 对象的键序在 JS 里**不保证**，
/// 而前端要「按槽号升序」—— 排序这件事放在服务端做一次，两边都不必再操心。
#[derive(Debug, Serialize)]
pub struct ProceduresDto {
    pub slots: Vec<ProcedureSlotDto>,
}

/// `POST /v1/progress/update` 的请求体。
///
/// 对应旧版 `param1=updataProgress`（`param3`=槽名、`param4`=要写的值、body=行 id 列表）。
/// 新版把三样都放进 JSON —— 旧版那个 `param3`/`param4` 混在 query 里的口径不好读。
#[derive(Debug, serde::Deserialize)]
pub struct ProgressUpdateInput {
    /// 要改的**行**（`order_lines.id`）。旧版是按「单号/回执单号」找行，新版直接给行 id。
    pub line_ids: Vec<i64>,
    /// `'工序1'` .. `'工序15'`
    pub slot: String,
    /// 要写进这个槽的值。旧版格式是 `工序名[_操作员]_YYYY-MM-DD`，但**服务端不校验格式**
    /// （它只当字符串存），所以新版也不校验 —— 谁拼谁负责。
    pub value: String,
}
