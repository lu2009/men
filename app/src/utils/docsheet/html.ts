// C 家族自绘单据 · HTML 构造器 —— 逐字移植自旧版。
//
// 对应关系（旧版标识符 → 本文件导出。GS2 行号 : PS2 行号）：
//   `D` GS:182-187 : PS2:191-196 → `escapeHtml`
//   `A` GS:188-202 : PS2:197-212 → `renderMultiline`  ⚠️ **两张单据唯一真正的逻辑差异**，见下
//   `B` GS:272-282 : PS2:282-292 → `renderOrderCaption`
//   `U` GS:206-307 : PS2:216-327 → `renderCell`
//   `G` GS:538-570 : PS2:564-596 → `renderRow`
//   `th` GS:591-600 : PS2:617-626 → `renderTableHead`
//   单页 GS:610-622 : PS2:636-648 → `renderPage`
//   `S` GS:308-360 : PS2:328-380 → `renderPreviewTable`（布局编辑器预览）
//   `j` GS:571-667 : PS2:597-693 → `buildRootHtml`
//   `J` GS:673-681 : PS2:699-707 → `buildDocumentHtml`
//
// ⚠️ **字面量换行与缩进全部是保真度的一部分**，别用格式化工具重排（§3 的三个 ⚠️）：
//   - `renderPage` 的 `<section>` 前是 `\n  `（2 空格）、`> ` 后是 `\n    `（4 空格）、
//     `</tr></thead>` 与 `<tbody>` 之间**没有空格**、`</table>` 与 `</section>` 之间是 `\n  `；
//   - `renderRow` 的 `<tr>` 前有 `\n  `、`</tr>` 前无换行；
//   - 单页时 `{{pageNum}}` 是空串，会留下**连续两个** `\n    `（`>\n    \n    <div class="…-title">`）。
//
// ⚠️ **二维码尺寸三处统一 `17mm`（有意偏离，§7.4 决策 2，用户 2026-09-17 拍板）**：
//   旧版编辑器预览 `S` 传 `{qrSize:"15mm"}`（GS:340），量测 `O`（GS:458）与打印 `G`（GS:561）
//   传 `"17mm"`。三处不一致 ⇒ 编辑器里看到的换行位置与真实打印**会有细微出入**。
//   新版统一成 `17mm`（预览与打印共用同一份行构造），理由：编辑器预览的意义就是所见即所得。
//   **两张单据同一条决策**（PS2 的 `S` 也是 15mm，§11 表把 `html.ts` 的三处一起列了）。

import type { ColumnConfig, DocSheetConfig, DocSheetPage, DocSheetRow, QrEncoder, QrSvg, RenderOptions, TableConfig } from './types'
import type { DocSheetProfile } from './profile'

/** 旧版 `U` 第 4 参的 `qrSize` 缺省值（GS:209 / PS2:219）。 */
export const DEFAULT_QR_SIZE = '17mm'

/** 旧版 `U` 第 4 参的 `imgStyle` 缺省值（GS:210-212 / PS2:220-222）—— 与三处显式传值**逐字相同**。 */
export const DEFAULT_IMG_STYLE = 'width:100%;display:block;margin:0 auto;object-fit:contain;'

// ------------------------------------------------------------------ //
// 基础工具
// ------------------------------------------------------------------ //

/**
 * HTML 转义（旧版 `D`，GS:182-187 / PS2:191-196）—— 5 个字符，**顺序照抄**（`&` 必须第一个替换）。
 *
 * ⚠️ 只用于**文本**。表头 `label`（GS:597）与图片 `src`（GS:222/298）旧版**都不转义**，
 * 本文件照抄（见 `renderTableHead` / `renderCell` 的注释）。两张单据逐字相同。
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
 * 富文本 → 多行 `<div class="{ns}-line">`（旧版 `A`，GS:188-202 / PS2:197-212）。
 *
 * 共同部分：按 `<br>` / `<br/>`（正则 `/<br\s*\/?>/i`）切开 → 每段 `trim()` → 逐段转义后包 div。
 * **分叉点只有一处**（见 `DocSheetProfile.keepEmptyLines`，§6.1 两边源码对照）：
 *
 * | `keepEmptyLines` | 空段 | 全空输入 |
 * |---|---|---|
 * | `false`（GS2） | `.filter(Boolean)` **丢掉** | 返回 **`""`** |
 * | `true` （PS2） | 保留，出 `<div class="…-line">&nbsp;</div>` | 返回 **1 个占位行**（永不空串） |
 *
 * ⚠️ 这一步决定了 `door`/`basicInfo`/`doorsheet`/`doorframe`/`windows`/`remark` 等列的**行数**，
 * 也就决定了分页高度 —— 打开 `keepEmptyLines` 时**别"顺手"再过滤一遍**。
 */
