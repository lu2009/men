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
    按 ic 分支的 ` 编辑XX ` —— 见下方 `EDIT_SPECS`（原版排 `手动打印` 之后，新版同序）
  原版**没有「预览」按钮**（弹窗本身就是预览），所以新版也去掉了那颗。

  ★ **编辑按钮的数据回环**（2026-09-18 补，照 §4「保存后重渲预览」）：
    预览渲染时产出的**行数组**（`buildBatchPayload` 的 `rows`）留住 → 喂给编辑弹窗
    （原版喂的是 Home 那份内存 ref：ic=1/2 的 `uc`、ic=4 的 `bc`、ic=8/9 的 `uc`）；
    保存后把它存成**行覆盖**并重跑一次渲染 —— `buildBatchPayload` 会用它替换载荷里的那一段行。
    **只改内存，不落库、不回写汇算结果**（§5），与旧版逐条一致。
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
        <!--
          编辑入口。文案逐字照旧版（**含前后空格**）—— 原版 `<n-button>` 的内容就是那个带空格的
          token（`dr` 表 key33/key29/key43/key32），HTML 折叠行首尾空白 ⇒ 视觉上无差异，照抄。
          旧版这几颗按钮没有 `disabled`（空数据是点了之后警告），这里只在「正在读数据」时禁掉。

          ⚠️ **有意偏离（观感，1 处）**：旧版这五颗按钮都是 `type:"primary"` + `round` + `size:"default"`
          （ic=1/2/4 走 token `s(1016)="primary"`，ic=8/9 写字面量 `"primary"`），
          而本弹窗的工具条从改结构那天起就统一成 `size="small"`、不 `round`、只有打印类才显色
          （`关闭`/`打印` 都在此列）。为不在一排里插进一颗风格突兀的按钮，这里**沿用工具条既有的口径**，
          不单独给编辑按钮上 primary/round。行为（点了开哪个弹窗）完全一致。
        -->
        <n-button v-if="editSpec" size="small" :disabled="loading" @click="openEdit">
          {{ editSpec.label }}
        </n-button>
        <!--
          「复制回执单」—— 旧版「查看回执单」那颗开的弹窗（`Ai`）工具条上的一颗（`hc`，:497024），
          排在「编辑回执单」之后。新版这条路落到本共用弹窗，所以**只在收据族 mode 上出现**。
          ⚠️ 旧版另有一颗名字不同的「复制收据单」(`hc`) 在按 `ic` 分支的那个弹窗上 ——
             两条路在新版合并到本弹窗，这里取 `ki` 那条路的名字。
          动作 = 把当前预览整份渲染成 PNG 进剪贴板（复用 `utils/receiptImage.ts`）。
        -->
        <n-button
          v-if="canCopyReceipt"
          size="small"
          :disabled="!ready || loading"
          :loading="copying"
          @click="doCopyReceipt"
        >
          {{ copying ? '复制中...' : '复制回执单' }}
        </n-button>
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

  <!--
    编辑弹窗（旧版是**三个不同的组件**，按 ic 分支 —— §3 的对照表）：
      · `flat`   → `ProductionEdit`（ic=1/2：平铺行 + 8 列硬编码定义 + 5 个字段转 `<br>`）
      · `label`  → `LabelEdit`（ic=4：平铺标签行、**一个字段都不转**）
      · `paired` → `ProductionEditOld`（ic=8/9：oldSheet 嵌套 + 双联）
    ⚠️ 三者的 props 签名不一样（`flat` 那套还要列定义/转换字段），所以**分开写三条**，
      不走 `<component :is>` 的动态注入。列定义等常量取自 `docSheetUi.ts`（与 GS2/PS2 同一份）。
  -->
  <DocEditDialog
    v-if="editSpec?.kind === 'flat'"
    v-model="editShow"
    :rows="editRows"
    :columns="DOC_EDIT_COLUMNS"
    :br-fields="DOC_EDIT_BR_FIELDS"
    :image-field="DOC_EDIT_IMAGE_FIELD"
    :title="editTitle"
    :success-text="DOC_EDIT_SUCCESS_TEXT"
    @save="onEditSaved"
  />
  <QualifiedLabelEditDialog
    v-else-if="editSpec?.kind === 'label'"
    v-model="editShow"
    :rows="editRows"
    @save="onEditSaved"
  />
  <ProductionSheetEditDialog
    v-else-if="editSpec?.kind === 'paired'"
    v-model="editShow"
    :rows="editRows"
    @save="onEditSaved"
  />
  <!-- 玻璃订单（旧版 ic=3 的 `GlassEdit`，9 列 + 操作列） -->
  <GlassEditDialog v-else-if="editSpec?.kind === 'glass'" v-model="editShow" :rows="editRows" @save="onEditSaved" />
  <!--
    收据族（旧版 ic=5 的 `ReceiptEdit`）。⚠️ 它编辑的是**载荷对象本身**（表头 + `receipt` 行），
    不是「一整份行」—— 所以吃 `editHeader` 而不是 `editRows`（见 `buildBatchPayload` 的 `header`）。
  -->
  <ReceiptEditDialog
    v-else-if="editSpec?.kind === 'receipt'"
    v-model="editShow"
    :customer-data="editHeader as never"
    @save="onEditSaved"
  />
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
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
import { copyReceiptImage } from '../utils/receiptImage'
import DocEditDialog from './DocEditDialog.vue'
import QualifiedLabelEditDialog from './QualifiedLabelEditDialog.vue'
import ProductionSheetEditDialog from './ProductionSheetEditDialog.vue'
import GlassEditDialog from './GlassEditDialog.vue'
import ReceiptEditDialog from './ReceiptEditDialog.vue'
import {
  DOC_EDIT_BR_FIELDS,
  DOC_EDIT_COLUMNS,
  DOC_EDIT_IMAGE_FIELD,
  DOC_EDIT_SUCCESS_TEXT,
} from './docSheetUi'

