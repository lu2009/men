/*
 * 差异 ③④⑤ 的实测：**预付款分配「执行」之后，两边到底动了什么**。
 *
 * 前面 `05-diff-alloc.mjs` 只比了预览的返回数字；这里比的是**落库效果** ——
 *   · 客户资金池余额变了多少（差异③「优惠扣不扣池子」、差异④「池子上限」）
 *   · 订单未收变成多少
 *   · 生成了什么记录（订单调整 / 分配行）
 *   · `资金池剩余` 这个返回字段各是什么含义（差异⑤）
 *
 * 左边：把旧版 `executePrepaymentAllocation` **原样切出来跑**，Prisma 换成**会记账的桩**
 *       （不只是返回值，还把每次 update/create 记下来，等价于「跑完之后的状态」）。
 * 右边：把同样的初始状态做进真库，打我们的真接口，再读回来。
 *
 * 用法：起独立端口后端（见 05 头部）后 `node docs/legacy-finance/07-diff-execute.mjs`
 * ⚠️ 写 `__TMP%` 一次性数据，finally 里清。
 */
import { execSync } from 'node:child_process'
import { runLegacyFns } from './lib/run-legacy-fn.mjs'

const API = `http://127.0.0.1:${process.env.E2E_PORT || '3999'}/api`
const DB = 'docker exec -i smartdoor-db psql -U smartdoor -d smartdoor -tAc'
const SQL = (q) => execSync(`${DB} ${JSON.stringify(q.replace(/\s+/g, ' '))}`).toString().trim().split('\n')[0].trim()

const clean = () =>
  SQL(`
    DELETE FROM orders WHERE receipt_no LIKE '\\_\\_TMP%';
    DELETE FROM finance_allocations WHERE customer_code LIKE '\\_\\_TMP%';
    DELETE FROM finance_payments WHERE customer_code LIKE '\\_\\_TMP%';
    DELETE FROM finance_order_adjustments WHERE customer_code LIKE '\\_\\_TMP%';
    DELETE FROM finance_customer_adjustments WHERE customer_code LIKE '\\_\\_TMP%';`)

const login = await (
  await fetch(`${API}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }),
  })
).json()
const H = { authorization: `Bearer ${login?.data?.token || login?.token}`, 'content-type': 'application/json' }
async function call(p, opt = {}) {
  const r = await fetch(`${API}${p}`, { headers: H, ...opt })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(j)}`)
  return j?.data ?? j
}

const CODE = '__TMP_EXEC__'

// ─────────────────────── 旧版：跑真代码 + 记账桩 ───────────────────────
/**
 * 夹具状态：订单 A 未收 1000、B 未收 500；池子里有 `pool` 元。
 * 调 `executePrepaymentAllocation({分配金额: amount, 优惠比例: rate})`，
 * 返回**跑完之后**的状态摘要。
 */
async function legacyExecute({ pool, amount, ratePercent }) {
  const orders = [
    { id: 11, orderNo: '__TMP_EXEC_A__', orderId: 101, allocatedAmount: 0, unpaidAmount: 1000, orderAdjustTotal: 0, order: { orderDate: new Date('2026-01-01'), totalAmount: 1000 } },
    { id: 12, orderNo: '__TMP_EXEC_B__', orderId: 102, allocatedAmount: 0, unpaidAmount: 500, orderAdjustTotal: 0, order: { orderDate: new Date('2026-02-01'), totalAmount: 500 } },
  ]
  const state = {
    balance: { id: 1, prepaidBalance: pool, totalTopup: pool, totalSpent: 0, customerName: '临时', clientCode: CODE },
    fo: new Map(orders.map((o) => [o.id, { ...o }])),
    orderAdjustments: [],
    fundFlows: [],
    orderUpdates: [],
  }
  const prisma = {
    customerBalance: {
      findFirst: async () => state.balance,
      update: async ({ data }) => {
        Object.assign(state.balance, data)
        return state.balance
      },
    },
    financeOrder: {
      update: async ({ where, data }) => {
        Object.assign(state.fo.get(where.id), data)
        return state.fo.get(where.id)
      },
    },
    order: {
      update: async ({ where, data }) => {
        state.orderUpdates.push({ id: where.id, ...data })
        return {}
      },
    },
    orderAdjustment: {
      create: async ({ data }) => {
        state.orderAdjustments.push(data)
        return data
      },
    },
    customerFundFlow: {
      create: async ({ data }) => {
        state.fundFlows.push(data)
        return data
      },
    },
  }

  const res = await runLegacyFns(
    [
      'toNum', 'dateText', 'textValue', 'nowDate', 'statusText', 'orderTotal',
      'customerCodeFromBody', 'buildAllocationPreview', 'executePrepaymentAllocation',
    ],
    {
      prisma,
      resolveCustomerIdentity: async () => ({ balanceCode: CODE, customerName: '临时', client: { id: 1 } }),
      unpaidOrdersForCustomer: async () => [...state.fo.values()],
    },
    // ⚠️ 客户编号必须给：旧版路由是 `/customers/:code/...`，handler 把它写进 body 再传进来
    //    （`customerCodeFromBody` 读 `客户编号`/`customerCode`/`clientCode`）。
    //    第一版漏了这个字段 ⇒ `customerCode` 为空 ⇒ `balance` 为 null ⇒ available=0 ⇒ 整个函数空转，
    //    左边全是 0。**数是 0 就是有 bug**，别把它当成「旧版什么都不做」。
    `return executePrepaymentAllocation('ds', ${JSON.stringify({
      客户编号: CODE,
      分配金额: amount,
      优惠比例: ratePercent / 100, // 旧版收小数
      备注: '差分台',
    })})`,
  )

  return {
    poolAfter: state.balance.prepaidBalance,
    poolDelta: state.balance.prepaidBalance - pool,
    totalSpent: state.balance.totalSpent,
    unpaid: [...state.fo.values()].map((o) => ({ receipt: o.orderNo, unpaid: o.unpaidAmount, allocated: o.allocatedAmount })),
    adjustments: state.orderAdjustments.map((a) => ({ orderNo: a.orderNo, amount: a.adjustAmount, type: a.adjustType })),
    fundFlows: state.fundFlows.map((f) => ({ amount: f.amount, type: f.flowType })),
    preview: { poolRemaining: res.data['资金池剩余'], totalDiscount: res.data['合计优惠金额'], allocated: res.data.totalAllocated },
  }
}

