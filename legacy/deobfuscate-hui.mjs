// 反混淆 legacy/js/Hui-d088417c.js → legacy/js/Hui.formatted.js
//
// 为什么重做：原先那份 `Hui.formatted.js` 是用 `legacy/hui-stringmaps.json` 生成的，
// 而那份表**只做了 base64 解码、没做数组旋转**（javascript-obfuscator 的旋转块），
// 值几乎全错位 —— 抽查 35609 条里 35573 条对不上，55 个可比对解码器里 48 个**全错**。
// 典型：`_0x46841d(961)` 正确是 `formulaID`，错表给的是 `业务员:`；
// `_0x250a(566)` 正确是 `includes`，错表给的是 `折叠5扇`。
// 照着错表读逻辑会读出**看着像那么回事、其实完全错**的代码（如 `部件表["挖孔图"]["业务员:"]+开向`）。
//
// 本脚本用与 `decode-stringmap.mjs` 相同的旋转求解重做，产出**正确**的 `Hui.formatted.js`。
//
// ⚠️ 行号刻意保持不变（美化算法、头部行数、结尾 `export{}` 的裁剪都与旧版一致），
// 所以 docs/ 里 `Hui.formatted.js:9467` 这类引用仍然有效；
// docs 里大量的 `@NNNNN` 是**字符偏移**（对着本文件数），因替换后的串长度变了，偏移会漂移几个字符，
// 引用时以邻近的 `@` 值定位、再用 `indexOf` 精确定位即可。
//
// 用法：node legacy/deobfuscate-hui.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'legacy/js/Hui-d088417c.js'
const OUT = 'legacy/js/Hui.formatted.js'
let s = readFileSync(SRC, 'utf8')

// ---------- 1. 数组构造器 ----------
const builders = new Map()
for (const m of s.matchAll(/function (_0x[0-9a-f]+)\(\)\{const e=(\[[\s\S]*?\]);return\((_0x[0-9a-f]+)=function\(\)\{return e\}\)\(\)\}/g)) {
  builders.set(m[1], JSON.parse(m[2]))
}

