/**
 * 「行内编辑 / 改客户名 / 改生产日期」—— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）—— **三段，不是一个连续区间**：
 *   · `Home.vue:1018-1058` —— 分区头 + `editingId`/`draft` + `startEdit`/`saveEdit`/`cancelEdit`
 *   · `Home.vue:1060-1106` —— 分区头 + `renameShow`/`renameTarget`/`renameValue`/`openRename`/
 *                              `submitRename` + `dateShow`/`dateTarget`/`dateValue`/`openDate`
 *   · `Home.vue:1191-1203` —— `submitDate`
 *   （41 + 47 + 13 = 101 行）
 *
 * ⚠️ **`1018-1203` 之间夹着别人的东西，所以「按名字删段」是硬要求**：
 *    `1108`（`pad`）与 `1110-1119`（`localToday` 连 JSDoc）**已由 Task 4 搬去 `utils/homeDate.ts`**；
 *    `1121-1153` 是 **`confirmAudit`（B11 / Task 13）**，`1155-1189` 是 **`combineSelected`（B10 / Task 3）**
 *    —— 本块**三段的行段里一个都不含**，删的时候必须三段分开。
 *    方案 §3.1 的 B8 行原写 `1018–1058 + 1060–1108 + 1116–1119 + 1191–1203` —— 那是 Task 3/4 跑之前
 *    的快照：`1108` 与 `1110–1119` 归 Task 4（§3.1 还漏算了 `localToday` 的 JSDoc `1110–1115`）。
 *    （按用户 2026-09-20 的令「不必写的文档不要写」，**本轮不改 `docs/`** —— 更正记在这里。）
 *
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（B8 一条）。
 *
 * ⚠️ **注入 2 项**：`message`（页面 `useMessage()`，REF `484`）与 `load`（B1 `useHomeData` 回传）。
 *    `api` / `pad` 是**模块级依赖，直接 `import` 不注入**（与 `useHomeSelection.ts` 同一口径）——
 *    `pad` 来自 Task 4 建的 `utils/homeDate.ts`（注意是 `../../utils/`，不是 `../utils/`）。
 *
 * ⚠️⚠️ **`draft` 是 `reactive` 对象，不是 ref** —— `return` 的是**那个响应式对象本身**。
 *    写 `draft: draft.value` 或 `toRef(...)` 都会让 `renderEditable`（B12，现在还在页面里）对
 *    `draft[field] = v` 的写入**静默丢失**（不报错，只是输入框里的字打不进去）。
 *    与 B6 的 `details`、B10 的 `checkedRowKeys` 是同一类坑。
 *
 * ⚠️ **15 项全部回传**（实测每一项在段外都有活读者：模板 167/174/177/182/183/190/197/200/205/206 ·
 *    `columns` 2974/2976/2978/2979/3094/3118/3191/3193/3196/3200 · B12 的 `renderEditable`
 *    2811/2816/2823/2826/2827）—— 这样 `Home.vue` 侧解构之后 15 个名字仍留在同一作用域，
 *    **模板与 `columns` 一行都不用改**。
 *    ⚠️ 页面侧**必须解构**，不许写成 `rowEditing.renameValue`：`<script setup>` 的模板只对**顶层绑定**
 *    自动解包 ref，属性访问会让 167/182/190/205 的弹窗显隐不再响应，而 `renameValue`(177) /
 *    `dateValue`(200) 是 `v-model` **写入** ⇒ 会把 **ref 对象整个换成字符串**（**静默**坏）。
 */

