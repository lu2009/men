-- 补齐 Home 订单主表所需的订单头字段（见 docs/2026-09-17-home-analysis.md §3/§7.1/§10）。
--
-- 旧版订单头（中文 key）→ 新版 orders 表映射：
--   单号集      -> order_no_set      合并订单后多个单号的空格串，主表「单号集」列显示
--   安装地址    -> install_address   头级安装地址（旧版「安装地址」列可内联编辑）
--   打单操作    -> production_status 生产状态机（"生产单 玻璃订单 标签 收据单" 等，空格串）
--   打单人      -> creator_name      制单人姓名（非管理员只看自己的单，见 §3.1 `fs`）
--   锁向        -> lock_direction    锁具方向配置
--
-- 截止日期仍由「下单日期 + 生产天数 + 1」在 SQL 层推导（旧版改下单日期时也是重算而非独立编辑，§4.6）。
-- 加价项目不设头级字段：旧版头只是提供默认项，真实加价在 Hui 明细表 order_lines.markup（§4.8）。
-- 单号（order_no）不单设列：新版 receipt_no 已承担「回执单号/单号」双重角色，主表只显示「单号集」。

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_no_set      TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS install_address   TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS production_status TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS creator_name      TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS lock_direction    TEXT NOT NULL DEFAULT '';
