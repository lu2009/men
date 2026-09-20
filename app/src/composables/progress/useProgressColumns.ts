/**
 * Progress 订单进度页的**筛选链 + 列定义**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）：`Progress.vue:1226-1373`
 * （连续一整段，148 行，**4 个声明**）—— 拆分方案里的 **P6**（全计划**最后一刀**，
 * 也是注入面最大的一块）。段首两行分区横幅（`// ── B3. 筛选链 + 分页…` 与 1226 起那段
 * 25 行的「旧版 §4.1 链路」块注释、以及 1302 的 `// ── B4. 列定义…`）**一起搬来**；
 * 工厂体内**与 REF 一字不差、相对顺序也不动**（除下表那 32 项注入的接线处理：20 项进 `deps` 改写 + 12 项走 `import` 原样）。
 *
 * ⚠️ **横幅与段内注释的保真不在守卫里**（核心 `sliceFn` 从**声明**起切，它们根本不进切片）——
 *   唯一证据是「整段与 REF 同区间逐字节比」（判据 R39：归一化掉工厂那层统一缩进之后，
 *   剩余差异必须**恰好等于在案的注入改写，不多不少**）。别拿「守卫绿」当它的证据。
 *
 * ⚠️ **本段里没有顶层非声明语句**（没有 `watch(` / `if(` 那一类）—— 实测 REF 1226–1373
 *   的顶层语句**全是那 4 个声明**（`filteredRows` 1250 · `pageRows` 1280 · `dateHeader` 1291 ·
 *   `columns` 1303）⇒ 不存在 P9 那种「切片器切不到、对它们恒恒绿」的盲区
 *   （memory `split-guard-blind-spots` 第 4 类不适用）。量法：真 TS 解析器遍历
 *   `<script setup>` 的 `sf.statements`，逐条打 `SyntaxKind`。
 *
 * ⚠️ **工厂式**（`useProgressColumns(deps)`）⇒ **一条 `export` 改写都没有**
 *   （函数体内写 `export` 是 `TS1184`；与 P2/P3/P5/P7/P8/P9/P10 同形）。
 *
 * ── 注入面：**20 项进 `deps`** + **12 项走 `import`**（`SEARCH_FIELDS`/`ProgressRow` 各 1 + P1 的 10 个单元格渲染函数）（控制者与实现者各量一遍，逐名核过）──
 *
 * 量法（R43/R46 四条）：① 真 TS 解析器（`app/node_modules/typescript` 的 `ts.createSourceFile`，
 * **必须把 `<script setup>` 抠出来按 `ScriptKind.TS` 解析** —— 直接喂 `.vue` 走 `TSX` 会把
 * `<script setup>` 当 JSX 元素、整段成 `JsxText`、一个 Identifier 都数不到）数「段内标识符
 * ∩ 全文顶层声明 − 本块自己的声明」⇒ **32 个**；② 整文件纯文本搜（含 `<template>` 与字符串）；
 * ③ 排除解构自身的 `BindingElement`（否则每个名字都「自证有 1 处使用」）；④ `vue-tsc` 正反各跑一次。
 * 32 − `SEARCH_FIELDS`(import) − `ProgressRow`(import type) − P1 那 10 个(import) = **20 项进 `deps`**。
 *
 * | 来源 | 个数 | 名字 |
 * |---|---|---|
 * | **P5** `useProgressHeader` 回传 | 6 | `colorFilter` · `matchesOrderNoOption` · `orderNoFilterValues` · `orderNoQuery` · `orderNoHeader` · `progressHeader` |
 * | **P7** `useProgressToolbar` 回传 | 3 | `searchText` · `allSelected` · `toggleSelectAll` |
 * | **P8** `useProgressQueryMore` 回传 | 2 | `moreActive` · `moreRows` |
 * | **P2** `useProgressColors` 回传（壳解构出来的） | 4 | `UNPRODUCED_KEY` · `colorKeyOf` · `cellPad` · `progressCellStyle` |
 * | **壳区** ref / 函数 | 5 | `rows` · `page` · `pageSize` · `openUpdate`(P3) · `confirmDeleteRow`(P4) |
 * | **P1** `utils/progressCells` 模块（**自己 import，不进 `deps`**） | 10 | `progressCell` `remarkCell` `profileColorCell` `glassCell` `fansDirectionCell` `trackCasingCell` `doorSizeCell` `lightWindowCell` `amountCell` `line` |
 * | **模块 `import`**（`useProgressHeader` 的 `SEARCH_FIELDS` · `utils/progressRow` 的 `ProgressRow`） | 2 | `SEARCH_FIELDS` · `ProgressRow`(type) |
 *
 * ⚠️ **后 2 项（`moreActive` / `moreRows`）是本块最容易漏的一处，也是本任务最险的一处。**
 *   它们的声明在 **P8（Task 5）**，而 **P8 的 `useProgressQueryMore` 是喂给 P5 的** ——
 *   Task 5 的登记只写了「喂给 P5」⇒ **本块是第二个接点**。REF 里这两个名字的**段外**读者
 *   只有两处、分属两块：**1061（P5 的候选集）** 与 **1251（本块的 `filteredRows` 体第一行）**。
 *   两处源码**逐字同形**（`moreActive.value ? moreRows.value : rows.value`）⇒ 裸 `grep`
 *   只会说「有 2 处」，**必须把引用点回落块区间**才知道是两个接点。
 *   **漏接的后果**：`filteredRows` 恒按 `rows` 算 ⇒ **「查询更多」拉回来的那批数据不再参与筛选**，
 *   而**守卫、`vue-tsc`、37 台子全绿**（`rows` 里有值、类型对、只是少了更多的行）——
 *   正是 memory `split-guard-blind-spots` 第 3 类「名字在、类型对、值是空的」。
 *   ⚠️ 另一条反向链：**P6 的 `filteredRows` 反过来被 P7 消费**（`allSelected` / `toggleSelectAll`）
 *   ⇒ **P6 与 P7 互为输入**，环的破法见下面「调用点为什么在 P5 之后」。
 *
 * ⚠️ **`SEARCH_FIELDS` / `ProgressRow` 走 `import`，不进 `deps`**：
 *   · `SEARCH_FIELDS` 是 P5 文件里的模块级 `export const`（REF 1213）—— 壳当年就是
 *     `import { SEARCH_FIELDS }` 接住给本块用的，本文件照抄同一条路；
 *   · `ProgressRow` 是 `type`（REF 362，Task 5 归位到 `utils/progressRow.ts`）⇒ `import type`。
 *   ⚠️ 那 10 个单元格渲染函数（含 `line`）同理**由本文件自己 `import`**，**不许抄第二份实现**
 *     （先例：Task 6 的 `getOriginalOpenDirection` 直连 import）。
 *
 * ── 回传 3 项（4 个声明里真被段外消费的 3 个）──
 *   · `filteredRows` —— 段外用点 **12 处脚本 + 3 处模板**：脚本 `383`（壳 `load()`）·
 *     `1622`(×2) `1630`（P7b）· `1876` `1899` `1913` `1924` `1942` `1961`（P10）·
 *     `2054` `2075`（P11）；模板 `167` `170` `316`。⇒ **4 个外部接点 = 壳 / P7 / P10 / P11 + 模板。**
 *     ⚠️ 本文件是它的**声明方**，回传后由壳解构；P7 / P10 / P11 三处的 `deps` 名字不变即自动指向它。
 *   · `pageRows` —— **只被模板用**（1 处，模板 REF **176** 的 `:data="pageRows"`），段外脚本 0。
 *   · `columns` —— **只被模板用**。⚠️ 这个数**极易数错**：裸名正则在模板 REF `175`
 *     那一行 `      :columns="columns"` 上会**把属性名也算一次** ⇒ 计数器报 2，**真实消费者只有 1**
 *     （`="columns"` 那个值位）。全文 `columns` 仅 2 处真命中（175 值位 + 1303 声明）。
 *     ⚠️ 另有 2 处**纯文本假阳性**：175 的属性名，以及 REF **2037** 的 `ws.columns = cols`
 *     （P11 里 **`ws` 的属性名**，与这个 `columns` 同名不同物）—— 用真 TS 解析器数才分得开。
 *   ⚠️ **不回传的 1 个**：`dateHeader`（段外脚本 0、模板 0）—— 它是 `columns` 第一列的列头渲染
 *     辅助，**跟着本块走**。**但别以为它没用**：`columns` 在 REF 1307 拿它当 `title`。
 *
 * ── 调用点为什么在 P5（列头交互）之后 ─────────────────────────────────────
 * ⚠️ **本块的调用点不能放回 P6 的原位置**（B 段横幅那里）：它注入的 P8（`moreActive`/`moreRows`）
 *   / P5（6 个）/ P7（3 个）/ P3（`openUpdate`）**在 REF 里都排在本块之后**（或由后面的工厂产出）
 *   ⇒ 放回原位会**早读一串 TDZ 变量**（`TS2448`）。
 * ⚠️ **P6 ↔ P7 是一对环**：本块要 P7 的 `searchText` / `allSelected` / `toggleSelectAll`，
 *   P7 又要本块的 `filteredRows`（它的 `allSelected` / `toggleSelectAll` 底表）。
 *   而 P7 的调用点**必须留在原处**（它下面 P8 要它的 `searchText`、P3 要它的 `selectedRows`），
 *   本块又**必须**排在 P5 之后（P8 → P5 → 本块 这条链也是硬的）⇒ **本块不可能排在 P7 之前**。
 *   ⇒ 环只能从 P7 那一侧打破：壳把喂给 P7 的 `filteredRows` 写成
 *   `computed(() => progressColumns.filteredRows.value)` —— **一层前向 thunk**
 *   （与破 P7↔P3 那个环的 `openUpdateDialog: (r) => progressUpdateDialog.openUpdateDialog(r)`
 *   同一个手法：箭头体在用户交互时才求值，那时 `progressColumns` 早已初始化）。
 *   ⚠️ **为什么用 `computed` 包而不是把 P7 的 `filteredRows` 形参改成 thunk**：后者要动
 *   `useProgressToolbar.ts`（P7 的登记逐字比会红），前者**一个别的文件都不碰**。
 *   语义零变化：转发 `computed` 与原对象给出**同一个值**、同一条依赖链，只多一个节点。
 *
 * ⚠️ **搬迁时的文本改写 = 20 条规则、命中 39 处**（`deps.` 化），逐条登记在守卫的 `rewrites` 里、
 *   分挂在吃它的声明下。规则一律**带边界**（核心文件头：朴素 `split/join`，裸名会顺手打到
 *   别的标识符上）。两处已单独核过：
 *   · `rows.value` **不会**误伤 `moreRows.value`（差在 `Rows` 的**大写 R**，`split/join` 大小写敏感）；
 *   · `page.value` **不会**误伤 `pageSize.value`（前者要求字面 `page.value`）。
 */

