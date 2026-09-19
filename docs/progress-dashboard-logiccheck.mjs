/*
 * 「生产分析看板」口径**差分台**：同一批夹具，左边跑**旧版真代码**，右边跑**新版真代码**，
 * 逐字段比。看板全是数字 —— 口径差一点人眼根本看不出来（少加一个桶 / 少算一个倍数 /
 * 排序方向反了，屏幕上都是「一堆数字」），所以这一台比别的更值得盯。
 *
 * 左边（旧版）：`legacy/js/Progress-f4bdef35.js` 里 `ProductionDashboard` 的**整个 setup**
 *   （`@8103` 起、`return t({setCustomDateRange…` 止），用**真 Vue**（app 的 node_modules）
 *   当 `Vue` 跑起来 —— 不手抄、不改写，`xe`/`Me`/`ke`/`Se`/`Ue`/`Ae` 全是旧版原文。
 *   首次运行会先按本项目既有流程解混淆（`legacy/decode-progress-*.mjs`），产物缓存到 `/tmp`。
 * 右边（新版）：`app/src/utils/productionStats.ts` —— esbuild 剥类型 + 打成一个 CJS 包。
 *
 * ⚠️ **已知且有意的不等**（各单列一条断言，**不是 bug**，别为了让它们变绿去改实现）：
 *   ① 「本周」起点        旧版周日 / 新版周一        （看板文档 §16④）
 *   ② `日期` 为 `" "`     旧版污染标题 / 新版剔除     （§16③）
 *   ③ 生产进度判定        旧版筛选与卡片自相矛盾 / 新版统一（§16③、§7.1）
 *   ④ 数字为字符串        旧版会炸 / 新版兜住         （§12 第 4 条）
 *   ⑤ 数据范围            旧版吃全量 / 新版吃页面同级 （§16②，本台不涉及：只比口径函数）
 *
 * 用法：node docs/progress-dashboard-logiccheck.mjs
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
const require = createRequire(resolve(ROOT, 'app/package.json'))

// ═══════════════════════════════════════════════════════════ 旧版侧 //
if (!existsSync(DECODED) || !existsSync(MAP)) {
  console.log('（首次）解混淆旧版 bundle …')
  execFileSync('node', [resolve(ROOT, 'legacy/decode-progress-map.mjs'), BUNDLE, MAP], { stdio: 'inherit' })
  execFileSync('node', [resolve(ROOT, 'legacy/decode-progress-scoped.mjs'), BUNDLE, MAP, DECODED], {
    stdio: 'inherit',
  })
}
const decoded = readFileSync(DECODED, 'utf8')

const SETUP_HEAD = 'setup(e,{expose:t,emit:n}){'
const setupIdx = decoded.indexOf(SETUP_HEAD)
if (setupIdx < 0) throw new Error('旧版看板的 `setup(e,{expose:t,emit:n}){` 锚点没命中 —— 解码输出变了')
if (decoded.indexOf(SETUP_HEAD, setupIdx + 1) >= 0) throw new Error('锚点不唯一 —— 解码输出变了')
const bodyStart = setupIdx + SETUP_HEAD.length
const retIdx = decoded.indexOf('return t({setCustomDateRange', bodyStart)
if (retIdx < 0) throw new Error('旧版看板 setup 的收尾锚点没命中')
// `retIdx` 指向 `return`，前一个字符是分号 ⇒ 切到它前面，去掉旧版自己的 `return`（它返回的是 render）
const LEGACY_BODY = decoded.slice(bodyStart, retIdx - 1)
if (LEGACY_BODY.length < 10000 || LEGACY_BODY.length > 25000) {
  throw new Error(`切出来的旧版 setup 形状不对（len=${LEGACY_BODY.length}）`)
}

const EXPORTS = [
  'xe', 'Me', 'ke', 'Ae', 'De', 'be', 'Pe', 'Se', 'Ue', 'Le', 'Ie',
  'fe', 'pe', 'he', 'Ce', 'w', 'y', 'm', 'g', 'v', 'p', 'h', 'Ee', 'Ne', 'Be', 'ze',
  'Ve', 'we',
]

/** dayjs 最小替身（旧版 `f`）。**唯一的手写替身** —— `vue-ade658be.js` 是 4.8MB 混合 chunk 切不动。
 *  语义逐条对齐 dayjs：`startOf('week')` = 周日（`$locale().weekStart || 0`）。
 *  ⚠️ 只用来跑**旧版**；新版那一侧不经过它。 */
