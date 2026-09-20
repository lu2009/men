/**
 * E2E 共享件 —— **只有这一份**，`*.spec.ts` 一律 import 这里，不许抄第二份。
 *
 * 装它的装置是 `scripts/e2e.mjs`（`npm run e2e`）：它建一次性库、起后端与 vite，
 * 再把这些东西通过环境变量喂进来。**这套 spec 必须整装置跑** —— 它们不只是「点点看」，
 * 每一条断言都要**现查克隆库**跟页面对账（差分台的精神：左边数据库、右边页面，逐字段比）。
 *
 * 三件东西：
 *   1. `attachGuards(page)` —— `pageerror` / `console.error` 零容忍 + **`:3000` 请求守卫**；
 *   2. `login(page)` —— 走**真表单**登录（不是塞 token）；
 *   3. `dbQuery` / `progressLineCount` / `adminTenantId` —— **现查克隆库**的小工具。
 *
 * ⚠️ **期望值一律现查，不许写死会随数据变的常数**。库里的行数、聚合值都从 `dbQuery` 拿，
 *    页面上读到的跟它比。数据变了（用户又录了几单）测试**不该红**。
 * ⚠️ 每条断言在**它自己这条测试开始时**现查 —— 不依赖 spec 之间的执行顺序：
 *    `progress.spec` 会删行、`home.spec` 会改单元格，`mount.spec` 要数行。
 */
import { type Page } from '@playwright/test'
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
 */
export const FORBIDDEN_PORT = 3000

// ── 装置喂进来的环境变量（都有默认值，默认值 = 装置的默认值）────────────────────
const DB_CONTAINER = process.env.E2E_DB_CONTAINER ?? 'smartdoor-db'
const DB_USER = process.env.E2E_DB_USER ?? 'smartdoor'
/**
 * 默认库名**故意**是 `smartdoor_e2e`（装置建的一次性库），**绝不是**开发库 `smartdoor`
 * —— 这几个工具只读库，但也不能把默认值指到用户的库上。
 */
const DB_NAME = process.env.E2E_DB_NAME ?? 'smartdoor_e2e'
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
 * 给一个 page 挂上那三道闸。**每条测试都要挂**（第一个动作之前挂，否则会漏掉早报的错）。
 *
 * `assertClean()` 放在**测试体最后**：中途失败就不必再报噪声了。
 */
export function attachGuards(page: Page, options: GuardOptions = {}): GuardHandle {
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
/**
 * 走**真表单**登录：填 placeholder、点「登录」，然后等路由离开 `/login`。
 * 已经登录过（localStorage 里有令牌）就直接返回 —— 守卫会把 `/login` 弹走，这里等不到表单。
 *
 * 返回值是落地的 URL（admin 是 `/`）。**不断言落地页**：不同角色的落地页不同，
 * 由调用方自己断言它关心的页面。
 */
export async function login(page: Page, opts: { user?: string; pw?: string } = {}): Promise<void> {
  await page.goto(LOGIN_PATH)
  // 有登录态的话，路由守卫会把 /login 弹到落地页 ⇒ 这里已经不是 /login 了。
  if (!new URL(page.url()).pathname.startsWith(LOGIN_PATH)) return

  await page.getByPlaceholder(LOGIN_USER_PLACEHOLDER).fill(opts.user ?? ADMIN_USER)
  await page.getByPlaceholder(LOGIN_PW_PLACEHOLDER).fill(opts.pw ?? ADMIN_PW)
  await page.getByRole('button', { name: LOGIN_BUTTON_TEXT }).click()
  await page.waitForURL((u) => !u.pathname.startsWith(LOGIN_PATH), { timeout: 20_000 })
}

// ── 3. 现查克隆库 ───────────────────────────────────────────────────────────
/** 单引号字面量转义（值只来自本文件的环境变量，不是用户输入；够用了）。 */
function sqlLit(v: string): string {
  return v.replace(/'/g, "''")
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
