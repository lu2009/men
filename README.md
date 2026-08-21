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
├── backend/          # Rust axum API 服务
│   ├── src/main.rs   # 入口
│   ├── src/app.rs    # 路由组装
│   ├── src/core/     # 横切：config/db/error/response/auth
│   ├── src/modules/  # 业务模块：auth、health
│   └── migrations/   # sqlx 迁移（启动时自动执行）
├── app/              # Vue 3 + TS 前端
│   ├── src/          # 前端源码
│   └── src-tauri/    # Tauri 2 桌面壳
├── legacy/           # 旧版编译产物（业务参考）
├── compose.yaml      # PostgreSQL 容器
└── docs/             # 设计文档
```

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
| `POST /api/v1/auth/login` | 无 | 登录，返回 `{token, user, tenant}` |
| `POST /api/v1/auth/logout` | ✅ | 登出当前会话 |
| `GET /api/v1/auth/me` | ✅ | 当前用户 + 租户 |
| `POST /api/v1/auth/change-password` | ✅ | 修改密码 |

认证方式：`Authorization: Bearer <token>`。

## 约定

- 后端统一以 `/api/v1/*` 提供接口，业务模块在 `backend/src/modules/` 下按域拆分（模块化单体，依赖方向 `modules → core`）。
- 成功响应统一 `{ data: ... }`，错误响应 `{ error: { code, message } }`。
- 前端 API 封装统一走 `app/src/api/`；Web 端经 Vite 代理 `/api`，桌面端通过 `VITE_API_BASE_URL` 指向后端。
- 数据库迁移放在 `backend/migrations/`，文件名按 `NNNN_描述.sql` 递增。
