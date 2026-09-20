/*
 * 把仓库里**所有差分台/验收脚本**跑一遍，出汇总。
 *
 * ── 为什么要它（真实教训，2026-09-19）─────────────────────────────────────
 * 那天提交「总余额显示」时，验收只跑了 `npm run build` + **Hui 那几个台子**，
 * 结果同一笔改动给 `loadPrintPrereqs` 的返回值加了 `totalBalances`，
 * 把 `print-lineno-check.mjs` 的手写桩打崩了（`buildOrderPrintContext` 里 TypeError）——
 * **一天之后才被发现**。`npm run build` 和 `vue-tsc` 都抓不到这种「台子的夹具过时」。
 * ⇒ 验收应当是**跑全套**，而不是「跑我记得的那几个」。
 *
 * ── 依赖环境的几个（会在汇总里标出来）────────────────────────────────────
 *   · 需要后端在跑的：多数 `*-check.mjs` / `*-logiccheck.mjs`（默认 `127.0.0.1:3000`，
 *     可用 `E2E_PORT` 覆盖）。后端没起 ⇒ 它们失败**不是**代码问题。
 *   · `finance-reversal-e2e.mjs` 要一个**独立实例**（默认 `3999`），平时不跑。
 *   · `docs/legacy-finance/0{5,6,7,9}-*.mjs`（四台财务差分台）同上，默认也是 `3999`，
 *     并且**还要仓库外**的旧版服务端源码（`lib/run-legacy-fn.mjs` 顶层就读那个 `.ts`）。
 *     2026-09-20 起它们收进了收集范围；在此之前它们散在统一入口之外，长期没人跑。
 *   · `merge-audit.mjs` **已作废**，但**不在收集范围内**（它的文件名不匹配下面的后缀正则）——
 *     它是块「指路牌」，只能手工 `node` 跑，跑必退 1。别以为它被这里跑过。
 *   · `docs/legacy-finance/08-verify-live.mjs` **故意不收**（它要真实数据、还要人工传客户
 *     编号；空库上两边都算 0 ⇒ 必然「绿」= **假绿**）。见下面 `MANUAL`。
 *
 * 仓库根的**统一入口**是 `npm run verify`（`scripts/verify.mjs`）：它按顺序跑
 * fmt → 前端构建 → clippy → test → 建库起后端 → 本脚本。平时验收用那条，
 * 别手工拼命令 —— 手工跑容易漏掉「后端其实没起来」这类前提。
 *
 * 用法：
 *   node docs/home-audit/run-all.mjs            # 跑全部
 *   node docs/home-audit/run-all.mjs --quiet    # 只打汇总表
 *
 * 三个环境变量（`npm run verify` 用它们；手工跑不用管）：
 *   · `RUN_ALL_SKIP=a.mjs,b.mjs` —— 跳过指定台子（逗号分隔，路径同下面的收集格式）。
 *     verify 用它排掉**需要仓库外旧版服务端源码**的那两个（CI 上没有那份源码），
 *     跳过会在汇总里单列一行，**不是静默略过**。
 *   · `RUN_ALL_STRICT=1` —— 把 `EXPECTED` 清空：本该「⏭ 不算真红」的失败一律算红。
 *     verify 跑的是**自己刚拉起来的干净后端**，那些「环境性」借口不成立，
 *     所以要求 36 个全绿，而不是「绿 30 个也行」。
 *   · `RUN_ALL_SUMMARY=<path>` —— 把机器可读的汇总（含 🔴 已知红 / ❌ 真失败 / ⏭ 未运行）
 *     落成 JSON。verify 靠它**如实**报出「已知红」，而不是只看到本脚本退出 0 就当全绿。
 */