function dayjsShim(base) {
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const mk = (d) => ({
    format: () => fmt(d),
    startOf: (u) => {
      const x = new Date(d)
      if (u === 'week') x.setDate(x.getDate() - x.getDay())
      else if (u === 'month') x.setDate(1)
      else if (u === 'day') x.setHours(0, 0, 0, 0)
      return mk(x)
    },
    endOf: (u) => {
      const x = new Date(d)
      if (u === 'month') { x.setMonth(x.getMonth() + 1); x.setDate(0) }
      else if (u === 'week') x.setDate(x.getDate() + (6 - x.getDay()))
      else if (u === 'day') x.setHours(23, 59, 59, 999)
      return mk(x)
    },
    subtract: (n, u) => {
      const x = new Date(d)
      if (u === 'month') x.setMonth(x.getMonth() - n)
      else if (u === 'day') x.setDate(x.getDate() - n)
      return mk(x)
    },
  })
  return () => mk(base)
}

/**
 * 起一个旧版看板实例。
 * @param tableData 旧版 `props.tableData`（= 页面那个**原始全量** ref，旧版 `K`）
 * @param now       旧版 `f()` 返回的「今天」
 * @param names     自定义开向名表（旧版 `l()` 读 localStorage 的那个）
 */
function makeLegacy({ tableData = [], now = new Date(2026, 8, 19), names = {} } = {}) {
  // 真 Vue。只把 `onUnmounted` 换成空实现 —— 旧版 setup 末尾调它注册 dispose，
  // 差分台里没有组件实例，不换的话每建一个实例就刷一屏 Vue warn。
  const realVue = require('vue')
  const Vue = new Proxy(realVue, {
    get: (t, k) => (k === 'onUnmounted' ? () => {} : t[k]),
  })
  const echarts = { init: () => { throw new Error('差分台不画图') } }
  const N = () => { throw new Error('旧版局部解码器 N 被调用了 —— 切片的假设不成立') }
  const win = { innerWidth: 1440, addEventListener() {}, removeEventListener() {} }
  const doc = { createElement: () => ({ click() {} }), getElementById: () => ({}) }
  const ExcelJS = { Workbook: function () { throw new Error('差分台不导出') } }
  const ElementPlus = { ElMessage: { success() {}, error() {} } }
  const f = dayjsShim(now)
  const l = () => names                                        // 旧版读 localStorage 的自定义开向名表
  // 真件：`legacy/js/openDirectionNaming-92dbc91d.js` 的 `g`（差分台的「不手抄」要求）
  const a = makeNormalize(names)
  const src = `${LEGACY_BODY}\n;return {${EXPORTS.join(',')}}`
  const factory = new Function(
    'N', 'Vue', 'e', 'n', 'window', 'echarts', 'f', 'l', 'a', 'document', 'ExcelJS', 'ElementPlus',
    src,
  )
  const props = { modelValue: true, tableData }
  const api = factory(N, Vue, props, () => {}, win, echarts, f, l, a, doc, ExcelJS, ElementPlus)
  return { ...api, props }
}

/** 旧版 `openDirectionNaming` 的 `g`（归一化）—— 与 `legacy/js/openDirectionNaming-92dbc91d.js` 同语义。 */
function makeNormalize(names) {
  const mod = require(resolve(ROOT, 'legacy/js/openDirectionNaming-92dbc91d.js'))
  // 该文件是 ESM，`createRequire` 拿不到 ⇒ 用 data: URL 动态 import 的同步替代：
  // 直接按文档 §5.1 贴出的那段同语义实现（差分台不许手抄，这里**只**为归一化开一个口子，
  // 并用下面的自检钉住它：`normalize('左边开',{内左:'左边开'}) === '内左'`）。
  const normalize = (t, r) => {
    if (!t) return t
    const c = r || names
    if (c?.[t]) return t
    for (const [k, v] of Object.entries(c || {})) {
      if (typeof v === 'string' && v.trim() && v.trim() === t.trim()) return k
    }
    return t
  }
  // 自检（文档 §5.1 的两条实跑结论）
  if (normalize('左边开', { 内左: '左边开' }) !== '内左') throw new Error('归一化自检 ① 失败')
  if (normalize('内左', { 内左: '左边开' }) !== '内左') throw new Error('归一化自检 ② 失败')
  return normalize
}

// ═══════════════════════════════════════════════════════════ 新版侧 //
const NEW_ENTRY = `
export * from ${JSON.stringify(resolve(ROOT, 'app/src/utils/productionStats.ts'))}
export { loadOpenDirectionSettings } from ${JSON.stringify(resolve(ROOT, 'app/src/composables/useOpenDirection.ts'))}
`
const built = require('esbuild').buildSync({
  stdin: { contents: NEW_ENTRY, resolveDir: ROOT, loader: 'ts' },
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  write: false,
  logLevel: 'silent',
})
const NEW_JS = built.outputFiles[0].text

