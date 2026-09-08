-- 订单行补全字段：对齐旧版 ping_hui(45键)/diao_hui(50键) 行模型。
-- 差异字段（扇数/套线等）已存在；本迁移补齐旧版其余行字段。

ALTER TABLE order_lines
    ADD COLUMN IF NOT EXISTS open_img           TEXT NOT NULL DEFAULT '',           -- 开向 3D 示意图码
    ADD COLUMN IF NOT EXISTS edge_seal_count    DOUBLE PRECISION,                   -- 边封数（平开 单双丁?2:null；吊趟 2）
    ADD COLUMN IF NOT EXISTS seal_board_height  DOUBLE PRECISION NOT NULL DEFAULT 0,-- 封板高 mm
    ADD COLUMN IF NOT EXISTS track_length       DOUBLE PRECISION NOT NULL DEFAULT 0,-- 轨道长 mm
    ADD COLUMN IF NOT EXISTS front_casing_add   DOUBLE PRECISION,                   -- 前包加长
    ADD COLUMN IF NOT EXISTS back_casing_add    DOUBLE PRECISION,                   -- 后包加长
    ADD COLUMN IF NOT EXISTS link_no            TEXT,                               -- 关联订单单号
    ADD COLUMN IF NOT EXISTS double_ding        TEXT,                               -- 单双丁
    ADD COLUMN IF NOT EXISTS light_window_count INTEGER NOT NULL DEFAULT 0,        -- 亮窗数量
    ADD COLUMN IF NOT EXISTS image_id           TEXT,                               -- IndexedDB 图片 id
    ADD COLUMN IF NOT EXISTS image_url          TEXT,                               -- 图片 URL
    ADD COLUMN IF NOT EXISTS progress           TEXT NOT NULL DEFAULT '',           -- 生产进度标识
    ADD COLUMN IF NOT EXISTS hole_size          TEXT NOT NULL DEFAULT '',           -- 洞尺/净尺口径
    ADD COLUMN IF NOT EXISTS markup_raw         TEXT NOT NULL DEFAULT '';           -- 加价项目原始数据
