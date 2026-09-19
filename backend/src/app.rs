use axum::http::HeaderValue;
use axum::middleware;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::core::guard;
use crate::core::AppState;
use crate::modules;

/// 组装应用：注册各模块路由 + 角色授权 + 跨域 + 追踪，注入全局状态。
///
/// ## 路由分两棵树（这是权限的第一道闸）
///
/// - `public`：**不需要登录**的端点。登录、公开回执单、健康检查。
/// - `guarded`：其余全部。套 `guard::require_role`，白名单（`core/guard.rs`）
///   之外的路径只认 `admin`。
///
/// ⚠️ **新模块默认往 `guarded` 里 merge**。往 `public` 里放是要特意做的事，
/// 而忘了归类的结果是「被拦住」而不是「被放行」—— 这就是 deny-by-default 的落点。
///
/// ⚠️ `Router::layer` 只作用于**调用它时已经登记的路由**（axum 0.8 的语义），
/// 所以 `.layer(中介件)` 必须写在所有 `.merge()` **之后**；中间插一条路由上去，
/// 那条路由就是**没有门**的。往 `guarded` 里加模块时，加在 layer 之前。
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

    let public = Router::<AppState>::new()
        .merge(modules::auth::public_router())
        .merge(modules::receipts::public_router())
        .merge(modules::health::router());

    let guarded = Router::<AppState>::new()
        .merge(modules::auth::router())
        .merge(modules::catalog::router())
        .merge(modules::clients::router())
        .merge(modules::finance::router())
        .merge(modules::formula::router())
        .merge(modules::orders::router())
        .merge(modules::progress::router())
        .merge(modules::receipts::router())
        .merge(modules::scanner::router())
        .merge(modules::settings::router())
        // 必须在上面所有 merge 之后：
        .layer(middleware::from_fn_with_state(
            state.clone(),
            guard::require_role,
        ));

    public
        .merge(guarded)
        // 跨域层在最外面：预检 OPTIONS 由它直接应答，不会打到授权层（预检不带令牌）。
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;

    use super::*;
    use crate::core::config::Config;

    /// 不连库的池子：只用来把 `AppState` 凑齐。
    ///
    /// `acquire_timeout` 调小：`/api/v1/health` 会真去取连接，默认 30 秒会让测试白等。
    fn state() -> AppState {
        AppState {
            pool: PgPoolOptions::new()
                .acquire_timeout(std::time::Duration::from_millis(200))
                .connect_lazy("postgres://user:pw@127.0.0.1:1/none")
                .expect("connect_lazy 不该失败"),
            config: Config {
                port: 0,
                database_url: "postgres://user:pw@127.0.0.1:1/none".into(),
                cors_origins: vec![],
                admin_username: "admin".into(),
                admin_password: "Admin@12345".into(),
                admin_tenant_name: "默认门窗厂".into(),
                receipt_secret: "test".into(),
            },
        }
    }

    /// 带不带令牌都打不通的探测器：无令牌时若返回 401，说明**授权层确实挂在这条路由上**。
    ///
    /// 没有令牌 ⇒ 授权中间件在查库之前就返回，所以这个测试不需要真数据库。
    async fn status_without_token(path: &str) -> StatusCode {
        let req = Request::builder().uri(path).body(Body::empty()).unwrap();
        app(state()).oneshot(req).await.unwrap().status()
    }

    /// deny-by-default 的回归钉子：每个业务模块**至少一条**路径必须要求登录。
    ///
    /// 新加模块时把它加进这个清单：忘了加，测试不会红；但**忘了给模块套门**
    /// （比如误 merge 进 public 子树），这里就会红。
    #[tokio::test]
    async fn every_business_module_requires_a_token() {
        for path in [
            "/api/v1/auth/me",
            "/api/v1/orders",
            "/api/v1/clients",
            "/api/v1/finance/orders/summary",
            "/api/v1/formulas",
            "/api/v1/prices",
            "/api/v1/progress",
            "/api/v1/procedures",
            "/api/v1/receipts/R1",
            "/api/v1/column-configs",
            "/api/v1/scanner-accounts",
        ] {
            assert_eq!(
                status_without_token(path).await,
                StatusCode::UNAUTHORIZED,
                "{path} 没经过授权层（无令牌竟然不是 401）"
            );
        }
    }

    /// 公开端点不能反过来被门拦掉：登录、健康检查、公开回执单。
    #[tokio::test]
    async fn public_endpoints_are_not_gated() {
        for path in [
            "/api/v1/auth/login",
            "/api/v1/health",
            "/api/v1/public/receipts",
        ] {
            assert_ne!(
                status_without_token(path).await,
                StatusCode::UNAUTHORIZED,
                "{path} 是公开端点，不该要求令牌"
            );
        }
    }
}
