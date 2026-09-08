-- 客户信息：编号 + 名称/品牌/联系人/电话/送货电话/地址/户籍/物流商/物流电话
CREATE TABLE IF NOT EXISTS clients (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code            TEXT NOT NULL DEFAULT '',
    name            TEXT NOT NULL,
    brand           TEXT NOT NULL DEFAULT '',
    contact         TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    delivery_phone  TEXT NOT NULL DEFAULT '',
    address         TEXT NOT NULL DEFAULT '',
    origin          TEXT NOT NULL DEFAULT '',
    logistics       TEXT NOT NULL DEFAULT '',
    logistics_phone TEXT NOT NULL DEFAULT '',
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_tenant_code ON clients(tenant_id, code) WHERE code <> '';