export function renderMultiline(value: unknown, profile: DocSheetProfile): string {
  const lines = String(value ?? '')
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
  const line = profile.classes.line

  if (!profile.keepEmptyLines) {
    // GS2：丢空段；全空 → 空串（**空 div 不渲染**）
    const kept = lines.filter(Boolean)
    if (kept.length === 0) return ''
    return kept.map((s) => '<div class="' + line + '">' + escapeHtml(s) + '</div>').join('')
  }

  // PS2：**不丢空段**，空段补 `&nbsp;` 占位行。
  // ⚠️ 旧版那层 `o.length === 0 ? "" : …` 在这里是**死分支**（§6.2 CONFIRMED）：
  //    `String(x).split()` 永返回 ≥1 个元素 ⇒ PS2 的 `renderMultiline` **永不可能返回 `""`**。
  //    所以这里直接 map，不加长度判断 —— 加了才是偏离。
  return lines
    .map((s) =>
      s
        ? '<div class="' + line + '">' + escapeHtml(s) + '</div>'
        : '<div class="' + line + '">&nbsp;</div>',
    )
    .join('')
}

/**
 * 单号字幕折行（旧版 `B`，GS:272-282 / PS2:282-292）—— **与 `renderMultiline` 不是一回事**：
 * 这里的 `<br>` 是**字面 `<br>`**（不是 `…-line` div），且每段整段转义。
 *
 * 规则（按 `/` 切分单号）：
 * - ≥3 段：`esc(a[0] + "/" + a[1]) + "<br>" + esc(a.slice(2).join("/"))`
 * - 2 段：`esc(a[0]) + "<br>" + esc(a[1])`
 * - 其它：`esc(全串)`
 *
 * 空串 → `""`（此时调用方连带整个字幕 div 都不渲染）。两张单据逐字相同。
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
 * 带缓存的二维码 provider（旧版 `I` + GS:245-260 的 IIFE；PS2:255-270 同）。
 *
 * 缓存键是 **`text + "::m1"`**（GS:248）—— `m1` 对应 `EncodeHintType.MARGIN = 1`，
 * 即「静默区 1 模块」；旧版把 hint 编进键里，是为了将来换 margin 时缓存不串味。
 * **照抄这个键格式。**
 *
 * 视图盒回退 `"0 0 180 180"`（GS:253）由这里补，编码器只管产出 `{viewBox, inner}`。
 *
 * ⚠️ 失败**不进缓存**（旧版 `catch` 里直接 `return null`，GS:257-259）—— 每次都重试。照抄。
 *
 * ⚠️ **有意做成工厂**（旧版是模块级单例 `k = new y()` + 模块级 `Map`）：
 * 编码器由组件层注入（见 `types.ts` 的 `QrEncoder`）。把缓存和编码器绑在一个实例里，
 * 既保住「同一组件内不重复编码」的旧版行为，又避免多个编码器共用一张缓存表时串味。
 * **每个打印管理器实例建一个即可。**
 *
 * @param fallbackViewBox 库产出取不到 `viewBox` 时的回退值。
 *   C 家族（GS2/PS2）是 **`"0 0 180 180"`**（GS:253，因为旧版 `write(text, 180, 180, …)`）；
 *   **自定义生产单（ic=14）是 `"0 0 200 200"`**（PS:830，旧版 `write(text, 200, 200, …)`）。
 *   ⇒ 这是本函数唯一被参数化的常量（§1 #33 / §8.2 #14）。**默认值保持 `180`，C 家族逐字未动。**
 */
