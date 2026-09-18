// 自定义生产单 · 分页 —— 解析式估高，**不是量测**。
//
// 施工图：`docs/custom-docs-recon/01-ps.md` §5（§5.2 行高估算 / §5.3 打包 / §5.4 两联）。
//
// ★★ **这是本单据与 C 家族最结构性的一处差异**（§5.5 对照表）：
//    |            | 底座 `docsheet/paginate.ts`                   | PS（本文件）                     |
//    |------------|-----------------------------------------------|----------------------------------|
//    | 量测方式    | 隐藏 iframe + `document.write` + `offsetHeight` | **无**（纯解析式）                |
//    | 同步/异步   | `async`（必须真实浏览器）                       | **同步**                          |
//    | 预算公式    | `heightMm - 2*paddingMm - 8 - 10`，**每页相同**  | 首页 `- top - V - 4`、后续 `- V - 6`，**不同** |
//    | 行高来源    | 实测 `offsetHeight * pxToMm`                    | `maxLines * 0.2646*rowHeight + 1`；有门图时 `min(1.5*W/n, 60)` |
//    | 空数据      | `[[]]` → 1 个空页                                | **0 个 section**（短路在 `build.ts`）|
//    | 页码        | `pageCount > 1` 时渲染 `.{ns}-page-num`          | **无页码**                        |
//
// ⚠️ **`oe`（`PS:1036-1321`）全文 0 个 `await`**（CONFIRMED）—— 整份 HTML 是纯同步计算。
//    **别**引入 C 家族那套隐藏 iframe 量测，也别 import `measureRowHeights`。
//
// ⚠️ 底座那两个常数 `8` / `10`（标题行 + 留白）在 PS **没有对应物**（PS 没有标题行、没有页码），
//    这里的 `4` / `6` 与它们**没有任何关系**，别互相"对齐"。

import {
  buildSheetStyle,
  renderDoorImgBox,
  renderHeaderFields,
  renderTable,
  skipBySuffix,
  visibleTableColumns,
} from './html'
import { PS_CLASSES } from './profile'
import type {
  ProductionSheetCell,
  ProductionSheetConfig,
  ProductionSheetRenderOptions,
  ProductionSheetRow,
} from './types'

/**
 * px → mm 换算系数（`PS:934` / `PS:1073` / `PS:1234` 三处都是这个字面量）。
 *
 * 1 英寸 = 25.4mm，CSS 的 1px = 1/96 英寸 ⇒ 25.4/96 = 0.2645833…
 * 旧版取四位小数的 **`0.2646`**（略微偏大 0.006%），**照抄不"修正"** ——
 * 改成精确值会让分页位置与旧版差一丁点。
 */
export const PX_TO_MM = 0.2646

/**
 * 单行估高的固定加项 mm。
 *
 * 非 2-up 是 `+ 1`（`PS:1259`）、2-up 是 `+ 1`（`PS:1104`），**两边相同**。
 */
export const ROW_HEIGHT_EXTRA_MM = 1

/**
 * 每行「表格开销」mm（旧版 `V = d + 2`，`PS:1074` / `PS:1235`）。
 *
 * 语义是 INTERPRETED：行本身的行高之外，表格还要吃掉边框/内边距的固定开销。
 * 旧版取 `+2`，照抄。
 */
export const ROW_OVERHEAD_MM = 2

/** 单行行高 mm（`d = 0.2646 * rowHeight`，`PS:1073` / `PS:1234`）。 */
export function rowLineHeightMm(rowHeightPx: number): number {
  return PX_TO_MM * rowHeightPx
}

/** 旧版 `V`（非 2-up）/ `s`（2-up）：行高 + 固定开销。 */
export function rowOverheadMm(rowHeightPx: number): number {
  return rowLineHeightMm(rowHeightPx) + ROW_OVERHEAD_MM
}

// ------------------------------------------------------------------ //
// §5.2 / §5.4 行高估算
// ------------------------------------------------------------------ //

