mod config;
mod db;
mod routes;

use std::net::SocketAddr;

use axum::http::HeaderValue;
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "smartdoor_backend=debug,tower_http=debug,info".into()),
        )
        .init();

    // 加载 .env（若存在），缺失时回退到默认值。
    dotenvy::dotenv().ok();
    let config = config::Config::from_env()?;

    let pool = db::connect(&config.database_url).await?;

    // 启动时自动执行 migrations/ 目录下的迁移，无需额外安装 sqlx-cli。
    sqlx::migrate!("./migrations").run(&pool).await?;

    let app = app(config.clone(), pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("smartdoor-backend 监听于 http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn app(config: config::Config, pool: sqlx::PgPool) -> Router {
    let origins: Vec<HeaderValue> = config
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

    routes::router(pool)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}
