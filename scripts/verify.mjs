#!/usr/bin/env node
/*
 * 统一验证入口 —— `npm run verify`。
 *
 * ── 为什么要有它 ────────────────────────────────────────────────────────────
 * 原来验证散在五六个地方：`cd backend && cargo test`、`cd app && npm run build`、
 * `node docs/home-audit/run-all.mjs`、fmt、clippy……**各跑各的，谁也不知道全套是什么**。
 * 2026-09-19 就栽在这上面：提交「总余额显示」时只跑了 build + Hui 那几个台子，
 * 同一笔改动打崩了 `print-lineno-check.mjs` 的手写桩，**一天之后才发现**
 * （见 `docs/home-audit/run-all.mjs` 文件头）。一条命令跑全套，就是不让这件事重演。
 *
 * ── 它跑什么（顺序不是随手排的）────────────────────────────────────────────
 *   1. `cargo fmt --all --check`
 *   2. 前端装依赖（缺 `app/node_modules` 时才装）+ `npm run build`（= vue-tsc + vite build）
 *   3. `cargo clippy --workspace --all-targets --all-features -- -D warnings`
 *   4. `cargo test --workspace`
 *   5. 建库 → 起后端 → 等 health → `run-all.mjs`（29 个差分台）→ 收尾
 *
 *   ⚠️ **第 2 步必须早于第 3 步**：`app/src-tauri/tauri.conf.json` 的
 *   `frontendDist` 指向 `../dist`，而 `app/dist/` 是 gitignore 的 —— CI 上刚 checkout
 *   出来没有这个目录，先跑 clippy 的话 `tauri-build` 会直接报错。
 *
 *   （用户原话的顺序是 1/2/3/4/5/6 分列「前端构建、cargo test、台子、fmt、clippy、PG 集成」；
 *     这里把 fmt 提到最前、把前端构建提到 clippy 前，其余等价。第 6 项「PostgreSQL 集成测试」
 *     就是第 5 步 —— 用户已确认「3 和 6 是同一件事」。）
 *
 * ── 隔离：绝不碰你正在跑的那套 ──────────────────────────────────────────────
 *   · 用**自己的库** `smartdoor_verify`（跑前重建、跑完删掉）+ **自己的端口** 3100。
 *   · **不碰** `smartdoor` 开发库、**不碰** :3000。
 *   · **绝不** `docker compose down`（那会连 `pgdata` 卷一起删掉）；只会在容器没起时
 *     `docker compose up -d db`。
 *   · 只在 3100 没人监听时才自己起后端；**已占用就直接报错退出，不做任何清理**。
 *   · 收尾只杀**自己起的那个 PID**、只删**自己建的那个库**（不用 `pkill`）。
 *
 * ── 种子的来源 ──────────────────────────────────────────────────────────────
 *   有几个台子的夹具是照着**真业务配置**写的（`NEEDS_SEED`）。用户手上那份配置只有
 *   开发库里有，所以本地 verify 会把开发库的配置数据**只读**克隆进一次性库
 *   （写操作仍然只落在一次性库上）。克隆不到就**如实列出受影响的台子**，不假装绿。
 *
 * ── 已知未覆盖 / 已知红（会打在最显眼的位置，都不当它是绿灯）────────────────
 *   · **未运行**：2 个台子要在**仓库外**的旧版服务端源码（`/Users/aaa/Downloads/server`）
 *     上切函数跑，CI 上没有那份源码；另有 1 个要有业务配置，CI 的空库满足不了。
 *   · **已知红**：`finance-reversal-e2e.mjs` 是真失败（已查清原因、记在案，待裁决），
 *     记在 `run-all.mjs` 的 `KNOWN_RED` 里。
 *   两者都不是绿。详见 `docs/verification.md`。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

// ── 隔离参数 ────────────────────────────────────────────────────────────────
const PORT = Number(process.env.VERIFY_PORT || 3100)
const DB_NAME = process.env.VERIFY_DB || 'smartdoor_verify'
const DB_CONTAINER = process.env.DB_CONTAINER || 'smartdoor-db'
const DB_USER = process.env.DB_USER || 'smartdoor'
/**
 * 后端首次启动时会往**空库**里播种这个管理员（`modules::auth::seed_admin`），
 * 台子用它登录。这是仓库里已公开的开发缺省值（见 `backend/.env.example`），**不是**生产凭据。
 */
const ADMIN_USER = 'admin'
const ADMIN_PW = 'Admin@12345'
const ADMIN_TENANT = '默认门窗厂'
const BASE = `http://127.0.0.1:${PORT}`

