#!/usr/bin/env node
/*
 * 真浏览器 E2E 装置 —— `npm run e2e`。
 *
 * ── 这是什么 ────────────────────────────────────────────────────────────────
 * 起一套**完全隔离**的栈（一次性库 + 自己的后端端口 + 自己的 vite 端口），用 Playwright
 * 驱动**系统 Chrome** 真跑一遍页面，跑完把库和进程都收干净。测什么写在 `app/e2e/*.spec.ts`。
 *
 * ── 为什么要有它 ────────────────────────────────────────────────────────────
 * 现有三道闸（`vue-tsc` / `npm run build` / 搬迁守卫）对**「模板绑定漏解构 ⇒ 三闸全绿但
 * 页面空白」**集体失明（见记忆 `split-guard-blind-spots` 第 3 类盲区）。E2E 是唯一能盖住
 * 那个盲区的闸。它落地在 `Progress.vue` 拆分**动第一刀之前**，是拆分的第四道闸。
 *
 * ── 怎么跑 ──────────────────────────────────────────────────────────────────
 *   npm run e2e                 # 全套
 *   npm run e2e -- --headed     # 透传参数给 playwright test（如 --headed / --debug / -g 名字）
 * 前置（缺一条它会明确告诉你缺哪条、为什么需要、然后退出 1）：
 *   · docker 容器 `smartdoor-db` **在跑**（一次性库建在它里面）
 *   · 开发库 `smartdoor` **存在**（本装置的数据 = **只读克隆**它。见下面「测试数据」）
 *   · `app/node_modules/@playwright/test` 在（`@playwright/test@1.63` 已在 `app/package.json`）
 *   · 端口 3101 / 5273 **空着**（被占就拒绝继续，**不做任何清理**）
 * **不需要** `npx playwright install` —— 配置里用 `channel: 'chrome'` 直接驱动系统 Chrome，
 * 一个浏览器二进制都不下。
 *
 * ── 为什么不上 CI（用户 2026-09-20 拍板，这是接受的代价）────────────────────
 * 测试数据 = **克隆本机的开发库**，不是自造种子（用户明确不要种子）。
 * 换一台没有那份配置数据的机器（含 CI）跑，页面上就是空的 —— 那时**红得没有意义**。
 * 所以它只在「有 docker 容器 + 有开发库 + 有系统 Chrome」的本机跑。
 *
 * ── 为什么必须 workers=1（写死进 `app/playwright.config.ts`）────────────────
 * 所有 spec 共用**同一个**一次性库，而且 spec 里有**写操作**（`progress.spec` 删行、
 * `home.spec` 改单元格）。并行跑就是自己踩自己。
 *
 * ── 为什么绝对不许碰 :3000 ──────────────────────────────────────────────────
 * `:3000` 是**用户正在用的 dev 后端**，它连的是**用户真在用的开发库** `smartdoor`。
 * 本装置三道锁钉住这件事：
 *   ① 后端 / vite 都起在**别的端口**（3101 / 5273），并由本文件保证；
 *   ② 起 vite **之前**，用 **vite 自己的 `resolveConfig`** 把 `app/vite.config.ts` 解析一遍，
 *      断言解析出来的端口与 `/api` 代理目标**就是**本次的 5273 → 3101。
 *      ★ 这一条是**决定性的**：浏览器发的都是**相对路径** `/api/...`，光看网络请求看不出
 *        代理指向哪儿；配置写错（比如忘了读环境变量）时，代理会**静默**指回 3000，
 *        于是测试的写操作全落进用户的开发库。解析一次配置就能在**任何东西跑起来之前**拦住。
 *   ③ 测试进程里还有一条运行时守卫（`app/e2e/lib/setup.ts`）：任何请求落到 `:3000` 直接判红。
 *
 * ── 隔离细则 ────────────────────────────────────────────────────────────────
 *   · 库 = `smartdoor_e2e`（**每次跑之前删掉重建**，跑完再删）；源库 `smartdoor` **只读**，
 *     只 `pg_dump` 出来灌进一次性库，绝不回写。
 *   · `E2E_DB` 有**两行硬守卫**（见常量块之后）：不许等于源库、不许不是 `*_e2e` 结尾 ——
 *     本文件对库做的第一件事就是 `DROP DATABASE ... WITH (FORCE)`，库名是唯一能真删用户库的入口。
 *   · **不要**「清空 users 让它重新播种」：后端的 `seed_admin` 只在 users 表为空时播种，
 *     而且会**新建租户** —— 新 admin 会落到新租户上，克隆来的订单属于旧租户 ⇒ **页面全空**。
 *     克隆库里的 admin 直接就能登录（`ADMIN_USER` / `ADMIN_PW` 是 `scripts/verify.mjs:71-72`
 *     里已有的开发缺省值，不是生产凭据）。
 *   · 收尾**按 PID 杀**（不用 `pkill -f`），只杀本次起的两个进程、只删本次建的库。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { connect } from 'node:net'
import { dirname, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const APP = resolve(ROOT, 'app')

// ── 隔离参数（改这里 = 改整套端口/库名，spec 侧从环境变量读，不写死）──────────
const BACKEND_PORT = Number(process.env.E2E_PORT || 3101)
const VITE_PORT = Number(process.env.E2E_VITE_PORT || 5273)
const DB_NAME = process.env.E2E_DB || 'smartdoor_e2e'
const DB_CONTAINER = process.env.DB_CONTAINER || 'smartdoor-db'
const DB_USER = process.env.DB_USER || 'smartdoor'
/** 源库：**用户真在用的开发库**。只读，只当克隆源。 */
const SOURCE_DB = process.env.E2E_SOURCE_DB || 'smartdoor'
/**
 * 用户正在用的 dev 后端端口 —— 本装置**绝不**碰它，两个端口也绝不许等于它。
 *
 * 值**从环境变量来**（默认仍是 3000），并且由本文件喂给 spec 侧（`E2E_FORBIDDEN_PORT`）
 * ⇒ 装置与守卫**只可能有一个值**，不会各写一份而静默分叉。
 * 允许覆盖的用途只有一个：**验证守卫本身真的会红** —— 靶子换成自建的本地 server
 * （如 3399），绝不去碰真正的 :3000。⚠️ 覆盖它是**故意削弱本次运行的守卫**，
 * 只许在做这个证明时用。
 */
