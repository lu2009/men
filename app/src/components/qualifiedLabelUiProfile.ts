// 自定义合格标签族（ic=13，`QualifiedLabelPrintManager`）· **组件层**档案。
//
// ⚠️ **本单据与三张 C 家族（GS2/PS2）以及 B 家族（ic=14）都不同族**（施工图 §0 一页结论）：
//   · 没有 `core`（底座的 `DocSheetProfile` 表达不了本单的 `fields[]`/`globalFont`/
//     `autoHideEmpty`/`printRotate90`，见 `utils/qualifiedlabel/profile.ts` 头注）；
//   · 产出 HTML 的 class 是 `qlabel-root`/`qlabel`/`qfield`（**另一套命名**，不从任何前缀派生）；
//   · 布局编辑器的 class 是**裸的** `layout-editor-*` / `layout-canvas*` / `layout-node*`
//     （`QL_LAYOUT_CLASSES`），同样与前缀无关。
//   ⇒ 这里是一份**显式的对象字面量**，类型是 `DocSheetDialogProfile`（抽屉真正消费的那一面），
//     与 `productionSheetUiProfile.ts`（ic=14）同一形态。
//
// 施工图：`docs/custom-docs-recon/01-ql.md`（§3 布局编辑器 / §5.2 固定张数 / §6 三入口 / §9 数据源）。
//
// ★★ **本文件存在的最大理由：三入口的行过滤**（§6.1 / §9 / §10.1 D1）。
//    旧版三个入口（`br`/`Dr`/`Ar`）打开的是**同一个组件**，只是喂给 `lable()` 的参数不同：
//      · `自定义合格标签` → `lable()`              = `{ping:true, diao:true}`（全都要）
//      · `平开合格标签`   → `lable({ping:!0,diao:!1})`
//      · `推拉合格标签`   → `lable({ping:!1,diao:!0})`
//    ⇒ 组件**完全无感**（§6.1 的证据链：props 里没有 `mode`/`kind`/`ic`，全文 grep `ping`/`diao`
//      零命中，两个弹窗标题与 `<title>` 恒为常量）——所以新版**只做一张单据**，
//      三个入口只是「先对行做一次过滤，再喂给同一个 build」。
//    ⚠️ **过滤在这里做，不在 `printPayloads.ts`**：施工图 §10.1 D1 推荐给 `labelRows` 加
//      `opts?: {ping, diao}`，但那要改 `app/src/utils/`（本次任务的硬规矩：**不改 utils/**），
//      而 `produceRows(ctx)` 拿到的 `ctx` 本就是可自由裁剪的普通对象 ⇒
//      **在档案里把 `ctx.lines` 过滤掉再构造 payloads**，产物与「给 labelRows 加参数」逐条等价。
//      （`createPrintPayloads` 只读 `ctx.lines` / `ctx.order` / `ctx.tenantName` / `ctx.formulaImages`
//       等字段，`{...ctx, lines: 过滤后的}` 是同一个对象换掉一个数组，语义无损。）

import {
  buildQualifiedLabelHtml,
  createDefaultConfig,
  createQualifiedLabelQrProvider,
  loadFixedQuantitySetting,
  loadQualifiedLabelSettings,
  padToFixedQuantity,
  printQualifiedLabelDirect,
  saveQualifiedLabelConfig,
  saveQualifiedLabelPrinter,
  QL_DOCUMENT_TITLE,
} from '../utils/qualifiedlabel'
import { createQrEncoder } from '../utils/qualifiedlabel/qr'
import type {
  LabelRow,
  QualifiedLabelConfig,
  QualifiedLabelRenderOptions,
} from '../utils/qualifiedlabel'
import { createPrintPayloads, type PrintContext } from '../utils/printPayloads'

/**
 * 订单行类型 —— 直接取自 `PrintContext['lines']` 的元素类型。
 *
 * ⚠️ **不从 `partsEngine` 直接 import `Line`**：本文件的依赖面停在「`printPayloads` 的入口契约」
 * 这一层就够（`Line` 在 `printPayloads.ts` 里只是 `import type` 进来的、没有转出）。
 */
