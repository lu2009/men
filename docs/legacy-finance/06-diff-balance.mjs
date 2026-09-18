/*
 * 「客户余额 / 实收金额 / 未分配余额」的**差分台**。
 *
 * 左边：把旧服务端的 **`getCustomerBalance` 原样切出来跑**，只把它依赖的
 *       Prisma 查询换成桩（返回夹具）—— **连一行公式都不用转写**。
 * 右边：打我们后端的真接口。
 *
 * 用法：
 *   ① 起独立端口后端（别动正在跑的那个）：见 `05-diff-alloc.mjs` 头部
 *   ② node docs/legacy-finance/06-diff-balance.mjs
 *
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

// ─────────────────────── 场景：直接给「旧版的输入状态」 ───────────────────────
// 旧版读的是存量列，所以夹具直接给存量列的值（这是**给旧版的输入**，不是抄它的算法）：
//   financeOrders[].{allocatedAmount, unpaidAmount, orderAdjustTotal}
//   customerBalance.{totalTopup, prepaidBalance}
//   orderAdjustments / customerAdjustments
const SCEN = [
  {
    name: '① 一张单 1000，没付任何钱',
    fo: [{ allocatedAmount: 0, unpaidAmount: 1000, orderAdjustTotal: 0 }],
    cb: { totalTopup: 0, prepaidBalance: 0 },
    oa: [], ca: [],
  },
  {
    name: '② 一张单 1000，客户往池子打 1000（未分配）',
    // 旧版：池子充值 1000 ⇒ prepaidDelta=1000 ⇒ prepaidBalance=1000, totalTopup=1000；
    //       订单没被分配，unpaidAmount 仍是 1000
    fo: [{ allocatedAmount: 0, unpaidAmount: 1000, orderAdjustTotal: 0 }],
    cb: { totalTopup: 1000, prepaidBalance: 1000 },
    oa: [], ca: [],
  },
  {
    name: '③ 上面那张单再分配 600 上去',
    fo: [{ allocatedAmount: 600, unpaidAmount: 400, orderAdjustTotal: 0 }],
    cb: { totalTopup: 1000, prepaidBalance: 400 },
    oa: [], ca: [],
  },
  {
    name: '④ 预付款优惠 50（记成订单调整，不扣池子）',
    fo: [{ allocatedAmount: 600, unpaidAmount: 350, orderAdjustTotal: 50 }],
    cb: { totalTopup: 1000, prepaidBalance: 400 },
    oa: [{ adjustAmount: 50 }], ca: [],
  },
  {
    name: '⑤ 客户抹零 80',
    fo: [{ allocatedAmount: 0, unpaidAmount: 1000, orderAdjustTotal: 0 }],
    cb: { totalTopup: 0, prepaidBalance: 0 },
    oa: [], ca: [{ adjustAmount: 80 }],
  },
  {
    name: '⑥ 池子红冲后余额为负（旧版不夹零）',
    fo: [{ allocatedAmount: 0, unpaidAmount: 1000, orderAdjustTotal: 0 }],
    cb: { totalTopup: 1000, prepaidBalance: -200 },
    oa: [], ca: [],
  },
]

/** 旧版 `getCustomerBalance` 只用到这几个 prisma 方法，做成桩。 */
function fakePrisma(scen, code) {
  const rows = scen.fo.map((f, i) => ({
    orderNo: `__TMP_BAL_${i}__`,
    allocatedAmount: f.allocatedAmount,
    unpaidAmount: f.unpaidAmount,
    orderAdjustTotal: f.orderAdjustTotal,
    order: {},
  }))
  return {
    customerBalance: {
      findFirst: async () => ({
        totalTopup: scen.cb.totalTopup,
        prepaidBalance: scen.cb.prepaidBalance,
        totalSpent: 0,
        customerName: '临时差分',
        clientCode: code,
      }),
      upsert: async () => ({
        totalTopup: scen.cb.totalTopup,
        prepaidBalance: scen.cb.prepaidBalance,
        customerName: '临时差分',
        clientCode: code,
      }),
    },
    financeOrder: { findMany: async () => rows },
    customerAdjustment: { findMany: async () => scen.ca },
    orderAdjustment: { findMany: async () => scen.oa },
  }
}

async function legacyBalance(scen) {
  const code = '__TMP_BAL__'
  const res = await runLegacyFns(
    ['toNum', 'statusText', 'getCustomerBalance'],
    {
      prisma: fakePrisma(scen, code),
      // `getCustomerBalance` 里用到的三个外部件，各自桩掉
      findClient: async () => ({ id: 1, clientCode: code, name: '临时差分' }),
      ensureCustomerBalance: async () => ({
        totalTopup: scen.cb.totalTopup,
        prepaidBalance: scen.cb.prepaidBalance,
        customerName: '临时差分',
        clientCode: code,
      }),
      financeOrdersForCustomer: async () =>
        scen.fo.map((f, i) => ({
          orderNo: `__TMP_BAL_${i}__`,
          allocatedAmount: f.allocatedAmount,
          unpaidAmount: f.unpaidAmount,
          orderAdjustTotal: f.orderAdjustTotal,
          order: {},
        })),
    },
    `return getCustomerBalance('ds', ${JSON.stringify(code)}, undefined)`,
  )
  return res.data ?? res
}

