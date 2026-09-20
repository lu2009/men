/*
 * 行状态判据的**逐字对照**：把旧版 `Ko`/`Zo`/`Xo`/`Qo`/`so`/`Vo` 的**原始源码**从
 * `legacy/js/Home.formatted.js` 里切出来、就地反混淆后**真的跑起来**，再拿同一批夹具跑新版实现，
 * 逐条比结果。**不手抄旧版函数** —— 手抄等于引入转写错误，本项目已经栽过（见 00-summary 的「教训」）。
 *
 * 对照对象（旧版 → 新版，**都不在 `Home.vue` 里了** —— 2026-09-20 两次归位之后）：
 *   `Ko`  → `dupKey()` 里的 `k()`     —— `composables/home/useHomeRowStatus.ts`（Task 11 搬出）
 *   `Zo`  → `dupKey()`                —— 同上
 *   `Xo`  → `duplicateKeys`（computed）—— 同上
 *   `Qo`  → `rowClass()`              —— 同上
 *   `so`  → `unpaidOf()`（摘要缺失时的回退分支）—— `utils/homeMetrics.ts`（Task 2 搬出）
 *   `Vo`  → 客户列 render 里的 `unpaidOf(row) === 0` —— 那个 render **还在 `Home.vue`**（`columns` 内）
 *
 * ⚠️ **新版那几段是本文件里照抄的一份**（同逻辑、同夹具）。改**上面那两处**时要同步改这里。
 * ★ **本台子不读那个文件**（它只读旧版 bundle）⇒ 那两处搬走时它**不会报红**（实测：105 条照过）。
 *   ⇒ 也就是说：**真身改了、这里没跟，两边会静默漂开，台子照样绿**。
 *   `dupKey`/`duplicateKeys`/`rowClass` 的**搬迁保真**由 `home-extract-movecheck.mjs` 逐字守着
 *   （B7 一条），但**逻辑漂移**这台子测不出来 —— 改了判据就**顺手**改这里那份副本。
 *
 * 用法：node docs/home-audit/rowstate-logiccheck.mjs
 *   前置：/tmp/home-map.json（由 legacy/decode-home-map.mjs 生成）
 */
import { SRC, assertDecoder, between, deobf, runLegacy } from './legacy-slice.mjs'

assertDecoder()

/** 取 `[from .. to)` 之间的源码（锚点不存在就抛，别静默切错）。 */
const slice = (from, to) => between(from, to, SRC)

// 各函数的右值源码（**原样**，未反混淆）。
const RAW = {
  Ko: slice('Ko=e=>', ',Zo=e=>'),
  Zo: slice('Zo=e=>', ',Xo=Vue.computed'),
  Xo: slice('Xo=Vue.computed', ',Qo=({'),
  // ⚠️ 锚点必须带上前导的 `,`：`Qo=` 在全文出现 **2 次**，只用 `Qo=` 会切到前面那处、切片大得离谱
  //    （实测切出 1600+ 处「未命中」，就是这个原因）。
  Qo: `({${slice(',Qo=({', ',Ro=(e,t)=>')}`,
  so: slice('so=e=>', ',Vo=e=>'),
  Vo: slice('Vo=e=>', ',mo=Vue.reactive'),
}

const D = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, deobf(v)]))

