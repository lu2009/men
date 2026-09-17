// C 家族自绘单据 · **组件层**档案 —— 三套弹窗（抽屉 / 布局编辑 / 打印设置）的唯一差异注入点。
//
// 施工图：`docs/custom-docs-recon/01-diff.md`（§0 四处差异 / §10 组件层字符串差异 / §11 施工清单）。
//
// 两份档案各一层，靠**同一个「单据档案」**串起来，依赖方向单向：
//   · `utils/docsheet/profile.ts`   —— **核心层**档案（类名前缀 / 两个 localStorage 键 /
//     默认列 / 空段占位开关 / 单元格 case 表）。底座与两个 `utils/<doc>/` 目录读它。
//   · 本文件（`DocSheetUiProfile`） —— **组件层**档案（文案 / 外壳 class / 模块转出 / 行来源）。
//     它**转发**核心层档案（`core` 字段），不重抄前缀 —— 见 `createDocSheetUiProfile`。
//
// ⚠️ 三处「不在本层」的差异，别往这里塞：
//   1. `&nbsp;` 空段占位（`keepEmptyLines`）—— 核心层的事，组件层一个字都不该管；
//   2. 类名前缀对**产出 HTML/CSS** 的影响（`gs-root` / `gs2-table` / `gs2-prev-table`）—— 核心层；
//   3. 两个 localStorage 键名 —— 核心层（`storage.ts` 从这里转出）。
//   本层只负责「外壳长什么样、说什么话、调哪几个函数」。

import type { DocSheetProfile } from '../utils/docsheet/profile'
import type {
  DocSheetConfig,
  DocSheetRow,
  QrEncoder,
  RenderOptions,
} from '../utils/docsheet/types'
import type { DocSheetLoadedSettings } from '../utils/docsheet/storage'
import type { PrintContext } from '../utils/printPayloads'

/**
 * 三套弹窗外壳用到的全部 class 名 —— 由**单一前缀**派生（`'gs'` / `'ps'`）。
 *
 * ⚠️ **两套前缀并存是旧版事实**（核心层 `DocSheetClasses` 头注 / §4.2 CONFIRMED）：
 * `gs-root` / `gs-sheet` 不带 `2`，`gs2-layout-*` 带 `2`。本层全部是**带 `2`** 的那套，
 * 所以派生规则只有一条：`prefix + '2' + 后缀`。
 *
 * 前 5 条（抽屉外壳）与后 2 条（打印设置外壳）是**新版自己的排版胶水** —— 旧版组件
 * 自己不渲染抽屉、也没有这两块 scoped 样式（见各组件头注的「有意偏离」）。它们跟单据走前缀
 * 只是为了让 DOM 里不出现第二种命名风格，**不承载任何保真语义**。
 */
export interface DocSheetUiClasses {
  /** 抽屉内容列 */
  drawerWrap: string
  /** 抽屉工具条 */
  drawerToolbar: string
  /** 空数据提示条 */
  drawerEmpty: string
  /** 「正在生成…」行 */
  drawerLoading: string
  /** 预览容器（横向宽表靠它滚动） */
  drawerPreview: string
  /** 打印设置：常用尺寸按钮行 */
  settingsPresets: string
  /** 打印设置：footer 按钮行 */
  settingsFooter: string
  /** 布局编辑器：整屏两栏 */
  layoutWrap: string
  /** 布局编辑器：左栏 */
  layoutLeft: string
  /** 布局编辑器：右栏 */
  layoutRight: string
  /** 布局编辑器：区块小标题（纸张 / 表格全局 / 各列设置） */
  layoutSectionTitle: string
  /** 布局编辑器：右栏灰底「纸台」 */
  layoutCanvasShell: string
  /** 布局编辑器预览：单页外壳（**在 `v-html` 串里**） */
  layoutPageWrap: string
  /** 布局编辑器预览：多页时的「第 n / m 页」标签（**在 `v-html` 串里**） */
  layoutPageLabel: string
  /** 布局编辑器预览：白纸本身（**在 `v-html` 串里**） */
  layoutCanvas: string
  /** 布局编辑器：footer 按钮行 */
  layoutFooter: string
  /** 布局编辑器：列设置表里 ↑↓ 两颗按钮的排布 */
  columnOrder: string
}

