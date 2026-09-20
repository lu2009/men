/*
 * `decl-sweep.mjs` —— **验工具本身**：`sliceFn` 到底有没有把每个声明「切全」。
 *
 * ## ⚠️ 它验的是「切片器」，不是「搬迁有没有搬错」
 *
 * 这两件事**必须分开**，别混：
 *   · 「搬迁有没有搬错」= `{home,hui}-extract-movecheck.mjs`（拿参照提交与目标文件逐字比）。
 *   · 「切片器切得全不全」= **本脚本**。`sliceFn` 是文本启发式、不是解析器，
 *     它一旦**静默切短**，两台守卫就只比了前半段，而**照样报「逐字一致」**（假绿卡）。
 *     `npm run build` / `vue-tsc` **都抓不到**这类问题 —— 它们只看类型，不看「这段代码有没有被切对」。
 *
 * 判据是**真 TS 解析器**（`app/node_modules/typescript`，就在仓库里）：
 * `ts.createSourceFile` 遍历整棵树取同名声明的 `getText()`，与 `sliceFn` 的结果
 * **都过一遍 `norm()`** 再比（`norm()` 来自被测的那个核心，保证口径一致）。
 *
 * ## 用法
 *
 * ```bash
 * node docs/home-audit/decl-sweep.mjs                       # 四类计数 + 名单
 * node docs/home-audit/decl-sweep.mjs --check               # 「解析器切得全、sliceFn 切短」⇒ exit 1
 * node docs/home-audit/decl-sweep.mjs --selftest            # 只跑本脚本自己的判据自测（不碰 git、不扫目录）
 * node docs/home-audit/decl-sweep.mjs --against <git-ref>   # 额外：该 ref 的核心 vs 工作区核心 方向表
 * ```
 *
 * `--against` 是做**回归证明**用的：拿一个历史提交（例如改核心之前的那个）的核心与当前核心比，
 * 打出「旧对新错（**真回归，必须 0**）/ 旧错新对（改进）/ 两边都对但文本不同（口径）」。
 * ⚠️ 报数字时**必须同时写清比的是哪两个 sha** —— 否则这个数没法复现。
 *
 * ### ⚠️ `--against` 的**新核恒为工作区**，它没有「指定新核」的参数
 *
 * 所以**「旧核 A vs 新核 B」这种声明用这条命令表达不出来** —— 命令只认旧核那一个 ref。
 * 想在某个历史状态上量「A 对 B」，得先 `git stash`/checkout 到那个状态再跑。
 * 文档里凡是给这条命令配数字的，都要写清「**在哪个 HEAD 上跑的**」。
 *
 * ### ⚠️ `--against` 的**盲区：794 个声明它完全看不见**
 *
 * | 量 | 数 |
 * |---|---|
 * | 可识别声明总数 | **4434** |
 * | `--against` 实际比较的 | **3640**（= 4434 − 789 同名重复 − 4 切不出 − 1 抛错）|
 * | **它完全看不见的** | **794（17.9%）** |
 *
 * 这 794 的构成（判据见下面主循环里 `countByName` 那几行）：
 * `countByName` 是**按文件**统计的，判据是 `if (countByName.get(nm) > 1) { … continue }` ——
 * 它把**同文件里重名的声明全部跳过，包括第一个**。其中
 * · **495 个**是第二次及以后的出现（`sliceFn` 本来就只切第一个，比不了，**无可救药**）；
 * · **294 个**是**同名组的第一个**（**本来能被 `sliceFn` 切、只是被这条判据多跳了**）。
 * 495 + 294 = 789，再加 4 切不出 + 1 抛错 = **794**。
 * ⇒ **「旧对 → 新错 = 0」不是全仓结论**，它只覆盖 3640 个。报这个数时必须带上分母。
 * （把那条跳过规则改成「只跳第 2 个及以后」能补上那 294 个，但它会**改动 33 / 3 / 3640
 *   这一整套已写进 §9e/§9g/§9h 的头条数字** ⇒ **本任务不改**，只记账。）
 *
 * ## 四类（对解析器）
 *
 * | 类 | 判据 | 含义 |
 * |---|---|---|
 * | **短** | `解析器文本.startsWith(切片)` 且切片更短，**且差值不是孤立的 `;`** | **切片器切短了** —— `--check` 的门槛 |
 * | **口径差** | 同上，但**差值恰好是空白 + 一个 `;`** | **不是洞** —— 见下节 |
 * | **长** | `切片.startsWith(解析器文本)` 且切片更长 | 切片多带（典型是**行尾注释**，`norm()` 契约明文保留注释）—— 正常 |
 * | **其它** | 两者互不为前缀 | 真空区：切片既没切短也没多带，但就是不一样 ⇒ **要人看** |
 *
 * 用「前缀关系」而不是「行数」判 —— **行数是最容易被骗过去的量**：洞④ 修前修后**行数一样**，
 * 差别只在末行（`}` vs `}>({ a: '' })`）。本仓库为这个坑栽过一次「只比行数 ⇒ 得出全等价的错结论」。
 *
 * ## 第四类「口径差（ASI 守卫 `;`）」—— **为什么它不算洞**
 *
 * 判据（在 **`norm()` 之后**的文本上算，见下）：`norm(解析器文本).startsWith(norm(切片))`
 * 且 **余下部分**匹配 `/^\s*;$/`。
 *
 * 机理：ASI 守卫写法让**下一行行首那个 `;`** 被真 TS 解析器算进上一条 `VariableStatement`：
 * ```ts
 * const old = oldByField.get(l) ?? (l as unknown as Record<string, string>)[field] ?? ''
 * ;(l as unknown as Record<string, string>)[field] = (v as string) ?? ''
 * ```
 * `ts` 给的 `stmt.getText()` 是**第 1 行 + `\n        ;`**；而 `sliceFn` 只切到第 1 行。
 *
 * **为什么不算洞**：**切片含着完整的声明**，去掉的只是那个 **ASI 守卫符**（它不是声明的一部分）
 * ⇒ **任何真改动都会被切片抓到**，判别力不受影响。这与「静默切短」有本质区别。
 * 它**只有一个实例**（全 `app/src`）：`app/src/components/DetailLinesTable.vue::old`。
 *
 * 🔴 **`--check` 的语义**：**「切短」为 0 即通过**；「口径差」照常打印、照常计数，**但不判红**。
 *
 * ### 🔴 为什么**不用「往 `HEAD_CONTINUES` 加 `';'`」的办法把它「修」掉 —— 那是**洗白**
 *
 * 实测（2026-09-20 Task 3.8，把 `core` 的 `HEAD_CONTINUES` 分别改成 A/B/C 三组跑完整 sweep）：
 *
 * | 组 | 改动 | 逐字相同 | 多带 | 切短 | 口径差 | `--check` |
 * |---|---|---|---|---|---|---|
 * | 现状 | 无（BASE 核） | 3505 | 132 | 2 | 1 | exit 1 |
 * | **A** | 只加 `';'` | **3505（没涨！）** | **133** | 2 | **0** | exit 1 |
 * | **B** | 只加 `'>'` | **3507（+2）** | 132 | **0** | 1 | **exit 0** |
 * | **C** | 两个都加 | 3507 | 133 | 0 | 0 | exit 0 |
 *
 * ⚠️ 同一批数据在**本类还没加进来**之前（三类）读作 切短 3 / 2 / 1 / 0，B 组那时也是 `exit 1` ——
 * 因为 `old` 当时被算在「短」里。**两个读法都对，只是口径不同。**
 *
 * 看 A 组那一行（**两套读法下结论一致**）：加 `';'` 之后 **「逐字相同」一条都没涨**，
 * `old` 那一处只是从「口径差」**挪进了「多带」桶**。因为 `headContinues` 不再在第 1 行末收工 ⇒ **整条第 2 行被吞进切片**，
 * 切片变成「第 1 行 + 完整第 2 行」、比解析器文本**还长** ⇒ 掉进「多带」。
 * **切片仍然是错的，但闸变绿了** —— 这正是这套守卫最怕的那件事。
 * **⇒ 本仓库不许加 `';'`**；`'>'` 才是真修法（A/B/C 三组是分开量的，不是「一起加看总数」）。
 *
 * ## 这个判据自己踩过的三个坑（要改本脚本时先看，`docs/2026-09-20-home-hui-split.md` §9d）
 *
 * 1. 遍历**必须限定在「可整体搬走的声明」**这几种 kind —— 否则 `engine` 会命中
 *    `{ engine?: OrderLines }` 里的 `PropertySignature`，报出**假的不同**。
 * 2. `.vue` **不能整个喂** `createSourceFile`：最后一个语句的 `end` 会越过 `</script>`
 *    （`<style scoped` 被当成类型断言续上去），解析器文本凭空多几行 ⇒ 先只取 `<script …>…</script>`。
 * 3. `VariableDeclaration.getText()` 起于 `const`、**不含 `export`**（`export` 挂在外层
 *    `VariableStatement` 上）⇒ 必须**上提一层**，否则每个 `export const` 都会被判「短」。
 *
 * ⚠️ 本脚本**故意不接进 `run-all.mjs`**（接不接由 Task 15 / Task 29 裁决）。
 *    它是诊断仪器，不是「搬迁保真」那一套验收台子。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

import { norm, sliceFn } from './lib/extract-movecheck-core.mjs'

// 仓库根从**本文件位置**推出（本文件在 `docs/home-audit/` ⇒ 往上两级）。别写死绝对路径。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SRC = join(ROOT, 'app', 'src')
const CORE_REL = 'docs/home-audit/lib/extract-movecheck-core.mjs'

const argv = process.argv.slice(2)
const CHECK = argv.includes('--check')
const SELFTEST = argv.includes('--selftest')
const againstIdx = argv.indexOf('--against')
const AGAINST = againstIdx >= 0 ? argv[againstIdx + 1] : null
if (againstIdx >= 0 && !AGAINST) {
  console.error('✗ --against 后面要跟一个 git ref（例如 --against bc8d5855）')
  process.exit(2)
}

/**
 * 前缀归类（见文件头「四类」）。`slice`/`truth` 是**原始文本**，内部各自过 `norm()`。
 * ⚠️ 必须比**归一化后**的文本：切片会多带行首缩进（搬进 `utils/` 后整体多缩 2 格）。
 *
 * ⚠️ **「口径差」那一条必须在 `norm()` 之后的文本上算**（`nt.slice(ns.length)`）——
 *    别拿 raw 文本套同一个 `/^\s*;$/`：raw 下两侧缩进可以不同（`startsWith` 直接不成立），
 *    而且差值的白空部分形状也不一样。`--selftest` 有一例专门钉住这一点。
 *
 * ⚠️ 顺序要紧：**先判「口径差」再判「短」** —— 口径差是「短」的一个**子集**，
 *    放后面判就永远进不来。它是**放松闸门**的那一行，所以 `--selftest` 用
 *    「近邻负例」（差值以 `;` 开头但后面还有东西）钉住它**没把真洞一起放过去**。
 */