// 旧版函数里还引用的外部量（都由 `runLegacy` 注入）：
//   `Ht` —— 「启用新财务系统」开关（`:7581`），决定 `so` 走哪个分支。
//           夹具里取 `false` ⇒ 走**回退分支**（总价-定金），与新版 `unpaidOf` 摘要缺失时一致。
//   `g`  —— 局部解码器；反混淆后已无 `X(n)` 调用，但函数体里的 `const t=g` 还在，得给个值。
//   `Vue`—— 只需要 `computed`；真 Vue 的 computed 是惰性的，这里给个等价的 getter 版。
const legacy = runLegacy(
  `
  const Ko = e => ${D.Ko}
  const so = e => ${D.so}
  const Zo = e => ${D.Zo}
  const Vo = e => ${D.Vo}
  const ps = { value: [] }
  const jo = { value: new Set() }
  const _o = { value: new Set() }
  const Xo = Vue.computed(${D.Xo})   // 切片是从 Vue.computed **之后**起的，所以这里补回包装
  const Qo = ${D.Qo}
  return {
    Zo,
    Vo,
    dupKeys: (rows) => { ps.value = rows; return Xo.value },
    rowClass: (row) => Qo({ row }),
    setState: (expanded, loaded) => { jo.value = new Set(expanded); _o.value = new Set(loaded) },
  }
`,
  {
    Vue: { ref: (v) => ({ value: v }), computed: (fn) => ({ get value() { return fn() } }) },
    g: () => undefined,
    Ht: { value: false },
  },
)

// ------------------------------------------------------------------ 新版实现 //
// ⚠️ 与 `app/src/composables/home/useHomeRowStatus.ts` 的 `dupKey()` / `duplicateKeys` / `rowClass()`
// 同逻辑（2026-09-20 随 B7 搬去那里；此前在 `app/src/views/Home.vue`）。
// （`unpaidOf()` 2026-09-20 随 B2 搬去 `app/src/utils/homeMetrics.ts`。）
function dupKey(r) {
  const k = (v) => (v == null ? '' : String(v).trim())
  const client = k(r.client_name)
  const doors = k(r.door_count)
  const total = k(r.total_price)
  return client && doors && total ? `${client}__${doors}__${total}` : ''
}
function duplicateKeys(rows) {
  const counts = new Map()
  for (const r of rows) {
    const k = dupKey(r)
    if (!k) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const out = new Set()
  counts.forEach((n, k) => {
    if (n > 1) out.add(k)
  })
  return out
}
function rowClass(r, expanded, loaded, dups) {
  const classes = []
  if (expanded.has(r.id)) classes.push('expanded-row')
  if (loaded.has(r.id)) classes.push('loaded-row')
  const k = dupKey(r)
  if (k && dups.has(k)) classes.push('duplicate-order-row')
  return classes.join(' ')
}
/** 新版 `unpaidOf`（`app/src/utils/homeMetrics.ts`，2026-09-20 前在 `Home.vue`）的回退分支（摘要缺失时）。 */
const unpaidOf = (r) => r.total_price - r.deposit

// -------------------------------------------------------------------- 夹具 //
// 覆盖：正常重复 / 缺字段（空串、null）/ 数值 0 / 小数 / 前后空白 / 单条不重复。
const FIXTURES = [
  { id: 1, receipt_no: 'A1', client_name: '张三', door_count: 2, total_price: 3000, deposit: 3000 },
  { id: 2, receipt_no: 'A2', client_name: '张三', door_count: 2, total_price: 3000, deposit: 0 }, // ← 与 A1 重复
  { id: 3, receipt_no: 'A3', client_name: '李四', door_count: 1, total_price: 1500, deposit: 500 },
  { id: 4, receipt_no: 'A4', client_name: '王五', door_count: null, total_price: 2000, deposit: 0 }, // 门数 null ⇒ 无键
  { id: 5, receipt_no: 'A5', client_name: '', door_count: 3, total_price: 2000, deposit: 0 }, // 客户空 ⇒ 无键
  { id: 6, receipt_no: 'A6', client_name: '赵六', door_count: 0, total_price: 0, deposit: 0 }, // 全 0 ⇒ **有键**
  { id: 7, receipt_no: 'A7', client_name: '赵六', door_count: 0, total_price: 0, deposit: 0 }, // ← 与 A6 重复
  { id: 8, receipt_no: 'A8', client_name: ' 孙七 ', door_count: '1', total_price: 999.5, deposit: 0 }, // 两端空白
  { id: 9, receipt_no: 'A9', client_name: '孙七', door_count: 1, total_price: 999.5, deposit: 0 }, // ← trim 后重复
  { id: 10, receipt_no: 'B1', client_name: '周八', door_count: 2, total_price: 100.1, deposit: 0 },
  { id: 11, receipt_no: 'B2', client_name: '周八', door_count: 2, total_price: 100.1, deposit: 50 }, // ← 重复
  { id: 12, receipt_no: 'B3', client_name: '吴九', door_count: 1, total_price: 0, deposit: 0 }, // 未收 0
  { id: 13, receipt_no: 'C1', client_name: '郑十', door_count: 3, total_price: 2500.75, deposit: 2500.75 }, // 小数恰好清零
]

// 旧版按 `回执单号` 建集合（它的 `row-key` 就是它，`:11300`）；夹具里 `id` 与 `receipt_no` 一一对应。
const toLegacy = (r) => ({
  客户: r.client_name,
  门数: r.door_count,
  总价: r.total_price,
  定金: r.deposit,
  回执单号: r.receipt_no,
})

// -------------------------------------------------------------------- 对照 //
let pass = 0
let fail = 0
const diff = (label, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) pass++
  else {
    fail++
    console.log(`✗ ${label}\n    旧版 = ${JSON.stringify(a)}\n    新版 = ${JSON.stringify(b)}`)
  }
}

