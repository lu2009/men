// 把 Vue 编译产物的**单行 render** 折行，便于人读。
// esbuild 的 formatter 对这种「一个巨型表达式语句」无能为力（它只按语句断行），
// 而 render 整个就是一条 `return a, b(...)` 表达式，几千字符一行。所以自己按逗号断。
//
// 只在**括号深度 >= minDepth** 的逗号处断行，并按深度缩进。字符串/模板串/注释/正则里的
// 逗号不会被误断（与仓库里其它切片脚本同一套状态机）。
//
// 用法：node legacy/lib-break-render.mjs <in.js> <out.js> [minDepth]
import { readFileSync, writeFileSync } from 'node:fs'

const IN = process.argv[2] || '/tmp/progress.pretty.js'
const OUT = process.argv[3] || '/tmp/progress.broken.js'
const MIN_DEPTH = Number(process.argv[4] ?? 2)

const src = readFileSync(IN, 'utf8')
const REGEX_OK_BEFORE = '(,=:[!&|?{};+-*%~^<>'

let out = ''
let depth = 0
let str = null

for (let i = 0; i < src.length; i++) {
  const c = src[i]
  if (str) {
    out += c
    if (c === '\\') { out += src[++i] ?? ''; continue }
    if (c === str) str = null
    continue
  }
  if (c === '"' || c === "'" || c === '`') { str = c; out += c; continue }
  if (c === '/') {
    const n = src[i + 1]
    if (n === '/') { const j = src.indexOf('\n', i); out += src.slice(i, j < 0 ? src.length : j); i = (j < 0 ? src.length : j) - 1; continue }
    if (n === '*') { const j = src.indexOf('*/', i); out += src.slice(i, j + 2); i = j + 1; continue }
    let k = i - 1
    while (k >= 0 && /\s/.test(src[k])) k--
    if (k < 0 || REGEX_OK_BEFORE.includes(src[k])) {
      let j = i + 1
      for (; j < src.length; j++) {
        if (src[j] === '\\') { j++; continue }
        if (src[j] === '\n') break
        if (src[j] === '/') break
      }
      out += src.slice(i, j + 1)
      i = j
      continue
    }
  }
  if (c === '(' || c === '[' || c === '{') {
    out += c
    depth++
    // 对象/数组字面量开头也断一次，读起来才像树
    if (depth >= MIN_DEPTH && c !== '(') out += '\n' + '  '.repeat(depth)
    continue
  }
  if (c === ')' || c === ']' || c === '}') {
    depth--
    if (depth >= MIN_DEPTH && c !== ')') out += '\n' + '  '.repeat(depth)
    out += c
    continue
  }
  if (c === ',' && depth >= MIN_DEPTH) { out += ',\n' + '  '.repeat(depth); continue }
  out += c
}

writeFileSync(OUT, out)
console.error(`折行写出 ${OUT}（${src.split('\n').length} → ${out.split('\n').length} 行）`)
