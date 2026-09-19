mod handler;
mod model;
mod service;

use axum::routing::{get, post};
use axum::Router;

use crate::core::AppState;

/// 需要登录、且**只有 admin** 能调的端点（收据数据含金额与客户信息）。
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/receipts/{receipt_no}", get(handler::get))
        .route("/api/v1/receipts/{receipt_no}/share", post(handler::share))
}

/// 无认证入口：另开 `/api/v1/public/*` 命名空间，避免与 `{receipt_no}` 抢占同一段路径
/// （否则单号恰好叫 "public" 的订单会把公开入口打穿）。
///
/// 它自己靠 `receipt_token` 签名令牌把关（给客户看回执单，客户没有账号），
/// 因此**不进** `app.rs` 的授权子树。
pub fn public_router() -> Router<AppState> {
    Router::new().route("/api/v1/public/receipts", get(handler::public_get))
}
