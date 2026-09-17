<!--
  「收据单2」抽屉 —— 旧版 Home 在 `ic=12` 时的那张自绘单据。

  与旧版的关系（逆向定稿见 `docs/2026-09-17-receipt2-analysis.md`）：
  · 旧版**组件自己不渲染预览**：它把 HTML 字符串推回 Home，由 Home 塞进容器。
    新版反过来，由本抽屉自己持容器 —— 交互闭环更清楚，产出不变。
  · 旧版打印是 `printFromContainer`（clone 预览 → 隐藏 iframe）；
    新版多插一层 `.r2-page-wrap`（见 `utils/receipt2/print.ts` 的偏离说明）。
  · 旧版还有 Electron 静默打印 / 打印机选择 / 打印份数，**新版整体不做**（无 Electron）。

  工具条按钮对照旧版 `ic=12` 的那几颗：
    「打印」→ printFromContainer｜「字体调节」→ 设置弹窗｜「编辑收据单」→ contentEditable 模式
    「复制收据单」→ html2canvas｜「导出PDF」→ 浏览器打印对话框（旧版是 jsPDF，有意改掉）
-->
<template>
  <n-drawer :show="show" :width="1180" placement="right" @update:show="(v: boolean) => emit('update:show', v)">
    <n-drawer-content title="收据单2" closable>
      <div class="r2-wrap">
        <div class="r2-toolbar">
          <span class="hint">
            已选 {{ orders.length }} 张订单
            <template v-if="loading"> · 正在读取数据…</template>
          </span>
          <span class="grow" />
          <n-button size="small" :disabled="!ready" @click="openSettings">字体调节</n-button>
          <n-button size="small" :disabled="!ready" @click="openEditorMode">
            {{ editing ? '完成编辑' : '编辑收据单' }}
          </n-button>
          <n-button size="small" :disabled="!ready" :loading="copying" @click="doCopy">复制收据单</n-button>
          <n-button size="small" :disabled="!ready" @click="doExportPdf">导出PDF</n-button>
          <n-button size="small" type="primary" :disabled="!ready" @click="doPrint">打印</n-button>
        </div>

        <div v-if="emptyHint" class="r2-empty">{{ emptyHint }}</div>

        <div v-if="rendering" class="r2-loading">
          <n-spin size="small" />
          <span>正在生成…</span>
        </div>

        <!-- 预览容器。`.receipt2-root` 由渲染器输出，屏幕态样式（灰底/卡片阴影/hover 虚框）在它的 CSS 里。 -->
        <div
          v-show="!rendering && !!previewHtml"
          ref="previewEl"
          class="r2-preview"
          :contenteditable="editing"
          v-html="previewHtml"
          @keydown.enter="onEditKeydown"
        />
      </div>
    </n-drawer-content>
  </n-drawer>

  <Receipt2SettingsDialog
    v-model:show="settingsShow"
    :fonts="settings.fontSettings"
    :paper="settings.printSettings"
    :visibility="settings.visibilitySettings"
    :brand="settings.brandSettings"
    @saved="onSettingsSaved"
  />

  <!--
    元素微调浮层：草稿/快照/即时预览都由它自己管，父组件只给「锚点 + 目标节点 + 配置表」。
    它「确认」时**原地写回 `configs` 并落盘**，父组件只负责重建预览。
  -->
  <Receipt2ElementEditor
    v-model:show="editorShow"
    :element-key="editingKey"
    :anchor="editingAnchor"
    :target="editingTarget"
    :configs="settings.elementConfigs"
    @confirm="onElementConfirm"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { NButton, NDrawer, NDrawerContent, NSpin, useMessage } from 'naive-ui'

import { api } from '../api/client'
import type { OrderDto } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { buildOrderPrintContext, loadPrintPrereqs, type PrintPrereqs } from '../composables/useOrderPrint'
import { buildReceipt2Order } from '../utils/receipt2/order'
import { paginateOrder } from '../utils/receipt2/paginate'
import { css } from '../utils/receipt2/css'
import { loadAllReceipt2Settings, saveElementConfigs, saveColumnWidths } from '../utils/receipt2/storage'
import {
  copyPreviewToClipboard,
  exportPreviewToPdf,
  printFromContainer,
  type PrintDeps,
} from '../utils/receipt2/print'
import { initColumnResize, disposeColumnResize } from '../composables/useReceipt2Preview'
import type { ElementKey } from '../utils/receipt2/types'
import type { PrintContext } from '../utils/printPayloads'
import Receipt2SettingsDialog from './Receipt2SettingsDialog.vue'
import Receipt2ElementEditor from './Receipt2ElementEditor.vue'