export function classify(slice, truth) {
  const ns = norm(slice)
  const nt = norm(truth)
  if (ns === nt) return 'same'
  if (nt.startsWith(ns)) {
    // 差值恰好是「空白 + 一个 `;`」⇒ ASI 守卫符被解析器算进了上一条声明（见文件头）。
    if (/^\s*;$/.test(nt.slice(ns.length))) return 'asi'
    return 'short' // 解析器以切片为前缀 ⇒ 切片只切到一半
  }
  if (ns.startsWith(nt)) return 'long' // 切片多带（行尾注释等）
  return 'other'
}

/*
 * ── `--selftest`：本脚本**自己**的判据自测（2026-09-20 Task 3.8 补） ──────────────
 *
 * 为什么要有：Task 3.7 建了这台仪器却没给自测 ⇒「改坏了没人知道」。
 * 本任务还要**改判据**（加「口径差」这一条放松闸门的规则），没有自测就是拿闸门裸奔。
 *
 * ⚠️ 断言一律**真调 `classify`**（就是主循环跑的那个函数），不许写 `assert(true)` 式的空断言。
 * ⚠️ 每条都必须能**「改坏即红」** —— 在 `/tmp` 副本里把对应判据改坏，确认该条变红。
 *    实测的变异与结果见 `task-3.8-report.md`。
 */
