use axum::extract::{Path, State};
use axum::Json;
use serde_json::{json, Value};

use crate::core::auth::CurrentUser;
use crate::core::error::ApiResult;
use crate::core::response;
use crate::core::AppState;

use super::model::{
    ImportFormulaMatchesRequest, ImportPrintTemplatesRequest, ImportPricesRequest,
};
use super::service;

pub async fn list_prices(
    State(state): State<AppState>,
    user: CurrentUser,
) -> ApiResult<Json<Value>> {
    let items = service::list_prices(&state.pool, user.tenant_id).await?;
    Ok(response::ok(serde_json::to_value(items).unwrap()))
}

pub async fn import_prices(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<ImportPricesRequest>,
) -> ApiResult<Json<Value>> {
    let count =
        service::import_prices(&state.pool, user.tenant_id, user.user_id, req.items).await?;
    Ok(response::ok(json!({ "imported": count })))
}

pub async fn list_formula_matches(
    State(state): State<AppState>,
    user: CurrentUser,
) -> ApiResult<Json<Value>> {
    let items = service::list_matches(&state.pool, user.tenant_id).await?;
    Ok(response::ok(serde_json::to_value(items).unwrap()))
}

pub async fn import_formula_matches(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<ImportFormulaMatchesRequest>,
) -> ApiResult<Json<Value>> {
    let count = service::import_matches(&state.pool, user.tenant_id, req.items).await?;
    Ok(response::ok(json!({ "imported": count })))
}

pub async fn list_print_templates(
    State(state): State<AppState>,
    user: CurrentUser,
) -> ApiResult<Json<Value>> {
    let items = service::list_templates(&state.pool, user.tenant_id).await?;
    Ok(response::ok(serde_json::to_value(items).unwrap()))
}

pub async fn list_print_templates_by_mode(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(mode): Path<String>,
) -> ApiResult<Json<Value>> {
    let items = service::list_templates_by_mode(&state.pool, user.tenant_id, &mode).await?;
    Ok(response::ok(serde_json::to_value(items).unwrap()))
}

pub async fn import_print_templates(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<ImportPrintTemplatesRequest>,
) -> ApiResult<Json<Value>> {
    let count = service::import_templates(&state.pool, user.tenant_id, req.items).await?;
    Ok(response::ok(json!({ "imported": count })))
}