/**
 * 由**单一**前缀派生全部组件层 class 名（`'gs'` / `'ps'`）。
 *
 * ⚠️ 模板里的 class 是**动态绑定**的，但 `<style scoped>` 的选择器只能是字面量 ——
 * 所以三套共用组件的样式表把两个前缀**都写出来**（`.gs2-x, .ps2-x`）。
 * 两个前缀就是当前 C 家族的全部成员，这份「CSS 里必须同时列两个前缀」的耦合
 * 写在每套组件样式表的头注里。**新增第三张单据时要回来补一行** ——
 * TODO(未确认): 若 C 家族继续扩张，把样式改成「稳定钩子类 + 单据类」双 class 的做法更划算。
 */
export function createDocSheetUiClasses(prefix: string): DocSheetUiClasses {
  const ns = prefix + '2'
  const layout = (suffix: string): string => ns + '-layout-' + suffix
  return {
    drawerWrap: ns + '-wrap',
    drawerToolbar: ns + '-toolbar',
    drawerEmpty: ns + '-empty',
    drawerLoading: ns + '-loading',
    drawerPreview: ns + '-preview',
    settingsPresets: ns + '-settings-presets',
    settingsFooter: ns + '-settings-footer',
    layoutWrap: layout('wrap'),
    layoutLeft: layout('left'),
    layoutRight: layout('right'),
    layoutSectionTitle: layout('section-title'),
    layoutCanvasShell: layout('canvas-shell'),
    layoutPageWrap: layout('page-wrap'),
    layoutPageLabel: layout('page-label'),
    layoutCanvas: layout('canvas'),
    layoutFooter: layout('footer'),
    columnOrder: ns + '-column-order',
  }
}

/**
 * **按单据写死的**文案（§10 那张表里的全部字符串差异都落在这一组里）。
 *
 * 判据：两张单据共用的文案（`已打开打印对话框` / `打印失败: ` / `暂无预览数据` …）
 * **不进本结构**，它们作为常量留在各自组件里并注明「§10 CONFIRMED 两边逐字相同」——
 * 两边都相同的值抄两份只会招来漂移。
 */
export interface DocSheetUiText {
  /** 抽屉标题。旧版组件没有抽屉（它把 HTML 推回 Home），所以取核心层文档标题（= `<title>` 字面量） */
  drawerTitle: string
  /**
   * 工具栏那颗「编辑」按钮的文案，**同时**当 `DocEditDialog` 的标题。
   * 旧版：Home 工具条的 ` 编辑合片单 `(key 23) / ` 编辑生产单 `(key 18) —— 两边不同，是 §10 表中的一条。
   * ⚠️ 旧版那个弹窗本身**没有 title**（`ProductionEdit` 的 `el-dialog` 只有 `width="1400px"`），
   * 新版拿按钮文案当标题，这是**新版自有的一处**（GS2 已这么做），不是复刻。
   */
  editActionLabel: string
  /** 「编辑」按钮点了但一行数据都没有时的警告（旧版 Home `ii` / `Xr`，两边**不同**）。 */
  emptyEditWarning: string
  /** 读数据失败（**新版自有**：旧版没有这条路径）。 */
  readError: string
  /** 生成打印文档时的遮罩文案（旧版 `printDirect`，GS:803 / PS2:829，两边**不同**）。 */
  printLoading: string
  /** 打印设置弹窗标题（GS:921 / PS2:946）。 */
  settingsTitle: string
  /** 布局编辑弹窗标题（GS:1377 / PS2:1400）。 */
  layoutTitle: string
}