type LabelLine = PrintContext['lines'][number]
import { createDocSheetUiClassesFromNs, type DocSheetDialogProfile } from './docSheetUi'

/**
 * **三个入口**（§6.1 的表格，CONFIRMED）。
 *
 * `all` = 旧版不传参的 `lable()`（`{ping:true,diao:true}`）；另两个各只留一种行。
 */
export type QualifiedLabelEntry = 'all' | 'ping' | 'diao'

/** ic=13 的组件层档案类型（显式起名，好用在三个组件里）。 */
export type QualifiedLabelUiProfile = DocSheetDialogProfile<
  QualifiedLabelConfig,
  LabelRow,
  QualifiedLabelRenderOptions
>

/**
 * 合格标签族的外壳 class（**只有抽屉那 5 条**）。
 *
 * ⚠️ 本单**没有 `core.prefix`** ⇒ 走显式的 `ns = 'ql'`。
 * ⚠️ 这里**只**覆盖 `DocSheetDialog.vue` 真正读的那 5 个成员（`dialogWrap`/`dialogToolbar`/
 *    `dialogEmpty`/`dialogLoading`/`dialogPreview`）—— 接口里剩下的 `layout*`/`settings*`/
 *    `columnOrder` 成员是被派生出来但**本单不会用到**的（本单的布局编辑器用核心层的
 *    `QL_LAYOUT_CLASSES`，设置弹窗没有任何 scoped 样式），照抄 `createDocSheetUiClassesFromNs`
 *    的结果即可，别拿它们去当 `layout-editor-*` 的替代品。
 */
const QUALIFIED_LABEL_UI_CLASSES = createDocSheetUiClassesFromNs('ql')

/**
 * 按入口过滤行（旧版 `lable({ping, diao})` 的等价物，§6.1）。
 *
 * ★ 判据是 `line.line_type`：
 *   · `ping` → 只留 `'ping'` 行（**含钻石/固玻行** —— 它们在数据层同样是 `line_type === 'ping'`，
 *     旧版 `ping_hui` 也是把它们算在平开那一边的，见 `printPayloads.ts` 里
 *     `isDiamond(l) && l.line_type !== 'diao'` 的用法）；
 *   · `diao` → 只留 `'diao'` 行；
 *   · `all`  → **原样返回同一个数组引用**（旧版默认参数就是这么走的，不做无谓的复制）。
 *
 * ⚠️ `line_type` 是 `string`（不是联合类型），所以比较用字面量；未知取值在 `ping`/`diao`
 *    两个入口下都会被滤掉 —— 与旧版「只从 `ping_hui` / `diao_hui` 里取」一致。
 */
export function filterLabelLines(lines: LabelLine[], entry: QualifiedLabelEntry): LabelLine[] {
  if (entry === 'all') return lines
  return lines.filter((line) => line.line_type === entry)
}

/**
 * 造一张**按入口绑定**的组件层档案（`QualifiedLabelDialog.vue` 每次切换入口时调一次）。
 *
 * @param entry 三个入口之一（`all` / `ping` / `diao`）。
 */
