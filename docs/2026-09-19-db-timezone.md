# 数据库会话时区：全栈只有一个「今天」

> 2026-09-19。起因是用户问「时区那里怎么了」，当笔修掉。
>
> **本文补的是一个当时没有任何文档描述过的口径。** 改之前 grep
> `时区|CURRENT_DATE|DB_TIMEZONE|时间基准` 只命中旧版（Node 进程 TZ）那几处
> —— 见 §6「与旧版那几个 UNCERTAIN 不是一回事」—— **新版自己的时间基准从没写进任何文档**。
> 属 `CLAUDE.md` 规矩第 3 条「找不到任何文档描述过它 ⇒ 尤其口径类，记一笔」。

## 1. 症状

**东八区凌晨 00:00–08:00，全系统的「今天」是昨天。**

库容器 `smartdoor-db` 的时区是 `UTC`（`SHOW TimeZone` ⇒ `UTC`）。`CURRENT_DATE`
取的是**库会话的时区**，不是北京。于是：

| 北京时间 | UTC | `CURRENT_DATE` 认为是 |
|---|---|---|
| 2026-09-19 03:00 | 2026-09-18 19:00 | **2026-09-18**（差一天） |
| 2026-09-19 21:00 | 2026-09-19 13:00 | 2026-09-19（正常） |

⇒ 只有**凌晨那 8 小时**出错。白天怎么点都是对的 —— 这正是它长期没被发现的原因，
也是**肉眼验收必漏**的那类 bug。

## 2. 打到了哪些地方

凡是把「今天」交给库算的，全中。已核到的入口：

| 位置 | 怎么用 `CURRENT_DATE` |
|---|---|
| `orders.order_date` 的**列默认值** | 建单不传日期时直接落库成「昨天」 |
| 财务「近 N 天」 | 区间端点是库算的 |
| `progress/service.rs::date_anchors` | 扫码统计的「当天 / 本周一 / 本月初」 |
| 扫码「扫码日期」的筛选 | 同上，走 `date_anchors` |

`config.rs:20` 那段注释把这条链写得很清楚：**全栈的时间基准是库的 `CURRENT_DATE`**。

## 3. 修法：挂在连接池的 `after_connect` 上

```rust
// backend/src/core/db.rs
pub async fn connect(database_url: &str, timezone: &str) -> Result<PgPool>
```

`main.rs:20` 是**唯一**的生产建池点：`core::db::connect(&config.database_url, &config.db_timezone)`。
（`app.rs:88` 那个 `PgPoolOptions` 在 `#[cfg(test)]` 里，`connect_lazy` 到 `127.0.0.1:1`，
只用来把 `AppState` 凑齐，不连库。）

**配置**：`DB_TIMEZONE`，默认 `Asia/Shanghai`（`core/config.rs:60`）。

### 为什么是会话级，不是 `ALTER DATABASE`

`ALTER DATABASE ... SET timezone` 改的是**整个库** —— 同一个库上别人的 psql、别的应用
全跟着变，还要额外权限。挂在池子上，作用域随本进程生灭，不碰库。

### ⚠️ 走过的弯路：`PgConnectOptions::options` 这条路**不通**

直觉写法是 `PgConnectOptions::options([("timezone", tz)])`（拼成 libpq 的
`options=-c timezone=…`）。**实测无效，会话仍是 UTC。**
sqlx 在握手包里硬塞了一个 `("TimeZone", "UTC")`：

```
sqlx-postgres-0.8.6/src/connection/establish.rs:33
    ("TimeZone", "UTC"),
```

「启动包参数赢过 `options` 里的 `-c`」这件事**单独实测过**（不经 sqlx，直接打库）：

```bash
# 同一个库上，两条只差「启动参数里有没有 TimeZone」
PGTZ=UTC PGOPTIONS="-c timezone=Asia/Shanghai" psql -c "SHOW TimeZone"   # ⇒ UTC      ← 启动参数赢
                PGOPTIONS="-c timezone=Asia/Shanghai" psql -c "SHOW TimeZone"   # ⇒ Asia/Shanghai
```

⇒ 只能退到 `after_connect`：连接建好、**交付给调用方之前**跑一条 `set_config`。
失败则连接不入池（错误冒泡给取连接的一方），所以不存在「有连接短暂跑在 UTC 下」的窗口。

### 为什么是 `set_config(...)` 而不是 `SET TIME ZONE`

`SET` 不接受绑定参数，拼字符串就把配置值变成注入面。`set_config` 第三个参数
`false` = 对本会话生效（不是事务局部）。

### 时区名非法会怎样

