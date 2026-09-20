/*
 * 「搬迁保真」检查（Home 版）—— 证明 Home.vue 里的代码搬到新文件时**逐字未改**。
 *
 * 为什么要这个：本项目栽过「手抄旧版源码导致转写错误」（见 00-summary 末尾）。
 * 把上千行从一个文件搬到另一个文件，风险与手抄同类 —— 而 `npm run build` 绿**证明不了**
 * 语义没变（少一个 `?? 0`、`Math.max` 写成 `Math.min` 都照样过编译）。
 * 所以这里拿 `git show <ref>:app/src/views/Home.vue` 的**搬迁前**原文，
 * 与新文件里的同名函数逐字比。
 *
 * 比的是**函数体归一化后的文本**：
 *   · 去掉每行行首缩进（搬进 utils/ 或 composables/ 后整体会多缩进）
 *   · 折叠行尾空白
 *   · 丢空行
 *   · `//` 注释**保留**（注释也是文档，改了要看得见）
 *
 * 用法：
 *   node docs/home-audit/home-extract-movecheck.mjs            # 与默认参照比
 *   node docs/home-audit/home-extract-movecheck.mjs <ref>      # 与指定 ref 比
 *   node docs/home-audit/home-extract-movecheck.mjs --selftest # 只跑自测（不碰 git）
 *
 * ⚠️ **能力边界（别把它当成「全都验过了」）**：
 *   它只验 `BLOCKS` 清单里**点名过的那些名字**。清单里没有的东西 —— 不管是没搬的、
 *   还是搬了却忘了登记 —— 它**完全不知道**。所以「本脚本绿」只等于「清单内逐字一致」，
 *   不等于「搬迁完整」。清单本身由人来维护，每搬一块加一条。
 *
 * ⚠️ **声明的改写**（每个 block 的 `rewrites`）只有列出来的那些，多一处都要报错：
 *   出现「未声明的差异」= 搬迁过程中动了逻辑，必须回查。
 *   反过来它**抓不到「漏了一条改写」** —— 那只会表现成 diff（这是有意的：宁可多报）。
 *
 * 姊妹件：`docs/home-audit/hui-extract-movecheck.mjs`（Hui.vue 那一版）。
 *
 * 比对**核心**（`sliceFn` / `norm` / `applyRewrites` / `firstDiffLine`）现在**只有一份实现**，
 * 在 `lib/extract-movecheck-core.mjs`（2026-09-20 Task 3.5 抽的）。
 * 在此之前两边各存一份逐字相同的副本、靠「改一份必须同步另一份」的自觉维持 ——
 * Task 3 撞出了那个死结：Home 侧的 `sliceFn` 实测有洞，而**修它就得动两份**，
 * 于是「改一份」与「别碰另一份」互相矛盾。抽成共用件正是解那个死结。
 *
 * 留在这边的只有**搬迁清单**与**判定/输出文案** —— 两版的形状本来就不同
 * （这边是多目标 manifest、规则按 block 传；那边是模块级 `MOVED` / `REWRITES`），
 * 硬合并只会让两边都变难懂。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyRewrites, firstDiffLine, norm, sliceFn } from './lib/extract-movecheck-core.mjs'

// 仓库根从**本文件位置**推出（本文件在 `docs/home-audit/` ⇒ 往上**两级**才是仓库根）。
// 别写死 `/Users/aaa/Desktop/door-main`：本机跑得通，换台机器或进 CI（checkout 路径不同）就崩。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

/**
 * ⚠️ 参照**必须钉在本次拆分之前的那个提交**（`28e36d21`，Home 拆分动工前）。
 * 不能用 `HEAD` —— 拆分提交一落，HEAD 就是「搬完」的状态，Home.vue 里那些函数已经被删了，
 * 全部会报「HEAD 里找不到」。`--selftest` 分支里给的 `'HEAD'` 只是兜底占位，自测本身不碰 git。
 */
