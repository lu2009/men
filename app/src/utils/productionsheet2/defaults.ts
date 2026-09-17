// 自定义生产单2 · 默认配置 —— 逐字移植自旧版 `a()`（PS2:11-107）。
//
// ⚠️ `a()` 是**函数**、每次调用产出一个**全新对象**（含全新的 `columns` 数组）。
// 旧版三个 ref 各持一份（`i` 生效 / `c` 打印设置草稿 / `s` 布局编辑草稿，PS2:110-112），
// 全靠这一点断引用。新版保持函数形态（`createDefaultConfig()`），**不要**改成共享常量。
//
// ⚠️ 纸张与打印份数**与 GS2 逐字段相同**（§2.1）—— 它们的实现已上移到
// `../docsheet/defaults.ts`，这里只做转出。本单据独有的是 `table.title`（「生产单」）
// 与那 **9 列**（GS2 是 8 列，且键/标签/宽/字号/行高全改，§2.2）。

import { createDefaultPaper, createDefaultPrint } from '../docsheet/defaults'
import type { ColumnConfig, ColumnKey, ProductionSheet2Config, TableConfig } from './types'

// 与单据无关的默认值 / UI 控件参数 —— 原样转出，与 GS2 侧同源。
// ⚠️ **§2.2 已核实：三个 15pt / 9mm 的列不越界**（`COLUMN_UI_RANGES` 上限 28pt / 20mm），
// 两张单据的 UI 范围相同，**无需为本单据放宽**。
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
 * 默认 **9 列**（PS2:22-104，**逐字段照抄**）。
 *
 * ⚠️ **顺序即列序**，且与 GS2 **不同**：`doorImg` 从 GS2 的第 7 位**前移**到第 2 位；
 * `client` 被删；`doorframe`/`windows` 插在 `doorsheet` 之后。
 *
 * ⚠️ `key` 与 `label` 仍然**故意错位**（§2.2）：`door`→「客户/门类」、`lockImg`→「方向」、
 * **`doorsheet`→「门扇」**（不是「玻璃尺寸」）、`doorframe`→「外框」、`windows`→「亮窗/扣板」。
 * **别"修正"**。
 *
 * 默认可见列总宽 = **266mm**（32+28+22+30+14+35+39+36+30）；
 * GS2 = 230mm。纸宽 297 − 2×3 = 291 可用，**两边都不相等**，
 * `table-layout:fixed` 自行分配（§2.2 末段）。
 */
export const DEFAULT_COLUMN_KEYS: ColumnKey[] = [
  'door',
  'doorImg',
  'order',
  'basicInfo',
  'lockImg',
  'doorsheet',
  'doorframe',
  'windows',
  'remark',
]

/** 默认 9 列的完整配置。每次调用返回**新对象数组**（旧版 `a()` 每次重建）。 */
export function createDefaultColumns(): ColumnConfig[] {
  return [
    { key: 'door', label: '客户/门类', widthMm: 32, fontSize: 13, rowHeightMm: 7, fontColor: '#000000', visible: true },
    { key: 'doorImg', label: '门图', widthMm: 28, fontSize: 12, rowHeightMm: 6.2, fontColor: '#111111', visible: true },
    { key: 'order', label: '单号', widthMm: 22, fontSize: 12, rowHeightMm: 7, fontColor: '#111111', visible: true },
    { key: 'basicInfo', label: '订单信息', widthMm: 30, fontSize: 13, rowHeightMm: 7, fontColor: '#111111', visible: true },
    { key: 'lockImg', label: '方向', widthMm: 14, fontSize: 10, rowHeightMm: 8, fontColor: '#111111', visible: true },
    { key: 'doorsheet', label: '门扇', widthMm: 35, fontSize: 15, rowHeightMm: 9, fontColor: '#111111', visible: true },
    { key: 'doorframe', label: '外框', widthMm: 39, fontSize: 15, rowHeightMm: 9, fontColor: '#111111', visible: true },
    { key: 'windows', label: '亮窗/扣板', widthMm: 36, fontSize: 15, rowHeightMm: 9, fontColor: '#111111', visible: true },
    { key: 'remark', label: '备注', widthMm: 30, fontSize: 12, rowHeightMm: 7, fontColor: '#111111', visible: true },
  ]
}

/** 默认 9 列的显示名（与 `DEFAULT_COLUMN_KEYS` 同序）。布局编辑器的「列名」列是**只读**的。 */
export const DEFAULT_COLUMN_LABELS: Record<ColumnKey, string> = {
  door: '客户/门类',
  doorImg: '门图',
  order: '单号',
  basicInfo: '订单信息',
  lockImg: '方向',
  doorsheet: '门扇',
  doorframe: '外框',
  windows: '亮窗/扣板',
  remark: '备注',
}

/** 表格默认值（PS2:18-105）。 */
export function createDefaultTable(): TableConfig {
  return {
    title: '生产单', // ⚠️ GS2 是「玻璃合片单」（§2.1 唯一改值的 `paper`/`print` 之外的顶层字段）
    borderColor: '#444444',
    headerFontSize: 13.5,
    columns: createDefaultColumns(),
  }
}

/**
 * 默认配置（旧版 `a()`，PS2:11-107）—— 逐字段完整复刻。
 *
 * 三个「重置默认」按钮（打印设置弹窗的 `B` PS2:149-151 / 布局编辑器的 `M` PS2:152-154）
 * 都**只重置各自的草稿**、不写盘、不关窗，用的就是这个函数。
 */
export function createDefaultConfig(): ProductionSheet2Config {
  return { paper: createDefaultPaper(), table: createDefaultTable(), print: createDefaultPrint() }
}
