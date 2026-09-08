-- 公式挖孔图：为某个公式按锁向挂玻璃开孔图，订单用该公式时算料单据带图。
CREATE TABLE IF NOT EXISTS formula_images (
    id         BIGSERIAL PRIMARY KEY,
    formula_id BIGINT NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    tenant_id  BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    direction  TEXT NOT NULL DEFAULT '',
    mirrored   BOOLEAN NOT NULL DEFAULT FALSE,
    mime       TEXT NOT NULL DEFAULT 'image/jpeg',
    data       BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formula_images_formula_id ON formula_images(formula_id);
CREATE INDEX IF NOT EXISTS idx_formula_images_tenant_id ON formula_images(tenant_id);
