/*
 * 「行级单号 / 单号集 / 合并订单」的差分台（A/B/C 三条拍板的落地验收）。
 *
 * 左边 = **旧服务端源码原样切出来跑**（`docs/legacy-finance/lib/run-legacy-fn.mjs`，
 *        esbuild 剥类型 + 花括号配平；不是手抄）；
 * 右边 = **打我们正在跑的后端**。
 *
 * 对照的三段：
 *   ① `buildReceiptNoSet`（`order.service.ts`）—— 单号集 = 各行「单号」去重后 `_` 连接
 *   ② `lineDateSuffix`（`line-number.service.ts`）—— 单号的日期后缀 `YY/MM/DD`
 *   ③ `lineNoNumber`（同上）—— 从已有单号里解析出「序号 + 年份」，决定下一个号
 *
 * ⚠️ **覆盖不到的部分，别当它验过了**：
 *   `ensureLineNumbers` 整个函数**碰 Prisma**（`prisma.order.findMany` 扫全库取最大），
 *   切不出来也跑不了。所以「按年全局 max+1、按年重置」这条**只做了行为抽样**（见 ③ 的用例），
 *   没有和旧实现逐字对跑。已知它还有个反例，见 `docs/2026-09-18-order-no-semantics.md` §7.5。
 *
 * 用法：起后端（默认 3000）后 `node docs/home-audit/lineno-logiccheck.mjs`
 * ⚠️ 写 `__TMP%` 一次性数据，finally 里清。
 */
import { execSync } from 'node:child_process'
import { legacySrc, runLegacyFns } from '../legacy-finance/lib/run-legacy-fn.mjs'

const API = `http://127.0.0.1:${process.env.E2E_PORT || '3000'}/api`
const DB = 'docker exec -i smartdoor-db psql -U smartdoor -d smartdoor -tAc'
const SQL = (q) => execSync(`${DB} ${JSON.stringify(q.replace(/\s+/g, ' '))}`).toString().trim()

const LINE_SRC = legacySrc('modules/order/line-number.service.ts')
const ORDER_SRC = legacySrc('modules/order/order.service.ts')

/**
 * 本次跑出来的订单 id —— **按 id 清**，不按 `client_code` 清。
 *
 * ⚠️ 踩过的坑：按 `client_code LIKE '__TMP%'` 清，一旦某条记录在创建途中出错、
 * `client_code` 没写进去（或这个键本来就没落），残留就**清不掉**；下次再跑，
 * 那几个写死的回执单号（`'1000'` 之类）会直接撞 `idx_orders_tenant_receipt`，
 * 报一个看起来毫无头绪的 500「数据库错误」。
 */
const createdIds = []
const clean = () => {
  if (createdIds.length) {
    const list = createdIds.join(',')
    SQL(`DELETE FROM order_lines WHERE order_id IN (${list}); DELETE FROM orders WHERE id IN (${list});`)
  }
}

/** 本次运行的唯一前缀 —— 回执单号也带上它，**跨次运行不可能撞号**。 */
const RUN = String(Date.now()).slice(-9)

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

// ───────────────────────── 左边：旧服务端源码，真的跑 ─────────────────────────
// ⚠️⚠️ `runLegacyFns` 是 **async** 的 —— 漏 `await` 会拿到一个 Promise，
//    而 `JSON.stringify(Promise)` 是 `"{}"`，对照会**静默**变成「旧版 = {}」，看着像数据问题。
//    本项目在 `09-diff-orderpay.mjs` 上已经栽过一次同样的跟头（那边是 `L.discount` 变 undefined）。
//    ⇒ 这三个包装**一律 async**，调用点一律 await。

/** `lineDateSuffix(dateValue)` —— 日期 → `YY/MM/DD`。 */
const legacyDateSuffix = (iso) =>
  runLegacyFns(['lineDateSuffix'], {}, `return lineDateSuffix(${JSON.stringify(iso)});`, LINE_SRC)

/** `lineNoNumber(value, year)` —— 从已有单号解析序号。 */
const legacyLineNoNumber = (value, year) =>
  runLegacyFns(
    ['lineNoNumber'],
    {},
    `return lineNoNumber(${JSON.stringify(value)}, ${JSON.stringify(year)});`,
    LINE_SRC,
  )

