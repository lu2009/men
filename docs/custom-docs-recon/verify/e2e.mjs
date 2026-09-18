// 端到端：真实订单 → labelRows('lable') → 合格标签 HTML；并验三个入口的行过滤。
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
const out = `${ROOT}/app/node_modules/.cache/ql-e2e.mjs`
await build({ entryPoints: ['/tmp/ql-verify/entry.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'warning', define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE_URL: API }) } })
const m = await import(out)

const login = await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }) })).json()
const H = { authorization: `Bearer ${login?.data?.token || login?.token}` }
const get = async (p) => { const r = await fetch(`${API}${p}`, { headers: H }); const j = await r.json(); return j?.data ?? j }

const list = await get('/v1/orders?page=1&page_size=10')
const orders = list?.items ?? list ?? []
const full = []
for (const o of orders) { const f = o.lines?.length ? o : await get(`/v1/orders/${o.id}`); if ((f.lines?.length ?? 0) > 0) full.push(f); if (full.length >= 3) break }

const [formulas, clients] = await Promise.all([get('/v1/formulas'), get('/v1/clients')])
const prereqs = { formulas, clients, payQrcode: '', formulaImages: {} }
const who = { tenantName: login?.data?.tenant?.name || '', maker: login?.data?.user?.name || '' }

const pingLines = full.flatMap(o => o.lines).filter(l => l.line_type === 'ping').length
const diaoLines = full.flatMap(o => o.lines).filter(l => l.line_type === 'diao').length
console.log(`订单 ${full.length} 张，明细合计 ${full.flatMap(o=>o.lines).length} 行（ping ${pingLines} / diao ${diaoLines}）`)

function rowsFor(entry) {
  const rows = []
  for (const o of full) {
    const ctx = m.buildOrderPrintContext(o, prereqs, who)
    const scoped = entry === 'all' ? ctx : { ...ctx, lines: ctx.lines.filter(l => l.line_type === entry) }
    rows.push(...m.createPrintPayloads(scoped).labelRows('lable'))
  }
  return rows
}

for (const entry of ['all', 'ping', 'diao']) {
  const rows = rowsFor(entry)
  const keys = rows.length ? Object.keys(rows[0]) : []
  console.log(`\n=== entry=${entry} → ${rows.length} 张标签 ===`)
  if (entry === 'all') console.log('  键集:', keys.join(', '))
  const r0 = rows[0] || {}
  console.log(`  [0] orderID=${JSON.stringify(r0.orderID)} package=${JSON.stringify(r0.package)}`)
  console.log(`      door=${JSON.stringify(r0.door)}  size=${JSON.stringify(r0.size)}`)
  console.log(`      lockway=${JSON.stringify(r0.lockway)}`)
  console.log(`      remark=${JSON.stringify(r0.remark)}`)
  const html = m.buildQualifiedLabelHtml(rows, m.createDefaultConfig(), { qr: m.createQualifiedLabelQrProvider() })
  writeFileSync(`/tmp/ql-verify/out-${entry}.html`, html)
  console.log(`      渲染 ${html.length} 字符；qlabel ${(html.match(/class="qlabel"/g)||[]).length} 个；二维码 ${(html.match(/<svg/g)||[]).length} 个`)
}
