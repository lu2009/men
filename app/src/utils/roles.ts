/**
 * 账号角色（`users.role`）→ 旧版 `userinfo.defaulted` 的语义对应表。
 *
 * ## 为什么要有这个文件
 *
 * 旧版靠 `userinfo.defaulted` **一个数字**决定「登录后落在哪、菜单能看见哪些」。
 * 取值全集见 `docs/2026-09-19-progress-shell.md` §0 第 3 条：
 *
 * | `defaulted` | 是什么账号 |
 * |---|---|
 * | 1 | 车间（默认密码）账号 |
 * | 2 | **扫码账号** |
 * | 3 | 终端账号 |
 * | 0 / 其它 | 普通 PC 账号 |
 *
 * 新栈**没有** `defaulted` 这个字段（它是旧服务端的 `User.isDefaultPw`），
 * 用 `users.role` 表达同一件事：后端把扫码账号建成 `role = 'scanner'`。
 *
 * ## ⚠️ 只映射 2，不映射 1 / 3
 *
 * 1（车间账号）和 3（终端账号）在新栈**没有对应账号**，也**没有产品线要建**——
 * 不要为了「对齐旧版」发明 `role = 'workshop'` / `'terminal'` 这种东西。
 * 依据：`docs/2026-09-19-qrscanner-analysis.md` §6.3、§8.6-(d)。
 *
 * ## 角色分三档处置
 *
 * | 角色 | 这里的处置 |
 * |---|---|
 * | `scanner` | **受限** —— 路由闸门（`RESTRICTED_ROUTES`）只放它进扫码那几个入口 |
 * | `admin` | 路由全放行；且是**唯一**能改工序名单的角色，见 `canEditProcedures` |
 * | 其余 | 按「普通 PC 账号」处理：路由闸门不管、也没有额外的页面内限制 |
 *
 * ⚠️ **第三档「其余」目前是空的**：建号只有两条路（`auth/service.rs` 写死 `admin`、
 * `scanner/service.rs` 写 `scanner`），`users.role` 的迁移默认值也已拍板从 `staff`
 * 改成 `admin`。所以那一行**不是「行为保证」，只是「一律不额外设限」**。
 *
 * ⚠️ 而且真冒出第三档角色时，**前后端口径是不一致的**：前端这里放它看全套菜单，
 * 后端 `guard.rs` 的 `allowed_for` 对它却是 **deny-by-default**（只剩自助端点）
 * ⇒ 他会「菜单全有、点什么都 403」。这是**已知**的、留给产品定的事，不是漏改；
 * 本轮只把「唯一的默认值入口」堵掉（默认值改 `admin`），deny-by-default 的结构**不动**。
 *
 * ## ⚠️ 这里是**体验层**，不是安全边界
 *
 * 藏菜单、挡路由，都只是「别让人看见不该看的」，让人少点错。
 * **前端改一行 JS 就能绕过** —— 谁都能在 devtools 里把 store 的 role 改掉。
 * 真正的授权在**后端**（scanner 只能调扫码那几个端点），
 * 那边没挡住的，这边挡了也等于没挡。**别把本文件当防线。**
 */

/** 扫码账号的 role 值（旧版 `defaulted === 2`）。后端建号时写这个值。 */
export const SCANNER_ROLE = 'scanner'

/** 租户管理员（后端 `guard.rs` 的 `ROLE_ADMIN`）。建号时写死这个值。 */
export const ADMIN_ROLE = 'admin'

/** 是不是扫码账号（旧版 `defaulted === 2`）。 */
export function isScanner(role?: string | null): boolean {
  return role === SCANNER_ROLE
}

