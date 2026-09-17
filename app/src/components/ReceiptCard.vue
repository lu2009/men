<!--
  电子回执单卡片 —— 复刻旧版 `ReceiptMobile-2bb0962e.js`（同一组件被 `ReceiptView`（已登录）
  与 `ReceiptShare`（分享）复用，新版同样如此）。

  样式与类名**逐条照抄** `legacy/css/ReceiptMobile-4bd5d8bb.css`。

  与原版的三处**有意差异**：
  1. 去掉「查看3D」（原版按 `doorType` 为 swing/sliding 且门洞宽>0 时显示，挂 three.js 3D 预览）
     —— 新版没有 3D 模块，留一个点了没反应的按钮比没有更糟。
  2. 去掉「支付二维码」卡片：原版收款码来自 `getimage&param2=qrcode`（旧版服务端图片库），
     新版只在**各人本地 IndexedDB** 里存 `qrcode`，**分享页读不到分享者的浏览器**，
     故需要租户级收款码设置后才能做（见 `docs` 与记忆 `home-phase3-status`）。
     卡片结构保留在下方注释里，数据源一到位即可启用。
  3. 展开箭头挪进 `.door-main`：原版 DOM 上是 `.door-card` 的兄弟节点，而
     `.expand-indicator` 是 `position:absolute`、`.door-card` 又**没有** `position`，
     于是它的包含块一路退到视口 —— 箭头会飘到整页右侧中部。CSS 的意图显然是贴着这一行，
     故放进 `.door-main`（它本就 `position:relative`）。
