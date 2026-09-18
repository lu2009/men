<template>
  <div class="home-container">
    <!-- 顶部：按钮组 + 搜索框 + 汇总信息条（仿旧版 search-section） -->
    <div class="header-container">
      <div class="toolbar-row">
        <n-button size="small" :loading="loading" @click="load">刷新</n-button>
        <!--
          「查询更多」（旧版工具栏按钮 `Home.formatted.js:11269-11273`，class `custom-search-btn`
          = `dr(1009)`，文案 `dr(1355)` = " 查询更多 "，onClick `ms`）。位置上旧版紧跟在「刷新」之后
          （中间那颗是终端视图专用的「电子回执单」，新版不做），所以放这儿。
        -->
        <n-button size="small" @click="openQuery">查询更多</n-button>
        <n-button
          size="small"
          :type="onlyUnproduced ? 'error' : 'default'"
          @click="onlyUnproduced = !onlyUnproduced"
        >
          {{ onlyUnproduced ? '未生产' : '显示全部' }}
        </n-button>
        <n-button
          size="small"
          :type="checkedRowKeys.length ? 'warning' : 'default'"
          @click="openPrint"
        >
          打印选中订单{{ checkedRowKeys.length ? `（${checkedRowKeys.length}）` : '' }}
        </n-button>
        <!--
          ⚠️ 自定义单据与标签的入口**不在这里** —— 它们在「打印选项」抽屉里。
          旧版工具栏**只有一个**按钮（工厂「打印选中订单」/ 终端「查看回执单」，onClick 是同一个 `Gi`），
          那 ~24 个单据入口（含 `自定义单据：` 分组）全在抽屉内。我们先前平铺在工具条上是偏离，
          2026-09-18 按用户要求改回原样。见 `docs/2026-09-17-home-print.md` §4。
        -->
        <n-button size="small" type="error" @click="deleteSelected">删除选中数据</n-button>
        <n-button size="small" type="success" @click="clearAccounts">清账</n-button>
        <span class="grow-spacer" />
        <n-button size="small" @click="dashboardShow = true">经营看板</n-button>
        <n-button size="small" type="primary" @click="router.push({ name: 'hui' })">汇算下单</n-button>
        <n-button size="small" @click="router.push({ name: 'clients' })">客户信息</n-button>
        <n-button size="small" @click="router.push({ name: 'formulas' })">公式管理</n-button>
        <n-button size="small" quaternary @click="onLogout">退出登录</n-button>
      </div>

      <div class="search-row">
        <n-input
          v-model:value="searchText"
          class="search-input"
          placeholder="搜索客户、安装地址等"
          clearable
        >
          <template #prefix>🔍</template>
        </n-input>
        <!--
          汇总条 = 旧版 `:11251` 那颗**二选一**的 `v-if/v-else-if`（同一行里就是这俩分支）：
            · 有搜索词（`Rc` 非空，`:11244`）→ 「 当前筛选: …」
            · **无搜索词**且 `_l.length > 0`（原始列表非空）→ 「 总计: N 条记录 …」
          两分支的**字段集与顺序完全相同**（旧版共用同一串 `dr` token）：
            时间 → 门数 → 总价 → 已付 → 未付 → 未付单数 → 未审核
          各自 token：`dr(1364)`=" | 时间: "、`dr(1444)`=" 总计: "、`dr(954)`=" | 门数: "、
          `dr(742)`=" | 总价: "、`dr(525)`=" | 未付: "、`dr(792)`="未付单数: "、`dr(1134)`="未审核: "，
          `已付` / `至` 是旧版模板里的字面量。两分支的数字都取自**筛选后**的列表（旧版 `ps`）。
          ⚠️ 旧版条件用的是 `_l`（原始列表）而不是 `ps`（筛选后），所以「筛选后为空但原始非空」时
             仍会显示一条「总计: 0 条记录」——照抄。
        -->
        <div v-if="searchText.trim()" class="summary-info">
          当前筛选: {{ searchText.trim() }}（{{ filtered.length }} 条结果）
          | 时间: {{ summary.earliest || '—' }} 至 {{ summary.latest || '—' }}
          | 门数: {{ summary.doors }} | 总价: {{ fmt(summary.total) }}
          | 已付: {{ fmt(summary.paid) }} | 未付: {{ fmt(summary.unpaid) }}
          | 未付单数: {{ summary.unpaidCount }} | 未审核: {{ summary.unaudited }}
        </div>
        <!--
          **无搜索词时的常驻汇总条**（旧版 `:11251` 那颗 `v-if/v-else-if` 的 else-if 分支）。
          两分支的**字段集与顺序完全相同**，只有开头一个是「当前筛选: X（N 条结果）」、
          一个是「总计: N 条记录」。
          ⚠️ 条件用的是 `rawOrders`（旧版 `_l`，**原始列表**）而不是 `filtered`（旧版 `ps`）——
             所以「筛选后为空但原始非空」时仍会显示一条「总计: 0 条记录」，**照抄**。
        -->
        <div v-else-if="rawOrders.length > 0" class="summary-info">
          总计: {{ filtered.length }} 条记录
          | 时间: {{ summary.earliest || '—' }} 至 {{ summary.latest || '—' }}
          | 门数: {{ summary.doors }} | 总价: {{ fmt(summary.total) }}
          | 已付: {{ fmt(summary.paid) }} | 未付: {{ fmt(summary.unpaid) }}
          | 未付单数: {{ summary.unpaidCount }} | 未审核: {{ summary.unaudited }}
        </div>
        <div v-else-if="rawOrders.length" class="summary-info">
          总计: {{ filtered.length }} 条记录
          | 时间: {{ summary.earliest || '—' }} 至 {{ summary.latest || '—' }}
          | 门数: {{ summary.doors }} | 总价: {{ fmt(summary.total) }}
          | 已付: {{ fmt(summary.paid) }} | 未付: {{ fmt(summary.unpaid) }}
          | 未付单数: {{ summary.unpaidCount }} | 未审核: {{ summary.unaudited }}
        </div>
      </div>
    </div>

    <!-- 订单主表 -->
    <div class="table-container">
      <n-data-table
        ref="tableRef"
        :columns="columns"
        :data="paged"
        :row-key="(row: OrderSummaryDto) => row.id"
        :loading="loading"
        :max-height="tableHeight"
        :scroll-x="1750"
        :checked-row-keys="checkedRowKeys"
        :expanded-row-keys="expandedRowKeys"
        :row-props="rowProps"
        :bordered="false"
        size="small"
        @update:checked-row-keys="onCheckedKeys"
        @update:expanded-row-keys="onExpandedKeys"
        @update:filters="onUpdateFilters"
      />
    </div>

    <!-- 分页 -->
    <div class="pagination-container">
      <n-pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :item-count="filtered.length"
        :page-sizes="[10, 20, 50, 100, 200]"
        show-size-picker
        show-quick-jumper
        @update:page="onPageChange"
      />
    </div>

    <!-- 改客户名弹窗 -->
    <n-modal
      v-model:show="renameShow"
      preset="card"
      title="修改客户名称"
      style="width: 460px"
    >
      <n-form label-placement="left" label-width="90">
        <n-form-item label="原客户">
          <n-input :value="renameTarget?.client_name" disabled />
        </n-form-item>
        <n-form-item label="修改为">
          <n-input v-model:value="renameValue" placeholder="新客户名称" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <n-button size="small" @click="renameShow = false">取消</n-button>
          <n-button size="small" type="primary" @click="submitRename">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!-- 修改下单日期弹窗 -->
    <n-modal
      v-model:show="dateShow"
      preset="card"
      title="修改下单日期"
      style="width: 400px"
    >
      <n-form label-placement="left" label-width="90">
        <n-form-item label="原日期">
          <n-input :value="dateTarget?.order_date" disabled />
        </n-form-item>
        <n-form-item label="新日期">
          <n-date-picker v-model:value="dateValue" type="date" style="width: 100%" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <n-button size="small" @click="dateShow = false">取消</n-button>
          <n-button size="small" type="primary" @click="submitDate">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!--
      「手动更新进度」弹窗（旧版 §4.7 `Ha`，`:510090` 区）：点「打单操作」格子打开。
      宽 460px / label-width 110px（旧版 `dr(1294)` / `dr(1335)`）；四个控件逐条对齐旧版：
      回执单号(disabled) · 操作名称(autocomplete，失焦入库、右键删自定义项) · 日期 · 记录日期(持久化偏好)。
      第 4 项旧版是 `<el-form-item label=" ">` 占住那 110px 的 label 列，让勾选框与上面输入框左对齐 —— 照抄。
    -->
    <n-modal
      v-model:show="manualShow"
      preset="card"
      title="手动更新进度"
      style="width: 460px"
    >
      <n-form label-placement="left" label-width="110" label-align="right">
        <n-form-item label="回执单号">
          <n-input :value="manualTarget?.receipt_no || ''" disabled />
        </n-form-item>
        <n-form-item label="操作名称">
          <n-auto-complete
            :value="manualName"
            :options="manualNameOptions"
            :input-props="manualNameInputProps"
            placeholder="选择或输入操作名"
            clearable
            @update:value="(v: string | null) => (manualName = v ?? '')"
            @select="(v: string) => (manualName = v)"
            @blur="onManualNameBlur"
          />
        </n-form-item>
        <n-form-item label="日期">
          <n-date-picker
            v-model:value="manualDate"
            type="date"
            placeholder="选择日期"
            clearable
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label=" ">
          <n-checkbox
            :checked="manualRecordDate"
            @update:checked="onRecordDateChange"
          >
            记录日期
          </n-checkbox>
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <n-button size="small" @click="closeManualProgress">取消</n-button>
          <!-- 旧版这颗是 `type="danger"`；Naive 没有 danger，红色对应 `error`（有意偏离：仅取名差异）。 -->
          <n-button size="small" type="error" @click="deleteManualProgress">删除</n-button>
          <n-button size="small" type="primary" @click="submitManualProgress">确认</n-button>
        </div>
      </template>
    </n-modal>

    <!--
      「查询更多」弹窗（审计 C21；旧版 `:12118-12176`，`el-dialog` 标题 `dr(980)`=「查询订单」，width 500px）。
      字段与两侧证据逐条对齐（旧版顺序 = 客户 → 安装地址 → 起始日期 → 结束日期 → 只含生产单）：
        · 客户       仅 `Yt`（工厂）时显示；新版恒工厂 ⇒ 恒显示（`:12135`）
        · 安装地址   仅 `rl` 时显示；`rl` 恒 true（弹窗只由 `ms` 开，见脚本区注释）⇒ 恒显示（`:12147`）
        · 起始日期   `value-format:"YYYY-MM-DD"` + 快捷项 `Ds`（今天/昨天/一周前），默认 = 去年今天
        · 结束日期   同上，默认 = 今天；两个 picker **各自**挂一份快捷项（旧版 `:12153` 与 `:12160` 各一份）
        · 只含生产单 `Vs.includeProductionOrder`（`:12166`）
      footer：取消 + 「确认」(`ys`)。「确认统计」(`vs`) 分支在旧版不可达，不实现（见脚本区注释）。
    -->
    <n-modal
      v-model:show="queryShow"
      preset="card"
      title="查询订单"
      style="width: 500px"
    >
      <n-form label-placement="left" label-width="100">
        <n-form-item label="客户">
          <!--
            客户框是 `type: "autocomplete"`，旧版带 `trigger-on-focus` + `clearable`。
            ⚠️ Naive 的 `n-auto-complete` 清空时 `update:value` 抛的是 **null**（`handleClear` →
            `doUpdateValue(null)`），所以要显式收口成空串，别用 `v-model:value` 直接绑 `string`。
          -->
          <n-auto-complete
            :value="queryForm.client"
            :options="clientSuggestions"
            placeholder="输入客户信息"
            clearable
            @update:value="(v: string | null) => (queryForm.client = v ?? '')"
          />
        </n-form-item>
        <n-form-item label="安装地址">
          <n-input v-model:value="queryForm.address" placeholder="请输入安装地址" clearable />
        </n-form-item>
        <n-form-item label="起始日期">
          <n-date-picker
            v-model:value="queryForm.startTs"
            type="date"
            :shortcuts="DATE_SHORTCUTS"
            placeholder="选择起始日期"
            clearable
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="结束日期">
          <n-date-picker
            v-model:value="queryForm.endTs"
            type="date"
            :shortcuts="DATE_SHORTCUTS"
            placeholder="选择结束日期"
            clearable
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="只含生产单">
          <n-checkbox v-model:checked="queryForm.onlyProduction">只含生产单</n-checkbox>
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <n-button size="small" @click="queryShow = false">取消</n-button>
          <n-button size="small" type="primary" :loading="queryLoading" @click="submitQuery">
            确认
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- 财务抽屉（§5 FinanceDrawer） -->
    <FinanceDrawer v-model:show="financeShow" :order="financeOrder" @saved="onFinanceSaved" />

    <!-- 打印选项抽屉（§4.2 打印选中订单） -->
    <!--
      「打印选项」抽屉只列入口；点了 hiprint 模板走 `openMode` → 下面的预览弹窗，
      点了自绘单据走 `openDoc` → 各自那张的抽屉（见 `onOpenDoc`）。
    -->
    <PrintDrawer
      v-model:show="printShow"
      :orders="printOrders"
      @open-mode="onOpenMode"
      @open-doc="onOpenDoc"
      @open-receipt-other="onOpenReceiptOther"
    />

    <!--
      「回执单-其它」（旧版「打印选项」抽屉顶部的第二颗，`Nn` :8184）：
      手动打印 / 复制 / 分享 / 下载 四颗单据动作，**没有预览**
      （旧版还有第五颗「直接打印回执单」，是云中转/hiprint 客户端静默打印，新版无载体 ⇒ 略，见组件头注释）。
      旧版它是「打印选项」抽屉里**嵌套**的第二层抽屉；新版按本文件 `onOpenDoc` 的口径先关外层再开。
    -->
    <ReceiptOtherDialog v-model:show="receiptOtherShow" :orders="receiptOtherOrders" />

    <!-- 打印预览弹窗（旧版那个 `el-dialog`，宽 1180px）：预览 + 该单据的操作栏 -->
    <PrintPreviewDialog
      v-model:show="previewShow"
      :orders="printOrders"
      :mode="previewMode"
      :title="previewTitle"
    />

    <!-- 收据单2（§旧版 ic=12 的自绘单据）：与打印抽屉并列的另一个入口 -->
    <Receipt2Dialog v-model:show="receipt2Show" :orders="receipt2Orders" />

    <!-- 自定义玻璃合片单（旧版 ic=16）：入口文案取自 `dr[529]` = ` 自定义玻璃合片单 ` -->
    <GlassSheet2Dialog v-model:show="glassSheet2Show" :orders="glassSheet2Orders" />

    <!-- 自定义生产单2（旧版 ic=15）：与玻璃合片单同属 C 家族，差在行数据来源与列集 -->
    <ProductionSheet2Dialog v-model:show="productionSheet2Show" :orders="productionSheet2Orders" />

    <!-- 自定义生产单（旧版 ic=14）：B 家族，行数据来自 oldSheetProduces() -->
    <ProductionSheetDialog v-model:show="productionSheetShow" :orders="productionSheetOrders" />

    <!--
      自定义合格标签族（旧版 ic=13）：**三个入口共用这一个抽屉**，只差 `entry`（= 行过滤）。
      旧版三个 handler 打开的就是同一个组件实例（施工图 §6.1 CONFIRMED），新版照此。
    -->
    <QualifiedLabelDialog
      v-model:show="qualifiedLabelShow"
      :orders="qualifiedLabelOrders"
      :entry="qualifiedLabelEntry"
    />

    <!-- 经营看板（§1.2 DashboardBigScreen，数据全部来自前端订单列表） -->
    <DashboardBigScreen v-model:show="dashboardShow" :orders="dashboardOrders" />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  h,
  nextTick,
  onMounted,
  reactive,
  ref,
  watch,
  type InputHTMLAttributes,
  type Ref,
} from 'vue'
import { useRouter } from 'vue-router'
import {
  NAutoComplete,
  NButton,
  NCheckbox,
  NDataTable,
  NDatePicker,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPagination,
  NPopover,
  NSpin,
  useDialog,
  useMessage,
  type DataTableColumns,
  type DataTableFilterState,
  type DataTableInst,
  type DataTableRowData,
  type DataTableRowKey,
} from 'naive-ui'
import { api } from '../api/client'
import { useAuthStore } from '../stores/auth'
import FinanceDrawer from '../components/FinanceDrawer.vue'
import DashboardBigScreen from '../components/DashboardBigScreen.vue'
import PrintDrawer from '../components/PrintDrawer.vue'
import PrintPreviewDialog from '../components/PrintPreviewDialog.vue'
import ReceiptOtherDialog from '../components/ReceiptOtherDialog.vue'
import Receipt2Dialog from '../components/Receipt2Dialog.vue'
import GlassSheet2Dialog from '../components/GlassSheet2Dialog.vue'
import ProductionSheet2Dialog from '../components/ProductionSheet2Dialog.vue'
import ProductionSheetDialog from '../components/ProductionSheetDialog.vue'
import QualifiedLabelDialog from '../components/QualifiedLabelDialog.vue'
import type { QualifiedLabelEntry } from '../components/qualifiedLabelUiProfile'
import type {
  ClientDto,
  OrderDto,
  OrderFinance,
  OrderHeadInput,
  OrderLineDto,
  OrderSummaryDto,
} from '../api/types'

