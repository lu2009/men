/*
 * Progress「查询更多」的差分台：同一批夹具，左边跑**旧版真代码**（`Io` 里「取回来的行怎么落地」
 * 那一段，从 `Progress-f4bdef35.js` 解混淆后切出来真跑），右边跑**新版真代码**
 * （新版那一侧在 `app/src/composables/progress/useProgressQueryMore.ts` 的 `submitMore` 里
 * —— 2026-09-20 Progress 拆分 **P8** 把这段搬出了 `Progress.vue`，本台随之换源）。
 *
 * 这一段值得单独钉 —— 它有三处**抄错不报错、肉眼也看不出来**的地方：
 *   ① **排序**：`parseInt(回执单号)` **倒序**。回执单号解不出来时是 `NaN`，比较函数返回 `NaN`，
 *      引擎按 0 处理 ⇒ 那几行的位置是「碰巧」的。换个写法（`localeCompare`、或先 filter 掉空值）
 *      看起来更"对"，但和旧版不一样。
 *   ② **并入全量 `K` 的规则**：查回来的**已有 id 换成新对象**（留在原位），**新 id 追加到末尾**。
 *      写成「先把旧的删掉再全部 append」会在页面上立刻看出来（行的顺序变了），
 *      写成「合并对象」则看不出来但对象身份变了（勾选态/展开态会跟着乱）。
 *   ③ **`zo` 被赋成「客户 + 空格 + 地址」**：它**同时**是「当前筛选」那句文案、搜索过滤词、
 *      和「导出表格」那颗按钮的显示开关 —— 少一个空格就少筛一个词。
 *
 * ⚠️ **这台差分台不覆盖的东西**（别以为它绿了就全都对）：
 *   1. **数据范围那一步**（旧版 `!b2 && (d = d.filter(打单人 === 自己))`）。新版**有意不做**
 *      （见 `Progress.vue` 里 `oo` 那段注释：它依赖 `userinfo.registrant/name` 那套账号字段）。
 *      夹具里把 `b` 固定成 `{value:true}`（= 注册人本人）⇒ 这一段在两边都**不生效**，不参与比对。
 *   2. **取数本身**（URL 的四个参数怎么拼）。那是 `api.listProgressMore` 的事，这里只喂现成的响应。
 *   3. **弹窗 UI**（客户自动完成、日期快捷项、默认区间）。
 *   4. `NaN` 那几行的**相对次序**只保证「两边一致」，不保证任何"正确"次序（旧版就没有）。
 *   5. ⚠️ **查回来的行上那两个字段，30 项比对一个都不看**（2026-09-20 实测，Task 5 记下）：
 *      `isSelected`（旧版 `isSelected:!1` = **勾选态随新对象归零**）与
 *      `生产进度`（旧版 `e["生产进度"]||""` = **兜底成空串**）。
 *      `shape()` 只取 `id:tag`，五条 `cmp` 也都不碰这两列 ⇒ 新版把 `isSelected: false`
 *      写成 `true`（或干脆照抄 `r.isSelected`）、把 `|| ''` 兜底删掉，**这台台子照样全绿**。
 *      实测：`isSelected: false → true`、`|| '' → || 'XX'` 两个突变，台子都 exit 0。
 *      要真盖住它**得同时**加断言**和**改夹具 —— `row()` 现在是
 *      `isSelected: tag === 'old'`，而每个夹具的 `q` 行都是 `'fresh'` ⇒ 全 `false`，
 *      **光加断言也看不见**（得给 `q` 塞一条 `isSelected: true` 的行）。
 *      本任务（纯搬迁）**不动它**，只如实记下 —— 别把「台子绿」当成这两列也核过了。
 *
 * ⚠️ 夹具只有能说清「夹具本身与旧版口径不符」时才能改，且要写明理由 —— 不许为了让测试变绿改夹具。
 *
 * 用法：node docs/progress-more-logiccheck.mjs
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
// ⚠️ 换源（Task 5 / R42）：这段 2026-09-20 随 **P8** 搬进了这个 composable
// （`Progress.vue` 里只剩一行指路注释）⇒ 从 `.vue` 改切这个 `.ts`。
const MORE_TS = resolve(ROOT, 'app/src/composables/progress/useProgressQueryMore.ts')

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
  // ⚠️ 终点锚点**含**在结果里（与本目录其它差分台一致）—— B 段就是靠这一点把 `.trim()` 收全的。
  return src.slice(a, b + endAnchor.length)
}

/*
 * 切 `Io` 的中段。**得分两段切** —— 旧版那个 `if` 的条件表达式把「并入全量」和「赋值 zo」和
 * 「关窗」全用逗号串在一起了（`if(K=…, K=…, zo=…, ho=!1, …, B&&N){…}`），
 * 一次切到 `zo` 会留下一个没有收尾的 `if(`（第一版就是这么 SyntaxError 的）。
 *
 *   A 段：`let d=c["data"].progressData…` → `Bo["value"]=!0;`（取数 + 补字段 + 排序 + 换底表）
 *   B 段：`const V=new Set(…` → `,ho["value"]=!1` 之前（并入 `K` + 赋值 `zo`）
 *
 * ⚠️ B 段开头那个 `if(K["value"]=` 是**同一个 `if` 的开头**，这里把它摘掉、让后面那几个逗号项
 *    变成一条普通的逗号表达式语句（我们只要前三个项；`ho`/`t.close()`/`B&&N` 是关窗与回灌，
 *    不在这台差分台的比对范围）。摘除次数**必须正好 1 次**，否则锚点变了。
 */
