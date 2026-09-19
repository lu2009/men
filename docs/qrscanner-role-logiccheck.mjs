/*
 * 「按角色落地页 / 导航门控 / 路由拦截」的**真跑台**。
 *
 * 为什么不是差分台：旧版那段守卫跑在浏览器里（`createWebHistory` + IndexedDB 里的 userinfo），
 * 切出来跑成本极高，而它的**口径已经在文档里定死了** —— 所以这里拿文档里的旧版口径当**期望值**，
 * 跑**新版真代码**，逐条对。
 *
 * 两块：
 *   ① `app/src/utils/roles.ts` —— 门控判定表，逐条断言（谁能进哪条路由、落地页是谁）；
 *   ② `app/src/router/index.ts` 的路由守卫 —— **真跑**。把守卫源码原样切出来、
 *      只把 `createWebHistory` 换成 `createMemoryHistory`（脱离浏览器），
 *      `.vue` 组件与 `api/client` 用桩替掉；**router 本身、守卫、roles.ts、pinia auth store
 *      全是真代码**。然后逐个角色走一遍导航，看**真的落在哪**，而不是「我读了一遍觉得对」。
 *
 * ⚠️ 本台**不覆盖**的东西（别以为它绿了就全都对）：
 *   1. **界面**。`AppHeader.vue` 的 `visibleItems` 用的是同一张表，但这里不渲染组件 ——
 *      「藏了哪几项」靠的是「表对 + 组件调的是这张表」，组件本身没跑。
 *   2. **后端授权**。这里全是前端。前端改一行 JS 就能绕过，见 `utils/roles.ts` 抬头。
 *   3. `defaulted = 1/3`（车间账号 / 终端账号）**不在范围内** —— 新栈没有这两种账号，
 *      也**不发明**对应的 role。见 `docs/2026-09-19-qrscanner-analysis.md` §6.3 / §8.6-(d)。
 *
 * 旧版口径出处（每条期望值的依据）：
 *   · `docs/2026-09-19-progress-shell.md` §0 第 3 条（`defaulted` 取值全集）、
 *     §2.2（`/Progress` 门控 `fe && !ve`）、§3.4（`defaulted = 2` 的导航函数全被挡）
 *   · `docs/2026-09-19-qrscanner-analysis.md` §1.3（`de`/`fe`/`we` 三张门控表）、
 *     §1.4（守卫默认落地页）、§6.3（谁能做什么）
 *   · `docs/2026-09-19-legacy-nav.md`（新版映射一节）
 *
 * 用法：node docs/qrscanner-role-logiccheck.mjs
 * （中间产物写在 `app/node_modules/.roletest/` —— 那里才解析得到 vue/pinia，跑完留着无妨。）
 */
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '..', 'app')

const { build } = await import(resolve(APP, 'node_modules/esbuild/lib/main.js'))
const { createPinia, setActivePinia } = await import(
  resolve(APP, 'node_modules/pinia/dist/pinia.mjs')
)

const OUT = resolve(APP, 'node_modules/.roletest')
await mkdir(OUT, { recursive: true })

// ---------------------------------------------------------------------------
// 桩：只替网络层。store / 守卫 / roles.ts 全是真的。
// ---------------------------------------------------------------------------
const STUB_CLIENT = `
  let _t = (globalThis.__TOKEN__ ?? null)
  export const getToken = () => _t
  export const setToken = (v) => { _t = v; globalThis.__TOKEN__ = v }
  export const api = {
    login: async () => { throw new Error('本台不测登录，只测登录之后的落地') },
    logout: async () => ({ logged_out: true }),
    me: async () => {
      if (globalThis.__ME_FAILS__) throw new Error('401')
      return {
        user: { id: 1, tenant_id: 1, username: 'u', name: 'n', role: globalThis.__ROLE__ },
        tenant: { id: 1, name: 't' },
      }
    },
  }
`

