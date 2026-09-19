/*
 * Progress「日期」列**行勾选**的差分台：同一批夹具、同一串操作，
 * 左边跑**旧版真代码**（`Jl` / `Rl` / `$l`，从 `Progress-f4bdef35.js` 解混淆后切出来真跑），
 * 右边跑**新版真代码**（`app/src/views/Progress.vue` 的 `allSelected` / `toggleSelectAll`）。
 *
 * 为什么值得单独盯 —— 这套语义里有**两条反直觉**、抄错不报错的地方：
 *   ① 表头「全选」盖的是**当前筛选结果** `no`（不是当前页，也不是全量 `K`）；
 *   ② 而「取消全选」清的是**全量 `K`**（不是 `no`）⇒ 被筛掉的那些行**也会被清掉**。
 *   这两条在页面上「点一下看不出差别」（只有翻页/换筛选词之后才暴露），肉眼验收必漏。
 *
 * 比四样东西（每一步操作之后都逐条比）：
 *   · 每行的 `isSelected`
 *   · 旧版 `te.ping_hui.length + te.diao_hui.length` ⟷ 新版「勾选行数」（= 工具条 `ea` 的口径）
 *   · 旧版 `Rl.value`（表头勾选框的 model-value）⟷ 新版 `allSelected.value`
 *   · 表头那颗勾选框**能不能被点出来**（全选/取消全选各来一次）
 *
 * ⚠️ **这台差分台不覆盖的东西**（别以为它绿了就全都对）：
 *   1. **`Jl` 往 `ping_hui`/`diao_hui` 里塞的那一整份行对象**（40 多个字段的搬运）。
 *      新版**根本不建那两个数组**（打印改走「订单 + 行」链路，见 Progress.vue 的 `printOrdersOf`），
 *      所以这里只比**条数**，不比对象内容 —— 那是**有意的结构差异**，不是抄漏。
 *   2. 勾选框的**渲染**（naive `n-checkbox` 的 `checked` 回写）。这里测的是两个 handler 的**语义**，
 *      不是 DOM 事件。
 *   3. 「批量更新」的弹窗与写库（那要后端，且旧版走的是另一套 id/单号分流）。
 *
 * ⚠️ 夹具只有能说清「夹具本身与旧版口径不符」时才能改，且要写明理由 —— 不许为了让测试变绿改夹具。
 *
 * 用法：node docs/progress-select-logiccheck.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const BUNDLE = resolve(ROOT, 'legacy/js/Progress-f4bdef35.js')
const MAP = '/tmp/progress-map.json'
const DECODED = '/tmp/progress.decoded.js'
const VUE = resolve(ROOT, 'app/src/views/Progress.vue')

// ---------------------------------------------------------------- 旧版侧 //
if (!existsSync(DECODED) || !existsSync(MAP)) {
  console.log('（首次）解混淆旧版 bundle …')
  execFileSync('node', [resolve(ROOT, 'legacy/decode-progress-map.mjs'), BUNDLE, MAP], { stdio: 'inherit' })
  execFileSync('node', [resolve(ROOT, 'legacy/decode-progress-scoped.mjs'), BUNDLE, MAP, DECODED], {
    stdio: 'inherit',
  })
}
const decoded = readFileSync(DECODED, 'utf8')

/** 唯一命中才肯用 —— 不唯一就说明解码输出变了，先看一眼再改锚点。 */
function cut(src, startAnchor, endAnchor, what) {
  const a = src.indexOf(startAnchor)
  if (a < 0) throw new Error(`旧版锚点没命中（${what} 的起点）：${startAnchor}`)
  if (src.indexOf(startAnchor, a + 1) >= 0) throw new Error(`旧版锚点不唯一（${what} 的起点）`)
  const b = src.indexOf(endAnchor, a)
  if (b < 0) throw new Error(`旧版锚点没命中（${what} 的终点）：${endAnchor}`)
  return src.slice(a, b)
}

/*
 * 旧版这三个声明是**一条** `const …` 链上连续的三个：
 *   `Jl=(e,t)=>{…}, Rl=Vue.computed((()=>{…})), $l=e=>{…}, ea=Vue.computed(…)`
 * ⇒ 从 `Jl=` 切到 `ea=Vue.computed`（不含），再补一个 `const ` 前缀、去掉尾部悬空的逗号。
 *
 * 切出来的这段引用了页面作用域的 `te`（勾选行数组）、`no`（筛选后行）、`K`（全量行）、
 * `ae`（只重算「已选 id」的那个函数）、`f`（混淆器的作用域哨兵，原样保留、注入一个空函数）、
 * `Vue`（只需要 `computed`）—— 全部由下面的 `legacyRun` 注入。
 */
