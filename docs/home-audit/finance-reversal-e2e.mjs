/*
 * 「删除订单红冲」的**端到端对照**：走真 HTTP 接口，把**旧写法**与**新写法**在同一套夹具上各跑一遍。
 *
 * 背景（详见 `backend/src/modules/finance/service.rs` 的 `reverse_order_allocation` 文档注释）：
 *   旧写法把整笔 `已分配收款`（= 本单收款 + 池分配）写成**一条客户级负收款**（`order_id = NULL`）。
 *   我们的账务模型里那会让同一笔钱扣两次：
 *
 *       未分配余额 = 净收款 − 已分配总额
 *       净收款     = Σ finance_payments（按客户，含负数）        ← 客户级负收款减的是它
 *       已分配总额 = Σ finance_payments(order_id NOT NULL) + Σ finance_allocations
 *                                                  ↑ 只认带 order_id 的，减不到
 *
 *   ⚠️ 「净收款」是 `customer_balance`（`backend/src/modules/finance/service.rs`）里那个 `paid`，
 *      **不是**对外的 `实收金额` —— 后者是「累计充值」（`paid_amount`）。两者分母不同，别合并：
 *      `未分配余额` 必须用净收款。本文件原来把 `paid` 写成「实收金额」，是改动 5 之前的叫法。
 *      （本文件里 `svc:N` 一律指**旧版** `finance.service.ts` 的行号，别与我们自己的行号混。）
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
// 库/容器/用户可用环境变量覆盖。缺省值 = 开发库，行为与改动前**逐字相同**。
// 为什么必须能覆盖：`npm run verify` 跑在自己的 `smartdoor_verify` 库上，而这些台子原来
// 把库名写死成开发库 —— 清理用的 DELETE 拿的是**新库里的 id**，两个库的序列都从 1 开始、
// id 必然撞上 ⇒ 会删掉开发库里的真数据。
const DB = `docker exec -i ${process.env.DB_CONTAINER || 'smartdoor-db'} psql -U ${process.env.DB_USER || 'smartdoor'} -d ${process.env.DB_NAME || 'smartdoor'} -tAc`

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
  console.log('      ⇒ 删除前：实收 0、已分配 500（200 给 B + 300 给 A）、未分配 0')
  console.log('        （实收 0 不是笔误，见下面 `实收金额` 那条注释）\n')

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
    //   实收金额   = 0 —— 不是笔误，是旧版口径：`实收金额` 是**累计充值**，只累加
    //                `prepaidDelta > 0` 的那部分（svc:398/:409，`prepaidDelta = amount − allocatedTotal`）。
    //                本夹具两笔收款的 prepaidDelta 都是 0：池子那笔 300 全分给了 A（300−300），
    //                B 那笔是**本单直收**，旧版走的是 `allocatedTotal = amount` 那条分支（`:341-358`）
    //                ⇒ 也返回 0。红冲（负数）同样进不了 `> 0` 那一侧 ⇒ 旧版**删除前后都是 0**，
    //                且与新/旧两种红冲写法无关。这正是改动 5 要的：红冲**永不**让实收增长。
    //   客户余额   = 0 —— 改动 4 把它改成「客户还欠多少」并夹零（旧版 svc:763 的
    //                `Math.max(0, Σ unpaidAmount − Σ 客户调整)`）。订单全删光 ⇒ 一分不欠 ⇒ 0。
    //                ⚠️ 原来这里断言的是 `= −未分配`，那是**改动 4 之前**的模型：
    //                当时 `客户余额` 是「可用资金」的另一种写法，池子里有钱就是负数。
    check(`${label} 删除前 实收`, before.paid_amount, 0)
    check(`${label} 未分配`, after.unallocated_balance, 300, label === '旧写法')
    check(`${label} 实收`, after.paid_amount, 0)
    check(`${label} 客户余额`, after.customer_balance, 0)
    console.log()
  }

  // ── 追加：`实收金额` 的**部分分配**形态（上面那套夹具覆盖不到它）──────────────
  // 为什么非补不可：上面两笔收款的 `prepaidDelta` **都是 0**（一笔全分掉、一笔本单直收），
  // 所以上面那几条只证明了「不该加的钱没加」。而「该加多少」—— 也就是 `amount − allocatedTotal`
  // 到底减得对不对、有没有夹零 —— 一条都没验。`实收金额` 恒为 0 的台子，在「忘了相减、
  // 只按客户级收款全额相加」那种错法下**也会绿**（本夹具就正是这样绿了几个月）。
  // 补这一块：打 500 进池子、只分 300 给订单 C ⇒ 旧版 `prepaidDelta = 500 − 300 = 200`（svc:384），
  // 实收应为 200；忘了相减就会算出 500。
  {
    const code = '__TMP_PART__'
    const c = Number(
      SQL(`INSERT INTO orders (tenant_id, receipt_no, client_code, client_name, total_price, door_count)
           VALUES (1,'${code}_C','${code}','临时E2E',1000,1) RETURNING id`),
    )
    await call(`/v1/finance/customers/${code}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        customer_code: code,
        customer_name: '临时E2E',
        amount: 500,
        pay_date: '2026-09-18',
        method: '现金',
        remark: 'E2E 部分分配',
        allocations: [{ order_id: c, receipt_no: `${code}_C`, amount: 300 }],
      }),
    })
    const bal = await call(`/v1/finance/customers/${code}/balance`)
    console.log('部分分配：往池子打 500，只分 300 给订单 C（该单总额 1000）')
    console.log(`         ⇒ 未分配=${bal.unallocated_balance} 实收=${bal.paid_amount}`)
    check('部分分配 未分配', bal.unallocated_balance, 200)
    check('部分分配 实收', bal.paid_amount, 200)
    console.log()
  }
} finally {
  clean()
  console.log('（一次性数据已清理）')
}
process.exit(fail ? 1 : 0)
