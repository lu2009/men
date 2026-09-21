/**
 * E2E 共享件 —— **只有这一份**，`*.spec.ts` 一律 import 这里，不许抄第二份。
 *
 * 装它的装置是 `scripts/e2e.mjs`（`npm run e2e`）：它建一次性库、起后端与 vite，
 * 再把这些东西通过环境变量喂进来。**这套 spec 必须整装置跑** —— 它们不只是「点点看」，
 * 每一条断言都要**现查克隆库**跟页面对账（差分台的精神：左边数据库、右边页面，逐字段比）。
 *
 * 四件东西：
 *   1. `test` / `expect` —— **从这里 import，不要从 `@playwright/test` import**。
 *      `test` 上挂了两个 auto fixture：**写隔离的重置**（§3.5）+ 三道闸
 *      （`pageerror` / `console.error` 零容忍 + **`:3000` 请求守卫**，见 §4）。
 *      两道都是自动生效，判定在 fixture 的 teardown 里跑（测试体怎么挂都会跑）。
 *   2. `login(page)` —— 走**真表单**登录（不是塞 token），返回落地的 URL；
 *   3. `dbQuery` / `progressLineCount` / `adminTenantId` —— **现查克隆库**的小工具；
 *   4. `resetWorkDb()` —— 写隔离的重置（已挂在 auto fixture 上，测试体一般**不用**直接调）。
 *
 * ⚠️ **期望值一律现查，不许写死会随数据变的常数**。库里的行数、聚合值都从 `dbQuery` 拿，
 *    页面上读到的跟它比。数据变了（用户又录了几单）测试**不该红**。
 *
 * ★ **写隔离（2026-09-21 加的，取代「只许改别的 spec 不读的字段」那条约定）**：
 *   每个用例开始前，工作库从只读母本 `TEMPLATE` 重建 ⇒ **上一条用例的写全被抹掉**。
 *   ⇒ 你**不再需要**挑字段躲着别的 spec 写，「创建 / 修改 / 删除」这类流程可以放心测。
 *   代价实测 0.363s/用例（与库体积无关）。细节见 §3.5。
 */
import { expect, test as base, type Page, type Request } from '@playwright/test'
import { spawnSync } from 'node:child_process'

// ── 路径与文案（全部实测过的字面量，别改成「看起来更对」的写法）──────────────────
export const LOGIN_PATH = '/login'
export const HOME_PATH = '/'
export const PROGRESS_PATH = '/progress'
/** 令牌落在哪个 localStorage 键（`app/src/api/client.ts` 的 `TOKEN_KEY`）。 */
export const TOKEN_KEY = 'smartdoor_token'
export const LOGIN_USER_PLACEHOLDER = '请输入用户名'
export const LOGIN_PW_PLACEHOLDER = '请输入密码'
export const LOGIN_BUTTON_TEXT = '登录'

/**
 * 用户正在用的 dev 后端端口。**任何请求落到它就判红。**
 * 那是用户真在用的后端，连的是他真在用的开发库 —— 测试的写操作落到那儿就是事故。
 *
 * ⚠️ 值**由装置喂进来**（`scripts/e2e.mjs` 的 `E2E_FORBIDDEN_PORT`）：这里再写死一份的话，
 *    哪天端口变了、只改了一边，守卫就会「盯着一个没人用的端口」而**静默失效**。
 *    默认值只是「不在装置里跑单条 spec」时的兜底。
 */
// ⚠️ 取默认值的写法与装置那边**逐字一致**（`Number(...) || 3000`，不用 `??`）：
//    `E2E_FORBIDDEN_PORT=""` 或写错成非数字时，`??` 会放行 `0` / `NaN` ⇒ 守卫**静默盯错端口**。
export const FORBIDDEN_PORT = Number(process.env.E2E_FORBIDDEN_PORT) || 3000

