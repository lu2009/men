// 自定义合格标签（旧版 `QualifiedLabelPrintManager`，Home 的 `ic=13`）· 数据模型。
//
// 逆向定稿：`docs/custom-docs-recon/01-ql.md`（施工图，逐段判定 + 逐字模板）
// 反混淆源码：`legacy/js/QualifiedLabel.deobfuscated.js`（注释里的 `QL:NNN` 即其行号）
//
// ⚠️ **本单据几何上属于「A 家族」（自由定位字段），但底座 `docsheet/` 一行都用不上**
//    （施工图 §0.1 的表）：`PaperConfig` 表达不了 5 键的 `paper`、`DocSheetProfile`
//    表达不了 `fields[]`/`globalFont`、`DocSheetClasses` 的派生规则在本单产出里一个都不出现。
//    ⇒ 本目录是**独立的一套类型**，与 `productionsheet/`（PS）的形态相似但语义无关。
//
// ⚠️ 与 C 家族（GS2/PS2）的三处根本不同（别照搬它们的心智模型）：
//   1. 配置是**自由定位字段表**（每字段 13 键），不是「列宽 mm + 表格」；
//   2. **没有分页** —— 一次产出全部标签，`page-break-after:always` 交给浏览器（§5.1）；
//   3. **不认 `<br>`** —— 文本整串转义，`备注:加急<br>加配:X` 会逐字显示 `<br>`（§4.2）。

/** 字体粗细。读盘（§2.6 R10）与全局字体（§2.6 R5）都**只认 `bold`**，其余一律 `normal`。 */
export type LabelFontWeight = 'normal' | 'bold'

/** 文本对齐（§2.6 R10 的白名单，顺序即旧版 `["left","center","right"]`）。 */
export type LabelTextAlign = 'left' | 'center' | 'right'

/** 纸张方向。⚠️ 在**本单不是死字段**（与 C 家族相反，见 `LabelPaper.orientation`）。 */
export type LabelOrientation = 'landscape' | 'portrait'

/**
 * 字段表里的 11 个 key（§2.2，CONFIRMED）。
 *
 * ★ 这是一个**闭集**：清洗（§2.6 R9）遍历的是**默认字段表**，存盘里多出来的 key 被静默丢弃，
 *   缺失的 key 回默认 ⇒ 运行期 `fields[]` 的 key 永远是这 11 个、顺序也永远是默认顺序。
 */
export type LabelFieldKey =
  | 'qrcode'
  | 'orderID'
  | 'client'
  | 'door'
  | 'size'
  | 'lockway'
  | 'color'
  | 'glass'
  | 'address'
  | 'remark'
  | 'package'

/**
 * 纸张（§2.1 / §2.4）—— **5 个键**（施工图骨架层少写了 `printRotate90`，本文件补全）。
 *
 * | 键 | 默认 | 弹窗范围 | 清洗 clamp |
 * |---|---|---|---|
 * | `widthMm`  | 70 | 20–300 s1 | `20..300` |
 * | `heightMm` | 90 | 20–400 s1 | `20..400` |
 * | `paddingMm`| 2  | 0–20 s0.5 | `0..20` |
 * | `orientation` | `"portrait"` | 方向下拉 | 只认 `landscape` |
 * | `printRotate90` | `false` | **只在布局编辑器** | **不 clamp**（原样带过） |
 */
export interface LabelPaper {
  /** `@page`、`<section>` 宽、iframe 宽、以及清洗里 x/width 的上界来源 */
  widthMm: number
  /** 同上（`@page` 高）；也是清洗里 y 的上界来源（经 `height`） */
  heightMm: number
  /** `<section>` 的 `padding` + `te()`（适应纸张宽度）算可用宽。⚠️ **不参与 CSS**（§4.3） */
  paddingMm: number
  /**
   * ⚠️ **不是死字段**（与 C 家族 `PaperConfig.orientation` 相反，§0.1 / §2.4）：
   * 消费者是 `printSilent` 的 `landscape`（`QL:1006`）。
   * 新版不做 Electron 静默打印 ⇒ **本仓库里它暂时没有消费者**，但**照抄存着** ——
   * 它是配置项的一部分（用户在设置弹窗里能改），且 `printSilent` 的替代物出现时要读它。
   * ⚠️ `@page` 的尺寸**交换靠 `printRotate90`，不靠它**（§4.3）。
   */
  orientation: LabelOrientation
  /**
   * 打印旋转 90°（`QL:2206` 的开关，提示语「布局60×90→打印输出到90×60纸」）。
   *
   * 两个消费者：① CSS 的 `@page size` 交换 + `transform:rotate(-90deg)`（§4.3）；
   * ② `printSilent` 的 `landscape` 与 `pageWidthMm/HeightMm`（`QL:1006-1013`，新版不做）。
   * ⚠️ **`printDirect` 的 iframe 尺寸不旋转**（仍用 `widthMm×heightMm`，靠 CSS 自己转，§5.1）。
   */
  printRotate90: boolean
}

