// 自定义玻璃合片单 · HTML 构造器 —— 逐字移植自旧版。
//
// 对应关系（旧版标识符 → 本文件导出）：
//   `D` GS:182-187 → `escapeHtml`
//   `A` GS:188-202 → `renderMultiline`
//   `B` GS:272-282 → `renderOrderCaption`
//   `U` GS:206-307 → `renderCell`
//   `G` GS:538-570 → `renderRow`
//   `th` GS:591-600 → `renderTableHead`
//   单页 GS:610-622 → `renderPage`
//   `S` GS:308-360 → `renderPreviewTable`（布局编辑器预览）
//   `j` GS:571-667 → `buildRootHtml`
//   `J` GS:673-681 → `buildDocumentHtml`
//
// ⚠️ **字面量换行与缩进全部是保真度的一部分**，别用格式化工具重排（§3 的三个 ⚠️）：
//   - `renderPage` 的 `<section>` 前是 `\n  `（2 空格）、`> ` 后是 `\n    `（4 空格）、
//     `</tr></thead>` 与 `<tbody>` 之间**没有空格**、`</table>` 与 `</section>` 之间是 `\n  `；
//   - `renderRow` 的 `<tr>` 前有 `\n  `、`</tr>` 前无换行；
//   - 单页时 `{{pageNum}}` 是空串，会留下**连续两个** `\n    `（`>\n    \n    <div class="gs2-title">`）。
//
// ⚠️ **二维码尺寸三处统一 `17mm`（有意偏离，§7.4 决策 2，用户 2026-09-17 拍板）**：
//   旧版编辑器预览 `S` 传 `{qrSize:"15mm"}`（GS:340），量测 `O`（GS:458）与打印 `G`（GS:561）
//   传 `"17mm"`。三处不一致 ⇒ 编辑器里看到的换行位置与真实打印**会有细微出入**。
//   新版统一成 `17mm`（预览与打印共用同一份行构造），理由：编辑器预览的意义就是所见即所得。
//   ⚠️ **注意**：这不是「预览向打印对齐」那么简单 —— 量测 `O` 也走 17mm，
//   所以统一之后 **量测/预览/打印三者才第一次真正一致**，分页结果也随之变化。

import type {
  ColumnConfig,
  GlassSheet2Config,
  GlassSheet2Page,
  GlassSheet2Row,
  QrEncoder,
  QrSvg,
  RenderOptions,
  TableConfig,
} from './types'

/** 旧版 `U` 第 4 参的 `qrSize` 缺省值（GS:209）。 */
export const DEFAULT_QR_SIZE = '17mm'

/** 旧版 `U` 第 4 参的 `imgStyle` 缺省值（GS:210-212）—— 与三处显式传值**逐字相同**。 */
export const DEFAULT_IMG_STYLE = 'width:100%;display:block;margin:0 auto;object-fit:contain;'

/** 完整文档的 `<title>`（旧版 `Bn(227)`，**字面量**，不是 `table.title`）。 */
export const DOCUMENT_TITLE = '自定义玻璃合片单'

// ------------------------------------------------------------------ //
// 基础工具
// ------------------------------------------------------------------ //

/**
 * HTML 转义（旧版 `D`，GS:182-187）—— 5 个字符，**顺序照抄**（`&` 必须第一个替换）。
 *
 * ⚠️ 只用于**文本**。表头 `label`（GS:597）与图片 `src`（GS:222/298）旧版**都不转义**，
 * 本文件照抄（见 `renderTableHead` / `renderCell` 的注释）。
 */
export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 富文本 → 多行 `<div class="gs2-line">`（旧版 `A`，GS:188-202）。
 *
 * 切分规则：按 `<br>` / `<br/>`（正则 `/<br\s*\/?>/i`）切开 → 每段 `trim()` →
 * **`filter(Boolean)` 丢掉空段** → 逐段转义后包 div。**全空 → 空串**（不是空 div）。
 *
 * ⚠️ 这一步决定了 `client`/`door`/`basicInfo`/`doorsheet`/`remark` 五列的行数，
 * 也就决定了分页高度 —— 别「顺手」保留空行。
 */
