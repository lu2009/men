-- 生产进度（旧版 `/Progress` 页）的数据底座：**行级工序槽** + **租户级工序名清单**。
-- 三份逆向文档：docs/2026-09-19-progress-{analysis,server,shell}.md。
--
-- ## 为什么要有这一列
--
-- 旧版把 15 个工序槽存在 **`orders.door_specs` 这个 JSON** 里，键名是 `工序1`..`工序15`，
-- 每段的格式是 `工序名[_操作员]_YYYY-MM-DD`（操作员可省）。服务端
-- `buildProgressText()`（`/Users/aaa/Downloads/server/src/modules/progress/progress.service.ts:123`）
-- 把**非空**的槽按槽号拼成「生产进度」串、分隔符是 `➞`：
--
--     for (let i = 1; i <= 15; i++) { const v = row[`工序${i}`]; if (非空) parts.push(v) }
--     return parts.join('➞')
--
-- 我们新后端**从来没有**这 15 个槽（`order_lines` 只有一个 `progress TEXT` 标识串），
-- 所以 `/Progress` 不是「加个页面」就能做的 —— 先补数据模型。
--
-- ## 为什么按「行」存
--
-- 旧版的门行 = 我们的 `order_lines`；`parts` / `markup` 都是按行存的 JSONB，
-- 这里沿用同一风格（15 个槽做成列太丑，做成行表又要多一次 join）。
--
-- ## ⚠️ 没照抄的两处（有意偏离，理由见 0021 文件末）
--
-- 旧版前端在 `GetProcedures` 返回的清单里找不到「回款」时，会把它**硬塞进 `工序10`**，
-- 而服务端对 `工序10` 又走 `mergePrintStatus`（**合并**而非覆盖，其余 14 槽是覆盖）。
-- 两处特判是耦合的，实测能写出脏数据：
--
--     已有 工序10="回款"  →  再写 "回款_李四_2026-09-20"
--                          →  工序10="回款_回款_李四_2026-09-20"
--
-- 新版**两处一起去掉**：槽就是槽，没有哪个槽特殊；「回款」按普通工序名由租户自己配。

ALTER TABLE order_lines
  ADD COLUMN IF NOT EXISTS procedure_slots JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN order_lines.procedure_slots IS
  '行级工序槽：{"工序1":"下料_张三_2026-09-19","工序2":"组装"}。'
  '空槽可以不出现、也可以是空串（读的时候一律当空处理）。'
  '「生产进度」展示串 = 非空槽按槽号升序用 ➞ 连接（旧版 buildProgressText）。'
  '⚠️ 新版**没有**「工序10 特殊 / 回款硬编码」那两处特判，见 0021 迁移头。';

-- 租户级工序名清单 —— 15 个扁平槽。
--
-- ⚠️ **旧版这张表是按 `registrant` 查的，不是按 `ds`**。旧系统有**两把租户键**：
--    业务表（orders/clients）用 `userinfo.ds`、配置表（settings/procedures/templates）用
--    `userinfo.registrant`，两侧列名**都叫** `database_name`。传错**不报错、只静默降级**
--    （传 ds 进来 ⇒ 15 槽全空、下拉只剩「回款」）。
--    我们新后端只有一把 `tenant_id`，无法复现这个坑 —— 但在**从旧库导入**时要留意：
--    得按旧库的 `registrant` 去捞 procedures，不是按 `ds`。
CREATE TABLE IF NOT EXISTS procedures (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slot        TEXT NOT NULL,                      -- '工序1' .. '工序15'
    name        TEXT NOT NULL DEFAULT '',           -- 该槽的工序名（空 = 未配置）
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, slot)
);

COMMENT ON TABLE procedures IS
  '租户级工序名清单，15 个扁平槽（旧版 GetProcedures 的 {工序1:"下料",…}）。'
  '旧版存在同名表里、按 registrant 查；新版只有一把 tenant_id，见 0021 迁移头。';