if (SELFTEST) {
  let bad = 0
  const check = (what, cond, detail = '') => {
    if (cond) console.log(`✓ 自测：${what}`)
    else {
      console.log(`✗ 自测失败：${what}${detail ? ` —— ${detail}` : ''}`)
      bad++
    }
  }
  /** 真调 `classify` 的一条断言。 */
  const clsOf = (slice, truth, want, what) => {
    const got = classify(slice, truth)
    check(what, got === want, `期望 \`${want}\`，实得 \`${got}\``)
  }

  // ① 真·切短：切片是解析器文本的**真前缀**，差值不是 `;` ⇒ 必须进「切短」（`--check` 的门槛）。
  //    样本照真形状造：`const a = f(` 首行收支 > 0，切片在配平处提前收口。
  clsOf(
    ['const a = f(', '  1,'].join('\n'), // 切片只切到第 2 行 ⇒ 解析器文本的真前缀
    ['const a = f(', '  1,', '  2', ')'].join('\n'),
    'short',
    '合成①：真·切短（切片是解析器文本的真前缀、差值不是 `;`）→ 进「切短」',
  )

  // ② ASI 守卫 `;`：差值恰为 `\n  ;` ⇒ 必须进「口径差」，**不**进「切短」。
  clsOf(
    ["const old = f(l) ?? ''", "const nxt = g(l) ?? ''"].join('\n').split('\n')[0], // 切片 = 第 1 行
    ["const old = f(l) ?? ''", '  ;'].join('\n'), // 解析器文本 = 第 1 行 + 孤立的 `;`
    'asi',
    '合成②：ASI 守卫 `;`（差值恰为空白 + 一个 `;`）→ 进「口径差」，**不**进「切短」',
  )

  // ③ 行尾注释：切片比解析器文本**更长** ⇒ 进「多带」。
  clsOf(
    ['const a = f() // 行尾注释'].join('\n'),
    ['const a = f()'].join('\n'),
    'long',
    '合成③：行尾注释（切片比解析器文本长）→ 进「多带」',
  )

  // ④ 完全相同 ⇒ 进「逐字相同」。
  clsOf(
    ['const a = f()', 'const b = 1'].join('\n'),
    ['const a = f()', 'const b = 1'].join('\n'),
    'same',
    '合成④：完全相同 → 进「逐字相同」',
  )

  /*
   * ⑤ 🔴 **近邻负例**：差值**以 `;` 开头但后面还有东西** ⇒ **必须仍然进「切短」**。
   *    这是给「口径差」那条**放松闸门**的规则钉边界 —— `^\s*;$` 里的 `$` 掉了，
   *    真洞就会被一起放过去。`--check` 的红靠的就是这个桶。
   */
  clsOf(
    ['const a = f(', '  1'].join('\n'),
    ['const a = f(', '  1', '  ;foo', '  2', ')'].join('\n'),
    'short',
    '合成⑤：**近邻负例** —— 差值以 `;` 开头但后面还有东西（`;foo`）→ **仍然进「切短」**',
  )

  /*
   * ⑥ 🔴 **口径说明**：判据在 **`norm()` 之后**的文本上算，**不是 raw**。
   *    造一对「raw 缩进不同、norm 后相同」的样本：
   *    · raw：切片 `  const a = x`（2 格）vs 解析器 `    const a = x\n    ;`（4 格）
   *      ⇒ `nt.startsWith(ns)` 在 raw 下**不成立** ⇒ 拿 raw 套判据会得到 `other`。
   *    · norm：`const a = x` vs `const a = x\n;` ⇒ 成立且差值 `\n;` ⇒ `asi`。
   *    ⇒ 这一例同时钉住「必须 norm」与「口径差成立」。
   */
  clsOf(
    '  const a = x',
    '    const a = x\n    ;',
    'asi',
    '合成⑥：口径差判据在 **norm() 之后**算 —— raw 下 `startsWith` 不成立（缩进不同），norm 后才成 `asi`',
  )

  process.exit(bad ? 1 : 0)
}

