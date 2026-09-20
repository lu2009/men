/**
 * Progress 订单进度页的**工具条 + 行勾选**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）—— **两段，不是一个连续区间**
 * （拆分方案里的 **P7**，共 **98 行** = 44 + 54，**8 个声明**）：
 *   · `Progress.vue:1374-1417`（44 行）—— 段首三行横幅 `// C. 工具条 + 统计行（旧版 §2.2 / §5.4）`
 *     + `ExcelJSInterop`(1383) / `exporting`(1389) / `searchText`(1396) / `selectedRows`(1408)
 *     / `refresh`(1414) —— **5 个**。
 *   · `Progress.vue:1599-1652`（54 行）—— `// ── C2. 行勾选` 横幅 + 整段块注释
 *     + `allSelected`(1621) / `toggleSelectAll`(1626) / `openBatchUpdate`(1644) —— **3 个**。
 *   ⚠️ 中间 `1418-1598` 是 **P8「查询更多」**（`moreShow`/`submitMore`…），**留在 `Progress.vue`**
 *     （Task 5 才搬）⇒ **删段必须是两段具名区间**，绝不是一整段 `sed '1374,1652d'`。
 *   ⇒ 本文件那 98 行也是**拼接**出来的：`1417` 那个空行之后直接接 `1599` 的 C2 横幅
 *     （中间 P8 那一整段被抽掉）。拼缝处的空白对 TS / esbuild 零影响。
 *
 * 边界怎么复量（R32 动手前量法，两端各看一眼）：
 *   `REF:1373` 空行 · `REF:1374` = 本段横幅 · `REF:1416` = `refresh` 的 `}` · `REF:1417` 空行 ·
 *   `REF:1418` 已是 **P8** 的段首横幅（`// ── C1b. 查询更多…`）
 *   ⇒ **止点 = 1417，不许写 1449**（R38）：`1449` 是 P8 那 31 行块注释的收尾两字符，写成 1449 会把
 *     P8 的横幅与整段承重注释一起搬走 —— 那 31 行正是「为什么默认日期用本地时区」
 *     「为什么客户候选改走 `/v1/clients`」的唯一出处。
 *   `REF:1598` 空行 · `REF:1599` = C2 横幅 · `REF:1651` = `openBatchUpdate` 的 `}` ·
 *   `REF:1652` 空行 · `REF:1653` 已是 **P9** 的横幅（`// ── C3. 打印…`）⇒ 第二段两端都干净。
 *   命令：`git show f097a9b1:app/src/views/Progress.vue | sed -n '1372,1377p'`（含 banner）
 *        `… | sed -n '1415,1419p'`（止点）· `… | sed -n '1597,1601p'` · `… | sed -n '1650,1654p'`
 *
 * 搬迁保真由 `docs/progress-extract-movecheck.mjs` 机核（P7 一条，参照 `f097a9b1`）。
 * ⚠️ **横幅与段内注释的保真不在那个守卫里**（`sliceFn` 从**声明**起切，它们根本不进切片）——
 *   唯一证据是「两段与 REF 同区间逐字节比」，别拿「守卫绿」当它的证据。
 *
 * ⚠️ **注入 5 项**（都是页面 / P3 拥有的东西；**传 ref / 函数本身，不是 `.value` 副本**）：
 *   · `rows`（**只读**）—— 页面 `ref<ProgressRow[]>([])`。`selectedRows` 从它派生、
 *     `toggleSelectAll` 的「取消全选」分支要遍历它。⚠️ 它**留壳**（写它的是页面 `load()`、
 *     P8 的 `submitMore()`、P4 的删除）。
 *   · `filteredRows` —— 页面 `computed`（= 旧版 `no`：筛完但**没分页**）。
 *     ⚠️ 它的归属是 **P6**（Task 7 才搬）⇒ 此刻它是壳里的 `computed`，由壳喂过来；
 *       Task 7 落地后壳要改成接 P6 的工厂回传（与 `useProgressStats` 同形）。
 *   · `load` —— 页面 `async function load()`（`refresh` 就是它）。
 *   · `message` —— 页面 `useMessage()`（`openBatchUpdate` 的「缺单号」提醒）。
 *   · `openUpdateDialog` —— **P3**（`useProgressUpdateDialog.ts`，Task 3 已搬）。
 *     ⚠️ 它**不是页面声明**：是从 P3 工厂 `return` 里解构出来的
 *       （`openBatchUpdate` 末句 `openUpdateDialog(null)`，REF 1650）。
 *   ⚠️ **派活清单写的是「注入：`rows`、`load`」**（只两项）—— 实测是 5 项。
 *     本节以**实测**为准（真 TS 解析器：段内引用 ∩ 全文顶层声明 − 本块自己的声明，剥注释）。
 *   模块级依赖（`ref`/`computed` 与类型 `ProgressRowDto`/`MessageApi`/`ExcelJSWorkbook`）
 *   本文件**直接 import 不注入**（与 `useProgressColors.ts` 等同一口径）。
 *
 * ⚠️ **`selectedRows` 与 `openUpdateDialog` 是一对「环」**：本文件的 `selectedRows` 要喂给 P3，
 *   P3 的 `openUpdateDialog` 要喂给本文件 ⇒ **P7a 与 P7b 必须同住一个文件**
 *   （拆开就得互相注入，两边各自 `TS2448` / 运行期 TDZ）。壳侧用一层 thunk 打破，见那里的注释。
 *
 * ⚠️ **搬迁时的文本改写 = 6 条规则、命中 8 处**（逐条登记在守卫的 `rewrites` 里）：
 *   `type ExcelJSInterop = {`(×1，加 `export`) · `rows.value`(×2：`selectedRows`/`toggleSelectAll`) ·
 *   `filteredRows.value`(×3：`allSelected` ×2 + `toggleSelectAll` ×1) · `load()`(×1) ·
 *   `message.`(×1) · `openUpdateDialog(null)`(×1)。
 *   ⚠️ 规则一律**带边界**（核心文件头：「朴素 split/join，裸名会顺手打到别的标识符上」）：
 *     `load` 写成 `load()`、`openUpdateDialog` 写成带实参的 `openUpdateDialog(null)`。
 *   ⚠️ `rows.value` 与 `filteredRows.value` **不构成子串关系**（大写 `R`，且 split/join 大小写敏感）
 *     ⇒ 两条规则互不误伤（已核）。
 *   复量法：`applyRewrites` 的 `from` 在文本里找不到就**抛** ⇒ 上面这些计数一旦漂了，守卫直接红。
 *
 * ⚠️ **`ExcelJSInterop` 的处理与其余 7 个不同**：它是**模块级 `type`**，必须放在工厂**外面**
 *   并 `export`（工厂体内写 `export` 是 `TS1184`）。它**不给页面**，给的是 **P11 `exportTable`**
 *   （REF 2005，Task 7 才搬）⇒ 页面现在 `import type { ExcelJSInterop }`，Task 7 改成
 *   `useProgressExport.ts` 自己 import。
 *   ⚠️ 它是**最容易被名单漏掉的那一类**（`type` 不是函数）：漏登记 ⇒ 守卫不切它 ⇒
 *     它留在壳里、守卫照样全绿（memory `split-guard-blind-spots` 第 1 类「登记写错两侧同错」）。
 *   **归属已由 R2 更正 + 裁决定死**（「归谁消费 ≠ 归谁搬」）⇒ 随 P7a 一起搬。
 *   ⚠️ 顺带**重排**：REF 的顺序是 横幅 → `ExcelJSInterop` → `exporting`…，这里把
 *     `ExcelJSInterop` 提到 deps 接口上方（它必须出工厂）。**工厂体内的相对顺序与 REF 一字不差。**
 *
 * ⚠️ **回传 7 项 = 本块 8 个声明里除 `ExcelJSInterop` 之外的全部**（它走 `export` 不走 `return`）。
 *   `.vue` 侧**7 个全解构**（都有段外活读者，一个不多一个不少 —— 多一个就是死局部 `TS6133`）：
 *     模板 `113`(`openBatchUpdate`) `114`(`selectedRows`) `126`(`refresh`)
 *     `129`(`exporting` `searchText`) `138`/`166`/`167`(`searchText`) ·
 *     脚本 `dateHeader`(`allSelected`/`toggleSelectAll`，REF 1295/1296) ·
 *     脚本 C3 打印段(`selectedRows`，REF 1734/1759/1775)。
 *   ⚠️ 与 P2/P3 同一口径：**工厂 `return` 借出本块产出面，页面只解构真有活读者的**。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import type { Workbook as ExcelJSWorkbook } from 'exceljs'
import type { ProgressRowDto } from '../../api/types'

/**
 * `await import('exceljs')` 的结果形状。
 * exceljs 的 `browser` 字段指向 UMD 包，**没有 ESM 默认导出**，Rollup 的 CJS interop
 * 有可能只给到 `default` ⇒ 运行期两个位置都取一下（见 `exportTable`）。
 */