const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const dialog = useDialog()

// ---------------------------------------------------------------------------
// 常量（文档 §2.2/§2.3/§3 口径）
// ---------------------------------------------------------------------------
const PAYMENT_OPTIONS = ['全部显示', '已付', '未付', '部分付']
const PROGRESS_OPTIONS = ['显示全部', '已打生产单', '未打生产单', '已订玻璃', '未订玻璃']
// 打单操作 5 固定步骤（§3 `ua`）：label + 完成色 + flex 比例。
const PROGRESS_STEPS = [
  { label: '确认下单', color: '#389e0d', flex: 1 },
  { label: '生产单', color: '#d48806', flex: 2 },
  { label: '玻璃订单', color: '#096dd9', flex: 2 },
  { label: '标签', color: '#c41d7f', flex: 2 },
  { label: '收据单', color: '#237804', flex: 2 },
]

// 「手动更新进度」弹窗 + 自定义进度项（旧版 §4.7，审计 G3–G11/B30/C12）。常量逐个有据：
//   `Na`（`:8036`）      = autocomplete 的 4 个固定候选
//   `wr`（`:7568`）      = localStorage 键：自定义操作项数组
//   `gr`（`:7568`）      = localStorage 键：`记录日期` 持久化偏好
//   `dr(1012)`（`:7968`）= 自定义进度段的颜色
//   `Bo`（`:7673`）      = 「打单操作」列头 popover 的 4 个固定项（新版把「显示全部」并进了同一个列表）
const MANUAL_ACTION_OPTIONS = ['玻璃订单', '生产单', '收据单', '确认生产']
const MANUAL_ACTIONS_KEY = 'home_manual_progress_actions'
const RECORD_DATE_KEY = 'home_manual_progress_record_date'
const CUSTOM_SEGMENT_COLOR = '#531dab'
const PROGRESS_FIXED_FILTERS = ['已打生产单', '未打生产单', '已订玻璃', '未订玻璃']
// `ua`（`:7964`）：自定义段总 flex = 3（5 个固定段 1+2+2+2+2 = 9，合计 12）。
const CUSTOM_SEGMENT_FLEX = 3

// ---------------------------------------------------------------------------
// 数据 / 加载
// ---------------------------------------------------------------------------
const loading = ref(false)
const rawOrders = ref<OrderSummaryDto[]>([])
// 财务摘要：{order_id → 未收金额}，供主表「未收 = 未收金额 ?? 总价-定金」口径（§7.1）。
const financeSummary = ref<Record<string, OrderFinance>>({})

async function load() {
  loading.value = true
  try {
    const [orders, summary] = await Promise.all([
      api.listOrders(),
      api.getOrderFinanceSummary().catch(() => ({})),
    ])
    rawOrders.value = orders
    financeSummary.value = summary
  } catch (e) {
    message.error((e as Error).message || '加载订单失败')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!(await auth.loadMe())) {
    router.push({ name: 'login' })
    return
  }
  load()
})

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}

// ---------------------------------------------------------------------------
// 财务/进度口径（§7.1）
// ---------------------------------------------------------------------------
const fmt = (v: number) => (v ?? 0).toFixed(2)
// 未收金额：优先取财务摘要（服务端下发的「未收金额」），否则回退 总价-定金（§7.1）。
const unpaidOf = (r: OrderSummaryDto) => {
  const s = financeSummary.value[r.id]
  return s ? s.unpaid_amount : r.total_price - r.deposit
}

function paymentStatus(r: OrderSummaryDto): string {
  const unpaid = unpaidOf(r)
  if (unpaid <= 0) return '已付'
  if (r.total_price > 0 && unpaid >= r.total_price) return '未付'
  return '部分付'
}

function progressMatch(r: OrderSummaryDto, opt: string): boolean {
  const s = r.production_status || ''
  if (opt === '已打生产单') return s.includes('生产单')
  if (opt === '未打生产单') return !s.includes('生产单')
  if (opt === '已订玻璃') return s.includes('玻璃订单')
  if (opt === '未订玻璃') return !s.includes('玻璃订单')
  if (opt === '显示全部') return true
  // 旧版 `Ao`（`:7684-7686`）的收尾分支：`n.includes(a)` —— 自定义项按「打单操作里含该串」命中。
  return s.includes(opt)
}

// ---------------------------------------------------------------------------
// 筛选（§3.1：未生产 → 付款状态 → 进度 → 搜索文本）
// ---------------------------------------------------------------------------
const searchText = ref('')
const onlyUnproduced = ref(false)
const paymentFilter = ref('全部显示')
const progressFilter = ref('显示全部')

function matchSearch(r: OrderSummaryDto): boolean {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return true
  const fields = [
    r.client_name,
    String(r.deposit),
    String(r.total_price),
    r.install_address,
    r.remark,
    r.production_status,
    r.salesperson,
    r.order_date,
    r.receipt_no,
  ]
  return fields.some((f) => (f ?? '').toLowerCase().includes(q))
}

// 「查询更多」的结果集与其生效标志 —— 完整口径见下方「查询更多（审计 C21）」一节。
// 旧版 `ps` 的头一句就是 `gs.value ? ws.value : fs.value`（`:11153`/`:11172`，`fs` 读全量 `_l`）：
// **查询态下主表显示的是查询结果集，不是全量列表**。
const queryRows = ref<OrderSummaryDto[]>([])
const queryMode = ref(false)

const filtered = computed(() => {
  // 非管理员只看自己打的单（§3.1 `fs`）。
  let list = queryMode.value ? queryRows.value : rawOrders.value
  if (auth.user?.role !== 'admin') {
    list = list.filter((r) => r.creator_name === auth.user?.name)
  }
  if (onlyUnproduced.value) {
    list = list.filter((r) => !r.production_status || r.production_status.trim() === '')
  }
  if (paymentFilter.value !== '全部显示') {
    list = list.filter((r) => paymentStatus(r) === paymentFilter.value)
  }
  if (progressFilter.value !== '显示全部') {
    list = list.filter((r) => progressMatch(r, progressFilter.value))
  }
  list = list.filter(matchSearch)
  // 列头筛选（C16–C18）。**有意偏离旧版**：旧版这一步发生在分页切片之后（只筛当前页、
  // 总数也不含它），新版放在这里 ⇒ **全量筛选、总数跟随**。见下方 `columnFilterState` 的说明。
  return list.filter(matchesColumnFilters)
})

// ---------------------------------------------------------------------------
// 列头原生筛选（C16–C18，旧版 `Home.formatted.js:7933-8003`）
// ---------------------------------------------------------------------------
/*
 * ⚠️ 顺序：旧版这套筛选**不在 `ps` 链里**，而是交给 el-table 自己在 `:data="Cs"` 上做 ——
 *    `:11296` `data:Cs.value`，而 `Cs` = `ps.slice(...)`（`:11180-11183`）。
 *    所以旧版是：筛选链（未生产→付款状态→进度→搜索）→ **分页切片** → 列头筛选，
 *    即**只筛当前页**；分页总数 `zs`（= `ps.length`）也不含它。
 *
 *    ★ **新版有意不照抄这一条**（用户 2026-09-18 拍板）：列头筛选并进 `filtered` 链 ⇒ 全量筛选、
 *      总数跟随。理由见 `matchesColumnFilters` 的注释 —— 旧版那个行为大概率是 bug。
 *
 * 选项取值来源：旧版 `ta`/`ma`/`wa` 全部读 `_l`（**全量**原始列表，`:7934`/`:7987`/`:7992`），
 * 不是当前筛选结果 —— 新版对应 `rawOrders`（连非管理员的「只看自己」过滤都不算在内，与旧版一致）。
 */
const columnFilterState = ref<DataTableFilterState>({})

// 旧版 `ta` 里 `unshift` 的哨兵（`:7937-7939`）：value = 字符串表 dr(1196) = "__EMPTY__"，
// text = dr(1470) = "未生产"。只挂在「打单操作」这一列上。
const EMPTY_FILTER_VALUE = '__EMPTY__'
const EMPTY_FILTER_LABEL = '未生产'

// Naive 的 `FilterOption` / `FilterOptionValue` 没有从包入口导出，这里按结构声明。
type ColumnFilterOption = { label: string; value: string | number }

// 旧版 `ta(prop)`（`:7933-7939`）= `new Set(_l.map(t => t[prop]))` → `Array.from` → `{text:v, value:v}`。
//   · 只做 distinct，**不排序**（保持首次出现顺序，`Set` 的插入序）；
//   · **不剔除空值**（空串同样会成为一个选项）；
//   · `text` 取原值，Element 用插值渲染 → 新版 `label` 取 `String(v)`，数值列显示一致。
function distinctOptions(pick: (r: OrderSummaryDto) => string | number): ColumnFilterOption[] {
  const seen = new Set<string | number>()
  const out: ColumnFilterOption[] = []
  for (const r of rawOrders.value) {
    const v = pick(r)
    if (seen.has(v)) continue
    seen.add(v)
    out.push({ label: String(v), value: v })
  }
  return out
}

