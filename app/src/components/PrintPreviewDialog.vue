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

  ★ **2026-09-18 补四颗按钮** —— 依据 `docs/toolbar-gap/01-gap.md` §2.5 / §2.7 / §2.8 / §2.11
    （该报告同时销掉了本文件原先「`FinalReceipt`/`ReceiptList` 是哪个 ic」的 TODO，见 §0）：

    | 按钮 | 旧版 | 挂哪个 mode | 旧版 ic |
    |---|---|---|---|
    | `显示金额`/`去除金额` | `Vr` @355200 | `FinalReceipt` | 5 |
    | `复制成图片` | `Ei` @375712 | `ReceiptList` | `al` ≡ 6 |
    | `复制玻璃单` | `vc` @424179 | `glassHole` | `lo` ≡ 3 |
    | `复制收据单` | `hc` @427351 | `FinalReceipt` | `oo` ≡ 5 |

  ★ **本轮的有意偏离清单**（逐条给理由；其余全部逐字照旧版）：

    1. **按钮顺序**：本弹窗从改结构那天起就是「编辑 → 复制类」两个固定槽。
       旧版 ic=5 的顺序（`key27` 编辑收据单 → `key28` 显示金额 → `key34` 复制收据单）与之**恰好一致**；
       但旧版 **ic=3 是反的**（`key39` 复制玻璃单 → `key41` 导出玻璃订单 → `key42` 编辑玻璃单）。
       理由：为一个 mode 把 `编辑` 槽改成按 mode 变位会把工具栏从「固定槽」变成「按序拼装」，
       而旧版自己这两处就不一致 —— 取 ic=5 那套（也是与现有代码零改动的那个顺序）。
    2. **按钮外观**：旧版这四颗都是 `type:"success"`（`dr[632]`）+ `round` + `size:"default"`；
       本弹窗统一 `size="small"`、不 `round`、只有打印类显色（与「编辑XX」同一处口径）。
       理由：不在一排里插进风格突兀的按钮。行为完全一致。
    3. **`FinalReceipt`/`receipt` 的空数据守卫**：旧版 ic=5 那颗（@495453）是
       `onClick: e => _n.value = !0`，**直接开窗、没有守卫**；`receipt` 那条路是
       `qn.length > 0` 才**渲染**按钮。新版统一走 `openEdit` 的「空数据只警告」那一套
       （两颗的 `emptyText` 都写 `暂无收据单数据`）。
       理由：本弹窗的编辑槽已有统一的守卫机制，且这两处「守卫 vs 不渲染」在旧版本身就不统一。
       实际影响趋近于零：有订单时 `editHeader` 恒非空，此分支够不到。
    4. **复制失败提示**：旧版 `hc`/`Ei` 的 catch 是 `dr[752]`「复制失败，请重试」，
       `vc` 的 catch **一句提示都没有**（只重渲了一遍预览 `yc()`）；新版四档统一提示，
       并在后面追加浏览器给的具体原因（沿用本弹窗既有写法）。
    5. **复制成功后「标记已打印」未做**：旧版四颗复制按钮尾部都会调 `Kc`/`Hl`/`Gl`
       写「已打印单号」集合（`vc` 连 **catch 分支**里也写）。新版全仓没有这套数据结构，
       本轮不引入。见 `COPY_SPECS` 上的 `TODO(未确认)`。
    6. **多选订单时复制的是「全部页」，旧版只复制第一份**：旧版这条路处处只取
       `[0].outerHTML` —— 预览 `Rn()`(@355100) / `Ci`(@368822) 与复制 `hc`/`vc`/`Ei`
       都是 `u[0].outerHTML` ⇒ 选 N 张订单时旧版**只看/只复制第一份**。
       新版预览从建这个弹窗起就用 `renderByMode` 把 `getHtml` 的每一页拼起来（既有决定），
       复制沿用「复制所见」⇒ N 份都复制。
       理由：与新版预览保持一致（复制出来的图必须等于屏幕上那份），且 `[0]` 在多选下显然
       是旧版的疏忽 —— **单张订单时两者逐字一致**，差异只在多选。

    ⚠️ 另外两处**不是**偏离、而是旧版自带的行为，已逐字保留：
       · 「显示金额 / 去除金额」的**文案方向是反的**（`Zn=true` 时写「显示金额」）；
       · 三档复制按钮的**容器样式 / scale 各不相同**（见 `receiptImage.ts` 的三个 `*_CSS` 常量）。

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
        <!-- 模板下拉（只在给了 `templates` 时出现）—— 收敛 Hui 的「模板预览」用 -->
        <n-select
          v-if="templates && templates.length"
          v-model:value="currentMode"
          size="small"
          filterable
          style="width: 240px"
          :options="templates.map((t) => ({ label: t.name, value: t.mode }))"
        />
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
          「显示金额 / 去除金额」—— 旧版 `Vr`（@355200），按钮 @495696（渲染模板 key28，
          唯一条件就是 `5==ic`，即 mode `FinalReceipt`）。

          ⚠️ **文案是反的**（CONFIRMED，@495696 解出来）：`Zn.value ? 【显示金额】 : 【去除金额】`
             —— `Zn=true`（当前**已经**去除）时按钮写「显示金额」。逐字照抄，别「修正」。

          ⚠️ 这颗按钮的动作**不止影响预览**：旧版 `Qn()` 的 5 个真实调用点是
             `Rn()`(预览) / `hc`(复制收据单) / `Zc`(云打印) / `Xc`(导出PDF) / `Qc`(手动打印)。
             新版统一在 `buildPayloads` 这一层套变换 ⇒ 预览与打印共用（复制走的是渲染好的预览 HTML）。
             见下方 `applyAmountTransform`。
        -->
        <n-button
          v-if="canToggleAmount"
          size="small"
          :disabled="!ready || loading"
          @click="toggleAmount"
        >
          {{ amountHidden ? '显示金额' : '去除金额' }}
        </n-button>
        <!--
          复制类的**唯一**一颗槽，按 mode 取口径（`COPY_SPECS`）—— 四档互斥：
            · `receipt`     →「复制回执单」 旧版 `Mi`（「查看回执单」那个弹窗上的那颗）
            · `ReceiptList` →「复制成图片」 旧版 `Ei` @375712（`al && !z`）
            · `glassHole`   →「复制玻璃单」 旧版 `vc` @424179（`lo && !z`）
            · `FinalReceipt`→「复制收据单」 旧版 `hc` @427351（`oo && !z` 的 ic=5 分支）

          动作都是「把**当前预览整份**渲染成 PNG 进剪贴板」（复用 `utils/receiptImage.ts`）；
          差别只在旧版逐处不同的**容器样式 / scale / 是否等字体 / 是否显式给尺寸** —— 见 `COPY_SPECS`。
        -->
        <n-button
          v-if="copySpec"
          size="small"
          :disabled="!ready || loading"
          :loading="copying"
          @click="doCopy"
        >
          {{ copying ? '复制中...' : copySpec.label }}
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
import { renderByMode, printByMode, type PrintPayload } from '../utils/printService'
import {
  buildBatchPayload,
  loadPrintPrereqs,
  type BuiltPrintPayload,
  type PrintPrereqs,
} from '../composables/useOrderPrint'
import {
  copyReceiptImage,
  GLASS_COPY_CSS,
  RECEIPT_COPY_CSS,
  SUMMARY_COPY_CSS,
  type OffscreenRenderOptions,
} from '../utils/receiptImage'
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
  /**
   * 打开预览时**是否自动补行级单号**（默认 true）。
   *
   * ⚠️ 传 `false` 的是**「算料」**那条路 —— 旧版 `In`/`Un` 不补号（补号是打印时才做的），
   * 而算料复用了本弹窗；不关掉的话点一下算料就把单号静默写进库了。
   */
  autoLineNumbers?: boolean
  /**
   * 可切换的模板清单（给了才在下拉里出现）。
   *
   * ⚠️ 这是为**收敛 Hui 的「模板预览」**加的（2026-09-19）：Hui 那个老弹窗有模板下拉，
   * 本弹窗只有固定 `mode`，功能不重合。给了 `templates` 就能顶替它。
   * **不传就完全没变化**（Home 那边一个字都不用改）。
   */
  templates?: { mode: string; name: string }[]
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
 * | `glassHole` | 3 | ` 编辑玻璃单 ` | `GlassEdit` | `GlassEditDialog` |
 * | `FinalReceipt` | 5 | ` 编辑收据单 ` | `ReceiptEdit` | `ReceiptEditDialog` |
 *
 * ★ **2026-09-18 销 TODO（`docs/toolbar-gap/01-gap.md` §0，两条独立证据互证）**：
 *    `FinalReceipt` = ic **5**（`hi` @366755 取 `template.FinalReceipt`；`Xc` 的 `5==ic` 分支
 *    标题写 `【收据单】`），`ReceiptList` = ic **6**（`Ci` @368822 + `Xc` 的 `6==ic` 分支）。
 *    `receipt`（客户回执单）**不在 ic 1–16 里** —— 它来自 `ki`「查看回执单」（@381604）
 *    那条路，所以它的编辑按钮文案取那个弹窗上的 `dr[597]`。
 *
 *    ⚠️ **顺带更正上一轮的挂错**：此前 `receipt` 上挂的是 `dr[504]`「 编辑收据单 」，
 *    那是 **ic=5** 的文案。按旧版改成 `dr[597]`「 编辑回执单 」——
 *    两者都开**同一个** `ReceiptEditDialog`（旧版 `ReceiptEdit`，两个挂载点 `_n` / `Jn`）。
 *
 * ⚠️ **不在这张表里的 mode 就是没有编辑按钮**。旧版 `Xc` 的按钮渲染里逐条扫过
 *    （工具栏那串 `createBlock(w,{key:N})`，key0–key43）：**没有任何 `6==ic` 分支**
 *    ⇒ `ReceiptList` 确实**没有**编辑按钮，不是漏掉。
 *
 * 刻意**排除**的相邻 mode（都不是漏掉，各有依据）：
 *    · `product1`（生产单1）—— 旧版 `mode 7` = ic=7「平开门生产单(定制)」，该 ic **没有**编辑按钮（§1/§6）。
 *    · `product4` / `product10` —— 分别是 ic=11「料标签」/ ic=10「生产标签」，两个 ic 都**没有**（§6）。
 *    · `product5`–`product9` —— 旧版 Home 的 16 个入口里根本没有它们（`docs/2026-08-23-hui-analysis.md`
 *      的模板清单有，但 §1 的 ic 表没有），没有可照抄的分支 ⇒ 不给。
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
  // 旧版 ic=5「收据单」（`dr[504]`，「 编辑收据单 」）。旧版 `_n` 那个开关（@495453）**直接置 true、
  // 没有空数据守卫** —— 这里的 `emptyText` 是新版自己加的前置拦截（见下方「有意偏离」）。
  FinalReceipt: { kind: 'receipt', label: ' 编辑收据单 ', emptyText: '暂无收据单数据' },
  // 旧版「查看回执单」（`ki` @381604）那条路上的「 编辑回执单 」（`dr[597]`）—— 客户回执单
  // `It.commentPreview("receipt", …)`。⚠️ 它**不在 ic 1–16 里**（§0），所以是独立的 mode。
  // 旧版那里是 `qn.length > 0` 才**渲染**这颗按钮（不是点了才警告），这里同样并进守卫表。
  receipt: { kind: 'receipt', label: ' 编辑回执单 ', emptyText: '暂无收据单数据' },
}

