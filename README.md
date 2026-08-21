# 智能门窗（SmartDoor）

面向铝合金门窗加工厂的 ERP + MES 软件。当前为**脚手架阶段**：后端、前端、桌面端三端打通的最小可运行骨架。

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
│   ├── src/          # main / config / db / routes
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

## 环境变量

后端配置见 `backend/.env.example`（复制为 `backend/.env` 后修改）：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgres://smartdoor:smartdoor@localhost:5432/smartdoor` | 数据库连接串 |
| `PORT` | `3000` | 后端端口 |
| `CORS_ORIGINS` | `http://localhost:5173,tauri://localhost,http://tauri.localhost` | 允许的跨域来源 |

## 约定

- 后端统一以 `/api/v1/*` 提供接口，业务模块后续在 `backend/src/routes/` 下按域拆分。
- 前端 API 封装统一走 `app/src/api/`；Web 端经 Vite 代理 `/api`，桌面端通过 `VITE_API_BASE_URL` 指向后端。
- 数据库迁移放在 `backend/migrations/`，文件名按 `NNNN_描述.sql` 递增。
