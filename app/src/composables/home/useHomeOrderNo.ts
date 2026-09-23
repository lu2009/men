/**
 * 「查单号」（旧版 `po`/`fo`/`ho`/`Co` + `To`/`Yo`/`Wo`）—— 2026-09-20 从 `Home.vue` 搬出
 * （逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）是**三段**：
 *   · `Home.vue:619-624` —— 三个 ref（`orderNoInput` / `orderNoRestoring` / `orderNoPopShow`）
 *   · `Home.vue:646-664` —— `orderNoCell`（含 12 行 JSDoc）
 *   · `Home.vue:2259-2338` —— 分区头 + `confirmOrderNoQuery` + `clearOrderNoQuery`
 * 三段合计 **6 个声明** —— 与 spec §3.1 的「6 个」对得上。
 *
 * ⚠️ **段里夹着两个「不是本块」的声明，看着连续而已**：
 *   · `617-618` `orderNoQuery` —— 随 T6/B3 归位到 `useHomeFilterView.ts`（本块**注入**它）；
 *   · `626-644` `splitOrderNos` / `orderNosOf` —— 随 Task 4 归位到 `utils/homeOrderNo.ts`。
 *   ⇒ spec 写的 `617-664` 会把这两处一起算进来（多算 3 个声明），照它搬会重复搬。
 *
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（B4 一条：6 个声明逐字一致）。
 *
 * ## 注入面 = **11 项**（spec 写 8 —— 实测差 3，见下）
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `rawOrders` | B1 `useHomeData` | 第 ② 步「`gs ? ws : fs`」里的 `fs` |
 * | `orderNoQuery` | B3 `useHomeFilterView` | **读 + 写**（确认/清除都改它）；`orderNoCell` 也读它 |
 * | `onlyUnproduced` | B3 | 第 ② 步要叠「未生产」那一步 |
 * | `filtered` | B3 | 第 ④ 步「展开筛选结果第一行」 |
 * | `page` | B3 | 确认/清除都回第 1 页 |
 * | `queryRows` / `queryMode` | B3（B5 的输入） | 第 ② 步「`gs ? ws : fs`」里的 `ws`/`gs` |
 * | `expandedRowKeys` | B6 `useHomeExpand` | 第 ④ 步展开一行；清除时全收起 |
 * | `details` | B6 | 展开的那行没拉过明细就 `loadDetail` |
 * | `loadDetail` | B6 | 同上 |
 * | `message` | 页面 | 「查不到「{关键字}」单号！」那条 warning |
 *
 * ⚠️ spec 的「8 项」少算的正是 `page` / `filtered` / `onlyUnproduced` 这类**B3 的回传**——
 *    它们在本块里都是**活的读者**（`page.value = 1` 三处、`filtered.value[0]` 一处、
 *    `onlyUnproduced.value` 一处），不是可省项。**以实测 11 项为准。**
 *
 * ## 注入的形状
 *
 * 九个是 `ref`（注入 **ref 对象本身**，体里照旧写 `deps.x.value`）。
 * ⚠️ **`details` 是 `reactive`（没有 `.value`）** ⇒ 注入对象本身、体里写 `deps.details[id]`，
 *    与 `useHomePrint.ts` 同一口径（REF 原文就是 `details[id]`，别给它加 `.value`）。
 *
 * 模块级依赖（`nextTick` / `orderNosOf` / 三个类型）本文件直接 `import`，不走注入。
 *
 * ⚠️ **本块自己拥有三个 ref**（`orderNoInput` / `orderNoRestoring` / `orderNoPopShow`），
 *    段① 声明的就是它们 —— 所以**它们不是注入项**，两个动作函数里读写的一律是**本块自己的**
 *    那三个（体里就是 `orderNoInput.value`，**没有** `deps.` 前缀）。
 *    （第一版把这三条也当成注入写了 `deps.` ⇒ 8 处 TS2339。**守卫抓不到这一类**：
 *    它只比「新侧文本是否符合**登记过的**改写」，登记本身写错它照样绿 —— 抓它的是 `vue-tsc`。）
 *
 * ⚠️ **本块是「零模板绑定」的一块**（2026-09-20 实测）：这 6 个名字在 `Home.vue` 的
 *    `<template>`（1–414 行）里**一处都没有** —— 唯一的消费者是**留在页面的 `columns`**，
 *    而它按 `orderNoInput.value` / `orderNoPopShow.value` 这种**显式 `.value`** 读写
 *    （那是普通 JS，不是模板自动解包）。⇒ 页面侧**解构**在本块是**约定**
 *    （与本次拆分其余各块同一形态），**不是**「不解构就静默坏」：
 *    写成 `orderNo.orderNoInput.value` 在 `columns` 里其实也跑得通。
 *    解构的真正好处是**让 `columns` 一行都不用改**（用户拍板它留在页面）。
 *    ⚠️ **别把这条类推到别的块**：B7 的 `rowClass` 才是**真模板绑定**（`:row-class-name`），
 *    那种地方不解构才会静默坏。
 */
