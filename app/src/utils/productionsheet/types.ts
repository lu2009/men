// 自定义生产单（旧版 `ProductionSheetPrintManager`，Home 的 `ic=14`）· 数据模型。
//
// 施工图：`docs/custom-docs-recon/01-ps.md`（注释里的 `PS:NNN` 即
// `legacy/js/ProductionSheet.deobfuscated.js` 的行号）。
//
// ⚠️ **本单据不属于 C 家族**（§0.1 逐段判定）：底座 `../docsheet/` 里能原样用的只有 4 小件
//    （`escapeHtml` / `waitForImages` / `createQrEncoder` / `storage.ts` 的两个写盘函数），
//    CSS / HTML / 分页 / 清洗 / profile 全须新写 —— 连类名派生规则都对不上（§0.3）。
//    ⇒ **本目录不复用 `DocSheetProfile`**，配置模型是自成一体的（见下）。
//
// 与 C 家族的结构性差别（别照搬 `productionsheet2/types.ts` 的心智模型）：
//   1. `paper` 之外多两块：**`globalHeaderFont`**（顶层第四块）与 **`doorImgBox`**；
//   2. `tableConfig` 是**自由定位表格**（`tableTopMm` + 4 列固定宽），不是「每列字号/行高/颜色」；
//   3. 头部字段是**自由定位**的 12 条（`x`/`y`/`width`），不是列；
//   4. `print` 多一个 **`itemsPerPage`（1/2）**，2 时「一行数据画上下两联」（§5.4）。

import type { QrEncoder, QrSvg } from '../docsheet/types'

export type { QrEncoder, QrSvg }

/**
 * 纸张方向。⚠️ **有字段、无消费者**（§2.1 注 4）——
 * 与 C 家族同样，`orientation` 不被 CSS / 分页 / 渲染任何一处读；
 * 印刷方向完全由 `widthMm`/`heightMm` 两个数值决定（`PS:1030` 的 `@page`）。
 * 只有设置弹窗的方向下拉与 `normalize()` 读写它。
 *
 * ★ **归一化方向与底座相反**（§2.1 注 3）：PS 是「只认 `landscape`」，底座是「只认 `portrait`」，
 *   两边的兜底值正好相反 ⇒ **别复用底座的 `sanitizePaper`**。
 */
export type PaperOrientation = 'landscape' | 'portrait'

/** 纸张（`PS:34-39`）。⚠️ 默认是 **A5 纵向 `210/148/portrait/5`**（C 家族是 `297/210/landscape/3`）。 */
export interface PaperConfig {
  /** 读盘 `N(v, 50, 400, 210)`（`PS:282-289`）；UI 50–400 step 1 */
  widthMm: number
  /** 读盘 `N(v, 50, 400, 148)`（`PS:290-297`）；UI 50–400 step 1 */
  heightMm: number
  /** 见 `PaperOrientation` —— **无消费者** */
  orientation: PaperOrientation
  /** 读盘 `N(v, 0, 30, 5)`（`PS:305-312`）；UI 0–30 step 0.5 */
  paddingMm: number
}

/**
 * 全局头部字体（`PS:40-45`）—— **C 家族没有这一块**。
 *
 * ⚠️ 它只进 `sheetStyle` 的 `font-family` / `font-size` 两项（`PS:1058-1061`），
 * 即 `<section>` 的**继承字体**；每个头部字段自己的 `fontSize`/`fontFamily`/`fontColor`
 * 是**内联**写死的，会覆盖这里的值。⇒ 单独改这里，页面文字**看不出变化**，
 * 除非某个字段的样式被改掉。这是旧版事实，照抄。
 */
export interface GlobalHeaderFont {
  /** 读盘 `v || 默认`（**`||` 不是 `??`** ⇒ 空串回落，`PS:315-318`） */
  fontFamily: string
  /** 读盘 `N(v, 6, 36, 19)`（`PS:319-326`） */
  fontSize: number
  /** 读盘 `v || 默认`（`PS:327-330`） */
  fontColor: string
  /** 读盘 `=== "bold" ? "bold" : "normal"`（`PS:331-337`） */
  fontWeight: string
}

