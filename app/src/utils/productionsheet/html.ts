// 自定义生产单 · HTML 构造器 —— 逐字移植旧版的 `R`/`F`/`$`/`ee`/`te`/`ne` 的片段。
//
// 施工图：`docs/custom-docs-recon/01-ps.md` §4（逐字模板）。
//
// ⚠️ **底座的 `html.ts` 只复用 `escapeHtml` 一件**（§0.1）：
//    本单据没有 `{ns}-line`、没有 `{ns}-table`、没有标题行、没有页码、没有「无可见列」占位；
//    表格走**全内联样式**。`renderMultiline`/`renderCell`/`renderRow`/`renderPage`/
//    `buildRootHtml`/`renderPreviewTable` **一个都用不上**。
//
// ⚠️ **产出 HTML 的 class 只有 `ps-root` / `ps-sheet`**（§0.3 全文枚举 CONFIRMED）：
//    `grep -c "ps2-\|gs2-\|page-num"` = **0**。别套底座那套 `ns + '-xxx'` 推导。

import { escapeHtml } from '../docsheet/html'
import { PS_CLASSES, PS_DOCUMENT_TITLE } from './profile'
import { productionSheetCss } from './css'
import type {
  ProductionSheetCell,
  ProductionSheetConfig,
  ProductionSheetRenderOptions,
  ProductionSheetRow,
  TableColumn,
} from './types'

export { escapeHtml }

/**
 * `<br>` 分段正则（`PS:930` / `PS:1256` / `PS:1101`，**三处逐字相同**）。
 *
 * TODO(未确认): **旧版缺 `i` 标志**（底座的对应正则是 `/<br\s*\/?>/i`，见 `docsheet/html.ts`）
 * ⇒ 旧版遇大写 `<BR>` **不切行**（§9.3）。数据里会不会出现大写 `Hui` 侧一律写小写 `<br>`，
 * 报告建议**照抄不加 `i`** —— 这里照抄，并留下这条注记。
 */
export const BR_SPLIT_RE = /<br\s*\/?>/

/** 可见列（`PS:895` / `PS:1072` / `PS:1145` / `PS:1222` / `PS:1283` 都用的 `filter(e => e.visible)`）。 */
export function visibleTableColumns(config: ProductionSheetConfig): TableColumn[] {
  return config.tableConfig.columns.filter((c) => c.visible)
}

/** 可见列合计宽 mm（`PS:900` / `PS:1147` / `PS:1283`）。 */
export function visibleTableWidthMm(config: ProductionSheetConfig): number {
  return visibleTableColumns(config).reduce((sum, c) => sum + c.width, 0)
}

// ------------------------------------------------------------------ //
// 取值 `R`（PS:788-809）
// ------------------------------------------------------------------ //

/**
 * 头部字段取值（旧版 `R`，`PS:788-809`）—— **只给 `headerFields` 用**。
 *
 * ⚠️ **`qrcode` 的键名是 `orderID`（小写 d）**（`PS:791-802`），与 C 家族的
 * `row.OrderID ?? row.orderID ?? row.qrcode`（大写 O 优先，`docsheet/html.ts:170-172`）**不同**。
 * PS 的 `calculateReceiptOld` 产出的正是 **`orderID`（小写）**（§6.4）——
 * **别照抄底座的 `orderText()`**，否则二维码会画不出来。
 *
 * ⚠️ `size` 的分支（`PS:803-808`）是为**多行文本字段** `size` 准备的：
 * 旧版 `calculateReceiptOld` 的 `size` 是**数组**，新版数据层 `oldSheetSize()` 已返回
 * `join(',')` 的字符串（`printPayloads.ts:1391`）—— `Array.isArray ? join(",") : String`
 * **两种情况都能过**（§2.6）。这里保留数组分支，与旧版逐字一致。
 *
 * ⚠️ 用的是 `??` 语义（旧版嵌套三元 `null != x ? x : ""`）—— 空串**不会**回退到下一个候选。
 */
