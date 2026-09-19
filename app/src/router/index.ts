import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { canAccessRoute, landingRouteName } from '../utils/roles'
import Clients from '../views/Clients.vue'
import Formulas from '../views/Formulas.vue'
import Home from '../views/Home.vue'
import Hui from '../views/Hui.vue'
import Login from '../views/Login.vue'
import Progress from '../views/Progress.vue'
import Qrscanner from '../views/Qrscanner.vue'
import ReceiptShare from '../views/ReceiptShare.vue'
import ReceiptView from '../views/ReceiptView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: Home, meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: Login },
    { path: '/formulas', name: 'formulas', component: Formulas, meta: { requiresAuth: true } },
    { path: '/clients', name: 'clients', component: Clients, meta: { requiresAuth: true } },
    { path: '/hui', name: 'hui', component: Hui, meta: { requiresAuth: true } },
    // 生产进度（旧版 `/Progress`）。⚠️ 旧版还有终端模式（同一页两套列），本版不做 ——
    // 那条接口在旧服务端是写死 400。见 docs/2026-09-19-progress-analysis.md §10。
    // 🔒 扫码账号看不见也进不去（旧版 `fe && !ve` 那条门控，见 `utils/roles.ts` 受限表）。
    { path: '/progress', name: 'progress', component: Progress, meta: { requiresAuth: true } },
    // 扫码生产（旧版 `/Qrscanner`）。整页已补齐（扫码录单/查单、统计看板、标签打印、
    // 设置工序）；**只有「扫码账号管理」是置灰的**（后端决定不做那条账号产品线，
    // 见 docs/2026-09-19-qrscanner-analysis.md §8.6-(d)）。清单见 `Qrscanner.vue` 文件头。
    { path: '/qrscanner', name: 'qrscanner', component: Qrscanner, meta: { requiresAuth: true } },
    // 电子回执单：`/receipt-view/:receiptNo` 已登录预览（旧版 ReceiptView），
    // `/receipt-share` 无认证分享页（旧版 ReceiptShare），令牌由后端签发、7 天有效。
    { path: '/receipt-view/:receiptNo', name: 'receipt-view', component: ReceiptView, meta: { requiresAuth: true } },
    { path: '/receipt-share', name: 'receipt-share', component: ReceiptShare },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // 角色门控要读 `auth.user.role`，但**刷新页面后 store 是空的** ——
  // 此前只有 `Home.vue` 自己在 onMounted 里补 `/me`，别的页面一直没补过。
  // 这里补一次：不补的话「刷新后在 `/progress`」就判不出角色，等于没挡。
  //
  // ⚠️ 只在**真需要判角色**的两种入口补：要登录的页面（门控）、已登录却访问登录页（定落地页）。
  //    无认证的分享页（`/receipt-share`）不补 —— 那是给客户看的，不该顺手要一次 `/me`。
  // ⚠️ 代价：刷新一个**自己也会 loadMe** 的页面（Home）时 `/me` 会走两趟（这里一趟、页面一趟）；
  //    登录后的跳转、页内跳转都不会多发（`auth.user` 已经有值）。
  const needsRole = to.meta.requiresAuth || to.name === 'login'
  if (needsRole && auth.token && !auth.user) {
    await auth.loadMe() // 令牌失效时它自己会 clear()，落到下面「未登录」那一支
  }

  if (to.meta.requiresAuth && !auth.token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && auth.token) {
    return { name: landingRouteName(auth.user?.role) }
  }
  // 角色门控 —— `utils/roles.ts` 那张表同时管导航显隐与本处拦截。
  // ★ 之所以必须在**路由**上再挡一次：只藏导航的话，直接敲 URL 就进来了。
  // ★ 这是**体验层不是授权**（前端改一行 JS 就能绕过），真正的授权在后端。
  if (to.meta.requiresAuth && !canAccessRoute(auth.user?.role, to.name)) {
    return { name: landingRouteName(auth.user?.role) }
  }
  return true
})

export default router
