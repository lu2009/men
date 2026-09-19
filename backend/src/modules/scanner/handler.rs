use axum::extract::{Query, State};
use axum::Json;
use serde_json::{json, Value};

use crate::core::auth::CurrentUser;
use crate::core::error::{ApiError, ApiResult};
use crate::core::guard;
use crate::core::response;
use crate::core::AppState;

use super::model::{CreateScannerRequest, DeleteScannerQuery};
use super::service;

/// `POST /api/v1/scanner-accounts` —— 开一个扫码账号（仅管理员）。
///
/// router 层（`core/guard.rs`）已经把非 admin 拦在外面；这里再判一次是兜底，
/// 防的是「以后有人把 `scanner::router()` 误 merge 进 public 子树」。
pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<CreateScannerRequest>,
) -> ApiResult<Json<Value>> {
    guard::require_admin(&user)?;

    let tenant_name = service::load_tenant_name(&state.pool, user.tenant_id).await?;
    let account = service::create(
        &state.pool,
        user.tenant_id,
        &tenant_name,
        &req.suffix,
        &req.password,
    )
    .await?;

    Ok(response::ok(serde_json::to_value(account).unwrap()))
}

/// `DELETE /api/v1/scanner-accounts?suffix=` —— 销户（仅管理员）。
///
/// 用后缀而不是完整账号名，是为了让调用方给不出「别的租户的账号名」：
/// 完整名由服务端拿当前租户名拼。
pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(q): Query<DeleteScannerQuery>,
) -> ApiResult<Json<Value>> {
    guard::require_admin(&user)?;

    let suffix = q
        .suffix
        .ok_or_else(|| ApiError::bad_request("缺少 suffix 参数"))?;
    let tenant_name = service::load_tenant_name(&state.pool, user.tenant_id).await?;
    service::delete(&state.pool, user.tenant_id, &tenant_name, &suffix).await?;

    Ok(response::ok(json!({ "deleted": true })))
}