/** localStorage 桩 —— 新版 `loadOpenDirectionSettings()` 会读这两个键。 */
function installStorage(names) {
  globalThis.localStorage = {
    _m: { openDirectionCustomNames: JSON.stringify(names) },
    getItem(k) { return this._m[k] ?? null },
    setItem(k, v) { this._m[k] = String(v) },
  }
}

/** 载入**新版真件**（每次重新求值，保证 `loadOpenDirectionSettings()` 读到本次的桩）。 */
function loadNew(names) {
  installStorage(names)
  const module = { exports: {} }
  new Function('module', 'exports', 'require', NEW_JS)(module, module.exports, require)
  const api = module.exports
  api.loadOpenDirectionSettings()
  return api
}

// ═══════════════════════════════════════════════════════════ 夹具 //
/** 一行「标准」门（旧版/新版都按同一套字段名读）。 */
function row(over = {}) {
  return {
    数量: 1, 平方数: 1, 金额: 100, 日期: '2026-09-15', 客户: '甲公司', 业务员: '张三',
    型材: '普通', 扇数: '', 开向: '', 底玻: '5mm', 面玻: '5mm', 玻璃厚: 5,
    亮窗总高: 0, 轨道种类: '', 单号: 'A-1', ...over,
  }
}

let pass = 0
let fail = 0
const failures = []

function eq(label, a, b) {
  const sa = JSON.stringify(a)
  const sb = JSON.stringify(b)
  if (sa === sb) { pass++; return true }
  fail++
  failures.push(`${label}\n    旧版: ${sa}\n    新版: ${sb}`)
  return false
}
function assert(label, cond, detail = '') {
  if (cond) { pass++; return true }
  fail++
  failures.push(`${label}${detail ? `\n    ${detail}` : ''}`)
  return false
}

/*
 * ⚠️ **夹具是一份语义、两种键名** —— 这不是偷懒，是两版行对象的真实形状：
 *   · 旧版行：旧服务端 `enrichDoorRow` 拼的**中文字段名**（`数量` / `型材` / `扇数` / …）；
 *   · 新版行：`ProgressRowDto` = `OrderLineDto` 的**英文字段名** + 几个中文补充键
 *     （`单号` / `客户` / `业务员` / `日期` / `工序N` / `生产进度` …）。
 * `toNew` 只翻**键名**、不动值；翻完还会把旧的中文键**删掉** —— 这样万一新代码偷偷在读
 * 旧键名，这边会直接读到 `undefined` 而露馅，而不是"碰巧也对"。
 * 映射依据是 `app/src/views/Progress.vue` 的列渲染（`profileColorCell` / `fansDirectionCell` /
 * `amountCell` / `lightWindowCell`），不是猜的。
 */
const NEW_KEYS = {
  数量: 'quantity', 平方数: 'square', 金额: 'amount', 型材: 'profile', 扇数: 'fans',
  开向: 'direction', 底玻: 'bottom_glass', 面玻: 'face_glass',
  亮窗总高: 'light_window_height', 轨道种类: 'track', 玻璃厚: 'glass_thickness',
}
const NEW_KEPT = new Set(['客户', '业务员', '日期', '单号', '备注', '安装地址', '生产进度'])
function toNew(r) {
  const out = {}
  for (const [k, v] of Object.entries(r)) {
    if (k in NEW_KEYS) continue                      // 旧中文键一律丢掉
    if (/^工序\d+$/.test(k) || NEW_KEPT.has(k)) out[k] = v
  }
  for (const [oldK, newK] of Object.entries(NEW_KEYS)) {
    if (oldK in r) out[newK] = r[oldK]
  }
  return out
}
/** 把一整个夹具数组翻成新版形状。 */
const N = (rows) => rows.map(toNew)

const NOW = new Date(2026, 8, 19) // 2026-09-19，**周六**（本周起点分歧在周六/周日才显形）

