/*
 * Progress 工具条的**逐字差分台**：同一批夹具，左边跑**旧版真代码**、右边跑**新版真代码**，
 * 逐字段比。两块：
 *
 *   ① 统计数字（§5.4 的 `yo`/`vo`/`mo`/`go`/`fo`/`po`）—— 纯函数，比数值；
 *   ② 「导出表格」（§4.6）—— 两边都喂**真的 exceljs**（`app/node_modules` 里那份），
 *      把生成的 workbook **逐行/逐格**比（值、行高、字体、对齐、底色、边框、合并、列宽），
 *      外加文件名与提示语。
 *
 * 为什么值得单独盯：
 *   · 统计里那张「扇数 → 每樘几扇」的表有 **22 个字面量**、开向有 **8+6 个字面量**，
 *     抄错一个**不报错**，只是数字小一点 —— 肉眼根本看不出来；
 *   · 导出里有十几处魔数（底色 `FFE6F4FF`/`FFFFF7E6`/`FFD9ECFF`、行高 `max(22, 18*(n+1))`、
 *     标题合并、`wrapText` 只给第 4 列、文件名的时间戳替换规则）—— 同理。
 *
 * 左边（旧版）：`legacy/js/Progress-f4bdef35.js` 解混淆后的
 *   `z=async()=>{…}`（导出）与 `yo=…`→`po=…`（统计）两段。
 * 右边（新版）：`app/src/views/Progress.vue` 里对应的两段（锚点见下）。
 *   ⚠️ **`SEARCH_FIELDS` 那一段 2026-09-20 起不在 `Progress.vue` 了** —— Progress 拆分 P5
 *     把它连整个「列头交互」搬去了 `app/src/composables/progress/useProgressHeader.ts`
 *     （纯搬迁、逐字未改）⇒ 那一对锚点改从新文件切，**断言与夹具一个字没动**。
 *     见下面 `SEARCH_FIELDS_TS` 上方的 ⚠️。
 *
 * ⚠️ **这台差分台不覆盖的东西**（别以为它绿了就全都对）：
 *   1. **开向归一化本身**。两边都注入**同一份**夹具映射（旧版走 `openDirectionNaming` 的真代码，
 *      新版走 `useOpenDirection.ts` 的真代码，喂同一张 map）—— 比的是「统计/导出怎么用归一化结果」，
 *      不是归一化本身。归一化由 `useOpenDirection.ts` 的注释 + Home/Hui 的差分台管。
 *   2. **新版 `exportTable` 里 `await import('exceljs')` 这一句**被换成了注入的 `__exceljs()`
 *      （见下面的 `NEW_JS` 替换）。测的是**导出内容**，不是打包/互操作 ——
 *      那部分靠 `npm run build` + 产物里那个独立的 `exceljs.min-*.js` chunk 兜。
 *   3. 统计的两处**文案**（工具条的 `statsTail` 与导出里的 `统计信息: …`）在旧版里就是**两串不同的话**
 *      （「条记录」后有没有空格、「移门亮窗个数」vs「移门亮窗」）⇒ 这里**分别**比，不做归一。
 *
 * ⚠️ 夹具只有能说清「夹具本身与旧版口径不符」时才能改，且要写明理由 —— 不许为了让测试变绿改夹具。
 *
 * 用法：node docs/progress-toolbar-logiccheck.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const BUNDLE = resolve(ROOT, 'legacy/js/Progress-f4bdef35.js')
const NAMING = resolve(ROOT, 'legacy/js/openDirectionNaming-92dbc91d.js')
const MAP = '/tmp/progress.map.json'
const DECODED = '/tmp/progress.decoded.js'
const VUE = resolve(ROOT, 'app/src/views/Progress.vue')
// P5（列头交互）2026-09-20 搬到这儿了 —— 本台子只有 `SEARCH_FIELDS` 那一对锚点落在它里面。
const HEADER = resolve(ROOT, 'app/src/composables/progress/useProgressHeader.ts')
// P10（统计行）2026-09-20 搬到这儿了 —— 本台子的「统计」段（`NEW_STATS_TS`）
// 与「两份移门扇数字面量」自检那对锚点（`moveFans`/`pingFans`）都落在它里面。
const STATS = resolve(ROOT, 'app/src/composables/progress/useProgressStats.ts')
const USE_OPEN_DIR = resolve(ROOT, 'app/src/composables/useOpenDirection.ts')

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
  return src.slice(a, b + endAnchor.length)
}

/*
 * ⚠️ 旧版这一整串声明是**一条** `const a=…,b=…,yo=Vue.computed(…),…,po=…` 链，
 *    从中间切必须以 `const ` 起头、并去掉尾部那个悬空的逗号，否则切出来的一段不是合法语句
 *    （这正是第一版直接 `SyntaxError` 的原因）。
 */
// 统计：`yo=Vue.computed(` … `po` 的收尾（紧跟着就是下一个声明 `ho=Vue.ref(!1)`）。
const STATS_RAW = cut(decoded, 'yo=Vue.computed', 'ho=Vue.ref(!1)', '统计').replace(
  /ho=Vue\.ref\(!1\)$/,
  '',
)
const LEGACY_STATS_SRC = `const ${STATS_RAW.replace(/,\s*$/, '')}`
// 导出：`z=async()=>{const e=de;try{` … catch 块收尾
const EXPORT_TAIL =
  '}catch(t){ElementPlus.ElMessage["error"]("导出失败: "+(t instanceof Error?t.message:String(t)))}}'
const EXPORT_RAW = cut(decoded, 'z=async()=>{const e=de;try{', EXPORT_TAIL, '导出')
const LEGACY_EXPORT_SRC = `const ${EXPORT_RAW}`