/** @type {import('esbuild').Plugin} */
const rig = {
  name: 'rig',
  setup(b) {
    // `.vue` → 空组件（本台不渲染界面）
    b.onResolve({ filter: /\.vue$/ }, (a) => ({ path: a.path, namespace: 'vue-stub' }))
    b.onLoad({ filter: /.*/, namespace: 'vue-stub' }, () => ({
      contents: 'export default { name: "stub", render() { return null } }',
      loader: 'js',
    }))
    // `api/client` → 桩
    b.onResolve({ filter: /\/api\/client$/ }, () => ({ path: 'client', namespace: 'client-stub' }))
    b.onLoad({ filter: /.*/, namespace: 'client-stub' }, () => ({
      contents: STUB_CLIENT,
      loader: 'js',
    }))
    // ★ 唯一一处对生产源码的改动：WebHistory → MemoryHistory。
    //   换了就要在下面断言「确实换上了」，否则守卫源码一改这里会**静默失去意义**。
    b.onLoad({ filter: /src\/router\/index\.ts$/ }, async (a) => {
      const fs = await import('node:fs/promises')
      const src = await fs.readFile(a.path, 'utf8')
      const out = src.replaceAll('createWebHistory', 'createMemoryHistory')
      if (out === src) throw new Error('没换上 createMemoryHistory —— 守卫源码动过，先看这个脚本')
      return { contents: out, loader: 'ts' }
    })
  },
}

const EXT = ['vue', 'pinia', 'naive-ui']
await build({
  entryPoints: [resolve(APP, 'src/router/index.ts')],
  bundle: true, format: 'esm', platform: 'node', external: EXT, plugins: [rig],
  outfile: resolve(OUT, 'router.mjs'), logLevel: 'error',
})
await build({
  entryPoints: [resolve(APP, 'src/stores/auth.ts')],
  bundle: true, format: 'esm', platform: 'node', external: EXT, plugins: [rig],
  outfile: resolve(OUT, 'authstore.mjs'), logLevel: 'error',
})
await build({
  entryPoints: [resolve(APP, 'src/utils/roles.ts')],
  bundle: true, format: 'esm', platform: 'node', external: EXT, plugins: [rig],
  outfile: resolve(OUT, 'roles.mjs'), logLevel: 'error',
})

const bust = '?t=' + Date.now()
const roles = await import(resolve(OUT, 'roles.mjs') + bust)
const { default: router } = await import(resolve(OUT, 'router.mjs') + bust)
const { useAuthStore } = await import(resolve(OUT, 'authstore.mjs') + bust)

let bad = 0
const check = (ok, msg) => { if (!ok) { bad++; console.log('✗ ' + msg) } }

// ---------------------------------------------------------------------------
// ① 门控表：谁能进哪条路由
// ---------------------------------------------------------------------------
// [路由 name, scanner 能不能进, 旧版依据]
const ROUTES = [
  ['home',      false, '导航函数 Z()(→/Home) 对 defaulted=2 直接 return'],
  ['hui',       false, 'fe（回执单组）+ 导航函数 W() 被挡'],
  ['progress',  false, 'fe && !ve，defaulted=2 时 fe=false'],
  ['formulas',  false, 'de（公式/客户信息/参数设定），defaulted=2 时 de=false'],
  ['clients',   false, '同 de 那一组'],
  ['qrscanner', true,  'we 保持 true —— 这是扫码账号自己的页'],
  ['receipt-view', true,  '旧版 defaulted=3 才落这儿；对 2 没有限制依据，不发明限制'],
  ['login',     true,  '—'],
  ['receipt-share', true, '无认证分享页（客户看的），不吃角色'],
  ['no-such-route', true, '受限表里没有的一律放行（普通账号天然不受影响）'],
]
// 其它角色：除 scanner 外**一律不限制** —— 这是「普通账号行为一点不变」的硬要求
const OTHER_ROLES = ['admin', 'staff', '', null]

console.log('① 门控表（app/src/utils/roles.ts）')
for (const [name, scannerOk, why] of ROUTES) {
  check(roles.canAccessRoute('scanner', name) === scannerOk,
    `scanner 对 ${name} 判定错（期望 ${scannerOk}）—— 依据：${why}`)
  for (const r of OTHER_ROLES) {
    check(roles.canAccessRoute(r, name) === true,
      `非 scanner 账号（role=${JSON.stringify(r)}）被挡在 ${name} 外面 —— 普通账号行为不能变`)
  }
}
check(roles.canAccessRoute('Scanner', 'home') === true, 'role 大小写不同被当成扫码账号了（不该）')

// 落地页
check(roles.landingRouteName('scanner') === 'qrscanner', 'scanner 落地页不是 /qrscanner')
for (const r of OTHER_ROLES) {
  check(roles.landingRouteName(r) === 'home', `非 scanner（${JSON.stringify(r)}）落地页被改了`)
}
console.log(`   ${ROUTES.length} 路由 × ${OTHER_ROLES.length + 1} 角色 —— ${bad ? '有错' : '全对'}`)