export function createQrSvgProvider(
  encode: QrEncoder,
  fallbackViewBox = '0 0 180 180',
): (text: string) => QrSvg | null {
  const cache = new Map<string, string>() // 旧版 `I`：text::m1 → JSON

  return (text: string): QrSvg | null => {
    if (!text) return null // GS:247

    const key = text + '::m1' // GS:248
    const cached = cache.get(key)
    if (cached !== undefined) return JSON.parse(cached) as QrSvg // GS:249

    try {
      const encoded = encode(text)
      if (!encoded) return null
      // GS:253 —— 库产出的 viewBox 取不到时回退固定视口（C 家族 180，PS 传 200）
      const svg: QrSvg = { viewBox: encoded.viewBox || fallbackViewBox, inner: encoded.inner }
      cache.set(key, JSON.stringify(svg)) // GS:256
      return svg
    } catch {
      return null // GS:257-259 —— 不缓存失败
    }
  }
}

// ------------------------------------------------------------------ //
// 单元格（U，GS:206-307 / PS2:216-327）
// ------------------------------------------------------------------ //

/**
 * 单号文本取值（GS:225-244 / PS2:235-254）：`row.OrderID ?? row.orderID ?? row.qrcode`，全缺 → `""`。
 *
 * ⚠️ 是 **`??`** 不是 `||` —— 空串 `OrderID: ""` **不会**回退到 `qrcode`。
 * 旧版嵌套三元写的，等价于 `??`。照抄。
 */
function orderText(row: DocSheetRow | undefined): string {
  return String(row?.OrderID ?? row?.orderID ?? row?.qrcode ?? '')
}

/**
 * 单元格内容 —— 三种形态，全部由 `profile.cellCases` 路由（旧版 `U` 的 `switch`）。
 *
 * | 形态 | 渲染 | 备注 |
 * |---|---|---|
 * | `multiline` | `renderMultiline(字段)` | 见 `DocSheetProfile.keepEmptyLines` |
 * | `image` | `<img style="…" src="…" />` | 固定 `imgStyle`，**`url` 不转义**；`trim()` 后为空 → 空串 |
 * | `order` | 二维码 + 字幕 | 见下 |
 * | 未登记的 key | — | `""`（旧版 `default` 分支，GS:304-305；读盘多出来的列走这里） |
 *
 * ⚠️ **两张单据的 case 表不同**（§7.1，CONFIRMED）：
 *   · GS2 有 `case "client"`，**没有** `doorframe`/`windows`；
 *   · PS2 删掉 `client`（客户被并进 `door` 列），**新增** `doorframe`（读 `row.doorframe`）
 *     与 `windows`（读 `row.windows`）。
 * 这正是「列集与行来源自洽」的那条结论 —— 别把 PS2 的两列「补」到 GS2 上。
 *
 * ⚠️ 旧版 PS2 的 `windows` 分支外面还包了一层 `String(row.windows ?? '').trim()`
 * （PS2:313-321），**是冗余的**：`renderMultiline` 内部本来就 `String(e ?? '')` 再 `.split().map(trim)`。
 * **行为等价（CONFIRMED，§3.6）**，故新版不照抄这层多余包装 —— 这是**等价的写法简化，不是行为偏离**。
 *
 * @param opts `qrSize` / `imgStyle` / `qr`。旧版这个参数在打印与量测两条链路里**都显式传**
 *             （GS:457-461、559-563 / PS2:483-487、585-589），且值逐字相同。
 */