// 旧版 `ma`（`:7986-7991`，已付列 `:11469`）：distinct 的是 **`co(row)` 金额数字**，不是「已付」标签。
// `co`（`:7660`）= `Ht && 已分配金额 != null ? 已分配金额 : 定金||0`；
// 新版财务摘要的 `allocated_amount`（后端注释即「已分配金额」，finance/service.rs:39-42）就是那个字段，
// 取不到摘要时回退 `定金||0` —— 与既有 `unpaidOf`（旧版 `so`）同构。
function paidOf(r: OrderSummaryDto): number {
  const s = financeSummary.value[r.id]
  return s ? s.allocated_amount : r.deposit || 0
}

// 旧版 `ga(value,row,column)`（`:7996-8002`）：
//   ① 打单操作列 + 哨兵值 → 该列值为空/纯空白即命中（`!v || (typeof v==='string' && v.trim()==='')`）；
//   ② 其余一律 `row[prop] === value` **严格相等**（不是模糊匹配，也不做类型转换）。
type TextFilterKey =
  | 'client_name'
  | 'order_date'
  | 'install_address'
  | 'production_status'
  | 'door_count'
  | 'total_price'
  | 'remark'
  | 'salesperson'
  | 'creator_name'

function textColumnFilter(key: TextFilterKey, value: string | number, row: OrderSummaryDto): boolean {
  if (key === 'production_status' && value === EMPTY_FILTER_VALUE) {
    const v = row.production_status
    return !v || (typeof v === 'string' && v.trim() === '')
  }
  return row[key] === value
}

// 旧版 `ya`（`:8003`）= `co(row)===e`；`fa`（`:8003`）= `so(row)===e`。
const paidColumnFilter = (value: string | number, row: OrderSummaryDto) => paidOf(row) === value
const unpaidColumnFilter = (value: string | number, row: OrderSummaryDto) => unpaidOf(row) === value

/**
 * 所有列头筛选的**合并判定**（多值 OR、列间 AND —— 与 naive / Element 的 `filter-multiple` 语义一致）。
 *
 * ★ **有意偏离旧版**：旧版把这一步交给 el-table 自己做，而它的 `:data` 是**分页切片**
 *   （`Home.formatted.js:11180-11183` 的 `Cs = ps.slice(...)`），所以旧版**只筛当前页**、
 *   分页总数（`zs = ps.length`）也不含列头筛选。
 *   新版放进 `filtered` 链 ⇒ 全量筛选、`item-count` 跟着变。
 *
 *   取舍理由：旧版那个行为大概率是 bug —— 勾「客户=张三」只筛出当前页里的张三、翻页结果又变，
 *   没人会那样预期。这正是 `docs/home-audit/00-summary.md` 里请用户拍板的那条，用户选了「做对」。
 *
 * 列定义的 `filter` 仍保留：naive 用它渲染勾选态，且它作用在**已筛过的**行上，等于空操作。
 */
function matchesColumnFilters(r: OrderSummaryDto): boolean {
  for (const key of TEXT_FILTER_KEYS) {
    const sel = columnFilterValues(key)
    if (sel.length && !sel.some((v) => textColumnFilter(key, v, r))) return false
  }
  const paid = columnFilterValues('deposit')
  if (paid.length && !paid.some((v) => paidColumnFilter(v, r))) return false
  const unpaid = columnFilterValues('unpaid')
  if (unpaid.length && !unpaid.some((v) => unpaidColumnFilter(v, r))) return false
  return true
}

/** 9 个文本列的 key（与列定义里的 `filterOptionValues` 一一对应）。 */
const TEXT_FILTER_KEYS: TextFilterKey[] = [
  'client_name',
  'order_date',
  'install_address',
  'production_status',
  'door_count',
  'total_price',
  'remark',
  'salesperson',
  'creator_name',
]

// 选项（受控列定义用量，`rawOrders`/`financeSummary` 变化时自动重算）。
const clientFilterOptions = computed(() => distinctOptions((r) => r.client_name))
const dateFilterOptions = computed(() => distinctOptions((r) => r.order_date))
const addressFilterOptions = computed(() => distinctOptions((r) => r.install_address))
const doorCountFilterOptions = computed(() => distinctOptions((r) => r.door_count))
const totalPriceFilterOptions = computed(() => distinctOptions((r) => r.total_price))
const remarkFilterOptions = computed(() => distinctOptions((r) => r.remark))
const salespersonFilterOptions = computed(() => distinctOptions((r) => r.salesperson))
const creatorFilterOptions = computed(() => distinctOptions((r) => r.creator_name))
// 打单操作：distinct 之后把哨兵 **unshift 到最前**（旧版 `:7937-7939`）。
const productionStatusFilterOptions = computed(() => {
  const opts = distinctOptions((r) => r.production_status)
  opts.unshift({ label: EMPTY_FILTER_LABEL, value: EMPTY_FILTER_VALUE })
  return opts
})
// 已付 / 未付（旧版 `ma` `:7986-7991` / `wa` `:7991-7995`）：选项同样是 distinct 的金额数字。
const paidFilterOptions = computed(() => distinctOptions(paidOf))
const unpaidFilterOptions = computed(() => distinctOptions(unpaidOf))

// 受控写法：Naive 2.45 的 n-data-table **没有表级 `filters` prop**，受控只能落在列的
// `filterOptionValues` 上（`use-table-data.mjs:58-68` 的 `mergedFilterStateRef`）。
// 不能用 `defaultFilterOptionValues` —— 那是非受控初值，之后组件内部状态说了算，会与
// `searchText`/`onlyUnproduced` 的「筛选即重算」预期打架。
function columnFilterValues(key: string): (string | number)[] {
  const v = columnFilterState.value[key]
  if (v == null) return []
  return Array.isArray(v) ? [...v] : [v]
}

// Naive 每次变更都会把**整个**筛选状态回抛（`FilterButton.mjs:68-69` `doUpdateFilters`）。
function onUpdateFilters(state: DataTableFilterState) {
  columnFilterState.value = { ...state }
}

const summary = computed(() => {
  const list = filtered.value
  let earliest = ''
  let latest = ''
  for (const r of list) {
    if (!earliest || r.order_date < earliest) earliest = r.order_date
    if (!latest || r.order_date > latest) latest = r.order_date
  }
  const doors = list.reduce((s, r) => s + r.door_count, 0)
  const total = list.reduce((s, r) => s + r.total_price, 0)
  // 已付（旧版 `as` `:10994-10996`）：`Σ (已分配金额 ?? 定金||0)` —— 与列头筛选用的
  // `paidOf`（旧版 `co`，`:7660-7662`）**同一个口径**，直接复用。
  const paid = list.reduce((s, r) => s + paidOf(r), 0)
  const unpaid = list.reduce((s, r) => s + unpaidOf(r), 0)
  const unpaidCount = list.filter((r) => unpaidOf(r) > 0).length
  const unaudited = list.filter(
    (r) => !r.production_status?.trim() && !r.order_no_set?.trim(),
  ).length
  return { earliest, latest, doors, total, paid, unpaid, unpaidCount, unaudited }
})

// ---------------------------------------------------------------------------
// 分页（§3.1 客户端分页，默认 50）
// ---------------------------------------------------------------------------
const page = ref(1)
const pageSize = ref(50)
// n-data-table 实例（只用来在翻页后复位滚动条，见 `onPageChange`）。
const tableRef = ref<DataTableInst | null>(null)
const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

// 翻页复位滚动条（旧版 `xs` `:11184-11195` 的收尾两句）：
//   `const l = document.querySelector(".table-container"); l && (l.scrollTop = 0)`
// ⚠️ 旧版只在**翻页**（`xs`）复位，**改页大小**（`Bs` `:11196-11206`）**不复位** —— 这里照抄，
//    所以挂在 `@update:page` 上而不是 `watch(page)`（改 page-size 时 Naive 会顺带改页，若用 watch 就会误复位）。
// ⚠️ 新版 `.table-container` 是 `flex:1; min-height:0`（**不是**滚动容器），真正滚动的是
//    n-data-table 因 `:max-height` 生成的内层 scrollbar（`.n-data-table-base-table-body`）。
//    旧版写 `.table-container` 能生效是因为它那条 CSS 是 `height:calc(100vh - 10px);overflow:hidden`
//    ——`overflow:hidden` 仍是滚动容器，能被子元素聚焦等程序化滚动。新版没有那层，
//    所以这里改用 n-data-table 暴露的 `scrollTo({ top: 0 })`（`DataTableInst`），
//    等价且不依赖内层 class 名。放在 `nextTick` 里：旧版是同步置 0，但它那层不参与重渲染；
//    Naive 换页要重渲染 body，渲染后置 0 才不会被 scrollbar 的 sync 覆盖。
function onPageChange() {
  void nextTick(() => {
    tableRef.value?.scrollTo({ top: 0 })
  })
}

watch([searchText, onlyUnproduced, paymentFilter, progressFilter], () => {
  page.value = 1
})

// 退出查询态：旧版 `Es`（搜索框 `onInput`，`:11099` 附近）与 `Ms`（`onClear`，`:11096-11100`）
// 都会把 `gs` 置回 `false` —— 即「用户一动搜索框就回到全量列表」。
// 新版 `n-input` 没有可用的输入事件钩子（`v-model:value` 下 `@update:value` 只在用户交互时发，
// 拿不到「是否用户触发」这层区别），改用 watch：只要框里的值不再是进查询态时写进去的那串就退出。
// 进查询态时 `submitQuery` 是先写 `querySearchPreset` 再写 `searchText`，所以那一次不会误退出。
watch(searchText, (v) => {
  if (v !== querySearchPreset.value) queryMode.value = false
})

// ---------------------------------------------------------------------------
// 行状态色（§3 有 CSS 语义的部分；.paid-row/.paid-customer/.duplicate 无清晰口径，暂不实现）
// ---------------------------------------------------------------------------
function isDueSoon(due: string): boolean {
  if (!due) return false
  const [y, m, d] = due.split('-').map(Number)
  if (!y || !m || !d) return false
  const dueDate = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((dueDate.getTime() - today.getTime()) / 86400000)
  return diff >= 0 && diff <= 4
}

/**
 * 「未审核」判据（旧版 `bs`）。`rowProps` 与「审核确认」按钮两处共用 —— 抽出来免得两处漂开。
 */
function isUnaudited(r: OrderSummaryDto): boolean {
  return !r.production_status?.trim() && !r.order_no_set?.trim()
}

function rowProps(r: OrderSummaryDto) {
  const cls: string[] = []
  if (isUnaudited(r)) cls.push('date-audit')
  if (isDueSoon(r.due_date)) cls.push('date-warning')
  return { class: cls.join(' ') }
}

// ---------------------------------------------------------------------------
// 内联编辑（§4.5：定金/安装地址/订单备注/业务员/打单人）
// ---------------------------------------------------------------------------
const editingId = ref<number | null>(null)
const draft = reactive<OrderHeadInput>({})

function startEdit(row: OrderSummaryDto) {
  editingId.value = row.id
  draft.client_code = row.client_code
  draft.client_name = row.client_name
  draft.phone = row.phone
  draft.brand = row.brand
  draft.order_date = row.order_date
  draft.production_days = row.production_days
  draft.deposit = row.deposit
  draft.remark = row.remark
  draft.salesperson = row.salesperson
  draft.order_no_set = row.order_no_set
  draft.install_address = row.install_address
  draft.production_status = row.production_status
  draft.creator_name = row.creator_name
  draft.lock_direction = row.lock_direction
}

async function saveEdit() {
  if (editingId.value == null) return
  const id = editingId.value
  try {
    await api.updateOrderHead(id, { ...draft })
    message.success('修改成功')
    editingId.value = null
    await load()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  }
}

function cancelEdit() {
  editingId.value = null
}

// ---------------------------------------------------------------------------
// 改客户名 / 改日期（§4.4/§4.6，Phase 1 走 updateOrderHead 就地改）
// ---------------------------------------------------------------------------
const renameShow = ref(false)
const renameTarget = ref<OrderSummaryDto | null>(null)
const renameValue = ref('')

function openRename(row: OrderSummaryDto) {
  renameTarget.value = row
  renameValue.value = row.client_name
  renameShow.value = true
}

async function submitRename() {
  if (!renameTarget.value) return
  try {
    await api.updateOrderHead(renameTarget.value.id, { client_name: renameValue.value })
    message.success('修改成功')
    renameShow.value = false
    await load()
  } catch (e) {
    message.error((e as Error).message || '修改失败')
  }
}

const dateShow = ref(false)
const dateTarget = ref<OrderSummaryDto | null>(null)
const dateValue = ref<number | null>(null)

