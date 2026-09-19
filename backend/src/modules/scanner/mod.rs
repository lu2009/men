//! 扫码账号管理（旧版 `/Qrscanner` 页的「扫码账号管理」弹窗，`AddScanner` / `DeleteScanner`）。
//!
//! 逆向依据：`docs/2026-09-19-qrscanner-analysis.md` §5.3 / §6.3；
//! 旧服务端 `src/modules/scanner/scanner.service.ts`。
//!
//! | 端点 | 谁可以调 |
//! |---|---|
//! | `POST   /api/v1/scanner-accounts` | 仅 `admin` |
//! | `DELETE /api/v1/scanner-accounts?suffix=` | 仅 `admin` |
//!
//! 旧版这两个接口只判「登录了没」（`scanner.routes.ts` 挂 `requireAuth`），
//! 谁都能调；旧版前端靠「账号名 === 租户名」挡住子账号（§6.3 `dt`）。
//! 新版把这条规则放到服务端：只有 `admin` 能开户/销户，且只能开在本租户。
//!
//! ⚠️ 建出来的账号 `role = 'scanner'`，登录后能做什么由 `core/guard.rs` 的白名单决定
//! （扫码生产页那几个端点 + 自助改密）。

mod handler;
mod model;
pub(crate) mod service;

use axum::routing::post;
use axum::Router;

use crate::core::AppState;

/// 两个方法同一个路径：开户与销户。
pub fn router() -> Router<AppState> {
    Router::new().route(
        "/api/v1/scanner-accounts",
        post(handler::create).delete(handler::delete),
    )
}