import { execFile } from 'node:child_process'
import { readdirSync, writeFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
// 仓库根从**本文件位置**推出（本文件在 `docs/home-audit/` ⇒ 往上**两级**才是仓库根）。
// 原来这里写死的是 `'/Users/aaa/Desktop/door-main'`：本机跑得通，换台机器或进 CI
// （checkout 路径不同）就直接崩。`docs/*.mjs` 那几个台子早就这么写了，差的正是这一层深度。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const QUIET = process.argv.includes('--quiet')
/** 要跳过的台子（`RUN_ALL_SKIP`，逗号分隔）。见文件头。 */
const SKIP = (process.env.RUN_ALL_SKIP || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
/** 严格模式（`RUN_ALL_STRICT=1`）：不给任何「环境性失败」免红牌。见文件头。 */
const STRICT = process.env.RUN_ALL_STRICT === '1'

/**
 * 收集「台子」。**只扫目录第一层，不递归**（`lib/` 里的共用件不是台子）。
 * 两个目录、几套命名，各有各的正则：
 *   · `docs/` 与 `docs/home-audit/`：`*-logiccheck.mjs` / `*-check.mjs` / `*-e2e.mjs`
 *   · `docs/legacy-finance/`：`05-diff-alloc.mjs` 这种 `0N-*.mjs`（2026-09-20 收进来的）
 *   · 搬迁保真守卫：`*-movecheck.mjs`（2026-09-20 接入）—— 它们只读 git + 文件，不依赖后端，
 *     因此**在任何环境都该跑**；但**要 `git show <旧提交>`**，浅克隆下会失败（见 ci.yml 的 fetch-depth）。
 */
const collect = (dir, re = /(-logiccheck|-movecheck|-check|-e2e)\.mjs$/) =>
  readdirSync(`${ROOT}/${dir}`)
    .filter((f) => re.test(f))
    .map((f) => `${dir}/${f}`)
    .sort()

/**
 * **故意不收集**的 —— 收进来只会制造假绿/假红，所以只能手工跑。
 *   · `08-verify-live.mjs`：**只读**的「真实数据体检」，要人工传客户编号（`argv[2]`）。
 *     它比的是「库里的真账」，而这里跑的是**空库/一次性库** ⇒ 两边都算 0 ⇒ 必然「绿」。
 *     假绿比红更坏：它会让「全套绿了」这句话变成假的。要跑它：
 *     `node docs/legacy-finance/08-verify-live.mjs <客户编号>`（对着你真正想看的那套库）。
 */
const MANUAL = ['docs/legacy-finance/08-verify-live.mjs']

const FILES = [
  ...collect('docs'),
  ...collect('docs/home-audit'),
  ...collect('docs/legacy-finance', /^0\d-.*\.mjs$/),
].filter((f) => !SKIP.includes(f) && !MANUAL.includes(f))

/**
 * 已知的**非代码**失败（环境）—— 命中就在汇总里标出来，不算真红。
 * ⚠️ 键必须与上面 `collect()` 产出的路径**逐字一致**，否则这条永远不会命中：
 * 本表里原先有两条死键 —— `docs/home-audit/merge-audit.mjs`（文件名不匹配后缀正则，
 * 压根不在收集范围内）与 `docs/finance-reversal-e2e.mjs`（真文件在 `docs/home-audit/` 下）。
 * 它们从没生效过，却让读的人以为「这两个不跑是安排好的」。**已删**。
 */
const INDEPENDENT = '需要独立后端实例（E2E_PORT，默认 3999；它文件头有起法）'
const EXPECTED = STRICT ? {} : {
  'docs/home-audit/finance-reversal-e2e.mjs': INDEPENDENT,
  // 这四台 2026-09-20 收进来，缺省端口同上一行。⚠️ 它们**额外**还要仓库外旧版源码：
  // CI 上连收集都进不去（verify 用 `RUN_ALL_SKIP` 排掉），手工跑时若没有那份源码，
  // 它们是**在 import 阶段就 ENOENT**，下面这条免红牌只是不让「没起 3999」把它记成真红 ——
  // 想确认它们到底绿不绿，看 `npm run verify` 那一组（见 `docs/verification.md` 第 3 节）。
  'docs/legacy-finance/05-diff-alloc.mjs': INDEPENDENT,
  'docs/legacy-finance/06-diff-balance.mjs': INDEPENDENT,
  'docs/legacy-finance/07-diff-execute.mjs': INDEPENDENT,
  'docs/legacy-finance/09-diff-orderpay.mjs': INDEPENDENT,
  'docs/qrscanner-authz-check.mjs': '需要独立后端实例（BASE，默认 http://localhost:3999；它文件头有起法）',
}

/**
 * 已登记的**真红** —— 与 `EXPECTED` 是两回事，别混：
 *   · `EXPECTED` 说的是「**这不是红**，是环境不满足」；
 *   · 这里说的是「**这就是红**，只是原因不在本次改动、已经查清并记在案，
 *     不让它天天把 CI 卡死」。所以 `RUN_ALL_STRICT=1` **不会**清空它，汇总里也**单列**。
 * 每条都必须能指到一份写清理由的文档；修好一条就删一条。
 *
 * **当前为空**（2026-09-20）。原来那条是 `finance-reversal-e2e.mjs`：它有 3 条断言
 * 与旧版口径矛盾（红冲不改「实收」、`客户余额` 夹零），同一次改动把 `实收金额` 的 SQL
 * 也对齐了旧版（迁移 0025）并改了那几条断言 ⇒ 它现在真绿，按「修好一条删一条」删掉。
 * 排空不等于可以删掉这套机制 —— 留着下次用。见 `docs/verification.md`。
 */
const KNOWN_RED = {}

const results = []
for (const f of FILES) {
  const started = Date.now()
  let ok = true
  let tail = ''
  try {
    const { stdout } = await run('node', [f], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 })
    tail = stdout.trim().split('\n').filter(Boolean).pop() ?? ''
  } catch (e) {
    ok = false
    const out = `${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim()
    // 只留「像原因」的那一行，别把整段堆栈糊上来
    const lines = out.split('\n').filter(Boolean)
    tail =
      lines.find((l) => /TypeError|Error:|ECONNREFUSED|不符|不一致|❌/.test(l)) ??
      lines[lines.length - 1] ??
      '(无输出)'
  }
  results.push({ f, ok, ms: Date.now() - started, tail: tail.slice(0, 120), expected: EXPECTED[f] })
}

const knownRed = results.filter((r) => !r.ok && !r.expected && KNOWN_RED[r.f])
const bad = results.filter((r) => !r.ok && !r.expected && !KNOWN_RED[r.f])
const envBad = results.filter((r) => !r.ok && r.expected)

if (!QUIET) {
  for (const r of results) {
    const mark = r.ok ? '✅' : r.expected ? '⏭ ' : KNOWN_RED[r.f] ? '🔴' : '❌'
    console.log(`${mark} ${r.f.padEnd(48)} ${String(r.ms).padStart(6)}ms  ${r.tail}`)
  }
}

console.log('\n' + '─'.repeat(78))
console.log(`共 ${results.length} 个台子：✅ 通过 ${results.length - bad.length - envBad.length - knownRed.length}` +
  ` · ⏭ 跳过(环境/作废) ${envBad.length} · 🔴 已知红(待裁决) ${knownRed.length} · ❌ 失败 ${bad.length}`)
if (SKIP.length) {
  console.log(`   另按 \`RUN_ALL_SKIP\` **未运行** ${SKIP.length} 个：${SKIP.join('、')}`)
  console.log('   （未运行 ≠ 通过。它们各自的原因见调用方，别把这行当成绿灯。）')
}
if (envBad.length) {
  for (const r of envBad) console.log(`   ⏭ ${r.f} —— ${r.expected}`)
}
if (knownRed.length) {
  console.log('\n🔴 以下是**真红**，只是已经查清并记在案（**不是绿灯**，修好一条删一条）：')
  for (const r of knownRed) console.log(`   · ${r.f}\n     ${KNOWN_RED[r.f]}`)
}
if (bad.length) {
  console.log('\n❌ 这些是真失败，去修（别只重跑一遍看它变绿）：')
  for (const r of bad) console.log(`   · ${r.f}\n     ${r.tail}`)
}
// 机器可读的汇总：调用方（`scripts/verify.mjs`）靠它如实报出「🔴 已知红」，
// 而不是只看到「run-all 退出了 0」就当成全绿。
if (process.env.RUN_ALL_SUMMARY) {
  writeFileSync(
    process.env.RUN_ALL_SUMMARY,
    JSON.stringify(
      {
        total: results.length,
        pass: results.length - bad.length - envBad.length - knownRed.length,
        envBad: envBad.map((r) => r.f),
        knownRed: knownRed.map((r) => ({ f: r.f, why: KNOWN_RED[r.f] })),
        bad: bad.map((r) => ({ f: r.f, tail: r.tail })),
        notRun: SKIP,
      },
      null,
      2,
    ),
  )
}
process.exitCode = bad.length ? 1 : 0
