use axum::extract::State;
use axum::Json;
use super::model::{LabelDataInput, ProceduresInput, ProgressUpdateInput};
use serde_json::{json, Value};

use crate::core::auth::CurrentUser;
use crate::core::error::ApiResult;
use crate::core::response;
use crate::core::AppState;

use super::service;

/// `GET /v1/procedures` —— 本租户的工序名清单（15 个扁平槽）。
///
/// 旧版是 `param1=GetProcedures&param2={userinfo.registrant}`；新版走 RESTful 路径，
/// 租户从登录态拿（**不再有「两把租户键」那个坑**，见迁移 `0021` 头注）。
pub async fn get_procedures(
    State(state): State<AppState>,
    user: CurrentUser,
) -> ApiResult<Json<Value>> {
    let dto = service::get_procedures(&state.pool, user.tenant_id).await?;
    Ok(response::ok(serde_json::to_value(dto).unwrap()))
}

/// `POST /v1/procedures` —— 整体 upsert 本租户的工序清单（名字 + 颜色）。
///
/// 对应旧版 `param1=SetProcedures`（body 是 `{工序1:名字, …}`、颜色不上服务端）。
/// 语义、校验与三处有意偏离见 `service::set_procedures` 的注释。
/// 返回 `{ saved: true }`（外层还有 `response::ok` 的 `data` 包装，与其它端点一致）。
pub async fn set_procedures(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<ProceduresInput>,
) -> ApiResult<Json<Value>> {
    service::set_procedures(&state.pool, user.tenant_id, &req).await?;
    Ok(response::ok(json!({ "saved": true })))
}

/// `GET /v1/progress` —— 本租户全量进度行。
///
/// 旧版是 `param1=getProgress&param2={userinfo.ds}`；新版走 RESTful 路径、租户从登录态拿。
/// ⚠️ 旧版还有个终端分支（`getProgressForTerminal`），**服务端是写死 400**（静态响应覆盖），
///    那条路本来就是坏的 ⇒ 新版**不做终端分支**（有意偏离，见 `-analysis.md` §10）。
pub async fn get_progress(State(state): State<AppState>, user: CurrentUser) -> ApiResult<Json<Value>> {
    let v = service::get_progress(&state.pool, user.tenant_id).await?;
    Ok(response::ok(v))
}

/// `POST /v1/progress/update` —— 给若干行的某个工序槽写值。
///
/// 旧版是 `param1=updataProgress`（`param3`=槽名、`param4`=值、body=id 列表）。
/// 语义与偏离见 `service::update_progress` 的注释。
pub async fn update_progress(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<ProgressUpdateInput>,
) -> ApiResult<Json<Value>> {
    let n = service::update_progress(&state.pool, user.tenant_id, &req).await?;
    Ok(response::ok(json!({ "updated": n })))
}

/// `POST /v1/scan/labels` —— 标签云打印的数据（body `{ line_nos: [...] }`，**行级单号**）。
///
/// 旧版是 `param1=getLabelData&param2={ds}`，body 是裸的单号数组。
/// 返回 `{ rows: [ 门行… ] }`，**行结构与 `GET /v1/progress` 完全一致**（同一个 `build_row`）。
pub async fn label_data(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<LabelDataInput>,
) -> ApiResult<Json<Value>> {
    let v = service::label_data(&state.pool, user.tenant_id, &req.line_nos).await?;
    Ok(response::ok(v))
}
