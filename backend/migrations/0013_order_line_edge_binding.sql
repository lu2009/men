-- 订单行补全「包边」字段：双包/单包/外包/内包/平框。
-- 旧版「套线种类」字段存包边类型（双包/外包/内包/平框，见 Hui.formatted.js 758/1099 行 autocomplete），
-- 算料时按 part.track === 套线种类 激活套线部件（单包=1宽2高、双包=2宽4高）。
-- 新版 casing 字段被复用为套线长度模式（一高一宽/两高两宽…），故新增独立列承载包边类型，
-- 替换原先「墙厚>0→双包」的近似（formulaEngine.isCasingTrackActive）。

ALTER TABLE order_lines
    ADD COLUMN IF NOT EXISTS edge_binding TEXT NOT NULL DEFAULT '';