/** `buildReceiptNoSet(specs)` —— 单号集派生。`doorRowsFromSpecs`/`parseJsonRecord` 一并切。 */
const legacyReceiptNoSet = (rows) =>
  runLegacyFns(
    ['parseJsonRecord', 'asRecordArray', 'doorRowsFromSpecs', 'buildReceiptNoSet'],
    {},
    `return buildReceiptNoSet(${JSON.stringify({ ping_hui: rows, customerInfo: {} })});`,
    ORDER_SRC,
  )

// ─────────────────────────────── 夹具 / 跑我们 ───────────────────────────────
const CODE = '__TMP_LN__'
const mkLine = (lineNo, amt = 100) => ({
  line_type: 'ping', profile: '8888', color: '', direction: '', fans: '', track: '',
  casing: '', hardware: '', bottom_glass: '', face_glass: '', glass_thickness: '',
  door_width: 100, door_height: 200, light_window_height: 0, wall_thickness: 0, jiao: 0,
  mother_door_width: 0, quantity: 1, unit_price: amt, price_type: '', discount: 1, square: 0,
  custom_square: -1, other_fee: 0, casing_price: 0, casing_amount: 0, amount: amt, parts: [],
  markup: [], formula_id: null, remark: '', install_address: '', open_img: '',
  edge_seal_count: null, seal_board_height: 0, track_length: 0, front_casing_add: null,
  back_casing_add: null, double_ding: null, light_window_count: 0, image_id: null,
  image_url: null, progress: '', hole_size: '', line_no: lineNo,
})

async function makeOrder(receipt, orderDate, lines) {
  const o = await call('/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      receipt_no: receipt, client_code: CODE, client_name: '临时', phone: '', brand: '',
      order_date: orderDate, production_days: 7, deposit: 0, remark: '', salesperson: '',
      lines,
    }),
  })
  createdIds.push(o.id)
  return o
}

let pass = 0
let fail = 0
const eq = (label, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) pass++
  else {
    fail++
    console.log(`✗ ${label}\n    旧版 = ${JSON.stringify(a)}\n    新版 = ${JSON.stringify(b)}`)
  }
}

