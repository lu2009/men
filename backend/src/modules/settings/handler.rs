use axum::extract::{Path, State};
use axum::Json;
use serde_json::{json, Value};

use crate::core::auth::CurrentUser;
use crate::core::error::ApiResult;
use crate::core::response;
use crate::core::AppState;

use super::model::{AddPriceItemInput, ColumnConfigDto};
use super::service;

pub async fn get_column_config(
    State(state): State<AppState>,
    user: CurrentUser,
) -> ApiResult<Json<Value>> {
    let (p, d) = service::get_column_config(&state.pool, user.tenant_id).await?;
    Ok(response::ok(json!({ "ping_columns": p, "diao_columns": d })))
}

pub async fn put_column_config(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<ColumnConfigDto>,
) -> ApiResult<Json<Value>> {
    service::upsert_column_config(&state.pool, user.tenant_id, req.ping_columns, req.diao_columns)
        .await?;
    Ok(response::ok(json!({ "saved": true })))
}

pub async fn list_price_items(
    State(state): State<AppState>,
    user: CurrentUser,
) -> ApiResult<Json<Value>> {
    let items = service::list_price_items(&state.pool, user.tenant_id).await?;
    Ok(response::ok(serde_json::to_value(items).unwrap()))
}

pub async fn create_price_item(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<AddPriceItemInput>,
) -> ApiResult<Json<Value>> {
    let item = service::create_price_item(&state.pool, user.tenant_id, &req).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

pub async fn delete_price_item(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    service::delete_price_item(&state.pool, user.tenant_id, id).await?;
    Ok(response::ok(json!({ "deleted": true })))
}