/** 当前 mode 的编辑口径；`null` = 这个 mode 没有编辑按钮。 */
/**
 * 当前显示的模板 mode。
 *
 * 默认**跟着 `props.mode` 走**（Home 那边一直如此）；给了 `templates` 时，
 * 下拉可以把它切成别的模板。`props.mode` 一变就同步回来 —— 保证「父组件说了算」。
 */
const currentMode = ref(props.mode)
watch(
  () => props.mode,
  (m) => {
    if (m) currentMode.value = m
  },
)

const editSpec = computed<EditSpec | null>(() => EDIT_SPECS[currentMode.value] ?? null)

/** 弹窗标题 = 按钮文案去掉那对**旧版字符串表自带的**前后空格（旧版三个弹窗都没有 title，§10.5）。 */
const editTitle = computed(() => editSpec.value?.label.trim() || '编辑')

const editShow = ref(false)
/** 复制类那颗按钮的进行中态（旧版逐 `mode` 各有一个 ref：`Mi`/`Ei`/`vc`/`hc` 用 `wl`/`vl`/`wl`/`xl`；
 *  四档互斥，新版共用这一个）。文案一律「复制中...」（`dr[1194]`）。 */
const copying = ref(false)

// ------------------------------------------------- 显示金额 / 去除金额（旧版 `Zn`） //

