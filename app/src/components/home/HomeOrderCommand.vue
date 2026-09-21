<template>
  <section class="order-command" aria-labelledby="order-command-title">
    <header class="order-command__header">
      <div class="order-command__identity">
        <div class="order-command__mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none">
            <path d="M11 13.5h26M11 24h26M11 34.5h26" />
            <circle cx="16" cy="13.5" r="3" />
            <circle cx="31" cy="24" r="3" />
            <circle cx="21" cy="34.5" r="3" />
          </svg>
        </div>
        <div class="order-command__copy">
          <span class="order-command__eyebrow">PRODUCTION LEDGER · 订单运营</span>
          <h1 id="order-command-title">订单工作台</h1>
          <p>检索、筛选并批量处理当前生产订单</p>
        </div>
      </div>

      <nav class="order-command__primary-nav" aria-label="订单快捷入口">
        <n-button secondary @click="emit('open-dashboard')">经营看板</n-button>
      </nav>
    </header>

    <div class="order-command__search-row">
      <n-input
        class="order-command__search"
        :value="search"
        size="large"
        placeholder="搜索客户、安装地址等"
        clearable
        @update:value="emit('update:search', $event)"
      >
        <template #prefix>
          <svg class="order-command__search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.3" />
            <path d="m15.5 15.5 4.2 4.2" />
          </svg>
        </template>
      </n-input>

      <div class="order-command__search-actions">
        <n-button secondary @click="emit('open-query')">查询更多</n-button>
        <n-button :loading="loading" @click="emit('refresh')">刷新</n-button>
      </div>

      <nav class="order-command__utility-nav" aria-label="账户操作">
        <n-button quaternary type="error" @click="emit('logout')">退出登录</n-button>
      </nav>
    </div>

    <!--
      保留旧版汇总条的二选一条件与完整字段集：有搜索词显示“当前筛选”，否则仅在原始列表非空时
      显示“总计”；两种情形都继续使用筛选后列表的汇总值。
    -->
    <div v-if="search.trim() || rawCount > 0" class="order-command__summary" aria-label="订单汇总">
      <div class="order-command__summary-context">
        <span>{{ search.trim() ? '当前筛选' : '订单台账' }}</span>
        <strong :title="search.trim() || '全部订单'">
          {{ search.trim() || '全部订单' }}
        </strong>
        <em>{{ filteredCount }} 条{{ search.trim() ? '结果' : '记录' }}</em>
      </div>

      <dl class="order-command__metrics">
        <div class="order-command__metric order-command__metric--time">
          <dt>时间范围</dt>
          <dd>{{ summary.earliest || '—' }} <span>至</span> {{ summary.latest || '—' }}</dd>
        </div>
        <div class="order-command__metric">
          <dt>门数</dt>
          <dd>{{ summary.doors }}</dd>
        </div>
        <div class="order-command__metric">
          <dt>总价</dt>
          <dd>¥ {{ fmt(summary.total) }}</dd>
        </div>
        <div class="order-command__metric order-command__metric--paid">
          <dt>已付</dt>
          <dd>¥ {{ fmt(summary.paid) }}</dd>
        </div>
        <div class="order-command__metric order-command__metric--unpaid">
          <dt>未付</dt>
          <dd>¥ {{ fmt(summary.unpaid) }}</dd>
        </div>
        <div class="order-command__metric">
          <dt>未付单数</dt>
          <dd>{{ summary.unpaidCount }}</dd>
        </div>
        <div class="order-command__metric order-command__metric--audit">
          <dt>未审核</dt>
          <dd>{{ summary.unaudited }}</dd>
        </div>
      </dl>
    </div>

    <div class="order-command__batch-row">
      <div class="order-command__selection" aria-live="polite">
        <span class="order-command__selection-dot" :class="{ 'is-active': selectedCount > 0 }"></span>
        <div>
          <span>批量处理</span>
          <strong v-if="selectedCount">已选择 {{ selectedCount }} 条订单</strong>
          <strong v-else>选择订单后执行打印、清账或合并</strong>
        </div>
      </div>

      <div class="order-command__batch-actions" aria-label="订单批量操作">
        <n-button
          :type="onlyUnproduced ? 'warning' : 'default'"
          :secondary="onlyUnproduced"
          @click="emit('toggle-unproduced')"
        >
          {{ onlyUnproduced ? '未生产' : '显示全部' }}
        </n-button>
        <n-button
          :type="selectedCount ? 'primary' : 'default'"
          :secondary="selectedCount > 0"
          @click="emit('print-selected')"
        >
          打印{{ selectedCount ? `（${selectedCount}）` : '' }}
        </n-button>
        <n-button type="success" secondary @click="emit('clear-accounts')">清账</n-button>
        <!-- 旧版行为：合并入口只在选中至少两条订单时出现。 -->
        <n-button
          v-if="selectedCount > 1"
          type="warning"
          secondary
          @click="emit('combine-selected')"
        >
          合并（{{ selectedCount }}）
        </n-button>
        <n-button type="error" quaternary @click="emit('delete-selected')">删除选中</n-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { NButton, NInput } from 'naive-ui'
