use axum::extract::State;
use axum::Json;
use serde_json::{json, Value};
use sqlx::PgPool;

/// 健康检查：确认服务存活与数据库连通。
pub async fn health(State(pool): State<PgPool>) -> Json<Value> {
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&pool)
        .await
        .is_ok();

    Json(json!({
        "status": "ok",
        "service": "smartdoor-backend",
        "db": if db_ok { "connected" } else { "disconnected" },
    }))
}
