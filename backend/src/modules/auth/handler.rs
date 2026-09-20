use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde_json::{json, Value};

use crate::core::auth::{bearer_token, CurrentUser};
use crate::core::error::{ApiError, ApiResult};
use crate::core::response;
use crate::core::AppState;

use super::model::{ChangePasswordRequest, LoginRequest};
use super::service;

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> ApiResult<Json<Value>> {
    let auth = service::login(&state.pool, &req.username, &req.password).await?;
    Ok(response::ok(serde_json::to_value(auth).unwrap()))
}

pub async fn logout(
    State(state): State<AppState>,
    _user: CurrentUser,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    let token = bearer_token(&headers).ok_or_else(|| ApiError::unauthorized("未提供认证令牌"))?;
    service::logout(&state.pool, &token).await?;
    Ok(response::ok(json!({ "logged_out": true })))
}

pub async fn me(State(state): State<AppState>, user: CurrentUser) -> ApiResult<Json<Value>> {
    let tenant = service::load_tenant(&state.pool, user.tenant_id).await?;
    Ok(response::ok(json!({
        "user": {
            "id": user.user_id,
            "tenant_id": user.tenant_id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
        },
        "tenant": tenant,
    })))
}

pub async fn change_password(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<ChangePasswordRequest>,
) -> ApiResult<Json<Value>> {
    service::change_password(
        &state.pool,
        user.user_id,
        &req.old_password,
        &req.new_password,
    )
    .await?;
    Ok(response::ok(json!({ "changed": true })))
}
