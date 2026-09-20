/**
 * 「展开明细」（§4.1：fetch detail → 平开/移门只读子表）—— 2026-09-20 从 `Home.vue` 搬出
 * （逻辑逐字未改，**唯一一处真改代码**见下方「断环」）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）：
 *   · `Home.vue:1888-2014` —— 段一：`expandedRowKeys` … `loadDetail`（19 个声明）
 *   · `Home.vue:2107-2257` —— 段二：`renderExpandDetail` … `fillLineNumbersFor`（4 个声明）
 *
 * ⚠️ **段二是 `2107–2257`，不是 `2134–2257`**：`2107–2133`（27 行）是 `renderExpandDetail`
 *    头上那**一整段 `/* … *\/` 说明**（F5 审计误判的更正、「互斥不成立」的源码实证、
 *    以及那条**有意偏离的两条理由 + 回退条件**）。方案/spec §3.1 从 `function` 那一行起算，
 *    把它漏在外面了 —— 丢了它，下一个人会把「只在有明细时才渲染」当成 bug 去改。
 *    段一的 `1888–2014` 已逐行复核过，边界无误（2014 是 `loadDetail` 的 `}`）。
 *
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（B6 一条）。
 *
 * ## 注入的都是**页面拥有的东西**
 *
 *   · `message` —— `useMessage()`；`dialog` —— `useDialog()`（两者都是页面级组件上下文）；
 *   · `openPrintPreview` —— **B9 的接缝**（`composables/home/useHomePrint.ts` 拥有）。
 *
 * ⚠️ **这里有一个回头边，是抽这一块时唯一必须真改代码的地方**（详见下方「断环」）：
 *    REF 的 `calcSingleRowInExpand` 末尾三句**直接写 B9 的状态**（`printOrders` / `onOpenMode` /
 *    `previewAutoLineNumbers`），于是 B6 反向依赖 B9；而 B9 的 `openPrint` 又读 B6 的 `details`
 *    ⇒ **两边都有边 = 真环**。断法是「把那三句收成 B9 自己的一个函数、B6 改成注入调用」——
 *    收出来的那个函数就是 `useHomePrint.ts` 里的 `openPrintPreview(orders, autoLineNumbers)`。
 *    断完只剩 **B9 → B6** 一条单向边 ⇒ **本工厂必须在 `useHomePrint(...)` 之上调用**。
 *    （页面上因此有个**前向引用**：本工厂拿到的 `openPrintPreview` 是转发到下面那个 `const` 的
 *      箭头函数 —— 它在**点击时**才求值，setup 期间不会被调，所以合法。）
 *
 * 模块级依赖（`api` / `h` / `NSpin` / `NEmpty` / `DetailLinesTable` / `LS` / `useOrderLines` /
 * `useDetailLineDialogs` / 各类型）本文件直接 `import`，不走注入 —— 与 `useHomeSelection.ts`
 * 同一口径。
 *
 * ## 回传**只有 8 项**，每一项都有实测的外部读者（少一项就编译红或静默坏）
 *
 * | 回传 | 谁需要 |
 * |---|---|
 * | `expandedRowKeys` | 模板 `:114` · B7 的 `expandedIds` · B4 的「查单号」 |
 * | `details` | B9 的 `openPrint`（经注入）· B4 的「查单号」 |
 * | `homeFormulas` | 页面的 `onMounted`（`void api.listFormulas().then((f) => (homeFormulas.value = f))`）|
 * | `homeDialogs` | 模板 `:411`（`<DetailLineDialogs :d="homeDialogs" />`）|
 * | `loadedIds` | B7 的 `rowClass`（行类 `loaded-row`）|
 * | `onExpandedKeys` | 模板 `:119`（`@update:expanded-row-keys`）|
 * | `loadDetail` | B4 的「查单号」 |
 * | `renderExpandDetail` | `columns` 的 `{ type: 'expand', renderExpand }` |
 *
 * 其余 15 个声明（`loadingDetail` / `lineRefs` / `lineRefOf` / `normalizeLines` / `homeDisableAutoMarkup` /
 * `homeDetailHooks` / `homeSelectTick` / `tableShown` / `shownOf` / `homeLineInputOf` / `homeCalcEngine` /
 * `addRowToExpand` / `batchDeleteInExpand` / `calcSingleRowInExpand` / `fillLineNumbersFor`）
 * **段外零命中**（实测），所以**不回传** —— 回传了也没人用，反而让接口失真。
 *
 * ⚠️ 回传的是**状态本身**（ref / reactive 对象），不是 `.value` 的副本 ——
 *    模板 `:expanded-row-keys` 虽是**单向读**（不是 `v-model:`），但传 `expand.expandedRowKeys`
 *    过去拿到的是**那个 Ref 对象**（模板不解包 `obj.ref`），`n-data-table` 要的是数组 ⇒ **照样坏**。
 *    ⇒ `Home.vue` 侧**必须解构**，不许写成 `expand.xxx`。
 */
