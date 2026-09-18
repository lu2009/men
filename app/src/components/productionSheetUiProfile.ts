// 自定义生产单（ic=14，`ProductionSheetPrintManager`）· **组件层**档案。
//
// 与 `glassSheet2UiProfile.ts` / `productionSheet2UiProfile.ts`（C 家族）**不对称**：
//   · 它们用 `createDocSheetUiProfile({core, text, api, ...})` —— class 由 `core.prefix` 派生；
//   · 本单据**没有 `core`**（核心层 `utils/productionsheet/profile.ts` 头注已判定：底座的
//     `DocSheetProfile` 表达不了 B 家族的配置模型，§0.1），且编辑器 class 是
//     `ps-layout-**editor**-*`，**不能**从前缀派生（§0.3）。
//   ⇒ 这里是一份**显式的对象字面量**，类型是 `DocSheetDialogProfile`（抽屉真正消费的那一面），
//     而不是 `DocSheetUiProfile`。原因与取舍写在 `docSheetUi.ts` 的 `DocSheetDialogProfile` 头注。
//
// 施工图：`docs/custom-docs-recon/01-ps.md`（§6.1 expose 清单 / §6.2 Home 调用点 / §3.1 / §3.7）。

import {
  buildProductionSheetHtml,
  createDefaultConfig,
  loadProductionSheetSettings,
  printProductionSheetDirect,
  PS_DOCUMENT_TITLE,
  saveProductionSheetConfig,
  saveProductionSheetPrinter,
} from '../utils/productionsheet'
import { createProductionSheetQrProvider, createQrEncoder } from '../utils/productionsheet/qr'
import type {
  ProductionSheetConfig,
  ProductionSheetRenderOptions,
  ProductionSheetRow,
} from '../utils/productionsheet/types'
import { createPrintPayloads, type PrintContext } from '../utils/printPayloads'
import {
  PRODUCTION_SHEET_UI_CLASSES,
  type DocSheetDialogProfile,
} from './docSheetUi'

/**
 * ic=14 的组件层档案**类型**（显式起个名字，好用在本单据的四个组件里）。
 *
 * ⚠️ 它是 `DocSheetDialogProfile` 而不是 `DocSheetUiProfile` —— 本单据没有 `core`、
 *    也没有 C 家族那两条只有布局编辑器才用的方法（见 `docSheetUi.ts` 的头注）。
 */
export type ProductionSheetUiProfile = DocSheetDialogProfile<
  ProductionSheetConfig,
  ProductionSheetRow,
  ProductionSheetRenderOptions
>

/**
 * ic=14 的组件层档案。
 *
 * ⚠️ `produceRows` 的**第二参 `config` 是本单据存在的理由**（决策 D2，§8.1）：
 * 它的行形状由 `print.itemsPerPage` 决定 —— `=== 2` 时要把两条记录**配对**成一条配对行。
 * 这也是本档案必须设 `rowsDependOnConfig: true` 的原因（决策 D3）：改了「每页数据数」
 * 必须**重跑配对**，否则预览还是旧版式。
 */