/**
 * 单行高度估算（**非 2-up**，旧版 `w`，`PS:1237-1260`）。
 *
 * ```
 * if (可见列里有 doorImg && String(row.doorImg ?? "") 为真)
 *       return min(1.5 * (可用页宽 / 可见列数), 60)
 * else
 *       n = 1
 *       for col of 可见列 (跳过 doorImg):
 *             n = max(n, String(row[col.key] ?? "").split(/<br\s*\/?>/).length)
 *       return n * d + 1
 * ```
 *
 * ★ **空串 → 1 行**（`"".split()` 长度 1）⇒ 恒 `≥ d+1`，不会塌成 0
 *   —— 与底座 `keepEmptyLines` 同观感但**成因不同**（§5.2）。
 * ★ 有门图的那一支用的是**可用页宽 ÷ 列数**（`PS:1248`），
 *   而 2-up 的对应分支用的是**可见列平均宽**（`PS:1088-1090`）—— **两个公式不同**，别统一。
 */
export function estimateRowHeight(
  row: ProductionSheetCell | undefined,
  config: ProductionSheetConfig,
  cols = visibleTableColumns(config),
): number {
  const lineMm = rowLineHeightMm(config.tableConfig.rowHeight) // 旧版 `d`

  if (cols.some((c) => c.key === 'doorImg') && String(row?.doorImg ?? '')) {
    // PS:1248 —— 可用页宽 ÷ 可见列数
    const perColumn = (config.paper.widthMm - 2 * config.paper.paddingMm) / cols.length
    return Math.min(1.5 * perColumn, 60) // PS:1249
  }

  let maxLines = 1 // PS:1251
  for (const col of cols) {
    if (col.key === 'doorImg') continue // PS:1253
    // PS:1254-1256 —— ⚠️ 正则**无 `i` 标志**（见 `html.ts` 的 `BR_SPLIT_RE`）
    const lines = String(row?.[col.key] ?? '').split(/<br\s*\/?>/).length
    if (lines > maxLines) maxLines = lines // PS:1257
  }
  return maxLines * lineMm + ROW_HEIGHT_EXTRA_MM // PS:1259
}

/**
 * 单行高度估算（**2-up**，旧版 `V`，`PS:1076-1105`）—— 与上面**只差有门图那一支的公式**。
 *
 * ```
 * if (有 doorImg && String(row.doorImg ?? ""))
 *       return min(1.5 * (可见列.length > 0 ? Σ列宽 / 可见列.length : 40), 60)
 * else  …同一套 maxLines 循环…
 * ```
 *
 * ⚠️ `: 40`（`PS:1091`）是**可见列为 0 时的兜底**—— 实际上不可达
 * （可见列里若没有 `doorImg` 就进不了这一支），照抄。
 */
export function estimateRowHeightTwin(
  row: ProductionSheetCell | undefined,
  config: ProductionSheetConfig,
  cols = visibleTableColumns(config),
): number {
  const lineMm = rowLineHeightMm(config.tableConfig.rowHeight) // 旧版 `c`

  if (cols.some((c) => c.key === 'doorImg') && String(row?.doorImg ?? '')) {
    const perColumn =
      cols.length > 0 ? cols.reduce((sum, c) => sum + c.width, 0) / cols.length : 40 // PS:1087-1091
    return Math.min(1.5 * perColumn, 60) // PS:1092
  }

  let maxLines = 1 // PS:1094
  for (const col of cols) {
    if (col.key === 'doorImg') continue // PS:1096
    const lines = String(row?.[col.key] ?? '').split(/<br\s*\/?>/).length // PS:1097-1101
    if (lines > maxLines) maxLines = lines // PS:1102
  }
  return maxLines * lineMm + ROW_HEIGHT_EXTRA_MM // PS:1104
}

// ------------------------------------------------------------------ //
// §5.3 预算
// ------------------------------------------------------------------ //

