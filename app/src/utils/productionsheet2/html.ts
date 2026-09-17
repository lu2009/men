// 自定义生产单2 · HTML 构造器 —— 实现已上移到公共底座 `../docsheet/html.ts`
// （逐字移植自旧版，全部对应关系与字面量保真度说明见该文件头注；PS2 行号：`D` PS2:191-196 /
//  `A` PS2:197-212 / `B` PS2:282-292 / `U` PS2:216-327 / `G` PS2:564-596 / `th` PS2:617-626 /
//  单页 PS2:636-648 / `S` PS2:328-380 / `j` PS2:597-693 / `J` PS2:699-707）。
//
// ⚠️ **§3 CONFIRMED：PS2 的 HTML 与 GS2 逐字节相同，只差两件事** ——
//   (a) 类名 `gs`→`ps`；(b) 列集（§2.2 的 9 列）。两件都由 profile 注入，本文件无字面量。
//
// 本单据相对 GS2 的两处 profile 取值在这里生效：
//   · `keepEmptyLines: true` —— 多行文本**不丢空段**，空段出 `&nbsp;` 占位行，且**永不返回空串**（§6）；
//   · `cellCases` 删 `client`、加 `doorframe`/`windows`（§7.1）。

import {
  buildDocumentHtml as baseBuildDocumentHtml,
  buildRootHtml as baseBuildRootHtml,
  createQrSvgProvider as baseCreateQrSvgProvider,
  escapeHtml as baseEscapeHtml,
  renderCell as baseRenderCell,
  renderMultiline as baseRenderMultiline,
  renderOrderCaption as baseRenderOrderCaption,
  renderPage as baseRenderPage,
  renderPreviewTable as baseRenderPreviewTable,
  renderRow as baseRenderRow,
  renderTableHead as baseRenderTableHead,
  visibleColumns as baseVisibleColumns,
} from '../docsheet/html'
import { PRODUCTIONSHEET2_PROFILE } from './profile'
import type {
  ProductionSheet2Config,
  ProductionSheet2Page,
  ProductionSheet2Row,
  RenderOptions,
  TableConfig,
} from './types'

export { DEFAULT_QR_SIZE, DEFAULT_IMG_STYLE } from '../docsheet/html'

/** ⚠️ `label` 不转义、只用于文本 —— 详见底座。 */
export const escapeHtml = baseEscapeHtml

/**
 * 富文本 → 多行 `<div class="ps2-line">`（旧版 `A`，PS2:197-212）。
 *
 * ⚠️ **本单据与 GS2 唯一真正的逻辑差异**：
 * 不 `filter(Boolean)`；空段出 `<div class="ps2-line">&nbsp;</div>`；
 * 且 **永不可能返回 `""`**（旧版那个 `o.length === 0` 分支是死代码，§6.2 CONFIRMED）。
 */
export function renderMultiline(value: unknown): string {
  return baseRenderMultiline(value, PRODUCTIONSHEET2_PROFILE)
}

/** 单号字幕折行（旧版 `B`，PS2:282-292）—— 与 `renderMultiline` 不是一回事。 */
export const renderOrderCaption = baseRenderOrderCaption

/** 带缓存的二维码 provider（缓存键 `text + "::m1"`，失败不缓存）—— 与 GS2 同一个实现。 */
export const createQrSvgProvider = baseCreateQrSvgProvider

/** 单元格内容（旧版 `U`，PS2:216-327）。case 表见 `profile.ts`。 */
export function renderCell(
  key: string,
  row: ProductionSheet2Row | undefined,
  opts: RenderOptions = {},
): string {
  return baseRenderCell(key, row, opts, PRODUCTIONSHEET2_PROFILE)
}

/** 可见列（旧版 `p` computed，PS2:121-123）。**行、表头、分页、量测全都读它。** */
export const visibleColumns = baseVisibleColumns

/** 一行明细（旧版 `G`，PS2:564-596）。 */
export function renderRow(
  row: ProductionSheet2Row,
  table: TableConfig,
  opts: RenderOptions = {},
): string {
  return baseRenderRow(row, table, opts, PRODUCTIONSHEET2_PROFILE)
}

/** 打印版表头（PS2:617-626）—— **无内联 `font-size`**，且 `label` 不转义。 */
export const renderTableHead = baseRenderTableHead

/** 一页（旧版 PS2:636-648）。单页时 `{{pageNum}}` 是空串，留下连续两个 `\n    `（§3.3）。 */
export function renderPage(
  rows: ProductionSheet2Row[],
  pageIndex: number,
  pageCount: number,
  config: ProductionSheet2Config,
  opts: RenderOptions = {},
): ProductionSheet2Page {
  return baseRenderPage(rows, pageIndex, pageCount, config, opts, PRODUCTIONSHEET2_PROFILE)
}

/** 根容器（旧版 `j` 尾，PS2:691-692）：`<div class="ps-root"><style>…</style>{各页}</div>`。 */
export function buildRootHtml(pages: ProductionSheet2Page[], cssText: string): string {
  return baseBuildRootHtml(pages, cssText, PRODUCTIONSHEET2_PROFILE)
}

/**
 * 完整文档（旧版 `J`，PS2:699-707）。
 * ⚠️ 逐字：`<title>自定义生产单2</title>`（**字面量**，不是 `table.title`「生产单」）。
 */
export function buildDocumentHtml(rootHtml: string): string {
  return baseBuildDocumentHtml(rootHtml, PRODUCTIONSHEET2_PROFILE)
}

/**
 * 布局编辑器预览（旧版 `S`，PS2:328-380）。
 * 与打印版的 4 处不同 + 「二维码统一 17mm」的有意偏离，详见底座头注。
 */
export function renderPreviewTable(
  rows: ProductionSheet2Row[],
  config: ProductionSheet2Config,
  opts: RenderOptions = {},
): string {
  return baseRenderPreviewTable(rows, config, opts, PRODUCTIONSHEET2_PROFILE)
}
