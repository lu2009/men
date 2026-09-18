// 自定义合格标签 · 默认配置工厂 + 全部 UI 控件参数。
//
// 验收夹具：`docs/custom-docs-recon/ql-default-config.json` → 应为 `createDefaultConfig()` 的逐字段产物
// （施工图 §2.2 的 11 行表是同一份数据的表格形态；§10.4 要求 deep-equal）。
//
// ⚠️ `fields[]` 的**数组顺序即默认顺序**，且清洗时按 `key` 合并（不是按下标，§2.6 R9）——
//    默认表既是「出厂版式」也是「清洗的主干」，改这里等于同时改两件事。

import type {
  LabelField,
  LabelFieldKey,
  LabelGlobalFont,
  LabelPaper,
  LabelPrintConfig,
  QualifiedLabelConfig,
} from './types'

/**
 * 默认配置工厂（旧版 `a`，`QL:23-205`，4307 字符）。
 *
 * ★ **每次调用返回全新对象**（旧版是 `() => ({...})`）—— 清洗 `N` 内部就调一次拿基准，
 *   调用方也各自 `a()`，**不要**退化成共享常量，否则清洗的浅拷贝会污染基准。
 *
 * 默认版式的几何（70×90、内边距 2 ⇒ 可用宽 66mm）：
 * - `qrcode` 占 `x=0.5, y=0, width=height=20`；
 * - `orderID`/`client` 在 `x=21`，与二维码并排（二维码占 0.5–20.5），**两者都 `showPrefix:false`**；
 * - 第 4–11 条 `x=2, width=66` 正好铺满可用宽；
 * - `package` 在 `y=85`（纸高 90）是**最后一行**，且 `x=4`（不是 2）、`fontSize=10`（不是 16）、
 *   `textAlign=center` —— 三处刻意的差异化，见下。
 *
 * ⚠️ `qrcode.fontSize: 19` 是**死值**：二维码分支从不读 `fontSize`（§2.3）。
 *    照抄 19，别"顺手"改成 16。
 * ⚠️ `qrcode.height: 20` **等于 width** —— 这与清洗 R10 的「qrcode 的 height 强制 = width」一致；
 *    对 `qrcode` 来说 `height` 只在编辑画布（`$`，`QL:680`）被读，打印 HTML 里从不出现。
 * ⚠️ `package` 的 `fontSize:10` 被「应用到全部」**明确排除**（§2.5），见 `layout.ts` 的 `applyToAllFontSize`。
 */
export function createDefaultConfig(): QualifiedLabelConfig {
  return {
    paper: createDefaultPaper(),
    globalFont: createDefaultGlobalFont(),
    autoHideEmpty: true,
    fields: createDefaultFields(),
    print: createDefaultPrint(),
  }
}

/** 纸张默认（`QL:24-30`）：70×90 纵向、内边距 2、不旋转。 */
export function createDefaultPaper(): LabelPaper {
  return { widthMm: 70, heightMm: 90, orientation: 'portrait', paddingMm: 2, printRotate90: false }
}

/** 全局字体默认（`QL:31-36`）。⚠️ `fontFamily` 的引号是**双引号**，进 HTML 时才换成单引号（§4.1）。 */
export function createDefaultGlobalFont(): LabelGlobalFont {
  return {
    fontFamily: '"Microsoft YaHei", sans-serif',
    fontSize: 16.5,
    fontWeight: 'normal',
    lineHeight: 1.1,
  }
}

/** 打印默认（`QL:205`）。 */
export function createDefaultPrint(): LabelPrintConfig {
  return { copies: 1 }
}

/** 单条字段的工厂（内部用；13 键全给，避免各处漏键）。 */
function field(
  key: LabelFieldKey,
  label: string,
  x: number,
  y: number,
  extra: Partial<LabelField> = {},
): LabelField {
  return {
    key,
    label,
    visible: true,
    showPrefix: false,
    x,
    y,
    width: 66,
    height: 5,
    fontSize: 16,
    fontWeight: 'normal',
    wrap: false,
    maxLines: 1,
    textAlign: 'left',
    ...extra,
  }
}

/**
 * 默认的 11 条字段（`QL:37-204`，§2.2 的表格）。
 *
 * 写成「工厂 + 逐条覆盖」而不是 11 个完整对象字面量：默认表里绝大多数键是同一组值
 * （`width:66 / height:5 / fontSize:16 / wrap:false / maxLines:1 / textAlign:'left'`），
 * 逐条覆盖能一眼看出**每条真正与众不同的那几个键**，且产物与 `ql-default-config.json` 逐字段相同
 * （由 `ql-logiccheck.mjs` 的 deep-equal 用例钉死）。
 */