/**
 * 一个头部字段（`PS:46-227` 的 12 条）。
 *
 * ⚠️ 共 **12 个键**，**没有 `height` / `textAlign` / `maxLines`**（那是「合格标签」家族 A 的，
 * §2.2）—— 高度由 `fontSize × lineHeight × wrap` 隐式决定。
 *
 * ⚠️ `key` / `label` / `prefix` 由 `normalize()` **强制取默认值**（`PS:450-452`），
 * 任何 UI 都改不了（`prefix` 在布局编辑器里连控件都没有）。这里留 `string` 是为了
 * 读取存盘数据时可被赋值，运行期恒等于默认 12 个 key 之一。
 */
export interface HeaderField {
  /** 取值路由键（见 `readFieldValue`），恒为默认 12 个之一 */
  key: string
  /** 显示名。⚠️ **不转义**（`PS:871` 的「假值回落」分支直接拼 `prefix`，`label` 走 `K()`） */
  label: string
  /**
   * 前缀。⚠️ **不转义**（`PS:871` 直接 `t.prefix + K(n)`）——
   * 旧版就是这么写的，别「顺手补一个 `escapeHtml`」，产物会不等。
   */
  prefix: string
  /** `false` 的字段不进 HTML（`PS:814` 的 `filter(e => e.visible)`） */
  visible: boolean
  /** 读盘 `N(v, 0, 400, 默认)`；UI 0–400 step 0.5 */
  x: number
  /** 读盘 `N(v, 0, 400, 默认)`；UI 0–400 step 0.5 */
  y: number
  /** 读盘 `N(v, 5, 300, 默认)`；UI 5–300 step 0.5。单位 **mm** */
  width: number
  /** 读盘 `N(v, 6, 36, 默认)`；UI 6–36 step 0.5（`qrcode`/`lockImg` 无此控件）。单位 **pt** */
  fontSize: number
  /** 读盘 `v || 默认`。★ 布局编辑器里**无处可改**，只能去设置弹窗的「头部字段」tab */
  fontFamily: string
  /** 读盘 `v || 默认` */
  fontColor: string
  /** 读盘 `=== "bold" ? "bold" : "normal"` */
  fontWeight: string
  /** 读盘 `undefined ? 默认 : !!v`（**保留 `undefined` 与 `false` 的区别**，`PS:472-475`） */
  wrap: boolean
  /**
   * 行距倍率。读盘用 **`Number.isFinite(Number(v))`** 判定、夹 **0.8–3**（`PS:476-480`）——
   * ★ 这是全文件**唯一**一处用了「修掉 `NaN`」写法的地方（§2.4）。
   */
  lineHeight: number
}

/**
 * 一列的版式（`PS:234-239`）—— **只有 4 个键**：`{key,label,visible,width}`。
 *
 * ⚠️ **没有 `fontSize` / `rowHeightMm` / `fontColor`**（那是 C 家族 `ColumnConfig` 的字段，§2.3）：
 * 表格的字号是**全局一个** `tableConfig.tableFontSize`，行高是**全局一个** `tableConfig.rowHeight`。
 * 旧版 `normalize()` 的列合并里虽然顺带 clamp 了一次 `width`，但**其余字段一概不认**。
 *
 * ⚠️ 单位是 **mm**，字段名是 **`width`**（不是 C 家族的 `widthMm`）—— 别改名。
 */
export interface TableColumn {
  /** 取值路由键：默认 4 个 `doorsheet`/`doorframe`/`windows`/`doorImg` 之一（见 `normalize()` 的列合并） */
  key: string
  /** 表头显示名，**转义**（`PS:913` 走 `K()`） */
  label: string
  /** `false` 的列不进 HTML（表头与明细都不渲染） */
  visible: boolean
  /** 读盘 `N(v, 5, 300, 默认)`；UI 5–300 **step 1**。单位 **mm** */
  width: number
}

