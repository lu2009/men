// 还原 legacy/js/*.js 里的「字符串表」（javascript-obfuscator 的 base64 + 数组旋转方案）。
//
// 为什么需要它：旧版 chunk 把中文/英文串都换成了 `_0x5c0d14(995)` 这种 token，
// 要逐字核对原版语义就必须先把 token 解回字符串。仓库里的 `hui-stringmaps.json`
// **是错的**（数组未做旋转，值全部错位），不要再用它。
//
// ⚠️ 那份错表已删除，它生成的 `Hui.formatted.js` 也已用 `legacy/deobfuscate-hui.mjs` 重建
// （正确字符串、行号不变）。本脚本现在只在需要拿「单一 token 的取值」时用，整文件反混淆走
// `node legacy/deobfuscate-hui.mjs`。`legacy/diao-stringmaps.json` 那份是**对的**，可继续用。
//
// 用法：
//   node legacy/decode-stringmap.mjs legacy/js/Hui-d088417c.js /tmp/hui-map.json
//   node -e 'const t=require("/tmp/hui-map.json");
//            const A=t.aliases; const M=(al,i)=>t.decoders[A[al]||al][i];
//            console.log(M("_0x5c0d14",995))'   // => 上亮横
//
// 原理（每套表各自独立，共 14 套）：
//   1. `function _0xB(){const e=[...];return(_0xC=function(){return e})()}` —— 数组构造器
//   2. `function _0xD(e,t){const a=_0xB();return _0xD=function(t,x){let _=a[t-=OFF];...}}` —— 解码器
//      （自定义 base64 字母表 + 百分号转义 + decodeURIComponent）
//   3. `!function(e,t){const a=_0xD,x=_0xB();for(;;)try{if(校验和)break;x.push(x.shift())}catch(_){x.push(x.shift())}}()`
//      —— 旋转数组直到校验和成立；**多个解码器可能共用同一数组，旋转会叠加**
//   4. `const _0xALIAS=_0xD` —— 别名
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = process.argv[2] || 'legacy/js/Hui-d088417c.js'
const s = readFileSync(FILE, 'utf8')

// ---------- 1. 数组构造器 ----------
const builders = new Map() // 名称 -> 数组（**会被旋转原地修改**）
for (const m of s.matchAll(/function (_0x[0-9a-f]+)\(\)\{const e=(\[[\s\S]*?\]);return\((_0x[0-9a-f]+)=function\(\)\{return e\}\)\(\)\}/g)) {
  builders.set(m[1], JSON.parse(m[2]))
}

// ---------- 2. 解码器 ----------
const decoders = new Map() // 名称 -> { builder, offset }
for (const m of s.matchAll(/function (_0x[0-9a-f]+)\(e,t\)\{const a=(_0x[0-9a-f]+)\(\);return _0x[0-9a-f]+=function\(t,x\)\{let _=a\[t-=(\d+)\];/g)) {
  decoders.set(m[1], { builder: m[2], offset: Number(m[3]) })
}

// ---------- 3. 旋转块（文档序） ----------
const rotations = []
for (const m of s.matchAll(/const a=(_0x[0-9a-f]+),x=(_0x[0-9a-f]+)\(\);for\(;;\)try\{if\(([\s\S]*?)\)break;x\.push\(x\.shift\(\)\)\}catch\(_\)\{x\.push\(x\.shift\(\)\)\}\}/g)) {
  rotations.push({ decoder: m[1], cond: m[3] })
}

// ---------- 4. base64 解码（照抄原版 NcYIwu，注意**自定义字母表**） ----------
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

// 逐个旋转块暴力求解步数
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
  if (!solved) console.error('未解出旋转:', r.decoder, cond.slice(0, 90))
}

// ---------- 5. 别名（可链式：const A=B; const B=解码器） ----------
const raw = new Map()
for (const m of s.matchAll(/(?:const |,)(_0x[0-9a-f]+)=(_0x[0-9a-f]+)[,;]/g)) raw.set(m[1], m[2])
const aliases = {}
for (const a of raw.keys()) {
  let n = a
  const seen = new Set()
  while (!decoders.has(n) && raw.has(n) && !seen.has(n)) { seen.add(n); n = raw.get(n) }
  if (decoders.has(n)) aliases[a] = n
}

// ---------- 6. 导出 ----------
const out = process.argv[3]
const dec = {}
for (const [name, d] of decoders) {
  const arr = builders.get(d.builder)
  const map = {}
  for (let i = d.offset; i < d.offset + arr.length; i++) {
    try { map[i] = valueAt(name, i) } catch { /* 坏项跳过 */ }
  }
  dec[name] = map
}
const payload = JSON.stringify({ decoders: dec, aliases })
if (out) { writeFileSync(out, payload); console.error(`已写出 ${out}（${Object.keys(dec).length} 套表，${Object.keys(aliases).length} 个别名）`) }
else console.log(payload)