// ─────────────────────── 新版：真库 + 真接口 ───────────────────────
async function ourExecute({ pool, amount, ratePercent }) {
  clean()
  SQL(`DELETE FROM orders WHERE receipt_no LIKE '\\_\\_TMP\\_EXEC%'`)
  const mk = (receipt, total, day) =>
    Number(
      SQL(`INSERT INTO orders (tenant_id, receipt_no, client_code, client_name, total_price, door_count, order_date)
           VALUES (1,'${receipt}','${CODE}','临时',${total},1,'${day}') RETURNING id`),
    )
  const a = mk('__TMP_EXEC_A__', 1000, '2026-01-01')
  const b = mk('__TMP_EXEC_B__', 500, '2026-02-01')
  if (pool > 0) {
    SQL(`INSERT INTO finance_payments (tenant_id, customer_code, customer_name, order_id, amount, kind)
         VALUES (1,'${CODE}','临时',NULL,${pool},'prepayment')`)
  }
  const before = await call(`/v1/finance/customers/${CODE}/balance`)

  const res = await call(`/v1/finance/customers/${CODE}/prepayment/execute`, {
    method: 'POST',
    body: JSON.stringify({ customer_code: CODE, allocate_amount: amount, discount_rate: ratePercent, remark: '差分台' }),
  })

  const after = await call(`/v1/finance/customers/${CODE}/balance`)
  const unpaid = (await call('/v1/orders?page=1&page_size=200')).filter((o) =>
    ['__TMP_EXEC_A__', '__TMP_EXEC_B__'].includes(o.receipt_no),
  )
  const allocs = SQL(`SELECT COALESCE(json_agg(json_build_object('receipt_no',receipt_no,'amount',amount,'discount',discount))::text,'[]')
                      FROM finance_allocations WHERE customer_code='${CODE}'`)
  const adjs = SQL(`SELECT COALESCE(json_agg(json_build_object('receipt_no',receipt_no,'amount',amount,'type',type))::text,'[]')
                    FROM finance_order_adjustments WHERE customer_code='${CODE}'`)

  return {
    poolAfter: after.unallocated_balance,
    poolDelta: after.unallocated_balance - before.unallocated_balance,
    unpaid: unpaid
      .sort((x, y) => (x.order_date < y.order_date ? -1 : 1))
      .map((o) => ({ receipt: o.receipt_no, unpaid: o.total_price - (o.id === a || o.id === b ? 0 : 0) - 0 })),
    adjustments: JSON.parse(adjs),
    allocations: JSON.parse(allocs),
    preview: { poolRemaining: res?.pool_remaining, totalDiscount: res?.total_discount, allocated: res?.total_allocated },
    _res: res,
  }
}

// 订单未收要现算：这里直接用接口给的财务摘要（不是 total_price）
async function unpaidOf(receipt) {
  const list = await call('/v1/orders?page=1&page_size=200')
  const o = list.find((x) => x.receipt_no === receipt)
  if (!o) return null
  const d = await call(`/v1/finance/orders/${o.id}`)
  return d.unpaid_amount
}

// ─────────────────────────────── 对照 ───────────────────────────────
const CASES = [
  { name: '③ 池子 1000，分配 600，优惠 10%', pool: 1000, amount: 600, ratePercent: 10 },
  { name: '③b 池子 1000，分配 1500（超池），优惠 10%', pool: 1000, amount: 1500, ratePercent: 10 },
  { name: '④ 池子 0，分配 600（无池可分配）', pool: 0, amount: 600, ratePercent: 10 },
]

try {
  for (const c of CASES) {
    const L = await legacyExecute(c)
    const N = await ourExecute(c)
    const NUnpaid = { A: await unpaidOf('__TMP_EXEC_A__'), B: await unpaidOf('__TMP_EXEC_B__') }
    console.log(`\n■ ${c.name}`)
    console.log(`  资金池变化   旧版 ${L.poolDelta}  |  新版 ${N.poolDelta}   ${L.poolDelta === N.poolDelta ? '✓' : '⛔'}`)
    console.log(`  池子余额     旧版 ${L.poolAfter}  |  新版 ${N.poolAfter}   ${L.poolAfter === N.poolAfter ? '✓' : '⛔'}`)
    console.log(`  A 未收       旧版 ${L.unpaid[0].unpaid}  |  新版 ${NUnpaid.A}`)
    console.log(`  B 未收       旧版 ${L.unpaid[1].unpaid}  |  新版 ${NUnpaid.B}`)
    console.log(`  订单调整记录 旧版 ${JSON.stringify(L.adjustments)}`)
    console.log(`               新版 ${JSON.stringify(N.adjustments)}`)
    console.log(`  分配行记录   新版 ${JSON.stringify(N.allocations)}   （旧版没有这张表）`)
    console.log(`  资金池剩余   旧版 ${L.preview.poolRemaining}（=本次没分掉的）  新版 ${N.preview.poolRemaining}（=池子还剩多少）`)
  }
} finally {
  clean()
  console.log('\n（一次性数据已清理）')
}
