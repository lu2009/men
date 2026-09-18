use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::core::auth::CurrentUser;
use crate::core::error::ApiResult;
use crate::core::response;
use crate::core::AppState;

use super::model::*;
use super::service;

#[derive(Debug, Deserialize)]
pub struct SummaryQuery {
    #[serde(default = "default_days")]
    pub days: i64,
}

fn default_days() -> i64 {
    60
}

/// 订单财务明细（finance_getOrderDetail）。
pub async fn order_finance(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(order_id): Path<i64>,
) -> ApiResult<Json<Value>> {
    let item = service::order_finance_detail(&state.pool, user.tenant_id, order_id).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

/// 订单财务摘要表（finance_getOrderFinanceSummary）：返回 {order_id: {…}}。
pub async fn order_finance_summary(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(q): Query<SummaryQuery>,
) -> ApiResult<Json<Value>> {
    let items = service::order_finance_summary(&state.pool, user.tenant_id, q.days).await?;
    let map: serde_json::Map<String, Value> = items
        .into_iter()
        .map(|(id, f)| (id.to_string(), serde_json::to_value(f).unwrap()))
        .collect();
    Ok(response::ok(Value::Object(map)))
}

/// 删除/冲销前校验（finance_checkOrderPayment）。
pub async fn check_order_payment(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<CheckOrderPayment>,
) -> ApiResult<Json<Value>> {
    let items = service::check_order_payment(&state.pool, user.tenant_id, &req.order_ids).await?;
    Ok(response::ok(serde_json::to_value(items).unwrap()))
}

/// 本单收款（finance_addOrderPayment）。
pub async fn add_order_payment(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(order_id): Path<i64>,
    Json(mut req): Json<AddOrderPayment>,
) -> ApiResult<Json<Value>> {
    req.order_id = order_id;
    service::add_order_payment(&state.pool, user.tenant_id, req).await?;
    Ok(response::ok(json!({ "saved": true })))
}

/// 冲销订单的「资金池分配」—— 删除订单红冲的一条腿（另一半是带 `order_id` 的负收款，
/// 走 `add_order_payment`）。为什么要拆，见 `service::reverse_order_allocation` 的文档注释。
///
/// 无请求体：金额**服务端**按该订单当前的分配合计取，不接受客户端传。
pub async fn reverse_order_allocation(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(order_id): Path<i64>,
) -> ApiResult<Json<Value>> {
    let reversed = service::reverse_order_allocation(&state.pool, user.tenant_id, order_id).await?;
    Ok(response::ok(serde_json::to_value(AllocationReversal { reversed }).unwrap()))
}

/// 订单抹零/冲销（finance_addOrderAdjustment）。
pub async fn add_order_adjustment(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(order_id): Path<i64>,
    Json(mut req): Json<AddOrderAdjustment>,
) -> ApiResult<Json<Value>> {
    req.order_id = order_id;
    service::add_order_adjustment(&state.pool, user.tenant_id, req).await?;
    Ok(response::ok(json!({ "saved": true })))
}

/// 客户余额（finance_getCustomerBalance）。
pub async fn customer_balance(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(customer_code): Path<String>,
) -> ApiResult<Json<Value>> {
    let item = service::customer_balance(&state.pool, user.tenant_id, &customer_code).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

/// 对账流水（finance_getCustomerStatement）。
pub async fn customer_statement(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(customer_code): Path<String>,
) -> ApiResult<Json<Value>> {
    let items = service::customer_statement(&state.pool, user.tenant_id, &customer_code).await?;
    Ok(response::ok(serde_json::to_value(items).unwrap()))
}

/// 收款趋势（finance_getPaymentStats）。
pub async fn payment_stats(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(customer_code): Path<String>,
) -> ApiResult<Json<Value>> {
    let stats = service::payment_stats(&state.pool, user.tenant_id, &customer_code).await?;
    Ok(response::ok(stats))
}

/// 客户收款 + 分配（finance_addPayment）。
pub async fn add_customer_payment(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(customer_code): Path<String>,
    Json(mut req): Json<AddCustomerPayment>,
) -> ApiResult<Json<Value>> {
    req.customer_code = customer_code;
    service::add_customer_payment(&state.pool, user.tenant_id, req).await?;
    Ok(response::ok(json!({ "saved": true })))
}

/// 客户抹零/冲销（finance_addCustomerAdjustment）。
pub async fn add_customer_adjustment(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(customer_code): Path<String>,
    Json(mut req): Json<AddCustomerAdjustment>,
) -> ApiResult<Json<Value>> {
    req.customer_code = customer_code;
    service::add_customer_adjustment(&state.pool, user.tenant_id, req).await?;
    Ok(response::ok(json!({ "saved": true })))
}

/// 分配预览（finance_previewAllocation）。
pub async fn preview_allocation(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(customer_code): Path<String>,
    Json(mut req): Json<PreviewAllocation>,
) -> ApiResult<Json<Value>> {
    req.customer_code = customer_code;
    let preview = service::preview_allocation(&state.pool, user.tenant_id, req).await?;
    Ok(response::ok(serde_json::to_value(preview).unwrap()))
}

/// 预付款分配预览（finance_previewPrepaymentAllocation）。
pub async fn preview_prepayment_allocation(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(customer_code): Path<String>,
    Json(mut req): Json<PreviewPrepaymentAllocation>,
) -> ApiResult<Json<Value>> {
    req.customer_code = customer_code;
    let preview =
        service::preview_prepayment_allocation(&state.pool, user.tenant_id, req).await?;
    Ok(response::ok(serde_json::to_value(preview).unwrap()))
}

/// 预付款分配执行（finance_executePrepaymentAllocation）。
/// 响应 = 预览那份计划（旧版 svc:862 也是把 preview 摊进来）+ `saved`，前端只用 `saved`。
pub async fn execute_prepayment_allocation(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(customer_code): Path<String>,
    Json(mut req): Json<ExecutePrepaymentAllocation>,
) -> ApiResult<Json<Value>> {
    req.customer_code = customer_code;
    let preview = service::execute_prepayment_allocation(&state.pool, user.tenant_id, req).await?;
    let mut body = serde_json::to_value(preview).unwrap();
    if let Value::Object(ref mut map) = body {
        map.insert("saved".into(), json!(true));
    }
    Ok(response::ok(body))
}
