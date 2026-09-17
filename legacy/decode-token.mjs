// 查单个混淆 token 的值。用法：
//   node legacy/decode-token.mjs dr 858          # Home 自带表（dr/$n/wl/Ml/To/Jo/Ca/Ha/Vn/bn/Wn）
//   node legacy/decode-token.mjs l 664           # Home 从 Hui 导入的解码器（l/o/a/n/u/r/i/c）
// Home→Hui 导入名映射：l=_0x148cac o=_0xf4057 a=_0x306d52 n=_0x34f592 u=_0x3db7e7 r=_0x33f65a i=_0xb261ee c=_0x475eaa
import { readFileSync } from 'node:fs'
const home = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
const hui = JSON.parse(readFileSync('/tmp/hui-map.json', 'utf8'))
const IMPORT = { l: '_0x148cac', o: '_0xf4057', a: '_0x306d52', n: '_0x34f592', u: '_0x3db7e7', r: '_0x33f65a', i: '_0xb261ee', c: '_0x475eaa' }
const name = process.argv[2], idx = process.argv[3]
if (!name || idx === undefined) { console.error('用法: node legacy/decode-token.mjs <name> <idx>'); process.exit(1) }
const resolve = (map, n) => (map.decoders[n] ? n : map.aliases[n])
function lookup(map, n, i) {
  const d = resolve(map, n)
  if (!d) return null
  const v = map.decoders[d][i]
  return v === undefined ? null : v
}
let v = lookup(home, name, idx)
if (v === null && IMPORT[name]) v = lookup(hui, IMPORT[name], idx)
if (v === null) { console.error(`未解析 ${name}(${idx})`); process.exit(1) }
console.log(`${name}(${idx}) = ${JSON.stringify(v)}`)
