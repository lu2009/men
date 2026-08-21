mod handler;
mod model;
mod service;

pub use service::seed_admin;

use axum::routing::{get, post};
use axum::Router;

use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/auth/login", post(handler::login))
        .route("/api/v1/auth/logout", post(handler::logout))
        .route("/api/v1/auth/me", get(handler::me))
        .route("/api/v1/auth/change-password", post(handler::change_password))
}