/**
 * 旧版 `Zn`（`Vue.ref(!1)`）—— **已去除金额**态。置真只有 `Vr`（@355200）一处翻转；
 * 每次进 ic=5（`hi` @3664xx）都先 `Zn.value=!1` 复位，新版在下面 watch 里同样复位。
 */
const amountHidden = ref(false)

/** 这颗只在 `FinalReceipt`（= ic=5，见 §0）出现。 */
const canToggleAmount = computed(() => currentMode.value === 'FinalReceipt')

/**
 * 旧版 `Qn()`（@354822，逐字）：
 *
 * ```js
 * Zn.value
 *   ? jn.map(t => ({ ...t, total: 0, deposit: 0, balance: 0,
 *                    receipt: Array.isArray(t?.receipt)
 *                      ? t.receipt.map(e => ({ ...e, price: 0, amount: 0, pricing: '' }))
 *                      : t?.receipt }))
 *   : jn
 * ```
 *
 * ⚠️ 未去除时**原样返回**（不是浅拷贝）。
 * ⚠️ 只对**载荷**做变换，**不动** `built.header`/`built.rows` —— 旧版的 `jn`（编辑对象）也从没被
 *    `Qn()` 改过，编辑弹窗永远看到真金额；若把它一起归零，用户一编辑就会把 0 存回去。
 */
