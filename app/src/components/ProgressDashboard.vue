<template>
  <!--
    生产分析看板（旧版 `ProductionDashboard`，`Progress-f4bdef35.js`）。
    逆向：`docs/2026-09-19-progress-dashboard.md`（下称「看板文档」）—— 每个数字的口径都在那里逐条跑过。

    外壳：旧版是 `el-dialog fullscreen + destroy-on-close + 点遮罩不关`（§1.2）。
    Naive 的 `n-modal` 没有 `fullscreen`，用「铺满视口 + 圆角 0」还原；
    `destroy-on-close` 用 `display-directive="if"`（关闭即销毁内容 ⇒ 再开重新 init echarts）。
    真正的滚动条在 `.dashboard-container` 身上，与旧版 CSS 一致（§1.4）。
  -->
  <n-modal
    :show="show"
    preset="card"
    :title="title"
    :bordered="false"
    display-directive="if"
    :mask-closable="false"
    :style="fullscreenStyle"
    :content-style="contentStyle"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="dashboard-container">
      <!-- ───────────── 筛选条（旧版 `.filter-bar`，§3） ───────────── -->
      <div class="filter-bar">
        <!-- ⚠️ 这一组旧版**没有** `size="small"`（下面趋势那组才有），照抄。 -->
        <n-radio-group :value="timeMode" @update:value="onTimeChange">
          <!-- 移动端多一颗红色「关闭」（旧版 `window.innerWidth <= 768`，§1.3） -->
          <n-radio-button v-if="isMobile" class="mobile-close-radio" :value="CLOSE_SENTINEL">
            关闭
          </n-radio-button>
          <!-- ⚠️ 「自定义查询」那颗多挂一个 click（旧版 `me`）—— 再点一次也要能开出「查询更多」，见 `onCustomRadioClick` -->
          <n-radio-button
            v-for="m in TIME_MODE_LABELS"
            :key="m.value"
            :value="m.value"
            @click="m.value === 'custom' && onCustomRadioClick()"
          >
            {{ m.label }}
          </n-radio-button>
        </n-radio-group>

        <n-divider vertical />
        <n-select
          v-model:value="clientFilter"
          :options="clientSelectOptions"
          placeholder="筛选客户"
          clearable
          filterable
          size="small"
          class="dash-select"
        />
        <n-select
          v-model:value="salesmanFilter"
          :options="salesmanSelectOptions"
          placeholder="筛选业务员"
          clearable
          filterable
          size="small"
          class="dash-select dash-ml"
        />
        <n-select
          v-model:value="producedFilter"
          :options="producedOptions"
          placeholder="生产状态"
          clearable
          size="small"
          class="dash-select--narrow dash-ml"
        />
        <n-button type="info" size="small" class="dash-ml" @click="resetFilters">重置</n-button>
      </div>

      <!-- ───────────── 5 张 KPI 卡（§7） ───────────── -->
      <div class="kpi-cards">
        <div class="kpi-card total">
          <div class="label">总门数</div>
          <div class="value">{{ metrics.totalQuantity }}</div>
          <div class="detail-row">{{ quantityDetail }}</div>
        </div>

        <div class="kpi-card fans">
          <div class="fans-filter-toggle">
            <n-checkbox v-model:checked="excludeSingleGlass" size="small">不含单玻</n-checkbox>
          </div>
          <div class="label">总扇数</div>
          <div class="value">{{ metrics.totalFans }}</div>
          <div class="detail-row">{{ fansDetail }}</div>
        </div>

        <div class="kpi-card area">
          <div class="label">总平方</div>
          <div class="value">{{ metrics.totalArea.toFixed(2) }}</div>
          <div class="detail-row">{{ areaDetail }}</div>
        </div>

        <div class="kpi-card amount">
          <div class="label">总金额</div>
          <div class="value">¥{{ metrics.totalAmount.toFixed(0) }}</div>
          <div class="detail-row">{{ amountDetail }}</div>
        </div>

        <div class="kpi-card production">
          <div class="label">生产进度</div>
          <div class="sub-values">
            <span class="started">已生产: {{ production.started }}</span>
            <span class="not-started">未生产: {{ production.notStarted }}</span>
          </div>
        </div>
      </div>

      <!-- ───────────── 4 张饼图（§8） ───────────── -->
      <div class="charts-row">
        <div class="chart-wrapper">
          <div class="chart-title">按门数</div>
          <div ref="countPieRef" class="chart"></div>
        </div>
        <div class="chart-wrapper">
          <div class="chart-title">按扇数</div>
          <div ref="fansPieRef" class="chart"></div>
        </div>
        <div class="chart-wrapper">
          <div class="chart-title">按平方</div>
          <div ref="areaPieRef" class="chart"></div>
        </div>
        <div class="chart-wrapper">
          <div class="chart-title">按金额</div>
          <div ref="amountPieRef" class="chart"></div>
        </div>
      </div>

      <!-- ───────────── 趋势图（§9） ───────────── -->
      <div class="trend-chart-section">
        <div class="chart-wrapper">
          <div class="trend-time-filter">
            <!--
              ⚠️ 这一组与筛选条那一组**共用同一个 `timeMode`** —— 旧版两组 radio 绑的是同一个 `w` ref（§1.3）。
              所以：在任意一组切时间，两组一起变；而这里**没有「自定义查询」**，
              上面切到自定义之后，这一组会一个都不选中。旧版就是这个表现，照抄。
            -->
            <n-radio-group :value="timeMode" size="small" @update:value="onTimeChange">
              <n-radio-button v-if="isMobile" class="mobile-close-radio" :value="CLOSE_SENTINEL">
                关闭
              </n-radio-button>
              <n-radio-button
                v-for="m in TREND_TIME_MODES"
                :key="m.value"
                :value="m.value"
              >
                {{ m.label }}
              </n-radio-button>
            </n-radio-group>
          </div>
          <div class="chart-title">{{ trendTitle }}</div>
          <div ref="trendChartRef" class="trend-chart"></div>
        </div>
      </div>

      <!-- ───────────── 4 个统计 tab（§10） ───────────── -->
      <div class="tabs-section">
        <n-tabs v-model:value="activeTab" type="line">
          <n-tab-pane
            v-for="tab in TABS"
            :key="tab.name"
            :name="tab.name"
            :tab="tab.tab"
          >
            <div class="dash-export-row">
              <n-button
                type="primary"
                size="small"
                :loading="exporting"
                @click="exportTab(tab.name)"
              >
                导出表格
              </n-button>
            </div>
            <!-- 旧版 `border + width:100% + height="400"`（el-table 的 `height` 是**表体**高，表头另算，
                 naive 的 `max-height` 是**整表**上限）—— 差一个表头高度，没有对像素，先记在这里。 -->
            <n-data-table
              class="dash-table"
              :columns="columnsByTab[tab.name]"
              :data="tabRows"
              :bordered="true"
              :max-height="400"
              :row-key="(r: GroupRow) => r.name"
            />
          </n-tab-pane>
        </n-tabs>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  NButton,
  NCheckbox,
  NDataTable,
  NDivider,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NTabPane,
  NTabs,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import type { Workbook as ExcelJSWorkbook } from 'exceljs'
