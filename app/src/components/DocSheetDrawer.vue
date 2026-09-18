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
    **C 家族两张**单据用的是**同一个** `ProductionEdit`，见 §15.5 的映射表）。
    ⚠️ **ic=14（自定义生产单）是例外**：它用的是另一个组件 `ProductionEditOld`
    （oldSheet 嵌套 + 双联，施工图 §6.5），所以本组件留了 `editDialog` 注入口 ——
    **只有 C 家族（GS2/PS2）走内置的 `DocEditDialog`**，ic=14 由包装层注入。
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
  <!--
    A：编辑行数据。**两种口径**（旧版是两个不同的组件，见 §15.5 / §6.5）：
      · C 家族（ic=15/16）→ `ProductionEdit`，平铺行、8 列固定定义 ⇒ 用内置的 `DocEditDialog`；
      · 自定义生产单（ic=14）→ `ProductionEditOld`，**oldSheet 嵌套 + 双联** ⇒ 形状对不上，
        由包装层经 `editDialog` 注入（`ProductionSheetEditDialog.vue`）。
    列定义 = 旧版 `ProductionEdit` 硬编码的那 8 列（§15.2）；`brFields` = 旧版做 `<br>`↔`\n`
    转换的那 **5** 个字段（`remark`/`OrderID`/`doorImg` **不转**）。
  -->
  <component
    v-if="editDialog"
    :is="editDialog"
    v-model="editShow"
    :rows="rows"
    :title="profile.text.editActionLabel"
    @save="onRowsSaved"
  />
  <DocEditDialog
    v-else
    v-model="editShow"
    :rows="docEditRows"
    :columns="DOC_EDIT_COLUMNS"
    :br-fields="DOC_EDIT_BR_FIELDS"
    :image-field="DOC_EDIT_IMAGE_FIELD"
    :title="profile.text.editActionLabel"
    :success-text="DOC_EDIT_SUCCESS_TEXT"
    @save="onRowsSaved"
  />
</template>

<script setup lang="ts" generic="C, R, O">
import { computed, nextTick, ref, shallowRef, watch, type Component } from 'vue'
import { NButton, NDrawer, NDrawerContent, NSpin, useMessage } from 'naive-ui'

import { api } from '../api/client'
import type { OrderDto } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { buildOrderPrintContext, loadPrintPrereqs, type PrintPrereqs } from '../composables/useOrderPrint'
import type { PrintContext } from '../utils/printPayloads'
import DocEditDialog from './DocEditDialog.vue'
import {
  DOC_EDIT_BR_FIELDS,
  DOC_EDIT_COLUMNS,
  DOC_EDIT_IMAGE_FIELD,
  DOC_EDIT_SUCCESS_TEXT,
  UI_NO_ORDERS_HINT,
  UI_PRINT_FAIL_PREFIX,
  UI_PRINT_OK,
  type DocSheetDrawerProfile,
} from './docSheetUi'

/**
 * ⚠️ **三个类型形参只有一处用处**：让「配置 / 行 / 渲染选项」的形状随单据走。
 * 本组件对它们**不做任何假设**（只把它们原样转给档案里的函数），所以不需要约束
 * （`R` 尤其不能约束成 `DocSheetRow` —— 它是 interface，没有索引签名时的隐式兼容不成立）。
 *
 * GS2 / PS2 由 `PRODUCTIONSHEET2_UI_PROFILE`（= `DocSheetUiProfile`，三个形参全走默认值）
 * 推出 `C = DocSheetConfig` / `R = DocSheetRow` / `O = RenderOptions`，与改动前逐字等价。
 */