const props = defineProps<{
  show: boolean
  /** 选中订单的**完整**明细（由调用方保证已 `getOrder`）。 */
  orders: OrderDto[]
}>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const message = useMessage()
const auth = useAuthStore()

const loading = ref(false)
const rendering = ref(false)
const copying = ref(false)
const previewHtml = ref('')
const emptyHint = ref('')
const previewEl = ref<HTMLElement | null>(null)
const settingsShow = ref(false)
const editing = ref(false)
const editorShow = ref(false)
const editingKey = ref<ElementKey | null>(null)
const editingAnchor = ref<{ top: number; left: number; bottom: number } | null>(null)
/** 被点中的预览节点（浮层做即时预览时直接改它的 style，不重渲染整块）。 */
const editingTarget = ref<HTMLElement | null>(null)

/** 已落盘的设置（生效值）。草稿由设置弹窗内部维护。 */
const settings = ref(loadAllReceipt2Settings())
const ready = computed(() => !!previewHtml.value)

/** 订单 → 收据单2 数据模型（复用打印层的 `receiptPrintData`）。 */
function receipt2Orders(ctxs: PrintContext[]) {
  return ctxs.map((c) => buildReceipt2Order(c))
}

/** 当前设置下的渲染上下文。 */
const renderCtx = computed(() => ({
  visibility: settings.value.visibilitySettings,
  elementConfigs: settings.value.elementConfigs,
  brand: settings.value.brandSettings,
  columnWidths: settings.value.columnWidths,
}))

const printDeps = computed<PrintDeps>(() => ({
  fonts: settings.value.fontSettings,
  paper: settings.value.printSettings,
  columnWidths: settings.value.columnWidths,
}))

watch(
  () => props.show,
  async (open) => {
    if (!open) return
    previewHtml.value = ''
    emptyHint.value = ''
    editing.value = false
    if (!props.orders.length) {
      emptyHint.value = '请先在订单列表里勾选要打单的订单'
      return
    }
    loading.value = true
    try {
      // 明细兜底：选中行可能没展开过（旧版就栽在这里，打出来是空白）。
      const full = await Promise.all(
        props.orders.map(async (o) => (o.lines?.length ? o : await api.getOrder(o.id))),
      )
      const prereqs: PrintPrereqs = await loadPrintPrereqs(full)
      const who = { tenantName: auth.tenant?.name || '', maker: auth.user?.name || '' }
      const ctxs = full.map((o) => buildOrderPrintContext(o, prereqs, who))
      await renderPreview(receipt2Orders(ctxs))
    } catch (e) {
      message.error((e as Error).message || '读取收据单2 数据失败')
    } finally {
      loading.value = false
    }
  },
)

/** 逐单分页，拼成一个 `.receipt2-root`（与旧版 `ge()` 的产出形状一致）。 */
async function renderPreview(orders: ReturnType<typeof receipt2Orders>) {
  rendering.value = true
  try {
    const pages: string[] = []
    for (const order of orders) {
      pages.push(
        ...(await paginateOrder(
          order,
          order.receipt,
          settings.value.fontSettings,
          settings.value.printSettings,
          renderCtx.value,
        )),
      )
    }
    previewHtml.value =
      `<div class="receipt2-root"><style>${css(settings.value.fontSettings, settings.value.printSettings, settings.value.columnWidths)}</style>` +
      pages.join('') +
      '</div>'
    await nextTick()
    mountPreviewInteractions()
  } finally {
    rendering.value = false
  }
}

/**
 * 预览重建后重新挂交互。
 *
 * ⚠️ 缩字**不在这里调** —— `initColumnResize` 内部第一步就是 `applyShrinkFit`（旧版 `:854-873` 同理：
 * 缩字会改字号、可能让表格回流，必须在挂手柄之前跑完，否则量到的列宽是旧的）。
 */
function mountPreviewInteractions() {
  const el = previewEl.value
  if (!el) return
  disposeColumnResize()
  initColumnResize(el, settings.value.columnWidths, (w) => {
    settings.value.columnWidths = w
    saveColumnWidths(w)
  })
  bindElementEditor(el)
}

// ---------------------------------------------------------------- 元素微调 //

/**
 * 点预览里任一 `[data-r2-el]` 元素 → 开微调浮层。
 *
 * 命中用 `closest`（点到的通常是元素内部的文字节点），浮层自己会做 `document.elementsFromPoint`
 * 那套兜底 —— 旧版 `Ce`(:947-982) 也有，用于穿透遮罩。
 */
