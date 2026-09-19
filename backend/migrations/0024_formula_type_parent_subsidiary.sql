-- `formulas.formula_type` 的子母门取值：全小写 `parentsubsidiary` → 驼峰 `parentSubsidiary`。
--
-- ## 为什么改
--
-- 旧版「吊」页这套 `formulaType` **全是驼峰**，四处逐字可查（`legacy/js/Diao.deobfuscated.js`）：
--
-- | 位置 | 源码 |
-- |---|---|
-- | `:912-914` | `["ping","parentSubsidiary","double","diamond"].includes(...)`（「平开类」判据） |
-- | `:2213` | `l["formulaType"]==="parentSubsidiary" ? …`（加载时判子母门） |
-- | `:2236` | `"parentSubsidiary"===_0xb8c576["value"] ? (门洞宽="900", 母门宽="200") : …` |
-- | `:2133` | `:2534` 等模板加载器写入的也是 `"parentSubsidiary"` |
--
-- 我们建库时写成了**全小写**，于是**自家代码就劈成了两半**：
--
-- | 用全小写 | 用驼峰（= 旧版） |
-- |---|---|
-- | `data/formulaExtra.ts` 的 `SIMPLE_SQUARE_TYPES` | **`utils/printPayloads.ts:823`** |
-- | `data/formulaTemplates.ts` 的 `FORMULA_TYPE_LABELS` | **`utils/printPayloads.ts:1000`** |
-- | `views/Formulas.vue` 的 `isSubsidiary` / `isPingLike` | `utils/printPayloads.ts:839`（注释） |
-- | `composables/useOrderLines.ts` 的 `PING_FAMILY_TYPES` | |
--
-- ## ⚠️ 这不是「拼写不一致」，是**活的 bug**
--
-- `printPayloads.ts` 那几处的 `ft` 来自 `formulaOf(l)?.formula_type` —— **就是本表这一列**。
-- 它按驼峰比，而库里存的是小写 ⇒ **比不中** ⇒ 子母门公式的打印一直落进通用分支：
--
-- | 行 | 本该 | 实际（比不中后） |
-- |---|---|---|
-- | `:823` | 双玻 `4×数量` / 单玻 `2×数量` | `quantity×数量` / `(quantity/2)×数量` |
-- | `:1000` | 取「子门/母门玻璃宽·高」 | 取通用的「玻璃宽/玻璃高」 |
--
-- 也就是说**子母门的算料单据一直印错**，而且不报错、界面上看不出来。
--
-- ## 改哪边：对齐旧版（而不是把 printPayloads 改成小写）
--
-- 三个理由，任一条都够：
--   1. 旧版四处全是驼峰 —— 本项目的目标是跟旧版对齐，不是另立口径；
--   2. `printPayloads.ts` 那几处是**照旧版逐字复刻**过来的（注释里就写着「原版 A平 `_0xcfde65`」），
--      它是对的，错的是这边的数据；
--   3. 改数据只需一条 UPDATE，改代码要动 4 个文件且**改完仍然是「和旧版不一样」**。
--
-- ## 数据
--
-- 本迁移执行时库里的实际状况（已核）：`formulas` 共 2 行，
-- `formula_type` 分别是 `diao` 与 `ping`，**没有一行是 `parentsubsidiary`** —— 所以这条 UPDATE
-- 实际改 0 行。**仍然要写**：一是别让「开发和生产的差异」取决于谁先建了公式，
-- 二是留一条可追溯的口径变更记录。
--
-- 前端与后端代码在同一次改动里已改用驼峰；这条 UPDATE 是给「已经存过的行」兜底。

UPDATE formulas SET formula_type = 'parentSubsidiary' WHERE formula_type = 'parentsubsidiary';

COMMENT ON COLUMN formulas.formula_type IS
  '公式类型。取值为旧版「吊」页 `_0xb8c576` 的 5 个值之一：'
  'ping / diao / double / diamond / parentSubsidiary（**最后一个是驼峰，见迁移 0024**）。'
  '⚠️ `parentSubsidiary` 的拼写必须与旧版逐字一致 —— `utils/printPayloads.ts` 按它比，'
  '写成全小写会让子母门的算料单据静默走错分支。';
