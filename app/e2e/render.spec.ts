/**
 * **渲染烟测：每条路由都真挂载出来。**
 *
 * ── 这一条盖的是哪个盲区 ─────────────────────────────────────────────────────
 * 那 34 个台子（差分台 / 纯函数台 / HTTP 级台）**集体看不见「组件渲染」这一层**
 * （记忆 `split-guard-blind-spots` 第 3 类：模板绑定漏解构 ⇒ 三闸全绿但页面空白）。
 * `mount.spec.ts` 只深挖了 Home 与 Progress 两页的**数据对账**；本文件补的是
 * **横向覆盖**：其余路由（公式 / 客户 / 汇算 / 扫码 / 电子回执 / 登录）至少证明
 * 「模板真渲染出东西了、且渲染过程没有抛异常」。
 *
 * ── 与 `mount.spec.ts` 的**分工**（别以为是漏了）─────────────────────────────
 * **`/progress` 在本文件里只有一颗「打印选项」按钮 + `#app` 非空，没有纵深锚点**，
 * 这是**有意的**：它的纵深（表格真渲染出的行数、`.total-info` 的「总计/移门亮窗个数/
 * 淋浴房扇数」、时间区间）已经在 `mount.spec.ts` 里**逐项跟克隆库对账**了 ——
 * 那比在烟测里再钉一个「某块在不在」强得多。同一条理由，Home 的**行数类**对账
 * 也不在本文件（本文件只钉「汇总条那块渲染出来了」，不对它的数字）。
 * ⇒ 本文件的定位是**广度**（每条路由都进得去、渲染得出来），深度的数对账归 `mount.spec.ts`
 *   与 T3/T6/T7；两者**不是重复**，别把这条删了去"合并"。
 *
 * ── 为什么断言的是「特征元素」而不是「body 里有字」 ───────────────────────────
 * `.page` 这个根 class **四个页面共用**（`clients` / `formulas` / `hui` / `progress`
 * 的根 div 都是它）⇒ 它只能证明「挂了个 Vue 应用」，不能证明「挂的是这一页」。
 * 所以每条路由都钉一个**只有这一页有**的特征元素（按钮文案 / 页面标题 / 页面自有 class）。
 * `#app` 非空只作**辅助**断言（它是 `<div id="app">`，任何页面都成立），
 * 真正的身份判据是那个特征元素 —— 这一点**量过**：把 `Home.vue` 的一个解构名删掉做变异时，
 * `.app-header` **照样可见**（它是 `App.vue` 的兄弟节点，不随 `router-view` 一起炸），
 * 红的是 `.home-container`。⇒ 光有 `.app-header` 挡不住「页面空白」。
 *
 * ── "特征元素必须亲眼看见"这条是怎么落实的 ──────────────────────────────────
 * 下面每个选择器都**先在浏览器里跑出来过**（不是从源码里读出来的）。这条要求不是形式主义：
 * 从源码里「读出一个元素」和「那个元素真在浏览器里」是**两件事**。简报那张表里有**两格**
 * 与真页面不符，两处都是**实测**出来的（2026-09-21，各真跑一次）：
 *   · `/formulas`「底部确认按钮」：`getByRole('button', { name: '确认', exact: true })`
 *     报 `Error: element(s) not found`，而且**没有** pageerror ⇒ 页面是好的，
 *     是那个元素首屏不在（`v-show` 关着，理由见那条用例）；
 *   · `/hui`「保存回执单按钮」：页面上那颗的**完整文案是「3.保存回执单」**（带序号）。
 *     按简报那个名字写确实也能命中（Playwright 的 `name` 默认是**子串**匹配 ——
 *     这是它的文档行为，本文件**没有**为这一条单独跑过对照），但「碰巧命中」
 *     不等于「名字对」；本文件用 `exact` 钉死全串，让文案一变就红。
 *
 * 而且「断言红了」本身也分两种，**不能混成一句「找不到」**：
 *   · **选择器名写错了**（猜的元素根本不在）⇒ 页面是好的，改断言；
 *   · **页面真坏了**（渲染抛异常 / 整页空白）⇒ 改页面。
 * 这两种在本套里的**证据形状不同**，分得开：
 *   · 前者只有 `toBeVisible()` 一条红，报的是 `Error: element(s) not found`；
 *   · 后者会**再多一条** `pageerror`（三道闸里的那道），报组件栈上的异常
 *     —— 实测：删掉 `Home.vue` 模板用到的一个解构名 ⇒ `ReferenceError: checkedRowKeys is
 *     not defined at setup (Home.vue:214)`，与「元素找不到」**同时**出现。
 * 两种情形 Playwright 都会存下失败截图与 `error-context.md`（页面快照）。
 *
 * ── 期望值不写死（Global Constraint 1）──────────────────────────────────────
 * 本文件里唯一一个「随数据变的期望值」是电子回执单号：它**从克隆库现查**
 * （`dbQuery`，口径与后端 `orders::service::get_by_receipt_no` 一致），不写死。
 * 其余路由不涉及业务数据。
 *
 * ── `/receipt-share` 为什么不在这个文件里 ────────────────────────────────────
 * 它要后端签发的**签名令牌**（无认证页面靠令牌取详情），归 Task 10。
 * 本文件覆盖 9 条路由里的 8 条。
 *
 * ⚠️ `test` / `expect` 从 `./lib/setup` import —— 三道闸（pageerror / console.error /
 *    `:3000`）挂在那里面的 auto fixture 上，测试体里**不用**（也**不要**）再手工挂一次。
 *    写隔离（每个用例前把工作库重置回干净克隆态）同样在 fixture 上，与本文件无关。
 */
