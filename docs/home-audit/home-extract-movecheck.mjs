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
 * 两者的 `sliceFn` / `norm` **逐字相同**（`node -e` 比对过），`applyRewrites` 只差
 * 「规则从哪来」—— 那边是模块级 `REWRITES`，这边因为是多目标 manifest 而按 block 传参。
 * 改其中一份的 `sliceFn`/`norm` 时**必须同步另一份**。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
 *     consts: ['BAZ'],                  // const BAZ = ...（含 computed / ref）
 *     rewrites: { foo: [{ from: '…', to: '…' }] } }  // 声明的改写，可省
 *
 * ⚠️ **此刻是空的**（2026-09-20 立骨架时）—— 第一个真条目由 Task 2 加。
 * 空清单下本脚本对真代码**没有任何检验力**（它只证明「跑得起来」）。
 */
const BLOCKS = []

/**
 * 反查：这些名字搬走后，Home.vue 里不该再有自己的定义（否则两份实现各自漂移）。
 * `names` / `consts` 都可省（只搬函数就不必写 `consts: []`）—— 见下面循环里同样的取法。
 */
const allNames = () => BLOCKS.flatMap((b) => [...(b.names || []), ...(b.consts || [])])

/**
 * 比对的**核心**：返回首个不同行的行号（1 基），两串一致则返回 0。
 *
 * ⚠️ 主比对循环与 `--selftest` **共用这一个函数**（不是各写一份）——
 * 否则自测验的就不是主循环真正跑的那段代码，等于没测。
 */
function firstDiffLine(a, b) {
  const A = a.split('\n')
  const B = b.split('\n')
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] !== B[i]) return i + 1
  }
  return 0
}

/**
 * 切出一个声明（`function NAME(...) {...}` / `const NAME = ...`）的整段。
 *
 * ⚠️ 切的难点：参数表**后面还有返回类型**，而返回类型里自己就带花括号 ——
 * `function pingCasingOptions(l: Line): { label: string; value: string }[] {`
 * 。按「参数表后第一个 `{`」会切到返回类型上（姊妹件前两版都栽在这）。
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

/**
 * 应用声明的改写；`from` 找不到就报错（规则失效比差异漏网更危险）。
 * 与姊妹件的唯一差别：改写规则按 block 传进来（这边是多目标 manifest 驱动）。
 */
function applyRewrites(name, text, rules) {
  let out = text
  for (const r of rules[name] || []) {
    if (!out.includes(r.from)) {
      throw new Error(`声明的改写失效：${name} 里找不到 from 片段\n  ${r.from.slice(0, 120)}`)
    }
    out = out.split(r.from).join(r.to)
  }
  return out
}

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
  const oldTxt = `function f(a: number) {\n  const n = Math.round(a * 1.13)\n  return n ?? 0\n}`
  const cases = [
    ['Math.round → Math.floor', `function f(a: number) {\n  const n = Math.floor(a * 1.13)\n  return n ?? 0\n}`, 2],
    ['丢掉 ?? 0',              `function f(a: number) {\n  const n = Math.round(a * 1.13)\n  return n\n}`, 3],
    ['未改坏（应判为一致）',    oldTxt, 0],
  ]
  let bad = 0
  for (const [what, newTxt, expectDiffLine] of cases) {
    const diff = firstDiffLine(norm(oldTxt), norm(newTxt)) // 返回首个不同的行号（1 基），一致则 0
    if (diff !== expectDiffLine) {
      console.log(`✗ 自测失败：${what} —— 期望首个差异在第 ${expectDiffLine} 行，实得 ${diff}`)
      bad++
    } else {
      console.log(`✓ 自测：${what} → 第 ${diff} 行`)
    }
  }
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
  // `names` / `consts` 都可省 —— 缺了就当空数组。**别省掉 `|| []`**：漏写一个键时
  // 裸的展开会抛 `TypeError: b.consts is not iterable`（立骨架时实测踩到），
  // 那句话对着清单看不出是哪个 block 缺了什么。
  for (const name of [...(b.names || []), ...(b.consts || [])]) {
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
// 前缀与 `sliceFn` 的取法**逐字对齐**（含 `async`）—— 否则 `async function foo()` 搬走后
// 这一条认不出来，反查会静默漏掉它（立骨架时实测踩到：`load` 就是 `async function`）。
const dupe = allNames().filter((n) => new RegExp(`^[ \\t]*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var)\\s+${n}\\b`, 'm').test(after))

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
if (!BLOCKS.length) {
  console.log('\n⚠️ BLOCKS 清单是空的 —— 本次**没有检验任何东西**（只证明脚本跑得起来）。')
}
console.log('\n✓ 清单内全部一致 —— 搬迁未改动任何逻辑')