const REF = process.argv[2] || (process.argv.includes('--selftest') ? 'HEAD' : '28e36d21')
const OLD_PATH = 'app/src/views/Home.vue'

/**
 * 本次拆分的搬迁清单。**每搬完一块就在这里加一条** —— 守卫只验清单里的东西，
 * 清单外的东西它不知道（这是它的能力边界，写在这里免得被当成「全都验过了」）。
 *
 * 一条的形状：
 *   { target: 'app/src/utils/xxx.ts',   // 相对仓库根；有多个目标就写多条 block
 *     names:  ['foo', 'bar'],           // function foo() {} / 箭头函数都算
 *     consts: ['BAZ'],                  // const BAZ = ... / type BAZ = ...（含 computed / ref）
 *     rewrites: { foo: [{ from: '…', to: '…' }] } }  // 声明的改写，可省
 *
 * ⚠️ **清单是空的那些日子**（2026-09-20 立骨架时）本脚本对真代码**没有任何检验力**
 * （它只证明「跑得起来」）。Task 2 加了第一条（B2 → `utils/homeMetrics.ts`，纯函数样板），
 * Task 3 加了第二条（B10 → `composables/home/useHomeSelection.ts`，**composable 样板**：
 * 注入响应式依赖 + 回传状态）。后两条是后面各块的样板，改它们等于改一整片。
 *
 * ⚠️⚠️ **登记新名字前先验「切片切得完整」** —— 本脚本的绿只等于「切出来的那一段逐字一致」，
 * **不等于「整个声明都对过」**。切片器的已知残留（`lib/extract-movecheck-core.mjs` 文件头有全表）：
 * 对**「首行括号正好配平、声明却在下一行继续」**的写法，它只切首行 ——
 * 例：`type TextFilterKey =`（`REF:769`，下面 9 行union 成员一行都不比）、
 * `const engine: OrderLines =`（`DetailLinesTable.vue:149`）。
 * **验法**（Task 4 简报里那套，抄过来）：把该声明的**第二行**随便改一下 → 跑本脚本 →
 * **必须报红**；不红就别登记（登记了等于给自己发一张假绿卡）。改完**还原**。
 */
