<!--
  「自定义玻璃合片单」抽屉 —— 旧版 Home 上那一套（组件叫 `GlassSheet2PrintManager`，`ic=16`）。

  逆向定稿：`docs/custom-docs-recon/02-glasssheet2.md`（§11.3 Home 调用点 / §11.4 五颗工具条按钮 /
  §10 打印链路 / §15.6 三套弹窗的分工）。

  与旧版的关系（**三处结构性差异，都是有意的**）：
  · 旧版组件**自己不渲染预览**：它把 HTML 字符串推回 Home，由 Home 塞进
    `commentPreviewContainer`（`@499768`，`width:fit-content` + `overflowX:auto` + `maxWidth:100%`）。
    新版反过来，由本抽屉自己持容器 —— 与收据单抽屉同一决策，产出不变。
  · 旧版「编辑合片单」是 Home 侧的 `ProductionEdit`（Hui chunk，改的是**行数据**）；
    这里换成共用的 `DocEditDialog.vue`（列定义/转换字段都按 §15.2 传进去）。
  · 旧版有五颗按钮（§11.4 的 key 22-26）。新版**去掉「直接打印」**：它的浏览器分支就是
    「生成 HTML 塞进预览」（`@363550`），而本抽屉恒有预览 —— 等价物已经天然存在，不需要这颗按钮。
    Electron 的 `printSilent` 分支更是没有载体（新版没有 Electron）。

  **数据来源**：`printPayloads.ts` 的 `glassProduces()`（引擎 A）—— 旧版这份行数据来自
  Hui 组件的 `calculateGlass()`（§2.1），新版从订单列表出发走同一套行构造，不重写数据层。
-->
<template>
  <n-drawer :show="show" :width="1180" placement="right" @update:show="(v: boolean) => emit('update:show', v)">
    <n-drawer-content title="自定义玻璃合片单" closable>
      <div class="gs2-wrap">
        <div class="gs2-toolbar">
          <span class="hint">
            已选 {{ orders.length }} 张订单
            <template v-if="loading"> · 正在读取数据…</template>
          </span>
          <span class="grow" />
          <!-- 按钮顺序照 §11.4（手动打印 / 编辑合片单 / 打印设置 / 布局设置） -->
          <n-button size="small" :disabled="loading" @click="openEditDialog">编辑合片单</n-button>
          <n-button size="small" :disabled="!ready" @click="settingsShow = true">打印设置</n-button>
          <n-button size="small" :disabled="!ready" @click="layoutShow = true">布局设置</n-button>
          <n-button size="small" type="primary" :disabled="!ready" :loading="printing" @click="doPrint">
            打印
          </n-button>
        </div>

        <div v-if="emptyHint" class="gs2-empty">{{ emptyHint }}</div>

        <div v-if="rendering" class="gs2-loading">
          <n-spin size="small" />
          <span>正在生成…</span>
        </div>

        <!--
          预览容器。屏屏幕态样式（灰底 / 卡片阴影 / 折行）由 `.gs-root` 自带的 `@media screen` 提供
          （见 `utils/glasssheet2/css.ts`），这里只负责「横向宽表靠容器滚动」——
          照 Home 那个容器的三个属性（`@499768`）：`width:fit-content` + `overflowX:auto` + `maxWidth:100%`。
        -->
        <div v-show="!rendering && !!previewHtml" class="gs2-preview" v-html="previewHtml" />
      </div>
    </n-drawer-content>
  </n-drawer>

  <!-- B：布局编辑（改版式，存 `glass_sheet2_template_v1`） -->
  <GlassSheet2LayoutDialog v-model:show="layoutShow" :config="config" :rows="rows" @saved="onConfigSaved" />

  <!-- C：打印设置（改纸张/方向/份数/打印机，**同一个键**） -->
  <GlassSheet2SettingsDialog v-model:show="settingsShow" :config="config" @saved="onConfigSaved" />

  <!--
    A：编辑合片单（改**行数据**，不持久化，只改内存）。
    列定义 = 旧版 `ProductionEdit` 硬编码的那 8 列（§15.2）；`brFields` = 旧版做 `<br>`↔`\n`
    转换的那 **5** 个字段（`remark`/`OrderID`/`doorImg` **不转**）。
  -->
  <DocEditDialog
    v-model="editShow"
    :rows="rows"
    :columns="DOC_EDIT_COLUMNS"
    :br-fields="DOC_EDIT_BR_FIELDS"
    image-field="doorImg"
    title="编辑合片单"
    success-text="生产单已更新"
    @save="onRowsSaved"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { NButton, NDrawer, NDrawerContent, NSpin, useMessage } from 'naive-ui'

