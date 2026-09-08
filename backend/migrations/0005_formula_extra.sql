-- 公式附加配置（洞尺/包边/丁墙/合页/边封增量/固定配件等），JSONB 存储。
ALTER TABLE formulas ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}';
