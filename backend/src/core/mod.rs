// 横切关注点：被所有业务模块依赖，但不依赖任何业务模块。
pub mod auth;
pub mod config;
pub mod db;
pub mod error;
pub mod response;

use sqlx::PgPool;

/// 全局共享状态，通过 `axum::extract::State<AppState>` 注入到各处理器。
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: config::Config,
}