export const PRODUCTION_SHEET_UI_PROFILE: ProductionSheetUiProfile = {
  // 外壳 class 走**显式**的 `ps1-*` 命名空间（决策 D1(b)）——
  // ⚠️ 不是 `createDocSheetUiClasses('ps')`（那会吐 `ps2-*`，与 PS2 撞名）。
  classes: PRODUCTION_SHEET_UI_CLASSES,

  text: {
    // 文档 `<title>` 字面量（`PS:1332`）—— 旧版组件没有抽屉（它把 HTML 推回 Home），
    // 所以抽屉标题取它。本单据**没有标题行**（§7「无页码 / 无标题行」）。
    dialogTitle: PS_DOCUMENT_TITLE, // 「自定义生产单」
    // Home 工具条 key 18（§骨架 §7.3）—— PS2 那条也是「编辑生产单」，GS2 是「编辑合片单」。
    editActionLabel: '编辑生产单',
    // 旧版 Home `mc`（`HOME:10053`）：`Array.isArray(t) && t.length ? 开窗 : ElMessage.warning("暂无生产单数据")`
    // —— 直写字面量（CONFIRMED）。
    emptyEditWarning: '暂无生产单数据',
    // 新版自有（旧版这条路径不存在：读取失败走的是 Home `gi` 的 `catch` → 「生成失败: 」）。
    readError: '读取自定义生产单数据失败',
    // 旧版 `printDirect` 的 `ElLoading` 文案（`PS:1398`）。
    printLoading: '正在生成生产单...',
    // ★ 两个弹窗标题**逐字照抄旧版**（`PS:1513` / `PS:2936`）——
    //   注意设置弹窗是「- 设置」，**不是** C 家族的「- 打印设置」。
    settingsTitle: '自定义生产单 - 设置',
    layoutTitle: '自定义生产单 - 布局编辑',
  },

  /**
   * 模块转出。**只列抽屉真的会调的那 8 个**（`DocSheetRenderApi`）——
   * ic=14 没有 `paginateWithMeasure` / `renderPreviewTable`（它的分页是解析式的、
   * 编辑器预览是三种绝对定位元素拼出来的，§3.3 / §5.1）。
   */
  api: {
    loadSettings: loadProductionSheetSettings, // 旧版 `onMounted` 的载入段（`PS:1340-1357`）
    saveConfig: saveProductionSheetConfig, // 旧版 `C`（`PS:265-270`）
    savePrinter: saveProductionSheetPrinter, // 旧版 `x`（`PS:514-519`）
    createDefaultConfig, // 旧版 `a()`（`PS:33-243`）
    buildHtml: buildProductionSheetHtml, // 旧版 `oe`（`PS:1036-1321`）
    printDirect: printProductionSheetDirect, // 旧版 `printDirect`（`PS:1394-1442`）
    createQrSvgProvider: createProductionSheetQrProvider, // 旧版 `Q`（`PS:787`，回退 viewBox 是 200）
    createQrEncoder, // 本仓库用 `qrcode-generator` 顶旧版 vendor 里的 zxing（见 `docsheet/qr.ts`）
  },

  /**
   * 渲染选项 —— ★ 键是 **`qrSvg`**（`ProductionSheetRenderOptions`），不是 C 家族的 `qr`。
   * 这就是它必须由档案构造、而不是由抽屉自己拼的原因（`createRenderOpts` 的头注）。
   *
   * 每次调用新建一个 provider（旧版是模块级单例 `Z` + Map 缓存 `Q`）——
   * 抽屉只在 `setup` 里调一次，等价于「按抽屉实例一份」（见 `qr.ts` 末的 ⚠️）。
   */
  createRenderOpts: () => ({
    qrSvg: createProductionSheetQrProvider(),
  }),

  /**
   * **行来源** —— `printPayloads.oldSheetProduces(paired)`（§6.4 逐键核对 CONFIRMED）。
   *
   * 它是旧版 `calculateReceiptOld()`（Home `gi` 里的 `await lc.value["calculateReceiptOld"]()`，
   * 无参）的等价物：14 个平铺键（含 ic=14 独有的 `maker`/`lockway`、**小写 d** 的 `orderID`）
   * + `oldSheet:[{doorsheet,doorframe,windows,doorImg}]` 嵌套。
   *
   * ⚠️ **不能**换 C 家族的 `productionProduces()`（那是 ic=15 的口径）：它的行**没有嵌套**、
   * 没有 `size`/`maker`/`lockway`，12 个 headerFields 会塌掉一半。
   *
   * ⚠️ 配对**只在这一处做**（决策 D2/D3 + §9.2）：旧版是 Home 的 `Sr()`→`sc()` 配对、
   * 编辑弹窗保存后 `wc` 又跑一次 `Sr()` ⇒ **二次配对**（一次汇算 ≥4 张订单且开「2 条/页」时
   * 会产出 `orderID11` 这类脏键）。新版不复刻这条缺陷，见 `DocSheetDialog.onRowsSaved` 的注。
   */
  produceRows: (ctx: PrintContext, config: ProductionSheetConfig): ProductionSheetRow[] =>
    createPrintPayloads(ctx).oldSheetProduces(config.print.itemsPerPage === 2),

  /** ★ 决策 D3（§8.1）：本单据的行形状随 `print.itemsPerPage` 变，配置保存后**必须**重建行。 */
  rowsDependOnConfig: true,
}
