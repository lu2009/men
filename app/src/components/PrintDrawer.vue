<!--
  「打印选项」抽屉 —— 旧版 Home 工具栏「打印选中订单」点开后那一片单据按钮。

  ★ **2026-09-18 结构对齐原版**：本抽屉**只列入口**，不渲染预览。
  原版是两层：

      工具栏「打印选中订单」→ 【本抽屉】（`size:350`，只有入口按钮）
        → 点入口 → 设 `ic` → 【打印预览弹窗】（`PrintPreviewDialog.vue`，预览 + 该单据的操作栏）

  新版先前把预览和「预览/打印」按钮也放在本抽屉里 —— 与原型不符，已拆开。

  入口分三类：
    · `mode` = hiprint 模板 → 抛 `openMode`，Home 开 `PrintPreviewDialog`
    · `doc`  = 自绘单据（旧版 `ic=12–16`）→ 抛 `openDoc`，Home 开它自己的抽屉
      （那五张各有自己的组件与打印链路；旧版也是同一个预览弹窗按 `ic` 分支，
       新版保留各自的实现，因为它们本来就是「预览 + 工具栏」的形态）
    · 顶部那组「查看回执单 / 回执单-其它」（旧版 `ki` / `Nn`）→ 前者实质是 `mode:'receipt'`
      的预览（走 `openMode`），后者抛 `openReceiptOther`，Home 开 `ReceiptOtherDialog`
      （**2026-09-18 补**：旧版这两颗在抽屉最上面，本文件先前整块没有）

  单据清单见 `docs/edit-dialog-recon/01-edit-table.md` §1、§2。

  ★ **2026-09-19 加了 `preset`**：生产进度页（`/Progress`）旧版**也有**这颗「打印选项」，
  但它抽屉里是**另一份清单**（12 类，见 `PROGRESS_ITEMS`），且**没有**顶部那两颗回执单按钮、
  也**没有**「自定义单据」分组。旧版两页的抽屉本来就是两种内容（Home 24 个入口 / Progress 12 个），
  所以做成**同一组件的两个 preset**，而不是在页面里再抄一份抽屉。
  `preset` 不传 = `'home'` ⇒ 本文件对 Home 的行为**一个字节都没变**。
-->
<template>
  <n-drawer :show="show" :width="350" placement="right" @update:show="(v: boolean) => emit('update:show', v)">
    <n-drawer-content title="打印选项" closable>
      <div class="print-drawer">
        <div class="doc-hint">已选 {{ orders.length }} 张订单</div>

        <!--
          抽屉**最上面**那一组（旧版渲染函数 `:11868-11873`，容器 `div.drawer-content`）：

            [ 查看回执单 ]  `ki`  :9103
            [ 回执单-其它 ] `Nn`  :8184 → 开第二层嵌套抽屉（`ReceiptOtherDialog.vue`）

          旧版两颗都是 `type:"primary"`、`size` 用默认值。这里沿用本抽屉既有的 `size="small"` 口径
          （与下方 24 个单据入口一致；不为一排按钮单独换字号属**观感口径统一**，行为一致）。

          ⚠️ 旧版 `ki` 打开的是**它自己的**预览弹窗（`Ai`，宽 1180px，工具条 = 关闭/打印/手动打印/
          编辑回执单/复制回执单），不是 24 个入口用的那个按 `ic` 分支的弹窗。新版这两条路
          (`ki` 与 `openMode`) 落到同一个 `PrintPreviewDialog` —— 模板、数据形状、编辑入口都相同，
          差别只有工具条上那颗「复制回执单」（新版由「回执单-其它」抽屉提供，见 `ReceiptOtherDialog.vue`）。
        -->
        <!-- ⚠️ 这一组只有 Home 的 preset 有（旧版 Progress 的抽屉里没有，见文件头） -->
        <div v-if="showTopActions" class="doc-buttons">
          <n-button
            size="small"
            type="primary"
            :disabled="!orders.length"
            @click="openReceiptPreview"
          >
            查看回执单
          </n-button>
          <n-button
            size="small"
            type="primary"
            :disabled="!orders.length"
            @click="openReceiptOther"
          >
            回执单-其它
          </n-button>
        </div>

        <!-- `g.title` 可缺省（Progress 那份是**一整排没有分组标题**的按钮，与旧版一致） -->
        <div v-for="(g, gi) in sections" :key="gi" class="doc-group">
          <div v-if="g.title" class="doc-group-title">{{ g.title }}</div>
          <div class="doc-buttons">
            <template v-for="d in g.items" :key="d.mode ?? d.doc">
              <!--
                本版还没有对应能力的入口（见 `PROGRESS_ITEMS` 里那两颗）：**置灰 + 悬停给提示**，
                不做死链。⚠️ 外层这个 `span` 是必需的：`<button disabled>` 在 Chrome 里不派发 click、
                也收不到 hover，得靠 `pointer-events:none` 把命中测试让给 span
                （同一套机制：`Qrscanner.vue` 的 `.pending-slot`）。
              -->
              <n-tooltip v-if="d.disabled">
                <template #trigger>
                  <span class="doc-pending">
                    <n-button size="small" disabled>{{ d.label }}</n-button>
                  </span>
                </template>
                {{ d.hint }}
              </n-tooltip>
              <n-button
                v-else
                size="small"
                :type="d.type ?? 'default'"
                :disabled="!orders.length"
                @click="d.doc ? openDoc(d.doc, d.entry) : openMode(d.mode as string, d.label)"
              >
                {{ d.label }}
              </n-button>
            </template>
          </div>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NDrawer, NDrawerContent, NTooltip } from 'naive-ui'

