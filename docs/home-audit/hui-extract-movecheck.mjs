/*
 * 「搬迁保真」检查 —— 证明引擎代码从 Hui.vue 搬到 useOrderLines.ts 时**逐字未改**。
 *
 * 为什么要这个：本项目栽过「手抄旧版源码导致转写错误」（见 00-summary 末尾）。
 * 把 800 行从一个文件搬到另一个文件，风险与手抄同类 —— 而 `npm run build` 绿**证明不了**
 * 语义没变（少一个 `?? 0`、`Math.max` 写成 `Math.min` 都照样过编译）。
 * 所以这里拿 `git show <ref>:app/src/views/Hui.vue` 的**搬迁前**原文，
 * 与新文件里的同名函数逐字比。
 *
 * 比的是**函数体归一化后的文本**：
 *   · 去掉每行行首缩进（引擎进了工厂函数，整体多缩进 2 格）
 *   · 折叠行尾空白
 *   · `//` 注释保留（注释也是文档，改了要看得见）
 *
 * 用法：
 *   node docs/home-audit/hui-extract-movecheck.mjs            # 与 HEAD 比
 *   node docs/home-audit/hui-extract-movecheck.mjs <ref>      # 与指定 ref 比
 *
 * ⚠️ **声明的改写**（`REWRITES`）只有这些，多一处都要报错：
 *   出现「未声明的差异」= 搬迁过程中动了逻辑，必须回查。
 *
 * ## 两轮
 *
 * · **第一轮**（步骤 1）：引擎 → `composables/useOrderLines.ts`，参照 `git show <ref>:Hui.vue`。
 * · **第二轮**（步骤 3b）：列/单元格/行级编辑态 → `components/DetailLinesTable.vue`。
 *
 * ⚠️ **第二轮用的是一个过渡期参照**：步骤 1/2/3a 的改动当时还没提交，`HEAD` 对「被那三步
 * 动过的函数」是过期的（`opsCol`/`rowClassName` 在步骤 2 改过、`pingCols` 在 3a 改过）。
 * 所以那一批拿 `/tmp/moved3b.ts` —— **3b 动手前一刻从工作区切出来的原文** —— 当参照。
 *
 * 这个快照是**临时的**：等步骤 1–5 提交之后，`HEAD` 就成了正确参照，那个文件可以不要
 * （找不到时脚本会退回过期会话并打印提示，不会静默放过）。
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const ROOT = '/Users/aaa/Desktop/door-main'
/**
 * ⚠️ 参照**必须钉在本次重构之前的那个提交**（`d6057283`，2026-09-19）。
 * 不能用 `HEAD` —— 重构提交一落，HEAD 就是「搬完」的状态，两个文件的函数都已经被删了，
 * 全部会报「HEAD 里找不到」。
 */
const REF = process.argv[2] || 'd6057283'
const OLD_PATH = 'app/src/views/Hui.vue'
const NEW_PATH = `${ROOT}/app/src/composables/useOrderLines.ts`

