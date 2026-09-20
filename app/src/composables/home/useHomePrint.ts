/**
 * 「打印选中订单」—— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）：
 *   · `Home.vue:1411-1528` —— 分区头 + 19 个 `const`（`printShow` … `qualifiedLabelEntry`）
 *                              + `openPrint` / `onOpenMode` / `onOpenReceiptOther` / `onOpenDoc`
 *
 * ⚠️ **行段是 `1411–1528`**（`1528 − 1411 + 1 = 118`，与 `docs/2026-09-20-home-hui-split.md`
 *    §1 的模块表 / §1.2 的 23 段表里写的「118 行」都对得上）。方案与 spec 另有**两处**把它
 *    写成 `1411–1538` —— 那两处是错的（多半把下一段的分区头也算进来了）：
 *    `1529–1531` 起已经是**另一个分区**「电子回执单」（§6.2 ReceiptView / ReceiptShare），
 *    里面的 `openReceipt`(1532–1538) **不搬** —— 它体里是 `router.push`，与打印无关，
 *    且它的调用者 `columns`(REF 2968–3305) **留在页面**（用户拍板）。
 *
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（B9 一条）。
 *
 * ⚠️ **本块不拥有任何共享状态**：19 个 `const` 与 4 个函数都只读写本块自己的 ref，
 *    注入的全是**页面拥有的东西**：
 *      · `checkedRowKeys` —— B10 拥有并借出（`composables/home/useHomeSelection.ts`）；
 *      · `details` —— 此刻仍在 `Home.vue`（B6/Task 10 才搬）。⚠️ 它是 `reactive`（**没有 `.value`**），
 *        所以注入的是**对象本身**，体里写 `deps.details[id]`（REF 原文就是 `details[id]`）；
 *      · `message` —— 页面级组件上下文。
 *    模块级依赖（`api` / 类型 `OrderDto` `DataTableRowKey` `MessageApi` `QualifiedLabelEntry`）
 *    本文件直接 `import`，不走注入 —— 与 `useHomeSelection.ts` / `useOrderPrint.ts` 同一口径。
 *
 * ⚠️ 回传的是**那 23 个 ref 本身**，不是 `.value` 的副本 —— 模板里 7 处 `v-model:show`
 *    （`previewShow` / `receiptOtherShow` / `receipt2Show` / `glassSheet2Show` /
 *    `productionSheet2Show` / `productionSheetShow` / `qualifiedLabelShow`）拿到副本会**静默失效**。
 *    ⇒ `Home.vue` 侧**必须解构**（`const { previewShow, … } = useHomePrint({…})`），
 *    不许写成 `print.previewShow`：`<script setup>` 的模板只对**顶层绑定**自动解包 ref，
 *    `print.previewShow` 是普通属性访问 ⇒ `v-model:show` 那 7 处会把 **ref 对象整个换成布尔值**，
 *    其余 `*Orders` 传给子组件的是 **Ref 对象**而不是数组（都是**不报错**的那种坏法）。
 */
