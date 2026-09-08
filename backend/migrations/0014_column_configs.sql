-- 列显隐配置（仿旧版 userinfo.ping_column / userinfo.diao_column）：
-- 每租户一组「字段名 → 布尔」，缺省空对象 = 全部可显隐列都显示。
-- 前端 Hui 页按此决定各列是否渲染，并提供「列显隐」设置弹窗。
CREATE TABLE IF NOT EXISTS column_configs (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    BIGINT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    ping_columns JSONB NOT NULL DEFAULT '{}',   -- 平开门列显隐 {字段: bool}
    diao_columns JSONB NOT NULL DEFAULT '{}',   -- 移门/吊趟列显隐 {字段: bool}
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
