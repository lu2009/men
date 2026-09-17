// C 家族自绘单据 · 与单据无关的默认值 / UI 控件参数（底座层）。
//
// 这些值在 GS2 与 PS2 里**逐字段相同**（§2.1：`paper` 与 `print` 两块全同；§2.2：
// 三个列控件的 UI 范围相同、默认值不越界，无需改范围；§10：两个弹窗的控件逐字相同）。
// 单据各自不同的只有 `table.title` 与 `table.columns` —— 那两个由 profile 的默认配置工厂给。

import type { Orientation, PaperConfig, PrintConfig } from './types'

/** 边距默认值 mm（GS:15 / PS2:15）。`sanitizePaper` 的回落值也是它 —— 两处共用一个常量。 */
export const DEFAULT_PADDING_MM = 3

/** 纸张默认值（GS:12-17 / PS2:12-17）：A4 横向。两张单据全同。 */
export function createDefaultPaper(): PaperConfig {
  return { widthMm: 297, heightMm: 210, paddingMm: DEFAULT_PADDING_MM, orientation: 'landscape' }
}

/** 打印默认值（GS:97 / PS2:106）。 */
export function createDefaultPrint(): PrintConfig {
  return { copies: 1 }
}

// ------------------------------------------------------------------ //
// UI 范围（布局编辑器 / 打印设置弹窗的控件参数，§7.3 / §8）
// ------------------------------------------------------------------ //

/** 布局编辑器「纸张」区块的 `el-input-number` 范围（GS:1419-1470 / PS2:1445-1496）。 */
export const PAPER_UI_RANGES = {
  widthMm: { min: 100, max: 420, step: 1 },
  heightMm: { min: 100, max: 297, step: 1 },
  paddingMm: { min: 0, max: 20, step: 0.5 },
} as const

/** 布局编辑器「表格全局」区块（GS:1471-1500）。标题输入框 `style="width:160px"`。 */
export const TABLE_UI_RANGES = {
  headerFontSize: { min: 7, max: 28, step: 0.5 },
} as const

/**
 * 布局编辑器「各列设置」表格的每列控件范围（GS:1700-1745 / PS2:1726-1771）。
 * 列宽 `controls-position:"right"`。
 *
 * ⚠️ PS2 三列默认字号 15pt / 行高 9mm **不越界**（上限 28pt / 20mm），无需为它放宽。
 */
export const COLUMN_UI_RANGES = {
  widthMm: { min: 10, max: 120, step: 1 },
  fontSize: { min: 7, max: 28, step: 0.5 },
  rowHeightMm: { min: 3, max: 20, step: 0.5 },
} as const

/** 打印份数范围（GS:752-762 的 clamp **与** UI 的 `el-input-number` 都是 1–99）。 */
export const COPIES_RANGE = { min: 1, max: 99, step: 1 } as const

/** 打印设置弹窗的方向下拉选项（GS:675 / PS2:701）：`横向`=landscape、`纵向`=portrait。 */
export const ORIENTATION_OPTIONS: { value: Orientation; label: string }[] = [
  { value: 'landscape', label: '横向' },
  { value: 'portrait', label: '纵向' },
]

/**
 * 打印设置弹窗的 3 个「常用尺寸」预设（GS:676 / PS2:702）。
 *
 * ⚠️ 只有 3 个（收据单是 8 个），且**不联动 `orientation`** —— 只写宽高两个数。
 */
export const PAPER_PRESETS: { label: string; widthMm: number; heightMm: number }[] = [
  { label: 'A4', widthMm: 297, heightMm: 210 },
  { label: 'A5', widthMm: 210, heightMm: 148 },
  { label: 'B5', widthMm: 257, heightMm: 182 },
]