const props = defineProps<{
  show: boolean
  /** 选中订单的**完整**明细（由调用方保证已 `getOrder`）。 */
  orders: OrderDto[]
  /** 本单据的组件层档案（文案 / 外壳 class / 模块转出 / **行来源**）。 */
  profile: DocSheetDrawerProfile<C, R, O>
  /**
   * 两个设置弹窗的**具体单据包装组件**（`GlassSheet2LayoutDialog` / `ProductionSheet2LayoutDialog` …）。
   *
   * ⚠️ 为什么不放进 profile：档案模块要能被三个包装组件同时 import，而包装组件又要被档案引用
   * ⇒ 循环。把「组件」当 props 由包装层注入，档案就保持成一份纯数据 + 函数引用。
   * 两个组件都接收 `{ show, config, rows?, profile, saved }`（见各自的 defineProps）。
   */
  layoutDialog: Component
  settingsDialog: Component
  /**
   * 「编辑XX」那颗按钮开的弹窗组件（**可选**）。缺省 → 用内置的 `DocEditDialog`（C 家族口径）。
   *
   * ⚠️ 为什么必须能换：ic=14 的编辑弹窗是旧版的另一个组件 `ProductionEditOld`（§6.5），
   * 数据形状是 `oldSheet` 嵌套 + 双联，与 `DocEditDialog` 的「平铺行 + 8 列固定定义」对不上。
   * 注入的组件接收 `{ modelValue, rows, title }` 并 emit `save`。
   */
  editDialog?: Component
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

/**
 * 行数据（旧版 Home 的 `oi` / `qr`）—— 编辑弹窗改的就是它，随抽屉重开重建。
 *
 * ⚠️ 必须是 `shallowRef` 而不是 `ref`：`R` 是**不设约束**的形参，`ref<R[]>` 会得到
 * `UnwrapRefSimple<R>[]`，那个类型**没法**传回 `produceRows`/`printDirect`（`R` 可能是个
 * 带方法或 getter 的类型）。本组件只**整体替换**这个数组（从不就地改某一项），
 * 浅层响应式完全够用，且与旧版「每次 build 现算一整个数组」的语义一致。
 */
const rows = shallowRef<R[]>([])
/**
 * 每张订单的汇算上下文（**新版自有的一份留存**）—— 只为「配置改了要重建行」这件事
 * （决策 D3）。旧版没有这一层：它的行来源是 Home 侧的 `getData()`，每次 build 现算。
 * 不留这份就无法在 `onConfigSaved()` 里重跑 `produceRows`（`props.orders` 那时已经
 * 被 `getOrder` 补全过，`prereqs` 也不想重拉一遍）。
 */
const rowContexts = ref<PrintContext[]>([])
/** 生效配置（旧版组件内的 `i`）。两个弹窗都只读它，草稿在各自内部。 */
const config = ref<C>(props.profile.api.loadSettings().config)
const ready = computed(() => !!previewHtml.value)

/**
 * 给**内置** `DocEditDialog` 用的行（只走 `v-else` 那条分支）。
 *
 * ⚠️ 断言是必要的、也是安全的：`R` 在本组件里是个不设约束的形参，而**内置编辑弹窗只服务
 * C 家族**（`R` 在那里恒为 `DocSheetRow`，本身就带 `[extra: string]: unknown`）。
 * ic=14 走的是 `editDialog` 注入的那条分支，根本不经过这里（§6.5）。
 */
const docEditRows = computed(() => rows.value as unknown as Record<string, unknown>[])

/**
 * 整份文档一套渲染选项（旧版是模块级单例 + 一张 Map 缓存，这里按抽屉实例一份）。
 *
 * ⚠️ 由**档案**构造而不是在这里拼：两张单据的选项**键名不同**（C 家族 `{qr}` /
 * ic=14 `{qrSvg}`），本组件不知道 `O` 的具体形状 —— 见 `DocSheetDrawerProfile.createRenderOpts`。
 */
const renderOpts: O = props.profile.createRenderOpts()

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
      rowContexts.value = full.map((o) => buildOrderPrintContext(o, prereqs, who))
      rows.value = buildRows()
      await renderPreview()
    } catch (e) {
      message.error((e as Error).message || props.profile.text.readError)
    } finally {
      loading.value = false
    }
  },
)

/**
 * 由留存的上下文重建行（**决策 D3 新加的**）。
 *
 * 多张订单 = 各单的行**首尾相接**（旧版 `oi` / `qr` 就是一次汇算的全部行）；
 * 第二参 `config` 供「行形状依赖配置」的单据使用（本次是自定义生产单的 `itemsPerPage`，
 * 见 `DocSheetUiProfile.produceRows` 的注）。
 */
function buildRows(): R[] {
  return rowContexts.value.flatMap((ctx) => props.profile.produceRows(ctx, config.value))
}

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

/**
 * 两个设置弹窗保存后：重读生效配置（同一个 localStorage 键）→ 按需重建行 → 重渲染。
 *
 * **决策 D3（§8.1，2026-09-18 lead 批准）**：自定义生产单（ic=14）的**行形状**由
 * `print.itemsPerPage` 决定（`=== 2` 时两条记录配对成一条配对行），所以改了「每页数据数」
 * 之后**必须重跑一次 `produceRows`**，否则预览仍按旧版式渲染。
 * 其余单据的行只由订单明细决定 ⇒ `rowsDependOnConfig` 留空，这里不白跑一遍汇算。
 *
 * ⚠️ 判据刻意**不看配置内容是否真的变了**（旧版 Home `wc` 就是保存后无条件重跑 `Sr()`）：
 * `produceRows` 对同一份输入是纯函数，多跑一次无副作用，而逐字段比配置反而容易漏字段。
 */
