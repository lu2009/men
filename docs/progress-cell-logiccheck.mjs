/*
 * 「生产进度」格 `va()` 的**逐字差分台**：同一批夹具，左边跑**旧版真代码**，右边跑**新版真代码**
 * （直接从 `app/src/views/Progress.vue` 里切出来 + esbuild 剥类型），逐字节比输出。
 *
 * 为什么值得单独盯：`va()` 的输出是**含内联样式的 HTML 串**，错了既不报错也不崩 ——
 * 只是「当前工序」标红的位置不对（标到上一道工序 / 标了半截 / 全红），
 * 而这种错**肉眼一眼看不出来**（几道工序的字符串长得几乎一样）。见 §5.2。
 *
 * 左边（旧版）：`legacy/js/Progress-f4bdef35.js` 里 `va=e=>{…}` 那一段。
 *   先按文档给的命令解混淆（`legacy/decode-progress-scoped.mjs`），缓存到 `/tmp`。
 * 右边（新版）：`app/src/views/Progress.vue` 里 `// ── A1.` 到 `// ── A2.` 之间的整段。
 *
 * ⚠️ **已知且有意的一处不同**：新版把非红色部分做了 **HTML 转义**（旧版裸 `innerHTML`）。
 *    所以夹具里一律不放 `<`/`>`/`&`，两边应当**逐字节相等**；
 *    另外单列一条「转义」的用例，只断言新版转义、不断言两边相等。
 *
 * 用法：node docs/progress-cell-logiccheck.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const BUNDLE = resolve(ROOT, 'legacy/js/Progress-f4bdef35.js')
const MAP = '/tmp/progress.map.json'
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

// 锚点 1：`va=e=>{…}` 的起点。**必须唯一命中** —— 不唯一就说明解码输出变了，先看一眼再改。
const VA_START = decoded.indexOf('va=e=>{const t=f;if(!e||""===e.trim())return"";')
if (VA_START < 0) throw new Error('旧版 `va` 的锚点没命中 —— 解码输出变了')
const VA_TAIL = 'return n["join"]("➞")}'
const VA_END = decoded.indexOf(VA_TAIL, VA_START)
if (VA_END < 0) throw new Error('旧版 `va` 的结尾锚点没命中')
const LEGACY_SRC = decoded.slice(VA_START, VA_END + VA_TAIL.length)

// 自检：切出来的这一段得真的像个函数（防止锚点错位却"看起来成功"）。
if (!LEGACY_SRC.startsWith('va=e=>{') || LEGACY_SRC.length < 400 || LEGACY_SRC.length > 2000) {
  throw new Error(`切出来的旧版 va 形状不对（len=${LEGACY_SRC.length}）`)
}
// 解码表里 `f` 是局部解码器；这段 `va` 里只把它当 `const t=f` 用，**从未调用** ⇒ 给个占位即可。
const legacyVa = new Function('f', `const ${LEGACY_SRC}; return va`)(() => {
  throw new Error('旧版 va 不应调用局部解码器 f')
})

// ---------------------------------------------------------------- 新版侧 //
const vue = readFileSync(VUE, 'utf8')
const NEW_START = vue.indexOf('const RED_STYLE = ')
const NEW_END = vue.indexOf('// ── A2.')
if (NEW_START < 0 || NEW_END < 0) throw new Error('新版 Progress.vue 的锚点变了（`RED_STYLE` / `── A2.`）')
const NEW_TS = vue.slice(NEW_START, NEW_END)

// 从 app/ 的 node_modules 里拿 esbuild（根目录没有）。
const require = createRequire(resolve(ROOT, 'app/package.json'))
const esbuild = require('esbuild')
const NEW_JS = esbuild.transformSync(NEW_TS, { loader: 'ts', format: 'cjs' }).code
const newVa = new Function('module', 'exports', `${NEW_JS}\nreturn va`)(
  { exports: {} },
  {},
)

// ------------------------------------------------------------- 差分夹具 //
/*
 * 夹具按「旧版分支」组织，每一类都要有：
 *   ① 无 `➞` 无 `_`      → 原样（不标红）
 *   ② 无 `➞` 有 `_`      → 末段标红
 *   ③ 有 `➞`、**日期全同** → 最后一段带日期的整段标红
 *   ④ 有 `➞`、日期不同     → **日期最大**那段整段标红
 *   ⑤ 有 `➞`、**都没日期** → 每段各自的「`_` 后那截」标红
 *   ⑥ 边界：空串 / 纯空格 / 段首段尾多余 `➞` / 操作员段缺失（`名_日期`）
 */
