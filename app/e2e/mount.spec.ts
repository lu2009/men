/**
 * 「页面真挂载」+ **拆分的响应式连接**（本套 E2E 的核心价值）。
 *
 * ── 这一条盖的是哪个盲区 ─────────────────────────────────────────────────────
 * `vue-tsc` / `npm run build` / 搬迁守卫对**「模板绑定漏解构 ⇒ 三闸全绿但页面空白」**
 * 集体失明（见记忆 `split-guard-blind-spots` 第 3 类）。所以这里的断言不是「元素在不在」，
 * 而是**页面上真渲染出来的东西**与**克隆库里真有的东西**逐项对账（差分台精神：左库右页）。
 * 页面一空，行数就是 0，立刻红。
 *
 * ── 为什么期望值全是现查的 ───────────────────────────────────────────────────
 * 数据是**开发库的克隆**，会随用户真实录入而变 —— 写死「37」这种数，数据一变就假红。
 * 所以：`select` 出库里的值 → 跟页面上读到的比。数据变了测试**不该红**。
 * 而且每条断言都在**本测试开始时**现查（`progress.spec` 会删行、`home.spec` 会改单元格，
 * 不许依赖 spec 之间的执行顺序）。
 *
 * ── ⚠️ 没写的断言（别以为是漏了）─────────────────────────────────────────────
 * `.total-info` 里的「移门扇数 / 平开门扇数 / 其它」三个数**故意没写**：它们的口径依赖
 * 前端那两张**字面量表**（`MOVE_FAN_NAMES` 22 项「每樘几扇」、`PING_*_DIRECTIONS` 14 项开向）。
 * 把那些字面量抄进 SQL 就等于**同一批字面量写第三份**（`Progress.vue` 自己已经写了两份，
 * 靠 `docs/progress-toolbar-logiccheck.mjs` 的自检钉住）—— 正是本项目明确禁止的做法。
 * 「淋浴房扇数」当前也**没有证据力**：这份数据里那个值是 **0**，0 对 0 是空转（断言留着，
 * 等库里真出现淋浴房才有意义）。
 */
import { expect, test } from '@playwright/test'
import {
  adminTenantId,
  attachGuards,
  dbNumber,
  dbQuery,
  HOME_PATH,
  login,
  PROGRESS_PATH,
  progressLineCount,
} from './lib/setup'

/**
 * Progress 表格**首屏每页 100 条**（`Progress.vue` 的 `pageSize = ref(100)`，可选 [10..200]）。
 * 库里行数超过一页时，首屏只渲染得下前 100 行 ⇒ 断言退化成
 * 「渲染行数 == min(库行数, 100)」。**它不是数据常数**（数据怎么变都不会假红），
 * 而「页面空白」时渲染行数恒为 0 ⇒ 照样红。`.total-info` 的「总计」那一条没有这个问题。
 */
const FIRST_PAGE_SIZE = 100

/** 从 `.total-info` 里抠一个 `标签: 数字`。找不到就**立刻失败**（别让 `NaN` 蒙混过去）。 */
function numAfter(text: string, label: string): number {
  const m = text.match(new RegExp(`${label}\\s*:\\s*(-?\\d+)`))
  expect(m, `.total-info 里没找到「${label}:」—— 实际文本：${JSON.stringify(text)}`).not.toBeNull()
  return Number(m![1])
}

// ── 下面两条 SQL 是**照 `Progress.vue` 前端口径**写的对应聚合（不是另发明一个口径）──
// ① `lightWindows`：`亮窗总高 > 0` 且 `轨道种类` 非空且 ≠ 字符串 `'NULL'`（四字母，不是 null）。
//    列都是 NOT NULL，所以 SQL 里不用管 NULL。
const lightWindowSql = (t: number) =>
  `select coalesce(sum(l.quantity), 0) from order_lines l join orders o on o.id = l.order_id ` +
  `where l.tenant_id = ${t} and o.tenant_id = ${t} ` +
  `and l.light_window_height > 0 and l.track <> '' and l.track <> 'NULL'`