export function createQualifiedLabelUiProfile(entry: QualifiedLabelEntry): QualifiedLabelUiProfile {
  return {
    classes: QUALIFIED_LABEL_UI_CLASSES,

    text: {
      // 抽屉标题。旧版组件**没有抽屉**（它把 HTML 字符串推回 Home 的预览容器），
      // 所以取核心层的文档 `<title>` 字面量 —— ★ 它在三个入口下**恒为这四个字**（§6.1 证据链 3）。
      dialogTitle: QL_DOCUMENT_TITLE, // 「自定义合格标签」
      // 工具条 key 13 的「 编辑标签 」按钮（§7.3 / §8.2 的 `kc`）。
      editActionLabel: '编辑标签',
      // 旧版 Home `kc`：`Cc.length ? 开窗 : ElMessage.warning("暂无标签数据")`
      // （`Home.formatted.js:10352`，字面量由 `dr` 表 index 1295 解出，CONFIRMED）。
      emptyEditWarning: '暂无标签数据',
      // 新版自有（旧版读取失败走的是 Home `gi` 的 `catch` → 「生成失败: 」）。
      readError: '读取自定义合格标签数据失败',
      // 旧版 `printDirect` 自己的 `ElLoading` 文案（`QL:933-937`，逐字「正在生成标签...」）。
      printLoading: '正在生成标签...',
      // 两个弹窗标题**逐字照抄**（`QL:1088` / `QL:1922`）。
      settingsTitle: '自定义合格标签 - 设置',
      layoutTitle: '自定义合格标签 - 布局编辑',
      // ★ 这两条是**本单据独有的按钮文案**（§7.3 CONFIRMED 四张单据不统一）：
      //   设置按钮 QL=「标签机设置」（GS2/PS2=「打印设置」、ic=14=「生产单设置」）；
      //   布局按钮 QL 与 PS=「编辑布局」（GS2/PS2=「布局设置」）。
      settingsActionLabel: '标签机设置',
      layoutActionLabel: '编辑布局',
    },

    api: {
      loadSettings: loadQualifiedLabelSettings, // 旧版 `onMounted` 的载入段（`QL:873-889` 前两段）
      saveConfig: saveQualifiedLabelConfig, // 旧版 `M`（`QL:235-240`）
      savePrinter: saveQualifiedLabelPrinter, // 旧版 `E`（`QL:369-374`，裸字符串、选中即写）
      createDefaultConfig, // 旧版 `a()`（`QL:23-205`）
      /**
       * 旧版 `ae`（`QL:719-766`）**声明成 `async` 但全文 0 个 `await`** ——
       * 新版核心层 `buildQualifiedLabelHtml` 是纯同步的，这里包一层 `async`
       * 只为满足抽屉 `await profile.api.buildHtml(...)` 的契约（语义不变，少一层微任务）。
       */
      buildHtml: async (rows, config, opts) => buildQualifiedLabelHtml(rows, config, opts),
      printDirect: printQualifiedLabelDirect, // 旧版 expose 的 `printDirect`（`QL:931-985`）
      createQrSvgProvider: createQualifiedLabelQrProvider, // 旧版 `X`（回退 viewBox 是 200，见 `qr.ts`）
      createQrEncoder, // 本仓库用 `qrcode-generator` 顶旧版 vendor 里的 zxing
    },

    /**
     * 渲染选项 —— 键是 C 家族同名的 **`qr`**（`QualifiedLabelRenderOptions`）。
     * 每次调用新建一个 provider（旧版是组件级 Map 缓存 `X`）；抽屉只在 `setup` 里调一次。
     */
    createRenderOpts: () => ({
      qr: createQualifiedLabelQrProvider(),
    }),

    /**
     * **行来源** —— `printPayloads.labelRows('lable')`（§9 逐键核对 CONFIRMED：
     * 11 个 field key 全部命中，含 `remark` 的 `<br>` 语义 —— 本单**不解释 `<br>`**，
     * 会逐字显示，与旧版一致），再按**固定张数**补齐。
     *
     * ⚠️ **`ctx` 是「换了 `lines` 的浅拷贝」**（见文件头注）：`createPrintPayloads` 只读
     *    `ctx.lines` 等字段，换个数组引用即可，其余字段（`order`/`formulaImages`/`tenantName`…）
     *    原样透传。
     *
     * ★★ **固定张数在这里补齐 = 旧版 Home 的 `Cc = Cr(zc)`**（§5.2，`H@≈355640`）：
     *    旧版是 Home 在 `buildQualifiedLabelHtml(Cc)` **之前**把行集循环取模补齐到 N 条，
     *    三个入口**都**这么做 ⇒ 新版把它放到「行来源」这唯一一处，预览与打印**同时**拿到补齐后的行
     *    （`printDirect` 也吃这个 `rows`，与旧版 `de()` 无参时回落 `getLabels()` = 补齐后的 `Cc` 一致）。
     *    ⚠️ **`config` 仍然用不上** —— 固定张数**不在配置里**，它是两个**裸串 localStorage 键**
     *    （`qualified_label_quantity_enabled` / `_value`），所以这里现读（`loadFixedQuantitySetting`），
     *    与旧版从组件实例的 `C`/`z` 两个 ref 上读是同一个值（那两个 ref 只在设置弹窗保存时写）。
     */
    produceRows: (ctx: PrintContext): LabelRow[] => {
      const scoped: PrintContext = { ...ctx, lines: filterLabelLines(ctx.lines, entry) }
      const rows = createPrintPayloads(scoped).labelRows('lable')
      return padToFixedQuantity(rows, loadFixedQuantitySetting())
    },

    /**
     * ★ **行是否随配置变化 = `true`**（决策 D3 的同一套机制，见 `DocSheetUiProfile.rowsDependOnConfig`）。
     *
     * 本单据的**行数**由「固定标签数」决定，而那个设置是**设置弹窗保存时**写盘的
     * （`saveFixedQuantitySetting` 写两个裸串键）⇒ 设置弹窗一保存，抽屉必须**重跑一次
     * `produceRows`** 才能看到新的张数。
     *
     * ⚠️ 这正是旧版 `onFixedQuantityChange` 回调链的等价物（`QL:417-421`：
     *    设置弹窗点「保存并应用」→ `if (props.isActive?.())` → `props.onFixedQuantityChange()`
     *    → Home 侧 `Cc = Cr(zc)` → 重建 HTML → 刷预览）。
     *    ⚠️ 旧版 **`k` 无条件调** `onFixedQuantityChange`（不判断固定张数是否真的变了）——
     *    新版判据同样**不看配置内容是否真的变了**（`DocSheetDialog.onConfigSaved` 的既有口径：
     *    `produceRows` 对同一份输入是纯函数，多跑一次无副作用）。
     * ⚠️ 与 ic=14 的区别：那边随配置变的是**行形状**（配对），这边变的是**行数**（补齐）。
     *
     * ⚠️⚠️ **有意偏离（一处，由 `true` 带来的副作用，必须记一笔）**：
     *    `DocSheetDialog.onConfigSaved` **不区分是哪个弹窗保存的**，所以**布局编辑器**保存时
     *    也会重建一次行。于是这条链路：
     *      「编辑标签」改过行 → 保存 → 再开「布局编辑」/「标签机设置」并保存
     *    在新版里会把**编辑标签的改动冲掉**（行被重新推导），而旧版**不会** ——
     *    旧版布局保存走 `ne()` = `ae()`（**无参**），它回落到 `props.getLabels()`，
     *    拿到的正是 Home 那份**已被编辑覆盖**的 `Cc`（`QL:901` / `Pc` 的 `Cc = labels`）。
     *
     *    为什么仍然这么做：①**没有别的钩子** —— 抽屉只有在「配置保存后」这一个时机重建行，
     *    而固定张数是本次唯一能让抽屉感知到变化的通道；②**改动本来就是会话级的** ——
     *    旧版下次进入三个入口时 `Cc = Cr(zc)` 同样会从零重算，编辑结果从不落库；
     *    ③ 与 ic=14 的既有处置同源（`DocSheetDialog.onRowsSaved` 的注：编辑结果只活在本抽屉的
     *    这一次会话里，不复刻旧版的二次配对缺陷）。
     *    ⇒ 差异只在「编辑过行 **且** 之后又保存过某个设置弹窗」这一组合下可见，
     *    且**不涉及任何落库产物**（配置与固定张数两个键的写入都与它无关）。
     */
    rowsDependOnConfig: true,
  }
}
