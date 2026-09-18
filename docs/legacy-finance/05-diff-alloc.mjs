/*
 * 分配 + 优惠的**差分台**：同一组夹具，
 *   左边跑**旧服务端的真代码**（`buildAllocationPreview` 原样切出来，见 `lib/run-legacy-fn.mjs`），
 *   右边打**我们后端的真接口**（HTTP）。
 * 逐字段比，把「同一笔业务、两个系统给出不同的数」摆出来。
 *
 * 用法：
 *   ① 起一个**独立端口**的后端（别动正在跑的那个）：
 *        cd backend && cargo build
 *        DATABASE_URL=postgres://smartdoor:smartdoor@localhost:5432/smartdoor PORT=3999 \
 *          ./target/debug/smartdoor-backend &
 *   ② node docs/legacy-finance/05-diff-alloc.mjs
 *
 * ⚠️ 会往库里写 `__TMP%` 前缀的一次性数据，无论成败都在 finally 里清掉。
 */
import { execSync } from 'node:child_process'
import { runLegacyFns } from './lib/run-legacy-fn.mjs'

const API = `http://127.0.0.1:${process.env.E2E_PORT || '3999'}/api`
const DB = 'docker exec -i smartdoor-db psql -U smartdoor -d smartdoor -tAc'
const SQL = (q) =>
  execSync(`${DB} ${JSON.stringify(q.replace(/\s+/g, ' '))}`).toString().trim().split('\n')[0].trim()

function clean() {
  SQL(`
    DELETE FROM orders WHERE receipt_no LIKE '\\_\\_TMP%';
    DELETE FROM finance_allocations WHERE customer_code LIKE '\\_\\_TMP%';
    DELETE FROM finance_payments WHERE customer_code LIKE '\\_\\_TMP%';
    DELETE FROM finance_order_adjustments WHERE customer_code LIKE '\\_\\_TMP%';
    DELETE FROM finance_customer_adjustments WHERE customer_code LIKE '\\_\\_TMP%';`)
}

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

// ───────────────────────────── 场景 ─────────────────────────────
// 客户三张单，日期递增（旧版取 orderDate asc、同日 createdAt asc；我们取 order_date, id）。
// 关键场景是 **amount 足够付清前面整单** —— 那时旧版的优惠是 0，我们不是。
const CODE = '__TMP_DIFF__'
const ORDERS = [
  { receipt: '__TMP_DIFF_A__', total: 1000, day: '2026-01-01' },
  { receipt: '__TMP_DIFF_B__', total: 500, day: '2026-02-01' },
  { receipt: '__TMP_DIFF_C__', total: 300, day: '2026-03-01' },
]
const SCENARIOS = [
  { name: '部分覆盖第一单（两边都该按 alloc 算优惠）', amount: 800, ratePercent: 10 },
  { name: '正好付清第一单', amount: 1000, ratePercent: 10 },
  { name: '付清第一单并覆盖第二单', amount: 1500, ratePercent: 10 },
  { name: '覆盖全部三单', amount: 1800, ratePercent: 10 },
  { name: '优惠比例 5%', amount: 1500, ratePercent: 5 },
]

// 「我们的比例」是百分数（10），「旧版的优惠比例」是小数（0.1）—— 契约本来就不同，换算着喂。
const toLegacyRate = (pct) => pct / 100

// ─────────────────────── 旧版：跑真代码 ───────────────────────
// `buildAllocationPreview(orders, amount, discountRate)` 读 `fo.allocatedAmount` /
// `fo.unpaidAmount`（存量列），夹具里就是「未收 = 总价，已分配 = 0」。
async function legacyPreview(amount, ratePercent) {
  const foRows = ORDERS.map((o) => ({
    orderNo: o.receipt,
    allocatedAmount: 0,
    unpaidAmount: o.total,
    orderAdjustTotal: 0,
    order: { orderDate: new Date(o.day), totalAmount: o.total },
  }))
  const data = await runLegacyFns(
    ['toNum', 'dateText', 'textValue', 'orderTotal', 'buildAllocationPreview'],
    {},
    `return buildAllocationPreview(${JSON.stringify(foRows)}, ${amount}, ${toLegacyRate(ratePercent)})`,
  )
  // `orderDate` 被 JSON 化后是字符串，`dateText` 照样能处理；这里只取金额字段比。
  return {
    rows: data['分配列表'].map((r) => ({
      receipt: r['回执单号'],
      alloc: r['分配金额'],
      discount: r['优惠金额'],
      after: r['分配后余额'],
    })),
    totalDiscount: data['合计优惠金额'],
    poolRemaining: data['资金池剩余'],
  }
}

// ─────────────────────── 新版：打真接口 ───────────────────────
async function ourPreview(amount, ratePercent) {
  const d = await call(`/v1/finance/customers/${CODE}/prepayment/preview`, {
    method: 'POST',
    body: JSON.stringify({ customer_code: CODE, allocate_amount: amount, discount_rate: ratePercent }),
  })
  return {
    rows: (d.allocations ?? []).map((a) => ({
      receipt: a.receipt_no,
      alloc: a.allocated_amount,
      // 我们的 preview 不逐行给优惠，只有合计 —— 这一点本身就是差异，下面单独说明
      discount: null,
      after: a.remaining_after,
    })),
    totalDiscount: d.total_discount,
    poolRemaining: d.pool_remaining,
  }
}

let fail = 0
try {
  clean()
  for (const o of ORDERS) {
    SQL(`INSERT INTO orders (tenant_id, receipt_no, client_code, client_name, total_price, door_count, order_date)
         VALUES (1,'${o.receipt}','${CODE}','临时差分',${o.total},1,'${o.day}')`)
  }

  for (const sc of SCENARIOS) {
    const L = await legacyPreview(sc.amount, sc.ratePercent)
    const N = await ourPreview(sc.amount, sc.ratePercent)
    const sameAlloc =
      JSON.stringify(L.rows.map((r) => [r.receipt, r.alloc])) ===
      JSON.stringify(N.rows.map((r) => [r.receipt, r.alloc]))
    const sameDiscount = L.totalDiscount === N.totalDiscount

    console.log(`\n■ ${sc.name}   （收 ${sc.amount}，优惠 ${sc.ratePercent}%）`)
    console.log(`  旧版 合计优惠 ${L.totalDiscount}  资金池剩余 ${L.poolRemaining}`)
    console.log(`  新版 合计优惠 ${N.totalDiscount}  资金池剩余 ${N.poolRemaining}`)
    console.log(`  分配明细一致：${sameAlloc ? '✓' : '✗'}`)
    if (!sameAlloc) {
      console.log(`    旧版 ${JSON.stringify(L.rows)}`)
      console.log(`    新版 ${JSON.stringify(N.rows)}`)
    }
    if (!sameDiscount) {
      fail++
      console.log(`  ⛔ **合计优惠不一致** —— 旧版 ${L.totalDiscount} vs 新版 ${N.totalDiscount}`)
    }
    if (L.poolRemaining !== N.poolRemaining) {
      console.log(`  ⚠️ 资金池剩余不一致（旧版语义=本次没分掉的；新版语义=池子还剩多少）`)
    }
  }
} finally {
  clean()
  console.log('\n（一次性数据已清理）')
}
console.log(fail ? `\n⛔ ${fail} 个场景的优惠算法不一致` : '\n✓ 所有场景优惠一致')
process.exit(fail ? 1 : 0)
