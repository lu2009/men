import { defineStore } from 'pinia'
import { api, getToken, setToken } from '../api/client'
import type { TenantDto, UserDto } from '../api/types'

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
    /** 刷新当前用户/租户；令牌失效时清空并返回 false。 */
    async loadMe(): Promise<boolean> {
      try {
        const res = await api.me()
        this.user = res.user
        this.tenant = res.tenant
        return true
      } catch {
        this.clear()
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
