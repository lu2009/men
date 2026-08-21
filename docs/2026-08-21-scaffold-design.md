# 智能门窗 脚手架设计文档

- 日期：2026-08-21
- 阶段：脚手架（最小可运行骨架）

## 目标

从零搭建「智能门窗」多端应用的可运行骨架：Rust 后端 + Vue 3 前端 + PostgreSQL + Tauri 2 桌面端，三端打通。业务功能（订单、汇算计料、生产、财务等）不在本阶段范围，后续依据 `legacy/DESIGN-DOC.md` 分期实现。

## 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 架构形态 | 独立服务端 + 桌面壳 | 保留 SaaS 多租户能力，桌面端仅作为更顺手的入口，通过网络访问后端 |
| 后端框架 | axum 0.8 | tokio 生态最主流、最活跃 |
| 数据访问 | sqlx 0.8 | 编译期校验 SQL、异步、轻量，不引入重 ORM |
| UI 组件库 | Naive UI | 用户指定（Vue3 原生 TS、主题定制强） |
| 本地数据库 | Docker Compose（PostgreSQL 16） | 本机无 psql、有 Docker |
| 包管理 | npm | 本机无 pnpm，避免额外安装 |

## 目录结构

```
door-main/
├── backend/          # Rust axum API 服务
│   ├── src/          # main / config / db / routes
│   └── migrations/   # sqlx 迁移（启动时自动执行）
├── app/              # Vue 3 + TS 前端
│   ├── src/          # router / stores / api / views
│   └── src-tauri/    # Tauri 2 桌面壳
├── legacy/           # 旧版编译产物（业务参考）
├── docs/
├── compose.yaml
└── README.md
```

## 端口与连通

| 组件 | 地址 |
|---|---|
| PostgreSQL（Docker） | `localhost:5432`，库/用户 `smartdoor` |
| 后端 axum | `http://localhost:3000`，`GET /api/v1/health` |
| 前端 Vite dev | `http://localhost:5173`，`/api` 代理到 `3000` |
| Tauri dev | 桌面窗口指向 `5173` |

连通验证：前端首页调用 `/api/v1/health`，展示后端与数据库连通状态。

## 约定

- 后端接口统一 `/api/v1/*`，业务模块在 `backend/src/routes/` 按域拆分。
- 前端 API 统一封装于 `app/src/api/`；Web 端走 Vite 代理，桌面端走 `VITE_API_BASE_URL`。
- 迁移放 `backend/migrations/`，用 `sqlx::migrate!` 启动时自动执行，无需 sqlx-cli。
- 开发期 CORS 宽松（Vite + Tauri 来源），生产收紧。

## 本阶段不做（YAGNI）

- 用户认证 / 登录、订单、汇算计料、公式、生产进度、财务、打印、3D/画图、扫码等业务模块。
- CI/CD、部署、PWA、AI 客服集成。
