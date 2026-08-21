use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;
use axum::http::HeaderMap;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::time::{SystemTime, UNIX_EPOCH};

use super::error::{ApiError, ApiResult};
use super::AppState;

/// 会话有效期：7 天（秒）。
pub const SESSION_TTL_SECS: i64 = 7 * 24 * 3600;

pub fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// 令牌只以 SHA-256 哈希形式落库，不存明文。
pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

/// 从请求头解析 `Authorization: Bearer <token>`。
pub fn bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(|s| s.trim().to_string())
}

/// 通过认证后注入到处理器里的当前用户（含租户上下文）。
#[derive(Clone, Debug)]
pub struct CurrentUser {
    pub user_id: i64,
    pub tenant_id: i64,
    pub username: String,
    pub name: String,
    pub role: String,
}

impl CurrentUser {
    /// 校验令牌并解析出当前用户；无效/过期返回 `Ok(None)`。
    pub async fn resolve(pool: &PgPool, token: &str) -> ApiResult<Option<Self>> {
        let token_hash = hash_token(token);

        let row: Option<(i64, i64, String, String, String, i64)> = sqlx::query_as(
            "SELECT u.id, u.tenant_id, u.username, u.name, u.role, s.expires_at \
             FROM sessions s JOIN users u ON u.id = s.user_id \
             WHERE s.token_hash = $1",
        )
        .bind(&token_hash)
        .fetch_optional(pool)
        .await?;

        match row {
            Some((user_id, tenant_id, username, name, role, expires_at)) => {
                if expires_at <= now_epoch() {
                    return Ok(None);
                }
                Ok(Some(CurrentUser {
                    user_id,
                    tenant_id,
                    username,
                    name,
                    role,
                }))
            }
            None => Ok(None),
        }
    }
}

impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = bearer_token(&parts.headers)
            .ok_or_else(|| ApiError::unauthorized("未提供认证令牌"))?;
        CurrentUser::resolve(&state.pool, &token)
            .await?
            .ok_or_else(|| ApiError::unauthorized("令牌无效或已过期"))
    }
}