export function readFieldValue(row: ProductionSheetRow | undefined, key: string): string {
  if (key === 'qrcode') return String(row?.orderID ?? row?.qrcode ?? '') // PS:792-802
  if (key === 'size') {
    const value = row?.size // PS:804
    return Array.isArray(value) ? value.join(',') : String(value ?? '') // PS:805-807
  }
  return String(row?.[key] ?? '') // PS:809
}

// ------------------------------------------------------------------ //
// 头部字段 `F`（PS:811-889）
// ------------------------------------------------------------------ //

/**
 * 渲染全部可见头部字段（旧版 `F`，`PS:811-889`）。
 *
 * **丢弃规则**（`PS:818-819`）：`if (!value && key !== "remark" && key !== "address") return ""`
 * —— ★ **`remark` 与 `address` 即使取值为空也会渲染**（只剩前缀）；其余 10 个字段值为空则整块不渲染。
 *
 * 三条分支：
 *   · `qrcode`（`PS:820-858`）—— `<svg>`，**方形**（`height` = `width`），尺寸单位 **mm**
 *     且值就是字段的 `width`（默认 18mm）。**没有字幕、也没有 0.5mm 下边距**
 *     （底座的 QR 是固定 17mm + 居中字幕，`docsheet/html.ts:224-238`）。编码失败 → 整块 `""`。
 *   · `lockImg`（`PS:859-870`）—— `<img>`，`height:auto`（不是固定高）。
 *   · 其余（`PS:871-886`）—— `<div style="…">{prefix}{escaped}</div>`。
 *
 * ⚠️ **`prefix` 与 `fontFamily` 都不转义**（`PS:871` / `PS:878` 直接拼），**只有值走 `escapeHtml`**。
 *    旧版就是这么写的，别「顺手补一个转义」，产物会不等。
 *
 * 最后 `filter(Boolean).join("")`（`PS:888-889`）—— **先 map 再 filter 再 join**，空串被丢掉。
 */
export function renderHeaderFields(
  row: ProductionSheetRow | undefined,
  config: ProductionSheetConfig,
  opts: ProductionSheetRenderOptions = {},
): string {
  const qrSvg = opts.qrSvg ?? null

  return config.headerFields
    .filter((f) => f.visible) // PS:814
    .map((f) => {
      const value = readFieldValue(row, f.key) // PS:817
      if (!value && f.key !== 'remark' && f.key !== 'address') return '' // PS:818-819

      if (f.key === 'qrcode') {
        // PS:820-858 —— 编码失败（provider 返回 null）→ 整块空串
        const svg = qrSvg ? qrSvg(value) : null
        if (!svg) return '' // PS:838
        const style =
          'position:absolute;left:' +
          f.x +
          'mm;top:' +
          f.y +
          'mm;width:' +
          f.width +
          'mm;height:' +
          f.width + // ★ height = width（正方形）
          'mm;display:block;'
        return (
          '<svg style="' +
          style +
          '" viewBox="' +
          svg.viewBox + // PS:853 —— viewBox 不转义
          '" preserveAspectRatio="xMidYMid meet">' +
          svg.inner +
          '</svg>'
        )
      }

      if (f.key === 'lockImg') {
        if (!value) return '' // PS:860
        const style =
          'position:absolute;left:' +
          f.x +
          'mm;top:' +
          f.y +
          'mm;width:' +
          f.width +
          'mm;height:auto;'
        // ★ `src` **不转义**（`PS:869`）；`height:auto` 不是固定高
        return '<img src="' + value + '" style="' + style + '" />'
      }

      const inner = f.prefix + escapeHtml(value) // PS:871 —— ★ prefix 不转义
      const style = [
        'position:absolute',
        'left:' + f.x + 'mm',
        'top:' + f.y + 'mm',
        'width:' + f.width + 'mm',
        'font-size:' + f.fontSize + 'pt',
        // ★ 单引号 + 固定后缀 `, sans-serif`；fontFamily 不转义（PS:878）
        "font-family:'" + f.fontFamily + "', sans-serif",
        'color:' + f.fontColor,
        'font-weight:' + f.fontWeight,
        f.wrap
          ? 'white-space:normal;word-break:break-all'
          : 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
        'line-height:' + f.lineHeight,
        // PS:885 —— `array.join(";")`，尾项无分号
      ].join(';')
      return '<div style="' + style + '">' + inner + '</div>' // PS:886
    })
    .filter(Boolean) // PS:888
    .join('')
}

