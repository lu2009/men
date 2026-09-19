-- 工序颜色：给 `procedures` 加一列 `color`。
-- 逆向依据：docs/2026-09-19-qrscanner-analysis.md §4（「设置工序」弹窗）、§8.3 第 2 条。
--
-- ## 为什么要有这一列
--
-- 旧版「设置工序」弹窗里每道工序旁边有个 `el-color-picker`（`show-alpha`，自由取色），
-- 但**颜色一个字节都不上服务端** —— `SetProcedures` 的 body 只有 `{工序1:名字, …}`，
-- 颜色被写进**浏览器 localStorage** 的 `procedure_name_color_map`。
--
-- 那个键有三个毛病（都是旧版实打实的，见 §4.6 / §7.3）：
--
--   1. **键是「工序名」不是槽号** ⇒ 改一次名字就丢一次颜色（`wl[k] = t4[新名字]` 查不到旧色，
--      回落 `#FFFFFF`）；
--   2. **不分租户** —— localStorage 是浏览器级的，同一台机器换个账号登录就读到上一个租户的颜色；
--   3. 序表 `procedure_name_order_list` 与它「含不含工序10」的口径还不一致（§4.3）。
--
-- 新版**不做这两个键**，颜色直接落在 `procedures` 表上：键是 `slot`，改名不丢色、
-- 天然按 `tenant_id` 隔离，也不会出现「两个真相源」。
--
-- ## 为什么默认是空串，而不是 `#FFFFFF`
--
-- 旧版取色器初值确实是 `#FFFFFF`（`sa` 里 `wl[k] = t4[nm] ? t4[nm] : "#FFFFFF"`），
-- 但那是**前端**的默认值。库里存空串表示「这个槽没配过颜色」，
-- 「没配」和「显式配成白色」是两回事 —— 前端要什么兜底色由前端自己决定。
--
-- ## 注意
--
-- 本列**不加** CHECK 约束：旧版取色器 `show-alpha` 自由取色，落库的值不限于 `#RRGGBB`
-- （可能是 `rgba(...)` 或带 alpha 的 8 位 hex），写死格式会把合法值挡在门外。

ALTER TABLE procedures ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN procedures.color IS
  '工序颜色，前端取色器的值（旧版 el-color-picker show-alpha，自由取色、不限固定色板）。'
  '空串 = 该槽没配过颜色，由前端决定兜底色。'
  '⚠️ 旧版这玩意存在浏览器 localStorage 的 procedure_name_color_map 里（键是工序名 ⇒ 改名丢色、'
  '且不分租户）；新版落在本表上，键是 slot，见迁移 0022 文件头。';
