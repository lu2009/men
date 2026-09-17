// C 家族自绘单据 · 分页 —— 移植自旧版 `O`（量测）+ `H`（打包）。
//
// 对应关系：`O` GS:419-518 : PS2:445-544；`H` GS:519-537 : PS2:545-563。
// **§5 CONFIRMED：两段去空白后逐字节相同（H 421 字符 / O 2108 字符），无 PS2 独有分支。**
// 唯一随 profile 变的只有量测样式块里的 `.{ns}-line` 选择器。
//
// ⚠️ **这不是收据单那套**（对照表见 §5.2，7 条差异）。最容易抄错的四条：
//   1. 「固定开销」是**硬编码常数** `8 + 10`，**不量测**（收据单是量出来的）；
//   2. **每一页预算完全相同**（本家族**没有页脚**；收据单的末页预算不同）；
//   3. **没有**收据单那两个补丁（`l<=y → l=y+1` 与「给末页留一行」）；
//   4. 量测载体是**隐藏 iframe + `document.write`**（收据单是隐藏 div）。
//
// ⚠️ **PS2 的连带影响（§5 末段）**：分页代码一个字不改，但 `keepEmptyLines: true` 会让
// 空串字段（`doorframe`/`windows` 经常是空串）渲染出占位行、**每行实测高度变大**，
// 于是切页位置随之改变。**这是最容易被忽略的一处**。
//
// 本文件拆成三层，与收据单 `receipt2/paginate.ts` 同构：
//   - `paginate()`            —— 纯函数「打包半」，逐字移植自 GS:519-537
//   - `measureRowHeights()`   —— 「量测半」`O`，只能照抄旧版原码（要真实浏览器）
//   - `renderAllPages()` 等   —— 调度 + 逐页渲染

import type { DocSheetConfig, DocSheetPage, DocSheetRow, RenderOptions } from './types'
import type { DocSheetProfile } from './profile'
import { buildDocumentHtml, buildRootHtml, renderCell, renderPage, visibleColumns } from './html'
import { docSheetCss } from './css'

/**
 * 分页预算里的两个**硬编码常数**（GS:525 / PS2:551）：`heightMm - 2*paddingMm - 8 - 10`。
 *
 * ⚠️ **一个都别改**（§5.2 明确要求「照抄这两个常数，别"改进"」）。语义是 INTERPRETED：
 *   - `8` 对应 `.{ns}-title` 的 `line-height:8mm`（CSS 里正好是 8mm，见 `css.ts`）；
 *   - `10` 是额外留白（标题还带 `margin-bottom:0.5mm`，且避免贴边）。
 * 证据：预算里没有任何其它固定高度项。**若哪天要改，务必先量一遍真实排版。**
 */
export const PAGE_BUDGET_TITLE_MM = 8
export const PAGE_BUDGET_EXTRA_MM = 10

/**
 * 量测不到行高时的兜底值 mm（GS:531 的 `heights[i] ?? 20`）。
 *
 * ⚠️ 是 **`??`** —— 量测出的 `0` **不会**被替换成 20（0 是合法量测值）。
 */
export const FALLBACK_ROW_HEIGHT_MM = 20

/**
 * 量测时的等图超时 ms（GS:505 的 `2e3`）。
 *
 * ⚠️ **只有量测这条链路有超时**。旧版 `printDirect` 的等图 Promise **没有兜底**
 * （§9.3 / §13.9 CONFIRMED）：任一张 `<img>` 既不触发 `onload` 也不触发 `onerror`
 * （断链但连接挂起），**打印对话框永远不会弹出**、`ElLoading` 遮罩一直转。
 * 新版打印链路**补同样的 2s 兜底**（`waitForImages(doc, MEASURE_IMAGE_TIMEOUT_MS)`，
 * 见 `print.ts`），那是有意的改进，不改变本层的量测行为。
 */
export const MEASURE_IMAGE_TIMEOUT_MS = 2000

// ------------------------------------------------------------------ //
// A. 打包半（纯函数，H，GS:519-537 / PS2:545-563）
// ------------------------------------------------------------------ //

