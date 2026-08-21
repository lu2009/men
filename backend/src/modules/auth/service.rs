use argon2::password_hash::rand_core::OsRng as ArgonOsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand::RngCore;
use sqlx::PgPool;

use crate::core::auth::{hash_token, now_epoch, SESSION_TTL_SECS};
use crate::core::error::{ApiError, ApiResult};

use super::model::{AuthResponse, TenantDto, UserDto};

/// 登录：校验用户名密码，签发会话令牌。
pub async fn login(pool: &PgPool, username: &str, password: &str) -> ApiResult<AuthResponse> {
    let user: Option<(i64, i64, String, String, String, String)> = sqlx::query_as(
        "SELECT id, tenant_id, username, name, role, password_hash \
         FROM users WHERE username = $1",
    )
    .bind(username)
    .fetch_optional(pool)
    .await?;

    let Some((id, tenant_id, username, name, role, password_hash)) = user else {
        return Err(ApiError::unauthorized("用户名或密码错误"));
    };

    verify_password(&password_hash, password)
        .map_err(|_| ApiError::unauthorized("用户名或密码错误"))?;

    let token = generate_token();
    let token_hash = hash_token(&token);
    let expires_at = now_epoch() + SESSION_TTL_SECS;

    sqlx::query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(id)
        .bind(&token_hash)
        .bind(expires_at)
        .execute(pool)
        .await?;

    let tenant = load_tenant(pool, tenant_id).await?;

    Ok(AuthResponse {
        token,
        user: UserDto {
            id,
            tenant_id,
            username,
            name,
            role,
        },
        tenant,
    })
}

/// 登出：按令牌删除对应会话。
pub async fn logout(pool: &PgPool, token: &str) -> ApiResult<()> {
    let token_hash = hash_token(token);
    sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn load_tenant(pool: &PgPool, tenant_id: i64) -> ApiResult<TenantDto> {
    let (id, name): (i64, String) =
        sqlx::query_as("SELECT id, name FROM tenants WHERE id = $1")
            .bind(tenant_id)
            .fetch_one(pool)
            .await?;
    Ok(TenantDto { id, name })
}

/// 修改密码：校验原密码 + 新密码策略。
pub async fn change_password(
    pool: &PgPool,
    user_id: i64,
    old_password: &str,
    new_password: &str,
) -> ApiResult<()> {
    validate_password_policy(new_password)?;

    let current_hash: String =
        sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await?;

    verify_password(&current_hash, old_password).map_err(|_| ApiError::unauthorized("原密码错误"))?;

    let new_hash = hash_password(new_password)?;
    sqlx::query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2")
        .bind(&new_hash)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// 首次启动播种：若不存在任何用户，创建默认租户 + 管理员。
pub async fn seed_admin(
    pool: &PgPool,
    tenant_name: &str,
    username: &str,
    password: &str,
) -> ApiResult<()> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;
    if count > 0 {
        return Ok(());
    }

    validate_password_policy(password)?;

    let tenant_id: i64 = sqlx::query_scalar("INSERT INTO tenants (name) VALUES ($1) RETURNING id")
        .bind(tenant_name)
        .fetch_one(pool)
        .await?;

    let password_hash = hash_password(password)?;

    sqlx::query(
        "INSERT INTO users (tenant_id, username, password_hash, name, role) \
         VALUES ($1, $2, $3, $4, 'admin')",
    )
    .bind(tenant_id)
    .bind(username)
    .bind(&password_hash)
    .bind("管理员")
    .execute(pool)
    .await?;

    tracing::info!("已创建默认管理员账号: {username}（租户: {tenant_name}）");
    Ok(())
}

fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn hash_password(password: &str) -> ApiResult<String> {
    let salt = SaltString::generate(&mut ArgonOsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| ApiError::internal(format!("密码哈希失败: {e}")))
}

fn verify_password(hash: &str, password: &str) -> ApiResult<()> {
    let parsed = PasswordHash::new(hash)
        .map_err(|e| ApiError::internal(format!("密码哈希解析失败: {e}")))?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .map_err(|_| ApiError::unauthorized("密码错误"))
}

/// 密码策略：8–20 位，含大小写字母、数字、特殊字符。
fn validate_password_policy(password: &str) -> ApiResult<()> {
    let chars: Vec<char> = password.chars().collect();
    let len_ok = (8..=20).contains(&chars.len());
    let has_upper = chars.iter().any(|c| c.is_ascii_uppercase());
    let has_lower = chars.iter().any(|c| c.is_ascii_lowercase());
    let has_digit = chars.iter().any(|c| c.is_ascii_digit());
    let has_special = chars.iter().any(|c| !c.is_ascii_alphanumeric());

    if len_ok && has_upper && has_lower && has_digit && has_special {
        Ok(())
    } else {
        Err(ApiError::bad_request(
            "密码需 8–20 位，含大小写字母、数字和特殊字符",
        ))
    }
}