export function renderMultiline(value: unknown): string {
  const lines = String(value ?? '')
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''
  return lines.map((s) => '<div class="gs2-line">' + escapeHtml(s) + '</div>').join('')
}

/**
 * 单号字幕折行（旧版 `B`，GS:272-282）—— **与 `renderMultiline` 不是一回事**：
 * 这里的 `<br>` 是**字面 `<br>`**（不是 `gs2-line` div），且每段整段转义。
 *
 * 规则（按 `/` 切分单号）：
 * - ≥3 段：`esc(a[0] + "/" + a[1]) + "<br>" + esc(a.slice(2).join("/"))`
 * - 2 段：`esc(a[0]) + "<br>" + esc(a[1])`
 * - 其它：`esc(全串)`
 *
 * 空串 → `""`（此时调用方连带整个字幕 div 都不渲染）。
 */
export function renderOrderCaption(value: unknown): string {
  const text = String(value || '')
  if (!text) return ''
  const parts = text.split('/')
  return parts.length >= 3
    ? escapeHtml(parts[0] + '/' + parts[1]) + '<br>' + escapeHtml(parts.slice(2).join('/'))
    : parts.length === 2
      ? escapeHtml(parts[0]) + '<br>' + escapeHtml(parts[1])
      : escapeHtml(text)
}

// ------------------------------------------------------------------ //
// 二维码
// ------------------------------------------------------------------ //

/**
 * 带缓存的二维码 provider（旧版 `I` + GS:245-260 的 IIFE）。
 *
 * 缓存键是 **`text + "::m1"`**（GS:248）—— `m1` 对应 `EncodeHintType.MARGIN = 1`，
 * 即「静默区 1 模块」；旧版把 hint 编进键里，是为了将来换 margin 时缓存不串味。
 * **照抄这个键格式。**
 *
 * 视图盒回退 `"0 0 180 180"`（GS:253）由这里补，编码器只管产出 `{viewBox, inner}`。
 *
 * ⚠️ 失败**不进缓存**（旧版 `catch` 里直接 `return null`，GS:257-259）——
 * 每次都重试。照抄。
 *
 * ⚠️ **有意做成工厂**（旧版是模块级单例 `k = new y()` + 模块级 `Map`）：
 * 本仓库没有二维码编码库（见 `types.ts` 的 `QrEncoder` 注释），编码器由组件层注入。
 * 把缓存和编码器绑在一个实例里，既保住「同一组件内不重复编码」的旧版行为，
 * 又避免多个编码器共用一张缓存表时串味。**每个打印管理器实例建一个即可。**
 */
export function createQrSvgProvider(encode: QrEncoder): (text: string) => QrSvg | null {
  const cache = new Map<string, string>() // 旧版 `I`：text::m1 → JSON

  return (text: string): QrSvg | null => {
    if (!text) return null // GS:247

    const key = text + '::m1' // GS:248
    const cached = cache.get(key)
    if (cached !== undefined) return JSON.parse(cached) as QrSvg // GS:249

    try {
      const encoded = encode(text)
      if (!encoded) return null
      // GS:253 —— 库产出的 viewBox 取不到时回退固定视口
      const svg: QrSvg = { viewBox: encoded.viewBox || '0 0 180 180', inner: encoded.inner }
      cache.set(key, JSON.stringify(svg)) // GS:256
      return svg
    } catch {
      return null // GS:257-259 —— 不缓存失败
    }
  }
}

// ------------------------------------------------------------------ //
// 单元格（U，GS:206-307）
// ------------------------------------------------------------------ //

/**
 * 单号文本取值（GS:225-244）：`row.OrderID ?? row.orderID ?? row.qrcode`，全缺 → `""`。
 *
 * ⚠️ 是 **`??`** 不是 `||` —— 空串 `OrderID: ""` **不会**回退到 `qrcode`。
 * 旧版嵌套三元写的，等价于 `??`。照抄。
 */
function orderText(row: GlassSheet2Row | undefined): string {
  return String(row?.OrderID ?? row?.orderID ?? row?.qrcode ?? '')
}

