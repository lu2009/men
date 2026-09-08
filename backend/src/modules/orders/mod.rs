mod handler;
mod model;
mod service;

use axum::routing::get;
use axum::Router;

use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/orders", get(handler::list).post(handler::create))
        .route(
            "/api/v1/orders/{id}",
            get(handler::get).put(handler::update).delete(handler::delete),
        )
        .route(
            "/api/v1/orders/{id}/lines/{line_id}",
            axum::routing::put(handler::update_line).delete(handler::delete_line),
        )
}