// ------------------------------------------------------------------ //
// 表格 `$`（PS:891-983）
// ------------------------------------------------------------------ //

/**
 * 渲染表格（旧版 `$`，`PS:891-983`）。
 *
 * **前提**：`rows` 非空数组且**可见列 > 0**，否则返回 `""`（`PS:894-896`）。
 * ★ **没有「无可见列」占位**（C 家族有，§4.5）—— 直接空串。
 *
 * ⚠️ **`<th>` 的边框硬编码 `1px solid #000`，不读 `showBodyBorder`**（`PS:910` CONFIRMED）——
 *    关掉「外边框」，表头**仍有框**。只有 `<td>` 读它（`PS:897-899`）。
 *
 * ⚠️ 单元格读的是 `row[key]` **原始值**，**不走 `readFieldValue()`**（`PS:919-921`）——
 *    所以 `size`/`qrcode` 的特例只在头部字段生效。默认 4 列都不受影响。
 *
 * ⚠️ `<tr>` 是 `"<tr>" + tds + "</tr>"`，**无换行、无缩进**（`PS:917`/`PS:981`）
 *    —— 与底座的 `"\n  <tr>…</tr>"` 不同，逐字节比对会挂。
 *
 * @param cellHeightMm `doorImg` 那格的高度 mm（旧版第 3 参 `o = 0`）。**首页与后续页传的值不同**
 *   （`PS:1281` 的 `Math.max(10, (首页 ? g : y) - 6)`，§5.3）。`<= 0` 或该格无图 → 不写 `height`
 *   （`PS:968` 的 `o > 0 && u`）。
 */
export function renderTable(
  rows: ProductionSheetCell[],
  config: ProductionSheetConfig,
  cellHeightMm = 0,
): string {
  if (!Array.isArray(rows) || rows.length === 0) return '' // PS:894
  const cols = visibleTableColumns(config)
  if (cols.length === 0) return '' // PS:896

  const rowHeight = config.tableConfig.rowHeight // px
  // PS:897-899 —— ★ 只作用于 `<td>`
  const border = config.tableConfig.showBodyBorder ? 'border:1px solid #000;' : 'border:none;'
  const totalWidth = cols.reduce((sum, c) => sum + c.width, 0) // PS:900

  let html =
    '<table style="width:' +
    totalWidth +
    'mm;border-collapse:collapse;table-layout:fixed;margin-top:2mm;font-size:' +
    config.tableConfig.tableFontSize +
    'pt;">' // PS:901-906

  html += '<thead><tr>' // PS:907
  for (const col of cols) {
    // PS:909-914 —— ★ 边框硬编码，不读 showBodyBorder；label 转义
    html +=
      '<th style="border:1px solid #000;padding:2px 4px;text-align:center;width:' +
      col.width +
      'mm;box-sizing:border-box;">' +
      escapeHtml(col.label) +
      '</th>'
  }
  html += '</tr></thead>' // PS:915
  html += '<tbody>' // PS:915

  for (const cell of rows) {
    html += '<tr>' // PS:917
    for (const col of cols) {
      const raw = String(cell?.[col.key] ?? '') // PS:919-921
      let inner = '' // PS:922

      if (col.key === 'doorImg') {
        if (raw) {
          // PS:923-928 —— ★ src 不转义
          inner =
            '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="' +
            raw +
            '" style="height:100%;width:auto;max-width:100%;display:block;object-fit:contain;" /></div>'
        }
      } else {
        // PS:929-956 —— 按 `<br>` 切段
        const segments = raw.split(BR_SPLIT_RE) // PS:930
        // PS:931-936 —— ★ 空段**多一个 `min-height`**（非空段没有）
        const emptyStyle = 'line-height:' + rowHeight + 'px;min-height:' + rowHeight + 'px;'
        inner = segments
          .map((segment) => {
            const text = segment.trim() // PS:940
            if (text) {
              return config.tableConfig.underlineBrElements
                ? '<div style="text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:1px;line-height:' +
                    rowHeight +
                    'px;">' +
                    escapeHtml(text) +
                    '</div>' // PS:943-947
                : '<div style="line-height:' +
                    rowHeight +
                    'px;">' +
                    escapeHtml(text) +
                    '</div>' // PS:948-952
            }
            // PS:953 —— ★ 空段**永远保留**（等价于底座 `keepEmptyLines: true`）
            return '<div style="' + emptyStyle + '">&nbsp;</div>'
          })
          .join('')
      }

      const padding = col.key === 'doorImg' ? 'padding:0;' : 'padding:1px 4px;' // PS:957-958
      const style =
        col.key === 'doorImg'
          ? border +
            padding +
            'position:relative;vertical-align:middle;text-align:center;width:' +
            col.width +
            'mm;box-sizing:border-box;overflow:hidden;' +
            (cellHeightMm > 0 && raw ? 'height:' + cellHeightMm + 'mm;' : '') // PS:960-968
          : border +
            padding +
            'vertical-align:top;line-height:' +
            rowHeight +
            'px;width:' +
            col.width +
            'mm;box-sizing:border-box;' // PS:969-976
      html += '<td style="' + style + '">' + inner + '</td>'
    }
    html += '</tr>' // PS:981
  }

  html += '</tbody></table>' // PS:983
  return html
}