// 自检：切出来的段落得有个像样的形状（防止锚点错位却「看起来成功」）。
if (STATS_RAW.length < 1800 || !STATS_RAW.startsWith('yo=Vue.computed')) {
  throw new Error(`旧版统计段形状不对（len=${STATS_RAW.length}）`)
}
if (EXPORT_RAW.length < 2500 || !EXPORT_RAW.includes('FFE6F4FF')) {
  throw new Error(`旧版导出段形状不对（len=${EXPORT_RAW.length}）`)
}

// 开向归一化：把旧版那个小模块整个跑起来（`export{e as a,c as g,o as l}` → CJS）。
const namingSrc = readFileSync(NAMING, 'utf8').replace(
  /export\{([^}]*)\};?\s*$/,
  (_, inner) => {
    const pairs = inner.split(',').map((p) => p.trim().split(/\s+as\s+/))
    return `module.exports={${pairs.map(([n, alias]) => `${alias}:${n}`).join(',')}};`
  },
)
/*
 * ⚠️ `openDirectionNaming.o()` 读的是**全局 `window`**（不是参数）⇒ 必须把假 window 注进
 *    这个模块的**构造期作用域**，不能事后当参数传（否则 `typeof window === "undefined"` ⇒ 返回 `{}`，
 *    归一化静默失效，差分台会误报成「新版算错了」）。
 * ⚠️ 键名是 **`openDirectionCustomNames`**（不是 `open_direction_naming` 之类）——
 *    与新版 `useOpenDirection.ts` 的 `OPEN_DIRECTION_CUSTOM_NAMES_KEY` **恰好同名**，
 *    这是实测出来的，不是猜的。
 */
const namingStore = {}
const namingWindow = { localStorage: { getItem: (k) => namingStore[k] ?? null } }
const namingModule = { exports: {} }
new Function('module', 'exports', 'window', namingSrc)(namingModule, namingModule.exports, namingWindow)
const legacyNaming = namingModule.exports

// ---------------------------------------------------------------- 新版侧 //
const vue = readFileSync(VUE, 'utf8')
const header = readFileSync(HEADER, 'utf8')
const stats = readFileSync(STATS, 'utf8')

/**
 * 从 `src` 里按「命中 + 唯一 + 终点在后」切一段。
 * ⚠️ 2026-09-20（Progress 拆分 P5）起「新版侧」**不再只有一个源文件** ⇒ 把源提成参数，
 *    原来的 `cutVue` 保留成薄壳（十余处调用点一行都不用改）。
 */
function cutIn(src, startAnchor, endAnchor, what) {
  const a = src.indexOf(startAnchor)
  if (a < 0) throw new Error(`新版锚点没命中（${what} 的起点）：${startAnchor}`)
  if (src.indexOf(startAnchor, a + 1) >= 0) throw new Error(`新版锚点不唯一（${what} 的起点）`)
  const b = src.indexOf(endAnchor, a)
  if (b < 0) throw new Error(`新版锚点没命中（${what} 的终点）：${endAnchor}`)
  return src.slice(a, b)
}
const cutVue = (startAnchor, endAnchor, what) => cutIn(vue, startAnchor, endAnchor, what)

/*
 * ⚠️ **换源（2026-09-20，Progress 拆分 P10）**：「统计」这一段从 `Progress.vue`
 *    搬到了 `composables/progress/useProgressStats.ts` ⇒ 起点锚点不动、源换成新文件。
 *
 * 终点锚点**必须换掉**，两条理由：
 *   ① 原来的 `// ── C2.` 是 **P11（导出）的段首横幅** —— P10 一搬走，它与本段之间
 *      已经隔着工厂的 `return` 与收尾 `}` ⇒ 照原样会切出**跨工厂边界**的一段
 *      （末尾多出一个悬空的 `}`，`toCjs` 直接语法错）；
 *   ② 那个锚在 REF 里本来就不唯一（1599 勾选 / 1984 导出），**别指望它**。
 *   ⇒ 改成**新文件自己的工厂 `return`**：`'\n  return {'`（带换行 ⇒ 不会命中
 *     `dateRange` 里那句 `return { earliest: … }` 的 4 格缩进版本；实测全文件唯一）。
 *   ⚠️ 这条锚**只认新文件**，Task 7 搬 P11 时**不必再回来动第二次**。
 */
const NEW_STATS_TS = cutIn(stats, 'const MOVE_FAN_NAMES = [', '\n  return {', '统计')
const NEW_EXPORT_TS = cutVue('async function exportTable() {', '</script>', '导出')

if (NEW_STATS_TS.length < 2000 || !NEW_STATS_TS.includes('const statsTail = computed(')) {
  throw new Error(`新版统计段形状不对（len=${NEW_STATS_TS.length}）`)
}
if (NEW_EXPORT_TS.length < 2000 || !NEW_EXPORT_TS.includes('筛选结果_')) {
  throw new Error(`新版导出段形状不对（len=${NEW_EXPORT_TS.length}）`)
}

// 从 app/ 的 node_modules 里拿 esbuild 与 exceljs（根目录没有）。
const require = createRequire(resolve(ROOT, 'app/package.json'))
const esbuild = require('esbuild')
const RealExcelJS = require('exceljs')

// ⚠️ `charset:'utf8'` 必须显式给：默认是 ascii，中文会被转义成 `\uXXXX`，
//    按字面量做集合比对时会「两边看起来完全不一样」。
const toCjs = (ts) => esbuild.transformSync(ts, { loader: 'ts', format: 'cjs', charset: 'utf8' }).code

