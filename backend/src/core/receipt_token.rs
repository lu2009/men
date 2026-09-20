//! 电子回执单分享令牌：无状态 HMAC-SHA256 签名，无需建表/落库。
//!
//! 旧版回执分享走的是「深链 + 旧域名 token」（`{i}af{c}wy{Date.now()+888}`，见
//! `docs/2026-09-17-home-analysis.md` §6.2），依赖旧系统自己的用户库校验，新版没有那套表，
//! 故改为**自签自验**：签名密钥取自环境变量 `RECEIPT_SECRET`，令牌里带租户 + 过期时间，
//! 服务端验签后直接放行，不落任何状态。
//!
//! 令牌形如 `{tenant_id}.{exp_epoch}.{sig_hex}`，sig 覆盖 `{tenant_id}.{exp}.{receipt_no}`，
//! 故回执单号单独作为查询参数传递（`?no=...&t=...`），令牌本身不含单号 —— 换个单号复用
//! 同一令牌会验签失败。
//!
//! HMAC 按 RFC 2104 手写（sha2 已在依赖里），避免为 15 行引入 hmac crate。

use sha2::{Digest, Sha256};

use super::error::{ApiError, ApiResult};

/// 分享链接有效期：7 天（与旧版回执 token 的 7 天窗口一致）。
pub const SHARE_TTL_SECS: i64 = 7 * 24 * 3600;

const BLOCK: usize = 64;

fn hmac_sha256(key: &[u8], msg: &[u8]) -> [u8; 32] {
    let mut block = [0u8; BLOCK];
    if key.len() > BLOCK {
        block[..32].copy_from_slice(&Sha256::digest(key));
    } else {
        block[..key.len()].copy_from_slice(key);
    }

    let mut inner = Vec::with_capacity(BLOCK + msg.len());
    let mut outer = Vec::with_capacity(BLOCK + 32);
    for b in block.iter() {
        inner.push(b ^ 0x36);
        outer.push(b ^ 0x5c);
    }
    inner.extend_from_slice(msg);
    let inner_hash = Sha256::digest(&inner);
    outer.extend_from_slice(&inner_hash);
    let out = Sha256::digest(&outer);

    let mut sig = [0u8; 32];
    sig.copy_from_slice(&out);
    sig
}

fn sign(secret: &str, tenant_id: i64, exp: i64, receipt_no: &str) -> String {
    let msg = format!("{tenant_id}.{exp}.{receipt_no}");
    hex::encode(hmac_sha256(secret.as_bytes(), msg.as_bytes()))
}

/// 生成分享令牌（不含回执单号）。
pub fn issue(secret: &str, tenant_id: i64, receipt_no: &str, now: i64) -> (String, i64) {
    let exp = now + SHARE_TTL_SECS;
    let sig = sign(secret, tenant_id, exp, receipt_no);
    (format!("{tenant_id}.{exp}.{sig}"), exp)
}

/// 校验分享令牌，返回 `(tenant_id, exp)`。签名不符/格式错/已过期一律 403。
pub fn verify(secret: &str, token: &str, receipt_no: &str, now: i64) -> ApiResult<(i64, i64)> {
    let invalid = || {
        ApiError::new(
            axum::http::StatusCode::FORBIDDEN,
            "forbidden",
            "回执单链接无效或已过期",
        )
    };

    let mut parts = token.splitn(3, '.');
    let tenant_id: i64 = parts
        .next()
        .and_then(|s| s.parse().ok())
        .ok_or_else(invalid)?;
    let exp: i64 = parts
        .next()
        .and_then(|s| s.parse().ok())
        .ok_or_else(invalid)?;
    let sig = parts.next().ok_or_else(invalid)?;

    let expected = sign(secret, tenant_id, exp, receipt_no);
    // 定长 hex 比较，逐字节累积差值，避免提前返回。
    if sig.len() != expected.len() {
        return Err(invalid());
    }
    let diff = sig
        .bytes()
        .zip(expected.bytes())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b));
    if diff != 0 {
        return Err(invalid());
    }
    if exp <= now {
        return Err(invalid());
    }
    Ok((tenant_id, exp))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issue_then_verify_roundtrip() {
        let (token, exp) = issue("s3cret", 7, "HT00000042", 1_700_000_000);
        assert_eq!(exp, 1_700_000_000 + SHARE_TTL_SECS);
        let (tenant, got_exp) = verify("s3cret", &token, "HT00000042", 1_700_000_001).unwrap();
        assert_eq!(tenant, 7);
        assert_eq!(got_exp, exp);
    }

    #[test]
    fn verify_rejects_other_receipt_no() {
        let (token, _) = issue("s3cret", 7, "HT00000042", 1_700_000_000);
        assert!(verify("s3cret", &token, "HT00000043", 1_700_000_001).is_err());
    }

    #[test]
    fn verify_rejects_other_secret_and_expired() {
        let (token, _) = issue("s3cret", 7, "HT00000042", 1_700_000_000);
        assert!(verify("other", &token, "HT00000042", 1_700_000_001).is_err());
        assert!(verify(
            "s3cret",
            &token,
            "HT00000042",
            1_700_000_000 + SHARE_TTL_SECS
        )
        .is_err());
    }
}