import { reactive, ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { OrderHeadInput, OrderSummaryDto } from '../../api/types'
import { pad } from '../../utils/homeDate'

/** `useHomeRowEditing()` 的注入面。**只放页面拥有的东西**（见文件头）。 */
export interface HomeRowEditingDeps {
  /** 三处写库成功后的提示 + 失败提示。 */
  message: MessageApi
  /** 改完要重拉列表（B1 `useHomeData` 回传的 `load`）。 */
  load: () => Promise<void>
}

/**
 * 行内编辑 + 「改客户名 / 改日期」两条就地改头。
 *
 * ⚠️ **构造顺序**：`load` 是 B1 回传的 ⇒ 必须在 `useHomeData(...)` **之后**调用；
 *    而 B12（`useHomeCellRender`）要读本块借出的 `editingId`/`draft`/`startEdit` ⇒ 必须在其**之前**。
 *    传早了拿到的是 `undefined`，且**不一定报错**。
 */
export function useHomeRowEditing(deps: HomeRowEditingDeps) {
  // ---------------------------------------------------------------------------
  // 内联编辑（§4.5：定金/安装地址/订单备注/业务员/打单人）
  // ---------------------------------------------------------------------------
  const editingId = ref<number | null>(null)
  const draft = reactive<OrderHeadInput>({})

  function startEdit(row: OrderSummaryDto) {
    editingId.value = row.id
    draft.client_code = row.client_code
    draft.client_name = row.client_name
    draft.phone = row.phone
    draft.brand = row.brand
    draft.order_date = row.order_date
    draft.production_days = row.production_days
    draft.deposit = row.deposit
    draft.remark = row.remark
    draft.salesperson = row.salesperson
    // `order_no_set` 不再抄进草稿 —— 它是服务端派生值（= 各行 line_no 去重后 `_` 连接），
    // 发回去也不会被采纳。见 `docs/2026-09-18-order-no-semantics.md` §6.B。
    draft.install_address = row.install_address
    draft.production_status = row.production_status
    draft.creator_name = row.creator_name
    draft.lock_direction = row.lock_direction
  }

  async function saveEdit() {
    if (editingId.value == null) return
    const id = editingId.value
    try {
      await api.updateOrderHead(id, { ...draft })
      deps.message.success('修改成功')
      editingId.value = null
      await deps.load()
    } catch (e) {
      deps.message.error((e as Error).message || '保存失败')
    }
  }

  function cancelEdit() {
    editingId.value = null
  }

  // ---------------------------------------------------------------------------
  // 改客户名 / 改日期（§4.4/§4.6，Phase 1 走 updateOrderHead 就地改）
  // ---------------------------------------------------------------------------
  const renameShow = ref(false)
  const renameTarget = ref<OrderSummaryDto | null>(null)
  const renameValue = ref('')

  function openRename(row: OrderSummaryDto) {
    renameTarget.value = row
    renameValue.value = row.client_name
    renameShow.value = true
  }

  async function submitRename() {
    if (!renameTarget.value) return
    try {
      await api.updateOrderHead(renameTarget.value.id, { client_name: renameValue.value })
      deps.message.success('修改成功')
      renameShow.value = false
      await deps.load()
    } catch (e) {
      deps.message.error((e as Error).message || '修改失败')
    }
  }

  const dateShow = ref(false)
  const dateTarget = ref<OrderSummaryDto | null>(null)
  const dateValue = ref<number | null>(null)

  function openDate(row: OrderSummaryDto) {
    // 旧版 `:11412-11419`：**只有「单号集」为空才让改生产日期**，
    // 否则 `ElMessage.warning("已生产的单不能修改生产日期")` 并**不开弹窗**。
    // 判据逐字：`"" === (单号集 ?? "").toString().trim()` 才放行。
    //
    // ⚠️ **这条注释 2026-09-19 更正过**：原写「打单操作」，与源码不符 ——
    //    旧版取的是 `dr(1362)`，`node legacy/decode-token.mjs dr 1362` = **「单号集」**。
    // ⚠️ **而下面的代码判的是 `production_status`（打单操作），两者不等价**：
    //    点过「审核确认」（打单操作非空）但**还没「填入单号」**的单，旧版**放行**改日期、我们**拦住**
    //    （反向亦然）。已记为待拍板的行为偏离（`docs/home-audit/00-summary.md` §五.1），**别照这行改代码**。
    if ((row.production_status ?? '').toString().trim() !== '') {
      deps.message.warning('已生产的单不能修改生产日期')
      return
    }
    dateTarget.value = row
    dateValue.value = row.order_date ? Date.parse(row.order_date) : null
    dateShow.value = true
  }

  async function submitDate() {
    if (!dateTarget.value || dateValue.value == null) return
    const d = new Date(dateValue.value)
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    try {
      await api.updateOrderHead(dateTarget.value.id, { order_date: iso })
      deps.message.success('日期修改成功')
      dateShow.value = false
      await deps.load()
    } catch (e) {
      deps.message.error((e as Error).message || '修改失败')
    }
  }

  return {
    editingId, draft, startEdit, saveEdit, cancelEdit,
    renameShow, renameTarget, renameValue, openRename, submitRename,
    dateShow, dateTarget, dateValue, openDate, submitDate,
  }
}
