mod app;
mod core;
mod modules;

use std::net::SocketAddr;

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
    let config = core::config::Config::from_env()?;

    let pool = core::db::connect(&config.database_url, &config.db_timezone).await?;
    tracing::info!("数据库会话时区 = {}", config.db_timezone);

    // 启动时自动执行 migrations/ 目录下的迁移，无需额外安装 sqlx-cli。
    sqlx::migrate!("./migrations").run(&pool).await?;

    // 首次启动播种默认租户 + 管理员。
    modules::auth::seed_admin(
        &pool,
        &config.admin_tenant_name,
        &config.admin_username,
        &config.admin_password,
    )
    .await?;

    let state = core::AppState {
        pool,
        config: config.clone(),
    };
    let app = app::app(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("smartdoor-backend 监听于 http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
