import { readFileSync } from 'node:fs'
const FILE = process.argv[2] || 'legacy/js/Home-d6b13b9a.js'
const A = Number(process.argv[3])
const B = Number(process.argv[4])
const s = readFileSync(FILE, 'utf8')
const map = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
const tbl = map.decoders.dr
const seg = s.slice(A, B)
const out = seg.replace(/([A-Za-z_$][A-Za-z0-9_$]*)\(\s*(\d+)\s*\)/g, (m, id, n) => {
  const v = tbl[n]
  if (v === undefined) return m
  return '【' + v + '】'
})
console.log('=== ' + A + '-' + B + ' (dr 表) ===')
console.log(out)