const FORBIDDEN_PORT = Number(process.env.E2E_FORBIDDEN_PORT) || 3000

/** 登录凭据：`scripts/verify.mjs:71-72` 里已有的开发缺省值，**不引入新口令**。 */
const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin'
const ADMIN_PW = process.env.E2E_ADMIN_PW || 'Admin@12345'
const ADMIN_TENANT = process.env.E2E_ADMIN_TENANT || '默认门窗厂'

// ⛔ **库名守卫** —— 必须在**任何一次 docker 调用之前**（本文件对库做的第一件事就是
//    `DROP DATABASE IF EXISTS ... WITH (FORCE)`，而库名只由 `E2E_DB` 决定）。
//    端口那边有三道锁（见文件头「为什么绝对不许碰 :3000」），**库名这边一道都不能少**：
//    `E2E_DB=smartdoor npm run e2e` 会直接删掉**用户正在用的开发库**。
//    默认值（smartdoor_e2e）本来就是安全的 —— 这两行防的是「有人手滑改了 E2E_DB」。
if (DB_NAME === SOURCE_DB) throw new Error(`E2E_DB 不能等于克隆源库 ${SOURCE_DB}`)
if (!/_e2e$/.test(DB_NAME)) throw new Error(`E2E_DB 必须是 *_e2e 这种一次性库名，收到 ${DB_NAME}`)