/*
 * 新版 `exportTable` 里那句 `await import('exceljs')` 换成注入的 `await __exceljs()`
 *（理由见文件头「不覆盖的东西」第 2 条）。
 *
 * ⚠️ **必须在 esbuild 之前替换**：esbuild 的 `format:'cjs'` 转换会把 `await import(x)`
 *    里的 `await` **吃掉**（输出 `const mod = import_(x)`），于是 `mod` 成了 Promise、
 *    `mod.Workbook` 恒 undefined ⇒ 一路走到「exceljs 未正确加载」。
 *    换成一个普通函数调用之后 `await` 就留住了。第一版就踩了这个坑。
 */
const NEW_EXPORT_TS_REPLACED = NEW_EXPORT_TS.replace(
  /await import\(['"]exceljs['"]\)/g,
  'await __exceljs()',
)
if (NEW_EXPORT_TS_REPLACED === NEW_EXPORT_TS) {
  throw new Error("新版 `await import('exceljs')` 的替换没生效（锚点变了？）")
}
const NEW_EXPORT_JS = toCjs(NEW_EXPORT_TS_REPLACED)
if (!NEW_EXPORT_JS.includes('await __exceljs()')) {
  throw new Error('新版导出的 `await __exceljs()` 没进到转换后的代码里')
}

// `getOriginalOpenDirection` 从 `useOpenDirection.ts` 里切出来（新版真代码）。
const uod = readFileSync(USE_OPEN_DIR, 'utf8')
const GOD_START = uod.indexOf('export function getOriginalOpenDirection(')
const GOD_END = uod.indexOf('\n}', GOD_START)
if (GOD_START < 0 || GOD_END < 0) throw new Error('新版 `getOriginalOpenDirection` 的锚点变了')
const GOD_TS = uod.slice(GOD_START, GOD_END + 2).replace('export ', '')

/**
 * ⚠️ **P10 换源之后这段读的是注入对象**（`useProgressStats` 工厂的 `deps`）⇒ 要多搭一个
 *   `deps` 壳，与 `progress-more-logiccheck.mjs`（P8）同一个改法：
 *   `deps.filteredRows` **就是**原来那个 `filteredRows` ref 桩本身（同一对象，不是复制）
 *   ⇒ 调用点、夹具、断言一个字都不用动。
 *   ⚠️ 实测这段里出现的 `deps.` **只有** `deps.filteredRows`（×6）一个键
 *     （本块只注入这一项）⇒ 不必多搭别的桩。
 *   「`filteredRows` 这个裸参数还留着」是有意的：`useProgressStats` 的**注入面**就一项，
 *     但夹具侧的名字照旧 —— 传进去的那个 ref 桩即 `deps.filteredRows`。
 */
function makeNewStats() {
  const js = toCjs(`${GOD_TS}\n${NEW_STATS_TS}`)
  return new Function(
    'module',
    'exports',
    'computed',
    'filteredRows',
    'customDirectionNames',
    'getOriginalOpenDirection',
    'deps',
    `${js}
     return { moveFans, pingFans, lightWindows, showerFans, others, dateRange, statsTail: undefined }`,
  )
}

// ---------------------------------------------------------------- 夹具 //
/*
 * 夹具按**新版 DTO 的字段名**写（`profile` / `fans` / `direction` / `quantity` /
 * `light_window_height` / `track`），再用 `toLegacyRow` 摊成旧版那一行的中文键。
 * 这样夹具只写一遍，两边看到的是同一份数据 —— 映射本身对应 `-analysis.md` §11。
 */
function toLegacyRow(r) {
  return {
    日期: r['日期'],
    型材: r.profile,
    扇数: r.fans,
    开向: r.direction,
    数量: r.quantity,
    亮窗总高: r.light_window_height,
    轨道种类: r.track,
    // 搜索框命中的十个字段里，剩下这几个在两版 DTO 里**同名**（中文键），直接透传。
    客户: r['客户'],
    安装地址: r['安装地址'],
    备注: r['备注'],
    单号: r['单号'],
    业务员: r['业务员'],
    打单人: r['打单人'],
    生产进度: r['生产进度'],
    回执单号: r['回执单号'],
  }
}

const row = (o) => ({
  日期: '2026-09-01',
  profile: '',
  fans: '',
  direction: '',
  quantity: 1,
  light_window_height: 0,
  track: '',
  ...o,
})

const FIXTURES = [
  // ── yo：22 种扇数一个字面量一条（每樘几扇按旧版 if 链）────────────────
  ...['2轨2扇', '单轨2扇', '折叠2扇'].map((n) => row({ fans: n, quantity: 2 })), // → 2
  ...['2轨3扇', '3轨3扇', '折叠3扇', '3轨2扇1纱'].map((n) => row({ fans: n, quantity: 3 })), // → 3
  ...['2轨4扇', '4轨4扇', '折叠4扇'].map((n) => row({ fans: n, quantity: 1 })), // → 4
  ...['3轨4扇2纱', '折叠6扇', '6轨6扇'].map((n) => row({ fans: n, quantity: 1 })), // → 6
  row({ fans: '单轨单扇', quantity: 8 }), // → 1
  ...['折叠5扇', '5轨5扇'].map((n) => row({ fans: n, quantity: 1 })), // → 5
  ...['折叠7扇', '7轨7扇'].map((n) => row({ fans: n, quantity: 1 })), // → 7
  ...['折叠8扇', '8轨8扇'].map((n) => row({ fans: n, quantity: 1 })), // → 8
  ...['折叠9扇', '9轨9扇'].map((n) => row({ fans: n, quantity: 1 })), // → 9
  row({ fans: '这个扇数表里没有', quantity: 99 }), // 查不到 ⇒ 两个数都不计
  row({ fans: '2轨2扇', profile: '哑口系列', quantity: 5 }), // 哑口 ⇒ yo 跳过；但 fo 要算（见下）
  // ── vo：单开 8 + 双开 6 + 钻石 + 归一化 ─────────────────────────────
  ...['内左', '内右', '外左', '外右', '左锁内开', '右锁内开', '左锁外开', '右锁外开'].map((d) =>
    row({ direction: d, fans: '单轨单扇', quantity: 2 }),
  ),
  ...['双开内开', '双开外开', '双开内左', '双开内右', '双开外左', '双开外右'].map((d) =>
    row({ direction: d, fans: '单轨单扇', quantity: 2 }),
  ),
  row({ direction: '内左', profile: '钻石', quantity: 7 }), // 钻石 ⇒ vo 跳过
  row({ direction: '不是开向', quantity: 3 }), // 不在 14 项里
  // ── mo：亮窗 ────────────────────────────────────────────────────────
  row({ light_window_height: 300, track: '2轨', quantity: 2 }), // +2
  row({ light_window_height: 300, track: 'NULL', quantity: 2 }), // 字符串 "NULL" ⇒ 不计
  row({ light_window_height: 300, track: '', quantity: 2 }), // 空 ⇒ 不计
  row({ light_window_height: 0, track: '2轨', quantity: 2 }), // 总高 0 ⇒ 不计
  // ── go：淋浴房 ──────────────────────────────────────────────────────
  row({ fans: '一固一活', quantity: 2 }), // +2×2
  row({ fans: '双活', quantity: 3 }), // +2×3
  row({ fans: '一固一活', profile: '钻石', quantity: 1 }), // 先命中淋浴 ⇒ +2×1（不再走钻石分支）
  row({ fans: '', profile: '钻石', quantity: 4 }), // +4
  // ── fo：其它（每种「不算其它」的判据各来一条，外加真·其它）───────────
  row({ fans: '2轨3扇', quantity: 1 }), // 移门 ⇒ 不算其它
  row({ light_window_height: 300, track: '3轨', quantity: 1 }), // 亮窗 ⇒ 不算其它
  row({ fans: '双活', quantity: 1 }), // 淋浴 ⇒ 不算其它
  row({ profile: '钻石', quantity: 1 }), // 钻石 ⇒ 不算其它
  row({ direction: '双开外右', quantity: 1 }), // 平开 ⇒ 不算其它
  /*
   * ⚠️ 这一条是**文档与源码不一致**的那个点：分析文档 §5.4 把「其它」写成「（且非哑口）」，
   *    但源码里「哑口」只参与「移门」那一条判据 ⇒ 一行哑口、又不是上面任何一类时，
   *    它**会被算进「其它」**。这条夹具就是钉这个行为的（新版权威 = 源码）。
   */
  row({ profile: '哑口系列', quantity: 6 }), // 哑口 + 都不是 ⇒ 算进「其它」
  // ── 归一化：开向写的是**自定义显示名**，要能反查回原始开向 ─────────────
  row({ direction: '朝南', quantity: 2 }), // map: 内左 → 朝南 ⇒ 归一化回「内左」⇒ vo +2
  row({ direction: '朝北单', quantity: 2 }), // map: 双开内开 → 朝北单 ⇒ vo +4
  // ── 日期区间 ────────────────────────────────────────────────────────
  row({ 日期: '2026-08-31' }),
  row({ 日期: '2026-10-02' }),
  row({ 日期: '' }), // 空日期要被 filter 掉
]

/** 旧版 `openDirectionNaming` 读的那张 localStorage 表（夹具：两个键被改了显示名）。 */
const NAMING_MAP = { 内左: '朝南', 双开内开: '朝北单' }
/** 旧版读 localStorage 用的键名（实测：`openDirectionNaming.o()` 里那个 `n(470)`）。 */
const LEGACY_NAMING_KEY = 'openDirectionCustomNames'

/** 把夹具里的自定义开向命名灌进那台假 localStorage（旧版 `o()` 每次现读）。 */
function seedLegacyNaming() {
  namingStore[LEGACY_NAMING_KEY] = JSON.stringify(NAMING_MAP)
}

// ---------------------------------------------------------------- 跑统计 //
const legacyStats = new Function(
  'Vue',
  'no',
  'l',
  'a',
  'f',
  'window',
  `${LEGACY_STATS_SRC}
   return { yo, mo, go, vo, fo, po }`,
)

function runLegacyStats(rows) {
  seedLegacyNaming()
  // `l()` = 「读 localStorage 里的自定义开向命名表」，`a(开向, 表)` = 「显示名 → 原始开向」。
  // 两者都是 `openDirectionNaming` 的真代码，只是被当参数注进这一段。
  const l = () => legacyNaming.l()
  const a = (dir, map) => legacyNaming.g(dir, map)
  return legacyStats(
    { computed: (fn) => ({ get value() { return fn() } }) },
    { value: rows.map(toLegacyRow) },
    l,
    a,
    () => {
      throw new Error('旧版统计段不应调用局部解码器 f')
    },
    namingWindow,
  )
}

function runNewStats(rows) {
  const make = makeNewStats()
  /** 注入给工厂的那个 `filteredRows` —— 与 `deps.filteredRows` 是**同一个对象**（见上）。 */
  const filteredRows = { value: rows }
  const computeds = make(
    { exports: {} },
    {},
    (fn) => ({ get value() { return fn() } }),
    filteredRows,
    { value: NAMING_MAP },
    (d) => {
      // 与 `useOpenDirection.getOriginalOpenDirection` 同一份 map（新版那个真函数在下面单独跑一遍做自检）
      const map = NAMING_MAP
      if (!d) return d
      if (map[d]) return d
      for (const [k, v] of Object.entries(map)) {
        if (typeof v === 'string' && v.trim() && v.trim() === d.trim()) return k
      }
      return d
    },
    // `deps` —— P10 换源后那段读的是注入对象（见 `makeNewStats` 上方的 ⚠️）。
    { filteredRows },
  )
  return computeds
}

// 自检：新版真·`getOriginalOpenDirection`（从 `useOpenDirection.ts` 切出来的那段）与上面注入的
// 匿名实现，在同一张 map 上必须给一样的结果 —— 否则说明我上面那个匿名实现写歪了，差分台就白跑了。
{
  const godJs = toCjs(`${GOD_TS}\nmodule.exports = { getOriginalOpenDirection }`)
  const mod = { exports: {} }
  new Function('module', 'exports', 'customDirectionNames', godJs)(mod, mod.exports, {
    value: NAMING_MAP,
  })
  const real = mod.exports.getOriginalOpenDirection
  for (const d of ['内左', '朝南', '双开内开', '朝北单', '外右', '不认识', '']) {
    const got = real(d)
    const want =
      !d ? d : NAMING_MAP[d] ? d : Object.entries(NAMING_MAP).find(([, v]) => v === d)?.[0] ?? d
    if (got !== want) throw new Error(`开向归一化自检失败：${JSON.stringify(d)} → ${got}（期望 ${want}）`)
  }
  console.log('开向归一化（新版真代码 vs 夹具实现）：✓ 一致')
}

let fails = 0
const check = (name, got, want) => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) console.log(`✓ ${name}`)
  else {
    fails++
    console.log(`✗ ${name}\n    旧版 = ${w}\n    新版 = ${g}`)
  }
}

