// 自定义生产单 · 构建入口 —— 逐字移植旧版 `oe`（`PS:1036-1321`）与 `ne`（`PS:1327-1338`）。
//
// 施工图：`docs/custom-docs-recon/01-ps.md` §5.1（骨架）/ §4.1（顶层结构）/ §4.3（完整文档）。
//
// ★★ **`oe` 全文 0 个 `await`**（CONFIRMED，§5.1）—— 整份 HTML 是**纯同步**计算。
//    `oe` 本身是 `async`（旧版如此），新版也保持 `async` **但内部无 await**（§8.3 第 1 条）——
//    这样调用方（组件层）的 `await` 写法与旧版一致，将来真要异步化也不用改调用点。
//    **别**给它套 `measureRowHeights` / 隐藏 iframe。
//
// ⚠️ 行来源在**新版是显式入参**（旧版 `oe(e)` 是「传参优先，否则 `props.getData()`」）——
//    与底座 `buildDocSheetHtml` 同一处理（见 `docsheet/paginate.ts` 的说明）。

import {
  buildDocumentHtml,
  buildRootHtml,
  buildSheetStyle,
  renderDoorImgBox,
  renderHeaderFields,
  renderTable,
  visibleTableColumns,
} from './html'
import {
  estimateRowHeight,
  fullPageBudgets,
  isTwinRow,
  packPages,
  pageCellHeightMm,
  pageTableTopMm,
  renderTwinSheet,
  resolveTableTopMm,
  tableWrapWidth,
} from './paginate'
import { PS_CLASSES } from './profile'
import type {
  ProductionSheetCell,
  ProductionSheetConfig,
  ProductionSheetRenderOptions,
  ProductionSheetRow,
} from './types'

/**
 * 表格包裹 div（`PS:1291-1300` / `PS:1159-1168`）：
 * `<div style="position:absolute;left:{paddingMm}mm;top:{top}mm;width:{表宽};">{table}</div>`。
 *
 * ⚠️ `tableHtml` 为空 → **整个 div 不产出**（`PS:1290` 的 `V ? … : ""`）。
 */
function renderTableWrap(
  tableHtml: string,
  config: ProductionSheetConfig,
  topMm: number,
): string {
  if (!tableHtml) return ''
  return (
    '<div style="position:absolute;left:' +
    config.paper.paddingMm +
    'mm;top:' +
    topMm +
    'mm;width:' +
    tableWrapWidth(config) +
    ';">' +
    tableHtml +
    '</div>'
  )
}

/** 单个 `<section>`（非 2-up 的两条出口都走它，`PS:1214-1233` / `PS:1301-1313`）。 */
function renderSection(sheetStyle: string, inner: string): string {
  return '<section class="' + PS_CLASSES.sheet + '" style="' + sheetStyle + '">' + inner + '</section>'
}

/**
 * 一行数据 → 若干 `<section>`（旧版 `oe` 里 `n.map(...)` 的那个内联箭头函数，
 * `PS:1044-1316`）。
 *
 * 分叉顺序**照抄**（`PS:1063-1068` 的两联判定在**最前面**）：
 * 1. 两联判定 → `renderTwinSheet`；
 * 2. `header = F(row)` / `box = ee(row)`；
 * 3. `top` 解析；
 * 4. `oldSheet` 非数组或为空 → **单页 section（header + box，无表格）**；
 * 5. 可见列为 0 → **同上**（★ 没有「无可见列」占位）；
 * 6. 否则估高 + 打包 + 逐页 section。
 *
 * ★ **表头字段与门图框只在第 1 页渲染**（`PS:1301-1313` 的 `c ? … : …`）。
 */
function renderSheet(
  row: ProductionSheetRow,
  config: ProductionSheetConfig,
  opts: ProductionSheetRenderOptions,
): string {
  const sheetStyle = buildSheetStyle(config) // 旧版 `n`

  // ① 两联（PS:1063-1068）—— ★ 逐行判断，同一批数据里两种版式可并存
  if (isTwinRow(row, config)) return renderTwinSheet(row, config, opts)

  const header = renderHeaderFields(row, config, opts) // 旧版 `u`
  const box = renderDoorImgBox(row, config) // 旧版 `r`
  const tableTopMm = resolveTableTopMm(config) // 旧版 `i`

  const oldSheet = (row?.oldSheet ?? []) as ProductionSheetCell[] // 旧版 `c`
  if (!Array.isArray(oldSheet) || oldSheet.length === 0) {
    // PS:1213-1221 —— 无表数据：只有 header + 门图框
    return renderSection(sheetStyle, header + box)
  }

  const cols = visibleTableColumns(config) // 旧版 `s`
  if (cols.length === 0) {
    // PS:1225-1233 —— ★ C 家族在这里有「无可见列」占位，PS **没有**，直接空串
    return renderSection(sheetStyle, header + box)
  }

  // ② 估高 + 打包（PS:1234-1275）—— ★ 首页与后续页预算不同
  const { first, later } = fullPageBudgets(config, tableTopMm) // 旧版 `g` / `y`
  const pages = packPages(
    oldSheet,
    first,
    later,
    (cell) => estimateRowHeight(cell, config, cols), // 旧版 `w`
  )

  // ③ 逐页（PS:1276-1315）
  let out = ''
  for (let index = 0; index < pages.length; index++) {
    const isFirst = index === 0 // 旧版 `c`
    const wrapTopMm = pageTableTopMm(config, isFirst, tableTopMm) // 旧版 `s`
    const cellHeightMm = pageCellHeightMm(isFirst ? first : later) // 旧版 `d`
    const tableHtml = renderTable(pages[index], config, cellHeightMm) // 旧版 `V`
    const tableWrap = renderTableWrap(tableHtml, config, wrapTopMm) // 旧版 `f`
    out += isFirst
      ? renderSection(sheetStyle, header + tableWrap + box) // PS:1301-1308 —— ★ 顺序：header → 表 → 门图框
      : renderSection(sheetStyle, tableWrap) // PS:1309-1313
  }
  return out
}

