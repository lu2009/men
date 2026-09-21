/**
 * 「路由与登录状态」—— 未登录会被弹走、真表单能登进来、刷新之后令牌还在。
 *
 * 为什么这四条值得占一个 spec：
 *   · 它们是**后面所有 spec 的地基**（登录/路由一旦坏，别的红得看不懂）；
 *   · 「刷新后仍是 Progress」这条盖的是**持久化**那一环（令牌在 `localStorage`，
 *     刷新后由路由守卫补 `/me` 再判角色）—— 单测与类型闸都碰不到这一段；
 *   · 最后一条盖的是**「请求没拿到响应」与「令牌失效」被混为一谈**那个坑（见那条的注释）。
 *
 * ⚠️ 凭据从环境变量读，默认值是 `scripts/verify.mjs:71-72` 里已有的开发缺省值
 *    （**不是**生产凭据，也**不引入新口令**）。
 * ⚠️ `test` / `expect` 从 `./lib/setup` import —— 三道闸（pageerror / console.error / `:3000`）
 *    挂在那里面的 auto fixture 上，测试体里**不用**（也**不要**）再手工挂一次。
 */
import {
  expect,
  HOME_PATH,
  LOGIN_BUTTON_TEXT,
  LOGIN_PATH,
  LOGIN_PW_PLACEHOLDER,
  LOGIN_USER_PLACEHOLDER,
  login,
  PROGRESS_PATH,
  test,
  TOKEN_KEY,
} from './lib/setup'

test.describe('路由与登录状态', () => {
  test('未登录直敲 /progress ⇒ 落到 /login 且带上 redirect；Progress 一点没渲染', async ({ page }) => {
    await page.goto(PROGRESS_PATH)

    await page.waitForURL((u) => u.pathname === LOGIN_PATH)
    expect(
      new URL(page.url()).searchParams.get('redirect'),
      '登录后要弹回原来那一页，redirect 得带上',
    ).toBe(PROGRESS_PATH)

    // 登录表单在场（三个元素都是实测过的定位方式：placeholder → role）
    await expect(page.getByPlaceholder(LOGIN_USER_PLACEHOLDER)).toBeVisible()
    await expect(page.getByPlaceholder(LOGIN_PW_PLACEHOLDER)).toBeVisible()
    await expect(page.getByRole('button', { name: LOGIN_BUTTON_TEXT })).toBeVisible()

    // 是被**挡在门外**，不是「渲染了再跳走」：Progress 的工具条那颗按钮一个都不该在。
    await expect(page.getByRole('button', { name: '打印选项' })).toHaveCount(0)
    await expect(page.locator('.n-data-table')).toHaveCount(0)
  })

  test('走真表单登录 ⇒ 落到 /，AppHeader 与 .home-container 在场', async ({ page }) => {
    // `login()` 自己会等到「离开 /login」，它返回的落地 URL 再跟页面当前 URL 对一次。
    const landed = await login(page)

    expect(new URL(page.url()).pathname).toBe(HOME_PATH)
    expect(new URL(landed).pathname).toBe(HOME_PATH)
    await expect(page.locator('.app-header')).toBeVisible()
    await expect(page.locator('.home-container')).toBeVisible()
    // 令牌是真写进 localStorage 的（不是只在内存里）—— 刷新那一条全靠它。
    expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBeTruthy()
  })

  test('登录后刷新 /progress ⇒ 仍是 Progress（令牌从 localStorage 恢复）', async ({ page }) => {
    await login(page)
    const tokenBefore = await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)

    await page.goto(PROGRESS_PATH)
    // `.page` 好几个页面都用（Home/Hui/…），所以另点一颗**只有这一页有**的按钮钉住身份。
    await expect(page.getByRole('button', { name: '打印选项' })).toBeVisible()

    await page.reload()

    // 刷新之后没有被弹回 /login，而且页面**真渲染出来了**（不是空壳）。
    await page.waitForURL((u) => u.pathname === PROGRESS_PATH)
    await expect(page.getByRole('button', { name: '打印选项' })).toBeVisible()
    await expect(page.locator('.n-data-table')).toBeVisible()
    expect(await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)).toBe(tokenBefore)
  })

  test('那次 /me 还在飞的时候刷新 ⇒ 不掉线（「没拿到响应」≠「令牌失效」）', async ({ page }) => {
    await login(page)

    // ★ 把 `/me` 按住，让「在飞」这个状态**必然**出现。
    //   不按的话，「刷新时它是否还在飞」取决于后端快慢 —— 快了这条就**空转通过**
    //   （0 证据力却长得跟真绿一样）。按住它，窗口就是确定的。
    //   这不是 mock 响应：请求照样发到真后端、拿真响应，我们只改**它什么时候回来**。
    const HOLD_MS = 1000
    await page.route('**/api/v1/auth/me', async (route) => {
      await new Promise((r) => setTimeout(r, HOLD_MS))
      // 被下面那次刷新掐掉的请求，在这里 continue 会抛 —— **那正是预期的**（按住它就是为了让它被掐）。
      await route.continue().catch(() => {})
    })

    // 整文档导航 ⇒ 路由守卫补的那次 `/me` 被按住；**不等它**，等它一开始就再导航一次把它掐掉。
    const meStarted = page.waitForRequest((r) => r.url().includes('/api/v1/auth/me'))
    await page.goto(HOME_PATH)
    await meStarted
    await page.reload()

    // 修复前：被掐掉的 fetch ⇒ `loadMe` 的 catch ⇒ `clear()` ⇒ 令牌从 localStorage 抹掉
    //        ⇒ 新文档读到 token=null ⇒ 守卫弹 /login ⇒ `.home-container` 永远不出现。
    // 刷新后 URL 本来就是 `/`，所以**不能拿 URL 当断言**（那会恒绿地空转）——
    // 要等的是「Home 真的渲染出来了」，它只有没被弹走才可能出现。
    await expect(page.locator('.home-container')).toBeVisible()
    expect(
      await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY),
      '刷新把令牌弄没了 —— 说明「请求被中止」又被当成「令牌失效」了',
    ).toBeTruthy()

    await page.unroute('**/api/v1/auth/me')
  })
})