const legacyOut = runLegacyStats(FIXTURES)
const newOut = runNewStats(FIXTURES)

check('yo 移门扇数', newOut.moveFans.value, legacyOut.yo.value)
check('vo 平开门扇数', newOut.pingFans.value, legacyOut.vo.value)
check('mo 移门亮窗个数', newOut.lightWindows.value, legacyOut.mo.value)
check('go 淋浴房扇数', newOut.showerFans.value, legacyOut.go.value)
check('fo 其它', newOut.others.value, legacyOut.fo.value)
check('po 时间区间', newOut.dateRange.value, legacyOut.po.value)

// 逐个夹具单独跑一遍，确保**不是**「总数碰巧相等」（比如一处多算一处少算）。
console.log('— 逐条夹具单独对（防「总数碰巧相等」）—')
let perRowFails = 0
for (const [i, f] of FIXTURES.entries()) {
  const a = runLegacyStats([f])
  const b = runNewStats([f])
  const pairs = [
    ['yo', b.moveFans.value, a.yo.value],
    ['vo', b.pingFans.value, a.vo.value],
    ['mo', b.lightWindows.value, a.mo.value],
    ['go', b.showerFans.value, a.go.value],
    ['fo', b.others.value, a.fo.value],
  ]
  const bad = pairs.filter(([, x, y]) => x !== y)
  if (bad.length) {
    perRowFails++
    fails++
    console.log(`  ✗ 夹具 #${i} ${JSON.stringify(f)} → ${bad.map(([k, x, y]) => `${k}: 旧=${y} 新=${x}`).join(' ')}`)
  }
}
if (!perRowFails) console.log(`  ✓ ${FIXTURES.length} 条夹具逐条一致`)