import type { OrderDto } from '../api/types'

const props = defineProps<{
  show: boolean
  /**
   * 选中订单。本抽屉**不消费**它（不渲染预览），只用来①显示张数②没有选中时禁用入口按钮。
   * 真正的打印数据由目标（预览弹窗 / 各单据抽屉）自己按需拉取。
   */
  orders: OrderDto[]
  /**
   * 用哪一份单据清单（见文件头 ★ 段）。
   * · 不传 / `'home'` = 订单管理页那套（24 个入口 + 顶部两颗回执单按钮 + 自定义单据分组）；
   * · `'progress'` = 生产进度页那套（旧版抽屉里那 **12 类**，无分组标题、无顶部按钮）。
   */
  preset?: 'home' | 'progress'
}>()

const emit = defineEmits<{
  'update:show': [boolean]
  /** 点了 hiprint 模板 → Home 开预览弹窗。`title` 用于弹窗标题。 */
  openMode: [mode: string, title: string]
  /**
   * 点了**自绘单据**的入口（旧版 `ic=12–16`）。
   * `entry` 只有合格标签族用（`'all' | 'ping' | 'diao'`，三个入口共用一张单据）。
   */
  openDoc: [doc: string, entry?: string]
  /**
   * 点了顶部那颗「回执单-其它」（旧版 `Nn`，:8184）—— Home 开 `ReceiptOtherDialog`。
   *
   * ⚠️ 旧版是**嵌套**抽屉（外层「打印选项」不关，内层直接叠上去）；新版由 Home 关掉本抽屉再开，
   * 与本文件的 `onOpenDoc` 同一个口径（两层 `n-drawer` 都从右侧出会互相压）。
   */
  openReceiptOther: []
}>()

/**
 * 单据按钮的一项。`mode` 与 `doc` **二选一**：
 * · `mode` = hiprint 模板（17 张之一）→ 抛 `openMode`；
 * · `doc`  = 自绘单据（旧版 `ic=12–16`）→ 抛 `openDoc`。
 */
interface DocEntry {
  label: string
  /** hiprint 模板 mode（与 `doc` 二选一） */
  mode?: string
  /** 自绘单据 key（与 `mode` 二选一） */
  doc?: string
  /** 只有合格标签族用：`'all' | 'ping' | 'diao'`（三个入口共用一张单据） */
  entry?: string
  /**
   * 按钮语义色。不传 = naive 默认灰（Home 那套就是这个口径，**别改**）。
   * Progress 那套照旧版：11 颗 `success` + 「收据单」一颗 `primary`。
   */
  type?: 'default' | 'primary' | 'success'
  /**
   * 本版还没有对应能力的入口 —— 恒置灰，鼠标悬停出 `hint`。
   * ⚠️ 它与「没勾选」那种置灰**不是一回事**：那种由 `!orders.length` 控制，勾选后自动可点。
   */
  disabled?: boolean
  /** `disabled` 时悬停显示的说明（**给厂里用人看的**，别塞文档记号）。 */
  hint?: string
}

/** 抽屉的一段。`title` 缺省 = 不画分组标题（Progress 那套就是平铺一排）。 */
interface DocSection {
  title?: string
  items: DocEntry[]
}

