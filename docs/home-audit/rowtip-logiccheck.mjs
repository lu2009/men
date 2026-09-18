/*
 * 单元格 hover tooltip 的**逐字对照**（旧版 `sa`，`:7973-7980`）。
 *
 * 对照的是**内容构造**，不是 DOM 结构：旧版拼 HTML 串再 `innerHTML`，新版渲染 VNode
 * （有意偏离，见 `Home.vue` 的 `showRowTip` —— 观感一致且避开 `innerHTML`）。
 * 所以这里把旧版产出的 HTML 解析成 `(颜色, 符号, 段名)` 三元组序列 + 「已付清」那行，
 * 与新版表示逐条比。
 *
 * 另钉住一条容易看走眼的：旧版那个像是「tooltip 跟着鼠标走」的 `Va`（`:7983`）
 * **全文件零调用**，是死码 —— 位置只在进入单元格那一刻取一次。
 *
 * 用法：node docs/home-audit/rowtip-logiccheck.mjs
 */
import { SRC, assertDecoder, balanced, deobf, runLegacy } from './legacy-slice.mjs'

assertDecoder()

// ------------------------------------------------------------------ 旧版切片 //
// `sa`（`:7973`）里的内容构造 IIFE：`const n=(e=>{ … })(e);`
const SA_AT = SRC.indexOf(',sa=(e,t,l,o)=>')
if (SA_AT < 0) throw new Error('`sa` 的锚点变了')
const IIFE_AT = SRC.indexOf('(e=>{', SA_AT)
// `e` 是这一段的局部解码器（`const a=g` 在 `sa` 里，IIFE 内另有 `const t=g`）。
const BUILDER = deobf(balanced(SRC.slice(IIFE_AT), '('), ['a', 't', 'o', 'l', 'n'])
// ⚠️ 反混淆后 `const t=g` 还在（`g` 由 runLegacy 注入），`e[t(625)]` 已变成 `e["done"]` 之类。

/** 旧版：`ua`（进度段）/ `Vo`（已付清）由外部注入。 */
const legacyBuild = runLegacy(`return ${BUILDER}`, {
  g: () => undefined,
  ua: (row) => row.segments,
  Vo: (row) => row.paid,
})

// `Va` 是不是死码：全文件有没有 `Va(` 调用（排除定义处 `,Va=e=>{`）。
const VA_DEF = SRC.indexOf(',Va=e=>')
const VA_CALLS = [...SRC.matchAll(/(?<![a-zA-Z0-9_$.])Va\(/g)].filter((m) => m.index !== VA_DEF + 1)
const VA_IS_DEAD = VA_CALLS.length === 0

// ---------------------------------------------------------------- 新版的表示 //
// ⚠️ 与 `app/src/views/Home.vue` 的 `showRowTip` 同逻辑：段 → {text, done}，外加一个「已付清」行。
const newBuild = (row) => ({
  lines: row.segments.map((s) => ({ text: s.label, done: s.done })),
  paid: row.paid,
})

/** 把旧版那段 HTML 解析成同一形状。 */
function parseLegacyHtml(html) {
  if (!html) return { lines: [], paid: false }
  const lines = []
  let paid = false
  for (const m of html.matchAll(/<span style="color:(#[0-9a-f]{3,6})(?:;font-weight:700;)?"\s*>(.*?)<\/span>/g)) {
    const [, color, inner] = m
    if (inner.includes('已付清')) {
      paid = true
      continue
    }
    // `✓&nbsp;确认下单`
    const mm = /^(✓|○)&nbsp;(.*)$/.exec(inner)
    lines.push({ text: mm ? mm[2] : inner, done: mm ? mm[1] === '✓' : false, color })
  }
  return { lines, paid }
}

// -------------------------------------------------------------------- 夹具 //
const SEG = (label, done) => ({ label, done })
const ROWS = [
  { name: '全部未做且未付清', segments: [SEG('确认下单', false), SEG('生产单', false)], paid: false },
  { name: '部分完成', segments: [SEG('确认下单', true), SEG('生产单', true), SEG('玻璃订单', false)], paid: false },
  { name: '全部完成 + 已付清', segments: [SEG('确认下单', true), SEG('收据单', true)], paid: true },
  { name: '含自定义段 + 已付清', segments: [SEG('确认下单', true), SEG('我的自定义', false)], paid: true },
  { name: '没有段且未付清（不该显示）', segments: [], paid: false },
]

// -------------------------------------------------------------------- 对照 //
let pass = 0
let fail = 0
const eq = (label, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) pass++
  else {
    fail++
    console.log(`✗ ${label}\n    旧版 = ${JSON.stringify(a)}\n    新版 = ${JSON.stringify(b)}`)
  }
}
const truthy = (label, v) => {
  if (v) pass++
  else {
    fail++
    console.log(`✗ ${label}`)
  }
}

for (const row of ROWS) {
  const html = legacyBuild(row)
  const L = parseLegacyHtml(html)
  const N = newBuild(row)
  // 比 `{text, done}`；`color` 单列一条下面比（解析器多带了这个键）
  eq(`${row.name} 逐行（段名 + 完成态）`, L.lines.map(({ text, done }) => ({ text, done })), N.lines)
  eq(`${row.name} 已付清行`, L.paid, N.paid)
  // 颜色规则：完成 #52c41a、未完成 #bbb
  eq(
    `${row.name} 颜色规则`,
    L.lines.map((l) => l.color),
    N.lines.map((l) => (l.done ? '#52c41a' : '#bbb')),
  )
  // 空内容不显示（旧版 `n && (…)`）
  truthy(`${row.name} 空内容时旧版产出空串（所以不该弹）`, (html === '') === (N.lines.length === 0 && !N.paid))
}

truthy('旧版跟手函数 `Va` 是死码（全文件零调用）', VA_IS_DEAD)
console.log(`\n样例输出（第 2 行夹具）：\n  ${legacyBuild(ROWS[1])}`)
console.log(`\n对照 ${pass + fail} 条：通过 ${pass}，不符 ${fail}`)
process.exit(fail ? 1 : 0)
