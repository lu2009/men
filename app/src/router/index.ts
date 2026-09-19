import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
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
    { path: '/progress', name: 'progress', component: Progress, meta: { requiresAuth: true } },
    // 扫码生产（旧版 `/Qrscanner`）。⚠️ **本版只做了「设置工序」**（工序名的唯一配置入口，
    // Progress 的「更新进度」下拉靠它）；扫码/看板/标签打印/账号管理都没做，
    // 清单见 `Qrscanner.vue` 文件头的「⏳ 还没做」。
    { path: '/qrscanner', name: 'qrscanner', component: Qrscanner, meta: { requiresAuth: true } },
    // 电子回执单：`/receipt-view/:receiptNo` 已登录预览（旧版 ReceiptView），
    // `/receipt-share` 无认证分享页（旧版 ReceiptShare），令牌由后端签发、7 天有效。
    { path: '/receipt-view/:receiptNo', name: 'receipt-view', component: ReceiptView, meta: { requiresAuth: true } },
    { path: '/receipt-share', name: 'receipt-share', component: ReceiptShare },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && auth.token) {
    return { name: 'home' }
  }
  return true
})

export default router