/** 首页的表格 Y 位置 mm（旧版 `i` / `d`，`PS:1204-1211`）。 */
export function resolveTableTopMm(config: ProductionSheetConfig): number {
  if (config.tableConfig.tableTopMm >= 0) return config.tableConfig.tableTopMm // PS:1205-1206
  // ⚠️ **可见字段全部不可见时**：`Math.max(...[])` = **`-Infinity`**
  // ⇒ 首页预算变成 `+Infinity` ⇒ **永不翻页**（首页吞掉全部行）。
  //
  // 布局编辑器里的 `S` computed（`PS:613-619`）**显式处理了这个情况（返回 45）**，
  // 而 `oe` 里的这份**内联副本没有** —— 这是旧版的一处不一致/缺陷（§9.1）。
  //
  // TODO(未确认): 是否照抄这个缺陷。默认 12 个字段全 `visible: true`，实际触发需要用户
  // 逐个取消勾选。**当前照抄**（与 `paddingMm` 那处 NaN 缺陷的处理口径一致），
  // 产物里会出现字面量 `-Infinity`（`top:-Infinitymm`）—— 这正是旧版行为。
  return Math.max(...config.headerFields.filter((f) => f.visible).map((f) => f.y)) + 12 // PS:1207-1211
}

/**
 * 整页的两套预算（`PS:1261-1262`）—— ★ **首页与后续页不同**（首页被 header / 表格 Y 挤掉）。
 *
 * ```
 * first = heightMm - 2*paddingMm - top          - V - 4
 * later = heightMm - 2*paddingMm -                V - 6
 * ```
 *
 * 默认值代入（A5 210×148、`tableTopMm 42.5`、`rowHeight 37`，§5.3）：
 * `d = 0.2646×37 = 9.7902`、`V = 11.7902`、`top = 42.5`
 * ⇒ **首页 79.71mm**、**后续页 120.21mm**，1 行 = 10.79mm。
 *
 * ★ 底座 `paginate()` 的「每页预算完全相同」在这里**不成立** ⇒ **不能参数化复用**（§5.3）。
 */
export function fullPageBudgets(
  config: ProductionSheetConfig,
  tableTopMm = resolveTableTopMm(config),
): { first: number; later: number } {
  const paper = config.paper
  const overhead = rowOverheadMm(config.tableConfig.rowHeight) // 旧版 `V`
  const usable = paper.heightMm - 2 * paper.paddingMm
  return {
    first: usable - tableTopMm - overhead - 4, // PS:1261
    later: usable - overhead - 6, // PS:1262
  }
}

/**
 * 半页（2-up）的两套预算（`PS:1069-1074`）。
 *
 * ```
 * half  = heightMm / 2
 * s     = 0.2646*rowHeight + 2
 * first = half - top                - s - 4      // 15.71mm（默认值）
 * later = half - (paddingMm + 2)    - s - 6      // 49.21mm（默认值）
 * ```
 *
 * ★ **上下两联用同一对预算**（`PS:1144` 的两次 `m(u, w, g)` / `m(r, w, g)`）——
 * 下半联首页**不渲染表头**，却仍按「有表头」的预算算，因此**首页下半联会留白**。
 * 这是旧版事实（CONFIRMED），**照抄**（§5.4）。
 */
export function halfPageBudgets(
  config: ProductionSheetConfig,
  tableTopMm = resolveTableTopMm(config),
): { first: number; later: number; halfHeightMm: number } {
  const paper = config.paper
  const halfHeightMm = paper.heightMm / 2 // 旧版 `l`
  const overhead = rowOverheadMm(config.tableConfig.rowHeight) // 旧版 `s`
  return {
    halfHeightMm,
    first: halfHeightMm - tableTopMm - overhead - 4, // PS:1072
    later: halfHeightMm - (paper.paddingMm + 2) - overhead - 6, // PS:1073
  }
}

