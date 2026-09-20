/**
 * 「查询更多」弹窗（B5）—— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）：
 *   · `Home.vue:1205-1243` + `1246-1382`
 *
 * ⚠️ **为什么中间少了一段 `1244-1245`**（**Ruling 51**）：那是 `querySearchPreset` 与它上面
 *    那行 JSDoc。它的**读者**是 B3 的 `watch`(`REF:955`)，本块只是**写者**(`REF:1362`)——
 *    「共享 ref 声明在最早构造的读者块里，后来者注入写」⇒ **B3 声明，本块注入写**。
 *    （**Ruling 51** 原文：共享状态归最早构造的读者；本块在构造顺序里排最后。）
 *
 * ⚠️ **本块不拥有任何共享状态** —— 十块里唯一一个「只写别人的 ref」的块，9 处跨块写入全靠注入：
 *    · `rawOrders` / `financeSummary`  属 B1（`useHomeData.ts`）—— 本块把查询结果**并回主表**；
 *    · `searchText` / `queryRows` / `queryMode` / `querySearchPreset` 属 B3（`useHomeFilterView.ts`）
 *      —— 本块进/退查询态、写搜索框。
 *    **绝不许在本文件里重新声明这四个 ref** —— 那会造成两套状态、**静默不一致**，
 *    而且 `home-extract-movecheck.mjs` **抓不到**（它只比声明的文本，不比「这个声明该不该存在」）。
 *
 * ⚠️ **`querySearchPreset` → `searchText` 的写入顺序是语义，不是风格。**
 *    依据是 B3 里 `watch(searchText)`(`REF:954`) 上方 `REF:953` 的注释逐字写着：
 *    「进查询态时 `submitQuery` 是先写 `querySearchPreset` 再写 `searchText`，所以那一次不会误退出。」
 *    ⇒ **反过来的话那个 `watch` 会把 `queryMode` 打回 `false`，弹出结果立刻消失** ——
 *    静默行为破坏，测试多半抓不到。**不许对调这两行。**
 *
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（**第 8 块**，B5 一条）——
 * 11 个声明逐字比对；本块登记的注入改写（8 条）写在那块的 `rewrites` 里，改本文件任何字面都会报红。
 *
 * 注入的都是**页面拥有的东西**（响应式状态 / 组件上下文 API）；模块级依赖
 * （`api` / `pad` / `progressMatch` / `canSeeAllOrders` / naive-ui 与 `api/types` 的类型）
 * 本文件直接 `import`，不走注入 —— 与 `useHomeData.ts` / `useHomeSelection.ts` 同一口径。
 */
