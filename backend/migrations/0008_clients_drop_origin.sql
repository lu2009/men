-- 移除客户户籍字段（旧版虽返回该字段但页面不展示，本次彻底移除）
ALTER TABLE clients DROP COLUMN IF EXISTS origin;