/**
 * 本单据 `utils/<doc>/` 出口里**组件层真正用到**的那几个函数 —— 显式列出、显式改名，
 * 免得共用组件去 `import * as` 再按名字猜（两张单据的导出名不同：
 * `buildGlassSheet2Html` vs `buildProductionSheet2Html`、`loadGlassSheet2Settings` vs
 * `loadProductionSheet2Settings`）。
 *
 * 参数类型统一成底座的 `DocSheetRow` / `DocSheetConfig`：两张单据的类型都是它们的
 * 别名或子类型（见 `utils/docsheet/types.ts`），所以这里是**收窄方向**、不是放宽。
 */
export interface DocSheetUiApi {
  /** 一次载入的两项（生效配置 + 裸字符串打印机名，GS:686-774 / PS2:709-803）。 */
  loadSettings(): DocSheetLoadedSettings
  /** 配置落盘 —— **两个弹窗共用同一个键**（§6.3 / §8）。 */
  saveConfig(config: DocSheetConfig): void
  /** 打印机名落盘 —— **裸字符串，不 JSON**，选中即写。 */
  savePrinter(name: string): void
  /** 默认配置工厂（旧版 `a()`）—— 三颗「重置默认」按钮都用它，**每次返回全新对象**。 */
  createDefaultConfig(): DocSheetConfig
  /** 根容器 HTML（旧版 `j`，读**生效配置**）。 */
  buildHtml(rows: DocSheetRow[], config: DocSheetConfig, opts?: RenderOptions): Promise<string>
  /** 直接打印（旧版 `printDirect`：重建文档 → iframe → 300ms → print）。 */
  printDirect(rows: DocSheetRow[], config: DocSheetConfig, opts?: RenderOptions): Promise<void>
  /** 量测 + 切页（旧版 `H`）—— 布局编辑器的右侧预览走它，用的是**草稿**配置。 */
  paginateWithMeasure(
    rows: DocSheetRow[],
    config: DocSheetConfig,
    opts?: RenderOptions,
  ): Promise<DocSheetRow[][]>
  /** 布局编辑器预览表（旧版 `S`）。 */
  renderPreviewTable(rows: DocSheetRow[], config: DocSheetConfig, opts?: RenderOptions): string
  /** 二维码 SVG provider（旧版是模块级单例 + Map 缓存；新版按组件实例一份）。 */
  createQrSvgProvider(encode: QrEncoder): QrEncoder
  /** 二维码编码器（本仓库用 `qrcode-generator` 顶旧版的 zxing，见 `utils/docsheet/qr.ts`）。 */
  createQrEncoder(): QrEncoder
}

/** 一张单据在**组件层**的全部差异。 */
export interface DocSheetUiProfile {
  /** 核心层档案（同一个「单据档案」）—— 组件层读它的 `prefix` 与 `documentTitle`。 */
  core: DocSheetProfile
  /** 由 `core.prefix` 派生的外壳 class 名。 */
  classes: DocSheetUiClasses
  text: DocSheetUiText
  api: DocSheetUiApi
  /**
   * **行数据来源** —— 两张单据最根本的不同，也是核心层**唯一**不表达的那处差异
   * （§0 差异 #1 / §7.2）：
   *   · GS2 → `createPrintPayloads(ctx).glassProduces()`（= 旧版 `calculateGlass()`）
   *   · PS2 → `createPrintPayloads(ctx).productionProduces()`（= 旧版 `calculateReceipt()`
   *     的 `{ping:!0,diao:!0,single:!1,singleRowData:null}` 口径）
   * 返回值**首尾相接**就是整份单据的行（多张订单 = 各单的行拼接，旧版 `oi` / `qr` 就是全量行）。
   */
  produceRows(ctx: PrintContext): DocSheetRow[]
}

/**
 * 装配一张单据的组件层档案 —— `classes` 由 `core.prefix` 派生，**别在调用处手写**。
 */
