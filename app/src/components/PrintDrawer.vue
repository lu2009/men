<!--
  「打印选项」抽屉 —— 旧版 Home 工具栏「打印选中订单」点开后那一片单据按钮。

  与旧版的关系（逆向见 `docs/2026-09-17-home-analysis.md` §4.2 与随本次实现补的逆向报告）：
  · 旧版按钮组有 ~24 个入口、`ic` 1–16，其中好几个是**同一张模板换引擎/换行过滤**。
    新版按**模板**列（后端 `print_templates` 共 17 张），一张模板一个按钮 —— 少一半入口，覆盖不减。
  · 旧版打印走 socket.io 云打印（`v4.printjs.cn:17521`）时另有一路；新版只用本机 hiprint 打印。
  · 旧版**不补拉未展开订单的明细**（没展开过就打空白），新版进抽屉时统一拉齐。
  · 旧版「收据单2」（`ic=12`）是自绘组件、含字体调节，不在 17 张模板里 —— 新版未做，见文末说明。

  N 张订单 = **一个打印任务里的 N 页**（与旧版一致），不是弹 N 次打印框。
-->
<template>
  <n-drawer :show="show" :width="900" placement="right" @update:show="(v: boolean) => emit('update:show', v)">
    <n-drawer-content title="打印选项" closable>
      <div class="print-drawer">
        <div class="doc-list">
          <div v-for="g in DOC_GROUPS" :key="g.title" class="doc-group">
            <div class="doc-group-title">{{ g.title }}</div>
            <div class="doc-buttons">
              <!--
                两种按钮：`mode` 的是 hiprint 模板（点了在本抽屉里渲染预览）；
                `doc` 的是**自绘单据**（点了抛给 Home 去开它自己的抽屉 —— 见 `openDoc`）。
              -->
              <n-button
                v-for="d in g.items"
                :key="d.mode ?? d.doc"
                size="small"
                :type="(d.mode && mode === d.mode) ? 'primary' : 'default'"
                :disabled="loading"
                @click="d.doc ? openDoc(d.doc) : selectMode(d.mode as string)"
              >
                {{ d.label }}
              </n-button>
            </div>
          </div>
        </div>

        <div class="toolbar">
          <span class="hint">
            已选 {{ orders.length }} 张订单
            <template v-if="loading"> · 正在读取数据…</template>
          </span>
          <span class="grow" />
          <!--
            「预览」保留为**手动重渲**用（点单据已会自动出预览，见 `selectMode`）。
            `@click` 必须包一层：`doPreview(mode0?)` 直接绑会把 MouseEvent 当 mode 传进去。
          -->
          <n-button size="small" :disabled="!mode || loading" :loading="rendering" @click="() => doPreview()">
            预览
          </n-button>
          <n-button size="small" type="primary" :disabled="!mode || loading" @click="doPrint">
            打印
          </n-button>
        </div>

        <div v-if="emptyHint" class="empty-hint">{{ emptyHint }}</div>

        <div v-if="previewLoading" class="preview-loading">
          <n-spin size="small" />
          <span>正在渲染预览…</span>
        </div>
        <!-- 预览 = hiprint 真渲染（与实打同一套渲染核心）：样式/分页/二维码/图片位置都与实打一致。 -->
        <div v-show="!previewLoading && !!previewHtml" class="production-host" v-html="previewHtml" />
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NDrawer, NDrawerContent, NSpin, useMessage } from 'naive-ui'

import { api } from '../api/client'
import type { OrderDto } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { renderByMode, printByMode } from '../utils/printService'
import {
  buildBatchPayload,
  loadPrintPrereqs,
  type PrintPrereqs,
} from '../composables/useOrderPrint'

const props = defineProps<{
  show: boolean
  /** 选中订单的**完整**明细（由调用方保证已 `getOrder`）。 */
  orders: OrderDto[]
}>()
const emit = defineEmits<{
  'update:show': [boolean]
  /**
   * 点了**自绘单据**的入口（旧版 `ic=12–16`）。
   *
   * 本抽屉只负责列入口、不负责渲染它们 —— 那五张各有自己的抽屉组件与打印链路。
   * 由 Home 接住、关掉本抽屉、开对应的那个。
   *
   * `entry` 只有合格标签族用（`'all' | 'ping' | 'diao'`，三个入口共用一张单据）。
   */
  openDoc: [doc: string, entry?: string]
}>()

const message = useMessage()
const auth = useAuthStore()