function applyAmountTransform(payload: PrintPayload): PrintPayload {
  if (!amountHidden.value || !Array.isArray(payload)) return payload
  return payload.map((t) => ({
    ...t,
    total: 0,
    deposit: 0,
    balance: 0,
    receipt: Array.isArray(t.receipt)
      ? (t.receipt as Record<string, unknown>[]).map((e) => ({ ...e, price: 0, amount: 0, pricing: '' }))
      : t.receipt,
  }))
}

/**
 * 旧版 `Vr`（@355200，逐字）：`Zn.value = !Zn.value` → `await Rn()`（重渲预览）→
 * `ElMessage.success(Zn ? '已去除金额字段' : '已恢复金额字段')`。
 * 注意提示语与**按钮文案的方向相反**：去除成功时按钮变成「显示金额」。
 */
async function toggleAmount(): Promise<void> {
  amountHidden.value = !amountHidden.value
  await render(currentMode.value, ++renderToken)
  message.success(amountHidden.value ? '已去除金额字段' : '已恢复金额字段')
}

// ------------------------------------------------------------ 复制类（四档互斥） //

/** 复制类按钮的口径。 */
interface CopySpec {
  /** 按钮文案（逐字，含旧版字符串表里的前后空格 / 直接用字面量的那几处）。 */
  label: string
  /** 成功提示（逐字）。 */
  done: string
  /** 预览为空时的错误提示（旧版 `Ei` 的 `dr[1171]`）。不给 = 静默返回（旧版 `Mi` 那条路的口径）。 */
  emptyText?: string
  /** 离屏截图参数 —— **逐条照旧版**，各 mode 的容器样式/scale/等字体/显式尺寸都不一样。 */
  options: OffscreenRenderOptions
}

