<!--
  C 家族自绘单据 · **共用**抽屉 —— 旧版 Home 上那两张（`GlassSheet2PrintManager` `ic=16` /
  `ProductionSheet2PrintManager` `ic=15`）在组件层逐字相同的那一份。

  逆向定稿：`docs/custom-docs-recon/02-glasssheet2.md`（§11.3 Home 调用点 / §11.4 五颗工具条按钮 /
  §10 打印链路 / §15.6 三套弹窗的分工）；两单据对照见 `docs/custom-docs-recon/01-diff.md` §10 ——
  该节 CONFIRMED：两张单据的**组件层差异只有 4 个字面量**（弹窗标题 ×2 / Loading 文案 /
  「编辑」按钮），其余（工具条形状、两个弹窗的全部控件、打印链路）逐字相同。

  ⚠️ 本文件里**不允许**出现 `gs` / `ps` / 「玻璃合片单」/「生产单」这类字面量 ——
  一切按单据写死的东西都在 `profile` 里（`docSheetUi.ts` 的 `DocSheetUiProfile`）。
  唯一例外是下方的三处「新版自有」注释，它们讲的是**共同**的取舍。

  与旧版的关系（**三处结构性差异，都是有意的**，两张单据同一条）：
  · 旧版组件**自己不渲染预览**：它把 HTML 字符串推回 Home，由 Home 塞进
    `commentPreviewContainer`（`@499768`，`width:fit-content` + `overflowX:auto` + `maxWidth:100%`）。
    新版反过来，由本抽屉自己持容器 —— 与收据单抽屉同一决策，产出不变。
  · 旧版「编辑XX」是 Home 侧的 `ProductionEdit`（Hui chunk，改的是**行数据**）；
    这里换成共用的 `DocEditDialog.vue`（列定义/转换字段都按 §15.2 传进去，
    两张单据用的是**同一个** `ProductionEdit`，见 §15.5 的映射表）。
  · 旧版有五颗按钮（GS §11.4 的 key 22-26 / PS2 的 key 17-21）。新版**去掉「直接打印」**：
    它的浏览器分支就是「生成 HTML 塞进预览」（`@363550`），而本抽屉恒有预览 ——
    等价物已经天然存在，不需要这颗按钮。Electron 的 `printSilent` 分支更是没有载体
    （新版没有 Electron）。「手动打印」对应这里的「打印」。

  **数据来源**：由 `profile.produceRows(ctx)` 决定 —— GS2 走 `glassProduces()`（引擎 A）、
  PS2 走 `productionProduces()`（引擎 B）。这是两张单据**最根本的不同**（§7.2）。
-->
<template>
  <n-drawer :show="show" :width="1180" placement="right" @update:show="(v: boolean) => emit('update:show', v)">
    <n-drawer-content :title="profile.text.drawerTitle" closable>
      <div :class="cls.drawerWrap">
        <div :class="cls.drawerToolbar">
          <span class="hint">
            已选 {{ orders.length }} 张订单
            <template v-if="loading"> · 正在读取数据…</template>
          </span>
          <span class="grow" />
          <!-- 按钮顺序照旧版工具条（手动打印 / 编辑XX / 打印设置 / 直接打印 / 布局设置） -->
          <n-button size="small" :disabled="loading" @click="openEditDialog">
            {{ profile.text.editActionLabel }}
          </n-button>
          <n-button size="small" :disabled="!ready" @click="settingsShow = true">打印设置</n-button>
          <n-button size="small" :disabled="!ready" @click="layoutShow = true">布局设置</n-button>
          <n-button size="small" type="primary" :disabled="!ready" :loading="printing" @click="doPrint">
            打印
          </n-button>
        </div>

        <div v-if="emptyHint" :class="cls.drawerEmpty">{{ emptyHint }}</div>

        <div v-if="rendering" :class="cls.drawerLoading">
          <n-spin size="small" />
          <span>正在生成…</span>
        </div>

        <!--
          预览容器。屏幕态样式（灰底 / 卡片阴影 / 折行）由根容器自带的 `@media screen` 提供
          （见各单据 `utils/<doc>/css.ts`），这里只负责「横向宽表靠容器滚动」——
          照 Home 那个容器的三个属性（`@499768`）：`width:fit-content` + `overflowX:auto` + `maxWidth:100%`。
        -->
        <div v-show="!rendering && !!previewHtml" :class="cls.drawerPreview" v-html="previewHtml" />
      </div>
    </n-drawer-content>
  </n-drawer>

  <!-- B：布局编辑（改版式，存 `profile.core.storageKeys.template`） -->
  <component
    :is="layoutDialog"
    v-model:show="layoutShow"
    :config="config"
    :rows="rows"
    :profile="profile"
    @saved="onConfigSaved"
  />

  <!-- C：打印设置（改纸张/方向/份数/打印机，**同一个键**） -->
  <component
    :is="settingsDialog"
    v-model:show="settingsShow"
    :config="config"
    :profile="profile"
    @saved="onConfigSaved"
  />

  <!--
    A：编辑行数据（改**行数据**，不持久化，只改内存）。
    列定义 = 旧版 `ProductionEdit` 硬编码的那 8 列（§15.2）；`brFields` = 旧版做 `<br>`↔`\n`
    转换的那 **5** 个字段（`remark`/`OrderID`/`doorImg` **不转**）。
    ⚠️ 两张单据用的是**同一个** `ProductionEdit`（§15.5），所以这四项是**共用常量**，不进 profile。
  -->
  <DocEditDialog
    v-model="editShow"
    :rows="rows"
    :columns="DOC_EDIT_COLUMNS"
    :br-fields="DOC_EDIT_BR_FIELDS"
    :image-field="DOC_EDIT_IMAGE_FIELD"
    :title="profile.text.editActionLabel"
    :success-text="DOC_EDIT_SUCCESS_TEXT"
    @save="onRowsSaved"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type Component } from 'vue'