// ── 装置喂进来的环境变量（都有默认值，默认值 = 装置的默认值）────────────────────
const DB_CONTAINER = process.env.E2E_DB_CONTAINER ?? 'smartdoor-db'
const DB_USER = process.env.E2E_DB_USER ?? 'smartdoor'
/**
 * 默认库名**故意**是 `smartdoor_e2e`（装置建的一次性库），**绝不是**开发库 `smartdoor`
 * —— 这几个工具只读库，但也不能把默认值指到用户的库上。
 */
const DB_NAME = process.env.E2E_DB_NAME ?? 'smartdoor_e2e'
/**
 * **只读母本**（`scripts/e2e.mjs` 建的一次性库）：工作库每个用例前从它 `TEMPLATE` 重建。
 * 同样由装置喂进来，理由与 `FORBIDDEN_PORT` 一样 —— 两边各写一份，改漏一处就静默指错库。
 */
const SEED_DB = process.env.E2E_SEED_DB ?? 'smartdoor_e2e_seed'
// 防御性再查一次（装置那边已有三条守卫）：母本等于工作库的话，「重建」就是自己拷自己，
// 重置**静默失效**、测试之间又开始互相看见写入 —— 那种绿是最坏的一种。
if (SEED_DB === DB_NAME) {
  throw new Error(`E2E_SEED_DB 不能等于 E2E_DB_NAME（都是 ${DB_NAME}）—— 重置会静默失效`)
}
export const ADMIN_USER = process.env.E2E_ADMIN_USER ?? 'admin'
export const ADMIN_PW = process.env.E2E_ADMIN_PW ?? 'Admin@12345'

// ── 1. 零容忍闸 + :3000 守卫 ────────────────────────────────────────────────
/**
 * **默认**就放行的 `console.error`（在下面 `allowConsoleError` 之前生效）。
 *
 * 目前只有一条：浏览器自己会去要 `/favicon.ico`（`index.html` 里没写 `<link rel=icon>`），
 * 这个仓里没有那个文件 ⇒ **每个页面**都来一条 404 噪音。它是浏览器发的，与被测代码无关。
 * ⚠️ 别把这一条当先例 —— 真要放行别的（如打印链路的 `localhost:17521` WebSocket 报错），
 *    必须在**那一份 spec** 里显式传 `allowConsoleError`，并写明理由。
 */
const DEFAULT_ALLOWED: RegExp[] = [/favicon\.ico/]

export interface GuardOptions {
  /**
   * 在默认白名单之外**额外**放行的 `console.error`（正则，对 `"文本 @ url:行号"` 整串测
   * —— 所以规则可以锚在**哪个 URL** 上，而不只是文案）。
   *
   * 唯一已知需要额外放行的是打印链路的 `localhost:17521` WebSocket 报错
   * （hiprint 的默认 host，重试 5 次）—— 只有真去点「打印预览」的 spec 才用得上。
   */
  allowConsoleError?: RegExp[]
}

export interface GuardHandle {
  /** 断言本次测试期间：零 `pageerror`、零（未被放行的）`console.error`、零 `:3000` 请求。 */
  assertClean(): void
  /** 原始收集（给「到底报了什么」用的，别拿它当断言）。 */
  readonly collected: { pageErrors: string[]; consoleErrors: string[]; forbiddenRequests: string[] }
}

/**
 * 给一个 page 挂上那三道闸。**故意不 export** —— 挂闸只有一条路：文件末尾那个 auto fixture。
 * （留两条路 = 新 spec 作者可能选错那条「忘了挂 / 只在最后一行审」的路，而那种错是**静默**的。）
 */
