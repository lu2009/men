/**
 * 「终端链接」（token 生成 + 复制）—— 2026-09-20 从 `Hui.vue` 搬出（逻辑逐字未改，C7）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）是**一段**：`Hui.vue:2084-2129`，段内 **5 个声明**：
 * `tenantName` / `currentUserName` / `buildTerminalToken` / `terminalLink` / `copyTerminalLink`。
 * ⚠️ 那一段里还夹着 `currentClient`（`2091-2093`）—— 它是 **C5** 的，C5 已经先搬走了
 *    （见 `composables/hui/useHuiClients.ts`）；本块只是**注入**它，**没有**再搬一遍。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C7 一条）。
 *
 * ## 注入面 = **3 项**
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `currentClient` | **C5**（`useHuiClients` 回传的 computed） | `terminalLink` / `copyTerminalLink` 先判有没有客户 |
 * | `order` | 页面脊梁（`reactive`） | 拼 URL：`order.client_name` / `order.receipt_no` |
 * | `message` | 页面 `useMessage()` | 「请先选择客户」/ 复制成败 |
 *
 * `TENANT_DS` 是模块级常量（`utils/printPayloads` 导出）⇒ 新家直接 `import`，**不注入**。
 *
 * ## 回传面 = **4 项**（`buildTerminalToken` **不回传**）
 *
 * | 名字 | 段外的活读者 |
 * |---|---|
 * | ⚠️ `tenantName` | 打印载荷 `tenantName: tenantName.value`（`:1799`）· **`onMounted` 里写它**（`:1835`，`me.tenant.name`） |
 * | ⚠️ `currentUserName` | 打印载荷 `maker: currentUserName.value`（`:1800`）· **`onMounted` 里写它**（`:1834`，`me.user.name`） |
 * | `terminalLink` | 打印载荷 `terminalLink: terminalLink.value`（`:1802`） |
 * | `copyTerminalLink` | `onMoreSelect` 的 `case 'terminal'`（`:1036`） |
 *
 * 🔴 **`tenantName` / `currentUserName` 必须回传**（spec §3.3 点名的雷）：它们不是只读的 ——
 *    `onMounted` 拿到 `/me` 之后**回写**这两个 ref。少回传一个 ⇒ 打印出来的**租户名/打单人是空的**，
 *    而且**不报错**。
 * ⚠️ `buildTerminalToken` **不回传**：段外零命中（只被本块的 `terminalLink` 调）⇒ 解构即 TS6133。
 *
 * ⚠️ **token 算法是「兼容旧版」的，别改动**：`a = TENANT_DS === 'smartdoor' ? 1000 :
 *    Number(TENANT_DS.split('smartdoor')[1]) + 1000`，`x = 7 × 客户编号 + 1987`，`t = Date.now() + 888`，
 *    拼成 `${a}af${x}wy${t}` —— 注意 **`a` 与租户 id 无关**（原版没用 `tenant.id`）。
 *    终端页（只读订单视图）尚未接入；当前只生成并复制链接。
 */
import { computed, ref, type ComputedRef } from 'vue'
import type { MessageApi } from 'naive-ui'
import type { ClientDto } from '../../api/types'
import { TENANT_DS } from '../../utils/printPayloads'

/** `useTerminalLink()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface TerminalLinkDeps {
  /** **C5** 的 `currentClient`（`useHuiClients` 回传）—— 本块只读它。 */
  currentClient: ComputedRef<ClientDto | undefined>
  /** 页面脊梁：订单草稿（`reactive`）—— 拼 URL 时读 `client_name` / `receipt_no`。 */
  order: { client_name: string; receipt_no: string }
  /** 页面 `useMessage()`。 */
  message: MessageApi
}

/** 终端链接：按旧版算法生成 token、拼 URL、复制到剪贴板。 */
export function useTerminalLink(deps: TerminalLinkDeps) {
  // 兼容旧版算法：a = tenant_id + 1000, x = 7 × 客户编号 + 1987, t = 时间戳 + 888。
  // 终端页（只读订单视图）后续接入后消费 param2 token；当前仅生成并复制链接。
  const tenantName = ref('')
  // 当前登录用户（原版 maker = userinfo.name，打单人）
  const currentUserName = ref('')


  // 原版（@448151 邻近）token = `{a}af{x}wy{now+888}`：
  //   `ds === 'smartdoor'` → a = 1000；否则 a = Number(ds.split('smartdoor')[1]) + 1000
  //   x = 7 × 客户编号 + 1987
  // 注意 a **与租户 id 无关**（原版没有用 tenant.id）。
  function buildTerminalToken(clientId: number): string {
    const a = TENANT_DS === 'smartdoor' ? 1000 : Number(TENANT_DS.split('smartdoor')[1]) + 1000
    const x = 7 * clientId + 1987
    const t = Date.now() + 888
    return `${a}af${x}wy${t}`
  }

  const terminalLink = computed(() => {
    const c = deps.currentClient.value
    if (!c) return ''
    const token = buildTerminalToken(c.id)
    const p = new URLSearchParams({
      param1: deps.order.client_name || c.name,
      param2: token,
      receiptNo: deps.order.receipt_no,
    })
    return `${window.location.origin}/terminal?${p.toString()}`
  })

  async function copyTerminalLink() {
    if (!deps.currentClient.value) {
      deps.message.warning('请先选择客户')
      return
    }
    try {
      await navigator.clipboard.writeText(terminalLink.value)
      deps.message.success('终端链接已复制')
    } catch {
      deps.message.error('复制失败，请手动复制')
    }
  }
  return {
    // 4 项回传 —— 两个 ref 是**会被 `onMounted` 回写**的（漏一个 ⇒ 打印出的租户名/打单人为空，且不报错）。
    tenantName,
    currentUserName,
    terminalLink,
    copyTerminalLink,
    // 不回传 `buildTerminalToken`：段外零命中（只被本块的 `terminalLink` 调）⇒ 解构即 TS6133。
  }
}
