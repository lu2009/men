<!--
  `/receipt-view/:receiptNo` —— **已登录**的电子回执单预览页。

  对应旧版 `ReceiptView-2e239d4a.js`。旧版右上角是一个「✕」直接跳 `/terminal-orders`；
  新版改为「复制分享链接」+「返回订单」两个动作 —— 因为旧版那个 ✕ 指向的终端订单页新版没有，
  而「把这个回执发给客户」才是这张页面真正要干的事。
-->
<template>
  <div class="receipt-view">
    <div class="close-btn" title="关闭" @click="close">✕</div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner" />
      <div class="loading-text">加载回执单中...</div>
    </div>

    <div v-else-if="error" class="error-container">
      <div class="error-icon">❌</div>
      <div class="error-text">{{ error }}</div>
      <n-button type="primary" @click="load">重试</n-button>
    </div>

    <div v-else-if="receipt && customerInfo" class="receipt-container">
      <div class="share-bar">
        <n-button size="small" :loading="sharing" @click="copyShareLink">复制分享链接</n-button>
        <span v-if="shareHint" class="share-hint">{{ shareHint }}</span>
      </div>
      <ReceiptCard
        :info="customerInfo"
        :picture="picture"
        :finance="{
          allocated_amount: receipt.allocated_amount,
          unpaid_amount: receipt.unpaid_amount,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, useMessage } from 'naive-ui'

import { api } from '../api/client'
import type { ReceiptDto } from '../api/types'
import ReceiptCard from '../components/ReceiptCard.vue'
import { buildReceiptCustomerInfo, buildReceiptPicture } from '../utils/receiptBuilder'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const loading = ref(true)
const error = ref('')
const receipt = ref<ReceiptDto | null>(null)
const sharing = ref(false)
const shareHint = ref('')

const picture = computed(() => (receipt.value ? buildReceiptPicture(receipt.value.lines) : []))
const customerInfo = computed(() =>
  receipt.value
    ? buildReceiptCustomerInfo(receipt.value, receipt.value.declaration)
    : null,
)

async function load() {
  const receiptNo = String(route.params.receiptNo ?? '')
  if (!receiptNo) {
    error.value = '未找到回执单号'
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    receipt.value = await api.getReceipt(receiptNo)
  } catch (e) {
    error.value = (e as Error).message || '获取回执单失败，请重试'
  } finally {
    loading.value = false
  }
}

/** 关闭 → 回订单管理页（旧版跳的是 `/terminal-orders`，新版没有该页）。 */
function close() {
  router.push({ name: 'home' })
}

/**
 * 复制分享链接。链接在后端签发令牌后由**前端**拼 origin —— 后端不知道对外域名
 * （本地 5173 / Tauri / 正式域名各不同），这比让后端猜一个可靠。
 */
async function copyShareLink() {
  const receiptNo = String(route.params.receiptNo ?? '')
  if (!receiptNo) return
  sharing.value = true
  try {
    const { token, expires_at } = await api.shareReceipt(receiptNo)
    const url = `${window.location.origin}/receipt-share?no=${encodeURIComponent(receiptNo)}&t=${encodeURIComponent(token)}`
    const until = new Date(expires_at * 1000).toLocaleDateString()
    try {
      await navigator.clipboard.writeText(url)
      shareHint.value = `链接已复制（有效期至 ${until}）`
      message.success('电子回执单链接已复制')
    } catch {
      // 剪贴板不可用（非 https / 无权限）时退化为直接展示链接，别让用户拿不到。
      shareHint.value = url
      message.warning('剪贴板不可用，已展示链接')
    }
  } catch (e) {
    message.error((e as Error).message || '生成分享链接失败')
  } finally {
    sharing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
/* 逐条照抄 legacy/css/ReceiptView-fb313d57.css，另加「复制分享链接」工具条 */
.receipt-view {
  min-height: 100vh;
  background: #f5f5f5;
  position: relative;
}
.close-btn {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 1000;
  transition: background 0.2s;
}
.close-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}
.close-btn span {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}
.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% {
    transform: rotate(0);
  }
  to {
    transform: rotate(360deg);
  }
}
.loading-text {
  margin-top: 20px;
  font-size: 18px;
  color: #fff;
  font-weight: 500;
}
.share-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 12px 0;
}
.share-hint {
  font-size: 12px;
  color: #666;
  word-break: break-all;
}
.receipt-container {
  padding: 0;
}
.error-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}
.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}
.error-text {
  font-size: 16px;
  color: #666;
  margin-bottom: 20px;
  text-align: center;
}
</style>
