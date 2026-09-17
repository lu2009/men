// 盘点旧版「自定义单据」族：每张单据的组件名、代码量、ic 值、以及入口按钮文案。
import { readFileSync } from 'node:fs'

const ROOT = '/Users/aaa/Desktop/door-main'
const src = readFileSync(`${ROOT}/legacy/js/Home.formatted.js`, 'utf8')
const map = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))

const NAMES = [
  ['Receipt2PrintManager', '自定义收据单'],
  ['QualifiedLabelPrintManager', '自定义合格标签'],
  ['ProductionSheetPrintManager', '自定义生产单'],
  ['ProductionSheet2PrintManager', '自定义生产单2'],
  ['GlassSheet2PrintManager', '自定义玻璃合片单'],
]

/** 从 `__name:"X"` 往回找 defineComponent 的 `{`，再配平到组件结束。 */
function componentSpan(name) {
  const at = src.indexOf(`__name:"${name}"`)
  if (at < 0) return null
  const dc = src.lastIndexOf('defineComponent(', at)
  const open = src.indexOf('{', dc)
  let depth = 0, i = open, str = null
  for (; i < src.length; i++) {
    const c = src[i]
    if (str) {
      if (c === '\\') { i++; continue }
      if (c === str) str = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { str = c; continue }
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) return { start: open, end: i + 1 }
  }
  return null
}

console.log('=== 旧版「自定义单据」族（分组标题 `自定义单据：`，dr[972]）===\n')
console.log('组件名'.padEnd(32) + '界面名'.padEnd(18) + '代码量'.padEnd(14) + '行号范围')
console.log('-'.repeat(90))
const sizes = []
for (const [name, label] of NAMES) {
  const span = componentSpan(name)
  const text = span ? src.slice(span.start, span.end) : ''
  const lines = text ? text.split('\n').length : 0
  const chars = text.length
  sizes.push({ name, label, lines, chars })
  const range = span
    ? `${src.slice(0, span.start).split('\n').length}–${src.slice(0, span.end).split('\n').length}`
    : '—'
  console.log(`${name.padEnd(32)}${label.padEnd(18)}${(lines + ' 行').padEnd(14)}${range}`)
}

console.log('\n=== 各自设定的 ic 值 ===')
// 每个组件由一个 `ic.value = N` 的入口触发；找出所有 ic.value=N 并定位最近的组件 ref 名
for (const m of src.matchAll(/ic\s*(?:\.value)?\s*=\s*(\d+)/g)) {
  const n = m[1]
  const ctx = src.slice(Math.max(0, m.index - 220), m.index + 60)
  const ref = [...ctx.matchAll(/([A-Za-z_$][\w$]*)\.value\s*=\s*await\s+([A-Za-z_$][\w$]*)/g)]
    .map((x) => `${x[1]}=await ${x[2]}`)
    .join(' ')
  console.log(`  ic=${n.padEnd(3)} ${ctx.replace(/\s+/g, ' ').slice(-150)}`)
}

console.log('\n=== 入口按钮文案（都在 dr 表，前后带空格）===')
for (const [dec, tbl] of Object.entries(map.decoders)) {
  for (const [idx, val] of Object.entries(tbl)) {
    if (typeof val === 'string' && /^\s*自定义.+单\s*$|^\s*自定义合格标签\s*$/.test(val)) {
      console.log(`  ${dec}[${idx}]  ${JSON.stringify(val)}`)
    }
  }
}