import { api } from '../api/client'
import type { OrderDto } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { buildOrderPrintContext, loadPrintPrereqs, type PrintPrereqs } from '../composables/useOrderPrint'
import { createPrintPayloads, type PrintContext } from '../utils/printPayloads'
import {
  buildGlassSheet2Html,
  createQrSvgProvider,
  loadGlassSheet2Settings,
} from '../utils/glasssheet2'
import { createQrEncoder } from '../utils/glasssheet2/qr'
import { printGlassSheet2Direct } from '../utils/glasssheet2/print'
import type { GlassSheet2Config, GlassSheet2Row, RenderOptions } from '../utils/glasssheet2/types'
import GlassSheet2LayoutDialog from './GlassSheet2LayoutDialog.vue'
import GlassSheet2SettingsDialog from './GlassSheet2SettingsDialog.vue'
import DocEditDialog, { type DocEditColumn } from './DocEditDialog.vue'

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
const printing = ref(false)
const previewHtml = ref('')
const emptyHint = ref('')
const layoutShow = ref(false)
const settingsShow = ref(false)
const editShow = ref(false)

/** 行数据（旧版 Home 的 `oi`）—— 编辑合片单改的就是它，随抽屉重开重建。 */
const rows = ref<GlassSheet2Row[]>([])
/** 生效配置（旧版组件内的 `i`）。两个弹窗都只读它，草稿在各自内部。 */
const config = ref<GlassSheet2Config>(loadGlassSheet2Settings().config)
const ready = computed(() => !!previewHtml.value)

/** 整份文档一套二维码 provider（旧版是模块级单例 + 一张 Map 缓存，这里按抽屉实例一份）。 */
const renderOpts: RenderOptions = { qr: createQrSvgProvider(createQrEncoder()) }

/**
 * 「编辑合片单」的 8 列 —— 旧版 `ProductionEdit` 是**按字段名硬编码**的（§15.2），
 * 与玻璃合片单自己的 8 列**不是同一组**（两张列清单都列在报告 §15.2 的 ⚠️ 里）：
 *   · 弹窗里改不到 `client`（客户）与 `lockImg`（方向）；
 *   · 弹窗的「门扇材料」写的是 `doorsheet` —— 就是版式里的「玻璃尺寸」列（同字段两个标题）；
 *   · 弹窗的「门框材料」「亮窗/扣板」（`doorframe`/`windows`）本单据**根本不显示**，是多余的两列。
 */
const DOC_EDIT_COLUMNS: DocEditColumn[] = [
  { key: 'OrderID', label: '单号', width: 150 },
  { key: 'door', label: '型材/颜色', width: 180 },
  { key: 'basicInfo', label: '基本信息', width: 200 },
  { key: 'doorsheet', label: '门扇材料', width: 200 },
  { key: 'doorframe', label: '门框材料', width: 200 },
  { key: 'windows', label: '亮窗/扣板', width: 200 },
  { key: 'doorImg', label: '门图', width: 180 },
  { key: 'remark', label: '备注', width: 200 },
]

/** 旧版 `ProductionEdit` 的换行转换字段，**严格 5 个**（`remark`/`OrderID`/`doorImg` 不做转换）。 */
const DOC_EDIT_BR_FIELDS = ['basicInfo', 'doorsheet', 'doorframe', 'windows', 'door']

/**
 * 订单上下文 → 玻璃合片单的行（旧版是 Hui 的 `calculateGlass()`，新版走同一套行构造引擎 A）。
 * 多张订单 = 各单的行**首尾相接**（旧版 `oi` 就是一次汇算的全部行）。
 */