import type { ProcedureSlotDto, ProgressRowDto } from '../api/types'
import {
  TIME_MODE_LABELS,
  applyDashboardFilters,
  buildProcedureGroups,
  buildTrend,
  byCustomer,
  byProfile,
  bySalesman,
  clientOptions as clientOptionsOf,
  countProduction,
  dashboardTitle,
  aggregateRows,
  salesmanOptions as salesmanOptionsOf,
  type GroupRow,
  type Metrics,
  type StatsOptions,
  type TimeMode,
} from '../utils/productionStats'

const props = defineProps<{
  show: boolean
  /**
   * 看板的数据集。
   *
   * 🔴 **有意偏离旧版**（看板文档 §16②，**用户拍板**）：旧版看板吃的是页面那个**原始全量** ref
   *    （连「只看自己打单」的数据范围都不吃）⇒ 一个业务员账号打开看板能看见**全公司**的生产数据。
   *    新版这里收的是**已经过数据范围**的行（`Progress.vue` 按当前账号算好传进来，与经营看板同一条规则）。
   *    **别照旧版改回全量。**
   */
  tableData: ProgressRowDto[]
  /** 工序槽（`GET /v1/procedures`）。旧版是打开看板时现拉旧版生产域名的 `GetProcedures`（§10.3）。 */
  procedures: ProcedureSlotDto[]
}>()

const emit = defineEmits<{
  'update:show': [boolean]
  /**
   * 选了「自定义查询」—— 交给页面开「查询更多」对话框（旧版 `emit("customQuery")`）。
   * 页面对完区间后调本组件暴露的 `setCustomDateRange` 回灌（旧版 §3.5 那条环）。
   */
  customQuery: []
}>()

const message = useMessage()

// ── 外壳尺寸（照 `DocSheetLayoutDialog.vue` 那套「Naive 没有 fullscreen」的写法） ──
const fullscreenStyle = {
  width: '100vw',
  height: '100vh',
  maxWidth: '100vw',
  borderRadius: '0',
}
/*
 * `min-height:0` 是给 `n-card__content` 的：它是 flex 子项（`flex:1`），默认 `min-height:auto`
 * 会**按内容撑高**、把 `height:100%` 链断开 ⇒ `.dashboard-container` 就不滚了。
 * 这里让它老老实实收缩到卡片给的高度，滚动条回到 `.dashboard-container` 身上（与旧版 §1.4 一致）。
 */
const contentStyle = { padding: '0', overflow: 'auto', minHeight: '0' }

// ── 看板自己的状态（旧版 `w/m/g/v/h/p`，§3.5） ──────────────────────────────
const timeMode = ref<TimeMode>('all')
const customRange = ref<[string, string] | null>(null)
const clientFilter = ref<string | null>(null)
const salesmanFilter = ref<string | null>(null)
const excludeSingleGlass = ref(false)
const activeTab = ref('customer')

/** 移动端（旧版 `c` = `innerWidth <= 768`）。 */
const isMobile = ref(false)
/** 移动端那颗红色「关闭」radio 的哨兵值。 */
const CLOSE_SENTINEL = '__close__'