/** 全局字体（§2.5）—— 4 个键。⚠️「一键改全部」的**只有 `lineHeight`**，见下。 */
export interface LabelGlobalFont {
  /**
   * **纯继承**：只写进 `<section class="qlabel">` 的 `font-family`（`QL:732`），
   * 字段 div 不写，靠继承。进 HTML 时引号被替换：`"` → `'`（所以默认值
   * `"Microsoft YaHei", sans-serif` 变成 `'Microsoft YaHei', sans-serif`）。
   * ⚠️ **清洗不校验它**（§2.6 R5），靠 `{...默认, ...存档}` 原样带过。
   */
  fontFamily: string
  /**
   * **不直接影响任何字段**：只写 `<section>` 的 `font-size`（`QL:733`）；
   * 每个字段的 `font-size` 一律取**字段自己的** `fontSize`（`QL:602`）。
   * 只有点「应用到全部」（`ee`）才写进字段 —— 且**排除 `qrcode` 与 `package`**（§2.5）。
   */
  fontSize: number
  /**
   * 同上：只写 `<section>`（`QL:734`），字段取自己的。
   * ★ **没有任何「应用到全部粗细」按钮** —— 改了它字段不会变，只能逐字段在右栏改。
   */
  fontWeight: LabelFontWeight
  /**
   * ★ **`globalFont` 里唯一「一键改全部」的键**：既写 `<section>`（`QL:735`），
   * **又写进每个文本字段的 inline `line-height`**（`QL:615`）⇒ 改它全局即时生效。
   */
  lineHeight: number
}

/**
 * 一个字段（§2.1 / §2.3）—— **13 个键**。
 *
 * ★ `height` 是**半死字段**（§2.3）：**从不进打印 HTML**，编辑画布上文本节点的高度也由字号算
 * （只有 `qrcode` 分支用它算画布高度，`QL:680`）。它唯一的真实作用是
 * **限制 `y` 的上界**（§2.6 R10 的 `y ∈ [0, 纸高 − height]`）。
 * ⚠️ 「按 `height` 画渲染」与「按渲染结果算 `y` 上界」两种直觉都是**错的**（§10.3 #3）。
 */
export interface LabelField {
  /** 决定渲染分支 + `data-key`，同时是**清洗时的合并主键**（§2.6 R9） */
  key: LabelFieldKey
  /**
   * 显示名。`showPrefix` 时拼成 `label + ":"` 前缀，**并用于剥除取到的值上的同名前缀**（§4.2）。
   * ⚠️ UI 里**没有改 label 的入口**，但存盘里手工改过的 label 会覆盖默认（§2.6 R9 的合并方向）。
   */
  label: string
  /** `false` 的字段**整个不渲染**（打印与画布都是）。★ 全 11 个都 false → 清洗整体回默认（§2.6 R11） */
  visible: boolean
  /** 值前面拼 `label + ":"`（**恒半角冒号**，`QL:598`）。`label` 为空时**不拼** */
  showPrefix: boolean
  /** mm。清洗 clamp `0..max(0, 纸宽 − width)` */
  x: number
  /** mm。清洗 clamp `0..max(0, 纸高 − height)`（★ 上界依赖 `height`） */
  y: number
  /** mm。清洗 clamp `1..纸宽`。`qrcode` 的**渲染宽高都取它**（与 `height` 无关，§4.2） */
  width: number
  /** mm。⚠️ **从不进打印 HTML**（§2.3），只用来限制 `y` 的上界（+ `qrcode` 的画布高度） */
  height: number
  /** pt。清洗 clamp `5..30` */
  fontSize: number
  /** 清洗只认 `bold`。⚠️ 默认 `client` 是 `bold`、其余 `normal`（`qrcode` 的 19pt 是死值，见 §2.2） */
  fontWeight: LabelFontWeight
  /**
   * 换行。决定 3 条互斥样式（§4.2 分支 B）：
   * `true` → `white-space:normal` + `word-break:break-all` + `-webkit-line-clamp`；
   * `false` → `white-space:nowrap` + `overflow:hidden` + `text-overflow:ellipsis`。
   * ⚠️ 画布（`$`）**不用它** —— 画布恒单行溢出隐藏。
   */
  wrap: boolean
  /** `-webkit-line-clamp:{n}`，**仅 `wrap=true` 时消费**（`QL:611`，全文唯一一处）。清洗 `round` 后 clamp `1..10` */
  maxLines: number
  /** 清洗白名单 `{left,center,right}`，否则 `left`。渲染时 `|| "left"` 兜一道 */
  textAlign: LabelTextAlign
}

/** 打印参数（§2.1）。**只有 `copies`**，且只进 `printSilent`（新版不做）。 */
export interface LabelPrintConfig {
  /** 1–99（清洗 `max(1, min(99, Number(v) || 默认))`）。浏览器打印路径**不读它** */
  copies: number
}

/** 整份配置 —— 5 个顶层键（§2.1）。两个弹窗共用、共用**一个** localStorage 键。 */
export interface QualifiedLabelConfig {
  paper: LabelPaper
  globalFont: LabelGlobalFont
  /** `true` 时**空值字段整个不渲染**（§4.2 分支 B 的第一行）。⚠️ **不影响固定张数**，只影响单张里有啥 */
  autoHideEmpty: boolean
  /** ★ **顺序即默认顺序**，清洗按 `key` 合并（不是按下标），永远是默认那 11 条 */
  fields: LabelField[]
  print: LabelPrintConfig
}

/**
 * 行对象（旧版 `lable()` 的产物 / 新版 `printPayloads.labelRows('lable')`）。
 *
 * **全字段可选**：取值走别名表（`fieldAliases.ts`）且旧版一律 `void 0 !==` / `!== null` 判空，
 * 缺字段不抛。本层要求「能用字符串下标取值」，**不认识任何业务字段**。
 */
export interface LabelRow {
  [extra: string]: unknown
}

/**
 * 固定张数设置（§5.2，QL 独有）。
 *
 * `enabled` 关着、或行集为空 → **原样返回**（不补齐）；
 * 开启时把行集**循环取模**补齐到 `value` 条（`Cr`，`H@≈355640`）。
 */
export interface FixedQuantitySetting {
  enabled: boolean
  /** 1–99（`L` = `round` → clamp，非有限值回 1） */
  value: number
}