const MORE_A = cut(decoded, 'let d=c["data"].progressData[', 'Bo["value"]=!0;', '查询更多·A')
let MORE_B = cut(
  decoded,
  'const V=new Set(K["value"]["map"]',
  '.trim()',
  '查询更多·B',
)
if (MORE_B.split('if(K["value"]=').length - 1 !== 1) {
  throw new Error('旧版 B 段里 `if(K["value"]=` 的出现次数不是 1 —— 锚点变了')
}
MORE_B = MORE_B.replace('if(K["value"]=', 'K["value"]=')

// A 段实测 234 字符（就是那一长串），阈值取 180 留点余量；再钉住三个关键片段。
if (
  MORE_A.length < 180 ||
  !MORE_A.includes('parseInt') ||
  !MORE_A.includes('xo["value"]=d,Bo["value"]=!0;')
) {
  throw new Error(`旧版 A 段形状不对（len=${MORE_A.length}）`)
}
if (MORE_B.length < 260 || !MORE_B.includes('zo["value"]=((Do["selectedClient"]')) {
  throw new Error(`旧版 B 段形状不对（len=${MORE_B.length}）`)
}
// 这两段里不该有局部解码器调用（`=de` 之类）—— 有就说明切宽了，立刻报出来而不是静默跑错。
if (/=\s*de\b/.test(MORE_A + MORE_B)) throw new Error('旧版这段里出现了局部解码器 de —— 锚点切宽了')

const LEGACY_SRC = `
  ${MORE_A}
  ${MORE_B};
  return { d, xo, Bo, K, zo }
`

/**
 * 跑旧版那一段。`c` = 接口响应，`K`/`xo`/`Bo`/`zo` 是页面级的 ref 桩，
 * `b` 固定 `true`（= 注册人本人 ⇒ **不走**数据范围那一步，见文件头第 1 条）。
 */
function runLegacy(c, K, xo, Bo, zo, Do) {
  const fn = new Function('c', 'b', 'L', 'xo', 'Bo', 'K', 'Do', 'zo', LEGACY_SRC)
  return fn(c, { value: true }, { value: '' }, xo, Bo, K, Do, zo)
}

// ---------------------------------------------------------------- 新版侧 //
const moreSrc = readFileSync(MORE_TS, 'utf8')

