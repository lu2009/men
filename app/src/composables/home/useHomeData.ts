/**
 * 「数据 / 加载」+「经营看板」—— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）：
 *   · `Home.vue:538-544` + `546-560` —— `loading` / `rawOrders` / `financeSummary` / `load`
 *   · `Home.vue:1540-1548` —— `dashboardShow` / `dashboardOrders`
 * `onMounted`(562-571) / `onLogout`(573-576) **故意留在页面**（`onMounted` 写 B6 的 `homeFormulas`）。
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（**第 6 块**，B1 一条）——
 * 6 个声明逐字比对；本块登记的注入改写（`message.error(` / `auth.user?.` 各加 `deps.` 前缀）
 * 写在那个块的 `rewrites` 里，改本文件任何字面都会在守卫里报红。
 *
 * ⚠️ `rawOrders` / `financeSummary` 是本块**拥有并借出**的状态：B5（查询更多）会**写入**它们
 *    （`1352`/`1353`/`1374`），`columns` 与 B3/B4/B6/B11 会**读**它们。
 *    所以 `return` 的必须是**那个 ref 本身**，不是 `.value` 的副本。
 *
 * 注入的都是**页面拥有的东西**；模块级依赖（`api` / `canSeeAllOrders` / 类型）本文件直接 `import`。
 */
import { computed, ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import { canSeeAllOrders } from '../../utils/roles'
import type { useAuthStore } from '../../stores/auth'
import type { OrderFinance, OrderSummaryDto } from '../../api/types'

export interface HomeDataDeps {
  /** `load()` 失败时的提示。 */
  message: MessageApi
  /** `dashboardOrders` 按角色过滤要用它。 */
  auth: ReturnType<typeof useAuthStore>
}

export function useHomeData(deps: HomeDataDeps) {
  // ---------------------------------------------------------------------------
  // 数据 / 加载
  // ---------------------------------------------------------------------------
  const loading = ref(false)
  const rawOrders = ref<OrderSummaryDto[]>([])
  // 财务摘要：{order_id → 未收金额}，供主表「未收 = 未收金额 ?? 总价-定金」口径（§7.1）。
  const financeSummary = ref<Record<string, OrderFinance>>({})

  async function load() {
    loading.value = true
    try {
      const [orders, summary] = await Promise.all([
        api.listOrders(),
        api.getOrderFinanceSummary().catch(() => ({})),
      ])
      rawOrders.value = orders
      financeSummary.value = summary
    } catch (e) {
      deps.message.error((e as Error).message || '加载订单失败')
    } finally {
      loading.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // 经营看板（§1.2 DashboardBigScreen）：全量订单（按角色过滤），看板内自带日期/客户/业务员筛选
  // ---------------------------------------------------------------------------
  const dashboardShow = ref(false)
  const dashboardOrders = computed(() =>
    canSeeAllOrders(deps.auth.user?.role)
      ? rawOrders.value
      : rawOrders.value.filter((r) => r.creator_name === deps.auth.user?.name),
  )

  return { loading, rawOrders, financeSummary, load, dashboardShow, dashboardOrders }
}