import { computed, h, type ComputedRef, type Ref, type VNodeChild } from 'vue'
import { NButton, NCheckbox, type DataTableColumn } from 'naive-ui'
import type { ProgressRowDto } from '../../api/types'
import { SEARCH_FIELDS } from './useProgressHeader'
import {
  amountCell,
  doorSizeCell,
  fansDirectionCell,
  glassCell,
  lightWindowCell,
  line,
  profileColorCell,
  progressCell,
  remarkCell,
  trackCasingCell,
} from '../../utils/progressCells'
import type { ProgressRow } from '../../utils/progressRow'

/**
 * `useProgressColumns()` 的注入面。**20 项进 `deps`** + **12 项走 `import`**（下表 7 组：前 5 组那 20 项进 `deps`，**末两组那 12 项走 `import`、不进 `deps`**）。
 *
 * ⚠️ **注入的是 ref / 函数本身，不是 `.value` 副本**（与 P2/P3/P5/P7/P8/P9/P10 同一口径）——
 *   本块要**在 `computed` 体内读**它们（`filteredRows` / `pageRows` / `columns` 三个都是
 *   `computed`，`dateHeader` 是渲染辅助函数）⇒ 传副本会把响应性剪断。
 */
export interface ProgressColumnsDeps {
  /** 全量行（页面 `ref<ProgressRow[]>([])`）—— `filteredRows` 的兜底分支。 */
  rows: Ref<ProgressRow[]>
  /** 分页页码（页面 `ref(1)`）—— `pageRows` 的切片起点。 */
  page: Ref<number>
  /** 每页条数（页面 `ref(100)`）—— `pageRows` 的切片终点。 */
  pageSize: Ref<number>

