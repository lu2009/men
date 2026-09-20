use sqlx::PgPool;

use crate::core::error::{ApiError, ApiResult};
use crate::core::receipt_token;
use crate::modules::finance;
use crate::modules::orders;

use super::model::{ReceiptDto, ShareTokenDto};

/// 订单须知兜底文案：旧版 `租户.declaration || "含安装费"`（token 1114）。
/// 新后端 tenants 表暂无 declaration 列，故恒取该兜底值（与 Hui 打印回执同源）。
pub const DEFAULT_DECLARATION: &str = "含安装费";

async fn tenant_name(pool: &PgPool, tenant_id: i64) -> ApiResult<String> {
    let name: Option<String> = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?;
    Ok(name.unwrap_or_default())
}

/// 组装回执单载荷。`receipt_no` 必须在本租户内存在，否则 404。
pub async fn build(pool: &PgPool, tenant_id: i64, receipt_no: &str) -> ApiResult<ReceiptDto> {
    let order = orders::service::get_by_receipt_no(pool, tenant_id, receipt_no).await?;
    let fin = finance::service::order_finance(pool, tenant_id, order.id).await?;

    Ok(ReceiptDto {
        receipt_no: order.receipt_no,
        client_name: order.client_name,
        phone: order.phone,
        brand: order.brand,
        order_date: order.order_date,
        due_date: order.due_date,
        production_days: order.production_days,
        install_address: order.install_address,
        remark: order.remark,
        salesperson: order.salesperson,
        creator_name: order.creator_name,
        total_price: order.total_price,
        deposit: order.deposit,
        door_count: order.door_count,
        allocated_amount: fin.allocated_amount,
        unpaid_amount: fin.unpaid_amount,
        tenant_name: tenant_name(pool, tenant_id).await?,
        declaration: DEFAULT_DECLARATION.to_string(),
        lines: order.lines,
    })
}

/// 签发分享令牌（已认证入口调用）。
pub fn issue_share_token(secret: &str, tenant_id: i64, receipt_no: &str) -> ShareTokenDto {
    let (token, expires_at) = receipt_token::issue(
        secret,
        tenant_id,
        receipt_no,
        crate::core::auth::now_epoch(),
    );
    ShareTokenDto {
        receipt_no: receipt_no.to_string(),
        token,
        expires_at,
    }
}

/// 校验分享令牌并返回回执单（无认证入口调用）。
pub async fn public_by_token(
    pool: &PgPool,
    secret: &str,
    receipt_no: &str,
    token: &str,
) -> ApiResult<ReceiptDto> {
    if receipt_no.trim().is_empty() {
        return Err(ApiError::bad_request("缺少回执单号"));
    }
    let (tenant_id, _exp) = receipt_token::verify(
        secret,
        token,
        receipt_no.trim(),
        crate::core::auth::now_epoch(),
    )?;
    build(pool, tenant_id, receipt_no.trim()).await
}