const BASE = `http://127.0.0.1:${BACKEND_PORT}`
const WEB = `http://127.0.0.1:${VITE_PORT}`
const BACKEND_BIN = resolve(ROOT, 'target/debug/smartdoor-backend')
const CONFIG_FILE = resolve(APP, 'vite.config.ts')
const PLAYWRIGHT_CLI = resolve(APP, 'node_modules/@playwright/test/cli.js')

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
/** 记录一步的结果，失败**立即抛出**（后面几步依赖前面的产物，硬跑没意义）。 */
function record(name, ok, detail = '') {
  steps.push({ name, ok, detail })
  if (!ok) throw new Error(`${name} 失败${detail ? `（${detail}）` : ''}`)
}

// ── 收尾用的状态 ────────────────────────────────────────────────────────────
let backend = null
let vite = null
let dbCreated = false
let backendLog = ''
let viteLog = ''

function psql(db, sql) {
  return spawnSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', db, '-tAc', sql], {
    encoding: 'utf8',
  })
}

function containerRunning() {
  const r = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', DB_CONTAINER], { encoding: 'utf8' })
  return r.status === 0 && r.stdout.trim() === 'true'
}

/**
 * 端口「空着吗」—— **用 `connect` 探「有没有人在听」，不是探「我能不能绑上」**。
 *
 * ⚠️ 别再改回 `createServer().listen(port, '127.0.0.1')` 那种写法：macOS 的 `SO_REUSEADDR`
 *    允许「指定地址」与「通配地址」在**同一端口**上共存，于是「绑 127.0.0.1 试一下」对
 *    `0.0.0.0:PORT` 的监听会**假阳**（实测：用户正在用的 dev 后端就是 `TCP *:3000 (LISTEN)`，
 *    旧写法把它判成「空着」）。反过来绑 `0.0.0.0` 又会漏掉只绑 `127.0.0.1` 的监听 ——
 *    两种「绑一下试试」各漏一半，**只有 connect 两边都盖得住**。
 *    这条不严会让两处承诺同时失效：「端口被占就拒绝继续」与收尾自检的「端口已释放」。
 */
function portFree(port) {
  return new Promise((ok) => {
    const c = connect({ port, host: '127.0.0.1' })
    c.once('connect', () => {
      c.destroy()
      ok(false) // 有人在听 ⇒ 不空
    })
    c.once('error', () => ok(true))
  })
}

/** 轮询一个 URL 直到 2xx，或超时。返回 true/false。 */
async function waitHttp(url, tries, what) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url)
      if (r.ok) return true
    } catch {
      /* 还没监听 */
    }
    await sleep(500)
  }
  console.log(dim(`  （${what} 没等到：${url}）`))
  return false
}

/** 尾巴几行进程输出，报错时贴出来（不然「起不来」等于没说）。 */
function tail(text, n = 12) {
  return text
    .trim()
    .split('\n')
    .slice(-n)
    .map((l) => `    ${l}`)
    .join('\n')
}

/**
 * 用 **vite 自己的 `resolveConfig`** 把 `app/vite.config.ts` 解析一遍 —— 见文件头「三道锁」②。
 * 这一步**不启动任何东西**、也不写任何东西，纯粹是「vite 等一下会拿到的配置到底是什么」。
 */
function resolvedViteConfig() {
  const probe = [
    "import { resolveConfig } from 'vite'",
    `const cfg = await resolveConfig({ configFile: ${JSON.stringify(CONFIG_FILE)}, root: ${JSON.stringify(APP)} }, 'serve')`,
    "const proxy = cfg.server.proxy && cfg.server.proxy['/api']",
    'process.stdout.write(JSON.stringify({ port: cfg.server.port, target: (proxy && proxy.target) || null }))',
  ].join('\n')
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
    cwd: APP,
    env: { ...process.env, VITE_PORT: String(VITE_PORT), VITE_API_TARGET: BASE },
    encoding: 'utf8',
  })
  if (r.status !== 0) {
    throw new Error(`解析 vite 配置失败（${r.stderr?.trim() || r.error?.message || '未知原因'}）`)
  }
  try {
    return JSON.parse(r.stdout)
  } catch {
    throw new Error(`解析 vite 配置的输出读不懂：${r.stdout}`)
  }
}

