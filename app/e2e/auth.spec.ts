/**
 * 「路由与登录状态」—— 未登录会被弹走、真表单能登进来、刷新之后令牌还在。
 *
 * 为什么这三条值得占一个 spec：
 *   · 它们是**后面所有 spec 的地基**（登录/路由一旦坏，别的红得看不懂）；
 *   · 「刷新后仍是 Progress」这条盖的是**持久化**那一环（令牌在 `localStorage`，
 *     刷新后由路由守卫补 `/me` 再判角色）—— 单测与类型闸都碰不到这一段。
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
})