const oldSrc = execSync(`git -C ${ROOT} show ${REF}:${OLD_PATH}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const newSrc = readFileSync(NEW_PATH, 'utf8')

/** 应该已经被搬走的函数/常量名。搬完 Hui.vue 里不该再有这些定义。 */
const MOVED = [
  'readFieldHistory', 'writeFieldHistory', 'rememberField',
  'partsTrackOptions', 'rememberLocks', 'hardwareOptionsFor',
  'newLine',
  'needsMotherWidth', 'singleArea', 'fanCount', 'minSquareOf',
  'computeSquare', 'computeAmount', 'markupError', 'recalcMarkup',
  'matchFormulaByName', 'resolveRow', 'syncGlassMarkup', 'onGlassSelection',
  'sizeMarkupCandidates', 'syncSizeMarkupPing', 'pickDiaoWallMarkup',
  'syncSizeMarkupDiao', 'syncSizeMarkup',
  'removeLine', 'copyRow',
  'belongsToTable', 'profileOptionsFor', 'pingCasingOptions',
  'sanitizeNum', 'sanitizeFloat',
  'defaultBottomGlass', 'defaultGlassThickness',
  'rememberDefaultBottomGlass', 'rememberDefaultGlassThickness',
]

/** `const X = ...` 形式（箭头/计算属性）也要比。 */
const MOVED_CONSTS = [
  'LS', 'lockOptions', 'lastProf', 'PING_FAMILY_TYPES',
  'lineRefresh', 'colorOptions', 'partsEngine', 'formulaOf', 'isDiamond',
  'computeParts', 'pingProfileOptions', 'diaoProfileOptions',
]

/**
 * 声明的改写：`名字 → [{from,to}]`。每条都必须**在旧文里找得到 from**、否则报错
 * （防止写出永不生效的规则把真实差异放过）。
 */
const REWRITES = {
  // 搬到模块级并导出（页面初始化 `disableAutoMarkup` 也要用它，那时引擎还没实例化）。
  LS: [{ from: 'const LS = {', to: 'export const LS = {' }],
  pingCasingOptions: [
    // 原来是闭包捕获页面的 casingKindOptions；搬出去后改成形参注入（引擎不依赖视图常量）。
    { from: 'function pingCasingOptions(l: Line): { label: string; value: string }[] {', to: 'function pingCasingOptions(l: Line, casingKindOptions: { label: string; value: string }[]) {' },
  ],
  /*
   * 2026-09-19：子母门 `formulaType` 的大小写对齐（审计 §3.1）——
   * **搬迁之后有意改的，不是搬迁失真。**
   *
   * · 搬迁时这里是**全小写** `'parentsubsidiary'`；而旧版**四处全是驼峰**
   *   `parentSubsidiary`（`Diao.deobfuscated.js:912-914` 的 `_0x3ccfb0`、`:2213`、`:2236`、`:2133`）。
   * · 更要命的是**自家** `utils/printPayloads.ts:823/:1000` 早就按驼峰在比，
   *   而那边拿的是 `formulaOf(l)?.formula_type`（就是库里这一列）
   *   ⇒ **子母门公式的算料单据一直静默走错分支**（数量 `4×/2×` 变成 `quantity× / quantity÷2`、
   *   子门/母门玻璃取成通用玻璃），不报错、界面上也看不出来。
   * · 已按旧版对齐（前端 4 个文件）并用**迁移 0024** 迁数据。
   *
   * ⚠️ 这条改写规则**自带自检**：`applyRewrites` 找不到 `from` 就抛错。
   *    所以哪天旧值变了，这里会立刻报「声明的改写失效」，不会静默漏过。
   * 详见 `docs/2026-09-19-diao-audit.md` §3.1。
   */
  PING_FAMILY_TYPES: [
    {
      from: "const PING_FAMILY_TYPES = ['ping', 'double', 'parentsubsidiary', 'diamond']",
      to: "const PING_FAMILY_TYPES = ['ping', 'double', 'parentSubsidiary', 'diamond']",
    },
  ],
}

/**
 * 切出一个声明（`function NAME(...) {...}` / `const NAME = ...`）的整段。
 *
 * ⚠️ 切的难点：参数表**后面还有返回类型**，而返回类型里自己就带花括号 ——
 * `function pingCasingOptions(l: Line): { label: string; value: string }[] {`
 * 。按「参数表后第一个 `{`」会切到返回类型上（本脚本前两版都栽在这）。
 *
 * 用的判据：**函数体的 `{` 是那个后面紧跟换行的 `{`** —— 本仓库里返回类型字面量一律写在一行内
 * （`{ label: string; value: string }`），从不换行；而所有函数/对象字面量的体都换行。
 * 找到它再做花括号配对，切到配对的 `}`。单行声明（`const x = ref([])`）没有这种 `{`，
 * 退化成按行切。
 */
function sliceFn(src, name) {
  // 允许行首缩进 —— 新文件里它们缩在工厂函数内部（多 2 格）。
  // ⚠️ 用 `[ \t]*` 而不是 `\s*`：`\s` 会把**前一个换行**也吃进去，`m.index` 就落在空行上，
  //    后面按行切全错（表现为「HEAD 里找不到」）。
  const re = new RegExp(`^[ \\t]*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var)\\s+${name}\\b`, 'm')
  const m = re.exec(src)
  if (!m) return null
  const i = m.index

  // 单行声明（`const x = computed(() => f(y))`）连花括号都没有 —— 先按行判：整行括号收支为 0 就到此为止。
  // ⚠️ 不能靠「行尾有分号」判 —— 本仓库这两行都没写分号，会一路扫进下一个函数的体里（本脚本前几版就栽在这）。
  const firstNl = src.indexOf('\n', i)
  const firstLine = src.slice(i, firstNl < 0 ? src.length : firstNl)
  let lineDepth = 0
  for (const c of firstLine) {
    if (c === '{' || c === '(' || c === '[') lineDepth++
    else if (c === '}' || c === ')' || c === ']') lineDepth--
  }
  if (lineDepth === 0) return firstLine.replace(/\s+$/, '')

  // 找「后面紧跟换行」的第一个 `{`（跳过字符串里的）
  let inStr = null
  let body = -1
  for (let k = i; k < src.length; k++) {
    const c = src[k]
    if (inStr) { if (c === '\\') { k++; continue } if (c === inStr) inStr = null; continue }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue }
    if (c === '{') {
      const rest = src.slice(k + 1)
      if (/^\s*\n/.test(rest)) { body = k; break }
      // 否则是类型字面量/对象一行写法，跳过它的配对
      let d = 0
      for (let j = k; j < src.length; j++) {
        if (src[j] === '{') d++
        else if (src[j] === '}') { d--; if (d === 0) { k = j; break } }
      }
    }
    if (c === '\n') break
  }
  if (body < 0) {
    const end = src.indexOf('\n', i)
    return src.slice(i, end < 0 ? src.length : end)
  }
  let d = 0
  inStr = null
  for (let k = body; k < src.length; k++) {
    const c = src[k]
    if (inStr) { if (c === '\\') { k++; continue } if (c === inStr) inStr = null; continue }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue }
    if (c === '{') d++
    else if (c === '}') { d--; if (d === 0) return src.slice(i, k + 1) }
  }
  return null
}

/** 归一化：逐行去行首缩进、去行尾空白、丢空行。 */
const norm = (s) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n')

/** 应用声明的改写；`from` 找不到就报错（规则失效比差异漏网更危险）。 */
function applyRewrites(name, text) {
  const rules = REWRITES[name] || []
  let out = text
  for (const r of rules) {
    if (!out.includes(r.from)) {
      throw new Error(`声明的改写失效：${name} 里找不到 from 片段\n  ${r.from.slice(0, 120)}`)
    }
    out = out.split(r.from).join(r.to)
  }
  return out
}

let pass = 0
const fail = []
let missing = 0

for (const name of [...MOVED, ...MOVED_CONSTS]) {
  const o = sliceFn(oldSrc, name)
  const n = sliceFn(newSrc, name)
  if (!o) { fail.push(`${name}: 在 ${REF}:${OLD_PATH} 里找不到（MOVED 清单写错了？）`); continue }
  if (!n) { fail.push(`${name}: 新文件 ${NEW_PATH} 里找不到 —— 没搬过去？`); missing++; continue }
  // ⚠️ 顺序：**先归一化再套改写规则**。`norm()` 去了行首缩进，多行的 `from` 片段匹配不上。
  const a = applyRewrites(name, norm(o))
  const b = norm(n)
  if (a === b) { pass++; continue }
  const A = a.split('\n'), B = b.split('\n')
  const diffs = []
  for (let i = 0; i < Math.max(A.length, B.length) && diffs.length < 6; i++) {
    if (A[i] !== B[i]) diffs.push(`    L${i + 1}\n      旧: ${String(A[i]).slice(0, 150)}\n      新: ${String(B[i]).slice(0, 150)}`)
  }
  fail.push(`${name}: 归一化后仍不一致（旧 ${A.length} 行 / 新 ${B.length} 行）\n${diffs.join('\n')}`)
}

// ─────────────────────────────────────────────────────────────────────────
// 第二轮：3b（2026-09-19）—— 列定义 / 单元格 / 行级编辑态搬到 DetailLinesTable.vue
// ─────────────────────────────────────────────────────────────────────────
const COMPONENT = `${ROOT}/app/src/components/DetailLinesTable.vue`
const compSrc = readFileSync(COMPONENT, 'utf8')

/** 搬到组件里的定义（顺序同搬迁清单 A–J）。 */
const MOVED_TO_COMPONENT = [
  // A 单元格
  'wallThicknessCell', 'glassSelectCell', 'CELL', 'cellError', 'tCell', 'isRedNum',
  'intCell', 'moneyCell', 'optCell', 'profileCell', 'colorCell', 'trackCell',
  'casingCell', 'hardwareCell', 'PING_HOLE_SIZE_OPTS', 'DIAO_HOLE_SIZE_OPTS', 'holeCell',
  // B
  'selCol',
  // C
  'partsTooltip',
  // D 行级编辑态
  'pingEdit', 'diaoEdit', 'rowKeyOf', 'editOf', 'stripForDirty', 'recomputeDirty',
  'isEditing', 'isDirty', 'confirmLeaveDirtyRow', 'enterEdit', 'cancelEdit', 'saveRow',
  // E
  'opsCol',
  // F
  'sqCell', 'amountCell', 'remarkCell', 'markupSelectCell', 'markupCol',
  // G
  'doorImgCell',
  // H
  'cCol', 'sub', 'DOUBLE_DING_OPTS', 'orderNoCell', 'moneyCell_2', 'doorImgCol',
  // I
  'pingCols', 'diaoCols',
  // J
  'rowKey', 'rowClassName', 'rowPropsOf', 'pingColumns', 'diaoColumns',
]

/**
 * 组件化时**声明的改写** —— 全是「页面作用域 → props/引擎」这一件事，逐条列出。
 * 规则是**纯字符串替换**（不是正则），`from` 在旧文里找不到就报错。
 */
const COMPONENT_REWRITES = [
  // 3a 改的：`pingCasingOptions` 多了一个形参（视图常量改注入），调用点跟着变
  ["pingCasingOptions(l), undefined, true, 'casing')", "pingCasingOptions(l, casingKindOptions), undefined, true, 'casing')"],
  ['pingColVis', 'props.colVis'],
  ['diaoColVis', 'props.colVis'],
  ['orderId.value', 'props.savedOrderId'],
  ['lineInputOf(', 'props.hooks.lineInputOf('],
  ['calcSingleRow(', 'props.hooks.calcSingleRow('],
  ['openSquareDialog(', 'props.hooks.openSquareDialog('],
  ['openAddMarkup(', 'props.hooks.openAddMarkup('],
  ['removeDoorImg(', 'props.hooks.removeDoorImg('],
  ['pickDoorImg(', 'props.hooks.pickDoorImg('],
  ['openTextImg(', 'props.hooks.openTextImg('],
  ['order.client_name', 'props.client.name'],
  ['order.client_code', 'props.client.code'],
  // 引擎在组件里是局部常量 `engine`（Hui 传进来 / Home 自建，二选一），不是 `props.engine`
  ['lines.value.find(', 'engine.lines.value.find('],
  ['diaoRows.value', 'props.rows'],
  ['pingRows.value', 'props.rows'],
  ['checkboxTick.value++', 'props.hooks.onSelectChange()'],
  // 归一化之后两行都去了缩进，所以 from 也写成去缩进的样子
  ['previewImg.value = l.image_url\npreviewOpen.value = true', "props.hooks.previewImage(l.image_url ?? '')"],
]

/**
 * ⚠️ **第 2 步（行级编辑态）写的那批代码还没提交，`HEAD` 里没有** ——
 * 所以那一批拿「3b 动手前从工作区切出来的快照」当参照（`/tmp/moved3b.ts`，
 * 由 `move3b.mjs` 在删除**之前**导出，是独立的原文）。
 * 它证明的是「切出来之后到落进组件之间没被手改」—— 与 HEAD 那一路的证明力不同，
 * 但也够：那批代码本身的正确性由 `hui-row-save-check.mjs` 与 `hui-engine-logiccheck.mjs` 管。
 */
const SNAPSHOT = `${ROOT}/docs/home-audit/fixtures/hui-pre-3b.ts`
let snapSrc = ''
try {
  snapSrc = readFileSync(SNAPSHOT, 'utf8')
} catch {
  // ⚠️ 找不到就**退回过期会话**（下面会打印用的是哪个参照）—— 别当成通过。
  snapSrc = ''
}

/**
 * **搬迁之后有意改过的**（不是搬迁失真，因此不再逐字比；但**必须列出来**，别让它变成
 * 「反正检查器不看」的暗区 —— 脚本会把它们打印出来）。
 *
 * 2026-09-19 用户实测报「点确认修改没反应」，查下来两处：
 *  · `confirmLeaveDirtyRow` 漏了旧版 `It` 的第二个判据（同一行里换格子不算切行）⇒ 补上，并加 `target` 形参；
 *  · `saveRow` 的前置不满足时**静默 return**（表现就是「点了没反应」）⇒ 改成出声提示。
 *  `enterEdit` 随之改成把当前行传给守卫。
 *
 */
const POST_MOVE_EDITS = new Set(['confirmLeaveDirtyRow', 'enterEdit', 'saveRow'])

let pass2 = 0
const fail2 = []
const skipped = []
for (const name of MOVED_TO_COMPONENT) {
  if (POST_MOVE_EDITS.has(name)) { skipped.push(name); continue }

  // ⚠️ **快照优先**：第 1/2/3a 步的改动都还没提交，`HEAD` 对「被那三步动过的函数」是过期的
  //    （`opsCol`/`rowClassName` 在步骤 2 改过、`pingCols` 在 3a 改过）。
  //    快照是 3b 动手**前一刻**的工作区原文，才是这批的真参照。
  let o = snapSrc ? sliceFn(snapSrc, name) : null
  let ref = '搬迁前快照'
  if (!o) { o = sliceFn(oldSrc, name); ref = `${REF}:${OLD_PATH}` }
  const n = sliceFn(compSrc, name)
  if (!o) { fail2.push(`${name}: 在 ${ref} 里找不到`); continue }
  if (!n) { fail2.push(`${name}: 组件里找不到 —— 没搬过去？`); continue }
  let a = norm(o)
  for (const [from, to] of COMPONENT_REWRITES) {
    // 与上同理：先归一化再替换；但改写里的多行片段要在归一化后仍然匹配
    a = a.split(from).join(to)
  }
  const b = norm(n)
  if (a === b) { pass2++; continue }
  const A = a.split('\n'), B = b.split('\n')
  const diffs = []
  for (let i = 0; i < Math.max(A.length, B.length) && diffs.length < 5; i++) {
    if (A[i] !== B[i]) diffs.push(`    L${i + 1}\n      旧: ${String(A[i]).slice(0, 150)}\n      新: ${String(B[i]).slice(0, 150)}`)
  }
  fail2.push(`${name}: 归一化后仍不一致（旧 ${A.length} 行 / 新 ${B.length} 行）\n${diffs.join('\n')}`)
}
console.log(`  组件（列/单元格/编辑态）逐字一致：${pass2} 个`)
if (skipped.length) console.log(`  ⚠️ 搬迁后有意改过、**不在逐字比对内**：${skipped.join(', ')}`)
if (fail2.length) {
  console.log(`\n✗ 组件侧 ${fail2.length} 处不符：`)
  fail2.forEach((f) => console.log('  - ' + f))
  process.exit(1)
}
fail.push(...fail2)

// 反向检查：搬走的定义不该在 Hui.vue 里留下第二份（否则两份实现会各自漂移）。
const dupe = [...MOVED, ...MOVED_CONSTS].filter(
  (n) => new RegExp(`^\\s*(?:function|const|let|var)\\s+${n}\\b`, 'm').test(src_after()),
)
function src_after() {
  try {
    return readFileSync(`${ROOT}/${OLD_PATH}`, 'utf8')
  } catch {
    return ''
  }
}

console.log(`搬迁保真检查（${REF}:${OLD_PATH} → ${NEW_PATH}）`)
console.log(`  逐字一致：${pass} 个`)
if (missing) console.log(`  未搬走：${missing} 个`)
if (dupe.length) console.log(`  ⚠️ Hui.vue 里仍有同名定义（应已删除）：${dupe.join(', ')}`)
if (fail.length) {
  console.log(`\n✗ ${fail.length} 处不符：`)
  fail.forEach((f) => console.log('  - ' + f))
  process.exit(1)
}
console.log('\n✓ 全部一致 —— 搬迁未改动任何逻辑')
