<template>
  <div class="home-container">
    <!-- 顶部：按钮组 + 搜索框 + 汇总信息条（仿旧版 search-section） -->
    <div class="header-container">
      <div class="toolbar-row">
        <n-button size="small" :loading="loading" @click="load">刷新</n-button>
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
        <div v-if="searchText.trim()" class="summary-info">
          当前筛选: {{ searchText.trim() }}（{{ filtered.length }} 条结果）
          | 时间: {{ summary.earliest || '—' }} 至 {{ summary.latest || '—' }}
          | 门数: {{ summary.doors }} | 总价: {{ fmt(summary.total) }}
          | 未付: {{ fmt(summary.unpaid) }} | 未付单数: {{ summary.unpaidCount }}
          | 未审核: {{ summary.unaudited }}
        </div>
      </div>
    </div>

    <!-- 订单主表 -->
    <div class="table-container">
      <n-data-table
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

    <!-- 财务抽屉（§5 FinanceDrawer） -->
    <FinanceDrawer v-model:show="financeShow" :order="financeOrder" @saved="onFinanceSaved" />

    <!-- 打印选项抽屉（§4.2 打印选中订单） -->
    <PrintDrawer v-model:show="printShow" :orders="printOrders" />

    <!-- 经营看板（§1.2 DashboardBigScreen，数据全部来自前端订单列表） -->
    <DashboardBigScreen v-model:show="dashboardShow" :orders="dashboardOrders" />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
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
  type DataTableRowKey,
} from 'naive-ui'
import { api } from '../api/client'
import { useAuthStore } from '../stores/auth'
import FinanceDrawer from '../components/FinanceDrawer.vue'
import DashboardBigScreen from '../components/DashboardBigScreen.vue'
import PrintDrawer from '../components/PrintDrawer.vue'
import type { OrderDto, OrderFinance, OrderHeadInput, OrderLineDto, OrderSummaryDto } from '../api/types'

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
  return true
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

const filtered = computed(() => {
  // 非管理员只看自己打的单（§3.1 `fs`）。
  let list = rawOrders.value
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
  return list.filter(matchSearch)
})

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
  const unpaid = list.reduce((s, r) => s + unpaidOf(r), 0)
  const unpaidCount = list.filter((r) => unpaidOf(r) > 0).length
  const unaudited = list.filter(
    (r) => !r.production_status?.trim() && !r.order_no_set?.trim(),
  ).length
  return { earliest, latest, doors, total, unpaid, unpaidCount, unaudited }
})

// ---------------------------------------------------------------------------
// 分页（§3.1 客户端分页，默认 50）
// ---------------------------------------------------------------------------
const page = ref(1)
const pageSize = ref(50)
const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

watch([searchText, onlyUnproduced, paymentFilter, progressFilter], () => {
  page.value = 1
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

function rowProps(r: OrderSummaryDto) {
  const cls: string[] = []
  if (!r.production_status?.trim() && !r.order_no_set?.trim()) cls.push('date-audit')
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

function onCheckedKeys(keys: DataTableRowKey[]) {
  checkedRowKeys.value = keys
}

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

// 展开行明细（§4.1）：平开/移门只读子表，逐行 fetch detail。
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

function renderProgress(status: string) {
  return h(
    'div',
    { class: 'progress-bar' },
    PROGRESS_STEPS.map((step) =>
      h('div', {
        class: 'progress-seg',
        title: `${step.label}${status.includes(step.label) ? ' ✓' : ''}`,
        style: { flex: step.flex, background: status.includes(step.label) ? step.color : '#e0e0e0' },
      }),
    ),
  )
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
    render: (row) =>
      h('div', { class: 'clickable-cell', onClick: () => openRename(row) }, row.client_name),
  },
  {
    title: '日期',
    key: 'order_date',
    minWidth: 90,
    sortable: true,
    render: (row) =>
      h('div', { class: 'clickable-cell', onClick: () => openDate(row) }, row.order_date),
  },
  {
    title: '安装地址',
    key: 'install_address',
    minWidth: 220,
    render: (row) => renderEditable(row, 'install_address'),
  },
  {
    title: popoverTitle('打单操作', '生产进度', PROGRESS_OPTIONS, progressFilter, progressPopShow, (v) => (progressFilter.value = v)),
    key: 'production_status',
    minWidth: 150,
    render: (row) =>
      h('div', { class: 'progress-cell', style: { background: statusBg(row.production_status || '') } }, renderProgress(row.production_status || '')),
  },
  { title: '门数', key: 'door_count', minWidth: 80 },
  { title: '总价', key: 'total_price', minWidth: 100, render: (row) => fmt(row.total_price) },
  {
    title: '已付',
    key: 'deposit',
    minWidth: 100,
    render: (row) => {
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
    render: (row) => {
      const u = unpaidOf(row)
      return h('span', { style: { color: u <= 0 ? '#67c23a' : '#f56c6c', fontWeight: 'bold' } }, fmt(u))
    },
  },
  {
    title: '订单备注',
    key: 'remark',
    minWidth: 220,
    render: (row) => renderEditable(row, 'remark'),
  },
  { title: '业务员', key: 'salesperson', minWidth: 80, render: (row) => renderEditable(row, 'salesperson') },
  { title: '打单人', key: 'creator_name', minWidth: 80, render: (row) => renderEditable(row, 'creator_name') },
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
