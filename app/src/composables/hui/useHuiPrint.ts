/**
 * 「打印出口 + 打印载荷」—— 2026-09-20 从 `Hui.vue` 搬出（逻辑逐字未改，C10，**C 批最后一块**）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）是**三段**（中间隔着「模板预览 / 订单列表」那些没跟着搬的件）：
 *   · `Hui.vue:1941-1980` —— `printLabels` / `formulaImages` / `loadFormulaImages` /
 *     `ensureFormulaImages`，**4 个声明**
 *   · `Hui.vue:2039-2079` —— `printGlass` / `printGlassHole` / `printProductionCustom`，**3 个声明**
 *   · `Hui.vue:2152-2175` —— `printCtx` / `printApi`，**2 个声明**
 * 三段合计 **9 个声明**。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C10 一条）。
 *
 * ## 🔴 注入面 = **14 项**（plan `:829` 写的是「12 项」—— **实测 14**，差在 `today` 与 `markupError`
 * 这两项当时没数进去；以本表为准）
 *
 * | # | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|---|
 * | 1 | `order` | **脊梁** `reactive` | `printCtx.order` |
 * | 2 | `lines` | **脊梁** `ref<Line[]>` | 四个打印出口的「暂无订单行」判空 + `printCtx` |
 * | 3 | `formulas` | **脊梁** `ref<FormulaDto[]>` | `printCtx.formulas` |
 * | 4 | `clients` | C5 `useHuiClients` 回传 | `printCtx.clients` |
 * | 5 | `tenantName` | C7 `useTerminalLink` 回传 | `printCtx.tenantName` |
 * | 6 | `currentUserName` | C7 回传 | `printCtx.maker` |
 * | 7 | `payQrcodeUrl` | C3 `useHuiPayQrcode` 回传 | `printCtx.payQrcode` |
 * | 8 | `terminalLink` | C7 回传 | `printCtx.terminalLink` |
 * | 9 | `showPing` | C2 `useHuiColumnConfig` 回传 | `printCtx.showPing` |
 * | 10 | `showDiao` | C2 回传 | `printCtx.showDiao` |
 * | 11 | `sortMethod` | C13 `useHuiSortMethod` 回传 | `printCtx.sortMethod`（生产类单据的行顺序） |
 * | 12 | `today` | 页面 `function today()`（**没搬**） | `printCtx.today` |
 * | 13 | `markupError` | 引擎 `useOrderLines` 解构出来的那个 | `printCtx.onMarkupError` |
 * | 14 | `message` | 页面 `useMessage()` | 四个打印出口的提示 |
 *
 * `api` / `printByMode` / `createPrintPayloads` / `PrintContext` / `FormulaImageDto` / `Line`
 * 都是**模块级导出** ⇒ 直接 `import`，**不进注入面**。
 *
 * ## 🔴🔴 注入项一律**传引用本身** —— 传值 ⇒ **打印内容冻结在注入那一刻**（spec §3.3 点名的雷）
 *
 * `printCtx` 是一个 `computed`：它每次重算都去读 `deps.*.value`。
 *   · ✅ 传 ref/reactive（`order` / `lines` / `formulas` / `clients` / `tenantName` / …）
 *     ⇒ 改订单、改行、切两表显隐、换排序方式，**打印内容跟着变**（与搬之前逐字同义）；
 *   · ❌ 传值（`lines: lines.value`、`tenantName: tenantName.value`…）⇒ `deps.lines` 是个**快照**，
 *     `computed` 再也追不到后续修改 ⇒ **打印出来永远是"打开页面那一刻"的内容**：
 *     新加的行走不进玻璃单、隐藏的移门照样打、改了排序方式也没反应。
 *     **一律不报错**，而且 `vue-tsc` 只有在类型对不上时才会响（`.value` 用错会 `TS2339`，
 *     但**直接传值再也不用 `.value`** 这种写法可以完全静默）。
 * ⇒ 这一条**守卫验不了**（它只比文本）；**改注入面的人必须逐项确认传的是引用**。
 *
 * ⚠️ `today` / `markupError` 是**函数**，传函数引用即可（它们不是 ref，没有 `.value`）。
 *
 * ## 回传面 = **5 项**（其余 4 个声明在页面里**零读者**）
 *
 * | 名字 | 页面（`Hui.vue`）里剩下的读者 |
 * |---|---|---|
 * | `printLabels` / `printGlass` / `printGlassHole` / `printProductionCustom` | `onMoreSelect` 的四个 `case`（`:1018`-`:1022`） |
 * | `loadFormulaImages` | `calcSingleRow` 里 `engine.calcRowParts(l, loadFormulaImages)`（`:1161`） |
 *
 * **有意不回传的 4 个**（2026-09-20 逐个实测，全部只剩块内引用）：
 * `formulaImages`（那段缓存只在本块与 `printCtx` 里用）· `ensureFormulaImages`（只有 `printGlassHole` 调）·
 * `printCtx` / `printApi`（只有本块用；回执族走的是 `PrintPreviewDialog` → `useOrderPrint`，不是这两个）。
 *
 * ## ⚠️ 页面调用点的**位置**是有讲究的（不是随便挑的）
 *
 * 本块的依赖里 `tenantName` / `currentUserName` / `terminalLink` 来自 **C7**、`sortMethod` 来自 **C13**，
 * 那两个解构在页面里比本块原来的位置**更靠下** ⇒ composable 的调用点只能放在**原第三段**（`printCtx` 那处）。
 * 于是页面里 `onMoreSelect`(`:1014`) 与 `calcSingleRow`(`:1161`) 会**在解构之前**引用这些名字 ——
 * **这是安全的**，因为两处都是**运行时才求值**的（`onMoreSelect` 是函数声明、`calcSingleRow` 是点击触发），
 * 到那时 setup 早就跑完了。
 * 🔴 **别把 print 的调用挪进 `onMounted` 或任何 setup 期同步执行的语句里** —— 那会撞上 `const` 的 TDZ。
 *
 * ## 与「回执单」的边界（别混）
 *
 * 本文件只喂 **`printApi` 的非回执单据**（标签 / 玻璃单 / 玻璃订单 / 生产单）。**回执族全部**走
 * `components/PrintPreviewDialog.vue` → `composables/useOrderPrint.ts` 的 `loadPrintPrereqs`。
 * 所以 `printCtx` 里**故意不给 `totalBalance`**（那几张模板里根本没有这一格）—— 别"顺手补齐"。
 */
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { ClientDto, FormulaDto } from '../../api/types'
import type { FormulaImageDto } from '../../api/types'
import { printByMode } from '../../utils/printService'
import { createPrintPayloads, type PrintContext } from '../../utils/printPayloads'
import type { Line } from '../../utils/partsEngine'

