// 从 Receipt2.deobfuscated.js 里**逐字**抽取纯字符串构造器，拼成一个可在 Node 跑的模块。
// 不手抄 —— 手抄会毁掉黄金样本最要紧的东西（空白/缩进）。
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = '/Users/aaa/Desktop/door-main/legacy/js/Receipt2.deobfuscated.js'
const src = readFileSync(SRC, 'utf8')

// 与 legacy/decode-receipt2.mjs 同款的「这个 / 是正则还是除号」判定
const REGEX_OK_BEFORE = '(,=:[!&|?{};+-*%~^<>'

// 跳过「字符串 / 模板串 / 注释 / 正则字面量」整体，返回下一个索引；普通字符返回 -1。
// ⚠️ 必须处理正则：`le` 里有 `/"/g` 和 `/'/g`，正则体里的引号会把朴素的字符串跟踪带偏，
//    导致扫描越界吞掉后面几十行（`le` 曾一路吃到 `ue` 的 CSS，把产出截断在
//    `.receipt2-table th,` 那个逗号上）。判定沿用 decode-receipt2.mjs 的启发式：
//    `/` 前面最近的非空白字符若属 REGEX_OK_BEFORE 就当正则起点。
function skipSpecial(s, i) {
  const c = s[i]
  if (c === '"' || c === "'" || c === '`') {
    for (let j = i + 1; j < s.length; j++) {
      if (s[j] === '\\') { j++; continue }
      if (s[j] === c) return j + 1
    }
    return s.length
  }
  if (c === '/') {
    const n = s[i + 1]
    if (n === '/') { const j = s.indexOf('\n', i); return j < 0 ? s.length : j }
    if (n === '*') { const j = s.indexOf('*/', i); return j < 0 ? s.length : j + 2 }
    let j = i - 1
    while (j >= 0 && /\s/.test(s[j])) j--
    if (j < 0 || REGEX_OK_BEFORE.includes(s[j])) {
      for (let k = i + 1; k < s.length; k++) {
        const r = s[k]
        if (r === '\\') { k++; continue }
        if (r === '\n') return k + 1            // 未闭合 → 当普通字符
        if (r === '[') { while (k < s.length && s[k] !== ']') { if (s[k] === '\\') k++; k++ } continue }
        if (r === '/') return k + 1
      }
      return s.length
    }
  }
  return -1
}

// 从 start 处的开括号开始配平 (){}[]，返回闭合索引（含）
function matchBalanced(s, start) {
  const open = s[start]
  const CLOSE = { '(': ')', '{': '}', '[': ']' }
  const stack = [CLOSE[open]]
  for (let i = start + 1; i < s.length; i++) {
    const next = skipSpecial(s, i)
    if (next >= 0) { i = next - 1; continue }
    const c = s[i]
    if (c === '(' || c === '{' || c === '[') { stack.push(CLOSE[c]); continue }
    if (c === ')' || c === '}' || c === ']') {
      if (stack[stack.length - 1] !== c) throw new Error(`括号不匹配 @${i}: 期望 ${stack[stack.length-1]} 得到 ${c}`)
      stack.pop()
      if (stack.length === 0) return i
    }
  }
  throw new Error('未闭合')
}

