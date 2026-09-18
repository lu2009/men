/*
 * 「本单收款 + 预付优惠」的差分台（改动 8）。
 *
 * 旧版这条路在 `addPayment` 的**单张单分支**（svc:339-361），只有四行在算什么：
 *   `discount` / `deltaUnpaid` / `nextAllocated` / `nextUnpaid` ——
 *   这里把这四行**从源码原样切出来跑**（不手抄），再把结果与我们的接口比。
 *
 * 除了数字，还要验**副作用**：旧版该分支 `return { prepaidDelta: 0 }` 提前返回，
 * **不碰客户资金池**；我们先前写的是 `finance_allocations(amount=discount)`，等于从池子扣。
 *
 * 用法：起独立端口后端（见 05 头部）后 `node docs/legacy-finance/09-diff-orderpay.mjs`
 * ⚠️ 写 `__TMP%` 一次性数据，finally 里清。
 */
import { execSync } from 'node:child_process'
import { SVC_SRC, runLegacyFns } from './lib/run-legacy-fn.mjs'

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

/**
 * 从旧版源码里**原样**抠出一行赋值语句的**右值**。
 * ⚠️ 只剥 `const ` 是不够的 —— 那样会连 `discount = ` 一起带回来，
 *    拼进 `const discount = (...)` 就成了自引用（`Cannot access 'discount' before initialization`）。
 *    要按**第一个** ` = ` 切（`deltaUnpaid` 的右值里有 `>=`，不能用「最后一个等号」）。
 */
function grab(line) {
  const i = SVC_SRC.indexOf(line)
  if (i < 0) throw new Error(`源码里找不到：${line}`)
  const src = SVC_SRC.slice(i, SVC_SRC.indexOf('\n', i)).replace(/;\s*$/, '')
  const m = /^const\s+\w+\s*=\s*([\s\S]*)$/.exec(src)
  if (!m) throw new Error(`这行不是 const 赋值：${src}`)
  return m[1]
}

const EXPR_DISCOUNT = grab("const discount = Math.max(0, amount) * toNum(body['优惠比例']);")
const EXPR_DELTA = grab('const deltaUnpaid = amount >= 0 ? -(amount + discount) : Math.abs(amount);')
const EXPR_UNPAID = grab('const nextUnpaid = Math.max(0, toNum(fo.unpaidAmount) + deltaUnpaid);')

/** 旧版：给定 (未收, 收款额, 比例小数) → { discount, nextUnpaid }。 */
const legacyCalc = (unpaid, amount, rate) =>
  runLegacyFns(
    ['toNum'],
    // `body` 是旧版从请求体里取的（`优惠比例` 收**小数**），夹具照它的形态给
    { body: { 优惠比例: rate } },
    `const amount = ${amount};
     const discount = (${EXPR_DISCOUNT});
     const deltaUnpaid = (${EXPR_DELTA});
     const fo = { unpaidAmount: ${unpaid} };
     const nextUnpaid = (${EXPR_UNPAID});
     return { discount, nextUnpaid };`,
  )

// ───────────────────────────── 新版 ─────────────────────────────
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

