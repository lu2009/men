// 收据单2（旧版 `Receipt2PrintManager`）的数据模型。
//
// ⚠️ 这份模型与 `docs/2026-09-16-print-font.md` 早先记的**完全不同** —— 那份写的是
// 「合格标签」`LabelPrintManager` 的模型（`globalFont` / 逐字段 `fontFamily` / `tableConfig`），
// 在收据单2 里逐字 grep 出现次数全为 0。逆向定稿见 `docs/2026-09-17-receipt2-analysis.md`。
//
// 关键事实：**字体族、字重、行高、页边距全部硬编码在 CSS 里，不可配**。
// 能配的只有：6 类字号、纸张尺寸/方向、元素显隐与位置、品牌名、10 个元素的几何微调、10 列列宽。

/** 6 类字号。默认值与范围见 `defaults.ts` 的 `FONT_RANGES`。 */
export interface FontSettings {
  /** UI「品牌字体」——实际控制标题 `.receipt2-title`，名字有误导性 */
  headerFontSize: number
  /** UI「编号日期字体」 */
  orderDateFontSize: number
  /** UI「表格字体」 */
  tableFontSize: number
  /** UI「金额字体」 */
  amountFontSize: number
  /** UI「基础信息字体」 */
  metaFontSize: number
  /** UI「说明字体」 */
  declarationFontSize: number
}

export type Orientation = 'landscape' | 'portrait'

/** 纸张与份数。 */
export interface PaperSettings {
  /** 1–99。**浏览器打印路径完全不读它**，只有 Electron 静默打印用。 */
  copies: number
  /** 50–500 */
  widthMm: number
  /** 50–500 */
  heightMm: number
  /** 合法值优先保留；反推（宽≥高→landscape）只是兜底。见 `sanitizePaper`。 */
  orientation: Orientation
}

/** 页头三件套的水平位置。`"left"` 进左侧，**其余一切值都进右侧**。 */
export type Position = 'left' | 'right'

/** 信息栏的 4 个元素（也是 `metaOrder` 的合法值域与规范顺序）。 */
export type MetaKey = 'client' | 'tel' | 'address' | 'productionDays'

export interface VisibilitySettings {
  showOrderNo: boolean
  showDate: boolean
  showQrcode: boolean
  showClient: boolean
  showTel: boolean
  showAddress: boolean
  showProductionDays: boolean
  showAmounts: boolean
  showDeclaration: boolean
  orderNoPosition: Position
  datePosition: Position
  qrcodePosition: Position
  /**
   * 信息栏渲染顺序。默认 `["client","tel","address","productionDays"]`。
   *
   * ⚠️ 旧版的归一化**不去重**：存了 `["client","client"]` 会产出长度 5 的数组、客户渲染两次。
   * 新版**有意补上 Set 去重**（见逆向文档决策项 10）—— 只在脏数据下触发，正常路径保真度不受影响。
   */
  metaOrder: MetaKey[]
}

export interface BrandSettings {
  /** 关掉时名称输入框整行不渲染 */
  enabled: boolean
  /** 保存时 `trim()`；UI `maxlength:40` */
  name: string
}

/** 可被 `data-r2-el` 命中的 10 个元素。**明细表格行一个都没有**。 */
export type ElementKey =
  | 'orderNo'
  | 'date'
  | 'title'
  | 'qrcode'
  | 'client'
  | 'tel'
  | 'address'
  | 'productionDays'
  | 'amounts'
  | 'declaration'

/** 单个元素的几何微调。由「元素微调」面板编辑，**不走设置弹窗的保存按钮**。 */
export interface ElementConfig {
  /** mm，无上下限（可负） */
  offsetXMm: number
  /** mm，无上下限（可负） */
  offsetYMm: number
  /** 0 = 不覆盖，用 CSS 默认。读盘只保 ≥0（UI 上限 60，但读盘不校验） */
  fontSize: number
  /** 0 = 不覆盖，用 CSS 默认。读盘只保 ≥0（UI 上限 300，但读盘不校验） */
  widthMm: number
  /** false 时加 `display:none` —— 元素**仍在 DOM 里**，所以元素微调面板还能点到它 */
  visible: boolean
}

export type ElementConfigs = Record<ElementKey, ElementConfig>

/** 10 列列宽，**裸百分比**。默认和 99.8%（不是 100%）。各项下限 3。 */
export type ColumnWidths = number[]

/** 常用尺寸预设的 key。**从不持久化**——落盘的只有 widthMm/heightMm/orientation 三个原始字段。 */
export type PaperPresetKey =
  | 'pin-210-140'
  | 'pin-200-140'
  | 'pin-210-90'
  | 'pin-200-90'
  | 'a4-landscape'
  | 'a4-portrait'
  | 'a5-landscape'
  | 'a5-portrait'

/** 收据单2 渲染所读的订单头字段。注意既有英文键也有**中文键**。 */
export interface Receipt2Order {
  orderNo: string
  date: string
  client: string
  tel: string
  /** ⚠️ **中文键**。与英文 `address` 是两个不同字段，渲染器只读这个。 */
  安装地址: string
  productionDays: string | number
  brand: string
  total: number
  deposit: number
  balance: number
  declaration: string
  /** 收款二维码 URL。空白字符串（`trim()` 后为空）走虚线空框分支。 */
  payQrcode: string
  receipt: Receipt2Line[]
}

/** 明细行。10 列各自对应的英文键。 */
export interface Receipt2Line {
  profile: string
  direction: string
  color: string
  glass: string
  size: string
  quantity: string | number
  price: string | number
  amount: string | number
  pricing: string
  remark: string
}

/** 一页的 HTML（`me()` 的产物）。 */
export type Receipt2Page = string
