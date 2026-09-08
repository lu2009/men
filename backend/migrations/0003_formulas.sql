-- 公式管理：公式元数据 + 部件参数（JSONB 占位）
CREATE TABLE IF NOT EXISTS formulas (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    formula_type        TEXT NOT NULL DEFAULT '',
    door_width          TEXT NOT NULL DEFAULT '',
    door_height         TEXT NOT NULL DEFAULT '',
    light_window_height TEXT NOT NULL DEFAULT '0',
    wall_thickness      TEXT NOT NULL DEFAULT '0',
    jiao                TEXT NOT NULL DEFAULT '0',
    mother_door_width   TEXT NOT NULL DEFAULT '0',
    square              TEXT NOT NULL DEFAULT '0',
    parts               JSONB NOT NULL DEFAULT '{}',
    remark              TEXT NOT NULL DEFAULT '',
    created_by          BIGINT REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formulas_tenant_id ON formulas(tenant_id);