/**
 * 四档复制口径（`mode` → 口径）。
 *
 * ⚠️ **有意偏离**（编号对应文件头那份清单）：
 *    · #2 **外观**：旧版这四颗的 `type` 都是 `success`（`dr[632]`）+ `round` + `size:"default"`
 *      （`Ei` 那颗甚至没写 `size`）。本弹窗统一 `size="small"`、不 `round`、只有打印类显色
 *      （与「编辑XX」同一处口径），这里沿用。行为（点了复制什么）完全一致。
 *    · #4 **失败提示**：旧版 `hc`/`Ei` 的 catch 是 `dr[752]`「复制失败，请重试」，
 *      `vc` 的 catch **连这句都没有**（只重渲了一遍预览 `yc()`）；新版四档统一提示，见 `doCopy`。
 *    · #5 **「标记已打印」未做**：旧版复制成功后还会顺手写「已打印单号」集合
 *      （`Ei`/`vc`/`hc` 尾部都调 `Kc`/`Hl`/`Gl`，`vc` 连 catch 分支里也写）。
 *      新版全仓没有这套数据结构，本轮不引入。
 *      TODO(未确认): `Kc`/`Hl`/`Gl` 三个函数分别写哪张表、`Hl` 的第二个参数（`Kt.value`）是什么，
 *        没有查 —— 落「标记已打印」时应先补这一步。
 */
const COPY_SPECS: Record<string, CopySpec> = {
  // 旧版 `Mi`（「查看回执单」那个弹窗上的那颗，`dr[1392]`）。沿用 `receiptImage.ts` 的收据族口径
  // （裸容器 + 不传 scale），与「回执单-其它」抽屉里那颗同源。
  receipt: {
    label: '复制回执单',
    done: '回执单图片已复制，可直接粘贴到微信',
    options: {},
  },
  // 旧版 `Ei` @375712（`al && !z` ≡ ic=6）。容器 **`width:1123px` + 背景白**，
  // `html2canvas({useCORS, scale:2, backgroundColor:'white'})`，**不等字体**。
  ReceiptList: {
    label: '复制成图片',
    done: '订单汇总图片已复制到剪切板！可直接粘贴',
    emptyText: '未找到订单汇总内容，请先生成订单汇总',
    options: { cssText: SUMMARY_COPY_CSS, scale: 2, backgroundColor: 'white' },
  },
  // 旧版 `vc` @424179（`lo && !z` ≡ ic=3）。容器 **`width:1200px` + 30px Arial + line-height 3.5**，
  // `await document.fonts.ready` 之后 `html2canvas({useCORS, scale:2})`。
  glassHole: {
    label: '复制玻璃单',
    done: '图片已复制到剪切板！可直接粘贴',
    options: { cssText: GLASS_COPY_CSS, scale: 2, awaitFonts: true },
  },
  // 旧版 `hc` @427351（`oo && !z` ≡ ic=5）。容器 **`width:auto; display:inline-block` + 同一组字体**，
  // 等字体之后 `html2canvas({useCORS, scale:2, width:scrollWidth, height:scrollHeight})`。
  FinalReceipt: {
    label: '复制收据单',
    done: '图片已复制到剪切板！可直接粘贴',
    options: { cssText: RECEIPT_COPY_CSS, scale: 2, awaitFonts: true, useElementScrollSize: true },
  },
}