function attachGuards(page: Page, options: GuardOptions = {}): GuardHandle {
  const allow = [...DEFAULT_ALLOWED, ...(options.allowConsoleError ?? [])]
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const forbiddenRequests: string[] = []

  // 未捕获异常 —— 一律红，没有白名单。
  page.on('pageerror', (err) => {
    pageErrors.push(err.stack ?? String(err))
  })

  // console.error —— 默认红，按文本放行。
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    const loc = msg.location()
    const entry = loc?.url ? `${text}  @ ${loc.url}:${loc.lineNumber}` : text
    if (allow.some((re) => re.test(entry))) return
    consoleErrors.push(entry)
  })

  // ★ `:3000` 守卫 —— 防的是「配置写错 ⇒ 偷偷打到用户的 dev 后端 / 开发库」。
  //   装置那边还有一道更硬的锁（起 vite 前用 vite 自己的 resolveConfig 解析代理目标），
  //   这一道管的是「代码里写死了绝对地址」这类漏网。
  page.on('request', (req) => {
    let url: URL
    try {
      url = new URL(req.url())
    } catch {
      return // about:blank / data: 之类
    }
    if (url.port === String(FORBIDDEN_PORT)) forbiddenRequests.push(`${req.method()} ${req.url()}`)
  })

  return {
    collected: { pageErrors, consoleErrors, forbiddenRequests },
    assertClean() {
      const lines: string[] = []
      if (pageErrors.length) lines.push(`未捕获异常 ${pageErrors.length} 条：`, ...pageErrors.map(indent))
      if (consoleErrors.length) lines.push(`console.error ${consoleErrors.length} 条：`, ...consoleErrors.map(indent))
      if (forbiddenRequests.length) {
        lines.push(
          `有 ${forbiddenRequests.length} 个请求打到 :${FORBIDDEN_PORT}（用户正在用的 dev 后端）：`,
          ...forbiddenRequests.map(indent),
          '  这一条是**硬红线**：说明配置指错了，测试正在写用户的开发库。',
        )
      }
      if (lines.length) throw new Error(`\n${lines.join('\n')}\n`)
    },
  }
}

const indent = (s: string) => `  · ${s.split('\n').join('\n    ')}`

// ── 2. 登录辅助（走真表单）──────────────────────────────────────────────────
/** `settleApi` 判「安静」的窗口：这么久没有再动，才算落定。 */
const SETTLE_QUIET_MS = 300

/**
 * 等**应用安静下来**：没有在飞的 `/api/` 请求，且已有一小段时间没再发新的。
 *
 * ── 为什么 `login()` 必须等这一步（★ 这不是「顺手加个等待」）────────────────────
 * 登录后落地页在 `onMounted` 里还会补一次 `/me`（`Home.vue:543`）。原先 `login()` 是
 * **URL 一变就返回** —— 那次 `/me` **还在飞**。spec 紧接着的 `page.goto(...)` 是**整文档导航**，
 * 会把在飞的 fetch 掐掉 ⇒ `stores/auth.ts` 的 `loadMe()` 走进它的 `catch { this.clear() }`，
 * **令牌被抹**（`localStorage.removeItem`，同源共享）⇒ 下一个文档读到 `token === null`，
 * 路由守卫把 `/login` 弹回来。实测三档对照：不等待必红；`login()` 后等 1 秒必绿；
 * 把写隔离的重置夹具停掉也必绿（重置让冷下来的连接池把 `/me` 拖慢，把这个窗口撑开）。
 *
 * 所以这**不是**「页面错了」，是**这个辅助函数返回得太早**。断言必须诚实地测应用，
 * 不能靠在 spec 里垫一次耗时操作、赌它「恰好够快」—— 那种绿是掷骰子掷出来的。
 *
 * ── 为什么不干脆等某一次具体的 `/me` ─────────────────────────────────────────
 * 那等于把「落地页一定会补 `/me`」写死进辅助函数：非 admin/scanner 的落地页（`landingRouteName`）
 * 不发 `/me` 时，等待会挂到超时。等「网络安静」跟落地页是哪个页面无关。
 *
 * ── 为什么不用 `waitForLoadState('networkidle')` ──────────────────────────────
 * 那个 lifecycle 事件**每个文档只发一次**，而这里文档早就 load 完了（SPA 换路由）
 * ⇒ 调用会立刻返回，等于没等。
 *
 * 超时不静默：真的一直不安静就抛，别让「没等到」被当成「等到了」。
 */