/** 趋势图上方那组时间档位：**没有「自定义查询」**（旧版 §1.3）。 */
const TREND_TIME_MODES = TIME_MODE_LABELS.filter((m) => m.value !== 'custom')

const TABS = [
  { name: 'customer', tab: '按客户统计', first: '客户' },
  { name: 'salesman', tab: '按业务员统计', first: '业务员' },
  { name: 'procedure', tab: '按工序统计', first: '工序' },
  { name: 'profile', tab: '按型材统计', first: '型材' },
] as const
type TabName = (typeof TABS)[number]['name']

/*
 * 生产状态（旧版 `v`，值是布尔 `true` / `false`，§3.4）。
 * ⚠️ Naive 的 `SelectOption.value` 只收 `string | number`，所以这里用 `'yes'` / `'no'` 两个哨兵，
 *    进筛选链前再翻译成布尔 —— 旧版「清空 ⇒ 不筛」的语义靠 `null` 保留。
 */
const PRODUCED_YES = 'yes'
const PRODUCED_NO = 'no'
const producedOptions: SelectOption[] = [
  { label: '已进入生产', value: PRODUCED_YES },
  { label: '未进入生产', value: PRODUCED_NO },
]
const producedFilter = ref<string | null>(null)
const producedBool = computed<boolean | null>(() =>
  producedFilter.value === PRODUCED_YES
    ? true
    : producedFilter.value === PRODUCED_NO
      ? false
      : null,
)

// ── 口径（全部来自 `utils/productionStats.ts`，与看板文档逐条对应） ──────────
const statsOpts = computed<StatsOptions>(() => ({
  excludeSingleGlass: excludeSingleGlass.value,
}))

/** 筛选链（旧版 `pe`，§3）。 */
const filtered = computed(() =>
  applyDashboardFilters(
    props.tableData,
    {
      time: timeMode.value,
      custom: customRange.value,
      client: clientFilter.value ?? '',
      salesman: salesmanFilter.value ?? '',
      produced: producedBool.value,
    },
  ),
)

/** KPI（旧版 `ke`，§7）。 */
const metrics = computed(() => aggregateRows(filtered.value, statsOpts.value))
const production = computed(() => countProduction(filtered.value))
const title = computed(() => dashboardTitle(filtered.value))

const clientSelectOptions = computed(() =>
  clientOptionsOf(props.tableData).map((c) => ({ label: c, value: c })),
)
const salesmanSelectOptions = computed(() =>
  salesmanOptionsOf(props.tableData).map((s) => ({ label: s, value: s })),
)

// ── KPI 副行（**逐字**照旧版，§7；注意两处顺序不同，别「统一」） ──────────────
// 卡 1 / 卡 3 / 卡 4 的顺序：平开 · 移门 · 淋浴 · 其它
// 卡 2（扇数）的顺序：平开 · 移门 · **亮窗** · 淋浴 · 其它
// 饼图（§8.2）的扇数顺序：平开 · 移门 · **淋浴** · **亮窗** · 其它 —— 与卡 2 **不同**，两处都照旧版。
const quantityDetail = computed(
  () =>
    `平开${metrics.value.swingQuantity} | 移门${metrics.value.slidingQuantity}` +
    ` | 淋浴${metrics.value.showerQuantity} | 其它${metrics.value.otherQuantity}`,
)
const fansDetail = computed(
  () =>
    `平开${metrics.value.swingFans} | 移门${metrics.value.slidingFans}` +
    ` | 亮窗${metrics.value.slidingBrightFans} | 淋浴${metrics.value.showerFans}` +
    ` | 其它${metrics.value.otherFans}`,
)
const areaDetail = computed(
  () =>
    `平开${metrics.value.swingArea.toFixed(1)} | 移门${metrics.value.slidingArea.toFixed(1)}` +
    ` | 淋浴${metrics.value.showerArea.toFixed(1)} | 其它${metrics.value.otherArea.toFixed(1)}`,
)
const amountDetail = computed(
  () =>
    `平开${metrics.value.swingAmount.toFixed(0)} | 移门${metrics.value.slidingAmount.toFixed(0)}` +
    ` | 淋浴${metrics.value.showerAmount.toFixed(0)} | 其它${metrics.value.otherAmount.toFixed(0)}`,
)

// ── 趋势（旧版 `Ue` / 标题，§9.1 §9.2） ────────────────────────────────────
const trend = computed(() => buildTrend(filtered.value, statsOpts.value))
const trendTitle = computed(
  () => `${trend.value.isMonthly ? '月度趋势' : '每日趋势'}（门数/扇数/平方/金额）`,
)

// ── 4 个 tab 的数据（旧版 `De/be/Se/Pe`，§10.2 §10.3） ─────────────────────
const procedureNames = computed<Record<string, string>>(() => {
  const m: Record<string, string> = {}
  for (const p of props.procedures) {
    const name = (p.name || '').trim()
    if (name) m[p.slot] = name
  }
  return m
})

