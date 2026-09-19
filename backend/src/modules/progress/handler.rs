use axum::extract::{Query, State};
use axum::Json;
use super::model::{
    LabelDataInput, ProceduresInput, ProgressUpdateInput, ScanQrCodeQuery, ScanStatsQuery,
};
use serde_json::{json, Value};

use crate::core::auth::CurrentUser;
use crate::core::error::ApiResult;
use crate::core::response;
use crate::core::AppState;
use crate::modules::orders::model::OrderSearchQuery;

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

/// `GET /v1/progress/more` —— 「查询更多」：按客户 / 安装地址 / 日期范围再取一批进度行。
///
/// 旧版是 `param1=getMoreProgress&param2={ds}&param3…6={客户,地址,起,止}`；新版走 RESTful 路径。
/// **入参复用 `OrderSearchQuery`**（Home「查询更多」`GET /v1/orders/search` 用的同一个结构）——
/// 两个「查询更多」在旧版里就是同一组参数（`param3..param6`）、同一套语义，
/// 共用一个结构前端也好共用一份查询参数。
///
/// 返回 `{ progressData: [ 门行… ] }`，**行结构与 `GET /v1/progress` 完全一致**（同一个 `build_row`）。
/// 语义与两处有意偏离见 `service::get_more_progress` 的注释。
pub async fn more_progress(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(q): Query<OrderSearchQuery>,
) -> ApiResult<Json<Value>> {
    let v = service::get_more_progress(&state.pool, user.tenant_id, &q).await?;
    Ok(response::ok(v))
}

/// `POST /v1/progress/update` —— 给若干行的某个工序槽写值。
///
/// 旧版是 `param1=updataProgress`（`param3`=槽名、`param4`=值、body=id 或 单号）。
/// 「改哪几行」收 `line_ids`（行 id）**或** `line_nos`（**行级**单号），至少给一个，
/// 都给取并集 —— 扫码端手里只有单号，不该为了拿行 id 去拉全量。语义与偏离见
/// `service::update_progress` 的注释。
///
/// 返回 `{ updated, failed }`：`failed` = 给的 `line_nos` 里本租户内一个都没对上的那些
/// （**字段名照旧版** `data.failed`，前端 `api.updateProgress` 按它读）。
///
/// ## 状态码只有两种，**与旧版同形**（别改成「一律 200」）
///
/// | 情况 | 返回 |
/// |---|---|
/// | 命中一部分或全命中 | **200** `{updated, failed}` —— `failed` 非空就是「有几个没对上、已跳过」 |
/// | **一个都没命中**（或两个字段都没给） | **400**「没有要更新的行」 |
///
/// 第二行逐字对齐旧版 `progress.service.ts:655`：
/// `if (failed.size > 0 && totalUpdated === 0) return { code: 400, … }` ——
/// 旧版把「给的 ref 一个都不存在」当**输入有问题**，只把「部分命中」当正常结果。
/// 新版沿用这个划分（也和本端点「空入参 400」同口径）。
///
/// ⚠️ 400 那条路上**不带 `failed` 列表**（本项目的错误信封统一是 `{"error":{…}}`）——
/// 可那种情况下「没对上的」就是调用方给的全部单号，信息并没有丢。
pub async fn update_progress(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(req): Json<ProgressUpdateInput>,
) -> ApiResult<Json<Value>> {
    let out = service::update_progress(&state.pool, user.tenant_id, &req).await?;
    Ok(response::ok(
        json!({ "updated": out.updated, "failed": out.failed }),
    ))
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

/// `GET /v1/scan/qrcode?code=` —— 扫码 / 手动查单：**只回命中这个单号的那几行**。
///
/// 对应旧版 `param1=getScanQRcode&param3={扫到的文本}`。
/// 返回 `{ rows: [ 门行… ] }`（与 `POST /v1/scan/labels` 同键，行同 [`service::build_row`]）；
/// 有 `code` 却一行都没命中时 **404 `未找到相关订单`** —— 旧版就是 404 不是空数组，
/// 前端据此走 error 分支，**照抄**。
pub async fn scan_qrcode(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(q): Query<ScanQrCodeQuery>,
) -> ApiResult<Json<Value>> {
    let v = service::scan_qrcode(&state.pool, user.tenant_id, &q.code).await?;
    Ok(response::ok(v))
}

/// `GET /v1/scan/stats?employee=&range=` —— 扫码统计：**只回范围内的行**。
///
/// 对应旧版 `param1=getProcessCounts&param3={员工}&param4={当天|本周|本月|"起,止"}`。
/// 返回 `{ progressData: [ 门行… ] }`，键与 `GET /v1/progress` **同名同构** ——
/// 前端换接口时不用改取数那一行。筛法与偏离见 `service::scan_stats`。
pub async fn scan_stats(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(q): Query<ScanStatsQuery>,
) -> ApiResult<Json<Value>> {
    let v = service::scan_stats(&state.pool, user.tenant_id, &q.employee, &q.range).await?;
    Ok(response::ok(v))
}
