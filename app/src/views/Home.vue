<template>
  <div class="page">
    <n-card class="card">
      <template #header>
        <div class="header">
          <span class="title">智能门窗 · 脚手架</span>
          <div class="user-box">
            <n-tag v-if="auth.user" type="info">
              {{ auth.user.name }}（{{ auth.tenant?.name }}）
            </n-tag>
            <n-button size="small" :loading="health.loading" @click="health.refresh()">
              刷新状态
            </n-button>
            <n-button size="small" type="error" @click="onLogout">退出登录</n-button>
          </div>
        </div>
      </template>

      <n-descriptions :column="1" bordered>
        <n-descriptions-item label="前端">
          <n-tag type="success">Vue 3 + TypeScript + Vite + Naive UI</n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="后端">
          <n-tag :type="health.data ? 'success' : 'default'">
            {{ health.data ? `已连通（${health.data.service}）` : '未连接' }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="数据库">
          <n-tag :type="health.data?.db === 'connected' ? 'success' : 'warning'">
            {{ health.data?.db === 'connected' ? '已连通（PostgreSQL）' : '未连通' }}
          </n-tag>
        </n-descriptions-item>
      </n-descriptions>

      <n-alert v-if="health.error" class="alert" type="error" title="无法连接后端">
        {{ health.error }} —— 请确认已启动 PostgreSQL 与后端服务。
      </n-alert>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useHealthStore } from '../stores/health'

const router = useRouter()
const auth = useAuthStore()
const health = useHealthStore()

onMounted(async () => {
  // 刷新当前用户/租户；令牌失效则跳回登录。
  const ok = await auth.loadMe()
  if (!ok) {
    router.push({ name: 'login' })
    return
  }
  health.refresh()
})

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  padding: 24px;
}
.card {
  width: 100%;
  max-width: 560px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.user-box {
  display: flex;
  align-items: center;
  gap: 8px;
}
.alert {
  margin-top: 16px;
}
</style>
