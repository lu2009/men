// 自定义生产单2 · **组件层**档案 —— 与 `glassSheet2UiProfile.ts` 对称的另一半。
//
// 核心层档案在 `../utils/productionsheet2/profile.ts`（前缀 `ps` / 两个键名 / **9 列**默认配置 /
// `keepEmptyLines:true` / case 表），这里**转发**它，不重抄。
//
// 施工图：`docs/custom-docs-recon/01-diff.md` §10（组件层字符串差异表）。
// 与 GS2 的差异**只有 4 条**落进本文件：`text` 的 4 个字面量（抽屉标题 / 编辑按钮 /
// 空数据警告 / Loading 文案）+ 2 个弹窗标题；其余（api 接线形状、`classes` 派生规则）完全同构。

import {
  buildProductionSheet2Html,
  createDefaultConfig,
  createQrSvgProvider,
  loadProductionSheet2Settings,
  paginateWithMeasure,
  renderPreviewTable,
  saveProductionSheet2Config,
  saveProductionSheet2Printer,
} from '../utils/productionsheet2'
import { PRODUCTIONSHEET2_PROFILE } from '../utils/productionsheet2/profile'
import { createQrEncoder } from '../utils/productionsheet2/qr'
import { printProductionSheet2Direct } from '../utils/productionsheet2/print'
import type { ProductionSheet2Row } from '../utils/productionsheet2/types'
import { createPrintPayloads, type PrintContext } from '../utils/printPayloads'
import { createDocSheetUiProfile, type DocSheetUiProfile } from './docSheetUi'

/**
 * PS2 的组件层档案。
 *
 * ⚠️ `produceRows` 是**本单据与 GS2 最根本的不同**，也是核心层唯一不表达的那处差异 ——
 * 见 `docSheetUi.ts` 的 `DocSheetUiProfile.produceRows` 头注。
 */
export const PRODUCTIONSHEET2_UI_PROFILE: DocSheetUiProfile = createDocSheetUiProfile({
  core: PRODUCTIONSHEET2_PROFILE,
  text: {
    // 文档 `<title>` 字面量（§3.1 / PS2:703）—— 也是抽屉标题。
    drawerTitle: PRODUCTIONSHEET2_PROFILE.documentTitle, // 「自定义生产单2」
    // Home 工具条 key 18（§15.5 映射表 ic=15）—— GS2 是「编辑合片单」。
    editActionLabel: '编辑生产单',
    // 旧版 Home `Xr`（`Home.formatted.js:8448`，源码 @448504 附近）：
    // `qr.value.length ? Zr.value = !0 : ElementPlus.ElMessage["warning"]("暂无生产单数据")`
    // —— **是直写字面量**（不是字符串表查表），无需解码（CONFIRMED）。
    emptyEditWarning: '暂无生产单数据',
    // 新版自有（旧版这条路径不存在）。⚠️ 别照抄 GS2 那句 —— PS2 的文档名带「2」。
    readError: '读取自定义生产单2数据失败',
    // 旧版 `printDirect` 的遮罩文案（PS2:829）—— GS2 是「正在生成玻璃合片单...」。
    printLoading: '正在生成生产单...',
    // 两个弹窗的标题（PS2:946 / PS2:1400）。
    settingsTitle: '自定义生产单2 - 打印设置',
    layoutTitle: '自定义生产单2 - 布局编辑',
  },
  api: {
    loadSettings: loadProductionSheet2Settings,
    saveConfig: saveProductionSheet2Config,
    savePrinter: saveProductionSheet2Printer,
    createDefaultConfig,
    buildHtml: buildProductionSheet2Html,
    printDirect: printProductionSheet2Direct,
    paginateWithMeasure,
    renderPreviewTable,
    createQrSvgProvider,
    createQrEncoder,
  },
  /**
   * **行来源：引擎 B**（§7.2 CONFIRMED）—— 旧版 `calculateReceipt({ping:!0,diao:!0,single:!1,
   * singleRowData:null})` 那条口径，键名已核实全覆盖 PS2 要的 9 个字段：
   * `door` / `doorImg` / `OrderID` / `basicInfo` / `lockImg` / `doorsheet` / `doorframe` /
   * `windows` / `remark`（§7.2 末）。
   *
   * ⚠️ 本单据**必须**用它，不能用 `glassProduces()`：后者的 `doorframe`/`windows` 恒为 `""`
   * （§7.3），而 PS2 的 7、8 两列正是读它俩；且 `keepEmptyLines:true` 会把空串渲染成
   * `&nbsp;` 占位行（核心层档案的事），拿错行来源会让这两列整片塌掉。
   */
  produceRows: (ctx: PrintContext) =>
    createPrintPayloads(ctx).productionProduces() as ProductionSheet2Row[],
})
