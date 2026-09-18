/*
 * 「查单号」（旧版 `po`/`fo`/`ho`/`Co` + `Uo`/`So`/`To`/`Yo`/`Wo`）的**逐字对照**。
 *
 * 做法同 `rowstate-logiccheck.mjs`：把旧版源码从 `Home.formatted.js` 切出来、就地反混淆、
 * **真的跑**，拿同一批夹具跑新版实现（`app/src/views/Home.vue`）逐条比。**不手抄旧版函数** ——
 * 手抄等于引入转写错误。
 *
 * 对照的四段**纯逻辑**（其余是弹窗显隐 / 翻页 / 展开这类流程，靠读源码 + tsc + 构建兜底）：
 *   ① `Uo`（`:7694-7697`）拆单号集           → `splitOrderNos()`
 *   ② `To`（`:7699-7701`）单元格显示哪一段    → `orderNoCell()`
 *   ③ `Yo` 里的**补年份后缀**（`:7703-7709`）  → `confirmOrderNoQuery()` 第 ① 步
 *   ④ `ps` 里的 **`po` 筛选谓词**（`:11160`）  → `filtered` 里那段 filter
 *
 * ⚠️ 新版那几段是本文件里照抄的一份（同逻辑、同夹具）。改 `Home.vue` 时要同步改这里。
 *
 * 用法：node docs/home-audit/orderno-logiccheck.mjs
 */
import { readFileSync } from 'node:fs'
import { SRC, assertDecoder, balanced, between, deobf, runLegacy } from './legacy-slice.mjs'

assertDecoder()

// ---------------------------------------------------------------- 旧版源码切片 //
/** 取 `anchor` 之后那个 `{...}`（函数体），含花括号。 */
const bodyOf = (anchor) => balanced(SRC.slice(SRC.indexOf(anchor)), '{')

const UO = deobf(`e => ${bodyOf(',Uo=e=>')}`)
const TO = deobf(`e => ${bodyOf(',To=e=>')}`)

// `Yo` 里那段补年份后缀的 IIFE：`Yo=async()=>{ const e=g,t=(e=>{...})(String(fo[...]||"").trim()); ...`
// 取的是 `(e=>{...})` 这个**箭头函数本身**，不含后面的调用。
const YEAR_IIFE_START = SRC.indexOf('(e=>{', SRC.indexOf(',Yo=async()=>'))
const YEAR = deobf(balanced(SRC.slice(YEAR_IIFE_START), '('))

// `ps` 里的 `po` 分支：`po[e(755)]){ const l=po.value[...](); t=t[e(1360)]((t=>Uo(...)[...]((t=>...)))) }`
// 取 `filter(...)` 的实参 —— 那个 `(t=>...)` 谓词。
const PO_BRANCH = SRC.indexOf('po[e(755)])', SRC.indexOf('ps=Vue.computed'))
const PO_PRED_START = SRC.indexOf('((t=>', PO_BRANCH)
// ⚠️ 这段谓词用的局部解码器是 `e`（`ps` 开头那句 `const e=g`），而**切片里没有那句** ⇒
//    闭包收不到、必须手工告知（见 `legacy-slice.mjs` 的 `extraLocals`）。
const PO_PRED = deobf(balanced(SRC.slice(PO_PRED_START), '('), ['e'])

// ------------------------------------------------------------------ 旧版实例 //
// `po` 是旧版的 ref；`Uo` 是 `To` 与谓词都要用的公共件。
const legacy = runLegacy(
  `
  const Uo = ${UO}
  const So = e => Uo(e == null ? void 0 : e["单号集"])
  const To = ${TO}
  const yearSuffix = ${YEAR}
  // 谓词闭包了 ps 里的局部 l（小写后的关键字）⇒ 这里补成参数，别去猜它的值。
  // ⚠️ 本模板串里**不能出现反引号**（会把模板提前结束掉，报 "missing ) after argument list"）。
  const poPred = l => ${PO_PRED}
  return {
    split: (v) => Uo(v),
    cell: (row) => To(row),
    year: (v) => yearSuffix(v),
    match: (rows, q) => { po.value = q; return rows.filter(poPred(q.toLowerCase())) },
    setPo: (v) => { po.value = v },
  }
`,
  {
    po: { value: '' },
    // 旧版里 `Uo` 之外还引用了 `g`（局部解码器）——反混淆后已无 `X(n)` 调用，但 `const t=g` 还在。
    g: () => undefined,
  },
)