// ------------------------------------------------------------------ //
// 打包
// ------------------------------------------------------------------ //

/**
 * 贪心切页（旧版 `oe` 里的内联循环 `PS:1263-1275`，与 2-up 的 `m` `PS:1106-1124` 同构）。
 *
 * 逐字规则：
 * - `used + h > (first ? firstBudget : laterBudget) && cur.length > 0` 才翻页
 *   —— **`cur.length > 0` 保证每页至少一行**（与底座 `paginate()` 同）；
 * - `first` 只在**真正翻页时**才置 `false`（`PS:1117`）—— 没翻过页就一直是「首页预算」；
 * - 单行本身就超一整页时**不切分、不降字号**，静默溢出（`height:{半页}mm` + `overflow:hidden` 裁掉）。
 *
 * ⚠️ 与 2-up 的 `m` **只差空数据语义**：`m` 空输入返回 `[[]]`（`PS:1108`），
 *    本函数返回 `[]`。非 2-up 的调用方已经在 `build.ts` 里短路了空 `oldSheet`，
 *    所以这个差别不可达 —— 但 2-up 那条路**必须**保留 `[[]]`，见 `renderTwinSheet`。
 *
 * @param heightOf 单行估高函数（`estimateRowHeight` 或 `estimateRowHeightTwin`）
 */
export function packPages<T>(
  rows: T[],
  firstBudget: number,
  laterBudget: number,
  heightOf: (row: T) => number,
): T[][] {
  const pages: T[][] = []
  let cur: T[] = []
  let used = 0
  let first = true

  for (const row of rows) {
    const h = heightOf(row)
    if (used + h > (first ? firstBudget : laterBudget) && cur.length > 0) {
      pages.push(cur)
      cur = []
      used = 0
      first = false
    }
    cur.push(row)
    used += h
  }
  if (cur.length > 0) pages.push(cur)
  return pages
}

/**
 * 2-up 专用的打包（旧版 `m`，`PS:1106-1124`）—— ★ **与 `packPages` 只差空数据语义**。
 *
 * ```js
 * if (!Array.isArray(e) || 0 === e.length) return [[]]      // PS:1108
 * …
 * return n.length > 0 ? n : [[]]                            // PS:1123
 * ```
 *
 * ★ **空数据 → `[[]]`（一个空页），不是 `[]`（零页）** —— 这条是必须的：
 * 两联的两条半联各自独立打包，若某一条为空就整个不产出，`pageCount` 会算错
 * （两条都空时更会直接**吐出 0 个 `<section>`**，与旧版「1 个 section、两个空半页 div」不符）。
 * 非 2-up 那条路径**不需要**它 —— 它的空 `oldSheet` 已经在 `build.ts` 里短路成单页了。
 */
export function packTwinPages<T>(
  rows: T[],
  firstBudget: number,
  laterBudget: number,
  heightOf: (row: T) => number,
): T[][] {
  if (!Array.isArray(rows) || rows.length === 0) return [[]] // PS:1108
  const pages = packPages(rows, firstBudget, laterBudget, heightOf)
  return pages.length > 0 ? pages : [[]] // PS:1123
}

/** 表格包裹 div 的 `top`（`PS:1280`）：首页用 `top`、后续页 `paddingMm + 2`。 */
export function pageTableTopMm(
  config: ProductionSheetConfig,
  isFirstPage: boolean,
  tableTopMm = resolveTableTopMm(config),
): number {
  return isFirstPage ? tableTopMm : config.paper.paddingMm + 2
}

/**
 * `$` 的第 3 参（门图格高度 mm，`PS:1281` / `PS:1156`）：
 * `Math.max(10, (首页 ? first : later) - 6)`。**首页与后续页给的值不同。**
 */
export function pageCellHeightMm(budget: number): number {
  return Math.max(10, budget - 6)
}

