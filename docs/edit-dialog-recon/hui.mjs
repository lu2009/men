import { readFileSync } from 'node:fs'
const FILE = '/Users/aaa/Desktop/door-main/legacy/js/Hui.formatted.js'
const A = Number(process.argv[2]) // 起始行
const B = Number(process.argv[3]) // 结束行
const D = process.argv[4] // 解码器名（_0xXXXX 或别名）
const s = readFileSync(FILE, 'utf8')
const map = JSON.parse(readFileSync('/tmp/hui-map.json', 'utf8'))
const real = map.aliases[D] || D
const tbl = map.decoders[real]
if (!tbl) { console.error('未知解码器', D, real); process.exit(1) }
const lines = s.split('\n')
const seg = lines.slice(A - 1, B).join('\n')
const out = seg.replace(/([A-Za-z_$][\w$]*)\("?(\d+)"?\)/g, (m, id, n) => {
  const v = tbl[n]
  return v === undefined ? m : '【' + v + '】'
})
console.log('=== 行 ' + A + '-' + B + ' dec=' + D + '→' + real + ' ===')
console.log(out)
