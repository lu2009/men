/**
 * 「筛选 / 列头筛选 / 分页」（B3）—— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）：
 *   · `Home.vue:606-613`   —— 「筛选」段头 + `searchText` / `onlyUnproduced` / `paymentFilter` / `progressFilter`
 *   · `Home.vue:617-618`   —— `orderNoQuery`（**连它上面那行 JSDoc**）
 *   · `Home.vue:666-681`   —— `matchSearch`
 *   · `Home.vue:686-687`   —— `queryRows` / `queryMode`
 *   · `Home.vue:689-714`   —— `filtered`
 *   · `Home.vue:716-883`   —— 列头原生筛选（C16–C18）+ 选项 + `summary`
 *   · `Home.vue:885-956`   —— 分页（§3.1）+ `onPageChange` / `onPageSizeChange` + 两处 `watch`
 *   · `Home.vue:1244-1245` —— `querySearchPreset`（**连它上面那行 JSDoc**）
 *
 * ⚠️ **为什么 `orderNoQuery`(617-618) 与 `querySearchPreset`(1244-1245) 在本块**（**Ruling 51**）：
 *    两块共享状态都「声明在**最早构造的读者块**里，后来者注入写」——
 *    · `orderNoQuery`：读者是本块 `filtered`(`REF:700`·`701`)，B4 只是写者(`2279`·`2293`·`2328`)；
 *    · `querySearchPreset`：读者是本块 `watch`(`REF:955`)，B5 只是写者(`REF:1362`)。
 *    ⇒ 两处都是**本块声明、别人注入读写**。这也是它们物理上躺在 B4/B5 的分区里却归本块的原因。
 *    （对照：`Home.vue:614-616` 的「查单号」段头与 `619-624`·`646-664` 归 B4/Task 7 —— **本块没拿**。）
 *
 * ⚠️ **`rawOrders` / `financeSummary` 是 B1 拥有、本块只读**（`filtered` 的取数池、财务口径函数第二实参）。
 *    `orderNoQuery` / `queryRows` / `queryMode` / `querySearchPreset` 则是**本块拥有并借出** ——
 *    B4/B5 会**写**它们（见各处的 `deps.` 注入），所以声明留在这里、由工厂 `return` 出去。
 *    本文件**不拥有** `rawOrders`/`financeSummary`，也**绝不**重新声明它们。
 *
 * ⚠️⚠️ **本块有 2 处守卫登记不了的东西**：`watch([searchText, …])` 与 `watch(searchText, …)`
 *    是**顶层匿名调用**（没有名字）⇒ `sliceFn` 匹配不到，既进不了 `names` 也进不了 `consts`。
 *    **这 2 处的保真由「手工 diff」提供，不由守卫提供**（见 `task-6-report.md` 里贴的两个 hunk 全文）。
 *    ⚠️ 顺带钉住两条：① 第一处 `watch` 的依赖数组是
 *    `[searchText, onlyUnproduced, paymentFilter, progressFilter]` —— **没有 `pageSize`**
 *    （第二轮审计把它记成「✅ 已做」是错的）；② `nextTick` 的顺序不能动。
 *
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（**第 9 块**，B3 一条）——
 * 41 个声明逐字比对；本块登记的改写（Task 2 的调用形 + 本笔的注入前缀）写在那块的 `rewrites` 里。
 *
 * 注入的都是**页面拥有的东西**（响应式状态 / 组件上下文 API）；模块级依赖
 * （`utils/*` 与 `api/types`、naive-ui 的类型）本文件直接 `import`，不走注入 ——
 * 与 `useHomeData.ts` / `useHomeSelection.ts` / `useHomeQueryMore.ts` 同一口径。
 */
import { computed, nextTick, ref, watch, type Ref } from 'vue'
import type { DataTableFilterState, DataTableInst } from 'naive-ui'
import type { OrderFinance, OrderSummaryDto } from '../../api/types'
import { EMPTY_FILTER_VALUE } from '../../utils/homeConstants'
import { paidOf, paymentStatus, progressMatch, unpaidOf } from '../../utils/homeMetrics'
import { orderNosOf } from '../../utils/homeOrderNo'
import { canSeeAllOrders } from '../../utils/roles'
import type { useAuthStore } from '../../stores/auth'

