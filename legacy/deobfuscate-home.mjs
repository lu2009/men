// 反混淆 legacy/js/Home-d6b13b9a.js → legacy/js/Home.formatted.js
// 只替换 Home 自带的多字符解码器/别名（dr/$n/wl/Ml/To/Jo/Ca/Ha/Vn/bn/Wn + Tt/pl/Pl/_o/pa/Ga/dn/Bn/Yn），
// 单字符名（l/o/t/e/s/a/d/n/u/r/i/c 及局部别名 g/Ye/B/m/V/E）因作用域遮蔽，一律不替换，
// 留给读者对照 /tmp/home-map.json（Home 自表）+ /tmp/hui-map.json（Hui 导入表）查。
import { readFileSync, writeFileSync } from 'node:fs'
const SRC = 'legacy/js/Home-d6b13b9a.js'
const OUT = 'legacy/js/Home.formatted.js'
let s = readFileSync(SRC, 'utf8')
const { decoders, aliases } = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
const resolve = (name) => (decoders[name] ? name : aliases[name])
function call(name, idx) {
  const d = resolve(name)
  if (!d) return null
  const v = decoders[d][idx]
  return v === undefined || v === null ? null : v
}
let hits = 0
s = s.replace(/([A-Za-z_$][A-Za-z0-9_$]*)\((\d+)\)/g, (m, name, n) => {
  const v = call(name, parseInt(n, 10))
  if (v === null) return m
  hits++
  return JSON.stringify(v)
})

// pretty（照抄 deobfuscate-hui.mjs）
function pretty(src) {
  let res = '', i = 0, indent = 0, quote = null, lineStart = true
  const pushIndent = () => { if (lineStart) { res += '  '.repeat(indent); lineStart = false } }
  while (i < src.length) {
    const ch = src[i], next = src[i + 1]
    if (quote) { res += ch; if (ch === '\\') { res += next; i += 2; continue } if (ch === quote) quote = null; i++; continue }
    if (ch === '/' && next === '/') { while (i < src.length && src[i] !== '\n') { res += src[i++]; lineStart = false } continue }
    if (ch === '/' && next === '*') { res += '/*'; i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) res += src[i++]; res += '*/'; i += 2; continue }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; pushIndent(); res += ch; i++; continue }
    if (ch === '{') { pushIndent(); res += '{\n'; indent++; lineStart = true }
    else if (ch === '}') { indent = Math.max(0, indent - 1); if (!lineStart) res += '\n'; res += '  '.repeat(indent) + '}'; lineStart = false; if (next === ';' || next === ',' || next === ')') { res += next; i += 2; continue } res += '\n'; lineStart = true }
    else if (ch === ';') { res += ';\n'; lineStart = true }
    else { pushIndent(); res += ch }
    i++
  }
  return res
}
const header = `// Home.formatted.js —— 由 legacy/deobfuscate-home.mjs 自动生成（勿手工编辑）。\n// 已替换 Home 自带多字符解码器/别名；单字符名与局部别名未处理。\n// 解码参考：/tmp/home-map.json（Home 自表）、/tmp/hui-map.json（Hui 导入表）。\n\n`
writeFileSync(OUT, header + pretty(s))
console.error(`已写出 ${OUT}（替换 ${hits} 个 token）`)
