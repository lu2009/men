// 量「自定义单据」族每个组件的代码量。
// 复用 decode-receipt2.mjs 里那套**认识正则字面量**的扫描器 —— 不认识正则的话，
// `/"/` 里的引号会让字符串状态错乱，花括号再也配不平（本会话已经栽过一次）。
import { readFileSync } from 'node:fs'

const src = readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home.formatted.js', 'utf8')
const REGEX_OK_BEFORE = '(,=:[!&|?{};+-*%~^<>'

const NAMES = [
  ['Receipt2PrintManager', '自定义收据单', 12],
  ['QualifiedLabelPrintManager', '自定义合格标签', 13],
  ['ProductionSheetPrintManager', '自定义生产单', 14],
  ['ProductionSheet2PrintManager', '自定义生产单2', 15],
  ['GlassSheet2PrintManager', '自定义玻璃合片单', 16],
]

function spanOf(name) {
  const at = src.indexOf(`__name:"${name}"`)
  if (at < 0) return null
  const dc = src.lastIndexOf('defineComponent', at)
  if (dc < 0) return null
  const open = src.indexOf('{', dc)
  let depth = 0
  let i = open
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
    else if (c === '}' && --depth === 0) return { a: open, b: i + 1 }
  }
  return null
}

console.log('=== 旧版「自定义单据」族（分组 `自定义单据：`）===\n')
console.log('ic  ' + '界面名'.padEnd(16) + '组件名'.padEnd(32) + '代码量'.padEnd(12) + '起始行')
console.log('-'.repeat(90))

const rows = []
for (const [name, label, ic] of NAMES) {
  const s = spanOf(name)
  if (!s) { rows.push({ ic, label, name, lines: -1, kb: -1, line: -1 }); continue }
  const text = src.slice(s.a, s.b)
  rows.push({
    ic,
    label,
    name,
    lines: text.split('\n').length,
    kb: Math.round(text.length / 1024),
    line: src.slice(0, s.a).split('\n').length,
  })
}
rows.sort((a, b) => a.ic - b.ic)
for (const r of rows) {
  const size = r.lines < 0 ? '（切分失败）' : `${r.lines} 行 / ${r.kb} KB`
  console.log(`${String(r.ic).padEnd(4)}${r.label.padEnd(16)}${r.name.padEnd(32)}${size.padEnd(12)}${r.line < 0 ? '—' : r.line}`)
}
const ok = rows.filter((r) => r.lines > 0)
console.log(`\n合计（切分成功的 ${ok.length} 个）：${ok.reduce((s, r) => s + r.lines, 0)} 行 / ${ok.reduce((s, r) => s + r.kb, 0)} KB`)
