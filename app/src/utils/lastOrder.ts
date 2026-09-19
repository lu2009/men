// 「上次订单」—— 唯一真源。**只在保存成功那一刻写、只在点「导入上次订单」时读**。
//
// 旧版（`legacy/js/Hui.formatted.js`）里这个键一共只出现**两次**，先把它记全：
//   · **写** `H:8853`，在 `_0xafd9e0`（工具栏「3.保存回执单」）**保存成功之后**：
//       `localStorage.setItem('smartdoor_last_order',
//          JSON.stringify({ ...整单载荷, showPingkai, showDiao, savedAt: Date.now() }))`
//     —— 注意是**整单载荷**（`_0x5b10d7.value`，含 `customerInfo` 与两张表的行），不是表单快照。
//   · **读** `H:8903`，只有一处：抽屉里的「导入上次订单」`importLastOrder`（`H:8899-8925`）。
//   **`onMounted`（`H:8261-8264`）里没有它** —— 旧版**页面加载时不恢复任何订单数据**。
//
// ⚠️ 2026-09-19 **改（用户报的 bug）**：我们先前做的是另一套东西 ——
//    一个「编辑中就落盘」的实时草稿（键 `hui_order_draft_v1`，`watch` 去抖 400ms 写），
//    并在 `onMounted` 里**无条件恢复**，还弹一句「已恢复上次未保存的订单」。两个后果：
//      ① **每次刷新页面都被上一次的订单数据糊上**；旧版没有这个行为。
//      ② 「上次订单」的语义被换掉了：旧版是**上次保存的**订单，我们成了**上次编辑过**的东西 ——
//         连「导入上次订单」导进来的都是没保存的半成品（`resetOrder` 里那次空草稿写入更离谱：
//         等于「清空订单 = 连上次订单一起清掉」）。
//    ⇒ 实时草稿整套删掉，键名也换回旧版的 `smartdoor_last_order`
//      （与 `smartdoor_sort_method` / `smartdoor_disable_auto_markup` 同一取名习惯；
//       旧版 `legacy/DESIGN-DOC.md` §8.4 有登记，且它在 `local-request-interceptor.js` 的
//       租户级键白名单里 —— 换身份时要清）。
//
// 为什么单独一个文件：这个函数的**文案与分支**要和旧版逐字对齐，而 `Hui.vue` 里的函数
// 差分台跑不到（SFC 里的 setup 函数没法 import）。所以把「读 → 判空 → 弹确认 → 应用」
// 这段做成**注入 IO 的纯函数**，差分台拿它和旧版切片对着跑。
// 台子：`docs/home-audit/last-order-logiccheck.mjs`。

/** `localStorage` 键名 —— 与旧版**逐字相同**（`H:8853` / `H:8903`）。 */
export const LAST_ORDER_KEY = 'smartdoor_last_order'

/** 三条提示的原文（旧版 token：`1170` / `759` / `902`）—— 一个字都不能改。 */
export const LAST_ORDER_EMPTY_MSG = '没有找到上次保存的订单数据'
export const LAST_ORDER_OK_MSG = '上次订单数据已导入'
export const LAST_ORDER_ERROR_MSG = '导入订单数据失败'

/** 确认框的标题与两个按钮（旧版 token：`854` / `500`，取消是字面量「取消」）。 */
export const LAST_ORDER_CONFIRM_TITLE = '导入上次订单'
export const LAST_ORDER_CONFIRM_OK = '确认导入'
export const LAST_ORDER_CONFIRM_CANCEL = '取消'

/**
 * 旧版：`c.savedAt ? new Date(c.savedAt).toLocaleString() : '未知时间'`。
 *
 * ⚠️ 用 `toLocaleString()` 而**不是**我们自己的 `formatDateTime` —— 旧版就是本机时区的
 * 本地化字符串，换个 locale 长得不一样也对。
 */
export function lastOrderSavedAtText(savedAt: unknown): string {
  return savedAt ? new Date(savedAt as number).toLocaleString() : '未知时间'
}

