mod handler;
pub(crate) mod model;
pub(crate) mod service;

use axum::routing::{get, post};
use axum::Router;

use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/finance/orders/summary",
            get(handler::order_finance_summary),
        )
        .route(
            "/api/v1/finance/orders/check",
            post(handler::check_order_payment),
        )
        .route(
            "/api/v1/finance/orders/{order_id}",
            get(handler::order_finance),
        )
        .route(
            "/api/v1/finance/orders/{order_id}/payments",
            post(handler::add_order_payment),
        )
        // 删除订单红冲的一条腿：冲销该订单的「资金池分配」（写负的 finance_allocations）。
        // 另一条腿（本单直接收款）复用上面的 `/payments`，金额取负即可 —— 它的负数是允许的
        // （`add_order_payment` 里那条「红冲金额绝对值不能超过本单已分配金额」的校验就是为它留的）。
        .route(
            "/api/v1/finance/orders/{order_id}/allocation-reversal",
            post(handler::reverse_order_allocation),
        )
        .route(
            "/api/v1/finance/orders/{order_id}/adjustments",
            post(handler::add_order_adjustment),
        )
        .route(
            "/api/v1/finance/customers/{customer_code}/balance",
            get(handler::customer_balance),
        )
        .route(
            "/api/v1/finance/customers/{customer_code}/statement",
            get(handler::customer_statement),
        )
        .route(
            "/api/v1/finance/customers/{customer_code}/stats",
            get(handler::payment_stats),
        )
        .route(
            "/api/v1/finance/customers/{customer_code}/payments",
            post(handler::add_customer_payment),
        )
        .route(
            "/api/v1/finance/customers/{customer_code}/adjustments",
            post(handler::add_customer_adjustment),
        )
        .route(
            "/api/v1/finance/customers/{customer_code}/allocation/preview",
            post(handler::preview_allocation),
        )
        .route(
            "/api/v1/finance/customers/{customer_code}/prepayment/preview",
            post(handler::preview_prepayment_allocation),
        )
        .route(
            "/api/v1/finance/customers/{customer_code}/prepayment/execute",
            post(handler::execute_prepayment_allocation),
        )
}
