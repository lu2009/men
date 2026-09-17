// 自定义生产单2 · 分页 —— 实现已上移到公共底座 `../docsheet/paginate.ts`
// （量测 `O` PS2:445-544 + 打包 `H` PS2:545-563）。
//
// ⚠️ **§5 CONFIRMED：PS2 的分页与 GS2 完全一致，无本单据独有分支**
// （`H` 去空白后 421 字符、`O` 2108 字符逐字节相同）：预算公式 `heightMm - 2*paddingMm - 8 - 10`、
// 常数 `8`/`10`、兜底 `?? 20`、切页条件 `used + h > budget && cur.length > 0`、
// 空数据 `[[]]`、量测 iframe/比例/等图超时、`data-ridx`、硬编码 `#444` —— 一条不差。
// 唯一随 profile 变的是量测样式块里的 `.ps2-line` 选择器。
//
// ⚠️ **但分页的「输入」变了**（§5 末段）：`keepEmptyLines: true` 会改变每一行的**实测高度**，
// 从而改变切页位置。**这是最容易被忽略的连带影响** —— 分页代码零改动，行为却不同。

import {
  buildDocSheetDocument,
  buildDocSheetHtml,
  buildMeasureTable as baseBuildMeasureTable,
  measureRowHeights as baseMeasureRowHeights,
  paginate as basePaginate,
  paginateWithMeasure as basePaginateWithMeasure,
  renderAllPages as baseRenderAllPages,
} from '../docsheet/paginate'
import { PRODUCTIONSHEET2_PROFILE } from './profile'
import type {
  ProductionSheet2Config,
  ProductionSheet2Page,
  ProductionSheet2Row,
  RenderOptions,
} from './types'

/**
 * 分页预算里的两个**硬编码常数**：`heightMm - 2*paddingMm - 8 - 10`（PS2:551）。
 * ⚠️ **一个都别改**（§5.2）—— 语义说明见底座。
 */
export {
  PAGE_BUDGET_TITLE_MM,
  PAGE_BUDGET_EXTRA_MM,
  FALLBACK_ROW_HEIGHT_MM,
  MEASURE_IMAGE_TIMEOUT_MS,
} from '../docsheet/paginate'

/**
 * 等文档里所有 `<img>` 完成（PS2:519-531）。默认无超时，传 `timeoutMs` 才有兜底 ——
 * 旧版打印链路漏了兜底，见 `print.ts`。
 */
export { waitForImages } from '../docsheet/paginate'

/**
 * 把行按高度贪心切页（旧版 `H`，PS2:545-563）。
 *
 * 逐字规则（详见底座）：空数据 → `[[]]`；`budget` 每页相同（本单**没有页脚**）；
 * `used + h > budget && cur.length > 0` 才翻页（保证每页至少一行）；单行超页静默溢出。
 *
 * ⚠️ **§9 CONFIRMED：本单据没有 `getItemsPerPage`** —— 分页完全靠实测高度。
 * （旧版有 `getItemsPerPage` 的是 `ProductionSheet`，**不是 `ProductionSheet2`**。）
 */
export function paginate(
  rows: ProductionSheet2Row[],
  rowHeights: number[],
  config: ProductionSheet2Config,
): ProductionSheet2Row[][] {
  return basePaginate(rows, rowHeights, config)
}

/**
 * 造量测用的表格 HTML（PS2:450-498）。
 *
 * ⚠️ 与打印版三处**必须**不同：`<th>` 带内联 `font-size`、每行带 `data-ridx`、
 * 裸 `<table>` 且 `</thead><tbody>` 紧接无换行。详见底座。
 */
export function buildMeasureTable(
  rows: ProductionSheet2Row[],
  config: ProductionSheet2Config,
  opts: RenderOptions = {},
): string {
  return baseBuildMeasureTable(rows, config, opts, PRODUCTIONSHEET2_PROFILE)
}

/** 量测每行高度（旧版 `O`，PS2:445-544）—— **必须真实浏览器**，node 里返回 `[]`。 */
export function measureRowHeights(
  rows: ProductionSheet2Row[],
  config: ProductionSheet2Config,
  opts: RenderOptions = {},
): Promise<number[]> {
  return baseMeasureRowHeights(rows, config, opts, PRODUCTIONSHEET2_PROFILE)
}

/** 量测 + 切页。空数据短路成 `[[]]`，**不建 iframe**。 */
export function paginateWithMeasure(
  rows: ProductionSheet2Row[],
  config: ProductionSheet2Config,
  opts: RenderOptions = {},
): Promise<ProductionSheet2Row[][]> {
  return basePaginateWithMeasure(rows, config, opts, PRODUCTIONSHEET2_PROFILE)
}

/** 渲染全部页。⚠️ `pageCount > 1` 才渲染页码（PS2:628-635）；空数据得到 `[[]]` → 1 页无页码。 */
export function renderAllPages(
  rows: ProductionSheet2Row[],
  config: ProductionSheet2Config,
  opts: RenderOptions = {},
): Promise<ProductionSheet2Page[]> {
  return baseRenderAllPages(rows, config, opts, PRODUCTIONSHEET2_PROFILE)
}

/**
 * 构建**根容器 HTML**（旧版 `j` / 组件 expose 的 `buildProductionSheet2Html`，PS2:597-693）。
 *
 * 旧版 `j(rows?)` 的行来源是「传参优先，否则 `props.getData()`」（PS2:600-602）；
 * 新版**行由调用方显式传入** —— Home 侧的 `ic=15` 分支先取 `productionProduces()`
 * 再调它（§7.2，`HOME@448504`）。
 *
 * ⚠️ 旧版 `j` 里**读的是「生效配置」`i.value`**，不是草稿 —— 布局编辑器的预览走的是
 * 另一条路（`S` + 草稿 `s`，见 `html.ts` 的 `renderPreviewTable`）。两者别混。
 */
export function buildProductionSheet2Html(
  rows: ProductionSheet2Row[],
  config: ProductionSheet2Config,
  opts: RenderOptions = {},
): Promise<string> {
  return buildDocSheetHtml(rows, config, opts, PRODUCTIONSHEET2_PROFILE)
}

/**
 * 构建**完整文档**（旧版 `J`，PS2:699-707）—— 带 `<!DOCTYPE html>` 与
 * `<title>自定义生产单2</title>`，给 `printDirect` 的隐藏 iframe 用。
 */
export function buildProductionSheet2Document(
  rows: ProductionSheet2Row[],
  config: ProductionSheet2Config,
  opts: RenderOptions = {},
): Promise<string> {
  return buildDocSheetDocument(rows, config, opts, PRODUCTIONSHEET2_PROFILE)
}