// ------------------------------------------------------------------ 新版实现 //
// ⚠️ 与 `app/src/views/Home.vue` 的 `splitOrderNos()` / `orderNoCell()` /
//    `confirmOrderNoQuery()` 第 ① 步 / `filtered` 里那段 `po` filter 同逻辑。
let poValue = '' // 新版 `orderNoQuery`
function splitOrderNos(v) {
  const s = String(v ?? '').trim()
  if (!s) return []
  return s
    .split('_')
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
}
function orderNoCell(row) {
  const parts = splitOrderNos(row?.order_no_set)
  if (!parts.length) return ''
  const q = poValue.trim().toLowerCase()
  if (!q) return parts[0] || ''
  return parts.find((p) => p.toLowerCase().startsWith(q)) || parts[0] || ''
}
function yearSuffix(raw) {
  const s = String(raw ?? '').trim()
  return s ? (/-\d{2}\b/.test(s) ? s : `${s}-${String(new Date().getFullYear()).slice(-2)}`) : ''
}
const poMatch = (rows, q) => {
  const s = q.toLowerCase()
  return rows.filter((r) => splitOrderNos(r.order_no_set).some((x) => x.toLowerCase().startsWith(s)))
}

// -------------------------------------------------------------------- 夹具 //
const ROWS = [
  { id: 1, order_no_set: '199-26_200-26' },
  { id: 2, order_no_set: ' 199-25 _ 201-25 ' }, // 两端带空白
  { id: 3, order_no_set: '199-26__202-26' }, // 双下划线 ⇒ 中间空段要去掉
  { id: 4, order_no_set: '' },
  { id: 5, order_no_set: '   ' },
  { id: 6, order_no_set: 'ABC_199-26' }, // 段在第二位
  { id: 7, order_no_set: '199' }, // 无年份后缀
  { id: 8, order_no_set: '199-26' },
]

const SPLIT_CASES = ROWS.map((r) => ({ raw: r.order_no_set, row: r })).concat([
  { raw: null, row: { order_no_set: null } },
  { raw: undefined, row: { order_no_set: undefined } },
])

const PO_CASES = ['', '199', '199-26', '199-2', '200', 'abc', 'ABC', ' 199-26 ', 'zzz']
const YEAR_CASES = ['', '  ', '199', '199-26', '199-2', 'A1', '199-', 'x199', '199-26-01', '12-3']

let pass = 0
let fail = 0

// ------------------------------------------------- 漂移守卫：对着 Home.vue 真身 //
/**
 * ⚠️ 上面「新版实现」那段是**本文件里照抄的一份**（见文件头那句）——
 * 所以**它能过，不代表 `Home.vue` 没漂**：函数改名、`_` 改成空格、`startsWith`
 * 改成 `includes`、年份换算法，这里照样全绿。
 *
 * 补一层**源码级**断言：直接从 `Home.vue` 真身里抠出对应片段，把**判据本身**钉住。
 * 这不是重复上面那批对照（那批比的是**行为**，这批比的是**实现里那几个关键 token 还在不在**）。
 */
const HOME_SRC = readFileSync(new URL('../../app/src/views/Home.vue', import.meta.url), 'utf8')

/** 取 `function <name>(` 起那段配平的 `{}`（这几个函数体里没有裸 `}` 字面量，够用）。 */
function fnBody(name) {
  const at = HOME_SRC.indexOf(`function ${name}(`)
  if (at < 0) return ''
  const i = HOME_SRC.indexOf('{', at)
  let depth = 0
  for (let k = i; k < HOME_SRC.length; k++) {
    if (HOME_SRC[k] === '{') depth++
    else if (HOME_SRC[k] === '}' && --depth === 0) return HOME_SRC.slice(i, k + 1)
  }
  return ''
}
/** 从 `anchor` 起取一小段，够看清关键 token 即可。 */
const near = (anchor, len = 400) => {
  const at = HOME_SRC.indexOf(anchor)
  return at < 0 ? '' : HOME_SRC.slice(at, at + len)
}

