mod handler;
mod model;
mod service;

use axum::routing::get;
use axum::Router;

use crate::core::AppState;

/// 租户级界面/配置设置（列显隐配置 + 加价项目列表）。
pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/column-configs",
            get(handler::get_column_config).put(handler::put_column_config),
        )
        .route(
            "/api/v1/add-price-items",
            get(handler::list_price_items).post(handler::create_price_item),
        )
        .route(
            "/api/v1/add-price-items/{id}",
            axum::routing::delete(handler::delete_price_item),
        )
}