/** `useHuiPrint()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HuiPrintDeps {
  /**
   * **脊梁**：订单头（reactive 对象本身）。
   *
   * ⚠️ 类型**从 `PrintContext` 派生**（`PrintContext['order']`），**不复制一份字段清单** ——
   *    复制必漂：那边加一个字段，这边就少一个，而 `printCtx` 会安静地少传一个键。
   */
  order: PrintContext['order']
  /** **脊梁**：明细行。 */
  lines: Ref<Line[]>
  /** **脊梁**：公式。 */
  formulas: Ref<FormulaDto[]>
  /** 客户目录（C5 回传）。 */
  clients: Ref<ClientDto[]>
  /** 租户名（C7 回传）。 */
  tenantName: Ref<string>
  /** 当前用户名（C7 回传）。 */
  currentUserName: Ref<string>
  /** 收款码图 URL（C3 回传）。 */
  payQrcodeUrl: Ref<string>
  /** 终端链接（C7 回传）。 */
  terminalLink: Ref<string>
  /** 平开表显隐（C2 回传）。 */
  showPing: Ref<boolean>
  /** 移门表显隐（C2 回传）。 */
  showDiao: Ref<boolean>
  /** 排序方式（C13 回传）。 */
  sortMethod: Ref<string>
  /** 页面的 `today()`（没搬，仍在 `Hui.vue`）。 */
  today: () => string
  /** 引擎的 `markupError`（加价项校验报错回调）。 */
  markupError: (msg: string) => void
  /** 页面 `useMessage()`。 */
  message: MessageApi
}

