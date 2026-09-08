-- 公式模板 key（用于列表展示细粒度门型名，如「铝木门」「单轨门」）。
-- 旧版存库时不存此字段，仅作展示增强；缺省空串时列表回退到 5 值 formula_type 标签。
ALTER TABLE formulas ADD COLUMN IF NOT EXISTS template_key TEXT NOT NULL DEFAULT '';
