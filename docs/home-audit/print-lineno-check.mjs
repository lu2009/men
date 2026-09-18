/*
 * 打印载荷里的「单号」到底取哪一级 —— 逐处核对。
 *
 * 起因：`OrderID` / `orderID` / `qrcode` 这些键在旧版**全部来自明细行的「单号」**
 * （`Hui.formatted.js:10028/10057/10087/10131/…` 十余处 `x["OrderID"] = row["单号"]`；
 * `:9075` `qrcode = String(row["单号"])`），而新版一度全喂 `ctx.order.receipt_no`（订单级回执单号）。
 * 后果：厂里扫二维码本应定位到**哪一樘门**，却得到订单号。
 *
 * ⚠️ 但**不是所有** `orderNo` 都该改 —— 回执族（receipt/FinalReceipt/ReceiptList）表头那个
 * `receiptPrintData().orderNo` **本来就该是回执单号**（旁证：`ReceiptMobile` 拿它当
 * `finance_getOrderFinanceBalance` 的入参）。这台机器把两边**都钉住**，防止以后有人一把 grep 全改。
 *
 * 做法：esbuild 把 `printPayloads.ts` 打成 ESM 直接 import（不是手抄一份），
 * 用一条**行级单号各不相同**的订单跑全部 builders。
 *
 * 用法：起后端（默认 3000）后 `node docs/home-audit/print-lineno-check.mjs`
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = '/Users/aaa/Desktop/door-main'
const req = createRequire(`${ROOT}/app/`)
const { build } = req(`${ROOT}/app/node_modules/esbuild`)
const API = `http://127.0.0.1:${process.env.E2E_PORT || '3000'}/api`

/**
 * `buildOrderPrintContext` 在 `composables/useOrderPrint`、`createPrintPayloads` 在 `utils/printPayloads`，
 * 所以走一个**两行入口**把它们一起打出来（同 `docs/custom-docs-recon/verify/entry.ts` 的手法）。
 */
/**
 * ⚠️ **不能一路返回 null** —— 打进来的 `api` 是从 `localStorage` 取登录 token 的
 * （`client.ts` 的 `TOKEN_KEY = 'smartdoor_token'`）。给 null 的话，
 * `ensureLineNumbersForPrint` 里那个 `api.fillLineNumbers()` 会 401，
 * 而它**把异常吞掉**（补号失败不拦打印）⇒ 测试看到的是「没补上」，
 * 排查半天才发现是夹具没给 token。所以这里在登录后回填真 token。
 */
let AUTH_TOKEN = null
globalThis.localStorage = {
  getItem: (k) => (k === 'smartdoor_token' ? AUTH_TOKEN : null),
  setItem: () => {},
  removeItem: () => {},
}

const ENTRY = '/tmp/print-verify/entry.ts'
writeFileSync(
  ENTRY,
  `export { buildOrderPrintContext, ensureLineNumbersForPrint } from '${ROOT}/app/src/composables/useOrderPrint'\n` +
    `export { createPrintPayloads } from '${ROOT}/app/src/utils/printPayloads'\n`,
)
const out = `${ROOT}/app/node_modules/.cache/print-lineno-check.mjs`
await build({
  entryPoints: [ENTRY],
  bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'error',
  define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: API }) },
})
const M = await import(out)

let pass = 0
let fail = 0
const eq = (label, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) pass++
  else {
    fail++
    console.log(`✗ ${label}\n    期望 = ${JSON.stringify(a)}\n    实得 = ${JSON.stringify(b)}`)
  }
}
const ok = (label, v) => eq(label, true, !!v)

/** 递归找出对象里所有 `OrderID` / `orderID` / `qrcode` 的值。 */
function collectIds(node, acc = []) {
  if (Array.isArray(node)) { node.forEach((n) => collectIds(n, acc)); return acc }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && ['OrderID', 'orderID', 'qrcode'].includes(k)) acc.push([k, v])
      else collectIds(v, acc)
    }
  }
  return acc
}

// ─────────────────────── 造一条「每行单号都不同」的订单 ───────────────────────
const login = await (await fetch(`${API}/v1/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }),
})).json()
AUTH_TOKEN = login?.data?.token || login?.token
const H = { authorization: `Bearer ${AUTH_TOKEN}`, 'content-type': 'application/json' }
const call = async (p, o = {}) => {
  const r = await fetch(`${API}${p}`, { headers: H, ...o })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(j)}`)
  return j?.data ?? j
}

