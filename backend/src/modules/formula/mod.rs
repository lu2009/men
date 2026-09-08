mod handler;
mod model;
mod service;

use axum::routing::{delete, get};
use axum::Router;

use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/formulas",
            get(handler::list).post(handler::create),
        )
        .route(
            "/api/v1/formulas/{id}",
            get(handler::get)
                .put(handler::update)
                .delete(handler::delete),
        )
        .route(
            "/api/v1/formulas/{id}/images",
            get(handler::list_images).post(handler::add_image),
        )
        .route(
            "/api/v1/formulas/{id}/images/{image_id}",
            delete(handler::delete_image),
        )
}
