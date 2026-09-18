// 自定义生产单 · 默认配置 `a()`（`PS:33-243`）+ 7 个纸张预设 `L`（`PS:548-553`）+ 全部 UI 范围（§3.2）。
//
// 施工图：`docs/custom-docs-recon/01-ps.md` §2.1 / §2.5 / §3.2。

import type {
  HeaderField,
  PaperOrientation,
  ProductionSheetConfig,
  TableColumn,
} from './types'

/**
 * 头部字段的公共默认项。
 *
 * 12 条里只有 `material`（红色）与 `address`/`remark`（换行）破例 —— 其余全是这一组，
 * 与 `PS:46-227` 逐字段核对一致。**`fontFamily` 12 条全同**（`Microsoft YaHei`）。
 */
const FIELD_FONT_FAMILY = 'Microsoft YaHei'
const FIELD_FONT_SIZE_DEFAULT = 15
const FIELD_FONT_COLOR_DEFAULT = '#000000'
const FIELD_FONT_WEIGHT_DEFAULT = 'normal'
const FIELD_LINE_HEIGHT_DEFAULT = 1.4

/**
 * 造一条头部字段，把「12 条里相同的那些」收在一处。
 *
 * ⚠️ 与旧版逐字等价：旧版每条都把这 12 个键写全（`PS:46-227`），
 * 这里只是把**相同的那 6 个**提成默认值，取值一个不差。
 */
function field(
  key: string,
  label: string,
  prefix: string,
  x: number,
  y: number,
  width: number,
  over: Partial<HeaderField> = {},
): HeaderField {
  return {
    key,
    label,
    prefix,
    visible: true,
    x,
    y,
    width,
    fontSize: FIELD_FONT_SIZE_DEFAULT,
    fontFamily: FIELD_FONT_FAMILY,
    fontColor: FIELD_FONT_COLOR_DEFAULT,
    fontWeight: FIELD_FONT_WEIGHT_DEFAULT,
    wrap: false,
    lineHeight: FIELD_LINE_HEIGHT_DEFAULT,
    ...over,
  }
}

/**
 * 12 条默认头部字段（`PS:46-227`，顺序即数组顺序）。
 *
 * ★ **顺序永远是这个顺序** —— `normalize()` 以本表为主干遍历（`PS:445-483`），
 *   存盘里的顺序、多出的 key 一概无效（§2.4）。用户拖不出顺序，也存不住。
 *
 * ⚠️ 与 `Hui` 的 `calculateReceiptOld()` 行键**逐一对应**（CONFIRMED，§2.2）——
 * 包括最不起眼的 `maker`（制单）与 `lockway`（开向），**这两个键只有 ic=14 这条口径有**。
 *
 * ⚠️ 三条「错位」是旧版事实，别"修正"：
 *   · `glass` 的 `y` 是 **10.5**（不是 10，与同排的 `color` 差 0.5）；
 *   · `maker` 在 **(164.5, 36)** —— 单独落在右下角，不与任何字段同排；
 *   · `lockImg`/`qrcode` 的 `prefix` 是**空串**，字号 **11**（其余都是 15）。
 */
export function createDefaultHeaderFields(): HeaderField[] {
  return [
    field('material', '型材', '型材：', 5, 3.5, 75, { fontColor: '#F70505' }), // PS:47-61
    field('size', '尺寸', '尺寸：', 85.5, 3.5, 93.5), // PS:62-76
    field('color', '颜色', '颜色：', 5, 10, 75), // PS:77-91
    field('glass', '玻璃', '玻璃：', 85.5, 10.5, 94), // PS:92-106 —— y 是 10.5
    field('client', '客户', '客户：', 5, 17, 75), // PS:107-121
    field('maker', '制单', '制单：', 164.5, 36, 40), // PS:122-136
    field('lockway', '开向', '开向：', 85.5, 17, 90), // PS:137-151
    field('orderID', '单号', '单号：', 5, 24, 75), // PS:152-166
    field('address', '地址', '地址：', 85.5, 24, 94, { wrap: true }), // PS:167-181
    field('remark', '备注', '备注：', 5, 31, 180, { wrap: true }), // PS:182-196
    field('lockImg', '锁图', '', 187.5, 24, 14, { fontSize: 11 }), // PS:197-211
    field('qrcode', '二维码', '', 186, 3.5, 18, { fontSize: 11 }), // PS:212-226
  ]
}

