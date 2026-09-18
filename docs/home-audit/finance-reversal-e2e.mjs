/*
 * 「删除订单红冲」的**端到端对照**：走真 HTTP 接口，把**旧写法**与**新写法**在同一套夹具上各跑一遍。
 *
 * 背景（详见 `backend/src/modules/finance/service.rs` 的 `reverse_order_allocation` 文档注释）：
 *   旧写法把整笔 `已分配收款`（= 本单收款 + 池分配）写成**一条客户级负收款**（`order_id = NULL`）。
 *   我们的账务模型里那会让同一笔钱扣两次：
 *
 *       未分配余额 = 实收金额 − 已分配总额
 *       实收金额   = Σ finance_payments（按客户，含负数）        ← 负收款减的是它
 *       已分配总额 = Σ finance_payments(order_id NOT NULL) + Σ finance_allocations
 *                                                  ↑ 只认带 order_id 的，减不到
 *
 *   被删订单对 `已分配总额` 的贡献仍在（两处都按 `order_id` 聚合，订单删了行还留着）⇒ 多扣 2×金额。
 *
 * 新写法按**来源**拆成两条腿：
 *   · 本单直接收款 → 带 `order_id` 的负收款 ⇒ 实收与已分配总额同额下降，未分配不变
 *   · 资金池分配   → 负的 `finance_allocations` ⇒ 只降已分配总额，钱回到池子
 *
 * 用法：
 *   ① 起一个**独立端口**的后端（别动正在跑的那个）：
 *        cd backend && cargo build
 *        DATABASE_URL=postgres://smartdoor:smartdoor@localhost:5432/smartdoor PORT=3999 \
 *          ./target/debug/smartdoor-backend &
 *   ② node docs/home-audit/finance-reversal-e2e.mjs
 *
 * ⚠️ 会往库里写 `__TMP%` 前缀的一次性数据，**无论成败都在 finally 里清掉**。
 *    依赖 `docker exec smartdoor-db psql`（本机 postgres 跑在容器里；没有 psql 客户端）。
 */
import { execSync } from 'node:child_process'

const PORT = process.env.E2E_PORT || '3999'
const API = `http://127.0.0.1:${PORT}/api`
const DB = 'docker exec -i smartdoor-db psql -U smartdoor -d smartdoor -tAc'

/**
 * 跑一句 SQL 并返回**第一行**。
 * ⚠️ `-tAc` 下 `INSERT … RETURNING id` 的输出是 `"91\nINSERT 0 1"`（值在前、命令标签在后），
 *    不取首行的话 `Number()` 会得到 NaN ⇒ JSON 里变成 null ⇒ 接口 422。
 * ⚠️ 语句里的换行要先压成空格：`JSON.stringify` 会把换行转义成字面量 `\n`，
 *    psql 会把开头那个当成反斜杠命令（`invalid command \n`）。
 */
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
const H = {
  authorization: `Bearer ${login?.data?.token || login?.token}`,
  'content-type': 'application/json',
}
async function call(p, opt = {}) {
  const r = await fetch(`${API}${p}`, { headers: H, ...opt })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(j)}`)
  return j?.data ?? j
}

/** 造一套夹具：A = 全部来自池分配；B = 全部来自本单直接收款。两张单总额各 1000。 */
async function fixture(code) {
  const mk = (receipt) =>
    Number(
      SQL(`INSERT INTO orders (tenant_id, receipt_no, client_code, client_name, total_price, door_count)
           VALUES (1,'${receipt}','${code}','临时E2E',1000,1) RETURNING id`),
    )
  const a = mk(`${code}_A`)
  const b = mk(`${code}_B`)
  // 客户往池子打 300，并把它分配到 A
  await call(`/v1/finance/customers/${code}/payments`, {
    method: 'POST',
    body: JSON.stringify({
      customer_code: code,
      customer_name: '临时E2E',
      amount: 300,
      pay_date: '2026-09-18',
      method: '现金',
      remark: 'E2E 池',
      allocations: [{ order_id: a, receipt_no: `${code}_A`, amount: 300 }],
    }),
  })
  // B：本单直接收款 200
  await call(`/v1/finance/orders/${b}/payments`, {
    method: 'POST',
    body: JSON.stringify({
      customer_code: code,
      customer_name: '临时E2E',
      receipt_no: `${code}_B`,
      amount: 200,
      pay_date: '2026-09-18',
      method: '现金',
      remark: 'E2E 本单',
      use_prepay_discount: false,
      discount_rate: 0,
    }),
  })
  return { a, b }
}

/** 旧写法：整笔 allocated_amount 写成**一条客户级负收款**（order_id = NULL）。 */
async function revertOld(code, orders) {
  const items = await call('/v1/finance/orders/check', {
    method: 'POST',
    body: JSON.stringify({ order_ids: orders.map((o) => o.id) }),
  })
  const byCustomer = new Map()
  for (const it of items) byCustomer.set(it.customer_code, (byCustomer.get(it.customer_code) ?? 0) + it.allocated_amount)
  for (const [c, total] of byCustomer) {
    if (total > 0) {
      await call(`/v1/finance/customers/${c}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          customer_code: c,
          customer_name: '临时E2E',
          amount: -total,
          pay_date: '2026-09-18',
          method: '其他',
          remark: '删除订单红冲收款',
          allocations: [],
        }),
      })
    }
  }
}