  /** 行内「更新进度」（P3 `useProgressUpdateDialog` 回传，REF 479）。 */
  openUpdate: (r: ProgressRowDto) => void
  /** 行内「删除」（P4 `useProgressDeleteRow` 回传，REF 564）。 */
  confirmDeleteRow: (r: ProgressRowDto) => void

  /** 颜色键归一（P2 `useProgressColors` 回传，REF 933）—— 颜色筛那一支。 */
  colorKeyOf: (text: unknown) => string
  /** 「未生产」哨兵键（P2 回传，REF 839）—— 颜色筛的特例分支。 */
  UNPRODUCED_KEY: string
  /** 「生产进度」整格底色（P2 回传，REF 958）—— 那一列的 `cellProps`。 */
  progressCellStyle: (text: unknown) => {
    backgroundColor?: string
    color?: string
    fontWeight?: string
  }
  /** 所有格共用的 `padding:1px`（P2 回传，REF 966）—— `columns` 里 13 处 `cellProps`。 */
  cellPad: () => { style: { padding: string } }

  /** 搜索框内容（P7 `useProgressToolbar` 回传，REF 1396）—— 搜索框那一支。 */
  searchText: Ref<string>
  /** 「当前筛选结果是否全选中」（P7 回传，REF 1621）—— `dateHeader` 的 checkbox。 */
  allSelected: ComputedRef<boolean>
  /** 表头「全选/取消全选」（P7 回传，REF 1626）—— `dateHeader` 的 `onUpdate:checked`。 */
  toggleSelectAll: (v: boolean) => void