/**
 * 是不是**租户管理员** —— 本模块里 `ADMIN_ROLE` 字面量比较的**唯一**出处。
 *
 * ★ 这是**原语**，不是口径。下面 [`canEditProcedures`] 与 [`canSeeAllOrders`] 是两条
 *   **各自独立**的口径，现在恰好都由它满足 —— 但**别因此把它们合并成一个**：
 *   旧版这两件事来自**两个不同的门控变量**（`defaulted === 1` 与 `qt`），
 *   哪天其中一条改口径，另一条不该跟着动。要改的是那两条判定，不是这里。
 *
 * ⚠️ 未知角色（`null` / `undefined`）返回 **`false`** —— **fail-closed**。
 *    注意这**不等于**「不是管理员所以只能看自己的单」：调用方若把 `false` 当
 *    「按普通业务员处理」，在 role 还没读到的瞬间会闪一下「只剩自己那几行」。
 *    见 [`canSeeAllOrders`] 里各调用点的说明。
 */
export function isAdmin(role?: string | null): boolean {
  return role === ADMIN_ROLE
}

/**
 * 能不能改「设置工序」的工序名单 —— 也就是旧版那颗 `el-button type="info"` 的显示条件。
 *
 * ★ **只有 `admin`。** 依据旧版 §6.3 那张表：`yt = (Number(userinfo.defaulted) === 1)`
 *   才显示 —— `=2`（扫码账号）**和 `0/其它`（普通 PC 账号）都不显示**。
 *   不只是「扫码账号看不到」，普通账号同样看不到。新栈没有 `defaulted`，
 *   `admin` 是唯一对应「本租户能改配置」的角色。
 *
 * ⚠️ 三件事别搞混：
 *
 * 1. 这条**只**管「设置工序」那颗按钮 / 它开的弹窗。`/qrscanner` 本身**必须**对
 *    `scanner` 开放（那是他的落地页，见 `landingRouteName`）⇒ 所以它**不在**
 *    `RESTRICTED_ROUTES` 里，那张表是**路由级**的，装不下「同一页里藏一颗按钮」。
 * 2. 这是**体验层**，不是防线（见抬头）。真正的拦截在后端 `guard.rs` 的
 *    `SCANNER_ALLOWED`：`GET /v1/procedures` **放行**（扫码页的工序下拉要读）、
 *    `POST /v1/procedures` **不放行**。前端藏按钮只是别让人白填一遍再吃 403。
 * 3. 用它的地方**读 store 的 role**（`auth.user?.role`），而本函数对「role 还不知道」
 *    （`null` / `undefined`）返回 **`false`** —— **fail-closed**，未知就不给改。
 *    实际上不会闪：`/qrscanner` 带 `requiresAuth`，路由守卫在放行前已经
 *    `await auth.loadMe()`（`router/index.ts:48-51`），页面渲染时 role 已经有值了。
 *    即便如此也保持 fail-closed —— 万一将来有页面在守卫之外用它，宁可不显示。
 */
export function canEditProcedures(role?: string | null): boolean {
  return isAdmin(role)
}

/**
 * 能不能看到**全量订单** —— `false` ⇒ 只看自己打的单（`creator_name === 自己的 name`）。
 *
 * ★ 旧版的门控变量是 **`qt`**：`fs = qt ? _l : _l.filter(打单人 === 当前用户)`
 *   （`docs/2026-09-17-home-analysis.md` §3.1 逐字记着这一行）。三处调用点同一条口径：
 *
 *   | 调用点 | 旧版对应 |
 *   |---|---|
 *   | 主表 `filtered`（声明已随 B3 归位到 `app/src/composables/home/useHomeFilterView.ts`，2026-09-20 纯搬迁） | `fs`（`:11153` / `:11172`） |
 *   | `Home.vue` 「查询更多」落地 | `:11076` `!qt.value && (s = s.filter(t => t["打单人"] === _t.value))` |
 *   | `Home.vue` 经营看板 | 旧版看板**不吃**这个范围（吃原始全量 `K`）—— **有意偏离**，见 `docs/2026-09-19-progress-dashboard.md` §2.2 / §193 |
 *
 * ⚠️ **与 [`canEditProcedures`] 是两条口径，别合并**：那个来自 `defaulted === 1`（车间账号），
 *    这个来自 `qt`。今天都落到「是不是 `admin`」，但**依据不同**。
 *
 * ⚠️ 未知角色（role 还没读到）⇒ `false` ⇒ **按「只看自己」渲染**。
 *    这与改动前的内联 `role !== 'admin'` **逐字同义**（`undefined !== 'admin'` 也是 `true`），
 *    所以不是新引入的闪动。真要修那个闪动得改路由守卫的时序，不在本函数职责内。
 */