/**
 * 单据按钮的一项。`mode` 与 `doc` **二选一**：
 * · `mode` = hiprint 模板（17 张之一），点了在本抽屉里渲染预览；
 * · `doc`  = 自绘单据（旧版 `ic=12–16`），点了抛 `openDoc` 给 Home 去开它自己的抽屉。
 */
interface DocEntry {
  label: string
  /** hiprint 模板 mode（与 `doc` 二选一） */
  mode?: string
  /** 自绘单据 key（与 `mode` 二选一） */
  doc?: string
  /** 只有合格标签族用：`'all' | 'ping' | 'diao'`（三个入口共用一张单据） */
  entry?: string
}

/**
 * 单据清单 = 后端 `print_templates` 的 17 张 + 5 张自绘单据，按用途分组。
 * 标签里写死 mode（而不去后端拉列表）是**有意**的：分组与中文名是产品语义，
 * 后端只有 mode/name；拉列表再分组反而多一次请求、还得分派。
 */
const DOC_GROUPS: { title: string; items: DocEntry[] }[] = [
  {
    title: '生产类',
    items: [
      { mode: 'product', label: '生产单' },
      { mode: 'product1', label: '生产单1' },
      { mode: 'product2', label: '生产单定制' },
      { mode: 'product3', label: '生产单3（双联）' },
      { mode: 'product4', label: '切料标签' },
      { mode: 'product5', label: '生产单5' },
      { mode: 'product6', label: '生产单6' },
      { mode: 'product7', label: '生产单7' },
      { mode: 'product8', label: '生产单8' },
      { mode: 'product9', label: '生产单9' },
    ],
  },
  {
    title: '玻璃类',
    items: [
      { mode: 'glass', label: '玻璃合片单' },
      { mode: 'glassHole', label: '玻璃订单' },
    ],
  },
  {
    title: '标签类',
    items: [
      { mode: 'lable', label: '标签' },
      { mode: 'product10', label: '生产标签' },
    ],
  },
  {
    title: '收据类',
    items: [
      { mode: 'receipt', label: '客户回执单' },
      { mode: 'FinalReceipt', label: '收据单' },
      { mode: 'ReceiptList', label: '出货清单' },
    ],
  },
  /**
   * **自绘单据**（旧版 Home 抽屉里的 `自定义单据：` 分组，`dr[972]`）。
   *
   * ⚠️ 它们**不是 hiprint 模板**（旧版 `ic=12–16`），各有自己的抽屉组件与打印链路，
   * 所以这里点下去**不发渲染**，而是抛 `openDoc` 给 Home 去开对应的抽屉。
   *
   * 合格标签族三个入口**共用同一个抽屉**（旧版同一个组件、同一个 `ic`，只差数据过滤，
   * 已由施工图 §6.1 证实组件对入口完全无感），所以这里传的是同一个 `qlabel` + 不同 `entry`。
   *
   * 分组顺序照旧版：生产类 / 玻璃类 / 标签类 / 收据类 / **自定义单据**。
   */
  {
    title: '自定义单据',
    items: [
      { doc: 'receipt2', label: '自定义收据单' },
      { doc: 'glassSheet2', label: '自定义玻璃合片单' },
      { doc: 'productionSheet2', label: '自定义生产单2' },
      { doc: 'productionSheet', label: '自定义生产单' },
      { doc: 'qlabel', label: '自定义合格标签', entry: 'all' },
      { doc: 'qlabel', label: '平开合格标签', entry: 'ping' },
      { doc: 'qlabel', label: '推拉合格标签', entry: 'diao' },
    ],
  },
]

/**
 * 当前选中的单据 mode。**初值空串** —— 打开抽屉时一张都不选。
 *
 * ⚠️ 这里刻意不预设默认单据：单据按钮的选中态是绑 `mode` 的，
 * 若预设成 `product`，打开抽屉就会看到「生产单」显示为选中、而预览区是空的，
 * 界面在骗人。空着 → 点谁就选中谁、同时立刻出预览。
 */
const mode = ref<string>('')
const loading = ref(false)
const rendering = ref(false)
const previewLoading = ref(false)
const previewHtml = ref('')
const emptyHint = ref('')
let prereqs: PrintPrereqs | null = null
/** 兜底拉齐明细后的订单（`props.orders` 里未展开过的那些只有表头）。 */
const fullOrders = ref<OrderDto[]>([])