import { NButton, NDrawer, NDrawerContent, NSpin, useMessage } from 'naive-ui'

import { api } from '../api/client'
import type { OrderDto } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { buildOrderPrintContext, loadPrintPrereqs, type PrintPrereqs } from '../composables/useOrderPrint'
import type { DocSheetRow, RenderOptions } from '../utils/docsheet/types'
import DocEditDialog from './DocEditDialog.vue'
import {
  DOC_EDIT_BR_FIELDS,
  DOC_EDIT_COLUMNS,
  DOC_EDIT_IMAGE_FIELD,
  DOC_EDIT_SUCCESS_TEXT,
  UI_NO_ORDERS_HINT,
  UI_PRINT_FAIL_PREFIX,
  UI_PRINT_OK,
  type DocSheetUiProfile,
} from './docSheetUi'

const props = defineProps<{
  show: boolean
  /** 选中订单的**完整**明细（由调用方保证已 `getOrder`）。 */
  orders: OrderDto[]
  /** 本单据的组件层档案（文案 / 外壳 class / 模块转出 / **行来源**）。 */
  profile: DocSheetUiProfile
  /**
   * 两个设置弹窗的**具体单据包装组件**（`GlassSheet2LayoutDialog` / `ProductionSheet2LayoutDialog` …）。
   *
   * ⚠️ 为什么不放进 profile：档案模块要能被三个包装组件同时 import，而包装组件又要被档案引用
   * ⇒ 循环。把「组件」当 props 由包装层注入，档案就保持成一份纯数据 + 函数引用。
   * 两个组件都接收 `{ show, config, rows?, profile, saved }`（见各自的 defineProps）。
   */
  layoutDialog: Component
  settingsDialog: Component
}>()
const emit = defineEmits<{ 'update:show': [boolean] }>()

const message = useMessage()
const auth = useAuthStore()

const cls = computed(() => props.profile.classes)

const loading = ref(false)
const rendering = ref(false)
const printing = ref(false)
const previewHtml = ref('')
const emptyHint = ref('')
const layoutShow = ref(false)
const settingsShow = ref(false)
const editShow = ref(false)

/** 行数据（旧版 Home 的 `oi` / `qr`）—— 编辑弹窗改的就是它，随抽屉重开重建。 */
const rows = ref<DocSheetRow[]>([])
/** 生效配置（旧版组件内的 `i`）。两个弹窗都只读它，草稿在各自内部。 */
const config = ref(props.profile.api.loadSettings().config)
const ready = computed(() => !!previewHtml.value)

/** 整份文档一套二维码 provider（旧版是模块级单例 + 一张 Map 缓存，这里按抽屉实例一份）。 */
const renderOpts: RenderOptions = {
  qr: props.profile.api.createQrSvgProvider(props.profile.api.createQrEncoder()),
}