// ---------------------------------------------------------------------------
// ② 路由守卫：真跑
// ---------------------------------------------------------------------------
async function nav(role, token, from, to) {
  setActivePinia(createPinia())
  globalThis.__ROLE__ = role
  globalThis.__TOKEN__ = token
  globalThis.__ME_FAILS__ = false
  const auth = useAuthStore()
  auth.token = token
  auth.user = null // 模拟「刷新后 store 是空的」—— 这正是守卫必须自己补 /me 的场景
  auth.tenant = null
  await router.replace(from).catch(() => {})
  await router.replace(to).catch(() => {})
  await new Promise((r) => setTimeout(r, 0))
  return { name: String(router.currentRoute.value.name), auth }
}

// [角色, 有令牌, 起点, 目标, 期望落点, 说明]
const NAV = [
  ['scanner', true, '/login',     '/',            'qrscanner',    '落在「订单管理」→ 弹回扫码页'],
  ['scanner', true, '/login',     '/progress',    'qrscanner',    '敲 /progress → 挡住（旧版 fe 门控）'],
  ['scanner', true, '/qrscanner', '/hui',         'qrscanner',    '敲 /hui → 挡住'],
  ['scanner', true, '/qrscanner', '/formulas',    'qrscanner',    '敲 /formulas → 挡住（旧版 de 门控）'],
  ['scanner', true, '/qrscanner', '/clients',     'qrscanner',    '敲 /clients → 挡住'],
  ['scanner', true, '/qrscanner', '/qrscanner',   'qrscanner',    '进自己的页 → 放行'],
  ['scanner', true, '/qrscanner', '/login',       'qrscanner',    '已登录访问 /login → 落扫码页'],
  ['scanner', true, '/qrscanner', '/receipt-view/X1', 'receipt-view', '看自己的电子回执 → 放行'],
  ['admin',   true, '/login',     '/',            'home',         '落 Home —— 与加门控之前一致'],
  ['admin',   true, '/login',     '/progress',    'progress',     '进 /progress —— 与加门控之前一致'],
  ['admin',   true, '/',          '/progress',    'progress',     '页内跳转 /progress'],
  ['staff',   true, '/login',     '/',            'home',         'staff 同普通账号'],
  ['staff',   true, '/',          '/hui',         'hui',          'staff 进 /hui'],
  ['admin',   false, '/',         '/progress',    'login',        '无令牌 → 登录页 —— 与加门控之前一致'],
  ['scanner', false, '/qrscanner','/qrscanner',   'login',        '扫码账号无令牌 → 登录页'],
]

console.log('\n② 路由守卫（app/src/router/index.ts，真跑）')
for (const [role, token, from, to, want, why] of NAV) {
  const { name } = await nav(role, token, from, to)
  check(name === want, `${role} ${from} → ${to} 落在 ${name}，期望 ${want}（${why}）`)
  console.log(`   ${name === want ? '✓' : '✗'} ${role.padEnd(7)} → ${to.padEnd(18)} 落 ${name.padEnd(13)} ${why}`)
}

// 守卫里那次补 /me 失败 ⇒ 必须清令牌回登录页，不能停在受限页
{
  setActivePinia(createPinia())
  globalThis.__TOKEN__ = 'dead'; globalThis.__ROLE__ = 'scanner'; globalThis.__ME_FAILS__ = true
  const a = useAuthStore(); a.token = 'dead'; a.user = null
  await router.replace('/qrscanner').catch(() => {})
  await router.replace('/progress').catch(() => {})
  await new Promise((r) => setTimeout(r, 0))
  const ok = String(router.currentRoute.value.name) === 'login' && a.token === null
  check(ok, '令牌失效时没回登录页')
  console.log(`   ${ok ? '✓' : '✗'} 令牌失效 → 守卫补 /me 失败 ⇒ 清令牌回登录页（落 ${router.currentRoute.value.name}）`)
}

// 无认证的分享页不该顺手要一次 /me（那是给客户看的）
{
  setActivePinia(createPinia())
  globalThis.__TOKEN__ = 't'; globalThis.__ROLE__ = 'scanner'; globalThis.__ME_FAILS__ = true
  const a = useAuthStore(); a.token = 't'; a.user = null
  await router.replace('/receipt-share').catch(() => {})
  await new Promise((r) => setTimeout(r, 0))
  const ok = String(router.currentRoute.value.name) === 'receipt-share'
  check(ok, '无认证分享页被守卫挡了')
  console.log(`   ${ok ? '✓' : '✗'} 无认证分享页不走 /me（落 ${router.currentRoute.value.name}）`)
}

console.log(bad === 0 ? '\n✓ 全部一致' : `\n✗ ${bad} 处不一致`)
process.exit(bad ? 1 : 0)