/**
 * 把行按高度贪心切页（旧版 `H` 的循环体，GS:522-536）。
 *
 * 逐字规则：
 * - **空数据 → `[[]]`**（一个空页，表头还在、`<tbody>` 空）—— 与收据单「一行
 *   `colspan=10` 的『暂无明细』」**不同**（差异表 #15）。这个空页由 `renderPage([], 0, 1, …)` 渲染。
 * - `budget = heightMm - 2*paddingMm - 8 - 10`，**每页相同**（无页脚 ⇒ 无常数差异）。
 * - `used + h > budget && cur.length > 0` 才翻页 —— **`cur.length > 0` 保证每页至少一行**。
 *   这就是为什么**不需要**收据单那两个补丁。
 * - 单行本身就超一整页时**不切分、不降字号**，静默溢出（`overflow:hidden` 裁掉，§5.2 末行）。
 *
 * ⚠️ **有意偏离（§5.2 / §6.4 决策 1）**：旧版 `paddingMm` 读盘可能得到 **`NaN`**
 * （`??` 语义的缺陷），此时 `budget` 也是 `NaN`，而 `used + h > NaN` **恒为 false**
 * ⇒ 永不翻页 ⇒ **整份单据退化成单页**。新版在 `sanitize.ts` 把 `paddingMm` 的读盘
 * 改成 `Number.isFinite` 判定（回落 3），这条路径**不再可达**。
 * 本函数**不做额外防御**：`budget` 若真是 `NaN`，行为与旧版逐字一致（也退化成单页）。
 *
 * @param rowHeights 每行高度 mm（来自 `measureRowHeights`）。缺失项按 `FALLBACK_ROW_HEIGHT_MM` 估。
 */
export function paginate<R extends DocSheetRow>(
  rows: R[],
  rowHeights: number[],
  config: DocSheetConfig,
): R[][] {
  // GS:522 —— 空数据短路，**在量测之前**（不建 iframe）
  if (!Array.isArray(rows) || rows.length === 0) return [[]]

  const paper = config.paper
  const budget =
    paper.heightMm - 2 * paper.paddingMm - PAGE_BUDGET_TITLE_MM - PAGE_BUDGET_EXTRA_MM // GS:525

  const pages: R[][] = []
  let cur: R[] = []
  let used = 0

  for (let i = 0; i < rows.length; i++) {
    const h = rowHeights[i] ?? FALLBACK_ROW_HEIGHT_MM // GS:531
    if (used + h > budget && cur.length > 0) {
      pages.push(cur) // GS:532
      cur = []
      used = 0
    }
    cur.push(rows[i])
    used += h
  }
  if (cur.length > 0) pages.push(cur) // GS:536
  return pages
}

// ------------------------------------------------------------------ //
// B. 量测半（O，GS:419-518 / PS2:445-544）
// ------------------------------------------------------------------ //

/** 量测用 iframe 的样式（GS:478-479 逐字）。 */
const MEASURE_IFRAME_STYLE =
  'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;visibility:hidden;'

/**
 * 量测文档里的样式块（GS:473-474 **逐字**）。随 profile 变的只有 `.{ns}-line` 一处。
 *
 * ⚠️ 两处必须注意：
 * 1. 选择器是**裸 `th,td`**（不是 `.{ns}-table th, td`），因为量测表格没有 `class`；
 * 2. 边框色**硬编码 `#444`**，**忽略配置的 `borderColor`**（GS:474 就是这么写的）。
 *    所以配置换了边框色时，量测出来的行高与最终打印**可能有亚像素差**。
 *    照抄 —— 改它会让分页与旧版不一致。
 */
function measureStyle(profile: DocSheetProfile): string {
  return (
    '\n    th,td{border:0.2mm solid #444;vertical-align:top;padding:1mm 1.2mm;word-break:break-all;}\n    th{text-align:center;font-weight:600;}\n    .' +
    profile.classes.line +
    '{line-height:inherit;}\n    body{margin:0;padding:0;}\n  '
  )
}

/**
 * 造量测用的表格 HTML（GS:424-472 / PS2:450-498）。
 *
 * ⚠️ 与打印版有三处**必须**不同（别为了「复用」把它们合并）：
 * 1. `<th>` **带内联 `font-size:{headerFontSize}pt`**（打印版靠 CSS 规则，没有内联）；
 * 2. 每行是 `<tr data-ridx="{i}">` —— 量测就是靠这个属性回捞行元素的；
 * 3. 表格是**裸 `<table style="…">`**、且 `</thead><tbody>` **紧接无换行**
 *    （打印版是 `\n      <tbody>`）。
 *
 * 二维码尺寸与打印版一致，是 **17mm**（GS:458）；`imgStyle` 也显式传（GS:459-460）。
 *
 * **导出只为可验证**（这段 HTML 只在 iframe 里跑、不产出可见结果，没有现成夹具）——
 * 组件层不该直接用它，请走 `renderAllPages` / `buildDocSheetHtml`。
 */
