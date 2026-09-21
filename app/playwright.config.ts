import { defineConfig } from '@playwright/test'

/**
 * 真浏览器 E2E 的 Playwright 配置。
 *
 * ── 用**系统 Chrome**（`channel: 'chrome'`）⇒ **不需要** `npx playwright install` ──────
 * 那个命令要下几百 MB 的浏览器二进制，本仓库**故意没下**（`@playwright/test@1.63` 已装在
 * `app/package.json` 的 devDeps 里）。要换别的浏览器时再自己下。
 *
 * ── 为什么没有 `webServer` ─────────────────────────────────────────────────────────
 * 这一整套要管的不止一个前端：**一次性库**（克隆 → 收尾删除）、**后端**（自己的端口、
 * 指向那个库）、**vite**（自己的端口、代理指向那个后端）。Playwright 的 `webServer`
 * 只管得起一个进程。所以都由装置 `scripts/e2e.mjs` 起停（`npm run e2e`），本文件只管
 * 「跑哪些 spec、怎么跑」。
 *
 * ── `workers: 1` 是硬要求，别改 ────────────────────────────────────────────────────
 * 装置只起**一个**后端、**一个** vite（端口写死 3101 / 5273），并行 worker 会互相抢。
 * 至于**写与写之间的隔离**：那**不归这条管** —— 靠 `lib/setup.ts` 的 auto fixture
 * 在**每个用例开始前**把工作库从只读母本重置回干净克隆态（实测 0.363s/次）。
 * 所以 spec 里有写操作是**允许的**，不必躲着别的 spec 挑字段。
 *
 * ── `baseURL` 从环境变量读 ────────────────────────────────────────────────────────
 * 装置给 `E2E_BASE_URL`；默认值 `http://127.0.0.1:5273` 是装置的默认端口（**不是** :5173，
 * 更不是 :3000 —— 那两个是用户正在用的 dev 前后端）。直接 `npx playwright test` 而没起
 * 装置的话，连不上是对的：这套 spec 必须整装置跑（它们还要**现查克隆库**对账）。
 */
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5273',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
