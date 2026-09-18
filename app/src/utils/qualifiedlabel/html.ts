// 自定义合格标签 · HTML 构造器 —— 逐字移植旧版 `Q`（字段）/ `ae`（全部标签）/ `de`（完整文档）。
//
// 验收夹具（§4.1 / §10.4）：
//   · `docs/custom-docs-recon/ql-sample.html`   —— `ae()` 的产物（两条样本行，5619 字符）
//   · `docs/custom-docs-recon/ql-document.html` —— `de()` 的全文档（6636 字符）
//   两份都由 `ql-htmlcheck.mjs` 逐字节比对。
//
// ⚠️ **底座的 `html.ts` 只有 `escapeHtml` 能用**（§0.1）：`renderMultiline` / `renderCell` /
//    `renderRow` / `renderPage` / `renderTableHead` / `buildRootHtml` / `buildDocumentHtml`
//    在本单**零复用** —— 本单没有表格、没有标题/页码、没有「无可见列」占位、没有分页。
//
// ★★ **最容易搞混的一处：本单不认 `<br>`**（§4.2 / §0.1 的特别提醒）。
//    文本字段的值**整串转义**（连 `<br>` 一起），所以 `备注:加急<br>加配:X` 会**逐字**显示
//    `<br>` —— 样例夹具里可见 `&lt;br&gt;`。底座 `renderMultiline` 那套「按 `<br>` 切行」
//    **在本单是错的**，千万别为了「统一」把它接进来。
//
// ⚠️ **`ae()` 是 `async` 但全文 0 个 `await`**（CONFIRMED，`QL:719-766`）—— 返回 Promise
//    只是为了让 `ne` 能 `await`。新版这里是**纯同步函数**（`buildQualifiedLabelHtml`），
//    组件层要 `await` 就 `await` 一个同步值，语义不变、少一层微任务。
//
// ⚠️ **本单没有分页**（§5.1）：一次产出**全部**标签，`page-break-after:always` 在内联样式里、
//    由 CSS 的 `.qlabel:last-child` 取消。**不要**引入底座的 `paginate` / 量测 / 行高预算。

import { escapeHtml } from '../docsheet/html'
import { QL_CLASSES, QL_DATA_ATTR, QL_DOCUMENT_TITLE, QL_EMPTY_QR_VIEW_BOX } from './profile'
import { qualifiedLabelCss } from './css'
import { readFieldValue, stripLabelPrefix } from './fieldAliases'
import type { LabelField, LabelRow, QualifiedLabelConfig } from './types'
import type { QrSvg } from '../docsheet/types'

/** 底座的 `escapeHtml` **逐字相同**（`QL:625-630` 与 GS:182-187 / PS2:191-196 的 5 条 `replace` 一致）
 *  —— 施工图 §0.1 判定「可原样用的四处」之一，直接转出。 */
export { escapeHtml }

/** 二维码 provider：文本 → `{viewBox, inner}`，失败/空 → `null`（见 `qr.ts`）。 */
export type QrProvider = (text: string) => QrSvg | null

/** 渲染选项。本单**只有二维码**一项可注入（没有底座的 `qrSize`/`imgStyle`）。 */
export interface QualifiedLabelRenderOptions {
  /** 留空 → 二维码字段**只画占位/不画**（等价于旧版编码器抛错，§4.2 分支 A）。 */
  qr?: QrProvider | null
}

/** 可见字段全部渲染成空串时的兜底占位（`QL:748-752`，串表 312）。**内联样式，无 class**。 */
const EMPTY_LABEL_PLACEHOLDER =
  '<div style="position:absolute;left:2mm;top:2mm;font-size:8pt;color:#666;">无可显示字段</div>'

/**
 * 全局字体族进 HTML 前的引号替换（`QL:732`）：`"` → `'`。
 *
 * ★ 默认值 `"Microsoft YaHei", sans-serif` 进产物后变成 `'Microsoft YaHei', sans-serif`
 *   （样例夹具里逐字可见）。**照抄**，别"顺手"保留原引号 —— 外层 `style="…"` 是双引号，
 *   不换会**截断整个 style 属性**（旧版这行不是为了好看，是必需的）。
 */