import { nextTick, ref, type Ref } from 'vue'
import type { DataTableRowKey, MessageApi } from 'naive-ui'
import type { OrderDto, OrderSummaryDto } from '../../api/types'
import { orderNosOf } from '../../utils/homeOrderNo'

/** `useHomeOrderNo()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HomeOrderNoDeps {
  /** B1 拥有（`useHomeData` 借出）。 */
  rawOrders: Ref<OrderSummaryDto[]>
  /** B3 拥有（`useHomeFilterView` 借出）—— 本块读**也写**它。 */
  orderNoQuery: Ref<string>
  /** B3。 */
  onlyUnproduced: Ref<boolean>
  /** B3。 */
  filtered: Ref<OrderSummaryDto[]>
  /** B3。 */
  page: Ref<number>
  /** B3 —— 旧版 `ws`。 */
  queryRows: Ref<OrderSummaryDto[]>
  /** B3 —— 旧版 `gs`。 */
  queryMode: Ref<boolean>
  /** B6 拥有（`useHomeExpand` 借出）。 */
  expandedRowKeys: Ref<DataTableRowKey[]>
  /**
   * B6 —— 展开的那一行没拉过明细时补拉。
   *
   * ⚠️ 是 `reactive`（**没有 `.value`**）⇒ 注入**对象本身**，体里写 `deps.details[id]`。
   */
  details: Record<number, OrderDto>
  /** B6。 */
  loadDetail: (id: number) => void
  /** 打开整张回执单编辑器；一个回执单下包含全部门明细。 */
  openOrderEditor: (row: OrderSummaryDto) => void
  /** 页面级组件上下文。 */
  message: MessageApi
}

/**
 * 「查单号」（§3.2）。
 *
 * ⚠️ **构造顺序**：11 项注入都是 setup 顶层即时求值 ⇒ 本调用必须在
 * `useHomeData`(B1) / `useHomeFilterView`(B3) / `useHomeExpand`(B6) **之后** ——
 * 传早了拿到的是 `undefined`，且**不一定报错**（只有点「确定」/「清除」那一下才炸）。
 */