function cutNew(startAnchor, endAnchor, what) {
  const a = moreSrc.indexOf(startAnchor)
  if (a < 0) throw new Error(`新版锚点没命中（${what} 的起点）：${startAnchor}`)
  if (moreSrc.indexOf(startAnchor, a + 1) >= 0) throw new Error(`新版锚点不唯一（${what} 的起点）`)
  const b = moreSrc.indexOf(endAnchor, a)
  if (b < 0) throw new Error(`新版锚点没命中（${what} 的终点）：${endAnchor}`)
  return moreSrc.slice(a, b + endAnchor.length)
}

const NEW_TS = cutNew(
  'const list: ProgressRow[] = (d?.progressData ?? [])',
  // ⚠️ 终点锚点**必须跟着 P8 的注入改写走**：这段读的搜索框现在是注进来的
  //   `deps.searchText`（工厂回传），不再是壳里的裸 `searchText`。
  //   起点锚点一个字未动（`const list: ProgressRow[] = …` 搬迁时逐字保留、只多了 2 缩进，
  //   而 `indexOf` 不吃前导空白）。
  'deps.searchText.value = `${moreForm.client} ${moreForm.address}`.trim()',
  '查询更多·落地',
)
if (NEW_TS.length < 400 || !NEW_TS.includes('moreActive.value = true')) {
  throw new Error(`新版「查询更多·落地」段形状不对（len=${NEW_TS.length}）`)
}

const require = createRequire(resolve(ROOT, 'app/package.json'))
const esbuild = require('esbuild')
const NEW_JS = esbuild.transformSync(NEW_TS, { loader: 'ts', format: 'cjs', charset: 'utf8' }).code

/**
 * 跑新版那一段（`d` = 接口响应，其余是 ref 桩）。
 *
 * ⚠️ 换源之后这段读的是**注入对象**（P8 工厂的 `deps`），所以要多搭一个 `deps` 壳：
 *   `deps.rows` / `deps.searchText` **就是**传进来的那两个 ref 桩本身（同一对象，
 *   不是复制）⇒ 工厂里 `deps.rows.value = [...]` 的写入照旧落在 `rows` 上，
 *   调用点、夹具、断言**一个字都不用动**。
 *   实测这段里出现的 `deps.` 只有 `deps.rows`(×3) 与 `deps.searchText`(×1) 两个键，
 *   没有 `message`/`dashboardShow`（那两个在本段的区间**外**）⇒ 不必多搭别的桩。
 */
function runNew(d, rows, moreRows, moreActive, moreForm, searchText) {
  const deps = { rows, searchText }
  const fn = new Function(
    'd',
    'rows',
    'moreRows',
    'moreActive',
    'moreForm',
    'searchText',
    'deps',
    `${NEW_JS}\n return { list, rows, moreRows, moreActive, searchText }`,
  )
  return fn(d, rows, moreRows, moreActive, moreForm, searchText, deps)
}

// ------------------------------------------------------------------ 夹具 //
/**
 * 一行：`id` 是身份、`回执单号` 参与排序、`tag` 用来分辨「这一行是原有的还是查回来的」。
 * 其余字段与这段逻辑无关，夹具里不塞（`生产进度` 会被兜底成 `''`，两边都会做）。
 */
const row = (id, receipt, tag) => ({ id, 回执单号: receipt, tag, isSelected: tag === 'old' })