const tabRows = computed<GroupRow[]>(() => {
  const rows = filtered.value
  const opts = statsOpts.value
  switch (activeTab.value) {
    case 'salesman':
      return bySalesman(rows, opts)
    case 'procedure':
      return buildProcedureGroups(rows, procedureNames.value, opts)
    case 'profile':
      return byProfile(rows, opts)
    default:
      return byCustomer(rows, opts)
  }
})

/**
 * 列定义（旧版四个 tab **逐字相同**，只有首列 label 不同，§10.1）。
 *
 * 配色：旧版走 el-table 的 `header-cell-style`（`Ye`）/`cell-style`（`Oe`）——
 * 表头按「分组 / 列名 / prop」三段判断，单元格底色只看 prop。
 * 逐格推演的结果是**每个分组一套色**（见看板文档 §10.1 的那张表），
 * 所以这里落成 4 个 class，而不是把那两个函数原样搬过来。
 */
/** 四个 tab 的列集（**一次算好**，别在模板里每次渲染重建 —— 那会让 naive 反复重算表头）。 */
const columnsByTab = computed<Record<TabName, DataTableColumns<GroupRow>>>(() => {
  const out = {} as Record<TabName, DataTableColumns<GroupRow>>
  for (const t of TABS) out[t.name] = tabColumns(t)
  return out
})

function tabColumns(tab: (typeof TABS)[number]): DataTableColumns<GroupRow> {
  const leaf = (
    title: string,
    key: keyof Metrics,
    width: number,
    cls: string,
    fmt?: (n: number) => string,
  ) => ({
    title,
    key,
    width,
    className: cls,
    render: (row: GroupRow) => (fmt ? fmt(row.metrics[key]) : String(row.metrics[key])),
  })
  // naive 的默认排序器用 `row[columnKey]`（**平铺**取值），拿不到 `row.metrics.xxx`
  // ⇒ 必须显式给 `compare`，等价于 el-table 的默认数值排序。
  const num =
    (key: keyof Metrics) =>
    (a: GroupRow, b: GroupRow) =>
      a.metrics[key] - b.metrics[key]

  return [
    {
      title: tab.first,
      key: 'name',
      width: 180,
      sorter: (a: GroupRow, b: GroupRow) => a.name.localeCompare(b.name),
    },
    {
      title: '数量类',
      key: 'g-qty',
      align: 'center',
      className: 'dh-quantity',
      children: [
        { ...leaf('总门数', 'totalQuantity', 90, 'dh-quantity'), sorter: num('totalQuantity') },
        leaf('平开', 'swingQuantity', 80, 'dh-quantity'),
        leaf('移门', 'slidingQuantity', 80, 'dh-quantity'),
        leaf('淋浴', 'showerQuantity', 80, 'dh-quantity'),
        leaf('其它', 'otherQuantity', 80, 'dh-quantity'),
      ],
    },
    {
      title: '扇数类',
      key: 'g-fans',
      align: 'center',
      className: 'dh-fans',
      children: [
        { ...leaf('总扇数', 'totalFans', 90, 'dh-fans'), sorter: num('totalFans') },
        leaf('平开扇', 'swingFans', 80, 'dh-fans'),
        leaf('移门扇', 'slidingFans', 80, 'dh-fans'),
        leaf('移门亮', 'slidingBrightFans', 80, 'dh-fans'),
        leaf('淋浴扇', 'showerFans', 80, 'dh-fans'),
        leaf('其它扇', 'otherFans', 80, 'dh-fans'),
      ],
    },
    {
      title: '面积类 (m²)',
      key: 'g-area',
      align: 'center',
      className: 'dh-area',
      children: [
        {
          ...leaf('总面积', 'totalArea', 100, 'dh-area', (n) => n.toFixed(2)),
          sorter: num('totalArea'),
        },
        leaf('平开', 'swingArea', 90, 'dh-area', (n) => n.toFixed(2)),
        leaf('移门', 'slidingArea', 90, 'dh-area', (n) => n.toFixed(2)),
        leaf('淋浴', 'showerArea', 90, 'dh-area', (n) => n.toFixed(2)),
        leaf('其它', 'otherArea', 90, 'dh-area', (n) => n.toFixed(2)),
      ],
    },
    {
      title: '金额类 (元)',
      key: 'g-amount',
      align: 'center',
      className: 'dh-amount',
      children: [
        {
          ...leaf('总金额', 'totalAmount', 110, 'dh-amount', (n) => n.toFixed(0)),
          sorter: num('totalAmount'),
        },
        leaf('平开', 'swingAmount', 100, 'dh-amount', (n) => n.toFixed(0)),
        leaf('移门', 'slidingAmount', 100, 'dh-amount', (n) => n.toFixed(0)),
        leaf('淋浴', 'showerAmount', 100, 'dh-amount', (n) => n.toFixed(0)),
        leaf('其它', 'otherAmount', 100, 'dh-amount', (n) => n.toFixed(0)),
      ],
    },
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// echarts（旧版是全局 `/vendor/js/echarts.min.js`，§1.4）
// ═══════════════════════════════════════════════════════════════════════════
/*
 * 新版**加 `echarts` 依赖 + 动态 import**（看板文档 §16①）：
 * 只在真正打开看板时才拉那个 chunk，不进主包。版本对齐旧版 vendor 那份（5.6.0）。
 */
type ECharts = typeof import('echarts')
let echartsMod: ECharts | null = null

const countPieRef = ref<HTMLDivElement | null>(null)
const fansPieRef = ref<HTMLDivElement | null>(null)
const areaPieRef = ref<HTMLDivElement | null>(null)
const amountPieRef = ref<HTMLDivElement | null>(null)
const trendChartRef = ref<HTMLDivElement | null>(null)

let countPie: import('echarts').ECharts | null = null
let fansPie: import('echarts').ECharts | null = null
let areaPie: import('echarts').ECharts | null = null
let amountPie: import('echarts').ECharts | null = null
let trendChart: import('echarts').ECharts | null = null

/** 饼图共用 option（旧版 `Te` 里那段，逐字，§8.1）。 */
function pieOption(data: { name: string; value: number }[]) {
  return {
    tooltip: { trigger: 'item' as const },
    legend: { bottom: '0%' },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}: {c} ({d}%)' },
        data,
      },
    ],
  }
}