export function createDefaultFields(): LabelField[] {
  return [
    // 1 二维码：`showPrefix:false`、宽高都 20、fontSize 19（死值）
    field('qrcode', '二维码', 0.5, 0, {
      width: 20,
      height: 20,
      fontSize: 19,
    }),
    // 2 订单号：x=21 与二维码并排
    field('orderID', '订单号', 21, 2, { width: 48 }),
    // 3 客户：★ 唯一的 bold，且 showPrefix:false
    field('client', '客户', 21, 11.5, { width: 48, fontWeight: 'bold' }),
    // 4 型材：★ wrap=true（maxLines 仍是 1）
    field('door', '型材', 2, 20.5, { showPrefix: true, wrap: true }),
    field('size', '尺寸', 2, 29, { showPrefix: true }),
    field('lockway', '开向', 2, 37, { showPrefix: true }),
    field('color', '颜色', 2, 45, { showPrefix: true }),
    field('glass', '玻璃', 2, 53, { showPrefix: true }),
    // 9 地址：wrap=true + maxLines=2
    field('address', '地址', 2, 61, { showPrefix: true, wrap: true, maxLines: 2 }),
    // 10 备注：wrap=true + maxLines=2
    field('remark', '备注', 2, 73, { showPrefix: true, wrap: true, maxLines: 2 }),
    // 11 包装：★ x=4（不是 2）、fontSize=10（不是 16）、textAlign=center —— 三处刻意的差异化
    field('package', '包装', 4, 85, { showPrefix: true, fontSize: 10, textAlign: 'center' }),
  ]
}

// ------------------------------------------------------------------ //
// UI 控件参数（施工图 §3.2 / §3.5 / §2.4）
// ------------------------------------------------------------------ //

/** `el-input-number` 的三元组。 */
export interface UiRange {
  min: number
  max: number
  step: number
}

/** 左侧「纸张」区块的范围（设置弹窗 `QL:1167/1195/1262`、布局编辑器 `QL:1990/2016/2043` **两处逐字相同**）。 */
export const PAPER_UI_RANGES = {
  widthMm: { min: 20, max: 300, step: 1 },
  heightMm: { min: 20, max: 400, step: 1 },
  paddingMm: { min: 0, max: 20, step: 0.5 },
} as const satisfies Record<string, UiRange>

/**
 * **布局编辑器左栏**「字段设置」的范围（§3.2 第二组）。
 *
 * ⚠️ ★ **`width` 的下限在三个地方不一样，三处都照抄**（§3.2 的 ⚠️ / §10.3）：
 *   · 布局编辑器**左栏**的 `宽(mm)` = **4**（`QL:2324`）；
 *   · 布局编辑器**右栏字段表**的 `宽(mm)` = **1**（`QL:2948`）；
 *   · 清洗 `N` 的 clamp = **1**（`QL:342`）。
 *   三者不一致是旧版事实 —— `defaults.ts` 的两个常量就是为了让这处不一致**显式可见**。
 */
export const FIELD_UI_RANGES = {
  x: { min: 0, max: 300, step: 0.5 },
  y: { min: 0, max: 400, step: 0.5 },
  /** ★ 左栏是 4，右栏表格是 1，见上 */
  width: { min: 4, max: 300, step: 0.5 },
  fontSize: { min: 5, max: 30, step: 0.5 },
  /** 仅 `wrap=true` 时出现（`QL:2438` 的 `v-if`） */
  maxLines: { min: 1, max: 10, step: 1 },
} as const satisfies Record<string, UiRange>

/** **右栏字段表**的范围（§3.5）。与左栏的差别**只有 `width` 下限**（1 vs 4）。 */
export const FIELD_TABLE_UI_RANGES = {
  x: { min: 0, max: 300, step: 0.5 },
  y: { min: 0, max: 400, step: 0.5 },
  width: { min: 1, max: 300, step: 0.5 },
  fontSize: { min: 5, max: 30, step: 0.5 },
} as const satisfies Record<string, UiRange>

/** 右栏字段表的**列宽**（`QL:2851-3082` 的 `width:"NN"`，字符串形式，9 列）。 */
export const FIELD_TABLE_COLUMN_WIDTHS = {
  visible: '38',
  label: '46',
  x: '72',
  y: '72',
  width: '82',
  fontSize: '78',
  textAlign: '74',
  wrap: '52',
  showPrefix: '52',
} as const

/** 右栏「对齐」下拉的宽度（`QL:3017` 的 `style:{width:"68px"}`）。 */
export const FIELD_TABLE_ALIGN_SELECT_WIDTH = '68px'

/** 「快捷批量调整」三个控件的范围（§3.2 第三组，`QL:2613/2638/2663`）。 */
export const BATCH_UI_RANGES = {
  /** 正文字号 pt */
  fontSize: { min: 5, max: 30, step: 0.5 },
  /** 正文行宽 mm */
  bodyWidth: { min: 10, max: 200, step: 1 },
  /** 客户/单号宽 mm（`client` + `orderID`） */
  orderWidth: { min: 10, max: 200, step: 1 },
} as const satisfies Record<string, UiRange>

/** 设置弹窗「行高」的范围（`QL:1634`，步长 **0.05** —— 别抄成 0.5）。 */
export const LINE_HEIGHT_UI_RANGE = { min: 1, max: 2, step: 0.05 } as const satisfies UiRange

/** 设置弹窗「默认字号」的范围（`QL:1563`）。 */
export const GLOBAL_FONT_SIZE_UI_RANGE = { min: 5, max: 30, step: 0.5 } as const satisfies UiRange

