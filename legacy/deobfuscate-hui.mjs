// 反混淆 legacy/js/Hui-d088417c.js：用**正确**的字符串表（decode-stringmap 的算法）
// 把 `_0x5c0d14(995)` / 短别名 `t(523)` 换回字符串，输出可读文件。
//
// 为什么需要：仓库里的 `legacy/hui-stringmaps.json` 是错的（数组未旋转、值全错位），
// 据此生成的 `Hui.formatted.js` 里字符串全是乱的（同一个 token 会解成 "无"/"左"/"右" 等），
// 逐字核对原版语义会读出错的东西。本脚本用与 `decode-stringmap.mjs` 相同的旋转求解重做一遍。
//
// 用法：node legacy/deobfuscate-hui.mjs [输出路径]
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'legacy/js/Hui-d088417c.js'
const OUT = process.argv[2] || 'legacy/js/Hui.deobfuscated.js'
const s = readFileSync(SRC, 'utf8')

// ---------- 1. 数组构造器 + 2. 解码器 ----------
const builders = new Map()
for (const m of s.matchAll(/function (_0x[0-9a-f]+)\(\)\{const e=(\[[\s\S]*?\]);return\((_0x[0-9a-f]+)=function\(\)\{return e\}\)\(\)\}/g)) {
  builders.set(m[1], JSON.parse(m[2]))
}
const decoders = new Map()
for (const m of s.matchAll(/function (_0x[0-9a-f]+)\(e,t\)\{const a=(_0x[0-9a-f]+)\(\);return _0x[0-9a-f]+=function\(t,x\)\{let _=a\[t-=(\d+)\];/g)) {
  decoders.set(m[1], { builder: m[2], offset: Number(m[3]) })
}

// ---------- 3. 旋转块 ----------
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

// ---------- 5. 别名 ----------
const raw = new Map()
for (const m of s.matchAll(/(?:const |,)(_0x[0-9a-f]+)=(_0x[0-9a-f]+)[,;]/g)) raw.set(m[1], m[2])
const aliases = {}
for (const a of raw.keys()) {
  let n = a
  const seen = new Set()
  while (!decoders.has(n) && raw.has(n) && !seen.has(n)) { seen.add(n); n = raw.get(n) }
  if (decoders.has(n)) aliases[a] = n
}
const resolve = (name) => decoders.has(name) ? name : aliases[name]
const call = (name, idx) => {
  const d = resolve(name)
  if (!d) return null
  try { return valueAt(d, idx) } catch { return null }
}

// ---------- 6. 替换 ----------
// 命名解码器 `_0xHEX(N)`，以及**单字母别名** `X(N)` / `X["Y"]` 这类取法
let hits = 0, miss = 0
const out = s.replace(/_0x([0-9a-f]+)\((\d+)\)|\b([A-Za-z_$][A-Za-z0-9_$]*)\((\d+)\)/g, (m, hex, n1, name, n2) => {
  const dec = hex !== undefined ? `_0x${hex}` : name
  const n = parseInt(hex !== undefined ? n1 : n2, 10)
  const v = call(dec, n)
  if (v === null) { miss++; return m }
  hits++
  return JSON.stringify(v)
})

writeFileSync(OUT, out)
console.error(`已写出 ${OUT}（替换 ${hits} 个 token，未命中 ${miss} 个）`)