const drift = []
const need = (label, body, re) => {
  if (!body) drift.push(`${label}（**抠不到源码片段**，函数被改名/搬走了？）`)
  else if (!re.test(body)) drift.push(label)
}

const SPLIT_BODY = fnBody('splitOrderNos')
need('splitOrderNos 按 "_" 切', SPLIT_BODY, /split\('_'\)/)
need('splitOrderNos 逐段 trim', SPLIT_BODY, /\.trim\(\)/)
need('splitOrderNos 去掉空段', SPLIT_BODY, /filter\(Boolean\)/)
const CELL_BODY = fnBody('orderNoCell')
need('orderNoCell 用 startsWith（不是 includes）', CELL_BODY, /startsWith/)
need('orderNoCell 小写化后再比', CELL_BODY, /toLowerCase/)

const YEAR_SNIP = near('confirmOrderNoQuery', 700)
need('补年份：已带 -YY 就原样保留', YEAR_SNIP, /\\d\{2\}/)
need('补年份：取当前年份后两位', YEAR_SNIP, /getFullYear\(\)\)\.slice\(-2\)/)

// `filtered` 里那段 `po` 筛选谓词
const PO_SNIP = near('orderNosOf(r)', 300)
need('筛选谓词走 orderNosOf + startsWith', PO_SNIP, /startsWith/)
need('筛选谓词小写化后再比', PO_SNIP, /toLowerCase/)

if (drift.length) {
  fail += drift.length
  console.log('\n⛔ `Home.vue` 与本文档的模型已漂开：')
  for (const d of drift) console.log(`   ✗ ${d}`)
  console.log('   （上面那批行为对照**测不出**这个 —— 它比的是本文件里照抄的一份）\n')
} else {
  pass++
  console.log('✓ 漂移守卫：`Home.vue` 真身里那几个判据都还在（_ 切分 / startsWith / 补年份 / 小写化）')
}

// -------------------------------------------------------------------- 对照 //
const diff = (label, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) pass++
  else {
    fail++
    console.log(`✗ ${label}\n    旧版 = ${JSON.stringify(a)}\n    新版 = ${JSON.stringify(b)}`)
  }
}

// ① 拆单号集
for (const { raw, row } of SPLIT_CASES) {
  diff(`Uo/splitOrderNos  ${JSON.stringify(raw)}`, legacy.split(raw), splitOrderNos(raw))
  // ② 单元格显示（`po` 为空 / 各关键字下都要一致）
  for (const q of PO_CASES) {
    legacy.setPo(q)
    poValue = q
    diff(
      `To/orderNoCell  ${JSON.stringify(raw)} @po=${JSON.stringify(q)}`,
      legacy.cell({ 单号集: raw }),
      orderNoCell(row),
    )
  }
}

// ③ 补年份后缀
for (const v of YEAR_CASES) diff(`Yo 年份后缀  ${JSON.stringify(v)}`, legacy.year(v), yearSuffix(v))

// ④ `po` 筛选谓词
const legacyRows = ROWS.map((r) => ({ 单号集: r.order_no_set }))
for (const q of PO_CASES.filter(Boolean)) {
  const l = legacy.match(legacyRows, q).map((r) => r.单号集)
  const n = poMatch(ROWS, q).map((r) => r.order_no_set)
  diff(`ps po 筛选 @po=${JSON.stringify(q)}`, l, n)
}

// ⑤ 记一笔：`-\d{2}\b` 的边界行为（`199-26-01` 会被判为「已有后缀」）
console.log(`边界：\`199-26-01\` → 旧版 ${JSON.stringify(legacy.year('199-26-01'))}，新版 ${JSON.stringify(yearSuffix('199-26-01'))}`)
console.log(`边界：\`199\`(今年 ${new Date().getFullYear()}) → ${JSON.stringify(yearSuffix('199'))}`)

console.log(`\n对照 ${pass + fail} 条：通过 ${pass}，不符 ${fail}`)
process.exit(fail ? 1 : 0)
