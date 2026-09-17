// C 家族自绘单据 · 公共数据模型（底座层）。
//
// 「C 家族」= 旧版 Home bundle 里**同一套模板换皮**的两张自绘单据：
//   · 自定义玻璃合片单 `GlassSheet2PrintManager`  —— `legacy/js/GlassSheet2.deobfuscated.js`（注释里 `GS:NNN`）
//   · 自定义生产单2     `ProductionSheet2PrintManager` —— `legacy/js/ProductionSheet2.deobfuscated.js`（`PS2:NNN`）
// 逐成员对照见 `docs/custom-docs-recon/01-diff.md`：43 个成员里**只有 7 个有实质差异**，其余逐字相同。
//
// ⚠️ **单据之间的差异不在本文件**，全在 `profile.ts` 的 `DocSheetProfile` 里：
// 类名前缀 / 两个 localStorage 键 / 文档标题 / 默认配置工厂 / 空段占位开关 / 单元格 case 表。
//
// 与收据单2 的三处根本不同（别照搬 `receipt2/types.ts` 的心智模型，两边都成立）：
//   1. 配置是**嵌套**的 `{paper, table{columns[]}, print}`，不是收据单那种扁平 6 字号 + 9 显隐；
//   2. 列宽是**每列绝对 mm**（`widthMm`），不是裸百分比、**不能拖拽**（GS:1748-1817 / PS2:1774-1843 是上下箭头排序）；
//   3. 字号是**每列独立 `fontSize`(pt)** + 表头 `headerFontSize`，颜色是**每列 `fontColor`** + 全局 `borderColor`。

/** 纸张方向。⚠️ 见 `PaperConfig.orientation` —— 两张单据里都是**有字段、无消费者**。 */
export type Orientation = 'landscape' | 'portrait'

/** 纸张（GS:12-17 / PS2:12-17）。两张单据逐字段相同。 */
export interface PaperConfig {
  /** 输入框 100–420，step 1。读盘 `Number(v) || 297` */
  widthMm: number
  /** 输入框 100–297，step 1。读盘 `Number(v) || 210` */
  heightMm: number
  /**
   * 输入框 0–20，step 0.5。读盘语义**新版有意偏离**（旧版是 `??` 会得到 `NaN`）：
   * 见 `sanitize.ts` 的 `sanitizePaper` / 逆向报告 §6.4 决策 1。**两张单据同一条路径。**
   */
  paddingMm: number
  /**
   * ⚠️ **有字段、无消费者**（GS 全组件 grep / PS2 同构，逆向报告 §6.1 末尾 CONFIRMED）。
   *
   * 它不被 CSS 发生器读（横/纵完全靠 `widthMm`/`heightMm` 的数值，见 `css.ts` 的 `@page`）、
   * 不被分页读（`paginate.ts` 只读 `heightMm`/`paddingMm`）、不被量测读。
   * **只有「打印设置」弹窗的方向下拉框在读写它**（GS:675 / PS2:701）。
   * 这是从「合格标签」那套复制过来的残留字段。**照抄存着，别让它生效** ——
   * 收据单的 `orientation` 是真在旋转页面的（差异表 #20），这里不是。
   */
  orientation: Orientation
}

/**
 * 一列的版式配置（GS:23-94 / PS2:22-104 的每一列，字段顺序照抄）。
 *
 * `key` 是 `string` 而不是字面量联合：读盘时**按下标合并默认列、多出的列原样保留**（GS:745-748），
 * 所以运行期真的会存在 `key` 不在默认列集之内的列 —— 它们经 `renderCell` 的 `default` 分支
 * 渲染成空串（GS:304-305），列本身仍在表头里占一格。
 */
