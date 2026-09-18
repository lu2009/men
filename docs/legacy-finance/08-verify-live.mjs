/*
 * **在真实数据上**核对新口径：拿库里的实际账，左边用旧版公式在 SQL 里**独立算一遍**，
 * 右边打我们后端的接口，逐字段比。
 *
 * 与 05/06/07 的区别：那三台用**手写夹具**（覆盖边界），这台用**你的真实数据**（覆盖真实形态）。
 *
 * ⚠️ **只读**：不写任何表，不改任何数据。
 *
 * 用法：node docs/legacy-finance/08-verify-live.mjs [客户编号]
 */
import { execSync } from 'node:child_process'

const API = `http://127.0.0.1:${process.env.E2E_PORT || '3000'}/api`
const CODE = process.argv[2] || '1'

const SQL = (q) =>
  execSync(
    `docker exec -i smartdoor-db psql -U smartdoor -d smartdoor -tAc ${JSON.stringify(q.replace(/\s+/g, ' '))}`,
  )
    .toString()
    .trim()

/** 取一个标量（psql -tAc 只回一行一列，没有命令标签）。 */
const one = (q) => Number(SQL(`SELECT ${q}`))

const login = await (
  await fetch(`${API}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }),
  })
).json()
const H = { authorization: `Bearer ${login?.data?.token || login?.token}` }
const api = async (p, opt = {}) => {
  const r = await fetch(`${API}${p}`, { headers: { ...H, ...(opt.body ? { 'content-type': 'application/json' } : {}) }, ...opt })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(j)}`)
  return j?.data ?? j
}

// ───────────────────── 左边：旧版公式（在 SQL 里独立算，不碰 Rust） ─────────────────────
// 依据（都是这次逆向读出来的）：
//   逐单未收   = max(0, 总价 − 本单收款 − 池分配 − 订单调整)   svc:827/829
//   客户余额   = max(0, Σ 逐单未收 − Σ 客户调整)               svc:763
//   实收金额   = Σ max(0, 客户级收款)                          svc:257/398/409（累计充值，只增）
//   未分配余额 = Σ 客户级收款(净) − Σ 池分配
//     ⚠️ **不减订单级收款**：旧版 `prepaidBalance` 只被 `prepaidDelta`（= 收款 − 分配到订单的额）
//        和预付款分配动过；`addOrderPayment`（本单收款，svc:438-457）走的是
//        `updateFinanceOrderAmounts`，**完全不碰 CustomerBalance**。
//        我们的 `unallocated = Σ全部收款 − (订单级 + 分配)` 里订单级两边抵消，等价 ——
//        第一版脚本多减了一次订单级，是我写错，不是代码错。
//   订单总额   = Σ (已分配 + 未收 + 订单调整)                  svc:748
const T = (sub) => `(SELECT COALESCE(${sub},0) FROM orders WHERE 1=0)` // 占位，防止手滑

const ORDER_AGG = `
  WITH o AS (SELECT id, total_price FROM orders WHERE tenant_id=1 AND client_code='${CODE}'),
       pay AS (SELECT order_id, SUM(amount) s FROM finance_payments
               WHERE tenant_id=1 AND order_id IS NOT NULL GROUP BY order_id),
       alc AS (SELECT order_id, SUM(amount) s FROM finance_allocations
               WHERE tenant_id=1 GROUP BY order_id),
       adj AS (SELECT order_id, SUM(amount) s FROM finance_order_adjustments
               WHERE tenant_id=1 GROUP BY order_id)
  SELECT
    COALESCE(SUM(GREATEST(0, o.total_price - COALESCE(pay.s,0) - COALESCE(alc.s,0) - COALESCE(adj.s,0))), 0),
    COALESCE(SUM(COALESCE(pay.s,0) + COALESCE(alc.s,0)), 0),
    COALESCE(SUM(COALESCE(adj.s,0)), 0),
    COALESCE(SUM(COALESCE(pay.s,0) + COALESCE(alc.s,0) + COALESCE(adj.s,0)
                 + GREATEST(0, o.total_price - COALESCE(pay.s,0) - COALESCE(alc.s,0) - COALESCE(adj.s,0))), 0)
  FROM o LEFT JOIN pay ON pay.order_id=o.id
          LEFT JOIN alc ON alc.order_id=o.id
          LEFT JOIN adj ON adj.order_id=o.id`