// ------------------------------------------------------------------ //
// 门图框 `ee`（PS:985-1013）
// ------------------------------------------------------------------ //

/**
 * 渲染门图框（旧版 `ee`，`PS:985-1013`）—— `enabled` 假 → `""`。
 *
 * url 是**两级回退**：`row.doorImg || row.oldSheet?.[0]?.doorImg || ""`（`PS:989-996`）。
 *
 * ⚠️ **虚线框 `border:1px dashed #333` 会真的打印出来**（`PS:1004`）——
 *    它不是编辑器辅助线。旧版就是这样，照抄。
 * ⚠️ `src` **不转义**；有图才出 `<img>`，无图 → 空内容但**框还在**。
 */
export function renderDoorImgBox(
  row: ProductionSheetRow | undefined,
  config: ProductionSheetConfig,
): string {
  if (!config.doorImgBox.enabled) return '' // PS:988

  const url = row?.doorImg || row?.oldSheet?.[0]?.doorImg || '' // PS:989-996
  const box = config.doorImgBox
  const style = [
    'position:absolute',
    'left:' + box.x + 'mm',
    'top:' + box.y + 'mm',
    'width:' + box.width + 'mm',
    'height:' + box.height + 'mm',
    'border:1px dashed #333',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'overflow:hidden',
    // PS:1009 —— `array.join(";")`，尾项无分号
  ].join(';')

  const img = url ? '<img src="' + url + '" style="max-width:100%;max-height:100%;" />' : '' // PS:1010-1012
  return '<div style="' + style + '">' + img + '</div>'
}

// ------------------------------------------------------------------ //
// 按后缀拆键 `te`（PS:1015-1022）
// ------------------------------------------------------------------ //

/**
 * 只保留**以 `suffix` 结尾**的键，并**剥掉后缀**（旧版 `te`，`PS:1015-1022`）。
 * `itemsPerPage === 2` 的上下联拆分专用（§5.4）。
 *
 * ★ **`if ("" === suffix) return e` 这条 guard 是必须的** —— 旧版 `slice(0, -0)`
 *   会把**每一个键都变成空串**（`slice(0, -0)` = `slice(0, 0)` = `""`）。
 *   漏了它，上半联的整行键全没了。**照抄这条 guard。**
 *
 * 非对象 / `null` → `{}`（`PS:1019`）。
 */