function onPreviewClick(e: MouseEvent) {
  if (editing.value) return // 编辑模式下点击是改文字，不开微调浮层（两套并列，别同时开）
  const target = (e.target as HTMLElement)?.closest?.('[data-r2-el]') as HTMLElement | null
  if (!target) return
  const key = target.getAttribute('data-r2-el') as ElementKey | null
  if (!key || !(key in settings.value.elementConfigs)) return
  const rect = target.getBoundingClientRect()
  editingKey.value = key
  editingAnchor.value = { top: rect.top, left: rect.left, bottom: rect.bottom }
  editingTarget.value = target
  editorShow.value = true
}

function bindElementEditor(el: HTMLElement) {
  el.removeEventListener('click', onPreviewClick)
  el.addEventListener('click', onPreviewClick)
}

/**
 * 浮层「确认」——它已经**原地写回 `configs` 并落盘**了，这里只管重建预览。
 * （旧版 `xe`(:989-1003)：写回 → 落盘 → `await ve()` 重渲染 → 重挂列宽手柄与点击监听。）
 */
function onElementConfirm() {
  editingKey.value = null
  editingAnchor.value = null
  editingTarget.value = null
  saveElementConfigs(settings.value.elementConfigs)
  rerender()
}

// ------------------------------------------------------------------ 编辑模式 //

function openEditorMode() {
  editing.value = !editing.value
  // 进编辑模式要退出元素微调（旧版这两套是并列的，同时开会打架）。
  editorShow.value = false
  editingKey.value = null
  editingTarget.value = null
  if (previewEl.value) previewEl.value.spellcheck = false
}

/**
 * 「编辑收据单」= contentEditable 就地改文字。
 *
 * ⚠️ **有意照抄旧版：改了不持久化**（用户 2026-09-17 拍板「原样复刻」）。
 * 刷一次预览就回到原文。这不是 bug，是旧版行为。
 */
function onEditKeydown(_e: KeyboardEvent) {
  // 目前不需要拦键；留着这个钩子是因为 contentEditable 里 Enter 的默认行为
  // 在 `white-space: pre-line` 下会插入换行、与旧版一致，无需干预。
}

// -------------------------------------------------------------------- 动作 //

async function rerender() {
  if (!previewEl.value) return
  // 重新走一遍数据管线（设置可能刚变过）。
  const full = await Promise.all(
    props.orders.map(async (o) => (o.lines?.length ? o : await api.getOrder(o.id))),
  )
  const prereqs = await loadPrintPrereqs(full)
  const who = { tenantName: auth.tenant?.name || '', maker: auth.user?.name || '' }
  await renderPreview(receipt2Orders(full.map((o) => buildOrderPrintContext(o, prereqs, who))))
}

function openSettings() {
  settingsShow.value = true
}

async function onSettingsSaved() {
  settings.value = loadAllReceipt2Settings()
  await rerender()
}

async function doPrint() {
  const el = previewEl.value
  if (!el) return
  try {
    // 编辑模式下的改动不该进纸里 —— 先退出编辑态。
    editing.value = false
    await printFromContainer(el, printDeps.value)
  } catch (e) {
    message.error((e as Error).message || '打印失败')
  }
}

async function doCopy() {
  const el = previewEl.value
  if (!el) return
  copying.value = true
  try {
    await copyPreviewToClipboard(el)
    message.success('收据单2已复制到剪贴板！')
  } catch (e) {
    message.error('复制失败: ' + ((e as Error).message || e))
  } finally {
    copying.value = false
  }
}

async function doExportPdf() {
  const el = previewEl.value
  if (!el) return
  try {
    // 走浏览器打印对话框，由用户选「另存为 PDF」。**不引 jsPDF**（见 print.ts 的说明）。
    editing.value = false
    await exportPreviewToPdf(el, printDeps.value)
  } catch (e) {
    message.error('导出PDF失败: ' + ((e as Error).message || e))
  }
}

onBeforeUnmount(disposeColumnResize)
</script>

<style scoped>
.r2-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.r2-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}
.r2-toolbar .hint {
  font-size: 13px;
  color: #666;
}
.r2-toolbar .grow {
  flex: 1;
}
.r2-empty {
  color: #d03050;
  font-size: 13px;
}
.r2-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 13px;
  padding: 24px 0;
}
/* 预览容器本身不加边框/背景 —— `.receipt2-root` 的屏幕态（灰底 + 卡片阴影）由渲染器自带的 CSS 负责。 */
.r2-preview {
  overflow: auto;
  max-height: 72vh;
}
</style>