export function buildMeasureTable(
  rows: DocSheetRow[],
  config: DocSheetConfig,
  opts: RenderOptions,
  profile: DocSheetProfile,
): string {
  const cols = visibleColumns(config.table)

  // GS:424-435 —— 表头，**带内联 font-size**
  const theadCells = cols
    .map(
      (col) =>
        '<th style="width:' +
        col.widthMm +
        'mm;font-size:' +
        config.table.headerFontSize +
        'pt;">' +
        col.label +
        '</th>',
    )
    .join('')

  // GS:436-466 —— 明细行，每行挂 `data-ridx`
  const bodyRows = rows
    .map((row, index) => {
      const tds = cols
        .map(
          (col) =>
            '<td style="width:' +
            col.widthMm +
            'mm;font-size:' +
            col.fontSize +
            'pt;color:' +
            col.fontColor +
            ';line-height:' +
            col.rowHeightMm +
            'mm;">' +
            renderCell(col.key, row, opts, profile) +
            '</td>',
        )
        .join('')
      return '<tr data-ridx="' + index + '">' + tds + '</tr>' // GS:464
    })
    .join('')

  // GS:467-472 —— `</thead><tbody>` 紧接，**没有换行**
  return (
    '<table style="width:100%;border-collapse:collapse;table-layout:fixed;">\n    <thead><tr>' +
    theadCells +
    '</tr></thead><tbody>' +
    bodyRows +
    '</tbody></table>'
  )
}

/**
 * 等文档里所有 `<img>` 完成（旧版 GS:493-506）。
 *
 * `complete` 为真的直接计数；否则挂 `onload` **和** `onerror`（**两个都算完成** ——
 * 图片挂了不能让分页永远卡住）。默认**无超时**，传 `timeoutMs` 才有兜底。
 *
 * ⚠️ 旧版 `printDirect` 的同一段等待**没有传超时**（§9.3），这是旧版缺陷；
 * 新版打印链路传 `MEASURE_IMAGE_TIMEOUT_MS`（见 `print.ts`）。
 */
export function waitForImages(doc: Document, timeoutMs?: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const images = Array.from(doc.querySelectorAll('img'))
    if (images.length === 0) return resolve() // GS:496

    let done = 0
    const tick = () => {
      done++
      if (done >= images.length) resolve() // GS:498-500
    }
    images.forEach((img) => {
      if (img.complete) tick()
      else {
        img.onload = tick
        img.onerror = tick
      }
    })

    // GS:505 —— 2s 兜底。`resolve` 幂等，超时后图片再回来也不会重复结算。
    if (timeoutMs !== undefined) setTimeout(resolve, timeoutMs)
  })
}

/**
 * 量测每行高度（旧版 `O`，GS:419-518 / PS2:445-544）—— **必须真实浏览器**。
 *
 * 流程（§5.1 逐条对照）：
 * 1. 造表格 HTML（表头 + 带 `data-ridx` 的明细行）；
 * 2. 建隐藏 iframe 挂到 body，`document.write` 一份**独立文档**
 *    （`<body><div style="width:{widthMm-2*paddingMm}mm">{table}</div></body>`）；
 * 3. 等图片（**2s 超时**）；
 * 4. 量：`tr[data-ridx]` 的 `offsetHeight` × **px→mm 比例**；
 * 5. 摘掉 iframe。
 *
 * **px→mm 比例**（GS:508-512）：`(widthMm - 2*paddingMm) / 包装 div 的 offsetWidth`。
 * 包装 div 的宽度是显式 `mm`，它的 `offsetWidth` 是 CSS px —— 两者相除即「1px 等于多少 mm」，
 * 对 DPI/浏览器缩放免疫。
 *
 * ⚠️ `doc.querySelector("div")` 取的是**文档里第一个 div**。这**是对的**：
 * 量测文档是 `<body><div style="width:…">{table}</div></body>`，包装 div 就是第一个；
 * 单元格里的 `<div class="{ns}-line">` 都在它**内部**、在文档序里更靠后。
 * 这里**保持旧版写法**，不改加 id —— 量测结果与旧版逐像素一致优先。
 *
 * ⚠️ 只有一处**有意加固**：`finally` 摘 iframe。旧版是顺序执行（量测抛错时 iframe 会
 * 赖在 body 上），新版套了 try/finally。**正常路径逐字未动**。
 */