const BLOCKS = [
  {
    target: 'app/src/utils/homeMetrics.ts',
    names: ['paymentStatus', 'progressMatch', 'paidOf', 'dateCellClass', 'isUnaudited'],
    consts: ['fmt', 'unpaidOf'],
    rewrites: {
      // ① 搬到模块级并导出（新文件里每个声明都加 `export`）。
      fmt: [{ from: 'const fmt = ', to: 'export const fmt = ' }],
      // ② 读 `financeSummary.value` 的两处 → 形参 `fin`（unpaidOf / paidOf 各一处）。
      unpaidOf: [
        { from: 'const unpaidOf = (r: OrderSummaryDto) => {', to: 'export const unpaidOf = (r: OrderSummaryDto, fin: Record<string, OrderFinance>) => {' },
        { from: 'const s = financeSummary.value[r.id]', to: 'const s = fin[r.id]' },
      ],
      paidOf: [
        { from: 'function paidOf(r: OrderSummaryDto): number {', to: 'export function paidOf(r: OrderSummaryDto, fin: Record<string, OrderFinance>): number {' },
        { from: 'const s = financeSummary.value[r.id]', to: 'const s = fin[r.id]' },
      ],
      // ③ 两个下游函数的签名加形参 + 内部调用点跟着改（同一名字的多条规则写在同一个数组里）。
      paymentStatus: [
        { from: 'function paymentStatus(r: OrderSummaryDto): string {', to: 'export function paymentStatus(r: OrderSummaryDto, fin: Record<string, OrderFinance>): string {' },
        { from: 'const unpaid = unpaidOf(r)', to: 'const unpaid = unpaidOf(r, fin)' },
      ],
      dateCellClass: [
        { from: 'function dateCellClass(r: OrderSummaryDto): string {', to: 'export function dateCellClass(r: OrderSummaryDto, fin: Record<string, OrderFinance>): string {' },
        { from: 'if (!due || unpaidOf(r) === 0) return', to: 'if (!due || unpaidOf(r, fin) === 0) return' },
      ],
      // ④ 只加 `export`、签名一字未动的那两个。
      progressMatch: [{ from: 'function progressMatch(', to: 'export function progressMatch(' }],
      isUnaudited: [{ from: 'function isUnaudited(', to: 'export function isUnaudited(' }],
    },
  },
  {
    target: 'app/src/composables/home/useHomeSelection.ts',
    names: ['onCheckedKeys', 'deleteSelected', 'clearAccounts', 'combineSelected'],
    consts: ['checkedRowKeys', 'selectAllMode'],
    rewrites: {
      /*
       * B10（删除选中 / 清账 / 合并订单）。**本块没有 `export` 改写** ——
       * 6 个声明都由工厂 `return` 借出，不做模块级导出（与 B2 那套不同）。
       *
       * 下面是「闭包名 → `deps.名`」的**全量**清单。两件事必须同时成立：
       *   · 每条 `from` 都得在该函数的旧文里找得到（找不到 `applyRewrites` 会抛 —— 这是白送的检查）；
       *   · **不能漏**（漏了不抛，只表现成 diff）⇒ 改完必须**逐行看 diff**，不能只看退出码。
       *
       * ⚠️ 规则一律**带边界**（写 `dialog.warning({` 而不是 `dialog`）：`applyRewrites` 是朴素
       *    split/join，裸名会把别的标识符一起改坏（例：写 `load` 会顺手打到 `loadedIds` 上）。
       *    本块的 `message.` 只锚了右边 —— 左锚写不出（`norm()` 去了行首空白，多行/带缩进的
       *    `from` 匹配不上），所以**另行核对过**：本块内不存在 `.message.` 这种「属性名恰好叫
       *    `message`、后面还跟一个点」的序列 ⇒ 不会把 `(e as Error).message` 改坏
       *    （改完实测全文 `.deps` 出现 0 次）。
       *
       * ⚠️ `clearAccounts` 的第一条**不是注入改写**，是 B2 那一刀留下的**调用点变化**：
       *    参照提交里 `unpaidOf` 自己读 `financeSummary`，抽进 `utils/homeMetrics.ts` 后改成
       *    显式传参（`unpaidOf(r, financeSummary.value)`）⇒ 这条的 `from` 得写**抽取前**的样子。
       *    换句话说 `rewrites` 记的是「相对参照提交的全部文本差异」，不只是「注入面」。
       */
      /*
       * ⚠️⚠️ **这条曾经是空的，而且是被迫空的 —— 记住这段历史，别再退回那个状态。**
       *
       * `onCheckedKeys`(REF:1601) 的**参数表跨行**。旧的 `sliceFn` 找函数体 `{` 的循环末尾
       * 有一句「遇到换行就 break」，参数表一换行就永远找不到体 ⇒ 退化成「按行切」，
       * **只返回 `function onCheckedKeys(` 这一行，函数体一行都不比**。
       * 后果有两层：① 往里写任何 `from` 都会抛「声明的改写失效」；
       *            ② 更危险的是**它不抛也不报** —— 本来就没在比，看起来却是绿的。
       * （Task 3 当时判定「本脚本保证不了这个名字」，只做了**手工**切段比对。）
       *
       * **2026-09-20 Task 3.5 修好了根因**：`sliceFn` 移进 `lib/extract-movecheck-core.mjs`
       * 并重写为「只在**括号栈空**时遇换行才停」，参数表跨行不再挡路。修好后这个名字
       * **第一次被真正比对**，当场报出一处此前看不见的真差异（就是下面那条规则）。
       *
       * 全 `Home.vue` 里参数表跨行的**函数声明**只有 3 个：`onCheckedKeys`(REF:1601)、
       * `renderEditable`(REF:2807)、`headerFilter`(REF:2866) —— 后两个属 B12。
       * 它们现在**同样**受加固后的 `sliceFn` 保护（不必再手工复核）。
       *
       * ⚠️ 下面这条规则是**修好根因之后按报出的 diff 补的**，不是为了让守卫变绿而删名字 ——
       *    「把它从 BLOCKS 里删掉」是本仓库 CLAUDE.md 明令禁止的那种改法。
       *    边界已核对：本函数旧文里 `filtered.value` **只出现 1 次**（L10），
       *    不存在 `xfiltered.value` 这种会被朴素 split/join 误伤的前缀。
       */
      onCheckedKeys: [{ from: 'filtered.value', to: 'deps.filtered.value' }],
      deleteSelected: [
        { from: 'rawOrders.value.', to: 'deps.rawOrders.value.' },
        { from: 'await load()', to: 'await deps.load()' },
        { from: 'message.', to: 'deps.message.' },
        { from: 'dialog.warning({', to: 'deps.dialog.warning({' },
      ],
      clearAccounts: [
        { from: 'unpaidOf(r)', to: 'unpaidOf(r, deps.financeSummary.value)' },
        { from: 'rawOrders.value.', to: 'deps.rawOrders.value.' },
        { from: 'await load()', to: 'await deps.load()' },
        { from: 'message.', to: 'deps.message.' },
        { from: 'dialog.warning({', to: 'deps.dialog.warning({' },
      ],
      combineSelected: [
        { from: 'await load()', to: 'await deps.load()' },
        { from: 'message.', to: 'deps.message.' },
        { from: 'dialog.warning({', to: 'deps.dialog.warning({' },
      ],
    },
  },
]