/** `useHomeFilterView()` 的注入面。**只放页面拥有的东西**（见文件头末段）。 */
export interface HomeFilterViewDeps {
  /** `filtered` 的取数池：查询态取 `queryRows`，否则取它（`REF:691`）。 */
  rawOrders: Ref<OrderSummaryDto[]>
  /** 财务口径函数（`paidOf`/`unpaidOf`/`paymentStatus`）都要它当第二实参。 */
  financeSummary: Ref<Record<string, OrderFinance>>
  /** `filtered` 按角色过滤（`REF:692`·`693`）。 */
  auth: ReturnType<typeof useAuthStore>
}

/**
 * 筛选链 + 列头筛选 + 分页。
 *
 * ⚠️ **构造顺序（Ruling 54）**：`B1 → B3 → B6 → B7 → B4 → B5` —— 本块**排在 B1 之后、其余之前**，
 *    必须紧跟 `useHomeData(...)`。放早了 `rawOrders`/`financeSummary` 是 `undefined`，
 *    而它们只在第一次重算 `filtered` 时被读到 ⇒ **编译过、启动过、平时不报错**。
 */
export function useHomeFilterView(deps: HomeFilterViewDeps) {
  // ---------------------------------------------------------------------------
  // 筛选（§3.1：未生产 → 付款状态 → 进度 → 搜索文本）
  // ---------------------------------------------------------------------------
  const searchText = ref('')
  const onlyUnproduced = ref(false)
  const paymentFilter = ref('全部显示')
  const progressFilter = ref('显示全部')


  /** 生效中的查单号关键字（旧版 `po`）—— 参与筛选，也决定单元格显示哪一段。 */
  const orderNoQuery = ref('')

  function matchSearch(r: OrderSummaryDto): boolean {
    const q = searchText.value.trim().toLowerCase()
    if (!q) return true
    const fields = [
      r.client_name,
      String(r.deposit),
      String(r.total_price),
      r.install_address,
      r.remark,
      r.production_status,
      r.salesperson,
      r.order_date,
      r.receipt_no,
    ]
    return fields.some((f) => (f ?? '').toLowerCase().includes(q))
  }

  const queryRows = ref<OrderSummaryDto[]>([])
  const queryMode = ref(false)

  const filtered = computed(() => {
    // 非管理员只看自己打的单（§3.1 `fs`）—— 口径在 `utils/roles.ts` 的 `canSeeAllOrders`。
    let list = queryMode.value ? queryRows.value : deps.rawOrders.value
    if (!canSeeAllOrders(deps.auth.user?.role)) {
      list = list.filter((r) => r.creator_name === deps.auth.user?.name)
    }
    if (onlyUnproduced.value) {
      list = list.filter((r) => !r.production_status || r.production_status.trim() === '')
    }
    // 查单号（旧版 `ps` 里紧跟「未生产」那一步，`:11160-11163` / `:11176-11179`）：
    // **单号集里任一段以关键字开头**即命中（`startsWith`，不是 `includes`）。
    if (orderNoQuery.value) {
      const q = orderNoQuery.value.toLowerCase()
      list = list.filter((r) => orderNosOf(r).some((s) => s.toLowerCase().startsWith(q)))
    }
    if (paymentFilter.value !== '全部显示') {
      list = list.filter((r) => paymentStatus(r, deps.financeSummary.value) === paymentFilter.value)
    }
    if (progressFilter.value !== '显示全部') {
      list = list.filter((r) => progressMatch(r, progressFilter.value))
    }
    list = list.filter(matchSearch)
    // 列头筛选（C16–C18）。**有意偏离旧版**：旧版这一步发生在分页切片之后（只筛当前页、
    // 总数也不含它），新版放在这里 ⇒ **全量筛选、总数跟随**。见下方 `columnFilterState` 的说明。
    return list.filter(matchesColumnFilters)
  })

  // ---------------------------------------------------------------------------
  // 列头原生筛选（C16–C18，旧版 `Home.formatted.js:7933-8003`）
  // ---------------------------------------------------------------------------
  /*
   * ⚠️ 顺序：旧版这套筛选**不在 `ps` 链里**，而是交给 el-table 自己在 `:data="Cs"` 上做 ——
   *    `:11296` `data:Cs.value`，而 `Cs` = `ps.slice(...)`（`:11180-11183`）。
   *    所以旧版是：筛选链（未生产→付款状态→进度→搜索）→ **分页切片** → 列头筛选，
   *    即**只筛当前页**；分页总数 `zs`（= `ps.length`）也不含它。
   *
   *    ★ **新版有意不照抄这一条**（用户 2026-09-18 拍板）：列头筛选并进 `filtered` 链 ⇒ 全量筛选、
   *      总数跟随。理由见 `matchesColumnFilters` 的注释 —— 旧版那个行为大概率是 bug。
   *
   * 选项取值来源：旧版 `ta`/`ma`/`wa` 全部读 `_l`（**全量**原始列表，`:7934`/`:7987`/`:7992`），
   * 不是当前筛选结果 —— 新版对应 `rawOrders`（连非管理员的「只看自己」过滤都不算在内，与旧版一致）。
   */
  const columnFilterState = ref<DataTableFilterState>({})

  // 旧版 `ta` 里 `unshift` 的哨兵（`:7937-7939`）：value = 字符串表 dr(1196) = "__EMPTY__"，
  // text = dr(1470) = "未生产"。只挂在「打单操作」这一列上。
  //（`__EMPTY__` 那个常量已归位到 `app/src/utils/homeConstants.ts`，2026-09-20 纯搬迁；
  //  下面 `EMPTY_FILTER_LABEL` 仍在本文件 —— 它不在本任务的搬迁清单里。）
  const EMPTY_FILTER_LABEL = '未生产'

  // Naive 的 `FilterOption` / `FilterOptionValue` 没有从包入口导出，这里按结构声明。
  type ColumnFilterOption = { label: string; value: string | number }

  // 旧版 `ta(prop)`（`:7933-7939`）= `new Set(_l.map(t => t[prop]))` → `Array.from` → `{text:v, value:v}`。
  //   · 只做 distinct，**不排序**（保持首次出现顺序，`Set` 的插入序）；
  //   · **不剔除空值**（空串同样会成为一个选项）；
  //   · `text` 取原值，Element 用插值渲染 → 新版 `label` 取 `String(v)`，数值列显示一致。
  function distinctOptions(pick: (r: OrderSummaryDto) => string | number): ColumnFilterOption[] {
    const seen = new Set<string | number>()
    const out: ColumnFilterOption[] = []
    for (const r of deps.rawOrders.value) {
      const v = pick(r)
      if (seen.has(v)) continue
      seen.add(v)
      out.push({ label: String(v), value: v })
    }
    return out
  }

  // 旧版 `ga(value,row,column)`（`:7996-8002`）：
  //   ① 打单操作列 + 哨兵值 → 该列值为空/纯空白即命中（`!v || (typeof v==='string' && v.trim()==='')`）；
  //   ② 其余一律 `row[prop] === value` **严格相等**（不是模糊匹配，也不做类型转换）。
  type TextFilterKey =
    | 'client_name'
    | 'order_date'
    | 'install_address'
    | 'production_status'
    | 'door_count'
    | 'total_price'
    | 'remark'
    | 'salesperson'
    | 'creator_name'

  function textColumnFilter(key: TextFilterKey, value: string | number, row: OrderSummaryDto): boolean {
    if (key === 'production_status' && value === EMPTY_FILTER_VALUE) {
      const v = row.production_status
      return !v || (typeof v === 'string' && v.trim() === '')
    }
    return row[key] === value
  }

  // 旧版 `ya`（`:8003`）= `co(row)===e`；`fa`（`:8003`）= `so(row)===e`。
  const paidColumnFilter = (value: string | number, row: OrderSummaryDto) => paidOf(row, deps.financeSummary.value) === value
  const unpaidColumnFilter = (value: string | number, row: OrderSummaryDto) => unpaidOf(row, deps.financeSummary.value) === value

  /**
   * 所有列头筛选的**合并判定**（多值 OR、列间 AND —— 与 naive / Element 的 `filter-multiple` 语义一致）。
   *
   * ★ **有意偏离旧版**：旧版把这一步交给 el-table 自己做，而它的 `:data` 是**分页切片**
   *   （`Home.formatted.js:11180-11183` 的 `Cs = ps.slice(...)`），所以旧版**只筛当前页**、
   *   分页总数（`zs = ps.length`）也不含列头筛选。
   *   新版放进 `filtered` 链 ⇒ 全量筛选、`item-count` 跟着变。
   *
   *   取舍理由：旧版那个行为大概率是 bug —— 勾「客户=张三」只筛出当前页里的张三、翻页结果又变，
   *   没人会那样预期。这正是 `docs/home-audit/00-summary.md` 里请用户拍板的那条，用户选了「做对」。
   *
   * 列定义的 `filter` 仍保留：naive 用它渲染勾选态，且它作用在**已筛过的**行上，等于空操作。
   */
  function matchesColumnFilters(r: OrderSummaryDto): boolean {
    for (const key of TEXT_FILTER_KEYS) {
      const sel = columnFilterValues(key)
      if (sel.length && !sel.some((v) => textColumnFilter(key, v, r))) return false
    }
    const paid = columnFilterValues('deposit')
    if (paid.length && !paid.some((v) => paidColumnFilter(v, r))) return false
    const unpaid = columnFilterValues('unpaid')
    if (unpaid.length && !unpaid.some((v) => unpaidColumnFilter(v, r))) return false
    return true
  }

  /** 9 个文本列的 key（与列定义里的 `filterOptionValues` 一一对应）。 */
  const TEXT_FILTER_KEYS: TextFilterKey[] = [
    'client_name',
    'order_date',
    'install_address',
    'production_status',
    'door_count',
    'total_price',
    'remark',
    'salesperson',
    'creator_name',
  ]

  // 选项（受控列定义用量，`rawOrders`/`financeSummary` 变化时自动重算）。
  const clientFilterOptions = computed(() => distinctOptions((r) => r.client_name))
  const dateFilterOptions = computed(() => distinctOptions((r) => r.order_date))
  const addressFilterOptions = computed(() => distinctOptions((r) => r.install_address))
  const doorCountFilterOptions = computed(() => distinctOptions((r) => r.door_count))
  const totalPriceFilterOptions = computed(() => distinctOptions((r) => r.total_price))
  const remarkFilterOptions = computed(() => distinctOptions((r) => r.remark))
  const salespersonFilterOptions = computed(() => distinctOptions((r) => r.salesperson))
  const creatorFilterOptions = computed(() => distinctOptions((r) => r.creator_name))
  // 打单操作：distinct 之后把哨兵 **unshift 到最前**（旧版 `:7937-7939`）。
  const productionStatusFilterOptions = computed(() => {
    const opts = distinctOptions((r) => r.production_status)
    opts.unshift({ label: EMPTY_FILTER_LABEL, value: EMPTY_FILTER_VALUE })
    return opts
  })
  // 已付 / 未付（旧版 `ma` `:7986-7991` / `wa` `:7991-7995`）：选项同样是 distinct 的金额数字。
  const paidFilterOptions = computed(() => distinctOptions((r) => paidOf(r, deps.financeSummary.value)))
  const unpaidFilterOptions = computed(() => distinctOptions((r) => unpaidOf(r, deps.financeSummary.value)))

  // 受控写法：Naive 2.45 的 n-data-table **没有表级 `filters` prop**，受控只能落在列的
  // `filterOptionValues` 上（`use-table-data.mjs:58-68` 的 `mergedFilterStateRef`）。
  // 不能用 `defaultFilterOptionValues` —— 那是非受控初值，之后组件内部状态说了算，会与
  // `searchText`/`onlyUnproduced` 的「筛选即重算」预期打架。
  function columnFilterValues(key: string): (string | number)[] {
    const v = columnFilterState.value[key]
    if (v == null) return []
    return Array.isArray(v) ? [...v] : [v]
  }

  // Naive 每次变更都会把**整个**筛选状态回抛（`FilterButton.mjs:68-69` `doUpdateFilters`）。
  function onUpdateFilters(state: DataTableFilterState) {
    columnFilterState.value = { ...state }
  }

  const summary = computed(() => {
    const list = filtered.value
    let earliest = ''
    let latest = ''
    for (const r of list) {
      if (!earliest || r.order_date < earliest) earliest = r.order_date
      if (!latest || r.order_date > latest) latest = r.order_date
    }
    const doors = list.reduce((s, r) => s + r.door_count, 0)
    const total = list.reduce((s, r) => s + r.total_price, 0)
    // 已付（旧版 `as` `:10994-10996`）：`Σ (已分配金额 ?? 定金||0)` —— 与列头筛选用的
    // `paidOf`（旧版 `co`，`:7660-7662`）**同一个口径**，直接复用。
    const paid = list.reduce((s, r) => s + paidOf(r, deps.financeSummary.value), 0)
    const unpaid = list.reduce((s, r) => s + unpaidOf(r, deps.financeSummary.value), 0)
    const unpaidCount = list.filter((r) => unpaidOf(r, deps.financeSummary.value) > 0).length
    const unaudited = list.filter(
      (r) => !r.production_status?.trim() && !r.order_no_set?.trim(),
    ).length
    return { earliest, latest, doors, total, paid, unpaid, unpaidCount, unaudited }
  })

  // ---------------------------------------------------------------------------
  // 分页（§3.1 客户端分页，默认 50）
  // ---------------------------------------------------------------------------
  const page = ref(1)
  const pageSize = ref(50)
  // n-data-table 实例（只用来在翻页后复位滚动条，见 `onPageChange`）。
  const tableRef = ref<DataTableInst | null>(null)
  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return filtered.value.slice(start, start + pageSize.value)
  })

  // 翻页复位滚动条（旧版 `xs` `:11184-11195` 的收尾两句）：
  //   `const l = document.querySelector(".table-container"); l && (l.scrollTop = 0)`
  // ⚠️ 旧版只在**翻页**（`xs`）复位，**改页大小**（`Bs` `:11196-11206`）**不复位** —— 这里照抄，
  //    所以挂在 `@update:page` 上而不是 `watch(page)`（改 page-size 时 Naive 会顺带改页，若用 watch 就会误复位）。
  // ⚠️ 新版 `.table-container` 是 `flex:1; min-height:0`（**不是**滚动容器），真正滚动的是
  //    n-data-table 因 `:max-height` 生成的内层 scrollbar（`.n-data-table-base-table-body`）。
  //    旧版写 `.table-container` 能生效是因为它那条 CSS 是 `height:calc(100vh - 10px);overflow:hidden`
  //    ——`overflow:hidden` 仍是滚动容器，能被子元素聚焦等程序化滚动。新版没有那层，
  //    所以这里改用 n-data-table 暴露的 `scrollTo({ top: 0 })`（`DataTableInst`），
  //    等价且不依赖内层 class 名。放在 `nextTick` 里：旧版是同步置 0，但它那层不参与重渲染；
  //    Naive 换页要重渲染 body，渲染后置 0 才不会被 scrollbar 的 sync 覆盖。
  function onPageChange() {
    // 页大小刚变过 ⇒ 这次 `update:page` 是 naive 的**夹页**，不是用户翻页 —— 不复位滚动条。
    if (pageSizeJustChanged) return
    void nextTick(() => {
      tableRef.value?.scrollTo({ top: 0 })
    })
  }

  /**
   * 页大小刚变过的一次性标志（同 tick 内有效）。见 `onPageSizeChange`。
   * 用普通变量而不是 ref：它不参与渲染，只做「同一次同步流程里传个话」。
   */
  let pageSizeJustChanged = false

  /**
   * 改页大小（旧版 `Bs`，`:11196-11206`）。
   *
   * ⚠️ 旧版末尾是 **`Kl.value = 1`（无条件回第 1 页）**。naive 不是：
   *    `pagination/src/Pagination.mjs` 的 `doUpdatePageSize` 只在
   *    `mergedPageCountRef.value < mergedPageRef.value`（当前页超出新页数）时才动 page，
   *    而且动的是 **`doUpdatePage(mergedPageCount)`——夹到最后一页，不是回第 1 页**。
   *    ⇒ 「第 3 页 → 换成 200/页」会停在原页码，必须显式置 1。
   *    （第二轮审计把 E6 记成「✅ 已做」是**错的**：那条 watch 里只有四个筛选条件，没有 `pageSize`。）
   *
   * ⚠️ `pageSizeJustChanged`：naive 那次夹页会**发 `update:page`**，而 `onPageChange` 里有滚动复位；
   *    旧版 `Bs` **不复位滚动条**（只有翻页 `xs` 复位）⇒ 得把它挡掉。
   *    naive 是先发 size 事件、再做夹页（同一个同步流程），所以在这里置真就能挡住那一次。
   */
  function onPageSizeChange(size: number) {
    pageSize.value = size
    pageSizeJustChanged = true
    page.value = 1
    void nextTick(() => {
      pageSizeJustChanged = false
    })
  }

  watch([searchText, onlyUnproduced, paymentFilter, progressFilter], () => {
    page.value = 1
  })

  // 退出查询态：旧版 `Es`（搜索框 `onInput`，`:11099` 附近）与 `Ms`（`onClear`，`:11096-11100`）
  // 都会把 `gs` 置回 `false` —— 即「用户一动搜索框就回到全量列表」。
  // 新版 `n-input` 没有可用的输入事件钩子（`v-model:value` 下 `@update:value` 只在用户交互时发，
  // 拿不到「是否用户触发」这层区别），改用 watch：只要框里的值不再是进查询态时写进去的那串就退出。
  // 进查询态时 `submitQuery` 是先写 `querySearchPreset` 再写 `searchText`，所以那一次不会误退出。
  watch(searchText, (v) => {
    if (v !== querySearchPreset.value) queryMode.value = false
  })

  /** 进查询态时写进搜索框的那串（旧版 `Rc`，`:11083`）。搜索框一旦被改动即退出查询态。 */
  const querySearchPreset = ref('')

  /*
   * ⚠️ **两个顶层匿名 `watch` 就在上面这段里**（`REF:945-947` 与 `954-956`）——
   *    它们没有名字，`home-extract-movecheck.mjs` 的 `sliceFn` **验不到**（只按名字切）。
   *    这两处的保真靠 `task-6-report.md` 里的手工 `git diff` 全文。
   */
  return {
    // —— 页面模板直接读（模板留在 `Home.vue`，名字仍在同一作用域）
    searchText,
    onlyUnproduced,
    filtered,
    summary,
    paged,
    page,
    pageSize,
    tableRef,
    onPageChange,
    onPageSizeChange,
    // —— `columns`(`Home.vue:2968-3303`) 读的（含 11 组 `*FilterOptions` 与两个谓词）
    paymentFilter,
    progressFilter,
    orderNoQuery,
    columnFilterValues,
    textColumnFilter,
    paidColumnFilter,
    unpaidColumnFilter,
    onUpdateFilters,
    clientFilterOptions,
    dateFilterOptions,
    addressFilterOptions,
    doorCountFilterOptions,
    totalPriceFilterOptions,
    remarkFilterOptions,
    salespersonFilterOptions,
    creatorFilterOptions,
    productionStatusFilterOptions,
    paidFilterOptions,
    unpaidFilterOptions,
    // —— 借给别的块：B4 读/写 `orderNoQuery`；B5 写 `queryRows`/`queryMode`/`querySearchPreset`
    queryRows,
    queryMode,
    querySearchPreset,
  }
}
