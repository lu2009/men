// 端到端：真实订单 → productionProduces() → 自定义生产单2 HTML。
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const ROOT = '/Users/aaa/Desktop/door-main'
const req = createRequire(`${ROOT}/app/`)
const { build } = req(`${ROOT}/app/node_modules/esbuild`)
const API = 'http://127.0.0.1:3000/api'

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
globalThis.DOMParser = class {
  parseFromString(text) {
    const open = /<svg([^>]*)>/.exec(text)
    const attrs = open ? open[1] : ''
    const inner = open ? text.slice(open.index + open[0].length).replace(/<\/svg>\s*$/, '') : ''
    return { documentElement: { getAttribute: (n) => (new RegExp(n + '="([^"]*)"').exec(attrs) || [])[1] ?? null, innerHTML: inner } }
  }
}

const out = `${ROOT}/app/node_modules/.cache/ps2-e2e.mjs`
await build({ entryPoints: ['/tmp/ps2-verify-entry.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'warning', define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: API }) } })
const m = await import(out)

const login = await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }) })).json()
const token = login?.data?.token || login?.token
const H = { authorization: `Bearer ${token}` }
const get = async (p) => { const r = await fetch(`${API}${p}`, { headers: H }); const j = await r.json(); return j?.data ?? j }

const list = await get('/v1/orders?page=1&page_size=10')
const orders = list?.items ?? list ?? []
const full = []
for (const o of orders) { const f = o.lines?.length ? o : await get(`/v1/orders/${o.id}`); if ((f.lines?.length ?? 0) > 0) full.push(f); if (full.length >= 2) break }

const [formulas, clients] = await Promise.all([get('/v1/formulas'), get('/v1/clients')])
const prereqs = { formulas, clients, payQrcode: '', formulaImages: {} }
const who = { tenantName: login?.data?.tenant?.name || '', maker: login?.data?.user?.name || '' }

const rows = []
for (const o of full) {
  const ctx = m.buildOrderPrintContext(o, prereqs, who)
  const produced = m.createPrintPayloads(ctx).productionProduces()
  console.log(`订单 ${o.receipt_no}  ${o.client_name}  明细 ${o.lines.length} 行 → productionProduces 产出 ${produced.length} 行`)
  rows.push(...produced)
}

console.log(`\n=== 合计 ${rows.length} 行；键集 ===`)
console.log(' ', Object.keys(rows[0] || {}).join(', '))
for (const [i, r] of rows.entries()) {
  console.log(`  [${i}] door=${JSON.stringify(r.door)}`)
  console.log(`      basicInfo=${JSON.stringify(r.basicInfo)}`)
  console.log(`      doorframe=${JSON.stringify(r.doorframe)}   ← PS2 新增列`)
  console.log(`      windows=${JSON.stringify(r.windows)}     ← PS2 新增列`)
  console.log(`      doorsheet=${JSON.stringify(r.doorsheet)}`)
}

const cfg = m.createDefaultConfig()
const opts = { qr: m.createQrSvgProvider(m.createQrEncoder()) }
const html = await m.buildProductionSheet2Html(rows, cfg, opts)
writeFileSync('/tmp/ps2-verify/out.html', html)
console.log(`\n=== 渲染 ${html.length} 字符 ===`)
console.log('  含 <table>:', /<table/.test(html), ' 含二维码:', (html.match(/<svg/g) || []).length, '个')
console.log('  空段占位 <div class="ps2-line">&nbsp;</div>:', (html.match(/<div class="ps2-line">&nbsp;<\/div>/g) || []).length, '处')