// ---------------------------------------------------------------- 跑导出 //
/* 两边都喂**真的 exceljs**，把生成的 workbook 抓下来逐格比。
   下面这堆桩只负责「浏览器环境」与副作用（下载、提示），不参与内容生成。 */
function makeBrowserStubs() {
  const log = { downloads: [], messages: [] }
  const blobToBytes = (b) => b
  const URLStub = {
    createObjectURL: (b) => {
      blobToBytes(b)
      return 'blob:fake'
    },
    revokeObjectURL: () => {},
  }
  const documentStub = {
    createElement: () => ({
      href: '',
      download: '',
      click() {
        log.downloads.push(this.download)
      },
    }),
  }
  return { log, URLStub, documentStub }
}

/** 抓 `new ExcelJS.Workbook()` 造出来的那个 workbook。 */
function makeExcelJSStub(captured) {
  return {
    Workbook: function () {
      const wb = new RealExcelJS.Workbook()
      captured.wb = wb
      return wb
    },
  }
}

/** 把 workbook 摊成可比较的纯数据（值 / 行高 / 字体 / 对齐 / 底色 / 边框 + 列 + 合并）。 */
function dumpWorkbook(wb) {
  const ws = wb.worksheets[0]
  const rows = []
  ws.eachRow({ includeEmpty: true }, (r) => {
    const cells = []
    r.eachCell({ includeEmpty: true }, (c) => {
      cells.push({ v: c.value ?? null, border: c.border ?? null })
    })
    rows.push({
      values: r.values,
      height: r.height ?? null,
      font: r.font ?? null,
      alignment: r.alignment ?? null,
      fill: r.fill ?? null,
      cells,
    })
  })
  return {
    sheetName: ws.name,
    rowCount: ws.rowCount,
    columns: ws.columns.map((c) => ({ header: c.header ?? null, key: c.key ?? null, width: c.width ?? null })),
    merges: Object.keys(ws._merges ?? {}).sort(),
    rows,
  }
}