const CASES = [
  {
    name: '回执单号都是数字：按 parseInt 倒序',
    K: [row(1, '1001', 'old'), row(2, '1003', 'old'), row(3, '1002', 'old')],
    q: [row(9, '1001', 'fresh'), row(8, '1003', 'fresh'), row(7, '1002', 'fresh')],
    client: '张三',
    address: '幸福路 1 号',
  },
  {
    name: '回执单号解不出来（空串 / 非数字）夹在中间',
    K: [row(1, '', 'old'), row(2, '1002', 'old')],
    q: [row(5, '', 'fresh'), row(6, 'R-2024-0007', 'fresh'), row(4, '1002', 'fresh'), row(3, '99', 'fresh')],
    client: '',
    address: '',
  },
  {
    name: '并入：已有 id 换新对象（留在原位）+ 新 id 追加到末尾',
    K: [row(1, '10', 'old'), row(2, '9', 'old'), row(3, '8', 'old')],
    q: [row(3, '8', 'fresh'), row(4, '7', 'fresh'), row(1, '10', 'fresh'), row(5, '6', 'fresh')],
    client: '李四',
    address: '',
  },
  {
    name: '空结果：一行都不换、也不追加（原有的对象身份不变）',
    K: [row(1, '10', 'old'), row(2, '9', 'old')],
    q: [],
    client: '',
    address: '某路',
  },
  {
    name: '全量里一行都没有（首次查询就查出一批新的）',
    K: [],
    q: [row(1, '5', 'fresh'), row(2, '4', 'fresh')],
    client: '王五',
    address: '两条街 3 号',
  },
  {
    name: '只填客户 / 只填地址：`zo` 去空格后**不留**多余空白',
    K: [row(1, '5', 'old')],
    q: [row(1, '5', 'fresh')],
    client: '  张三  ',
    address: '',
  },
]

// ------------------------------------------------------------------ 跑比 //
let failed = 0
let checks = 0

/** 只比「谁、什么顺序、是不是查回来那份对象」—— 其余字段两边都不该动。 */
const shape = (arr) => arr.map((r) => `${r.id}:${r.tag}`).join(',')

for (const c of CASES) {
  // 两边各自一份对象（不能共用，否则是在自己跟自己比）。
  const K = { value: c.K.map((r) => ({ ...r })) }
  const XO = { value: [] }
  const BO = { value: false }
  const ZO = { value: '' }
  const DO = { selectedClient: c.client, selectedAddress: c.address }
  const legacy = runLegacy({ data: { progressData: c.q.map((r) => ({ ...r })) } }, K, XO, BO, ZO, DO)

  const rowsRef = { value: c.K.map((r) => ({ ...r })) }
  const moreRowsRef = { value: [] }
  const moreActiveRef = { value: false }
  const moreForm = { client: c.client, address: c.address }
  const searchTextRef = { value: '' }
  const now = runNew(
    { progressData: c.q.map((r) => ({ ...r })) },
    rowsRef,
    moreRowsRef,
    moreActiveRef,
    moreForm,
    searchTextRef,
  )

  const problems = []
  const cmp = (what, a, b) => {
    checks++
    if (a !== b) problems.push(`${what}：旧版 ${JSON.stringify(a)} / 新版 ${JSON.stringify(b)}`)
  }

  // ① 结果集本身（顺序 = 排序结果）
  cmp('结果集 xo/moreRows', shape(legacy.xo.value), shape(now.moreRows.value))
  // ② 生效标志
  cmp('生效标志 Bo/moreActive', legacy.Bo.value, now.moreActive.value)
  // ③ 并入后的全量（顺序 + 对象身份）
  cmp('全量 K/rows', shape(legacy.K.value), shape(now.rows.value))
  // ④ 搜索框回显
  cmp('搜索框 zo/searchText', legacy.zo.value, now.searchText.value)
  // ⑤ 「换新对象」这件事本身：被替换的行必须是查回来那份（tag=fresh），没被查到的保持旧对象
  const legacyFresh = legacy.K.value.filter((r) => r.tag === 'fresh').map((r) => r.id).join(',')
  const newFresh = now.rows.value.filter((r) => r.tag === 'fresh').map((r) => r.id).join(',')
  cmp('被换新的行集合', legacyFresh, newFresh)

  if (problems.length) {
    failed++
    console.log(`✗ ${c.name}`)
    for (const p of problems) console.log(`    ${p}`)
  } else {
    console.log(`✓ ${c.name}`)
  }
}

console.log(`\n${CASES.length - failed}/${CASES.length} 组夹具一致（共 ${checks} 项比对）`)
if (failed) {
  console.log('✗ 有夹具不一致 —— 要么新版抄错了，要么夹具与旧版口径不符（后者要写明理由）。')
  process.exit(1)
}
console.log('✓ 全部一致')