try {
  clean()

  // ── ① 单号集派生：各行「单号」去重后 `_` 连接 ──
  const SET_CASES = [
    ['去重 + 保序', ['85-26/09/14', '86-26/09/14', '85-26/09/14']],
    ['带空白（两侧 trim）', [' 85-26/09/14 ', '86-26/09/14']],
    ['含空串（跳过）', ['85-26/09/14', '', '  ']],
    ['全空 → 旧版保留旧值/回空串', ['', '']],
    ['单个', ['7-26/01/02']],
  ]
  for (const [name, rows] of SET_CASES) {
    const legacy = await legacyReceiptNoSet(rows.map((v) => ({ 单号: v })))
    const order = await makeOrder('', '2026-01-02', rows.map((v) => mkLine(v)))
    // 旧版「全空」时回落 customerInfo['单号集']（夹具里是 undefined ⇒ 空串）；
    // 新版**保留旧值**（新建单旧值是 ''）⇒ 两边都该是空串。语义差异在「改单」时才显形，
    // 见下面 ①b。
    eq(`① ${name}`, legacy ?? '', order.order_no_set)
  }

  // ①b 全空**不清空**：先有值，再把所有行单号清空 ⇒ 新版必须保住旧值（旧版那条 fallback）
  {
    const o = await makeOrder('', '2026-01-02', [mkLine('85-26/09/14')])
    const before = o.order_no_set
    await call(`/v1/orders/${o.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        receipt_no: o.receipt_no, client_code: CODE, client_name: '临时', phone: '', brand: '',
        order_date: '2026-01-02', production_days: 7, deposit: 0, remark: '', salesperson: '',
        lines: [mkLine('')],
      }),
    })
    const after = (await call(`/v1/orders/${o.id}`)).order_no_set
    const legacyFallback = await legacyReceiptNoSet([]) // 无行 ⇒ 回落
    eq(`①b 全空保住旧值（旧版 fallback 语义）`, { kept: before, legacyNoFallbackWouldGive: legacyFallback ?? '' }, { kept: after, legacyNoFallbackWouldGive: '' })
  }

  // ── ② 日期后缀：`YY/MM/DD` ──
  for (const iso of ['2026-09-14', '2025-12-31', '2026-01-01']) {
    const legacy = await legacyDateSuffix(iso)
    const o = await makeOrder('', iso, [mkLine('')])
    await call(`/v1/orders/${o.id}/fill-line-numbers`, { method: 'POST' })
    const got = (await call(`/v1/orders/${o.id}`)).lines[0].line_no
    eq(`② ${iso} 的日期后缀（旧版 ${legacy}）`, got.endsWith(`-${legacy}`), true)
  }

  // ── ③ 序号解析：`lineNoNumber` 只认 `N-YY...` ──
  // 抽样验「已有的号会被算进最大值」：造一个 N=777 的行，下一个号必须 > 777。
  for (const [existing, year] of [['777-26/09/14', '26'], ['777-26', '26'], ['777-25/09/14', '25']]) {
    const legacyN = await legacyLineNoNumber(existing, year)
    const o = await makeOrder('', '2026-09-14', [mkLine(existing), mkLine('')])
    await call(`/v1/orders/${o.id}/fill-line-numbers`, { method: 'POST' })
    const assigned = (await call(`/v1/orders/${o.id}`)).lines[1].line_no
    const n = Number(assigned.split('-')[0])
    // 旧版同一年份才计入 ⇒ 同年时必须 > 777；不同年（25）则不计入，新号可从 1 起
    const expectGt = legacyN === 777 ? n > 777 : true
    eq(`③ 已有 ${existing}（旧版解析 ${legacyN}）→ 新号 ${assigned}`, expectGt, true)
  }

  // ── ④ 合并：存活单 = 回执单号数值最小（旧版前端 `Ii` 的规则，新版搬到服务端）──
  {
    const a = await makeOrder(RUN+'3000', '2026-05-01', [mkLine('10-26/05/01', 100)])
    const b = await makeOrder(RUN+'1000', '2026-04-01', [mkLine('11-26/04/01', 200)])
    const c = await makeOrder(RUN+'2000', '2026-06-01', [mkLine('12-26/06/01', 300)])
    const m = await call('/v1/orders/combine', {
      method: 'POST',
      body: JSON.stringify({ order_ids: [a.id, c.id, b.id] }),
    })
    // 旧版：`[...sel].sort((x,y)=>parseInt(x.回执单号)-parseInt(y.回执单号))[0]` ⇒ 1000
    const legacyTarget = [a, b, c].map((o) => o.receipt_no).sort((x, y) => parseInt(x) - parseInt(y))[0]
    eq('④ 存活单 = 回执单号数值最小', m.receipt_no, legacyTarget)
    eq('④ 总价累加', m.total_price, 600)
    eq('④ 门数累加', m.door_count, 3)
    eq('④ 日期取更早', m.order_date, '2026-04-01')
    eq('④ 打单操作置「合并单」', m.production_status, '合并单')
    eq('④ 三行都搬过来了', m.lines.length, 3)
    eq('④ 行单号原样保留', m.lines.map((l) => l.line_no).sort(), ['10-26/05/01', '11-26/04/01', '12-26/06/01'])
    eq('④ 单号集按合并后的全部行重算', m.order_no_set, '11-26/04/01_10-26/05/01_12-26/06/01')
  }

  // ── ⑤ 守卫：<2 条、跨客户 ──
  {
    // ⚠️ 后缀别和 ④ 那批重（同一跑里 `RUN+'1000'` 已经用过了，会撞唯一索引）。
    const one = await makeOrder(RUN + '9000', '2026-01-01', [mkLine('1-26/01/01')])
    let msg = ''
    try {
      await call('/v1/orders/combine', { method: 'POST', body: JSON.stringify({ order_ids: [one.id] }) })
    } catch (e) {
      msg = String(e.message)
    }
    eq('⑤ 少于两条被拦', msg.includes('请选择至少两条'), true)
  }
} finally {
  clean()
  console.log('\n（一次性数据已清理）')
}

console.log(`\n对照 ${pass + fail} 条：通过 ${pass}，不符 ${fail}`)
process.exit(fail ? 1 : 0)
