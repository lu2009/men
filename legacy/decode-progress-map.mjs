// 把 Progress-f4bdef35.js 的**全部内联解码器**真的跑起来，dump 出「下标 → 字符串」映射。
//
// 为什么跑而不是抄：主表经过**轮转 IIFE**（`t.push(t.shift())` 循环到校验和成立），
// 下标不是数组原序。抄数组 = 抄错。这里把 数组函数 + 解码器 + 轮转 IIFE 原样切出来 eval，
// 让轮转自己跑到位，再按下标取字符串。
//
// ⚠️ 下标是**相对偏移**：解码器里写的是 `l[t-=OFFSET]`，所以 `f(OFFSET+k)` 才等于 `arr[k]`。
// （第一次写这脚本就栽在这：以为 `f(i)` 直接可取，一个都没取到。）
//
// ⚠️ 这个包里**有四套** 数组/解码器对，别只找第一套：
//   E/B   offset 453，316 条，有轮转 —— 页面主表（ProductionDashboard 用它）
//   dl/de offset 218，有轮转 —— 第二段独立模块（Home 订单表格的打包副本）
//   ue/se offset 405，12 条，**无轮转** —— 小表
//   vl/fl offset 294，12 条，**无轮转** —— 小表
//
// 用法：node legacy/decode-progress-map.mjs [in.js] [out.json]
import { readFileSync, writeFileSync } from 'node:fs'

const IN = process.argv[2] || 'legacy/js/Progress-f4bdef35.js'
const OUT = process.argv[3] || '/tmp/progress-map.json'

const src = readFileSync(IN, 'utf8')