const CODE = '__TMP_OP__'
async function ourCalc(unpaid, amount, ratePercent, pool) {
  clean()
  const id = Number(
    SQL(`INSERT INTO orders (tenant_id, receipt_no, client_code, client_name, total_price, door_count, order_date)
         VALUES (1,'__TMP_OP_A__','${CODE}','临时',${unpaid},1,'2026-01-01') RETURNING id`),
  )
  if (pool > 0) {
    SQL(`INSERT INTO finance_payments (tenant_id, customer_code, customer_name, order_id, amount, kind)
         VALUES (1,'${CODE}','临时',NULL,${pool},'prepayment')`)
  }
  const balBefore = (await call(`/v1/finance/customers/${CODE}/balance`)).unallocated_balance
  let discount = null
  try {
    await call(`/v1/finance/orders/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        customer_code: CODE,
        customer_name: '临时',
        receipt_no: '__TMP_OP_A__',
        amount,
        pay_date: '2026-09-18',
        method: '现金',
        remark: '差分台',
        use_prepay_discount: true,
        discount_rate: ratePercent,
      }),
    })
  } catch (e) {
    discount = `(被拒) ${String(e.message).slice(0, 90)}`
  }
  const d = await call(`/v1/finance/orders/${id}`)
  const balAfter = (await call(`/v1/finance/customers/${CODE}/balance`)).unallocated_balance
  return {
    discount,
    nextUnpaid: d.unpaid_amount,
    orderAdjust: d.adjustment_amount,
    poolDelta: Math.round((balAfter - balBefore) * 100) / 100,
    _raw: d,
  }
}

// ───────────────────────────── 对照 ─────────────────────────────
const CASES = [
  { name: '① 未收 1000，收 500，优惠 10%，池子充足', unpaid: 1000, amount: 500, rate: 10, pool: 10000 },
  // ⚠️ ② 是**有意偏离**：旧版照算（`nextUnpaid = max(0, 1000-1000-100) = 0`），
  //    那个 100 的优惠其实**被夹掉了、什么都没减到**，且它不记任何调整记录 ⇒ 无声浪费。
  //    我们多加了一条护栏「收款金额+优惠抵扣不能超过本单未收」，直接拦住并告诉用户
  //    「这单不需要优惠」。收满时把开关关掉即可。
  //    （`08-fix-plan.md`「不做的」第 3 条：我们比旧版多的入参校验保留。）
  { name: '② 未收 1000，收 1000（收满），优惠 10% —— 我们有意比旧版严', unpaid: 1000, amount: 1000, rate: 10, pool: 10000, expectReject: true },
  { name: '③ 未收 1000，收 500，优惠 10%，**池子 0**', unpaid: 1000, amount: 500, rate: 10, pool: 0 },
]

let bad = 0
try {
  for (const c of CASES) {
    // ⚠️ `runLegacyFns` 是 async 的 —— 漏 await 会拿到 Promise，`L.discount` 静默变 undefined
    const L = await legacyCalc(c.unpaid, c.amount, c.rate / 100)
    const N = await ourCalc(c.unpaid, c.amount, c.rate, c.pool)
    // `N.discount` 非 null = 被接口拒了（里面存的是错误文案）
    const rejected = N.discount !== null
    // 有意偏离的那条 ②：**要**被拦住；其余场景**不**该被拦
    const okDiscount = c.expectReject ? rejected : !rejected
    const okUnpaid = c.expectReject ? rejected : N.nextUnpaid === L.nextUnpaid
    const okAdjust = c.expectReject ? N.orderAdjust === 0 : Math.abs(N.orderAdjust - L.discount) < 0.005
    const okPool = N.poolDelta === 0
    if (!okDiscount || !okUnpaid || !okAdjust || !okPool) bad++

    console.log(`\n■ ${c.name}   （旧版：优惠 ${L.discount}，收后未收 ${L.nextUnpaid}）`)
    console.log(
      c.expectReject
        ? `  ${okDiscount ? '✓' : '✗'} 被护栏拦住（预期如此）  ${okDiscount ? '' : '竟然接受了'}`
        : `  ${okDiscount ? '✓' : '✗'} 接口接受收款        ${okDiscount ? '' : N.discount}`,
    )
    console.log(
      c.expectReject
        ? `  ${okUnpaid ? '✓' : '✗'} 未收保持 ${N.nextUnpaid}（没收进去）`
        : `  ${okUnpaid ? '✓' : '✗'} 收款后未收   旧版 ${L.nextUnpaid}   我们 ${N.nextUnpaid}`,
    )
    console.log(
      c.expectReject
        ? `  ${okAdjust ? '✓' : '✗'} 被拦下且没记任何调整（旧版会静默浪费那 ${L.discount}）`
        : `  ${okAdjust ? '✓' : '✗'} 记的订单调整 旧版(隐含) ${L.discount}   我们 ${N.orderAdjust}`,
    )
    console.log(`  ${okPool ? '✓' : '✗'} 资金池变化   旧版 0（提前 return 不碰池子）   我们 ${N.poolDelta}`)
  }
} finally {
  clean()
  console.log('\n（一次性数据已清理）')
}
console.log(bad ? `\n⛔ ${bad} 处不符` : '\n✓ 三个场景全部一致')
process.exit(bad ? 1 : 0)