import { ref, type Ref } from 'vue'
import type { DataTableRowKey, MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { OrderDto } from '../../api/types'
import type { QualifiedLabelEntry } from '../../components/qualifiedLabelUiProfile'

/** `useHomePrint()` 的注入面。**只放页面拥有的东西**（见文件头末段）。 */
export interface HomePrintDeps {
  /** 打印选中订单要先看勾了哪些（B10 拥有，`useHomeSelection` 借出）。 */
  checkedRowKeys: Ref<DataTableRowKey[]>
  /**
   * `openPrint` 对**没展开过**的订单兜底补拉明细（旧版不补拉，这是有意的行为改进）。
   *
   * ⚠️ 是 `reactive`（**没有 `.value`**）⇒ 注入**对象本身**，体里写 `deps.details[id]`，
   *    不许 `toRef`、不许 `.value`（REF 原文就是 `details[id]`）。
   */
  details: Record<number, OrderDto>
  message: MessageApi
}

/**
 * 打印选中订单（§4.2：工具栏 →「打印选项」抽屉 → 单据 × 预览/打印）。
 *
 * ⚠️ **构造顺序**：`checkedRowKeys` / `details` / `message` 都是 setup 顶层即时求值，
 *    本调用必须在它们**之后** —— 传早了拿到的是 `undefined`，且**不一定报错**。
 */
export function useHomePrint(deps: HomePrintDeps) {
  // ---------------------------------------------------------------------------
  // 打印选中订单（§4.2：工具栏 →「打印选项」抽屉 → 单据 × 预览/打印）
  // ---------------------------------------------------------------------------
  const printShow = ref(false)
  const printOrders = ref<OrderDto[]>([])
  /** 打印预览弹窗（旧版那个 `el-dialog`）：入口在「打印选项」抽屉里，点 hiprint 模板即开。 */
  const previewShow = ref(false)
  const previewMode = ref('')
  const previewTitle = ref('')
  /** 见 `calcSingleRowInExpand`：**算料**开着预览时**不许补号**（旧版算料不补）。 */
  const previewAutoLineNumbers = ref(true)
  /** 「回执单-其它」抽屉（旧版嵌套在「打印选项」里的第二层，`Mn`）。 */
  const receiptOtherShow = ref(false)
  const receiptOtherOrders = ref<OrderDto[]>([])
  const receipt2Show = ref(false)
  const receipt2Orders = ref<OrderDto[]>([])
  const glassSheet2Show = ref(false)
  const glassSheet2Orders = ref<OrderDto[]>([])
  const productionSheet2Show = ref(false)
  const productionSheet2Orders = ref<OrderDto[]>([])
  const productionSheetShow = ref(false)
  const productionSheetOrders = ref<OrderDto[]>([])
  const qualifiedLabelShow = ref(false)
  const qualifiedLabelOrders = ref<OrderDto[]>([])
  /** 合格标签族的入口（三个按钮唯一的差别，见 `qualifiedLabelUiProfile.ts`）。 */
  const qualifiedLabelEntry = ref<QualifiedLabelEntry>('all')

  async function openPrint() {
    const ids = deps.checkedRowKeys.value.map((k) => Number(k))
    if (!ids.length) {
      deps.message.warning('请先勾选要打印的订单')
      return
    }
    // 已展开过的订单用缓存，其余现拉（旧版不补拉，没展开过就打空白 —— 这是有意的行为改进）。
    try {
      printOrders.value = await Promise.all(ids.map((id) => deps.details[id] ?? api.getOrder(id)))
    } catch (e) {
      deps.message.error((e as Error).message || '读取订单明细失败')
      return
    }
    printShow.value = true
  }

  /**
   * 「打印选项」抽屉里点了**自绘单据**的入口 —— 开对应的抽屉。
   *
   * 旧版工具栏只有一个按钮，那 ~24 个单据入口全在抽屉里（含 `自定义单据：` 分组），
   * 所以这一层是**入口分派**，与「打印选中订单」共用同一套选中订单。
   *
   * ⚠️ **复用 `printOrders`，不再重新请求** —— 打开打印抽屉时已经做过明细兜底
   * （未展开过的订单会 `getOrder` 补全），这里重复拉一遍是白费。
   *
   * ⚠️ **先关自己再开目标**：两个 `n-drawer` 都从右侧出，叠着会互相压。
   */
  /**
   * 「打印选项」抽屉里点了 **hiprint 模板** → 开打印预览弹窗。
   *
   * 结构照原版：抽屉只列入口，点了设 `ic`（这里是 `mode`）并开预览弹窗，
   * 该单据的操作按钮栏长在**弹窗**里（见 `PrintPreviewDialog.vue`）。
   *
   * ⚠️ 与 `onOpenDoc` 一样**复用 `printOrders`**：打开打印抽屉时已做过明细兜底。
   */
  function onOpenMode(mode: string, title: string) {
    printShow.value = false // 先关抽屉再开弹窗，两者都占屏幕
    previewAutoLineNumbers.value = true // 打印面照旧补号
    previewMode.value = mode
    previewTitle.value = title
    previewShow.value = true
  }

  /**
   * 「打印选项」抽屉顶部点了「回执单-其它」（旧版 `Nn`，:8184）。
   *
   * 旧版那里只是 `Mn.value = true` —— **外层抽屉不关**，第二层嵌套抽屉直接叠上去
   * （`append-to-body` + `direction:"rtl"` + `size:350`，与外层同宽同侧）。
   * 新版沿用本文件 `onOpenDoc` 的口径：先关外层再开 —— 两层 `n-drawer` 都从右侧出，叠着会互相压。
   *
   * 数据复用 `printOrders`（`openPrint` 已做过明细兜底），不重复请求。
   */
  function onOpenReceiptOther() {
    receiptOtherOrders.value = printOrders.value
    printShow.value = false
    receiptOtherShow.value = true
  }

  function onOpenDoc(doc: string, entry?: string) {
    const orders = printOrders.value
    printShow.value = false

    const open = (
      target: typeof receipt2Orders,
      show: typeof receipt2Show,
    ) => {
      target.value = orders
      show.value = true
    }

    switch (doc) {
      case 'receipt2':
        open(receipt2Orders, receipt2Show)
        break
      case 'glassSheet2':
        open(glassSheet2Orders, glassSheet2Show)
        break
      case 'productionSheet2':
        open(productionSheet2Orders, productionSheet2Show)
        break
      case 'productionSheet':
        open(productionSheetOrders, productionSheetShow)
        break
      case 'qlabel':
        // 合格标签族三个入口共用同一个抽屉，只差 `entry`（= 行过滤）
        qualifiedLabelEntry.value = (entry ?? 'all') as QualifiedLabelEntry
        open(qualifiedLabelOrders, qualifiedLabelShow)
        break
    }
  }

  /**
   * 展开行「算料」后开「生产单」预览 —— **为 B6 预置的接缝**（2026-09-20 拆分时新增）。
   *
   * 原来这三句是 `Home.vue` 的 `calcSingleRowInExpand`（REF `:2231-2243`）直接写 B9 的状态，
   * 于是 B6 反向依赖 B9；B9 又依赖 B6 的 `details` ⇒ 成环、抽不出来。
   * 把这三句收成 B9 自己拥有的一个函数、B6 改成注入调用，环就断了（B9→B6 那条单向留着）。
   *
   * ⚠️ **三句的顺序是语义，不是风格**：`onOpenMode` 内部会把
   * `previewAutoLineNumbers` 置回 `true`（REF `:1475`），所以「算料不补号」那一次赋值
   * **必须排在它后面**。原注释（REF `:2240-2241`）说的就是这件事，随这几句一起搬到这里。
   *   旧版口径（REF `:2240-2241` 原句）：「**算料不补行级单号**」—— 旧版 `In`/`Un`
   *   只算料 + 开预览，补号是打印时才做的。
   */
  function openPrintPreview(orders: OrderDto[], autoLineNumbers: boolean) {
    printOrders.value = orders
    onOpenMode('product', '生产单')
    previewAutoLineNumbers.value = autoLineNumbers
  }

  return {
    // ⚠️ 回传 **ref 本身**（不是 `.value` 的副本）—— 理由见文件头。
    printShow,
    printOrders,
    previewShow,
    previewMode,
    previewTitle,
    previewAutoLineNumbers,
    receiptOtherShow,
    receiptOtherOrders,
    receipt2Show,
    receipt2Orders,
    glassSheet2Show,
    glassSheet2Orders,
    productionSheet2Show,
    productionSheet2Orders,
    productionSheetShow,
    productionSheetOrders,
    qualifiedLabelShow,
    qualifiedLabelOrders,
    qualifiedLabelEntry,
    openPrint,
    onOpenMode,
    onOpenReceiptOther,
    onOpenDoc,
    // ⚠️ 本笔它**还没有调用者** —— Task 10 才把它接到 B6 的 `calcSingleRowInExpand` 上。
    //    别为了「不留死代码」提前去改 `Home.vue` 的 `2238–2242`：那一笔归 Task 10
    //    （一笔只改一件事，出问题才定位得到笔）。`noUnusedLocals` 不检查未使用的 export。
    openPrintPreview,
  }
}
