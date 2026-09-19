/*
 * Diao「按门型补默认尺寸」的差分台。
 *
 * 左边跑**旧版真代码**（`Diao.deobfuscated.js` 里那一段硬编码，
 * 连同它依赖的三个判据函数 `_0x3ccfb0` / `_0xd7eaf8` / `_0x59130c` 一起切出来真跑），
 * 右边跑**新版真代码**（`app/src/data/formulaExtra.ts` 的 `defaultDims`）。
 *
 * ## ⚠️ 两边**有意不同**的一件事，怎么比才公平
 *
 * 旧版**不存尺寸**，所以它每次打开公式都**无条件覆盖**这六个框。
 * 我们**存**尺寸，做的是「**空着才补**」—— 覆盖会冲掉用户数据（理由见 `defaultDims` 的注释）。
 *
 * ⇒ 这台差分台比的是「**当六个框都是空的时候**，两边填出来的东西一样吗」。
 *    这正是「空才补」这条路径的全部行为，也是我们唯一声称与旧版一致的部分。
 *    旧版**覆盖已有值**那半边我们**有意不复刻**，不在这台的范围（也不该有）。
 *
 * ## ⚠️ 吊脚（`j`）只比「同为 0」，不比来源
 *
 * 旧版吊脚取的是**用户数据** `registrant.ping_column["吊脚"]`（`:3314-3316` → `_0x49f71f`）。
 * 我们**没有这份数据**，固定给 `"0"` —— 即旧版**取不到时的值**。
 * 所以这里把旧版的取数函数桩成「拿不到数据」，两边应当都是 0。
 * **这台差分台证明不了「吊脚取值口径一致」**，它只证明「拿不到数据时两边一致」。
 *
 * ⚠️ 夹具只有能说清「夹具本身与旧版口径不符」时才能改，且要写明理由 —— 不许为了让测试变绿改夹具。
 *
 * 用法：node docs/diao-default-dims-logiccheck.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { writeFileSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const BUNDLE = resolve(ROOT, 'legacy/js/Diao.deobfuscated.js')
const EXTRA_TS = resolve(ROOT, 'app/src/data/formulaExtra.ts')

const src = readFileSync(BUNDLE, 'utf8')

/** 唯一命中才肯用 —— 不唯一就说明源码变了，先看一眼再改锚点。 */
function cut(src, startAnchor, endAnchor, what) {
  const a = src.indexOf(startAnchor)
  if (a < 0) throw new Error(`旧版锚点没命中（${what} 起点）：${startAnchor}`)
  if (src.indexOf(startAnchor, a + 1) >= 0) throw new Error(`旧版锚点不唯一（${what} 起点）`)
  const b = src.indexOf(endAnchor, a)
  if (b < 0) throw new Error(`旧版锚点没命中（${what} 终点）：${endAnchor}`)
  return src.slice(a, b + endAnchor.length)
}

// 三个判据函数 —— 逐个切，并钉住长度下限，防止锚点悄悄切宽/切窄。
// ⚠️ 这几个函数在源码里是 `const` 链上的一环，后面跟的是 `,` 不是 `;` ——
//    终点锚点**不带**那个逗号，闭括号由 `+ '}'` 补回来（`.` 那几行按源码缩进原样补）。
const F_PINGLIKE =
  cut(src, '_0x3ccfb0=e=>{', '"diamond"].includes(String(e||"")["trim"]())', '平开类判据 _0x3ccfb0') +
  '\n    }'
const F_LIGHTNAME =
  cut(src, '_0xd7eaf8=e=>{', '!t["includes"]("无亮窗")', '亮窗名判据 _0xd7eaf8') + '\n    }'
const F_HASLIGHT =
  cut(src, '_0x59130c=(e={', 't["track"]))', '有亮窗件判据 _0x59130c') + '\n      }))\n    }'
for (const [n, f, min] of [
  ['_0x3ccfb0', F_PINGLIKE, 60],
  ['_0xd7eaf8', F_LIGHTNAME, 60],
  ['_0x59130c', F_HASLIGHT, 300],
]) {
  if (f.length < min) throw new Error(`旧版 ${n} 切出来只有 ${f.length} 字符，形状不对`)
}