export async function measureRowHeights(
  rows: DocSheetRow[],
  config: DocSheetConfig,
  opts: RenderOptions,
  profile: DocSheetProfile,
): Promise<number[]> {
  // 旧版是 Vue 组件、必在浏览器；这里加一层守卫，让本模块在 node 里可被单测引用。
  if (typeof document === 'undefined') return []

  const paper = config.paper
  const contentWidthMm = paper.widthMm - 2 * paper.paddingMm // GS:476 的 `m`
  const table = buildMeasureTable(rows, config, opts, profile)

  const iframe = document.createElement('iframe') // GS:477
  iframe.style.cssText = MEASURE_IFRAME_STYLE // GS:478-479
  document.body.appendChild(iframe) // GS:480

  try {
    const doc = iframe.contentDocument || iframe.contentWindow!.document // GS:481
    doc.open() // GS:483
    doc.write(
      // GS:484-490
      '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
        measureStyle(profile) +
        '</style></head><body><div style="width:' +
        contentWidthMm +
        'mm;">' +
        table +
        '</div></body></html>',
    )
    doc.close() // GS:492

    await waitForImages(doc, MEASURE_IMAGE_TIMEOUT_MS) // GS:493-506

    const trs = Array.from(doc.querySelectorAll('tr[data-ridx]')) // GS:507
    // GS:508-512 —— `|| 1` 防除零（量到 0 时比例为 widthMm-2P，行高也恒为 0）
    const pxToMm = contentWidthMm / (doc.querySelector('div')?.offsetWidth || 1)
    return trs.map((tr) => (tr as HTMLElement).offsetHeight * pxToMm) // GS:513
  } finally {
    // GS:515 —— 摘掉 iframe，异常路径也不泄漏
    if (document.body.contains(iframe)) document.body.removeChild(iframe)
  }
}

// ------------------------------------------------------------------ //
// C. 调度
// ------------------------------------------------------------------ //

/**
 * 量测 + 切页（旧版 `H`，GS:519-537）。空数据短路成 `[[]]`，**不建 iframe**。
 */
export async function paginateWithMeasure<R extends DocSheetRow>(
  rows: R[],
  config: DocSheetConfig,
  opts: RenderOptions,
  profile: DocSheetProfile,
): Promise<R[][]> {
  if (!Array.isArray(rows) || rows.length === 0) return [[]] // GS:522
  const heights = await measureRowHeights(rows, config, opts, profile) // GS:526
  return paginate(rows, heights, config)
}

/**
 * 渲染全部页（旧版 `j` 里 `u.map(renderPage).join("")` 的那一步，GS:577-624）。
 *
 * ⚠️ **单页判定**：`pageCount > 1` 才渲染页码（GS:602-609）。
 * 空数据得到的是 `[[]]` → **1 页**（表头在、`<tbody>` 空、**无页码**）。
 */
export async function renderAllPages<R extends DocSheetRow>(
  rows: R[],
  config: DocSheetConfig,
  opts: RenderOptions,
  profile: DocSheetProfile,
): Promise<DocSheetPage[]> {
  const pages = await paginateWithMeasure(rows, config, opts, profile)
  return pages.map((page, i) => renderPage(page, i, pages.length, config, opts, profile))
}

/**
 * 构建**根容器 HTML**（旧版 `j` / 组件 expose 的 `buildXxxSheet2Html`，GS:571-667）。
 *
 * 旧版 `j(rows?)` 的行来源是「传参优先，否则 `props.getData()`」（GS:574-576）；
 * 新版**行由调用方显式传入**（GS2 从 `glassProduces()`、PS2 从 `productionProduces()` 拿），
 * 这个回退分支不收进来。
 *
 * ⚠️ 旧版 `j` 里**读的是「生效配置」`i.value`**，不是草稿 —— 布局编辑器的预览走的是
 * 另一条路（`S` + 草稿 `s`，见 `html.ts` 的 `renderPreviewTable`）。两者别混。
 */
export async function buildDocSheetHtml<R extends DocSheetRow>(
  rows: R[],
  config: DocSheetConfig,
  opts: RenderOptions,
  profile: DocSheetProfile,
): Promise<string> {
  const pages = await renderAllPages(rows, config, opts, profile)
  return buildRootHtml(pages, docSheetCss(config, profile), profile)
}

/**
 * 构建**完整文档**（旧版 `J`，GS:673-681 / PS2:699-707）—— 带 `<!DOCTYPE html>` 与 `<title>`，
 * 给 `printDirect` 的隐藏 iframe / Electron 静默打印用。
 */
export async function buildDocSheetDocument<R extends DocSheetRow>(
  rows: R[],
  config: DocSheetConfig,
  opts: RenderOptions,
  profile: DocSheetProfile,
): Promise<string> {
  return buildDocumentHtml(await buildDocSheetHtml(rows, config, opts, profile), profile)
}
