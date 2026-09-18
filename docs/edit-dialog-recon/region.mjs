import { readFileSync } from 'node:fs'
const FILE = process.argv[2] || 'legacy/js/Home-d6b13b9a.js'
const A = Number(process.argv[3])
const B = Number(process.argv[4])
const DEC = process.argv[5] || 's'
const s = readFileSync(FILE, 'utf8')
const map = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
// 找出该 decoder 别名指向哪张表（Home 自表）
const aliases = map.aliases
const FORCE = { s: 'dr', $n: 'dr', t: 'wl', o: 'To', d: 'Ml', l: 'Jo', n: 'Ca' }
let table = FORCE[DEC] || DEC
if (aliases[DEC]) table = aliases[DEC]
const tbl = map.decoders[table]
if (!tbl) { console.error('未知表', DEC, '→', table, '可用:', Object.keys(map.decoders)); process.exit(1) }
const seg = s.slice(A, B)
const out = seg.replace(new RegExp('\\b' + DEC + '\\((\\d+)\\)', 'g'), (m, n) => {
  const v = tbl[n]
  return v === undefined ? m : '【' + v + '】'
})
console.log('=== 区域 ' + A + '-' + B + '  decoder=' + DEC + '(表 ' + table + ') ===')
console.log(out)
