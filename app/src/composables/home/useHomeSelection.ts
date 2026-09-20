/**
 * 「删除选中 / 清账 / 合并订单」—— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）：
 *   · `Home.vue:1155-1189` —— `combineSelected`（含其 JSDoc）
 *   · `Home.vue:1550-1886` —— `checkedRowKeys` / `selectAllMode` / `onCheckedKeys`
 *                              / `deleteSelected` / `clearAccounts`（含 banner 与各 JSDoc）
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（B10 一条）。
 *
 * ⚠️ `checkedRowKeys` 是本块**拥有并借出**的状态：模板有 6 处直接读写它
 *    （`Home.vue` 模板 `:22` `:25` `:40` `:45` `:113` `:118`），
 *    页面里还有 `openPrint()` 一处**只读**引用。
 *    所以下面 `return` 的是**那个 ref 本身**，不是 `.value` 的副本 —— 返回副本会让模板的勾选静默失效。
 *
 * 注入的都是**页面拥有的东西**（响应式状态 / 组件上下文 API）；模块级依赖
 * （`api` / `fmt` / `unpaidOf` / naive-ui 类型）本文件直接 `import`，不走注入 ——
 * 与 `useOrderPrint.ts` 同一口径。
 */
import { ref, type ComputedRef, type Ref } from 'vue'
import type { DataTableRowData, DataTableRowKey, DialogApi, MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { OrderFinance, OrderSummaryDto } from '../../api/types'
import { fmt, unpaidOf } from '../../utils/homeMetrics'

/** `useHomeSelection()` 的注入面。**只放页面拥有的东西**（见文件头末段）。 */
export interface HomeSelectionDeps {
  /** 主表当前显示的行（`onCheckedKeys` 的「表头全选」要拿它全选）。 */
  filtered: ComputedRef<OrderSummaryDto[]>
  /** 全量列表（`deleteSelected` 查回执单号、`clearAccounts` 取行都用它）。 */
  rawOrders: Ref<OrderSummaryDto[]>
  /** 财务摘要（`clearAccounts` 算未收要用）。 */
  financeSummary: Ref<Record<string, OrderFinance>>
  /** 删完/清完/合并完要重拉列表。 */
  load: () => Promise<void>
  message: MessageApi
  dialog: DialogApi
}

/**
 * 选中集 + 三个批量动作（删除选中 / 清账 / 合并订单）。
 *
 * ⚠️ **构造顺序**：必须在 `filtered` / `rawOrders` / `financeSummary` / `load` **之后**调用 ——
 *    这几个都是 setup 顶层即时求值，传早了拿到的是 `undefined`，且**不一定报错**。
 */
export function useHomeSelection(deps: HomeSelectionDeps) {
  /**
   * 「合并订单」（旧版 `Ii`，`Home.formatted.js:9190-9219`）。
   *
   * 旧版前端自己算存活单（按 `parseInt(回执单号)` 升序取最小）再 POST `{merged, record}`；
   * **新版只把 id 列表交给服务端**，存活单由服务端算 —— 见 `api.combineOrders` 的说明。
   * 所以这里的确认文案「以最早的回执单号为准」是**服务端真的会执行**的规则，不再是前端口头承诺。
   *
   * 文案逐字对齐旧版：确认框标题 `dr(1005)`=「合并订单确认」，
   * 正文 `"确定要合并选中的 N 条订单吗？" + dr(1224)`（=「…合并后将以最早的回执单号为准，合并后不可恢复。」）；
   * 选不满 2 条时 `dr(639)`=「请选择至少两条数据进行合并」（按钮本身只在 ≥2 条时出现，
   * 但键盘/程序化触发仍可能到这儿，保留守卫）。
   */
  function combineSelected() {
    const ids = checkedRowKeys.value.map(Number)
    if (ids.length < 2) {
      deps.message.warning('请选择至少两条数据进行合并')
      return
    }
    deps.dialog.warning({
      title: '合并订单确认',
      content: `确定要合并选中的 ${ids.length} 条订单吗？合并后将以最早的回执单号为准，合并后不可恢复。`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          await api.combineOrders(ids)
          checkedRowKeys.value = []
          await deps.load()
          deps.message.success('合并成功')
        } catch (e) {
          deps.message.error((e as Error).message || '订单合并操作失败')
        }
      },
    })
  }

  // ---------------------------------------------------------------------------
  // 删除选中（§4.3：先查财务记录，红冲，再删除）
  //
  // ⚠️ **红冲必须排在删除之前**（与旧版「先删后冲」的顺序相反，见下）：
  //    `addOrderPayment`（本单收款那条腿）内部要 `order_finance(order_id)` 取「本单已分配金额」
  //    做校验，订单删掉之后那个查询会 `not_found`。
  //    顺带也更安全：红冲失败时订单还在，可以重试；反过来则会留下「删了但没冲」的孤儿。
  // ---------------------------------------------------------------------------
  const checkedRowKeys = ref<DataTableRowKey[]>([])

  /**
   * 跨页全选（旧版 `Oo` `:7743-7759`，挂在 el-table 的 `onSelectAll` 上 —— 见 `:11300`
   * `onSelectAll:Oo`）。
   *
   * ⚠️ 先纠正一处审计误判：**旧版没有「工具栏全选 checkbox」**。`Oo` 是 el-table
   * **表头全选格**的事件处理函数；审计里当作「工具栏 checkbox 状态」的 `Ol`（`:7611`）
   * 全仓库只被**写**过、从没在 render 里被**读**过 —— 是死变量。
   *
   * 旧版语义（逐句）：
   *   ```js
   *   Oo = () => {
   *     Wl.value ? (Wl.value = false) : (Wl.value = true)      // 翻转「全选模式」开关
   *     if (Wl.value)  { Vn.clearSelection(); ps.forEach(r => Vn.toggleRowSelection(r, true)) }
   *     else           { Vn.clearSelection() }
   *     …再级联到展开行里的两张子表（新版无子表，随 A3 一起缺）
   *   }
   *   ```
   *   ElTable 的 `toggleRowSelection` 是**按行对象**进出 `selection` 数组的，不要求该行
   *   在当前页的 `data` 里 ⇒ 它一次就把**整个筛选结果 `ps`**（跨页）塞进选中集，
   *   这也是 `Fl`（选中行）/ 删除 `Si` 读到的集合。两个后果：
   *     ① 表头全选 = 选中**当前筛选结果的全部行**（不止当前页）；
   *     ② 之后翻页/改页大小，`xs`(`:11185-11193`) / `Bs`(`:11198-11206`) 会在 `nextTick` 里
   *        `clearSelection()` 后重新全选 `ps` —— 因为 el-table 换页会丢选择，得重刷。
   *   新版 `:checked-row-keys` 是**受控**的，且 Naive 的 TreeMate 对「不在当前 data 里的 key」
   *   只增不删（`treemate/es/check.js:166` `getExtendedCheckedKeySet` 以 `new Set(checkedKeys)`
   *   起步，扁平表 `treeNodeMap.get(key)` 取不到就跳过），所以 ② 那步重刷**不需要**了：
   *   key 一直在受控数组里，翻页后新页的勾选框自然勾上。
   *
   * 因此这里只保留 ① 的语义，`selectAllMode` 就是旧版那个 `Wl`（纯开关记忆，不参与渲染）：
   *   · 表头全选（`action === 'checkAll'`）/ 表头取消全选（`'uncheckAll'`）→ 翻转开关，
   *     开 → 选中**全部筛选结果**；关 → **清空全部**。
   *     （旧版是按 `Wl` 翻转决定清空/全选，而不是看表头 checkbox 当前状态 —— 例如「手动勾满
   *      当前页」时表头已显示为勾选，旧版点它仍是『置 Wl=true 并全选』，这里照抄。）
   *   · 单行勾选（`'check'` / `'uncheck'`）→ 用 Naive 回抛的 keys 原样写回。
   *
   * Naive 把动作类型放在 `update:checked-row-keys` 的**第三个参数**里
   * （`data-table/src/use-check.mjs:82-88` 的 `{ row, action }`），所以能精确区分，
   * 不需要「回抛的 keys 恰好等于本页 keys 就当成全选」这种会误伤手点的启发式。
   */
  const selectAllMode = ref(false)

  function onCheckedKeys(
    keys: DataTableRowKey[],
    // Naive 的 `OnUpdateCheckedRowKeys` 第二参是 `InternalRowData[]`（未从包根导出），
    // 这里用它导出的等价别名 `DataTableRowData`（`Record<string, any>`）。本函数用不到这个参数。
    _rows: DataTableRowData[],
    meta?: { row?: unknown; action?: 'check' | 'uncheck' | 'checkAll' | 'uncheckAll' },
  ) {
    if (meta?.action === 'checkAll' || meta?.action === 'uncheckAll') {
      selectAllMode.value = !selectAllMode.value
      checkedRowKeys.value = selectAllMode.value ? deps.filtered.value.map((r) => r.id) : []
      return
    }
    checkedRowKeys.value = keys
  }

  /**
   * 删除选中（旧版 `Si` `:9224-9305`）。
   *
   * ⚠️⚠️ **旧版在删除前有一步「管理员密码二次校验」，新版【刻意未实现】—— 这里只留结论与出处，
   * 别照着补一个本地口令。** 回源码查证如下（`usePasswordVerify-b6115859.js`，即审计里的 `y(...)`）：
   *
   * ```js
   * // 旧版 `Si` 里（`:9229`，在「已选为空」判断之后、`自助下单||工厂` 守卫之前）：
   * if (!(await y("删除"))) return
   *
   * // `y` = `usePasswordVerify()` 的 `verifyPassword`（`Home.formatted.js:7568-7572`
   * //   `const { verifyPassword: y } = St()`，`St` 即该模块的 `u` 导出）。它的实现是：
   * verifyPassword: async (action = "操作", skipGate = false) => {
   *   const m = await getUserData()                       // index chunk 的 `g`
   *   if (!m) return ElMessage.error("无法获取用户数据"), false
   *   const registrant = m.userinfo.registrant
   *   // 只有写死的这 3 个租户才需要口令，其它租户直接放行：
   *   if (!skipGate && !["恒泰智门33", "恒祥门业", "临泉县品匠移门"].includes(registrant)) return true
   *   const { value: pwd } = await ElMessageBox.prompt(
   *     "请输入管理员密码以确认" + action + "操作", "身份验证",
   *     { confirmButtonText: "确认", cancelButtonText: "取消", inputType: "password",
   *       inputPlaceholder: "请输入密码",
   *       inputValidator: v => !(!v || v.trim().length === 0) || "密码不能为空" })
   *   // ↓ 关键：**服务端**校验，目标是【旧版生产域名】
   *   const r = (await axios.get("https://www.samrtdoor.com.cn/1", {
   *     params: { param1: "login", param2: registrant, param3: pwd } })).data[0]
   *   return !(!r || r.statu !== 1) || (ElMessage.error("密码错误，无权" + action), false)
   * }
   * // 取消：ElMessage.info("已取消" + action)；其它异常：ElMessage.error("验证请求失败，请重试")
   * // 返回 false ⇒ `Si` 那句 `if (!(await y(...))) return` 直接静默返回，不走后面的确认框。
   * ```
   *
   * 结论（逐条都有出处，非推测）：
   *   ① **不是本地口令**，是服务端校验：`GET https://www.samrtdoor.com.cn/1`，
   *      `param1=login`、`param2=<userinfo.registrant>`、`param3=<明文密码>`，
   *      成功判据是响应 `data[0].statu === 1`（旧版把 `status` 拼成了 `statu`）。
   *   ② 它**不是全租户生效**：写死 3 个租户名才弹窗，其余租户 `y` 直接 `return true`。
   *   ③ 弹窗文案 `"请输入管理员密码以确认" + action + "操作"`（action="删除"），
   *      标题 `"身份验证"`，按钮 `确认`/`取消`，密码框带一个「小眼睛」显隐切换
   *      （`usePasswordVerify` 里那段 DOM 注入，`:c()`）。
   *
   * **新版后端没有对应接口**（`backend/src/modules/auth/mod.rs` 只有
   * `/auth/login` `/auth/logout` `/auth/me` `/auth/change-password`，没有「拿租户名+口令换一次
   * 动作授权」这种），前端也没有任何一处调过这个旧域名（全仓库只有
   * `ReceiptEditDialog.vue:682` 的注释提到过它，那处同样是「刻意不发」）。
   * 因此**按本仓库既有口径不发这条跨系统请求**（同 `ReceiptEditDialog.vue:695-701` 的理由①：
   * 目标是旧版生产域名，从新版发出去是跨系统的对外写）。
   *
   * TODO(未确认): 待产品拍板后再补。三条候选路径，任选其一：
   *   (a) 新版后端加一个 `POST /api/v1/auth/verify-action`（校验当前用户口令，返回是否放行），
   *       前端只做弹窗 + 调它 —— 需先定「哪些租户/哪些动作要校验」是否还沿用那 3 个写死租户名；
   *   (b) 沿用旧域名转发 —— 需要先确认旧域名在可预见的将来仍可用、且允许新版跨域调用；
   *   (c) 明确不做（旧版这 3 个租户之外本来就不校验，去掉它不影响绝大多数租户）。
   * 在拍板之前，这里**保持无二次校验**，以免落一个「看起来在验、其实验不了」的假闸门。
   */
  function deleteSelected() {
    const ids = checkedRowKeys.value.map(Number)
    if (ids.length === 0) {
      deps.message.warning('请选择要删除的数据')
      return
    }

    // 先查财务记录，有红冲需求时提示（§A3：只对 >0 的合计取负）。
    api
      .checkOrderPayment(ids)
      .then((items) => {
        interface Group {
          code: string
          name: string
          allocated: number
          adjustment: number
          /** 该客户下**逐单**的红冲清单 —— 收款红冲必须逐单做，见下方 `onPositiveClick`。 */
          orders: { id: number; receipt: string; orderPaid: number; allocation: number }[]
        }
        const byCustomer = new Map<string, Group>()
        let totalAlloc = 0
        let totalAdj = 0
        for (const it of items) {
          const g =
            byCustomer.get(it.customer_code) ?? {
              code: it.customer_code,
              name: it.customer_name,
              allocated: 0,
              adjustment: 0,
              orders: [],
            }
          const receipt = deps.rawOrders.value.find((o) => o.id === it.order_id)?.receipt_no ?? String(it.order_id)
          g.orders.push({
            id: it.order_id,
            receipt,
            orderPaid: it.order_paid_amount,
            allocation: it.allocation_amount,
          })
          if (it.allocated_amount > 0) {
            g.allocated += it.allocated_amount
            totalAlloc += it.allocated_amount
          }
          if (it.adjustment_amount > 0) {
            g.adjustment += it.adjustment_amount
            totalAdj += it.adjustment_amount
          }
          byCustomer.set(it.customer_code, g)
        }
        const groups = [...byCustomer.values()].filter((g) => g.allocated > 0 || g.adjustment > 0)

        let content = `确定删除选中的 ${ids.length} 条订单吗？删除后不可恢复。`
        if (totalAlloc > 0 || totalAdj > 0) {
          const lines = ['选中的订单有以下财务记录：']
          if (totalAlloc > 0) lines.push(`• 已分配收款 ¥${fmt(totalAlloc)}`)
          if (totalAdj > 0) lines.push(`• 订单抹零 ¥${fmt(totalAdj)}`)
          lines.push('删除订单时将自动进行红冲。')
          content = lines.join('\n')
        }

        deps.dialog.warning({
          title: '删除确认',
          content,
          positiveText: '删除',
          negativeText: '取消',
          onPositiveClick: async () => {
            try {
              // ① 先红冲（顺序理由见本函数上方的说明）。
              //
              //  ⚠️ **收款红冲按「来源」拆成两条腿**，这是本文件与旧版唯一实质不同的一处：
              //     旧版把整笔「已分配收款」写成**一条客户级负收款**（`order_id = NULL`）。
              //     在我们的账务模型里那会**同一笔钱扣两次** ——
              //       净收款 = Σ finance_payments（按客户，含负数）              ← 负收款减的是它
              //       `已分配总额` = Σ finance_payments(order_id NOT NULL) + Σ finance_allocations
              //                                                  ↑ 只认带 order_id 的，减不到
              //     被删订单对 `已分配总额` 的贡献仍在（两处都按 order_id 聚合，订单删了行还留着）
              //     ⇒ 未分配余额多降 2×金额。实测（事务内 ROLLBACK）：
              //       池分配 300 的订单删掉后 700 → 400，正确应为 1000。
              //     所以：本单直接收款 → 带 `order_id` 的负收款（走 addOrderPayment，它的负数分支
              //     和「红冲金额绝对值不能超过本单已分配金额」那条校验就是为这个留的）；
              //           资金池分配   → 负的分配行（`reverseOrderAllocation`）。
              //     两条腿各自让「净收款」与「已分配总额」同额下降、或只降后者，未分配余额才算得对。
              //     ⚠️ 别拿接口上的 `实收金额` 来推这套账：它是**累计充值**，不是净收款 ——
              //     只算客户级（`order_id IS NULL`），且**逐笔减掉这一笔自己的分配**、逐笔夹零后求和，
              //     红冲不减（2026-09-20 对齐旧版 totalTopup 的完整口径）。
              //     与「未分配余额」用的净收款不是同一个数，见 finance/service.rs 的 `customer_balance`。
              const payDate = new Date().toISOString().slice(0, 10)
              for (const g of groups) {
                for (const o of g.orders) {
                  if (o.orderPaid > 0) {
                    await api.addOrderPayment(o.id, {
                      customer_code: g.code,
                      customer_name: g.name,
                      receipt_no: o.receipt,
                      amount: -o.orderPaid,
                      pay_date: payDate,
                      method: '其他',
                      remark: '删除订单红冲收款 ' + o.receipt,
                      use_prepay_discount: false,
                      discount_rate: 0,
                    })
                  }
                  if (o.allocation > 0) await api.reverseOrderAllocation(o.id)
                }
                // 抹零红冲**保持旧版原样**（客户级负调整），照抄旧版 C7。理由 2026-09-18 变了，
                // 结论没变：现在 `customer_balance` = max(0, Σ 逐单未收 − 客户调整合计)（对齐旧版
                // svc:763），**不再含订单调整那一项**。订单删掉后它就不再贡献「欠款」，而这条
                // 客户级负调整仍在 ⇒ 两边相抵后的数与旧版同式（旧版删单时 finance_orders 行
                // 一并消失，同样只剩客户调整）⇒ 冲在客户级才与旧版对得上，别改成订单级。
                if (g.adjustment > 0) {
                  await api.addCustomerAdjustment(g.code, {
                    customer_code: g.code,
                    customer_name: g.name,
                    amount: -g.adjustment,
                    type: '删除订单冲销',
                    remark: '删除订单红冲抹零 ' + g.orders.map((o) => o.receipt).join(','),
                  })
                }
              }
              // ② 再删除。
              for (const id of ids) await api.deleteOrder(id)
              deps.message.success('删除成功')
              checkedRowKeys.value = []
              await deps.load()
            } catch (e) {
              deps.message.error((e as Error).message || '删除失败')
            }
          },
        })
      })
      .catch((e) => {
        deps.message.error((e as Error).message || '查询财务记录失败')
      })
  }

  // ---------------------------------------------------------------------------
  // 清账（全单回款，§5.4 C7：按客户分组，逐客户 finance_addPayment）
  // ---------------------------------------------------------------------------
  function clearAccounts() {
    const ids = checkedRowKeys.value.map(Number)
    if (ids.length === 0) {
      deps.message.warning('请选择要清账的数据')
      return
    }
    const rows = deps.rawOrders.value.filter((o) => ids.includes(o.id))

    interface CGroup {
      code: string
      name: string
      count: number
      unpaid: number
      allocs: Array<{
        order_id: number
        receipt_no: string
        order_date: string
        total_price: number
        amount: number
        remaining_after: number
      }>
    }
    const byCustomer = new Map<string, CGroup>()
    for (const r of rows) {
      const unpaid = unpaidOf(r, deps.financeSummary.value)
      if (unpaid <= 0) continue
      const g =
        byCustomer.get(r.client_code) ??
        { code: r.client_code, name: r.client_name, count: 0, unpaid: 0, allocs: [] }
      g.count++
      g.unpaid += unpaid
      g.allocs.push({
        order_id: r.id,
        receipt_no: r.receipt_no,
        order_date: r.order_date,
        total_price: r.total_price,
        amount: unpaid,
        remaining_after: 0,
      })
      byCustomer.set(r.client_code, g)
    }
    const groups = [...byCustomer.values()]
    const total = groups.reduce((s, g) => s + g.unpaid, 0)
    if (total <= 0) {
      deps.message.warning('选中的订单没有未收金额，无需清账')
      return
    }

    const lines = [`将为选中的 ${ids.length} 条订单录入未收金额作为收款：`]
    for (const g of groups) lines.push(`${g.name}：${g.count}单，未收 ¥${fmt(g.unpaid)}`)
    lines.push(`合计 ¥${fmt(total)}`)

    deps.dialog.warning({
      title: '清账确认',
      content: lines.join('\n'),
      positiveText: '清账',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          for (const g of groups) {
            await api.addCustomerPayment(g.code, {
              customer_code: g.code,
              customer_name: g.name,
              amount: g.unpaid,
              pay_date: new Date().toISOString().slice(0, 10),
              method: '清账',
              remark: '批量清账 ',
              allocations: g.allocs,
            })
          }
          deps.message.success('清账成功')
          checkedRowKeys.value = []
          await deps.load()
        } catch (e) {
          deps.message.error((e as Error).message || '清账失败')
        }
      },
    })
  }
  return { checkedRowKeys, selectAllMode, onCheckedKeys, deleteSelected, clearAccounts, combineSelected }
}
