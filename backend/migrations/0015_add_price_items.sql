-- 加价项目列表（仿旧版「同步保存」后端持久化的加价项目目录）。
-- 每租户独立，name+price+unit 唯一。
CREATE TABLE IF NOT EXISTS add_price_items (
    id         BIGSERIAL PRIMARY KEY,
    tenant_id  BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name       TEXT NOT NULL DEFAULT '',
    price      DOUBLE PRECISION NOT NULL DEFAULT 0,
    unit       TEXT NOT NULL DEFAULT '元/套',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_add_price_items_uniq
    ON add_price_items(tenant_id, name, price, unit);
