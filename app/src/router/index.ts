import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Clients from '../views/Clients.vue'
import Formulas from '../views/Formulas.vue'
import Home from '../views/Home.vue'
import Hui from '../views/Hui.vue'
import Login from '../views/Login.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: Home, meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: Login },
    { path: '/formulas', name: 'formulas', component: Formulas, meta: { requiresAuth: true } },
    { path: '/clients', name: 'clients', component: Clients, meta: { requiresAuth: true } },
    { path: '/hui', name: 'hui', component: Hui, meta: { requiresAuth: true } },
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
