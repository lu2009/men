<template>
  <div v-if="show" class="big-screen">
    <!-- 顶部：装饰 + 标题 + 关闭 -->
    <div class="bs-header">
      <div class="deco-line" />
      <div class="bs-title">经营数据驾驶舱</div>
      <div class="deco-line" />
      <button class="bs-close" @click="close">✕</button>
    </div>

    <!-- 筛选条 -->
    <div class="bs-filter">
      <div class="bs-chips">
        <button
          v-for="r in RANGES"
          :key="r"
          class="bs-chip"
          :class="{ active: range === r }"
          @click="range = r"
        >
          {{ r }}
        </button>
      </div>
      <select v-model="clientFilter" class="bs-select">
        <option value="">筛选客户</option>
        <option v-for="c in clientOptions" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="salesFilter" class="bs-select">
        <option value="">筛选业务员</option>
        <option v-for="s in salesOptions" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <!-- 主体 grid 1fr 2fr 1fr -->
    <div class="bs-main">
      <!-- 左：业务员排行 + 客户排行 -->
      <div class="bs-col">
        <div class="bs-panel">
          <div class="bs-panel-title">业务员排行</div>
          <div v-if="salesRank.length" class="rank-list">
            <div v-for="(r, i) in salesRank" :key="r.name" class="rank-item">
              <span class="rank-no" :class="`no${i + 1}`">{{ i + 1 }}</span>
              <span class="rank-name">{{ r.name }}</span>
              <div class="rank-bar"><div class="rank-fill" :style="{ width: barPct(r.amount, salesRank[0].amount) }" /></div>
              <span class="rank-val">¥{{ fmt(r.amount) }}</span>
            </div>
          </div>
          <div v-else class="empty">暂无数据</div>
        </div>

        <div class="bs-panel">
          <div class="bs-panel-title">客户排行</div>
          <div v-if="clientRank.length" class="rank-list">
            <div v-for="(r, i) in clientRank" :key="r.name" class="rank-item">
              <span class="rank-no" :class="`no${i + 1}`">{{ i + 1 }}</span>
              <span class="rank-name">{{ r.name }}</span>
              <div class="rank-bar"><div class="rank-fill" :style="{ width: barPct(r.amount, clientRank[0].amount) }" /></div>
              <span class="rank-val">¥{{ fmt(r.amount) }}</span>
            </div>
          </div>
          <div v-else class="empty">暂无数据</div>
        </div>
      </div>

      <!-- 中：数字翻牌 + 趋势 + 占比 -->
      <div class="bs-col center">
        <div class="digital-row">
          <div class="digital" style="color: #3de7c9">
            <div class="dig-num">{{ stats.count }}</div>
            <div class="dig-label">订单总数</div>
          </div>
          <div class="digital" style="color: #00d2ff">
            <div class="dig-num">{{ stats.doors }}</div>
            <div class="dig-label">订门总数</div>
          </div>
          <div class="digital" style="color: #409eff">
            <div class="dig-num">¥{{ fmt(stats.total) }}</div>
            <div class="dig-label">订单总金额</div>
          </div>
          <div class="digital" style="color: #67c23a">
            <div class="dig-num">¥{{ fmt(stats.paid) }}</div>
            <div class="dig-label">已付金额</div>
          </div>
          <div class="digital" style="color: #f56c6c">
            <div class="dig-num">¥{{ fmt(stats.unpaid) }}</div>
            <div class="dig-label">未付金额</div>
          </div>
        </div>

        <div class="bs-panel grow">
          <div class="bs-panel-title">每日订单趋势</div>
          <svg v-if="trendData.length >= 2" class="trend-svg" viewBox="0 0 100 42" preserveAspectRatio="none">
            <polyline :points="trendPoints" fill="none" stroke="#409eff" stroke-width="0.6" />
            <circle v-for="(p, i) in trendDots" :key="i" :cx="p[0]" :cy="p[1]" r="0.7" fill="#3de7c9" />
          </svg>
          <div v-else class="empty">数据不足</div>
          <div class="trend-axis">
            <span>{{ trendData[0]?.date || '' }}</span>
            <span>{{ trendData[trendData.length - 1]?.date || '' }}</span>
          </div>
        </div>

        <div class="bs-panel grow">
          <div class="bs-panel-title">客户金额占比</div>
          <div v-if="pieData.length" class="pie-wrap">
            <div class="pie" :style="{ background: pieStyle }"><div class="pie-hole" /></div>
            <div class="pie-legend">
              <div v-for="(p, i) in pieData" :key="p.name" class="legend-item">
                <i class="legend-dot" :style="{ background: PIE_COLORS[i % PIE_COLORS.length] }" />
                <span class="legend-name">{{ p.name }}</span>
                <span class="legend-val">¥{{ fmt(p.value) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="empty">暂无数据</div>
        </div>
      </div>

      <!-- 右：流程状态 + 最新订单 -->
      <div class="bs-col">
        <div class="bs-panel">
          <div class="bs-panel-title">流程状态</div>
          <div class="process-grid">
            <div class="process-cell entered">
              <div class="process-num">{{ processStats.entered }}</div>
              <div class="process-label">已进入流程</div>
            </div>
            <div class="process-cell not-entered">
              <div class="process-num">{{ processStats.notEntered }}</div>
              <div class="process-label">未进入流程</div>
            </div>
          </div>
        </div>

        <div class="bs-panel grow">
          <div class="bs-panel-title">最新订单</div>
          <div class="latest-list">
            <div v-for="(o, i) in latestOrders" :key="o.id" class="latest-item">
              <span class="latest-no">{{ i + 1 }}</span>
              <span class="latest-client">{{ o.client_name }}</span>
              <span class="latest-date">{{ o.order_date }}</span>
              <span class="latest-amount">¥{{ fmt(o.total_price) }}</span>
            </div>
          </div>
          <div v-if="!latestOrders.length" class="empty">暂无数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OrderSummaryDto } from '../api/types'

const props = defineProps<{
  show: boolean
  orders: OrderSummaryDto[]
}>()

const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

const RANGES = ['全部', '今天', '本周', '本月', '上月', '90天']
const PIE_COLORS = ['#3de7c9', '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#a855f7', '#00d2ff', '#f97316']

const range = ref('全部')
const clientFilter = ref('')
const salesFilter = ref('')

const fmt = (v: number) => (v ?? 0).toFixed(2)

function close() {
  emit('update:show', false)
}

// ---------------------------------------------------------------------------
// 日期区间过滤（§1.2）
// ---------------------------------------------------------------------------
function inRange(dateStr: string): boolean {
  if (range.value === '全部') return true
  if (!dateStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range.value === '今天') return d.getTime() === today.getTime()
  if (range.value === '本周') {
    const day = today.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(today.getTime() + mondayOffset * 86400000)
    return d.getTime() >= monday.getTime() && d.getTime() <= today.getTime()
  }
  if (range.value === '本月') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  if (range.value === '上月') {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth()
  }
  if (range.value === '90天') return d.getTime() >= today.getTime() - 90 * 86400000
  return true
}

const clientOptions = computed(() => [...new Set(props.orders.map((o) => o.client_name).filter(Boolean))].sort())
const salesOptions = computed(() => [...new Set(props.orders.map((o) => o.salesperson).filter(Boolean))].sort())

const filteredOrders = computed(() =>
  props.orders.filter((o) => {
    if (!inRange(o.order_date)) return false
    if (clientFilter.value && o.client_name !== clientFilter.value) return false
    if (salesFilter.value && o.salesperson !== salesFilter.value) return false
    return true
  }),
)

// ---------------------------------------------------------------------------
// 5 个数字翻牌（口径 §7：已付=Σ定金，未付=Σ总价−Σ定金）
// ---------------------------------------------------------------------------
const stats = computed(() => {
  const list = filteredOrders.value
  const total = list.reduce((s, o) => s + (o.total_price || 0), 0)
  const paid = list.reduce((s, o) => s + (o.deposit || 0), 0)
  return {
    count: list.length,
    doors: list.reduce((s, o) => s + (o.door_count || 0), 0),
    total,
    paid,
    unpaid: total - paid,
  }
})

// ---------------------------------------------------------------------------
// 排行
// ---------------------------------------------------------------------------
interface Rank {
  name: string
  count: number
  amount: number
}

function rankBy(field: 'salesperson' | 'client_name'): Rank[] {
  const map = new Map<string, Rank>()
  for (const o of filteredOrders.value) {
    const name = o[field] || '未填'
    const r = map.get(name) ?? { name, count: 0, amount: 0 }
    r.count++
    r.amount += o.total_price || 0
    map.set(name, r)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, 7)
}

const salesRank = computed(() => rankBy('salesperson'))
const clientRank = computed(() => rankBy('client_name'))

function barPct(v: number, max: number): string {
  if (max <= 0) return '0%'
  return `${Math.max(2, Math.round((v / max) * 100))}%`
}

// ---------------------------------------------------------------------------
// 每日订单趋势（按日计数，折线）
// ---------------------------------------------------------------------------
const trendData = computed(() => {
  const map = new Map<string, number>()
  for (const o of filteredOrders.value) {
    if (!o.order_date) continue
    map.set(o.order_date, (map.get(o.order_date) ?? 0) + 1)
  }
  return [...map.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
})

const trendPoints = computed(() => {
  const data = trendData.value
  if (data.length < 2) return ''
  const max = Math.max(...data.map((d) => d.count), 1)
  const w = 100
  const h = 40
  return data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - (d.count / max) * (h - 2) - 1
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
})

const trendDots = computed(() => {
  const data = trendData.value
  if (data.length < 2) return []
  const max = Math.max(...data.map((d) => d.count), 1)
  const w = 100
  const h = 40
  return data.map((d, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (d.count / max) * (h - 2) - 1
    return [x, y]
  })
})

// ---------------------------------------------------------------------------
// 客户金额占比（Top8，conic-gradient 饼图）
// ---------------------------------------------------------------------------
const pieData = computed(() => {
  const map = new Map<string, number>()
  for (const o of filteredOrders.value) {
    map.set(o.client_name || '未填', (map.get(o.client_name || '未填') ?? 0) + (o.total_price || 0))
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
})

const pieStyle = computed(() => {
  const data = pieData.value
  const total = data.reduce((s, p) => s + p.value, 0)
  if (total <= 0) return ''
  let acc = 0
  const stops = data.map((p, i) => {
    const start = (acc / total) * 360
    acc += p.value
    const end = (acc / total) * 360
    return `${PIE_COLORS[i % PIE_COLORS.length]} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`
  })
  return `conic-gradient(${stops.join(', ')})`
})

// ---------------------------------------------------------------------------
// 流程状态 + 最新订单
// ---------------------------------------------------------------------------
const processStats = computed(() => {
  let entered = 0
  let notEntered = 0
  for (const o of filteredOrders.value) {
    if (o.production_status && o.production_status.trim()) entered++
    else notEntered++
  }
  return { entered, notEntered }
})

const latestOrders = computed(() =>
  [...filteredOrders.value]
    .sort((a, b) => (b.order_date || '').localeCompare(a.order_date || '') || b.id - a.id)
    .slice(0, 10),
)
</script>

<style scoped>
.big-screen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  padding: 18px 24px;
  background: linear-gradient(180deg, #0d1b2a 0%, #1a2d42 50%, #0d1b2a 100%);
  color: #cfe3ff;
  overflow: hidden;
}
.bs-header {
  display: flex;
  align-items: center;
  gap: 20px;
  justify-content: center;
  position: relative;
  padding-bottom: 8px;
}
.deco-line {
  flex: 1;
  height: 2px;
  background: linear-gradient(90deg, transparent, #3de7c9, transparent);
}
.bs-title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 4px;
  color: #eaf6ff;
  text-shadow: 0 0 12px #3de7c9;
}
.bs-close {
  position: absolute;
  right: 0;
  top: 0;
  width: 34px;
  height: 34px;
  border: 1px solid #3de7c9;
  border-radius: 50%;
  background: transparent;
  color: #3de7c9;
  font-size: 16px;
  cursor: pointer;
}
.bs-filter {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
}
.bs-chips {
  display: flex;
  gap: 6px;
  flex: 1;
}
.bs-chip {
  padding: 4px 12px;
  border: 1px solid #2c4a6b;
  border-radius: 4px;
  background: transparent;
  color: #9fc3e8;
  font-size: 12px;
  cursor: pointer;
}
.bs-chip.active {
  color: #0d1b2a;
  background: #3de7c9;
  border-color: #3de7c9;
  font-weight: 600;
}
.bs-select {
  padding: 5px 10px;
  border: 1px solid #2c4a6b;
  border-radius: 4px;
  background: #13263b;
  color: #cfe3ff;
  font-size: 12px;
  outline: none;
}
.bs-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 15px;
  min-height: 0;
}
.bs-col {
  display: flex;
  flex-direction: column;
  gap: 15px;
  min-height: 0;
  overflow: hidden;
}
.bs-col.center {
  gap: 15px;
}
.bs-panel {
  border: 1px solid #23405f;
  border-radius: 6px;
  background: rgba(13, 27, 42, 0.6);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.bs-panel.grow {
  flex: 1;
}
.bs-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #7fd8ff;
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 3px solid #3de7c9;
}
.empty {
  color: #5a7b9c;
  font-size: 12px;
  text-align: center;
  padding: 18px 0;
}
/* 排行 */
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.rank-no {
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 3px;
  background: #23405f;
  color: #cfe3ff;
  flex-shrink: 0;
}
.rank-no.no1 { background: #e6a23c; color: #fff; }
.rank-no.no2 { background: #9fb6c9; color: #fff; }
.rank-no.no3 { background: #b0814c; color: #fff; }
.rank-name {
  width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #cfe3ff;
  flex-shrink: 0;
}
.rank-bar {
  flex: 1;
  height: 6px;
  background: #16304d;
  border-radius: 3px;
  overflow: hidden;
}
.rank-fill {
  height: 100%;
  background: linear-gradient(90deg, #409eff, #3de7c9);
  border-radius: 3px;
}
.rank-val {
  color: #e6a23c;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
/* 数字翻牌 */
.digital-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.digital {
  border: 1px solid #23405f;
  border-radius: 6px;
  background: rgba(13, 27, 42, 0.6);
  text-align: center;
  padding: 10px 4px;
}
.dig-num {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.dig-label {
  font-size: 11px;
  color: #7d9ec0;
  margin-top: 4px;
}
/* 折线图 */
.trend-svg {
  width: 100%;
  height: 100%;
  min-height: 90px;
}
.trend-axis {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #5a7b9c;
  margin-top: 4px;
}
/* 饼图 */
.pie-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.pie {
  width: 110px;
  height: 110px;
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pie-hole {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #13263b;
}
.pie-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow-y: auto;
  font-size: 11px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}
.legend-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #cfe3ff;
}
.legend-val {
  color: #e6a23c;
  font-variant-numeric: tabular-nums;
}
/* 流程状态 */
.process-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.process-cell {
  text-align: center;
  border-radius: 6px;
  padding: 14px 4px;
}
.process-cell.entered {
  background: rgba(61, 231, 201, 0.12);
  border: 1px solid rgba(61, 231, 201, 0.4);
}
.process-cell.not-entered {
  background: rgba(245, 108, 108, 0.12);
  border: 1px solid rgba(245, 108, 108, 0.4);
}
.process-num {
  font-size: 26px;
  font-weight: 700;
}
.entered .process-num { color: #3de7c9; }
.not-entered .process-num { color: #f56c6c; }
.process-label {
  font-size: 11px;
  color: #7d9ec0;
  margin-top: 4px;
}
/* 最新订单 */
.latest-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}
.latest-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
  border-bottom: 1px dashed #1c3a58;
}
.latest-no {
  width: 16px;
  color: #5a7b9c;
  text-align: center;
  flex-shrink: 0;
}
.latest-client {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #cfe3ff;
}
.latest-date {
  color: #7d9ec0;
  font-size: 11px;
  flex-shrink: 0;
}
.latest-amount {
  color: #67c23a;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
</style>
