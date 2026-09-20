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
 * 用法（两条都行）：`npm run verify`（库 / 端口由它指过来），或起独立端口后端
 *   （见 05 头部）后 `node docs/legacy-finance/07-diff-execute.mjs`。
 * ⚠️ 写 `__TMP%` 一次性数据，finally 里清。
 * ⚠️ 要**仓库外**的旧版服务端源码 ⇒ CI 上跑不了（见 05 头部）。
 */
import { execSync } from 'node:child_process'
import { runLegacyFns } from './lib/run-legacy-fn.mjs'

const API = `http://127.0.0.1:${process.env.E2E_PORT || '3999'}/api`
// 库/容器/用户可用环境变量覆盖。缺省值 = 开发库，行为与改动前**逐字相同**。
// 为什么必须能覆盖：`npm run verify` 跑在自己的 `smartdoor_verify` 库上，而这些台子原来
// 把库名写死成开发库 —— 清理用的 DELETE 拿的是**新库里的 id**，两个库的序列都从 1 开始、
// id 必然撞上 ⇒ 会删掉开发库里的真数据。
const DB = `docker exec -i ${process.env.DB_CONTAINER || 'smartdoor-db'} psql -U ${process.env.DB_USER || 'smartdoor'} -d ${process.env.DB_NAME || 'smartdoor'} -tAc`
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

// 判定（2026-09-18 改成断言式，写法照 05-diff-alloc.mjs）：任一条不一致就 exit(1)。
// 比的是**跑完之后的状态**，不是公式 —— 两边的记账表结构不同（旧版没有 allocations 表），
// 所以「分配行 vs 订单调整」这类只有一边有的东西，比的是**同名的业务量**：
//   · 旧版 `fo.allocatedAmount` ↔ 我们 `finance_allocations.amount` 的合计（都是「落到订单的分配额」）
//   · 旧版 `orderAdjustment` ↔ 我们 `finance_order_adjustments`（两边都该只有优惠那笔）
const adjustmentsOf = (rows) =>
  JSON.stringify(
    rows
      .map((a) => ({ receipt: a.receipt_no ?? a.orderNo, amount: a.amount ?? a.adjustAmount, type: a.type ?? a.adjustType }))
      .sort((x, y) => (x.receipt < y.receipt ? -1 : x.receipt > y.receipt ? 1 : x.amount - y.amount)),
  )
const sumByReceipt = (rows, key, amountKey) => {
  const out = {}
  for (const r of rows) out[r[key]] = (out[r[key]] ?? 0) + r[amountKey]
  return out
}

let mismatch = 0
const check = (label, legacy, ours) => {
  const same = legacy === ours
  if (!same) mismatch++
  console.log(
    `  ${same ? '✓' : '⛔'} ${label.padEnd(12)} 旧版 ${String(legacy).padStart(6)}  |  新版 ${String(ours).padStart(6)}` +
      (same ? '' : '   ⛔ 不一致'),
  )
}

try {
  for (const c of CASES) {
    const L = await legacyExecute(c)
    const N = await ourExecute(c)
    const NUnpaid = { A: await unpaidOf('__TMP_EXEC_A__'), B: await unpaidOf('__TMP_EXEC_B__') }

    const ourAlloc = sumByReceipt(N.allocations, 'receipt_no', 'amount')
    const legacyAlloc = Object.fromEntries(L.unpaid.map((u) => [u.receipt, u.allocated]))

    console.log(`\n■ ${c.name}`)
    check('资金池变化', L.poolDelta, N.poolDelta)
    check('池子余额', L.poolAfter, N.poolAfter)
    check('A 未收', L.unpaid[0].unpaid, NUnpaid.A)
    check('B 未收', L.unpaid[1].unpaid, NUnpaid.B)
    check('合计分配金额', L.preview.allocated, N.preview.allocated)
    check('合计优惠金额', L.preview.totalDiscount, N.preview.totalDiscount)
    check('资金池剩余', L.preview.poolRemaining, N.preview.poolRemaining)
    // 每单「落到订单的分配额」：旧版是改完的 fo.allocatedAmount，我们是分配行合计。
    // ⚠️ 这条就是改动 2 的把关点：我们曾经把 `amount` 写成 `alloc + 优惠`（案例③会是 660 vs 600）。
    for (const receipt of ['__TMP_EXEC_A__', '__TMP_EXEC_B__']) {
      check(`${receipt.slice(-2)} 分配额`, legacyAlloc[receipt] ?? 0, ourAlloc[receipt] ?? 0)
    }
    console.log(`  订单调整记录 旧版 ${JSON.stringify(L.adjustments)}`)
    console.log(`               新版 ${JSON.stringify(N.adjustments)}`)
    if (adjustmentsOf(L.adjustments) !== adjustmentsOf(N.adjustments)) {
      mismatch++
      console.log('  ⛔ 订单调整记录不一致（旧版优惠记 orderAdjustment，我们该记 finance_order_adjustments）')
    }
    console.log(`  分配行记录   新版 ${JSON.stringify(N.allocations)}   （旧版没有这张表，上面已按金额对照）`)
    // 分配行的 `discount` 列只作追溯，必须与同单的调整记录对上（优惠额两侧同源）。
    const adjByReceipt = sumByReceipt(
      N.adjustments.map((a) => ({ receipt_no: a.receipt_no, amount: a.amount })),
      'receipt_no',
      'amount',
    )
    for (const r of N.allocations) {
      if ((adjByReceipt[r.receipt_no] ?? 0) !== r.discount) {
        mismatch++
        console.log(`  ⛔ ${r.receipt_no} 的分配行 discount=${r.discount} 与订单调整记录对不上`)
      }
    }
  }
} finally {
  clean()
  console.log('\n（一次性数据已清理）')
}
console.log(mismatch ? `\n⛔ ${mismatch} 处不一致` : '\n✓ 三个场景的落库效果全部一致')
process.exit(mismatch ? 1 : 0)