// 真 TS 解析器从 **app 的 node_modules** 取（仓库里就有，不用装）。用 createRequire 锚在 app/package.json，
// 这样无论从哪个 cwd 跑都取到同一份。
const require = createRequire(join(ROOT, 'app', 'package.json'))
let ts
try {
  ts = require('typescript')
} catch (e) {
  console.error(`✗ 取不到 typescript（${join(ROOT, 'app', 'node_modules', 'typescript')}）—— 先 cd app && npm i`)
  console.error(`  ${e.message}`)
  process.exit(2)
}

/**
 * `sliceFn` 的能力面：它的起点正则只认这几种声明。
 * 与核心里的正则**逐字对齐**（含 `async`）—— 对不齐的话，本脚本会拿「`sliceFn` 根本不认的名字」
 * 去比，报出一堆假差异。
 */
const CAP = /^[ \t]*(?:export\s+)?(?:async\s+)?(?:function|const|let|var|type|interface)\s+([A-Za-z_$][\w$]*)\b/

/** `.vue` 只取 `<script …>…</script>` 那一段（坑 2，见文件头）。 */
function scriptOf(file, text) {
  if (!file.endsWith('.vue')) return text
  const m = /<script[^>]*>([\s\S]*?)<\/script>/.exec(text)
  return m ? m[1] : null
}