// ② `showerFans`：扇数 ∈ {一固一活, 双活} ⇒ `+2×数量`；**否则**型材含「钻石」⇒ `+数量`
//    （注意是「否则」—— 淋浴与钻石不是相加，是 if/else if）。
const showerFansSql = (t: number) =>
  `select coalesce(sum(case when l.fans in ('一固一活', '双活') then 2 * l.quantity ` +
  `when l.profile like '%钻石%' then l.quantity else 0 end), 0) ` +
  `from order_lines l join orders o on o.id = l.order_id ` +
  `where l.tenant_id = ${t} and o.tenant_id = ${t}`

/** 统计行里「时间: 起 至 止」的两个日期（= 有明细的那些订单的 `order_date` 的 min/max）。 */
const dateRangeSql = (t: number) =>
  `select to_char(min(o.order_date), 'YYYY-MM-DD') || ' 至 ' || ` +
  `to_char(max(o.order_date), 'YYYY-MM-DD') from orders o where o.tenant_id = ${t} ` +
  `and exists (select 1 from order_lines l where l.order_id = o.id and l.tenant_id = ${t})`

test.describe('页面真挂载', () => {
  test('Home：挂载出来、零 pageerror、零 console.error', async ({ page }) => {
    const guard = attachGuards(page)

    await login(page)
    await page.goto(HOME_PATH)

    expect(new URL(page.url()).pathname).toBe(HOME_PATH)
    await expect(page.locator('.app-header')).toBeVisible()
    await expect(page.locator('.home-container')).toBeVisible()
    await expect(page.locator('#app')).not.toBeEmpty()

    guard.assertClean()
  })

  test('Progress：渲染出的行数 / 统计行数字 与克隆库逐项对账', async ({ page }) => {
    const guard = attachGuards(page)

    await login(page)

    // ★ 每条断言**在本测试开始时**现查基线（见文件头）。
    const tenantId = adminTenantId()
    const dbLines = progressLineCount(tenantId)
    // 库里一行都没有 ⇒ 下面每条断言都会「通过」，但那是**空转**（页面空白也全绿）。
    // 装置是从开发库克隆的，真出现这种情况说明源库就是空的 —— 那时候红得对。
    expect(
      dbLines,
      '克隆库里一条订单明细都没有 ⇒ 这两条断言失去意义（装置的数据是从开发库克隆来的）',
    ).toBeGreaterThan(0)

    await page.goto(PROGRESS_PATH)
    // 先钉住「这是 Progress 页」——`.page` 好几个页面都用，不足以定身份。
    await expect(page.getByRole('button', { name: '打印选项' })).toBeVisible()

    // ① 表格真渲染出的**数据行数** == 库里（经 `/api/v1/progress` 口径）的行数。
    //    页面空白 ⇒ 这里恒为 0 ⇒ 红。`toHaveCount` 会重试到超时，数据是异步拉的。
    const rows = page.locator('.n-data-table-tbody .n-data-table-tr')
    await expect(rows).toHaveCount(Math.min(dbLines, FIRST_PAGE_SIZE))

    // ② `.total-info` 的「总计」== 库里同一个口径的总行数（这一条不受分页影响）。
    const info = await page.locator('.total-info').innerText()
    expect(numAfter(info, '总计')).toBe(dbLines)

    // ③ 统计行的三个数 / 时间区间，逐个跟库里算出来的比。
    expect(numAfter(info, '移门亮窗个数')).toBe(dbNumber(lightWindowSql(tenantId)))
    expect(numAfter(info, '淋浴房扇数')).toBe(dbNumber(showerFansSql(tenantId)))
    expect(info).toContain(`时间: ${dbQuery(dateRangeSql(tenantId))}`)

    guard.assertClean()
  })
})
