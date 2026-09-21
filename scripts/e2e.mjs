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
 * 本装置只起**一个**后端、**一个** vite（端口写死），并行 worker 会互相抢这套进程与端口；
 * 而且所有 spec 共用**同一个**工作库、库里还有**写操作**。并行跑就是自己踩自己。
 * 写与写之间的隔离**不靠这条** —— 靠「每个用例开始前把工作库重置回干净克隆态」
 * （见下面「写隔离」，实测 0.363s/次）。`workers=1` 管的是进程与端口那一层。
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
 * ── 写隔离（2026-09-21 加，取代「只许改别的 spec 不读的字段」那条约定）──────────
 * 老办法是靠**人工挑字段**躲开冲突（谁要改编辑字段先回来对清单），那条路自己写着
 * 「今天的安全是「选得好」，**不是「被保证的**」。现在换成机制：
 *
 *   **两个库。** `smartdoor_e2e_seed` 是**只读母本**（从开发库克隆一次，全程没人写它）；
 *   `smartdoor_e2e` 是**工作库**，从母本 `CREATE DATABASE … TEMPLATE` 拷出来。
 *   每个用例开始前，spec 侧（`app/e2e/lib/setup.ts` 的 auto fixture）把工作库
 *   **掐连接 → DROP → 从母本重建**，于是上一条用例的写全被抹掉。
 *   ⇒ 创建/修改/删除这类流程才**能测** —— 不必再躲着别的 spec 写。
 *
 *   成本实测：`CREATE DATABASE … TEMPLATE` **0.098s**、整轮重置 **0.363s**，
 *   且与库体积无关（TEMPLATE 是文件级拷贝）。**不需要重启后端** —— 实测池会自愈
 *   （掐连接后 health 200、重新登录拿到令牌、`GET /clients` 200，后端日志 error+panic 零行）。
 *
 * ── 隔离细则 ────────────────────────────────────────────────────────────────
 *   · 母本 = `smartdoor_e2e_seed`、工作库 = `smartdoor_e2e`（**每次跑之前删掉重建**，跑完
 *     两个都删）；源库 `smartdoor` **只读**，只 `pg_dump` 出来灌进母本，绝不回写。
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
 * **只读母本**：开发库克隆下来的那一份，全程没有任何进程连它。
 * 工作库 `DB_NAME` 每个用例前从它 `TEMPLATE` 重建（见文件头「写隔离」）。
 */
