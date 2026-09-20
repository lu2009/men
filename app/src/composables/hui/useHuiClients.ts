/**
 * 「客户」—— 客户目录、按客户套用资料、切换客户时的清空确认（C5）。
 * 2026-09-20 从 `Hui.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）是**两段**：
 *   · `Hui.vue:1370-1410` —— `clients` / `clientOptions` / `lastAppliedClient` / `applyClient` / `onClientChange`
 *   · `Hui.vue:2091-2093` —— `currentClient`（按 `order.client_code` 反查当前客户）
 * 两段合计 **6 个声明**（与 spec §3.3 的 C5 对得上）。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C5 一条）。
 *
 * ## 注入面 = **3 项**
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `order` | 页面脊梁（`reactive`） | `applyClient` 写 `client_name`/`phone`/`brand`；`onClientChange` 写 `client_code` |
 * | `lines` | 页面脊梁（`ref`） | `onClientChange` 判「有没有门类」并**清空**（`lines.value = []`） |
 * | `dialog` | 页面 `useDialog()` | 切换客户前的二次确认 |
 *
 * ⚠️ **`order` 是 `reactive`（没有 `.value`）** ⇒ 注入对象本身、体里写 `deps.order.x`
 *    （与 Home 的 `details` 同一口径）。
 * ⚠️ **`clients` 不注入** —— 它是**本块自己的** `ref`；页面侧那两处改动
 *    （`loadOrder` 里 `clients.value = await api.listClients()`、打印载荷读 `clients.value`）
 *    都是**通过回传的同一个 ref** 做的，所以 `api` 也不进本块的注入面。
 *
 * ## 🔴 裸 `let`（spec §6.2）：`lastAppliedClient` 只能靠 **getter + setter** 跨块访问
 *
 * 它**不是 ref**（对响应式完全隐身）⇒ **绝不能导出「值」**：那样导出的是**一次快照**，
 * 之后本块再改它，页面那边就同步不过去了（而且不报错）。
 * ⇒ 本文件导出 `getLastAppliedClient()` / `setLastAppliedClient(v)` 一对；
 *   页面侧现在有 **3 处写它**（`loadOrder` 套用客户、清空订单、导入订单）都改走 setter。
 *
 * ## 回传面 = **6 项 + getter/setter**
 *
 * | 名字 | 段外的活读者 |
 * |---|---|
 * | `clients` | `loadOrder` 里的「目录里有没有这个编号」判断（`:1171`）· 打印载荷 `clients: clients.value`（`:1863`）· **写**：`load()` 里 `clients.value = await api.listClients()`（`:1905`） |
 * | `clientOptions` | 模板 `:55` 的 `:options` |
 * | `applyClient` | `loadOrder` 里套用客户（`:1172`） |
 * | `onClientChange` | 模板 `:57` 的 `@update:value` |
 * | `currentClient` | `buildTerminalToken` 附近（`:1807`/`:1819`） |
 * | `setLastAppliedClient` | 上面那 3 处写 |
 * ⚠️ `getLastAppliedClient` **页面侧现在没有读者** ⇒ 页面**不解构**它（解构出来就是 TS6133）；
 *    它仍然导出，供后续块/将来使用。
 */
import { computed, ref, type Ref } from 'vue'
import type { DialogApi } from 'naive-ui'
import type { ClientDto } from '../../api/types'
import type { Line } from '../../utils/partsEngine'

/**
 * `useHuiClients()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。
 *
 * ⚠️ `order` 这里只声明本块**真正碰**的 4 个字段（结构类型）—— 页面那个 `reactive` 对象
 *    天然满足它，不必把整张订单类型引进来（引进来反而会让本块跟订单字段表耦合）。
 */
export interface HuiClientsDeps {
  /** 页面脊梁：订单草稿（`reactive`，**没有 `.value`**）。 */
  order: { client_code: string; client_name: string; phone: string; brand: string }
  /** 页面脊梁：订单行（`ref`）—— 切换客户时会被**整个清空**。 */
  lines: Ref<Line[]>
  /** 页面 `useDialog()`。 */
  dialog: DialogApi
}

/** 客户目录 + 套用客户资料 + 切换客户确认（含裸 `let` 的读写一对）。 */
export function useHuiClients(deps: HuiClientsDeps) {
  const clients = ref<ClientDto[]>([])
  const clientOptions = computed(() =>
    clients.value.map((c) => ({ label: `${c.name}（${c.code}）`, value: c.code })),
  )
  let lastAppliedClient = ''

  function applyClient(code: string | null) {
    const c = clients.value.find((x) => x.code === code)
    deps.order.client_name = c?.name ?? ''
    deps.order.phone = c?.phone ?? ''
    deps.order.brand = c?.brand ?? ''
    lastAppliedClient = c?.code ?? ''
  }

  function onClientChange(code: string | null) {
    // 仅当「已有归属客户（加载的订单或已选客户）」且切换到另一客户时，才二次确认是否清空订单行。
    // 新订单首次选择客户不弹窗（已有门类但无归属客户，直接套用客户资料）。
    if (
      deps.lines.value.length > 0 &&
      code &&
      lastAppliedClient &&
      code !== lastAppliedClient
    ) {
      deps.dialog.warning({
        title: '切换客户',
        content: '当前订单已有门类，切换客户将清空现有订单行。是否继续？',
        positiveText: '清空并切换',
        negativeText: '取消',
        onPositiveClick: () => {
          deps.lines.value = []
          applyClient(code)
        },
        onNegativeClick: () => {
          deps.order.client_code = lastAppliedClient || ''
        },
      })
      return
    }
    applyClient(code)
  }

  const currentClient = computed(() =>
    clients.value.find((c) => c.code === deps.order.client_code),
  )
  /**
   * 「最后套用的客户编号」的**读/写一对**（spec §6.2 的裸 `let`）。
   *
   * ⚠️ 它是**裸 `let`**（不是 ref）⇒ 对响应式完全隐身。**跨块访问只能走这两个函数**：
   *    导出「值」等于导出一张**一次快照**，之后本块再改它就同步不过去了。
   *    页面侧现在有 3 处写它（`loadOrder` 里套用客户、清空订单、导入订单），
   *    都必须走 `setLastAppliedClient(...)`。
   */
  function getLastAppliedClient(): string {
    return lastAppliedClient
  }
  function setLastAppliedClient(v: string): void {
    lastAppliedClient = v
  }

  return {
    // 6 项回传 —— 段外活读者见文件头那张表。
    clients,
    clientOptions,
    applyClient,
    onClientChange,
    currentClient,
    // 🔴 裸 `let` 的**读写一对**（spec §6.2）—— 页面只解构 setter（getter 现在没人用）。
    getLastAppliedClient,
    setLastAppliedClient,
    // `lastAppliedClient` 本身**不回传**：它就是那个裸 `let`，导出值 = 一次快照。
  }
}