/** 打印份数范围（`QL:1824/1886` 与清洗 `QL:320-330` 的 clamp 都是 1–99）。 */
export const COPY_RANGE = { min: 1, max: 99, step: 1 } as const satisfies UiRange

/**
 * 「整体自适应」的**基准版式**（§3.3，`QL:462-463` 的字面量 `70` / `90`）。
 *
 * ★ 基准**恒为出厂默认版式**（函数内部会 `createDefaultConfig()`），
 *   不是「当前版式」—— 所以它的语义是「把 70×90 的出厂版式按新纸张重铺一遍」，
 *   用户之前的所有手工调整会被覆盖。UI 提示语就是这么写的（「基准 70×90mm」）。
 */
export const LONG_EDGE_BASE = { widthMm: 70, heightMm: 90 } as const

/** 纸张预设按钮（`QL:1293-1419`，**7 个**；底座的 C 家族只有 3 个）。点击只写宽高，**不重排字段**。 */
export const PAPER_PRESETS: { label: string; widthMm: number; heightMm: number }[] = [
  { label: '40×30', widthMm: 40, heightMm: 30 },
  { label: '50×30', widthMm: 50, heightMm: 30 },
  { label: '50×40', widthMm: 50, heightMm: 40 },
  { label: '60×40', widthMm: 60, heightMm: 40 },
  { label: '70×50', widthMm: 70, heightMm: 50 },
  { label: '80×60', widthMm: 80, heightMm: 60 },
  { label: '100×80', widthMm: 100, heightMm: 80 },
]

/** 字体族下拉（`QL:1515-1533`，**5 项**，`value` 的引号形式照抄）。 */
export const FONT_FAMILY_OPTIONS: { label: string; value: string }[] = [
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif' },
  { label: '宋体', value: '"SimSun", serif' },
  { label: '黑体', value: '"SimHei", sans-serif' },
  { label: '苹方', value: '"PingFang SC", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
]

/** 字体粗细下拉（全部 5 处 `el-select` 的选项逐字相同：正常/加粗）。 */
export const FONT_WEIGHT_OPTIONS: { label: string; value: 'normal' | 'bold' }[] = [
  { label: '正常', value: 'normal' },
  { label: '加粗', value: 'bold' },
]

/** 对齐下拉（右栏字段表，宽 68px）。 */
export const TEXT_ALIGN_OPTIONS: { label: string; value: 'left' | 'center' | 'right' }[] = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' },
]

/**
 * 「快捷批量调整」的两组字段 key（§3.2 第三组，`QL:426-427`）。
 *
 * ★ `BODY_FIELD_KEYS` 是「正文行」的 7 条（不含 `orderID`/`client`/`qrcode`/`package`）；
 *   `ORDER_FIELD_KEYS` 是「客户/单号」的 2 条。
 * ⚠️ 这两个组的用途**互不相同**，别合并：
 *   `BODY_FIELD_KEYS` 同时服务「正文字号」(O) 与「正文行宽」(H) **两个**控件；
 *   `ORDER_FIELD_KEYS` 只服务「客户/单号宽」(G) **一个**控件。
 * ⚠️ `qrcode` 与 `package` **两个组里都没有** —— 所以批量调整**永远改不到它们**
 *   （这是旧版事实，与 `applyToAllFontSize` 的显式排除是两条独立的路径）。
 */
export const BODY_FIELD_KEYS: readonly LabelFieldKey[] = [
  'door',
  'size',
  'lockway',
  'color',
  'glass',
  'address',
  'remark',
]

/** 「客户/单号宽」作用的 key（`QL:427`）。 */
export const ORDER_FIELD_KEYS: readonly LabelFieldKey[] = ['client', 'orderID']

/**
 * 「应用到全部」**显式排除**的两个 key（§2.5，`QL:696-698`，CONFIRMED 且必须照抄）。
 *
 * ★ 不照抄的后果：`package` 会从 10pt 变成 `globalFont.fontSize`（默认 16.5pt），
 *   把包装行撑成正文大小 —— 见 §10.3 的 checklist 第 1 条。
 * `qrcode` 被排除是因为它**没有字号概念**（渲染时根本不读 `fontSize`）。
 */
export const APPLY_TO_ALL_EXCLUDED_KEYS: readonly LabelFieldKey[] = ['qrcode', 'package']

/**
 * 「快捷批量调整」三个控件的初值（`QL:428-430` 的 `Vue.ref(16)` / `ref(66)` / `ref(48)`）。
 *
 * ⚠️ 这三个数是**可变的界面状态**，不是配置：`W()`（`readBatchValues`）会从草稿里回读刷新，
 *   调用时机只有三处（`openLayoutEditor` / `le` / `J`）—— 用户逐个改字段后它们**会变陈旧**
 *   （旧版行为，照抄；新版若要做实时同步属有意偏离，见 §3.2 的说明）。
 */
export const BATCH_INITIAL_VALUES = { fontSize: 16, bodyWidth: 66, orderWidth: 48 } as const
