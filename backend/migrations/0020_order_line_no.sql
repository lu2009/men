-- 行级「单号」（每一樘门一个流水号）+ 把 `orders.order_no_set` 的语义落正。
-- 见 docs/2026-09-18-order-no-semantics.md。
--
-- 为什么要有这一列：
--   旧版订单头**根本没有**「单号」这个字段 —— 它是**明细行**级的，
--   格式 `N-YY/MM/DD`（如 `85-26/09/14`），由旧服务端 `ensureLineNumbers()` 惰性补号，
--   **永不覆盖已有值**，序号按年在本租户内递增。
--   而订单头的 `单号集` 就是**该单所有明细行「单号」去重后 `_` 连接**（不是回执单号！）。
--
--   我们先前把 `单号` 当成「已并入 receipt_no」（见 0018 的注释）—— 那是**层级搞混**：
--   `回执单号`（= orders.receipt_no，订单级）与 `单号`（行级）是两个东西。
--   后果：单号集恒空、「查单号」恒不命中、Hui「单号」列显示的是订单号、
--   打印的二维码扫出来是订单号而不是「哪一樘门」、`orderPrefix()` 恒 0 导致
--   「序号优先」排序静默失效。
--
-- ⚠️ 0017/0018 是**已应用**的迁移，`main.rs` 用 `sqlx::migrate!` 会对它们做校验和比对，
--    改一个字符后端就起不来。所以更正一律走**新迁移**（本文件），不回改旧文件。
--    （0017 当初删过一个 `link_no`，删列理由「没有 UI 写点 ⇒ 恒为 NULL」是错的 ——
--      写点从来不在前端，在旧服务端。那笔更正也记在这里。）

ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS line_no TEXT NOT NULL DEFAULT '';

-- 「填入单号」要按**本租户该年份**扫全库取最大序号 ⇒ 按 tenant 扫就够了。
CREATE INDEX IF NOT EXISTS idx_order_lines_line_no ON order_lines (tenant_id, line_no);

COMMENT ON COLUMN order_lines.line_no IS
  '行级单号，格式 N-YY/MM/DD（如 85-26/09/14）。每樘门一个，永不覆盖已有值。'
  '订单头的 order_no_set 是它的去重并集。旧版由服务端 ensureLineNumbers() 生成。';

COMMENT ON COLUMN orders.order_no_set IS
  '该单所有明细行 line_no 去重后以 "_" 连接（旧版 buildReceiptNoSet 的 join(''_'')）。'
  '⚠️ 分隔符是下划线，不是空格（0018 的注释写错了，见 0020 文件头）。'
  '⚠️ 内容不是回执单号。全部行都为空时**保留旧值**，不清空（旧版的 fallback）。';