/** 表格包裹 div 的宽度（`PS:1148-1151` / `PS:1286-1289`）：合计宽 0 → 退化成 `calc(100% - 2*paddingMm mm)`。 */
export function tableWrapWidth(config: ProductionSheetConfig): string {
  const total = visibleTableColumns(config).reduce((sum, c) => sum + c.width, 0)
  return total > 0 ? total + 'mm' : 'calc(100% - ' + 2 * config.paper.paddingMm + 'mm)'
}

// ------------------------------------------------------------------ //
// §5.4 一页两联（itemsPerPage === 2）
// ------------------------------------------------------------------ //

/**
 * 判断一行是否走**两联**版式（`PS:1063-1068`）。
 *
 * ```js
 * 2 === config.print.itemsPerPage &&
 * ( row.orderID1 !== undefined || row.oldSheet1 !== undefined || row.size1 !== undefined )
 * ```
 *
 * ★ **是逐行判断的** —— 同一批数据里有的行带 `1` 后缀、有的不带
 * ⇒ **同一个文档里两种版式并存**（`PS:1043-1318` 的 map 内部分叉）。
 * ★ 触发是**看行**（不是只看配置）—— 这就是为什么 Home 侧的 `sc()` 必须真的把行配对（§6.4）。
 *
 * TODO(未确认): 为什么判据挑的是这三个键（`size1` 而不是 `maker1` 之类）无从判断，**无影响**（§9.6）。
 */
export function isTwinRow(row: ProductionSheetRow | undefined, config: ProductionSheetConfig): boolean {
  if (config.print.itemsPerPage !== 2) return false
  return row?.orderID1 !== undefined || row?.oldSheet1 !== undefined || row?.size1 !== undefined
}

/**
 * 一行数据 → **一页一个 `<section>`**，里面两个「半页 div」（旧版 `oe` 的 2-up 分支，
 * `PS:1126-1200`）。
 *
 * 逐条（§5.4）：
 * 1. `u = skipBySuffix(row, "")` = **整行原样**（上半联）；
 *    `r = skipBySuffix(row, "1")` = **只留带 `1` 后缀的键并剥掉后缀**（下半联）；
 * 2. 两联各跑一次 `w(data, topOffset)`：上联 `top=0`、下联 `top=heightMm/2`；
 * 3. 每页 = `<section class="ps-sheet">` + 上联 div + 下联 div，逐页配对输出；
 * 4. ★ **下联上浮**：当 `!t && a`（`PS:1189`）时，把下联 div 的 `top:{半页高}mm;` 换成 `top:0mm;`
 *    —— 靠**字符串替换第一个匹配**（`PS:1191`），**不是重排**。照抄这个手法，否则逐字节比对会挂。
 *
 *    ⚠️ **触发条件容易读错**：这里判断的是「**这一页上联的 div 不存在**」，而**不是**
 *    「上联的数据为空」。因为旧版 `m` 对空数据返回 `[[]]`（`PS:1108`），
 *    两条半联**各自永远至少产出 1 页** ⇒ 上联数据为空时会产出一个**空的半页 div**（字符串非空），
 *    **不会**触发上浮。真正触发的是**下联页数多于上联**（`upperPages[i]` 取到 `undefined`）。
 * 5. 两个半页 div 都是 `overflow:hidden` ⇒ 半页内容**静默裁切**。
 *
 * ⚠️ 半页 div 里**第 0 页才带** header + 门图框（`PS:1169` 的 `s ? "" + r + c : ""`），
 *    后续页只有表格。
 */