/** 需要**仓库外**旧版服务端源码的台子（模块顶层就读那个文件，缺了直接 ENOENT）。 */
const NEEDS_LEGACY_SRC = ['docs/home-audit/lineno-logiccheck.mjs', 'docs/qrscanner-scan-logiccheck.mjs']
const LEGACY_SERVER = process.env.LEGACY_SERVER_SRC || '/Users/aaa/Downloads/server/src'
const LEGACY_PRESENT = existsSync(`${LEGACY_SERVER}/modules/finance/finance.service.ts`)

/**
 * 需要**库里有业务配置**（公式 / 打印模板）的台子 —— 它自己第一句就断言
 * 「库里至少有一条平开公式（没有的话这个夹具没意义）」。空库跑它必红，**不是**回归。
 * 数据来源见下面的「种子」一节。
 */
const NEEDS_SEED = ['docs/home-audit/print-lineno-check.mjs']
/** `VERIFY_SEED=0` 关掉播种（想验「空库能不能起来」时用）。 */
const SEED = process.env.VERIFY_SEED !== '0'

/** `--quiet` 透传给 `run-all.mjs`：29 个台子逐条那几十行不打了，只留汇总表。 */
const QUIET = process.argv.includes('--quiet')
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

const steps = []
let stepNo = 0
function banner(title) {
  stepNo += 1
  console.log(`\n${'━'.repeat(74)}\n  ${stepNo}. ${title}\n${'━'.repeat(74)}`)
}
/** 跑一条命令，透传输出；返回是否成功。 */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts })
  if (r.error) {
    console.error(red(`  ✗ 起不来：${cmd} —— ${r.error.message}`))
    return false
  }
  return r.status === 0
}
/** 记录一步的结果，失败**立即抛出**（后面几步依赖前面的产物，硬跑没意义）。 */
function record(name, ok, detail = '') {
  steps.push({ name, ok, detail })
  if (!ok) throw new Error(`${name} 失败${detail ? `（${detail}）` : ''}`)
}

// ── 收尾用的状态 ────────────────────────────────────────────────────────────
let backend = null
let dbCreated = false
/** 一次性库里有没有「业务配置」数据（公式 / 打印模板）。有 ⇒ `NEEDS_SEED` 那些台子才有意义。 */
let seeded = false
/** run-all 落下的机器可读汇总（见 `RUN_ALL_SUMMARY`）。 */
const SUMMARY_PATH = resolve(tmpdir(), `smartdoor-verify-${process.pid}.json`)
let harnessSummary = null
let backendLog = ''

function psql(db, sql) {
  return spawnSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', db, '-tAc', sql], {
    encoding: 'utf8',
  })
}

function containerRunning() {
  const r = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', DB_CONTAINER], { encoding: 'utf8' })
  return r.status === 0 && r.stdout.trim() === 'true'
}

function portFree(port) {
  return new Promise((ok) => {
    const s = createServer()
    s.once('error', () => ok(false))
    s.once('listening', () => s.close(() => ok(true)))
    s.listen(port, '127.0.0.1')
  })
}

/** 本次**跑不了**的台子及原因。未运行 ≠ 通过，所以它会同时出现在过程里和汇总里。 */
function uncovered() {
  const out = []
  if (!LEGACY_PRESENT) {
    for (const f of NEEDS_LEGACY_SRC) out.push({ f, why: `缺仓库外旧版服务端源码（${LEGACY_SERVER}）` })
  }
  if (!seeded) {
    for (const f of NEEDS_SEED) out.push({ f, why: '空库 —— 它要有业务配置（公式 / 打印模板）才成立' })
  }
  return out
}