/** 收尾：只杀自己起的两个 PID、只删自己建的库。任何情况下都不碰别的东西。 */
let cleaned = false
async function cleanup() {
  // 幂等：`finally` 与信号处理器都会调它（信号可能正好在收尾途中到达），重复调用不能报错、
  // 也不能把「已经杀掉的东西」再数落一遍。
  if (cleaned) return
  cleaned = true
  for (const [child, name] of [
    [vite, 'vite'],
    [backend, '后端'],
  ]) {
    if (!child || !child.pid || child.exitCode !== null) continue
    console.log(dim(`\n  收尾：停掉本次起的${name} PID ${child.pid}（只杀这一个）…`))
    try {
      process.kill(child.pid, 'SIGTERM')
    } catch {
      /* 已经没了 */
    }
    for (let i = 0; i < 20 && child.exitCode === null; i += 1) await sleep(250)
    if (child.exitCode === null) {
      try {
        process.kill(child.pid, 'SIGKILL')
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

// ── 信号路径：Ctrl-C / kill 时也要收干净 ────────────────────────────────────
// `finally` **盖不到信号路径**（实测：给装置单独发 SIGINT 之后，库还在、后端还活着、vite 还活着，
// `finally` 一次都没跑）。诚实边界：真终端 Ctrl-C 是发给**整个前台进程组**的，那两个子进程
// 多半也会一起收到信号而死 ⇒ **进程残留是「看情况」；库残留是无条件的**（没人去 DROP）。
// 所以这一条必须补 —— 报告里那个「上手前容器里已有一个 smartdoor_e2e 残留库」就是这条的生产实例。
for (const [sig, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.on(sig, async () => {
    console.log(dim(`\n  收到 ${sig} —— 先收尾再退出…`))
    await cleanup()
    // 与文件末尾那条报错同样的理由：管道是异步写的，`process.exit()` 会把最后几行截掉。
    // 这里给 stdout 一点时间把上面那句刷出去（收尾是幂等的，重复调用无害）。
    await sleep(50)
    process.exit(code)
  })
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
let failed = null
let testStatus = 1
try {
  console.log(`真浏览器 E2E 装置 — 仓库根 ${ROOT}`)
  console.log(dim(`  隔离：库 ${DB_NAME} · 后端 :${BACKEND_PORT} · vite :${VITE_PORT} · 容器 ${DB_CONTAINER}`))
  console.log(dim(`  ⛔ 绝不碰 :${FORBIDDEN_PORT}（你的 dev 后端）与开发库 ${SOURCE_DB}（只读克隆源）`))

  // ── 1. 前置检查 ───────────────────────────────────────────────────────────
  banner('前置检查')
  record(
    `docker 容器 ${DB_CONTAINER} 在跑`,
    containerRunning(),
    `一次性库 ${DB_NAME} 建在它里面，收尾也从它删 —— 自己起一下：docker compose up -d db`,
  )
  record(
    'app/node_modules/@playwright/test 在',
    existsSync(PLAYWRIGHT_CLI),
    '测试跑不起来 —— cd app && npm ci（装了它才需要，**不用** npx playwright install，配置用系统 Chrome）',
  )
  record(
    `开发库 ${SOURCE_DB} 连得上`,
    psql(SOURCE_DB, 'select 1').status === 0,
    `本装置的数据 = **只读克隆**它（用户拍板：不要自造种子；换台机器就没有这份数据了）`,
  )
  for (const port of [BACKEND_PORT, VITE_PORT]) {
    record(
      `端口 ${port} 空着`,
      await portFree(port),
      `本装置要在自己的端口上起后端 / vite；**不做任何清理**（占它的可能是你正在用的东西）：\n` +
        `      lsof -nP -iTCP:${port} -sTCP:LISTEN`,
    )
  }
  record(
    '两个端口都不是 :3000',
    BACKEND_PORT !== FORBIDDEN_PORT && VITE_PORT !== FORBIDDEN_PORT,
    '那是你正在用的 dev 后端 —— E2E 打到那儿就会写进你的开发库',
  )

  // ── 2. 建库 + 克隆（源库只读）─────────────────────────────────────────────
  banner(`建一次性库 ${DB_NAME}（从开发库 ${SOURCE_DB} 只读克隆）`)
  const drop = psql('postgres', `DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`)
  if (drop.status !== 0) throw new Error(`删不掉旧库 ${DB_NAME}：${(drop.stderr || '').trim()}`)
  const create = psql('postgres', `CREATE DATABASE "${DB_NAME}"`)
  if (create.status !== 0) throw new Error(`建不了库 ${DB_NAME}：${(create.stderr || '').trim()}`)
  dbCreated = true
  record('建库', true)

  // 参数**传数组**，不拼 shell 字符串（同文件别处的 `psql()` 也是这么写的）——
  // 库名/用户名只从环境变量来，但带引号或空格时拼字符串会**静默**出错。
  const dump = spawnSync('docker', ['exec', DB_CONTAINER, 'pg_dump', '-U', DB_USER, '-d', SOURCE_DB], {
    maxBuffer: 512 * 1024 * 1024,
  })
  if (dump.status !== 0) {
    throw new Error(`pg_dump ${SOURCE_DB} 失败：${(dump.stderr || '').toString().trim()}`)
  }
  const load = spawnSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-q'], {
    input: dump.stdout,
    maxBuffer: 512 * 1024 * 1024,
  })
  if (load.status !== 0) {
    throw new Error(`灌进 ${DB_NAME} 失败：${(load.stderr || '').toString().trim()}`)
  }
  console.log(green(`  已从 ${SOURCE_DB} **只读**克隆一份到 ${DB_NAME}`) + dim('（写操作只落在一次性库上）'))

  // 克隆出来的东西对不对 —— 别等页面空白了才发现库是空的（那会误判成「实现坏了」）。
  const lineCount = (db) => Number(psql(db, 'select count(*) from order_lines').stdout?.trim() || -1)
  const srcLines = lineCount(SOURCE_DB)
  const e2eLines = lineCount(DB_NAME)
  record(
    '克隆件数对得上',
    srcLines > 0 && srcLines === e2eLines,
    `源库 order_lines=${srcLines}，克隆库=${e2eLines}（源库本来就是空的话，整套断言都没有意义）`,
  )
  const adminInClone = Number(
    psql(DB_NAME, `select count(*) from users where username = '${ADMIN_USER}'`).stdout?.trim() || 0,
  )
  record(
    `克隆库里有现成的管理员 ${ADMIN_USER}`,
    adminInClone === 1,
    '**不要去清空 users 让它重新播种** —— `seed_admin` 会**新建租户**，新 admin 落在新租户上，' +
      '克隆来的订单属于旧租户 ⇒ 页面全空',
  )
  console.log(dim(`  order_lines ${e2eLines} 行 · 管理员 ${ADMIN_USER}（租户「${ADMIN_TENANT}」）`))

  // ── 3. 起 vite 之前先把「代理指向哪儿」钉死 ───────────────────────────────
  banner('vite 配置解析（决定性的隔离锁）')
  const cfg = resolvedViteConfig()
  record(
    `vite 解析出的端口 = ${VITE_PORT}`,
    cfg.port === VITE_PORT,
    `解析出来是 ${cfg.port} —— app/vite.config.ts 没读到 VITE_PORT（写死 5173 的话会和你的 dev server 撞车）`,
  )
  record(
    `/api 代理目标 = ${BASE}`,
    cfg.target === BASE,
    `解析出来是 ${cfg.target} —— app/vite.config.ts 没读到 VITE_API_TARGET。\n` +
      `      **拒绝继续**：代理指错 = 本次的写操作会落进你的开发库 ${SOURCE_DB}`,
  )
  console.log(
    green(`  ✓ 解析结果就是本次的 ${VITE_PORT} → ${BACKEND_PORT}`) +
      dim('（浏览器发的是相对路径，光看请求看不出来，所以要在起之前解析一次）'),
  )

  // ── 4. 后端二进制 ─────────────────────────────────────────────────────────
  // banner **无条件**打（之前是条件打 ⇒ 二进制已存在时步骤号会跳号，看着像漏了一步）。
  banner('后端二进制')
  if (existsSync(BACKEND_BIN)) {
    console.log(dim(`  已在，跳过编译：${BACKEND_BIN}`))
  } else {
    const b = spawnSync('cargo', ['build', '-p', 'smartdoor-backend'], { cwd: ROOT, stdio: 'inherit' })
    record('cargo build -p smartdoor-backend', b.status === 0)
  }

  // ── 5. 起后端（指向一次性库）─────────────────────────────────────────────
  banner(`起后端 :${BACKEND_PORT} → 库 ${DB_NAME}`)
  backend = spawn(BACKEND_BIN, [], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: `postgres://${DB_USER}:${DB_USER}@localhost:5432/${DB_NAME}`,
      PORT: String(BACKEND_PORT),
      // 这三个只在**空库**里播种时才用得上（克隆库有 admin，走不到）；给上是为了不误播种。
      ADMIN_USERNAME: ADMIN_USER,
      ADMIN_PASSWORD: ADMIN_PW,
      ADMIN_TENANT_NAME: ADMIN_TENANT,
      DB_TIMEZONE: 'Asia/Shanghai',
      RECEIPT_SECRET: 'e2e-only-not-a-real-secret',
      CORS_ORIGINS: WEB,
      RUST_LOG: 'warn',
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

  const health = await waitHttp(`${BASE}/api/v1/health`, 60, '后端 health')
  if (!health) {
    throw new Error(
      `后端 30 秒内没起来（exitCode=${backend.exitCode}）。它最后说的话：\n${tail(backendLog)}`,
    )
  }
  console.log(green('  health ✓'))

  // 登录探针：在 Playwright 之前先证明「这份克隆库 + 这套凭据」真能登进去。
  // （不然登录失败会淹没在 Playwright 的一堆超时里，看不出是数据问题还是页面问题。）
  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PW }),
  })
  const loginBody = await loginRes.json().catch(() => ({}))
  // ⚠️ 复制件都在 `{data: ...}` 信封里（与 `scripts/verify.mjs` 打接口时看到的一样）。
  const loginData = loginBody?.data ?? loginBody
  record(
    `用 ${ADMIN_USER} 登录克隆库`,
    loginRes.ok && typeof loginData?.token === 'string',
    `${loginRes.status} ${JSON.stringify(loginBody).slice(0, 200)} —— 克隆库里的 admin 应该直接能用；` +
      `**别去清空 users 重新播种**（见上）`,
  )
  console.log(
    green(`  登录 ✓`) +
      dim(` 租户「${loginData?.tenant?.name ?? '?'}」(id=${loginData?.tenant?.id ?? '?'})`),
  )

  // ── 6. 起 vite（代理指向本次后端）──────────────────────────────────────────
  banner(`起 vite :${VITE_PORT}（/api → ${BASE}）`)
  vite = spawn(process.execPath, [resolve(APP, 'node_modules/vite/bin/vite.js')], {
    cwd: APP,
    env: { ...process.env, VITE_PORT: String(VITE_PORT), VITE_API_TARGET: BASE },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  vite.stdout.on('data', (b) => {
    viteLog += b
  })
  vite.stderr.on('data', (b) => {
    viteLog += b
  })
  console.log(`  vite 已起：PID ${vite.pid} → ${WEB}`)

  const web = await waitHttp(`${WEB}/`, 60, 'vite')
  if (!web) {
    throw new Error(`vite 30 秒内没起来（exitCode=${vite.exitCode}）。它最后说的话：\n${tail(viteLog)}`)
  }
  console.log(green('  vite ✓'))

  // ── 7. Playwright ─────────────────────────────────────────────────────────
  banner('playwright test（cwd app/）')
  const passthrough = process.argv.slice(2)
  const pw = spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', ...passthrough], {
    cwd: APP,
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_BASE_URL: WEB,
      // spec 侧「现查克隆库」用这几个（见 app/e2e/lib/setup.ts）—— 不写死任何库名/端口。
      E2E_DB_NAME: DB_NAME,
      E2E_DB_CONTAINER: DB_CONTAINER,
      E2E_DB_USER: DB_USER,
      E2E_ADMIN_USER: ADMIN_USER,
      E2E_ADMIN_PW: ADMIN_PW,
      // 运行时守卫盯的那个端口**由装置喂进来**：`setup.ts` 里再写一份 3000 的话，
      // 哪天两边改漏一处，守卫就会「盯着一个没人用的端口」而**静默失效**。
      E2E_FORBIDDEN_PORT: String(FORBIDDEN_PORT),
    },
  })
  if (pw.error) throw new Error(`playwright 起不来：${pw.error.message}`)
  testStatus = pw.status ?? 1
  record('playwright test', testStatus === 0, '红了就是真红 —— 别只重跑一遍看它变绿')
} catch (e) {
  failed = e
} finally {
  await cleanup()
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(74)}`)
console.log('  E2E 装置 —— 汇总')
console.log('─'.repeat(74))
for (const s of steps) console.log(`  ${s.ok ? '✅' : '❌'} ${s.name}${s.detail && !s.ok ? dim(`  (${s.detail})`) : ''}`)

// 收尾自检：装置自己说「收干净了」不算数，量一遍。
const leftovers = []
for (const port of [BACKEND_PORT, VITE_PORT]) {
  if (!(await portFree(port))) leftovers.push(`端口 ${port} 还被占着`)
}
// ⚠️ 这里**不许**再加 `if (dbCreated)`：失败在「建库之前」的那些轮次（前置检查不过、端口被占、
//    `E2E_PORT=3000`…）dbCreated 是 false，于是库检查整段被跳过、自检却照样印「库已删」——
//    **没量过就下结论**（实测栽过）。库里没有这个名字就等价于删干净了，查一次即可。
const still = psql('postgres', `select count(*) from pg_database where datname = '${DB_NAME}'`).stdout?.trim()
if (still !== '0') leftovers.push(`库 ${DB_NAME} 还在${still === '' ? '（连库都查不动，别当它是干净）' : ''}`)
if (leftovers.length) {
  console.log(red(`\n  ⚠️ 收尾没干净：${leftovers.join('；')}`))
} else {
  console.log(dim(`\n  收尾自检 ✓ 端口 ${BACKEND_PORT}/${VITE_PORT} 已释放，库 ${DB_NAME} 已删`))
}

if (failed) {
  // 印**一遍**就好（之前首行 + 整条印两遍）。
  console.log(red(`\n  ❌ 装置挂在：\n\n${failed.message}\n`))
  // ⚠️ 用 `exitCode` 而不是 `process.exit()`：输出管道是异步写的，`exit()` 会把**最后几行
  //    （也就是最要紧的那条报错）截掉**。这里让 node 自然退出。
  process.exitCode = 1
} else {
  console.log(
    testStatus === 0 ? green('\n  ✅ E2E 全绿\n') : red(`\n  ❌ E2E 有失败（playwright 退出码 ${testStatus}）\n`),
  )
  process.exitCode = testStatus
}
