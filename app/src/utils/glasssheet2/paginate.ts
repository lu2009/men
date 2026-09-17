// 自定义玻璃合片单 · 分页 —— 实现已上移到公共底座 `../docsheet/paginate.ts`
// （量测 `O` GS:419-518 + 打包 `H` GS:519-537；三条「别抄成收据单」与两处有意偏离见该文件头注）。
//
// ⚠️ **本文件相对 PS2 零差异**（§5 CONFIRMED：`H` 去空白后 421 字符、`O` 2108 字符逐字节相同）。
// 唯一的 profile 影响是量测样式块里的 `.{ns}-line` 选择器。
//
// ⚠️ 但 `keepEmptyLines: true`（PS2）会改变**每行的实测高度**，从而改变切页位置 ——
// 分页代码一个字不改，行为却会变（§5 末段）。

import {
  buildDocSheetDocument,
  buildDocSheetHtml,
  buildMeasureTable as baseBuildMeasureTable,
  measureRowHeights as baseMeasureRowHeights,
  paginate as basePaginate,
  paginateWithMeasure as basePaginateWithMeasure,
  renderAllPages as baseRenderAllPages,
  waitForImages,
} from '../docsheet/paginate'
import { GLASSSHEET2_PROFILE } from './profile'
import type { GlassSheet2Config, GlassSheet2Page, GlassSheet2Row, RenderOptions } from './types'

/**
 * 分页预算里的两个**硬编码常数**：`heightMm - 2*paddingMm - 8 - 10`（GS:525）。
 * ⚠️ **一个都别改**（§5.2）—— 语义说明见底座。
 */
export { PAGE_BUDGET_TITLE_MM, PAGE_BUDGET_EXTRA_MM, FALLBACK_ROW_HEIGHT_MM, MEASURE_IMAGE_TIMEOUT_MS } from '../docsheet/paginate'

/** 等文档里所有 `<img>` 完成（旧版 GS:493-506）。默认无超时，传 `timeoutMs` 才有兜底。 */
export { waitForImages }

/**
 * 把行按高度贪心切页（旧版 `H`，GS:519-537）。
 *
 * 逐字规则（详见底座）：空数据 → `[[]]`；`budget` 每页相同；`used + h > budget && cur.length > 0`
 * 才翻页；单行超页静默溢出。
 */
export function paginate(
  rows: GlassSheet2Row[],
  rowHeights: number[],
  config: GlassSheet2Config,
): GlassSheet2Row[][] {
  return basePaginate(rows, rowHeights, config)
}

/**
 * 造量测用的表格 HTML（GS:424-472）。
 *
 * ⚠️ 与打印版三处**必须**不同：`<th>` 带内联 `font-size`、每行带 `data-ridx`、
 * 裸 `<table>` 且 `</thead><tbody>` 紧接无换行。详见底座。
 */
export function buildMeasureTable(
  rows: GlassSheet2Row[],
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): string {
  return baseBuildMeasureTable(rows, config, opts, GLASSSHEET2_PROFILE)
}

/** 量测每行高度（旧版 `O`，GS:419-518）—— **必须真实浏览器**，node 里返回 `[]`。 */
export function measureRowHeights(
  rows: GlassSheet2Row[],
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): Promise<number[]> {
  return baseMeasureRowHeights(rows, config, opts, GLASSSHEET2_PROFILE)
}

/** 量测 + 切页（旧版 `H`，GS:519-537）。空数据短路成 `[[]]`，**不建 iframe**。 */
export function paginateWithMeasure(
  rows: GlassSheet2Row[],
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): Promise<GlassSheet2Row[][]> {
  return basePaginateWithMeasure(rows, config, opts, GLASSSHEET2_PROFILE)
}

/**
 * 渲染全部页。⚠️ `pageCount > 1` 才渲染页码（GS:602-609）；空数据得到 `[[]]` → 1 页无页码。
 */
export function renderAllPages(
  rows: GlassSheet2Row[],
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): Promise<GlassSheet2Page[]> {
  return baseRenderAllPages(rows, config, opts, GLASSSHEET2_PROFILE)
}

/**
 * 构建**根容器 HTML**（旧版 `j` / 组件 expose 的 `buildGlassSheet2Html`，GS:571-667）。
 *
 * 旧版 `j(rows?)` 的行来源是「传参优先，否则 `props.getData()`」（GS:574-576）；
 * 新版**行由调用方显式传入**（Home 侧从 `glassProduces()` 拿），这个回退分支不收进来。
 *
 * ⚠️ 旧版 `j` 里**读的是「生效配置」`i.value`**，不是草稿 —— 布局编辑器的预览走的是
 * 另一条路（`S` + 草稿 `s`，见 `html.ts` 的 `renderPreviewTable`）。两者别混。
 */
export function buildGlassSheet2Html(
  rows: GlassSheet2Row[],
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): Promise<string> {
  return buildDocSheetHtml(rows, config, opts, GLASSSHEET2_PROFILE)
}

/**
 * 构建**完整文档**（旧版 `J`，GS:673-681）—— 带 `<!DOCTYPE html>` 与
 * `<title>自定义玻璃合片单</title>`，给 `printDirect` 的隐藏 iframe 用。
 */
export function buildGlassSheet2Document(
  rows: GlassSheet2Row[],
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): Promise<string> {
  return buildDocSheetDocument(rows, config, opts, GLASSSHEET2_PROFILE)
}