import {
  adminTenantId,
  dbQuery,
  expect,
  HOME_PATH,
  LOGIN_PATH,
  LOGIN_PW_PLACEHOLDER,
  LOGIN_USER_PLACEHOLDER,
  login,
  PROGRESS_PATH,
  test,
} from './lib/setup'

/**
 * `login()` 的入参类型就是 `Page`。
 *
 * ★ **故意不 `import type { Page } from '@playwright/test'`** —— Global Constraint 7 写的是
 *   「一律从 `./lib/setup` import」。类型是编译期擦除的，import 它并**不会**让三道闸失效
 *   （那条规矩针对的是把 `test`/`expect` 从别处引进来），但照字面守更省事，
 *   也免得后来者照着这一行去 import 真东西。
 */
type Page = Parameters<typeof login>[0]

/**
 * 走真表单登录 → 导航到 `path` → 两条**所有路由共有**的断言：
 *   ① 没被路由守卫弹走（URL 就是我们要的那条）；
 *   ② `#app` 非空（Vue 真挂上了，不是空壳）。
 * ③「页面自己的根元素在场」**不在这里** —— 根元素按页不同（`.home-container` /
 *   `.page` / `.login-page` / `.receipt-view`），各条用例自己断言那一条（见文件头
 *   「为什么断言的是特征元素」）。
 *
 * ⚠️ `login()` 返回前会等应用**落定**（`settleApi`）—— 别把它去掉、也别在这里再垫
 *    一个 `waitForTimeout`：紧跟着的 `goto` 是**整文档导航**，会把在飞的 `/me` 掐掉，
 *    于是令牌被 `loadMe` 的 catch 抹掉、守卫把下一个文档弹回 `/login`。
 *    机制与三档实测见 `lib/setup.ts` 里 `settleApi` 的注释。
 */
async function gotoAuthed(page: Page, path: string): Promise<void> {
  await login(page)
  await page.goto(path)
  expect(new URL(page.url()).pathname, `${path} 被路由守卫弹走了`).toBe(path)
  await expect(page.locator('#app')).not.toBeEmpty()
}