const FIXTURES = [
  // ①
  ['下料', '①无➞无_'],
  ['下料 组装 打包', '①无➞无_（带空格）'],
  // ②
  ['下料_张三', '②无➞有_'],
  ['下料_张三_2026-09-19', '②无➞有_（三段）'],
  // ③ 日期全同 → 最后一段
  ['下料_张三_2026-09-19➞组装_李四_2026-09-19➞打包_王五_2026-09-19', '③日期全同'],
  ['下料_2026-09-19➞组装_2026-09-19', '③日期全同（无操作员）'],
  // ④ 日期不同 → 日期最大那段
  ['下料_张三_2026-09-01➞组装_李四_2026-09-19➞打包_王五_2026-09-10', '④日期不同（最大在中间）'],
  ['下料_张三_2026-09-20➞组装_李四_2026-09-01', '④日期不同（最大在开头）'],
  ['下料_张三_2026-09-01➞组装_李四_2026-09-02', '④日期不同（最大在末尾）'],
  // ⑤ 都没日期
  ['下料_张三➞组装_李四', '⑤都没日期（两段都有_）'],
  ['下料➞组装', '⑤都没日期（两段都没_）'],
  ['下料_张三➞组装', '⑤都没日期（一段有一段没有）'],
  // ⑥ 边界
  ['', '⑥空串'],
  ['   ', '⑥纯空格'],
  ['➞下料_张三_2026-09-19➞', '⑥首尾多余 ➞'],
  ['下料_张三_2026-09-19➞➞打包_2026-09-19', '⑥中间空段'],
  ['回款_张三_2026-09-19', '⑥「回款」段（外层还要加 .progress-paid）'],
]

let fail = 0
for (const [input, what] of FIXTURES) {
  const a = legacyVa(input)
  const b = newVa(input)
  if (a !== b) {
    fail++
    console.log(`✗ ${what}\n  输入: ${JSON.stringify(input)}\n  旧版: ${a}\n  新版: ${b}`)
  }
}
console.log(`\nva() 逐字对照：${FIXTURES.length - fail}/${FIXTURES.length} 命中`)

// ------------------------------------------------- 转义（新版独有，单列） //
const XSS = '<img src=x onerror=alert(1)>_张三'
const escOut = newVa(XSS)
const escOk = !escOut.includes('<img') && escOut.includes('&lt;img')
console.log(`HTML 转义（新版有意偏离）：${escOk ? '✓' : '✗ 没转义！'}  ${escOut}`)
if (!escOk) fail++

// 旧版这一条**会**吐出裸标签 —— 把这个差异钉在脚本里，免得后人以为是我们抄错了。
const legacyXss = legacyVa(XSS)
console.log(`旧版同输入（裸 innerHTML，预期含裸标签）：${legacyXss.includes('<img') ? '✓ 确认' : '✗ 与预期不符'}`)

// ═══════════════════════════════════════════════════════════════════════════
// 第二部分：颜色口径 —— 主要用来钉住 **`procedure_name_order_list` 的替代口径**
// ═══════════════════════════════════════════════════════════════════════════
/*
 * 旧版 `J(进度串)` 有两条路：
 *   A. `procedure_name_order_list`（localStorage）**非空** ⇒ **从后往前**找第一个
 *      「名字被进度串 includes 且该名字在颜色表里有色」的 ⇒ 返回它的色；一个都没有 ⇒ `null`。
 *   B. 该 List **为空** ⇒ 取「日期最大那一段」，再拿颜色表的 key 按**长度倒序**找第一个被该段 includes 的。
 *
 * ★ 新版**没有这个键**（它是 `/Qrscanner` 保存时写的，见 qrscanner 分析 §4.3）。
 *   新版的等价物 = **按槽号从大到小**扫 `procedures` 的名字（`orderedProcedureNames`）。
 *   依据：旧版那个 List 就是**按槽号升序**写的 ⇒「从后往前找」= 「按槽号从高到低找」，**完全等价**。
 *
 * ⚠️ **一处已知且有意的不等价**：旧版写 List 时**排掉了工序10**（`El` 而不是 `yl` 的全键），
 *    新版**不排**（`docs/2026-09-19-qrscanner-analysis.md` §8.3-1：新版已去掉「回款→工序10」
 *    的全部特判，槽不再有特殊含义）。所以当进度串里有「回款」时两边可能给出**不同**的颜色 ——
 *    这一条在下面**单列断言**（断言"确实不同"），而不是当 bug。
 */
