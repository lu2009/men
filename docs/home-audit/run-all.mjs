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
 *   · `merge-audit.mjs` **已作废**（见该文件头），它故意退出 1。
 *
 * 用法：
 *   node docs/home-audit/run-all.mjs            # 跑全部
 *   node docs/home-audit/run-all.mjs --quiet    # 只打汇总表
 */
import { execFile } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { promisify } from 'node:util'

const run = promisify(execFile)
const ROOT = '/Users/aaa/Desktop/door-main'
const QUIET = process.argv.includes('--quiet')

/** 收集「台子」：`*-logiccheck.mjs` / `*-check.mjs` / `*-e2e.mjs`。 */
const collect = (dir) =>
  readdirSync(`${ROOT}/${dir}`)
    .filter((f) => /(-logiccheck|-check|-e2e)\.mjs$/.test(f))
    .map((f) => `${dir}/${f}`)
    .sort()

const FILES = [...collect('docs'), ...collect('docs/home-audit')]

/** 已知的**非代码**失败（环境/已作废）—— 命中就在汇总里标出来，不算真红。 */
const EXPECTED = {
  'docs/home-audit/merge-audit.mjs': '已作废（故意退出 1，见该文件头）',
  'docs/finance-reversal-e2e.mjs': '需要独立后端实例（E2E_PORT，默认 3999）',
  'docs/home-audit/finance-reversal-e2e.mjs': '需要独立后端实例（E2E_PORT，默认 3999）',
  'docs/qrscanner-authz-check.mjs': '需要独立后端实例（BASE，默认 http://localhost:3999；它文件头有起法）',
}

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

const bad = results.filter((r) => !r.ok && !r.expected)
const envBad = results.filter((r) => !r.ok && r.expected)

if (!QUIET) {
  for (const r of results) {
    const mark = r.ok ? '✅' : r.expected ? '⏭ ' : '❌'
    console.log(`${mark} ${r.f.padEnd(48)} ${String(r.ms).padStart(6)}ms  ${r.tai ?? r.tail}`)
  }
}

console.log('\n' + '─'.repeat(78))
console.log(`共 ${results.length} 个台子：✅ 通过 ${results.length - bad.length - envBad.length}` +
  ` · ⏭ 跳过(环境/作废) ${envBad.length} · ❌ 失败 ${bad.length}`)
if (envBad.length) {
  for (const r of envBad) console.log(`   ⏭ ${r.f} —— ${r.expected}`)
}
if (bad.length) {
  console.log('\n❌ 这些是真失败，去修（别只重跑一遍看它变绿）：')
  for (const r of bad) console.log(`   · ${r.f}\n     ${r.tail}`)
}
process.exitCode = bad.length ? 1 : 0
