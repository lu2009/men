mod handler;
mod model;
mod service;

use axum::routing::get;
use axum::Router;

use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/clients", get(handler::list).post(handler::create))
        .route(
            "/api/v1/clients/{id}",
            get(handler::get)
                .put(handler::update)
                .delete(handler::delete),
        )
}