/** 花括号/圆括号/方括号配平自检 —— 切片切歪了**必须当场报错**，不能等到 new Function 才炸。 */
function assertBalanced(src, label) {
  let depth = 0
  let inStr = null
  let inRe = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inStr) {
      if (inRe && c === '[') {
        // 正则里的方括号（本例只有 `/\s+/g`，没有）—— 保守处理，直接跳过
      }
      if (c === '\\') i++
      else if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'") inStr = c
    else if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    if (depth < 0) throw new Error(`${label}: 括号提前闭合 —— 切片切歪了`)
  }
  if (depth !== 0) throw new Error(`${label}: 括号不配平（差 ${depth}）—— 结尾锚点八成命中了内层的同名片段`)
  inRe = false
  if (!/\}$/.test(src)) throw new Error(`${label}: 结尾不是 '}' —— 切片没包住整个函数`)
}

function sliceFn(src, head, tail) {
  const s = src.indexOf(head)
  if (s < 0) throw new Error(`锚点没命中：${head}`)
  if (src.indexOf(head, s + 1) >= 0) throw new Error(`锚点不唯一：${head}`)
  const e = src.indexOf(tail, s)
  if (e < 0) throw new Error(`结尾锚点没命中：${tail}`)
  const out = src.slice(s, e + tail.length)
  assertBalanced(out, head)
  return out
}

const LEGACY_COLOR_SRC = [
  // ⚠️ `F` 的收尾 `}` 是 `'}`' —— 别漏，漏了会把后面每个函数都吞进 F 的函数体（第一版就这么挂的）
  sliceFn(decoded, 'F=e=>{const t=f;', '["toLowerCase"]()}'),

  sliceFn(decoded, 'X=()=>{const e=f;', 'catch(t){return{}}}'),
  // ⚠️ `J` 的结尾锚点必须取**最后**那个 `return a[u]||null}` ——
  //    取 `return null}` 会命中 `if(o["length"]>0){…return null}` 那处**内层**的（第一版就这么挂的，
  //    而且症状是 `new Function` 报语法错，看不出是哪个函数切歪了 ⇒ 现在有 `assertBalanced` 兜底）。
  //    内层那个读 order_list 的 IIFE 藏在 `const o=(()=>{…})()` 里，一起切进来。
  sliceFn(decoded, 'J=e=>{const t=f,l=', 'for(const u of r)if(n["includes"](u))return a[u]||null;return null}'),
  sliceFn(decoded, 'R=e=>{const t=f,l=', '["includes"]("自助下单")?F("#FFA500"):""}'),
  sliceFn(decoded, 're=e=>{const t=f,l=', '?{backgroundColor:"#FFA500",fontWeight:"bold"}:{}}'),
].join(';')

/** 造一个「旧版运行环境」：`localStorage` 里放给定的两个键，返回 `{F,J,R,re}`。 */
function makeLegacyColor(colorMap, orderList) {
  const store = {
    procedure_name_color_map: JSON.stringify(colorMap),
    procedure_name_order_list: JSON.stringify(orderList),
  }
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => (store[k] = String(v)),
  }
  return new Function(
    'f',
    'localStorage',
    'Vl',
    'wl',
    `${LEGACY_COLOR_SRC}; return { F, J, R, re }`,
  )(
    () => {
      throw new Error('颜色函数不应调用局部解码器 f')
    },
    localStorage,
    'procedure_name_color_map',
    'procedure_name_order_list',
  )
}

// 新版侧：从 `RED_STYLE` 一直切到「B1」之前（含 A1 `va` + A2 格件 + 颜色整段）。
const NEW_END2 = vue.indexOf('// ── B1.')
if (NEW_END2 < 0) throw new Error('新版 Progress.vue 的 `── B1.` 锚点变了')
const NEW_ALL_TS = vue.slice(NEW_START, NEW_END2)
const NEW_ALL_JS = esbuild.transformSync(NEW_ALL_TS, { loader: 'ts', format: 'cjs' }).code

const { computed, h, ref } = require('vue')
const makeNewColor = (slots) => {
  const procedures = ref(slots)
  return new Function(
    'h',
    'computed',
    'ref',
    'procedures',
    `${NEW_ALL_JS}; return { colorKeyOf, progressCellStyle, resolveConfiguredColor, orderedProcedureNames, colorFilterOptions }`,
  )(h, computed, ref, procedures)
}

// ---- 夹具：15 个槽，一部分配了名字 + 颜色 ----
const NAME = {
  工序1: '下料',
  工序2: '组装',
  工序3: '打包',
  工序5: '穿条',
  工序8: '装玻璃',
  工序10: '回款',
  工序12: '质检',
  工序15: '发货',
}
const COLOR = {
  工序1: '#67C23A',
  工序2: '#409EFF',
  工序3: '#E6A23C',
  工序5: '#909399',
  工序8: '#F56C6C',
  工序10: '#90EE90',
  工序12: '#8E44AD',
  工序15: '#F1C40F',
}
const SLOTS = Object.keys(NAME).map((slot) => ({ slot, name: NAME[slot], color: COLOR[slot] }))
// 旧版写 order_list 的口径：只取 `El`（**不含工序10**），按槽号升序，trim 后过滤空
const LEGACY_ORDER_LIST = Object.entries(NAME)
  .filter(([slot]) => slot !== '工序10')
  .map(([, name]) => name)

