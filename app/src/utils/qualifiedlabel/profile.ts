// 自定义合格标签 · 单据常量（class 名 / 4 个 localStorage 键 / 文档标题 / QR 回退 viewBox）。
//
// ⚠️ **本单据不复用底座的 `DocSheetProfile`**（§0.1 判定「表达不了」）：
//    底座缺 `fields[]`/`globalFont`/`autoHideEmpty`/`printRotate90`，
//    `cellCases` 的「列 key → 3 形态」模型也对不上「自由定位字段 + 每字段 13 个属性」。
//    ⇒ 这里是一张**显式列出全部 class 的常量表**，不是从 prefix 派生。

/**
 * 产出 HTML 用到的**全部** class（§4.1 / §4.2，全文枚举 CONFIRMED）。
 *
 * ★ **只有这 5 个**（含两个 qfield 子类）—— 旧版全文 grep 不到任何一个 `{ns}-` 派生名。
 *   ⇒ 底座那条 `ns + '-xxx'` 派生规则（`docsheet/profile.ts`）**对本单是错的**，
 *     千万别写 `createDocSheetClasses('ql')`（那会吐 `ql2-title`/`ql2-table`/…，本单一处都不吐）。
 *   §0 一页结论原话：QL 产出 HTML 的 class 只有 **`qlabel-root` / `qlabel` / `qfield` /
 *   `qfield-qr`|`qfield-text`** 四个（`qfield-qr`/`qfield-text` 是同一个 class 的两个取值）。
 */
export const QL_CLASSES = {
  /** 根容器（`QL:763`），CSS 全挂它 */
  root: 'qlabel-root',
  /** 一张标签（`QL:754`）。★ 与 `@page` 同尺寸，`page-break-after:always` 在**内联**样式里 */
  label: 'qlabel',
  /** 字段（`QL:562` / `QL:620`）—— 二维码与文本都带 */
  field: 'qfield',
  /** 二维码字段**额外**带的子类（`QL:562` / `QL:586`） */
  fieldQr: 'qfield-qr',
  /** 文本字段**额外**带的子类（`QL:620`） */
  fieldText: 'qfield-text',
} as const

/**
 * 标签 `<section>` 上的**属性选择器标记**（`QL:754` 的 `data-qlabel`）—— **值不重要，存在即可**。
 *
 * 旧版有三处消费：① `ce()`（就地编辑）用 `el.querySelector("[data-qlabel]")` 找第一张标签；
 * ② `ie()` 清理；③ 拖拽时算 mm→px 比例。
 *
 * ⚠️ **新版不做就地编辑四件套**（§7 / §10.1 D2：Home 从不调用
 * `enterEditMode`/`exitEditMode`/`toggleEditMode`/`isEditMode`，且它们不在任何一张字符串表里
 * —— 彻底的死 API）⇒ 本仓库里它**暂时没有消费者**，但**照抄在 HTML 里**：
 * 它是产物的结构事实，且 `data-key` 与它一起构成「预览 DOM 可被外部脚本操作」的契约。
 */
export const QL_DATA_ATTR = 'data-qlabel'

/**
 * **布局编辑器**的 class（§3.1，CONFIRMED）。
 *
 * ⚠️ 这些是**组件层**（`QualifiedLabelLayoutDialog.vue`）用的，本层只声明不消费 ——
 *    与 `qlabel-root`/`qlabel` **不共用一个前缀体系**（布局用的是裸 `layout-*`），
 *    所以放在同一个常量表里、但分成两块，避免误用。
 *
 * ⚠️ **两个面板共用同一个 class**：字段设置面板与快捷批量调整面板**都是** `layout-field-editor`
 *    （`QL:2245` / `QL:2546`），旧版就是复用同一个 class，**别给它编出第二个名字**。
 *
 * ⚠️ **A 家族没有 `layout-node-selected`** —— 全文 grep 只有 PS 的 `ps-layout-node-selected` 3 处。
 *    本单画布上**没有选中高亮**，选中态只体现在右侧字段表的 `highlight-current-row` 上。
 *
 * 旧版 scoped CSS 见 `docs/custom-docs-recon/ql-scoped.css`（13 条，**带 `[data-v-1b2a6816]`**，
 * 新版组件用 `<style scoped>` 让 Vue 自己加 scope 属性，别把那个属性抄进 CSS）。
 * ★ **其中 3 条是死规则、新版不必实现**（`QL` 全文 `grep -c` = 0）：
 *   `layout-fields-list` / `layout-field-item` / `layout-field-item.active`
 *   —— 它们是旧版从别处抄来的残留（本单的字段列表走 `el-table`，不是自定义列表）。
 */
