use axum::extract::{Path, State};
use axum::Json;
use serde_json::{json, Value};

use crate::core::auth::CurrentUser;
use crate::core::error::ApiResult;
use crate::core::response;
use crate::core::AppState;

use super::model::{OrderHeadPatch, OrderLineInput, OrderRequest};
use super::service;

pub async fn list(
    State(state): State<AppState>,
    user: CurrentUser,
) -> ApiResult<Json<Value>> {
    let items = service::list(&state.pool, user.tenant_id).await?;
    Ok(response::ok(serde_json::to_value(items).unwrap()))
}

pub async fn get(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    let item = service::get(&state.pool, user.tenant_id, id).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<OrderRequest>,
) -> ApiResult<Json<Value>> {
    let item = service::create(&state.pool, user.tenant_id, user.user_id, &user.name, req).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(req): Json<OrderRequest>,
) -> ApiResult<Json<Value>> {
    let item = service::update(&state.pool, user.tenant_id, id, req).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    service::delete(&state.pool, user.tenant_id, id).await?;
    Ok(response::ok(json!({ "deleted": true })))
}

/// 就地编辑订单头（不动行）。
pub async fn update_head(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(patch): Json<OrderHeadPatch>,
) -> ApiResult<Json<Value>> {
    let item = service::update_head(&state.pool, user.tenant_id, id, patch).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

/// 更新订单内单行（按 line_id）。
pub async fn update_line(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((id, line_id)): Path<(i64, i64)>,
    Json(line): Json<OrderLineInput>,
) -> ApiResult<Json<Value>> {
    service::update_line(&state.pool, user.tenant_id, id, line_id, &line).await?;
    Ok(response::ok(json!({ "updated": true })))
}

/// 删除订单内单行（按 line_id）。
pub async fn delete_line(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((id, line_id)): Path<(i64, i64)>,
) -> ApiResult<Json<Value>> {
    service::delete_line(&state.pool, user.tenant_id, id, line_id).await?;
    Ok(response::ok(json!({ "deleted": true })))
}