/** 能整体搬走的声明 kind（坑 1，见文件头）—— 与两台守卫的 `sliceFn` 覆盖面一致。 */
const KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.VariableStatement,
])

function collect(node, sf, out) {
  if (KINDS.has(node.kind)) {
    const txt = node.getText(sf)
    const m = CAP.exec(txt)
    if (m) {
      if (node.kind === ts.SyntaxKind.VariableStatement) {
        // 坑 3：`export` 挂在 `VariableStatement` 上 ⇒ 用这一层（`txt`）的文本，名字取里层的标识符。
        for (const d of node.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) out.push([d.name.text, txt])
        }
      } else if (node.name) {
        out.push([node.name.text, txt])
      }
    }
  }
  // **递归**：搬进工厂函数之后那些声明就不是顶层语句了，只看顶层会把目标文件全漏掉。
  ts.forEachChild(node, (c) => collect(c, sf, out))
}

const SKIP_DIR = new Set(['node_modules', 'dist', '.git'])
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIR.has(e)) walk(p, acc)
    } else if (['.ts', '.vue'].includes(extname(e)) && !e.endsWith('.d.ts')) acc.push(p)
  }
  return acc
}

const files = walk(SRC)
let declTotal = 0
let dupSkipped = 0
let noMatch = 0
const errs = []
const cls = { same: [], long: [], asi: [], short: [], other: [] }
/** 每个声明一行的记录，供 `--against` 复用（避免再扫一遍目录）。 */
const rows = []

for (const f of files) {
  const raw = readFileSync(f, 'utf8')
  const text = scriptOf(f, raw)
  if (text == null) continue
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const decls = []
  collect(sf, sf, decls)
  const countByName = new Map()
  for (const [nm] of decls) countByName.set(nm, (countByName.get(nm) || 0) + 1)
  const rel = f.slice(ROOT.length + 1)
  for (const [nm, truth] of decls) {
    declTotal++
    // 同名在一个文件里出现多次时跳过：`sliceFn` 只会切**第一个**同名声明，
    // 拿它跟第二个的真文本比必然不等 —— 那是比较口径的问题，不是切片器的洞。
    // ⚠️ 这条判据跳的是**整组**（含第一个）⇒ 见文件头「盲区：794 个声明它完全看不见」。
    if (countByName.get(nm) > 1) {
      dupSkipped++
      continue
    }
    let slice = null
    let err = null
    try {
      slice = sliceFn(text, nm)
    } catch (e) {
      err = e.message.split('\n')[0]
    }
    if (err) {
      errs.push(`${rel}::${nm} :: ${err}`)
      continue
    }
    if (slice == null) {
      noMatch++
      continue
    }
    const c = classify(slice, truth)
    cls[c].push(`${rel}::${nm}`)
    rows.push({ rel, nm, c, slice, truth })
  }
}

const pct = (n) => `${((n / Math.max(1, declTotal)) * 100).toFixed(1)}%`
console.log(`切片器体检（decl-sweep）—— ${SRC.replace(ROOT + '/', '')}，真 TS 解析器 ${ts.version}`)
console.log(`  扫描文件 ${files.length} 个 · 可识别声明 ${declTotal} 个（跳过同名重复 ${dupSkipped}、切不出 ${noMatch}）`)
console.log(`  ✅ 与解析器逐字相同      ${cls.same.length}  (${pct(cls.same.length)})`)
console.log(`  ➕ 切片多带（行尾注释等） ${cls.long.length}  (${pct(cls.long.length)})`)
console.log(`  ✂️  切片切短（**洞**）     ${cls.short.length}  (${pct(cls.short.length)})`)
console.log(`  🟰 口径差（ASI 守卫 \`;\`） ${cls.asi.length}  (${pct(cls.asi.length)})  ← **不是洞**，不判红`)
console.log(`  ❓ 其它（互不为前缀）     ${cls.other.length}  (${pct(cls.other.length)})`)
if (errs.length) console.log(`  ⚠️ 切片抛错（结构性硬闸） ${errs.length}`)

const dump = (title, list, max) => {
  if (!list.length) return
  console.log(`\n--- ${title}（${list.length}）---`)
  list.slice(0, max).forEach((x) => console.log('  ' + x))
  if (list.length > max) console.log(`  …还有 ${list.length - max} 条（--all 不截断，自己改 max）`)
}
dump('切片切短', cls.short, 200)
dump('口径差（ASI 守卫 `;`，不是洞、不判红）', cls.asi, 200)
dump('其它（互不为前缀，要人看）', cls.other, 200)
dump('切片抛错', errs, 200)