export const QL_LAYOUT_CLASSES = {
  /** 弹窗体（`QL:1922` `width:"980px"`） */
  editorWrap: 'layout-editor-wrap',
  /** 左栏 `width:280px` */
  editorLeft: 'layout-editor-left',
  /** 右栏（画布 + 字段表） */
  editorRight: 'layout-editor-right',
  canvasShell: 'layout-canvas-shell',
  canvas: 'layout-canvas',
  /** ★ 字段设置面板 **与** 快捷批量调整面板**共用** */
  fieldEditor: 'layout-field-editor',
  /** 灰标题。⚠️ 左栏「字段设置：X」与右栏「字段列表（…）」**用同一个 class**，右栏那份 `margin-top:0` */
  fieldsTitle: 'layout-fields-title',
  /** 画布上的字段节点 */
  node: 'layout-node',
  /** 画布节点：二维码（`display:flex` 居中） */
  nodeQr: 'layout-node-qr',
  /** 画布节点：文本 */
  nodeText: 'layout-node-text',
} as const

/**
 * **4 个 localStorage 键**（§2.6 末 / §骨架 §8.1）。
 *
 * 前两个是 `loadDocSheetSettingsWith` 认的那两个（形状与底座同），
 * **后两个是 QL 独有的裸字符串键** —— 用底座的 `loadRawString`/`saveRawString` 读写。
 *
 * ⚠️ **命名不统一**（旧版事实，别"顺手统一"）：模板键带 `_v2`、打印机键**没有版本号**、
 *    两个固定张数键带 `qualified_label_` 但不带 `_v`。
 *    键名来源：`HOME:3461` 的 module 级常量 `Aa`/`ka`/`Pa`/`Ia`（CONFIRMED）。
 */
export const QL_STORAGE_KEYS = {
  /** 整份配置 JSON（旧版 `Aa`；`M()` 写、`onMounted` 读） */
  template: 'qualified_label_template_v2',
  /** 打印机名，**裸串不是 JSON**（旧版 `ka`；`E()` 写、`onMounted` 读） */
  selectedPrinter: 'qualified_label_printer',
  /** 固定标签数开关，裸串 `"1"` / `"0"`（旧版 `Pa`） */
  fixedQuantityEnabled: 'qualified_label_quantity_enabled',
  /** 固定标签数数量，裸串数字（旧版 `Ia`） */
  fixedQuantityValue: 'qualified_label_quantity_value',
  /**
   * 「编辑标签」弹窗「位置」列的显隐开关，裸串 `"1"` / `"0"`。
   *
   * ⚠️ **新版新增的键，旧版没有**（旧版把这一列的显隐硬编码在门店名上）。
   * 见 `locationColumn.ts` 顶部说明。
   */
  locationColumn: 'qualified_label_location_column',
} as const

/**
 * 完整文档的 `<title>` 字面量（`QL:864`，`de`）。
 *
 * ★ **恒为这四个字，与三个入口无关**（§6.1 证据链第三条第 2 点）——
 *   `自定义合格标签` / `平开合格标签` / `推拉合格标签` 三个入口打开的是**同一个文档标题**。
 *   也**不是**用户可改的标题（本单没有标题行）。
 */
export const QL_DOCUMENT_TITLE = '自定义合格标签'

/**
 * 二维码 `viewBox` 取不到时的回退值（`QL:571-577`）。
 *
 * ★ 底座是 `'0 0 180 180'`（`docsheet/html.ts` 的缺省），**本单是 `'0 0 200 200'`** ——
 *   因为旧版 `K.write(text, 200, 200, Z)`（`QL:575`）的尺寸参数是 **200**（GS2/PS2 是 180）。
 *
 * ⚠️ **这个差别基本不进产物**（与 PS 同一条 INTERPRETED 结论）：新版编码器用
 *   `createSvgTag({scalable:true})` 不写 `width`/`height`，`viewBox` 只由 QR 矩阵尺寸决定，
 *   200/180 都不进 SVG ⇒ 走真编码器时两边逐字节相同。
 *   只有「库产出取不到 `viewBox`」这条回退路径才看得出来 —— 仍然照抄 200。
 */
export const QL_QR_FALLBACK_VIEW_BOX = '0 0 200 200'

/**
 * **空值二维码**的占位 `viewBox`（`QL:566`）。
 *
 * ★ 与上面那个回退**不是一回事**，别混：值是**空串**时旧版**根本不调编码器**，
 *   直接吐一个 `<svg … viewBox="0 0 1 1"></svg>` 的**空占位** —— 它仍占满 `width×width` 的框，
 *   且**不受 `autoHideEmpty` 影响**（`QL:560` 的 `if (!n) return` 在 `autoHideEmpty` 判断之前，
 *   而那个判断只属于文本分支）。
 */
export const QL_EMPTY_QR_VIEW_BOX = '0 0 1 1'