/** 打印出口（标签/玻璃单/玻璃订单/生产单）+ 它们共用的打印载荷与挖孔图缓存。 */
export function useHuiPrint(deps: HuiPrintDeps) {
  async function printLabels() {
    if (!deps.lines.value.length) {
      deps.message.warning('暂无订单行')
      return
    }
    const rows = printApi.value.labelRows('lable')
    if (!rows.length) {
      deps.message.warning('标签数量为 0，无需打印')
      return
    }
    try {
      await printByMode('lable', rows)
    } catch (e) {
      deps.message.error(e instanceof Error ? e.message : '标签打印失败')
    }
  }

  // 公式挖孔图缓存（原版 glassHole doorImg = 按行开向取公式图片）
  const formulaImages = ref<Record<number, FormulaImageDto[]>>({})

  async function loadFormulaImages(fid: number | null) {
    if (fid == null || formulaImages.value[fid]) return
    try {
      formulaImages.value[fid] = await api.listFormulaImages(fid)
    } catch {
      formulaImages.value[fid] = []
    }
  }

  /**
   * 打印/预览「玻璃订单」前，确保**各行公式的挖孔图都已加载**。
   *
   * ⚠️ `loadFormulaImages` 原先**只在「算料」里调用一次**（`calcSingleRow`），而 `holeImageOf` /
   * `holeImgByDir` 是同步查缓存的 ⇒ **载入一张已保存的订单后直接打印玻璃订单，挖孔图整列为空**
   * （必须先在页面上点一次「算料」才会出现）。这里在打印/预览入口补一次兜底加载
   * （`loadFormulaImages` 自带缓存，重复调用是 no-op）。
   */
  async function ensureFormulaImages() {
    const ids = [...new Set(deps.lines.value.map((l) => l.formula_id).filter((v): v is number => v != null))]
    await Promise.all(ids.map((id) => loadFormulaImages(id)))
  }

  async function printGlass() {
    if (!deps.lines.value.length) {
      deps.message.warning('暂无订单行')
      return
    }
    try {
      await printByMode('glass', { produces: printApi.value.glassProduces() })
    } catch (e) {
      deps.message.error(e instanceof Error ? e.message : '玻璃单打印失败')
    }
  }

  // 玻璃订单（glassHole 模板，table.field=glassInfoList）
  async function printGlassHole() {
    if (!deps.lines.value.length) {
      deps.message.warning('暂无订单行')
      return
    }
    try {
      await ensureFormulaImages()
      await printByMode('glassHole', { glassInfoList: printApi.value.glassInfoProduces() })
    } catch (e) {
      deps.message.error(e instanceof Error ? e.message : '玻璃订单打印失败')
    }
  }

  // 生产单定制（product2，mode 8）/ 生产单3（product3，mode 9）—— 均走 `oldSheet` 载荷。
  // **product3 需要配对**：`_0x1ebfe1` 把相邻两行合成一张，第二行的所有键加 `1` 后缀
  // （模板里同时有 `oldSheet` 与 `oldSheet1` 两张表，正是为此）。原版 mode 9 有独立分支，
  // 我们原先只有 product2 一个出口，product3 只能从「模板预览」里打。
  async function printProductionCustom(mode: 'product2' | 'product3' = 'product2') {
    if (!deps.lines.value.length) {
      deps.message.warning('暂无订单行')
      return
    }
    try {
      await printByMode(mode, printApi.value.oldSheetProduces(mode === 'product3'))
    } catch (e) {
      deps.message.error(e instanceof Error ? e.message : '生产单定制打印失败')
    }
  }

  // ---------------------------------------------------------------------------
  // 打印载荷（Hui 这一单）—— 构造层已搬到 `utils/printPayloads.ts`，与 Home 批量打印共用。
  // ---------------------------------------------------------------------------
  // ⚠️ 这里**故意不给 `totalBalance`**：本对象只喂 `printApi` 的非回执单据
  // （玻璃单 / 玻璃订单 / 生产单 —— 见 `printGlass` / `printProduction` 那几处），
  // 这几张模板里根本没有 `TotalBalance` 这一格。回执族的打印**全部**走
  // `PrintPreviewDialog` → `useOrderPrint.loadPrintPrereqs`，余额在那儿取。
  const printCtx = computed<PrintContext>(() => ({
    order: deps.order,
    lines: deps.lines.value,
    formulas: deps.formulas.value,
    clients: deps.clients.value,
    tenantName: deps.tenantName.value,
    maker: deps.currentUserName.value,
    payQrcode: deps.payQrcodeUrl.value,
    terminalLink: deps.terminalLink.value,
    showPing: deps.showPing.value,
    showDiao: deps.showDiao.value,
    sortMethod: deps.sortMethod.value,
    formulaImages: formulaImages.value,
    today: deps.today(),
    onMarkupError: deps.markupError,
  }))

  const printApi = computed(() => createPrintPayloads(printCtx.value))

  return {
    // 5 项回传（其余 4 个声明在页面里零读者，见文件头「回传面」）。
    printLabels,
    printGlass,
    printGlassHole,
    printProductionCustom,
    loadFormulaImages,
  }
}