const SELECT_RAW = cut(decoded, 'Jl=(e,t)=>{', 'ea=Vue.computed', '勾选三件套').replace(/,\s*$/, '')
if (SELECT_RAW.length < 1800 || !SELECT_RAW.includes('Rl=Vue.computed') || !SELECT_RAW.includes('$l=e=>{')) {
  throw new Error(`旧版勾选段形状不对（len=${SELECT_RAW.length}）`)
}
const LEGACY_SRC = `
  const ${SELECT_RAW};
  return { Jl, Rl, $l }
`

/**
 * 跑一段「旧版真代码」：注入它需要的页面作用域桩，回传三个东西（`Jl` / `Rl` / `$l`）。
 * `rowsRef`/`filteredRef` 是**同一个 model** 的两个视图（`K` 与 `no`）；`te` 由调用方建，
 * 好让**勾选条数**（`ping_hui.length + diao_hui.length` = 旧版的 `ea`）能在外面对着比。
 */
function makeLegacy(rowsRef, filteredRef, te) {
  const ae = () => {}
  const f = () => {}
  const Vue = { computed: (fn) => ({ value: fn() }) }
  const fn = new Function('te', 'no', 'K', 'ae', 'f', 'Vue', LEGACY_SRC)
  return fn(te, filteredRef, rowsRef, ae, f, Vue)
}

// ---------------------------------------------------------------- 新版侧 //
const vue = readFileSync(VUE, 'utf8')

function cutVue(startAnchor, endAnchor, what) {
  const a = vue.indexOf(startAnchor)
  if (a < 0) throw new Error(`新版锚点没命中（${what} 的起点）：${startAnchor}`)
  if (vue.indexOf(startAnchor, a + 1) >= 0) throw new Error(`新版锚点不唯一（${what} 的起点）`)
  const b = vue.indexOf(endAnchor, a)
  if (b < 0) throw new Error(`新版锚点没命中（${what} 的终点）：${endAnchor}`)
  return vue.slice(a, b)
}

// 从 `allSelected` 到 `openBatchUpdate`（不含）—— 正好是「表头全选 + 两个 handler」这一段。
const NEW_TS = cutVue('const allSelected = computed(', 'function openBatchUpdate(', '勾选段')
if (!NEW_TS.includes('function toggleSelectAll(') || NEW_TS.length < 700) {
  throw new Error(`新版勾选段形状不对（len=${NEW_TS.length}）`)
}

const require = createRequire(resolve(ROOT, 'app/package.json'))
const esbuild = require('esbuild')
const toCjs = (ts) => esbuild.transformSync(ts, { loader: 'ts', format: 'cjs', charset: 'utf8' }).code

const NEW_SRC = `${toCjs(NEW_TS)}\n return { allSelected, toggleSelectAll }`
const { computed } = require(resolve(ROOT, 'app/node_modules/vue/dist/vue.cjs.js'))

/** 跑新版那一段：`rows` / `filteredRows` 由外部注入（与旧版的 `K` / `no` 对应）。 */
function makeNew(rowsRef, filteredRef) {
  return new Function('rows', 'filteredRows', 'computed', NEW_SRC)(rowsRef, filteredRef, computed)
}

// ------------------------------------------------------------------ 夹具 //
/**
 * 一行的最小形状：勾选段只读 `isSelected`（旧版 `Jl` 还读 `吊脚` 来分 ping/diao 两个桶，
 * 以及那一大串只为「打印时拼标签」存在的字段 —— 那些**不影响**勾选语义，夹具里给 `吊脚` 就够）。
 * `tag` 只用于报错时指出是哪一行。
 */
const row = (tag, jiao) => ({ tag, id: tag, 吊脚: jiao, isSelected: false })

