// 自定义玻璃合片单（旧版 `GlassSheet2PrintManager`）的数据模型。
//
// 逆向定稿：`docs/custom-docs-recon/02-glasssheet2.md`（§2 数据模型 / §6 配置模型）。
// 反混淆源码：`legacy/js/GlassSheet2.deobfuscated.js`（下称 `GS:NNN`）。
//
// 与收据单2 的三处根本不同（别照搬 `receipt2/types.ts` 的心智模型）：
//   1. 配置是**嵌套**的 `{paper, table{columns[]}, print}`，不是收据单那种扁平 6 字号 + 9 显隐；
//   2. 列宽是**每列绝对 mm**（`widthMm`），不是裸百分比、**不能拖拽**（GS:1748-1817 是上下箭头排序）；
//   3. 字号是**每列独立 `fontSize`(pt)** + 表头 `headerFontSize`，颜色是**每列 `fontColor`** + 全局 `borderColor`。

/** 纸张方向。⚠️ 见 `PaperConfig.orientation` —— 本组件里**有字段、无消费者**。 */
export type Orientation = 'landscape' | 'portrait'

/** 纸张（GS:12-17）。 */
export interface PaperConfig {
  /** 输入框 100–420，step 1。读盘 `Number(v) || 297` */
  widthMm: number
  /** 输入框 100–297，step 1。读盘 `Number(v) || 210` */
  heightMm: number
  /**
   * 输入框 0–20，step 0.5。读盘语义**新版有意偏离**（旧版是 `??` 会得到 `NaN`）：
   * 见 `sanitize.ts` 的 `sanitizeConfig` / 逆向报告 §6.4 决策 1。
   */
  paddingMm: number
  /**
   * ⚠️ **有字段、无消费者**（GS 全组件 grep，逆向报告 §6.1 末尾 CONFIRMED）。
   *
   * 它不被 CSS 发生器读（横/纵完全靠 `widthMm`/`heightMm` 的数值，见 `css.ts` 的 `@page`）、
   * 不被分页读（`paginate.ts` 只读 `heightMm`/`paddingMm`）、不被量测读。
   * **只有「打印设置」弹窗的方向下拉框在读写它**（GS:675）。
   * 这是从「合格标签」那套复制过来的残留字段。**照抄存着，别让它生效** ——
   * 收据单的 `orientation` 是真在旋转页面的（差异表 #20），这里不是。
   */
  orientation: Orientation
}

/**
 * 一列的版式配置（GS:23-94 的每一列，字段顺序照抄）。
 *
 * `key` 是 `string` 而不是字面量联合：读盘时**按下标合并默认列、多出的列原样保留**（GS:745-748），
 * 所以运行期真的会存在 `key` 不在默认 8 个之内的列 —— 它们经 `renderCell` 的 `default` 分支
 * 渲染成空串（GS:304-305），列本身仍在表头里占一格。
 */
export interface ColumnConfig {
  /** 取值路由键。见 `ColumnKey`；未知 key → 空单元格 */
  key: string
  /**
   * 表头显示名。**与 `key` 故意错位**，实现时别「修正」（§2.4）：
   * `door` 显示「门类」、`order` 显示「单号」、`lockImg` 显示「方向」……
   *
   * ⚠️ 渲染表头时**不转义**（GS:597 直接拼 `e.label`），与 `table.title` 不同。
   */
  label: string
  /** 列宽 mm。输入框 10–120，step 1。**绝对单位**，不是百分比 */
  widthMm: number
  /** 单元格字号 pt。输入框 7–28，step 0.5 */
  fontSize: number
  /** `line-height` mm。输入框 3–20，step 0.5 */
  rowHeightMm: number
  /** 单元格文字颜色 */
  fontColor: string
  /** `false` 的列**不进 HTML**（表头与明细都不渲染），但仍留在配置数组里 */
  visible: boolean
}

/** 默认 8 列的 key（§2.4）。其余值走 `renderCell` 的 `default` 分支 → 空串。 */
export type ColumnKey =
  | 'client'
  | 'door'
  | 'order'
  | 'basicInfo'
  | 'lockImg'
  | 'doorsheet'
  | 'doorImg'
  | 'remark'

/** 表格全局（GS:18-96）。 */
export interface TableConfig {
  /** 页面标题。**渲染时转义**（GS:616）。默认「玻璃合片单」 */
  title: string
  /** 表格边框色，同时进 CSS 的 `border` 与编辑器预览的内联 `<style>`。默认 `#444444` */
  borderColor: string
  /** 表头字号 pt。输入框 7–28，step 0.5。默认 13.5 */
  headerFontSize: number
  /** **顺序即列序**，由布局编辑器的 ↑/↓ 按钮就地交换（GS:1748-1817），没有拖拽 */
  columns: ColumnConfig[]
}