/**
 * 单元格内容 —— 三种形态（§3.6），另有 `default` → 空串。
 *
 * | key | 形态 | 备注 |
 * |---|---|---|
 * | `client` / `door` / `basicInfo` / `doorsheet` / `remark` | (a) 多行文本 | `renderMultiline` |
 * | `doorImg` / `lockImg` | (b) 图片 | 固定 `imgStyle`，**`url` 不转义**；`trim()` 后为空 → 空串 |
 * | `order` | (c) 二维码 + 字幕 | 见下 |
 * | 其它 | — | `""` |
 *
 * @param opts `qrSize` / `imgStyle` / `qr`（二维码 provider）。旧版这个参数在打印与量测
 *             两条链路里**都显式传**（GS:457-461、559-563），且值逐字相同。
 */
export function renderCell(
  key: string,
  row: GlassSheet2Row | undefined,
  opts: RenderOptions = {},
): string {
  const qrSize = opts.qrSize || DEFAULT_QR_SIZE // GS:209
  const imgStyle = opts.imgStyle || DEFAULT_IMG_STYLE // GS:210-212

  switch (key) {
    case 'client':
      return renderMultiline(row?.client) // GS:214-215
    case 'door':
      return renderMultiline(row?.door) // GS:216-217
    case 'doorImg': {
      // GS:218-223 —— `url` **不转义**（旧版直接拼 `e`），照抄
      const url = String(row?.doorImg ?? '').trim()
      return url ? '<img style="' + imgStyle + '" src="' + url + '" />' : ''
    }
    case 'order': {
      // GS:224-291
      const text = orderText(row)
      const qr = opts.qr ? opts.qr(text) : null // GS:245-260（无 provider → 等价于旧版编码器抛错）
      const svg = qr
        ? '<svg style="width:' +
          qrSize +
          ';height:' +
          qrSize +
          ';display:block;margin:0 auto 0.5mm;" viewBox="' +
          qr.viewBox +
          '" preserveAspectRatio="xMidYMid meet">' +
          qr.inner +
          '</svg>'
        : '' // GS:261-271
      const caption = renderOrderCaption(text) // GS:272-282
      return (
        svg +
        (caption ? '<div style="text-align:center;line-height:1.4;">' + caption + '</div>' : '') // GS:283-290
      )
    }
    case 'basicInfo':
      return renderMultiline(row?.basicInfo) // GS:292-293
    case 'lockImg': {
      // GS:294-299 —— 与 `doorImg` 同一个 `imgStyle`。这是**开向示意图**，不是锁具图/挖孔图。
      const url = String(row?.lockImg ?? '').trim()
      return url ? '<img style="' + imgStyle + '" src="' + url + '" />' : ''
    }
    case 'doorsheet':
      return renderMultiline(row?.doorsheet) // GS:300-301
    case 'remark':
      return renderMultiline(row?.remark) // GS:302-303
    default:
      return '' // GS:304-305 —— 未知 key（读盘多出来的列）走这里
  }
}

/** 单元格 `<td>` 的样式串（GS:207-212 / GS:329-341 两处逐字相同）。**结尾带分号。** */
function cellStyle(col: ColumnConfig): string {
  return (
    'width:' +
    col.widthMm +
    'mm;font-size:' +
    col.fontSize +
    'pt;color:' +
    col.fontColor +
    ';line-height:' +
    col.rowHeightMm +
    'mm;'
  )
}

/** 可见列（旧版 `p` computed，GS:112-114）。**行、表头、分页、量测全都读它。** */
export function visibleColumns(table: TableConfig): ColumnConfig[] {
  return table.columns.filter((c) => c.visible)
}

// ------------------------------------------------------------------ //
// 明细行（G，GS:538-570）
// ------------------------------------------------------------------ //

