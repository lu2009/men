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

        Ok(Self {
            port,
            database_url,
            cors_origins,
            admin_username,
            admin_password,
            admin_tenant_name,
            receipt_secret,
        })
    }
}