// ---------- 2. 解码器 ----------
const decoders = new Map()
for (const m of s.matchAll(/function (_0x[0-9a-f]+)\(e,t\)\{const a=(_0x[0-9a-f]+)\(\);return _0x[0-9a-f]+=function\(t,x\)\{let _=a\[t-=(\d+)\];/g)) {
  decoders.set(m[1], { builder: m[2], offset: Number(m[3]) })
}

// ---------- 3. 旋转块（文档序） ----------
const rotations = []
for (const m of s.matchAll(/const a=(_0x[0-9a-f]+),x=(_0x[0-9a-f]+)\(\);for\(;;\)try\{if\(([\s\S]*?)\)break;x\.push\(x\.shift\(\)\)\}catch\(_\)\{x\.push\(x\.shift\(\)\)\}\}/g)) {
  rotations.push({ decoder: m[1], cond: m[3] })
}

// ---------- 4. base64（自定义字母表） ----------
const B64 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/='
function b64decode(e) {
  let t = '', a = ''
  for (let x, _, l = 0, o = 0; (_ = e.charAt(o++)); ~_ && (x = l % 4 ? 64 * x + _ : _, l++ % 4) ? t += String.fromCharCode(255 & x >> (-2 * l & 6)) : 0) _ = B64.indexOf(_)
  for (let x = 0, n = t.length; x < n; x++) a += '%' + ('00' + t.charCodeAt(x).toString(16)).slice(-2)
  return decodeURIComponent(a)
}

// 旋转状态按**数组**记（多解码器共用数组时会叠加）
const shift = new Map([...builders.keys()].map((k) => [k, 0]))
function valueAt(decName, idx) {
  const d = decoders.get(decName)
  const arr = builders.get(d.builder)
  const k = shift.get(d.builder)
  return b64decode(arr[((idx - d.offset + k) % arr.length + arr.length) % arr.length])
}
for (const r of rotations) {
  if (!decoders.has(r.decoder)) continue
  const builder = decoders.get(r.decoder).builder
  const arr = builders.get(builder)
  const start = shift.get(builder)
  const cond = r.cond.replace(/\ba\((\d+)\)/g, (_, n) => `parseInt(valueAt(${JSON.stringify(r.decoder)}, ${n}))`)
  let solved = false
  for (let k = start; k < start + arr.length; k++) {
    shift.set(builder, k)
    let ok = false
    try { ok = !!eval(cond) } catch { ok = false }
    if (ok) { solved = true; break }
  }
  if (!solved) console.error('未解出旋转:', r.decoder)
}

// ---------- 5. 别名（可链式） ----------
const raw = new Map()
for (const m of s.matchAll(/(?:const |,)(_0x[0-9a-f]+)=(_0x[0-9a-f]+)[,;]/g)) raw.set(m[1], m[2])
const aliases = {}
for (const a of raw.keys()) {
  let n = a
  const seen = new Set()
  while (!decoders.has(n) && raw.has(n) && !seen.has(n)) { seen.add(n); n = raw.get(n) }
  if (decoders.has(n)) aliases[a] = n
}
const resolve = (name) => (decoders.has(name) ? name : aliases[name])
function call(name, idx) {
  const d = resolve(name)
  if (!d) return null
  try { return valueAt(d, idx) } catch { return null }
}

// ---------- 6. 替换 ----------
// 只替换**具名解码器**与具名别名（`_0xHEX(N)`）；组件内的单字母解码器（`a(207)`/`t(523)`）
// 作用域局部、不在别名表里，一并留给读者对照原始 chunk。与旧版口径一致。
let hits = 0
s = s.replace(/_0x([0-9a-f]+)\((\d+)\)|\b([A-Za-z_$][A-Za-z0-9_$]*)\((\d+)\)/g, (m, hex, n1, name, n2) => {
  const v = call(hex !== undefined ? `_0x${hex}` : name, parseInt(hex !== undefined ? n1 : n2, 10))
  if (v === null) return m
  hits++
  return JSON.stringify(v)
})

// ---------- 7. 裁掉结尾的 export{}（与旧版一致，保证行号不变） ----------
s = s.replace(/export\{[^}]*\};?\s*$/, '')

// ---------- 8. 美化（与 legacy/deobfuscate-diao.js 同一算法） ----------
function pretty(src) {
  let res = ''
  let i = 0
  let indent = 0
  let quote = null
  let lineStart = true
  const pushIndent = () => { if (lineStart) { res += '  '.repeat(indent); lineStart = false } }
  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1]
    if (quote) {
      res += ch
      if (ch === '\\') { res += next; i += 2; continue }
      if (ch === quote) quote = null
      i++
      continue
    }
    if (ch === '/' && next === '/') { while (i < src.length && src[i] !== '\n') { res += src[i++]; lineStart = false } continue }
    if (ch === '/' && next === '*') { res += '/*'; i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) res += src[i++]; res += '*/'; i += 2; continue }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; pushIndent(); res += ch; i++; continue }
    if (ch === '{') { pushIndent(); res += '{\n'; indent++; lineStart = true }
    else if (ch === '}') {
      indent = Math.max(0, indent - 1)
      if (!lineStart) res += '\n'
      res += '  '.repeat(indent) + '}'
      lineStart = false
      if (next === ';' || next === ',' || next === ')') { res += next; i += 2; continue }
      res += '\n'; lineStart = true
    } else if (ch === ';') { res += ';\n'; lineStart = true }
    else { pushIndent(); res += ch }
    i++
  }
  return res
}

// 头部恒为 3 行（2 行注释 + 空行）—— 与旧版一致，行号才不漂
const header = `// Hui.formatted.js —— 由 legacy/deobfuscate-hui.mjs 自动生成（勿手工编辑）。\n// 已替换所有本地解码器 _0xHEX(N)；组件内单字母解码器 a()/t()/x() 未处理。\n\n`
writeFileSync(OUT, header + pretty(s))
console.error(`已写出 ${OUT}（替换 ${hits} 个 token）`)