export function renderTwinSheet(
  row: ProductionSheetRow,
  config: ProductionSheetConfig,
  opts: ProductionSheetRenderOptions = {},
): string {
  const sheetStyle = buildSheetStyle(config)
  // 旧版 `l` / `w` / `g`（PS:1069-1073）—— 两联**共用同一对预算**，见 `halfPageBudgets` 的注
  const { halfHeightMm, first: firstBudget, later: laterBudget } = halfPageBudgets(config)
  const upper = skipBySuffix(row, '') // 旧版 `u`
  const lower = skipBySuffix(row, '1') // 旧版 `r`

  const cols = visibleTableColumns(config)
  const widthCss = tableWrapWidth(config)

  /** 旧版 `w(e, n)`：把一份（半联的）数据渲成逐页的字符串数组。 */
  const renderHalf = (data: ProductionSheetRow, topOffset: number): string[] => {
    const header = renderHeaderFields(data, config, opts) // 旧版 `r`
    const box = renderDoorImgBox(data, config) // 旧版 `c`
    const tableTopMm = resolveTableTopMm(config) // 旧版 `d`
    const laterTopMm = config.paper.paddingMm + 2 // 旧版 `V`

    const cells = Array.isArray(data.oldSheet) ? data.oldSheet : [] // 旧版 `y`
    // ⚠️ 可见列为 0 时 **不打包**，直接给一个空页（旧版 `v = i.length > 0 ? m(...) : [[]]`，`PS:1144`）；
    //    可见列 > 0 时走 `packTwinPages` —— ★ 它带 `[[]]` 空数据兜底（旧版 `m`，`PS:1108`），
    //    不能直接用 `packPages`，否则空 `oldSheet` 会让半联整个不产出。
    const pages =
      cols.length > 0
        ? packTwinPages(cells, firstBudget, laterBudget, (c) => estimateRowHeightTwin(c, config, cols))
        : [[]]

    return pages.map((page, index) => {
      const isFirst = index === 0 // 旧版 `s`
      const wrapTopMm = isFirst ? tableTopMm : laterTopMm // 旧版 `m`
      const cellHeightMm = pageCellHeightMm(isFirst ? firstBudget : laterBudget) // 旧版 `y`
      const tableHtml = page.length > 0 ? renderTable(page, config, cellHeightMm) : '' // 旧版 `v`
      const tableWrap = tableHtml
        ? '<div style="position:absolute;left:' +
          config.paper.paddingMm +
          'mm;top:' +
          wrapTopMm +
          'mm;width:' +
          widthCss +
          ';">' +
          tableHtml +
          '</div>' // PS:1159-1168
        : ''
      // PS:1169 —— 旧版写作 `"" + r + c`，那个前导 `""` 是等价的空串拼接（压缩器残留），此处略去
      const headAndBox = isFirst ? header + box : ''
      // PS:1171-1179 —— 半页 div
      return (
        '<div style="position:absolute;left:0;top:' +
        topOffset +
        'mm;width:100%;height:' +
        halfHeightMm +
        'mm;overflow:hidden;box-sizing:border-box;">' +
        headAndBox +
        tableWrap +
        '</div>'
      )
    })
  }

  const upperPages = renderHalf(upper, 0) // 旧版 `g = w(u, 0)`
  const lowerPages = renderHalf(lower, halfHeightMm) // 旧版 `y = w(r, l)`

  let out = '' // 旧版 `f`
  const pageCount = Math.max(upperPages.length, lowerPages.length) // 旧版 `v`
  for (let i = 0; i < pageCount; i++) {
    const upperHtml = upperPages[i] || ''
    let lowerHtml = lowerPages[i] || ''
    // ★ `PS:1189-1191` —— 上联空、下联有 → 下联的 `top:{半页高}mm;` 换成 `top:0mm;`
    // ⚠️ 是 `String.replace(字符串, 字符串)` ⇒ **只替换第一个匹配**；下联 div 的 top 在最前面，
    //    所以命中的正是它。照抄（别改成 `replaceAll`）。
    if (!upperHtml && lowerHtml) {
      lowerHtml = lowerHtml.replace('top:' + halfHeightMm + 'mm;', 'top:0mm;')
    }
    out +=
      '<section class="' + PS_CLASSES.sheet + '" style="' + sheetStyle + '">' + upperHtml + lowerHtml + '</section>' // PS:1192-1198
  }
  return out
}