/** 一行可编辑数据（三张编辑弹窗的 `rows` 都是这个形状）。 */
type Row = Record<string, unknown>

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

// ---------------------------------------------------------------- 编辑入口 //

/**
 * 「编辑XX」按钮 → 编辑弹窗的分发表（旧版按 `ic` 分支，新版按 `mode`）。
 * 见 `docs/edit-dialog-recon/01-edit-table.md` §1/§2 与 §8 的挂载点表。
 *
 * | mode | 旧版 ic | 按钮文案（逐字，含前后空格） | 旧版弹窗 | 新版弹窗 |
 * |---|---|---|---|---|
 * | `glass` | 1 | ` 编辑玻璃合片单 ` | `ProductionEdit` | `DocEditDialog` |
 * | `product` | 2 | ` 编辑生产单 ` | `ProductionEdit` | `DocEditDialog` |
 * | `lable` | 4 | ` 编辑标签 ` | `LabelEdit` | `QualifiedLabelEditDialog` |
 * | `product2` | 8 | ` 编辑生产单 ` | `ProductionEditOld` | `ProductionSheetEditDialog` |
 * | `product3` | 9 | ` 编辑生产单 ` | `ProductionEditOld` | `ProductionSheetEditDialog` |
 *
 * ⚠️ **不在这张表里的 mode 就是没有编辑按钮** —— 旧版同样只有 ic 1/2/3/4/5/8/9/12–16 有（§6）。
 *    ic=3（玻璃订单 → mode `glassHole`）与 ic=5（收据单 → mode `receipt`）的编辑入口由别的改动接。
 *
 * 刻意**排除**的相邻 mode（都不是漏掉，各有依据）：
 *    · `product1`（生产单1）—— 旧版 `mode 7` = ic=7「平开门生产单(定制)」，该 ic **没有**编辑按钮（§1/§6）。
 *    · `product4` / `product10` —— 分别是 ic=11「料标签」/ ic=10「生产标签」，两个 ic 都**没有**（§6）。
 *    · `product5`–`product9` —— 旧版 Home 的 16 个入口里根本没有它们（`docs/2026-08-23-hui-analysis.md`
 *      的模板清单有，但 §1 的 ic 表没有），没有可照抄的分支 ⇒ 不给。
 * TODO(未确认): `FinalReceipt` / `ReceiptList` 对应旧版哪个 ic 没查（§1 只记了「收据单」= ic=5），
 *     故这两个 mode 这里**不给**编辑按钮 —— 不猜。
 * TODO(未确认): `product5`–`product9` 是否在别的设置路径下被赋过 ic，没有查（按上面的理由先不给按钮）。
 */
