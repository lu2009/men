<!--
  「打印预览」弹窗 —— 旧版那个 `el-dialog`（`C` 组件，`modelValue: eo`）。

  ★ **这是对原版结构的对齐**（2026-09-18）。原版是两层：

      工具栏「打印选中订单」→ 【打印选项】抽屉（`size:350`，**只有入口按钮**）
        → 点入口 → 设 `ic` → 本弹窗（**预览 + 该单据的操作按钮栏**）

  而新版先前把预览放在抽屉里、按钮也只有笼统的「预览/打印」两颗 —— 与原型不符。
  现在拆成：`PrintDrawer`（只列入口）+ 本弹窗（预览 + 工具栏）。

  宽度照原版：`15==ic || 16==ic ? "95%" : "1180px"`。新版这里只服务 hiprint 的 17 张模板
  （自绘单据仍走各自的抽屉，它们本来就是「预览 + 工具栏」的形态）。

  工具栏照原版的构成（`docs/edit-dialog-recon/01-edit-table.md` §2）：
    全部 ic：`关闭` … `导出PDF`
    非 12–16：`云打印` / `手动打印` —— **新版不做云打印**；`手动打印` = 本机 hiprint 打印，
              对应我们的「打印」
  原版**没有「预览」按钮**（弹窗本身就是预览），所以新版也去掉了那颗。
-->
<template>
  <n-modal
    :show="show"
    preset="card"
    :style="{ width: dialogWidth }"
    :bordered="false"
    :title="title"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="pp-wrap">
      <div class="pp-toolbar">
        <span class="pp-hint">
          已选 {{ orders.length }} 张订单
          <template v-if="loading"> · 正在读取数据…</template>
        </span>
        <span class="pp-grow" />
        <n-button size="small" @click="emit('update:show', false)">关闭</n-button>
        <n-button size="small" :disabled="!ready || loading" :loading="rendering" @click="doPrint">打印</n-button>
      </div>

      <div v-if="emptyHint" class="pp-empty">{{ emptyHint }}</div>

      <div v-if="rendering" class="pp-loading">
        <n-spin size="small" />
        <span>正在渲染…</span>
      </div>

      <!-- 预览 = hiprint 真渲染（与实打同一套渲染核心）：样式/分页/二维码/图片位置都与实打一致。 -->
      <div v-show="!rendering && !!previewHtml" class="pp-host" v-html="previewHtml" />
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NModal, NSpin, useMessage } from 'naive-ui'

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
  /** 要打印的订单（**完整**明细，由调用方保证已 `getOrder`）。 */
  orders: OrderDto[]
  /** hiprint 模板 mode（对应旧版的 `ic`）。 */
  mode: string
  /** 弹窗标题（= 单据中文名）。 */
  title: string
  /** 旧版 `15||16 ? 95% : 1180px`；新版这里只服务 hiprint，故固定 1180。 */
  dialogWidth?: string
}>()

const emit = defineEmits<{ 'update:show': [boolean] }>()

const message = useMessage()
const auth = useAuthStore()

const loading = ref(false)
const rendering = ref(false)
const previewHtml = ref('')
const emptyHint = ref('')
let prereqs: PrintPrereqs | null = null
/** 兜底拉齐明细后的订单（`props.orders` 里未展开过的那些只有表头）。 */
const fullOrders = ref<OrderDto[]>([])

const ready = computed(() => !!previewHtml.value)
const dialogWidth = computed(() => props.dialogWidth || '1180px')

/**
 * 渲染竞态令牌。渲染是异步的（拉模板 + hiprint 渲染），
 * 换单据或连点时慢的那次若不丢弃，会覆盖快的那次。
 */
let renderToken = 0

watch(
  () => [props.show, props.mode] as const,
  async ([open, mode]) => {
    if (!open) return
    previewHtml.value = ''
    emptyHint.value = ''
    if (!props.orders.length) {
      emptyHint.value = '请先在订单列表里勾选要打印的订单'
      return
    }
    if (!mode) return

    const token = ++renderToken
    loading.value = true
    try {
      // 明细兜底：选中行可能没展开过（旧版就栽在这里，打出来是空白）。
      fullOrders.value = await Promise.all(
        props.orders.map(async (o) => (o.lines?.length ? o : await api.getOrder(o.id))),
      )
      prereqs = await loadPrintPrereqs(fullOrders.value)
      if (token !== renderToken) return
      await render(mode, token)
    } catch (e) {
      if (token !== renderToken) return
      message.error((e as Error).message || '读取打印数据失败')
    } finally {
      if (token === renderToken) loading.value = false
    }
  },
  { immediate: true },
)

/** 每张订单 → 各自的 payload（`templatePayload` 的分发逻辑与 Hui 完全同一份）。 */
async function buildPayloads(forPreview: boolean, mode0: string) {
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

async function render(mode0: string, token: number) {
  rendering.value = true
  try {
    const { payload } = await buildPayloads(true, mode0)
    const html = (await renderByMode(mode0, payload)) || ''
    if (token !== renderToken) return
    previewHtml.value = html
    if (!html) message.warning('该模板渲染为空')
  } catch (e) {
    if (token !== renderToken) return
    previewHtml.value = ''
    message.error((e as Error).message || '渲染失败')
  } finally {
    if (token === renderToken) rendering.value = false
  }
}

async function doPrint() {
  if (!props.mode) return
  try {
    const { payload } = await buildPayloads(false, props.mode)
    await printByMode(props.mode, payload)
  } catch (e) {
    message.error((e as Error).message || '打印失败')
  }
}
</script>

<style scoped>
.pp-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pp-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}
.pp-toolbar .pp-hint {
  font-size: 13px;
  color: #666;
}
.pp-toolbar .pp-grow {
  flex: 1;
}
.pp-empty {
  color: #d03050;
  font-size: 13px;
}
.pp-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 13px;
  padding: 24px 0;
}
.pp-host {
  overflow: auto;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 8px;
  background: #fafafa;
  max-height: 72vh;
}
</style>