export type ExcelJSInterop = {
  Workbook?: typeof ExcelJSWorkbook
  default?: { Workbook: typeof ExcelJSWorkbook }
}

/** `useProgressToolbar()` 的注入面。**只放页面 / P3 拥有的东西**（见文件头「注入 5 项」）。 */
export interface ProgressToolbarDeps {
  /**
   * 页面行列表（页面 `ref<ProgressRow[]>([])`）—— 本块**只读**：`selectedRows` 从它派生、
   * `toggleSelectAll` 的「取消全选」要遍历它。写它的是页面 `load()`、P8 `submitMore()`、P4 删除。
   *
   * ⚠️ 行类型**内联**写、本文件**不另立 type**：页面那个
   *   `type ProgressRow = ProgressRowDto & { isSelected: boolean }`（REF:362）归「壳区」那一次
   *   单独的搬迁（Task 5 → `utils/progressRow.ts`）⇒ 本文件现在既不能 import 一个**还不存在**的
   *   文件，也不该另立一份**同名** type（＝第二份定义，两边各自漂移）。
   *   Task 5 建好那个文件之后，这两行应改成 `import type { ProgressRow }`。
   *   ⚠️ 页面传进来的 `Ref<ProgressRow[]>` 与这里的形状**逐字同形** ⇒ 结构化赋值，`vue-tsc` 干净。
   */
  rows: Ref<(ProgressRowDto & { isSelected: boolean })[]>
  /** 过完筛选链、**没分页**的行（页面 `filteredRows` = 旧版 `no`）—— 表头全选/取消全选的底表。 */
  filteredRows: ComputedRef<(ProgressRowDto & { isSelected: boolean })[]>
  /** 重拉整表（页面 `load`）—— `refresh` 的全部内容就是它。 */
  load: () => Promise<void>
  /** 「批量更新」那道「缺单号」闸的提醒（页面 `useMessage()`）。 */
  message: MessageApi
  /**
   * 「批量更新」开弹窗（P3 `useProgressUpdateDialog` 回传的 `openUpdateDialog`，REF 1650）。
   * ⚠️ 与页面的 `selectedRows` 构成**环**（本块的 `selectedRows` 喂给 P3）⇒ 壳侧用一层
   *   thunk 打破：`(r) => progressUpdateDialog.openUpdateDialog(r)`，真调用发生在用户点
   *   「批量更新」时，那时两者都已就绪。**不是**为了凑数。
   */
  openUpdateDialog: (r: ProgressRowDto | null) => void
}