test.describe('路由渲染烟测', () => {
  test('`/` Home：`.app-header` 与 `.home-container` 都在场', async ({ page }) => {
    await gotoAuthed(page, HOME_PATH)
    // 全局标题栏（`App.vue` 的 `HEADER_ROUTES` 白名单里有 home）。
    await expect(page.locator('.app-header')).toBeVisible()
    // Home 自己的根容器。
    await expect(page.locator('.home-container')).toBeVisible()
    // ★ **纵深锚点**：汇总条（`.search-row` 里那块「当前筛选: …」/「总计: N 条记录 …」）。
    //
    // ── 它比 `.home-container` 多盖了什么 ──────────────────────────────────────
    // `.home-container` 是页面的**静态外壳**（`Home.vue:2` 上没有任何条件），首屏必然在。
    // 这一块不是：`v-else-if="rawOrders.length > 0"`（`Home.vue:90`，无搜索词时走这支）
    // ⇒ **它的存在要先有 `/api/v1/orders` 回来的数据**。数据到达会触发一次 re-render，
    //   而**只要那次 re-render 抛异常，Vue 就保留上一次成功的 DOM**（外壳还在、这块不在）
    //   —— 那正是「第一次渲染成功、第二次渲染炸」的逃逸者形状。
    //
    // ── 证据（两条，一条测到的 + 一条没测到的，分开写）────────────────────────
    // ✓ **测到的**：把 `summary` 这个解构名从 `Home.vue` 删掉（它就是被这一块读的），
    //   本条断言**自己就红**：`Error: element(s) not found`（报告 §3.3 有原样输出）。
    //   ★ 这正是不加它就漏掉的那种红：同一变异在**没有这条锚点**时，渲染断言**全绿**，
    //   只有三道闸里的 `pageerror` 抓得到 —— 而 `pageerror` 只是「有异常」，
    //   说不出「页面上少了哪一块」。
    // ✗ **没测到的**：探针**没能**拍到「数据回来之前它不在」那个窗口 ——
    //   在本机这套装置上后端答得比 `load` 事件还快，`goto()` 一返回 count 就已经是 1 了
    //   （t0 / t+2.5s 两次采样都是 1）。所以「它真有那么一个空窗期」是**源码事实**
    //   （那个 `v-else-if` 条件摆着），不是我量到的。**别把这条写成实测**。
    //
    // ⚠️ 别把它换成 `toHaveCount(1)` 之类：`v-if`/`v-else-if` 两支互斥，永远只有 1 个，
    //    计数是空转的；`toBeVisible()` 才是「数据到了且渲染没炸」的那条判据。
    // ⚠️ 也**不在这里对账行数/金额** —— 那是 `mount.spec.ts`（Progress）与 T3/T6/T7 的活，
    //    而且贴着 Global Constraint 10。
    await expect(page.locator('.summary-info')).toBeVisible()
    // ⚠️ 这条与 `mount.spec.ts` 的第一条有意重叠：那边深挖的是**数据对账**，
    //    这边只负责「这条路由进得来、渲染得出来」。重叠的是入口，不是证据。
  })

  test('`/formulas` 公式管理：标题在场（不是简报说的「底部确认按钮」）', async ({ page }) => {
    await gotoAuthed(page, '/formulas')
    // ★ 简报那张表写的是「底部『确认』按钮」，**实测不成立**：那颗按钮在
    //   `v-show="editorVisible"` 里（`Formulas.vue:1293` 的 `.formula-actions`），而
    //   `editorVisible`（`Formulas.vue:61`）初值 `ref(false)`，全文**只有 3 处**给它赋值
    //   （`:757` / `:762` / `:938`，**全是 `= true`、从不回 false** —— 这是个单向闩），
    //   三处都在「加载模板 / 复制公式 / 查询公式」这些**用户动作**里；
    //   `onMounted`（`:1079`）只补了一次 `/me`，没有任何一条挂载路径会打开它。
    //   ⇒ 首屏那颗按钮是 `display:none`，对它写 `toBeVisible()` **必红**。
    //   （核对方式：`grep -n "editorVisible.value *=" Formulas.vue` —— 别信这句注释，
    //     行号会漂；上面那 3 个行号是 2026-09-21 实测的。）
    //   这里钉同一页里**始终可见**的标题；「`（吊）`」两个字也只有这一页有。
    await expect(page.getByText('公式管理（吊）')).toBeVisible()
    // 「开孔图」是这一页工具条上的按钮，顺带钉住「工具条整块渲染出来了」。
    await expect(page.getByRole('button', { name: '开孔图' })).toBeVisible()
  })

  test('`/clients` 客户信息：头部「新增客户」按钮在场', async ({ page }) => {
    await gotoAuthed(page, '/clients')
    await expect(page.getByRole('button', { name: '新增客户' })).toBeVisible()
    // 列表真拿到了数据（表格在场）。**不断言行数** —— 客户数会随用户录入而变，
    // 而且「空表」与「页面没渲染」在这一层分不开，那不是本文件的活儿。
    await expect(page.locator('.n-data-table')).toBeVisible()
  })

  test('`/hui` 汇算：工具条上「保存回执单」在场', async ({ page }) => {
    await gotoAuthed(page, '/hui')
    // ⚠️ 按钮的**完整**文案是「3.保存回执单」（`Hui.vue:18`，序号是旧版就有的）。
    //    `getByRole` 的 `name` 默认是**子串**匹配，所以这里按简报写「保存回执单」也能命中；
    //    用 `exact` 钉全串，是为了万一将来又冒出一颗含这三个字的按钮时**立刻红**，
    //    而不是静默匹配到另一颗上。
    await expect(page.getByRole('button', { name: '3.保存回执单', exact: true })).toBeVisible()

    // ★ **纵深锚点**：订单头表单行（`.header-form`，`Hui.vue:47`）—— 工具条**下面**的
    //    页面主体。它比上面那颗按钮多盖了一大片：这一块里挂了 11 个字段的绑定
    //    （客户 `:options="clientOptions"`、电话 / 安装地址 / 备注 / 业务员 /
    //    生产天数 / 订金 / 品牌 / 日期 `orderDateTs` / 编号 `order.receipt_no`），
    //    任何一条绑定把名字写坏，这块就渲染不出来，而工具条那颗按钮**照样在**。
    //
    // ── 诚实边界（实测，别当它盖了更多）────────────────────────────────────────
    //    ✗ 它**不**盖「第二次渲染」。探针两次采样（`goto()` 刚返回 / 再等 2.5s）：
    //      `.header-form` **两次都是 1** ⇒ 本页首屏**没有**「数据到了才出现」的可见区。
    //      原因是本页 `onMounted`（`Hui.vue:1525`）那几条异步拉取（`clientOptions` /
    //      `payQrcodeUrl` / 列配置 / `/me`）喂的全是**隐藏控件**（收款码弹窗、列显隐）
    //      与打印载荷，**不改变首屏哪块存不存在**。
    //      唯一数据门控的可见区是 `.totals-strip`（`v-if="lines.length"`，`Hui.vue:175`），
    //      但它要用户先「2.添加门类」再落一行 —— 烟测不点、也不该点（那是行为断言）。
    //    ✓ 所以这条锚点的作用是**纯纵深**（主体区整片渲染没炸），不是「抓第二次渲染」。
    //      真要抓后者得先有一个数据门控的可见区，本页**没有** —— 不为了测试去改页面。
    //      （对比：Home 的 `.summary-info` 是数据门控的，那条才盖得住第二次渲染。）
    await expect(page.locator('.header-form')).toBeVisible()
  })

  test('`/progress` 生产进度：工具条上「打印选项」在场', async ({ page }) => {
    await gotoAuthed(page, PROGRESS_PATH)
    // 这一颗在 `mount.spec.ts` / `auth.spec.ts` 里已经实测过（`.page` 好几个页面都用，
    // 不足以定身份，所以两处都拿它钉 Progress）。
    await expect(page.getByRole('button', { name: '打印选项' })).toBeVisible()
  })

  test('`/qrscanner` 扫码生产：「扫码录单」在场', async ({ page }) => {
    await gotoAuthed(page, '/qrscanner')
    // `Qrscanner.vue:140`：`v-if="!scanning"`。初始 `scanning` 为假 ⇒ 首屏这颗在。
    // （点它会去要摄像头，本文件**不点** —— 烟测只证明渲染，不碰硬件。）
    await expect(page.getByRole('button', { name: '扫码录单' })).toBeVisible()

    // ★ **纵深锚点**：工序下拉（`.procedure-select`，`Qrscanner.vue:206`）—— 工具条
    //    **下面**的页面主体（与员工名输入框同行）。
    //    它比上面那颗按钮多盖了：这一块挂着**由接口喂**的绑定
    //    （`onMounted(loadProcedures)` → `GET /api/v1/procedures` → `:options="procedureOptions"`，
    //    `Qrscanner.vue:442`），而那颗按钮只依赖 `scanning` 这个本地 ref。
    //    按钮渲染得出来、这块渲染不出来，只有它看得见。
    //
    // ── 诚实边界（实测）───────────────────────────────────────────────────────
    //    ✗ 它**不**盖「第二次渲染」：探针两次采样（`goto()` 刚返回 / 再等 2.5s），
    //      `.procedure-select` **两次都是 1** ⇒ 它不是「数据到了才出现」的。
    //      （本页 `onMounted` 拉回来的 `procedures` 只喂这个下拉的**选项**，
    //      而克隆库里 `procedures` 是**空表** ⇒ 选项本来就是空的，DOM 有无都不变。）
    //      本页唯一数据门控的可见区是 `.scan-results`（`v-if="codes.length > 0"`），
    //      要真扫一个码才出现 —— 烟测不碰摄像头，**不点**。
    //    ✓ 所以这条是**纯纵深**（主体区的接口绑定渲染没炸），不是「抓第二次渲染」。
    await expect(page.locator('.procedure-select')).toBeVisible()
  })

  test('`/receipt-view/:receiptNo` 电子回执：回执号**现查库**、页面上显示的就是它', async ({
    page,
  }) => {
    // ★ 回执号**从克隆库现查**（Global Constraint 1：不许写死）。口径与后端一致：
    //   `orders::service::get_by_receipt_no` = `WHERE receipt_no = $1 AND tenant_id = $2`
    //   （`backend/src/modules/orders/service.rs:353`）—— 所以取**本租户**的、且取非空值。
    const receiptNo = dbQuery(
      `select receipt_no from orders where tenant_id = ${adminTenantId()} ` +
        `and receipt_no <> '' order by id limit 1`,
    )
    // 查不到就**当场红**：往下走会得到一个 `/receipt-view/` 空参数路由，
    // 那测的就不是路由参数这条链路了（而且报错会指向「页面坏了」这个错误的方向）。
    expect(
      receiptNo,
      '克隆库里没有带回执单号的订单 ⇒ 这条用例无从测起（装置的数据是从开发库克隆来的）',
    ).not.toBe('')

    await gotoAuthed(page, `/receipt-view/${encodeURIComponent(receiptNo)}`)

    // ① 回执真渲染出来了（`.receipt-container` 只在 `receipt && customerInfo` 都到手时才在，
    //    `ReceiptView.vue:23`）—— loading / error 分支下它是**不存在**的。
    //    所以这一条同时排除了「接口 404 走了错误分支」那种「页面有东西但不是回执」的假绿。
    await expect(page.locator('.receipt-container')).toBeVisible()
    await expect(page.locator('.receipt-mobile .customer-card')).toBeVisible()

    // ② **库 → 页面**逐字段对账的那一格：页面上印的订单号 == 我们刚查出来的那个回执号。
    //    `ReceiptCard` 的 `.order-no` 绑的是 `info.orderNo`，而
    //    `receiptBuilder.ts:303` 是 `orderNo: receipt.receipt_no`（原样透传，无格式化）
    //    ⇒ 两边是同一个值，可以直接比字符串（不需要在这里重算任何业务口径）。
    await expect(page.locator('.order-no')).toHaveText(receiptNo)
  })

  test('`/login` 登录页：两个 placeholder 在场', async ({ page }) => {
    // ⚠️ 这条**不调 `login()`** —— 调了就登进去了，守卫会把 `/login` 弹走。
    //    每条用例是**独立的 browser context** ⇒ localStorage 本来就是空的，
    //    `goto(LOGIN_PATH)` 会稳稳落在登录页（`auth.spec.ts` 第一条也是这个前提）。
    await page.goto(LOGIN_PATH)
    expect(new URL(page.url()).pathname).toBe(LOGIN_PATH)
    await expect(page.locator('#app')).not.toBeEmpty()
    await expect(page.getByPlaceholder(LOGIN_USER_PLACEHOLDER)).toBeVisible()
    await expect(page.getByPlaceholder(LOGIN_PW_PLACEHOLDER)).toBeVisible()
    // 页面自己的根容器。
    await expect(page.locator('.login-page')).toBeVisible()
  })
})
