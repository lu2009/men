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
| 角色鉴权 | **router 层中间件**，白名单放行 + 其余要 `admin`（deny-by-default）。2026-09-19 补，见下节 |

## 模块结构（模块化单体）

```
backend/src/
├── main.rs            # 入口：配置 → 连库 → 迁移 → 播种 → 起服务
├── app.rs             # 组装：注册模块路由 + 跨域 + 追踪 + 注入状态
├── core/              # 横切关注点（仅被模块依赖，不依赖模块）
│   ├── config.rs / db.rs
│   ├── error.rs       # ApiError → { error: { code, message } }
│   ├── response.rs    # 成功 → { data: ... }
│   ├── guard.rs       # 角色授权中间件 + 白名单（2026-09-19 补）
│   └── auth.rs        # Bearer 提取器 + CurrentUser 提取器 + 会话解析
└── modules/           # 业务模块（依赖 core）
    ├── health.rs
    ├── auth/          # handler / service / model
    └── scanner/       # 扫码账号开户/销户（2026-09-19 补，仅 admin）
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
| `POST /api/v1/auth/login` | 无 | `{username,password}` → `{token,user,tenant}`（`user.role` 用于前端判落地页/导航） |
| `POST /api/v1/auth/logout` | ✅ | 删除当前会话 |
| `GET /api/v1/auth/me` | ✅ | 当前用户 + 租户 |
| `POST /api/v1/auth/change-password` | ✅ | `{old_password,new_password}` |

认证方式：请求头 `Authorization: Bearer <token>`；受保护处理器用 `CurrentUser` 提取器（含 `user_id/tenant_id/username/name/role`）。

## 角色授权层（2026-09-19 补）

### 为什么补

在这之前**全后端只有 `auth/service.rs` 一处**按用户身份行事，没有任何地方按 `role` 拦权限
⇒ 一个 `role='scanner'` 的账号（发给车间工人、装在他们手机上的那种）能调**所有**端点：
删订单、动财务、改设置、读客户资料。这是权限漏洞，不是理论风险。

旧版靠 `userinfo.defaulted`（1=车间主账号 / 2=扫码账号 / 3=终端账号）做**前端**门控，
服务端只有 `requireAuth`（验令牌不验角色）。新版用 `role` 表达同一件事，并把门控放到**服务端**
—— 前端门控只能防误点，防不住直接打接口。

### 怎么做（`backend/src/core/guard.rs`）

`app.rs` 把路由分成两棵子树，中间件套在 `guarded` 那棵上：

- `public`（**不经过**授权层）：`POST /auth/login`、`GET /api/v1/health`、
  `GET /api/v1/public/receipts`（靠 HMAC 分享令牌自保）。
- `guarded`（其余全部）：先过 `guard::require_role`，401（没登录）/ 403（角色不够）。

角色口径：

| 角色 | 能调什么 |
|---|---|
| `admin` | 全部 |
| `scanner` | 自助端点 + `GET /progress`、`GET /progress/more`、`POST /progress/update`、`POST /scan/labels`、`GET /procedures`（**只读**） |
| 其它（含 `users.role` 默认值 `staff`） | 只放开自助端点 |
| 自助端点（任何已登录角色） | `GET /auth/me`、`POST /auth/logout`、`POST /auth/change-password` |

**deny-by-default 靠两件互相独立的事**：① 新模块默认往 `guarded` 里 merge（忘归类的后果是**被拦**）；
② 白名单是「方法 + 完整路径」的**精确匹配**，不是前缀 —— 老模块里新加的端点照样要 admin。
`Router::layer` 只作用于调用它时已登记的路由（axum 0.8 语义），所以 `.layer()` 必须写在所有
`.merge()` 之后，`app.rs` 里那条注释是写给人看的。

### 敏感模块（只有 admin）

`orders` / `finance` / `receipts` / `settings`（列显隐、加价项目）/ `catalog`（取价、公式匹配、打印模板）/
`formula` / `clients` / `scanner-accounts`（开户销户本身）。

## 安全说明

- 令牌明文仅回传一次，服务端存 SHA-256 哈希。
- 密码策略：8–20 位，含大小写字母、数字、特殊字符（开户与改密共用一条）。
- `create-scanner-account` 只能建出 `role='scanner'`；**没有任何接口能建管理员**
  （已存在角色的提升没有路径：开户写死 scanner，改密不动 `role`）。
- **有意不抄旧版**：旧版 `changePassword` 顺手把 `isDefaultPw` 置 0（`auth.service.ts:260`），
  那会让扫码账号改一次自己的密码就把自己降级成普通 PC 账号。新版改密不碰 `role`。
- 令牌存前端 `localStorage`（Web 与 Tauri webview 均可），属脚手架阶段务实选择；生产可迁移 httpOnly cookie。
- 暂未实现：改密后吊销**其它**会话、首次登录强制改密、刷新令牌。

## 验证结果

- 2026-08-21：端到端 curl 验证通过（未带令牌 401 / 错误密码 401 / 登录 200 / me 200 / 改密往返 /
  登出 200 / 登出后 401 / health 200）。
- 2026-09-19：扫码账号 + 授权层 54 项端到端验收全绿，脚本 `docs/qrscanner-authz-check.mjs`
  （另起 `PORT=3999` 实例跑，不动开发用的 3000）；单元测试 `cargo test` 18 项全绿，
  其中 `app::tests` 用 `oneshot` 逐个模块钉住「无令牌必须是 401」。

## 验证结果

端到端 curl 验证通过：未带令牌 401 / 错误密码 401 / 登录 200 / me 200 / 改密往返 / 登出 200 / 登出后 401 / health 200。