// ① 键函数
for (const r of FIXTURES) diff(`Zo/dupKey  ${r.receipt_no}`, legacy.Zo(toLegacy(r)), dupKey(r))

// ② 重复键集合
const legacyRows = FIXTURES.map(toLegacy)
const lDups = legacy.dupKeys(legacyRows)
const nDups = duplicateKeys(FIXTURES)
diff('Xo/duplicateKeys（键集合）', [...lDups].sort(), [...nDups].sort())

// ③ `paid-row`：旧版产出、新版不产出（旧版全库无该类的 CSS 规则 ⇒ 死码，有意不做）
legacy.setState([], [])
const lPaid = FIXTURES.filter((r) => legacy.rowClass(toLegacy(r)).includes('paid-row')).map((r) => r.receipt_no)
const nPaid = FIXTURES.filter((r) => rowClass(r, new Set(), new Set(), nDups).includes('paid-row')).map(
  (r) => r.receipt_no,
)
console.log(`paid-row：旧版命中 [${lPaid}]，新版命中 [${nPaid}]（预期新版为空 —— 旧版加类但无 CSS 规则）`)

// ④ 行类：拿「去掉 paid-row 之后」的旧版输出与新版的比
const stripPaid = (s) =>
  s
    .split(' ')
    .filter((c) => c && c !== 'paid-row')
    .join(' ')
const STATE_GROUPS = [
  [[], []],
  [['A1'], []],
  [['A1'], ['A1']],
  [['A2', 'B3'], ['A2']],
  [['C1', 'A6'], ['C1', 'A6', 'B1']],
  [FIXTURES.map((r) => r.receipt_no), FIXTURES.map((r) => r.id).slice(0, 3).map((i) => FIXTURES[i - 1].receipt_no)],
]
for (const [exp, load] of STATE_GROUPS) {
  legacy.setState(exp, load)
  const e = new Set(FIXTURES.filter((r) => exp.includes(r.receipt_no)).map((r) => r.id))
  const d = new Set(FIXTURES.filter((r) => load.includes(r.receipt_no)).map((r) => r.id))
  for (const r of FIXTURES) {
    diff(
      `Qo/rowClass ${r.receipt_no} (展开${exp.length}/已载${load.length})`,
      stripPaid(legacy.rowClass(toLegacy(r))),
      rowClass(r, e, d, nDups),
    )
  }
}

// ⑤ 客户列绿块
for (const r of FIXTURES) diff(`Vo/unpaidOf===0  ${r.receipt_no}`, legacy.Vo(toLegacy(r)), unpaidOf(r) === 0)

console.log(`\n对照 ${pass + fail} 条：通过 ${pass}，不符 ${fail}`)
process.exit(fail ? 1 : 0)