const copySpec = computed<CopySpec | null>(() => COPY_SPECS[currentMode.value] ?? null)
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
  () => [props.show, currentMode.value] as const,
  async ([open, mode]) => {
    if (!open) return
    previewHtml.value = ''
    emptyHint.value = ''
    // 每次开 / 换 mode 都是新会话：上一轮的编辑结果作废（旧版每个入口 handler 都重算行）
    rowOverride.value = null
    headerOverride.value = null
    editRows.value = []
    editHeader.value = null
    // 进 ic=5 时旧版 `hi`（@3664xx）把 `Zn.value` 复位成 `!1` —— 每次进单据都回到「带金额」态。
    amountHidden.value = false
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
      prereqs = await loadPrintPrereqs(fullOrders.value, { autoLineNumbers: props.autoLineNumbers })
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
 *
 * ★ **「显示金额 / 去除金额」的变换也在这里统一套上**（`applyAmountTransform`）——
 *   旧版 `Qn()` 的 5 个真实调用点是 `Rn()`(预览) / `hc`(复制收据单) / `Zc`(云打印) /
 *   `Xc`(导出PDF) / `Qc`(手动打印)，**不是**只有那颗按钮/只有预览。新版把它收在这**唯一**一处：
 *   `render()` 与 `doPrint()` 都从这里拿载荷 ⇒ 预览与实打必然同一份；
 *   复制类走的是渲染好的 `previewHtml`，也必然是同一份。
 *   TODO(未确认): `导出PDF`(`Xc`) 新版**还没做**（§2.1，需显式声明 `jspdf`）；
 *     做的时候务必也从这里取载荷，别再套一次/漏套。
 *   ⚠️ 变换只作用于 `payload`，**不写回** `header`/`rows`（编辑对象必须保持真金额，见 `applyAmountTransform`）。
 */
async function buildPayloads(
  forPreview: boolean,
  mode0: string,
  overrideRows: Row[] | null = null,
  overrideHeader: Row | null = null,
): Promise<BuiltPrintPayload> {
  const templates = await api.getPrintTemplatesByMode(mode0)
  const tpl = templates[0]?.template
  if (!tpl) throw new Error(`未配置打印模板：${mode0}`)
  if (!prereqs) throw new Error('打印数据尚未就绪')
  const built = buildBatchPayload(
    fullOrders.value,
    prereqs,
    { tenantName: auth.tenant?.name || '', maker: auth.user?.name || '' },
    tpl,
    mode0,
    forPreview,
    overrideRows,
    overrideHeader,
  )
  return { ...built, payload: applyAmountTransform(built.payload) }
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
 * 复制类那颗按钮 —— 四档共用（`COPY_SPECS`）。把**当前预览整份**渲染成 PNG 进剪贴板。
 *
 * 与「回执单-其它」抽屉里那颗是同一个动作、同一份实现（`utils/receiptImage.ts`），
 * 只是入口与**离屏参数**不同（旧版这四处各写各的容器样式/scale，见 `COPY_SPECS`）。
 *
 * ⚠️ 四档都吃**渲染好的 `previewHtml`**，不重新拉模板 —— 旧版 `hc` 是就地再调一次
 * `commentPreview(FinalReceipt, Qn())`，内容与「刚重渲过的预览」逐字相同（同一个模板 + 同一份
 * `Qn()`），所以复用预览 HTML 等价；`Ei` 本来取的就是预览 HTML（`Wn`）。
 * `vc` 是拿 `commentPreview` 的返回**取 `[0]`**（只第一份）—— 见文件头「有意偏离」#6。
 */
async function doCopy(): Promise<void> {
  const spec = copySpec.value
  if (!spec) return
  if (!previewHtml.value) {
    // 按钮本身 `:disabled="!ready"`，这里是兜底（旧版 `Ei` 的守卫原文）
    if (spec.emptyText) message.error(spec.emptyText)
    return
  }
  copying.value = true
  try {
    await copyReceiptImage(previewHtml.value, spec.options)
    message.success(spec.done)
  } catch (e) {
    message.error('复制失败，请重试' + ((e as Error).message ? '：' + (e as Error).message : ''))
  } finally {
    copying.value = false
  }
}

async function doPrint() {
  if (!currentMode.value) return
  try {
    const { payload } = await buildPayloads(false, currentMode.value, rowOverride.value, headerOverride.value)
    await printByMode(currentMode.value, payload)
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
  await render(currentMode.value, token)
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