const legacyExport = new Function(
  'ExcelJS',
  'ElementPlus',
  'window',
  'document',
  'Blob',
  'no',
  'zo',
  'po',
  'yo',
  'vo',
  'mo',
  'go',
  'fo',
  'f',
  'de',
  `${LEGACY_EXPORT_SRC}
   return z`,
)

async function runLegacyExport(rows, searchText) {
  const captured = {}
  const { log, URLStub, documentStub } = makeBrowserStubs()
  const z = legacyExport(
    makeExcelJSStub(captured),
    { ElMessage: { success: (m) => log.messages.push(['success', m]), error: (m) => log.messages.push(['error', m]) } },
    { URL: URLStub },
    documentStub,
    Blob,
    { value: rows.map(toLegacyRow) },
    { value: searchText },
    { value: runLegacyStats(rows).po.value },
    { value: runLegacyStats(rows).yo.value },
    { value: runLegacyStats(rows).vo.value },
    { value: runLegacyStats(rows).mo.value },
    { value: runLegacyStats(rows).go.value },
    { value: runLegacyStats(rows).fo.value },
    () => {
      throw new Error('旧版导出段不应调用局部解码器（f）')
    },
    () => {
      throw new Error('旧版导出段不应调用局部解码器（de）')
    },
  )
  await z()
  if (!captured.wb) throw new Error(`旧版导出没造出 workbook；提示语 = ${JSON.stringify(log.messages)}`)
  return { dump: dumpWorkbook(captured.wb), log }
}

async function runNewExport(rows, searchText) {
  const captured = {}
  const { log, URLStub, documentStub } = makeBrowserStubs()
  const newStats = runNewStats(rows)
  const js = NEW_EXPORT_JS
  const fn = new Function(
    'module',
    'exports',
    'exporting',
    'searchText',
    'filteredRows',
    'dateRange',
    'moveFans',
    'pingFans',
    'lightWindows',
    'showerFans',
    'others',
    'message',
    'document',
    'URL',
    'Blob',
    '__exceljs',
    `${js}
     return exportTable`,
  )
  const exportTable = fn(
    { exports: {} },
    {},
    { value: false },
    { value: searchText },
    { value: rows },
    newStats.dateRange,
    newStats.moveFans,
    newStats.pingFans,
    newStats.lightWindows,
    newStats.showerFans,
    newStats.others,
    { success: (m) => log.messages.push(['success', m]), error: (m) => log.messages.push(['error', m]) },
    documentStub,
    URLStub,
    Blob,
    async () => makeExcelJSStub(captured),
  )
  await exportTable()
  if (!captured.wb) throw new Error(`新版导出没造出 workbook；提示语 = ${JSON.stringify(log.messages)}`)
  return { dump: dumpWorkbook(captured.wb), log }
}

const TS_RE = /\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/

const legacyExp = await runLegacyExport(FIXTURES, '关键词 甲')
const newExp = await runNewExport(FIXTURES, '关键词 甲')

check('导出 · 工作表名', newExp.dump.sheetName, legacyExp.dump.sheetName)
check('导出 · 行数', newExp.dump.rowCount, legacyExp.dump.rowCount)
check('导出 · 列（header/key/width）', newExp.dump.columns, legacyExp.dump.columns)
check('导出 · 合并区', newExp.dump.merges, legacyExp.dump.merges)
// 行逐条比：先比条数，再逐行比 —— 逐行比能一眼看出是哪一行哪一格不对
check('导出 · 行数（含空行）', newExp.dump.rows.length, legacyExp.dump.rows.length)
let rowDiff = 0
for (let i = 0; i < Math.max(newExp.dump.rows.length, legacyExp.dump.rows.length); i++) {
  const a = legacyExp.dump.rows[i]
  const b = newExp.dump.rows[i]
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    rowDiff++
    fails++
    console.log(`  ✗ 导出第 ${i + 1} 行不一致`)
    console.log(`      旧版 = ${JSON.stringify(a)?.slice(0, 400)}`)
    console.log(`      新版 = ${JSON.stringify(b)?.slice(0, 400)}`)
  }
}
if (!rowDiff) console.log(`  ✓ 导出 ${newExp.dump.rows.length} 行逐行（值/行高/字体/对齐/底色/边框）一致`)

/*
 * 钉住旧版那个**重复表头行**（见 `Progress.vue` 的 `exportTable` 注释 ③）：
 * row3 = `ws.columns = cols` 时 ExcelJS 自己插的表头、row4 = 旧版 `addRow(cols.map(header))` 手工加的那行。
 * 两边都必须是这个形状 —— 哪天有人「顺手清理」成一行，这条会红，提醒他那是**改输出**、得先拍板。
 */
{
  // 只比前 4 列（整行 23 列，比全行太脆）
  const isHeaderRow = (r) => JSON.stringify(r?.values?.slice(1, 5)) === JSON.stringify(['日期', '客户', '单号', '生产进度'])
  const dup = [2, 3].every((i) => isHeaderRow(newExp.dump.rows[i]) && isHeaderRow(legacyExp.dump.rows[i]))
  if (dup) console.log('✓ 导出 · 第 3/4 行都是表头（旧版那个重复表头行照抄了）')
  else {
    fails++
    console.log('✗ 导出 · 第 3/4 行不是「两行一样的表头」—— 旧版是这个形状，新版跑偏了')
  }
}

check('导出 · 文件名（时间戳归一后）', newExp.log.downloads.map((d) => d.replace(TS_RE, 'TS')), legacyExp.log.downloads.map((d) => d.replace(TS_RE, 'TS')))
check('导出 · 提示语', newExp.log.messages, legacyExp.log.messages)
if (!TS_RE.test(newExp.log.downloads[0] ?? '')) {
  fails++
  console.log(`  ✗ 新版的文件名里没有「YYYY-MM-DD_HH-mm-ss」形状的时间戳：${newExp.log.downloads[0]}`)
} else {
  console.log('  ✓ 新版文件名的时间戳形状与旧版一致')
}