// ── ① 门数分类（旧版 `Me` 内联分类器，互斥） ──────────────────────────────
{
  const fixtures = [
    ['移门（开向被忽略）', { 扇数: '2轨2扇', 型材: '普通', 开向: '内左' }],
    ['哑口排除移门 → 平开门', { 扇数: '2轨2扇', 型材: '哑口', 开向: '内左' }],
    ['哑口 + 钻石 → 淋浴房', { 扇数: '', 型材: '哑口 钻石' }],
    ['哑口 + 平开向 → 平开门', { 扇数: '', 型材: '哑口', 开向: '内左' }],
    ['钻石赢过开向', { 扇数: '', 型材: '钻石', 开向: '外右' }],
    ['一固一活 → 淋浴房', { 扇数: '一固一活', 型材: '普通' }],
    ['双活 → 淋浴房', { 扇数: '双活', 型材: '普通' }],
    ['无扇数无开向 → 其它', { 扇数: '', 型材: '普通', 开向: '' }],
    ['9轨9扇 → 移门', { 扇数: '9轨9扇', 型材: '普通' }],
    ['折叠9扇 → 移门', { 扇数: '折叠9扇', 型材: '普通' }],
    ['双开外左 → 平开门', { 扇数: '', 型材: '普通', 开向: '双开外左' }],
    ['左锁内开 → 平开门', { 扇数: '', 型材: '普通', 开向: '左锁内开' }],
  ]
  for (const [what, over] of fixtures) {
    const r = row({ 数量: 5, 金额: 100, 平方数: 2, ...over })
    const legacy = makeLegacy({ tableData: [r] })
    const m = legacy.Me([r])
    // 从旧版 `Me` 的输出反推它把这一行归到了哪一桶（数量是 5，唯一非零的那桶就是它）
    const legacyKind = m.swingQuantity === 5 ? '平开门'
      : m.slidingQuantity === 5 ? '移门'
      : m.showerQuantity === 5 ? '淋浴房' : '其它'
    const nw = loadNew({})
    eq(`门数分类 / ${what}`, legacyKind, nw.classifyDoor(toNew(r)))
    assert(`门数分类互斥 / ${what}`, m.totalQuantity === 5, `totalQuantity=${m.totalQuantity}`)
  }
}

// ── ② 扇数 5 桶（旧版 `xe`）+ 不含单玻 ────────────────────────────────────
{
  const fixtures = [
    ['单轨单扇 + 内左（两桶都进）', { 扇数: '单轨单扇', 开向: '内左' }],
    ['2轨2扇', { 扇数: '2轨2扇' }],
    ['2轨3扇', { 扇数: '2轨3扇' }],
    ['3轨2扇1纱', { 扇数: '3轨2扇1纱' }],
    ['3轨4扇2纱', { 扇数: '3轨4扇2纱' }],
    ['单轨2扇', { 扇数: '单轨2扇' }],
    ['折叠5扇', { 扇数: '折叠5扇' }],
    ['8轨8扇', { 扇数: '8轨8扇' }],
    ['亮窗（非移门）', { 扇数: '', 开向: '内左', 亮窗总高: 50, 轨道种类: '2轨' }],
    ['亮窗 + 移门', { 扇数: '2轨2扇', 亮窗总高: 100, 轨道种类: '2轨' }],
    ['轨道种类 NULL', { 亮窗总高: 100, 轨道种类: 'NULL' }],
    ['轨道种类空串', { 亮窗总高: 100, 轨道种类: '' }],
    ['亮窗总高 0', { 亮窗总高: 0, 轨道种类: '2轨' }],
    ['双开 → 2 倍', { 开向: '双开内开' }],
    ['钻石行（开向不算平开）', { 型材: '钻石', 开向: '内左' }],
    ['一固一活 → 2 倍淋浴扇', { 扇数: '一固一活' }],
    ['哑口 + 移门扇数（不算移门）', { 型材: '哑口', 扇数: '2轨2扇' }],
    ['数量 0', { 数量: 0, 扇数: '2轨2扇' }],
    ['数量 null', { 数量: null, 扇数: '2轨2扇' }],
    ['数量 3 + 4轨4扇', { 数量: 3, 扇数: '4轨4扇' }],
  ]
  for (const [what, over] of fixtures) {
    const r = row({ 数量: 2, ...over })
    const legacy = makeLegacy({ tableData: [r] })
    legacy.h.value = false
    const nw = loadNew({})
    eq(`扇数 5 桶 / ${what}`, legacy.xe(r), nw.computeFans(toNew(r), { excludeSingleGlass: false }))
  }

  // 「不含单玻」：**只有 `底玻 === '无'`（严格相等）** 才归零
  for (const bottom of ['无', '5mm', '', null, undefined]) {
    const r = row({ 底玻: bottom, 扇数: '2轨2扇', 开向: '内左', 亮窗总高: 50, 轨道种类: '2轨' })
    const legacy = makeLegacy({ tableData: [r] })
    legacy.h.value = true
    const nw = loadNew({})
    eq(`不含单玻 / 底玻=${JSON.stringify(bottom)}`, legacy.xe(r), nw.computeFans(toNew(r), { excludeSingleGlass: true }))
  }

  // 开关**只动扇数**：同一批行，门数/平方/金额必须一模一样
  {
    const rows = [row({ 底玻: '无', 数量: 4, 平方数: 3.5, 金额: 999, 扇数: '2轨2扇' }), row({ 底玻: '5mm' })]
    const legacy = makeLegacy({ tableData: rows })
    legacy.h.value = true
    const on = legacy.Me(rows)
    legacy.h.value = false
    const off = legacy.Me(rows)
    const nwOn = loadNew({}).aggregateRows(N(rows), { excludeSingleGlass: true })
    const nwOff = loadNew({}).aggregateRows(N(rows), { excludeSingleGlass: false })
    eq('不含单玻 / 门数平方金额不受影响（旧版）', [on.totalQuantity, on.totalArea, on.totalAmount], [off.totalQuantity, off.totalArea, off.totalAmount])
    eq('不含单玻 / 门数平方金额不受影响（新版）', [nwOn.totalQuantity, nwOn.totalArea, nwOn.totalAmount], [nwOff.totalQuantity, nwOff.totalArea, nwOff.totalAmount])
    eq('不含单玻 / 扇数被清（旧版）', off.totalFans > 0 && on.totalFans < off.totalFans, true)
    eq('不含单玻 / 扇数被清（新版）', nwOff.totalFans > 0 && nwOn.totalFans < nwOff.totalFans, true)
  }
}

