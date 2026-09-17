// 端到端：真实订单 → glassProduces() → 玻璃合片单 HTML。
import { writeFileSync } from "node:fs"

//
// 不走浏览器（分页要真 DOM 量行高），验的是**数据管线与 HTML 构造**：
// 登录 → 取订单/公式/客户 → 装配 PrintContext → glassProduces → buildGlassSheet2Html。
import { createRequire } from 'node:module'

const ROOT = '/Users/aaa/Desktop/door-main'
const req = createRequire(`${ROOT}/app/`)
const { build } = req(`${ROOT}/app/node_modules/esbuild`)
const API = 'http://127.0.0.1:3000/api'


// Node 没有 DOMParser —— 给个最小桩，让 qr.ts 的 svgToParts 走得通（浏览器里本来就有）。
globalThis.DOMParser = class {
  parseFromString(text) {
    const open = /<svg([^>]*)>/.exec(text)
    const attrs = open ? open[1] : ''
    const inner = open ? text.slice(open.index + open[0].length).replace(/<\/svg>\s*$/, '') : ''
    return { documentElement: { getAttribute: (n) => (new RegExp(n + '="([^"]*)"').exec(attrs) || [])[1] ?? null, innerHTML: inner } }
  }
}

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }

const out = `${ROOT}/app/node_modules/.cache/gs2-e2e.mjs`
await build({
  entryPoints: ['/tmp/gs2-verify/entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: out,
  logLevel: 'warning',
  define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: API }) },
})
const mod = await import(out)

const login = await (
  await fetch(`${API}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }),
  })
).json()
const token = login?.data?.token || login?.token
if (!token) {
  console.error('登录失败')
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
const withLines = []
for (const o of orders) {
  const full = o.lines?.length ? o : await get(`/v1/orders/${o.id}`)
  if ((full.lines?.length ?? 0) > 0) withLines.push(full)
  if (withLines.length >= 2) break
}
if (!withLines.length) {
  console.error('没有带明细的订单可测')
  process.exit(1)
}

const [formulas, clients] = await Promise.all([get('/v1/formulas'), get('/v1/clients')])
const prereqs = { formulas, clients, payQrcode: '', formulaImages: {} }
const who = { tenantName: login?.data?.tenant?.name || '', maker: login?.data?.user?.name || '' }

const rows = []
for (const o of withLines) {
  const ctx = mod.buildOrderPrintContext(o, prereqs, who)
  const produced = mod.createPrintPayloads(ctx).glassProduces()
  console.log(`订单 ${o.receipt_no}  ${o.client_name}  明细 ${o.lines.length} 行 → glassProduces 产出 ${produced.length} 行`)
  rows.push(...produced)
}

console.log(`\n=== 合计 ${rows.length} 行 ===`)
for (const [i, r] of rows.entries()) {
  console.log(`  [${i}] 客户=${JSON.stringify(r.client)} 单号=${JSON.stringify(r.OrderID)}`)
  console.log(`      型材/颜色=${JSON.stringify(r.door)}`)
  console.log(`      玻璃尺寸=${JSON.stringify(r.doorsheet)}`)
  console.log(`      门图=${r.doorImg ? '（有）' : '（无）'}  锁图=${r.lockImg ? '（有）' : '（无）'}`)
  console.log(`      备注=${JSON.stringify(r.remark)}`)
}

// 渲染（分页要 DOM，用单页兜底路径）
const cfg = mod.createDefaultConfig()
const renderOpts = { qr: mod.createQrSvgProvider(mod.createQrEncoder()) }
const html = await mod.buildGlassSheet2Html(rows, cfg, renderOpts)
const doc = mod.buildDocumentHtml(html)
console.log(`\n=== 渲染产出 ===`)
console.log(`  根容器 ${html.length} 字符；完整文档 ${doc.length} 字符`)
console.log(`  文档头: ${doc.slice(0, 120)}`)
console.log(`  根容器头: ${html.slice(0, 160)}`)
writeFileSync("/tmp/gs2-verify/out.html", doc);
console.log("  已写出 /tmp/gs2-verify/out.html")