// ── `--against`：历史核心 vs 工作区核心，方向表（回归证明用） ──────────────────
let regression = 0
if (AGAINST) {
  const dir = mkdtempSync(join(tmpdir(), 'decl-sweep-'))
  const p = join(dir, 'core-against.mjs')
  try {
    writeFileSync(p, execFileSync('git', ['-C', ROOT, 'show', `${AGAINST}:${CORE_REL}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
  } catch (e) {
    console.error(`\n✗ 取不到 ${AGAINST}:${CORE_REL} —— ${String(e.stderr || e.message).split('\n')[0]}`)
    process.exit(2)
  }
  const oldCore = await import(pathToFileURL(p).href)
  let bothOkSame = 0
  let bothOkTextDiff = 0
  const oldBadNewOk = []
  const oldOkNewBad = []
  const bothBad = []
  const oldErr = []
  let textDiff = 0
  for (const r of rows) {
    const text = readFileSync(join(ROOT, r.rel), 'utf8')
    const src = scriptOf(r.rel, text)
    let o = null
    let oe = null
    try {
      o = oldCore.sliceFn(src, r.nm)
    } catch (e) {
      oe = e.message.split('\n')[0]
    }
    const okNew = r.c === 'same'
    // ⚠️ 旧核的判据里**没有「口径差」这一类** ⇒ 它那边只认 `norm` 后逐字相同。这是**故意**的：
    //    比的是「旧核切出来的东西对不对」，不是「旧核的分类器怎么写」。
    const okOld = !oe && o != null && norm(o) === norm(r.truth)
    if (!oe && o != null && o !== r.slice) textDiff++
    if (okOld && okNew && o === r.slice) bothOkSame++
    else if (okOld && okNew) bothOkTextDiff++
    else if (!okOld && okNew) oldBadNewOk.push(`${r.rel}::${r.nm}`)
    else if (okOld && !okNew) oldOkNewBad.push(`${r.rel}::${r.nm}`)
    else bothBad.push(`${r.rel}::${r.nm}${oe ? ' (旧核抛错)' : ''}`)
    if (oe) oldErr.push(`${r.rel}::${r.nm} :: ${oe}`)
  }
  regression = oldOkNewBad.length
  console.log(`\n═══ 方向表：${AGAINST}（旧核） vs 工作区（新核） ═══`)
  console.log(`  ⚠️ 分母 ${rows.length} 个声明（**不是全仓 4434** —— 794 个被跳过规则与抛错挡住了，见文件头「盲区」）`)
  console.log(`  两边都=解析器且切片逐字相同  ${bothOkSame}`)
  console.log(`  两边都=解析器但切片文本不同  ${bothOkTextDiff}`)
  console.log(`  旧错 → 新对（改进）          ${oldBadNewOk.length}`)
  console.log(`  旧对 → 新错（**真回归**）     ${oldOkNewBad.length}`)
  console.log(`  两边都错                     ${bothBad.length}`)
  console.log(`  两核切片文本不同的总数        ${textDiff}`)
  dump('旧错→新对', oldBadNewOk, 200)
  dump('旧对→新错（**真回归，必须是 0**）', oldOkNewBad, 200)
  dump('两边都错', bothBad, 200)
  if (oldErr.length) dump('旧核抛错', oldErr, 50)
}

// 退出码：任何一条红都退 1（`--check` 看「切短」，`--against` 看「旧对→新错」）。
// ⚠️ **先把两条判据都算完再退出** —— 别在 `--against` 里提前 `process.exit`，
//    否则「同时传 `--check --against`」时后一条永远轮不到。
if (CHECK && cls.short.length) {
  console.log(`\n✗ --check：${cls.short.length} 处**解析器切得全、sliceFn 切短** —— 这些声明拿去比对就是假绿卡。`)
}
if (CHECK && !cls.short.length) {
  console.log(
    `\n✓ --check：没有一处「解析器切得全、sliceFn 切短」。` +
      (cls.asi.length ? `（另有 ${cls.asi.length} 处「口径差」—— ASI 守卫 \`;\`，**不是洞**，见文件头。）` : ''),
  )
}
if (regression > 0) {
  console.log(`\n✗ --against：${regression} 处**旧核对、新核错** —— 这是真回归，改核心改坏了。`)
}
if ((CHECK && cls.short.length) || regression > 0) process.exit(1)
