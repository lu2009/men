-- 财务子系统（新财务 Ht，见 docs/2026-09-17-home-analysis.md §5/§7.3/§8.2）。
-- 四张表：收款流水 / 订单抹零 / 客户抹零 / 预付款分配。
--
-- 不设指向 orders 的外键：旧版删除订单走「先红冲再删」（§4.3），财务记录需独立于订单存续；
-- 各表冗余 customer_code/customer_name/receipt_no，便于按客户聚合，且订单删除后仍可对账。

CREATE TABLE IF NOT EXISTS finance_payments (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_code  TEXT NOT NULL DEFAULT '',
    customer_name  TEXT NOT NULL DEFAULT '',
    order_id       BIGINT,                          -- NULL = 客户级资金池（预付款/客户收款）
    receipt_no     TEXT NOT NULL DEFAULT '',
    amount         DOUBLE PRECISION NOT NULL DEFAULT 0,  -- 正=收款，负=红冲
    pay_date       TEXT NOT NULL DEFAULT '',              -- YYYY-MM-DD
    method         TEXT NOT NULL DEFAULT '',              -- 收款方式
    remark         TEXT NOT NULL DEFAULT '',
    kind           TEXT NOT NULL DEFAULT 'payment',       -- order_payment/customer_payment/prepayment/clear_account
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_payments_tenant_customer
    ON finance_payments(tenant_id, customer_code);
CREATE INDEX IF NOT EXISTS idx_finance_payments_tenant_order
    ON finance_payments(tenant_id, order_id);

CREATE TABLE IF NOT EXISTS finance_order_adjustments (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_code  TEXT NOT NULL DEFAULT '',
    customer_name  TEXT NOT NULL DEFAULT '',
    order_id       BIGINT NOT NULL,
    receipt_no     TEXT NOT NULL DEFAULT '',
    amount         DOUBLE PRECISION NOT NULL DEFAULT 0,  -- 正=减免（抹零/优惠），负=冲销
    type           TEXT NOT NULL DEFAULT '',             -- 抹零/优惠/补贴/冲销/其他
    remark         TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_order_adj_tenant_order
    ON finance_order_adjustments(tenant_id, order_id);

CREATE TABLE IF NOT EXISTS finance_customer_adjustments (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_code  TEXT NOT NULL DEFAULT '',
    customer_name  TEXT NOT NULL DEFAULT '',
    amount         DOUBLE PRECISION NOT NULL DEFAULT 0,  -- 正=减免，负=冲销
    type           TEXT NOT NULL DEFAULT '',             -- 月度抹零/优惠/冲销/其他
    remark         TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_customer_adj_tenant_customer
    ON finance_customer_adjustments(tenant_id, customer_code);

CREATE TABLE IF NOT EXISTS finance_allocations (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_code  TEXT NOT NULL DEFAULT '',
    order_id       BIGINT NOT NULL,
    receipt_no     TEXT NOT NULL DEFAULT '',
    amount         DOUBLE PRECISION NOT NULL DEFAULT 0,  -- 分配到该订单的金额
    discount       DOUBLE PRECISION NOT NULL DEFAULT 0,  -- 优惠抵扣金额
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_alloc_tenant_customer
    ON finance_allocations(tenant_id, customer_code);
CREATE INDEX IF NOT EXISTS idx_finance_alloc_tenant_order
    ON finance_allocations(tenant_id, order_id);
