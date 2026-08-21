# 登录认证模块设计文档

- 日期：2026-08-21
- 阶段：认证模块（模块化单体）
- 前置：`2026-08-21-scaffold-design.md`（脚手架）

## 目标

在脚手架上实现首个业务子系统「登录认证」，确立模块化单体的代码组织、统一错误/响应、认证中间件与多租户模式，供后续业务模块复用。

## 关键决策

| 决策 | 选择 |
|---|---|
| 多租户 | 从根上多租户（users 带 tenant_id，后续业务表均带 tenant_id） |
| 令牌机制 | 数据库会话令牌（SHA-256 哈希落库，7 天过期，可吊销） |
| 密码哈希 | argon2 |
| 初始账号 | 启动时 bootstrap 播种默认租户 + 管理员（SQL 迁移无法跑 argon2） |

## 模块结构（模块化单体）

```
backend/src/
├── main.rs            # 入口：配置 → 连库 → 迁移 → 播种 → 起服务
├── app.rs             # 组装：注册模块路由 + 跨域 + 追踪 + 注入状态
├── core/              # 横切关注点（仅被模块依赖，不依赖模块）
│   ├── config.rs / db.rs
│   ├── error.rs       # ApiError → { error: { code, message } }
│   ├── response.rs    # 成功 → { data: ... }
│   └── auth.rs        # Bearer 提取器 + CurrentUser 提取器 + 会话解析
└── modules/           # 业务模块（依赖 core）
    ├── health.rs
    └── auth/          # handler / service / model
```

依赖方向单向：`modules/* → core`。迁移统一在 `backend/migrations/`。

## 数据模型

- `tenants(id, name, created_at)`
- `users(id, tenant_id → tenants, username UNIQUE, password_hash, name, role, created_at, updated_at)`
- `sessions(id, user_id → users, token_hash UNIQUE, expires_at BIGINT unix 秒, created_at)`

`username` 全局唯一（登录时定位租户）；`role` 暂为 `admin` / `staff` 字符串。

## API

| 端点 | 鉴权 | 说明 |
|---|---|---|
| `POST /api/v1/auth/login` | 无 | `{username,password}` → `{token,user,tenant}` |
| `POST /api/v1/auth/logout` | ✅ | 删除当前会话 |
| `GET /api/v1/auth/me` | ✅ | 当前用户 + 租户 |
| `POST /api/v1/auth/change-password` | ✅ | `{old_password,new_password}` |

认证方式：请求头 `Authorization: Bearer <token>`；受保护处理器用 `CurrentUser` 提取器（含 `user_id/tenant_id/username/name/role`）。

## 安全说明

- 令牌明文仅回传一次，服务端存 SHA-256 哈希。
- 密码策略：8–20 位，含大小写字母、数字、特殊字符。
- 令牌存前端 `localStorage`（Web 与 Tauri webview 均可），属脚手架阶段务实选择；生产可迁移 httpOnly cookie。
- 暂未实现：改密后吊销旧会话、首次登录强制改密、角色鉴权（403）、刷新令牌。

## 验证结果

端到端 curl 验证通过：未带令牌 401 / 错误密码 401 / 登录 200 / me 200 / 改密往返 / 登出 200 / 登出后 401 / health 200。