const [unpaidTotal, allocated, orderAdjTotal, orderTotal] = SQL(`${ORDER_AGG}`).split('|').map(Number)
const custAdjTotal = one(
  `COALESCE(SUM(amount),0) FROM finance_customer_adjustments WHERE tenant_id=1 AND customer_code='${CODE}'`,
)
const custPaidNet = one(
  `COALESCE(SUM(amount),0) FROM finance_payments WHERE tenant_id=1 AND customer_code='${CODE}' AND order_id IS NULL`,
)
const custPaidPos = one(
  `COALESCE(SUM(amount),0) FROM finance_payments WHERE tenant_id=1 AND customer_code='${CODE}' AND order_id IS NULL AND amount > 0`,
)
const allocAll = one(`COALESCE(SUM(amount),0) FROM finance_allocations WHERE tenant_id=1 AND customer_code='${CODE}'`)

const EXPECT = {
  order_total: orderTotal,
  paid_amount: custPaidPos,
  customer_balance: Math.max(0, unpaidTotal - custAdjTotal),
  unallocated_balance: custPaidNet - allocAll,
  order_adjust_total: orderAdjTotal,
  customer_adjust_total: custAdjTotal,
}

// ───────────────────────────── 右边：打接口 ─────────────────────────────
const got = await api(`/v1/finance/customers/${encodeURIComponent(CODE)}/balance`)

console.log(`客户编号 ${CODE} —— 真实数据核对（只读）\n`)
let bad = 0
for (const [k, want] of Object.entries(EXPECT)) {
  const g = got[k]
  const same = Math.abs(g - want) < 0.005
  if (!same) bad++
  console.log(`  ${same ? '✓' : '✗'} ${k.padEnd(20)} 旧版公式 ${String(want).padStart(12)}   接口 ${String(g).padStart(12)}`)
}

// ─────────────── 不变量：每条订单的未收都不该是负数 ───────────────
const orders = (await api('/v1/orders?page=1&page_size=500')).filter((o) => o.client_code === CODE)
console.log(`\n该客户 ${orders.length} 张订单的「未收金额」不变量：`)
for (const o of orders) {
  const d = await api(`/v1/finance/orders/${o.id}`)
  const ok = d.unpaid_amount >= 0
  if (!ok) bad++
  console.log(
    `  ${ok ? '✓' : '✗'} 订单 ${o.receipt_no}  总价 ${o.total_price}  已分配 ${d.allocated_amount}  调整 ${d.adjustment_amount}  未收 ${d.unpaid_amount}`,
  )
}

// ─────────────── 不变量：池子不足时不该分得出去 ───────────────
const pool = got.unallocated_balance
console.log(`\n资金池可用额 = ${pool}`)
const probe = await api(`/v1/finance/customers/${encodeURIComponent(CODE)}/prepayment/preview`, {
  method: 'POST',
  body: JSON.stringify({ customer_code: CODE, allocate_amount: pool + 100, discount_rate: 0 }),
})
const capped = Math.abs(probe.available_balance - Math.max(0, pool)) < 0.005
if (!capped) bad++
console.log(
  `  ${capped ? '✓' : '✗'} 申请 ${pool + 100}（超出池子）→ 封顶到 ${probe.available_balance}，实分 ${probe.total_allocated}`,
)

console.log(bad ? `\n⛔ ${bad} 处不符` : '\n✓ 真实数据全部核对通过')
process.exit(bad ? 1 : 0)