export function useHomeOrderNo(deps: HomeOrderNoDeps) {
  /** 弹窗里输入框的内容（旧版 `fo`）。确认时会被补齐年份后缀后写回。 */
  const orderNoInput = ref('')
  /** 「恢复中…」标志（旧版 `ho`）—— 清除按钮在做收起动画期间显示这个字。 */
  const orderNoRestoring = ref(false)
  /** 「查单号」popover 的显隐（旧版 `Co`，受控，因为确认/清除都要主动关它）。 */
  const orderNoPopShow = ref(false)

  /**
   * 单号集单元格显示什么（旧版 `To`，`:7699-7701`）：
   * ```js
   * To = e => { const l = So(e)                       // So = Uo(单号集)
   *             if (!l.length) return ""
   *             const o = String(po.value || "").trim().toLowerCase()
   *             return o ? (l.find(x => String(x||"").toLowerCase().startsWith(o)) || l[0] || "")
   *                      : (l[0] || "") }
   * ```
   * ⇒ **查单号生效时显示「以关键字开头的那一段」**，否则显示第一段。
   * （旧版 `:7700` 用的是 `startsWith`，不是 `includes` —— 别按「包含」理解。）
   */
  function orderNoCell(r: OrderSummaryDto): string {
    const parts = orderNosOf(r)
    if (!parts.length) return ''
    const q = deps.orderNoQuery.value.trim().toLowerCase()
    if (!q) return parts[0] || ''
    return parts.find((p) => p.toLowerCase().startsWith(q)) || parts[0] || ''
  }

  // ---------------------------------------------------------------------------
  // 「查单号」的两个动作（旧版 `Yo`/`Wo`，`:7702-7743`）
  // ---------------------------------------------------------------------------
  /**
   * 「确认」/输入框回车（旧版 `Yo`，`:7702-7729`）。
   *
   * 四步，逐字对齐：
   *  ① **补年份后缀**：输入里若没有 `-两位数字`（正则 `-\d{2}\b`）就补 `-` + 当前年份后两位。
   *     `String((new Date).getFullYear()).slice(-2)`（`dr(962)`=getFullYear、`dr(1001)`=slice）。
   *  ② 在「查询结果集 / 全量列表」`gs ? ws : fs` 里找，**再叠「未生产」那一步** ——
   *     注意：旧版这一步**不含**进度/付款/搜索/列头筛选，与主表 `ps` 的样本不同，照抄。
   *  ③ 没命中 → `warning("查不到「{关键字}」单号！")`，且 **`po` 清空**（不留下一个筛不出东西的关键字）。
   *  ④ 命中 → 写 `po`、回第 1 页、关弹窗、**展开筛选结果的第一行**。
   */
  async function confirmOrderNoQuery() {
    const raw = orderNoInput.value.trim()
    // ① 补年份后缀（旧版 :7703-7709）
    const q = raw ? (/-\d{2}\b/.test(raw) ? raw : `${raw}-${String(new Date().getFullYear()).slice(-2)}`) : ''
    orderNoInput.value = q
    if (!q) {
      deps.orderNoQuery.value = ''
      deps.page.value = 1
      orderNoPopShow.value = false
      return
    }
    // ② 找（旧版 :7710-7716）
    let pool = deps.queryMode.value ? deps.queryRows.value : deps.rawOrders.value
    if (deps.onlyUnproduced.value) {
      pool = pool.filter((r) => !r.production_status || r.production_status.trim() === '')
    }
    const key = q.toLowerCase()
    const hit = pool.some((r) => orderNosOf(r).some((s) => s.toLowerCase().startsWith(key)))
    // ③ 没命中（旧版 :7717-7718）
    if (!hit) deps.message.warning(`查不到「${q}」单号！`)
    deps.orderNoQuery.value = hit ? q : ''
    deps.page.value = 1
    orderNoPopShow.value = false
    if (!hit) return
    // ④ 打开第一条回执单编辑器。
    // 订单列表以回执单为粒度，一个回执单下可能有多条平开门/移门明细，
    // 因此查到门明细单号后，进入整张回执单编辑器，而不是展开一条局部子表。
    await nextTick()
    const first = deps.filtered.value[0]
    if (!first) return
    deps.openOrderEditor(first)
    // ⚠️ 旧版这里还有一段 800ms 后「滚到居中」：它找的是 `.highlight-matched-order`，
    //    而那个类由 **Hui 子表**按 `row.单号.startsWith(po)` 加（`Hui.formatted.js:1352-1356`
    //    / `:3788-3792`，靠 Home 往下传 `highlightOrderQuery`）。
    //
    //    ⚠️ **这条注释 2026-09-19 更正过**：原写「新版做不了，`OrderLineDto` 里没有『单号』字段」
    //    —— **已过期**。迁移 `0020` 之后 `OrderLineDto.line_no` **已经存在**
    //    （`app/src/api/types.ts:162`），样式也随组件搬到了 `components/DetailLinesTable.vue:1366-1371`。
    //    ⇒ 现在**做得了、只是没做**（这一点属「数据模型补回之前无落点」那个理由的失效，
    //    见 `docs/home-audit/02-actions.md` 的 I4，判定已从 ✅ 改成 ⚠️）。
    //    所以这里仍然刻意不写滚动 —— 但**理由变了**：不是「做不了」，是**还没做**。
    //    （旧版在找不到该元素时同样直接 return，不滚。）
  }

  /**
   * 「清除」（旧版 `Wo`，`:7730-7743`）：清关键字 → 清输入 → 关弹窗 →
   * **收起所有已展开的行**（`jo` 遍历 → `toggleRowExpansion(row, false)` → `jo.clear()`）。
   *
   * ⚠️ 时间轴照抄：先置 `ho=true`（按钮变「恢复中…」），**50ms 后**才干活，干完才 `ho=false`。
   *    那个 `setTimeout(..., 50)` 是旧版原样（`:7741-7743`），不是我们加的。
   */
  function clearOrderNoQuery() {
    orderNoRestoring.value = true
    setTimeout(async () => {
      deps.orderNoQuery.value = ''
      orderNoInput.value = ''
      orderNoPopShow.value = false
      await nextTick()
      if (deps.expandedRowKeys.value.length) {
        deps.expandedRowKeys.value = []
      }
      deps.page.value = 1
      orderNoRestoring.value = false
    }, 50)
  }

  return {
    // 6 个**全回传** —— 实测它们的消费者**只有一个**：留在页面的 `columns`（`Home.vue:876-932`
    // 那一格的 6 处调用）。
    // ⚠️ **`<template>` 里零命中**（2026-09-20 实测：1–414 行 0 处）—— 本块是「零模板绑定」的一块，
    //    所以页面侧的解构是**约定**、好处是「让 `columns` 一行都不用改」，**不是**「不解构就静默坏」。
    //    完整理由（含「别类推到 B7 的 `rowClass`」）见文件头。
    //    ⚠️ 这里原先写着「模板 3 处 ×2」—— **那是错的**，与文件头自相矛盾，已按实测改掉。
    orderNoInput,
    orderNoRestoring,
    orderNoPopShow,
    orderNoCell,
    confirmOrderNoQuery,
    clearOrderNoQuery,
  }
}
