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
 * node docs/home-audit/decl-sweep.mjs                       # 三类计数 + 名单
 * node docs/home-audit/decl-sweep.mjs --check               # 「解析器切得全、sliceFn 切短」⇒ exit 1
 * node docs/home-audit/decl-sweep.mjs --against <git-ref>   # 额外：该 ref 的核心 vs 工作区核心 方向表
 * ```
 *
 * `--against` 是做**回归证明**用的：拿一个历史提交（例如改核心之前的那个）的核心与当前核心比，
 * 打出「旧对新错（**真回归，必须 0**）/ 旧错新对（改进）/ 两边都对但文本不同（口径）」。
 * ⚠️ 报数字时**必须同时写清比的是哪两个 sha** —— 否则这个数没法复现。
 *
 * ## 三类（对解析器）
 *
 * | 类 | 判据 | 含义 |
 * |---|---|---|
 * | **短** | `解析器文本.startsWith(切片)` 且切片更短 | **切片器切短了** —— `--check` 的门槛 |
 * | **长** | `切片.startsWith(解析器文本)` 且切片更长 | 切片多带（典型是**行尾注释**，`norm()` 契约明文保留注释）—— 正常 |
 * | **其它** | 两者互不为前缀 | 真空区：切片既没切短也没多带，但就是不一样 ⇒ **要人看** |
 *
 * 用「前缀关系」而不是「行数」判 —— **行数是最容易被骗过去的量**：洞④ 修前修后**行数一样**，
 * 差别只在末行（`}` vs `}>({ a: '' })`）。本仓库为这个坑栽过一次「只比行数 ⇒ 得出全等价的错结论」。
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

import { firstDiffLine, norm, sliceFn } from './lib/extract-movecheck-core.mjs'

// 仓库根从**本文件位置**推出（本文件在 `docs/home-audit/` ⇒ 往上两级）。别写死绝对路径。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SRC = join(ROOT, 'app', 'src')
const CORE_REL = 'docs/home-audit/lib/extract-movecheck-core.mjs'

const argv = process.argv.slice(2)
const CHECK = argv.includes('--check')
const againstIdx = argv.indexOf('--against')
const AGAINST = againstIdx >= 0 ? argv[againstIdx + 1] : null
if (againstIdx >= 0 && !AGAINST) {
  console.error('✗ --against 后面要跟一个 git ref（例如 --against bc8d5855）')
  process.exit(2)
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

/**
 * 前缀归类（见文件头「三类」）。`slice`/`truth` 是**原始文本**，内部各自过 `norm()`。
 * ⚠️ 必须比**归一化后**的文本：切片会多带行首缩进（搬进 `utils/` 后整体多缩 2 格）。
 */
function classify(slice, truth) {
  const ns = norm(slice)
  const nt = norm(truth)
  if (ns === nt) return 'same'
  if (nt.startsWith(ns)) return 'short' // 解析器以切片为前缀 ⇒ 切片只切到一半
  if (ns.startsWith(nt)) return 'long' // 切片多带（行尾注释等）
  return 'other'
}

const files = walk(SRC)
let declTotal = 0
let dupSkipped = 0
let noMatch = 0
const errs = []
const cls = { same: [], long: [], short: [], other: [] }
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
console.log(`  ❓ 其它（互不为前缀）     ${cls.other.length}  (${pct(cls.other.length)})`)
if (errs.length) console.log(`  ⚠️ 切片抛错（结构性硬闸） ${errs.length}`)

const dump = (title, list, max) => {
  if (!list.length) return
  console.log(`\n--- ${title}（${list.length}）---`)
  list.slice(0, max).forEach((x) => console.log('  ' + x))
  if (list.length > max) console.log(`  …还有 ${list.length - max} 条（--all 不截断，自己改 max）`)
}
dump('切片切短', cls.short, 200)
dump('其它（互不为前缀，要人看）', cls.other, 200)
dump('切片抛错', errs, 200)

// ── `--against`：历史核心 vs 工作区核心，方向表（回归证明用） ──────────────────
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
    const okOld = !oe && o != null && norm(o) === norm(r.truth)
    if (!oe && o != null && o !== r.slice) textDiff++
    if (okOld && okNew && o === r.slice) bothOkSame++
    else if (okOld && okNew) bothOkTextDiff++
    else if (!okOld && okNew) oldBadNewOk.push(`${r.rel}::${r.nm}`)
    else if (okOld && !okNew) oldOkNewBad.push(`${r.rel}::${r.nm}`)
    else bothBad.push(`${r.rel}::${r.nm}${oe ? ' (旧核抛错)' : ''}`)
    if (oe) oldErr.push(`${r.rel}::${r.nm} :: ${oe}`)
  }
  console.log(`\n═══ 方向表：${AGAINST}（旧核） vs 工作区（新核） ═══`)
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

if (CHECK) {
  if (cls.short.length) {
    console.log(`\n✗ --check：${cls.short.length} 处**解析器切得全、sliceFn 切短** —— 这些声明拿去比对就是假绿卡。`)
    process.exit(1)
  }
  console.log('\n✓ --check：没有一处「解析器切得全、sliceFn 切短」。')
}