watch(
  () => props.show,
  async (open) => {
    if (!open) return
    previewHtml.value = ''
    emptyHint.value = ''
    if (!props.orders.length) {
      emptyHint.value = UI_NO_ORDERS_HINT
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
      // 多张订单 = 各单的行**首尾相接**（旧版 `oi` / `qr` 就是一次汇算的全部行）。
      rows.value = full.flatMap((o) => props.profile.produceRows(buildOrderPrintContext(o, prereqs, who)))
      await renderPreview()
    } catch (e) {
      message.error((e as Error).message || props.profile.text.readError)
    } finally {
      loading.value = false
    }
  },
)

/**
 * 重建预览（旧版组件的 `refreshPreview`，GS:779-780：`await props.onPreviewHtmlChange(await build())`）。
 *
 * ⚠️ 读的是**生效配置**（`i`），不是任何草稿 —— 布局编辑器的预览走另一条路
 * （`DocSheetLayoutDialog` 内部自己用草稿分页，见 `paginate.ts` 末的说明）。
 */
async function renderPreview(): Promise<void> {
  rendering.value = true
  try {
    previewHtml.value = await props.profile.api.buildHtml(rows.value, config.value, renderOpts)
    await nextTick()
  } finally {
    rendering.value = false
  }
}

/** 两个设置弹窗保存后：重读生效配置（同一个 localStorage 键）→ 重渲染。 */
async function onConfigSaved(): Promise<void> {
  config.value = props.profile.api.loadSettings().config
  await renderPreview()
}

/**
 * 「编辑XX」那颗按钮（旧版 Home 的 `ii` / `Xr`）：**空数据只警告、不开窗**。
 */
function openEditDialog(): void {
  if (!rows.value.length) {
    message.warning(props.profile.text.emptyEditWarning)
    return
  }
  editShow.value = true
}

/**
 * 编辑弹窗「确认修改」（旧版 Home 的 `ci` / `Qr`）：回写行 → 刷预览。
 * ⚠️ 旧版**只改 Home 那份行数组，不回写汇算结果** —— 下次重新算会被覆盖。
 * 新版同理：改动只活在本抽屉的这一次会话里。
 */
async function onRowsSaved(next: Record<string, unknown>[]): Promise<void> {
  rows.value = next as DocSheetRow[]
  await renderPreview()
}

/**
 * 「打印」（旧版「手动打印」按钮 → 组件 expose 的 `printDirect()`）。
 *
 * ⚠️ `printDirect` 是**无参**的：它**重建 HTML 字符串**（不是 clone 预览 DOM），
 * 时序 300ms 与收据单的 500ms **不同**（§10.2 对照表）。细节见各单据 `utils/<doc>/print.ts`。
 *
 * 遮罩文案照旧版（`profile.text.printLoading`，GS:803 / PS2:829 **两边不同**）；
 * 成功/失败文案两边逐字相同（§10 CONFIRMED）：GS:840/843 与 PS2:865/868。
 */
async function doPrint(): Promise<void> {
  if (!rows.value.length) return
  printing.value = true
  const mask = message.loading(props.profile.text.printLoading, { duration: 0 })
  try {
    await props.profile.api.printDirect(rows.value, config.value, renderOpts)
    message.success(UI_PRINT_OK)
  } catch (e) {
    message.error(UI_PRINT_FAIL_PREFIX + ((e as Error).message || e))
  } finally {
    mask.destroy()
    printing.value = false
  }
}
</script>

<style scoped>
/*
  ⚠️ 两个前缀并列 —— 模板 class 由 `profile.classes` 运行时绑定，CSS 选择器只能是字面量
  （详见 `DocSheetLayoutDialog.vue` 的文件头注）。

  下面 5 条全部是**新版自己的排版胶水**：旧版组件只把 HTML 推回 Home，没有抽屉外壳，
  所以没有任何旧版 CSS 可对照。逐字沿用 GS2 抽屉原有的取值（视觉零回归）。
*/
.gs2-wrap,
.ps2-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gs2-toolbar,
.ps2-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}
.gs2-toolbar .hint,
.ps2-toolbar .hint {
  font-size: 13px;
  color: #666;
}
.gs2-toolbar .grow,
.ps2-toolbar .grow {
  flex: 1;
}
.gs2-empty,
.ps2-empty {
  color: #d03050;
  font-size: 13px;
}
.gs2-loading,
.ps2-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 13px;
  padding: 24px 0;
}
/*
  预览容器：外层不加边框/背景 —— 根容器自带的 `@media screen` 负责灰底 + 卡片阴影。
  横向宽表靠这里滚动（等价 Home 那个容器的 `width:fit-content` + `overflowX:auto` + `maxWidth:100%`）。
*/
.gs2-preview,
.ps2-preview {
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  overflow: auto;
  max-height: 72vh;
}
</style>