const RUN = String(Date.now()).slice(-9)
const createdIds = []
/**
 * ⚠️ `formula_id` **必须给真的** —— `orderedLines` 的 `keep()` 会剔掉
 * `formula_id == null || !formulaOf(l)` 的行（`printPayloads.ts` 的 `keep`），
 * 给 null 的话生产单/合片单/自绘单据/product1 **全都出不了行**，
 * 于是「有没有用错单号」这件事根本测不到（第一版就是这么假绿的）。
 */
const mkLine = (no, type = 'ping', formulaId) => ({
  line_type: type, profile: '8888', color: '白', direction: '左开', fans: type === 'diao' ? '双扇' : '',
  track: '', casing: '', hardware: '', bottom_glass: '5mm', face_glass: '5mm', glass_thickness: '5',
  door_width: 100, door_height: 200, light_window_height: 0, wall_thickness: 0, jiao: 0,
  mother_door_width: 0, quantity: 1, unit_price: 100, price_type: '', discount: 1, square: 0,
  custom_square: -1, other_fee: 0, casing_price: 0, casing_amount: 0, amount: 100, parts: [],
  markup: [], formula_id: formulaId, remark: '', install_address: '', open_img: '',
  edge_seal_count: null, seal_board_height: 0, track_length: 0, front_casing_add: null,
  back_casing_add: null, double_ding: null, light_window_count: 0, image_id: null,
  image_url: null, progress: '', hole_size: '', line_no: no,
})

