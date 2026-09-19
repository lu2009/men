// 生产进度（旧版 `/Progress` 页）。
//
// 逆向文档：`docs/2026-09-19-progress-analysis.md`（前端看到什么）、
// `-server.md`（服务端怎么算怎么存）、`-shell.md`（外壳/设置/看板）。
//
// ⚠️ 本模块目前**只有读**，而且是分步做的第一步：
//   · `GET /v1/procedures` ✅（本文件）
//   · `GET /v1/progress`   ⏳ 待做 —— 它的**行结构**还没吃透
//     （旧版 `progressRowFromDoorRow` 那几层没读完，不猜）
//   · 写接口（更新/删除进度、收款）   ⏳ 待做
mod handler;
mod model;
mod service;

use axum::routing::get;
use axum::Router;

use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/v1/procedures", get(handler::get_procedures))
}
