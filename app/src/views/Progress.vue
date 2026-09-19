<template>
  <!--
    生产进度（旧版 `/Progress`）。

    逆向：`docs/2026-09-19-progress-analysis.md`（前端）、`-server.md`（服务端）、`-shell.md`（外壳/看板）。

    ## 本文件是**第一刀：骨架**

    已做：路由 / 导航项 / 拉全量数据 / **PC 14 列** / 分页（100 每页，可选 [10,20,50,100,200]）。

    ## ⏳ 还没做（按旧版顺序，各自独立可验）

    1. **工具条**：打印选项 / 批量更新 / 查询更多 / 生产分析 / 刷新 / 导出表格 / 搜索框 + 统计行
       （旧版 `search-row`，见 §2.2）
    2. **列头交互**：单号列的「有单号/空单号」筛选 + 「查单号」popover；生产进度列的「颜色筛选」
    3. **单元格保真**：「生产进度」的 `va()` 渲染（含「回款」标红）、各格的「一格多控件」小标签
    4. **行内动作**：每行的「更新进度 / 删除」两个链接
    5. **生产分析看板**（echarts，5 KPI + 4 饼图 + 趋势 + 4 个统计 tab）
       ⚠️ 它**不是**我们已有的 `DashboardBigScreen`，指标得重写
    6. **终端模式**（10 列）—— **本版不做**：旧版那条接口在服务端是写死 400，路本来就是坏的

    ## 有意偏离（照抄会出错的地方）

    - 旧版表格有 `v-if="K2.value.length > 1"` —— **只有 1 条时整表不渲染**（连表头都没有）。
      那是毛病，新版用 `> 0`（见 §9「旧版本身的两处毛病」）。
    - 旧版「回款 → 工序10」有前端硬编码 + 服务端 merge 特判，能写出脏数据。新版两处一起去掉。
  -->
  <div class="page">
    <div class="toolbar">
      <n-button size="small" :loading="loading" @click="load">刷新</n-button>
      <span class="grow-spacer" />
      <span class="count">共 {{ rows.length }} 条</span>
    </div>

    <n-data-table
      :columns="columns"
      :data="pageRows"
      :bordered="true"
      :row-key="(r: ProgressRowDto) => r.id"
      size="small"
      :max-height="tableHeight"
      :scroll-x="1500"
    />

    <div class="table-footer">
      <n-pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :item-count="rows.length"
        :page-sizes="[10, 20, 50, 100, 200]"
        show-size-picker
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { NButton, NDataTable, NPagination, useMessage } from 'naive-ui'
import type { DataTableColumn } from 'naive-ui'
import { api } from '../api/client'
import type { ProgressRowDto } from '../api/types'

const message = useMessage()

const rows = ref<ProgressRowDto[]>([])
const loading = ref(false)

