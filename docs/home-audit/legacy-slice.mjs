/*
 * 「把旧版某个函数从混淆源码里切出来、就地反混淆、真的跑起来」的公共件。
 *
 * 为什么要这样：**手抄旧版函数就是引入转写错误**，本项目为此栽过（见 `00-summary.md` 末尾的
 * 「教训：派活 ≠ 做完」那段）。凡是要跟旧版逐字对照的地方，都应该切源码跑，而不是照着读一遍再写。
 *
 * 两个坑（都踩过）：
 *   ① **作用域局部别名**：函数体里常有 `const e=g,t=new Map;` —— `e` 是解码器 `g` 的别名。
 *      只收一轮收不全，要**多轮闭包**（见 memory `hui-inline-decoder-recipe`）。
 *   ② **锚点不唯一**：`Qo=` 在 `Home.formatted.js` 里出现 **2 次**，只用它会切到前面那处、
 *      切出几万字符。锚点一律带上前导的 `,` / 上下文。
 *
 * 前置：`/tmp/home-map.json`（由 `legacy/decode-home-map.mjs` 生成）。
 */
import { readFileSync } from 'node:fs'

const ROOT = '/Users/aaa/Desktop/door-main'
export const MAP = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
export const SRC = readFileSync(`${ROOT}/legacy/js/Home.formatted.js`, 'utf8')

/** Home 主解码表名。局部别名 `g` 断言指向它（见下面 `assertDecoder`）。 */
const TABLE = 'dr'
/** setup 作用域里指向主表的局部名。 */
const LOCAL_DECODERS = ['g']

/** 取 `[from .. to)` 之间的源码；两个锚点都必须存在，否则直接抛（别静默切错）。 */
export function between(from, to, src = SRC) {
  const i = src.indexOf(from)
  if (i < 0) throw new Error(`锚点没找到: ${from}`)
  const j = src.indexOf(to, i + from.length)
  if (j < 0) throw new Error(`结束锚点没找到: ${to}（从 ${from} 之后）`)
  return src.slice(i + from.length, j)
}

/**
 * 名字 → 解码表。种子是解码器名、别名、局部名；再多轮闭包收 `const a=b`。
 *
 * `extraLocals` 用于**切片外的局部别名**：切片只取了一小段时，那句 `const e=g`
 * 可能留在切掉的上下文里（例如 `ps` 的谓词用 `e`，而 `const e=g` 在 `ps` 的开头）——
 * 闭包看不见它，就得手工告知。**不知道名字时必须报错，不能猜**。
 */
export function decoderTables(code, extraLocals = []) {
  const table = new Map()
  for (const d of Object.keys(MAP.decoders)) table.set(d, d)
  for (const [a, b] of Object.entries(MAP.aliases)) table.set(a, b)
  for (const n of [...LOCAL_DECODERS, ...extraLocals]) table.set(n, TABLE)
  for (let pass = 0; pass < 6; pass++) {
    for (const m of code.matchAll(/const (\w+)=(\w+)[,;]/g)) {
      if (table.has(m[2]) && !table.has(m[1])) table.set(m[1], table.get(m[2]))
    }
  }
  return table
}

/** 自检：`g` 确实等于 `dr`（`dr(755)` 必须是 "value"）。不成立就说明前置或假设变了，别继续。 */
export function assertDecoder() {
  if (MAP.decoders[TABLE]?.[755] !== 'value') throw new Error(`假设不成立：${TABLE}(755) ≠ "value"`)
  if (deobf('g(958)') !== JSON.stringify('未收金额')) throw new Error('局部解码器 g 解析不对')
}

/** 就地反混淆：把 `X(123)` 换成字面量。**有任何一处未命中就抛** —— 静默跳过会让对照失去意义。 */
export function deobf(code, extraLocals = []) {
  const table = decoderTables(code, extraLocals)
  const names = [...table.keys()].filter((n) => n !== '$n') // `$n` 用不到，且在正则里是锚点字符
  const re = new RegExp(`(?<![.\\w$])(${names.join('|')})\\((\\d+)\\)`, 'g')
  let miss = 0
  const out = code.replace(re, (all, n, idx) => {
    const v = MAP.decoders[table.get(n)]?.[idx]
    if (v === undefined) {
      miss++
      return all
    }
    return JSON.stringify(v)
  })
  if (miss) throw new Error(`反混淆有 ${miss} 处未命中，别继续跑`)
  return out
}

/**
 * 从 `open` 起做括号配平（认识字符串 / 正则 / 模板串 / 注释），返回含首尾括号的那一段。
 * ⚠️ 不认识正则会 `/"/` 这类字面量带偏（`deobfuscate-home.mjs` 栽过，见该文件 `isRegexStart`）。
 */
export function balanced(src, open) {
  const REGEX_OK_BEFORE = '(,=:[!&|?{};+-*%~^<>'
  const i = src.indexOf(open)
  if (i < 0) throw new Error(`起始括号没找到: ${open}`)
  const pairs = { '(': ')', '[': ']', '{': '}' }
  const stack = []
  let str = null
  for (let k = i; k < src.length; k++) {
    const c = src[k]
    if (str) {
      if (c === '\\') k++
      else if (c === str) str = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      str = c
      continue
    }
    if (c === '/') {
      const n = src[k + 1]
      if (n === '/') {
        while (k < src.length && src[k] !== '\n') k++
        continue
      }
      if (n === '*') {
        k = src.indexOf('*/', k) + 1
        continue
      }
      let j = k - 1
      while (j >= 0 && /\s/.test(src[j])) j--
      if (j < 0 || REGEX_OK_BEFORE.includes(src[j])) {
        k++
        for (; k < src.length; k++) {
          if (src[k] === '\\') k++
          else if (src[k] === '/') break
        }
        continue
      }
    }
    if (pairs[c]) stack.push(pairs[c])
    else if (stack.length && c === stack[stack.length - 1]) {
      stack.pop()
      if (!stack.length) return src.slice(i, k + 1)
    }
  }
  throw new Error('括号未配平')
}

/**
 * 跑一段**旧版源码**。`code` 里已反混淆，仍会引用旧版组件里的外部量 —— 由 `scope` 注入。
 *
 * `scope` 里的值会作为函数参数传入；返回 `code` 里 `return` 出来的东西。
 */
export function runLegacy(code, scope) {
  const keys = Object.keys(scope)
  const fn = new Function(...keys, code)
  return fn(...keys.map((k) => scope[k]))
}
