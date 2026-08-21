use anyhow::Result;

/// 运行配置，全部从环境变量读取（缺省值适配本地开发）。
#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub database_url: String,
    /// 允许的跨域来源（逗号分隔）。开发期前端 Vite 与 Tauri 来源。
    pub cors_origins: Vec<String>,
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

        Ok(Self {
            port,
            database_url,
            cors_origins,
        })
    }
}
