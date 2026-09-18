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
    // 逐行四项都取：未收 / 分配 / 优惠 / 分配后余额（旧版 `buildAllocationPreview` svc:200-214）
    rows: data['分配列表'].map((r) => ({
      receipt: r['回执单号'],
      unpaid: r['未收金额'],
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
      unpaid: a.unpaid_amount,
      alloc: a.allocated_amount,
      discount: a.discount,
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

  // ── 夹具必须带资金池（2026-09-18 补）──────────────────────────────────────────
  // 旧版 `previewPrepaymentAllocation` 是**先按池子封顶、再算分配**的：
  //   `available = max(0, prepaidBalance)`；`amount = min(max(0, 请求额), available)`（svc:796-797）
  // 所以「池子 0 却要分配 800」这种输入，在旧版**根本走不到**（会得到空列表）。
  // 这个台子左边直接调的是封顶**之后**的内层函数 `buildAllocationPreview`，夹具却只给了订单、
  // 没给池子 ⇒ 右边（我们的接口，已按旧版口径封顶）算出空列表，比的就成了「谁封顶」而不是
  // 「优惠公式」。**这是夹具与旧版口径不符，不是为了让测试变绿而放松断言**：
  // 补一笔池子（2000 > 最大场景 1800）让封顶成为恒等映射，本台子专心比优惠；
  // 封顶本身由 `07-diff-execute.mjs` 的场景 ③b / ④ 把关。
  SQL(`INSERT INTO finance_payments (tenant_id, customer_code, customer_name, order_id, amount, kind)
       VALUES (1,'${CODE}','临时差分',NULL,2000,'prepayment')`)

  for (const sc of SCENARIOS) {
    const L = await legacyPreview(sc.amount, sc.ratePercent)
    const N = await ourPreview(sc.amount, sc.ratePercent)
    // 逐行**四项**都比（先前只比 receipt+alloc，漏了未收/优惠/分配后余额）
    const brief = (rows) => JSON.stringify(rows.map((r) => [r.receipt, r.unpaid, r.alloc, r.discount, r.after]))
    const sameAlloc = brief(L.rows) === brief(N.rows)
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
    // `资金池剩余` 两边都该是「本次拟分配里没分掉的」（`amount − Σalloc`）。
    // 这条 2026-09-18 之后才成立：先前我们的 `pool_remaining` 是「客户池子还剩多少」
    // （甚至是个负数），旧版是「本次没分掉的」—— 同名不同物（差异⑤），所以当时只敢打 ⚠️。
    // 口径对齐（改动 6）之后升级成硬断言，这样将来谁再改回去会被这台子抓住。
    if (L.poolRemaining !== N.poolRemaining) {
      fail++
      console.log(`  ⛔ **资金池剩余不一致** —— 旧版 ${L.poolRemaining} vs 新版 ${N.poolRemaining}`)
    }
  }
} finally {
  clean()
  console.log('\n（一次性数据已清理）')
}
console.log(fail ? `\n⛔ ${fail} 个场景的优惠算法不一致` : '\n✓ 所有场景优惠一致')
process.exit(fail ? 1 : 0)
