// 自定义玻璃合片单 · HTML 构造器 —— 实现已上移到公共底座 `../docsheet/html.ts`
// （逐字移植自旧版，全部对应关系与字面量保真度说明见该文件头注）。
//
// 本文件只做两件事：
//   1. 把底座函数**绑定到 `GLASSSHEET2_PROFILE`**，恢复抽取前的对外签名（`opts` 默认 `{}`）；
//   2. 转出与单据无关的常量（`DEFAULT_QR_SIZE` / `DEFAULT_IMG_STYLE`）。
//
// 本单据相对 PS2 的三处差异在这里全部体现为 **profile 取值**，本文件里一个字面量都没有：
//   · 类名前缀 `gs`（§4.2）；
//   · `keepEmptyLines: false` —— 多行文本**丢空段、全空 → 空串**（GS:188-202）；PS2 相反（§6）；
//   · `cellCases` 有 `client`、无 `doorframe`/`windows`（§7.1）。

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
import { GLASSSHEET2_PROFILE } from './profile'
import type {
  GlassSheet2Config,
  GlassSheet2Page,
  GlassSheet2Row,
  RenderOptions,
  TableConfig,
} from './types'

export { DEFAULT_QR_SIZE, DEFAULT_IMG_STYLE } from '../docsheet/html'

/** ⚠️ `label` 不转义、只用于文本 —— 详见底座 `../docsheet/html.ts`。 */
export const escapeHtml = baseEscapeHtml

/** 富文本 → 多行 div（GS2 语义：**丢空段**，全空 → 空串）。 */
export function renderMultiline(value: unknown): string {
  return baseRenderMultiline(value, GLASSSHEET2_PROFILE)
}

/** 单号字幕折行（旧版 `B`，GS:272-282）—— 与 `renderMultiline` 不是一回事。 */
export const renderOrderCaption = baseRenderOrderCaption

/** 带缓存的二维码 provider（缓存键 `text + "::m1"`，失败不缓存）。 */
export const createQrSvgProvider = baseCreateQrSvgProvider

/** 单元格内容（旧版 `U`，GS:206-307）。case 表见 `profile.ts`。 */
export function renderCell(
  key: string,
  row: GlassSheet2Row | undefined,
  opts: RenderOptions = {},
): string {
  return baseRenderCell(key, row, opts, GLASSSHEET2_PROFILE)
}

/** 可见列（旧版 `p` computed，GS:112-114）。**行、表头、分页、量测全都读它。** */
export const visibleColumns = baseVisibleColumns

/** 一行明细（旧版 `G`，GS:538-570）。 */
export function renderRow(
  row: GlassSheet2Row,
  table: TableConfig,
  opts: RenderOptions = {},
): string {
  return baseRenderRow(row, table, opts, GLASSSHEET2_PROFILE)
}

/** 打印版表头（GS:591-600）—— **无内联 `font-size`**。 */
export const renderTableHead = baseRenderTableHead

/** 一页（旧版 `j` 的内联回调，GS:610-622）。 */
export function renderPage(
  rows: GlassSheet2Row[],
  pageIndex: number,
  pageCount: number,
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): GlassSheet2Page {
  return baseRenderPage(rows, pageIndex, pageCount, config, opts, GLASSSHEET2_PROFILE)
}

/** 根容器（旧版 `j`，GS:571-667）。 */
export function buildRootHtml(pages: GlassSheet2Page[], cssText: string): string {
  return baseBuildRootHtml(pages, cssText, GLASSSHEET2_PROFILE)
}

/** 完整文档（旧版 `J`，GS:673-681）—— `<title>` 是**字面量**，不是 `table.title`。 */
export function buildDocumentHtml(rootHtml: string): string {
  return baseBuildDocumentHtml(rootHtml, GLASSSHEET2_PROFILE)
}

/** 布局编辑器预览（旧版 `S`，GS:308-360）。 */
export function renderPreviewTable(
  rows: GlassSheet2Row[],
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): string {
  return baseRenderPreviewTable(rows, config, opts, GLASSSHEET2_PROFILE)
}
