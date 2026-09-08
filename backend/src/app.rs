use axum::http::HeaderValue;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::core::AppState;
use crate::modules;

/// 组装应用：注册各模块路由 + 跨域 + 追踪，注入全局状态。
pub fn app(state: AppState) -> Router {
    let origins: Vec<HeaderValue> = state
        .config
        .cors_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    // 开发期宽松跨域：允许 Vite 与 Tauri 来源。生产部署时需收紧为白名单。
    let cors = if origins.is_empty() {
        CorsLayer::permissive()
    } else {
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods(Any)
            .allow_headers(Any)
    };

    Router::<AppState>::new()
        .merge(modules::auth::router())
        .merge(modules::clients::router())
        .merge(modules::formula::router())
        .merge(modules::health::router())
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