import { fmt } from '../../utils/homeMetrics'

interface OrderSummaryView {
  earliest: string
  latest: string
  doors: number
  total: number
  paid: number
  unpaid: number
  unpaidCount: number
  unaudited: number
}

defineProps<{
  loading: boolean
  onlyUnproduced: boolean
  selectedCount: number
  search: string
  filteredCount: number
  rawCount: number
  summary: OrderSummaryView
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  refresh: []
  'open-query': []
  'toggle-unproduced': []
  'print-selected': []
  'delete-selected': []
  'clear-accounts': []
  'combine-selected': []
  'open-dashboard': []
  logout: []
}>()
</script>

<style scoped>
.order-command {
  position: relative;
  overflow: hidden;
  flex: 0 0 auto;
  border: var(--sd-border-width) solid var(--sd-border-glass-strong);
  border-radius: var(--sd-radius-material);
  background: var(--sd-material-surface);
  box-shadow: var(--sd-shadow-material-card);
  backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
  -webkit-backdrop-filter: blur(var(--sd-glass-blur-md)) saturate(var(--sd-glass-saturation));
  animation: order-command-enter var(--sd-duration-enter) var(--sd-ease-enter) both;
}

.order-command::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: var(--sd-material-highlight-strong);
  pointer-events: none;
}

.order-command__header,
.order-command__search-row,
.order-command__batch-row {
  display: flex;
  align-items: center;
}

.order-command__header {
  justify-content: space-between;
  gap: var(--sd-space-6);
  padding: var(--sd-space-4) var(--sd-space-5);
}

.order-command__identity {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--sd-space-4);
}

.order-command__mark {
  display: grid;
  place-items: center;
  flex: 0 0 54px;
  width: 54px;
  height: 54px;
  border: var(--sd-border-width) solid var(--sd-border-action-subtle);
  border-radius: var(--sd-radius-control);
  color: var(--sd-color-action);
  background: var(--sd-material-brand-chip);
  box-shadow: var(--sd-shadow-brand-mark);
}

.order-command__mark svg {
  width: 32px;
  height: 32px;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.order-command__mark circle {
  fill: var(--sd-color-bg-surface);
}

.order-command__copy {
  min-width: 0;
}

.order-command__eyebrow {
  display: block;
  overflow: hidden;
  color: var(--sd-color-action);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-bold);
  letter-spacing: var(--sd-letter-spacing-eyebrow);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-command__copy h1 {
  margin: 3px 0 1px;
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-xl);
  font-weight: var(--sd-font-weight-bold);
  line-height: var(--sd-line-height-tight);
  letter-spacing: -0.02em;
}

.order-command__copy p {
  margin: 0;
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-xs);
  line-height: var(--sd-line-height-base);
}

.order-command__primary-nav,
.order-command__search-actions,
.order-command__utility-nav,
.order-command__batch-actions {
  display: flex;
  align-items: center;
  gap: var(--sd-space-2);
}