  /** 「查询更多」是否生效（P8 `useProgressQueryMore` 回传，REF 1465）。 */
  moreActive: Ref<boolean>
  /** 「查询更多」的结果集（P8 回传，REF 1456）—— 生效时它取代 `rows`。 */
  moreRows: Ref<ProgressRow[]>

  /** 单号列筛的判据（P5 `useProgressHeader` 回传，REF 1013）。 */
  matchesOrderNoOption: (value: string | number, r: ProgressRowDto) => boolean
  /** 单号列筛的受控值（P5 回传，REF 1025）。 */
  orderNoFilterValues: () => (string | number)[]
  /** 「查单号」前缀（P5 回传，REF 1033）。 */
  orderNoQuery: Ref<string>
  /** 「单号」列表头（P5 回传，REF 1089）。 */
  orderNoHeader: () => VNodeChild
  /** 颜色筛的受控值（P5 回传，REF 1158）。 */
  colorFilter: Ref<string>
  /** 「生产进度」列表头（P5 回传，REF 1160）。 */
  progressHeader: () => VNodeChild
}

/**
 * 筛选链 + 分页 + 列定义（旧版 `no` / `io` / `pe` / 列数组）。
 *
 * ⚠️ **本块是全计划注入面最大的一块**（20 项进 `deps` + 12 项 `import`），也是**唯一一块与另一个块互为输入**的
 *   （P6 ↔ P7 的环，见文件头「调用点为什么在 P5 之后」）。
 */