function openDate(row: OrderSummaryDto) {
  dateTarget.value = row
  dateValue.value = row.order_date ? Date.parse(row.order_date) : null
  dateShow.value = true
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 「审核确认」（旧版 `Ba`/`Ma`/`rn`，`:476268-476400`，审计 `02-actions.md` G2）。
 *
 * 旧版两步：① 把**下单日期改成今天**（`Ma` = 今天 → `rn()`，那条路会重算截止日期）；
 * ② `Hl("确认下单", [回执单号])` = `updataProgress`，把「确认下单」追加进进度串。
 *
 * ⚠️ 新版**不需要**手动重算截止日期 —— `due_date` 由 SQL 推导
 * （`orders/service.rs` 的 `HEADER_COLUMNS`：`order_date + production_days + 1`），改日期自动跟随。
 *
 * 进度串的追加沿用 `submitManualProgress` 那条既有通路（`headWithStatus` + `updateOrderHead`），
 * 不另开后端接口 —— 与「手动更新进度」写的是同一个字段。
 * 文案照旧版：成功 `dr(1279)`=「更新成功」。
 */
async function confirmAudit(row: OrderSummaryDto) {
  try {
    await api.updateOrderHead(row.id, {
      ...headWithStatus(row, '确认下单'),
      // 旧版 `Ma` 是「今天」的 **date-picker 时间戳**；`order_date` 落库要 ISO 串，
      // 这里用既有的 `toIsoDate` 转（与 `submitDate` 同一口径）。
      order_date: toIsoDate(legacyToday()),
    })
    message.success('更新成功')
    await load()
  } catch (e) {
    message.error((e as Error).message || '更新失败')
  }
}

async function submitDate() {
  if (!dateTarget.value || dateValue.value == null) return
  const d = new Date(dateValue.value)
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  try {
    await api.updateOrderHead(dateTarget.value.id, { order_date: iso })
    message.success('日期修改成功')
    dateShow.value = false
    await load()
  } catch (e) {
    message.error((e as Error).message || '修改失败')
  }
}

// ---------------------------------------------------------------------------
// 「查询更多」弹窗（审计 C21 —— 旧版唯一的**日期范围**筛选入口）
// ---------------------------------------------------------------------------
/*
 * 旧版坐标：
 *   · 入口按钮      `:11269-11273`（工具栏 ` 查询更多 `，class `custom-search-btn`，onClick `ms`）
 *   · 开弹窗        `:11029-11045`（`ms`：重置表单 → 开弹窗 → 顺手拉一次客户列表）
 *   · 弹窗模板      `:12118-12176`（`el-dialog` 标题 `dr(980)`=「查询订单」，width 500px）
 *   · 确认          `:11047-11120`（`ys`）
 *   · 结果并入主表  `:11078-11083`
 *
 * ⚠️ **审计 C22「查询更多的结果预览表」不存在**（已回源码核）：审计把 `:12132` **之前**那段
 *    认成了结果表格，但那其实是 **「手动更新进度」弹窗**（`dr(1017)`，width 460px，
 *    字段 = 回执单号/操作名称/日期/记录日期）。审计引的 `{key:0,label:"客户"}` / `{key:1,…安装地址}`
 *    是查询弹窗里两个 `el-form-item` 的 **`v-if` 分支 key**（`:12136`/`:12148`），不是表格列。
 *    旧版查询结果**没有**任何预览表，直接进主表（见下 `queryMode`）。故 C22 无落点，不实现。
 *
 * ⚠️ **`rl` 那个「确认统计」分支不实现**：同一只弹窗靠 `rl`（`:7599` `Vue.ref(!1)`）分两态 ——
 *    `rl=true` → 有「安装地址」+ 底部「确认」(`ys` → `getMoreTableDate`)；
 *    `rl=false` → 无「安装地址」+ 底部「确认统计」(`vs` → `getMoreOrders` → 直接出 PDF)。
 *    全组件里 `rl` **只在 `ms` 里被置 true**（`:11031`，它的唯一赋值点），弹窗也只在 `ms` 里开
 *    （`cs` 唯一的 `=!0` 也在 `:11031`）⇒ `rl=false` / `vs` / `getMoreOrders` 在旧版是**不可达的死分支**，
 *    新版不做不算漏。
 *
 * ⚠️ **`Yt`（工厂/终端视图开关）**：`Yt` 的赋值只有两处 —— 初值 `!0`（`:7581`）、
 *    终端视图时置 `!1`（`:7885`/`:8147`）。新版明确只做工厂视图（既有先例，见 `Home.vue:929` 注释），
 *    ⇒ `Yt` 恒真 ⇒ 「客户」字段**恒显示**（旧版 `:12135` 的 `Yt ? … : createCommentVNode`）。
 */
const queryShow = ref(false)
const queryLoading = ref(false)
/** 客户候选 = 旧版 `nl`（`getClientsInfo` 的结果，`ms` 里灌入）。旧版初值是 3 条假数据（张三/李四/王五），新版不播种。 */
const queryClients = ref<ClientDto[]>([])
const queryForm = reactive<{
  client: string
  address: string
  startTs: number | null
  endTs: number | null
  onlyProduction: boolean
}>({ client: '', address: '', startTs: null, endTs: null, onlyProduction: false })
/** 进查询态时写进搜索框的那串（旧版 `Rc`，`:11083`）。搜索框一旦被改动即退出查询态。 */
const querySearchPreset = ref('')

/**
 * 本地「今天 00:00」起算的 `offsetDays` 天前的时间戳（`n-date-picker` 的 model 是时间戳）。
 * 用它而不是 `Date.now() - n*86400000`：跨夏令时的地区后者会飘到前一天的 23 点。
 */
function dayStart(offsetDays = 0): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.getTime()
}

/**
 * 弹窗默认起始日期 = **去年今天**（旧版 `ds`，`:11024-11027`：
 * `t.setFullYear(t.getFullYear() - 1)` 后取 ISO 日期）；默认结束日期 = 今天（旧版 `ss`，`:11025`）。
 */
function yearAgoStart(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setFullYear(d.getFullYear() - 1)
  return d.getTime()
}

// 快捷项（旧版 `Ds`，`:11228-11241`）：今天 / 昨天 / 一周前，顺序与文案逐个对齐。
// ⚠️ 有意的写法差异：旧版 `Ds` 是 setup 里算好的**定值数组**，跨零点就会把「今天」选成昨天；
//    这里用函数形态（Naive 的 `shortcuts` 值可以是 `() => number`，点击时才求值）。
const DATE_SHORTCUTS: Record<string, () => number> = {
  今天: () => dayStart(0),
  昨天: () => dayStart(-1),
  一周前: () => dayStart(-7),
}

