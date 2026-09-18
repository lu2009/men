// 端到端：真实订单 → oldSheetProduces(paired) → 自定义生产单 HTML。
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const ROOT = '/Users/aaa/Desktop/door-main'
const req = createRequire(`${ROOT}/app/`)
const { build } = req(`${ROOT}/app/node_modules/esbuild`)
const API = 'http://127.0.0.1:3000/api'
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
globalThis.DOMParser = class {
  parseFromString(t) { const o = /<svg([^>]*)>/.exec(t); const a = o ? o[1] : ''
    const inner = o ? t.slice(o.index + o[0].length).replace(/<\/svg>\s*$/, '') : ''
    return { documentElement: { getAttribute: (n) => (new RegExp(n + '="([^"]*)"').exec(a) || [])[1] ?? null, innerHTML: inner } } }
}
const out = `${ROOT}/app/node_modules/.cache/ps-e2e.mjs`
await build({ entryPoints: ['/tmp/ps-verify/entry.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'warning', define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: API }) } })
const m = await import(out)

const login = await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }) })).json()
const H = { authorization: `Bearer ${login?.data?.token || login?.token}` }
const get = async (p) => { const r = await fetch(`${API}${p}`, { headers: H }); const j = await r.json(); return j?.data ?? j }

const list = await get('/v1/orders?page=1&page_size=10')
const orders = list?.items ?? list ?? []
const full = []
for (const o of orders) { const f = o.lines?.length ? o : await get(`/v1/orders/${o.id}`); if ((f.lines?.length ?? 0) > 0) full.push(f); if (full.length >= 4) break }

const [formulas, clients] = await Promise.all([get('/v1/formulas'), get('/v1/clients')])
const prereqs = { formulas, clients, payQrcode: '', formulaImages: {} }
const who = { tenantName: login?.data?.tenant?.name || '', maker: login?.data?.user?.name || '' }

const rows = []
for (const o of full) {
  const ctx = m.buildOrderPrintContext(o, prereqs, who)
  const p = m.createPrintPayloads(ctx)
  const one = p.oldSheetProduces(false)
  const two = p.oldSheetProduces(true)
  console.log(`订单 ${o.receipt_no}  ${o.client_name}  明细 ${o.lines.length} 行 → 不配对 ${one.length} 行 / 配对 ${two.length} 行`)
  rows.push(...one)
}
console.log(`\n=== 合计 ${rows.length} 行；键集 ===`)
console.log(' ', Object.keys(rows[0] || {}).join(', '))
const r0 = rows[0] || {}
console.log(`  [0] material=${JSON.stringify(r0.material)}  orderID=${JSON.stringify(r0.orderID)}  size=${JSON.stringify(r0.size)}`)
console.log(`      oldSheet[0]=${JSON.stringify((r0.oldSheet || [])[0])}`)

const cfg = m.createDefaultConfig()
const opts = { qrSvg: m.createQrSvgProvider() }
const html = await m.buildProductionSheetHtml(rows, cfg, opts)
writeFileSync('/tmp/ps-verify/out.html', html)
console.log(`\n=== 渲染 ${html.length} 字符 ===`)
console.log('  含 ps-root:', /class="ps-root"/.test(html), ' ps-sheet:', (html.match(/class="ps-sheet"/g) || []).length, '个')
console.log('  含 <table>:', /<table/.test(html), ' 二维码:', (html.match(/<svg/g) || []).length, '个')