async function settleApi(page: Page, timeoutMs = 20_000): Promise<void> {
  let last = Date.now()
  // ⚠️ 这里的 `Request` 是 **Playwright 的**（上面 `type` 引进来的），不是 DOM 那个同名的。
  //    两者**形状不同**：Playwright 的 `url` 是**方法** `r.url()`，DOM 的 `url` 是**字符串属性**。
  //    不引这一个的话，TS 会解析到 `lib: DOM` 里那个全局 `Request` ⇒ 下面 `r.url()` 报
  //    「This expression is not callable」、`page.on('request', …)` 报重载不匹配。
  //    而**这套 spec 根本不过 `vue-tsc`**（`app/tsconfig.json` 的 include 只有 `src/**` 与
  //    `vite.config.ts`）⇒ 那个错**没有任何闸看得见**，运行期还照样对（真实回调收到的就是
  //    Playwright 的 Request）。2026-09-21 拿一个临时 tsconfig 把它引进来才量出来（7 处）。
  const inflight = new Set<Request>()
  const isApi = (r: Request) => r.url().includes('/api/')
  // 请求**开始**也要算活动：只看响应的话，「刚发出去、还没回来」会被误判成安静。
  const onStart = (r: Request) => { if (isApi(r)) { inflight.add(r); last = Date.now() } }
  const onEnd = (r: Request) => { if (isApi(r)) { inflight.delete(r); last = Date.now() } }

  page.on('request', onStart)
  page.on('requestfinished', onEnd)
  page.on('requestfailed', onEnd)
  try {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (inflight.size === 0 && Date.now() - last >= SETTLE_QUIET_MS) return
      await page.waitForTimeout(50)
    }
    throw new Error(
      `等应用安静超时（${timeoutMs}ms）：仍有 ${inflight.size} 个 /api/ 请求在飞 —— ` +
        `本次结果不可信，别把「没等到」当成「等到了」。`,
    )
  } finally {
    page.off('request', onStart)
    page.off('requestfinished', onEnd)
    page.off('requestfailed', onEnd)
  }
}

/**
 * 走**真表单**登录：填 placeholder、点「登录」，等路由离开 `/login`，**再等应用落定**。
 * 已经登录过（localStorage 里有令牌）就直接返回 —— 守卫会把 `/login` 弹走，这里等不到表单。
 *
 * ★ 两条路径都要 `settleApi`：前者是落地页 `onMounted` 补的那次 `/me`，后者是守卫补的那次，
 *   一样是「在飞的请求」，一样会被调用方下一次 `goto` 掐掉。
 *
 * 返回值是**落地的 URL**（admin 是 `/`）。**不断言落地页**：不同角色的落地页不同，
 * 由调用方自己断言它关心的页面。
 */
export async function login(page: Page, opts: { user?: string; pw?: string } = {}): Promise<string> {
  await page.goto(LOGIN_PATH)
  // 有登录态的话，路由守卫会把 /login 弹到落地页 ⇒ 这里已经不是 /login 了。
  if (!new URL(page.url()).pathname.startsWith(LOGIN_PATH)) {
    await settleApi(page)
    return page.url()
  }

  await page.getByPlaceholder(LOGIN_USER_PLACEHOLDER).fill(opts.user ?? ADMIN_USER)
  await page.getByPlaceholder(LOGIN_PW_PLACEHOLDER).fill(opts.pw ?? ADMIN_PW)
  await page.getByRole('button', { name: LOGIN_BUTTON_TEXT }).click()
  await page.waitForURL((u) => !u.pathname.startsWith(LOGIN_PATH), { timeout: 20_000 })
  await settleApi(page)
  return page.url()
}