/** 新写法：按来源拆（本单收款 → 带 order_id 的负收款；池分配 → 负分配行）。 */
async function revertNew(code, orders) {
  for (const { id, receipt } of orders) {
    const it = (
      await call('/v1/finance/orders/check', { method: 'POST', body: JSON.stringify({ order_ids: [id] }) })
    )[0]
    if (it.order_paid_amount > 0) {
      await call(`/v1/finance/orders/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          customer_code: code,
          customer_name: '临时E2E',
          receipt_no: receipt,
          amount: -it.order_paid_amount,
          pay_date: '2026-09-18',
          method: '其他',
          remark: '删除订单红冲收款',
          use_prepay_discount: false,
          discount_rate: 0,
        }),
      })
    }
    if (it.allocation_amount > 0) await call(`/v1/finance/orders/${id}/allocation-reversal`, { method: 'POST' })
  }
}

let fail = 0
/**
 * `expectFail = true` 用于**旧写法**：那条路本来就该不满足不变量，写在这里是当**反例**留证。
 * 判定标准是**不变量**（删光该客户的订单后，未分配余额应等于客户实打实还能用的钱），
 * 不是手填的期望值 —— 手填值会跟着实现漂。
 */
const check = (label, got, want, expectFail = false) => {
  const pass = expectFail ? got !== want : got === want
  if (!pass) fail++
  console.log(`  ${pass ? '✓' : '✗'} ${label}: ${got}${pass ? '' : `（应 ${want}）`}`)
}

try {
  console.log('夹具：客户往池子打 300 并分给 A；另外直接给 B 收 200。两张单总额各 1000。')
  console.log('      ⇒ 删除前：实收 500、已分配 500（200 给 B + 300 给 A）、未分配 0\n')

  for (const [label, code, revert] of [
    ['旧写法', '__TMP_OLD__', revertOld],
    ['新写法', '__TMP_NEW__', revertNew],
  ]) {
    const { a, b } = await fixture(code)
    const orders = [
      { id: a, receipt: `${code}_A` },
      { id: b, receipt: `${code}_B` },
    ]
    const before = await call(`/v1/finance/customers/${code}/balance`)
    await revert(code, orders)
    for (const id of [a, b]) await call(`/v1/orders/${id}`, { method: 'DELETE' })
    const after = await call(`/v1/finance/customers/${code}/balance`)
    console.log(`${label}：删除前 未分配=${before.unallocated_balance} 实收=${before.paid_amount}`)
    console.log(`${label}：删除后 未分配=${after.unallocated_balance} 实收=${after.paid_amount} 客户余额=${after.customer_balance}`)
    // 不变量：订单全删光之后
    //   未分配余额 = 客户打进池子的 300（A 那笔分配随单解除）
    //   实收金额   = 300（B 那笔 200 随单作废 —— 旧版「红冲收款」的语义）
    check(`${label} 未分配`, after.unallocated_balance, 300, label === '旧写法')
    check(`${label} 实收`, after.paid_amount, 300, label === '旧写法')
    // 自洽性：订单全没了，客户余额应恰为 −可用资金
    if (label !== '旧写法') check('新写法 客户余额 = −未分配', after.customer_balance, -after.unallocated_balance)
    console.log()
  }
} finally {
  clean()
  console.log('（一次性数据已清理）')
}
process.exit(fail ? 1 : 0)
