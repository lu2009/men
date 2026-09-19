/*
 * 「玻璃合片单」`doorsheet` 那一格的差分台。
 *
 * 左边跑**旧版真代码**（`legacy/js/Hui.formatted.js` 引擎 A 的两段，切出来真跑），
 * 右边跑**新版真代码**（`app/src/utils/printPayloads.ts` 的 `glassDoorsheetText`，纯函数）。
 *
 * ## 为什么补这一台
 *
 * 2026-09-19 修子母门 `formulaType` 大小写时发现：`printPayloads.ts` 里那几处
 * `ft === 'parentSubsidiary'` / `ft === 'diamond'` **一直是死比较**（库里存的是小写），
 * ⇒ 子母门的算料单据**静默走错分支**。修正那件事只是「让分支**够得着**」；
 * **分支体本身对不对，当时没有任何脚本覆盖** —— 这正是它能活下来的原因。本台补上。
 *
 * ## 旧版的两段（都是引擎 A）
 *
 * | 分支 | 旧版 | 位置 |
 * |---|---|---|
 * | 平开 | `_0xcfde65` 那段 | `:10730-10752` |
 * | 移门 | `_0x4d28ce` 那段 | `:10897-10922` |
 *
 * ⚠️ 源码里的字符串是**编码过的**（`_0x59f9e4(847)` 之类），本台按仓库既有手法**现解**：
 * 切出「数组函数 + 解码函数 + 轮转 IIFE」三段跑起来拿到解码器（见 memory
 * `hui-inline-decoder-recipe`）。**轮转 IIFE 必须带上**，否则索引整体错位。
 * 已解出 `847`=「parentSubsidiary」、`986`=「diamond」、`566`=「includes」、
 * `562`=「map」、`650`=「quantity」、`578`=「materialName」、`990`=「filter」。
 *
 * ## 这台**不覆盖**的东西
 *
 * 1. **部件怎么来的**（`computeParts(l,'A')` 与 `pk()` 的取值）。夹具直接给现成的部件表。
 * 2. **`doorsheet` 之外的那些列**（`door`/`basicInfo`/`remark`/`lockImg`…）——
 *    它们由 `glassProduces` 的其余部分算，本台只比 `doorsheet` 一格。
 * 3. **移门那支的另一半**：旧版那个 `if(...)` 的其余逗号项（`qrcode`/`OrderID` 等赋值）
 *    与它 `try{}` 体里的 `getImage` —— 与 `doorsheet` 无关，切的时候**刻意跳过**了。
 *
 * ⚠️ 夹具只有能说清「夹具本身与旧版口径不符」时才能改，且要写明理由 —— 不许为了让测试变绿改夹具。
 *
 * 用法：node docs/diao-print-doorsheet-logiccheck.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const HUI = resolve(ROOT, 'legacy/js/Hui.formatted.js')
const PAYLOADS_TS = resolve(ROOT, 'app/src/utils/printPayloads.ts')

const src = readFileSync(HUI, 'utf8')

function cut(startAnchor, endAnchor, what) {
  const a = src.indexOf(startAnchor)
  if (a < 0) throw new Error(`旧版锚点没命中（${what} 起点）：${startAnchor}`)
  if (src.indexOf(startAnchor, a + 1) >= 0) throw new Error(`旧版锚点不唯一（${what} 起点）`)
  const b = src.indexOf(endAnchor, a)
  if (b < 0) throw new Error(`旧版锚点没命中（${what} 终点）：${endAnchor}`)
  return src.slice(a, b + endAnchor.length)
}

/** 花括号/圆括号配对切一个函数体（跳过字符串里的括号）。 */
function cutFn(text, header) {
  const i = text.indexOf(header)
  if (i < 0) throw new Error('找不到 ' + header)
  let d = 0, inStr = null
  const k = text.indexOf('{', i)
  for (let j = k; j < text.length; j++) {
    const c = text[j]
    if (inStr) {
      if (c === '\\') { j++; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue }
    if (c === '{') d++
    else if (c === '}') { d--; if (d === 0) return text.slice(i, j + 1) }
  }
  throw new Error('括号不配平 ' + header)
}

// ────────────────────────────────────────────── 现解内联解码器 //
// 组件的内联解码器：`_0x59f9e4 = _0x43b0d8`，`_0x43b0d8 = _0x3a973c`，`_0x3a973c = _0x250a`。
const ARRAY_FN = cutFn(src, 'function _0x1ee4(){')
const DECODE_FN = cutFn(src, 'function _0x250a(e,t){')
// 轮转 IIFE：从 `!function(e,t){` 起到它自己的 `}`
const ri = src.indexOf('!function(e,t){', src.indexOf('const _0x3a973c=_0x250a;'))
if (ri < 0) throw new Error('找不到轮转 IIFE')
let rd = 0, rin = null, rend = -1, started = false
for (let j = ri; j < src.length; j++) {
  const c = src[j]
  if (rin) {
    if (c === '\\') { j++; continue }
    if (c === rin) rin = null
    continue
  }
  if (c === '"' || c === "'" || c === '`') { rin = c; continue }
  if (c === '{') { rd++; started = true }
  else if (c === '}') { rd--; if (started && rd === 0) { rend = j + 1; break } }
}
if (rend < 0) throw new Error('轮转 IIFE 括号不配平')
const DECODER = new Function(
  `${ARRAY_FN}\n${DECODE_FN}\n${src.slice(ri, rend)}();\nreturn _0x250a;`,
)()
// 自检：这几个值决定了整台的意义，解错一个就全是错的，所以**逐一钉住**。
const EXPECT = { 566: 'includes', 562: 'map', 650: 'quantity', 578: 'materialName', 990: 'filter', 847: 'parentSubsidiary', 986: 'diamond' }
for (const [k, v] of Object.entries(EXPECT)) {
  if (DECODER(Number(k)) !== v) {
    throw new Error(`内联解码器解出的 ${k} 不是 ${JSON.stringify(v)} —— 轮转/切段出问题了，别继续`)
  }
}

// ────────────────────────────────────────────── 切旧版两段 //
const PING_BLOCK = cut('_0x413ea2=["玻璃","门扇"];', '_0xcfde65["doorsheet"]=_0x406fda["join"]("<br>")+"<br>数量:"+_0x1973d4;', '平开 doorsheet')
if (PING_BLOCK.length < 700) throw new Error(`平开块只有 ${PING_BLOCK.length} 字符，形状不对`)

/*
 * 移门那段的 `if(...)` 是个很长的逗号表达式，`doorsheet` 只是**第 2 个逗号项**；
 * 第 1 项（一固一活/双活 改 `_0x4074bb`）也在条件里，所以两句都要。
 * 它的 body 是后面那个 `try{}`（`await getImage`）—— 与 doorsheet 无关，**刻意跳过**。
 *
 * ⇒ 分两刀切：① 两段 reduce 声明（到 `if((` 之前）；② 从 `if((` 之后到三元收尾。
 */
const DIAO_DECLS = src.slice(
  src.indexOf('_0x3fbf45=["玻璃"];'),
  src.indexOf('if(("一固一活"'),
)
// ⚠️ 第一处比较是 `==`（**两个等号**），第二处才是 `===` —— 源码就长这样，别「顺手改对」。
// ⚠️ 终点锚点要**够长**：`+"<br>数量:"+_0x4074bb` 在三元里出现了**两次**
//    （`?` 支中间一次、`:` 支末尾一次），用短的会切在 `?` 支中间、把三元截断。
const DIAO_TAIL =
  cut(
    '("一固一活"==_0x206283["扇数"]',
    '_0x4d28ce["doorsheet"]=_0x868616.join("<br>")+"<br>数量:"+_0x4074bb',
    '移门 doorsheet',
  ) + ';'
if (DIAO_DECLS.length < 1000 || DIAO_TAIL.length < 300) {
  throw new Error(`移门块形状不对（decls=${DIAO_DECLS.length} tail=${DIAO_TAIL.length}）`)
}
// 切出来的东西必须**没有** `await`（那属于被跳过的 try 体）—— 有就说明切宽了。
if (/\bawait\b/.test(DIAO_DECLS + DIAO_TAIL) || /\bawait\b/.test(PING_BLOCK)) {
  throw new Error('切出来的旧版块里出现了 await —— 锚点切宽了')
}

/** 跑旧版平开那一段。`parts` 是 `{key: {quantity, materialName, result}}`。 */
function runLegacyPing({ parts, bottom, face, qty, ft }) {
  const line = { 底玻: bottom, 面玻: face, 数量: qty }
  const out = { doorsheet: null }
  const fn = new Function(
    '_0x59f9e4', '_0x58f027', '_0x2f4e51', '_0x1d39cf', '_0xcfde65',
    `${PING_BLOCK}\n _0xcfde65["doorsheet"] = _0x406fda["join"]("<br>")+"<br>数量:"+_0x1973d4;`,
  )
  // ⚠️ 块里自己写了 `_0xcfde65["doorsheet"]=…`，但 `_0xcfde65` 是外部传入的对象 ⇒ 跑完读它。
  fn(DECODER, parts, line, ft, out)
  return out.doorsheet
}

/** 跑旧版移门那一段。 */
function runLegacyDiao({ parts, bottom, face, qty, fans }) {
  const line = { 底玻: bottom, 面玻: face, 数量: qty, 扇数: fans }
  const out = { doorsheet: null }
  const fn = new Function(
    '_0x59f9e4', '_0x20ce72', '_0x206283', '_0x4d28ce',
    `${DIAO_DECLS}\n${DIAO_TAIL}`,
  )
  fn(DECODER, parts, line, out)
  return out.doorsheet
}

// ────────────────────────────────────────────── 新版侧 //
const require = createRequire(resolve(ROOT, 'app/package.json'))
const { build } = require(resolve(ROOT, 'app/node_modules/esbuild'))
const OUT = resolve(tmpdir(), `print-doorsheet-check-${process.pid}.mjs`)
await build({
  entryPoints: [PAYLOADS_TS],
  bundle: true,
  format: 'esm',
  outfile: OUT,
  logLevel: 'error',
  // 只为了拿 `glassDoorsheetText`；它不碰网络/浏览器，外部依赖照常打进来即可。
})
const { glassDoorsheetText } = await import(OUT + `?v=${process.pid}`)

// ────────────────────────────────────────────── 夹具 //
/** 一个部件：`name` 既是 KEY 也是显示名（判据读 KEY，显示读 materialName）。 */
const part = (name, quantity, result, materialName) => ({
  name,
  quantity,
  result,
  materialName: materialName ?? name,
})

/** 夹具的行级常量。 */
const PING_BASE = { bottom: '双玻', face: '双玻', qty: 3, ft: 'ping' }
const DIAO_BASE = { bottom: '双玻', face: '双玻', qty: 2, fans: '' }

const CASES = [
  // ── 平开那支 ──
  {
    name: '平开 / ping / 玻璃+门扇 各一件（普通分支：双玻 ×数量）',
    kind: 'ping',
    line: { ...PING_BASE },
    parts: { 玻璃宽: part('玻璃宽', 2, 123), 门扇横: part('门扇横', 2, 456) },
  },
  {
    name: '★ 平开 / parentSubsidiary / 双玻 ⇒ 4×数量（不是 quantity×数量）',
    kind: 'ping',
    line: { ...PING_BASE, ft: 'parentSubsidiary' },
    parts: { 玻璃宽: part('玻璃宽', 2, 123), 门扇横: part('门扇横', 2, 456) },
  },
  {
    name: '★ 平开 / parentSubsidiary / 单玻 ⇒ 2×数量',
    kind: 'ping',
    line: { ...PING_BASE, ft: 'parentSubsidiary', bottom: '无', face: '双玻' },
    parts: { 玻璃宽: part('玻璃宽', 2, 123), 门扇横: part('门扇横', 2, 456) },
  },
  {
    name: '★ 平开 / diamond ⇒ 一律 3×数量（两个分支都覆盖）',
    kind: 'ping',
    line: { ...PING_BASE, ft: 'diamond' },
    parts: { 玻璃宽: part('玻璃宽', 2, 123), 门扇横: part('门扇横', 2, 456) },
  },
  {
    name: '★ 平开 / diamond + 单玻 ⇒ 仍是 3×数量（diamond 覆盖在最后，别写成 else-if）',
    kind: 'ping',
    line: { ...PING_BASE, ft: 'diamond', bottom: '无', face: '双玻' },
    parts: { 玻璃宽: part('玻璃宽', 2, 123) },
  },
  {
    name: '★ 平开 分组顺序：玻璃全在前、门扇全在后（parts 里交错给）',
    kind: 'ping',
    line: { ...PING_BASE },
    parts: { 门扇横: part('门扇横', 2, 1), 玻璃宽: part('玻璃宽', 2, 2), 门扇竖: part('门扇竖', 2, 3), 玻璃高: part('玻璃高', 2, 4) },
  },
  {
    name: '★ 平开 数量取「最后一组的最后一件」—— 玻璃/门扇 quantity 不同才看得出',
    kind: 'ping',
    line: { ...PING_BASE, qty: 5 },
    parts: { 玻璃宽: part('玻璃宽', 4, 1), 门扇横: part('门扇横', 6, 2) },
  },
  {
    name: '平开 单玻判据：名含「单玻」时 quantity 不折半',
    kind: 'ping',
    line: { ...PING_BASE, bottom: '无', face: '无' },
    parts: { 玻璃宽单玻: part('玻璃宽单玻', 4, 1) },
  },
  {
    // **有意偏离**（不是「待办」）：旧版 `[].join("<br>")` 得空串再拼 `"<br>数量:"+0`
    // ⇒ 纸上多一个空行加「数量:0」。那是 join 的副产物不是排版，见 `doorsheetText` 里的注释。
    // 哪天产品要照旧版印 ⇒ 改回 `doorsheetText` 并把这条的 `knownGap` 摘掉。
    name: '⚠️【有意偏离】平开 无玻璃/门扇件：旧版印 `<br>数量:0`，我们印空串',
    kind: 'ping',
    knownGap: true,
    line: { ...PING_BASE },
    parts: { 边封: part('边封', 2, 1) },
  },

  // ── 移门那支 ──
  {
    name: '移门 / 只有玻璃组 / 普通扇数',
    kind: 'diao',
    line: { ...DIAO_BASE },
    parts: { 玻璃宽: part('玻璃宽', 2, 111), 亮窗玻璃宽: part('亮窗玻璃宽', 1, 222) },
  },
  {
    // ★ 这条是**差分台自己挣来的**：抽取 `doorsheetText` 时我把第一组读成「只印裸名字」
    //   （因为先前用 `cut -c1-330` 截断看那行，`+":"+t.result` 被切掉了），照此改了代码。
    //   这台一跑立刻红 —— 旧版真代码跑出来是 `玻璃宽:111`。**旧版两组都拼 `名:result`。**
    name: '★ 移门 玻璃组也拼 `名:result`（旧版真代码跑出来的，别凭读代码下结论）',
    kind: 'diao',
    line: { ...DIAO_BASE },
    parts: { 玻璃宽: part('玻璃宽', 2, 111) },
  },
  {
    name: '★ 移门 亮窗组排除「压线」，且亮窗组的判据是 `底≠无 && 面≠无 || 名含单玻`',
    kind: 'diao',
    line: { ...DIAO_BASE },
    parts: { 亮窗玻璃宽: part('亮窗玻璃宽', 1, 222), 亮窗压线: part('亮窗压线', 9, 999) },
  },
  {
    name: '★ 移门 玻璃组要排除「亮窗」件（`includes(玻璃) && !includes(亮窗)`）',
    kind: 'diao',
    line: { ...DIAO_BASE },
    parts: { 玻璃宽: part('玻璃宽', 2, 111), 亮窗玻璃宽: part('亮窗玻璃宽', 1, 222) },
  },
  {
    name: '★ 移门 一固一活 ⇒ 第一组数量固定 2×数量（覆盖前面算的）',
    kind: 'diao',
    line: { ...DIAO_BASE, fans: '一固一活', qty: 3 },
    parts: { 玻璃宽: part('玻璃宽', 8, 111) },
  },
  {
    name: '★ 移门 双活 ⇒ 同样固定 2×数量',
    kind: 'diao',
    line: { ...DIAO_BASE, fans: '双活', qty: 3 },
    parts: { 玻璃宽: part('玻璃宽', 8, 111) },
  },
  {
    name: '★ 移门 亮窗组数量 `>0` 才追加；`<1` 时抬到 1',
    kind: 'diao',
    line: { ...DIAO_BASE, bottom: '无', face: '双玻', qty: 1 },
    parts: { 玻璃宽: part('玻璃宽', 2, 111), 亮窗玻璃宽: part('亮窗玻璃宽', 1, 222) },
  },
  {
    name: '移门 两组都空 ⇒ 数量 0',
    kind: 'diao',
    line: { ...DIAO_BASE },
    parts: { 边封: part('边封', 2, 1) },
  },
]

// ────────────────────────────────────────────── 跑比 //
let failed = 0
let checks = 0
let knownGapsHit = 0

for (const c of CASES) {
  // KEY = name；旧版读 `Object.entries(parts)`，新版读 `pk(p)` ⇒ 两边都拿 name 当 KEY。
  const legacyParts = Object.fromEntries(
    Object.entries(c.parts).map(([k, v]) => [k, { quantity: v.quantity, materialName: v.materialName, result: v.result }]),
  )
  const legacy =
    c.kind === 'ping'
      ? runLegacyPing({ parts: legacyParts, ...c.line })
      : runLegacyDiao({ parts: legacyParts, ...c.line })

  const ours = glassDoorsheetText({
    lineType: c.kind === 'diao' ? 'diao' : 'ping',
    fans: c.line.fans,
    formulaType: c.line.ft ?? '',
    bottomGlass: c.line.bottom,
    faceGlass: c.line.face,
    quantity: c.line.qty,
    parts: Object.entries(c.parts).map(([k, v]) => ({
      key: k,
      name: k,
      quantity: v.quantity,
      result: v.result,
      materialName: v.materialName,
    })),
  })

  checks++
  if (legacy === ours) {
    if (c.knownGap) {
      failed++
      console.log(`✗ ${c.name}`)
      console.log('    这条**已知分歧**居然一致了 —— 说明分歧被修好了，请把夹具里的 `knownGap` 去掉')
    } else {
      console.log(`✓ ${c.name}`)
    }
  } else if (c.knownGap) {
    knownGapsHit++
    console.log(`⚠️ ${c.name}`)
    console.log(`    旧版: ${JSON.stringify(legacy)}`)
    console.log(`    新版: ${JSON.stringify(ours)}`)
  } else {
    failed++
    console.log(`✗ ${c.name}`)
    console.log(`    旧版: ${JSON.stringify(legacy)}`)
    console.log(`    新版: ${JSON.stringify(ours)}`)
  }
}

const okCount = CASES.length - failed - knownGapsHit
console.log(`\n${okCount}/${CASES.length} 一致；${knownGapsHit} 条已知分歧（不算失败，但要有人管）`)
if (failed) {
  console.log('✗ 有夹具不一致 —— 要么新版抄错了，要么夹具与旧版口径不符（后者要写明理由）。')
  process.exit(1)
}
console.log('✓ 除已登记的分歧外全部一致')