export function createDocSheetUiProfile(input: {
  core: DocSheetProfile
  text: DocSheetUiText
  api: DocSheetUiApi
  produceRows: (ctx: PrintContext) => DocSheetRow[]
}): DocSheetUiProfile {
  return { ...input, classes: createDocSheetUiClasses(input.core.prefix) }
}

// --------------------------------------------------------------------------- //
// 两张单据**逐字相同**的组件层常量（§10 CONFIRMED）—— 只写一份
// --------------------------------------------------------------------------- //

/**
 * 「编辑XX」弹窗的列定义 —— 旧版 `ProductionEdit` 是**按字段名硬编码**的（§15.2），
 * 而 ic=15（PS2）与 ic=16（GS2）**用的是同一个组件**（§15.5 的映射表），所以列定义两边相同。
 *
 * ⚠️ 这张列清单与两张单据**自己的版式列**都不是同一组（§15.2 的 ⚠️）：
 *   · 弹窗里改不到 `client`（客户）与 `lockImg`（方向）；
 *   · 弹窗的「门扇材料」写的是 `doorsheet`（同字段两个标题）；
 *   · 弹窗的「门框材料」「亮窗/扣板」（`doorframe`/`windows`）对 GS2 是**多余的两列**
 *     （GS2 的行里这两个字段恒为 `""`），但旧版就是照渲染 —— 照抄。
 */
export const DOC_EDIT_COLUMNS: { key: string; label: string; width: number }[] = [
  { key: 'OrderID', label: '单号', width: 150 },
  { key: 'door', label: '型材/颜色', width: 180 },
  { key: 'basicInfo', label: '基本信息', width: 200 },
  { key: 'doorsheet', label: '门扇材料', width: 200 },
  { key: 'doorframe', label: '门框材料', width: 200 },
  { key: 'windows', label: '亮窗/扣板', width: 200 },
  { key: 'doorImg', label: '门图', width: 180 },
  { key: 'remark', label: '备注', width: 200 },
]

/** 旧版 `ProductionEdit` 的换行转换字段，**严格 5 个**（`remark`/`OrderID`/`doorImg` **不转**）。 */
export const DOC_EDIT_BR_FIELDS = ['basicInfo', 'doorsheet', 'doorframe', 'windows', 'door']

/** 旧版 `ProductionEdit` 的门图字段（点击换图，`FileReader` → dataURL，纯本地）。 */
export const DOC_EDIT_IMAGE_FIELD = 'doorImg'

/** 旧版 `ProductionEdit` 的成功文案（`_0x12cc` 表 229）—— 两张单据共用，**不是**「已更新」。 */
export const DOC_EDIT_SUCCESS_TEXT = '生产单已更新'

// --------------------------------------------------------------------------- //
// 通用文案（新版自有 / §10 CONFIRMED 两边相同）
// --------------------------------------------------------------------------- //

/** 抽屉里一张订单都没勾时（**新版自有**：旧版组件只接受 `getData()`，不管勾选）。 */
export const UI_NO_ORDERS_HINT = '请先在订单列表里勾选要打单的订单'

/** 打印成功 —— `已打开打印对话框`（GS:840 / PS2:865，§10 CONFIRMED 逐字相同）。 */
export const UI_PRINT_OK = '已打开打印对话框'

/** 打印失败前缀 —— `打印失败: `（GS:843 / PS2:868）。注意是**半角冒号 + 一个空格**。 */
export const UI_PRINT_FAIL_PREFIX = '打印失败: '

/** 布局编辑器右侧预览的空数据占位 —— `暂无预览数据`（GS:371 / PS2:394，逐字相同）。 */
export const UI_PREVIEW_EMPTY =
  '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#999;font-size:12px;">暂无预览数据</div>'

/** 布局编辑器预览的换算常数：**1mm = 3.78px**（96dpi，GS:406 / PS2:429）。 */
export const MM_TO_PX = 3.78