const SEED_DB = process.env.E2E_SEED_DB || 'smartdoor_e2e_seed'
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
// 母本同样会被 DROP/CREATE，所以一样要有守卫 —— 而且**多两条**：它绝不能等于工作库
// （否则「从母本重建工作库」就成了自己拷自己，重置会静默失效，测试之间又开始互相看见写入）。
if (SEED_DB === SOURCE_DB) throw new Error(`E2E_SEED_DB 不能等于克隆源库 ${SOURCE_DB}`)
if (SEED_DB === DB_NAME) throw new Error(`E2E_SEED_DB 不能等于工作库 ${DB_NAME}（重置会静默失效）`)
if (!/_seed$/.test(SEED_DB)) throw new Error(`E2E_SEED_DB 必须是 *_seed 这种一次性库名，收到 ${SEED_DB}`)

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
let seedCreated = false
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
  // 两个库都要删：工作库与母本。母本也不许留 —— 它装着开发库的克隆，是个不该过夜的东西。
  for (const [created, name, what] of [
    [dbCreated, DB_NAME, '工作库'],
    [seedCreated, SEED_DB, '母本库'],
  ]) {
    if (!created) continue
    console.log(dim(`  收尾：删掉本次建的${what} ${name}…`))
    // PG13+ 的 WITH (FORCE)：连同残留连接一起断掉，否则 DROP 会被占用挡回来。
    const r = psql('postgres', `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
    if (r.status !== 0) console.error(red(`  ⚠️ ${what} ${name} 没删掉：${(r.stderr || '').trim()}`))
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

  // ── 2. 建母本 + 从母本建工作库（源库只读）─────────────────────────────────
  banner(`建只读母本 ${SEED_DB}（从开发库 ${SOURCE_DB} 克隆）→ 工作库 ${DB_NAME}`)

  // 2a. 母本：开发库只读克隆，全程没有进程连它 ⇒ 它永远不会被写脏。
  const dropSeed = psql('postgres', `DROP DATABASE IF EXISTS "${SEED_DB}" WITH (FORCE)`)
  if (dropSeed.status !== 0) throw new Error(`删不掉旧母本 ${SEED_DB}：${(dropSeed.stderr || '').trim()}`)
  const createSeed = psql('postgres', `CREATE DATABASE "${SEED_DB}"`)
  if (createSeed.status !== 0) throw new Error(`建不了母本 ${SEED_DB}：${(createSeed.stderr || '').trim()}`)
  seedCreated = true

  // 参数**传数组**，不拼 shell 字符串（同文件别处的 `psql()` 也是这么写的）——
  // 库名/用户名只从环境变量来，但带引号或空格时拼字符串会**静默**出错。
  const dump = spawnSync('docker', ['exec', DB_CONTAINER, 'pg_dump', '-U', DB_USER, '-d', SOURCE_DB], {
    maxBuffer: 512 * 1024 * 1024,
  })
  if (dump.status !== 0) {
    throw new Error(`pg_dump ${SOURCE_DB} 失败：${(dump.stderr || '').toString().trim()}`)
  }
  const load = spawnSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', SEED_DB, '-q'], {
    input: dump.stdout,
    maxBuffer: 512 * 1024 * 1024,
  })
  if (load.status !== 0) {
    throw new Error(`灌进母本 ${SEED_DB} 失败：${(load.stderr || '').toString().trim()}`)
  }
  console.log(
    green(`  已从 ${SOURCE_DB} **只读**克隆一份到母本 ${SEED_DB}`) +
      dim('（母本从此只读；写操作只落在工作库上）'),
  )

  // 2b. 工作库：**从母本 TEMPLATE 拷**，不是再 dump 一次。
  //     TEMPLATE 是文件级拷贝，与库体积无关（实测 0.098s）—— 这正是「每个用例重置一次」
  //     能负担得起的原因；spec 侧每次重置走的是同一条路（见 app/e2e/lib/setup.ts）。
  const createWork = psql('postgres', `CREATE DATABASE "${DB_NAME}" TEMPLATE "${SEED_DB}"`)
  if (createWork.status !== 0) {
    throw new Error(
      `从母本建工作库失败：${(createWork.stderr || '').trim()}\n` +
        `      母本 ${SEED_DB} 上**不许有任何连接**（TEMPLATE 拷贝要求独占）—— 有残留连接就是这个报错。`,
    )
  }
  dbCreated = true
  record('母本 + 工作库', true)

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
  // ⚠️ `--host 127.0.0.1` 不能省。`vite.config.ts` 没写 `server.host`，vite 就用
  //    `localhost`，而 Node 把 `localhost` 交给系统解析器、**取第一个结果** ——
  //    这台机器上 `/etc/hosts` 里 `127.0.0.1` 与 `::1` 都在，解析顺序会翻。
  //    解析出 `::1` 时 vite 只绑 IPv6，而下面 `waitHttp` 探的是 `WEB`（写死的
  //    `127.0.0.1`）⇒ `ECONNREFUSED` ⇒ 30 秒超时 ⇒ **装置在任何用例之前就挂**，
  //    报出来的却是「vite 没起来」（vite 明明 ready 了）。
  //    2026-09-21 就是这么栽的：重启后解析顺序翻转，之前三次全绿纯属运气。
  //    钉死监听地址，让两端都确定，不再看解析器的脸色。
  vite = spawn(
    process.execPath,
    [resolve(APP, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'],
    {
      cwd: APP,
      env: { ...process.env, VITE_PORT: String(VITE_PORT), VITE_API_TARGET: BASE },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
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
      // 母本：spec 侧每个用例前从它 TEMPLATE 重建工作库（写隔离）。同样**由装置喂**，
      // 两边各写一份的话改漏一处就会让重置静默指向错的库。
      E2E_SEED_DB: SEED_DB,
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
// 两个库都要量（母本同样装着开发库的克隆，同样不该过夜），理由同上：无条件查。
for (const name of [DB_NAME, SEED_DB]) {
  const still = psql('postgres', `select count(*) from pg_database where datname = '${name}'`).stdout?.trim()
  if (still !== '0') leftovers.push(`库 ${name} 还在${still === '' ? '（连库都查不动，别当它是干净）' : ''}`)
}
if (leftovers.length) {
  console.log(red(`\n  ⚠️ 收尾没干净：${leftovers.join('；')}`))
} else {
  console.log(dim(`\n  收尾自检 ✓ 端口 ${BACKEND_PORT}/${VITE_PORT} 已释放，库 ${DB_NAME} / ${SEED_DB} 已删`))
}

if (failed) {
  // 印**一遍**就好（之前首行 + 整条印两遍）。
  console.log(red(`\n  ❌ 装置挂在：\n\n${failed.message}\n`))
  // ⚠️ 用 `exitCode` 而不是 `process.exit()`：输出管道是异步写的，`exit()` 会把**最后几行
  //    （也就是最要紧的那条报错）截掉**。这里让 node 自然退出。
  process.exitCode = 1
} else {
  if (testStatus === 0) {
    console.log(green('\n  ✅ E2E 全绿\n'))
  } else {
    console.log(red(`\n  ❌ E2E 有失败（playwright 退出码 ${testStatus}）\n`))
    // ★ 只在**红的时候**印两边的日志。绿的时候印一整屏没人看；红了却什么都没有才是要命的：
    //   在这之前 `backendLog` 唯一的用途是「后端没起来」那条错误 —— 用例跑到一半才失败时，
    //   后端说的话**全丢了**。而失败的黑盒现象常常是「页面空白 / 接口 500」，
    //   光看 playwright 的报错判不出来是哪一端的事。
    console.log(dim(`  ── 后端最后 30 行（RUST_LOG=warn）──\n${tail(backendLog, 30)}\n`))
    console.log(dim(`  ── vite 最后 20 行 ──\n${tail(viteLog, 20)}\n`))
  }
  process.exitCode = testStatus
}
