use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::core::auth::CurrentUser;
use crate::core::error::ApiResult;
use crate::core::response;
use crate::core::AppState;

use super::model::ClientRequest;
use super::service;

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub search: Option<String>,
}

pub async fn list(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(q): Query<ListQuery>,
) -> ApiResult<Json<Value>> {
    let items = service::list(&state.pool, user.tenant_id, q.search.as_deref().unwrap_or("")).await?;
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
    Json(req): Json<ClientRequest>,
) -> ApiResult<Json<Value>> {
    let item = service::create(&state.pool, user.tenant_id, user.user_id, req).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(req): Json<ClientRequest>,
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