export interface ColumnConfig {
  /** 取值路由键。见各单据的 `ColumnKey` 与 `DocSheetProfile.cellCases`；未知 key → 空单元格 */
  key: string
  /**
   * 表头显示名。**与 `key` 故意错位**，实现时别「修正」：
   * GS2 的 `door` 显示「门类」、`doorsheet` 显示「玻璃尺寸」；PS2 的 `doorsheet` 显示「门扇」。
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

/** 表格全局（GS:18-96 / PS2:18-105）。 */
export interface TableConfig {
  /** 页面标题。**渲染时转义**（GS:616）。默认「玻璃合片单」/「生产单」—— 由 profile 给 */
  title: string
  /** 表格边框色，同时进 CSS 的 `border` 与编辑器预览的内联 `<style>`。默认 `#444444` */
  borderColor: string
  /** 表头字号 pt。输入框 7–28，step 0.5。默认 13.5 */
  headerFontSize: number
  /** **顺序即列序**，由布局编辑器的 ↑/↓ 按钮就地交换（GS:1748-1817），没有拖拽 */
  columns: ColumnConfig[]
}

/** 打印参数（GS:97 / PS2:106）。 */
export interface PrintConfig {
  /** 1–99（读盘 clamp，GS:752-762）。**浏览器打印路径不读它**，只有 Electron 静默打印读（GS:793） */
  copies: number
}

/** 整份配置 —— 两个弹窗共用、共用**一个** localStorage 键（键名由 profile 给）。 */
export interface DocSheetConfig {
  paper: PaperConfig
  table: TableConfig
  print: PrintConfig
}

/**
 * 行对象。**全字段可选**：旧版一律用 `?.` / `?? ""` 取值，缺字段不会抛。
 *
 * 本层只要求「能用字符串下标取值」；具体字段名由**各单据自己的行接口**声明
 * （`GlassSheet2Row` / `ProductionSheet2Row`），并靠 `DocSheetProfile.cellCases`
 * 把列 `key` 映射到字段名。**本层不认识任何业务字段。**
 *
 * ⚠️ 这里保留索引签名（`unknown`）：两张单据的行接口都带它，所以互相可赋值；
 * 同时旧版 `calculateGlass` / `calculateReceipt` 的产物字段远多于渲染用到的那些。
 */
export interface DocSheetRow {
  [extra: string]: unknown
}

// ------------------------------------------------------------------ //
// 二维码
// ------------------------------------------------------------------ //

/**
 * 二维码 SVG 的两个片段（旧版从编码器产出的 `<svg>` 元素上取，GS:251-256 / PS2:261-266）。
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
 * **这是新版有意做成可注入的一处**（旧版是写死的模块内单例 `k = new y()`，GS:203）：
 * 旧版内嵌的是 vendor chunk 里的 `@zxing/library` 系编码器（`y`，报告 §1 / §9.2），
 * 而本仓库**没有**这个依赖。⇒ 编码器由**组件层注入**（`renderOptions.qr`）。
 * 这保住了本层全部的结构保真度（17mm / `preserveAspectRatio` / `viewBox` 回退 / 字幕折行），
 * 只把「怎么算 QR」推给上层。实现见 `docsheet/qr.ts`。
 */
export type QrEncoder = (text: string) => QrSvg | null

/** 量测/打印/预览三处共用的渲染选项（旧版 `U` 的第 4 参，GS:206-212 / PS2:216-222）。 */
export interface RenderOptions {
  /**
   * 二维码边长。打印/量测是 **17mm**；旧版编辑器预览是 15mm，
   * **新版三处统一 17mm**（§7.4 决策 2，见 `html.ts` 顶部说明）。两张单据同样处理。
   */
  qrSize?: string
  /** 图片列的内联样式。三处都显式传同一个字面量（GS:457-461、559-563 / PS2:483-487、585-589） */
  imgStyle?: string
  /** 二维码编码器（见 `QrEncoder`）。缺省 → 只渲染字幕 */
  qr?: QrEncoder | null
}

/** 一页的 HTML（`renderPage` 的产物）。两张单据共用。 */
export type DocSheetPage = string