.order-command__search-row {
  gap: var(--sd-space-3);
  padding: var(--sd-space-3) var(--sd-space-5);
  border-top: var(--sd-border-width) solid var(--sd-border-glass-divider);
  border-bottom: var(--sd-border-width) solid var(--sd-border-glass-divider);
  background: var(--sd-material-surface-subtle);
}

.order-command__search {
  flex: 1 1 360px;
  max-width: 620px;
}

.order-command__search-icon {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.order-command__utility-nav {
  margin-left: auto;
}


.order-command__summary {
  display: grid;
  grid-template-columns: minmax(150px, 0.9fr) minmax(0, 5fr);
  align-items: stretch;
  border-bottom: var(--sd-border-width) solid var(--sd-border-glass-divider);
}

.order-command__summary-context {
  display: grid;
  align-content: center;
  min-width: 0;
  gap: 1px;
  padding: var(--sd-space-3) var(--sd-space-5);
  border-right: var(--sd-border-width) solid var(--sd-border-glass-divider);
  background: var(--sd-material-highlight-faint);
}

.order-command__summary-context span,
.order-command__metric dt,
.order-command__selection span:not(.order-command__selection-dot) {
  color: var(--sd-color-text-muted);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-strong);
  letter-spacing: 0.04em;
}

.order-command__summary-context strong {
  overflow: hidden;
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-command__summary-context em {
  color: var(--sd-color-action);
  font-size: var(--sd-font-size-xs);
  font-style: normal;
  font-weight: var(--sd-font-weight-bold);
}

.order-command__metrics {
  display: grid;
  grid-template-columns: minmax(180px, 1.5fr) repeat(6, minmax(82px, 1fr));
  min-width: 0;
  margin: 0;
}

.order-command__metric {
  display: grid;
  align-content: center;
  min-width: 0;
  gap: 2px;
  padding: var(--sd-space-3) var(--sd-space-4);
  border-right: var(--sd-border-width) solid var(--sd-border-glass-divider);
}

.order-command__metric:last-child {
  border-right: 0;
}

.order-command__metric dd {
  overflow: hidden;
  margin: 0;
  color: var(--sd-color-text-strong);
  font-family: var(--sd-font-data);
  font-size: var(--sd-font-size-sm);
  font-weight: var(--sd-font-weight-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-command__metric dd span {
  color: var(--sd-color-text-disabled);
  font-family: var(--sd-font-sans);
  font-size: var(--sd-font-size-2xs);
  font-weight: var(--sd-font-weight-regular);
}

.order-command__metric--paid dd {
  color: var(--sd-color-process);
}

.order-command__metric--unpaid dd,
.order-command__metric--audit dd {
  color: var(--sd-color-danger);
}

.order-command__batch-row {
  justify-content: space-between;
  gap: var(--sd-space-5);
  padding: var(--sd-space-3) var(--sd-space-5);
  background: var(--sd-material-surface-strong);
}

.order-command__selection {
  display: flex;
  align-items: center;
  min-width: 220px;
  gap: var(--sd-space-3);
}

.order-command__selection > div {
  display: grid;
  gap: 1px;
}

.order-command__selection strong {
  color: var(--sd-color-text-strong);
  font-size: var(--sd-font-size-xs);
  font-weight: var(--sd-font-weight-medium);
}

.order-command__selection-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--sd-radius-pill);
  background: var(--sd-color-text-disabled);
  box-shadow: var(--sd-shadow-status-soft);
  transition:
    background var(--sd-duration-base) var(--sd-ease-standard),
    box-shadow var(--sd-duration-base) var(--sd-ease-standard),
    transform var(--sd-duration-fast) var(--sd-ease-standard);
}

.order-command__selection-dot.is-active {
  background: var(--sd-color-action);
  box-shadow: var(--sd-focus-ring-soft);
  transform: scale(1.08);
}

.order-command :deep(.n-button),
.order-command :deep(.n-input) {
  border-radius: var(--sd-radius-control);
}

.order-command :deep(.n-button) {
  font-weight: var(--sd-font-weight-medium);
  transition:
    transform var(--sd-duration-fast) var(--sd-ease-standard),
    box-shadow var(--sd-duration-fast) var(--sd-ease-standard),
    background-color var(--sd-duration-fast) var(--sd-ease-standard),
    color var(--sd-duration-fast) var(--sd-ease-standard);
}

.order-command :deep(.n-button:not(.n-button--disabled):hover) {
  transform: translateY(var(--sd-motion-hover-y));
}

.order-command :deep(.n-button:not(.n-button--disabled):active) {
  transform: scale(var(--sd-motion-press-scale));
}

.order-command :deep(.n-input) {
  background: var(--sd-material-control);
  transition:
    background-color var(--sd-duration-fast) var(--sd-ease-standard),
    box-shadow var(--sd-duration-fast) var(--sd-ease-standard);
}

.order-command :deep(.n-input:hover) {
  background: var(--sd-material-control-hover);
}

.order-command :deep(.n-input.n-input--focus) {
  background: var(--sd-material-control-focus);
  box-shadow: var(--sd-focus-ring-soft);
}

@keyframes order-command-enter {
  from {
    opacity: 0;
    transform: translateY(var(--sd-motion-enter-y));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1180px) {
  .order-command__search-row {
    flex-wrap: wrap;
  }

  .order-command__search {
    max-width: none;
  }

  .order-command__utility-nav {
    width: 100%;
    margin-left: 0;
    padding-top: var(--sd-space-2);
    border-top: var(--sd-border-width) solid var(--sd-border-glass-divider);
  }

  .order-command__metrics {
    overflow-x: auto;
    grid-template-columns: 180px repeat(6, minmax(90px, 1fr));
    scrollbar-width: thin;
  }
}

@media (max-width: 900px) {
  .order-command__header {
    align-items: flex-start;
  }

  .order-command__summary {
    grid-template-columns: 150px minmax(0, 1fr);
  }

  .order-command__batch-row {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--sd-space-3);
  }

  .order-command__batch-actions {
    overflow-x: auto;
    width: 100%;
    padding-bottom: 2px;
    scrollbar-width: thin;
  }

  .order-command__batch-actions :deep(.n-button) {
    flex: 0 0 auto;
  }
}

@media (max-width: 640px) {
  .order-command {
    border-radius: var(--sd-radius-card);
  }

  .order-command__header {
    flex-direction: column;
    gap: var(--sd-space-3);
    padding: var(--sd-space-4);
  }

  .order-command__primary-nav {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
  }

  .order-command__primary-nav :deep(.n-button) {
    width: 100%;
  }

  .order-command__search-row,
  .order-command__batch-row {
    padding-right: var(--sd-space-4);
    padding-left: var(--sd-space-4);
  }

  .order-command__search {
    flex-basis: 100%;
  }

  .order-command__search-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .order-command__search-actions :deep(.n-button) {
    width: 100%;
  }

  .order-command__utility-nav {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .order-command__utility-nav::-webkit-scrollbar {
    display: none;
  }

  .order-command__utility-nav :deep(.n-button) {
    flex: 0 0 auto;
  }

  .order-command__summary {
    grid-template-columns: 132px minmax(0, 1fr);
  }

  .order-command__summary-context {
    padding-right: var(--sd-space-3);
    padding-left: var(--sd-space-4);
  }

  .order-command__metric {
    padding-right: var(--sd-space-3);
    padding-left: var(--sd-space-3);
  }
}

@media (max-width: 420px) {
  .order-command__mark {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
  }

  .order-command__mark svg {
    width: 28px;
    height: 28px;
  }

  .order-command__copy h1 {
    font-size: var(--sd-font-size-lg);
  }

  .order-command__copy p {
    font-size: var(--sd-font-size-2xs);
  }

  .order-command__summary {
    grid-template-columns: 118px minmax(0, 1fr);
  }

  .order-command__summary-context {
    padding-left: var(--sd-space-3);
  }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .order-command {
    background: var(--sd-material-fallback);
  }
}

@media (prefers-reduced-motion: reduce) {
  .order-command {
    animation: none;
  }

  .order-command :deep(.n-button),
  .order-command :deep(.n-input),
  .order-command__selection-dot {
    transition: none;
  }
}
</style>
