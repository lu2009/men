use axum::extract::{Path, Query, State};
use axum::Json;
use serde_json::{json, Value};

use crate::core::auth::CurrentUser;
use crate::core::error::ApiResult;
use crate::core::response;
use crate::core::AppState;

use super::model::{OrderHeadPatch, OrderLineInput, OrderRequest, OrderSearchQuery};
use super::service;

pub async fn list(State(state): State<AppState>, user: CurrentUser) -> ApiResult<Json<Value>> {
    let items = service::list(&state.pool, user.tenant_id).await?;
    Ok(response::ok(serde_json::to_value(items).unwrap()))
}

/// Home「查询更多」（旧版 `getMoreTableDate`）：按客户 / 安装地址 / 日期范围取订单头。
pub async fn search(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(q): Query<OrderSearchQuery>,
) -> ApiResult<Json<Value>> {
    let items = service::search(&state.pool, user.tenant_id, &q).await?;
    Ok(response::ok(serde_json::to_value(items).unwrap()))
}

pub async fn get(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    let item = service::get(&state.pool, user.tenant_id, id).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

pub async fn create(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<OrderRequest>,
) -> ApiResult<Json<Value>> {
    let item = service::create(&state.pool, user.tenant_id, user.user_id, &user.name, req).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

pub async fn update(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(req): Json<OrderRequest>,
) -> ApiResult<Json<Value>> {
    let item = service::update(&state.pool, user.tenant_id, id, req).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

pub async fn delete(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    service::delete(&state.pool, user.tenant_id, id).await?;
    Ok(response::ok(json!({ "deleted": true })))
}

/// 就地编辑订单头（不动行）。
pub async fn update_head(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
    Json(patch): Json<OrderHeadPatch>,
) -> ApiResult<Json<Value>> {
    let item = service::update_head(&state.pool, user.tenant_id, id, patch).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

/// 更新订单内单行（按 line_id）。
pub async fn update_line(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((id, line_id)): Path<(i64, i64)>,
    Json(line): Json<OrderLineInput>,
) -> ApiResult<Json<Value>> {
    service::update_line(&state.pool, user.tenant_id, id, line_id, &line).await?;
    Ok(response::ok(json!({ "updated": true })))
}

/// 合并订单（旧版 `Ii` / `param1=combine`）。
///
/// ⚠️ 请求体是**订单 id 列表**，不是旧版那个 `{merged, record}` —— 存活单由服务端自己算
/// （旧版完全采信客户端，传错即不可恢复）。理由见 `service::combine` 的文档注释。
#[derive(Debug, serde::Deserialize)]
pub struct CombineRequest {
    pub order_ids: Vec<i64>,
}

pub async fn combine(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<CombineRequest>,
) -> ApiResult<Json<Value>> {
    let item = service::combine(&state.pool, user.tenant_id, &req.order_ids).await?;
    Ok(response::ok(serde_json::to_value(item).unwrap()))
}

/// 「填入单号」：给本单还没单号的行补 `N-YY/MM/DD`，返回 `{行id → 单号}`。
///
/// 对应旧版 Hui `:8491` 那颗按钮（旧版走 `param1=getDiaoFormulas` 顺带返回
/// `data.orderNumbers`，新版拆成独立端点 —— 有意偏离，理由见 `service::fill_line_numbers`）。
pub async fn fill_line_numbers(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<i64>,
) -> ApiResult<Json<Value>> {
    let map = service::fill_line_numbers(&state.pool, user.tenant_id, id).await?;
    Ok(response::ok(map))
}

/// 删除订单内单行（按 line_id）。
pub async fn delete_line(
    State(state): State<AppState>,
    user: CurrentUser,
    Path((id, line_id)): Path<(i64, i64)>,
) -> ApiResult<Json<Value>> {
    service::delete_line(&state.pool, user.tenant_id, id, line_id).await?;
    Ok(response::ok(json!({ "deleted": true })))
}