export function renderCell(
  key: string,
  row: DocSheetRow | undefined,
  opts: RenderOptions,
  profile: DocSheetProfile,
): string {
  const qrSize = opts.qrSize || DEFAULT_QR_SIZE // GS:209
  const imgStyle = opts.imgStyle || DEFAULT_IMG_STYLE // GS:210-212

  const c = profile.cellCases[key]
  if (!c) return '' // GS:304-305 —— 未知 key（读盘多出来的列）走这里

  switch (c.kind) {
    case 'multiline':
      return renderMultiline(row?.[c.field], profile)

    case 'image': {
      // GS:218-223 —— `url` **不转义**（旧版直接拼 `e`），照抄
      const url = String(row?.[c.field] ?? '').trim()
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

/** 可见列（旧版 `p` computed，GS:112-114 / PS2:121-123）。**行、表头、分页、量测全都读它。** */
export function visibleColumns(table: TableConfig): ColumnConfig[] {
  return table.columns.filter((c) => c.visible)
}

// ------------------------------------------------------------------ //
// 明细行（G，GS:538-570 / PS2:564-596）
// ------------------------------------------------------------------ //

/**
 * 一行明细（旧版 `G`，GS:538-570 / PS2:564-596）。
 *
 * ⚠️ 逐字结构：`"\n  <tr>" + 各 td + "</tr>"` —— `<tr>` 前有**一个换行 + 2 空格**，
 * `</tr>` 前**无换行**，所以行与行首尾相接（页面的 `<tbody>` 里逐行拼）。
 *
 * ⚠️ 打印版 `<tr>` **没有 `data-ridx`**（量测版才有，见 `paginate.ts`）。
 * 别把两个版本合并 —— 量测版还有「表头带内联 font-size」这一处不同。
 */
export function renderRow(
  row: DocSheetRow,
  table: TableConfig,
  opts: RenderOptions,
  profile: DocSheetProfile,
): string {
  const cells = visibleColumns(table)
    .map((col) => '<td style="' + cellStyle(col) + '">' + renderCell(col.key, row, opts, profile) + '</td>')
    .join('')
  return '\n  <tr>' + cells + '</tr>'
}

// ------------------------------------------------------------------ //
// 表头（GS:591-600 / PS2:617-626）
// ------------------------------------------------------------------ //

/**
 * 打印版表头单元格（GS:591-600）：`<th style="width:{w}mm">{label}</th>`。
 *
 * ⚠️ **没有内联 `font-size`** —— 表头字号只由 CSS 的 `.{ns}-table th { font-size:{headerFontSize}pt }`
 * 提供（见 `css.ts`）。这与量测版（`paginate.ts` 里带内联 font-size）**不同**，别混。
 *
 * ⚠️ `label` **不转义**（旧版直接拼 `e.label`），照抄。
 * ⚠️ 不依赖 profile —— 这里不吐任何 class。
 */
export function renderTableHead(table: TableConfig): string {
  return visibleColumns(table)
    .map((col) => '<th style="width:' + col.widthMm + 'mm">' + col.label + '</th>')
    .join('')
}

// ------------------------------------------------------------------ //
// 单页（GS:610-622 / PS2:636-648）
// ------------------------------------------------------------------ //

/**
 * 一页（旧版 `j` 的 `u.map(...)` 内联回调，GS:578-623 / PS2:604-649）。
 *
 * @param pageIndex 0 基页号（旧版 `t`）
 * @param pageCount 总页数（旧版 `o`）—— **`> 1` 才渲染页码**（GS:602-609）；
 *                  单页时 `{{pageNum}}` 是空串，会留下连续两个 `\n    `（§3.3）
 */
export function renderPage(
  rows: DocSheetRow[],
  pageIndex: number,
  pageCount: number,
  config: DocSheetConfig,
  opts: RenderOptions,
  profile: DocSheetProfile,
): DocSheetPage {
  const paper = config.paper
  const c = profile.classes
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
  const bodyRows = rows.map((row) => renderRow(row, config.table, opts, profile)).join('') // GS:601
  const pageNum =
    pageCount > 1 ? '<div class="' + c.pageNum + '">' + (pageIndex + 1) + ' / ' + pageCount + '</div>' : '' // GS:602-609

  return (
    '\n  <section class="' +
    c.sheet +
    '" style="' +
    paperStyle +
    '">\n    ' +
    pageNum +
    '\n    <div class="' +
    c.title +
    '">' +
    escapeHtml(config.table.title) + // GS:616 —— 标题**转义**
    '</div>\n    <table class="' +
    c.table +
    '">\n      <thead><tr>' +
    theadCells +
    '</tr></thead>\n      <tbody>' +
    bodyRows +
    '</tbody>\n    </table>\n  </section>'
  )
}

// ------------------------------------------------------------------ //
// 根容器（j，GS:571-667 / PS2:597-693）
// ------------------------------------------------------------------ //

/**
 * 根容器：`<div class="{prefix}-root"><style>{CSS}</style>{各页}</div>`（GS:625-666）。
 *
 * ⚠️ 页与页之间**无分隔符**（旧版 `r` 就是各页 `join("")`）。
 * ⚠️ 旧版 `j` 把「分页」也算在里面（`H`），新版拆开了 —— 分页在 `paginate.ts`，
 * 本函数只收**已经切好页**的 HTML 数组，保持 html.ts 纯函数、可离线比对。
 */
export function buildRootHtml(pages: DocSheetPage[], cssText: string, profile: DocSheetProfile): string {
  return (
    '<div class="' + profile.classes.root + '"><style>' + cssText + '</style>' + pages.join('') + '</div>'
  )
}

/**
 * 完整文档（旧版 `J`，GS:673-681 / PS2:699-707）。
 *
 * ⚠️ **逐字**，无换行、无缩进。`<title>` 是**字面量**（`profile.documentTitle`：
 * 「自定义玻璃合片单」/「自定义生产单2」），**不是** `config.table.title` ——
 * 用户改了标题，浏览器标签页/title 仍是这几个字。照抄。
 */
export function buildDocumentHtml(rootHtml: string, profile: DocSheetProfile): string {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
    profile.documentTitle +
    '</title></head><body>' +
    rootHtml +
    '</body></html>'
  )
}

// ------------------------------------------------------------------ //
// 布局编辑器预览（S，GS:308-360 / PS2:328-380）
// ------------------------------------------------------------------ //

/**
 * 布局编辑器右侧的单页预览（旧版 `S`，GS:308-360 / PS2:328-380）。
 *
 * **这是打印版的一个"散装"变体**，与 `renderPage` 有 4 处不同（§7.4 对照表）：
 * 1. **无 `class`** 的裸 `<table>` + 一段**自带 `<style>`**（`.{ns}-prev-table …`），
 *    而不是靠 `.{ns}-table` 类 + 全局 CSS；
 * 2. `<th>` **有**内联 `font-size`（打印版没有）；
 * 3. `<tr>` **无前导 `\n  `**、无 `data-ridx`；
 * 4. 可见列为 0 时**早退**成「无可见列」占位（打印版没有这个分支）。
 *
 * ⚠️ **第 5 处不同是旧版的 bug，新版已修（有意偏离，§7.4 决策 2）**：
 * 旧版这里的 `qrSize` 是 **`"15mm"`**（GS:340），而量测 `O`（GS:458）与打印 `G`（GS:561）
 * 都是 `"17mm"` ⇒ 编辑器里看到的二维码更矮、换行位置与真实打印对不上。
 * **新版统一 `17mm`** —— 预览、量测、打印三处第一次真正一致。
 *
 * ⚠️ 自带的 `<style>` 用的是 `.{ns}-prev-table` **后代选择器**，但这段 HTML 被塞进
 * `<div class="{ns}-prev-table">` 里（GS:401-405），所以选择器能命中。照抄结构即可。
 * `borderColor` 走的是配置值（与打印版一致），**不是**量测版那个硬编码的 `#444`。
 */
export function renderPreviewTable(
  rows: DocSheetRow[],
  config: DocSheetConfig,
  opts: RenderOptions,
  profile: DocSheetProfile,
): string {
  const prev = profile.classes.prevTable
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
          .map((col) => '<td style="' + cellStyle(col) + '">' + renderCell(col.key, row, opts, profile) + '</td>')
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
    '</tbody>\n    </table>\n    <style>\n      .' +
    prev +
    ' th, .' +
    prev +
    ' td { border:0.2mm solid ' +
    config.table.borderColor +
    '; vertical-align:top; padding:1mm 1.2mm; word-break:break-all; }\n      .' +
    prev +
    ' th { text-align:center; font-weight:600; }\n    </style>'
  )
}