/** 括号配平（认识字符串/模板串/注释/正则，够这个包用）。返回含首尾括号的一段。 */
function balanced(src, open) {
  const REGEX_OK_BEFORE = '(,=:[!&|?{};+-*%~^<>'
  let depth = 0, i = open, str = null
  for (; i < src.length; i++) {
    const c = src[i]
    if (str) { if (c === '\\') i++; else if (c === str) str = null; continue }
    if (c === '"' || c === "'" || c === '`') { str = c; continue }
    if (c === '/') {
      const n = src[i + 1]
      if (n === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
      if (n === '*') { i = src.indexOf('*/', i) + 1; continue }
      let j = i - 1
      while (j >= 0 && /\s/.test(src[j])) j--
      if (j < 0 || REGEX_OK_BEFORE.includes(src[j])) {
        i++
        for (; i < src.length; i++) {
          if (src[i] === '\\') i++
          else if (src[i] === '/') break
          else if (src[i] === '\n') break
        }
        continue
      }
    }
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') { if (--depth === 0) return src.slice(open, i + 1) }
  }
  throw new Error('括号未配平')
}

/** 全部解码器：形如 `function NAME(e,t){const|var l=ARR(); ... l[t-=OFFSET] ...` */
function findDecoders() {
  const out = []
  const re = /function ([A-Za-z_$][\w$]*)\(e,t\)\{(?:const|var) ([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\(\);/g
  let m
  while ((m = re.exec(src))) {
    const [, dec, alias, arrayFn] = m
    const bodyStart = src.indexOf('{', m.index + `function ${dec}(e,t)`.length)
    const body = balanced(src, bodyStart)
    const offM = body.match(/\[[A-Za-z_$][\w$]*-=(\d+)\]/)
    if (!offM) continue
    out.push({ dec, alias, arrayFn, offset: Number(offM[1]), at: m.index, bodyEnd: bodyStart + body.length })
  }
  return out
}

/** 数组函数：`function NAME(){const|var e=[...];return(NAME=function(){return e})()}` */
function arrayFnCode(name) {
  const start = src.indexOf(`function ${name}(){`)
  if (start < 0) throw new Error(`找不到数组函数 ${name}`)
  const m = src.slice(start).match(/return\([A-Za-z_$][\w$]*=function\(\)\{return e\}\)\(\)\}/)
  if (!m) throw new Error(`数组函数 ${name} 尾部形态不符`)
  return { code: src.slice(start, start + m.index + m[0].length), end: start + m.index + m[0].length }
}

/**
 * 轮转 IIFE（可能不存在 —— 小表就没轮转）。
 * ⚠️ 不能「在数组函数与解码器之间」找：主表里**数组函数在解码器之后**（解码器 @758，数组 @1284），
 * 那样切出来是空的。一律从数组函数结尾往后找。
 */
function rotationCode(decName) {
  // ⚠️ 三个坑，全踩过：
  //   ① 不能「在数组函数与解码器之间」找 —— 主表里数组函数在解码器**之后**（解码器 @758、数组 @1284）。
  //   ② 也不能「从数组函数往后找」—— `dl` 的轮转在数组函数**之前**。往后找还会串到隔壁表去。
  //   ③ 更不能写死轮转的开头形状：四张表的开头**各不相同**（这包真的很脏）——
  //        E : `!function(){const e=E,t=B();for(;;)try{`
  //        de: `!function(){const e=de,t=dl();for(;;)try{`
  //        se: `!function(){for(var e=se,t=ue();;)try{`     ← `for(var ...;;)` 不是 `for(;;)`
  //        fl: `!function(){for(var e=fl,t=vl();;)try{`
  //      之前的锚点只认第一种，于是 se/fl 被误判成「无轮转」，解出来的表**整体差一位**
  //      （`re(413)` 本该是 `__scopeId`，却解成校验和串 `75758DDkOwr`）。
  //   做法：遍历**所有** `!function(){` IIFE，挑出正文里出现 `<本解码器名>` 且带 `.push(.shift())` 的那个。
  let found = null
  for (const m of src.matchAll(/!function\(\)\{/g)) {
    const start = m.index
    const head = src.slice(start, start + 120)
    if (!new RegExp(`[=(,\\s]${decName}[,;)\\s]`).test(head)) continue
    // 用括号配平取整段，别用固定窗口 —— 表越大轮转体越长（`dl` 那种 700+ 条的会超窗）。
    // ⚠️ `!function(){...}()` 里 `function` 后面那个 `()` 是**空参数表**，不是函数体；
    //    要配平的是它后面那个 `{`。配错了只会得到 `()`，于是「有轮转」被判成「无轮转」。
    const body = balanced(src, src.indexOf('{', src.indexOf('(', start)))
    if (!/\.push\([A-Za-z_$][\w$]*\.shift\(\)\)/.test(body)) continue
    found = `!function()${body}();`
    break
  }
  return found
}

const decoders = findDecoders()
if (!decoders.length) throw new Error('一套解码器都没找到')

const sets = {}
for (const d of decoders) {
  const a = arrayFnCode(d.arrayFn)
  const rot = rotationCode(d.dec)
  const runner = new Function(
    `${a.code}\n${src.slice(d.at, d.bodyEnd)}\n` +
      `${rot || ''}\nreturn { arr: ${d.arrayFn}, dec: ${d.dec} };`,
  )
  const { arr: getArr, dec } = runner()
  const arr = getArr()
  const table = {}
  let miss = 0
  for (let k = 0; k < arr.length; k++) {
    try {
      const v = dec(d.offset + k)
      if (typeof v !== 'string') { miss++; continue }
      table[d.offset + k] = v
    } catch { miss++ }
  }
  sets[d.dec] = { ...d, len: arr.length, rotation: !!rot, table }
  console.error(
    `${d.dec}/${d.arrayFn} @${d.at}: offset ${d.offset}，数组 ${arr.length} 条，` +
      `有效下标 ${d.offset}..${d.offset + arr.length - 1}，轮转 ${rot ? '有' : '无'}，` +
      `解出 ${Object.keys(table).length} 条，失败 ${miss} 处`,
  )
}

// 自检：几张表各挑一个「语义上必须如此」的值。轮转配错时这些会整体偏移一位，
// 而且**不会报错**（只是解出别的字符串）—— 所以必须拿已知值钉住。
const CHECKS = [
  ['E', 743, 'dashboard-container'],
  ['E', 710, 'innerWidth'],
  ['de', 710, 'Progress'],
  ['de', 432, '生产进度'],
  ['se', 413, '__scopeId'],
  ['fl', 294, 'data-v-95ebc180'],
]
let ran = 0
for (const [dec, idx, want] of CHECKS) {
  if (!sets[dec]) continue // 这个包里没有该表（例如 index 包）—— 跳过，且**不计入 ran**
  const got = sets[dec].table[idx]
  if (got !== want) throw new Error(`自检失败：${dec}(${idx}) = ${JSON.stringify(got)}，应为 ${JSON.stringify(want)}`)
  ran++
}
if (!ran) console.error('⚠️ 本包没有任何一条自检命中 —— 解码表**没有被钉住**，轮转配错也不会报错')

writeFileSync(OUT, JSON.stringify({ sets }, null, 0))
console.error(`自检 ${ran}/${CHECKS.length} 条命中并通过；写出 ${OUT}`)