function quoteFontFamily(fontFamily: string): string {
  return fontFamily.replace(/"/g, "'")
}

/**
 * 一个字段的 HTML（旧版 `Q`，`QL:526-631`）—— **三个分支**（§4.2）。
 *
 * 共同前置：
 * ```
 * raw = 按别名表取行上的第一个非 undefined/非 null 的值（fieldAliases.readFieldValue）
 * n   = 剥掉开头的 "label:" / "label："（半角与全角都剥）
 * ```
 *
 * | 分支 | 条件 | 产物 |
 * |---|---|---|
 * | **A 二维码** | `field.key === 'qrcode'` | 见下 |
 * | **B 文本** | 其余一切（含未知 key） | `<div class="qfield qfield-text" …>` |
 *
 * **分支 A 的三条路**（`QL:548-595`）：
 * 1. `n` 为**空** → `<svg … viewBox="0 0 1 1"></svg>` **空占位**（仍占满 `width×width` 的框，
 *    ★ **不受 `autoHideEmpty` 影响**）；
 * 2. 编码成功 → 带 `viewBox` + `preserveAspectRatio="xMidYMid meet"` 的真 SVG；
 * 3. 编码失败（provider 返回 `null`）→ **`""`，整个二维码字段消失**（★ **没有任何兜底占位**）。
 *
 * ⚠️ 分支 A 的宽高**都取 `field.width`**（`QL:549`）—— 与 `field.height` **无关**。
 *
 * **分支 B 的样式**（`QL:599-618`）—— 注意 `filter(Boolean)` 会丢掉空串项，且
 * `wrap` 的**三条互斥样式**（`white-space`/`word-break`|`overflow`/`text-overflow`|`line-clamp`）：
 * ```
 * wrap=true  → white-space:normal; word-break:break-all; display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:{maxLines};overflow:hidden
 * wrap=false → white-space:nowrap; overflow:hidden; text-overflow:ellipsis
 * ```
 * 末尾恒有 `line-height:{globalFont.lineHeight}` —— ★ 这是 `globalFont` 里**唯一**
 * 直接落到每个字段上的键（§2.5）。
 *
 * ⚠️ **`field.height` 完全不进 style**（§2.3）：文本高度由内容 + `line-height` 决定，
 * `wrap=false` 时靠 `overflow:hidden` 截断。
 */
export function renderField(
  field: LabelField,
  row: LabelRow | undefined | null,
  config: QualifiedLabelConfig,
  qr?: QrProvider | null,
): string {
  const raw = readFieldValue(row, field.key) // `QL:535-545`
  const value = stripLabelPrefix(raw, field.label) // `QL:528-534`

  if (field.key === 'qrcode') {
    // `QL:548-559` —— 宽高都用 field.width（`t`），与 field.height 无关
    const size = field.width
    const style =
      'position:absolute;left:' +
      field.x +
      'mm;top:' +
      field.y +
      'mm;width:' +
      size +
      'mm;height:' +
      size +
      'mm;display:block;overflow:hidden;'
    const svgAttrs = ' class="' + QL_CLASSES.field + ' ' + QL_CLASSES.fieldQr + '" data-key="' + field.key + '"'

    // `QL:560-567` —— 空值 → **空占位**（★ 在 autoHideEmpty 判断之前，二维码不受它影响）
    if (!value) return '<svg' + svgAttrs + ' style="' + style + '" viewBox="' + QL_EMPTY_QR_VIEW_BOX + '"></svg>'

    // `QL:568-584` —— 编码（缓存与回退 viewBox 在 provider 里，见 `qr.ts`）
    const svg = qr ? qr(value) : null
    // `QL:585-595` —— 失败 → 空串，整个字段消失（**没有兜底占位**）
    return svg
      ? '<svg' +
          svgAttrs +
          ' style="' +
          style +
          '" viewBox="' +
          svg.viewBox +
          '" preserveAspectRatio="xMidYMid meet">' +
          svg.inner +
          '</svg>'
      : ''
  }

  // `QL:597` —— ★ 空值 + 开关 → 整字段消失。**只有文本分支有这一行**。
  if (!value && config.autoHideEmpty) return ''

  // `QL:598` —— 前缀恒**半角**冒号；`label` 为空串时也不拼（旧版是 `e.showPrefix && e.label` 真值判断）
  const text = field.showPrefix && field.label ? field.label + ':' + value : value

  // `QL:599-618` —— 顺序即字符串顺序，**别重排**（尾项无分号，靠 join 补）
  const style = [
    'position:absolute',
    'left:' + field.x + 'mm',
    'top:' + field.y + 'mm',
    'width:' + field.width + 'mm',
    'font-size:' + field.fontSize + 'pt',
    'font-weight:' + field.fontWeight,
    'text-align:' + (field.textAlign || 'left'),
    field.wrap ? 'white-space:normal' : 'white-space:nowrap',
    field.wrap ? 'word-break:break-all' : 'overflow:hidden',
    field.wrap ? '' : 'text-overflow:ellipsis',
    field.wrap
      ? 'display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:' +
        field.maxLines +
        ';overflow:hidden'
      : '',
    'line-height:' + config.globalFont.lineHeight,
  ]
    .filter(Boolean)
    .join(';')

  // `QL:619-631` —— ★ 整串转义（`<br>` 会被逐字显示，见文件头）
  return (
    '<div class="' +
    QL_CLASSES.field +
    ' ' +
    QL_CLASSES.fieldText +
    '" data-key="' +
    field.key +
    '" style="' +
    style +
    '">' +
    escapeHtml(text) +
    '</div>'
  )
}

/**
 * 一张标签（旧版 `ae` 内层的 `(e, t)` 映射回调，`QL:726-760`）。
 *
 * ```
 * <section class="qlabel" data-qlabel style="{纸张+全局字体 13 项; join}">{可见字段串接 || 兜底占位}</section>
 * ```
 *
 * ⚠️ `<section>` 的样式**顺序照抄**（`QL:731-745`）：纸张 3 项 → 全局字体 3 项 → 定位 5 项 →
 *     `page-break-after:always` 收尾。注意其中**没有 `field` 的任何东西** —— 字段全是绝对定位。
 *
 * ⚠️ 可见字段 = `fields.filter(f => f.visible).map(renderField).filter(Boolean).join("")`，
 *    结果为空串才用占位（`QL:746-752` 的 `||`）。
 */
export function renderLabel(
  row: LabelRow | undefined | null,
  config: QualifiedLabelConfig,
  qr?: QrProvider | null,
): string {
  const paper = config.paper
  const font = config.globalFont

  const paperStyle = [
    'width:' + paper.widthMm + 'mm',
    'height:' + paper.heightMm + 'mm',
    'padding:' + paper.paddingMm + 'mm',
    'font-family:' + quoteFontFamily(font.fontFamily),
    'font-size:' + font.fontSize + 'pt',
    'font-weight:' + font.fontWeight,
    'line-height:' + font.lineHeight,
    'position:relative',
    'box-sizing:border-box',
    'background:#fff',
    'color:#000',
    'overflow:hidden',
    'page-break-after:always',
  ].join(';')

  const fieldsHtml =
    config.fields
      .filter((f) => f.visible) // `QL:748`
      .map((f) => renderField(f, row, config, qr)) // `QL:749`
      .filter(Boolean) // `QL:750` —— 空串字段（隐藏/编码失败）不占位
      .join('') || EMPTY_LABEL_PLACEHOLDER // `QL:751-752`

  return (
    '<section class="' +
    QL_CLASSES.label +
    '" ' +
    QL_DATA_ATTR +
    ' style="' +
    paperStyle +
    '">' +
    fieldsHtml +
    '</section>'
  )
}

/**
 * 全部标签的根容器（旧版 `ae`，`QL:719-766`）—— **一次产出所有标签，没有分页**。
 *
 * ```
 * <div class="qlabel-root"><style>{CSS}</style>{每张 <section> 串接}</div>
 * ```
 *
 * ⚠️ 页与页之间、`</style>` 与第一个 `<section>` 之间**没有任何分隔符**（旧版就是 `join("")`）。
 * ⚠️ `CSS` 的**首尾各有一个 `\n`**（见 `css.ts`），所以 `<style>` 后面紧跟着换行。
 *
 * @param rows 行数据。**非数组 → 空数组**（等价于旧版 `Array.isArray(e) ? e : getLabels() || []`
 *             里「传进来的不是数组」那条；新版由组件层负责取 `getLabels`）。
 */
export function buildQualifiedLabelHtml(
  rows: readonly LabelRow[] | undefined | null,
  config: QualifiedLabelConfig,
  opts: QualifiedLabelRenderOptions = {},
): string {
  const list = Array.isArray(rows) ? rows : []
  const qr = opts.qr ?? null
  const sections = list.map((row) => renderLabel(row, config, qr)).join('')
  return (
    '<div class="' +
    QL_CLASSES.root +
    '"><style>' +
    qualifiedLabelCss(config) +
    '</style>' +
    sections +
    '</div>'
  )
}

/**
 * 完整文档（旧版 `de`，`QL:859-869`）。
 *
 * ```js
 * '<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义合格标签</title>\n' +
 * '  <style>html,body{margin:0;padding:0;background:#fff;}' + R(o) + '</style>\n' +
 * '  </head><body>' + a + '</body></html>'
 * ```
 *
 * ⚠️ ★ **head 里多一段 `<style>`**（`html,body` 重置 + 同一份 `R`）—— 底座的
 *    `buildDocumentHtml` **没有**这段（§0.1 判定本函数是「PARAM：文档模板」）。
 *    ⇒ 文档里 CSS 出现**两次**（head 一次、`ae` 产物里的 `.qlabel-root > style` 一次）。
 *    **照抄**，夹具 `ql-document.html` 就是两份。
 *
 * ⚠️ `<title>` 恒为 `自定义合格标签`（`QL_DOCUMENT_TITLE`），**与三个入口无关**（§6.1）。
 * ⚠️ `de(e)` 的参数是**可选的行数组**：`printDirect` 传空（→ 回落 `getLabels()`），
 *    `printSilent` **逐张传 `[单条]`** ⇒ 静默打印时每张标签是一个**独立文档**（`@page` 只放一张）。
 *    新版不做 `printSilent`，但 `printQualifiedLabelDirect` 支持传子集。
 */
export function buildQualifiedLabelDocument(
  rows: readonly LabelRow[] | undefined | null,
  config: QualifiedLabelConfig,
  opts: QualifiedLabelRenderOptions = {},
): string {
  const rootHtml = buildQualifiedLabelHtml(rows, config, opts)
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
    QL_DOCUMENT_TITLE +
    '</title>\n  <style>html,body{margin:0;padding:0;background:#fff;}' +
    qualifiedLabelCss(config) +
    '</style>\n  </head><body>' +
    rootHtml +
    '</body></html>'
  )
}