/**
 * 表格全局（`PS:228-240`）。
 *
 * ★ **`rowHeight` 的单位是 px**（不是 mm，§2.1 注 1）—— 渲染时一律 `0.2646 * rowHeight` 换算成 mm
 * （`PS:1073`/`PS:1234`/`PS:934` 里 `px` 与 `mm` 两处用法不同）。
 */
export interface TableConfig {
  /**
   * 「外边框」。★ **只作用于 `<td>`**（`PS:897-899`）：
   * `<th>` 恒为 `border:1px solid #000`（`PS:910`）—— **关掉它也仍有表头框**。照抄。
   */
  showBodyBorder: boolean
  /** 「加下划线」：单元格每个非空段加 `text-decoration:underline` + `offset 6px` + `thickness 1px`（`PS:943-947`） */
  underlineBrElements: boolean
  /** 「表体行高(px)」。读盘 `N(v, 16, 60, 37)`；UI 16–60 step 1。⚠️ 单位 **px** */
  rowHeight: number
  /** 「字号(pt)」。读盘 `N(v, 6, 24, 16.5)`；UI 6–24 step 0.5。作用于整个 `<table>`（`PS:905`） */
  tableFontSize: number
  /**
   * 表格绝对 Y 位置 mm。读盘 `N(v, -1, 400, 42.5)`；UI 0–400 step 0.5（绑 writable computed `T`）。
   * ★ **哨兵 `-1` = 自动**：取可见字段最大 `y` + 12（`PS:613-619` 的 `S` / `PS:1204-1211` 的内联副本）。
   */
  tableTopMm: number
  /** **顺序即列序**（`normalize()` 的列合并不重排已出现的 key，见 §2.4）。合计默认 200mm = 可用宽 */
  columns: TableColumn[]
}

/**
 * 门图框（`PS:241`）—— **C 家族没有这一块**。
 *
 * ⚠️ 渲染出来的 `border:1px dashed #333`（`PS:1004`）**会真的打印出来**，
 * 它不是编辑器辅助线。旧版就是这样，照抄。
 */
export interface DoorImgBoxConfig {
  /** `!!v`（读盘，`PS:382-384`） */
  enabled: boolean
  /** 读盘 `N(v, 0, 400, 128.5)`；UI 0–400 step 0.5 */
  x: number
  /** 读盘 `N(v, 0, 400, 80.5)`；UI 0–400 step 0.5 */
  y: number
  /** 读盘 `N(v, 10, 200, 43)`；UI **10–200 step 1** */
  width: number
  /** 读盘 `N(v, 10, 200, 50)`；UI **10–200 step 1** */
  height: number
}

/** 打印参数（`PS:242`）。 */
export interface PrintConfig {
  /**
   * 1–99（`Math.max(1, Math.min(99, Number(v) || 1))`，`PS:419-429`）。
   * ⚠️ **浏览器打印路径不读它**（`printDirect` 不传份数），旧版只有 Electron 静默打印读
   * （`printSilent`）—— 新版没有 Electron ⇒ **本层无消费者**，照抄存着。
   */
  copies: number
  /**
   * 每页数据数：**1 或 2**（`PS:430-438`）。读盘是 **`2 === Number(v) ? 2 : 默认(1)`**
   * —— 只有严格等于 2 才保留 2，`3`/`undefined`/`1` 一律回落到默认值。
   *
   * ★ `2` 的语义：Home 侧 `sc()` 把**两条**记录配对成**一条**配对行（`HOME:10034`），
   * 本层再把配对行画成**上下两联**（§5.4 / §9.4）。落到纸上仍是「一页两条记录」，
   * 但中间的数据形状是「1 条配对行」——别被文案误导。
   */
  itemsPerPage: number
}

/**
 * 整份配置（`PS:33-243` 的 `a()`）—— 两个弹窗（设置 / 布局编辑）**共用同一个 localStorage 键**。
 *
 * 顶层 **6 块**（§2.1）：`paper` / `globalHeaderFont` / `headerFields` / `tableConfig` /
 * `doorImgBox` / `print`。
 */