/**
 * 一行明细（旧版 `G`，GS:538-570）。
 *
 * ⚠️ 逐字结构：`"\n  <tr>" + 各 td + "</tr>"` —— `<tr>` 前有**一个换行 + 2 空格**，
 * `</tr>` 前**无换行**，所以行与行首尾相接（页面的 `<tbody>` 里逐行拼）。
 *
 * ⚠️ 打印版 `<tr>` **没有 `data-ridx`**（量测版才有，见 `paginate.ts`）。
 * 别把两个版本合并 —— 量测版还有「表头带内联 font-size」这一处不同。
 */
export function renderRow(
  row: GlassSheet2Row,
  table: TableConfig,
  opts: RenderOptions = {},
): string {
  const cells = visibleColumns(table)
    .map(
      (col) =>
        '<td style="' + cellStyle(col) + '">' + renderCell(col.key, row, opts) + '</td>',
    )
    .join('')
  return '\n  <tr>' + cells + '</tr>'
}

// ------------------------------------------------------------------ //
// 表头（GS:591-600）
// ------------------------------------------------------------------ //

/**
 * 打印版表头单元格（GS:591-600）：`<th style="width:{w}mm">{label}</th>`。
 *
 * ⚠️ **没有内联 `font-size`** —— 表头字号只由 CSS 的
 * `.gs2-table th { font-size:{headerFontSize}pt }` 提供（见 `css.ts`）。
 * 这与量测版（`paginate.ts` 里带内联 font-size）**不同**，别混。
 *
 * ⚠️ `label` **不转义**（旧版直接拼 `e.label`），照抄。
 */
export function renderTableHead(table: TableConfig): string {
  return visibleColumns(table)
    .map((col) => '<th style="width:' + col.widthMm + 'mm">' + col.label + '</th>')
    .join('')
}

// ------------------------------------------------------------------ //
// 单页（GS:610-622）
// ------------------------------------------------------------------ //

/**
 * 一页（旧版 `j` 的 `u.map(...)` 内联回调，GS:578-623）。
 *
 * @param pageIndex 0 基页号（旧版 `t`）
 * @param pageCount 总页数（旧版 `o`）—— **`> 1` 才渲染页码**（GS:602-609）；
 *                  单页时 `{{pageNum}}` 是空串，会留下连续两个 `\n    `（§3.3）
 */
export function renderPage(
  rows: GlassSheet2Row[],
  pageIndex: number,
  pageCount: number,
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): GlassSheet2Page {
  const paper = config.paper
  // GS:582-590 —— 顺序即字符串顺序，**别重排**（尾项无分号，靠 join 补）
  const paperStyle = [
    'width:' + paper.widthMm + 'mm',
    'height:' + paper.heightMm + 'mm',
    'padding:' + paper.paddingMm + 'mm',
    'position:relative',
    'box-sizing:border-box',
    'background:#fff',
    'overflow:hidden',
  ].join(';')

  const theadCells = renderTableHead(config.table) // GS:591-600
  const bodyRows = rows.map((row) => renderRow(row, config.table, opts)).join('') // GS:601
  const pageNum =
    pageCount > 1 ? '<div class="gs2-page-num">' + (pageIndex + 1) + ' / ' + pageCount + '</div>' : '' // GS:602-609

  return (
    '\n  <section class="gs-sheet" style="' +
    paperStyle +
    '">\n    ' +
    pageNum +
    '\n    <div class="gs2-title">' +
    escapeHtml(config.table.title) + // GS:616 —— 标题**转义**
    '</div>\n    <table class="gs2-table">\n      <thead><tr>' +
    theadCells +
    '</tr></thead>\n      <tbody>' +
    bodyRows +
    '</tbody>\n    </table>\n  </section>'
  )
}

// ------------------------------------------------------------------ //
// 根容器（j，GS:571-667）
// ------------------------------------------------------------------ //

/**
 * 根容器：`<div class="gs-root"><style>{CSS}</style>{各页}</div>`（GS:625-666）。
 *
 * ⚠️ 页与页之间**无分隔符**（旧版 `r` 就是各页 `join("")`）。
 * ⚠️ 旧版 `j` 把「分页」也算在里面（`H`），新版拆开了 —— 分页在 `paginate.ts`，
 * 本函数只收**已经切好页**的 HTML 数组，保持 html.ts 纯函数、可离线比对。
 */