/**
 * 构建**根容器 HTML**（旧版 `oe`，`PS:1036-1321`）。
 *
 * ★ **空行数组 → 一个 `<section>` 都不产出**（`PS:1043-1318` 的 `rows.map(...).join("")` = `""`）
 * —— 与底座「空数据 → `[[]]` → 渲染 1 个空页」**不同**（§4.1）。所以这里**不要**补什么占位页。
 *
 * ⚠️ 旧版 `oe` 的配置读的是**生效配置 `r.value`**，不是布局草稿 `s` ——
 *    布局编辑器的预览走另一条路（§6.1 的 `openLayoutEditor`）。新版由调用方显式传入
 *    `config`，别把草稿传进来当生效配置用。
 *
 * @param rows 行数据 —— 新版来自 `printPayloads.ts` 的 **`oldSheetProduces(paired)`**
 *   （`paired` 由 `config.print.itemsPerPage === 2` 决定，§8.1 D2）。
 */
export async function buildProductionSheetHtml(
  rows: ProductionSheetRow[] | undefined,
  config: ProductionSheetConfig,
  opts: ProductionSheetRenderOptions = {},
): Promise<string> {
  const list = Array.isArray(rows) ? rows : [] // 旧版 `Array.isArray(e) ? e : props.getData() || []`
  const sheets = list.map((row) => renderSheet(row, config, opts)).join('') // PS:1043-1318
  return buildRootHtml(sheets, config) // PS:1319-1321
}

/**
 * 构建**完整文档**（旧版 `ne`，`PS:1327-1338`）—— 给 `printDirect` 的隐藏 iframe 用。
 *
 * ★ **比底座的 `buildDocSheetDocument` 多一段 head `<style>`**（§4.3）：
 *   底座只有 `<title>`；PS 的 head 里还有 `html,body{…}` 重置 + 整段 CSS。
 *   ⇒ 这正是底座 `printDocSheetDirect` 被拆出 `printHtmlViaIframe` 骨架的原因。
 *
 * ⚠️ 旧版 `ne()` **无参**，内部 `oe()` 也**无参** ⇒ 走 `props.getData()`。
 *    新版行由调用方传入（同上）。
 */
export async function buildProductionSheetDocument(
  rows: ProductionSheetRow[] | undefined,
  config: ProductionSheetConfig,
  opts: ProductionSheetRenderOptions = {},
): Promise<string> {
  const rootHtml = await buildProductionSheetHtml(rows, config, opts) // PS:1330
  return buildDocumentHtml(rootHtml, config) // PS:1331-1337
}

/**
 * 每页数据数（旧版 expose 的 `getItemsPerPage`，`PS:1487`）。
 *
 * ```js
 * getItemsPerPage: () => r.value.print.itemsPerPage
 * ```
 *
 * ★ **读的是生效配置**（`r`），不是设置草稿 —— Home 侧 `Sr()`
 * （`HOME:8417`）就是靠它决定要不要调 `sc()` 配对的（§6.2）。
 * 新版由组件层拿生效 `config` 调本函数，**行为照抄**。
 *
 * TODO(未确认): 旧版 `Sr()` 被调用 3 次（`gi` 的 build、`wc` 的 build、`mc` 的编辑弹窗数据），
 * 每次都重跑一次本函数 ⇒ 若用户在一次交互中途改了「每页数据数」，同一次操作里可能拿到不同结果
 * （§6.2）。新版建议**配对只在一处做**（§8.1 D2/D3），这条竞争随之消失 —— 见 §9.2 的处置建议。
 */
export function productionSheetItemsPerPage(config: ProductionSheetConfig): number {
  return config.print.itemsPerPage
}