-->
<template>
  <div class="receipt-mobile">
    <!-- 客户信息卡 -->
    <div class="customer-card">
      <div class="card-header">
        <div class="order-badge">订单详情</div>
        <span class="order-no">{{ info.orderNo }}</span>
      </div>
      <div class="card-body">
        <div class="info-row">
          <span class="label">客户</span>
          <span class="value">{{ info.client }}</span>
        </div>
        <div class="info-row">
          <span class="label">下单日期</span>
          <span class="value">{{ info.date }}</span>
        </div>
        <div v-if="info.安装地址" class="info-row">
          <span class="label">安装地址</span>
          <span class="value">{{ info.安装地址 }}</span>
        </div>
      </div>
    </div>

    <!-- 门项目明细 -->
    <div class="section-title">
      <i class="icon-door" />
      门项目明细
      <span class="count">共 {{ picture.length }} 项</span>
    </div>

    <div class="door-list">
      <div v-for="(d, i) in picture" :key="i" class="door-card">
        <div class="door-main" @click="toggle(i)">
          <div class="door-image">
            <img v-if="d.openImg" :src="d.openImg" alt="门型图" />
          </div>
          <div class="door-info">
            <div class="door-title" v-html="d.profile" />
            <div class="door-specs">
              <div class="spec-row">
                <span class="spec-label">开向</span>
                <span class="spec-value">{{ d.direction }}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">颜色</span>
                <span class="spec-value">{{ d.color }}</span>
              </div>
              <div class="spec-row spec-row-full">
                <span class="spec-label">玻璃</span>
                <span class="spec-value" v-html="d.glass" />
              </div>
              <div class="spec-row spec-row-full">
                <span class="spec-label">尺寸</span>
                <span class="spec-value spec-value-wrap">{{ d.size }}</span>
              </div>
            </div>
            <div class="door-footer">
              <div class="quantity">
                <span class="qty-label">数量</span>
                <span class="qty-value">× {{ d.quantity }}</span>
              </div>
              <div class="footer-right">
                <div
                  v-if="d.imageId || d.imageUrl"
                  class="image-indicator"
                  @click.stop="openImage(i)"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path
                      fill="currentColor"
                      d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                    />
                  </svg>
                  查看图片
                </div>
                <div class="price-info">
                  <span v-if="d.price !== '/'" class="unit-price">单价: ¥{{ d.price }}</span>
                  <span class="amount">¥{{ d.amount }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="expand-indicator" :class="{ expanded: expanded[i] }">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"
              />
            </svg>
          </div>
        </div>

        <div v-show="expanded[i]" class="door-expand">
          <div v-if="d.pricing" class="expand-section">
            <div class="expand-title">计价说明</div>
            <div class="expand-content" v-html="d.pricing" />
          </div>
          <div v-if="d.remark" class="expand-section">
            <div class="expand-title">备注</div>
            <div class="expand-content" v-html="d.remark" />
          </div>
          <div v-if="d.processing" class="expand-section processing-section">
            <div class="expand-title">生产进度</div>
            <div class="expand-content processing-status">{{ d.processing }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 费用汇总 -->
    <div class="summary-card">
      <div class="summary-title">费用汇总</div>
      <div class="summary-body">
        <div class="summary-row">
          <span class="summary-label">门数</span>
          <span class="summary-value">{{ info.门数 }} 套</span>
        </div>
        <div class="summary-row total">
          <span class="summary-label">合计金额</span>
          <span class="summary-value price">¥{{ info.total }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">已付款</span>
          <span class="summary-value">¥{{ summary.deposit }}</span>
        </div>
        <div class="summary-row balance">
          <span class="summary-label">待付款</span>
          <span class="summary-value price">¥{{ summary.balance }}</span>
        </div>
      </div>
    </div>

    <!-- 订单须知（旧版 = 租户 declaration || "含安装费"） -->
    <div v-if="info.declaration" class="declaration-card">
      <div class="declaration-title">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
          />
        </svg>
        订单须知
      </div>
      <div class="declaration-content">{{ info.declaration }}</div>
    </div>

    <div class="footer-safe">
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path
          fill="currentColor"
          d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
        />
      </svg>
      电子回执单 · 安全可信
    </div>

    <!-- 门图预览 -->
    <div v-if="viewing" class="image-overlay" @click="viewing = ''">
      <div class="image-container" @click.stop>
        <img :src="viewing" alt="门图片" />
        <div class="close-btn" @click="viewing = ''">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import type { ReceiptCustomerInfo, ReceiptPictureLine } from '../utils/receiptBuilder'
import { idbGetImage } from '../utils/imageStore'

const props = defineProps<{
  info: ReceiptCustomerInfo
  picture: ReceiptPictureLine[]
  /**
   * 财务口径覆盖（复刻原版 `ReceiptMobile` 的 `he` + `Ye` computed）：
   * 拿到 `已分配金额` 时，用 `已付款 = 已分配金额`、`待付款 = 未收金额` 覆盖 `customerInfo` 里的
   * 定金 / 总价−定金。`allocated_amount` 为 null 或整体为 null 时保持 customerInfo 原值。
   */
  finance?: { allocated_amount: number | null; unpaid_amount: number | null } | null
}>()

const expanded = reactive<Record<number, boolean>>({})
props.picture.forEach((_, i) => {
  expanded[i] = true
})

function toggle(i: number) {
  expanded[i] = !expanded[i]
}

const summary = computed(() => {
  const f = props.finance
  if (f && f.allocated_amount !== null) {
    return { deposit: f.allocated_amount, balance: f.unpaid_amount ?? 0 }
  }
  return { deposit: props.info.deposit, balance: props.info.balance }
})

// 门图：优先落库的 `image_url`（新版持久化），回退本地 IndexedDB 里的 `imageId`
// （原版 `imageId` → 服务端取图；新版服务端无图片库，等价物就是本机 IDB）。
const viewing = ref('')
async function openImage(i: number) {
  const d = props.picture[i]
  if (d.imageUrl) {
    viewing.value = d.imageUrl
    return
  }
  if (!d.imageId) return
  const url = await idbGetImage(d.imageId)
  if (url) viewing.value = url
}
</script>

<!-- 样式逐条照抄 legacy/css/ReceiptMobile-4bd5d8bb.css（去掉与 3D 相关的 .door3d-*/.view-3d-btn） -->
<style scoped>
.receipt-mobile {
  min-height: 100vh;
  background: linear-gradient(180deg, #f0f5ff 0%, #f5f5f5 100%);
  padding: 12px 12px 80px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    sans-serif;
}
.customer-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  color: #fff;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}
.order-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}
.order-no {
  font-size: 14px;
  opacity: 0.9;
}
.card-body .info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}
.card-body .label {
  font-size: 14px;
  opacity: 0.8;
}
.card-body .value {
  font-size: 14px;
  font-weight: 500;
}
.card-body .value.tel {
  color: gold;
}
.card-body .value.highlight {
  color: gold;
  font-weight: 600;
}
.section-title {
  display: flex;
  align-items: center;
  padding: 16px 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}
.section-title .icon-door {
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  margin-right: 8px;
}
.section-title .count {
  margin-left: auto;
  font-size: 12px;
  color: #999;
  font-weight: 400;
}
.door-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.door-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.door-main {
  display: flex;
  padding: 16px;
  cursor: pointer;
  position: relative;
}
.door-image {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  background: #f8f9fa;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  position: relative;
}
.door-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.door-info {
  flex: 1;
  margin-left: 12px;
  min-width: 0;
}
.door-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  line-height: 1.4;
}
.door-specs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
}
.spec-row {
  display: flex;
  font-size: 16px;
}
.spec-row-full {
  grid-column: 1 / -1;
}
.spec-label {
  color: #999;
  margin-right: 6px;
  flex-shrink: 0;
  font-size: 14px;
}
.spec-value {
  color: #666;
  font-size: 16px;
}
.spec-value-wrap {
  word-break: break-all;
  line-height: 1.5;
}
.door-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #eee;
}
.quantity {
  font-size: 14px;
}
.qty-label {
  color: #999;
}
.qty-value {
  color: #333;
  font-weight: 500;
  margin-left: 4px;
}
.price-info {
  text-align: right;
}
.unit-price {
  font-size: 13px;
  color: #999;
  margin-right: 8px;
}
.amount {
  font-size: 18px;
  font-weight: 600;
  color: #ff4d4f;
}
.expand-indicator {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #ccc;
  transition: transform 0.3s;
}
.expand-indicator.expanded {
  transform: translateY(-50%) rotate(180deg);
}
.door-expand {
  background: #fafafa;
  padding: 0 16px 16px;
}
.expand-section {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  margin-top: 8px;
}
.expand-title {
  font-size: 14px;
  color: #999;
  margin-bottom: 8px;
  font-weight: 500;
}
.expand-content {
  font-size: 15px;
  color: #666;
  line-height: 1.8;
}
.expand-content br {
  display: block;
  margin: 4px 0;
}
.processing-section {
  background: #f0f9eb;
  border-left: 3px solid #67c23a;
}
.processing-status {
  color: #67c23a;
  font-weight: 500;
}
.summary-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.summary-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}
.summary-label {
  font-size: 14px;
  color: #666;
}
.summary-value {
  font-size: 14px;
  color: #333;
}
.summary-value.price {
  font-size: 20px;
  font-weight: 600;
  color: #ff4d4f;
}
.summary-row.total {
  background: linear-gradient(90deg, #fff5f5 0%, #fff 100%);
  margin: 8px -16px;
  padding: 14px 16px;
}
.summary-row.balance {
  border-top: 1px dashed #eee;
  margin-top: 8px;
  padding-top: 14px;
}
.declaration-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.declaration-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}
.declaration-title svg {
  color: #faad14;
}
.declaration-content {
  font-size: 12px;
  color: #999;
  line-height: 1.8;
  white-space: pre-line;
}
.footer-safe {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px 0;
  font-size: 12px;
  color: #bbb;
}
.footer-safe svg {
  color: #52c41a;
}
.footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.image-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #e6f7ff;
  border-radius: 4px;
  color: #1890ff;
  font-size: 12px;
  cursor: pointer;
}
.image-indicator:active {
  background: #bae7ff;
}
.image-indicator svg {
  flex-shrink: 0;
}
.image-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}
.image-container img {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
}
.close-btn {
  position: absolute;
  top: -40px;
  right: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  cursor: pointer;
  color: #fff;
}
.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}
@media (max-width: 375px) {
  .receipt-mobile {
    padding: 10px;
  }
  .door-image {
    width: 70px;
    height: 70px;
  }
  .door-specs {
    grid-template-columns: 1fr;
  }
  .amount {
    font-size: 16px;
  }
}
</style>