/** 趋势 option（旧版，逐字，§9.3）。默认**只勾「扇数」**。 */
function trendOption(t: {
  dates: string[]
  doors: number[]
  fans: number[]
  area: number[]
  amount: number[]
}) {
  return {
    tooltip: { trigger: 'axis' as const, axisPointer: { type: 'cross' as const } },
    legend: {
      data: ['门数', '扇数', '平方', '金额'],
      bottom: '0%',
      selected: { 门数: false, 扇数: true, 平方: false, 金额: false },
    },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category' as const, data: t.dates, axisLabel: { rotate: 45 } },
    yAxis: [
      { type: 'value' as const, name: '数量/扇数', position: 'left' as const },
      { type: 'value' as const, name: '金额', position: 'right' as const },
    ],
    series: [
      { name: '门数', type: 'bar' as const, data: t.doors, barMaxWidth: 30 },
      { name: '扇数', type: 'bar' as const, data: t.fans, barMaxWidth: 30 },
      { name: '平方', type: 'line' as const, data: t.area, smooth: true },
      { name: '金额', type: 'line' as const, data: t.amount, yAxisIndex: 1, smooth: true },
    ],
  }
}

/** 画图（旧版 `Te`）。**门禁不同**：旧版 4 张饼都要有实例才画（趋势单独判），这里按现有实例画。 */
function draw() {
  if (!props.show) return
  const m = metrics.value
  countPie?.setOption(
    pieOption([
      { value: m.swingQuantity, name: '平开门' },
      { value: m.slidingQuantity, name: '移门' },
      { value: m.showerQuantity, name: '淋浴房' },
      { value: m.otherQuantity, name: '其它' },
    ]),
  )
  // ⚠️ 「按扇数」饼的第 3、4 位是 **淋浴扇数 → 移门亮窗**（KPI 卡副行是「亮窗 → 淋浴」）—— 旧版真差异（§8.2）。
  fansPie?.setOption(
    pieOption([
      { value: m.swingFans, name: '平开扇数' },
      { value: m.slidingFans, name: '移门扇数' },
      { value: m.showerFans, name: '淋浴扇数' },
      { value: m.slidingBrightFans, name: '移门亮窗' },
      { value: m.otherFans, name: '其它' },
    ]),
  )
  // ⚠️ 「按平方」每项各自 `toFixed(2)` 再 `parseFloat`（「按金额」是原值）—— 旧版如此（§8.2）。
  areaPie?.setOption(
    pieOption([
      { value: parseFloat(m.swingArea.toFixed(2)), name: '平开门' },
      { value: parseFloat(m.slidingArea.toFixed(2)), name: '移门' },
      { value: parseFloat(m.showerArea.toFixed(2)), name: '淋浴房' },
      { value: parseFloat(m.otherArea.toFixed(2)), name: '其它' },
    ]),
  )
  amountPie?.setOption(
    pieOption([
      { value: m.swingAmount, name: '平开门' },
      { value: m.slidingAmount, name: '移门' },
      { value: m.showerAmount, name: '淋浴房' },
      { value: m.otherAmount, name: '其它' },
    ]),
  )
  trendChart?.setOption(trendOption(trend.value))
}

/** 初始化 5 个实例（旧版是在 `watch(打开)` 里 `nextTick` 后 init，§8.3）。 */
async function initCharts() {
  if (!echartsMod) echartsMod = await import('echarts')
  const echarts = echartsMod
  // await 之后弹窗可能已经被关掉（`display-directive="if"` 会把 DOM 撤掉）
  if (!props.show) return
  await nextTick()
  const pairs: [HTMLDivElement | null, 'pie' | 'trend'][] = [
    [countPieRef.value, 'pie'],
    [fansPieRef.value, 'pie'],
    [areaPieRef.value, 'pie'],
    [amountPieRef.value, 'pie'],
    [trendChartRef.value, 'trend'],
  ]
  const made = pairs.map(([el]) => (el ? echarts.init(el) : null))
  countPie = made[0]
  fansPie = made[1]
  areaPie = made[2]
  amountPie = made[3]
  trendChart = made[4]
  draw()
}

