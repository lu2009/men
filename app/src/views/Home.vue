<template>
  <div class="page">
    <n-card class="card" title="智能门窗 · 脚手架">
      <template #header-extra>
        <n-button size="small" :loading="store.loading" @click="store.refresh()">
          刷新
        </n-button>
      </template>

      <n-descriptions :column="1" bordered>
        <n-descriptions-item label="前端">
          <n-tag type="success">Vue 3 + TypeScript + Vite + Naive UI</n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="后端">
          <n-tag :type="store.data ? 'success' : 'default'">
            {{ store.data ? `已连通（${store.data.service}）` : '未连接' }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="数据库">
          <n-tag :type="store.data?.db === 'connected' ? 'success' : 'warning'">
            {{ store.data?.db === 'connected' ? '已连通（PostgreSQL）' : '未连通' }}
          </n-tag>
        </n-descriptions-item>
      </n-descriptions>

      <n-alert
        v-if="store.error"
        class="alert"
        type="error"
        title="无法连接后端"
      >
        {{ store.error }} —— 请确认已启动 PostgreSQL 与后端服务。
      </n-alert>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useHealthStore } from '../stores/health'

const store = useHealthStore()

onMounted(() => {
  store.refresh()
})
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
.alert {
  margin-top: 16px;
}
</style>