/**
 * 摊平一个 block 的 `names` + `consts`（两者都可省 —— 缺了当空数组）。
 *
 * ⚠️ `|| []` **不能省**：漏写一个键时裸的展开会抛 `TypeError: b.consts is not iterable`
 * （立骨架时实测踩到），那句话对着清单看不出是哪个 block 缺了什么。
 * 主循环与 `allNames()` **共用这一个**，别在两处各写一遍展开 —— `--selftest` 有一例钉住它。
 */
const blockNames = (b) => [...(b.names || []), ...(b.consts || [])]

/** 反查：这些名字搬走后，Home.vue 里不该再有自己的定义（否则两份实现各自漂移）。 */
const allNames = () => BLOCKS.flatMap(blockNames)

/**
 * 声明探测（反查用）：`src` 里**自己定义**了 `name` 吗。
 *
 * ⚠️ 前缀必须与 `sliceFn` 的取法**逐字对齐**（含 `async`）—— 否则 `async function foo()`
 * 搬走后这一条认不出来，反查会**静默漏报**（立骨架时实测踩到：`load` 正是 `async function`）。
 * `--selftest` 有一例专门钉住这个 `async`。
 *
 * ⚠️ `type` / `interface` 是 2026-09-20（Task 3.5）跟着 `sliceFn` 一起加的 —— 正是
 * 「前缀必须对齐」这条规矩要求的。Task 4 要把 `type ProgressSegment` 搬进
 * `utils/homeConstants.ts`，反查若认不出 `type` 声明，那个名字就成了**反查的暗区**：
 * 搬走之后 `Home.vue` 里再长出一份同名 `type`，本脚本不会吭声。
 */
const declares = (src, name) =>
  new RegExp(
    `^[ \\t]*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var|type|interface)\\s+${name}\\b`,
    'm',
  ).test(src)

/**
 * 自测：拿一对**已知故意改坏**的样本跑一遍比对核心，断言它报红且**定位到正确的行**。
 * 先例的教训（docs/2026-09-18-detail-table-extraction.md §5.3）：守卫自身的洞不会被它自己发现
 * —— 那次的扇数正则从 `(\d+)` 被改窄成 `(\d)`，夹具全是单位数，于是测试不报错。
 * 所以这里不测「真代码」，测「比对函数在已知输入上是否会红」。
 *
 * ⚠️ 这一段必须留在**任何 git 调用之前**：自测验证的是比对核心，不该依赖仓库状态
 *    （浅克隆、detached HEAD 下也要能跑）。
 */