/** 旧版那段模板串，逐字。 */
export function lastOrderConfirmText(savedAt: unknown): string {
  return `将导入 ${lastOrderSavedAtText(savedAt)} 保存的订单数据，当前数据将被覆盖，是否继续？`
}

/** 存进 `localStorage` 的东西。字段名是我们自己的（旧版存的是整单载荷，形状不同 —— 见文件头）。 */
export type LastOrderSnapshot = {
  header: Record<string, unknown>
  lines: unknown[]
  /** 旧版 `showPingkai` —— 导入后**两表的显隐跟着导入的数据走**，不是保持当前。 */
  showPing: boolean
  /** 旧版 `showDiao` */
  showDiao: boolean
  savedAt: number
}

/** 差分台/页面共用的最小 IO 面 —— 把 naive 的 `message` / `dialog` 与 `localStorage` 注进来。 */
export type LastOrderIO = {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  warning: (msg: string) => void
  success: (msg: string) => void
  error: (msg: string) => void
  confirm: (opts: {
    title: string
    content: string
    positiveText: string
    negativeText: string
    onPositiveClick: () => void
  }) => void
}

/** 保存成功后写一次 —— 旧版 `H:8853`，就在「3.保存回执单」里。 */
export function writeLastOrder(
  io: Pick<LastOrderIO, 'storage'>,
  snap: LastOrderSnapshot,
): void {
  try {
    io.storage.setItem(LAST_ORDER_KEY, JSON.stringify(snap))
  } catch {
    // 忽略（隐私模式 / 配额超限）—— 旧版这里也是空 catch
  }
}

/**
 * 「导入上次订单」—— 逐字照旧版 `H:8899-8925`。
 *
 * 旧版原文的分支：
 *   ```js
 *   const o = localStorage.getItem('smartdoor_last_order')
 *   if (!o) return void ElMessage.warning('没有找到上次保存的订单数据')   // ← warning，不是 info
 *   const c = JSON.parse(o)
 *   const n = c.savedAt ? new Date(c.savedAt).toLocaleString() : '未知时间'
 *   await ElMessageBox.confirm(`将导入 ${n} 保存的订单数据，当前数据将被覆盖，是否继续？`,
 *     '导入上次订单', { confirmButtonText:'确认导入', cancelButtonText:'取消', type:'warning' })
 *   …应用…
 *   ElMessage.success('上次订单数据已导入')
 *   // catch：`o === 'cancel'` 静默返回，其它 → ElMessage.error('导入订单数据失败')
 *   ```
 *
 * ⚠️ 旧版那个 `catch` 判的是 `ElMessageBox` 的**拒绝值** `'cancel'`。naive 的 `dialog`
 *    不走 Promise 拒绝 —— **取消就是不调 `onPositiveClick`**，语义等价（取消什么都不做），
 *    所以这里没有、也不需要那段 catch。
 * ⚠️ 旧版的 `JSON.parse` 包在 try 里，**解析失败走的是 `ElMessage.error('导入订单数据失败')`**。
 *    我们保持一样（不是「没有找到…」那条）。
 */
export function importLastOrder(
  io: LastOrderIO,
  apply: (snap: LastOrderSnapshot) => void,
): void {
  const raw = io.storage.getItem(LAST_ORDER_KEY)
  if (!raw) {
    io.warning(LAST_ORDER_EMPTY_MSG)
    return
  }
  let snap: LastOrderSnapshot
  try {
    snap = JSON.parse(raw) as LastOrderSnapshot
  } catch {
    io.error(LAST_ORDER_ERROR_MSG)
    return
  }
  io.confirm({
    title: LAST_ORDER_CONFIRM_TITLE,
    content: lastOrderConfirmText(snap?.savedAt),
    positiveText: LAST_ORDER_CONFIRM_OK,
    negativeText: LAST_ORDER_CONFIRM_CANCEL,
    onPositiveClick: () => {
      try {
        apply(snap)
        io.success(LAST_ORDER_OK_MSG)
      } catch {
        io.error(LAST_ORDER_ERROR_MSG)
      }
    },
  })
}