// ------------------------------------------------- 自检：两份「移门扇数」字面量必须一致 //
/*
 * 旧版把同一批扇数写了**两份**：`yo` 的 if 链（带「每樘几扇」的值）与 `fo` 的数组 `d`。
 * 新版也是两份（`moveFans` 的 if 链 + `MOVE_FAN_NAMES` 表）。
 * 夹具只覆盖「出现过的名字」⇒ 漏抄一个**不会有夹具报错**（那个名字压根没被喂进去），
 * 所以这里直接比两份的**集合**。
 */
{
  // 终点锚点取 `["includes"](s)`（**不含**前面那个 `]`）—— 那个 `]` 是数组自己的收尾，得留着
  const foSeg = cut(decoded, 'd=["2轨2扇"', '["includes"](s)', 'fo 的扇数数组').replace(
    /\["includes"\]\(s\)$/,
    '',
  )
  const legacyFanSet = JSON.parse(foSeg.replace(/^d=/, ''))
  // ⚠️ 这两处（`MOVE_FAN_NAMES` 表 / `moveFans` 的 if 链）**也在 P10 里** ⇒ 2026-09-20
  //    随之换源到 `useProgressStats.ts`（起点锚点原文一个字未动，`indexOf` 不吃前导空白）。
  const newFanList = new Function(
    `${toCjs(cutIn(stats, 'const MOVE_FAN_NAMES = [', '] as const', 'MOVE_FAN_NAMES') + ']')}\nreturn MOVE_FAN_NAMES`,
  )()
  // `yo` 的 if 链里出现的字面量（新版那段里的全部字符串）—— 与上面那张表应当**同集合**
  const moveSeg = toCjs(
    cutIn(stats, 'const moveFans = computed(', 'const pingFans = computed(', 'moveFans'),
  )
  // ⚠️ esbuild 会把单引号统一成双引号 ⇒ 两种引号都要认（第一版只认单引号，抓出个空数组）
  // ⚠️ 这一段里除了扇数，还有那个「哑口」判据的字符串 —— 要排掉，它不是扇数。
  const moveLits = [
    ...new Set(
      (moveSeg.match(/['"][^'"]+['"]/g) || [])
        .map((s) => s.slice(1, -1))
        .filter((s) => s !== '哑口'),
    ),
  ]
  const sort = (a) => [...a].sort()
  if (JSON.stringify(sort(legacyFanSet)) !== JSON.stringify(sort(newFanList))) {
    fails++
    console.log('✗ `MOVE_FAN_NAMES` 与旧版 `fo` 的数组不是同一批字面量')
    console.log(`    旧版 = ${JSON.stringify(sort(legacyFanSet))}`)
    console.log(`    新版 = ${JSON.stringify(sort(newFanList))}`)
  } else if (JSON.stringify(sort(newFanList)) !== JSON.stringify(sort(moveLits))) {
    fails++
    console.log('✗ 新版 `moveFans` 的 if 链与 `MOVE_FAN_NAMES` 不是同一批字面量（两份要一起改）')
    console.log(`    if 链 = ${JSON.stringify(sort(moveLits))}`)
    console.log(`    常量表 = ${JSON.stringify(sort(newFanList))}`)
  } else {
    console.log(`✓ 移门扇数字面量 · 旧版数组 / 新版 if 链 / 新版常量表 三份同集合（${newFanList.length} 项）`)
  }
}

// ---------------------------------------------------------------- 搜索框（§4.1 第 5 步）//
/*
 * 搜索框这一段值得单独钉：命中的是**十个字段**，而旧版写的是**中文键**、新版 DTO 是英文列名
 * （「型材」在新版叫 `profile`）—— 抄错一个键**不报错**，只是那个字段搜不到。
 * 这里把两边的**过滤表达式本身**切出来对跑，输入同一批行 + 同一批关键词。
 */
/*
 * ⚠️ 切出来的尾巴多带两层括号：这段是从 `no=Vue.computed((()=>{ … }))` 里抠出来的，
 *    末尾那个 `}))` 是 `Vue.computed(` 自己的收尾 ⇒ 去掉它才是能独立跑的语句序列
 *    （前面 stats 那段同理，只是它切在声明链上、尾巴是个逗号）。
 *    去掉后**再自检一次能不能 parse**，免得哪天锚点变了却「看起来成功」。
 */
const SEARCH_END_ANCHOR = 'ro=Vue.ref(1)'
const LEGACY_SEARCH_SRC = cut(decoded, 'if(!zo.value)return t;', SEARCH_END_ANCHOR, '搜索')
  // `cut` 的终点锚点是**含**在结果里的 ⇒ 先把它自己切掉，再去尾部那个逗号与 `Vue.computed` 的 `))`
  .slice(0, -SEARCH_END_ANCHOR.length)
  .replace(/,\s*$/, '')
  .replace(/\}\)\)$/, '')
if (!LEGACY_SEARCH_SRC.includes('回执单号') || LEGACY_SEARCH_SRC.length < 400) {
  throw new Error(`旧版搜索段形状不对（len=${LEGACY_SEARCH_SRC.length}）`)
}
// `de` 是这段里的局部解码器别名（`const V=de`），**只赋值不调用** ⇒ 给个会炸的桩，
// 万一哪天它真被调用了，测试立刻报出来，而不是静默返回 undefined。
const legacySearch = new Function('zo', 't', 'de', LEGACY_SEARCH_SRC)
const runLegacySearch = (rows, term) =>
  legacySearch({ value: term }, rows.map(toLegacyRow), () => {
    throw new Error('旧版搜索段不应调用局部解码器 de')
  })