// ─────────────────────── 新版：把同样的状态**做进库里**再读接口 ───────────────────────
// 我们的表是流水，所以要把「旧版的存量状态」翻译成等价的流水再插进去。
async function ourBalance(scen) {
  const code = '__TMP_BAL__'
  SQL(`DELETE FROM finance_allocations WHERE customer_code='${code}'`)
  SQL(`DELETE FROM finance_payments WHERE customer_code='${code}'`)
  SQL(`DELETE FROM finance_order_adjustments WHERE customer_code='${code}'`)
  SQL(`DELETE FROM finance_customer_adjustments WHERE customer_code='${code}'`)
  SQL(`DELETE FROM orders WHERE receipt_no LIKE '\\_\\_TMP\\_BAL%'`)

  let total = 0
  for (let i = 0; i < scen.fo.length; i++) {
    const f = scen.fo[i]
    const t = f.allocatedAmount + f.unpaidAmount + f.orderAdjustTotal
    total += t
    const id = SQL(`INSERT INTO orders (tenant_id, receipt_no, client_code, client_name, total_price, door_count, order_date)
                    VALUES (1,'__TMP_BAL_${i}__','${code}','临时差分',${t},1,'2026-01-0${i + 1}') RETURNING id`)
    // 已分配 = 订单级收款 + allocations；这里统一用 allocations 表示
    if (f.allocatedAmount > 0) {
      SQL(`INSERT INTO finance_allocations (tenant_id, customer_code, order_id, receipt_no, amount)
           VALUES (1,'${code}',${id},'__TMP_BAL_${i}__',${f.allocatedAmount})`)
    }
    if (f.orderAdjustTotal > 0) {
      SQL(`INSERT INTO finance_order_adjustments (tenant_id, customer_code, customer_name, order_id, receipt_no, amount, type)
           VALUES (1,'${code}','临时差分',${id},'__TMP_BAL_${i}__',${f.orderAdjustTotal},'预付款优惠')`)
    }
  }
  // 池子充值：旧版 totalTopup = Σ max(0, prepaidDelta)，prepaidBalance = Σ prepaidDelta。
  // 我们只有「客户级收款」一张表 ⇒ 用**两笔**分别表示正向充值与其净额差（若有负差）。
  if (scen.cb.totalTopup > 0) {
    SQL(`INSERT INTO finance_payments (tenant_id, customer_code, customer_name, order_id, amount, kind)
         VALUES (1,'${code}','临时差分',NULL,${scen.cb.totalTopup},'prepayment')`)
  }
  if (scen.cb.prepaidBalance < 0) {
    // 负余额：追加一笔负的客户级收款（旧版里是「预付款冲销」）
    SQL(`INSERT INTO finance_payments (tenant_id, customer_code, customer_name, order_id, amount, kind, remark)
         VALUES (1,'${code}','临时差分',NULL,${scen.cb.prepaidBalance - scen.cb.totalTopup},'客户级红冲','差分夹具')`)
  }
  for (const c of scen.ca) {
    SQL(`INSERT INTO finance_customer_adjustments (tenant_id, customer_code, customer_name, amount, type)
         VALUES (1,'${code}','临时差分',${c.adjustAmount},'月度抹零')`)
  }
  return await call(`/v1/finance/customers/${code}/balance`)
}

// ─────────────────────────────── 对照 ───────────────────────────────
const FIELDS = ['实收金额', '客户余额', '未分配余额', '订单总额', '已分配金额', '订单调整合计', '客户调整合计']
const OUR_KEY = {
  实收金额: 'paid_amount',
  客户余额: 'customer_balance',
  未分配余额: 'unallocated_balance',
  订单总额: 'order_total',
  已分配金额: null,
  订单调整合计: 'order_adjust_total',
  客户调整合计: 'customer_adjust_total',
}

let diffs = 0
try {
  clean()
  for (const sc of SCEN) {
    const L = await legacyBalance(sc)
    const N = await ourBalance(sc)
    console.log(`\n■ ${sc.name}`)
    for (const f of FIELDS) {
      const lv = L[f]
      const k = OUR_KEY[f]
      const nv = k ? N[k] : '(我们没这个字段)'
      const same = k && lv === nv
      if (!same) diffs++
      const mark = k ? (same ? '✓' : '✗') : '—'
      console.log(`   ${mark} ${f.padEnd(6)} 旧版 ${String(lv).padStart(8)}   新版 ${String(nv).padStart(8)}`)
    }
  }
} finally {
  clean()
  console.log('\n（一次性数据已清理）')
}
console.log(diffs ? `\n⛔ ${diffs} 处字段值不一致` : '\n✓ 全部一致')
process.exit(0)