function glassRows(ctxs: PrintContext[]): GlassSheet2Row[] {
  return ctxs.flatMap((ctx) => createPrintPayloads(ctx).glassProduces() as GlassSheet2Row[])
}

watch(
  () => props.show,
  async (open) => {
    if (!open) return
    previewHtml.value = ''
    emptyHint.value = ''
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
      rows.value = glassRows(full.map((o) => buildOrderPrintContext(o, prereqs, who)))
      await renderPreview()
    } catch (e) {
      message.error((e as Error).message || '读取自定义玻璃合片单数据失败')
    } finally {
      loading.value = false
    }
  },
)

/**
 * 重建预览（旧版组件的 `refreshPreview`，GS:779-780：`await props.onPreviewHtmlChange(await build())`）。
 *
 * ⚠️ 读的是**生效配置**（`i`），不是任何草稿 —— 布局编辑器的预览走另一条路
 * （`GlassSheet2LayoutDialog` 内部自己用草稿分页，见 `paginate.ts` 末的说明）。
 */
async function renderPreview(): Promise<void> {
  rendering.value = true
  try {
    previewHtml.value = await buildGlassSheet2Html(rows.value, config.value, renderOpts)
    await nextTick()
  } finally {
    rendering.value = false
  }
}

/** 两个设置弹窗保存后：重读生效配置（同一个 localStorage 键）→ 重渲染。 */
async function onConfigSaved(): Promise<void> {
  config.value = loadGlassSheet2Settings().config
  await renderPreview()
}

/**
 * 「编辑合片单」（旧版 Home 的 `ii`，`@363242`）：**空数据只警告、不开窗**。
 */
function openEditDialog(): void {
  if (!rows.value.length) {
    message.warning('暂无玻璃合片单数据')
    return
  }
  editShow.value = true
}

/**
 * 编辑弹窗「确认修改」（旧版 Home 的 `ci`，`@363331`）：回写行 → 刷预览。
 * ⚠️ 旧版**只改 Home 的 `oi`，不回写 Hui 的汇算结果** —— 下次从 Hui 重新 `calculateGlass()` 会被覆盖。
 * 新版同理：改动只活在本抽屉的这一次会话里。
 */
async function onRowsSaved(next: Record<string, unknown>[]): Promise<void> {
  rows.value = next as GlassSheet2Row[]
  await renderPreview()
}

/**
 * 「打印」（旧版「手动打印」按钮的 `si` → 组件 expose 的 `printDirect()`）。
 *
 * ⚠️ `printDirect` 是**无参**的：它**重建 HTML 字符串**（不是 clone 预览 DOM），
 * 时序 300ms 与收据单的 500ms **不同**（§10.2 对照表）。细节见 `utils/glasssheet2/print.ts`。
 *
 * 遮罩文案照旧版（GS:801「正在生成玻璃合片单...」）；成功/失败文案也照旧版
 * （GS:842「已打开打印对话框」/ GS:844「打印失败: …」）。
 */
async function doPrint(): Promise<void> {
  if (!rows.value.length) return
  printing.value = true
  const mask = message.loading('正在生成玻璃合片单...', { duration: 0 })
  try {
    await printGlassSheet2Direct(rows.value, config.value, renderOpts)
    message.success('已打开打印对话框')
  } catch (e) {
    message.error('打印失败: ' + ((e as Error).message || e))
  } finally {
    mask.destroy()
    printing.value = false
  }
}
</script>

<style scoped>
.gs2-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gs2-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}
.gs2-toolbar .hint {
  font-size: 13px;
  color: #666;
}
.gs2-toolbar .grow {
  flex: 1;
}
.gs2-empty {
  color: #d03050;
  font-size: 13px;
}
.gs2-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 13px;
  padding: 24px 0;
}
/*
  预览容器：外层不加边框/背景 —— `.gs-root` 自带的 `@media screen` 负责灰底 + 卡片阴影。
  横向宽表靠这里滚动（等价 Home 那个容器的 `width:fit-content` + `overflowX:auto` + `maxWidth:100%`）。
*/
.gs2-preview {
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  overflow: auto;
  max-height: 72vh;
}
</style>