const NEW_SEARCH_TS = cutVue(
  'const words = searchText.value.toLowerCase()',
  '\n  return list\n})',
  '搜索',
)
if (!NEW_SEARCH_TS.includes('SEARCH_FIELDS') || NEW_SEARCH_TS.length < 200) {
  throw new Error(`新版搜索段形状不对（len=${NEW_SEARCH_TS.length}）`)
}
/*
 * ⚠️ **2026-09-20（Progress 拆分 P5）：`SEARCH_FIELDS` 不在 `Progress.vue` 里了** ——
 *    它随「列头交互」整段搬进了 `app/src/composables/progress/useProgressHeader.ts`
 *    （纯搬迁、逐字未改，只是按「模块级常量必须出工厂」的口径多了一个 `export`）。
 *    ⇒ 这一对锚点改从这个新文件切；**断言与夹具一个字没动**（R12 档位 1）。
 *    ⚠️ 上面 `NEW_SEARCH_TS` 那一段（`filteredRows`）**仍然在 `.vue` 里**（它是 P6，Task 7 才搬）
 *      ⇒ 本台子现在是**跨两个文件**取料，`cutIn` 的 `src` 参数就是为这个加的。
 *    回退法：`git checkout <本笔之前的 sha> -- docs/progress-toolbar-logiccheck.mjs`
 *    （换源前必须连同 `Progress.vue` 一起回退，否则那对锚点在两边都不在）。
 *    ⚠️ 锚点本身**一个字没改**：新文件里那两行与 REF 逐字相同（只缩进为 0，原本也是 0）。
 */
const SEARCH_FIELDS_TS = cutIn(header, 'const SEARCH_FIELDS = [', '] as const satisfies', 'SEARCH_FIELDS') + ']'
/*
 * `SEARCH_FIELDS` 在 `filteredRows` **外面**（是模块级常量）⇒ 单独切出来求值，
 * 再当参数喂进那段过滤代码。这样「十个字段 + 它们的顺序」也被这份夹具钉住。
 * ⚠️ 切出来的这段**不含** `return list;`（锚点故意停在它前面）⇒ 这里自己补一句。
 */
const extractedFields = new Function(`${toCjs(SEARCH_FIELDS_TS)}\nreturn SEARCH_FIELDS`)()
const newSearchBody = toCjs(NEW_SEARCH_TS)
const makeNewSearch = new Function(
  'searchText',
  'SEARCH_FIELDS',
  `return function newSearch(list) {\n${newSearchBody}\nreturn list\n}`,
)
// ⚠️ `searchText` 是**每次调用现取**的（旧版也是 `zo.value` 现读）——
//    第一版把它在构造期固定成空串，结果「搜索永远不筛」，差点被当成新版实现错。
const runNewSearch = (rows, term) => makeNewSearch({ value: term }, extractedFields)(rows)

/** 搜索夹具：一行里十种字段各放一个可搜到的词，外加干扰项。 */
const SEARCH_ROWS = [
  row({ 客户: '张三门窗', profile: '断桥铝', 备注: '急单', 单号: '85-26/09/14', 安装地址: '人民路 1 号', 业务员: '李四', 打单人: '王五', 生产进度: '下料_张三_2026-09-14➞打包_李四_2026-09-15', 回执单号: 'R-001', 日期: '2026-09-14' }),
  row({ 客户: 'ABC 幕墙', profile: '钻石', 备注: '无', 单号: '86-26/09/15', 安装地址: '解放路 2 号', 业务员: '赵六', 打单人: '王五', 生产进度: '下料', 回执单号: 'R-002', 日期: '2026-09-15' }),
]
const SEARCH_TERMS = [
  '',
  '张三',
  '断桥',
  '急单',
  '85-26',
  '人民路',
  '李四',
  '王五',
  '下料',
  'R-001',
  '2026-09-15',
  '钻石 幕墙', // 两个词分属不同字段 ⇒ 必须**都**命中（同一行）
  '张三 幕墙', // 两个词分属**不同行** ⇒ 一条都不该命中
  '  张三   急单  ', // 多个空格 + 前后空白
  '不存在的东西',
]
{
  let bad = 0
  for (const term of SEARCH_TERMS) {
    const legacyIds = runLegacySearch(SEARCH_ROWS, term).map((r) => r['单号'])
    const newIds = runNewSearch(SEARCH_ROWS, term).map((r) => r['单号'])
    if (JSON.stringify(legacyIds) !== JSON.stringify(newIds)) {
      bad++
      fails++
      console.log(`  ✗ 搜索词 ${JSON.stringify(term)}：旧版 ${JSON.stringify(legacyIds)} / 新版 ${JSON.stringify(newIds)}`)
    }
  }
  if (!bad) console.log(`✓ 搜索框 · ${SEARCH_TERMS.length} 组关键词（含多词、前后空白）命中集合一致`)
  // 反向自检：夹具得真的能被筛掉 —— 否则「两边都返回全部」也会绿
  const narrowed = runLegacySearch(SEARCH_ROWS, "张三")
  if (narrowed.length !== 1) {
    fails++
    console.log(`✗ 搜索夹具失效：搜「张三」应只剩 1 条，实际 ${narrowed.length} 条`)
  }
}

// ---------------------------------------------------------------- 汇总 //
console.log('')
if (fails) {
  console.log(`✗ 有 ${fails} 处不一致`)
  process.exit(1)
}
console.log('✓ 全部一致')
