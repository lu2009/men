// 从每个「自定义单据」组件区间里提取**字面量字符串**，作为它的 UI 词汇表。
// 注：Home.formatted.js 生成时已把多字符解码器替换成字面量，所以直接取引号串即可。
import { readFileSync } from 'node:fs'

const src = readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home.formatted.js', 'utf8')
const REGEX_OK_BEFORE = '(,=:[!&|?{};+-*%~^<>'

function spanOf(name) {
  const at = src.indexOf(`__name:"${name}"`)
  if (at < 0) return null
  const dc = src.lastIndexOf('defineComponent', at)
  const open = src.indexOf('{', dc)
  let depth = 0, i = open, str = null
  for (; i < src.length; i++) {
    const c = src[i]
    if (str) { if (c === '\\') { i++; continue } if (c === str) str = null; continue }
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

/** 取区间内所有字符串字面量（含转义）。 */
function literals(text) {
  const out = []
  let str = null, buf = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (str) {
      if (c === '\\') { buf += c + (text[i + 1] ?? ''); i++; continue }
      if (c === str) { out.push(buf); str = null; continue }
      buf += c
      continue
    }
    if (c === '"' || c === "'" || c === '`') { str = c; buf = '' }
  }
  return out
}

const NAMES = process.argv[2]
  ? [[process.argv[2], process.argv[2], '']]
  : [
      ['Receipt2PrintManager', '自定义收据单', 12],
      ['QualifiedLabelPrintManager', '自定义合格标签', 13],
      ['ProductionSheetPrintManager', '自定义生产单', 14],
      ['ProductionSheet2PrintManager', '自定义生产单2', 15],
      ['GlassSheet2PrintManager', '自定义玻璃合片单', 16],
    ]

for (const [name, label, ic] of NAMES) {
  const s = spanOf(name)
  if (!s) { console.log(`\n### ${label}（切分失败）`); continue }
  const lits = literals(src.slice(s.a, s.b))
  const words = [...new Set(lits.filter((v) => /[一-龥]/.test(v) && v.length >= 2 && v.length <= 30))].sort()
  console.log(`\n### ic=${ic} ${label}  ——  \`${name}\``)
  console.log(`汉字字面量 ${words.length} 条：`)
  for (let i = 0; i < words.length; i += 3) {
    console.log('   ' + words.slice(i, i + 3).map((w) => w.padEnd(24)).join(''))
  }
}
