use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};

use crate::core::error::ApiResult;
use crate::core::response;
use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/v1/health", get(health))
}

/// 健康检查：确认服务存活与数据库连通。
async fn health(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
        .is_ok();

    Ok(response::ok(json!({
        "status": "ok",
        "service": "smartdoor-backend",
        "db": if db_ok { "connected" } else { "disconnected" },
    })))
}
