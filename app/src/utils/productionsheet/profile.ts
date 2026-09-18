// 自定义生产单 · 单据常量（class 名 / localStorage 键 / 文档标题 / QR 回退 viewBox）。
//
// ⚠️ **本单据不复用底座的 `DocSheetProfile`**（§0.1 判定「表达不了」）：
//    底座缺 `headerFields`/`tableConfig`/`doorImgBox`/`globalHeaderFont` 四块，
//    `cellCases` 的「列 key → 3 形态」模型也对不上 PS 的「自由定位字段 + 4 列固定表格」两套渲染。
//    ⇒ 这里是一张**显式列出全部 class 的常量表**，不是从 prefix 派生（决策 D1）。

/**
 * 产出 HTML 用到的**全部** class（§0.3，全文枚举 CONFIRMED）。
 *
 * ★ **只有这两个** —— `grep -c "ps2-\|gs2-\|page-num"` = **0**。
 *   ⇒ 底座那条 `ns + '-xxx'` 派生规则（`profile.ts:71-73`）**对 PS 是错的**，
 *     千万别写 `createDocSheetClasses('ps')`（那会吐 `ps2-title`/`ps2-table`/…，PS 一个都不吐）。
 *
 * ⚠️ `ps-root` / `ps-sheet` 与 **PS2 撞名** —— 旧版两个组件不同时出现在一份文档里，
 *    新版两个抽屉各自的预览是独立 `v-html`，也无事。
 */
export const PS_CLASSES = {
  root: 'ps-root',
  sheet: 'ps-sheet',
} as const

/**
 * **布局编辑器**的 class（§0.3 / §3）。
 *
 * ★ 与 PS2 的区别：PS 是 **`ps-layout-editor-*`（无 `2`、带 `editor`）**，
 *   PS2 是 `ps2-layout-*`。两者**没有一处相同**，因此不能靠前缀替换得到。
 *
 * ⚠️ 这些是**组件层**（B 家族布局编辑器，`ProductionSheetLayoutDialog.vue`）用的，
 * 本层只声明不消费 —— 与 `ps-root`/`ps-sheet` **不共用一个前缀体系**，
 * 所以放在同一个常量表里、但分成两块，避免误用。
 * CSS 见 `docs/custom-docs-recon/ps-layout.css`（11 条规则 / 1841 字符，**带 `[data-v-c55c9cb3]`**，
 * 新版组件用 `<style scoped>` 让 Vue 自己加 scope 属性，别把那个属性抄进 CSS）。
 */
export const PS_LAYOUT_CLASSES = {
  editorWrap: 'ps-layout-editor-wrap',
  editorLeft: 'ps-layout-editor-left',
  editorRight: 'ps-layout-editor-right',
  canvasShell: 'ps-layout-canvas-shell',
  canvas: 'ps-layout-canvas',
  fieldEditor: 'ps-layout-field-editor',
  fieldsTitle: 'ps-layout-fields-title',
  node: 'ps-layout-node',
  nodeSelected: 'ps-layout-node-selected',
  doorBox: 'ps-layout-door-box',
  tablePreview: 'ps-layout-table-preview',
} as const

/**
 * 两个 localStorage 键（§6.3，`HOME` 的 module 级常量，CONFIRMED）。
 *
 * ⚠️ **命名不统一**：模板键带 `_v1`，打印机键**没有** `_v1`。
 *    这是旧版事实，**别"顺手统一"** —— 统一了就读不到用户已有的存盘配置。
 */
export const PS_STORAGE_KEYS = {
  /** 整份配置 JSON（旧版 `on`） */
  template: 'production_sheet_template_v1',
  /** 打印机名，**裸串不是 JSON**（旧版 `an`） */
  selectedPrinter: 'production_sheet_printer',
} as const

/** 完整文档的 `<title>` 字面量（`PS:1332`，`ne`）。**不是**用户可改的标题 —— 本单据没有标题行。 */
export const PS_DOCUMENT_TITLE = '自定义生产单'

/**
 * 二维码 `viewBox` 取不到时的回退值（`PS:830`）。
 *
 * ★ 底座是 `'0 0 180 180'`（`html.ts:151`），**PS 是 `'0 0 200 200'`** ——
 *   因为旧版 `Z.write(text, 200, 200, X)` 的尺寸参数是 200（GS2 是 180）。
 *
 * ⚠️ **这个差别不影响产物**（INTERPRETED，§1 #33）：新版编码器用
 * `createSvgTag({scalable:true})` **不写 `width`/`height`**，`viewBox` 只由 QR 矩阵尺寸决定，
 * 180/200 都不进 SVG ⇒ 走真编码器时两边**产物逐字节相同**。
 * 只有「库产出取不到 viewBox」这条回退路径才会看出差别 —— 仍然照抄 200。
 */
export const PS_QR_FALLBACK_VIEW_BOX = '0 0 200 200'
