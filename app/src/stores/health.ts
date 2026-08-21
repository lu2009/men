import { defineStore } from 'pinia'
import { api } from '../api/client'
import type { HealthResponse } from '../api/types'

// 示例 Pinia store：演示状态管理骨架，后续按业务拆分。
export const useHealthStore = defineStore('health', {
  state: () => ({
    data: null as HealthResponse | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async refresh() {
      this.loading = true
      this.error = null
      try {
        this.data = await api.health()
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e)
      } finally {
        this.loading = false
      }
    },
  },
})
