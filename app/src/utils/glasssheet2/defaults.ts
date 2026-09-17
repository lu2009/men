// 自定义玻璃合片单 · 默认配置 —— 逐字移植自旧版 `a()`（GS:11-98）。
//
// ⚠️ `a()` 是**函数**、每次调用产出一个**全新对象**（含全新的 `columns` 数组）。
// 旧版三个 ref 各持一份（`i` 生效 / `c` 打印设置草稿 / `s` 布局编辑草稿，GS:102-104），
// 全靠这一点断引用。新版保持函数形态（`createDefaultConfig()`），**不要**改成共享常量。

import type {
  ColumnConfig,
  ColumnKey,
  GlassSheet2Config,
  Orientation,
  PaperConfig,
  PrintConfig,
  TableConfig,
} from './types'

/** 边距默认值 mm（GS:15）。`sanitize.ts` 的回落值也是它 —— 两处共用一个常量。 */
export const DEFAULT_PADDING_MM = 3

/**
 * 默认 8 列（GS:23-94，**逐字段照抄**）。
 *
 * ⚠️ `key` 与 `label` **故意错位**（§2.4）：`door`→「门类」、`order`→「单号」、
 * `lockImg`→「方向」、`doorsheet`→「玻璃尺寸」。**别"修正"**。
 * 默认可见列总宽 = 230mm（纸宽 297 − 2×3 = 291 可用），**不必相等**（§2.4 / §13 未确认 1）。
 */
export const DEFAULT_COLUMN_KEYS: ColumnKey[] = [
  'client',
  'door',
  'order',
  'basicInfo',
  'lockImg',
  'doorsheet',
  'doorImg',
  'remark',
]

/** 默认 8 列的完整配置。每次调用返回**新对象数组**（旧版 `a()` 每次重建）。 */
export function createDefaultColumns(): ColumnConfig[] {
  return [
    { key: 'client', label: '客户', widthMm: 30, fontSize: 13, rowHeightMm: 7, fontColor: '#000000', visible: true },
    { key: 'door', label: '门类', widthMm: 28, fontSize: 13, rowHeightMm: 7, fontColor: '#000000', visible: true },
    { key: 'order', label: '单号', widthMm: 24, fontSize: 12, rowHeightMm: 7, fontColor: '#111111', visible: true },
    { key: 'basicInfo', label: '订单信息', widthMm: 34, fontSize: 13, rowHeightMm: 7, fontColor: '#111111', visible: true },
    { key: 'lockImg', label: '方向', widthMm: 20, fontSize: 10, rowHeightMm: 8, fontColor: '#111111', visible: true },
    { key: 'doorsheet', label: '玻璃尺寸', widthMm: 36, fontSize: 14, rowHeightMm: 8, fontColor: '#111111', visible: true },
    { key: 'doorImg', label: '门图', widthMm: 28, fontSize: 12, rowHeightMm: 6.2, fontColor: '#111111', visible: true },
    { key: 'remark', label: '备注', widthMm: 30, fontSize: 12, rowHeightMm: 7, fontColor: '#111111', visible: true },
  ]
}

/** 默认 8 列的显示名（与 `DEFAULT_COLUMN_KEYS` 同序）。布局编辑器的「列名」列是**只读**的（GS:1741）。 */
export const DEFAULT_COLUMN_LABELS: Record<ColumnKey, string> = {
  client: '客户',
  door: '门类',
  order: '单号',
  basicInfo: '订单信息',
  lockImg: '方向',
  doorsheet: '玻璃尺寸',
  doorImg: '门图',
  remark: '备注',
}

/** 纸张默认值（GS:12-17）：A4 横向。 */
export function createDefaultPaper(): PaperConfig {
  return { widthMm: 297, heightMm: 210, paddingMm: DEFAULT_PADDING_MM, orientation: 'landscape' }
}

/** 表格默认值（GS:18-96）。 */
export function createDefaultTable(): TableConfig {
  return {
    title: '玻璃合片单',
    borderColor: '#444444',
    headerFontSize: 13.5,
    columns: createDefaultColumns(),
  }
}

/** 打印默认值（GS:97）。 */
export function createDefaultPrint(): PrintConfig {
  return { copies: 1 }
}

/**
 * 默认配置（旧版 `a()`，GS:11-98）—— 逐字段完整复刻。
 *
 * 三个「重置默认」按钮（打印设置弹窗的 `B` GS:140-142 / 布局编辑器的 `M` GS:143-145）
 * 都**只重置各自的草稿**、不写盘、不关窗，用的就是这个函数。
 */
export function createDefaultConfig(): GlassSheet2Config {
  return { paper: createDefaultPaper(), table: createDefaultTable(), print: createDefaultPrint() }
}

// ------------------------------------------------------------------ //
// UI 范围（布局编辑器 / 打印设置弹窗的控件参数，§7.3 / §8）
// ------------------------------------------------------------------ //

/** 布局编辑器「纸张」区块的 `el-input-number` 范围（GS:1419-1470）。 */
export const PAPER_UI_RANGES = {
  widthMm: { min: 100, max: 420, step: 1 },
  heightMm: { min: 100, max: 297, step: 1 },
  paddingMm: { min: 0, max: 20, step: 0.5 },
} as const

/** 布局编辑器「表格全局」区块（GS:1471-1500）。标题输入框 `style="width:160px"`。 */
export const TABLE_UI_RANGES = {
  headerFontSize: { min: 7, max: 28, step: 0.5 },
} as const

/** 布局编辑器「各列设置」表格的每列控件范围（GS:1700-1745）。列宽 `controls-position:"right"`。 */
export const COLUMN_UI_RANGES = {
  widthMm: { min: 10, max: 120, step: 1 },
  fontSize: { min: 7, max: 28, step: 0.5 },
  rowHeightMm: { min: 3, max: 20, step: 0.5 },
} as const

/** 打印份数范围（GS:752-762 的 clamp **与** UI 的 `el-input-number` 都是 1–99）。 */
export const COPIES_RANGE = { min: 1, max: 99, step: 1 } as const

/** 打印设置弹窗的方向下拉选项（GS:675）：`横向`=landscape、`纵向`=portrait。 */
export const ORIENTATION_OPTIONS: { value: Orientation; label: string }[] = [
  { value: 'landscape', label: '横向' },
  { value: 'portrait', label: '纵向' },
]

/**
 * 打印设置弹窗的 3 个「常用尺寸」预设（GS:676）。
 *
 * ⚠️ 只有 3 个（收据单是 8 个），且**不联动 `orientation`** —— 只写宽高两个数。
 */
export const PAPER_PRESETS: { label: string; widthMm: number; heightMm: number }[] = [
  { label: 'A4', widthMm: 297, heightMm: 210 },
  { label: 'A5', widthMm: 210, heightMm: 148 },
  { label: 'B5', widthMm: 257, heightMm: 182 },
]