// 分页：旧版 `page=1`、`pageSize=100`、可选 [10,20,50,100,200]（§2.4）。
const page = ref(1)
const pageSize = ref(100)
const pageRows = computed(() => rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

/** 旧版表格高度是 `calc(100vh - 240px)`；这里减去顶栏 + 工具条 + 分页。 */
const tableHeight = computed(() => Math.max(320, window.innerHeight - 240))

async function load() {
  loading.value = true
  try {
    const r = await api.listProgress()
    rows.value = r?.progressData ?? []
    // 数据换了要回到第一页（否则可能停在越界的页码上）
    if ((page.value - 1) * pageSize.value >= rows.value.length) page.value = 1
  } catch (e) {
    message.error(e instanceof Error ? e.message : '读取生产进度失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 一格一行纯文本（第一刀只求把数据摆出来；「一格多控件」的观感后续再补）。 */
const line = (v: unknown) => h('div', { class: 'cell-line' }, v == null || v === '' ? '—' : String(v))

/** `label：值` 一行；值为空则不渲染这一行（旧版多数小格是这个口径）。 */
const sub = (label: string, v: unknown) =>
  v == null || v === '' ? null : h('div', { class: 'cell-line' }, `${label}${v}`)

const cCol = (...vs: (ReturnType<typeof h> | null)[]) => h('div', { class: 'cell-col' }, vs)

const columns: DataTableColumn<ProgressRowDto>[] = [
  // 1 日期（旧版这一格还有行内 checkbox 与「更新进度/删除」两个链接 —— 见文件头 ⏳4）
  { title: '日期', key: '日期', width: 110, fixed: 'left', render: (r) => line(r['日期']) },
  { title: '客户', key: '客户', width: 110, render: (r) => line(r['客户']) },
  // 3 单号（表头筛选/popover 见文件头 ⏳2）
  { title: '单号', key: '单号', width: 110, render: (r) => line(r['单号']) },
  // 4 生产进度（`va()` 渲染与标红见文件头 ⏳3）
  {
    title: '生产进度',
    key: '生产进度',
    width: 220,
    render: (r) => h('div', { class: 'cell-line progress-text' }, r['生产进度'] || '—'),
  },
  {
    title: '型材/颜色',
    key: 'profile_color',
    width: 130,
    render: (r) => cCol(sub('型材：', r.profile), sub('颜色：', r.color)),
  },
  {
    title: '玻璃',
    key: 'glass',
    width: 120,
    render: (r) => cCol(sub('面玻：', r.face_glass), sub('底玻：', r.bottom_glass), sub('玻璃厚：', r.glass_thickness)),
  },
  {
    title: '扇数/开向',
    key: 'fans_dir',
    width: 110,
    render: (r) => cCol(sub('扇数：', r.fans), sub('开向：', r.direction)),
  },
  {
    title: '下轨道/套线',
    key: 'track_casing',
    width: 120,
    render: (r) => cCol(sub('轨道：', r.track), sub('套线：', r.casing)),
  },
  {
    title: '门洞尺寸',
    key: 'door_size',
    width: 130,
    render: (r) =>
      cCol(
        sub('高：', r.door_height),
        sub('宽：', r.door_width),
        sub('墙厚：', r.wall_thickness),
        sub('轨道长：', r.track_length),
        sub('洞尺：', r['洞尺']),
      ),
  },
  {
    title: '亮窗信息',
    key: 'lightwin',
    width: 120,
    render: (r) =>
      cCol(
        sub('总高：', r.light_window_height),
        sub('数量：', r.light_window_count),
        Number(r['封板高']) > 0 ? sub('封板高：', r['封板高']) : null,
      ),
  },
  // 11 备注（PC 模式下在这一位；终端模式会前移到第 5 位 —— 本版不做终端）
  {
    title: '备注',
    key: 'remark',
    width: 140,
    render: (r) => cCol(line(r['安装地址']), line(r['备注'])),
  },
  {
    title: '金额',
    key: 'amount',
    width: 130,
    render: (r) =>
      cCol(sub('单价：', r.unit_price), sub('数量：', r.quantity), sub('平方：', r.square), sub('金额：', r.amount)),
  },
  { title: '打单人', key: '打单人', width: 90, render: (r) => line(r['打单人']) },
  { title: '业务员', key: '业务员', width: 90, render: (r) => line(r['业务员']) },
]
</script>

<style scoped>
.page {
  /* 减掉全局标题栏的高度（`App.vue` 的 `--app-header-h`）。 */
  min-height: calc(100vh - var(--app-header-h));
  background: #fff;
  padding: 12px 16px 24px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.grow-spacer {
  flex: 1;
}
.count {
  font-size: 13px;
  color: #909399;
}
.table-footer {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
.cell-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cell-line {
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.progress-text {
  white-space: normal;
}
/* 表头底色照旧版（`Progress-4dee25cf.css`：`#f0f9eb`）。 */
:deep(.n-data-table .n-data-table-th) {
  background: #f0f9eb;
}
:deep(.n-data-table .n-data-table-th .n-data-table-th__title) {
  font-size: 12px;
  font-weight: 700;
  color: #000;
  justify-content: center;
  text-align: center;
}
</style>