// 那段硬编码赋值（613 字符）。含 `l["diao"]`（被加载的公式对象）与 `_0x49f71f()`（吊脚取数）。
const BLOCK = cut(
  src,
  '_0x1208fb["value"]="2000"',
  '_0x2fe495["value"]="800"',
  '默认尺寸赋值块',
)
if (BLOCK.length < 500 || !BLOCK.includes('"parentSubsidiary"')) {
  throw new Error(`旧版默认尺寸块形状不对（len=${BLOCK.length}）`)
}
// 这六个 ref 是这段的**全部输出**，一个都不能少。
for (const r of ['_0x1208fb', '_0x2fe495', '_0x497099', '_0x55e8eb', '_0x30f3a7', '_0x1dfd7e']) {
  if (!BLOCK.includes(r)) throw new Error(`旧版默认尺寸块里没出现 ${r} —— 锚点切窄了`)
}

/**
 * 跑旧版那一段。注入它需要的作用域：
 * - `_0xb8c576` formulaType ref（**注意：旧版这里是驼峰 `parentSubsidiary`**，见审计 §3.1）
 * - 六个尺寸 ref（进来时**全是空串** —— 本台只比「空才补」那条路径）
 * - `l` 被加载的公式对象（只用到 `l["diao"]`）
 * - `_0x49f71f` 吊脚取数：桩成「拿不到用户数据」（旧版返回 0）
 * - `_0x240250` / `_0x207f3d`：平开3D 的开关，与本段输出无关，桩成假
 * - `_0x5a2c87` / `_0xd002`：混淆器的作用域哨兵，原样保留、给个 undefined
 */
function runLegacy(formulaType, parts) {
  const mk = () => ({ value: '' })
  const refs = {
    _0x1208fb: mk(), // 门洞高
    _0x2fe495: mk(), // 门洞宽
    _0x497099: mk(), // 亮窗总高
    _0x55e8eb: mk(), // 墙厚
    _0x30f3a7: mk(), // 吊脚
    _0x1dfd7e: mk(), // 母门宽
    _0xb8c576: { value: formulaType },
    _0x207f3d: { value: false },
    _0x240250: { value: false },
  }
  const fn = new Function(
    ...Object.keys(refs),
    '_0x49f71f',
    'l',
    '_0x5a2c87',
    '_0xd002',
    `
    ${F_PINGLIKE}
    ${F_LIGHTNAME}
    ${F_HASLIGHT}
    ${BLOCK};
    return {
      w: _0x2fe495.value, h: _0x1208fb.value, h1: _0x497099.value,
      t: _0x55e8eb.value, j: _0x30f3a7.value, s: _0x1dfd7e.value,
    }
    `,
  )
  return fn(
    ...Object.values(refs),
    () => 0, // 吊脚：拿不到 ping_column ⇒ 旧版返回 0
    { diao: parts },
    undefined,
    undefined,
  )
}

// ---------------------------------------------------------------- 新版侧 //
const require = createRequire(resolve(ROOT, 'app/package.json'))
const esbuild = require('esbuild')
const OUT = resolve(tmpdir(), `formula-extra-check-${process.pid}.mjs`)
writeFileSync(
  OUT,
  esbuild.transformSync(readFileSync(EXTRA_TS, 'utf8'), {
    loader: 'ts',
    format: 'esm',
    charset: 'utf8',
  }).code,
)
const { defaultDims, applyDimDefaults } = await import(OUT + `?v=${process.pid}`)

/** 跑新版：同样假定六个框都是空的 ⇒ 直接取 `defaultDims` 的输出。 */
function runNew(formulaType, parts) {
  const d = defaultDims(formulaType, parts)
  return { w: d.w, h: d.h, h1: d.h1, t: d.t, j: d.j, s: d.s }
}

// ------------------------------------------------------------------ 夹具 //
/** 部件：键名 + materialName/title/track 四个名字，够 `_0x59130c` 判亮窗。 */
const part = (materialName, extra = {}) => ({
  state: false,
  quantity: 2,
  materialName,
  track: '',
  formula: '=h-v',
  result: 0,
  v: 0,
  title: '',
  calculate: '=h-result',
  color: 'lightgreen',
  ...extra,
})