export function canSeeAllOrders(role?: string | null): boolean {
  return isAdmin(role)
}

/**
 * 受限入口表：**路由 name** → 「这个角色能不能看见 / 能不能进」。
 *
 * ★ 一张表同时管**导航显隐**（`components/AppHeader.vue`）与**路由拦截**（`router/index.ts`），
 *   两处不会各写一份、也就不会对不上。加新受限入口**只改这里**。
 *
 * 表里**没有**的路由一律放行（`canAccessRoute` 默认 true）—— 这样普通账号
 * 天然不受影响，不用去枚举一遍白名单。
 *
 * 每条的依据都是旧版外壳的门控变量（`de` / `fe` / `we` / `ve`），
 * 见 `docs/2026-09-19-progress-shell.md` §2.2 与 `docs/2026-09-19-qrscanner-analysis.md` §1.3。
 */
const RESTRICTED_ROUTES: Record<string, (role?: string | null) => boolean> = {
  /**
   * 生产进度。旧版门控是 `fe && !ve`，即 `defaulted !== 2 && defaulted !== 3`；
   * `defaulted=2` 时外壳明确 `fe = false`。新栈只映射 2（3 不做），所以就是 `!scanner`。
   */
  progress: (role) => !isScanner(role),

  /** 汇算下单（旧版 `/Hui`，导航文案「制作回执单」）。同属 `fe` 那一组。 */
  hui: (role) => !isScanner(role),

  /** 公式。旧版 `de` 门控（公式 / 客户信息 / 参数设定），`defaulted=2` 时 `de = false`。 */
  formulas: (role) => !isScanner(role),

  /** 客户信息。同属 `de` 那一组。 */
  clients: (role) => !isScanner(role),

  /**
   * 订单管理（`/`，Home）。旧版**菜单变量**没有单独管它，但**导航函数**管：
   * 外壳里 `Z()`（→ `/Home`）一进门就 `if (2 == userinfo.defaulted) return`，
   * 同一串里还有 `/Diao` `/Hui` `/clients_Info` `/setting`
   * （`docs/2026-09-19-progress-shell.md` §3.4 的 `defaulted === 2` 一节）。
   *
   * ⚠️ 旧版只挡**导航函数**（点不动），**直接敲 URL 还是进得去** —— 那正是这次要补的洞：
   * Home 上挂着订单全表、经营看板、财务抽屉，扫码账号进得来等于把经营数据全敞开。
   */
  home: (role) => !isScanner(role),
}

/**
 * `name` 这条路由（route name），`role` 这个角色**能不能看见 / 能不能进**。
 * 受限表里没有的一律 true。`role` 还没读到时（刷新瞬间）也一律 true ——
 * 路由守卫会在判角色前先把 `/me` 补齐，见 `router/index.ts`。
 */
export function canAccessRoute(role: string | null | undefined, name: unknown): boolean {
  const gate = RESTRICTED_ROUTES[String(name ?? '')]
  return gate ? gate(role) : true
}

/**
 * 登录后（或**撞到无权页面被弹回时**）该落在哪条路由。
 *
 * 旧版那条规则是「`defaulted` 不是 1 也不是 3 → `/Qrscanner`」，我们**只取其中的 2**：
 * scanner → `/qrscanner`，其余一律 `/`（Home，新版既有行为）。
 *
 * ★ 有意偏离：旧版把 `defaulted = 0/其它`（普通 PC 账号）也丢到 `/Qrscanner`，
 *   那与它自己给这些账号**保留全套菜单**（`de`/`fe`/`we` 全 true）自相矛盾 ——
 *   一个满菜单的账号落在车间扫码页上。新版普通账号**继续落 `/`，行为不变**。
 */
export function landingRouteName(role?: string | null): string {
  return isScanner(role) ? 'qrscanner' : 'home'
}