import { h, reactive, ref, type Ref } from 'vue'
import { NEmpty, NSpin, type DataTableRowKey, type DialogApi, type MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { FormulaDto, OrderDto, OrderLineDto, OrderLineInput, OrderSummaryDto } from '../../api/types'
import type { Line } from '../../utils/partsEngine'
import { LS, useOrderLines } from '../useOrderLines'
import { useDetailLineDialogs } from '../useDetailLineDialogs'
import DetailLinesTable from '../../components/DetailLinesTable.vue'

/** `useHomeExpand()` 的注入面。**只放页面拥有的东西**（见文件头）。 */
export interface HomeExpandDeps {
  message: MessageApi
  /** 展开行「批量删除」的确认框。 */
  dialog: DialogApi
  /**
   * 展开行「算料」算完要开「生产单」预览 —— **B9 的接缝**（`useHomePrint.ts` 拥有）。
   *
   * ⚠️ 传进来的是那个函数的**转发**（页面上它要前向引用下面的 `useHomePrint(...)`，
   *    见文件头「断环」）—— 但**语义与直接传函数完全一致**：点击时才求值。
   */
  openPrintPreview: (orders: OrderDto[], autoLineNumbers: boolean) => void
}

/**
 * 展开明细（`details` / 行 ref / 只读子表渲染 / 4 个行级动作）。
 *
 * ⚠️ **构造顺序**：必须在**它依赖的页面级状态之后**调用 —— `message` / `dialog` 是组件上下文
 *    （`Home.vue` 顶部就建好了）；`openPrintPreview` 那条边是**反向**的（B9 在它下面），
 *    所以调用点要排在 `useHomePrint(...)` **之上**。传早了拿到的是 `undefined`，且**不一定报错**。
 */
export function useHomeExpand(deps: HomeExpandDeps) {
  // ---------------------------------------------------------------------------
  // 展开明细（§4.1：fetch detail → 平开/移门只读子表）
  // ---------------------------------------------------------------------------
  const expandedRowKeys = ref<DataTableRowKey[]>([])
  const details = reactive<Record<number, OrderDto>>({})
  const loadingDetail = reactive<Record<number, boolean>>({})

  // ── 展开行 = 与 Hui 同一张明细表（2026-09-19，方案第 5c 步）────────────────────
  // 旧版 Home 挂的就是 Hui 那两个 SFC 本体（`Home.formatted.js:9` import 自 Hui chunk）。
  // 新版挂 `components/DetailLinesTable.vue`，它按 `kind` 分派平开/移门。
  //
  // ⚠️ **引擎是「每张单一份」**：引擎依赖里 `lines` 是一个 ref，而 Home 同时可能展开多张单。
  //    组件为此提供了 `engineDeps` 自建模式（见该组件 `props.engine` 的注释）。
  const homeFormulas = ref<FormulaDto[]>([])
  /** 「自动加价设置」在 Hui 页设置、存 localStorage；Home 只读它，好让两边口径一致。 */
  const homeDisableAutoMarkup = ref(LS.get('smartdoor_disable_auto_markup') === 'true')

  /**
   * 每张单一个行数组 ref，**指向同一个数组本体**（`details[id].lines`），
   * 这样表格里改一行、下面别处读到的就是同一份数据。
   */
  const lineRefs = new Map<number, Ref<Line[]>>()
  function lineRefOf(id: number): Ref<Line[]> {
    let r = lineRefs.get(id)
    if (!r) {
      r = ref<Line[]>([])
      lineRefs.set(id, r)
    }
    return r
  }

  /** 明细行的归一：`OrderLineDto.parts/markup` 落库是 JSON，非数组一律当空（同 `useOrderPrint.toLines`）。 */
  function normalizeLines(lines: OrderLineDto[]): Line[] {
    for (const l of lines) {
      const raw = l as unknown as Line
      if (!Array.isArray(raw.parts)) raw.parts = []
      if (!Array.isArray(raw.markup)) raw.markup = []
    }
    return lines as unknown as Line[]
  }

  /**
   * 页面级回调 —— 与 Hui 的 `detailHooks` 同形。
   *
   * ✅ `calcSingleRow` **已经会顺手开「生产单」预览**（2026-09-19 更正这条注释，原写「尚未接」）：
   *    实现在 `calcSingleRowInExpand`（本文件 `:2220-2232`）—— 引擎算料 → 换成这一张单
   *    → `onOpenMode('product','生产单')`。旧版走的是「内嵌整个 Hui 页面组件」那条路
   *    （`Home.formatted.js:8221-8263`），我们改成「引擎算料 + 复用本页现成的打印预览弹窗」，
   *    结果一样、路更短。
   */
  const homeDialogs = useDetailLineDialogs({
    // 行内重算只看行本身 + formulas，用哪一份引擎实例都一样；挑一个稳定的。
    lineRefresh: (l: Line) => homeCalcEngine.lineRefresh(l),
  })
  const homeDetailHooks = {
    openSquareDialog: (l: Line) => homeDialogs.openSquareDialog(l),
    openAddMarkup: (l: Line) => homeDialogs.openAddMarkup(l),
    pickDoorImg: (l: Line) => homeDialogs.pickDoorImg(l),
    removeDoorImg: (l: Line) => homeDialogs.removeDoorImg(l),
    openTextImg: (l: Line) => homeDialogs.openTextImg(l),
    previewImage: (url: string) => homeDialogs.previewImage(url),
    // 占位：展开行是**每张单一份 hooks**（下面 `renderExpandDetail` 会覆盖它，好把 id 绑进去）
    calcSingleRow: (l: Line) => void homeCalcEngine.calcRowParts(l),
    // 勾选计数是**每张单各一份**（Home 的展开行各是独立的表）—— 用 tick 触发重算。
    onSelectChange: () => {
      homeSelectTick.value++
    },
    lineInputOf: (l: Line) => homeLineInputOf(l),
  }
  /** 勾选计数用的 tick（Home 每张单自己算，不像 Hui 那样两表共用）。 */
  const homeSelectTick = ref(0)
  /** 展开行里每张单的平开/移门显隐（旧版 `uo(row, kind)`，初值都是 true）。 */
  const tableShown = reactive<Record<number, { ping: boolean; diao: boolean }>>({})
  function shownOf(id: number) {
    if (!tableShown[id]) tableShown[id] = { ping: true, diao: true }
    return tableShown[id]
  }
  /** 展开行的行级保存要发完整行 —— 与 Hui 的 `lineInputOf` 同一件事。 */
  function homeLineInputOf(l: Line): OrderLineInput {
    // ⚠️ 必须发**完整行**：后端 `service::update_line` 是 45 列 SET 全字段替换（见 client.ts 的注释）。
    const { isSelected: _drop, ...rest } = l
    void _drop
    return rest as unknown as OrderLineInput
  }

  /**
   * 供「弹窗 / 单行算料」用的**一个**引擎实例（Home 的表格各自在组件内自建引擎，
   * 那些实例在 setup 里拿不到，而 `useDetailLineDialogs` 与 `calcSingleRow` 都需要一个）。
   */
  const homeCalcEngine = useOrderLines({
    lines: ref<Line[]>([]),
    formulas: homeFormulas,
    order: reactive({ client_code: '' }),
    orderId: ref<number | null>(null),
    disableAutoMarkup: homeDisableAutoMarkup,
  })
  /**
   * 明细**已加载成功**的订单 id（旧版 `_o`，`:7792`）—— 用于行类 `loaded-row`。
   *
   * ⚠️ 只有 detail 接口**返回 200** 才加进去（旧版 `:7792` 在 `if(200===o.code)` 分支里 add）；
   *    失败/报错**不加**。与 `details`（有值即算）不完全等价，所以单独记一个集合。
   */
  const loadedIds = ref<Set<number>>(new Set())

  function onExpandedKeys(keys: DataTableRowKey[]) {
    expandedRowKeys.value = keys
    for (const k of keys) {
      const id = Number(k)
      if (!details[id]) loadDetail(id)
    }
  }

  async function loadDetail(id: number) {
    loadingDetail[id] = true
    try {
      details[id] = await api.getOrder(id)
      // 展开行的表格读的是这个 ref —— **指向同一个数组本体**（`details[id].lines`），
      // 这样表里改一行、打印链路读到的就是同一份数据。见 `lineRefOf` 的注释。
      lineRefOf(id).value = normalizeLines(details[id].lines ?? [])
      // 旧版 `:7792` `_o.value.add(回执单号)` —— 只在 detail 成功那支里做。
      loadedIds.value = new Set(loadedIds.value).add(id)
    } catch (e) {
      deps.message.error((e as Error).message || '加载明细失败')
    } finally {
      loadingDetail[id] = false
    }
  }

  /*
   * 展开行明细（§4.1）：平开/移门只读子表，逐行 fetch detail。
   *
   * ⚠️ 更正审计 `01-table.md` F5 的一处误判（已回源码核实，2026-09-18）：
   *    审计写「旧版两张子表用 `v-show` **互斥**切换，新版『有就都渲染』」——**「互斥」不成立**。
   *    旧版 `:11306-11317` 的实况是**两个各自独立的 `v-show`**，且两者的初值都是 `true`：
   *      ```js
   *      no = reactive({})                                    // `:7650`
   *      uo = (e, t) => { if (!no[e]) no[e] = { ping: true, diao: true }; return no[e][t] }
   *      // 模板：
   *      <div v-show="uo(row.回执单号,'ping')" > <平开子表 v-model:showPingkai="uo(row.回执单号,'ping')" … /> </div>
   *      <div v-show="uo(row.回执单号,'diao')" > <移门子表 v-model:showDiao   ="uo(row.回执单号,'diao')" … /> </div>
   *      ```
   *    ⇒ 展开任何一行，**两张子表默认都渲染**（即使某一类一行明细都没有，也只是渲出一张空表）。
   *    所谓「切换」来自子组件的 `v-model:showXxx` 回写：子表只在**删掉自己最后一行**时
   *    emit `update:showPingkai/showDiao = (rows.length > 0)`（Hui 侧
   *    `Hui.formatted.js:1571-1572` 平开 / `:4358-4359` 移门，都在 `removeFirstRow` 里），
   *    从而把自己整个藏掉。两张表之间没有任何联动。
   *
   * **有意偏离（保留现状，不改成「都渲染」）**：新版 `if (ping.length)` / `if (diao.length)`
   * 只在**该类有明细时**才出一块。理由两条：
   *   ① 新版这两张是**只读**自绘表，没有「删最后一行」这条路径，旧版那个 `v-model:showXxx`
   *      回写在新型里没有对应物 ⇒ 就算照抄「无条件都渲染」，也只是多出一张空表，拿不到旧版的语义；
   *   ② 旧版那张空表来自「复用 Hui 汇算表」这一整套策略（审计 F3/A3 的架构级偏离），
   *      不是这里能补的 —— 补它要先把 `Hui.vue` 的两张表拆成可复用组件，属独立立项。
   * 若将来说要做 F3（复用 Hui 子表），这条要跟着一起回退。
   */
  function renderExpandDetail(row: OrderSummaryDto) {
    const id = row.id
    if (loadingDetail[id]) {
      return h('div', { class: 'expand-detail' }, [h(NSpin, { show: true }, { default: () => '加载明细…' })])
    }
    const detail = details[id]
    if (!detail) return h('span')

    const rows = lineRefOf(id).value
    const ping = rows.filter((l) => l.line_type === 'ping')
    const diao = rows.filter((l) => l.line_type === 'diao')
    const shown = shownOf(id)
    // 勾选数每张单自己算（`homeSelectTick` 只是触发重算）
    void homeSelectTick.value
    const selectedCount = rows.filter((l) => l.isSelected).length

    /** 一张表。`engineDeps` 让组件为**这张单**自建一份引擎（引擎的 `lines` 只能有一个 ref）。 */
    const table = (kind: 'ping' | 'diao', data: Line[]) =>
      h(DetailLinesTable, {
        kind,
        rows: data,
        // 列显隐：Home 不提供逐列开关，全显（空对象 ⇒ `colVis` 恒 true）
        colVis: {},
        client: { name: detail.client_name || '', code: detail.client_code || '' },
        engineDeps: {
          lines: lineRefOf(id),
          formulas: homeFormulas,
          order: { client_code: detail.client_code || '' },
          orderId: ref(id),
          disableAutoMarkup: homeDisableAutoMarkup,
        },
        savedOrderId: id,
        selectedCount,
        filling: false,
        // ⚠️ hooks 是**每张单一份**：`calcSingleRow` 要绑上本单 id（算完要开这一单的生产单预览）
        hooks: { ...homeDetailHooks, calcSingleRow: (l: Line) => void calcSingleRowInExpand(id, l) },
        'onAdd-row': () => addRowToExpand(id, kind),
        'onBatch-delete': () => batchDeleteInExpand(id),
        'onToggle-show': () => (shown[kind] = !shown[kind]),
        'onFill-line-numbers': () => void fillLineNumbersFor(id),
      })

    const children: (ReturnType<typeof h> | null)[] = []
    if (shown.ping && ping.length) children.push(table('ping', ping))
    if (shown.diao && diao.length) children.push(table('diao', diao))
    if (!rows.length) children.push(h(NEmpty, { description: '暂无明细', size: 'small' }))
    return h('div', { class: 'expand-detail' }, children)
  }

  /**
   * 展开行「添加行」（旧版子表底部那颗）。Home 里没有引擎实例可直接用，
   * 用 `newLine` 造一行推进该单的行数组 —— 口径与 Hui 一致（默认值都走引擎）。
   */
  function addRowToExpand(id: number, kind: 'ping' | 'diao') {
    const rows = lineRefOf(id).value
    rows.push(homeCalcEngine.newLine(kind))
  }

  /** 展开行「批量删除(选中)」——只删本地行，落库要逐行走行级保存（旧版也是即时 `deleteRow`，见方案 §3.3）。 */
  function batchDeleteInExpand(id: number) {
    const r = lineRefOf(id)
    const sel = r.value.filter((l) => l.isSelected)
    if (!sel.length) {
      deps.message.warning('请先勾选要删除的行')
      return
    }
    deps.dialog.warning({
      title: '批量删除',
      content: `确定删除选中的 ${sel.length} 行吗？`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        for (const l of sel) {
          if (l.id != null) {
            try {
              await api.deleteOrderLine(id, l.id)
            } catch {
              // 单行失败继续（与 Hui 的 batchDeleteRows 同）
            }
          }
          // ⚠️ 用 splice 而不是 r.value = filter(...)：后者会把 ref 换成**新数组**，
          // 与 `details[id].lines` 脱钩，打印链路就读不到删干净的行了。
          const i = r.value.indexOf(l)
          if (i >= 0) r.value.splice(i, 1)
        }
        deps.message.success('已删除选中行')
      },
    })
  }

  /**
   * 展开行的「算料」：算完**顺手开「生产单」预览**。
   *
   * 旧版 Home 就是这么做的（`Home.formatted.js:8221-8263`：调内嵌 Hui 页面的 `calculateReceipt`
   * → 拿 `produces` → 用「生产单」模板构造 → 开预览弹窗）。新版不内嵌 Hui 页面，
   * 改成「引擎算料 + 复用本页现成的打印预览弹窗」—— 结果一样，路更短。
   */
  async function calcSingleRowInExpand(id: number, l: Line) {
    const ok = await homeCalcEngine.calcRowParts(l)
    if (!ok) return
    deps.message.success(`算料完成：${l.parts.length} 个部件`)
    const detail = details[id]
    if (!detail) return
    // 预览读的是 `printOrders`（与「打印选项」抽屉同一条链路），这里换成这一张单。
    deps.openPrintPreview([detail], false)
  }

  /** 展开行「填入单号」（只有平开表有这颗按钮，见组件内 `kind === 'ping'`）。 */
  async function fillLineNumbersFor(id: number) {
    try {
      const map = await api.fillLineNumbers(id)
      for (const l of lineRefOf(id).value) {
        const v = map?.[String(l.id)]
        if (v) l.line_no = v
      }
      deps.message.success('已填入单号')
    } catch (e) {
      deps.message.error(e instanceof Error ? e.message : '填入单号失败')
    }
  }

  return {
    // ⚠️ 只回传这 8 项（每项都有实测的外部读者，见文件头那张表）——
    //    其余 15 个声明段外零命中，回传了也没人用。
    expandedRowKeys,
    details,
    homeFormulas,
    homeDialogs,
    loadedIds,
    onExpandedKeys,
    loadDetail,
    renderExpandDetail,
  }
}