/** 一整套夹具：`all` = 全量行（旧版 `K`），`filteredIdx` = 当前筛选结果（旧版 `no`）取全量的哪几个下标。 */
const CASES = [
  {
    name: '全选 → 取消全选（筛选结果 = 全量）',
    jiao: [0, 1, 2, 3, 4],
    ops: [
      { op: 'filter', idx: [0, 1, 2, 3, 4] },
      { op: 'all', v: true },
      { op: 'all', v: false },
    ],
  },
  {
    name: '筛选结果只是全量的一部分：全选只勾筛选结果',
    jiao: [0, 1, 2, 3, 4],
    ops: [
      { op: 'filter', idx: [1, 3] },
      { op: 'all', v: true },
    ],
  },
  {
    name: '★ 取消全选清的是「全量」而不是「筛选结果」',
    jiao: [0, 1, 2, 3, 4],
    ops: [
      { op: 'filter', idx: [0, 1, 2, 3, 4] },
      { op: 'row', i: 4, v: true }, // 先勾一个马上要被筛掉的行
      { op: 'filter', idx: [0, 1] }, // 换筛选词 ⇒ 第 5 行不在 no 里了
      { op: 'all', v: true },
      { op: 'all', v: false }, // ← 旧版这里连「不在筛选结果里」的第 5 行一起清
    ],
  },
  {
    name: '逐行勾选 / 取消（含移门行）',
    jiao: [0, null, 3, null, 5],
    ops: [
      { op: 'filter', idx: [0, 1, 2, 3, 4] },
      { op: 'row', i: 1, v: true },
      { op: 'row', i: 3, v: true },
      { op: 'row', i: 1, v: false },
      { op: 'row', i: 4, v: true },
    ],
  },
  {
    name: '点两次同一行（幂等）',
    jiao: [0, 1],
    ops: [
      { op: 'filter', idx: [0, 1] },
      { op: 'row', i: 0, v: true },
      { op: 'row', i: 0, v: true },
      { op: 'row', i: 0, v: false },
      { op: 'row', i: 0, v: false },
    ],
  },
  {
    name: '空表：全选点不出勾（`every` 对空数组恒真，旧版另有 `length>0` 前置）',
    jiao: [],
    ops: [
      { op: 'filter', idx: [] },
      { op: 'all', v: true },
    ],
  },
]

// ------------------------------------------------------------------ 跑比 //
let failed = 0
let steps = 0

for (const c of CASES) {
  // 两个 model **各自一份行对象**（旧版与新版不能共用同一批对象，否则是在自己跟自己比）。
  const legacyRows = c.jiao.map((j, i) => row(i, j))
  const newRows = c.jiao.map((j, i) => row(i, j))

  // 旧版侧：`K` = 全量、`no` = 筛选后（同一批对象，只是两个视图，与页面一致）
  const K = { value: legacyRows }
  const no = { value: legacyRows }
  const te = { value: { ping_hui: [], diao_hui: [] } }
  const legacy = makeLegacy(K, no, te)
  // 新版侧：`rows` = 全量、`filteredRows` = 筛选后
  const rowsRef = { value: newRows }
  const filteredRef = { value: newRows }
  const now = makeNew(rowsRef, filteredRef)

  const problems = []

  for (const [si, op] of c.ops.entries()) {
    if (op.op === 'filter') {
      no.value = op.idx.map((i) => legacyRows[i])
      filteredRef.value = op.idx.map((i) => newRows[i])
    } else if (op.op === 'all') {
      legacy.$l(op.v)
      now.toggleSelectAll(op.v)
    } else {
      // 行内勾选框：旧版是 `onUpdate:modelValue`（写 isSelected）+ `onChange: Jl(row, v)`
      const lr = legacyRows[op.i]
      lr.isSelected = op.v
      legacy.Jl(lr, op.v)
      newRows[op.i].isSelected = op.v
    }
    steps++

    const at = `第 ${si + 1} 步（${JSON.stringify(op)}）后`

    // ① 每行 isSelected
    for (let i = 0; i < c.jiao.length; i++) {
      if (legacyRows[i].isSelected !== newRows[i].isSelected) {
        problems.push(
          `${at}第 ${i} 行：旧版 ${legacyRows[i].isSelected} / 新版 ${newRows[i].isSelected}`,
        )
      }
    }
    // ② 勾选条数（= 工具条「批量更新 (n)」的那个 n = 旧版 `ea`）
    const legacyCount = te.value.ping_hui.length + te.value.diao_hui.length
    const newCount = newRows.filter((r) => r.isSelected).length
    if (legacyCount !== newCount) {
      problems.push(`${at}条数：旧版 te=${legacyCount} / 新版勾选=${newCount}`)
    }
    // ③ 表头勾选框的 model-value（旧版 `Rl`）
    if (legacy.Rl.value !== now.allSelected.value) {
      problems.push(`${at}表头全选态：旧版 ${legacy.Rl.value} / 新版 ${now.allSelected.value}`)
    }
  }

  if (problems.length) {
    failed++
    console.log(`✗ ${c.name}`)
    for (const p of problems) console.log(`    ${p}`)
  } else {
    console.log(`✓ ${c.name}`)
  }
}

console.log(`\n${CASES.length - failed}/${CASES.length} 组夹具一致（共 ${steps} 步）`)
if (failed) {
  console.log('✗ 有夹具不一致 —— 要么新版抄错了，要么夹具与旧版口径不符（后者要写明理由）。')
  process.exit(1)
}
console.log('✓ 全部一致')