/**
 * 渲染竞态令牌。点单据即渲染之后，用户可能**连点**不同单据 ——
 * 渲染是异步的（拉模板 + hiprint 渲染），慢的那次若不丢弃，会覆盖快的那次，
 * 导致「选中的是 A、预览显示的是 B」。每次渲染领一个号，落地前比对。
 */
let renderToken = 0

watch(
  () => props.show,
  async (open) => {
    if (!open) return
    previewHtml.value = ''
    emptyHint.value = ''
    mode.value = '' // 打开时一张都不选（见 `mode` 的声明处说明）
    renderToken++ // 作废可能还在飞的那次渲染
    if (!props.orders.length) {
      emptyHint.value = '请先在订单列表里勾选要打印的订单'
      return
    }
    loading.value = true
    prereqs = null
    try {
      // 明细兜底：选中行可能没展开过（旧版就栽在这里，打出来是空白）。
      fullOrders.value = await Promise.all(
        props.orders.map(async (o) => (o.lines?.length ? o : await api.getOrder(o.id))),
      )
      prereqs = await loadPrintPrereqs(fullOrders.value)
    } catch (e) {
      message.error((e as Error).message || '读取打印数据失败')
    } finally {
      loading.value = false
    }
  },
)

/** 每张订单 → 各自的 payload（`templatePayload` 的分发逻辑与 Hui 完全同一份）。 */
async function buildPayloads(forPreview: boolean, mode0: string = mode.value) {
  const templates = await api.getPrintTemplatesByMode(mode0)
  const tpl = templates[0]?.template
  if (!tpl) throw new Error(`未配置打印模板：${mode0}`)
  if (!prereqs) throw new Error('打印数据尚未就绪')
  return buildBatchPayload(
    fullOrders.value,
    prereqs,
    { tenantName: auth.tenant?.name || '', maker: auth.user?.name || '' },
    tpl,
    mode0,
    forPreview,
  )
}

/**
 * 渲染预览。
 *
 * `mode0` 显式传入（而不是读 `mode.value`）—— 这样「选中态」与「正在渲染的那张」
 * 在异步过程中不会被用户的后续点击改掉；配合 `renderToken` 丢弃过期结果。
 */
async function doPreview(mode0: string = mode.value) {
  if (!mode0) return
  const token = ++renderToken
  previewLoading.value = true
  rendering.value = true
  try {
    const { payload } = await buildPayloads(true, mode0)
    const html = (await renderByMode(mode0, payload)) || ''
    if (token !== renderToken) return // 已被更新的一次点击取代，丢弃
    previewHtml.value = html
    if (!html) message.warning('该模板渲染为空')
  } catch (e) {
    if (token !== renderToken) return
    previewHtml.value = ''
    message.error((e as Error).message || '渲染失败')
  } finally {
    if (token === renderToken) {
      previewLoading.value = false
      rendering.value = false
    }
  }
}

async function doPrint() {
  if (!mode.value) return
  try {
    const { payload } = await buildPayloads(false)
    await printByMode(mode.value, payload)
  } catch (e) {
    message.error((e as Error).message || '打印失败')
  }
}

/**
 * 点单据按钮 —— **选中并立刻渲染**，不用再点一次「预览」。
 *
 * 数据还没就绪（`loading` / `prereqs` 为空）时只选中、不渲染，避免白报一次错；
 * 等就绪后用户再点一次即可（抽屉打开时那一下很快，正常看不到这个分支）。
 */
/**
 * 点**自绘单据**入口 —— 交给 Home 去开对应的抽屉。
 *
 * 本抽屉**不关自己**：由 Home 决定（它会先关本抽屉再开目标抽屉，避免两个抽屉叠着）。
 */
function openDoc(doc: string, entry?: string) {
  emit('openDoc', doc, entry)
}

function selectMode(m: string) {
  mode.value = m
  previewHtml.value = ''
  emptyHint.value = ''
  if (loading.value || !prereqs) return
  void doPreview(m)
}
</script>

<style scoped>
.print-drawer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.doc-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.doc-group-title {
  font-size: 13px;
  color: #888;
  margin-bottom: 6px;
}
.doc-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #f0f0f0;
}
.toolbar .hint {
  font-size: 13px;
  color: #666;
}
.toolbar .grow {
  flex: 1;
}
.empty-hint {
  color: #d03050;
  font-size: 13px;
}
.preview-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 13px;
  padding: 24px 0;
}
.production-host {
  overflow: auto;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 8px;
  background: #fafafa;
  max-height: 60vh;
}
</style>
