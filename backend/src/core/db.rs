use anyhow::Result;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use sqlx::PgPool;

/// 建立 PostgreSQL 连接池，并把**每条连接**的会话时区设为 `timezone`。
///
/// ## 为什么是会话级，不是 `ALTER DATABASE`
///
/// `ALTER DATABASE ... SET timezone` 改的是**整个库**：同一个库上的别的应用、别人的
/// psql 会话全跟着变，而且需要额外的权限。挂在池子的 `after_connect` 上，作用域随本
/// 进程生灭，不碰库、不影响任何人。
///
/// ## ⚠️ 走过的弯路：`PgConnectOptions::options` 这条路**不通**（实测）
///
/// 直觉上应该用 `PgConnectOptions::options([("timezone", tz)])`（拼成 libpq 的
/// `options=-c timezone=...` 启动参数）。**实测无效，会话仍是 UTC**：
/// sqlx 在握手包里**硬塞了一个 `("TimeZone", "UTC")`**（`sqlx-postgres-0.8.6/src/
/// connection/establish.rs:33`），它盖过了 `options` 里的 `-c timezone=…`。
///
/// 「谁盖谁」已单独实测过（不用连 sqlx）：同一台库上
/// `PGTZ=UTC PGOPTIONS="-c timezone=Asia/Shanghai" psql -c "SHOW TimeZone"` ⇒ **`UTC`**，
/// 而只给 `PGOPTIONS` 时 ⇒ `Asia/Shanghai`。即**启动包里那个参数赢**，与 sqlx 的行为一致。
///
/// 同一串 `options` 走 libpq（`PGOPTIONS="-c timezone=Asia/Shanghai" psql`）**是生效的**
/// —— 差别就在 sqlx 多发的那个 `TimeZone` 参数。
///
/// 所以只能退到 `after_connect`：连接建好后、**交付给调用方之前**跑一条 `set_config`。
/// 失败则该连接不入池（错误冒泡给取连接的一方），因此不存在「有连接短暂跑在 UTC 下」的窗口。
///
/// ## 为什么是 `set_config(...)` 而不是 `SET TIME ZONE`
///
/// `SET` 不接受绑定参数，拼字符串会把配置值变成注入面。`set_config` 的第三个参数
/// `false` = 对本会话生效（不是事务局部）。
///
/// ## 时区名非法会怎样
///
/// 连接**直接失败**（PostgreSQL 报 `invalid value for parameter "TimeZone"`）。
/// 这是有意的：宁可起不来，也不要静默回落到 UTC 再错一天。
pub async fn connect(database_url: &str, timezone: &str) -> Result<PgPool> {
    let options: PgConnectOptions = database_url.parse::<PgConnectOptions>()?;
    let tz = timezone.to_string();

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .after_connect(move |conn, _meta| {
            let tz = tz.clone();
            Box::pin(async move {
                sqlx::query("SELECT set_config('TimeZone', $1, false)")
                    .bind(&tz)
                    .execute(conn)
                    .await?;
                Ok(())
            })
        })
        .connect_with(options)
        .await?;
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 会话时区真的落在**池子里每一条连接**上了吗？
    ///
    /// 需要真 PostgreSQL，所以 `#[ignore]`（默认 `cargo test` 不连库）。跑：
    ///
    /// ```text
    /// DATABASE_URL=postgres://smartdoor:smartdoor@localhost:5432/smartdoor \
    ///   cargo test -- --ignored session_timezone
    /// ```
    ///
    /// **只读**：全程 SELECT/SHOW，不建表、不写行、不留数据。
    ///
    /// 为什么要借满整个池子逐条查：时区是**连接级**设置，漏配一条连接就漏一天，
    /// 而漏的那条平时看不出来 —— 只在凌晨 00:00–08:00 才现形。
    ///
    /// ⚠️ 最后那条「非法时区名」的断言要跑满 `acquire_timeout`（默认 30 秒）才报错 ——
    /// sqlx 建池时会重试到超时。整个测试约 30 秒，慢是正常的。
    #[tokio::test]
    #[ignore = "需要真 PostgreSQL；默认跳过，见本函数文档"]
    async fn session_timezone_is_applied_to_every_connection() {
        let url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://smartdoor:smartdoor@localhost:5432/smartdoor".into());
        let pool = connect(&url, "Asia/Shanghai").await.expect("连库失败");

        // ① 池子里**每一条**连接都设上了。
        let mut conns = Vec::new();
        for _ in 0..5 {
            conns.push(pool.acquire().await.expect("取连接失败"));
        }
        for conn in &mut conns {
            let tz: String = sqlx::query_scalar("SHOW TimeZone")
                .fetch_one(&mut **conn)
                .await
                .expect("SHOW TimeZone 失败");
            assert_eq!(tz, "Asia/Shanghai", "有一条连接的会话时区没设上");
        }
        drop(conns);

        // ② **可配**：换个时区名 `CURRENT_DATE` 就跟着换（不是写死的）。
        //    断言用的是恒等式 `CURRENT_DATE == now() AT TIME ZONE <本会话时区> 的日历日` ——
        //    两边读同一个时钟，所以**不随时钟漂**，任何时刻跑都成立。
        for tz in ["Asia/Shanghai", "Pacific/Kiritimati", "UTC"] {
            let p = connect(&url, tz).await.expect("连库失败");
            let (current_date, tz_date): (String, String) = sqlx::query_as(
                "SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD'), \
                        to_char(now() AT TIME ZONE current_setting('TimeZone'), 'YYYY-MM-DD')",
            )
            .fetch_one(&p)
            .await
            .expect("取日期失败");
            eprintln!("会话时区 {tz:>20} → CURRENT_DATE = {current_date}（该时区此刻 {tz_date}）");
            assert_eq!(current_date, tz_date, "{tz}：CURRENT_DATE 没跟着会话时区走");
        }

        // ③ 同一个**绝对时刻**在两种时区下差一天 —— 这就是要修的 bug 本身。
        //    取北京凌晨 03:00（= UTC 前一天 19:00），`timestamptz::date` 按会话时区取日历日。
        let (utc_date, sh_date): (String, String) = sqlx::query_as(
            "SELECT to_char(TIMESTAMPTZ '2026-09-20 03:00:00+08' AT TIME ZONE 'UTC', 'YYYY-MM-DD'), \
                    to_char((TIMESTAMPTZ '2026-09-20 03:00:00+08')::date, 'YYYY-MM-DD')",
        )
        .fetch_one(&pool)
        .await
        .expect("取日期失败");
        assert_eq!(utc_date, "2026-09-19", "UTC 会话下应算成前一天");
        assert_eq!(sh_date, "2026-09-20", "Asia/Shanghai 会话下应是北京当天");

        // ④ 时区名非法 ⇒ 连接失败（不静默回落 UTC）。这是 `connect` 文档里承诺的行为。
        assert!(
            connect(&url, "Nowhere/Nonsense").await.is_err(),
            "非法时区名竟然连上了 —— 会静默回落 UTC 再错一天"
        );
    }
}
