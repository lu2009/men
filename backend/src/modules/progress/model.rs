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
