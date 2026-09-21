import { defineStore } from 'pinia'
import { api, getToken, setToken } from '../api/client'
import type { TenantDto, UserDto } from '../api/types'

/**
 * 服务端**明确拒绝了这个令牌**吗（401/403）。
 *
 * `api/client.ts` 的 `request()` 在非 2xx 时抛的错带 `status`；而 fetch 自己抛的
 * `TypeError`（**被导航掐掉**、网络故障、超时）**没有** `status` —— 那种一律不算拒绝。
 * 「没问到」与「你不配」是两回事，见 `loadMe` 的长注释。
 */
function isTokenRejected(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status
  return status === 401 || status === 403
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken() as string | null,
    user: null as UserDto | null,
    tenant: null as TenantDto | null,
    initialized: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
  },
  actions: {
    async login(username: string, password: string) {
      const res = await api.login({ username, password })
      setToken(res.token)
      this.token = res.token
      this.user = res.user
      this.tenant = res.tenant
    },
    /**
     * 刷新当前用户/租户。**只有服务端明确说这令牌不认**（401/403）才清空本地态。
     *
     * ── ★ 为什么不能「任何异常都 clear()」──────────────────────────────────────
     * `clear()` 把令牌从 `localStorage` **删掉**（`setToken(null)`），而那是**持久**的：
     * 下一个文档读到的就是「没登录」。可「请求压根没拿到响应」跟「令牌失效」是两回事，
     * 最常见的来源是**整文档导航把在飞的 fetch 掐掉**（按 F5、`page.goto`、点外链）。
     *
     * 实测那条链（E2E `auth.spec.ts` 最后一条钉住的就是它）：
     * 登录后落地页 `onMounted` 补的那次 `/me` **还在飞** ⇒ 刷新把它掐掉 ⇒ 原先这里
     * `clear()` ⇒ 新文档 `token === null` ⇒ 路由守卫直接弹 `/login`。
     * 也就是**登录后手快按一下刷新就会被登出**，而且后端越慢越容易中。
     *
     * 网络故障 / 5xx 同理不该**注销**会话：那是「这次没问到」，不是「你不配」。
     * 清令牌只留给服务端明确拒绝（`isTokenRejected`）。
     *
     * ⚠️ 返回值仍是「这次有没有拿到用户」——调用方（`Home.vue:543`）拿它决定要不要弹登录页，
     *    那条路径不受本改动影响；守卫那条只看 `auth.token`，令牌留着 ⇒ 不弹。
     */
    async loadMe(): Promise<boolean> {
      try {
        const res = await api.me()
        this.user = res.user
        this.tenant = res.tenant
        return true
      } catch (e) {
        if (isTokenRejected(e)) this.clear()
        return false
      } finally {
        this.initialized = true
      }
    },
    async logout() {
      try {
        await api.logout()
      } catch {
        // 服务端登出失败也继续清理本地态
      }
      this.clear()
    },
    clear() {
      setToken(null)
      this.token = null
      this.user = null
      this.tenant = null
      this.initialized = true
    },
  },
})