/** 打印参数（GS:97）。 */
export interface PrintConfig {
  /** 1–99（读盘 clamp，GS:752-762）。**浏览器打印路径不读它**，只有 Electron 静默打印读（GS:793） */
  copies: number
}

/** 整份配置 —— 两个弹窗共用、共用**一个** localStorage 键（`glass_sheet2_template_v1`）。 */
export interface GlassSheet2Config {
  paper: PaperConfig
  table: TableConfig
  print: PrintConfig
}

/**
 * 行对象（§2.2，CONFIRMED）。
 *
 * **全字段可选**：旧版一律用 `?.` / `?? ""` 取值，缺字段不会抛。
 * 字段名照抄旧版，注意三处坑：
 *   - 单号是 **`OrderID`（大写 O）**，`orderID` 只是 `renderCell` 的回退写法；
 *   - `qrcode` 与 `OrderID` 是**同一份单号的冗余字段**（Hui 侧 `calculateGlass()` 同时写两个）；
 *   - `door`/`basicInfo`/`doorsheet`/`remark` 都是**含 `<br>` 的富文本串**，不是纯文本。
 *
 * 新版**不重写数据层** —— 行由调用方传进来，复用 `app/src/utils/printPayloads.ts` 的
 * `glassProduces()`（同报告 §14.1）。
 */
export interface GlassSheet2Row {
  /** 客户 */
  client?: string
  /** 型材 + 颜色，`filter(Boolean).join("<br>")` */
  door?: string
  /** 单号（大写 O） */
  OrderID?: string
  /** 单号回退写法（小写 o），仅 `renderCell('order')` 读 */
  orderID?: string
  /** 单号的冗余副本 */
  qrcode?: string
  /** 订单信息：尺寸行 + 后缀（平开/吊趟两分支内容不同） */
  basicInfo?: string
  /** 开向示意图 URL（**不是锁具图**） */
  lockImg?: string
  /** 玻璃尺寸 */
  doorsheet?: string
  /** 门图 URL */
  doorImg?: string
  /** 备注 */
  remark?: string
  /** 旧版 `ProductionEdit` 会回写的其它字段（`doorframe` / `windows` 等），本单据不渲染 */
  [extra: string]: unknown
}

// ------------------------------------------------------------------ //
// 二维码
// ------------------------------------------------------------------ //

/**
 * 二维码 SVG 的两个片段（旧版从编码器产出的 `<svg>` 元素上取，GS:251-256）。
 *
 * `viewBox` 取库产出 SVG 的 `viewBox` 属性，**回退 `"0 0 180 180"`**；
 * `inner` 是它的 `innerHTML`。
 */
export interface QrSvg {
  viewBox: string
  inner: string
}

/**
 * 二维码编码器 —— 输入单号文本，产出可内联的 SVG 片段；失败返回 `null`。
 *
 * **这是新版有意做成可注入的一处**（旧版是写死的模块内单例，GS:203 `k = new y()`）：
 * 旧版内嵌的是 vendor chunk 里的 `@zxing/library` 系编码器（`y`，报告 §1 / §9.2），
 * 而本仓库**没有**这个依赖（`app/package.json` 无 qrcode 类库，全库 grep 也没有本地编码器）。
 * 报告 §9.2 建议复用「收据单的二维码能力」，但收据单的二维码其实只是后端给的图片 URL
 * （`payQrcode` → `<img>`），**并没有前端编码器**，所以无现成能力可复用。
 *
 * ⇒ 编码器由**组件层注入**（`renderOptions.qr`）。这保住了本层全部的结构保真度
 * （17mm / `preserveAspectRatio` / `viewBox` 回退 / 字幕折行），只把「怎么算 QR」推给上层。
 * **未注入时**，行为等价于旧版「编码器抛错」那条分支（GS:257-259 返回 `null`）：
 * 单元格只渲染单号字幕、不渲染 SVG。参照实现参数：`write(text, 180, 180, MARGIN=1)`。
 */
export type QrEncoder = (text: string) => QrSvg | null

/** 量测/打印/预览三处共用的渲染选项（旧版 `U` 的第 4 参，GS:206-212）。 */
export interface RenderOptions {
  /**
   * 二维码边长。打印/量测是 **17mm**；旧版编辑器预览是 15mm，
   * **新版三处统一 17mm**（§7.4 决策 2，见 `html.ts` 顶部说明）。
   */
  qrSize?: string
  /** 图片列的内联样式。三处都显式传同一个字面量（GS:457-461、559-563） */
  imgStyle?: string
  /** 二维码编码器（见 `QrEncoder`）。缺省 → 只渲染字幕 */
  qr?: QrEncoder | null
}

/** 一页的 HTML（`renderPage` 的产物）。 */
export type GlassSheet2Page = string