/** 收尾：只杀自己起的 PID、只删自己建的库。任何情况下都不 `compose down`。 */
async function cleanup() {
  if (backend && backend.pid && backend.exitCode === null) {
    console.log(dim(`\n  收尾：停掉本次起的后端 PID ${backend.pid}（只杀这一个）…`))
    try {
      process.kill(backend.pid, 'SIGTERM')
    } catch {
      /* 已经没了 */
    }
    for (let i = 0; i < 20 && backend.exitCode === null; i += 1) await sleep(250)
    if (backend.exitCode === null) {
      try {
        process.kill(backend.pid, 'SIGKILL')
      } catch {
        /* 已经没了 */
      }
    }
  }
  if (dbCreated) {
    console.log(dim(`  收尾：删掉本次建的库 ${DB_NAME}…`))
    // PG13+ 的 WITH (FORCE)：连同残留连接一起断掉，否则 DROP 会被占用挡回来。
    const r = psql('postgres', `DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`)
    if (r.status !== 0) console.error(red(`  ⚠️ 库 ${DB_NAME} 没删掉：${(r.stderr || '').trim()}`))
  }
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
let failed = null
try {
  console.log(`统一验证入口 — 仓库根 ${ROOT}`)
  console.log(dim(`  隔离：库 ${DB_NAME} · 端口 ${PORT} · 容器 ${DB_CONTAINER}`))

  // 1 ── fmt
  banner('cargo fmt --all --check')
  record('cargo fmt --all --check', run('cargo', ['fmt', '--all', '--check']), '有文件没格式化，跑 `cargo fmt --all`')

  // 2 ── 前端（必须早于 clippy，见文件头）
  if (!existsSync(resolve(ROOT, 'app/node_modules'))) {
    banner('npm ci（app/，首次装依赖）')
    record('npm ci', run('npm', ['ci'], { cwd: resolve(ROOT, 'app') }))
  }
  banner('npm run build（app/：vue-tsc --noEmit && vite build）')
  record('npm run build', run('npm', ['run', 'build'], { cwd: resolve(ROOT, 'app') }))

  // 3 ── clippy
  banner('cargo clippy --workspace --all-targets --all-features -- -D warnings')
  record(
    'cargo clippy',
    run('cargo', ['clippy', '--workspace', '--all-targets', '--all-features', '--', '-D', 'warnings']),
  )

  // 4 ── test
  banner('cargo test --workspace')
  record('cargo test', run('cargo', ['test', '--workspace']))

  // 5 ── 后端 + 29 个差分台
  banner('差分台（29 个）—— 起 postgres + 后端')

  if (!(await portFree(PORT))) {
    throw new Error(
      `端口 ${PORT} 已被占用 —— 拒绝继续。\n` +
        `  verify 要在自己的端口上起后端；这里**不做任何清理**（占用它的可能是你正在用的东西）。\n` +
        `  自己看一眼：lsof -nP -iTCP:${PORT} -sTCP:LISTEN`,
    )
  }

  // 5a 容器
  if (!containerRunning()) {
    console.log(`  容器 ${DB_CONTAINER} 没在跑，` + dim('docker compose up -d db') + ' …')
    if (!run('docker', ['compose', 'up', '-d', 'db'])) throw new Error('起 postgres 容器失败')
    for (let i = 0; i < 40; i += 1) {
      if (psql('postgres', 'select 1').status === 0) break
      await sleep(500)
    }
  }
  if (psql('postgres', 'select 1').status !== 0) {
    throw new Error(`连不上容器 ${DB_CONTAINER} 里的 postgres（本台子要用它建自己的库）`)
  }

  // 5b 建库（先删后建 = 每次都是干净起点）
  const drop = psql('postgres', `DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`)
  if (drop.status !== 0) throw new Error(`删不掉旧库 ${DB_NAME}：${(drop.stderr || '').trim()}`)
  const create = psql('postgres', `CREATE DATABASE "${DB_NAME}"`)
  if (create.status !== 0) throw new Error(`建不了库 ${DB_NAME}：${(create.stderr || '').trim()}`)
  dbCreated = true
  console.log(`  已建空库 ${DB_NAME}` + dim('（后端启动时会自动 migrate + 播种管理员）'))

  // 5b′ 种子：把**开发库的业务配置**（公式 / 打印模板）只读克隆过来。
  //   · 为什么需要：有几个台子的夹具是**照着真配置**写的（`NEEDS_SEED`），空库跑它必红，
  //     而那**不是**回归。用户手上那份配置在开发库里，没有第二份来源。
  //   · 只读源库、只写一次性库；克隆不到就**如实列出受影响的台子**，不假装绿。
  //   · CI 上没有开发库 ⇒ 这一步在 CI 里必然跳过，那几个台子由 verify 显式列为「未运行」。
  if (SEED && psql('smartdoor', 'select count(*) from formulas').status === 0) {
    const dump = spawnSync('docker', ['exec', DB_CONTAINER, 'sh', '-c', `pg_dump -U ${DB_USER} -d smartdoor`], {
      maxBuffer: 512 * 1024 * 1024,
    })
    const load =
      dump.status === 0
        ? spawnSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-q'], {
            input: dump.stdout,
            maxBuffer: 512 * 1024 * 1024,
          })
        : { status: 1 }
    seeded = load.status === 0 && Number(psql(DB_NAME, 'select count(*) from formulas').stdout?.trim() || 0) > 0
    console.log(
      seeded
        ? `  已从开发库**只读**克隆业务配置（公式 / 打印模板）` + dim('（写操作仍然只落在一次性库上）')
        : yellow('  ⚠️ 从开发库克隆业务配置失败，本次按空库跑'),
    )
  } else {
    console.log(dim('  未播种业务配置（没有可克隆的开发库，或 VERIFY_SEED=0）'))
  }

  // 5c 后端二进制
  record('cargo build -p smartdoor-backend', run('cargo', ['build', '-p', 'smartdoor-backend']))
  const BIN = resolve(ROOT, 'target/debug/smartdoor-backend')

  // 5d 起后端（只起这一个进程；收尾时按 PID 精确终止）
  backend = spawn(BIN, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: `postgres://${DB_USER}:${DB_USER}@localhost:5432/${DB_NAME}`,
      PORT: String(PORT),
      ADMIN_USERNAME: ADMIN_USER,
      ADMIN_PASSWORD: ADMIN_PW,
      ADMIN_TENANT_NAME: ADMIN_TENANT,
      DB_TIMEZONE: 'Asia/Shanghai',
      RECEIPT_SECRET: 'verify-only-not-a-real-secret',
      CORS_ORIGINS: BASE,
      RUST_LOG: QUIET ? 'error' : 'warn',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  backend.stdout.on('data', (b) => {
    backendLog += b
  })
  backend.stderr.on('data', (b) => {
    backendLog += b
  })
  console.log(`  后端已起：PID ${backend.pid} → ${BASE}`)

  // 5e 等 health
  let up = false
  for (let i = 0; i < 60; i += 1) {
    if (backend.exitCode !== null) break
    try {
      const r = await fetch(`${BASE}/api/v1/health`)
      if (r.ok) {
        up = true
        break
      }
    } catch {
      /* 还没监听 */
    }
    await sleep(500)
  }
  if (!up) {
    throw new Error(
      `后端 30 秒内没起来（exitCode=${backend.exitCode}）。它最后说的话：\n` +
        backendLog
          .trim()
          .split('\n')
          .slice(-12)
          .map((l) => `    ${l}`)
          .join('\n'),
    )
  }
  console.log(green('  health ✓'))

  // 5f 差异化台：给它们 verify 的库 / 端口 / 管理员，并要求**不许有环境性免红牌**
  const miss = uncovered()
  const skip = miss.map((m) => m.f)
  if (skip.length) {
    console.log(
      yellow(
        `\n  ⚠️ 本次**未运行** ${skip.length} 个台子：\n` +
          miss.map((m) => `       · ${m.f}\n         ↳ ${m.why}`).join('\n') +
          `\n     未运行 ≠ 通过。本机想跑全，把缺的东西补齐即可`,
      ),
    )
  }
  const ok = run('node', ['docs/home-audit/run-all.mjs', ...(QUIET ? ['--quiet'] : [])], {
    env: {
      ...process.env,
      BASE,
      E2E_PORT: String(PORT),
      DB_CONTAINER,
      DB_USER,
      DB_NAME,
      ADMIN_USER,
      ADMIN_PW,
      RUN_ALL_STRICT: '1',
      RUN_ALL_SUMMARY: SUMMARY_PATH,
      ...(skip.length ? { RUN_ALL_SKIP: skip.join(',') } : {}),
    },
  })
  record('差分台 run-all.mjs', ok, '台子红了就是真红，别只重跑一遍看它变绿')
} catch (e) {
  failed = e
} finally {
  await cleanup()
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(74)}`)
console.log('  统一验证入口 —— 汇总')
console.log('─'.repeat(74))
for (const s of steps) console.log(`  ${s.ok ? '✅' : '❌'} ${s.name}${s.detail && !s.ok ? dim(`  (${s.detail})`) : ''}`)

const miss = uncovered()
if (miss.length) {
  console.log(yellow(`\n  ⚠️ 未覆盖 ${miss.length} 个台子（未运行 ≠ 通过）：`))
  for (const m of miss) console.log(yellow(`       · ${m.f}\n         ↳ ${m.why}`))
  console.log(yellow('     详见 docs/verification.md 的「已知未覆盖」。'))
}

try {
  harnessSummary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'))
} catch {
  /* 没跑到那一步，或文件没落下来 */
}
rmSync(SUMMARY_PATH, { force: true })

if (harnessSummary?.knownRed?.length) {
  console.log(red(`\n  🔴 已知红 ${harnessSummary.knownRed.length} 个 —— 它们**失败**了，只是原因已查清并记在案：`))
  for (const r of harnessSummary.knownRed) console.log(red(`       · ${r.f}\n         ↳ ${r.why}`))
  console.log(red('     这不是绿灯：修好一条，就从 run-all.mjs 的 KNOWN_RED 里删一条。'))
}

if (failed) {
  console.log(red(`\n  ❌ 挂在：${failed.message.split('\n')[0]}`))
  console.log(red(`${failed.message}\n`))
  process.exit(1)
}
const caveats = []
if (miss.length) caveats.push(`${miss.length} 个台子本次未运行`)
if (harnessSummary?.knownRed?.length) caveats.push(`${harnessSummary.knownRed.length} 个已知红未修`)
console.log(
  caveats.length
    ? yellow(`\n  ⚠️ 没有失败项，但**不等于全绿**：${caveats.join('；')}（见上）。\n`)
    : green('\n  ✅ 全绿\n'),
)
