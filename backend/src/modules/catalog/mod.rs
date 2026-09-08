mod handler;
mod model;
mod service;

use axum::routing::{get, post};
use axum::Router;

use crate::core::AppState;

/// 汇算字典数据：取价 / 公式匹配 / 打印模板。
/// 提供 list（校验/前端取用）与 import（旧数据导入，upsert）。
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/prices", get(handler::list_prices))
        .route("/api/v1/prices/resolve", get(handler::resolve_price))
        .route("/api/v1/prices/import", post(handler::import_prices))
        .route("/api/v1/formula-matches", get(handler::list_formula_matches))
        .route(
            "/api/v1/formula-matches/resolve",
            get(handler::resolve_match),
        )
        .route(
            "/api/v1/formula-matches/import",
            post(handler::import_formula_matches),
        )
        .route("/api/v1/print-templates", get(handler::list_print_templates))
        .route(
            "/api/v1/print-templates/import",
            post(handler::import_print_templates),
        )
        .route(
            "/api/v1/print-templates/{mode}",
            get(handler::list_print_templates_by_mode),
        )
}