// 抽取 `NAME = <expr>` 的 <expr> 原文（名字按 `\n      NAME = ` 出现，缩进 6）
// 三种形态：① 数组/对象字面量  ② 箭头 + 块体 {..}  ③ 箭头 + 表达式体（如 `ae`/`le`/`re`）
function grab(name) {
  const needle = `\n      ${name} = `
  const at = src.indexOf(needle)
  if (at < 0) throw new Error(`找不到 ${name}`)
  const exprStart = at + needle.length
  const line = src.slice(0, at).split('\n').length + 1

  if (src[exprStart] === '[' || src[exprStart] === '{') {   // ① 字面量
    return [name, src.slice(exprStart, matchBalanced(src, exprStart) + 1), { line }]
  }

  // ②③ 箭头函数：先找**顶层**的 `=>`（参数里的括号/默认值要把深度算进去）
  let d = 0, arrowAt = -1
  for (let i = exprStart; i < src.length; i++) {
    const c = src[i]
    if (c === '(') d++
    else if (c === ')') d--
    else if (c === '=' && src[i + 1] === '>' && d === 0) { arrowAt = i; break }
  }
  if (arrowAt < 0) throw new Error(`找不到 => : ${name}`)
  let bs = arrowAt + 2
  while (/\s/.test(src[bs])) bs++

  if (src[bs] === '{') {                                     // ② 块体
    return [name, src.slice(exprStart, matchBalanced(src, bs) + 1), { line }]
  }

  // ③ 表达式体：扫到**顶层逗号**为止（成员之间用 `,\n      ` 分隔）
  let d2 = 0
  for (let i = bs; i < src.length; i++) {
    const next = skipSpecial(src, i)
    if (next >= 0) { i = next - 1; continue }
    const c = src[i]
    if (c === '(' || c === '{' || c === '[') d2++
    else if (c === ')' || c === '}' || c === ']') d2--
    else if (c === ',' && d2 === 0) return [name, src.slice(exprStart, i), { line }]
  }
  throw new Error(`表达式体未终结: ${name}`)
}

const FN = ['K', 'M', 'L', 'te', 'le', 'oe', 'ae', 'ne', 'ce', 'se', 'de', 'Ve', 're', 'ie', 'me', 'ue', 'X', 'Z']
const CONST = ['a', 'u', 'r', 's', 'g', 'x', 'B', 'F', 'R']

const out = []
const meta = {}
out.push('// ==== 自动抽取自 Receipt2.deobfuscated.js（逐字，勿手改）====')
out.push('const dec = (i) => (i === 385 ? "landscape" : i === 659 ? "portrait" : (() => { throw new Error("未知解码下标 " + i) })());')
out.push('const l = dec;')  // 原文件里的解码器别名（只有 X 真正调用它）

for (const n of CONST) {
  const [name, text, m] = grab(n)
  meta[name] = m
  out.push(`const ${name} = ${text};`)
  if (name === 'a') out.push(`const n = { value: [...a] };`)        // 列宽 ref（默认）
}

// se / ce 依赖 b
out.push('const b = { value: L() };')   // 占位，L 定义后再赋（见下）
out.push('const C = { value: { ...g, metaOrder: [...g.metaOrder] } };')  // 显隐（生效值）
out.push('const i = { value: { ...r } };')                              // 品牌（生效值）

// L 要在 b 之前定义：先把 L 抽出来
{
  const [name, text, m] = grab('L')
  meta[name] = m
  out.push(`const L_ = ${text};`)
}
for (const n of FN.filter((f) => f !== 'L')) {
  const [name, text, m] = grab(n)
  meta[name] = m
  out.push(`const ${name} = ${text};`)
}

out.push(`
// b 用真实默认（L() 已可用）
b.value = L();
export const __meta = ${JSON.stringify(meta, null, 2)};
export { dec, te, a, u, r, s, g, x, B, F, R, M, L, le, oe, ae, ne, ce, se, de, Ve, re, ie, me, ue, X, Z, b, C, i, n };
`)

// L 引用名要统一：源码里叫 L，这里我改成了 L_ 以免和抽取顺序冲突
let final = out.join('\n').replace(/const L_ = /, 'const L = ')
// 上面 b 的占位语句引用了 L，需要挪到 L 定义之后 —— 直接把占位那行删掉，末尾已重新赋值
final = final.replace("const b = { value: L() };\n", "let b = { value: null };\n")

writeFileSync('/tmp/r2-analysis/render-extracted.mjs', final)
console.log('已写出 /tmp/r2-analysis/render-extracted.mjs')
console.log('行号表：')
for (const [k, v] of Object.entries(meta)) console.log(`  ${k.padEnd(4)} L${v.line}`)