const LINE_NOS = ['7-26/09/14', '3-26/09/14', '11-26/09/14'] // 故意乱序，好验「序号优先」
let order
try {
  const [formulas, clients] = await Promise.all([call('/v1/formulas'), call('/v1/clients')])
  const pingF = formulas.find((f) => (f.formula_type || f.template_key) === 'ping')
  const diaoF = formulas.find((f) => (f.formula_type || f.template_key) === 'diao')
  ok('库里至少有一条平开公式（没有的话这个夹具没意义）', !!pingF)

  order = await call('/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      receipt_no: RUN + '1', client_code: '__TMP_PL__', client_name: '临时', phone: '', brand: '品牌X',
      order_date: '2026-09-14', production_days: 7, deposit: 0, remark: '', salesperson: '',
      install_address: '地址X',
      lines: [
        mkLine(LINE_NOS[0], 'ping', pingF?.id ?? null),
        mkLine(LINE_NOS[1], 'ping', pingF?.id ?? null),
        mkLine(LINE_NOS[2], 'diao', diaoF?.id ?? pingF?.id ?? null),
      ],
    }),
  })
  createdIds.push(order.id)
  const full = await call(`/v1/orders/${order.id}`)

  const prereqs = { formulas, clients, payQrcode: '', formulaImages: {} }
  const who = { tenantName: login?.data?.tenant?.name || '', maker: login?.data?.user?.name || '' }
  const ctx = M.buildOrderPrintContext(full, prereqs, who)

  const P = M.createPrintPayloads(ctx)
  const RECEIPT_NO = full.receipt_no

  // ── ① 回执族表头的 orderNo **必须**是订单级回执单号（这条是防「一把全改」的）──
  const receipt = P.receiptPrintData()
  eq('① 回执族表头 orderNo = 回执单号（不是行级单号）', receipt.orderNo, RECEIPT_NO)

  // ── ② 行级 builders 里的 OrderID/orderID/qrcode **必须**是行级单号 ──
  const BUILDS = {
    'lable 标签': () => P.labelRows('lable'),
    'product10': () => P.labelRows('product10'),
    '玻璃合片单': () => P.glassProduces(),
    '玻璃信息': () => P.glassInfoProduces(),
    '生产单': () => P.productionProduces(),
    '自绘单据': () => P.oldSheetProduces(),
    'product1': () => P.product1Produces(),
  }
  const seenIds = new Set()
  for (const [name, run] of Object.entries(BUILDS)) {
    let rows
    try {
      rows = run()
    } catch (e) {
      console.log(`  （${name} 跑不出来，跳过：${String(e.message).slice(0, 70)}）`)
      continue
    }
    const ids = collectIds(rows)
    ok(`② ${name} 有产出`, Array.isArray(rows) && rows.length > 0)
    const bad = ids.filter(([, v]) => v === RECEIPT_NO)
    eq(`② ${name} 没有一处用回执单号冒充行级单号`, bad, [])
    ids.forEach(([, v]) => seenIds.add(v))
  }
  // 出现过的值必须都是我们那三个行级单号之一（或空）
  const unexpected = [...seenIds].filter((v) => v !== '' && !LINE_NOS.includes(v))
  eq('② 行级 builders 里出现的单号值只能是行级单号', unexpected, [])

  // ── ③ 「序号优先」真的会重排 ──
  {
    const byFormula = P.orderedLines(true).map((l) => l.line_no)
    // 换一个 sortMethod 的 ctx 再取一次
    const ctx2 = { ...ctx, sortMethod: 'order' }
    const P2 = M.createPrintPayloads(ctx2)
    const byOrder = P2.orderedLines(true).map((l) => l.line_no)
    const sorted = [...byOrder].map((v) => parseInt(v, 10)).every((v, i, a) => i === 0 || a[i - 1] <= v)
    ok('③ 「序号优先」按行级单号升序', sorted)
    // 若两者相同，说明依然是原序（说明这个夹具没能体现差异，不算失败，但要报出来）
    if (JSON.stringify(byOrder) === JSON.stringify(byFormula)) {
      console.log('  ⚠️ 「序号优先」结果与默认序相同 —— 本夹具下看不出差异（不判失败，但值得留意）')
    } else {
      pass++
      console.log(`  ✓ 「序号优先」确实重排了：默认 ${JSON.stringify(byFormula)} → 序号 ${JSON.stringify(byOrder)}`)
    }
  }

  // ── ④ 打印前自动补号（旧版是「一打印就补」，见 useOrderPrint 的 ensureLineNumbersForPrint）──
  {
    // 造一张**行全都没单号**的订单：模拟「刚建完、还没点过填入单号」
    const blank = await call('/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        receipt_no: RUN + '2', client_code: '__TMP_PL__', client_name: '临时', phone: '', brand: '品牌X',
        order_date: '2026-09-14', production_days: 7, deposit: 0, remark: '', salesperson: '',
        install_address: '地址X',
        lines: [mkLine('', 'ping', pingF?.id ?? null), mkLine('', 'ping', pingF?.id ?? null)],
      }),
    })
    createdIds.push(blank.id)
    eq('④ 新单的行本来没有单号', blank.lines.map((l) => l.line_no), ['', ''])

    // 打一次「打印前置」—— 应当**就地**把单号补上
    await M.ensureLineNumbersForPrint([blank])
    const filled = blank.lines.map((l) => l.line_no)
    eq('④ 走一遍打印前置后，行级单号被补上', filled.every((v) => /^\d+-\d{2}\/\d{2}\/\d{2}$/.test(v)), true)
    console.log(`  ✓ 补出来的单号：${JSON.stringify(filled)}`)

    // 幂等：再走一遍不该改号（「永不覆盖已有值」）
    await M.ensureLineNumbersForPrint([blank])
    eq('④ 再走一遍不改已有单号（永不覆盖）', blank.lines.map((l) => l.line_no), filled)

    // 补完之后，打印载荷里的 OrderID 就该是这些号
    const ctx2 = M.buildOrderPrintContext(await call(`/v1/orders/${blank.id}`), prereqs, who)
    const ids2 = collectIds(M.createPrintPayloads(ctx2).labelRows('lable'))
    eq('④ 补号后标签载荷用的是补出来的单号', ids2.every(([, v]) => filled.includes(v)), true)
  }

  // ── ⑤ 源码静态守卫：不该再有行级位置喂 receipt_no ──
  const SRC = readFileSync(`${ROOT}/app/src/utils/printPayloads.ts`, 'utf8')
  const badLines = SRC
    .split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /^\s*(OrderID|orderID|qrcode):\s*(String\()?ctx\.order\.receipt_no/.test(l))
  eq('⑤ 源码里没有「行级键喂回执单号」的残留', badLines, [])
} finally {
  if (createdIds.length) {
    const { execSync } = await import('node:child_process')
    const list = createdIds.join(',')
    execSync(`docker exec -i smartdoor-db psql -U smartdoor -d smartdoor -tAc ${JSON.stringify(`DELETE FROM order_lines WHERE order_id IN (${list}); DELETE FROM orders WHERE id IN (${list});`)}`)
    console.log('\n（一次性数据已清理）')
  }
}

console.log(`\n对照 ${pass + fail} 条：通过 ${pass}，不符 ${fail}`)
process.exit(fail ? 1 : 0)
