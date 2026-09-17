// 端到端：真实订单 → 收据单2 数据模型 → HTML。
//
// 不走浏览器（分页要 DOM，本环境没有 jsdom），验的是**数据管线**：
// 登录 → 取订单/公式/客户 → 装配 PrintContext → buildReceipt2Order → renderPage。
// 重点看两件事：① 字段有没有错位 ② 中文键 `安装地址` 与派生的 `address` 是否如预期不同。
import { createRequire } from 'node:module'

// Node 里没有 localStorage —— 打印上下文的 sortMethod 会读它。给个空桩。
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }

const ROOT = '/Users/aaa/Desktop/door-main'
const req = createRequire(`${ROOT}/app/`)
const { build } = req(`${ROOT}/app/node_modules/esbuild`)
const API = 'http://127.0.0.1:3000/api'

const out = `${ROOT}/app/node_modules/.cache/r2-e2e.mjs`
await build({
  entryPoints: ['/tmp/r2-verify/e2e-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: out,
  logLevel: 'warning',
  define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: API }) },
})
const mod = await import(out)

// —— 登录 ——
const login = await (await fetch(`${API}/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }),
})).json()
const token = login?.data?.token || login?.token
if (!token) {
  console.error('登录失败：', JSON.stringify(login).slice(0, 300))
  process.exit(1)
}
const H = { authorization: `Bearer ${token}` }
const get = async (p) => {
  const r = await fetch(`${API}${p}`, { headers: H })
  if (!r.ok) throw new Error(`${p} → ${r.status}`)
  const j = await r.json()
  return j?.data ?? j
}

const list = await get('/v1/orders?page=1&page_size=10')
const orders = list?.items ?? list ?? []
if (!orders.length) {
  console.error('没有订单可测')
  process.exit(1)
}
const target = orders.find((o) => (o.lines?.length ?? 0) > 0) || orders[0]
const full = target.lines?.length ? target : await get(`/v1/orders/${target.id}`)

const [formulas, clients] = await Promise.all([get('/v1/formulas'), get('/v1/clients')])
const prereqs = { formulas, clients, payQrcode: '', formulaImages: {} }
const who = { tenantName: login?.data?.tenant?.name || '', maker: login?.data?.user?.name || '' }

const ctx = mod.buildOrderPrintContext(full, prereqs, who)
const r2 = mod.buildReceipt2Order(ctx)
const printData = mod.receiptPrintDataOf(ctx)

const show = (o, keys, title) => {
  console.log(`\n=== ${title} ===`)
  for (const k of keys) console.log(`  ${String(k).padEnd(16)} ${JSON.stringify(o[k])}`)
}

console.log(`订单：${full.receipt_no}  ${full.client_name}  明细 ${full.lines?.length ?? 0} 行`)
show(r2, ['orderNo', 'date', 'client', 'tel', '安装地址', 'productionDays', 'brand', 'total', 'deposit', 'balance', 'declaration', 'payQrcode'], '收据单2 订单头')

console.log('\n=== 关键对照（这两个**必须不同**）===')
console.log(`  收据单2 读的  安装地址 = ${JSON.stringify(r2['安装地址'])}`)
console.log(`  打印回执的    address  = ${JSON.stringify(printData.address)}`)
console.log(
  r2['安装地址'] === undefined ? '  ✗ 安装地址 缺失！' : '  ✓ 中文键存在',
)

console.log(`\n=== 明细 ${r2.receipt.length} 行 ===`)
for (const [i, l] of r2.receipt.entries()) {
  console.log(`  [${i}] 型材=${JSON.stringify(l.profile)}`)
  console.log(`      开向=${JSON.stringify(l.direction)} 颜色=${JSON.stringify(l.color)}`)
  console.log(`      玻璃=${JSON.stringify(l.glass)}`)
  console.log(`      尺寸=${JSON.stringify(l.size)} 数量=${JSON.stringify(l.quantity)} 单价=${JSON.stringify(l.price)} 金额=${JSON.stringify(l.amount)}`)
  console.log(`      计价=${JSON.stringify(l.pricing)}`)
  console.log(`      备注=${JSON.stringify(l.remark)}`)
}

// 渲染第一页（不经过分页，直接单页）—— 验证 HTML 能被真正产出
const html = mod.renderPage(
  r2,
  r2.receipt,
  true,
  { visibility: mod.DEFAULT_VISIBILITY, elementConfigs: mod.defaultElementConfigs(), brand: mod.DEFAULT_BRAND },
)
console.log(`\n=== 渲染出 HTML ${html.length} 字符 ===`)
console.log(html.slice(0, 420).replace(/\n/g, '\\n'))