// ── 3. 现查克隆库 ───────────────────────────────────────────────────────────
/** 单引号字面量转义（值只来自本文件的环境变量，不是用户输入；够用了）。 */
function sqlLit(v: string): string {
  return v.replace(/'/g, "''")
}

// ── 3.5 ★ 写隔离：每个用例开始前，把工作库重置回干净克隆态 ──────────────────────
/**
 * 掐掉工作库上的连接 → DROP → **从只读母本 `TEMPLATE` 重建**。
 *
 * ── 为什么要有它 ────────────────────────────────────────────────────────────
 * 老办法是靠人工挑字段躲开冲突（「只许改别的 spec 不读的列」），那条路自己写着
 * 「今天的安全是「选得好」，**不是「被保证的**」。而且它**根本盖不住创建/删除** ——
 * 「删一行」没有哪个字段是「别的 spec 不读的」。有了重置，写流程才**能测**。
 *
 * ── 为什么是「每个用例」而不是「每个文件」──────────────────────────────────
 * 每条用例自动生效（auto fixture），**新 spec 作者没有选错路的机会**。
 * 这与本文件给三道闸用 auto fixture 是同一条理由：留一条「记得手动调」的路，
 * 就会有人忘，而忘了是**静默**的。
 *
 * ── 为什么不用重启后端 ──────────────────────────────────────────────────────
 * 实测（2026-09-21）：掐连接后 SQLx 池**自己活过来** —— health 200、重新登录拿到令牌、
 * `GET /clients` 200，后端日志 error+panic **零行**。所以只重置库，不碰进程。
 *
 * ── 成本 ────────────────────────────────────────────────────────────────────
 * `CREATE DATABASE … TEMPLATE` 实测 **0.098s**、整轮 **0.363s**，且**与库体积无关**
 * （TEMPLATE 是文件级拷贝）。开发库现在 10 MB，长大十倍也不会变慢。
 *
 * ⚠️ 它会**真的删库**。库名只从环境变量来，且上面查过 `SEED_DB !== DB_NAME` ——
 *    这两个名字是装置建的一次性库，**不是**开发库。
 */
export function resetWorkDb(): void {
  const on = (db: string, sql: string): string => {
    const r = spawnSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', db, '-tAc', sql], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    if (r.error) throw new Error(`重置工作库时跑 psql 失败：${r.error.message}`)
    if (r.status !== 0) {
      throw new Error(
        `重置工作库失败（库 ${DB_NAME} / 母本 ${SEED_DB} / 容器 ${DB_CONTAINER}）：${(r.stderr || '').trim()}\n` +
          `  **本次结果不可信** —— 重置没成功，上一条用例的写还在库里。`,
      )
    }
    return (r.stdout ?? '').trim()
  }

  // 1. 掐掉后端池持有的连接 —— 不掐的话 DROP 会被「有连接在用」挡回来。
  //    （`WITH (FORCE)` 自己也会断连接，但这一条是**实测过的那条路**，别省。）
  on(
    'postgres',
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity ` +
      `WHERE datname = '${sqlLit(DB_NAME)}' AND pid <> pg_backend_pid()`,
  )
  // 2/3. 重建。母本全程没有任何连接 ⇒ 它永远能当 TEMPLATE。
  on('postgres', `DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`)
  on('postgres', `CREATE DATABASE "${DB_NAME}" TEMPLATE "${SEED_DB}"`)
}

/**
 * 在**装置建的一次性克隆库**上跑一条 SQL，返回 `psql -tAc` 的原始输出（trim 过）。
 * 连的是 `docker exec <容器> psql`，与 `scripts/verify.mjs` 同一个手法。
 */
export function dbQuery(sql: string): string {
  const r = spawnSync(
    'docker',
    ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tAc', sql],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  if (r.error) throw new Error(`跑 psql 失败：${r.error.message}`)
  if (r.status !== 0) {
    throw new Error(
      `查库失败（库 ${DB_NAME} / 容器 ${DB_CONTAINER}）：${(r.stderr || '').trim()}\n` +
        `  这套 spec 必须由 \`npm run e2e\` 起 —— 它会建 ${DB_NAME} 并把这些名字喂进来。`,
    )
  }
  return (r.stdout ?? '').trim()
}