/**
 * 🔴 **有意偏离旧版**（看板文档 §16③）：旧版**从不在 resize 时调 `echarts.resize()`** ——
 *    拖窗口大小时图表不跟随，只有重开看板才按新尺寸重画。这里是瑕疵，不照抄。
 */
function resizeCharts() {
  isMobile.value = window.innerWidth <= 768
  for (const c of [countPie, fansPie, areaPie, amountPie, trendChart]) c?.resize()
}

function disposeCharts() {
  for (const c of [countPie, fansPie, areaPie, amountPie, trendChart]) c?.dispose()
  countPie = fansPie = areaPie = amountPie = trendChart = null
}

// ── 交互（旧版 `ye` / `ge` / `ve`，§3.5） ──────────────────────────────────
function onTimeChange(v: TimeMode | string) {
  if (v === CLOSE_SENTINEL) {
    emit('update:show', false)
    return
  }
  timeMode.value = v as TimeMode
  if (v === 'custom') {
    // 选「自定义查询」→ 交给页面开「查询更多」对话框，选完日期区间再回灌进来。
    emit('customQuery')
  } else {
    // 旧版 `ye` 的另一半：**切到别的档位就把手选区间丢掉**（`y.value = null`）。
    // 不清的话，下次再切回「自定义查询」会先按上一次的区间筛一帧（对话框还没回灌）。
    customRange.value = null
  }
}

/**
 * 「自定义查询」那颗 radio 的**再次点击**（旧版 `me`：`onClick` 里也 emit 一次）。
 *
 * ⚠️ 为什么不能只靠 `onTimeChange`：radio 已经选中 `custom` 时再点它，值没变 ⇒ naive 不发
 *    `update:value`，对话框就再也开不出来了。旧版那颗 radio 同时挂了 `onChange` 与 `onClick`，
 *    就是为了「再点一次还能开」。这里只在「已经处于 custom」时补发，避免切换那一次连发两遍。
 */
function onCustomRadioClick() {
  if (timeMode.value === 'custom') emit('customQuery')
}

/**
 * 页面「查询更多」确认后回灌日期区间（旧版看板暴露的那个方法：
 * `setCustomDateRange: e => { y.value = e, w.value = "custom", nextTick(() => Te()) }`）。
 *
 * ⚠️ 旧版那句 `nextTick(Te())` 这里**不用写**：本组件的重绘挂在
 *    `watch([filtered, excludeSingleGlass])` 上，而 `filtered` 就读 `customRange`/`timeMode`
 *    ⇒ 改完这两个 ref 会自动重绘（等价、且不会漏）。
 */
function setCustomDateRange(range: [string, string]) {
  customRange.value = range
  timeMode.value = 'custom'
}

defineExpose({ setCustomDateRange })

/** 「重置」—— 🔴 **有意偏离**：旧版**不清「不含单玻」**（§12 第 18 条），新版一起清（§16③）。 */
function resetFilters() {
  timeMode.value = 'all'
  customRange.value = null
  clientFilter.value = null
  salesmanFilter.value = null
  producedFilter.value = null
  excludeSingleGlass.value = false
}

// ── 打开 / 关闭 ────────────────────────────────────────────────────────────
watch(
  () => props.show,
  async (open) => {
    if (!open) {
      disposeCharts()
      return
    }
    // 旧版 `watch(i)` 的第一句：**打开时一行数据都没有 ⇒ 立刻自己关掉**（§12 第 1 条）。
    // 看板文档 §16③ 明确这条**照抄**（其余瑕疵不照抄）—— 一张全 0 的面板比直接关掉更难看。
    if (!props.tableData.length) {
      emit('update:show', false)
      return
    }
    // 旧版 `destroy-on-close` 的效果：每次打开都回到默认筛选 + 重新 init echarts
    resetFilters()
    activeTab.value = 'customer'
    isMobile.value = window.innerWidth <= 768
    await initCharts()
  },
)

watch([filtered, excludeSingleGlass], () => {
  if (props.show) draw()
})

window.addEventListener('resize', resizeCharts)
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  disposeCharts()
})

// ═══════════════════════════════════════════════════════════════════════════
// 导出 xlsx（旧版 `We`，§11）
// ═══════════════════════════════════════════════════════════════════════════
type ExcelJSInterop = {
  Workbook?: typeof ExcelJSWorkbook
  default?: { Workbook: typeof ExcelJSWorkbook }
}

/** 导出中（按钮 loading，防连点生成两个文件）。旧版没有这个 flag，是我们加的（同 `Progress.vue`）。 */
const exporting = ref(false)

