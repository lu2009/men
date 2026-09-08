-- 取价 / 公式匹配（Phase C 脚手架）：
-- 旧版 getPingPrice/getDiaoPrice/getDiaoFormulas 的落库表，供导入旧数据后由前端取价/匹配公式。
-- 平方表已由 formulas.square 承载（数字或 {扇数:"min-max"} 对象），无需单独建表。

-- 型材价格表：按「型材」取单价/计价方式/套线单价/锁定条件，可设客户专属价。
CREATE TABLE IF NOT EXISTS profile_prices (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    line_type    TEXT NOT NULL DEFAULT 'ping',       -- ping 平开 / diao 吊趟
    profile      TEXT NOT NULL DEFAULT '',           -- 型材（关键字）
    price_type   TEXT NOT NULL DEFAULT '套',          -- 套 / 方
    unit_price   DOUBLE PRECISION NOT NULL DEFAULT 0,  -- 单价
    casing_price DOUBLE PRECISION,                    -- 套线单价（diao，元/米）
    lock_rules   JSONB NOT NULL DEFAULT '[]',         -- 锁定条件数组（getPingPrice lock[]）
    client_code  TEXT NOT NULL DEFAULT '',            -- 客户专属价（'' = 通用价）
    remark       TEXT NOT NULL DEFAULT '',
    created_by   BIGINT REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_prices_tenant ON profile_prices(tenant_id, line_type, profile);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_prices_uniq
    ON profile_prices(tenant_id, line_type, profile, client_code);

-- 公式匹配表：型材/扇数 → 公式（getDiaoFormulas 的匹配结果）。
CREATE TABLE IF NOT EXISTS formula_matches (
    id         BIGSERIAL PRIMARY KEY,
    tenant_id  BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    line_type  TEXT NOT NULL DEFAULT 'diao',         -- ping / diao
    profile    TEXT NOT NULL DEFAULT '',             -- 型材关键字
    fans       TEXT NOT NULL DEFAULT '',             -- 扇数（'' = 任意）
    formula_id BIGINT NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    priority   INTEGER NOT NULL DEFAULT 0,           -- 匹配优先级（越大越先）
    remark     TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formula_matches_tenant ON formula_matches(tenant_id, line_type, profile);
CREATE UNIQUE INDEX IF NOT EXISTS idx_formula_matches_uniq
    ON formula_matches(tenant_id, line_type, profile, fans, formula_id);