type EditKind = 'flat' | 'label' | 'paired' | 'glass' | 'receipt'

interface EditSpec {
  /** 用哪张编辑弹窗（旧版三个组件的三分法）。 */
  kind: EditKind
  /** 按钮文案（逐字）。 */
  label: string
  /** 空数据时的警告文案（旧版守卫：ic=1/2/8/9 `dc`/`mc` =「暂无生产单数据」，ic=4 `kc` =「暂无标签数据」，§8）。 */
  emptyText: string
}

const EDIT_SPECS: Record<string, EditSpec> = {
  glass: { kind: 'flat', label: ' 编辑玻璃合片单 ', emptyText: '暂无生产单数据' },
  product: { kind: 'flat', label: ' 编辑生产单 ', emptyText: '暂无生产单数据' },
  lable: { kind: 'label', label: ' 编辑标签 ', emptyText: '暂无标签数据' },
  product2: { kind: 'paired', label: ' 编辑生产单 ', emptyText: '暂无生产单数据' },
  product3: { kind: 'paired', label: ' 编辑生产单 ', emptyText: '暂无生产单数据' },
  // 旧版 ic=3「玻璃订单」；行取首单那份（旧版 `Uc` 编辑的是 `rc[0].glassInfoList`）。
  // 空数据守卫文案未在 §8 查到 ⇒ 用同族那句（**标 TODO**）。
  glassHole: { kind: 'glass', label: ' 编辑玻璃单 ', emptyText: '暂无生产单数据' },
  // 旧版 ic=5「收据单」，模板 key 就是 `receipt`（旧版 `It.commentPreview("receipt", …)`）。
  // ⚠️ `FinalReceipt`/`ReceiptList` 对应哪个 ic **没查实**，按「别猜」原则**不给**编辑按钮。
  receipt: { kind: 'receipt', label: ' 编辑收据单 ', emptyText: '暂无收据单数据' },
}

/** 当前 mode 的编辑口径；`null` = 这个 mode 没有编辑按钮。 */
const editSpec = computed<EditSpec | null>(() => EDIT_SPECS[props.mode] ?? null)

/** 弹窗标题 = 按钮文案去掉那对**旧版字符串表自带的**前后空格（旧版三个弹窗都没有 title，§10.5）。 */
const editTitle = computed(() => editSpec.value?.label.trim() || '编辑')

const editShow = ref(false)
/** 「复制回执单」的进行中态（旧版 `wl`，文案「复制中...」↔「复制回执单」）。 */
const copying = ref(false)

/**
 * 只有**收据族**有这颗。目前只给 `receipt` —— `FinalReceipt`/`ReceiptList` 对应旧版哪个 ic
 * 仍未查实（见 `EDIT_SPECS` 的 TODO），按「别猜」不给。
 */
const canCopyReceipt = computed(() => props.mode === 'receipt')
/**
 * 预览渲染时产出的行（`buildBatchPayload` 的 `rows`）—— 编辑弹窗读的就是这份
 * （对应旧版 Home 的内存 ref：ic=1/2 的 `uc`、ic=4 的 `bc`、ic=8/9 的 `uc`）。
 */
const editRows = shallowRef<Row[]>([])
/**
 * 「**载荷对象本身就是编辑对象**」那一类（**收据族**）的可编辑对象 —— 对应旧版 `jn[0]`。
 * 其余形状恒为 `null`（它们的可编辑面是 `editRows`）。见 `buildBatchPayload` 的 `header`。
 */
const editHeader = shallowRef<Row | null>(null)
/**
 * 编辑弹窗保存后的**行覆盖**。`null` = 本次会话还没编辑过 ⇒ 用汇算产物。
 *
 * ⚠️ 只活在本弹窗的内存里：旧版**不落库、也不回写汇算结果**（§5），下次开弹窗重新汇算即回退。
 * 重开弹窗 / 换 mode 时清空（旧版每个入口 handler 都会重算一遍行）。
 */
const rowOverride = shallowRef<Row[] | null>(null)
/** 收据族那份「对象本身」的覆盖；`null` = 本次会话还没编辑过。与 `rowOverride` 互斥使用。 */
const headerOverride = shallowRef<Row | null>(null)

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
    // 每次开 / 换 mode 都是新会话：上一轮的编辑结果作废（旧版每个入口 handler 都重算行）
    rowOverride.value = null
    headerOverride.value = null
    editRows.value = []
    editHeader.value = null
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