const EXPORT_HEADERS: { header: string; key: keyof Metrics | 'name'; width: number }[] = [
  { header: '总门数', key: 'totalQuantity', width: 12 },
  { header: '平开', key: 'swingQuantity', width: 10 },
  { header: '移门', key: 'slidingQuantity', width: 10 },
  { header: '淋浴', key: 'showerQuantity', width: 10 },
  { header: '其它', key: 'otherQuantity', width: 10 },
  { header: '总扇数', key: 'totalFans', width: 16 }, // ⚠️ 唯一会被「不含单玻」改写的列头
  { header: '平开扇', key: 'swingFans', width: 10 },
  { header: '移门扇', key: 'slidingFans', width: 10 },
  { header: '移门亮', key: 'slidingBrightFans', width: 10 },
  { header: '淋浴扇', key: 'showerFans', width: 10 },
  { header: '其它扇', key: 'otherFans', width: 10 },
  { header: '总面积(m²)', key: 'totalArea', width: 14 },
  { header: '平开面积', key: 'swingArea', width: 12 },
  { header: '移门面积', key: 'slidingArea', width: 12 },
  { header: '淋浴面积', key: 'showerArea', width: 12 },
  { header: '其它面积', key: 'otherArea', width: 12 },
  { header: '总金额(元)', key: 'totalAmount', width: 14 },
  { header: '平开金额', key: 'swingAmount', width: 12 },
  { header: '移门金额', key: 'slidingAmount', width: 12 },
  { header: '淋浴金额', key: 'showerAmount', width: 12 },
  { header: '其它金额', key: 'otherAmount', width: 12 },
]

const GROUP_FILLS = ['FFD9ECFF', 'FFEFDBFF', 'FFD9F7BE', 'FFFFE7BA']
const HEADER_FILLS = ['FFE6F4FF', 'FFF9F0FF', 'FFF0FFF0', 'FFFFF7E6']
/** 分组/列头的列区间（1-based，含首列 `name` 时整体右移 1）。 */
const GROUP_RANGES: [number, number][] = [
  [2, 6],
  [7, 12],
  [13, 17],
  [18, 22],
]

function pad2(n: number) {
  return String(n).padStart(2, '0')
}
function stamp(d: Date) {
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_` +
    `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  )
}

async function exportTab(name: TabName) {
  exporting.value = true
  try {
    // exceljs 只在真点导出时才下载（与 `Progress.vue` 的「导出表格」同一套路）。
    const mod = (await import('exceljs')) as unknown as ExcelJSInterop
    const WorkbookCtor = mod.Workbook ?? mod.default?.Workbook
    if (!WorkbookCtor) throw new Error('exceljs 未正确加载')

    const tab = TABS.find((t) => t.name === name)!
    const rows =
      name === 'salesman'
        ? bySalesman(filtered.value, statsOpts.value)
        : name === 'procedure'
          ? buildProcedureGroups(filtered.value, procedureNames.value, statsOpts.value)
          : name === 'profile'
            ? byProfile(filtered.value, statsOpts.value)
            : byCustomer(filtered.value, statsOpts.value)

    const withGlass = excludeSingleGlass.value
    // ⚠️ 吃「不含单玻」的**只有两处**：大标题 + 第 7 列表头（§11.2）。
    const sheetTitle = withGlass ? `${tab.tab}(不含单玻)` : tab.tab
    const fansHeader = withGlass ? '总扇数(不含单玻)' : '总扇数'

    const wb = new WorkbookCtor()
    const ws = wb.addWorksheet('统计数据')
    const cols = [
      { header: tab.first, key: 'name', width: 20 },
      ...EXPORT_HEADERS.map((c) =>
        c.key === 'totalFans' ? { ...c, header: fansHeader } : c,
      ),
    ]
    ws.columns = cols as never
    ws.insertRow(1, [sheetTitle])
    ws.mergeCells(1, 1, 1, cols.length)
    const titleRow = ws.getRow(1)
    titleRow.height = 30
    titleRow.font = { size: 16, bold: true }
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' }

    const groupRow = ws.addRow([
      tab.first, '数量类', '', '', '', '', '扇数类', '', '', '', '', '',
      '面积类(m²)', '', '', '', '', '金额类(元)', '', '', '', '',
    ])
    groupRow.height = 25
    groupRow.font = { bold: true, size: 11 }
    groupRow.alignment = { vertical: 'middle', horizontal: 'center' }
    ws.mergeCells(2, 2, 2, 6)
    ws.mergeCells(2, 7, 2, 12)
    ws.mergeCells(2, 13, 2, 17)
    ws.mergeCells(2, 18, 2, 22)

    const headerRow = ws.addRow(cols.map((c) => c.header))
    headerRow.height = 25
    headerRow.font = { bold: true, size: 10 }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

    for (const r of rows) {
      const m = r.metrics
      const dataRow = ws.addRow([
        r.name,
        m.totalQuantity, m.swingQuantity, m.slidingQuantity, m.showerQuantity, m.otherQuantity,
        m.totalFans, m.swingFans, m.slidingFans, m.slidingBrightFans, m.showerFans, m.otherFans,
        parseFloat(m.totalArea.toFixed(2)), parseFloat(m.swingArea.toFixed(2)),
        parseFloat(m.slidingArea.toFixed(2)), parseFloat(m.showerArea.toFixed(2)),
        parseFloat(m.otherArea.toFixed(2)),
        parseFloat(m.totalAmount.toFixed(0)), parseFloat(m.swingAmount.toFixed(0)),
        parseFloat(m.slidingAmount.toFixed(0)), parseFloat(m.showerAmount.toFixed(0)),
        parseFloat(m.otherAmount.toFixed(0)),
      ])
      dataRow.height = 22
      dataRow.alignment = { vertical: 'middle', horizontal: 'center' }
    }

    // 四边细边框（全表）+ 分组行 / 列头行的底色（§11.2 末尾）
    for (let i = 1; i <= ws.rowCount; i++) {
      ws.getRow(i).eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        }
      })
    }
    groupRow.eachCell((cell, col) => {
      const idx = GROUP_RANGES.findIndex(([a, b]) => col >= a && col <= b)
      if (idx >= 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUP_FILLS[idx] } }
    })
    headerRow.eachCell((cell, col) => {
      const idx = GROUP_RANGES.findIndex(([a, b]) => col >= a && col <= b)
      if (idx >= 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILLS[idx] } }
    })

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sheetTitle}_${stamp(new Date())}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    message.success('导出成功')
  } catch (e) {
    message.error('导出失败: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
/*
 * 布局与尺寸逐条照抄旧版 `legacy/css/Progress-4dee25cf.css`（scope `data-v-720e8586`，§1.4）。
 * 数值都是旧版原样，包括几个不常见的（`gap:-3px` 那类这里没有）。
 */
.dashboard-container {
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  padding: 0 10px;
}
.filter-bar {
  background: #fff;
  padding: 15px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}
/* 宽度是旧版内联 style 逐字抄的：客户/业务员 150px、生产状态 130px，
   后三个控件各自 `margin-left:10px`（客户那个不加，它前面是分隔线）。 */
.dash-select {
  width: 150px;
}
.dash-select--narrow {
  width: 130px;
}
.dash-ml {
  margin-left: 10px;
}

.kpi-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}
.kpi-card {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px #0000000d;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.kpi-card .label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 10px;
}
.kpi-card .value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}
.kpi-card.total .value {
  color: #409eff;
}
.kpi-card.fans .value {
  color: #9a66e4;
}
.kpi-card.area .value {
  color: #67c23a;
}
.kpi-card.amount .value {
  color: #e6a23c;
}
/* 「不含单玻」开关的定位锚 */
.kpi-card.fans {
  position: relative;
}
.fans-filter-toggle {
  position: absolute;
  top: 10px;
  right: 10px;
}
.kpi-card .detail-row {
  font-size: 13px;
  color: #909399;
  margin-top: 8px;
  white-space: nowrap;
}
.kpi-card.production .sub-values {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 16px;
}
.started {
  color: #67c23a;
}
.not-started {
  color: #f56c6c;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}
.chart-wrapper {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px #0000000d;
}
.chart-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 15px;
  text-align: center;
}
.chart {
  height: 430px;
}
.trend-chart-section {
  margin-bottom: 20px;
}
.trend-time-filter {
  margin-bottom: 10px;
}
.trend-chart {
  height: 350px;
}
.tabs-section {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px #0000000d;
}
.dash-export-row {
  margin-bottom: 10px;
}