export interface ProductionSheetConfig {
  paper: PaperConfig
  globalHeaderFont: GlobalHeaderFont
  /** ⚠️ **顺序永远是默认顺序**（`normalize()` 以默认表为主干遍历，`PS:445-483`），用户拖不出也存不住顺序 */
  headerFields: HeaderField[]
  tableConfig: TableConfig
  doorImgBox: DoorImgBoxConfig
  print: PrintConfig
}

/**
 * 表格里的一格数据（`row.oldSheet[0]`）—— 键与**列** `key` 对应。
 *
 * ⚠️ `row.oldSheet` 是**数组**（旧版 `calculateReceiptOld` 产出恒长 1 的数组，§6.4），
 * 表格渲染遍历它当「明细行」，再按列 key 取字段（`PS:916-921`）。
 * ⚠️ 表格单元格读的是**原始值**，**不走 `readFieldValue()`**（`PS:919-921`）——
 * 所以 `size`/`qrcode` 的特例只在 `headerFields` 生效。
 */
export interface ProductionSheetCell {
  [extra: string]: unknown
  doorsheet?: unknown
  doorframe?: unknown
  windows?: unknown
  doorImg?: unknown
}

/**
 * 一行数据 —— 旧版 `calculateReceiptOld()` 的产物（`HUI@650439-695139`）。
 *
 * **新版数据层已经就绪**：`app/src/utils/printPayloads.ts` 的 **`oldSheetProduces(paired)`**
 * 就是等价物（§6.4 逐键核对 CONFIRMED，含 ic=14 独有的 `maker`/`lockway`）。
 *
 * ⚠️ **`orderID` 是小写 `d`**（§2.6）—— `readFieldValue()` 对 `qrcode` 读的正是它；
 * ic=15 的 `calculateReceipt` 用大写 `OrderID`，**别混**。
 *
 * ⚠️ 带 **`1` 后缀**的键（`orderID1`/`oldSheet1`/`size1`/…）**只由 Home 的 `sc()` 造出**
 * （`HOME:10034`）—— `calculateReceiptOld()` 自身**永不产出**它们（§6.4 末，CONFIRMED）。
 */
export interface ProductionSheetRow {
  [extra: string]: unknown
  client?: unknown
  material?: unknown
  qrcode?: unknown
  orderID?: unknown
  maker?: unknown
  lockImg?: unknown
  /** ★ **ic=14 独有**（ic=15 没有这个键） */
  lockway?: unknown
  color?: unknown
  glass?: unknown
  /** ⚠️ 旧版是**数组**（`["1800*900","亮窗高：300"]`）；新版数据层已返回 `join(',')` 的字符串（§6.4） */
  size?: unknown
  address?: unknown
  remark?: unknown
  quantity?: unknown
  doorImg?: unknown
  /** 明细行数组，恒长 1（旧版口径） */
  oldSheet?: ProductionSheetCell[]
}

/**
 * 渲染选项。
 *
 * ⚠️ **与 C 家族的 `RenderOptions` 不同**：PS 的二维码**尺寸由字段自己的 `width` 决定**
 * （内联 `width:{w}mm;height:{w}mm`，`PS:839-848`），**不是固定 17mm**；
 * 图片列/门图框的样式也是各自硬编码的 ⇒ 底座那三个 `qrSize`/`imgStyle`/`qr` 里只有 `qr` 有意义。
 */
export interface ProductionSheetRenderOptions {
  /**
   * 二维码 provider（`text → {viewBox, inner} | null`）。缺省 / `null` → **不画二维码**
   * （旧版编码失败时 `F` 直接返回 `""`，连 `<svg>` 外壳都没有，`PS:838`）。
   *
   * ⚠️ 由**调用方**建一个实例并复用（旧版是模块级单例 `Z` + `Q`；缓存键 `text + "::m1"`）。
   * 见 `qr.ts` 的 `createProductionSheetQrProvider`。
   */
  qrSvg?: ((text: string) => QrSvg | null) | null
}
