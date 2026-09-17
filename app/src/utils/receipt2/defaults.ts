// 收据单2 的默认常量。全部逐字取自旧版 `Receipt2.deobfuscated.js`（行号见注释）。
//
// 这些对象会被反复展开（`{...DEFAULT_X}`）当作清洗器的兜底值，**切勿原地修改**。

import type {
  BrandSettings,
  ColumnWidths,
  ElementConfigs,
  ElementKey,
  FontSettings,
  MetaKey,
  PaperPresetKey,
  PaperSettings,
  VisibilitySettings,
} from './types'

/** 6 类字号的默认值与可调范围（`u` :13-20，范围见 `Z()` :252-289 的 clamp 调用）。 */
export const FONT_RANGES = {
  headerFontSize: { default: 30, min: 14, max: 36, label: '品牌字体' },
  orderDateFontSize: { default: 13, min: 8, max: 18, label: '编号日期字体' },
  tableFontSize: { default: 15, min: 8, max: 18, label: '表格字体' },
  amountFontSize: { default: 20, min: 16, max: 40, label: '金额字体' },
  metaFontSize: { default: 18, min: 8, max: 18, label: '基础信息字体' },
  declarationFontSize: { default: 15, min: 8, max: 18, label: '说明字体' },
} as const satisfies Record<keyof FontSettings, { default: number; min: number; max: number; label: string }>

/**
 * UI 里的显示顺序 —— 与 `u`(:13-20) 的声明顺序**不同**（旧版弹窗就是这个顺序，照抄）。
 * 逆向文档 §3 已注明「以 UI 顺序为准做界面」。
 */
export const FONT_UI_ORDER: (keyof FontSettings)[] = [
  'headerFontSize',
  'orderDateFontSize',
  'tableFontSize',
  'amountFontSize',
  'metaFontSize',
  'declarationFontSize',
]

/** 字号默认值（`u` :13-20）。 */
export const DEFAULT_FONT_SETTINGS: FontSettings = {
  headerFontSize: FONT_RANGES.headerFontSize.default,
  orderDateFontSize: FONT_RANGES.orderDateFontSize.default,
  tableFontSize: FONT_RANGES.tableFontSize.default,
  amountFontSize: FONT_RANGES.amountFontSize.default,
  metaFontSize: FONT_RANGES.metaFontSize.default,
  declarationFontSize: FONT_RANGES.declarationFontSize.default,
}

/** 纸张默认值（`s` :24）—— 200×140 横向，工业针式纸。 */
export const DEFAULT_PAPER: PaperSettings = {
  copies: 1,
  widthMm: 200,
  heightMm: 140,
  orientation: 'landscape',
}

/** 显隐默认值（`g` :58-72）。注意三个 position 的默认**不一致**，照抄。 */
export const DEFAULT_VISIBILITY: VisibilitySettings = {
  showOrderNo: true,
  showDate: true,
  showQrcode: true,
  showClient: true,
  showTel: true,
  showAddress: true,
  showProductionDays: true,
  showAmounts: true,
  showDeclaration: true,
  orderNoPosition: 'left',
  datePosition: 'right',
  qrcodePosition: 'right',
  metaOrder: ['client', 'tel', 'address', 'productionDays'],
}

/** 品牌默认值（`r` :21）。 */
export const DEFAULT_BRAND: BrandSettings = { enabled: false, name: '' }

/** 信息栏 4 个 key（`F` :309）—— `metaOrder` 的值域与规范补齐顺序。 */
export const META_KEYS: MetaKey[] = ['client', 'tel', 'address', 'productionDays']

/** 信息栏 4 项的中文标签（`$` :310-315），用于排序列表。 */
export const META_LABELS: Record<MetaKey, string> = {
  client: '客户',
  tel: '电话',
  address: '安装地址',
  productionDays: '生产天数',
}

/** 页头三件套的合法位置值（`R` :308）。 */
export const POSITIONS = ['left', 'right'] as const

