/**
 * **写隔离的看门人** —— 证明「每条用例开始前库被重置回干净克隆态」真的在生效。
 *
 * ── 为什么需要一条专门证明「隔离生效」的 spec ──────────────────────────────────
 * 重置一旦失效，**不会有人报错** —— 症状是「测试之间互相看见对方的写入」，
 * 表现成**偶发的、顺序相关的红**，而那种红最容易被当成「flaky」重跑掉。
 * 更坏的一种：如果重置「什么也没做」而断言恰好还是绿的，你就得到一条**在假装隔离**的套件。
 * 所以这条 spec 把隔离本身当成被测对象：**它红了 = 整套结果都不可信**。
 *
 * ── 为什么是两条用例、不是一条（★ 别把它改成一条）────────────────────────────
 * 只在一条用例里「写一笔、断言它不在」是**空转** —— 写失败也是「不在」，照样绿。
 * 拆成两条才有证据力：
 *   ① 第一条**证明写真的发生了**（写完立刻查库，查得到）；
 *   ② 第二条**证明它已经不在了**（同一个名字，查不到）。
 * ① 和 ② 合起来才排除了「写根本没成功」这个替代解释。
 * `mode: 'serial'` 是必需的：第一条挂了要**跳过**第二条 —— 否则第二条会**空转通过**，
 * 而空转通过看起来跟「隔离正常」一模一样。
 *
 * ── 写的是谁 ────────────────────────────────────────────────────────────────
 * 用 `request` fixture 打**真接口**（经 vite 代理 → 本次后端 → 工作库），
 * 不是直接写 SQL —— 直接写 SQL 只证明「DROP 能删数据」，证明不了「应用写进去的会被抹掉」。
 */
import { dbQuery, expect, login, test, TOKEN_KEY } from './lib/setup'

/**
 * 探针客户名。`Date.now()` 后缀是为了**绝不与克隆库既有数据撞名** ——
 * 撞了的话第一条就会查到别人的行，绿得毫无意义。
 * 模块级常量：同一文件的两条用例看到的是**同一个**名字。
 */
const MARK = `__isolation_probe_${Date.now()}`

test.describe.configure({ mode: 'serial' })

test.describe('写隔离', () => {
  test('① 写一笔客户，并证明它真的落库了', async ({ page, request }) => {
    await login(page)
    // 令牌从页面里取（走的是真登录），不自己造。
    const token = await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY)
    expect(token, '登录后 localStorage 里应该有令牌').toBeTruthy()

    const res = await request.post('/api/v1/clients', {
      headers: { authorization: `Bearer ${token}` },
      data: { name: MARK, phone: '', address: '', remark: '' },
    })
    expect(res.status(), `建客户应该 200，收到 ${res.status()}`).toBe(200)

    // ★ 这条是**整份文件的关键**：证明写**真的发生了**。
    //   少了它，下面那条「它不在了」就排不掉「写压根没成功」这个解释 —— 那是空转。
    expect(dbQuery(`select count(*) from clients where name = '${MARK}'`)).toBe('1')
  })

  test('② 上一笔写在本条已经不见了（重置生效）', async ({ page }) => {
    await login(page)
    expect(
      dbQuery(`select count(*) from clients where name = '${MARK}'`),
      '上一条用例建的客户还在库里 ⇒ **重置没生效** ⇒ 本次运行的所有结果都不可信',
    ).toBe('0')
  })
})