const newColor = makeNewColor(SLOTS)
// 旧版颜色表是 **名字 → 色**（含工序10）
const legacyColor = makeLegacyColor(
  Object.fromEntries(Object.entries(NAME).map(([slot, name]) => [name, COLOR[slot]])),
  LEGACY_ORDER_LIST,
)

const COLOR_FIXTURES = [
  // 单工序、无 ➞
  ['下料', '单段命中'],
  ['下料_张三_2026-09-19', '单段带日期'],
  ['不存在的工序', '单段不命中 → 空键（不标底色）'],
  ['', '空串 → 红底 #b71c1c'],
  // 多工序 ➞：**从后往前**找第一个命中
  ['下料_2026-09-01➞组装_2026-09-02', '两段都在表里 → 取靠后的「组装」'],
  ['下料_2026-09-01➞组装_2026-09-02➞打包_2026-09-03', '三段都在表里 → 取最后的「打包」'],
  ['下料_2026-09-01➞组装➞不存在', '最后一段不在表里 → 退回「组装」'],
  // 高槽号优先（证明是「按槽号」而不是「按出现顺序」）
  ['组装_2026-09-02➞下料_2026-09-01', '出现顺序反了 → 仍取槽号高的「组装」'],
  ['质检➞下料', '工序12 在工序1 之后 → 取「质检」'],
  // 命中优先级 + 关键词兜底
  ['下料_2026-09-01', '表里命中 → 不落到关键词兜底'],
  ['已打生产单', '表里不命中 → 关键词兜底 #FFFF99'],
  ['部分发货', '关键词兜底 #90EE90'],
]

let cFail = 0
for (const [input, what] of COLOR_FIXTURES) {
  const legacyKey = legacyColor.R(input)
  const newKey = newColor.colorKeyOf(input)
  if (legacyKey !== newKey) {
    cFail++
    console.log(`✗ [颜色] ${what}\n  输入: ${JSON.stringify(input)}\n  旧版: ${JSON.stringify(legacyKey)}\n  新版: ${JSON.stringify(newKey)}`)
  }
  // 底色也要一起比（`re()` vs `progressCellStyle()`）
  const lc = JSON.stringify(legacyColor.re(input))
  const nc = JSON.stringify(newColor.progressCellStyle(input))
  if (lc !== nc) {
    cFail++
    console.log(`✗ [底色] ${what}\n  输入: ${JSON.stringify(input)}\n  旧版: ${lc}\n  新版: ${nc}`)
  }
}
console.log(`\n颜色口径逐字对照：${COLOR_FIXTURES.length * 2 - cFail}/${COLOR_FIXTURES.length * 2} 命中`)
console.log(`  新版 order_list 等价物（按槽号降序）= ${JSON.stringify(newColor.orderedProcedureNames.value)}`)
console.log(`  旧版 order_list（qrscanner 写入口径，排掉工序10）= ${JSON.stringify(LEGACY_ORDER_LIST)}`)

// ---- 已知且有意的不等价：工序10 不再被排掉 ----
/*
 * 夹具要挑**能让两条路分岔**的：
 *   新版按槽号降序 = 发货(15) 质检(12) **回款(10)** 装玻璃(8) 穿条(5) 打包(3) 组装(2) 下料(1)
 *   旧版 order_list 降序 = 发货 质检 装玻璃 穿条 打包 **组装** 下料（**没有回款**，工序10 被排掉了）
 * ⇒ 串里放「组装 + 回款」时：新版先撞上「回款」，旧版跳过「回款」撞上「组装」。
 *   若串里放的是「质检 + 回款」，两边**都是「质检」**（质检槽号更高）—— 那样测不出差异（第一版选错夹具就是这个结果）。
 */
const HUIKUAN = '组装_2026-09-01➞回款_张三_2026-09-19'
const legacyHk = legacyColor.R(HUIKUAN)
const newHk = newColor.colorKeyOf(HUIKUAN)
const diverges = legacyHk !== newHk
console.log(
  `\n工序10「回款」：旧版=${JSON.stringify(legacyHk)} 新版=${JSON.stringify(newHk)} —— ` +
    (diverges ? '✓ 确认不等价（**有意**，见脚本注释与 qrscanner §8.3-1）' : '✗ 预期应当不等价，实际却一样，先查是不是夹具失效了'),
)
if (!diverges) cFail++

if (fail || cFail) {
  console.log(`\n✗ 有 ${fail + cFail} 条不一致`)
  process.exit(1)
}
console.log('\n✓ 全部一致')
