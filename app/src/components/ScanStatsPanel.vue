<template>
  <!--
    扫码统计面板 —— 旧版 `div.process-stats-mobile`（分析文档 §2.9）。

    ## 什么时候出现

    旧版的 `pl` 是 `ref(false)`，**只在查询成功时被置 `true`，全文没有任何地方置回 `false`**
    （`grep 'pl["value"]=' /tmp/qr.decoded.js` 三处全是 `=!0`）⇒ 面板一旦出现就**不会自己消失**。
    这里照旧：**没有关闭按钮**，由父组件决定要不要挂载它。

    两条路都能点亮它（旧版同一个 `Cl` + 同一个 `pl`）：
    · 「扫码查单 / 手动查单」→ 一个单号查出来的那几行；
    · 日期范围「当天/本周/本月/更多」→ 按**扫码日期 + 扫码员工**筛出来的一批。
    ⚠️ 后者筛的是「**扫码页干过的活**」，不是「任何一次进度写入」—— 见 `utils/scanStats.ts`
       里 `parseScanMarker` 的注释（那个正则要两个下划线）。

    ## 口径全在 `utils/scanStats.ts`

    本组件只负责画：`aggregateScanRows`（旧版 `ql`）、`buildProcedureGroups`（旧版 `Jl`）、
    `SCAN_DETAIL_COLUMNS`（旧版 `Ma` 26 列）、`buildScanCsv`（旧版 `Tl`）。
    `3轨6扇` 那处旧版自相矛盾的地方也在那个文件的头注里写清楚了。

    ## ⚠️ 有意没做的两处

    1. **`匹配工序键列表` 那套「非管理员过滤」**（旧版 `Wl`/`Gl`/`Kl`）—— 新版后端不返回该字段，
       见 `scanStats.ts` 文件头。这里对**所有行一视同仁**。
    2. **单价不持久化** —— 旧版 `xl`（三个全局单价）与 `Al`（按工序存的三个单价）都**不落任何地方**
       （不是 localStorage，不接口），刷新即归零；`Al` 在同一次会话里跨多次查询会一直留着。
       这里用 `reactive` 复刻这个生命周期，**故意不持久化**（旧版如此，别"顺手"加）。
  -->
  <div class="process-stats-mobile">
    <div class="stats-header">
      <div>
        <div class="stats-title">扫码统计</div>
        <div class="stats-subtitle">
          {{ title }} · 共{{ rows.length }}条<template v-if="employee"> · 员工 {{ employee }}</template>
        </div>
      </div>
      <div class="stats-actions">
        <n-button size="small" type="primary" @click="exportTable">导出表格</n-button>
        <n-button size="small" @click="showDetail = !showDetail">
          {{ showDetail ? '隐藏详情' : '显示详情' }}
        </n-button>
      </div>
    </div>

    <!-- 三个 KPI 卡（旧版 `Rl` + `xl`）。 -->
    <div class="stats-kpi-grid">
      <div class="stats-kpi-card">
        <div class="kpi-label">总门数</div>
        <div class="kpi-value">{{ m.totalQuantity }}</div>
        <div class="kpi-sub">平开{{ m.swingQuantity }} · 移门{{ m.slidingQuantity }}</div>
        <div class="kpi-price">
          <n-input-number v-model:value="prices.quantity" size="small" :min="0" :precision="2" />
          <span class="kpi-total">合计 {{ (m.totalQuantity * prices.quantity).toFixed(2) }}</span>
        </div>
      </div>

      <div class="stats-kpi-card">
        <div class="kpi-label">总扇数</div>
        <div class="kpi-value">{{ m.totalFans }}</div>
        <div class="kpi-sub">亮窗{{ m.slidingBrightFans }} · 淋浴{{ m.showerFans }}</div>
        <div class="kpi-price">
          <!-- ⚠️ 单价乘的是 **totalFans**（扇数×扇数单价），不是「数量」—— 旧版如此。 -->
          <n-input-number v-model:value="prices.fans" size="small" :min="0" :precision="2" />
          <span class="kpi-total">合计 {{ (m.totalFans * prices.fans).toFixed(2) }}</span>
        </div>
      </div>

      <div class="stats-kpi-card">
        <div class="kpi-label">总面积</div>
        <!-- ⚠️ 只有这一张卡的主值是 `toFixed(2)`，副行用的是 `toFixed(1)`（旧版如此，别统一）。 -->
        <div class="kpi-value">{{ m.totalArea.toFixed(2) }}</div>
        <div class="kpi-sub">㎡（平开{{ m.swingArea.toFixed(1) }} · 移门{{ m.slidingArea.toFixed(1) }}）</div>
        <div class="kpi-price">
          <n-input-number v-model:value="prices.area" size="small" :min="0" :precision="2" />
          <span class="kpi-total">合计 {{ (m.totalArea * prices.area).toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- 按工序统计（旧版 `Jl`）。 -->
    <div class="procedure-stats-section">
      <div class="section-title">按工序统计</div>
      <div v-if="groups.length === 0" class="no-data">暂无工序统计数据</div>
      <div v-else class="procedure-stats-list">
        <div v-for="g in groups" :key="g.name" class="procedure-stats-card">
          <div class="procedure-stats-title">{{ g.displayName }}</div>
          <div class="metric-row">
            <span class="metric-label">门数</span>
            <span class="metric-value">{{ g.metrics.totalQuantity }}</span>
            <n-input-number
              v-model:value="priceOf(g.name).quantity"
              size="small"
              :min="0"
              :precision="2"
            />
            <span class="metric-total">= {{ (g.metrics.totalQuantity * priceOf(g.name).quantity).toFixed(2) }}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">扇数</span>
            <span class="metric-value">{{ g.metrics.totalFans }}</span>
            <n-input-number v-model:value="priceOf(g.name).fans" size="small" :min="0" :precision="2" />
            <span class="metric-total">= {{ (g.metrics.totalFans * priceOf(g.name).fans).toFixed(2) }}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">面积</span>
            <span class="metric-value">{{ g.metrics.totalArea.toFixed(2) }}</span>
            <n-input-number v-model:value="priceOf(g.name).area" size="small" :min="0" :precision="2" />
            <span class="metric-total">= {{ (g.metrics.totalArea * priceOf(g.name).area).toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 订单详情（旧版 `Ml`）。默认收起，每次换一批数据都重新收起。 -->
    <div v-if="showDetail" class="detail-orders-section">
      <div class="section-title">订单详情</div>
      <div v-for="(row, i) in rows" :key="i" class="order-item">
        <div class="order-item-title">订单 {{ i + 1 }}</div>
        <!--
          ⚠️ 逐字段渲染，`null` / `数字 0` / 空串的字段**整行不渲染**（旧版 `null != v && 0 !== v && "" !== v`）。
             注意字符串 `"0"` **会**渲染 —— 条件是严格等于数字 0，不是「假值」。
        -->
        <template v-for="col in SCAN_DETAIL_COLUMNS" :key="col.key">
          <div v-if="isScanFieldVisible(rawOf(row, col.key))" class="result-field">
            <span class="field-label">{{ col.label }}:</span>
            <span class="field-value">{{ formatScanField(col.key, rawOf(row, col.key)) }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { NButton, NInputNumber, useMessage } from 'naive-ui'
import type { ProcedureSlotDto, ProgressRowDto } from '../api/types'
import {
  aggregateScanRows,
  buildProcedureGroups,
  buildScanCsv,
  formatScanField,
  isScanFieldVisible,
  SCAN_DETAIL_COLUMNS,
  ZERO_PRICES,
  type UnitPrices,
} from '../utils/scanStats'

const props = defineProps<{
  /** 要统计的行（已由页面按「扫码员工 + 扫码日期」筛过，或来自扫码查单）。 */
  rows: ProgressRowDto[]
  /** 副标题里那个日期口径 —— 旧版是 `zl`（`当天`/`本周`/`本月`/`更多`）。 */
  title: string
  /** 副标题里的「· 员工 X」—— 空串就不显示（旧版 `ul`）。 */
  employee: string
  /** 工序清单，只用来把槽号显示成「工序3-钻孔」。 */
  procedures: ProcedureSlotDto[]
}>()

const message = useMessage()

/** 槽号 → 工序名（旧版 `Hl` 读的那个映射，来源是 `GET /v1/procedures`）。 */
const nameMap = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {}
  for (const p of props.procedures) out[p.slot] = p.name
  return out
})

/** 汇总卡（旧版 `Rl = computed(() => ql(Gl.value))`）。 */
const m = computed(() => aggregateScanRows(props.rows))
/** 按工序统计（旧版 `Jl`）。 */
const groups = computed(() => buildProcedureGroups(props.rows, nameMap.value))

/** 三个全局单价（旧版 `xl`，初值全 0、**不持久化**）。 */
const prices = reactive<UnitPrices>({ ...ZERO_PRICES })
/** 按工序槽存的单价（旧版 `Al` + `Sl()` 惰性建键）。★ 同一次会话里跨多次查询不清空（旧版如此）。 */
const procPrices = reactive<Record<string, UnitPrices>>({})
function priceOf(slot: string): UnitPrices {
  if (!procPrices[slot]) procPrices[slot] = { ...ZERO_PRICES }
  return procPrices[slot]
}

/** 详情开关（旧版 `Ml`）—— 每次换一批数据都重置为「收起」（旧版三条查询路径都这么做）。 */
const showDetail = ref(false)
watch(
  () => props.rows,
  () => {
    showDetail.value = false
  },
)

/** 取行上某列的原始值 —— 行是接口来的 JSON，所以是 `unknown`。 */
function rawOf(row: ProgressRowDto, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key]
}

/** 本地日期 `YYYY-MM-DD`（**不用 `toISOString`**，那是 UTC；理由见 `Qrscanner.vue` 文件头）。 */
function todayYmd(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 导出表格（旧版 `Tl`）—— 纯前端 CSV，两段（「扫码统计」+「订单详情」）。
 *
 * ⚠️ 旧版文件名里的日期用 `toISOString().slice(0,10)`（**UTC**）；这里用**本地**日期
 * （与本页提交进度那处同一处理，见 `Qrscanner.vue` 文件头偏离 2）。
 * ⚠️ 旧版没有「导出成功」以外的失败提示 —— 两段都空时提示「暂无可导出的数据」并**不下载**。
 */
function exportTable() {
  const csv = buildScanCsv(
    props.rows,
    groups.value,
    m.value,
    { ...prices },
    procPrices,
    todayYmd(),
  )
  if (!csv) {
    message.warning('暂无可导出的数据')
    return
  }
  const blob = new Blob([csv.content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = csv.fileName
  a.click()
  URL.revokeObjectURL(url)
  message.success('导出成功')
}
</script>

<style scoped>
/*
 * 样式逐条取自旧版 `legacy/css/Qrscanner-4d126922.css`（类名同旧版）。
 * ⚠️ 旧版同一条规则出现两次 —— 第二次是 `@media (max-width:768px)` 里的窄屏值，
 *    下面用媒体查询表达（本组件按 `frontend-conventions.md` 的 flex/grid 规范写）。
 */
.process-stats-mobile {
  margin: 12px 0 16px;
}
.stats-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}
.stats-title {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}
.stats-subtitle {
  font-size: 12px;
  color: #909399;
}
.stats-actions {
  display: flex;
  gap: 6px;
}
/* 旧版 PC 是两列；窄屏仍两列（`repeat(2,minmax(0,1fr))` 本来就是自适应的）。 */
.stats-kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.stats-kpi-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 10px;
}
.kpi-label {
  font-size: 12px;
  color: #909399;
}
.kpi-value {
  margin-top: 4px;
  font-size: 20px;
  line-height: 1.2;
  font-weight: 700;
  color: #303133;
}
.kpi-sub {
  margin-top: 4px;
  font-size: 11px;
  color: #606266;
}
.kpi-price {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
.kpi-price :deep(.n-input-number) {
  width: 100px;
}
.kpi-total {
  font-size: 12px;
  color: #67c23a;
  font-weight: 600;
  white-space: nowrap;
}
.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 8px;
}
.procedure-stats-section {
  margin-top: 12px;
}
.procedure-stats-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.procedure-stats-card {
  background: #f8fafc;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  padding: 10px;
}
.procedure-stats-title {
  font-size: 13px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 6px;
}
.metric-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}
.metric-label {
  width: 40px;
  font-size: 12px;
  color: #909399;
}
.metric-value {
  min-width: 48px;
  font-size: 13px;
  color: #303133;
}
.metric-row :deep(.n-input-number) {
  width: 100px;
}
.metric-total {
  color: #67c23a;
  font-weight: 600;
  white-space: nowrap;
  font-size: 12px;
}
.no-data {
  font-size: 12px;
  color: #909399;
  padding: 8px 0;
}
.detail-orders-section {
  margin-top: 12px;
}
.order-item {
  padding: 10px;
  margin-bottom: 10px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}
.order-item-title {
  font-size: 13px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 6px;
}
.result-field {
  display: flex;
  padding: 5px 0;
  border-bottom: 1px solid #f0f0f0;
}
.field-label {
  font-weight: 700;
  width: 35%;
  color: #606266;
}
.field-value {
  width: 65%;
  word-break: break-all;
  color: #409eff;
}

/* 窄屏：KPI 仍是两列（旧版也是 `1fr 1fr`），只是字段标签收窄一点。 */
@media (max-width: 768px) {
  .stats-actions {
    flex-direction: column;
  }
  .field-label {
    width: 30%;
    margin-right: 4px;
  }
  .field-value {
    width: 70%;
  }
}
</style>
