-- 减法：删除三个「只写不读 / 建了没用」的死对象。
--
-- 1) order_lines.link_no —— 行级「单号」。
--    原版该列可逐行编辑（Hui.formatted.js:2597-2602、5408-5413 `modelValue: e["单号"]`），
--    并作为「序号优先」排序键（`parseInt(OrderID.split('-')[0])`）。移植时丢了编辑器，
--    全项目无任何 UI 写点 → 恒为 NULL，只读点（排序）恒走 receipt_no 回退，排序静默失效。
--    本次做减法：删列，排序退回订单级单号。
--
-- 2) order_lines.markup_raw —— 「加价项目原始数据」。
--    原版在加价重算里写它（Hui.formatted.js:1308/3873/4206 `JSON.stringify(...)`），
--    新版 recalcMarkup 只写 markup / other_fee，漏了该写点 → 恒为空串；
--    读取处 `l.markup_raw || l.markup` 一直走 l.markup 兜底，删列不影响输出。
--
-- 3) print_templates.remark —— 建表时带上，后端 SELECT/DTO 一路透传，前端零读取。
--
-- 4) app_meta —— 0001 基线迁移的建表+播种，仅用于自证迁移机制可用；此后全项目零读取。

ALTER TABLE order_lines      DROP COLUMN IF EXISTS link_no;
ALTER TABLE order_lines      DROP COLUMN IF EXISTS markup_raw;
ALTER TABLE print_templates  DROP COLUMN IF EXISTS remark;
DROP TABLE IF EXISTS app_meta;