/**
 * 每张订单 → 各自的 payload（`templatePayload` 的分发逻辑与 Hui 完全同一份）。
 *
 * `overrideRows` = 编辑弹窗保存过的行；非空时它会**替换**载荷里那一段行（见 `buildBatchPayload`）。
 * 预览与打印**都**走这里，所以编辑结果对「重渲的预览」和「实打」同时生效 ——
 * 与旧版一致（旧版打印/导出读的也是编辑过的那份内存 ref，§5）。
 */
async function buildPayloads(
  forPreview: boolean,
  mode0: string,
  overrideRows: Row[] | null = null,
  overrideHeader: Row | null = null,
) {
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
    overrideRows,
    overrideHeader,
  )
}

async function render(mode0: string, token: number) {
  rendering.value = true
  try {
    const built = await buildPayloads(true, mode0, rowOverride.value, headerOverride.value)
    if (token !== renderToken) return
    // 留住这一轮的可编辑数据 —— 编辑弹窗按 kind 读 `rows` 或 `header`
    editRows.value = built.rows
    editHeader.value = built.header
    const html = (await renderByMode(mode0, built.payload)) || ''
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

/**
 * 复制回执单（旧版 `hc`，:497024；「查看回执单」那条路的弹窗上叫 `Mi`）。
 *
 * 把**当前预览整份**渲染成 PNG 进剪贴板 —— 与「回执单-其它」抽屉里那颗是同一个动作、
 * 同一份实现（`utils/receiptImage.ts`），只是入口不同（这里是预览弹窗的工具条）。
 */
async function doCopyReceipt() {
  if (!previewHtml.value) return
  copying.value = true
  try {
    await copyReceiptImage(previewHtml.value)
    message.success('回执单图片已复制，可直接粘贴到微信')
  } catch (e) {
    message.error('复制失败，请重试' + ((e as Error).message ? '：' + (e as Error).message : ''))
  } finally {
    copying.value = false
  }
}

async function doPrint() {
  if (!props.mode) return
  try {
    const { payload } = await buildPayloads(false, props.mode, rowOverride.value, headerOverride.value)
    await printByMode(props.mode, payload)
  } catch (e) {
    message.error((e as Error).message || '打印失败')
  }
}

// ---------------------------------------------------------------- 编辑动作 //

/**
 * 「编辑XX」那颗按钮（旧版 `dc`(ic=1/2) / `kc`(ic=4) / `mc`(ic=8/9)）：
 * **空数据只警告、不开窗** —— 判据与文案逐字照 §8 的守卫表
 * （`uc.value.length` / `Cc.length`，警告走 `ElMessage.warning`）。
 */
function openEdit(): void {
  const spec = editSpec.value
  if (!spec) return
  // 收据族的可编辑面是 `header`（`rows` 对它是空的），守卫要按 kind 取对应的那份
  const hasData = spec.kind === 'receipt' ? !!editHeader.value : !!editRows.value.length
  if (!hasData) {
    message.warning(spec.emptyText)
    return
  }
  editShow.value = true
}

/**
 * 编辑弹窗「确认修改」（旧版各 ic 的 onSave：`gc`(ic=1/2) / `Pc`(ic=4) / `wc`(ic=8/9)）。
 *
 * **统一形态**（§4）：写回那份内存行数组 → 用该模板重渲预览。
 * 新版等价做法：把行存成覆盖 → 重跑一次渲染（`buildBatchPayload` 会用它替换载荷里的行）。
 *
 * ⚠️ 旧版这几个回调都是「**预览开着才**重渲」（关着就只落 ref）。本弹窗开着才可能点编辑，
 * 所以这里直接重渲；关窗后 `rowOverride` 随下一次开窗清空，语义仍然一致。
 * ⚠️ **不落库、不回写汇算结果**（§5）—— 改动只影响本次会话的预览 / 打印。
 */
async function onEditSaved(next: Row[] | Row): Promise<void> {
  // 收据族回传的是**对象**（整份 `customerData`），其余几个回传行数组
  if (editSpec.value?.kind === 'receipt') {
    headerOverride.value = next as Row
  } else {
    rowOverride.value = next as Row[]
  }
  const token = ++renderToken
  await render(props.mode, token)
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
