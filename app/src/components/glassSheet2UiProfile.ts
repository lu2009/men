// 自定义玻璃合片单 · **组件层**档案 —— 把 GS2 的外壳文案 / class / 模块接线 / 行来源填进 `DocSheetUiProfile`。
//
// 核心层档案在 `../utils/glasssheet2/profile.ts`（前缀 `gs` / 两个键名 / 8 列默认配置 /
// `keepEmptyLines:false` / case 表），这里**转发**它，不重抄。
//
// 三处组件层差异（§10 / §11 第 6 条），逐条落点：
//   · 类名前缀 `gs` → 由 `core.prefix` 派生（`createDocSheetUiProfile`）
//   · 弹窗标题 / Loading 文案 / 工具栏「编辑」按钮 → `text`
//   · 行数据来源 → `produceRows`（**核心层不表达的那一处**）

import {
  buildGlassSheet2Html,
  createDefaultConfig,
  createQrSvgProvider,
  loadGlassSheet2Settings,
  paginateWithMeasure,
  renderPreviewTable,
  saveGlassSheet2Config,
  saveGlassSheet2Printer,
} from '../utils/glasssheet2'
import { GLASSSHEET2_PROFILE } from '../utils/glasssheet2/profile'
import { createQrEncoder } from '../utils/glasssheet2/qr'
import { printGlassSheet2Direct } from '../utils/glasssheet2/print'
import type { GlassSheet2Row } from '../utils/glasssheet2/types'
import { createPrintPayloads, type PrintContext } from '../utils/printPayloads'
import { createDocSheetUiProfile, type DocSheetUiProfile } from './docSheetUi'

/**
 * GS2 的组件层档案。
 *
 * ⚠️ 全部按单据写死的值都在这儿，**别散回组件里**。
 */
export const GLASSSHEET2_UI_PROFILE: DocSheetUiProfile = createDocSheetUiProfile({
  core: GLASSSHEET2_PROFILE,
  text: {
    // 旧版组件把 HTML 推回 Home，自己没有标题栏 —— 取文档 `<title>` 字面量（§3.1）。
    dialogTitle: GLASSSHEET2_PROFILE.documentTitle, // 「自定义玻璃合片单」
    // Home 工具条 key 23（§11.4）—— PS2 是「编辑生产单」，两边不同。
    editActionLabel: '编辑合片单',
    // 旧版 Home `ii`（@363242）的整句：`oi.value.length ? … : ElMessage.warning(e(646))`，
    // `e(646)` 经 /tmp/home-map.json 的 `dr` 表解出即此串（CONFIRMED）。
    emptyEditWarning: '暂无玻璃合片单数据',
    // 新版自有（旧版这条路径不存在 —— 它读的是已在内存里的 `oi`，不重新拉数据）。
    readError: '读取自定义玻璃合片单数据失败',
    // 旧版 `printDirect` 的遮罩文案（GS:803）—— PS2 是「正在生成生产单...」，两边不同。
    printLoading: '正在生成玻璃合片单...',
    // 两个弹窗的标题（GS:921 / GS:1377）。
    settingsTitle: '自定义玻璃合片单 - 打印设置',
    layoutTitle: '自定义玻璃合片单 - 布局编辑',
  },
  api: {
    loadSettings: loadGlassSheet2Settings,
    saveConfig: saveGlassSheet2Config,
    savePrinter: saveGlassSheet2Printer,
    createDefaultConfig,
    buildHtml: buildGlassSheet2Html,
    printDirect: printGlassSheet2Direct,
    paginateWithMeasure,
    renderPreviewTable,
    createQrSvgProvider,
    createQrEncoder,
  },
  /**
   * **行来源：引擎 A**（§11 第 9 条 / §7.2）。
   * 旧版这份行来自 Hui 的 `calculateGlass()`；新版从订单上下文出发走同一套行构造
   * （`printPayloads.ts:748 glassProduces()`），不重写数据层。
   *
   * ⚠️ 与 PS2 的 `productionProduces()` **是两套完全不同的生成器**（§7.3 对照表）：
   * `door` 不带客户、`doorsheet` 带「数量:N」汇总行、`doorframe`/`windows` **恒为 `""`**……别混用。
   */
  produceRows: (ctx: PrintContext) =>
    createPrintPayloads(ctx).glassProduces() as GlassSheet2Row[],
})
