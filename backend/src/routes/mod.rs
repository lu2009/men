mod health;

use axum::routing::get;
use axum::Router;
use sqlx::PgPool;

/// 组装应用路由。业务模块的路由后续在此挂载。
pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route("/api/v1/health", get(health::health))
        .with_state(pool)
}
