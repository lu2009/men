-- 打印模板表（Phase F 脚手架）：
-- 旧版 getTemplates?param2=registrant 返回的 hiprint 模板 JSON（{config:{panels:[...]}}）落库，
-- 供 hiprint 打印引擎按单据模式/模板名取用。纸张按模板名推断：lable → 70×90 竖版，其余 A4。

CREATE TABLE IF NOT EXISTS print_templates (
    id         BIGSERIAL PRIMARY KEY,
    tenant_id  BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mode       TEXT NOT NULL DEFAULT '',             -- 单据模式：1..11 / receipt / sale 等
    name       TEXT NOT NULL DEFAULT '',             -- 模板名：product/glass/glassHole/lable/receipt/...
    paper      TEXT NOT NULL DEFAULT 'A4',           -- 纸张：A4 | 70x90
    template   JSONB NOT NULL DEFAULT '{}',          -- hiprint 模板 {config:{panels:[...]}}
    remark     TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_templates_tenant ON print_templates(tenant_id, mode);
CREATE UNIQUE INDEX IF NOT EXISTS idx_print_templates_uniq ON print_templates(tenant_id, mode, name);