export function useProgressColumns(deps: ProgressColumnsDeps) {
  // ── B3. 筛选链 + 分页 ─────────────────────────────────────────────────────
  /*
   * 旧版 §4.1 的链路：`K2`（原始）→ `oo` → `no`（最终）→ `io`（当页切片）。
   * 本页目前做了链里的四步（剩下没做的只有 `oo` 那一步，理由见下）：
   *
   *   `oo`（只看自己打单的行）—— 旧版 `b2 ? K2 : K2.filter(打单人 === 自己)`。
   *     ⚠️ 新版**还没做**：它依赖 `userinfo.registrant/name` 这套账号字段，
   *        旧版 §10 明确「`defaulted` 我们不复制，账号类型映射等做权限那一步再定」。
   *        这里先跳过，等权限那一步补 —— **不要**用「当前登录名」凑一个近似值。
   *   `ia` 单号列筛 → `Z2` 颜色筛 → `Va` 查单号前缀 → `zo` 搜索框（**顺序照旧版**）
   *
   * ⚠️ 与 Home 同款的**有意偏离**：旧版的列头筛发生在分页切片**之后**（只筛当前页、总数不含它），
   *    新版把这几步都并进 `filteredRows` ⇒ **全量筛选、总数跟随**。
   *
   * ⚠️ 旧版 `no` 的第一句是 `let t = Bo.value ? xo.value : oo.value` —— `Bo`/`xo` 是
   *    **「查询更多」的结果集与其生效标志**（点确认后 `xo=d, Bo=true`；**动搜索框或清空**就把
   *    `Bo` 置回 `false`，退回全量）。新版这一层 = `moreActive ? moreRows : rows`，
   *    退出条件照旧版放在搜索框的 `@input` / `@clear` 上（见 `onSearchInput` / `onSearchClear`）。
   *
   * ⚠️ 与 `oo`（只看自己打单的行）**不是一回事**，别合并：`oo` 是**数据范围**（本版仍未做，
   *    理由见上），`Bo`/`xo` 是**用户主动查出来的结果集**。旧版是 `no = (Bo ? xo : oo)`，
   *    即结果集**优先于**数据范围 —— 但结果集本身在 `Io` 里已经被数据范围滤过一遍
   *    （`!b2 && (d = d.filter(打单人 === 自己))`），两处都做才对。
   */
  const filteredRows = computed(() => {
    let list = deps.moreActive.value ? deps.moreRows.value : deps.rows.value
    const sel = deps.orderNoFilterValues()
    if (sel.length) list = list.filter((r) => sel.some((v) => deps.matchesOrderNoOption(v, r)))
    if (deps.colorFilter.value) {
      list =
        deps.colorFilter.value === deps.UNPRODUCED_KEY
          ? list.filter((r) => !String(r['单号'] ?? '').trim())
          : list.filter((r) => deps.colorKeyOf(r['生产进度']) === deps.colorFilter.value)
    }
    if (deps.orderNoQuery.value) {
      const q = deps.orderNoQuery.value.toLowerCase()
      list = list.filter((r) => String(r['单号'] ?? '').toLowerCase().startsWith(q))
    }
    // 搜索框：空格分词，**每个词都要命中**十个字段里的任意一个（全部 `toLowerCase()` 后 `includes`）。
    // 逐字对着旧版 `no` 的最后一段抄：字段顺序、`String(x ?? '')` 的空值处理都一样。
    // ⚠️ 旧版用 `?.toString().toLowerCase().includes(w)`，null/undefined 会短路成 falsy；
    //    这里等价写成 `String(x ?? '')`（`null` → `''`，`''.includes(w)` 只有 `w` 为空才真，
    //    而 `w` 已经 `filter(Boolean)` 过了 ⇒ 同样恒 false）。
    const words = deps.searchText.value.toLowerCase().split(/\s+/).filter((w) => w)
    if (words.length) {
      list = list.filter((r) =>
        words.every((w) =>
          SEARCH_FIELDS.some((k) => String(r[k] ?? '').toLowerCase().includes(w)),
        ),
      )
    }
    return list
  })

  const pageRows = computed(() =>
    filteredRows.value.slice((deps.page.value - 1) * deps.pageSize.value, deps.page.value * deps.pageSize.value),
  )

  /**
   * 「日期」列表头（旧版 `pe` 那个 div）：**全选 checkbox + 「日期」**竖排。
   *
   * ⚠️ 旧版这个 checkbox 的 `title` 就是下面这句 —— 它同时也是**唯一的范围说明**
   *    （全选盖的是「当前筛选结果」而不是当前页，见 `toggleSelectAll` 的注释）。
   *    naive 的 `n-checkbox` 没有 `title` prop，用原生 `title` 属性（浏览器悬停提示）。
   */
  const dateHeader = (): VNodeChild =>
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' } }, [
      h('span', { title: '全选/取消全选（当前筛选结果）' }, [
        h(NCheckbox, {
          checked: deps.allSelected.value,
          'onUpdate:checked': (v: boolean) => deps.toggleSelectAll(v),
        }),
      ]),
      h('span', null, '日期'),
    ])

  // ── B4. 列定义 ────────────────────────────────────────────────────────────
  const columns = computed<DataTableColumn<ProgressRow>[]>(() => [
    // 1 日期（表头带全选 checkbox，行内带勾选框 —— 见 §2.3 第 1 行；两者都是素 `D2`=PC 才有，
    //   本版不做终端分支 ⇒ 恒显示）
    {
      title: dateHeader,
      key: '日期',
      width: 150,
      fixed: 'left',
      cellProps: deps.cellPad,
      render: (r) =>
        h('div', { class: 'cell-col' }, [
          // 行勾选框（旧版 `m` = ElCheckbox，`modelValue: row.isSelected` + `onChange: Jl(row, t)`）。
          // ⚠️ 直接改行对象上的标志（`rows` 是深响应式），`selectedRows` 是它的派生 computed。
          h(NCheckbox, {
            checked: r.isSelected,
            'onUpdate:checked': (v: boolean) => {
              r.isSelected = v
            },
          }),
          line(r['日期']),
          // 两个链接都是 `v-if="D2"`（PC 模式）—— 本版不做终端模式，故恒显示。
          // 旧版这一格是 `{display:flex;flex-direction:column;align-items:center;gap:4px}` 的**竖排**
          // （`he`，见 §2.3 第 1 行「右侧两个链接」）⇒ 「更新进度」「删除」是**上下两行**，不是并排。
          h(NButton, { size: 'tiny', text: true, type: 'primary', onClick: () => deps.openUpdate(r) }, { default: () => '更新进度' }),
          // 「删除」旧版是**红字**（`<span class="update-progress-link" style="color:#f56c6c">`）。
          // ⚠️ 这里用 naive 的 `type="error"` 表达「危险」，**不是**旧版那个 `#f56c6c` ——
          //    与紧邻的「更新进度」（旧版 `#409eff`，这里用 `type="primary"`）是同一套取舍：
          //    这一列的两颗都按 naive 语义色走。要改成旧版原色，**两颗一起改**，
          //    别只把「删除」单独拧回 `#f56c6c`（那会让这一格看起来像两种风格拼的）。
          h(NButton, { size: 'tiny', text: true, type: 'error', onClick: () => deps.confirmDeleteRow(r) }, { default: () => '删除' }),
        ]),
    },
    { title: '客户', key: '客户', width: 110, cellProps: deps.cellPad, render: (r) => line(r['客户']) },
    // 3 单号：表头筛（有单号/空单号）+「查单号」popover
    {
      title: deps.orderNoHeader,
      key: '单号',
      width: 110,
      cellProps: deps.cellPad,
      filterOptions: [
        { label: '有单号', value: '有单号' },
        { label: '空单号', value: '空单号' },
      ],
      filter: (v, r) => deps.matchesOrderNoOption(v as string | number, r),
      // 受控：`computed` 里读 `columnFilterState`，变更时整列重算
      filterOptionValues: deps.orderNoFilterValues(),
      render: (r) => line(r['单号']),
    },
    // 4 生产进度：`va()` 渲染 + 含「回款」标红 + 整格底色（`cellProps`）+ 表头颜色筛选
    {
      title: deps.progressHeader,
      key: '生产进度',
      width: 220,
      cellProps: (r: ProgressRowDto) => ({
        style: { padding: '1px', ...deps.progressCellStyle(r['生产进度']) },
      }),
      render: progressCell,
    },
    { title: '型材/颜色', key: 'profile_color', width: 130, cellProps: deps.cellPad, render: profileColorCell },
    { title: '玻璃', key: 'glass', width: 120, cellProps: deps.cellPad, render: glassCell },
    { title: '扇数/开向', key: 'fans_dir', width: 110, cellProps: deps.cellPad, render: fansDirectionCell },
    { title: '下轨道/套线', key: 'track_casing', width: 120, cellProps: deps.cellPad, render: trackCasingCell },
    { title: '门洞尺寸', key: 'door_size', width: 130, cellProps: deps.cellPad, render: doorSizeCell },
    { title: '亮窗信息', key: 'lightwin', width: 120, cellProps: deps.cellPad, render: lightWindowCell },
    // 11 备注（PC 模式下在这一位；终端模式会前移到第 5 位 —— 本版不做终端）
    { title: '备注', key: 'remark', width: 140, cellProps: deps.cellPad, render: remarkCell },
    { title: '金额', key: 'amount', width: 130, cellProps: deps.cellPad, render: amountCell },
    { title: '打单人', key: '打单人', width: 90, cellProps: deps.cellPad, render: (r) => line(r['打单人']) },
    { title: '业务员', key: '业务员', width: 90, cellProps: deps.cellPad, render: (r) => line(r['业务员']) },
  ])

  return { filteredRows, pageRows, columns }
}