/**
 * 单据清单 = 后端 `print_templates` 的 17 张 + 5 张自绘单据，按用途分组。
 * 标签里写死 mode（而不去后端拉列表）是**有意**的：分组与中文名是产品语义，
 * 后端只有 mode/name；拉列表再分组反而多一次请求、还得分派。
 */
const HOME_SECTIONS: DocSection[] = [
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
      // ⚠️ 这里**没有** `receipt`（客户回执单）—— 它与抽屉顶部那颗「查看回执单」开的是
      // 同一个模板（旧版 `ki` 与本组入口落到同一个弹窗），**重复**，按用户要求移除。
      // 要打客户回执单走顶部那颗。
      { mode: 'FinalReceipt', label: '收据单' },
      { mode: 'ReceiptList', label: '出货清单' },
    ],
  },
  /**
   * **自绘单据**（旧版 Home 抽屉里的 `自定义单据：` 分组，`dr[972]`）。
   *
   * ⚠️ 它们**不是 hiprint 模板**（旧版 `ic=12–16`），各有自己的抽屉组件与打印链路。
   *
   * 合格标签族三个入口**共用同一个抽屉**（旧版同一个组件、同一个 `ic`，只差数据过滤，
   * 已由施工图 §6.1 证实组件对入口完全无感）。
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
 * **生产进度页（`/Progress`）的抽屉清单** —— 旧版那 12 类，**顺序、文案、按钮色**逐字照抄。
 *
 * 证据：`legacy/js/Progress-fb4def35.js` 反混淆后，抽屉 `zl`（`el-drawer` `title:"打印选项"`
 * `size:350`）的那一排 `el-button`，逐颗解出来的文案与 `onClick`：
 *
 * ```
 *   标签 / 生产标签 / 料标签 / 生产单 / 生产单定制 / 生产单定制(竖版) /
 *   玻璃合片单 / 玻璃订单 / 平开门生产单 / 移门生产单 / 平开门生产单(定制) / 收据单
 * ```
 * 前 11 颗 `type:"success"`、第 12 颗（收据单）`type:"primary"`；**全部**受
 * `ping_hui.length + diao_hui.length === 0` 置灰（= 没勾选就不给点），有勾选时文案后还缀
 * ` (n)`（见下「有意偏离」第 3 条）。
 *
 * ★ **mode 是怎么定的**（不是按按钮名猜的 —— 逐颗追它 `commentPreview` 用的模板键）：
 *
 * | 旧版按钮 | 旧版 `ic` / 模板键 | 新版 mode | 依据 |
 * |---|---|---|---|
 * | 标签 | `4` / `template.lable` | `lable` | `Ca` 里 `template.lable` |
 * | 生产标签 | `10` / `template.product10` | `product10` | `Pa` |
 * | 料标签 | `11` / `template.product4` | `product4` | `La`（⚠️ 就是「切料标签」那张模板） |
 * | 生产单 | `2` / `template.product` | `product` | `Ba`（`calculateReceipt{ping,diao}`） |
 * | 生产单定制 | `8` / `template.product2` | `product2` | `xa`（`calculateReceiptOld`） |
 * | 生产单定制(竖版) | `9` / `template.product3` | `product3` | `ba` |
 * | 玻璃合片单 | `1` / `template.glass` | `glass` | `Ma`（`calculateGlass`） |
 * | 玻璃订单 | `3` / `template.glassHole` | `glassHole` | `ka`（`Glasslist`） |
 * | 平开门生产单 | `2` / `template.product` | — **置灰** | `Aa`：`{ping:true,diao:false,single:true}` |
 * | 移门生产单 | `2` / `template.product` | — **置灰** | `Da`：`{ping:false,diao:true,single:true}` |
 * | 平开门生产单(定制) | `7` / `template.product1` | `product1` | `Ia`（`calculateReceiptForCustomed`） |
 * | 收据单 | `5` / 回执族 | `FinalReceipt` | `So`（`pl=5`） |
 *
 * ★ **有意偏离**（逐条给理由）：
 *
 * 1. **「平开门生产单」「移门生产单」置灰**。它们与「生产单」**同一个模板**（`product`），
 *    差别只在喂进去的行：旧版走 `calculateReceipt({ping:true,diao:false,single:true})` ——
 *    「只留平开（或只留移门）的行」+ `single:true`（一行一页的单独分页）。新版 `printPayloads`
 *    是**订单级**构造（`showPing`/`showDiao` 恒 true、没有 `single` 这个分页概念，
 *    见 `useOrderPrint.buildOrderPrintContext`）⇒ 现在做这颗只能做出「与生产单完全一样」的假货。
 *    **故置灰**，不假装能做。要做需要先给载荷层补「按行类型出单 + 单行分页」两件事。
 * 2. **没有「自定义单据」那一组**：旧版 Progress 的抽屉里就**没有**（两边抽屉内容本来就不同）。
 * 3. **按钮上不缀 ` (n)`**：旧版每颗按钮后跟已选条数。新版抽屉顶部统一显示「已选 N 张订单」
 *    （Home 那套一直如此），不在一排按钮里逐颗重复同一个数。
 * 4. **顶部两颗回执单按钮不出现**：旧版 Progress 抽屉里没有它们（同上第 2 条）。
 */