export function buildRootHtml(pages: GlassSheet2Page[], cssText: string): string {
  return '<div class="gs-root"><style>' + cssText + '</style>' + pages.join('') + '</div>'
}

/**
 * 完整文档（旧版 `J`，GS:673-681）。
 *
 * ⚠️ **逐字**，无换行、无缩进。`<title>` 是**字面量**「自定义玻璃合片单」（`DOCUMENT_TITLE`），
 * **不是** `config.table.title` —— 用户改了标题，浏览器标签页/title 仍是这 6 个字。照抄。
 */
export function buildDocumentHtml(rootHtml: string): string {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
    DOCUMENT_TITLE +
    '</title></head><body>' +
    rootHtml +
    '</body></html>'
  )
}

// ------------------------------------------------------------------ //
// 布局编辑器预览（S，GS:308-360）
// ------------------------------------------------------------------ //

/**
 * 布局编辑器右侧的单页预览（旧版 `S`，GS:308-360）。
 *
 * **这是打印版的一个"散装"变体**，与 `renderPage` 有 4 处不同（§7.4 对照表）：
 * 1. **无 `class`** 的裸 `<table>` + 一段**自带 `<style>`**（`.gs2-prev-table …`），
 *    而不是靠 `.gs2-table` 类 + 全局 CSS；
 * 2. `<th>` **有**内联 `font-size`（打印版没有）；
 * 3. `<tr>` **无前导 `\n  `**、无 `data-ridx`；
 * 4. 可见列为 0 时**早退**成「无可见列」占位（打印版没有这个分支）。
 *
 * ⚠️ **第 5 处不同是旧版的 bug，新版已修（有意偏离，§7.4 决策 2）**：
 * 旧版这里的 `qrSize` 是 **`"15mm"`**（GS:340），而量测 `O`（GS:458）与打印 `G`（GS:561）
 * 都是 `"17mm"` ⇒ 编辑器里看到的二维码更矮、换行位置与真实打印对不上。
 * **新版统一 `17mm`** —— 预览、量测、打印三处第一次真正一致。
 *
 * ⚠️ 自带的 `<style>` 用的是 `.gs2-prev-table` **后代选择器**，但这段 HTML 被塞进
 * `<div class="gs2-prev-table">` 里（GS:401-405），所以选择器能命中。照抄结构即可。
 * `borderColor` 走的是配置值（与打印版一致），**不是**量测版那个硬编码的 `#444`。
 */
export function renderPreviewTable(
  rows: GlassSheet2Row[],
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): string {
  const visible = visibleColumns(config.table)
  if (visible.length === 0) {
    // GS:311-312 —— 打印版没有这个分支
    return '<div style="text-align:center;color:#999;padding:20px;">无可见列</div>'
  }

  // GS:313-322 —— 与打印版表头的唯一区别：**有**内联 font-size
  const theadCells = visible
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

  // GS:323-348 —— 每行 `<tr>` 无前导换行（打印版 `G` 有）
  const bodyRows = rows
    .map(
      (row) =>
        '<tr>' +
        visible
          .map(
            (col) =>
              '<td style="' +
              cellStyle(col) +
              '">' +
              renderCell(col.key, row, opts) +
              '</td>',
          )
          .join('') +
        '</tr>',
    )
    .join('')

  // GS:349-359
  return (
    '<div style="text-align:center;font-size:7mm;line-height:8mm;font-weight:500;margin-bottom:0.5mm;">' +
    escapeHtml(config.table.title) +
    '</div>\n    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">\n      <thead><tr>' +
    theadCells +
    '</tr></thead>\n      <tbody>' +
    bodyRows +
    '</tbody>\n    </table>\n    <style>\n      .gs2-prev-table th, .gs2-prev-table td { border:0.2mm solid ' +
    config.table.borderColor +
    '; vertical-align:top; padding:1mm 1.2mm; word-break:break-all; }\n      .gs2-prev-table th { text-align:center; font-weight:600; }\n    </style>'
  )
}