/* 移动端那颗红色「关闭」radio（旧版 `.mobile-close-radio`，§1.3） */
.mobile-close-radio :deep(.n-radio-button__label) {
  color: #f56c6c;
}

/*
 * 统计表的行/列配色（旧版 `Ye` / `Oe` 逐格推演的结果，§10.1）。
 * 表头三档（分组 / 列名 / prop）最终等价于「每个分组一套色」，所以落成 4 个 class；
 * 单元格底色旧版**只看 prop** ⇒ 同一 class 在 `td` 上用浅一档的色。
 */
.dash-table :deep(th.dh-quantity) {
  background: #d9ecff;
  color: #1890ff;
  font-weight: bold;
}
.dash-table :deep(th.dh-fans) {
  background: #efdbff;
  color: #722ed1;
  font-weight: bold;
}
.dash-table :deep(th.dh-area) {
  background: #d9f7be;
  color: #52c41a;
  font-weight: bold;
}
.dash-table :deep(th.dh-amount) {
  background: #ffe7ba;
  color: #d46b08;
  font-weight: bold;
}
.dash-table :deep(td.dh-quantity) {
  background: #e6f4ff;
}
.dash-table :deep(td.dh-fans) {
  background: #f9f0ff;
}
.dash-table :deep(td.dh-area) {
  background: #f0fff0;
}
.dash-table :deep(td.dh-amount) {
  background: #fff7e6;
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 10px;
  }
  .filter-bar {
    flex-wrap: wrap;
  }
  .kpi-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .kpi-card .value {
    font-size: 20px;
  }
  .kpi-card .detail-row {
    white-space: normal;
    text-align: center;
  }
  .charts-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .chart {
    height: 280px;
  }
  .chart-title {
    font-size: 14px;
  }
  .trend-chart {
    height: 250px;
  }
  .tabs-section {
    padding: 10px;
  }
  .tabs-section :deep(.n-data-table) {
    font-size: 12px;
  }
}
@media (max-width: 480px) {
  .kpi-cards {
    grid-template-columns: 1fr;
  }
  .charts-row {
    grid-template-columns: 1fr;
  }
  .chart {
    height: 250px;
  }
}
</style>
