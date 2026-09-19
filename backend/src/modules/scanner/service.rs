//! 扫码账号（`role = 'scanner'`）的开户与销户。
//!
//! 逆向依据：`docs/2026-09-19-qrscanner-analysis.md` §5.3（旧版弹窗）、
//! §6.3（谁能管理）；旧服务端 `src/modules/scanner/scanner.service.ts`。
//!
//! 与旧版的对应关系：
//!
//! | 旧版 | 新版 |
//! |---|---|
//! | `prisma.user.create({ username, displayName: username, companyName: registrant, isDefaultPw: 2, mutilUser: 1 })` | `users` 一行，`role='scanner'`，`name = username` |
//! | `deleteMany({ databaseName: ds, username, mutilUser: 1 })` | `DELETE … WHERE tenant_id AND username AND role='scanner'` |
//! | 账号名 = 前端拼的 `registrant + 后缀` | 账号名 = 服务端拼 `tenants.name + 后缀` |
//!
//! `registrant` 在旧版是 `user.companyName`（`auth.service.ts:284` `registrant: user.companyName`），
//! 不是登录名 —— 新版对应 `tenants.name`。

use sqlx::PgPool;

use crate::core::error::{ApiError, ApiResult};
use crate::core::guard::ROLE_SCANNER;
use crate::modules::auth::service as auth_service;

use super::model::ScannerAccountDto;

/// 旧版 `User.username` 是 `VarChar(50)`（`prisma/schema.prisma:17`），
/// 超了在旧版是数据库报错。这里提前判，给一句人话。
const MAX_USERNAME_LEN: usize = 50;
/// 后缀（员工名）长度上限。旧版没校验，但账号名整体受 50 字符限制。
const MAX_SUFFIX_LEN: usize = 32;

/// 开户：拼账号名 → 校验密码策略 → 落库。
///
/// `tenant_id` / `tenant_name` 由调用方从**当前登录用户**取，不从请求体取 ——
/// 租户隔离写在 WHERE/VALUES 里，不靠调用方自觉。
pub async fn create(
    pool: &PgPool,
    tenant_id: i64,
    tenant_name: &str,
    suffix: &str,
    password: &str,
) -> ApiResult<ScannerAccountDto> {
    let suffix = normalize_suffix(suffix)?;
    let username = compose_username(tenant_name, &suffix)?;

    // 与旧版前端 `passwordStrength` 同一套口径；改密走的是同一个函数。
    auth_service::validate_password_policy(password)?;
    let password_hash = auth_service::hash_password(password)?;

    // 旧版 `displayName: username` —— 完整账号名当显示名。
    // 前端据此反推员工名（`name.slice(registrant.length)`，见 qrscanner 分析 §6.1 `Ea()`）。
    let row: Result<(i64,), sqlx::Error> = sqlx::query_as(
        "INSERT INTO users (tenant_id, username, password_hash, name, role) \
         VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(tenant_id)
    .bind(&username)
    .bind(&password_hash)
    .bind(&username)
    .bind(ROLE_SCANNER)
    .fetch_one(pool)
    .await;

    let id = match row {
        Ok((id,)) => id,
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            return Err(ApiError::conflict("扫码账号已存在"));
        }
        Err(e) => return Err(e.into()),
    };

    Ok(ScannerAccountDto {
        id,
        username: username.clone(),
        name: username,
        role: ROLE_SCANNER.to_string(),
    })
}

/// 销户：只认本租户的 `role = 'scanner'`。
///
/// 会话随用户级联删（`sessions.user_id … ON DELETE CASCADE`，迁移 `0002_auth.sql`），
/// 所以删完这个账号手里那张令牌当场失效，不用另写一句。
pub async fn delete(
    pool: &PgPool,
    tenant_id: i64,
    tenant_name: &str,
    suffix: &str,
) -> ApiResult<()> {
    let suffix = normalize_suffix(suffix)?;
    let username = compose_username(tenant_name, &suffix)?;

    // 租户 + 角色都写在 WHERE 里：跨租户删不动，也删不到管理员头上。
    let deleted: Option<(i64,)> = sqlx::query_as(
        "DELETE FROM users WHERE tenant_id = $1 AND username = $2 AND role = $3 RETURNING id",
    )
    .bind(tenant_id)
    .bind(&username)
    .bind(ROLE_SCANNER)
    .fetch_optional(pool)
    .await?;

    if deleted.is_none() {
        return Err(ApiError::not_found("扫码账号不存在"));
    }
    Ok(())
}

/// 读当前租户名（账号名前缀）。只按 `tenant_id` 查，不接收调用方给的 id。
pub async fn load_tenant_name(pool: &PgPool, tenant_id: i64) -> ApiResult<String> {
    let name: Option<String> = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?;
    name.ok_or_else(|| ApiError::not_found("租户不存在"))
}

/// 旧版口径：`username = registrant + 后缀`，即 **租户名 + 后缀**，中间不加分隔符
/// （`qrscanner-analysis.md` §5.3）。
pub fn compose_username(tenant_name: &str, suffix: &str) -> ApiResult<String> {
    let username = format!("{tenant_name}{suffix}");
    if username.chars().count() > MAX_USERNAME_LEN {
        return Err(ApiError::bad_request(format!(
            "账号名过长：租户名 + 后缀最多 {MAX_USERNAME_LEN} 个字符"
        )));
    }
    Ok(username)
}

/// 后缀规范化：去首尾空白后必须非空、不含空白与控制字符、不超长。
///
/// 这些字符会让账号名在微信里复制粘贴时断行/看不见（旧版建号弹窗的用途就是
/// 「已复制账号密码，可直接到微信进行粘贴」），旧版没拦，新版拦。
fn normalize_suffix(raw: &str) -> ApiResult<String> {
    let suffix = raw.trim();
    if suffix.is_empty() {
        return Err(ApiError::bad_request("请填写员工名称（账号后缀）"));
    }
    if suffix.chars().count() > MAX_SUFFIX_LEN {
        return Err(ApiError::bad_request(format!(
            "员工名称最多 {MAX_SUFFIX_LEN} 个字符"
        )));
    }
    if suffix.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err(ApiError::bad_request("员工名称不能包含空格或控制字符"));
    }
    Ok(suffix.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn username_is_tenant_name_plus_suffix() {
        assert_eq!(
            compose_username("默认门窗厂", "张三").unwrap(),
            "默认门窗厂张三"
        );
        // 不加分隔符，也不 trim 租户名（旧版直接字符串相加）
        assert_eq!(compose_username("A厂", "01").unwrap(), "A厂01");
    }

    #[test]
    fn username_length_is_capped_like_legacy_varchar50() {
        // 49 + 2 = 51 > 50，旧版 VarChar(50) 会炸
        assert!(compose_username(&"厂".repeat(49), "张三").is_err());
        // 40 + 2 = 42 ≤ 50
        assert!(compose_username(&"厂".repeat(40), "张三").is_ok());
    }

    #[test]
    fn suffix_is_trimmed_and_validated() {
        assert_eq!(normalize_suffix("  张三 ").unwrap(), "张三");
        assert!(normalize_suffix("").is_err());
        assert!(normalize_suffix("   ").is_err());
        assert!(normalize_suffix("张 三").is_err());
        assert!(normalize_suffix("张\n三").is_err());
        assert!(normalize_suffix(&"三".repeat(33)).is_err());
        assert!(normalize_suffix(&"三".repeat(32)).is_ok());
    }
}