// ── ③ 聚合 `Me`（21 字段全比） ────────────────────────────────────────────
{
  const rows = [
    row({ 数量: 5, 平方数: 2, 金额: 100, 扇数: '2轨2扇', 开向: '内左' }),
    row({ 数量: 2, 平方数: 1.5, 金额: 55.5, 扇数: '', 型材: '钻石', 开向: '外右' }),
    row({ 数量: 1, 平方数: 0.5, 金额: 33, 型材: '哑口', 开向: '内右' }),
    row({ 数量: 3, 平方数: 9, 金额: 700, 扇数: '折叠6扇', 亮窗总高: 80, 轨道种类: '3轨' }),
    row({ 数量: 1, 平方数: 1, 金额: 10, 型材: '钻石', 亮窗总高: 10, 轨道种类: '2轨', 开向: '内左' }),
    row({ 数量: null, 平方数: null, 金额: null, 扇数: '', 开向: '' }),
  ]
  for (const h of [false, true]) {
    const legacy = makeLegacy({ tableData: rows })
    legacy.h.value = h
    const nw = loadNew({})
    eq(`聚合 Me / 不含单玻=${h}`, legacy.Me(rows), nw.aggregateRows(N(rows), { excludeSingleGlass: h }))
  }
  // 门数 4 桶互斥 ⇒ 各桶之和 = totalQuantity
  const m = loadNew({}).aggregateRows(N(rows), {})
  eq('门数 4 桶互斥', m.swingQuantity + m.slidingQuantity + m.showerQuantity + m.otherQuantity, m.totalQuantity)
}

