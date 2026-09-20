/*
 * 「把 `legacy/js/Hui.formatted.js` 里某一小段**切出来、就地反混淆、真的跑起来**」的公共件。
 *
 * 为什么要有它：**手抄旧版源码就是引入转写错误**（本项目为此栽过，见 `00-summary.md` 末尾）。
 * 原来这套切片/解码工具只长在 `total-balance-logiccheck.mjs` 里，第二个台子要用就只能复制 ——
 * 复制出来的两份迟早走样，所以 2026-09-19 抽到这里，两个台子共用同一份。
 *
 * 三个**踩过的坑**（改这里之前先读）：
 *   ① **函数头一起切**：`function _0x250a(e,t){…}` 只取 `{…}` 会变成一个块语句，
 *      函数压根不会定义 ⇒ 从函数头切到配对的 `}`。
 *   ② **轮转 IIFE 要整句切**：`!function(e,t){…}(args);` 的形参和实参在花括号**外面**，
 *      只取 `{…}` 再自己补 `()` ⇒ 轮转不跑、每个索引整体错位。
 *   ③ **解码器名字是作用域局部的别名**，别写死：Hui 这段叫 `r`，Home 那段叫 `V`。
 *      用 `resolveDecoders()` 按「必须恰好命中一张表」反推。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 仓库根从**本文件位置**推出（本文件在 `docs/*/lib/` ⇒ 往上**三级**才是仓库根）。
// 原来是写死的 `'/Users/aaa/Desktop/door-main'`：本机跑得通，换台机器或进 CI 就直接崩。
const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '..', '..', '..')
export const HUI = readFileSync(`${ROOT}/legacy/js/Hui.formatted.js`, 'utf8')

/** 从 `open` 起做括号配平（认得字符串/模板串/注释/正则），返回**配对括号的下标**。 */
export function matchBracket(src, openIdx) {
  const REGEX_OK_BEFORE = '(,=:[!&|?{};+-*%~^<>'
  const pairs = { '(': ')', '[': ']', '{': '}' }
  const stack = []
  let str = null
  for (let k = openIdx; k < src.length; k++) {
    const c = src[k]
    const prev = src[k - 1]
    if (str) {
      if (c === '\\') k++
      else if (c === str) str = null
      continue
    }
    if (c === '/' && src[k + 1] === '/') {
      const nl = src.indexOf('\n', k)
      k = nl < 0 ? src.length : nl
      continue
    }
    if (c === '/' && src[k + 1] === '*') {
      const end = src.indexOf('*/', k)
      k = end < 0 ? src.length : end + 1
      continue
    }
    if (c === '/' && REGEX_OK_BEFORE.includes(prev)) {
      // 正则字面量：跳到未转义的 `/`
      for (let j = k + 1; j < src.length; j++) {
        if (src[j] === '\\') j++
        else if (src[j] === '/') {
          k = j
          break
        }
      }
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      str = c
      continue
    }
    if (pairs[c]) stack.push(pairs[c])
    else if (stack.length && c === stack[stack.length - 1]) {
      stack.pop()
      if (!stack.length) return k
    }
  }
  throw new Error(`括号没配上（起点 ${openIdx}）`)
}

/** 含首尾括号的那一段。 */
export function balanced(src, openIdx) {
  return src.slice(openIdx, matchBracket(src, openIdx) + 1)
}

/**
 * 从 IIFE 的起点切出**整句** `!function(e,t){…}(a,b);`。
 *
 * ⚠️ 不能只取 `{…}` 然后自己补 `()`：形参和实参都在括号外面，漏掉轮转就不跑。
 */
export function iifeAt(src, startIdx) {
  const bodyOpen = src.indexOf('{', startIdx)
  let k = matchBracket(src, bodyOpen) + 1
  while (k < src.length && /\s/.test(src[k])) k++
  if (src[k] === '(') k = matchBracket(src, k) + 1
  while (k < src.length && /\s/.test(src[k])) k++
  if (src[k] === ';') k++
  return src.slice(startIdx, k)
}

/** 两个锚点之间的源码；任一锚点缺失直接抛（**别静默切错**）。 */
export function between(src, from, to, file = '') {
  const i = src.indexOf(from)
  if (i < 0) throw new Error(`${file}: 起始锚点没找到: ${from}`)
  const j = src.indexOf(to, i)
  if (j < 0) throw new Error(`${file}: 结束锚点没找到: ${to}`)
  return src.slice(i, j)
}

/** 跑 Hui 自带的解码器（数组函数 + 解码函数 + **轮转 IIFE**）。惰性且只跑一次。 */
let _huiDec = null
export function huiDecoder() {
  if (_huiDec) return _huiDec
  // 从函数头一路切到配对的 `}` —— **要含函数头**，只取 `{…}` 就变成了一个块语句，
  // `_0x250a` 压根不会定义。
  const cutFn = (header) => {
    const i = HUI.indexOf(header)
    if (i < 0) throw new Error(`Hui 解码器函数没找到: ${header}`)
    const open = HUI.indexOf('{', i)
    return HUI.slice(i, matchBracket(HUI, open) + 1)
  }
  const ARR = cutFn('function _0x1ee4(){')
  const DEC = cutFn('function _0x250a(e,t){')
  const ri = HUI.indexOf('!function(e,t){', HUI.indexOf('const _0x3a973c=_0x250a;'))
  if (ri < 0) throw new Error('Hui 轮转 IIFE 锚点没找到')
  const ROT = iifeAt(HUI, ri)
  const fn = new Function(`${ARR}\n${DEC}\n${ROT};\nreturn _0x250a;`)()
  // 自检：不成立就说明切错/轮转没跑，别继续。
  if (fn(566) !== 'includes') throw new Error(`Hui 解码器自检失败: 566 = ${JSON.stringify(fn(566))}`)
  if (fn(847) !== 'parentSubsidiary') throw new Error(`Hui 解码器自检失败: 847 = ${JSON.stringify(fn(847))}`)
  _huiDec = fn
  return fn
}

/**
 * 认出片段里哪些标识符是**解码器**，并给每个配上正确的表。
 *
 * ⚠️ 别把表名写死。同一个 chunk 里 token 函数的名字是**作用域局部的别名**
 *   （Hui 这段是 `r`，Home 这段是 `V`，两处都指向各自的表）—— 写死名字的下场是
 *   `ReferenceError: V is not defined`。
 *
 * 判据是**可证伪的**：这段代码里出现 `名字(数字)` 的每一处，正确的那张表必须**全部**解得开
 * （解不开返回 `undefined`，不是字符串）。命中数必须**恰好 1** —— 命中 0 说明切错段，
 * 命中 ≥2 说明判据不够严，两种都不许往下走。
 */
export function resolveDecoders(code, candidates, label) {
  const calls = new Map()
  for (const m of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\((\d+)\)/g)) {
    if (!calls.has(m[1])) calls.set(m[1], new Set())
    calls.get(m[1]).add(Number(m[2]))
  }
  if (!calls.size) throw new Error(`${label}: 片段里没有任何 token 调用，八成切错了`)
  const table = {}
  for (const [name, idx] of calls) {
    // 去重（同一张表挂多个别名时只算一次）
    const uniq = [...new Set(Object.values(candidates))]
    const hits = uniq.filter((dec) => [...idx].every((i) => typeof dec(i) === 'string'))
    if (hits.length !== 1) {
      throw new Error(
        `${label}: token 函数 \`${name}\` 命中 ${hits.length} 张表（应为 1）—— 命中 0 是切错了段，` +
          `命中 ≥2 是判据不够严，都得先查清楚`,
      )
    }
    table[name] = hits[0]
  }
  return table
}

/** 把 `X(123)` 就地换成字面量。**任何一处没换成字符串就抛** —— 静默跳过等于对照失效。 */
export function deobf(code, table, label) {
  const out = code.replace(/(?<![.\w$])([A-Za-z_$][\w$]*)\((\d+)\)/g, (all, name, idx) => {
    const dec = table[name]
    if (!dec) throw new Error(`${label}: 没给 \`${name}\` 配解码表`)
    const v = dec(Number(idx))
    if (typeof v !== 'string') throw new Error(`${label}: ${name}(${idx}) 解出来不是字符串`)
    return JSON.stringify(v)
  })
  if (/(?<![.\w$])[A-Za-z_$][\w$]*\(\d+\)/.test(out)) throw new Error(`${label}: 还残留未解 token`)
  return out
}