/** `dbQuery` 的数字版（空结果按 0）。 */
export function dbNumber(sql: string): number {
  const raw = dbQuery(sql)
  return raw === '' ? 0 : Number(raw)
}

/** 登录用的那个管理员的租户 id（**现查**，不写死 1）。 */
export function adminTenantId(): number {
  return dbNumber(`select tenant_id from users where username = '${sqlLit(ADMIN_USER)}' order by id limit 1`)
}

/**
 * `/api/v1/progress` 会返回多少行 —— 也就是**页面表格该渲染多少条数据行**。
 *
 * 口径照后端 `orders::service::list_with_lines_filtered`（不筛选时 = `list_with_lines`）：
 * 取本租户的**全部订单**，再取这些订单的**全部明细行** ⇒ 就是下面这条 join。
 * 不是 `count(*) from order_lines` 那么简单（那会把别的租户的行也算进来）。
 */
export function progressLineCount(tenantId: number = adminTenantId()): number {
  return dbNumber(
    `select count(*) from order_lines l join orders o on o.id = l.order_id ` +
      `where l.tenant_id = ${tenantId} and o.tenant_id = ${tenantId}`,
  )
}

// ── 4. `test` / `expect`：三道闸走 **auto fixture**（结构性生效，不靠自觉）──────────
/**
 * spec **一律从这里 import** `test` / `expect`，不要从 `@playwright/test` import ——
 * 那样三道闸不会挂上，而且是**静默**的（没有任何东西会提醒你）。
 *
 * 为什么用 auto fixture 而不是「每条测试自己调 `attachGuards`」：
 *   ① 新 spec 忘了调 ⇒ 三道闸静默消失；
 *   ② 判定原本写在测试体**最后一行**，测试体中途失败 ⇒ 那一轮的 `:3000` / console 情况
 *      **无人审计**。放进 fixture 的 teardown 之后，无论测试体怎么挂，判定都会跑。
 */
export interface E2EFixtures {
  /**
   * 在默认白名单（`DEFAULT_ALLOWED`）之外**额外**放行的 `console.error`（正则）。
   * 打印类 spec 用 `test.use({ allowedConsole: [/17521/] })` 覆盖。
   */
  allowedConsole: RegExp[]
  /** 三道闸的句柄。测试体一般**不用管它**；要在中途看一眼 `guards.collected` 才用得上。 */
  guards: GuardHandle
  /** **内部件，别用**：写隔离的重置。它的存在只为了让 Playwright 跑它（`{auto:true}`）。 */
  dbReset: void
}

export const test = base.extend<E2EFixtures>({
  allowedConsole: [[], { option: true }],
  // ★ 写隔离。**必须声明在 `guards` 之前** —— auto fixture 按**声明序**跑，
  //   重置要先于任何页面动作发生（`guards` 会挂 page 监听，但页面请求是在测试体里才发的，
  //   所以真实约束只有一条：重置要在**测试体开始之前**跑完，声明序保证了这点）。
  dbReset: [
    async ({}, use) => {
      resetWorkDb()
      await use()
    },
    { auto: true },
  ],
  guards: [
    async ({ page, allowedConsole }, use) => {
      const handle = attachGuards(page, { allowConsoleError: allowedConsole })
      await use(handle)
      // teardown：断言本次测试期间零 pageerror / 零（未放行的）console.error / 零 :3000 请求。
      handle.assertClean()
    },
    { auto: true },
  ],
})

export { expect }
