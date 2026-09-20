# 智能门窗（SmartDoor）

面向铝合金门窗加工厂的 ERP + MES 软件。当前进度：**三端打通的可运行骨架 + 登录认证模块**（模块化单体 + 多租户）。

> 业务参考：`legacy/` 目录保留了旧版「开门红」的编译产物与 `DESIGN-DOC.md` 设计文档，作为后续业务复刻的依据（非源码）。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Rust · axum · sqlx · PostgreSQL |
| 前端 | Vue 3 · TypeScript · Vite · Naive UI · Pinia · Vue Router |
| 桌面端 | Tauri 2（复用前端，通过网络访问后端） |
| 数据库 | PostgreSQL 16（Docker Compose） |

## 目录结构

```
door-main/
├── Cargo.toml        # cargo workspace 根（成员见下）—— 全仓库只有根目录这一个 Cargo.lock
├── package.json      # 只有一条跨栈命令：npm run verify
├── scripts/verify.mjs# 统一验证入口（见「验证」一节）
├── backend/          # Rust axum API 服务（workspace 成员）
│   ├── src/main.rs   # 入口
│   ├── src/app.rs    # 路由组装
│   ├── src/core/     # 横切：config/db/error/response/auth/guard（角色授权）
│   ├── src/modules/  # 业务模块：auth、health、orders、progress、scanner…
│   └── migrations/   # sqlx 迁移（启动时自动执行）
├── app/              # Vue 3 + TS 前端
│   ├── src/          # 前端源码
│   └── src-tauri/    # Tauri 2 桌面壳（workspace 成员）
├── legacy/           # 旧版编译产物（业务参考）
├── compose.yaml      # PostgreSQL 容器
└── docs/             # 设计文档（验证相关见 docs/verification.md）
```

> `backend` 与 `app/src-tauri` 在同一个 cargo workspace 里：`cargo fmt --all` /
> `cargo clippy --workspace` / `cargo test --workspace` 在**仓库根**一条命令覆盖两个包。
> 下面那些 `cd backend && cargo …` 的写法**照样有效** —— cargo 按当前目录所在的成员包定位。

## 快速开始

### 1. 启动数据库

```bash
docker compose up -d
```

### 2. 启动后端

```bash
cd backend
cargo run
# 监听 http://localhost:3000，启动时自动执行迁移
# 验证：curl http://localhost:3000/api/v1/health
```

### 3. 启动前端（Web）

```bash
cd app
npm install
npm run dev
# 打开 http://localhost:5173，首页应显示「后端 + 数据库」均已连通
```

### 4. 启动桌面端（Tauri）

```bash
cd app
npm run tauri dev
# 首次编译 Rust 依赖较慢，耐心等待；桌面窗口打开后同样显示连通状态
```

### 默认账号

首次启动会自动播种默认租户 + 管理员（仅当 `users` 表为空时）：

| 项 | 值 |
|---|---|
| 用户名 | `admin` |
| 密码 | `Admin@12345`（请登录后修改） |
| 租户 | `默认门窗厂` |

## 验证

```bash
npm run verify          # 全套：fmt → 前端类型检查+生产构建 → clippy → cargo test → 36 个差分台
```

一条命令跑完**所有**检查，CI（`.github/workflows/ci.yml`）跑的就是它。
以前这些散在五六个地方、各跑各的，于是「验收只跑了记得的那几个」，`print-lineno-check.mjs`
的手写桩坏了一天才被发现 ⇒ 现在验收 = **跑全套**，不是「跑我记得的那几个」。

它**不碰**你正在跑的那套：自带一次性数据库 `smartdoor_verify` 与端口 `3100`，
只 `kill` 自己起的进程、只 `docker compose up -d db`（**从不 `compose down`**，那会连
`pgdata` 卷一起删）。跑完把那个库删掉。

⚠️ `verify` **不等于全绿**：有几个台子要有仓库外的旧版服务端源码、或要有业务配置才能跑，
它们会被显式列成「**未运行**」（未运行 ≠ 通过）。**完整说明、环境变量、已知未覆盖与
已知红清单：`docs/verification.md`。**

## 环境变量

后端配置见 `backend/.env.example`（复制为 `backend/.env` 后修改）：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgres://smartdoor:smartdoor@localhost:5432/smartdoor` | 数据库连接串 |
| `PORT` | `3000` | 后端端口 |
| `CORS_ORIGINS` | `http://localhost:5173,tauri://localhost,http://tauri.localhost` | 允许的跨域来源 |
| `ADMIN_USERNAME` | `admin` | 首次播种的管理员用户名 |
| `ADMIN_PASSWORD` | `Admin@12345` | 首次播种的管理员密码 |
| `ADMIN_TENANT_NAME` | `默认门窗厂` | 首次播种的默认租户名 |

## 认证接口

| 端点 | 鉴权 | 说明 |
|---|---|---|
| `POST /api/v1/auth/login` | 无 | 登录，返回 `{token, user, tenant}`（`user.role` 供前端判落地页/导航） |
| `POST /api/v1/auth/logout` | ✅ | 登出当前会话 |
| `GET /api/v1/auth/me` | ✅ | 当前用户 + 租户 |
| `POST /api/v1/auth/change-password` | ✅ | 修改密码 |
| `POST /api/v1/scanner-accounts` | **admin** | 开扫码账号（`{suffix, password}`，账号名 = 租户名 + 后缀） |
| `DELETE /api/v1/scanner-accounts?suffix=` | **admin** | 销扫码账号（会话级联失效） |

认证方式：`Authorization: Bearer <token>`。

**角色与授权**：`role` 取 `admin` / `scanner`。授权在 **router 层**统一拦（`backend/src/core/guard.rs`），
白名单之外一律要 `admin` —— 新增模块忘了归类是**被拦住**而不是被放行。
`scanner` 只能调：`/auth/me`、`/auth/logout`、`/auth/change-password`、
`GET /scan/qrcode`、`GET /scan/stats`、`POST /progress/update`、`POST /scan/labels`、
`GET /print-templates/lable`（**只有这一个 mode**）、`GET /procedures`。
> ⚠️ **2026-09-19 改过两条**：① **删**掉 `GET /progress` 与 `GET /progress/more` —— 两条都是**全量**
> 接口（整库门行带客户名/金额/安装地址），而扫码页跑在车间工人的手机上 ⇒ 换成上面两条**窄**的
> （只回自己扫到/范围内的行）；② **加**上 `GET /print-templates/lable`（「打印标签」那颗按钮要用，
> 回的是模板 JSON、不含业务数据）。扫码页若报 403，先看它调的是不是全量那条 / 别的 mode。
未登录 401、角色不够 403。详见 `docs/2026-08-21-auth-design.md`。

## 约定

- 后端统一以 `/api/v1/*` 提供接口，业务模块在 `backend/src/modules/` 下按域拆分（模块化单体，依赖方向 `modules → core`）。
- 成功响应统一 `{ data: ... }`，错误响应 `{ error: { code, message } }`。
- 前端 API 封装统一走 `app/src/api/`；Web 端经 Vite 代理 `/api`，桌面端通过 `VITE_API_BASE_URL` 指向后端。
- 数据库迁移放在 `backend/migrations/`，文件名按 `NNNN_描述.sql` 递增。