const CASES = [
  {
    name: 'ping（平开，无亮窗件）→ 亮窗总高取 0',
    type: 'ping',
    parts: { 门框宽: part('门框宽'), 上下方: part('上下方') },
  },
  {
    name: 'ping + 部件名里含「亮窗」→ 亮窗总高取 2500',
    type: 'ping',
    parts: { 门框宽: part('门框宽'), 亮窗玻璃: part('亮窗玻璃') },
  },
  {
    name: 'ping + 含「无亮窗」的部件名 ⇒ **不算**亮窗（`!includes("无亮窗")` 那条别丢）',
    type: 'ping',
    parts: { 无亮窗边封: part('无亮窗边封') },
  },
  {
    name: 'ping + 亮窗只在 title 上（materialName 干净）→ 命中',
    type: 'ping',
    parts: { 边封: part('边封', { title: '亮窗名称:' }) },
  },
  {
    name: 'ping + 亮窗只在 track 上 → 命中',
    type: 'ping',
    parts: { 上滑: part('上滑', { track: '亮窗轨道' }) },
  },
  {
    name: '元数据键 `_keyOrder`/`挖孔图`/`公式类型` 里的「亮窗」**要跳过**',
    type: 'ping',
    parts: { _keyOrder: part('亮窗'), 挖孔图: part('亮窗'), 公式类型: part('亮窗') },
  },
  { name: 'double（双开）', type: 'double', parts: { 上下方: part('上下方') } },
  {
    name: 'parentSubsidiary（子母）→ 门洞宽 900、母门宽 200',
    // ⚠️ 驼峰。2026-09-19 之前这里是全小写，本台第一次跑就**红了**（旧版比不中 ⇒ 800/留空），
    //    由此发现 `printPayloads.ts` 也按驼峰比 ⇒ 子母门打印一直走错分支。
    //    已按旧版对齐 + 迁移 0024。**这里不再需要 `legacyType` 之类的迁就** ——
    //    「同一个拼写喂两边」现在两边就该一致。
    type: 'parentSubsidiary',
    parts: { 母门上下方: part('母门上下方') },
  },
  {
    name: '★ diamond（钻石）→ 门洞宽 580、墙厚 560、亮窗总高 580（覆盖前面算的）',
    type: 'diamond',
    parts: { 左边: part('左边') },
  },
  {
    name: '★ diamond 即使没有亮窗件，亮窗总高也被链条改成 580',
    type: 'diamond',
    parts: { 左边: part('左边'), 亮窗玻璃: part('亮窗玻璃') },
  },
  { name: 'diao（推拉）→ 门洞宽 2400', type: 'diao', parts: { 边封: part('边封') } },
  {
    name: 'diao + 有亮窗件 → 亮窗总高 2500',
    type: 'diao',
    parts: { 边封: part('边封'), 亮窗玻璃: part('亮窗玻璃') },
  },
  {
    name: 'ling（旧版有这一支，新栈到不了）→ 门洞宽 1600、墙厚 0',
    type: 'ling',
    parts: { 边封: part('边封') },
  },
  { name: '未知类型 → 走最后的 else：门洞宽 800', type: 'unknown', parts: {} },
  { name: '空部件表', type: 'ping', parts: {} },
]

// ------------------------------------------------------------------ 跑比 //
let failed = 0
let checks = 0
const FIELDS = [
  ['w', '门洞宽'],
  ['h', '门洞高'],
  ['h1', '亮窗总高'],
  ['t', '墙厚'],
  ['j', '吊脚'],
  ['s', '母门宽'],
]

