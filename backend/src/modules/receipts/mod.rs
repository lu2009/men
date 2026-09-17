mod handler;
mod model;
mod service;

use axum::routing::{get, post};
use axum::Router;

use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/receipts/{receipt_no}", get(handler::get))
        .route("/api/v1/receipts/{receipt_no}/share", post(handler::share))
        // 无认证入口另开 `/api/v1/public/*` 命名空间，避免与 `{receipt_no}` 抢占同一段路径
        // （否则单号恰好叫 "public" 的订单会把公开入口打穿）。
        .route("/api/v1/public/receipts", get(handler::public_get))
}
