-- 汇算订单：订单头 orders + 订单行 order_lines。
-- 行按 line_type 区分平开门(ping)/吊趟门(diao)，差异字段（扇数/套线等）用可空/默认列承载。
-- 算料结果 parts 与加价项 markup 存 JSONB（算料由前端 formulaEngine 计算，后端仅持久化）。

CREATE TABLE IF NOT EXISTS orders (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    receipt_no      TEXT NOT NULL DEFAULT '',      -- 回执单号（本租户内唯一）
    client_code     TEXT NOT NULL DEFAULT '',      -- 客户编号
    client_name     TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    brand           TEXT NOT NULL DEFAULT '',
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    production_days INTEGER NOT NULL DEFAULT 0,
    total_price     DOUBLE PRECISION NOT NULL DEFAULT 0,
    deposit         DOUBLE PRECISION NOT NULL DEFAULT 0,
    remark          TEXT NOT NULL DEFAULT '',
    salesperson     TEXT NOT NULL DEFAULT '',
    door_count      INTEGER NOT NULL DEFAULT 0,    -- 门数 = Σ行数量
    created_by      BIGINT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tenant_receipt ON orders(tenant_id, receipt_no) WHERE receipt_no <> '';

CREATE TABLE IF NOT EXISTS order_lines (
    id                  BIGSERIAL PRIMARY KEY,
    order_id            BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    line_type           TEXT NOT NULL DEFAULT 'ping',   -- ping 平开门 / diao 吊趟门
    row_index           INTEGER NOT NULL DEFAULT 0,

    -- 型材/颜色/开向/扇数/轨道/套线/五金/玻璃
    profile             TEXT NOT NULL DEFAULT '',
    color               TEXT NOT NULL DEFAULT '',
    direction           TEXT NOT NULL DEFAULT '',
    fans                TEXT NOT NULL DEFAULT '',
    track               TEXT NOT NULL DEFAULT '',
    casing              TEXT NOT NULL DEFAULT '',
    hardware            TEXT NOT NULL DEFAULT '',
    bottom_glass        TEXT NOT NULL DEFAULT '',
    face_glass          TEXT NOT NULL DEFAULT '',
    glass_thickness     TEXT NOT NULL DEFAULT '',

    -- 尺寸（mm）
    door_width          DOUBLE PRECISION NOT NULL DEFAULT 0,
    door_height         DOUBLE PRECISION NOT NULL DEFAULT 0,
    light_window_height DOUBLE PRECISION NOT NULL DEFAULT 0,
    wall_thickness      DOUBLE PRECISION NOT NULL DEFAULT 0,
    jiao                DOUBLE PRECISION NOT NULL DEFAULT 0,
    mother_door_width   DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- 计价
    quantity            INTEGER NOT NULL DEFAULT 1,
    unit_price          DOUBLE PRECISION NOT NULL DEFAULT 0,
    price_type          TEXT NOT NULL DEFAULT '套',     -- 套/方
    discount            DOUBLE PRECISION NOT NULL DEFAULT 1,
    square              DOUBLE PRECISION NOT NULL DEFAULT 0,
    custom_square       DOUBLE PRECISION NOT NULL DEFAULT -1,
    other_fee           DOUBLE PRECISION NOT NULL DEFAULT 0,
    casing_price        DOUBLE PRECISION NOT NULL DEFAULT 0,
    casing_amount       DOUBLE PRECISION NOT NULL DEFAULT 0,
    amount              DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- 算料/加价/关联
    parts               JSONB NOT NULL DEFAULT '[]',     -- 算料结果（前端 formulaEngine 计算）
    markup              JSONB NOT NULL DEFAULT '[]',     -- 加价项目
    formula_id          BIGINT REFERENCES formulas(id),
    remark              TEXT NOT NULL DEFAULT '',
    install_address     TEXT NOT NULL DEFAULT '',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_tenant_id ON order_lines(tenant_id);
