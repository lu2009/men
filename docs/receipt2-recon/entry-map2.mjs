// 穷举「抽屉入口 → ic」映射。
//
// 上一版按「按钮块的正则」扫，漏了 ic 6/7/9/10 —— 那是按钮块的写法变了，不是没有入口。
// 这版反过来：**先枚举所有给 ic 赋值的函数**（入口的充要条件），再反查它的按钮文案。
import { readFileSync } from 'node:fs'

const ROOT = '/Users/aaa/Desktop/door-main'
const s = readFileSync(`${ROOT}/legacy/js/Home-d6b13b9a.js`, 'utf8')
const map = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
const dr = map.decoders.dr

// 单字符解码器别名（本文件里 s/g/e/t 等都指向 dr）—— 用于把 s(1234) 解成文案
const ALIASES = new Set(['s', 'g', 'e', 't', 'l', 'o', 'n', 'r', 'a', 'i', 'c', 'd'])

/** 所有 `[const] NAME=[async](...)=>{` 形式的函数及其函数体范围。 */
function allFns() {
  const out = []
  const re = /[,;{]\s*(?:const\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g
  let m
  while ((m = re.exec(s))) {
    const open = s.indexOf('{', m.index + m[0].length - 1)
    let depth = 0
    let i = open
    let str = null
    for (; i < s.length; i++) {
      const c = s[i]
      if (str) { if (c === '\\') { i++; continue } if (c === str) str = null; continue }
      if (c === '"' || c === "'" || c === '`') { str = c; continue }
      if (c === '{') depth++
      else if (c === '}' && --depth === 0) break
    }
    out.push({ name: m[1], a: open, b: i })
  }
  return out
}
const FNS = allFns()

/**
 * 包含某位置的**最小**函数 —— 不能用「往前找最近的定义」：
 * 那会跨过函数边界，把 ic 归错人（上一版就是这么把 ic=4/10 归给了 `pc`）。
 */
function enclosingFn(at) {
  const owner = FNS.filter((f) => f.a < at && at < f.b).sort((x, y) => x.b - x.a - (y.b - y.a))[0]
  return owner ? { name: owner.name } : null
}

/**
 * 某个函数的按钮文案。
 *
 * 按钮块的形状固定为：
 *   `onClick:NAME},{default:Vue.withCtx((()=>t[151]||(t[151]=[Vue.createTextVNode(s(1336))]))),_:1}`
 * 所以文案取**同一个块里的第一个 createTextVNode**，并且**不能越过下一个 `onClick:`**
 * —— 否则会吃到隔壁按钮的文案（上一版就是这么串台的）。
 */
function labelOf(handler) {
  const hits = []
  const re = new RegExp(`onClick:\\s*${handler}\\b`, 'g')
  let m
  while ((m = re.exec(s))) {
    let win = s.slice(m.index, m.index + 600)
    const next = win.indexOf('onClick:', 10)
    if (next > 0) win = win.slice(0, next) // 别越界到下一个按钮
    // 文案有两种写法：`s(NNN)`（走解码表）与 `"字面量"`（部分按钮直接写死）。
    const t =
      /createTextVNode\(\s*([A-Za-z_$][\w$]*)\((\d+)\)/.exec(win) ??
      /createTextVNode\(\s*"((?:[^"\\]|\\.)*)"/.exec(win)
    if (!t) continue
    let v
    if (t[2] !== undefined) {
      if (!ALIASES.has(t[1])) continue
      v = dr[Number(t[2])]
    } else {
      v = t[1]
    }
    if (typeof v === 'string' && v.trim() && !/^[\x00-\x7f]*$/.test(v)) hits.push(v.trim())
  }
  return [...new Set(hits)]
}

// —— 枚举所有 ic 赋值 ——
const entries = []
const re = /ic(?:\[[^\]]+\]|\.value)?\s*=\s*(\d+)/g
let m
while ((m = re.exec(s))) {
  const fn = enclosingFn(m.index)
  if (!fn) continue
  const dup = entries.find((e) => e.ic === Number(m[1]) && e.handler === fn.name)
  if (dup) continue
  entries.push({ ic: Number(m[1]), handler: fn.name, at: m.index })
}

console.log(`找到 ${entries.length} 处 ic 赋值，来自 ${new Set(entries.map((e) => e.handler)).size} 个函数\n`)

const rows = entries.map((e) => ({ ...e, labels: labelOf(e.handler) }))
rows.sort((a, b) => a.ic - b.ic || a.at - b.at)

console.log('ic   函数      按钮文案')
console.log('-'.repeat(78))
for (const r of rows) {
  console.log(`${String(r.ic).padEnd(5)}${r.handler.padEnd(10)}${r.labels.length ? r.labels.join(' / ') : '（未找到按钮）'}`)
}

const byIc = new Map()
for (const r of rows) {
  if (!byIc.has(r.ic)) byIc.set(r.ic, [])
  byIc.get(r.ic).push(r.labels[0] ?? r.handler)
}
console.log('\n=== 按 ic 归并 ===')
for (const ic of [...byIc.keys()].sort((a, b) => a - b)) {
  console.log(`  ic=${String(ic).padEnd(4)} ${byIc.get(ic).join(' / ')}`)
}