import { computed, reactive, ref, type Ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { ClientDto, OrderFinance, OrderSummaryDto } from '../../api/types'
import { pad } from '../../utils/homeDate'
import { progressMatch } from '../../utils/homeMetrics'
import { canSeeAllOrders } from '../../utils/roles'
import type { useAuthStore } from '../../stores/auth'

/** `useHomeQueryMore()` 的注入面。**只放页面拥有的东西**（见文件头末段）。 */
export interface HomeQueryMoreDeps {
  // —— 属 B1：本块**写**它们（把查询结果并回主表）
  rawOrders: Ref<OrderSummaryDto[]>
  financeSummary: Ref<Record<string, OrderFinance>>
  // —— 属 B3：本块**写**它们（进查询态 / 退出查询态 / 写搜索框）
  searchText: Ref<string>
  queryRows: Ref<OrderSummaryDto[]>
  queryMode: Ref<boolean>
  querySearchPreset: Ref<string>
  // —— 页面拥有
  auth: ReturnType<typeof useAuthStore>
  message: MessageApi
}

/**
 * 「查询更多」弹窗的全部逻辑（旧版 `ms` / `ys`，审计 C21 —— 旧版唯一的**日期范围**筛选入口）。
 *
 * ⚠️ **构造顺序（Ruling 54）**：`B1 → B3 → B6 → B7 → B4 → **B5**` —— 本块**在最后**，
 *    必须在 `useHomeOrderNo(...)` 之后调用。
 *    放早了 `deps.searchText` 等是 `undefined`，而 `submitQuery` 只在用户点「确定查询」时才走到那里
 *    ⇒ **编译过、启动过、平时不报错，只有点那一下才炸。**
 */
export function useHomeQueryMore(deps: HomeQueryMoreDeps) {
  // ---------------------------------------------------------------------------
  // 「查询更多」弹窗（审计 C21 —— 旧版唯一的**日期范围**筛选入口）
  // ---------------------------------------------------------------------------
  /*
   * 旧版坐标：
   *   · 入口按钮      `:11269-11273`（工具栏 ` 查询更多 `，class `custom-search-btn`，onClick `ms`）
   *   · 开弹窗        `:11029-11045`（`ms`：重置表单 → 开弹窗 → 顺手拉一次客户列表）
   *   · 弹窗模板      `:12118-12176`（`el-dialog` 标题 `dr(980)`=「查询订单」，width 500px）
   *   · 确认          `:11047-11120`（`ys`）
   *   · 结果并入主表  `:11078-11083`
   *
   * ⚠️ **审计 C22「查询更多的结果预览表」不存在**（已回源码核）：审计把 `:12132` **之前**那段
   *    认成了结果表格，但那其实是 **「手动更新进度」弹窗**（`dr(1017)`，width 460px，
   *    字段 = 回执单号/操作名称/日期/记录日期）。审计引的 `{key:0,label:"客户"}` / `{key:1,…安装地址}`
   *    是查询弹窗里两个 `el-form-item` 的 **`v-if` 分支 key**（`:12136`/`:12148`），不是表格列。
   *    旧版查询结果**没有**任何预览表，直接进主表（见下 `queryMode`）。故 C22 无落点，不实现。
   *
   * ⚠️ **`rl` 那个「确认统计」分支不实现**：同一只弹窗靠 `rl`（`:7599` `Vue.ref(!1)`）分两态 ——
   *    `rl=true` → 有「安装地址」+ 底部「确认」(`ys` → `getMoreTableDate`)；
   *    `rl=false` → 无「安装地址」+ 底部「确认统计」(`vs` → `getMoreOrders` → 直接出 PDF)。
   *    全组件里 `rl` **只在 `ms` 里被置 true**（`:11031`，它的唯一赋值点），弹窗也只在 `ms` 里开
   *    （`cs` 唯一的 `=!0` 也在 `:11031`）⇒ `rl=false` / `vs` / `getMoreOrders` 在旧版是**不可达的死分支**，
   *    新版不做不算漏。
   *
   * ⚠️ **`Yt`（工厂/终端视图开关）**：`Yt` 的赋值只有两处 —— 初值 `!0`（`:7581`）、
   *    终端视图时置 `!1`（`:7885`/`:8147`）。新版明确只做工厂视图（既有先例，见 `Home.vue:929` 注释），
   *    ⇒ `Yt` 恒真 ⇒ 「客户」字段**恒显示**（旧版 `:12135` 的 `Yt ? … : createCommentVNode`）。
   */
  const queryShow = ref(false)
  const queryLoading = ref(false)
  /** 客户候选 = 旧版 `nl`（`getClientsInfo` 的结果，`ms` 里灌入）。旧版初值是 3 条假数据（张三/李四/王五），新版不播种。 */
  const queryClients = ref<ClientDto[]>([])
  const queryForm = reactive<{
    client: string
    address: string
    startTs: number | null
    endTs: number | null
    onlyProduction: boolean
  }>({ client: '', address: '', startTs: null, endTs: null, onlyProduction: false })

  /**
   * 本地「今天 00:00」起算的 `offsetDays` 天前的时间戳（`n-date-picker` 的 model 是时间戳）。
   * 用它而不是 `Date.now() - n*86400000`：跨夏令时的地区后者会飘到前一天的 23 点。
   */
  function dayStart(offsetDays = 0): number {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + offsetDays)
    return d.getTime()
  }

  /**
   * 弹窗默认起始日期 = **去年今天**（旧版 `ds`，`:11024-11027`：
   * `t.setFullYear(t.getFullYear() - 1)` 后取 ISO 日期）；默认结束日期 = 今天（旧版 `ss`，`:11025`）。
   */
  function yearAgoStart(): number {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setFullYear(d.getFullYear() - 1)
    return d.getTime()
  }

  // 快捷项（旧版 `Ds`，`:11228-11241`）：今天 / 昨天 / 一周前，顺序与文案逐个对齐。
  // ⚠️ 有意的写法差异：旧版 `Ds` 是 setup 里算好的**定值数组**，跨零点就会把「今天」选成昨天；
  //    这里用函数形态（Naive 的 `shortcuts` 值可以是 `() => number`，点击时才求值）。
  const DATE_SHORTCUTS: Record<string, () => number> = {
    今天: () => dayStart(0),
    昨天: () => dayStart(-1),
    一周前: () => dayStart(-7),
  }

  /** 时间戳 → 本地 `YYYY-MM-DD`（旧版 `value-format:"YYYY-MM-DD"`，Element 按本地日期格式化）。 */
  function toIsoDate(ts: number | null): string {
    if (ts == null) return ''
    const d = new Date(ts)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  // 旧版 `jl`（`:7644-7646`）：按 `name` 子串（不区分大小写）过滤 `nl`；查询词为空则给全量。
  // Naive 的 `n-auto-complete` **没有**内置过滤（props 里没有 `filter`），候选要自己算 —— 口径与旧版一致。
  const clientSuggestions = computed(() => {
    const q = queryForm.client.trim().toLowerCase()
    return queryClients.value
      .filter((c) => !q || (c.name ?? '').toLowerCase().includes(q))
      .map((c) => ({ label: c.name, value: c.name }))
  })

  /** 旧版 `ms`（`:11029-11045`）：重置表单 + 开弹窗 + 拉客户列表。 */
  async function openQuery() {
    queryForm.client = ''
    queryForm.address = ''
    queryForm.startTs = yearAgoStart()
    queryForm.endTs = dayStart(0)
    queryForm.onlyProduction = false
    queryShow.value = true
    try {
      queryClients.value = await api.listClients()
    } catch {
      // 旧版此处文案 `dr(850)` =「初始化客户信息失败」。
      deps.message.error('初始化客户信息失败')
    }
  }

  /** 旧版 `ys`（`:11047-11120`）：取数 → 过滤 → 并入主表 → 进查询态。 */
  async function submitQuery() {
    queryLoading.value = true
    try {
      // ① 取数。旧版 URL 只有 4 个条件（`:11074`）：
      //    `param3=客户 &param4=安装地址 &param5=起始日期 &param6=结束日期`。
      //    旧版在 fetch 前还调了一次 `ts()`（`:11047`），那只是清 `es` 这张
      //    `getLatestClientsInfo` 的缓存（`:10986`）—— 新版没有这张缓存，无对应动作。
      let rows = await api.searchOrders({
        client_name: queryForm.client,
        install_address: queryForm.address,
        start_date: toIsoDate(queryForm.startTs),
        end_date: toIsoDate(queryForm.endTs),
      })

      // ② 非管理员只看自己打的单（旧版 `:11076` `!qt.value && (s = s.filter(t => t["打单人"] === _t.value))`）。
      //    必须在**并入主表之前**做：旧版并进 `_l` 的就是过滤后的 `s`，而列头筛选的候选值读的是 `_l`。
      if (!canSeeAllOrders(deps.auth.user?.role)) {
        rows = rows.filter((r) => r.creator_name === deps.auth.user?.name)
      }

      /*
       * ③ 只含生产单。
       * ⚠️ **有意偏离（旧版这颗 checkbox 在查询路径上是死的）**：旧版 `ys` 的 URL 只拼了
       *    param3–param6，**没有** `Vs.includeProductionOrder`（`:11074` 那一行）；
       *    该标志只被隔壁 `vs`（`getMoreOrders`）当 param6 用（`:11095`）。
       *    但弹窗里这颗 checkbox 名叫「只含生产单」，语义明确，摆着不动会被当成新版的 bug。
       *    这里按标签本义接上，口径取现有「已打生产单」（`progressMatch`，旧版 `Ao` `:7682`）——
       *    即 `打单操作` 含「生产单」。**如需 100% 照旧版（勾了等于没勾），删这 3 行即可。**
       */
      if (queryForm.onlyProduction) {
        rows = rows.filter((r) => progressMatch(r, '已打生产单'))
      }

      deps.queryRows.value = rows
      deps.queryMode.value = true

      // ④ 并入主表 `_l`（旧版 `:11078-11083`）：同 `回执单号` 的**替换**成查询回来的这条，
      //    新的**追加到末尾**（旧版这段不排序；`_l` 原本的降序只体现在原有行上）。
      //    注：新版两个接口（`/orders` 与 `/orders/search`）都是本租户全量，所以实际只会刷到已有行。
      const existing = new Set(deps.rawOrders.value.map((r) => r.receipt_no))
      const byReceipt = new Map(rows.map((r) => [r.receipt_no, r]))
      deps.rawOrders.value = [
        ...deps.rawOrders.value.map((r) => byReceipt.get(r.receipt_no) ?? r),
        ...rows.filter((r) => !existing.has(r.receipt_no)),
      ]

      // ⑤ 搜索框回显「客户 地址」（旧版 `Rc = ((selectedClient||"")+" "+(selectedAddress||"")).trim()`，`:11083`）。
      // ⚠️ 照抄的旧版行为：`Rc` 会在 150ms 后灌进 `Fc`，而 `ps` 拿 `Fc` 做**整串** `includes` 过滤
      //    （`:11176-11179`，9 个字段 OR，不切词）。所以**同时填了客户和地址**时（"张三 幸福路1号"）
      //    没有任何字段能整串命中 ⇒ 查询结果会被搜成 0 行。只填日期、或只填客户则正常。
      //    这是旧版自身的缺陷，本轮按**保真优先**原样保留；要修的话改成两块分开 OR 即可。
      deps.querySearchPreset.value = `${queryForm.client} ${queryForm.address}`.trim()
      deps.searchText.value = deps.querySearchPreset.value

      queryShow.value = false

      // ⑥ 财务字段（旧版 `:11085-11101`，仅在 `Yt && Ht`（工厂 + 启用财务）时执行）。
      //    新版没有 `Ht` 开关、财务恒开，而 `financeSummary` 又已被主表 `load()` 拉过一份 ——
      //    这里按查询的起始日期把窗口放大后重取一次，保证查出来的老单在「已付/未付」列上
      //    也能读到 `已分配金额`（否则回退成 总价-定金）。窗口只会变大，不会比 `load()` 的 60 天小。
      const startIso = toIsoDate(queryForm.startTs)
      if (startIso) {
        const days = Math.max(60, Math.ceil((Date.now() - Date.parse(startIso)) / 86400000))
        deps.financeSummary.value = await api.getOrderFinanceSummary(days).catch(() => deps.financeSummary.value)
      }
    } catch (e) {
      // 旧版失败文案 `dr(722)` =「查询数据失败」。
      deps.message.error((e as Error).message || '查询数据失败')
    } finally {
      queryLoading.value = false
    }
  }

  return {
    queryShow,
    queryLoading,
    queryForm,
    DATE_SHORTCUTS,
    clientSuggestions,
    openQuery,
    submitQuery,
  }
}