/** 10 个 `data-r2-el` 元素 key，**有序**（`x` :80-91）—— 也是微调面板的展示顺序。 */
export const ELEMENT_KEYS: ElementKey[] = [
  'orderNo',
  'date',
  'title',
  'qrcode',
  'client',
  'tel',
  'address',
  'productionDays',
  'amounts',
  'declaration',
]

/** 10 个元素的中文名（`B` :92-103）。既是显示名，也是**合法性校验表**。 */
export const ELEMENT_LABELS: Record<ElementKey, string> = {
  orderNo: '编号',
  date: '日期',
  title: '品牌标题',
  qrcode: '二维码',
  client: '客户',
  tel: '电话',
  address: '安装地址',
  productionDays: '生产天数',
  amounts: '金额',
  declaration: '说明',
}

/** 单个元素配置的零值（`L()` :125-136）。 */
export function defaultElementConfig() {
  return { offsetXMm: 0, offsetYMm: 0, fontSize: 0, widthMm: 0, visible: true }
}

/** 10 个元素的全零配置（`L()` :125-136）。每次调用返回**新对象**（旧版也是，无共享引用）。 */
export function defaultElementConfigs(): ElementConfigs {
  const out = {} as ElementConfigs
  for (const k of ELEMENT_KEYS) out[k] = defaultElementConfig()
  return out
}

/**
 * 10 列默认列宽（`a` :11），**百分比**。
 *
 * ⚠️ 早年逆向时把这 10 个数误当成「字段 X 坐标」——实际是列宽：唯一消费点是
 * CSS 生成器里的 `th:nth-child(k){width:N%}`（:390-408）。
 * **合计 99.8% 而非 100%**，是原样，不是笔误。
 */
export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = [
  13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5,
]

/**
 * 常用尺寸预设（`d` :25-50）。按钮顺序即此顺序。
 * 点击只写 `widthMm/heightMm/orientation` 三个字段，**不动 `copies`**。
 */
export const PAPER_PRESETS: { key: PaperPresetKey; label: string; settings: Omit<PaperSettings, 'copies'> }[] = [
  { key: 'pin-210-140', label: '210×140', settings: { widthMm: 210, heightMm: 140, orientation: 'landscape' } },
  { key: 'pin-200-140', label: '200×140', settings: { widthMm: 200, heightMm: 140, orientation: 'landscape' } },
  { key: 'pin-210-90', label: '210×90', settings: { widthMm: 210, heightMm: 90, orientation: 'landscape' } },
  { key: 'pin-200-90', label: '200×90', settings: { widthMm: 200, heightMm: 90, orientation: 'landscape' } },
  { key: 'a4-landscape', label: 'A4横向', settings: { widthMm: 297, heightMm: 210, orientation: 'landscape' } },
  { key: 'a4-portrait', label: 'A4纵向', settings: { widthMm: 210, heightMm: 297, orientation: 'portrait' } },
  { key: 'a5-landscape', label: 'A5横向', settings: { widthMm: 210, heightMm: 148, orientation: 'landscape' } },
  { key: 'a5-portrait', label: 'A5纵向', settings: { widthMm: 148, heightMm: 210, orientation: 'portrait' } },
]

/** 表格 10 列的表头文案（`re()` :439）。 */
export const TABLE_COLUMNS = [
  '型材',
  '开向',
  '颜色',
  '玻璃',
  '尺寸',
  '数量',
  '单价',
  '金额',
  '计价方式',
  '备注',
]

/** 用富文本换行（`white-space: pre-line` + `<br>`→`\n`）的列下标（0 基）：1/4/5/9/10 列。 */
export const CELL_MULTI_COLUMNS = [0, 3, 4, 8, 9]

/** 额外居中的列下标（`ue()` :390-408）：第 2/3/6/7/8 列。 */
export const CELL_CENTER_COLUMNS = [1, 2, 5, 6, 7]
