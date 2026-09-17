<!--
  `/receipt-share?no=…&t=…` —— **无认证**的电子回执单分享页。

  对应旧版 `ReceiptShare-48082842.js`。旧版从 URL 拿 `receiptNo/ds/registrant` 后直连旧域名接口
  （`getorders` / `getuserconfig` / `finance_getOrderFinanceSummary`）现拼回执行；新版改为
  一次请求后端 `GET /api/v1/public/receipts?no=…&t=…`，令牌是后端 HMAC 签名的
  （`core/receipt_token.rs`，7 天有效），验签通过才返回数据。
-->
<template>
  <div class="receipt-share-page">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner" />
      <p>正在加载回执单...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <p class="error-message">{{ error }}</p>
      <n-button type="primary" @click="load">重新加载</n-button>
    </div>

    <ReceiptCard
      v-else-if="receipt && customerInfo"
      :info="customerInfo"
      :picture="picture"
      :finance="{ allocated_amount: receipt.allocated_amount, unpaid_amount: receipt.unpaid_amount }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NButton } from 'naive-ui'

import { api } from '../api/client'
import type { ReceiptDto } from '../api/types'
import ReceiptCard from '../components/ReceiptCard.vue'
import { buildReceiptCustomerInfo, buildReceiptPicture } from '../utils/receiptBuilder'

const route = useRoute()

const loading = ref(true)
const error = ref('')
const receipt = ref<ReceiptDto | null>(null)

const picture = computed(() => (receipt.value ? buildReceiptPicture(receipt.value.lines) : []))
const customerInfo = computed(() =>
  receipt.value
    ? buildReceiptCustomerInfo(receipt.value, receipt.value.declaration)
    : null,
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    // 旧版从 `route.params` 与 `route.query` **两处**取值（深链与 query 两种进来方式），照抄。
    const no = String(route.params.no ?? route.query.no ?? '')
    const t = String(route.params.t ?? route.query.t ?? '')
    if (!no || !t) throw new Error('缺少必要参数：回执单号或用户信息')
    receipt.value = await api.getPublicReceipt(no, t)
  } catch (e) {
    error.value = (e as Error).message || '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
/* 逐条照抄 legacy/css/ReceiptShare-494642c3.css */
.receipt-share-page {
  min-height: 100vh;
  background: #f5f5f5;
}
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: #666;
}
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}
@keyframes spin {
  0% {
    transform: rotate(0);
  }
  to {
    transform: rotate(360deg);
  }
}
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  text-align: center;
}
.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.error-message {
  color: #ff4d4f;
  font-size: 16px;
  margin-bottom: 20px;
}
</style>
