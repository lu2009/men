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
 * 除 `scanner` 外**一切** role（现在的 `admin` / `staff`，以及以后新增的）
 * 都按「普通 PC 账号」处理 —— 也就是说，它们的行为**一个字节都不变**。
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

/** 是不是扫码账号（旧版 `defaulted === 2`）。 */
export function isScanner(role?: string | null): boolean {
  return role === SCANNER_ROLE
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