连接**直接失败**（PostgreSQL 报 `invalid value for parameter "TimeZone"`）。
这是有意的：**宁可起不来，也不要静默回落 UTC 再错一天。**

## 4. 怎么验收（别用 `pg_stat_activity`，那个查不出来）

```bash
cd backend && cargo test -- --ignored session_timezone --nocapture
```

一条测试断言四件事（约 30 秒 —— ④ 那条要跑满 `acquire_timeout` 才报错）：

1. 池子里**每一条**连接（借满 5 条）的 `SHOW TimeZone` 都是 `Asia/Shanghai`；
2. **可配**：换 `Pacific/Kiritimati` / `UTC` 时 `CURRENT_DATE` 跟着换；
3. 同一个绝对时刻在两种时区下**差一天**（`TIMESTAMPTZ '2026-09-20 03:00:00+08'`）；
4. 非法时区名 ⇒ 连接失败。

为什么 ① 要**逐条**查：时区是**连接级**设置，漏配一条就漏一天，而漏的那条平时看不出来。

为什么 ②③ 这么写**不随时钟漂**：断言的是恒等式
`CURRENT_DATE == (now() AT TIME ZONE current_setting('TimeZone'))::date` —— 两边读同一个时钟，
**任何时刻跑都成立**；③ 用的是**固定时刻字面量**。这一点很关键：本 bug 只在
**凌晨 00:00–08:00** 现形，若是拿「今天」去比，白天跑必绿、等于没测。

### ⚠️ 一个查不出来的姿势（我踩过）

```sql
-- ✗ 错的：current_setting 在**我自己这个 psql 会话**里求值，
--   读的是我自己的设置，跟 pg_stat_activity 那一行毫无关系。
SELECT pid, current_setting('TimeZone') FROM pg_stat_activity WHERE datname='smartdoor';
```

`pg_stat_activity` **不暴露别的会话的 GUC**。这条查询永远打印你自己会话的时区
（默认 UTC），看多少次都是 `UTC`，**看起来像"没修好"**。当时就差一点据此误判。
真要看运行时状态，用 §4 的测试，或者让进程自己把日期吐出来。

## 5. 前端那一半：客户端的「今天」

后端统一是不够的 —— 扫码提交时，**日期是客户端算好写进工序槽的**
（`parseScanMarker` 那一套，见 `docs/2026-09-19-qrscanner-analysis.md` §9 第 7 条）。

旧版前端用 `new Date().toISOString().split("T")[0]`（**UTC**）⇒ 东八区晚 8 点后写次日。
**新版已改为本地日期**（`Qrscanner.vue` 的 `localDate()`，文件头「偏离 2」），
`Progress.vue` 的 `localToday()` 同理。

⇒ 两边现在对齐：**客户端按设备本地时区、服务端按 `DB_TIMEZONE`（默认东八区）**。
厂里的设备就是东八区，一致。设备时区被设错（比如手机停在 UTC）仍会写错一天，
那是**设备自己的时区**，不在本机制能管的范围内。

## 6. 与旧版那几个 UNCERTAIN 不是一回事

`docs/legacy-finance/01-read.md` 的 **UNCERTAIN-8** / `01-read-B-fin-read2.md` 的 **[U-4]**、
`qrscanner-analysis.md` §9 第 7 条，讲的都是**旧版 Node 进程的 `TZ`**（旧服务端
`getFullYear` 本地时区 vs `toISOString` UTC 并存）。**那些仍然是 UNCERTAIN** ——
不读 `.env`、不读部署配置就判不出来，本笔**没有**去动它们，也没资格动。

本笔修的是**新版自己的**库会话时区。两者只是长得像，**别把本文当成那几条的答案**。

## 7. 复现 / 回归

| 动作 | 命令 |
|---|---|
| 单独验时区 | `cd backend && cargo test -- --ignored session_timezone` |
| 看运行时锚点 | `GET /api/v1/scan/stats`（走 `date_anchors`）—— ⚠️ **只在凌晨 00:00–08:00 有区分度**，白天问不出东西 |
| 相关差分台 | `docs/progress-{cell,toolbar,dashboard,select,more}-logiccheck.mjs`、`qrscanner-{role,scan}-logiccheck.mjs`、`qrscanner-authz-check.mjs` |

⚠️ **改 `.sql` 迁移后 `cargo build` 不会重编**（`sqlx::migrate!` 是编译期嵌入的，
cargo 不知道 `.sql` 变了）—— 必须 `touch` 一个 `.rs`。本笔虽没动迁移，但同一轮踩到过，
记在这里免得下一个人再花半小时。核验办法：查 `_sqlx_migrations` 的最大版本号。