// ── ④ 时间筛选（旧版 `fe`） ──────────────────────────────────────────────
{
  const dates = ['2026-08-31', '2026-09-01', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-19', '2026-09-20', '', ' ']
  const rows = dates.map((d) => row({ 日期: d }))
  const nw = loadNew({})
  for (const mode of ['all', 'today', 'month', 'lastMonth']) {
    const legacy = makeLegacy({ tableData: rows, now: NOW })
    legacy.w.value = mode
    const legacyDates = legacy.pe.value.map((r) => r['日期'])
    const newDates = nw.filterByTime(N(rows), mode, null, NOW).map((r) => r['日期'])
    eq(`时间筛选 / ${mode}`, legacyDates, newDates)
  }
  // 「本周」是**有意偏离**（旧版周日 / 新版周一）—— 断言两边**确实不同**，并钉住各自的值
  {
    const legacy = makeLegacy({ tableData: rows, now: NOW })
    legacy.w.value = 'week'
    const legacyDates = legacy.pe.value.map((r) => r['日期'])
    const newDates = nw.filterByTime(N(rows), 'week', null, NOW).map((r) => r['日期'])
    assert(
      '本周（有意偏离）/ 旧版从周日算',
      legacyDates.includes('2026-09-13') && !legacyDates.includes('2026-09-12'),
      `旧版 = ${JSON.stringify(legacyDates)}`,
    )
    assert(
      '本周（有意偏离）/ 新版从周一开始',
      newDates.includes('2026-09-14') && !newDates.includes('2026-09-13'),
      `新版 = ${JSON.stringify(newDates)}`,
    )
  }
  // 未来日期在 today/week/month 三档都被排除（右端 = 今天）
  for (const mode of ['today', 'week', 'month']) {
    const out = nw.filterByTime(N(rows), mode, null, NOW).map((r) => r['日期'])
    assert(`未来日期被排除 / ${mode}`, !out.includes('2026-09-20'), `${JSON.stringify(out)}`)
  }
  // 自定义区间
  {
    const legacy = makeLegacy({ tableData: rows, now: NOW })
    legacy.w.value = 'custom'
    legacy.y.value = ['2026-09-01', '2026-09-13']
    const newRange = nw.filterByTime(N(rows), 'custom', ['2026-09-01', '2026-09-13'], NOW).map((r) => r['日期'])
    eq('时间筛选 / custom', legacy.pe.value.map((r) => r['日期']), newRange)
    // `custom` 但没选区间 → 原样返回（空日期的行也留着）
    const legacyNoRange = makeLegacy({ tableData: rows, now: NOW })
    legacyNoRange.w.value = 'custom'
    eq('时间筛选 / custom 无区间 → 原样', legacyNoRange.pe.value.length, rows.length)
    eq('时间筛选 / custom 无区间（新版）', nw.filterByTime(N(rows), 'custom', null, NOW).length, rows.length)
  }
  // 客户 / 业务员 / 生产状态三个筛选
  {
    const rows2 = [
      row({ 客户: '甲公司', 业务员: '张三' }),
      row({ 客户: ' 甲公司', 业务员: ' 张三' }),
      row({ 客户: '甲公司 ', 业务员: '   ' }),
      row({ 客户: '乙公司', 业务员: '李四' }),
      row({ 客户: '', 业务员: '' }),
    ]
    const legacy = makeLegacy({ tableData: rows2, now: NOW })
    const nw2 = loadNew({})
    eq('客户候选（含空格差异）', legacy.Ve?.value ?? null, nw2.clientOptions(N(rows2)))
    eq('业务员候选（存原值）', legacy.we?.value ?? null, nw2.salesmanOptions(N(rows2)))
    legacy.m.value = '甲公司'
    eq(
      '客户筛选 / 严格 ===',
      legacy.pe.value.map((r) => r['客户']),
      nw2.applyDashboardFilters(N(rows2), { time: 'all', client: '甲公司' }, NOW).map((r) => r['客户']),
    )
    legacy.m.value = ''
    legacy.g.value = ' 张三'
    eq(
      '业务员筛选 / 严格 ===',
      legacy.pe.value.map((r) => r['业务员']),
      nw2.applyDashboardFilters(N(rows2), { time: 'all', salesman: ' 张三' }, NOW).map((r) => r['业务员']),
    )
  }
}

// ── ⑤ 生产进度（旧版 `ke`）—— 有意偏离单列 ──────────────────────────────
{
  const rows = [
    row({ 单号: 'A-1' }), row({ 单号: '' }), row({ 单号: null }), row({ 单号: ' ' }),
    row({ 单号: undefined }), row({ 单号: 0 }),
  ]
  const legacy = makeLegacy({ tableData: rows, now: NOW })
  const k = legacy.ke.value
  const nw = loadNew({})
  const n = nw.countProduction(N(rows))
  // 旧版：裸真值 ⇒ `undefined` / `0` 算**已生产**（`' '` 也是）
  eq('生产进度（旧版口径）', k.startedCount, rows.filter((r) => r['单号']).length)
  eq('生产进度（旧版未生产）', k.notStartedCount, rows.length - k.startedCount)
  // 新版：统一口径 —— 只有 `'A-1'` 算已生产（`' '` 也归未生产）
  assert('生产进度（新版统一口径）', n.started === 1 && n.notStarted === 5, `新版 = ${JSON.stringify(n)}`)
  // 钉住分歧本身：旧版「生产状态筛选」判 `undefined`/`0` 为**已进入生产**，而卡片说它未生产
  {
    const l2 = makeLegacy({ tableData: rows, now: NOW })
    l2.v.value = true
    const filtered = l2.pe.value.length
    assert(
      '旧版自相矛盾（有意不照抄）',
      filtered !== k.startedCount,
      `筛选留下 ${filtered} 行，卡片却写「已生产: ${k.startedCount}」`,
    )
  }
  // 新版：筛选与卡片同口径
  eq(
    '生产进度 / 筛选与卡片同口径（新版）',
    nw.applyDashboardFilters(N(rows), { time: 'all', produced: true }, NOW).length,
    n.started,
  )
}

// ── ⑥ 标题区间（旧版 `he` / `Ce`）—— 空串日期单列 ────────────────────────
{
  const rows = [row({ 日期: '2026-08-15' }), row({ 日期: '2026-09-01' }), row({ 日期: '2026-09-19' }), row({ 日期: '2026-09-20' }), row({ 日期: '' })]
  const legacy = makeLegacy({ tableData: rows, now: NOW })
  const nw = loadNew({})
  eq('标题 / 不含空串', legacy.Ce.value, nw.dashboardTitle(N(rows)))
  eq('标题区间 / 不含空串', legacy.he.value, nw.dateRangeOf(N(rows)))
  assert('标题 / 同一天只写一个日期', nw.dashboardTitle(N([row({ 日期: '2026-09-19' })])) === '生产分析看板 (2026-09-19)')
  assert('标题 / 无日期', nw.dashboardTitle([]) === '生产分析看板')
  // `" "`（纯空格）—— 有意偏离
  {
    const withBlank = [...rows, row({ 日期: ' ' })]
    const legacyBlank = makeLegacy({ tableData: withBlank, now: NOW })
    assert(
      '空格日期（有意偏离）/ 旧版会污染标题',
      legacyBlank.Ce.value !== '生产分析看板 (2026-08-15 ~ 2026-09-20)',
      `旧版 = ${legacyBlank.Ce.value}`,
    )
    assert(
      '空格日期（有意偏离）/ 新版剔掉',
      nw.dashboardTitle(N(withBlank)) === '生产分析看板 (2026-08-15 ~ 2026-09-20)',
      `新版 = ${nw.dashboardTitle(N(withBlank))}`,
    )
  }
}

// ── ⑦ 分组统计（旧版 `Ae` / `De` / `be` / `Pe` / `Se`） ──────────────────
{
  const rows = [
    row({ 客户: 'Z公司', 业务员: '张三', 型材: '普通', 金额: 100, 工序1: '下料_张三_2026-09-01' }),
    row({ 客户: 'A公司', 业务员: '', 型材: '', 金额: 100, 工序2: '组装' }),
    row({ 客户: 'M公司', 业务员: '   ', 型材: '钻石', 金额: 100, 工序10: '组装', 工序15: '包装' }),
    row({ 客户: '', 业务员: '李四', 型材: '普通', 金额: 300.5, 工序1: '下料_李四_2026-09-02' }),
    row({ 客户: 'Z公司', 业务员: '张三', 型材: '普通', 金额: 50, 工序1: '' }),
  ]
  const legacy = makeLegacy({ tableData: rows, now: NOW })
  legacy.Le.value = { 工序1: '下料', 工序2: '组装', 工序15: '包装' }
  const nw = loadNew({})
  const names = { 工序1: '下料', 工序2: '组装', 工序15: '包装' }
  eq('按客户', legacy.De.value, nw.byCustomer(N(rows), {}))
  eq('按业务员（空格键原值）', legacy.be.value, nw.bySalesman(N(rows), {}))
  eq('按型材', legacy.Pe.value, nw.byProfile(N(rows), {}))
  eq('按工序', legacy.Se.value, nw.buildProcedureGroups(N(rows), names, {}))
  // 金额降序；并列时保持**插入顺序**（V8 的 `sort` 稳定）
  // 金额：未知客户 300.5 → Z公司 150 → A公司 100（先插入）→ M公司 100（后插入）
  eq(
    '金额降序 + 并列保持插入顺序',
    nw.byCustomer(N(rows), {}).map((g) => g.name),
    ['未知客户', 'Z公司', 'A公司', 'M公司'],
  )
  // 工序 10 永不出现
  assert(
    '工序10 被跳过',
    !nw.buildProcedureGroups(N(rows), names, {}).some((g) => g.name.startsWith('工序10')),
    JSON.stringify(nw.buildProcedureGroups(N(rows), names, {}).map((g) => g.name)),
  )
  // 没工序名时退化成 `工序N`
  eq('按工序 / 无名表', legacy.Se.value.length > 0 && nw.buildProcedureGroups(N(rows), {}, {}).map((g) => g.name), ['工序1', '工序2', '工序15'])
  // 工序 tab 的排序是**槽号升序**（与其它三个 tab 的金额降序不同）
  {
    const l3 = makeLegacy({ tableData: rows, now: NOW })
    l3.Le.value = { 工序15: '包装', 工序1: '下料' }
    const got = nw.buildProcedureGroups(N(rows), { 工序15: '包装', 工序1: '下料' }, {}).map((g) => g.name)
    eq('工序排序 = 槽号升序', l3.Se.value.map((g) => g.name), got)
  }
}

// ── ⑧ 趋势（旧版 `Ue`）+ 30/31 阈值 ─────────────────────────────────────
{
  const mk = (n, startDay = 1) => {
    const out = []
    let d = new Date(2026, 6, startDay)
    for (let i = 0; i < n; i++) {
      out.push(row({ 日期: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, 数量: 1, 金额: 10, 平方数: 1.005 }))
      d = new Date(d.getTime() + 86400000)
    }
    return out
  }
  for (const n of [0, 1, 30, 31, 34]) {
    const rows = mk(n, 1)
    const legacy = makeLegacy({ tableData: rows, now: NOW })
    const nw = loadNew({})
    eq(`趋势 / ${n} 个日期`, legacy.Ue.value, nw.buildTrend(N(rows), {}))
    assert(
      `趋势转月阈值 / ${n} 天 → ${n > 30 ? '月度' : '每日'}`,
      legacy.Ue.value.isMonthly === (n > 30) && nw.buildTrend(N(rows), {}).isMonthly === (n > 30),
    )
  }
  // 空日期归「未知日期」且**不进 dates**
  {
    const rows = [row({ 日期: '' }), row({ 日期: '2026-09-19' }), row({ 日期: null })]
    const legacy = makeLegacy({ tableData: rows, now: NOW })
    const nw = loadNew({})
    eq('趋势 / 未知日期桶被剔除', legacy.Ue.value, nw.buildTrend(N(rows), {}))
  }
  // 趋势的 fans 用的是**同一套扇数口径**（吃「不含单玻」）
  {
    const rows = [row({ 日期: '2026-09-19', 底玻: '无', 数量: 3, 扇数: '2轨2扇' })]
    const legacy = makeLegacy({ tableData: rows, now: NOW })
    legacy.h.value = true
    const nw = loadNew({})
    eq('趋势 / 吃不含单玻', legacy.Ue.value, nw.buildTrend(N(rows), { excludeSingleGlass: true }))
  }
}

// ── ⑨ 开向归一化（自定义命名） ──────────────────────────────────────────
{
  const names = { 内左: '左边开', 双开内开: '对开' }
  const cases = [
    ['内左', row({ 开向: '内左' })],
    ['左边开（自定义名）', row({ 开向: '左边开' })],
    ['左边开 + 数量 3', row({ 开向: '左边开', 数量: 3 })],
    ['左边开（带空格）', row({ 开向: ' 左边开 ' })],
    ['对开 → 双开 2 倍', row({ 开向: '对开', 数量: 3 })],
    ['未登记的开向', row({ 开向: '某个怪名字' })],
  ]
  for (const [what, r] of cases) {
    const legacy = makeLegacy({ tableData: [r], now: NOW, names })
    const nw = loadNew(names)
    eq(`开向归一化 / ${what} / 扇数`, legacy.xe(r), nw.computeFans(toNew(r), {}))
    eq(`开向归一化 / ${what} / 门数`, legacy.Me([r]).swingQuantity, nw.aggregateRows(N([r]), {}).swingQuantity)
  }
}

// ── ⑩ 数字为字符串（有意偏离：旧版会炸） ─────────────────────────────────
{
  const r = row({ 数量: '3', 平方数: '2', 金额: '100' })
  const legacy = makeLegacy({ tableData: [r], now: NOW })
  let legacyBoom = ''
  try {
    // 旧版 KPI 卡里 `totalArea.toFixed(2)` —— 字符串拼接之后必然抛
    legacy.Me([r]).totalArea.toFixed(2)
  } catch (e) {
    legacyBoom = e.constructor.name
  }
  assert('字符串数字（有意偏离）/ 旧版抛异常', legacyBoom === 'TypeError', `旧版 = ${legacyBoom || '没抛'}`)
  const m = loadNew({}).aggregateRows(N([r]), {})
  assert(
    '字符串数字（有意偏离）/ 新版兜住',
    m.totalQuantity === 3 && m.totalArea === 2 && m.totalAmount === 100,
    `新版 = ${JSON.stringify([m.totalQuantity, m.totalArea, m.totalAmount])}`,
  )
}

// ═══════════════════════════════════════════════════════════ 结果 //
if (failures.length) {
  console.log('\n✗ 不一致的用例：')
  for (const f of failures) console.log(`  ✗ ${f}`)
}
console.log(`\n看板口径差分台：${pass}/${pass + fail} 通过`)
process.exit(fail ? 1 : 0)
