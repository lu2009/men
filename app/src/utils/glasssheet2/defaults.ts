// 自定义玻璃合片单 · 默认配置 —— 逐字移植自旧版 `a()`（GS:11-98）。
//
// ⚠️ `a()` 是**函数**、每次调用产出一个**全新对象**（含全新的 `columns` 数组）。
// 旧版三个 ref 各持一份（`i` 生效 / `c` 打印设置草稿 / `s` 布局编辑草稿，GS:102-104），
// 全靠这一点断引用。新版保持函数形态（`createDefaultConfig()`），**不要**改成共享常量。
//
// ⚠️ 纸张与打印份数**与 PS2 逐字段相同**（§2.1）—— 它们的实现已上移到
// `../docsheet/defaults.ts`，这里只做转出。本单据独有的是 `table.title`（「玻璃合片单」）
// 与那 8 列（PS2 是 9 列，键/标签/宽/字号/行高全改）。

import { createDefaultPaper, createDefaultPrint } from '../docsheet/defaults'
import type { ColumnConfig, ColumnKey, GlassSheet2Config, TableConfig } from './types'

// 与单据无关的默认值 / UI 控件参数 —— 原样转出，保持本模块的对外 API 不变。
export {
  DEFAULT_PADDING_MM,
  createDefaultPaper,
  createDefaultPrint,
  PAPER_UI_RANGES,
  TABLE_UI_RANGES,
  COLUMN_UI_RANGES,
  COPIES_RANGE,
  ORIENTATION_OPTIONS,
  PAPER_PRESETS,
} from '../docsheet/defaults'

/**
 * 默认 8 列（GS:23-94，**逐字段照抄**）。
 *
 * ⚠️ `key` 与 `label` **故意错位**（§2.4）：`door`→「门类」、`order`→「单号」、
 * `lockImg`→「方向」、`doorsheet`→「玻璃尺寸」。**别"修正"**。
 * 默认可见列总宽 = 230mm（纸宽 297 − 2×3 = 291 可用），**不必相等**（§2.4 / §13 未确认 1）。
 * PS2 是 9 列、合计 266mm —— 两边都「列宽之和 ≠ 可用宽」，`table-layout:fixed` 自行分配。
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

/** 表格默认值（GS:18-96）。 */
export function createDefaultTable(): TableConfig {
  return {
    title: '玻璃合片单',
    borderColor: '#444444',
    headerFontSize: 13.5,
    columns: createDefaultColumns(),
  }
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
