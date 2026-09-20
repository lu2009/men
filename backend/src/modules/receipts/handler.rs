use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

use crate::core::auth::CurrentUser;
use crate::core::error::ApiResult;
use crate::core::response;
use crate::core::AppState;

use super::service;

/// 已认证：按回执单号取回执单（Home「电子回执单」入口）。
pub async fn get(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(receipt_no): Path<String>,
) -> ApiResult<Json<Value>> {
    let item = service::build(&state.pool, user.tenant_id, &receipt_no).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

/// 已认证：签发分享令牌。链接由前端拼（后端不知道对外域名）。
pub async fn share(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(receipt_no): Path<String>,
) -> ApiResult<Json<Value>> {
    // 先确认单号真实存在，避免签出指向不存在订单的链接。
    service::build(&state.pool, user.tenant_id, &receipt_no).await?;
    let dto = service::issue_share_token(&state.config.receipt_secret, user.tenant_id, &receipt_no);
    Ok(response::ok(serde_json::to_value(dto).unwrap()))
}

#[derive(Debug, Deserialize)]
pub struct PublicQuery {
    #[serde(default)]
    pub no: String,
    #[serde(default)]
    pub t: String,
}

/// 无认证：凭分享令牌读回执单（`/receipt-share` 页面用）。
pub async fn public_get(
    State(state): State<AppState>,
    Query(q): Query<PublicQuery>,
) -> ApiResult<Json<Value>> {
    let item =
        service::public_by_token(&state.pool, &state.config.receipt_secret, &q.no, &q.t).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}
