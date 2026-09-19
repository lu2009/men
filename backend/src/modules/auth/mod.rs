mod handler;
mod model;
// `pub(crate)`：扫码账号开户（`modules/scanner`）要复用这里的 argon2 哈希与密码策略。
pub(crate) mod service;

pub use service::seed_admin;

use axum::routing::{get, post};
use axum::Router;

use crate::core::AppState;

/// 登录前就要能调、因此**不过授权层**的端点。
///
/// ⚠️ 往这里加东西前先想清楚：这棵子树的路径对**任何**调用方开放。
pub fn public_router() -> Router<AppState> {
    Router::new().route("/api/v1/auth/login", post(handler::login))
}

/// 需要登录的端点；由 `app.rs` merge 进套了角色授权中间件的 `guarded` 子树。
/// 其中 `me` / `logout` / `change-password` 属于自助端点，任何角色都放行（见 `core/guard.rs`）。
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/auth/logout", post(handler::logout))
        .route("/api/v1/auth/me", get(handler::me))
        .route("/api/v1/auth/change-password", post(handler::change_password))
}