/**
 * 默认 4 列（`PS:234-239`）。
 *
 * ⚠️ 每列**只有 4 个键** `{key,label,visible,width}` —— 与 C 家族 `ColumnConfig` 的 7 个键不同（§2.3）。
 * ★ **合计宽 = 200mm**，而可用宽 `210 − 2×5 = 200mm` —— **正好相等**（C 家族两边都不等）。
 */
export function createDefaultColumns(): TableColumn[] {
  return [
    { key: 'doorsheet', label: '门扇', visible: true, width: 50 }, // PS:235
    { key: 'doorframe', label: '外框', visible: true, width: 50 }, // PS:236
    { key: 'windows', label: '亮窗/扣板', visible: true, width: 50 }, // PS:237
    { key: 'doorImg', label: '门图', visible: true, width: 50 }, // PS:238
  ]
}

/**
 * 默认配置工厂（旧版 `a()`，`PS:33-243`）—— **每次返回全新对象**（含全新数组），
 * 别改成共享常量（`N`/`J`/`openLayoutEditor` 都靠它拿干净草稿）。
 *
 * 默认值一览（§2.1，CONFIRMED）：
 * ```
 * paper           210 / 148 / "portrait" / 5      ← ★ A5 纵向（C 家族是 297/210/landscape/3）
 * globalHeaderFont Microsoft YaHei / 19 / #000000 / normal
 * tableConfig      showBodyBorder:true / underlineBrElements:true
 *                  rowHeight:37(px!) / tableFontSize:16.5(pt) / tableTopMm:42.5(mm) / 4 列
 * doorImgBox       enabled:false / 128.5 / 80.5 / 43 / 50
 * print            copies:1 / itemsPerPage:1
 * ```
 */
export function createDefaultConfig(): ProductionSheetConfig {
  return {
    paper: {
      widthMm: 210,
      heightMm: 148,
      orientation: 'portrait',
      paddingMm: 5,
    },
    globalHeaderFont: {
      fontFamily: FIELD_FONT_FAMILY,
      fontSize: 19,
      fontColor: '#000000',
      fontWeight: 'normal',
    },
    headerFields: createDefaultHeaderFields(),
    tableConfig: {
      showBodyBorder: true,
      underlineBrElements: true,
      rowHeight: 37,
      tableFontSize: 16.5,
      tableTopMm: 42.5,
      columns: createDefaultColumns(),
    },
    doorImgBox: { enabled: false, x: 128.5, y: 80.5, width: 43, height: 50 },
    print: { copies: 1, itemsPerPage: 1 },
  }
}

/** 一个纸张预设（旧版 `L(w, h, orientation = "portrait")`，`PS:548-553`）。 */
export interface PaperPreset {
  /** 按钮文案（**逐字照抄旧版**，包括 `pin1` 这种看不出含义的，§2.5 / §9.5） */
  label: string
  widthMm: number
  heightMm: number
  /**
   * ★ 旧版 `L()` **连 orientation 一起写**（`PS:548-553`）——
   * 底座的 `PAPER_PRESETS` 是「不联动 orientation」的 3 个，**两边语义不同**（§2.5）。
   */
  orientation: PaperOrientation
}

/**
 * 7 个纸张预设（`PS:1722` / `1744` / `1766` / `1788` / `1810` / `1832` / `1854`）。
 *
 * ⚠️ **两个方向约定不一致，是旧版事实，别"修正"**：
 *   · `A5纵向` 是 `148×210`（宽 < 高）——**数值即方向**，与 `orientation` 字段同向；
 *   · `pin1 (200×140)` 与 `A5横向` 是 `宽 > 高` + `"landscape"` —— 也同向；
 *   · 但 `A4纵向` 是 `210×297` + `"portrait"`。
 *   ⇒ 七个**都是「数值即方向」且与 orientation 同向**。`orientation` 本身无消费者（§2.1 注 4），
 *     所以这里只需照抄配对。
 *
 * ⚠️ `L()` **不做任何 clamp**（`PS:548-553` 直接写进草稿）—— 只在保存时被 `normalize()` 夹一次。
 *    `pin1` 的 `200×140` 两个数都在 `[50,400]` 内，不会被夹掉。
 *
 * TODO(未确认): `pin1` 的名字含义（「1 分」= 一张印两联？）—— `PS:1722` 与
 * `itemsPerPage` 的按钮（`PS:2877`）之间**看不出任何代码耦合**（§9.5）。
 * 推测归推测，这里只保留旧版的字面值与调用参数。
 */