async function onConfigSaved(): Promise<void> {
  config.value = props.profile.api.loadSettings().config
  if (props.profile.rowsDependOnConfig) rows.value = buildRows()
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
 *
 * ⚠️⚠️ **有意偏离（决策 D3 的附带结论，§9.2，2026-09-18 lead 明确要求写在这里）**：
 * 新版**保存编辑后不再重跑 `produceRows`**（即**不再配对**）。
 *
 * 旧版 ic=14 的 `ProductionEditOld` 吃的是**已配对的行**、保存时**原样吐回配对行**
 * （两套 `orderID`/`size`/`oldSheet`/`remark`，`Hui.formatted.js:6544-6557`），
 * 而 Home 的 `wc` 紧接着又调了一次 `Sr()` → 又跑一次 `sc()` ⇒ **二次配对**：
 *   · 配对数 = 1 时是 no-op（`sc` 里 `b === undefined` 走 `else`，原样返回）；
 *   · 配对数 ≥ 2 时真的会串位，产出 `orderID11` / `oldSheet11` 这类脏键
 *     （关键字段歪打正着地活着，非关键字段串位）。
 *   触发门槛 = **一次汇算出 ≥ 4 张订单且开了「2 条/页」**（§9.2）。
 *
 * **这是旧版的一处长期潜伏的脏数据源，新版不复刻**：配对**只在一处做** ——
 * `produceRows(ctx, config)` 里按 `config.print.itemsPerPage` 决定
 * `oldSheetProduces(paired)`；编辑弹窗与预览读的是**同一份已配对的行**；
 * 编辑保存后只回写这行、**不重新配对**。行为差异仅在「≥4 张订单 + 2 条/页 + 用编辑弹窗改过」
 * 这一组合下可见，且新版是**修正**、不是回归。
 */
async function onRowsSaved(next: Record<string, unknown>[]): Promise<void> {
  rows.value = next as R[]
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
  ⚠️ **全部前缀并列** —— 模板 class 由 `profile.classes` 运行时绑定，CSS 选择器只能是字面量
  （详见 `DocSheetLayoutDialog.vue` 的文件头注）。

  三个前缀（§8.1 决策 D1(b)，2026-09-18 lead 批准）：
    · `gs2-*` —— 自定义玻璃合片单（ic=16）
    · `ps2-*` —— 自定义生产单2（ic=15）
    · `ps1-*` —— 自定义生产单（ic=14）。★ 前缀是 **`ps1`**（不是 `ps`）：
      PS2 的核心层前缀也是 `ps`，外壳若共用 `ps2-*` 两张单子在 DOM 里就同名了。
      常量见 `docSheetUi.ts` 的 `PS_SHELL_NS` / `PRODUCTION_SHEET_UI_CLASSES`。
      **落地情况（2026-09-18）**：`ps1-*` 这一组**已经是活的** ——
      `ProductionSheetDrawer.vue` 复用本组件、递的是 `PRODUCTION_SHEET_UI_PROFILE`
      （`classes` 走显式的 `PRODUCTION_SHEET_UI_CLASSES`，不派生自 `core.prefix`，
      因为 ic=14 没有 `core`，见 `DocSheetDrawerProfile` 的头注）。
      它下面 5 条样式随之生效，**不是死代码**。

  下面 5 条全部是**新版自己的排版胶水**：旧版组件只把 HTML 推回 Home，没有抽屉外壳，
  所以没有任何旧版 CSS 可对照。逐字沿用 GS2 抽屉原有的取值（视觉零回归）。
*/
.gs2-wrap,
.ps2-wrap,
.ps1-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gs2-toolbar,
.ps2-toolbar,
.ps1-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}
.gs2-toolbar .hint,
.ps2-toolbar .hint,
.ps1-toolbar .hint {
  font-size: 13px;
  color: #666;
}
.gs2-toolbar .grow,
.ps2-toolbar .grow,
.ps1-toolbar .grow {
  flex: 1;
}
.gs2-empty,
.ps2-empty,
.ps1-empty {
  color: #d03050;
  font-size: 13px;
}
.gs2-loading,
.ps2-loading,
.ps1-loading {
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
.ps2-preview,
.ps1-preview {
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  overflow: auto;
  max-height: 72vh;
}
</style>