/** 时间戳 → 本地 `YYYY-MM-DD`（旧版 `value-format:"YYYY-MM-DD"`，Element 按本地日期格式化）。 */
function toIsoDate(ts: number | null): string {
  if (ts == null) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 旧版 `jl`（`:7644-7646`）：按 `name` 子串（不区分大小写）过滤 `nl`；查询词为空则给全量。
// Naive 的 `n-auto-complete` **没有**内置过滤（props 里没有 `filter`），候选要自己算 —— 口径与旧版一致。
const clientSuggestions = computed(() => {
  const q = queryForm.client.trim().toLowerCase()
  return queryClients.value
    .filter((c) => !q || (c.name ?? '').toLowerCase().includes(q))
    .map((c) => ({ label: c.name, value: c.name }))
})

/** 旧版 `ms`（`:11029-11045`）：重置表单 + 开弹窗 + 拉客户列表。 */
async function openQuery() {
  queryForm.client = ''
  queryForm.address = ''
  queryForm.startTs = yearAgoStart()
  queryForm.endTs = dayStart(0)
  queryForm.onlyProduction = false
  queryShow.value = true
  try {
    queryClients.value = await api.listClients()
  } catch {
    // 旧版此处文案 `dr(850)` =「初始化客户信息失败」。
    message.error('初始化客户信息失败')
  }
}

/** 旧版 `ys`（`:11047-11120`）：取数 → 过滤 → 并入主表 → 进查询态。 */
async function submitQuery() {
  queryLoading.value = true
  try {
    // ① 取数。旧版 URL 只有 4 个条件（`:11074`）：
    //    `param3=客户 &param4=安装地址 &param5=起始日期 &param6=结束日期`。
    //    旧版在 fetch 前还调了一次 `ts()`（`:11047`），那只是清 `es` 这张
    //    `getLatestClientsInfo` 的缓存（`:10986`）—— 新版没有这张缓存，无对应动作。
    let rows = await api.searchOrders({
      client_name: queryForm.client,
      install_address: queryForm.address,
      start_date: toIsoDate(queryForm.startTs),
      end_date: toIsoDate(queryForm.endTs),
    })

    // ② 非管理员只看自己打的单（旧版 `:11076` `!qt.value && (s = s.filter(t => t["打单人"] === _t.value))`）。
    //    必须在**并入主表之前**做：旧版并进 `_l` 的就是过滤后的 `s`，而列头筛选的候选值读的是 `_l`。
    if (auth.user?.role !== 'admin') {
      rows = rows.filter((r) => r.creator_name === auth.user?.name)
    }

    /*
     * ③ 只含生产单。
     * ⚠️ **有意偏离（旧版这颗 checkbox 在查询路径上是死的）**：旧版 `ys` 的 URL 只拼了
     *    param3–param6，**没有** `Vs.includeProductionOrder`（`:11074` 那一行）；
     *    该标志只被隔壁 `vs`（`getMoreOrders`）当 param6 用（`:11095`）。
     *    但弹窗里这颗 checkbox 名叫「只含生产单」，语义明确，摆着不动会被当成新版的 bug。
     *    这里按标签本义接上，口径取现有「已打生产单」（`progressMatch`，旧版 `Ao` `:7682`）——
     *    即 `打单操作` 含「生产单」。**如需 100% 照旧版（勾了等于没勾），删这 3 行即可。**
     */
    if (queryForm.onlyProduction) {
      rows = rows.filter((r) => progressMatch(r, '已打生产单'))
    }

    queryRows.value = rows
    queryMode.value = true

    // ④ 并入主表 `_l`（旧版 `:11078-11083`）：同 `回执单号` 的**替换**成查询回来的这条，
    //    新的**追加到末尾**（旧版这段不排序；`_l` 原本的降序只体现在原有行上）。
    //    注：新版两个接口（`/orders` 与 `/orders/search`）都是本租户全量，所以实际只会刷到已有行。
    const existing = new Set(rawOrders.value.map((r) => r.receipt_no))
    const byReceipt = new Map(rows.map((r) => [r.receipt_no, r]))
    rawOrders.value = [
      ...rawOrders.value.map((r) => byReceipt.get(r.receipt_no) ?? r),
      ...rows.filter((r) => !existing.has(r.receipt_no)),
    ]

    // ⑤ 搜索框回显「客户 地址」（旧版 `Rc = ((selectedClient||"")+" "+(selectedAddress||"")).trim()`，`:11083`）。
    // ⚠️ 照抄的旧版行为：`Rc` 会在 150ms 后灌进 `Fc`，而 `ps` 拿 `Fc` 做**整串** `includes` 过滤
    //    （`:11176-11179`，9 个字段 OR，不切词）。所以**同时填了客户和地址**时（"张三 幸福路1号"）
    //    没有任何字段能整串命中 ⇒ 查询结果会被搜成 0 行。只填日期、或只填客户则正常。
    //    这是旧版自身的缺陷，本轮按**保真优先**原样保留；要修的话改成两块分开 OR 即可。
    querySearchPreset.value = `${queryForm.client} ${queryForm.address}`.trim()
    searchText.value = querySearchPreset.value

    queryShow.value = false

    // ⑥ 财务字段（旧版 `:11085-11101`，仅在 `Yt && Ht`（工厂 + 启用财务）时执行）。
    //    新版没有 `Ht` 开关、财务恒开，而 `financeSummary` 又已被主表 `load()` 拉过一份 ——
    //    这里按查询的起始日期把窗口放大后重取一次，保证查出来的老单在「已付/未付」列上
    //    也能读到 `已分配金额`（否则回退成 总价-定金）。窗口只会变大，不会比 `load()` 的 60 天小。
    const startIso = toIsoDate(queryForm.startTs)
    if (startIso) {
      const days = Math.max(60, Math.ceil((Date.now() - Date.parse(startIso)) / 86400000))
      financeSummary.value = await api.getOrderFinanceSummary(days).catch(() => financeSummary.value)
    }
  } catch (e) {
    // 旧版失败文案 `dr(722)` =「查询数据失败」。
    message.error((e as Error).message || '查询数据失败')
  } finally {
    queryLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// 财务抽屉（§5 FinanceDrawer）
// ---------------------------------------------------------------------------
const financeShow = ref(false)
const financeOrder = ref<{
  id: number
  receipt_no: string
  client_code: string
  client_name: string
  total_price: number
} | null>(null)

function openFinance(row: OrderSummaryDto) {
  financeOrder.value = {
    id: row.id,
    receipt_no: row.receipt_no,
    client_code: row.client_code,
    client_name: row.client_name,
    total_price: row.total_price,
  }
  financeShow.value = true
}

async function onFinanceSaved() {
  await load()
}

// ---------------------------------------------------------------------------
// 打印选中订单（§4.2：工具栏 →「打印选项」抽屉 → 单据 × 预览/打印）
// ---------------------------------------------------------------------------
const printShow = ref(false)
const printOrders = ref<OrderDto[]>([])
/** 打印预览弹窗（旧版那个 `el-dialog`）：入口在「打印选项」抽屉里，点 hiprint 模板即开。 */
const previewShow = ref(false)
const previewMode = ref('')
const previewTitle = ref('')
/** 「回执单-其它」抽屉（旧版嵌套在「打印选项」里的第二层，`Mn`）。 */
const receiptOtherShow = ref(false)
const receiptOtherOrders = ref<OrderDto[]>([])
const receipt2Show = ref(false)
const receipt2Orders = ref<OrderDto[]>([])
const glassSheet2Show = ref(false)
const glassSheet2Orders = ref<OrderDto[]>([])
const productionSheet2Show = ref(false)
const productionSheet2Orders = ref<OrderDto[]>([])
const productionSheetShow = ref(false)
const productionSheetOrders = ref<OrderDto[]>([])
const qualifiedLabelShow = ref(false)
const qualifiedLabelOrders = ref<OrderDto[]>([])
/** 合格标签族的入口（三个按钮唯一的差别，见 `qualifiedLabelUiProfile.ts`）。 */
const qualifiedLabelEntry = ref<QualifiedLabelEntry>('all')

async function openPrint() {
  const ids = checkedRowKeys.value.map((k) => Number(k))
  if (!ids.length) {
    message.warning('请先勾选要打印的订单')
    return
  }
  // 已展开过的订单用缓存，其余现拉（旧版不补拉，没展开过就打空白 —— 这是有意的行为改进）。
  try {
    printOrders.value = await Promise.all(ids.map((id) => details[id] ?? api.getOrder(id)))
  } catch (e) {
    message.error((e as Error).message || '读取订单明细失败')
    return
  }
  printShow.value = true
}

/**
 * 「打印选项」抽屉里点了**自绘单据**的入口 —— 开对应的抽屉。
 *
 * 旧版工具栏只有一个按钮，那 ~24 个单据入口全在抽屉里（含 `自定义单据：` 分组），
 * 所以这一层是**入口分派**，与「打印选中订单」共用同一套选中订单。
 *
 * ⚠️ **复用 `printOrders`，不再重新请求** —— 打开打印抽屉时已经做过明细兜底
 * （未展开过的订单会 `getOrder` 补全），这里重复拉一遍是白费。
 *
 * ⚠️ **先关自己再开目标**：两个 `n-drawer` 都从右侧出，叠着会互相压。
 */
/**
 * 「打印选项」抽屉里点了 **hiprint 模板** → 开打印预览弹窗。
 *
 * 结构照原版：抽屉只列入口，点了设 `ic`（这里是 `mode`）并开预览弹窗，
 * 该单据的操作按钮栏长在**弹窗**里（见 `PrintPreviewDialog.vue`）。
 *
 * ⚠️ 与 `onOpenDoc` 一样**复用 `printOrders`**：打开打印抽屉时已做过明细兜底。
 */
function onOpenMode(mode: string, title: string) {
  printShow.value = false // 先关抽屉再开弹窗，两者都占屏幕
  previewMode.value = mode
  previewTitle.value = title
  previewShow.value = true
}

/**
 * 「打印选项」抽屉顶部点了「回执单-其它」（旧版 `Nn`，:8184）。
 *
 * 旧版那里只是 `Mn.value = true` —— **外层抽屉不关**，第二层嵌套抽屉直接叠上去
 * （`append-to-body` + `direction:"rtl"` + `size:350`，与外层同宽同侧）。
 * 新版沿用本文件 `onOpenDoc` 的口径：先关外层再开 —— 两层 `n-drawer` 都从右侧出，叠着会互相压。
 *
 * 数据复用 `printOrders`（`openPrint` 已做过明细兜底），不重复请求。
 */
function onOpenReceiptOther() {
  receiptOtherOrders.value = printOrders.value
  printShow.value = false
  receiptOtherShow.value = true
}

function onOpenDoc(doc: string, entry?: string) {
  const orders = printOrders.value
  printShow.value = false

  const open = (
    target: typeof receipt2Orders,
    show: typeof receipt2Show,
  ) => {
    target.value = orders
    show.value = true
  }

  switch (doc) {
    case 'receipt2':
      open(receipt2Orders, receipt2Show)
      break
    case 'glassSheet2':
      open(glassSheet2Orders, glassSheet2Show)
      break
    case 'productionSheet2':
      open(productionSheet2Orders, productionSheet2Show)
      break
    case 'productionSheet':
      open(productionSheetOrders, productionSheetShow)
      break
    case 'qlabel':
      // 合格标签族三个入口共用同一个抽屉，只差 `entry`（= 行过滤）
      qualifiedLabelEntry.value = (entry ?? 'all') as QualifiedLabelEntry
      open(qualifiedLabelOrders, qualifiedLabelShow)
      break
  }
}

// ---------------------------------------------------------------------------
// 电子回执单（§6.2 ReceiptView / ReceiptShare）
// ---------------------------------------------------------------------------
function openReceipt(row: OrderSummaryDto) {
  if (!row.receipt_no) {
    message.warning('该订单没有回执单号，无法生成回执单')
    return
  }
  router.push({ name: 'receipt-view', params: { receiptNo: row.receipt_no } })
}

// ---------------------------------------------------------------------------
// 经营看板（§1.2 DashboardBigScreen）：全量订单（按角色过滤），看板内自带日期/客户/业务员筛选
// ---------------------------------------------------------------------------
const dashboardShow = ref(false)
const dashboardOrders = computed(() =>
  auth.user?.role !== 'admin'
    ? rawOrders.value.filter((r) => r.creator_name === auth.user?.name)
    : rawOrders.value,
)

// ---------------------------------------------------------------------------
// 删除选中（§4.3：先查财务记录，删除后自动红冲）
// ---------------------------------------------------------------------------
const checkedRowKeys = ref<DataTableRowKey[]>([])

/**
 * 跨页全选（旧版 `Oo` `:7743-7759`，挂在 el-table 的 `onSelectAll` 上 —— 见 `:11300`
 * `onSelectAll:Oo`）。
 *
 * ⚠️ 先纠正一处审计误判：**旧版没有「工具栏全选 checkbox」**。`Oo` 是 el-table
 * **表头全选格**的事件处理函数；审计里当作「工具栏 checkbox 状态」的 `Ol`（`:7611`）
 * 全仓库只被**写**过、从没在 render 里被**读**过 —— 是死变量。
 *
 * 旧版语义（逐句）：
 *   ```js
 *   Oo = () => {
 *     Wl.value ? (Wl.value = false) : (Wl.value = true)      // 翻转「全选模式」开关
 *     if (Wl.value)  { Vn.clearSelection(); ps.forEach(r => Vn.toggleRowSelection(r, true)) }
 *     else           { Vn.clearSelection() }
 *     …再级联到展开行里的两张子表（新版无子表，随 A3 一起缺）
 *   }
 *   ```
 *   ElTable 的 `toggleRowSelection` 是**按行对象**进出 `selection` 数组的，不要求该行
 *   在当前页的 `data` 里 ⇒ 它一次就把**整个筛选结果 `ps`**（跨页）塞进选中集，
 *   这也是 `Fl`（选中行）/ 删除 `Si` 读到的集合。两个后果：
 *     ① 表头全选 = 选中**当前筛选结果的全部行**（不止当前页）；
 *     ② 之后翻页/改页大小，`xs`(`:11185-11193`) / `Bs`(`:11198-11206`) 会在 `nextTick` 里
 *        `clearSelection()` 后重新全选 `ps` —— 因为 el-table 换页会丢选择，得重刷。
 *   新版 `:checked-row-keys` 是**受控**的，且 Naive 的 TreeMate 对「不在当前 data 里的 key」
 *   只增不删（`treemate/es/check.js:166` `getExtendedCheckedKeySet` 以 `new Set(checkedKeys)`
 *   起步，扁平表 `treeNodeMap.get(key)` 取不到就跳过），所以 ② 那步重刷**不需要**了：
 *   key 一直在受控数组里，翻页后新页的勾选框自然勾上。
 *
 * 因此这里只保留 ① 的语义，`selectAllMode` 就是旧版那个 `Wl`（纯开关记忆，不参与渲染）：
 *   · 表头全选（`action === 'checkAll'`）/ 表头取消全选（`'uncheckAll'`）→ 翻转开关，
 *     开 → 选中**全部筛选结果**；关 → **清空全部**。
 *     （旧版是按 `Wl` 翻转决定清空/全选，而不是看表头 checkbox 当前状态 —— 例如「手动勾满
 *      当前页」时表头已显示为勾选，旧版点它仍是『置 Wl=true 并全选』，这里照抄。）
 *   · 单行勾选（`'check'` / `'uncheck'`）→ 用 Naive 回抛的 keys 原样写回。
 *
 * Naive 把动作类型放在 `update:checked-row-keys` 的**第三个参数**里
 * （`data-table/src/use-check.mjs:82-88` 的 `{ row, action }`），所以能精确区分，
 * 不需要「回抛的 keys 恰好等于本页 keys 就当成全选」这种会误伤手点的启发式。
 */
const selectAllMode = ref(false)

function onCheckedKeys(
  keys: DataTableRowKey[],
  // Naive 的 `OnUpdateCheckedRowKeys` 第二参是 `InternalRowData[]`（未从包根导出），
  // 这里用它导出的等价别名 `DataTableRowData`（`Record<string, any>`）。本函数用不到这个参数。
  _rows: DataTableRowData[],
  meta?: { row?: unknown; action?: 'check' | 'uncheck' | 'checkAll' | 'uncheckAll' },
) {
  if (meta?.action === 'checkAll' || meta?.action === 'uncheckAll') {
    selectAllMode.value = !selectAllMode.value
    checkedRowKeys.value = selectAllMode.value ? filtered.value.map((r) => r.id) : []
    return
  }
  checkedRowKeys.value = keys
}

/**
 * 删除选中（旧版 `Si` `:9224-9305`）。
 *
 * ⚠️⚠️ **旧版在删除前有一步「管理员密码二次校验」，新版【刻意未实现】—— 这里只留结论与出处，
 * 别照着补一个本地口令。** 回源码查证如下（`usePasswordVerify-b6115859.js`，即审计里的 `y(...)`）：
 *
 * ```js
 * // 旧版 `Si` 里（`:9229`，在「已选为空」判断之后、`自助下单||工厂` 守卫之前）：
 * if (!(await y("删除"))) return
 *
 * // `y` = `usePasswordVerify()` 的 `verifyPassword`（`Home.formatted.js:7568-7572`
 * //   `const { verifyPassword: y } = St()`，`St` 即该模块的 `u` 导出）。它的实现是：
 * verifyPassword: async (action = "操作", skipGate = false) => {
 *   const m = await getUserData()                       // index chunk 的 `g`
 *   if (!m) return ElMessage.error("无法获取用户数据"), false
 *   const registrant = m.userinfo.registrant
 *   // 只有写死的这 3 个租户才需要口令，其它租户直接放行：
 *   if (!skipGate && !["恒泰智门33", "恒祥门业", "临泉县品匠移门"].includes(registrant)) return true
 *   const { value: pwd } = await ElMessageBox.prompt(
 *     "请输入管理员密码以确认" + action + "操作", "身份验证",
 *     { confirmButtonText: "确认", cancelButtonText: "取消", inputType: "password",
 *       inputPlaceholder: "请输入密码",
 *       inputValidator: v => !(!v || v.trim().length === 0) || "密码不能为空" })
 *   // ↓ 关键：**服务端**校验，目标是【旧版生产域名】
 *   const r = (await axios.get("https://www.samrtdoor.com.cn/1", {
 *     params: { param1: "login", param2: registrant, param3: pwd } })).data[0]
 *   return !(!r || r.statu !== 1) || (ElMessage.error("密码错误，无权" + action), false)
 * }
 * // 取消：ElMessage.info("已取消" + action)；其它异常：ElMessage.error("验证请求失败，请重试")
 * // 返回 false ⇒ `Si` 那句 `if (!(await y(...))) return` 直接静默返回，不走后面的确认框。
 * ```
 *
 * 结论（逐条都有出处，非推测）：
 *   ① **不是本地口令**，是服务端校验：`GET https://www.samrtdoor.com.cn/1`，
 *      `param1=login`、`param2=<userinfo.registrant>`、`param3=<明文密码>`，
 *      成功判据是响应 `data[0].statu === 1`（旧版把 `status` 拼成了 `statu`）。
 *   ② 它**不是全租户生效**：写死 3 个租户名才弹窗，其余租户 `y` 直接 `return true`。
 *   ③ 弹窗文案 `"请输入管理员密码以确认" + action + "操作"`（action="删除"），
 *      标题 `"身份验证"`，按钮 `确认`/`取消`，密码框带一个「小眼睛」显隐切换
 *      （`usePasswordVerify` 里那段 DOM 注入，`:c()`）。
 *
 * **新版后端没有对应接口**（`backend/src/modules/auth/mod.rs` 只有
 * `/auth/login` `/auth/logout` `/auth/me` `/auth/change-password`，没有「拿租户名+口令换一次
 * 动作授权」这种），前端也没有任何一处调过这个旧域名（全仓库只有
 * `ReceiptEditDialog.vue:682` 的注释提到过它，那处同样是「刻意不发」）。
 * 因此**按本仓库既有口径不发这条跨系统请求**（同 `ReceiptEditDialog.vue:695-701` 的理由①：
 * 目标是旧版生产域名，从新版发出去是跨系统的对外写）。
 *
 * TODO(未确认): 待产品拍板后再补。三条候选路径，任选其一：
 *   (a) 新版后端加一个 `POST /api/v1/auth/verify-action`（校验当前用户口令，返回是否放行），
 *       前端只做弹窗 + 调它 —— 需先定「哪些租户/哪些动作要校验」是否还沿用那 3 个写死租户名；
 *   (b) 沿用旧域名转发 —— 需要先确认旧域名在可预见的将来仍可用、且允许新版跨域调用；
 *   (c) 明确不做（旧版这 3 个租户之外本来就不校验，去掉它不影响绝大多数租户）。
 * 在拍板之前，这里**保持无二次校验**，以免落一个「看起来在验、其实验不了」的假闸门。
 */
function deleteSelected() {
  const ids = checkedRowKeys.value.map(Number)
  if (ids.length === 0) {
    message.warning('请选择要删除的数据')
    return
  }

  // 先查财务记录，有红冲需求时提示（§A3：只对 >0 的合计取负）。
  api
    .checkOrderPayment(ids)
    .then((items) => {
      interface Group {
        code: string
        name: string
        allocated: number
        adjustment: number
        receipts: string[]
      }
      const byCustomer = new Map<string, Group>()
      let totalAlloc = 0
      let totalAdj = 0
      for (const it of items) {
        const g =
          byCustomer.get(it.customer_code) ??
          { code: it.customer_code, name: it.customer_name, allocated: 0, adjustment: 0, receipts: [] }
        g.receipts.push(rawOrders.value.find((o) => o.id === it.order_id)?.receipt_no ?? String(it.order_id))
        if (it.allocated_amount > 0) {
          g.allocated += it.allocated_amount
          totalAlloc += it.allocated_amount
        }
        if (it.adjustment_amount > 0) {
          g.adjustment += it.adjustment_amount
          totalAdj += it.adjustment_amount
        }
        byCustomer.set(it.customer_code, g)
      }
      const groups = [...byCustomer.values()].filter((g) => g.allocated > 0 || g.adjustment > 0)

      let content = `确定删除选中的 ${ids.length} 条订单吗？删除后不可恢复。`
      if (totalAlloc > 0 || totalAdj > 0) {
        const lines = ['选中的订单有以下财务记录：']
        if (totalAlloc > 0) lines.push(`• 已分配收款 ¥${fmt(totalAlloc)}`)
        if (totalAdj > 0) lines.push(`• 订单抹零 ¥${fmt(totalAdj)}`)
        lines.push('删除订单时将自动进行红冲。')
        content = lines.join('\n')
      }

      dialog.warning({
        title: '删除确认',
        content,
        positiveText: '删除',
        negativeText: '取消',
        onPositiveClick: async () => {
          try {
            for (const id of ids) await api.deleteOrder(id)
            // 逐客户红冲：负收款 + 负抹零（§A3）。
            for (const g of groups) {
              if (g.allocated > 0) {
                await api.addCustomerPayment(g.code, {
                  customer_code: g.code,
                  customer_name: g.name,
                  amount: -g.allocated,
                  pay_date: new Date().toISOString().slice(0, 10),
                  method: '其他',
                  remark: '删除订单红冲收款 ' + g.receipts.join(','),
                  allocations: [],
                })
              }
              if (g.adjustment > 0) {
                await api.addCustomerAdjustment(g.code, {
                  customer_code: g.code,
                  customer_name: g.name,
                  amount: -g.adjustment,
                  type: '删除订单冲销',
                  remark: '删除订单红冲抹零 ' + g.receipts.join(','),
                })
              }
            }
            message.success('删除成功')
            checkedRowKeys.value = []
            await load()
          } catch (e) {
            message.error((e as Error).message || '删除失败')
          }
        },
      })
    })
    .catch((e) => {
      message.error((e as Error).message || '查询财务记录失败')
    })
}

// ---------------------------------------------------------------------------
// 清账（全单回款，§5.4 C7：按客户分组，逐客户 finance_addPayment）
// ---------------------------------------------------------------------------
function clearAccounts() {
  const ids = checkedRowKeys.value.map(Number)
  if (ids.length === 0) {
    message.warning('请选择要清账的数据')
    return
  }
  const rows = rawOrders.value.filter((o) => ids.includes(o.id))

  interface CGroup {
    code: string
    name: string
    count: number
    unpaid: number
    allocs: Array<{
      order_id: number
      receipt_no: string
      order_date: string
      total_price: number
      amount: number
      remaining_after: number
    }>
  }
  const byCustomer = new Map<string, CGroup>()
  for (const r of rows) {
    const unpaid = unpaidOf(r)
    if (unpaid <= 0) continue
    const g =
      byCustomer.get(r.client_code) ??
      { code: r.client_code, name: r.client_name, count: 0, unpaid: 0, allocs: [] }
    g.count++
    g.unpaid += unpaid
    g.allocs.push({
      order_id: r.id,
      receipt_no: r.receipt_no,
      order_date: r.order_date,
      total_price: r.total_price,
      amount: unpaid,
      remaining_after: 0,
    })
    byCustomer.set(r.client_code, g)
  }
  const groups = [...byCustomer.values()]
  const total = groups.reduce((s, g) => s + g.unpaid, 0)
  if (total <= 0) {
    message.warning('选中的订单没有未收金额，无需清账')
    return
  }

  const lines = [`将为选中的 ${ids.length} 条订单录入未收金额作为收款：`]
  for (const g of groups) lines.push(`${g.name}：${g.count}单，未收 ¥${fmt(g.unpaid)}`)
  lines.push(`合计 ¥${fmt(total)}`)

  dialog.warning({
    title: '清账确认',
    content: lines.join('\n'),
    positiveText: '清账',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        for (const g of groups) {
          await api.addCustomerPayment(g.code, {
            customer_code: g.code,
            customer_name: g.name,
            amount: g.unpaid,
            pay_date: new Date().toISOString().slice(0, 10),
            method: '清账',
            remark: '批量清账 ',
            allocations: g.allocs,
          })
        }
        message.success('清账成功')
        checkedRowKeys.value = []
        await load()
      } catch (e) {
        message.error((e as Error).message || '清账失败')
      }
    },
  })
}

// ---------------------------------------------------------------------------
// 展开明细（§4.1：fetch detail → 平开/移门只读子表）
// ---------------------------------------------------------------------------
const expandedRowKeys = ref<DataTableRowKey[]>([])
const details = reactive<Record<number, OrderDto>>({})
const loadingDetail = reactive<Record<number, boolean>>({})

function onExpandedKeys(keys: DataTableRowKey[]) {
  expandedRowKeys.value = keys
  for (const k of keys) {
    const id = Number(k)
    if (!details[id]) loadDetail(id)
  }
}

async function loadDetail(id: number) {
  loadingDetail[id] = true
  try {
    details[id] = await api.getOrder(id)
  } catch (e) {
    message.error((e as Error).message || '加载明细失败')
  } finally {
    loadingDetail[id] = false
  }
}

function pingOf(id: number): OrderLineDto[] {
  return (details[id]?.lines ?? []).filter((l) => l.line_type === 'ping')
}
function diaoOf(id: number): OrderLineDto[] {
  return (details[id]?.lines ?? []).filter((l) => l.line_type === 'diao')
}
const qtyOf = (lines: OrderLineDto[]) => lines.reduce((s, l) => s + (l.quantity || 0), 0)

const detailColumns: DataTableColumns<OrderLineDto> = [
  { title: '型材', key: 'profile', width: 90 },
  { title: '颜色', key: 'color', width: 70 },
  { title: '开向', key: 'direction', width: 70 },
  { title: '扇数', key: 'fans', width: 60 },
  { title: '五金', key: 'hardware', width: 90 },
  { title: '面玻', key: 'face_glass', width: 70 },
  { title: '底玻', key: 'bottom_glass', width: 70 },
  { title: '门洞宽', key: 'door_width', width: 70 },
  { title: '门洞高', key: 'door_height', width: 70 },
  { title: '数量', key: 'quantity', width: 55 },
  { title: '单价', key: 'unit_price', width: 70 },
  { title: '金额', key: 'amount', width: 80 },
  { title: '备注', key: 'remark' },
]

/*
 * 展开行明细（§4.1）：平开/移门只读子表，逐行 fetch detail。
 *
 * ⚠️ 更正审计 `01-table.md` F5 的一处误判（已回源码核实，2026-09-18）：
 *    审计写「旧版两张子表用 `v-show` **互斥**切换，新版『有就都渲染』」——**「互斥」不成立**。
 *    旧版 `:11306-11317` 的实况是**两个各自独立的 `v-show`**，且两者的初值都是 `true`：
 *      ```js
 *      no = reactive({})                                    // `:7650`
 *      uo = (e, t) => { if (!no[e]) no[e] = { ping: true, diao: true }; return no[e][t] }
 *      // 模板：
 *      <div v-show="uo(row.回执单号,'ping')" > <平开子表 v-model:showPingkai="uo(row.回执单号,'ping')" … /> </div>
 *      <div v-show="uo(row.回执单号,'diao')" > <移门子表 v-model:showDiao   ="uo(row.回执单号,'diao')" … /> </div>
 *      ```
 *    ⇒ 展开任何一行，**两张子表默认都渲染**（即使某一类一行明细都没有，也只是渲出一张空表）。
 *    所谓「切换」来自子组件的 `v-model:showXxx` 回写：子表只在**删掉自己最后一行**时
 *    emit `update:showPingkai/showDiao = (rows.length > 0)`（Hui 侧
 *    `Hui.formatted.js:1571-1572` 平开 / `:4358-4359` 移门，都在 `removeFirstRow` 里），
 *    从而把自己整个藏掉。两张表之间没有任何联动。
 *
 * **有意偏离（保留现状，不改成「都渲染」）**：新版 `if (ping.length)` / `if (diao.length)`
 * 只在**该类有明细时**才出一块。理由两条：
 *   ① 新版这两张是**只读**自绘表，没有「删最后一行」这条路径，旧版那个 `v-model:showXxx`
 *      回写在新型里没有对应物 ⇒ 就算照抄「无条件都渲染」，也只是多出一张空表，拿不到旧版的语义；
 *   ② 旧版那张空表来自「复用 Hui 汇算表」这一整套策略（审计 F3/A3 的架构级偏离），
 *      不是这里能补的 —— 补它要先把 `Hui.vue` 的两张表拆成可复用组件，属独立立项。
 * 若将来说要做 F3（复用 Hui 子表），这条要跟着一起回退。
 */
function renderExpandDetail(row: OrderSummaryDto) {
  const id = row.id
  if (loadingDetail[id]) {
    return h('div', { class: 'expand-detail' }, [h(NSpin, { show: true }, { default: () => '加载明细…' })])
  }
  const detail = details[id]
  if (!detail) return h('span')
  const ping = pingOf(id)
  const diao = diaoOf(id)
  const children: (ReturnType<typeof h> | null)[] = []
  if (ping.length) {
    children.push(
      h('div', { class: 'detail-block' }, [
        h('div', { class: 'detail-title' }, `平开门 · ${ping.length} 行 / ${qtyOf(ping)} 樘`),
        h(NDataTable, { columns: detailColumns, data: ping, bordered: false, size: 'small' }),
      ]),
    )
  }
  if (diao.length) {
    children.push(
      h('div', { class: 'detail-block' }, [
        h('div', { class: 'detail-title' }, `移门 · ${diao.length} 行 / ${qtyOf(diao)} 樘`),
        h(NDataTable, { columns: detailColumns, data: diao, bordered: false, size: 'small' }),
      ]),
    )
  }
  if (!detail.lines?.length) {
    children.push(h(NEmpty, { description: '暂无明细', size: 'small' }))
  }
  return h('div', { class: 'expand-detail' }, children)
}

// ---------------------------------------------------------------------------
// 手动更新进度 + 自定义进度项（§3 `Ea`/`La`/`ua`；§4.7 `Ha`/`ln`/`on`/`Ua`/`Ia`/`Sa`/`Ta`/`Ya`/`Wa`）
// ---------------------------------------------------------------------------
// 旧版 `Ea`（`:8036`）：读 localStorage 的 JSON 数组，只留非空字符串；解析失败/非数组 ⇒ []。
function readManualActions(): string[] {
  try {
    const raw = localStorage.getItem(MANUAL_ACTIONS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  } catch {
    return []
  }
}

// 旧版是 `Vue.ref(立即求值)` —— 只在组件建立时读一次，不跨标签页同步。新版照此。
const manualActions = ref<string[]>(readManualActions())

// 旧版 `Ia`（`:8030`）：整数组回写。
function saveManualActions() {
  localStorage.setItem(MANUAL_ACTIONS_KEY, JSON.stringify(manualActions.value))
}

// 旧版 `La`（`:8036`）：列头 popover 追加的自定义项 = 自定义项里不在固定表 `Bo` 里的那些。
// （`Ua` 只挡 `Na` 的 4 项，`Ea` 里仍可能出现与 `Bo` 同名的项，所以这里要再滤一次。）
const customProgressOptions = computed(() =>
  Array.from(new Set(manualActions.value.filter((v) => !PROGRESS_FIXED_FILTERS.includes(v)))),
)

// 旧版 `Ua`（`:8032`）：失焦/确认时把新名字入库；固定候选与已有项不重复入库。
function rememberManualAction(name: string) {
  const v = name.trim()
  if (!v || MANUAL_ACTION_OPTIONS.includes(v) || manualActions.value.includes(v)) return
  manualActions.value.push(v)
  saveManualActions()
}

// 旧版 `Ya` 内联的删除逻辑（`:8044-8049`）：固定项一律 false。
function forgetManualAction(name: string): boolean {
  const v = name.trim()
  if (!v || MANUAL_ACTION_OPTIONS.includes(v)) return false
  const before = manualActions.value.length
  manualActions.value = manualActions.value.filter((a) => a !== v)
  if (manualActions.value.length === before) return false
  saveManualActions()
  return true
}

// 弹窗状态（旧版 `ba`/`Da`/`Aa`/`ka`/`Pa`，`:8036-:8064`）。
const manualShow = ref(false)
const manualTarget = ref<OrderSummaryDto | null>(null)
const manualName = ref('')
const manualDate = ref<number | null>(null)
// 旧版 `Pa = ref("1" === localStorage.getItem(gr))` —— 持久化偏好：
// 从未设置过 ⇒ false；存过 "1" ⇒ 勾上。**不是**每次默认勾选。
const manualRecordDate = ref(localStorage.getItem(RECORD_DATE_KEY) === '1')

// 旧版 `ka` 初值（`:8036`）= `new Date().toISOString().split("T")[0]` —— **UTC** 日期串。
// 这里取同一个串再按本地日历还原成时间戳，保证与旧版显示同一天
//（含 UTC+8 凌晨会取到"昨天"这一旧版行为，属有意保真）。
function legacyToday(): number {
  const [y, m, d] = new Date()
    .toISOString()
    .split('T')[0]
    .split('-')
    .map(Number)
  return new Date(y, m - 1, d).getTime()
}

// 旧版 `value-format: "YYYY-MM-DD"` ⇒ 提交时拼进操作名的是 `YYYY-MM-DD` 串。
function isoDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 旧版 `Sa`（`:8041`）：候选 = 固定 4 项 + 自定义项，按**输入原值**（不 trim）`includes` 过滤。
// 旧版给 Element Plus 的只有 `{value}`（它的 value 同时当显示文本）；Naive 的 autocomplete
// 用 `label` 显示、选中回填的也是 `label`，故这里两者都填同一个串。
const manualNameOptions = computed(() => {
  const all = [...MANUAL_ACTION_OPTIONS, ...manualActions.value]
  const q = manualName.value
  return (q ? all.filter((v) => v.includes(q)) : all).map((v) => ({ label: v, value: v }))
})

// 旧版 `Ta`（`:8040`）：失焦即入库。
function onManualNameBlur() {
  rememberManualAction(manualName.value)
}

// 旧版 `Ya`（`:8042`）：在「操作名称」输入框上右键 = 删除自定义操作项。
function onManualNameContextMenu(e: MouseEvent) {
  e.preventDefault()
  const v = manualName.value.trim()
  if (!v) {
    message.warning('请先输入要删除的操作项')
    return
  }
  if (MANUAL_ACTION_OPTIONS.includes(v)) {
    message.warning('固定项不允许删除')
    return
  }
  if (!forgetManualAction(v)) {
    message.warning('未找到该自定义操作项')
    return
  }
  // 旧版 `Mo.value === l && Po()`：删掉的正是当前筛选值时清掉筛选（新版「清掉」= 显示全部）。
  if (progressFilter.value === v) progressFilter.value = '显示全部'
  manualName.value = ''
  message.success('已删除自定义操作项')
}

// Naive 的 AutoComplete 不认 `onContextmenu` 顶层 prop，要走 `inputProps` 透传到内层 input。
const manualNameInputProps: InputHTMLAttributes = { onContextmenu: onManualNameContextMenu }

// 旧版 `Wa`（`:8057`）：`记录日期` 是持久化偏好，写 "1"/"0"。
function onRecordDateChange(v: boolean) {
  manualRecordDate.value = v
  localStorage.setItem(RECORD_DATE_KEY, v ? '1' : '0')
}

// 旧版 `Ha`（`:8067`）：无回执单号 ⇒ warning 不开窗；开窗时重置操作名与日期（**不动** `记录日期`）。
function openManualProgress(row: OrderSummaryDto) {
  if (!row.receipt_no) {
    message.warning('当前行缺少回执单号，无法更新进度')
    return
  }
  manualTarget.value = row
  manualName.value = ''
  manualDate.value = legacyToday()
  manualShow.value = true
}

// 旧版 `tn`（`:8072`）：取消。
function closeManualProgress() {
  manualShow.value = false
  manualTarget.value = null
  manualName.value = ''
}

// 旧版 `ln`（`:8079`）/`on`（`:8089`）：勾了「记录日期」就把日期拼在操作名后面（`param3`）。
function manualProgressParam(): string {
  const name = manualName.value.trim()
  const date = manualDate.value
  return manualRecordDate.value && date != null ? `${name}${isoDate(date)}` : name
}

// `PATCH /orders/{id}` 是**整头覆盖**（后端 `update_head` 绑的是全字段），
// 所以必须带上原行的全部头字段，只换 `production_status`。
function headWithStatus(row: OrderSummaryDto, productionStatus: string): OrderHeadInput {
  return {
    client_code: row.client_code,
    client_name: row.client_name,
    phone: row.phone,
    brand: row.brand,
    order_date: row.order_date,
    production_days: row.production_days,
    deposit: row.deposit,
    remark: row.remark,
    salesperson: row.salesperson,
    order_no_set: row.order_no_set,
    install_address: row.install_address,
    production_status: productionStatus,
    creator_name: row.creator_name,
    lock_direction: row.lock_direction,
  }
}

// 旧版 `ln`（`:8074`）：确认 → `Hl(param3 = 操作名[+日期])` → 「进度更新成功」。
// 旧版紧接着 `t["打单操作"] = o`（**整串覆盖**，不是追加），新版照此语义写 `production_status`。
// 旧版的 `updataProgress` 是旧服务端不透明接口，新版后端没有对应端点 ⇒ 落到订单头字段。
// TODO(未确认): 旧服务端 `updataProgress` 自身是否还会做合并/追加（旧版前端不刷新，看不到服务端结果），
//               无法从 bundle 观测；新版按旧版**前端可见**的「整串覆盖」实现。
async function submitManualProgress() {
  const row = manualTarget.value
  if (!row) return
  if (!row.receipt_no) {
    message.error('缺少回执单号，无法更新进度')
    return
  }
  if (!manualName.value.trim()) {
    message.warning('请先选择或输入操作名称')
    return
  }
  rememberManualAction(manualName.value)
  try {
    await api.updateOrderHead(row.id, headWithStatus(row, manualProgressParam()))
    message.success('进度更新成功')
    closeManualProgress()
    await load()
  } catch (e) {
    message.error((e as Error).message || '更新进度失败')
  }
}

// 旧版 `on`（`:8088`）：删除 → `deleteProgressForFullOrder` → 「进度删除成功」，
// 成功后从 `打单操作` 串里摘掉该段（处理 `x` / `x_` / `_x` 三种形态）。
// 旧版对旧服务端最多重试 5 次；新版后端自洽，PATCH 即持久化 ⇒ 无重试（有意偏离，理由见上）。
async function deleteManualProgress() {
  const row = manualTarget.value
  if (!row) return
  if (!row.receipt_no) {
    message.error('缺少回执单号，无法删除进度')
    return
  }
  if (!manualName.value.trim()) {
    message.warning('请先选择或输入要删除的操作名称')
    return
  }
  const param = manualProgressParam()
  let status = row.production_status
  if (status) {
    if (status === param) status = ''
    else if (status.includes(`_${param}`)) status = status.replace(`_${param}`, '')
    else if (status.includes(`${param}_`)) status = status.replace(`${param}_`, '')
  }
  try {
    await api.updateOrderHead(row.id, headWithStatus(row, status))
    message.success('进度删除成功')
    closeManualProgress()
    await load()
  } catch (e) {
    message.error((e as Error).message || '删除进度失败')
  }
}

// ---------------------------------------------------------------------------
// 列定义（§3；Phase 1 = 工厂视图 Yt）
// ---------------------------------------------------------------------------
function statusBg(status: string): string {
  if (status.includes('收据单')) return '#90EE90'
  if (status.includes('标签')) return '#FFC0CB'
  if (status.includes('玻璃订单')) return '#87CEEB'
  if (status.includes('生产单')) return '#FFFF99'
  if (status.includes('自助下单')) return '#FFA500'
  return ''
}

// 旧版 `ua`（`:7964-7970`）：5 固定段 + 自定义段（flex = 3/个数，色 `#531dab`）。
type ProgressSegment = { label: string; color: string; flex: number; done: boolean }

function progressSegments(status: string): ProgressSegment[] {
  const custom = manualActions.value
  const flex = custom.length > 0 ? CUSTOM_SEGMENT_FLEX / custom.length : 0
  return [
    ...PROGRESS_STEPS.map((step) => ({
      label: step.label,
      color: step.color,
      flex: step.flex,
      // 旧版 `:7967`：`确认下单` 段只看整串是否非空，不要求真的含「确认下单」四个字。
      done: step.label === '确认下单' ? status.length > 0 : status.includes(step.label),
    })),
    ...custom.map((label) => ({
      label,
      color: CUSTOM_SEGMENT_COLOR,
      flex,
      done: status.includes(label),
    })),
  ]
}

// ⚠️ 分隔符口径冲突（需上游拍板）：旧版源码**只用下划线**——`oa`/`aa`（`:7943-7952`）`split("_")`，
// 删除时摘段也是 `x_` / `_x`（`:8100-8103`），全 bundle 查不到按空格切 `打单操作` 的地方；
// 而 `backend/migrations/0018_home_order_head_fields.sql` 的注释把 `打单操作 -> production_status`
// 写成「"生产单 玻璃订单 标签 收据单" 等，**空格串**」（同一段注释里 `单号集` 才是空格串）。
// 这里按**旧版源码**取 `_`；新版自身写入的是单个 token（无分隔符），所以只影响旧数据/多段串。
// 若上游确认新口径是空格串，改这两处的 split 即可。
// 旧版 `oa`（`:7943-7947`）：按 `_` 切分去空段，去掉最后一段后**再补回一个 `_`**；只有一段时返回空串。
function progressPrefix(status: string): string {
  if (!status) return ''
  const parts = status.split('_').filter((p) => p !== '')
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('_') + '_'
}

// 旧版 `aa`（`:7948-7952`）：最后一段；全是空段时原样返回。
function progressSuffix(status: string): string {
  if (!status) return ''
  const parts = status.split('_').filter((p) => p !== '')
  return parts.length ? parts[parts.length - 1] : status
}

// 旧版 `Yt` 分支的格子内容（`:11578-11582`）：色条 + 一行「`前段_` + **深红加粗末段**」+ `✓已付` 徽标。
function renderProgress(row: OrderSummaryDto) {
  const status = row.production_status || ''
  const prefix = progressPrefix(status)
  return [
    h(
      'div',
      { class: 'progress-bar' },
      progressSegments(status).map((seg) =>
        h('div', {
          class: 'progress-seg',
          title: `${seg.label}${seg.done ? ' ✓' : ''}`,
          style: {
            flex: seg.flex,
            minWidth: '4px',
            background: seg.done ? seg.color : '#e0e0e0',
          },
        }),
      ),
    ),
    h('span', null, [
      // 旧版 `qu` 样式：`{font-weight:400}`。
      prefix ? h('span', { style: { fontWeight: '400' } }, prefix) : null,
      // 旧版 `Ju` 样式：`{color:#d9001b; font-weight:700}`。
      h('span', { style: { color: '#d9001b', fontWeight: '700' } }, progressSuffix(status)),
    ]),
    // 旧版 `Vo(row)` = 未收 **=== 0**（是 `===` 不是 `<=`，见 `:7664`）；徽标样式 `_u`。
    unpaidOf(row) === 0
      ? h(
          'span',
          {
            style: {
              marginLeft: '4px',
              color: '#52c41a',
              fontSize: '10px',
              fontWeight: '700',
              verticalAlign: 'middle',
            },
          },
          '✓已付',
        )
      : null,
  ]
}

function renderEditable(
  row: OrderSummaryDto,
  field: 'install_address' | 'remark' | 'salesperson' | 'creator_name',
) {
  const editing = editingId.value === row.id
  if (editing) {
    const d = draft as unknown as Record<string, string>
    return h(NInput, {
      value: d[field],
      size: 'small',
      type: field === 'install_address' || field === 'remark' ? 'textarea' : 'text',
      autosize: { minRows: 1 },
      borderless: true,
      'onUpdate:value': (v: string) => {
        d[field] = v
      },
    })
  }
  return h('div', { class: 'editable-cell', onClick: () => startEdit(row) }, row[field] || '')
}

// 列头 popover（§2.2/§2.3）：手动触发，标题 + 单选列表。
function popoverTitle(
  label: string,
  title: string,
  options: string[],
  currentRef: Ref<string>,
  showRef: Ref<boolean>,
  onPick: (v: string) => void,
) {
  return () =>
    h(
      NPopover,
      { trigger: 'manual', show: showRef.value, 'onUpdate:show': (v: boolean) => (showRef.value = v) },
      {
        trigger: () =>
          h(
            'div',
            { class: 'header-filter', onClick: () => (showRef.value = !showRef.value) },
            [label, h('span', { class: 'header-caret' }, '▾')],
          ),
        default: () =>
          h('div', { class: 'filter-list' }, [
            h('div', { class: 'filter-title' }, title),
            ...options.map((o) =>
              h(
                'div',
                {
                  class: ['filter-item', { active: currentRef.value === o }],
                  onClick: () => {
                    onPick(o)
                    showRef.value = false
                  },
                },
                o,
              ),
            ),
          ]),
      },
    )
}

const paymentPopShow = ref(false)
const progressPopShow = ref(false)

const columns = computed<DataTableColumns<OrderSummaryDto>>(() => [
  { type: 'selection' },
  { type: 'expand', renderExpand: (row) => renderExpandDetail(row) },
  {
    title: '操作',
    key: 'actions',
    width: editingId.value != null ? 150 : 140,
    render: (row) =>
      editingId.value === row.id
        ? h('div', { class: 'action-buttons' }, [
            h(NButton, { size: 'tiny', type: 'primary', onClick: saveEdit }, { default: () => '保存' }),
            h(NButton, { size: 'tiny', onClick: cancelEdit }, { default: () => '取消' }),
          ])
        : h('div', { class: 'action-buttons' }, [
            h(NButton, { size: 'tiny', quaternary: true, type: 'info', onClick: () => openFinance(row) }, { default: () => '财务' }),
            // 电子回执单：进预览页，分享链接在那边一键复制（旧版 Home 是直接复制链接到剪贴板，
            // 但那样看不到内容、剪贴板失败也没提示 —— 新版多一步、两件事都能干）。
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => openReceipt(row) }, { default: () => '电子回执单' }),
          ]),
  },
  {
    title: '单号集',
    key: 'order_no_set',
    minWidth: 120,
    render: (row) => {
      const set = (row.order_no_set || '').trim()
      if (!set) return h('span')
      const parts = set.split(/\s+/)
      return h(NPopover, { trigger: 'hover' }, {
        trigger: () => h('span', parts[0]),
        default: () => h('div', { class: 'order-no-pop' }, parts.map((s) => h('div', s))),
      })
    },
  },
  {
    title: '客户',
    key: 'client_name',
    minWidth: 100,
    // 列头原生筛选（C16/C17）：旧版 `:11400` `filters:ta("客户")` + `"filter-method":ga`
    filterOptions: clientFilterOptions.value,
    filter: (v, row) => textColumnFilter('client_name', v, row),
    filterOptionValues: columnFilterValues('client_name'),
    render: (row) =>
      h('div', { class: 'clickable-cell', onClick: () => openRename(row) }, row.client_name),
  },
  {
    title: '日期',
    key: 'order_date',
    minWidth: 90,
    sortable: true,
    filterOptions: dateFilterOptions.value,
    filter: (v, row) => textColumnFilter('order_date', v, row),
    filterOptionValues: columnFilterValues('order_date'),
    render: (row) => {
      const cells: ReturnType<typeof h>[] = [
        h('div', { class: 'clickable-cell', onClick: () => openDate(row) }, row.order_date),
      ]
      // 旧版 `:11423-11438`（G1）：**未审核**时在日期下方追加一颗 `el-button primary small`
      // 「审核确认」，`margin-top:4px`。
      if (isUnaudited(row)) {
        cells.push(
          h(
            NButton,
            {
              size: 'tiny',
              type: 'primary',
              style: { marginTop: '4px' },
              onClick: () => confirmAudit(row),
            },
            { default: () => '审核确认' },
          ),
        )
      }
      return h('div', cells)
    },
  },
  {
    title: '安装地址',
    key: 'install_address',
    minWidth: 220,
    filterOptions: addressFilterOptions.value,
    filter: (v, row) => textColumnFilter('install_address', v, row),
    filterOptionValues: columnFilterValues('install_address'),
    render: (row) => renderEditable(row, 'install_address'),
  },
  {
    // popover 选项 = `PROGRESS_OPTIONS` + 自定义项（旧版 `Bo` + `La`，`:11558-11573`）。
    title: popoverTitle('打单操作', '生产进度', [...PROGRESS_OPTIONS, ...customProgressOptions.value], progressFilter, progressPopShow, (v) => (progressFilter.value = v)),
    key: 'production_status',
    minWidth: 150,
    filterOptions: productionStatusFilterOptions.value,
    filter: (v, row) => textColumnFilter('production_status', v, row),
    filterOptionValues: columnFilterValues('production_status'),
    // 旧版 `:11571-11582`：整格 `cursor:pointer`，点击（`.stop`）→ 开「手动更新进度」弹窗（`Ha`）。
    render: (row) =>
      h(
        'div',
        {
          class: 'progress-cell',
          style: { cursor: 'pointer', background: statusBg(row.production_status || '') },
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            openManualProgress(row)
          },
        },
        renderProgress(row),
      ),
  },
  {
    title: '门数',
    key: 'door_count',
    minWidth: 80,
    filterOptions: doorCountFilterOptions.value,
    filter: (v, row) => textColumnFilter('door_count', v, row),
    filterOptionValues: columnFilterValues('door_count'),
  },
  {
    title: '总价',
    key: 'total_price',
    minWidth: 100,
    filterOptions: totalPriceFilterOptions.value,
    filter: (v, row) => textColumnFilter('total_price', v, row),
    filterOptionValues: columnFilterValues('total_price'),
    render: (row) => fmt(row.total_price),
  },
  {
    title: '已付',
    key: 'deposit',
    minWidth: 100,
    // 旧版 `:11469` `filters:ma` + `"filter-method":ya` —— 选项是 `co(row)` 的**金额数字**，
    // 不是「已付」这种标签（C18，最容易做错的一处）。
    filterOptions: paidFilterOptions.value,
    filter: paidColumnFilter,
    filterOptionValues: columnFilterValues('deposit'),
    render: (row) => {
      // 旧版 `:11468-11473` 的渲染分支（B37，**本次补上**）：
      //   `已分配金额 != null ? <span style="font-weight:600;color:#409eff">{已分配金额}</span>
      //                       : <el-input 定金>`
      // 即**有财务分配时恒为蓝色加粗 span（不可编辑）**，没有才是可编辑的定金输入框。
      //
      // ⚠️ 补它的直接原因：筛选口径 `co`（见 `paidOf`）本来就是 `已分配金额 ?? 定金`，
      //   而本列原先**恒显示 `deposit`** ⇒ 两者不等时「下拉里能选的数字，格子里一个都找不到」。
      //   照旧版修了显示，两边自动一致。
      //
      // ⚠️⚠️ **判据是 `> 0` 而不是 `!= null`（这里踩过一次，别再改回去）**：
      //   旧版 `:11470` 判的是**订单行上的 `已分配金额 != null`** —— 那个字段在没有分配时**是 null**。
      //   而新版摘要里的 `allocated_amount` 是 **`number`（非可空）**，后端用
      //   `COALESCE(SUM(amount), 0.0)` 再相加（`finance/service.rs:64-77`）⇒ **没有分配时是 0，不是 null**。
      //   照抄 `!= null` 会让条件**恒真**（摘要覆盖近 60 天的每一张单）⇒ **编辑框变成死代码**：
      //   凡用户实际会编辑的订单，已付列都恒为蓝色只读 `0.00`。**实测复现过**（第二轮审计）。
      //
      //   等价性：后端 `allocated = 已收 + 已分配`，没有分配/收款时为 0 ⟺ 旧版的 `null`。
      //   唯一不等价的边角：**分配额恰好为 0** 的单 —— 旧版显示只读 `0.00`、新版可编辑。
      //   那是退化情形（没有人为 0 元的分配记录），可接受。
      const s = financeSummary.value[row.id]
      if (s && s.allocated_amount > 0) {
        return h('span', { style: { fontWeight: 600, color: '#409eff' } }, fmt(s.allocated_amount))
      }
      if (editingId.value === row.id) {
        return h(NInputNumber, {
          value: draft.deposit,
          size: 'small',
          'onUpdate:value': (v: number | null) => {
            draft.deposit = v ?? 0
          },
        })
      }
      return h('div', { class: 'editable-cell', onClick: () => startEdit(row) }, fmt(row.deposit))
    },
  },
  {
    title: popoverTitle('未付', '付款状态', PAYMENT_OPTIONS, paymentFilter, paymentPopShow, (v) => (paymentFilter.value = v)),
    key: 'unpaid',
    minWidth: 100,
    // 旧版 `:11475` `filters:wa` + `"filter-method":fa` —— 同样是 `so(row)` 的金额数字。
    filterOptions: unpaidFilterOptions.value,
    filter: unpaidColumnFilter,
    filterOptionValues: columnFilterValues('unpaid'),
    render: (row) => {
      const u = unpaidOf(row)
      return h('span', { style: { color: u <= 0 ? '#67c23a' : '#f56c6c', fontWeight: 'bold' } }, fmt(u))
    },
  },
  {
    title: '订单备注',
    key: 'remark',
    minWidth: 220,
    filterOptions: remarkFilterOptions.value,
    filter: (v, row) => textColumnFilter('remark', v, row),
    filterOptionValues: columnFilterValues('remark'),
    render: (row) => renderEditable(row, 'remark'),
  },
  {
    title: '业务员',
    key: 'salesperson',
    minWidth: 80,
    filterOptions: salespersonFilterOptions.value,
    filter: (v, row) => textColumnFilter('salesperson', v, row),
    filterOptionValues: columnFilterValues('salesperson'),
    render: (row) => renderEditable(row, 'salesperson'),
  },
  {
    title: '打单人',
    key: 'creator_name',
    minWidth: 80,
    filterOptions: creatorFilterOptions.value,
    filter: (v, row) => textColumnFilter('creator_name', v, row),
    filterOptionValues: columnFilterValues('creator_name'),
    render: (row) => renderEditable(row, 'creator_name'),
  },
])