export function skipBySuffix(
  row: ProductionSheetRow | undefined,
  suffix: string,
): ProductionSheetRow {
  if (suffix === '') return (row ?? {}) as ProductionSheetRow // PS:1017 —— ★ guard
  const out: Record<string, unknown> = {}
  if (!row || typeof row !== 'object') return out as ProductionSheetRow // PS:1019
  for (const key of Object.keys(row)) {
    if (key.endsWith(suffix)) out[key.slice(0, -suffix.length)] = row[key] // PS:1021
  }
  return out as ProductionSheetRow
}

// ------------------------------------------------------------------ //
// 页容器 `sheetStyle`（PS:1048-1062）/ 根容器（PS:1319-1321）
// ------------------------------------------------------------------ //

/**
 * `<section class="ps-sheet" style="…">` 的样式（`PS:1048-1062`）。
 *
 * 默认值代入后**逐字**为（§4.1）：
 * ```
 * width:210mm;height:148mm;padding:5mm;position:relative;box-sizing:border-box;background:#fff;color:#000;overflow:hidden;page-break-after:always;font-family:'Microsoft YaHei', sans-serif;font-size:19pt
 * ```
 *
 * ⚠️ **顺序即数组顺序，别重排**；`font-family` 的引号是**单引号**（`PS:1058-1060`）。
 * ⚠️ `page-break-after:always` 是**内联**的 —— PS 的 `@media print` 里**没有** `break-after`
 *    （与底座不同，§4.2 / §9.7）。
 */
export function buildSheetStyle(config: ProductionSheetConfig): string {
  const paper = config.paper
  return [
    'width:' + paper.widthMm + 'mm',
    'height:' + paper.heightMm + 'mm',
    'padding:' + paper.paddingMm + 'mm',
    'position:relative',
    'box-sizing:border-box',
    'background:#fff',
    'color:#000',
    'overflow:hidden',
    'page-break-after:always',
    "font-family:'" + config.globalHeaderFont.fontFamily + "', sans-serif",
    'font-size:' + config.globalHeaderFont.fontSize + 'pt',
  ].join(';')
}

/**
 * 根容器（`PS:1319-1321`）：`<div class="ps-root"><style>{CSS}</style>{各 section}</div>`。
 *
 * ⚠️ CSS **又拼了一份在这里**（`oe` 内部自拼），与 `buildProductionSheetDocument`
 * 的 head `<style>` **合起来出现两次**（`PS:1330` 调 `oe()`、`PS:1320` 里 `oe` 自己拼）——
 * 这是旧版事实，**照抄**（§4.3 CONFIRMED）。
 *
 * ⚠️ `rows` 为空数组时 `sheetsHtml` 是 `""` ⇒ **一个 `<section>` 都不产出**
 * （`PS:1043-1318` 的 `n.map(...).join("")`）—— 与底座「空数据 → `[[]]` → 渲染 1 个空页」
 * **不同**（§4.1）。
 */
export function buildRootHtml(sheetsHtml: string, config: ProductionSheetConfig): string {
  return (
    '<div class="' +
    PS_CLASSES.root +
    '"><style>' +
    productionSheetCss(config) +
    '</style>' +
    sheetsHtml +
    '</div>'
  )
}

/**
 * 完整文档（旧版 `ne`，`PS:1327-1338`）。
 *
 * ★ **比底座多一段 head `<style>`**（§4.3）：
 * 底座 `buildDocumentHtml` 只有 `<title>`，PS 的 head 里是
 * `html,body{margin:0;padding:0;background:#fff;}` + `productionSheetCss(config)`。
 * 这正是 §8.2 #15 要把「文档构造」参数化的原因（骨架复用、文档构造分叉）。
 *
 * 逐字（注意两处 `\n` 的位置）：
 * ```
 * <!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义生产单</title>\n  <style>…</style>\n  </head><body>{rootHtml}</body></html>
 * ```
 */
export function buildDocumentHtml(rootHtml: string, config: ProductionSheetConfig): string {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
    PS_DOCUMENT_TITLE +
    '</title>\n  <style>html,body{margin:0;padding:0;background:#fff;}' +
    productionSheetCss(config) +
    '</style>\n  </head><body>' +
    rootHtml +
    '</body></html>'
  )
}
