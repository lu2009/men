use anyhow::Result;

/// 运行配置，全部从环境变量读取（缺省值适配本地开发）。
#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub database_url: String,
    /// 允许的跨域来源（逗号分隔）。开发期前端 Vite 与 Tauri 来源。
    pub cors_origins: Vec<String>,
    /// 首次启动播种的默认管理员。
    pub admin_username: String,
    pub admin_password: String,
    pub admin_tenant_name: String,
    /// 电子回执单分享链接的签名密钥（HMAC-SHA256）。
    /// ⚠️ 生产必须通过 `RECEIPT_SECRET` 显式设置：默认值只用于本地开发，
    /// 泄漏后任何人都能伪造任意租户的回执单分享链接。
    pub receipt_secret: String,
    /// **数据库连接的会话时区**（IANA 名，如 `Asia/Shanghai`）。
    ///
    /// 全栈的时间基准是库的 `CURRENT_DATE`（`orders.order_date` 的默认值、财务的「近 N 天」、
    /// 扫码统计的「当天/本周/本月」），而 `CURRENT_DATE` 取的是**会话时区**。
    /// 库若是 UTC 而厂里在东八区，北京 00:00–08:00 这 8 小时里两边差一天。
    /// 落在每条连接上，见 `core/db.rs`。
    ///
    /// 可配是因为**生产库的时区未必和开发一致**；改这个值只影响本进程的连接，
    /// 不动库本身（也不影响别的应用连同一个库）。
    pub db_timezone: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let port: u16 = std::env::var("PORT")
            .unwrap_or_else(|_| "3000".into())
            .parse()?;

        let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://smartdoor:smartdoor@localhost:5432/smartdoor".into()
        });

        let cors_origins = std::env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| {
                "http://localhost:5173,tauri://localhost,http://tauri.localhost".into()
            })
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let admin_username = std::env::var("ADMIN_USERNAME").unwrap_or_else(|_| "admin".into());
        let admin_password =
            std::env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "Admin@12345".into());
        let admin_tenant_name =
            std::env::var("ADMIN_TENANT_NAME").unwrap_or_else(|_| "默认门窗厂".into());

        let receipt_secret =
            std::env::var("RECEIPT_SECRET").unwrap_or_else(|_| "dev-receipt-secret".into());

        // 数据库会话时区：默认东八区。厂里在 China，`CURRENT_DATE` 必须按北京时间翻篇，
        // 否则凌晨 00:00–08:00 下单/扫码统计会落到「昨天」。
        let db_timezone = std::env::var("DB_TIMEZONE").unwrap_or_else(|_| "Asia/Shanghai".into());

        Ok(Self {
            port,
            database_url,
            cors_origins,
            admin_username,
            admin_password,
            admin_tenant_name,
            receipt_secret,
            db_timezone,
        })
    }
}
