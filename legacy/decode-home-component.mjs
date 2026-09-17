// 把 Home 页里某个「自定义单据」组件从混淆态解出来（`decode-receipt2.mjs` 的通用版）。
//
// 与收据单那份的差别：
//   · 组件名要指定 —— 四张里只有 `Receipt2PrintManager` 在原始文件里是**字面量**，
//     其余四张的 `__name:` 是解码调用（如 `__name:pa(272)`），搜不到。
//   · 所以改从**组件名解码表**反查：先在 `decode-home-map.mjs` 的映射里找到组件名对应的
//     `解码器(下标)`，再拿它到原始文件里定位。
//
// 用法：node legacy/decode-home-component.mjs <组件名> [out.js]
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'legacy/js/Home-d6b13b9a.js'
const MAP = '/tmp/home-map.json'

const name = process.argv[2]
const out = process.argv[3] || `/tmp/${name}.decoded.js`
if (!name) {
  console.error('用法：node legacy/decode-home-component.mjs <组件名> [out.js]')
  process.exit(1)
}

const src = readFileSync(SRC, 'utf8')
const { decoders, aliases } = JSON.parse(readFileSync(MAP, 'utf8'))

/** 解码器名 → 别名列表（含自身）。用于把「组件名」反查成 `解码器(下标)`。 */
const aliasOf = new Map()
for (const [a, b] of Object.entries(aliases)) {
  if (!aliasOf.has(b)) aliasOf.set(b, [])
  aliasOf.get(b).push(a)
}

/** 在解码表里找出这个名字的 `解码器(下标)`。 */
function findNameCall(target) {
  for (const [dec, table] of Object.entries(decoders)) {
    for (const [idx, val] of Object.entries(table)) {
      if (val !== target) continue
      // 原始文件里可能用别名调用
      const names = [dec, ...(aliasOf.get(dec) ?? [])]
      for (const n of names) {
        const re = new RegExp(`__name:\\s*${n}\\(${idx}\\)`)
        const m = re.exec(src)
        if (m) return { at: m.index, call: `${n}(${idx})` }
      }
    }
  }
  return null
}

const hit = findNameCall(name)
if (!hit) throw new Error(`在原始文件里定位不到组件：${name}`)
console.error(`定位到 ${name}：__name:${hit.call} @${hit.at}`)

// 花括号配平取组件全文（认识正则/字符串/注释 —— 不认识正则会被 `/"/` 里的引号带偏）
const REGEX_OK_BEFORE = '(,=:[!&|?{};+-*%~^<>'
const dc = src.lastIndexOf('defineComponent(', hit.at)
if (dc < 0) throw new Error('找不到 defineComponent')
const open = src.indexOf('{', dc)
let depth = 0
let i = open
let end = -1
let str = null
for (; i < src.length; i++) {
  const c = src[i]
  if (str) {
    if (c === '\\') { i++; continue }
    if (c === str) str = null
    continue
  }
  if (c === '"' || c === "'" || c === '`') { str = c; continue }
  if (c === '/') {
    const n = src[i + 1]
    if (n === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (n === '*') { i = src.indexOf('*/', i) + 2; continue }
    let j = i - 1
    while (j >= 0 && /\s/.test(src[j])) j--
    if (j < 0 || REGEX_OK_BEFORE.includes(src[j])) {
      i++
      for (; i < src.length; i++) {
        const r = src[i]
        if (r === '\\') { i++; continue }
        if (r === '\n') break
        if (r === '[') { i++; while (i < src.length && src[i] !== ']') { if (src[i] === '\\') i++; i++ } continue }
        if (r === '/') break
      }
      continue
    }
  }
  if (c === '{') depth++
  else if (c === '}' && --depth === 0) { end = i + 1; break }
}
if (end < 0) throw new Error('花括号未配平')
let body = src.slice(open, end)

// 组件里的局部解码器别名（形如 `const l=_o`）
const localAlias = body.match(/const (\w+)=(\w+)[,;]/)
const seen = new Set()
let decName = localAlias ? localAlias[2] : null
while (decName && !decoders[decName] && aliases[decName] && !seen.has(decName)) {
  seen.add(decName)
  decName = aliases[decName]
}
if (!decName || !decoders[decName]) throw new Error(`解不出局部解码器：${localAlias?.[2]}`)

const table = decoders[decName]
const names = new Set([localAlias[1], localAlias[2], decName])
for (let pass = 0; pass < 4; pass++) {
  for (const m of body.matchAll(/const (\w+)=(\w+)[,;]/g)) if (names.has(m[2])) names.add(m[1])
}
const callRe = new RegExp(`(?<![.\\w$])(${[...names].join('|')})\\((\\d+)\\)`, 'g')
let miss = 0
let hits = 0
body = body.replace(callRe, (all, _n, idx) => {
  const v = table[idx]
  if (v === undefined) { miss++; return all }
  hits++
  return JSON.stringify(v)
})

writeFileSync(out, body)
console.error(`解码器 ${localAlias[1]} → ${decName}；别名 ${[...names].join(',')}`)
console.error(`替换 ${hits} 处，未命中 ${miss} 处；写出 ${out}（${body.length} 字符）`)