if (process.argv.includes('--selftest')) {
  let bad = 0
  /** 一条断言：`cond` 为假就记红（`detail` 只在红时打出来，说明实得什么）。 */
  const check = (what, cond, detail = '') => {
    if (cond) console.log(`✓ 自测：${what}`)
    else {
      console.log(`✗ 自测失败：${what}${detail ? ` —— ${detail}` : ''}`)
      bad++
    }
  }

  // ① 比对核心：一对**已知故意改坏**的样本，必须报红且**定位到正确的行**。
  const oldTxt = `function f(a: number) {\n  const n = Math.round(a * 1.13)\n  return n ?? 0\n}`
  const diffCases = [
    ['Math.round → Math.floor', `function f(a: number) {\n  const n = Math.floor(a * 1.13)\n  return n ?? 0\n}`, 2],
    ['丢掉 ?? 0',              `function f(a: number) {\n  const n = Math.round(a * 1.13)\n  return n\n}`, 3],
    ['未改坏（应判为一致）',    oldTxt, 0],
  ]
  for (const [what, newTxt, expectDiffLine] of diffCases) {
    const diff = firstDiffLine(norm(oldTxt), norm(newTxt)) // 返回首个不同的行号（1 基），一致则 0
    const same = diff === expectDiffLine
    // 绿时把「定位到第几行」打出来（这是这一例的看点）；红时别把实得值也塞进标题 —— 详情里已经有了。
    check(same ? `${what} → 第 ${diff} 行` : what, same, `期望首个差异在第 ${expectDiffLine} 行，实得 ${diff}`)
  }

  /*
   * ② 反查正则（`declares`）：认得出 `async function`，且**不把调用当定义**。
   * 这一例是补出来的 —— 立骨架时「漏 `async`」这个 bug 是**手工端到端跑**才发现的，
   * 当时 `--selftest` 对它完全不可见（那正是先例 §5.3「守卫自身的洞」的重演）。
   */
  check(
    '反查认得 `async function`（去掉 `(?:async\\s+)?` 这例即红）',
    declares('export async function load() {\n  return 1\n}', 'load'),
    '`async function` 搬走后反查会**静默漏报**',
  )
  check(
    '反查不把普通调用当定义',
    !declares('void load()\nload()\n', 'load'),
    '把调用当定义会让每个调用点都误报',
  )

  /*
   * ③ `names` / `consts` 都可省 —— 缺键**不能抛** `TypeError`。
   * 同样是手工跑才发现的：漏写 `consts` 换来一句对不上清单的 TypeError。
   */
  // 两条断言都走这个小包装 —— 否则「抛了」会变成**未捕获**的崩溃（栈糊满屏、后面的断言一条不跑），
  // 而自测要的是一行干净的 ✗（复审变异时实测踩到）。
  const flatOf = (b) => {
    try {
      return { v: blockNames(b) }
    } catch (e) {
      return { e: `${e.constructor.name}: ${e.message}` }
    }
  }
  const namesOnly = flatOf({ names: ['a', 'b'] })
  check(
    '只写 `names`、不写 `consts` 不抛',
    !!namesOnly.v && namesOnly.v.join(',') === 'a,b',
    namesOnly.e || `实得 ${JSON.stringify(namesOnly.v)}`,
  )
  const bothAbsent = flatOf({})
  check(
    '`names`/`consts` 都不写 = 空数组',
    !!bothAbsent.v && bothAbsent.v.length === 0,
    bothAbsent.e || `实得 ${JSON.stringify(bothAbsent.v)}`,
  )

  /*
   * ④ `sliceFn` 的边界：**返回类型里的花括号字面量**不能把切片骗走。
   * 这是姊妹件「前几版都栽在这」的那个构造（`function f(l: Line): { label: string }[] {`），
   * 而它此前对自测不可见。判据：切出来必须**就是整段**（含返回类型与函数体）。
   */
  const retTxt = `function pingCasingOptions(l: Line): { label: string; value: string }[] {\n  return []\n}`
  const retGot = sliceFn(retTxt, 'pingCasingOptions')
  check(
    '返回类型里的 `{}` 不骗走切片',
    retGot === retTxt,
    `实得 ${JSON.stringify(retGot)}`,
  )

  /*
   * ⑤ 洞①：**参数表跨行时，函数体也必须被比对**（2026-09-20 Task 3.5 补）。
   *
   * 这一例的构造就是 `Home.vue` 的 `onCheckedKeys` / `renderEditable` 的形状：参数表换行。
   * 改坏的是**函数体的第 2 行**（`String` → `Number`）。
   * ⚠️ 断言必须**经过 `sliceFn`**，不能只比 `norm` 的两段常量 —— 洞就长在 `sliceFn` 里：
   *    旧版对跨行签名只返回 `function onKeys(`，两边都只剩签名那一行 ⇒ 无论体内怎么改都判「一致」。
   *    经过 `sliceFn` 才有检验力（实测：把 `sliceFn` 换回旧版，这一例立刻红）。
   */
  const multiSig = (body2) =>
    ['function onKeys(', '  keys: DataRowKey[],', '  meta?: { row?: unknown },', ') {', '  if (!keys.length) return', `  checked.value = keys.map(${body2})`, '}'].join('\n')
  const multiGone = firstDiffLine(norm(sliceFn(multiSig('String'), 'onKeys') ?? ''), norm(sliceFn(multiSig('Number'), 'onKeys') ?? ''))
  check(
    '跨行签名的**函数体**被改坏 → 报红且定位到体内那行',
    multiGone === 6,
    `期望首个差异在第 6 行，实得 ${multiGone}（0 = 函数体根本没被比对 ⇒ 洞① 复发）`,
  )

  /*
   * ⑥ 洞②：`type` 别名要能切、且改坏要报红（2026-09-20 Task 3.5 补）。
   *
   * Task 4 要把 `type ProgressSegment` 搬进 `utils/homeConstants.ts`；切不出来就**登记不了**
   * （登记了也是假绿）。改坏的是字段类型（`flex: number` → `flex: string`）。
   * ⚠️ 判据里显式判 `null`：旧版 `sliceFn` 的正则不认 `type`，返回的是 `null` 而不是「切歪了」，
   *    直接丢给 `norm()` 会抛，整个自测崩掉、后面的断言一条都不跑。
   */
  const typeSrc = (field) => ['type Seg = {', '  label: string', `  flex: ${field}`, '  done: boolean', '}'].join('\n')
  const tOldS = sliceFn(typeSrc('number'), 'Seg')
  const tNewS = sliceFn(typeSrc('string'), 'Seg')
  const tDiff = tOldS == null || tNewS == null ? -1 : firstDiffLine(norm(tOldS), norm(tNewS))
  check(
    '`type` 别名被改坏 → 报红且定位到那行',
    tDiff === 3,
    tOldS == null
      ? '`type X = {…}` 根本没被切出来（洞② 复发：正则不认 `type`）'
      : `期望首个差异在第 3 行，实得 ${tDiff}`,
  )
  // `interface` 与 `type` 是两条独立的正则分支，只钉住一条等于「只在单侧被钉住」（洞③ 的教训）。
  const ifaceSrc = (field) => ['interface Seg {', '  label: string', `  flex: ${field}`, '}'].join('\n')
  const iOldS = sliceFn(ifaceSrc('number'), 'Seg')
  const iNewS = sliceFn(ifaceSrc('string'), 'Seg')
  const iDiff = iOldS == null || iNewS == null ? -1 : firstDiffLine(norm(iOldS), norm(iNewS))
  check(
    '`interface` 被改坏 → 报红且定位到那行',
    iDiff === 3,
    iOldS == null
      ? '`interface X {…}` 根本没被切出来（洞② 复发：正则不认 `interface`）'
      : `期望首个差异在第 3 行，实得 ${iDiff}`,
  )

  /*
   * ⑦ 洞③：`async` 前缀 —— 这次钉的是 **`sliceFn`**，不是 `declares`。
   *
   * 上面第 ② 组那条 `declares` 的 async 断言只钉住了**反查**那一侧：把 `sliceFn` 正则里的
   * `(?:async\s+)?` 删掉，此前自测**全绿**。而 `sliceFn` 认不出 `async function foo()` 的后果
   * 更直接：正比对里旧文件那侧返回 `null` ⇒ 报「参照里找不到」（名字明明在），
   * 或者反查与新文件两侧一起出错 ⇒ 静默漏报。
   *
   * ⚠️ 样本里**故意没有 `export`** —— 这样唯一能把匹配挡在 `function` 前面的就只剩 `async`，
   *    这一例才「只可能由 async 前缀差异触发」。
   */
  const asyncTxt = `async function load() {\n  return 1\n}`
  const asyncGot = sliceFn(asyncTxt, 'load')
  check(
    '`sliceFn` 认得 `async function`（去掉 `(?:async\\s+)?` 这例即红）',
    asyncGot === asyncTxt,
    `实得 ${JSON.stringify(asyncGot)}`,
  )

  process.exit(bad ? 1 : 0)
}