/**
 * 工具条 + 行勾选（旧版 §2.2 工具条 / §4.6 导出开关 / §5.4 统计行 / 「日期」列的行勾选）。
 *
 * ⚠️ **构造顺序**：五个注入项都是 setup 顶层即时求值 ⇒ 调用本工厂之前它们必须都已声明好
 *   （`filteredRows` 最晚，REF 1250）。见 `.vue` 里那段指路注释。
 */
export function useProgressToolbar(deps: ProgressToolbarDeps) {
  // ═══════════════════════════════════════════════════════════════════════════
  // C. 工具条 + 统计行（旧版 §2.2 / §5.4）
  // ═══════════════════════════════════════════════════════════════════════════

  /** 导出中（按钮 loading，防止连点两次生成两个文件）。旧版没有这个 flag，是本页加的。 */
  const exporting = ref(false)

  /**
   * 搜索词（旧版 `zo`）。
   * ⚠️ 它**同时**是「导出表格」按钮的显隐开关 —— 旧版那颗按钮的条件就是 `zo` 非空
   * （见 §2.2 与 §4.6），不是「有没有数据」也不是「有没有筛选」。
   */
  const searchText = ref('')

  /**
   * 行勾选（旧版 `te = {ping_hui:[], diao_hui:[], customerInfo:{}, hui_picture:[]}`）——
   * 「批量更新」的显隐与计数只用到前两个数组的长度和（`ea`），而每一行**必然**只落进其中一个
   * （旧版 `Jl` 按 `吊脚` 是否为空二分），所以 `ea` ≡ 勾选行数。
   *
   * ⚠️ 新版**不留那两个数组**：它们存在的唯一理由是旧版打印要拿它们去拼标签/生产单的行
   *    （`Ca` / `So` 那些 `push({qty…})`）。新版打印走的是「订单 + 行」那套共用链路
   *    （见 `printOrdersOf`）⇒ 留一份只有长度有用的副本反而容易和 `rows` 上的标志不同步。
   *    于是**唯一事实来源是行上的 `isSelected`**，这里只做一次派生。
   */
  const selectedRows = computed(() => deps.rows.value.filter((r) => r.isSelected))

  /**
   * 旧版 `pa()`：重拉数据 + **清空勾选**（`Ta()` + 逐个 `isSelected=false` + 重置 `te`）。
   * 新版不用手动清 —— `deps.load()` 会把 `rows` 整份换成新对象（见那里的注释）。
   */
  async function refresh() {
    await deps.load()
  }

  // ── C2. 行勾选（旧版「日期」列里的 checkbox，表头那颗是全选）────────────────
  /*
   * 旧版原文（反混淆后，逐字）：
   *
   *   // 表头（「日期」列 title）：ElCheckbox `model-value: Rl` + `onChange: $l`
   *   //   标题 = "全选/取消全选（当前筛选结果）"
   *   Rl = computed(() => { const t = no.value; return !(!t || 0 === t.length) && t.every(r => r.isSelected) })
   *   $l = e => { if (e) { no.value.forEach(l => { l.isSelected !== e && (l.isSelected = e, Jl(l, e)) }) }
   *               else { te.ping_hui = []; te.diao_hui = []; K.value.forEach(r => r.isSelected = false); ae() } }
   *
   *   // 行内：ElCheckbox `modelValue: row.isSelected` + `onUpdate:modelValue` + `onChange: t => Jl(row, t)`
   *   Jl = (row, checked) => { checked ? (吊脚 非空 ? push ping_hui : push diao_hui) : (从对应数组里 splice) }
   *
   * 三处**必须照抄**的语义，别顺手"改好"：
   *
   *  ① **表头全选的范围是「当前筛选结果」`no`，不是当前页** —— 旧版自己在 title 里都写明了。
   *     本页 `filteredRows` 就是 `no`（筛完但**没分页**，见那里的注释）⇒ 用它对。
   *  ② **取消全选清的是「全部行」`K`**（不是 `no`）—— 旧版那个分支直接 `K.value.forEach`。
   *     看着别扭，但结果就是「一取消全选，翻到哪页都没有勾」；用 `filteredRows` 会漏掉
   *     被筛掉的页上的勾。**照抄**。
   *  ③ 勾选**不影响**搜索/筛选/分页的任何一步（旧版 `isSelected` 从不参与 `no` 的计算）。
   */
  const allSelected = computed(
    () => deps.filteredRows.value.length > 0 && deps.filteredRows.value.every((r) => r.isSelected),
  )

  /** 表头「全选/取消全选」（旧版 `$l`）。 */
  function toggleSelectAll(v: boolean) {
    if (v) {
      // 旧版只对 `isSelected` **有变化**的行调 `Jl`（勾选态得靠它同步进 te 数组）；
      // 新版没有那个数组，这里只需设置标志，仍保留 `!r.isSelected` 的写法以对应原文。
      for (const r of deps.filteredRows.value) if (!r.isSelected) r.isSelected = true
    } else {
      for (const r of deps.rows.value) r.isSelected = false
    }
  }

  /**
   * 「批量更新」的入口（旧版 `ta`）—— 先过「有没有缺单号的行」那道闸，再开同一个弹窗。
   *
   * 旧版原文（逐字，提醒语的标点别改）：
   *   if ([...te.ping_hui, ...te.diao_hui].some(e => !e["单号"]))
   *     ElMessage.error("存在未生产的订单（缺少单号），不允许批量更新，请取消勾选未生产的订单")
   *   else { O = true（批量模式）; Y = null; S = true（loading）; …拉 GetProcedures…; W 复位; I = true }
   */
  function openBatchUpdate() {
    if (selectedRows.value.some((r) => !r['单号'])) {
      deps.message.error('存在未生产的订单（缺少单号），不允许批量更新，请取消勾选未生产的订单')
      return
    }
    // 批量模式：`updTarget` 留空（单行那套「未开始生产的单无法更新进度」的守卫也随之不生效 —— 旧版同理）
    deps.openUpdateDialog(null)
  }

  /*
   * 7 个**全部**回传 —— 本块的产出面就是它们（同 P2/P3 的口径）。
   * `ExcelJSInterop` 例外：它是模块级 `type`，由本文件 `export`，谁要谁 import。
   */
  return {
    exporting, searchText, selectedRows, refresh,
    allSelected, toggleSelectAll, openBatchUpdate,
  }
}