const tableHeight = 'calc(100vh - 300px)'
</script>

<style scoped>
.home-container {
  padding: 10px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.header-container {
  flex-shrink: 0;
}

.toolbar-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.grow-spacer {
  flex: 1;
}

.search-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}

.search-input {
  width: 320px;
}

.summary-info {
  font-size: 13px;
  color: #606266;
}

.table-container {
  flex: 1;
  min-height: 0;
}

/* 表头米色 + 16px bold 左对齐；单元格 16px（§3 `ha`/`dn`） */
:deep(.n-data-table-th) {
  background-color: #faeBD7 !important;
  color: #000 !important;
  font-size: 16px;
  font-weight: bold;
  text-align: left;
}
:deep(.n-data-table-td) {
  font-size: 16px;
}

.pagination-container {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 10px 0;
}

/* 可编辑格：无边框，hover 提示 */
.editable-cell,
.clickable-cell {
  min-height: 26px;
  line-height: 26px;
  cursor: pointer;
  border-radius: 3px;
  padding: 0 4px;
}
.editable-cell:hover,
.clickable-cell:hover {
  background: #f5f7fa;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

/* 打单操作进度条 */
.progress-cell {
  padding: 2px;
  border-radius: 3px;
}
.progress-bar {
  display: flex;
  height: 16px;
  border-radius: 3px;
  overflow: hidden;
  /* 旧版 `Au`/`ju`（`:7446-7449`）有 `margin-bottom:4px` —— 条下方现在有文字行，需要这段间距。 */
  margin-bottom: 4px;
}
.progress-seg {
  height: 100%;
}

/* 列头 popover 触发器 */
.header-filter {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  user-select: none;
}
.header-caret {
  font-size: 10px;
  color: #909399;
}
.filter-list {
  min-width: 130px;
}
.filter-title {
  font-size: 12px;
  color: #909399;
  padding: 6px 12px 4px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 4px;
}
.filter-item {
  padding: 6px 12px;
  cursor: pointer;
  font-size: 14px;
}
.filter-item:hover {
  background: #f5f7fa;
}
.filter-item.active {
  color: #409eff;
  font-weight: 700;
}

.order-no-pop {
  padding: 4px 6px;
  font-size: 13px;
}

/* 展开明细 */
.expand-detail {
  padding: 8px 16px 8px 60px;
  background: #fafafa;
}
.detail-block {
  margin-bottom: 8px;
}
.detail-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 行状态色（§3：.date-audit 未审核 / .date-warning 临近截止） */
:deep(.date-audit) td {
  background: #ffb6c1 !important;
}
:deep(.date-warning) td {
  background: #fff3cd !important;
}
</style>
