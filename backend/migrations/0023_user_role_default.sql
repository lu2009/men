-- `users.role` 的默认值 `staff` → `admin`。
--
-- ## 为什么改
--
-- 0002 建表时给了 `DEFAULT 'staff'`，但**我们的代码从来不创建 `staff`**：
-- 建号只有两条路 —— 播种管理员（`auth/service.rs` 写死 `'admin'`）与
-- 扫码账号（`scanner` 模块写死 `'scanner'`）。`staff` 是个**没人用的遗留默认值**。
--
-- 留着它会撞上一个**前后端口径不一致**（2026-09-19 发现）：
--
-- | | 对 `staff` 的口径 |
-- |---|---|
-- | 前端 `app/src/utils/roles.ts` | 「除 `scanner` 外一切 role 都按普通 PC 账号处理」⇒ **全套菜单** |
-- | 后端 `core/guard.rs` 的 `allowed_for` | **deny-by-default** ⇒ **一个端点也调不动** |
--
-- ⇒ 真手工插一个 `staff` 用户，他会**看见全套菜单、点什么都 403** —— 一个很难查的哑火。
--
-- 用户 2026-09-19 拍板：**改默认值**（而不是「后端跟着前端放行 staff」）。
-- 理由是**让默认值和实际用法一致**，同时**不动 deny-by-default 的结构** ——
-- 以后新增角色仍然默认被拦住，只是不会再有人意外撞上 `staff` 这个空档。
--
-- ## 只改默认值，**不动已有行**
--
-- 本迁移**不 UPDATE 任何行**。理由：现有 `staff` 行（如果有）是**手工插入**的，
-- 把它们的角色改成什么属于**产品决定**，不该由一条迁移顺手做掉。
-- 写这条时库里的实际状况：`role='admin'` 1 行、**`role='staff'` 0 行**（已核）。
-- 若将来发现有 `staff` 行，那是一条**独立的口径问题**（它现在会被全线 403），另行处理。

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'admin';

COMMENT ON COLUMN users.role IS
  '账号角色。代码只创建两种：''admin''（播种管理员）与 ''scanner''（扫码账号，见模块 scanner）。'
  '授权口径在 core/guard.rs 的 allowed_for：admin 全放行、scanner 只放行扫码那一组、'
  '其余**一律拦住**（deny-by-default）。'
  '⚠️ 默认值 2026-09-19 由 ''staff'' 改成 ''admin''（迁移 0023）—— 前者是个没人用的遗留值，'
  '留着会让手工插入的号「菜单全有、点什么都 403」。';