export const PAPER_PRESETS: readonly PaperPreset[] = [
  { label: 'pin1 (200×140)', widthMm: 200, heightMm: 140, orientation: 'landscape' }, // PS:1722
  { label: 'A5纵向', widthMm: 148, heightMm: 210, orientation: 'portrait' }, // PS:1744
  { label: 'A5横向', widthMm: 210, heightMm: 148, orientation: 'landscape' }, // PS:1766
  { label: 'A4纵向', widthMm: 210, heightMm: 297, orientation: 'portrait' }, // PS:1788
  { label: 'A4横向', widthMm: 297, heightMm: 210, orientation: 'landscape' }, // PS:1810
  { label: 'A6', widthMm: 105, heightMm: 148, orientation: 'portrait' }, // PS:1832
  { label: 'B5', widthMm: 182, heightMm: 257, orientation: 'portrait' }, // PS:1854
]

/** 一个数值输入框的范围（`min`/`max`/`step`），供组件层直接绑到 Naive 的 `n-input-number`。 */
export interface NumberRange {
  min: number
  max: number
  step: number
}

/**
 * 布局编辑器 / 设置弹窗里**每一个 `InputNumber`** 的范围（§3.2 / §2.3，全部 CONFIRMED）。
 *
 * ⚠️ **只列 UI 范围，不参与 `normalize()`** —— 两者的界**故意不一致**（旧版事实）：
 *   · `tableTopMm` 的 UI 下界是 **0**，而 `normalize()` 的下界是 **`-1`**（哨兵值，§2.1 注 2）；
 *   · 纸张宽高的 UI 是 50–400，`normalize()` 也是 50–400（一致）；
 *   · 列宽的 UI 是 **step 1**，`normalize()` 的 clamp 没有 step 概念。
 *   ⇒ 组件层用这张表，本层用 `normalize()` 里的字面量，**别互相"对齐"**。
 */
export const PS_UI_RANGES = {
  paperWidthMm: { min: 50, max: 400, step: 1 },
  paperHeightMm: { min: 50, max: 400, step: 1 },
  paperPaddingMm: { min: 0, max: 30, step: 0.5 },
  // 字段设置（`PS:3087-3107`）
  fieldX: { min: 0, max: 400, step: 0.5 },
  fieldY: { min: 0, max: 400, step: 0.5 },
  fieldWidth: { min: 5, max: 300, step: 0.5 },
  fieldFontSize: { min: 6, max: 36, step: 0.5 },
  fieldLineHeight: { min: 0.8, max: 3, step: 0.1 },
  // 表格设置（`PS:3346-3457`）
  tableTopMm: { min: 0, max: 400, step: 0.5 },
  tableFontSize: { min: 6, max: 24, step: 0.5 },
  tableRowHeight: { min: 16, max: 60, step: 1 },
  // 列宽设置（`PS:3524-3560`）—— ★ step 1（不是 0.5）
  columnWidth: { min: 5, max: 300, step: 1 },
  // 门图框设置（`PS:3616-3706`）—— ★ 宽高 step 1（不是 0.5）
  doorImgBoxX: { min: 0, max: 400, step: 0.5 },
  doorImgBoxY: { min: 0, max: 400, step: 0.5 },
  doorImgBoxWidth: { min: 10, max: 200, step: 1 },
  doorImgBoxHeight: { min: 10, max: 200, step: 1 },
  // 字段列表里的 X/Y/宽（`PS:3817-3877`）
  listFieldX: { min: 0, max: 400, step: 0.5 },
  listFieldY: { min: 0, max: 400, step: 0.5 },
  listFieldWidth: { min: 5, max: 300, step: 0.5 },
} as const satisfies Record<string, NumberRange>

/**
 * 两处**旁注灰字与实际默认值矛盾**的文案（`PS:2506-2518` / `PS:2549-2561`，§2.3）。
 *
 * ⚠️ 旧版残留文案，**建议照抄**（与「列显示与排序（拖拽行调整顺序）：」那句同理，§3.7）。
 *    `rowHeight` 实际默认 **37**、旁注写「默认22」；`tableFontSize` 实际默认 **16.5**、旁注写「默认10」。
 *    组件层直接用这两个常量，别从 `createDefaultConfig()` 推。
 */
export const PS_STALE_HINT_TEXT = {
  rowHeight: '默认22',
  tableFontSize: '默认10',
  /** `PS:2580` —— 文案承诺拖拽，实现只有 ↑↓ 两颗按钮（§3.7） */
  columnSort: '列显示与排序（拖拽行调整顺序）：',
} as const
