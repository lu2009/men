<template>
  <n-drawer v-model:show="show" :width="drawerWidth" placement="right">
    <n-drawer-content :title="`财务管理 — ${order?.client_name || ''}`" closable>
      <n-tabs v-model:value="tab" type="line">
        <!-- ───────────────────────── Tab 1 本单财务 ───────────────────────── -->
        <n-tab-pane name="order" tab="📄 本单财务">
          <div v-if="orderFinance" class="finance-body">
            <div class="banner">
              <span>回执单号：{{ order?.receipt_no }}</span>
              <span>订单总价：<b>¥{{ fmt(orderFinance.total_price) }}</b></span>
              <span>本单未收：<b :class="orderFinance.unpaid_amount > 0 ? 'text-danger' : ''">¥{{ fmt(orderFinance.unpaid_amount) }}</b></span>
            </div>

            <div class="summary-grid">
              <div class="stat-card">
                <div class="stat-label">订单总价</div>
                <div class="stat-value">¥{{ fmt(orderFinance.total_price) }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">已分配金额</div>
                <div class="stat-value">¥{{ fmt(orderFinance.allocated_amount) }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">订单调整金额</div>
                <div class="stat-value text-warning">¥{{ fmt(orderFinance.adjustment_amount) }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">未收金额</div>
                <div class="stat-value" :class="orderFinance.unpaid_amount > 0 ? 'text-danger' : ''">
                  ¥{{ fmt(orderFinance.unpaid_amount) }}
                </div>
              </div>
            </div>

            <!--
              「新增抹零」摆在这里 —— **在收款分配记录表的上面**，不是和「本单收款」挤一起。
              旧版的渲染顺序（`legacy/js/Home.formatted.js` 的 FinanceDrawer 段，按**源码顺序**读）：
                  `Zl` 按钮行（含两颗按钮）  →  `el-table`（收款记录）  →  `el-form`（本单收款录入）
              文案也对回旧版：`To(509)` = 「新增抹零」。
              ⚠️ 先前放成了「本单收款」标题的内联按钮，且文案写成「订单抹零 / 冲销」—— 两处都不对。
            -->
            <div class="action-row">
              <!-- 顺序照旧版：切换按钮先、新增抹零后（`:588` 的 `type:"primary"` → `:592` 的 `type:warning`） -->
              <n-button type="primary" size="small" @click="orderPayFormOpen = !orderPayFormOpen">
                {{ orderPayFormOpen ? '收起' : '录入本单收款' }}
              </n-button>
              <n-button size="small" type="warning" @click="openOrderAdjust">新增抹零</n-button>
            </div>

            <!-- 收款分配记录 -->
            <div class="section-title">收款分配记录</div>
            <n-data-table
              :columns="paymentRecordColumns"
              :data="orderFinance.payment_records"
              size="small"
              :max-height="180"
            />

            <!-- 本单收款表单（默认收起，点上面那颗「录入本单收款」才展开 —— 旧版 `f` 初值是 `!1`） -->
            <template v-if="orderPayFormOpen">
              <div class="section-title">本单收款</div>
              <n-form label-placement="left" label-width="80" size="small">
                <n-form-item label="收款金额">
                  <n-input-number
                    v-model:value="orderPayForm.amount"
                    style="width: 100%"
                    :precision="2"
                    :placeholder="`正数收款 / 负数红冲，最多可收 ¥${fmt(orderFinance.unpaid_amount)}`"
                  />
                </n-form-item>
                <n-form-item label="收款日期">
                  <!-- 旧版是 `type="datetime"` + `format="YYYY-MM-DD HH:mm"`（日期**加时间**） -->
                  <n-date-picker
                    v-model:value="orderPayForm.dateTs"
                    type="datetime"
                    format="yyyy-MM-dd HH:mm"
                    style="width: 100%"
                    placeholder="选择收款时间"
                  />
                </n-form-item>
              <n-form-item label="收款方式">
                <n-select v-model:value="orderPayForm.method" :options="methodOptions" />
              </n-form-item>
              <n-form-item label="备注">
                <n-input v-model:value="orderPayForm.remark" placeholder="备注（可选）" />
              </n-form-item>
              <n-form-item label="预付优惠">
                <n-switch v-model:value="orderPayForm.usePrepay" />
                <span v-if="orderPayForm.usePrepay" class="prepay-inline">
                  <n-input-number
                    v-model:value="orderPayForm.discountRate"
                    style="width: 120px"
                    :min="0.1"
                    :max="99"
                    :precision="1"
                    placeholder="优惠比例%"
                  />
                  <span class="hint">预计抵扣 ¥{{ fmt(prepayDiscount) }}</span>
                </span>
                </n-form-item>
              </n-form>
              <div class="action-row">
                <n-button type="primary" size="small" :loading="saving" @click="submitOrderPayment">
                  确认本单收款
                </n-button>
              </div>
            </template>

            <!-- 订单调整记录 -->
            <div class="section-title">订单调整记录</div>
            <n-data-table
              :columns="adjustRecordColumns"
              :data="orderFinance.adjustment_records"
              size="small"
              :max-height="160"
            />
          </div>
          <n-empty v-else-if="!loading" description="加载中或暂无数据" />
        </n-tab-pane>

        <!-- ───────────────────────── Tab 2 客户收款 ───────────────────────── -->
        <n-tab-pane name="customer" tab="💰 客户收款">
          <div class="finance-body">
            <div class="purple-card">
              <div class="pcell"><span>订单总额</span><b>¥{{ fmt(balance?.order_total) }}</b></div>
              <div class="pcell"><span>已实收</span><b>¥{{ fmt(balance?.paid_amount) }}</b></div>
              <div class="pcell"><span>客户余额</span><b>¥{{ fmt(balance?.customer_balance) }}</b></div>
              <div class="pcell"><span>未分配余额</span><b>¥{{ fmt(balance?.unallocated_balance) }}</b></div>
            </div>

            <!--
              本 tab 的摆放**照旧版**（`legacy/js/Home.formatted.js` 的 FinanceDrawer 段）：
                · 顶部**单摆一行**：`分配预付款`（旧版 `ro` = `{style:{margin-top:10px}}`，`:774`）
                · 次要按钮**内联在小节标题行**：旧版 `io` = `{class:"section-title",style:{margin-top:16px}}`
                  里是「 录入新收款 」+ `新增抹零` + `客户抹零`，后两颗带 `margin-left:8px`（`:782`/`:788`）
                · 表单
                · `预览自动分配`
                · 「 剩余未分配: 」+ **`确认提交收款`** —— 主操作在**预览结果下面**，不是和预览并排
              ⚠️ 先前我们把三颗一次性和「预览/提交」并排塞在两个 `.action-row` 里，
                 与旧版顺序不同；先后顺序在旧版是有意义的（确认发生在看过预览之后）。
            -->
            <div class="action-row">
              <n-button size="small" @click="openPrepayAllocate">预付款分配</n-button>
            </div>

            <div class="section-title">
              <span>录入收款</span>
              <n-button size="small" type="warning" class="title-btn" @click="openCustomerAdjust">
                客户抹零 / 冲销
              </n-button>
              <n-button size="small" type="success" class="title-btn" @click="openPrepayment">
                录入预付款
              </n-button>
            </div>
            <n-form label-placement="left" label-width="80" size="small">
              <n-form-item label="收款金额">
                <n-input-number
                  v-model:value="customerPayForm.amount"
                  style="width: 100%"
                  :precision="2"
                  placeholder="正数=收款；负数=红冲（冲销错误收款）"
                />
              </n-form-item>
              <n-form-item label="收款日期">
                <n-date-picker
                  v-model:value="customerPayForm.dateTs"
                  type="datetime"
                  format="yyyy-MM-dd HH:mm"
                  style="width: 100%"
                  placeholder="选择收款时间"
                />
              </n-form-item>
              <n-form-item label="收款方式">
                <n-select v-model:value="customerPayForm.method" :options="methodOptions" />
              </n-form-item>
              <n-form-item label="备注">
                <n-input v-model:value="customerPayForm.remark" placeholder="备注（可选）" />
              </n-form-item>
            </n-form>
            <div class="action-row">
              <n-button type="primary" size="small" :loading="saving" @click="previewAllocation">预览分配</n-button>
            </div>

            <template v-if="allocationPreview">
              <div class="section-title">分配预览（按订单日期从早到晚）</div>
              <n-data-table
                :columns="allocationColumns"
                :data="allocationPreview.allocations"
                :row-key="(r: AllocationItem) => r.order_id"
                size="small"
                :max-height="180"
              />
              <div class="preview-footer">
                剩余未分配：<b :class="allocationPreview.remaining_unallocated > 0 ? 'text-warning' : ''">
                  ¥{{ fmt(allocationPreview.remaining_unallocated) }}
                </b>
              </div>
              <!-- 主操作放在预览**下面**：旧版也是「先看预览、再确认提交」 -->
              <div class="action-row">
                <n-button type="primary" size="small" :loading="saving" @click="submitCustomerPayment">
                  提交收款
                </n-button>
              </div>
            </template>
          </div>
        </n-tab-pane>

        <!-- ───────────────────────── Tab 3 客户对账 ───────────────────────── -->
        <n-tab-pane name="statement" tab="📊 客户对账">
          <div class="finance-body">
            <div class="purple-card">
              <div class="pcell"><span>订单总额</span><b>¥{{ fmt(balance?.order_total) }}</b></div>
              <div class="pcell"><span>实收</span><b>¥{{ fmt(balance?.paid_amount) }}</b></div>
              <div class="pcell"><span>调整合计</span><b>¥{{ fmt(adjustTotal) }}</b></div>
              <div class="pcell"><span>客户余额</span><b>¥{{ fmt(balance?.customer_balance) }}</b></div>
            </div>

            <!-- 旧版把「刷新图表」内联在「收款趋势」标题行里（`:944`，`onClick: ae(客户编号)`） -->
            <div class="section-title">
              <span>收款趋势</span>
              <n-button
                size="small"
                class="title-btn"
                :loading="statsLoading"
                @click="refreshStats"
              >
                刷新图表
              </n-button>
            </div>
            <div v-if="stats && stats.monthly.length" class="chart">
              <div v-for="m in stats.monthly" :key="m.month" class="chart-row">
                <span class="chart-label">{{ m.month }}</span>
                <div class="chart-bar-wrap">
                  <div class="chart-bar receipt" :style="{ width: barWidth(m.receipt) }" :title="'收款 ¥' + fmt(m.receipt)" />
                  <div class="chart-bar refund" :style="{ width: barWidth(m.refund) }" :title="'红冲 ¥' + fmt(m.refund)" />
                </div>
                <span class="chart-val">收{{ fmt(m.receipt) }} / 冲{{ fmt(m.refund) }}</span>
              </div>
              <div class="chart-legend">
                <span><i class="dot receipt" /> 收款</span>
                <span><i class="dot refund" /> 红冲</span>
              </div>
            </div>
            <n-empty v-else-if="!loading" description="暂无收款记录" size="small" />

            <!--
              对账明细上方那排按钮（旧版容器 `zo` = `{style:{margin-top:10px;display:flex;gap:8px}}`，`:924`）：
                [月度抹零]        type=warning，开客户抹零弹窗（默认类型就是「月度抹零」）
                [刷新对账单]      重拉对账明细
                [仅看近365天/查看全部历史]  切换，`F` 真时 `type="warning"`
            -->
            <div class="action-row">
              <n-button size="small" type="warning" @click="openCustomerAdjust">月度抹零</n-button>
              <n-button size="small" :loading="statementLoading" @click="refreshStatement">
                刷新对账单
              </n-button>
              <n-button
                size="small"
                :type="stmtShowAll ? 'warning' : 'default'"
                @click="stmtShowAll = !stmtShowAll"
              >
                {{ stmtShowAll ? '仅看近365天' : '查看全部历史' }}
              </n-button>
            </div>

            <div class="section-title">对账明细（按日期降序）</div>
            <div class="filter-row">
              <n-select
                v-model:value="stmtTypeFilter"
                :options="stmtTypeOptions"
                size="small"
                style="width: 130px"
              />
              <n-input
                v-model:value="stmtKeyword"
                size="small"
                placeholder="筛选：单号 / 日期 / 地址 / 备注"
                clearable
              />
            </div>
            <n-data-table
              :columns="statementColumns"
              :data="filteredStatement"
              size="small"
              :max-height="320"
            />
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-drawer-content>
  </n-drawer>

  <!-- ───────────────────────── 弹窗：订单抹零/冲销 ───────────────────────── -->
  <n-modal v-model:show="orderAdjustShow" preset="card" title="订单抹零 / 冲销" style="width: 380px">
    <n-form label-placement="left" label-width="80" size="small">
      <n-form-item label="调整金额">
        <n-input-number
          v-model:value="orderAdjustForm.amount"
          style="width: 100%"
          :precision="2"
          placeholder="正数=减免，负数=冲销错误抹零"
        />
      </n-form-item>
      <n-form-item label="调整类型">
        <n-select v-model:value="orderAdjustForm.type" :options="orderAdjustTypes" />
      </n-form-item>
      <n-form-item label="备注">
        <n-input v-model:value="orderAdjustForm.remark" />
      </n-form-item>
    </n-form>
    <template #footer>
      <div class="modal-footer">
        <n-button size="small" @click="orderAdjustShow = false">取消</n-button>
        <n-button size="small" type="primary" :loading="saving" @click="submitOrderAdjust">确认抹零</n-button>
      </div>
    </template>
  </n-modal>

  <!-- ───────────────────────── 弹窗：客户抹零/冲销 ───────────────────────── -->
  <n-modal v-model:show="customerAdjustShow" preset="card" title="客户抹零 / 冲销" style="width: 380px">
    <n-form label-placement="left" label-width="80" size="small">
      <n-form-item label="调整金额">
        <n-input-number
          v-model:value="customerAdjustForm.amount"
          style="width: 100%"
          :precision="2"
          placeholder="如：2025年3月月结尾款抹零"
        />
      </n-form-item>
      <n-form-item label="调整类型">
        <n-select v-model:value="customerAdjustForm.type" :options="customerAdjustTypes" />
      </n-form-item>
      <n-form-item label="备注">
        <n-input v-model:value="customerAdjustForm.remark" />
      </n-form-item>
    </n-form>
    <template #footer>
      <div class="modal-footer">
        <n-button size="small" @click="customerAdjustShow = false">取消</n-button>
        <n-button size="small" type="primary" :loading="saving" @click="submitCustomerAdjust">确认抹零</n-button>
      </div>
    </template>
  </n-modal>

  <!-- ───────────────────────── 弹窗：录入预付款 ───────────────────────── -->
  <n-modal v-model:show="prepaymentShow" preset="card" title="录入预付款" style="width: 400px">
    <n-form label-placement="left" label-width="80" size="small">
      <n-form-item label="收款金额">
        <n-input-number
          v-model:value="prepaymentForm.amount"
          style="width: 100%"
          :precision="2"
          :min="0.01"
          :placeholder="
            prepaymentForm.isRefund
              ? `输入冲销金额（最大 ¥${fmt(balance?.unallocated_balance ?? 0)}）`
              : '输入预付款金额'
          "
        />
      </n-form-item>
      <n-form-item label="收款日期">
        <n-date-picker
          v-model:value="prepaymentForm.dateTs"
          type="datetime"
          format="yyyy-MM-dd HH:mm"
          style="width: 100%"
          placeholder="选择收款时间"
        />
      </n-form-item>
      <n-form-item label="收款方式">
        <n-select v-model:value="prepaymentForm.method" :options="methodOptions" />
      </n-form-item>
      <n-form-item label="备注">
        <n-input v-model:value="prepaymentForm.remark" />
      </n-form-item>
      <n-form-item label="冲销">
        <n-switch v-model:value="prepaymentForm.isRefund" />
        <span class="hint ml8">冲销将从未分配余额扣减</span>
      </n-form-item>
    </n-form>
    <template #footer>
      <div class="modal-footer">
        <n-button size="small" @click="prepaymentShow = false">取消</n-button>
        <n-button size="small" type="primary" :loading="saving" @click="submitPrepayment">确认录入</n-button>
      </div>
    </template>
  </n-modal>

  <!-- ───────────────────────── 弹窗：预付款分配 ───────────────────────── -->
  <n-modal v-model:show="prepayAllocateShow" preset="card" title="预付款分配" style="width: 560px">
    <n-form label-placement="left" label-width="80" size="small">
      <n-form-item label="分配金额">
        <n-input-number
          v-model:value="prepayAllocateForm.amount"
          style="width: 100%"
          :precision="2"
          :min="0.01"
          placeholder="不超过未分配余额"
        />
      </n-form-item>
      <n-form-item label="优惠比例">
        <n-input-number v-model:value="prepayAllocateForm.discountRate" style="width: 100%" :min="0.1" :max="99" :precision="1" />
      </n-form-item>
    </n-form>
    <div class="action-row">
      <n-button type="primary" size="small" :loading="saving" @click="previewPrepayAllocate">预览分配方案</n-button>
    </div>

    <template v-if="prepayAllocatePreview">
      <n-data-table
        :columns="allocationColumns"
        :data="prepayAllocatePreview.allocations"
        :row-key="(r: AllocationItem) => r.order_id"
        size="small"
        :max-height="200"
      />
      <!--
        ⚠️ 「资金池剩余」这个标签 2026-09-18 改过：`pool_remaining` 对齐旧版口径之后
        = **本次拟分配里没分掉的**（`amount − Σ分配`），**不是**「客户池子还剩多少」。
        后者现在单独返回 `available_balance`。两个都显示，并写清各自是什么。
      -->
      <div class="preview-footer">
        <span>合计分配：¥{{ fmt(prepayAllocatePreview.total_allocated) }}</span>
        <span class="ml8">优惠：¥{{ fmt(prepayAllocatePreview.total_discount) }}</span>
        <span class="ml8">本次未分掉：¥{{ fmt(prepayAllocatePreview.pool_remaining) }}</span>
        <span class="ml8">资金池可用：¥{{ fmt(prepayAllocatePreview.available_balance) }}</span>
      </div>
    </template>

    <template #footer>
      <div class="modal-footer">
        <n-button size="small" @click="prepayAllocateShow = false">取消</n-button>
        <n-button size="small" type="primary" :disabled="!prepayAllocatePreview" :loading="saving" @click="submitPrepayAllocate">
          确认分配
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, ref, watch, onMounted } from 'vue'
import {
  NButton,
  NDataTable,
  NDatePicker,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSwitch,
  NTabPane,
  NTabs,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { api } from '../api/client'
import type {
  AllocationItem,
  AllocationPreview,
  CustomerBalance,
  FinanceRecord,
  OrderFinanceDetail,
  PaymentStatsDto,
  PrepaymentAllocationPreview,
  StatementItem,
} from '../api/types'

const props = defineProps<{
  show: boolean
  order: { id: number; receipt_no: string; client_code: string; client_name: string; total_price: number } | null
}>()

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'saved'): void
}>()

const message = useMessage()
const show = computed({
  get: () => props.show,
  set: (v: boolean) => emit('update:show', v),
})

const drawerWidth = computed(() => (window.innerWidth <= 768 ? '100%' : '520px'))

const tab = ref<'order' | 'customer' | 'statement'>('order')
const loading = ref(false)
const saving = ref(false)

const orderFinance = ref<OrderFinanceDetail | null>(null)
const balance = ref<CustomerBalance | null>(null)
const statement = ref<StatementItem[]>([])
const stats = ref<PaymentStatsDto | null>(null)

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (v: number | undefined | null) => (v ?? 0).toFixed(2)
/**
 * 时间戳 → `YYYY-MM-DD HH:mm`（旧版收款日期是 `type="datetime"`、`format="YYYY-MM-DD HH:mm"`）。
 * ⚠️ 后端 `pay_date` 是 TEXT，且**本来就按带时间的形态处理**
 *    （`finance/service.rs:966` 注释：「存 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm:ss'，取前 7/4 位即可」），
 *    按月/按年聚合用的是 `left(pay_date, 7)`，所以带时间不影响趋势统计。
 */
const dateStr = (ts: number | null) => {
  if (ts == null) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const todayTs = () => Date.now()

// ---------------------------------------------------------------------------
// 收款方式（§5.3：默认 5 项 + localStorage 自定义）
// ---------------------------------------------------------------------------
const DEFAULT_METHODS = ['微信', '支付宝', '现金', '转账', '其他']
const METHOD_KEY = 'finance_payment_methods'
const customMethods = ref<string[]>([])

function loadMethods() {
  try {
    const raw = localStorage.getItem(METHOD_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as string[]
      customMethods.value = arr.filter(
        (m) => m && m.trim() && !DEFAULT_METHODS.includes(m),
      )
    }
  } catch {
    customMethods.value = []
  }
}

const methodOptions = computed(() =>
  [...DEFAULT_METHODS, ...customMethods.value].map((m) => ({ label: m, value: m })),
)

// ---------------------------------------------------------------------------
// 加载
// ---------------------------------------------------------------------------
async function load() {
  if (!props.order) return
  loading.value = true
  try {
    const [of, cb, st, st2] = await Promise.all([
      api.getOrderFinance(props.order.id),
      api.getCustomerBalance(props.order.client_code),
      api.getCustomerStatement(props.order.client_code),
      api.getPaymentStats(props.order.client_code),
    ])
    orderFinance.value = of
    balance.value = cb
    statement.value = st
    stats.value = st2
  } catch (e) {
    message.error((e as Error).message || '加载财务数据失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (v) => {
    if (v) load()
  },
)

onMounted(loadMethods)

// ---------------------------------------------------------------------------
// Tab1 本单收款
// ---------------------------------------------------------------------------
/**
 * 「本单收款」录入表单是否展开（旧版 `f = Vue.ref(!1)` —— **默认收起**）。
 * 控制它的就是上面那颗 `收起 / 录入本单收款` 按钮；表单收起时整块不渲染。
 */
const orderPayFormOpen = ref(false)

const orderPayForm = ref({
  amount: null as number | null,
  // 默认「现在」—— 旧版是 `(new Date).toISOString().slice(0,16)`，打开就是当前时间，不用手动选
  dateTs: Date.now() as number | null,
  method: '微信',
  remark: '',
  usePrepay: false,
  discountRate: 10 as number,
})

const prepayDiscount = computed(() => {
  if (!orderPayForm.value.usePrepay || !orderFinance.value) return 0
  const unpaid = Math.max(0, orderFinance.value.unpaid_amount)
  const pool = Math.max(0, balance.value?.unallocated_balance ?? 0)
  const rate = Math.max(0, orderPayForm.value.discountRate) / 100
  return Math.round(100 * Math.min(unpaid * rate, pool)) / 100
})

async function submitOrderPayment() {
  if (!props.order) return
  const amount = orderPayForm.value.amount
  if (amount == null || Math.abs(amount) < 0.005) {
    message.warning('收款金额不能为零')
    return
  }
  saving.value = true
  try {
    await api.addOrderPayment(props.order.id, {
      customer_code: props.order.client_code,
      customer_name: props.order.client_name,
      receipt_no: props.order.receipt_no,
      amount,
      pay_date: dateStr(orderPayForm.value.dateTs),
      method: orderPayForm.value.method,
      remark: orderPayForm.value.remark,
      use_prepay_discount: orderPayForm.value.usePrepay,
      discount_rate: orderPayForm.value.discountRate,
    })
    message.success('收款成功')
    // 旧版提交后把表单整个重置（`收款金额=null` / `备注=""` / 日期回到当前时间）
    orderPayForm.value.amount = null
    orderPayForm.value.usePrepay = false
    orderPayForm.value.remark = ''
    orderPayForm.value.dateTs = Date.now()
    await reload()
  } catch (e) {
    message.error((e as Error).message || '收款失败')
  } finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// Tab2 客户收款 + 分配
// ---------------------------------------------------------------------------
const customerPayForm = ref({
  amount: null as number | null,
  dateTs: Date.now() as number | null,
  method: '微信',
  remark: '',
})
const allocationPreview = ref<AllocationPreview | null>(null)

async function previewAllocation() {
  if (!props.order) return
  const amount = customerPayForm.value.amount
  if (amount == null || Math.abs(amount) < 0.005) {
    message.warning('收款金额不能为零')
    return
  }
  saving.value = true
  try {
    allocationPreview.value = await api.previewAllocation(props.order.client_code, {
      customer_code: props.order.client_code,
      amount,
    })
  } catch (e) {
    message.error((e as Error).message || '预览失败')
  } finally {
    saving.value = false
  }
}

async function submitCustomerPayment() {
  if (!props.order) return
  const amount = customerPayForm.value.amount
  if (amount == null || Math.abs(amount) < 0.005) {
    message.warning('收款金额不能为零')
    return
  }
  if (!allocationPreview.value) {
    message.warning('请先预览分配')
    return
  }
  saving.value = true
  try {
    await api.addCustomerPayment(props.order.client_code, {
      customer_code: props.order.client_code,
      customer_name: props.order.client_name,
      amount,
      pay_date: dateStr(customerPayForm.value.dateTs),
      method: customerPayForm.value.method,
      remark: customerPayForm.value.remark,
      allocations: allocationPreview.value.allocations.map((a) => ({
        order_id: a.order_id,
        receipt_no: a.receipt_no,
        order_date: a.order_date,
        total_price: a.total_price,
        amount: a.allocated_amount,
        remaining_after: a.remaining_after,
      })),
    })
    message.success('收款成功')
    customerPayForm.value.amount = null
    customerPayForm.value.remark = ''
    allocationPreview.value = null
    customerPayForm.value.dateTs = Date.now()
    await reload()
  } catch (e) {
    message.error((e as Error).message || '收款失败')
  } finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// 订单抹零
// ---------------------------------------------------------------------------
const ORDER_ADJUST_TYPES = ['抹零', '优惠', '补贴', '冲销', '其他']
const CUSTOMER_ADJUST_TYPES = ['月度抹零', '优惠', '冲销', '其他']
const orderAdjustTypes = ORDER_ADJUST_TYPES.map((t) => ({ label: t, value: t }))
const customerAdjustTypes = CUSTOMER_ADJUST_TYPES.map((t) => ({ label: t, value: t }))

const orderAdjustShow = ref(false)
const orderAdjustForm = ref({ amount: null as number | null, type: '抹零', remark: '' })

function openOrderAdjust() {
  orderAdjustForm.value = { amount: null, type: '抹零', remark: '' }
  orderAdjustShow.value = true
}

async function submitOrderAdjust() {
  if (!props.order) return
  if (orderAdjustForm.value.amount == null) return
  saving.value = true
  try {
    await api.addOrderAdjustment(props.order.id, {
      receipt_no: props.order.receipt_no,
      customer_code: props.order.client_code,
      customer_name: props.order.client_name,
      amount: orderAdjustForm.value.amount,
      type: orderAdjustForm.value.type,
      remark: orderAdjustForm.value.remark,
    })
    message.success('已保存')
    orderAdjustShow.value = false
    await reload()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// 客户抹零
// ---------------------------------------------------------------------------
const customerAdjustShow = ref(false)
const customerAdjustForm = ref({ amount: null as number | null, type: '月度抹零', remark: '' })

function openCustomerAdjust() {
  customerAdjustForm.value = { amount: null, type: '月度抹零', remark: '' }
  customerAdjustShow.value = true
}

async function submitCustomerAdjust() {
  if (!props.order) return
  if (customerAdjustForm.value.amount == null) return
  saving.value = true
  try {
    await api.addCustomerAdjustment(props.order.client_code, {
      customer_code: props.order.client_code,
      customer_name: props.order.client_name,
      amount: customerAdjustForm.value.amount,
      type: customerAdjustForm.value.type,
      remark: customerAdjustForm.value.remark,
    })
    message.success('已保存')
    customerAdjustShow.value = false
    await reload()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// 录入预付款（finance_addPayment，分配列表为空）
// ---------------------------------------------------------------------------
const prepaymentShow = ref(false)
const prepaymentForm = ref({
  amount: null as number | null,
  dateTs: null as number | null,
  method: '微信',
  remark: '',
  isRefund: false,
})

function openPrepayment() {
  prepaymentForm.value = { amount: null, dateTs: todayTs(), method: '微信', remark: '', isRefund: false }
  prepaymentShow.value = true
}

async function submitPrepayment() {
  if (!props.order) return
  const amount = prepaymentForm.value.amount
  if (amount == null || amount <= 0) {
    message.warning('收款金额需大于 0')
    return
  }
  const isRefund = prepaymentForm.value.isRefund
  const prefix = isRefund ? '预付款冲销:' : '预付款:'
  const remark = prepaymentForm.value.remark
    ? `${prefix}${prepaymentForm.value.remark}`
    : isRefund
      ? '预付款冲销'
      : '预付款'
  saving.value = true
  try {
    await api.addCustomerPayment(props.order.client_code, {
      customer_code: props.order.client_code,
      customer_name: props.order.client_name,
      amount: isRefund ? -amount : amount,
      pay_date: dateStr(prepaymentForm.value.dateTs),
      method: prepaymentForm.value.method,
      remark,
      allocations: [],
    })
    message.success('已保存')
    prepaymentShow.value = false
    await reload()
  } catch (e) {
    message.error((e as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// 预付款分配（preview → execute）
// ---------------------------------------------------------------------------
const prepayAllocateShow = ref(false)
const prepayAllocateForm = ref({ amount: null as number | null, discountRate: 10 as number })
const prepayAllocatePreview = ref<PrepaymentAllocationPreview | null>(null)

function openPrepayAllocate() {
  prepayAllocateForm.value = { amount: null, discountRate: 10 }
  prepayAllocatePreview.value = null
  prepayAllocateShow.value = true
}

async function previewPrepayAllocate() {
  if (!props.order) return
  const amount = prepayAllocateForm.value.amount
  if (amount == null || amount <= 0) {
    message.warning('分配金额需大于 0')
    return
  }
  saving.value = true
  try {
    prepayAllocatePreview.value = await api.previewPrepaymentAllocation(props.order.client_code, {
      customer_code: props.order.client_code,
      allocate_amount: amount,
      discount_rate: prepayAllocateForm.value.discountRate,
    })
  } catch (e) {
    message.error((e as Error).message || '预览失败')
  } finally {
    saving.value = false
  }
}

async function submitPrepayAllocate() {
  if (!props.order || !prepayAllocatePreview.value) return
  saving.value = true
  try {
    await api.executePrepaymentAllocation(props.order.client_code, {
      customer_code: props.order.client_code,
      allocate_amount: prepayAllocateForm.value.amount ?? 0,
      discount_rate: prepayAllocateForm.value.discountRate,
      remark: `优惠${prepayAllocateForm.value.discountRate}%`,
    })
    message.success('分配成功')
    prepayAllocateShow.value = false
    await reload()
  } catch (e) {
    message.error((e as Error).message || '分配失败')
  } finally {
    saving.value = false
  }
}

// ---------------------------------------------------------------------------
// 对账明细筛选
// ---------------------------------------------------------------------------
const adjustTotal = computed(() =>
  (balance.value?.order_adjust_total ?? 0) + (balance.value?.customer_adjust_total ?? 0),
)

/**
 * 对账明细是否显示全部历史。
 * 旧版是 `F`：`false` = 只看近 365 天（默认），`true` = 全部。
 * 那颗按钮的文案/类型都跟着它走：`F ? "仅看近365天" : "查看全部历史"`、`:type="F ? 'warning' : ''"`
 * （`:932`）。⚠️ 服务端的 `getCustomerStatement` 收 `_days` 但**不使用**（下划线前缀），
 * 所以这层过滤是**前端**做的。
 */
const stmtShowAll = ref(false)
const statementLoading = ref(false)
const statsLoading = ref(false)

/** 重拉对账明细（旧版 `$`）。 */
async function refreshStatement() {
  if (!props.order) return
  statementLoading.value = true
  try {
    statement.value = await api.getCustomerStatement(props.order.client_code)
  } catch (e) {
    message.error((e as Error).message || '刷新对账单失败')
  } finally {
    statementLoading.value = false
  }
}

/** 重拉收款趋势（旧版 `ae`）。 */
async function refreshStats() {
  if (!props.order) return
  statsLoading.value = true
  try {
    stats.value = await api.getPaymentStats(props.order.client_code)
  } catch (e) {
    message.error((e as Error).message || '刷新图表失败')
  } finally {
    statsLoading.value = false
  }
}

const stmtTypeFilter = ref('全部类型')
const stmtTypeOptions = computed(() =>
  [
    { label: '全部类型', value: '全部类型' },
    { label: '收款', value: '收款' },
    { label: '订单抹零', value: '订单抹零' },
    { label: '客户抹零', value: '客户抹零' },
    { label: '红冲单', value: '红冲单' },
  ],
)

const stmtKeyword = ref('')

const filteredStatement = computed(() => {
  // 「仅看近365天」是**前端**过滤（服务端不用 `_days`，见 `stmtShowAll` 的注释）
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
  let list = statement.value
  if (!stmtShowAll.value) {
    list = list.filter((r) => (r.date ?? '') >= cutoffStr)
  }
  if (stmtTypeFilter.value !== '全部类型') {
    list = list.filter((r) => r.kind === stmtTypeFilter.value)
  }
  const q = stmtKeyword.value.trim().toLowerCase()
  if (q) {
    list = list.filter((r) =>
      [r.receipt_no, r.date, r.install_address, r.remark].some((f) => (f ?? '').toLowerCase().includes(q)),
    )
  }
  return list
})

// ---------------------------------------------------------------------------
// 表格列
// ---------------------------------------------------------------------------
/*
 * 「收款分配记录」与「订单调整记录」**两张表的列不一样**（旧版就是分开定义的）：
 *
 *   收款分配记录：`收款日期 | 方式 | 分配金额 | 备注`
 *     —— 旧版列定义见 `createVNode(D,{label:"收款日期"...})` 一组
 *   订单调整记录：`日期 | 类型 | 减免金额 | 备注`
 *     —— 旧版那一列的 `label` 是 **「减免金额」**、渲染写死 **`"-¥" + 调整金额`**
 *
 * ⚠️ 先前两张表共用 `recordColumns`（`类型 | 日期 | 金额`），既不旧版也不自洽：
 *    调整表少了负号、列名也错（「金额」不是「减免金额」）。
 */
const paymentRecordColumns: DataTableColumns<FinanceRecord> = [
  { title: '收款日期', key: 'date', width: 100 },
  { title: '方式', key: 'kind', width: 70 },
  { title: '分配金额', key: 'amount', width: 110, render: (row) => `¥${fmt(row.amount)}` },
  { title: '备注', key: 'remark', ellipsis: { tooltip: true } },
]

const adjustRecordColumns: DataTableColumns<FinanceRecord> = [
  { title: '日期', key: 'date', width: 100 },
  { title: '类型', key: 'kind', width: 80 },
  {
    // 旧版是**写死的 `-¥` 前缀**（不是按正负动态加）—— 抹零在账上就是「减掉多少」
    title: '减免金额',
    key: 'amount',
    width: 90,
    render: (row) => `-¥${fmt(row.amount)}`,
  },
  { title: '备注', key: 'remark', ellipsis: { tooltip: true } },
]

// 列名逐字取自旧版 `createVNode(D,{label:"订单日期"...})` / `{label:"订单总价"...}`
const allocationColumns: DataTableColumns<AllocationItem> = [
  { title: '回执单号', key: 'receipt_no', width: 120 },
  { title: '订单日期', key: 'order_date', width: 100 },
  { title: '订单总价', key: 'total_price', width: 90, render: (r) => `¥${fmt(r.total_price)}` },
  {
    title: '本次分配',
    key: 'allocated_amount',
    width: 100,
    render: (r) => h('span', { style: { color: '#e6a23c' } }, `¥${fmt(r.allocated_amount)}`),
  },
  {
    title: '分配后余额',
    key: 'remaining_after',
    width: 100,
    render: (r) =>
      h(
        'span',
        { style: { color: r.remaining_after > 0 ? '#f56c6c' : '#67c23a' } },
        `¥${fmt(r.remaining_after)}`,
      ),
  },
]

const KIND_TAG_TYPE: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'default'> = {
  收款: 'success',
  订单抹零: 'warning',
  客户抹零: 'info',
  红冲单: 'danger',
}

const statementColumns: DataTableColumns<StatementItem> = [
  { title: '日期', key: 'date', width: 100 },
  {
    title: '类型',
    key: 'kind',
    width: 90,
    render: (r) => {
      const t = KIND_TAG_TYPE[r.kind] ?? 'default'
      return h('span', { class: `tag-${t}` }, r.kind)
    },
  },
  {
    title: '单据号/地址',
    key: 'receipt_no',
    render: (r) => (r.install_address ? `${r.receipt_no} · ${r.install_address}` : r.receipt_no),
  },
  {
    title: '金额',
    key: 'amount',
    width: 110,
    render: (r) =>
      h(
        'span',
        { style: { color: r.amount < 0 ? '#67c23a' : '#000' } },
        r.amount < 0 ? `-￥${fmt(Math.abs(r.amount))}` : `￥${fmt(r.amount)}`,
      ),
  },
  { title: '备注', key: 'remark', ellipsis: { tooltip: true } },
]

// ---------------------------------------------------------------------------
// 趋势图：简单柱状（无 echarts 依赖）
// ---------------------------------------------------------------------------
const barWidth = (v: number) => {
  const max = Math.max(1, ...(stats.value?.monthly.map((m) => Math.max(m.receipt, m.refund)) ?? [1]))
  return `${Math.max(2, (v / max) * 100)}%`
}

// ---------------------------------------------------------------------------
// 写后刷新
// ---------------------------------------------------------------------------
async function reload() {
  await load()
  emit('saved')
}
</script>

<style scoped>
.finance-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.banner {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 10px 12px;
  background: #faf5eb;
  border-radius: 6px;
  font-size: 13px;
}
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.stat-card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fff;
}
.stat-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 16px;
  font-weight: 600;
}
.purple-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
  color: #fff;
}
.pcell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pcell span {
  font-size: 12px;
  opacity: 0.85;
}
.pcell b {
  font-size: 16px;
}
/*
 * 小节标题 —— 逐字取自旧版 `legacy/css/Home-97d96482.css`：
 *   `.section-title[data-v-97a9ce53]{font-size:13px;font-weight:600;color:#303133;
 *     margin-bottom:8px;display:flex;align-items:center}`
 * ⚠️ 旧版**没有**左边那条蓝色竖条，也没有 `padding-left` —— 那是本文件先前自己加的。
 * `margin-bottom:8px` 保留；`margin-top` 不用（父级 `.finance-body` 的 `gap:12px` 已经隔开了）。
 */
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}
/* 挂在标题行里的次要按钮（旧版 `margin-left:8px`，见 `.section-title` 的用法） */
.title-btn {
  margin-left: 8px;
}
.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.preview-footer {
  font-size: 13px;
  padding: 8px 4px;
}
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* 行内文字之间的左间距。⚠️ **按钮之间不要用它** —— 按钮行一律靠 `.action-row` 的 `gap:8px`，
   逐个加 `margin-left` 会让第一个按钮也带上左边距、把整行推歪。 */
.ml8 {
  margin-left: 8px;
}
.hint {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}
.prepay-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}
.text-danger {
  color: #f56c6c;
}
.text-warning {
  color: #e6a23c;
}
.chart {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chart-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chart-label {
  width: 56px;
  font-size: 12px;
  color: #606266;
  text-align: right;
}
.chart-bar-wrap {
  flex: 1;
  display: flex;
  gap: 2px;
  height: 16px;
  background: #f5f7fa;
  border-radius: 3px;
  overflow: hidden;
}
.chart-bar {
  height: 100%;
  transition: width 0.2s;
}
.chart-bar.receipt {
  background: #67c23a;
}
.chart-bar.refund {
  background: #f56c6c;
}
.chart-val {
  width: 150px;
  font-size: 11px;
  color: #909399;
}
.chart-legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #606266;
  padding-left: 64px;
}
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 4px;
}
.dot.receipt {
  background: #67c23a;
}
.dot.refund {
  background: #f56c6c;
}
.tag-success {
  color: #67c23a;
}
.tag-warning {
  color: #e6a23c;
}
.tag-info {
  color: #909399;
}
.tag-danger {
  color: #f56c6c;
}
</style>