for (const c of CASES) {
  const legacy = runLegacy(c.type, c.parts)
  const now = runNew(c.type, c.parts)
  const problems = []
  for (const [k, label] of FIELDS) {
    checks++
    // 旧版的吊脚是个 **number**（`_0x49f71f` 返回 0），新版是字符串 `'0'` ⇒ 比字符串化后的值。
    if (String(legacy[k]) !== String(now[k])) {
      problems.push(`${label}：旧版 ${JSON.stringify(legacy[k])} / 新版 ${JSON.stringify(now[k])}`)
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

// ---------------------------------------- 防复发：小写拼写不许再出现 //
/*
 * 子母门的 formulaType **必须是驼峰 `parentSubsidiary`**（旧版四处逐字如此）。
 *
 * 2026-09-19 之前我们全用小写，而 `utils/printPayloads.ts` 早就按驼峰比
 * ⇒ **子母门的算料单据一直静默走错分支**（数量 4×/2× 变成 quantity×/quantity÷2、
 * 子门/母门玻璃取成通用玻璃）。已对齐 + 迁移 0024。
 *
 * 这台差分台**本身**已经能抓住它（同一拼写喂两边，小写会立刻红在子母门那组），
 * 但那只覆盖 `defaultDims` 这一条路径。所以再加一道**源码守卫**：
 * `app/src` 里**任何位置**都不许再出现小写字面量 —— 包括 `printPayloads.ts` 那种我们自己
 * 不会跑到的角落。注释里提到小写不算（那是解释历史），只扫代码。
 */
console.log('\n【防复发】app/src 里不许再出现小写 `parentsubsidiary` 字面量')
{
  const SRC = resolve(ROOT, 'app/src')
  const offenders = []
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = resolve(dir, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|vue)$/.test(p)) {
        const code = readFileSync(p, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '')
          .replace(/<!--[\s\S]*?-->/g, '')
        if (/['"]parentsubsidiary['"]/.test(code)) offenders.push(p.slice(ROOT.length + 1))
      }
    }
  }
  walk(SRC)
  checks++
  if (offenders.length) {
    failed++
    console.log(`  ✗ 小写字面量又出现了：${offenders.join(', ')}`)
  } else {
    console.log('  ✓ 一个都没有')
  }
}

// -------------------------------------- 「只补空的」那条**我们独有**的偏离 //
/*
 * 上面比的是「都空时填什么」；这一节比的是**我们有、旧版没有**的那半边：
 * 旧版无条件覆盖（它不存尺寸），我们**只补空着的、已有值原样保留**。
 * 差分台覆盖不到它（旧版没有对应行为可比），所以这里是**断言**而不是对照。
 * 理由见 `defaultDims` / `applyDimDefaults` 的注释与审计 §3.2。
 */
console.log('\n【我们独有的偏离】只补空的，已有值不动')
{
  const D = defaultDims('diamond', {}) // 门洞宽 580 / 墙厚 560 / 亮窗总高 580 / 门洞高 2000 / 吊脚 0
  const cases = [
    {
      name: '全空 ⇒ 全取默认',
      cur: {},
      want: { w: '580', h: '2000', h1: '580', t: '560', j: '0', s: '' },
    },
    {
      name: '★ 全都有值 ⇒ **一个都不许动**（旧版这里会全覆盖掉）',
      cur: { w: '1234', h: '2345', h1: '3456', t: '7', j: '8', s: '9' },
      want: { w: '1234', h: '2345', h1: '3456', t: '7', j: '8', s: '9' },
    },
    {
      name: '部分有值 ⇒ 只补空的那几个',
      cur: { w: '1234', h: '', h1: '   ', t: '7' },
      want: { w: '1234', h: '2000', h1: '580', t: '7', j: '0', s: '' },
    },
    {
      name: '★ 只有空白也算空（`"  "` 在计算上等于 0，`!v` 判不出来，得 `trim`）',
      cur: { w: '  ', h: '\t' },
      want: { w: '580', h: '2000', h1: '580', t: '560', j: '0', s: '' },
    },
    {
      name: '显式的 "0" **不是空** —— 用户填的 0 要留住',
      cur: { w: '0', h: '0', h1: '0', t: '0', j: '0', s: '0' },
      want: { w: '0', h: '0', h1: '0', t: '0', j: '0', s: '0' },
    },
  ]
  for (const c of cases) {
    const got = applyDimDefaults(c.cur, D)
    const bad = FIELDS.filter(([k]) => String(got[k]) !== String(c.want[k]))
    checks++
    if (bad.length) {
      failed++
      console.log(`  ✗ ${c.name}`)
      for (const [k, label] of bad) {
        console.log(`      ${label}：期望 ${JSON.stringify(c.want[k])} / 实得 ${JSON.stringify(got[k])}`)
      }
    } else {
      console.log(`  ✓ ${c.name}`)
    }
  }
}

console.log(`\n${CASES.length - failed}/${CASES.length} 组夹具一致（共 ${checks} 项比对）`)
if (failed) {
  console.log('✗ 有夹具不一致 —— 要么新版抄错了，要么夹具与旧版口径不符（后者要写明理由）。')
  process.exit(1)
}
console.log('✓ 全部一致')
console.log('（范围提醒：本台只比「六个框都空时填什么」。旧版**覆盖已有值**那半边我们有意不复刻，不在此列。）')
