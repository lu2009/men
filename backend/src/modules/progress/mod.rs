// 生产进度（旧版 `/Progress` 页）。
//
// 逆向文档：`docs/2026-09-19-progress-analysis.md`（前端看到什么）、
// `-server.md`（服务端怎么算怎么存）、`-shell.md`（外壳/设置/看板）。
// 「设置工序」的读写见 `docs/2026-09-19-qrscanner-analysis.md` §4 / §8。
//
// 端点清单（分步做，✅ = 已实现）：
//   · `GET /v1/procedures`  ✅ 15 槽 + 名字 + 颜色（迁移 `0022_procedure_color.sql`）
//   · `POST /v1/procedures` ✅ 整体 upsert（名字 + 颜色），槽名非法 400
//   · `GET /v1/progress`    ✅ 全量（行结构见 `-analysis.md` §11）
//   · 其余写接口（删除进度、收款）   ⏳ 待做
mod handler;
mod model;
mod service;

use axum::routing::get;
use axum::Router;

use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/procedures",
            get(handler::get_procedures).post(handler::set_procedures),
        )
        .route("/api/v1/progress", get(handler::get_progress))
        .route(
            "/api/v1/progress/update",
            axum::routing::post(handler::update_progress),
        )
}