const PROGRESS_ITEMS: DocEntry[] = [
  { mode: 'lable', label: '标签', type: 'success' },
  { mode: 'product10', label: '生产标签', type: 'success' },
  { mode: 'product4', label: '料标签', type: 'success' },
  { mode: 'product', label: '生产单', type: 'success' },
  { mode: 'product2', label: '生产单定制', type: 'success' },
  { mode: 'product3', label: '生产单定制(竖版)', type: 'success' },
  { mode: 'glass', label: '玻璃合片单', type: 'success' },
  { mode: 'glassHole', label: '玻璃订单', type: 'success' },
  {
    label: '平开门生产单',
    disabled: true,
    hint: '本版还没做：这张单要「只取平开的门、一扇一页」，现在做出来会和生产单一样',
  },
  {
    label: '移门生产单',
    disabled: true,
    hint: '本版还没做：这张单要「只取移门、一扇一页」，现在做出来会和生产单一样',
  },
  { mode: 'product1', label: '平开门生产单(定制)', type: 'success' },
  { mode: 'FinalReceipt', label: '收据单', type: 'primary' },
]

/** 当前 preset 要渲染的段落。不传 / `'home'` ⇒ Home 那份（与加 preset 之前逐字节相同）。 */
const sections = computed<DocSection[]>(() =>
  props.preset === 'progress' ? [{ items: PROGRESS_ITEMS }] : HOME_SECTIONS,
)

/** 顶部那两颗回执单按钮只有 Home 的 preset 有（见 `PROGRESS_ITEMS` 注释第 4 条）。 */
const showTopActions = computed(() => props.preset !== 'progress')

/** 点 hiprint 模板入口 → 交给 Home 开预览弹窗（本抽屉不关自己，由 Home 决定）。 */
function openMode(mode: string, title: string) {
  emit('openMode', mode, title)
}

/**
 * 「查看回执单」（旧版 `ki`）—— 实质就是**用回执模板开预览**，
 * 所以直接复用 `openMode` 那条路（mode = `receipt`，与「收据类」分组里那张同一个模板）。
 * 标题取**单据名**「客户回执单」，别写「查看回执单」—— 那是按钮名，不是单据名。
 * （该模板原先在「收据类」分组里也有一颗，2026-09-18 因与本颗重复而移除，所以这里写死。）
 */
function openReceiptPreview() {
  openMode('receipt', '客户回执单')
}

/** 「回执单-其它」（旧版 `Nn`）→ 交给 Home 开 `ReceiptOtherDialog`。 */
function openReceiptOther() {
  emit('openReceiptOther')
}

/** 点自绘单据入口 → 交给 Home 开对应的抽屉。 */
function openDoc(doc: string, entry?: string) {
  emit('openDoc', doc, entry)
}
</script>

<style scoped>
.print-drawer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.doc-hint {
  font-size: 13px;
  color: #666;
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
/*
 * 「本版还没做」的入口外层容器（见模板里那段注释）：
 * 里面那颗 button 是 `disabled` 的，Chrome 既不派发 click 也收不到 hover ⇒ 用
 * `pointer-events:none` 把它从命中测试里摘出去，事件与 `title` 提示都落到这个 span 上。
 * （与 `Qrscanner.vue` 的 `.pending-slot` 同一套机制，只是这里要的是 hover 而不是 click。）
 */
.doc-pending {
  display: inline-flex;
  cursor: not-allowed;
}
.doc-pending :deep(button) {
  pointer-events: none;
}
</style>
