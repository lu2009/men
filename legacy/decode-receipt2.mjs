// 把 Home 页里的 Receipt2PrintManager（收据单2 自绘组件）从混淆态解出来。
//
// 与 decode-stringmap.mjs 的区别：那套按 `_0x[0-9a-f]` 名字匹配，Home 用的是
// 「函数名 + 数字下标」的调用形式，且组件内 `const l=_o` 是个**局部别名**
// （`_o` 再别到 `Jo`）—— 所以这里直接吃 `decode-home-map.mjs` 产出的映射。
//
// 用法：node legacy/decode-receipt2.mjs [in.js] [out.js] [map.json]
import { readFileSync, writeFileSync } from 'node:fs'

const IN = process.argv[2] || 'legacy/js/Home.formatted.js'
const OUT = process.argv[3] || '/tmp/receipt2.decoded.js'
const MAP = process.argv[4] || '/tmp/home-map.json'

const src = readFileSync(IN, 'utf8')
const { decoders, aliases } = JSON.parse(readFileSync(MAP, 'utf8'))

// 组件起点：`va=Vue.defineComponent({__name:"Receipt2PrintManager"`
const start = src.indexOf('__name:"Receipt2PrintManager"')
if (start < 0) throw new Error('找不到 Receipt2PrintManager')
// `defineComponent(` 就在 `__name` 前面几十字符内 —— 把搜索窗口卡在它俩之间，
// 放宽会命中更早的组件（Home 里 defineComponent 不止一处）。
const dc = src.lastIndexOf('defineComponent(', start)
if (dc < 0 || start - dc > 400) throw new Error('defineComponent 不在预期距离内')
const open = src.indexOf('{', dc)

// 花括号配平取组件全文。
// 必须跳过 字符串 / 模板串 / 注释 / **正则字面量** 里的括号 —— 尤其最后一种：
// 正则里的 `/` 会被当成注释起点，注释里的 `*/` 又会把后面整段吞掉，括号数就再也配不平。
const REGEX_OK_BEFORE = '(,=:[!&|?{};+-*%~^<>' // 这些符号之后出现的 `/` 是正则起点
let depth = 0, i = open, end = -1, str = null
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
    // 正则字面量：看它前面最近的非空白字符，或行首
    let j = i - 1
    while (j >= 0 && /\s/.test(src[j])) j--
    if (j < 0 || REGEX_OK_BEFORE.includes(src[j])) {
      i++
      for (; i < src.length; i++) {
        const r = src[i]
        if (r === '\\') { i++; continue }
        if (r === '\n') break            // 未闭合，当普通字符处理
        if (r === '[') { while (i < src.length && src[i] !== ']') { if (src[i] === '\\') i++; i++ } continue }
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

// 组件里 `const l=_o` → 解析到真正的解码器名
const localAlias = body.match(/const (\w+)=(\w+)[,;]/)
const seen = new Set()
let decName = localAlias ? localAlias[2] : null
while (decName && !decoders[decName] && aliases[decName] && !seen.has(decName)) {
  seen.add(decName)
  decName = aliases[decName]
}
if (!decName || !decoders[decName]) throw new Error(`解不出局部解码器：${localAlias?.[2]}`)

const table = decoders[decName]

// 组件里到处是 `const t=l,o=…` 这种**函数内局部别名**，箭头函数体里再调 `t(NNN)`。
// 把「直接别名到解码器」的名字全收进来（含传递别名 X=Y=解码器），一并替换。
// 顶层 `t` 是 setup 的 expose 参数，但 expose 只会被对象调用、不会吃数字下标，故不冲突。
// 有的地方直接写全名（`Jo(624)`）而不是走局部别名 —— 一并收进来
const names = new Set([localAlias[1], localAlias[2], decName])
for (let pass = 0; pass < 4; pass++) {
  for (const m of body.matchAll(/const (\w+)=(\w+)[,;]/g)) {
    if (names.has(m[2])) names.add(m[1])
  }
}
// 别名名字里可能有 `t` 这种一字符名 —— 用词边界保证 `at(1)` / `.t(1)` 不被误伤
const callRe = new RegExp(`(?<![.\\w$])(${[...names].join('|')})\\((\\d+)\\)`, 'g')
let miss = 0, hits = 0
body = body.replace(callRe, (all, _name, n) => {
  const v = table[n]
  if (v === undefined) { miss++; return all }
  hits++
  return JSON.stringify(v)
})

writeFileSync(OUT, body)
console.error(`解码器 ${localAlias[1]} → ${decName}（${Object.keys(table).length} 条）`)
console.error(`别名 ${[...names].join(',')}；替换 ${hits} 处，未命中下标 ${miss} 处`)
console.error(`写出 ${OUT}（${body.length} 字符）`)
