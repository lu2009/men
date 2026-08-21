use axum::Json;
use serde_json::{json, Value};

/// 成功响应统一包装为 `{ "data": ... }`。
pub fn ok(data: Value) -> Json<Value> {
    Json(json!({ "data": data }))
}
