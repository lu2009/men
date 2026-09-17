// 打印选项抽屉里**每个入口按钮** → 它的 handler → 该 handler 设的 ic 值。
// 用来把「入口数」与「单据数」分开：旧版入口比单据多，多个入口共用一张单据、只换数据过滤。
import { readFileSync } from 'node:fs'

const ROOT = '/Users/aaa/Desktop/door-main'
const s = readFileSync(`${ROOT}/legacy/js/Home-d6b13b9a.js`, 'utf8')
const map = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
const dr = map.decoders.dr

/** 按钮块：createVNode(w,{...,onClick:XXX},{...createTextVNode(s(NNN))...}) */
const buttons = []
for (const m of s.matchAll(/onClick:([A-Za-z_$][\w$]*)\s*\},\s*\{default:Vue\.withCtx\(\(\(\)=>t\[(\d+)\]\|\|\(t\[\d+\]=\[Vue\.createTextVNode\(\s*([A-Za-z_$][\w$]*)\((\d+)\)/g)) {
  buttons.push({ handler: m[1], call: `${m[3]}(${m[4]})`, label: dr[m[4]] ?? `??? (${m[4]})` })
}

/** handler 函数体里设的 ic 值。 */
function icOf(handler) {
  const re = new RegExp(`[,;}]\\s*${handler}\\s*=\\s*(async\\s*)?\\(`, 'g')
  const m = re.exec(s)
  if (!m) return null
  const body = s.slice(m.index, m.index + 1200)
  const hit = /ic(?:\[[^\]]+\]|\.value)?\s*=\s*(\d+)/.exec(body)
  return hit ? Number(hit[1]) : null
}

/** handler 里调的数据方法（看它跟别的入口差在哪）。 */
function dataCall(handler) {
  const re = new RegExp(`[,;}]\\s*${handler}\\s*=\\s*(async\\s*)?\\(`, 'g')
  const m = re.exec(s)
  if (!m) return ''
  const body = s.slice(m.index, m.index + 1200)
  const hit = /await\s+[\w$]+(?:\[[^\]]+\]|\.value)?\.(lable|calculateReceiptOld|calculateReceipt|[a-zA-Z_$][\w$]*)\s*\(([^)]{0,60})\)/.exec(body)
  return hit ? `${hit[1]}(${hit[2]})` : ''
}

console.log('抽屉入口 → ic 映射\n')
console.log('ic  按钮文案'.padEnd(28) + 'handler'.padEnd(12) + '数据来源')
console.log('-'.repeat(86))
const rows = buttons.map((b) => ({ ...b, ic: icOf(b.handler), data: dataCall(b.handler) }))
rows.sort((a, b) => (a.ic ?? 99) - (b.ic ?? 99))
for (const r of rows) {
  console.log(`${String(r.ic ?? '?').padEnd(4)}${String(r.label).trim().padEnd(24)}${r.handler.padEnd(12)}${r.data}`)
}
const byIc = new Map()
for (const r of rows) byIc.set(r.ic, (byIc.get(r.ic) ?? 0) + 1)
console.log(`\n入口共 ${rows.length} 个，分布在 ic = ${[...byIc.keys()].sort((a, b) => a - b).join(', ')}`)