/**
 * ⚠️ 参照**先取一次、且必须取到** —— 放在 block 循环**外面**是有意的：
 * `BLOCKS` 为空时循环体一次都不跑，若把 `git show` 写在循环里，`BLOCKS = []` 会让
 * 脚本**根本不碰 git** ⇒ 参照取不到也退 0。那就是「未运行 ≠ 通过」的反面（假绿）。
 * 所以这里无条件先取参照：取不到就 fail-loud。
 */
let refSrc
try {
  // 用 execFileSync（不经 shell）：ref 是命令行参数，走 shell 拼串既怕空格也怕注入。
  refSrc = execFileSync('git', ['-C', ROOT, 'show', `${REF}:${OLD_PATH}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // stderr 也收进来（否则 git 会往终端直接喷一行 fatal，下面又打一遍 —— 重复且刺眼）
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (e) {
  console.error(`✗ 参照提交 ${REF} 取不到（${OLD_PATH}）—— 浅克隆？见 .github/workflows/ci.yml 的 fetch-depth: 0`)
  const why = String(e.stderr || e.message || '').trim().split('\n')[0]
  if (why) console.error(`  git 说：${why}`)
  process.exit(1)
}

let pass = 0
const fail = []
const missing = []

for (const b of BLOCKS) {
  const target = `${ROOT}/${b.target}`
  const rules = b.rewrites || {}
  let newSrc
  try {
    newSrc = readFileSync(target, 'utf8')
  } catch (e) {
    fail.push(`块「${b.target}」读不到 —— ${e.message}`)
    continue
  }
  // `names` / `consts` 都可省 —— 摊平与 `|| []` 的守卫都在 `blockNames()` 里（自测有一例钉住）。
  for (const name of blockNames(b)) {
    const o = sliceFn(refSrc, name)
    const n = sliceFn(newSrc, name)
    if (!o) { fail.push(`${name}: 在参照 ${REF}:${OLD_PATH} 里找不到（清单写错了？）`); continue }
    if (!n) { fail.push(`${name}: ${b.target} 里找不到 —— 没搬过去？`); missing.push(name); continue }
    // ⚠️ 顺序：**先归一化再套改写规则**。`norm()` 去了行首缩进，多行的 `from` 片段匹配不上。
    const a = applyRewrites(name, norm(o), rules)
    const nb = norm(n)
    const at = firstDiffLine(a, nb)
    if (at === 0) { pass++; continue }
    const A = a.split('\n'), B = nb.split('\n')
    const diffs = []
    for (let i = at - 1; i < Math.max(A.length, B.length) && diffs.length < 6; i++) {
      if (A[i] !== B[i]) diffs.push(`    L${i + 1}\n      旧: ${String(A[i]).slice(0, 150)}\n      新: ${String(B[i]).slice(0, 150)}`)
    }
    fail.push(`${name}: 归一化后仍不一致（旧 ${A.length} 行 / 新 ${B.length} 行）\n${diffs.join('\n')}`)
  }
}

// 反向检查：搬走的定义不该在 Home.vue 里留下第二份（否则两份实现会各自漂移）。
// ⚠️ 这里做成**失败**而不是姊妹件那样的警告：清单里写「搬走了」= 同一笔里必须删干净，
//    留着就是「改了一处忘了另一处」——那种不一致是 bug，不是提示。
const after = readFileSync(`${ROOT}/${OLD_PATH}`, 'utf8')
// 前缀含 `async` 的道理与自测那一例同源 —— 见 `declares()` 上方的注释。
const dupe = allNames().filter((n) => declares(after, n))

console.log(`搬迁保真检查（${REF}:${OLD_PATH} → ${BLOCKS.length} 个目标文件）`)
console.log(`  逐字一致：${pass} 个`)
if (missing.length) console.log(`  未搬走：${missing.length} 个`)
if (dupe.length) console.log(`  ⚠️ Home.vue 里仍有同名定义（应已删除）：${dupe.join(', ')}`)
if (fail.length) {
  console.log(`\n✗ ${fail.length} 处不符：`)
  fail.forEach((f) => console.log('  - ' + f))
  process.exit(1)
}
if (dupe.length) {
  console.log('\n✗ 清单里已声明搬走、Home.vue 里却仍有同名定义（两份实现会各自漂移）：')
  dupe.forEach((n) => console.log('  - ' + n))
  process.exit(1)
}
/*
 * 收尾的**判定句必须以条数为条件** —— 不能无条件打绿勾。
 *
 * 起因（复审 Minor 1）：原来这里无条件打 `✓ 清单内全部一致`，于是 `BLOCKS` 为空
 * （或每个 block 的 `names`/`consts` 都空）时，`run-all` 照样把它显示成 ✅ ——
 * 那正是 `run-all.mjs` 文件头明文禁止的那类混淆：**分不出「查了 0 个名字」和「全一致」**
 * （「未运行 ≠ 通过」）。
 *
 * ⚠️ 条数用 `total`（清单声明了多少条），不是 `pass`：
 *    走到这里时 `pass === total` 恒成立（任何没通过的条目都已经 `fail.push` 并在上面退 1），
 *    但**空转**看的是「清单里有没有东西」，与「比过几条」是两回事 —— 别弄反。
 * ⚠️ 空转**仍退 0**：「清单还是空的」不是被检代码的失败，不该把整套 verify 弄红。
 *    但它打的是 ⚠️ 说明，不是绿勾 —— 读的人必须看得出「这次什么都没验」。
 */
const total = BLOCKS.reduce((n, b) => n + blockNames(b).length, 0)
if (total === 0) {
  // ⚠️ **只打一行、且这一行必须在最后** —— `run-all.mjs` 的汇总只取 stdout 的**最后一行非空行**
  //    当说明文字。拆成两行的话，被显示出来的是后一行，看汇总的人就看不到「0 条」这个关键字了。
  console.log('\n⚠️ 清单内 0 条 —— 守卫此刻**空转**，未保护任何代码 —— 往 BLOCKS 里加条目才有用（见文件头「一条的形状」）。')
} else {
  console.log(`\n✓ 清单内 ${pass} 条全部一致 —— 搬迁未改动任何逻辑`)
}
