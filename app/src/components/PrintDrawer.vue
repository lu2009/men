<!--
  「打印选项」抽屉 —— 旧版 Home 工具栏「打印选中订单」点开后那一片单据按钮。

  ★ **2026-09-18 结构对齐原版**：本抽屉**只列入口**，不渲染预览。
  原版是两层：

      工具栏「打印选中订单」→ 【本抽屉】（`size:350`，只有入口按钮）
        → 点入口 → 设 `ic` → 【打印预览弹窗】（`PrintPreviewDialog.vue`，预览 + 该单据的操作栏）

  新版先前把预览和「预览/打印」按钮也放在本抽屉里 —— 与原型不符，已拆开。

  入口分两类（见 `DocEntry`）：
    · `mode` = hiprint 模板 → 抛 `openMode`，Home 开 `PrintPreviewDialog`
    · `doc`  = 自绘单据（旧版 `ic=12–16`）→ 抛 `openDoc`，Home 开它自己的抽屉
      （那五张各有自己的组件与打印链路；旧版也是同一个预览弹窗按 `ic` 分支，
       新版保留各自的实现，因为它们本来就是「预览 + 工具栏」的形态）

  单据清单见 `docs/edit-dialog-recon/01-edit-table.md` §1、§2。
-->
<template>
  <n-drawer :show="show" :width="350" placement="right" @update:show="(v: boolean) => emit('update:show', v)">
    <n-drawer-content title="打印选项" closable>
      <div class="print-drawer">
        <div class="doc-hint">已选 {{ orders.length }} 张订单</div>

        <div v-for="g in DOC_GROUPS" :key="g.title" class="doc-group">
          <div class="doc-group-title">{{ g.title }}</div>
          <div class="doc-buttons">
            <n-button
              v-for="d in g.items"
              :key="d.mode ?? d.doc"
              size="small"
              :disabled="!orders.length"
              @click="d.doc ? openDoc(d.doc, d.entry) : openMode(d.mode as string, d.label)"
            >
              {{ d.label }}
            </n-button>
          </div>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { NButton, NDrawer, NDrawerContent } from 'naive-ui'

import type { OrderDto } from '../api/types'

defineProps<{
  show: boolean
  /**
   * 选中订单。本抽屉**不消费**它（不渲染预览），只用来①显示张数②没有选中时禁用入口按钮。
   * 真正的打印数据由目标（预览弹窗 / 各单据抽屉）自己按需拉取。
   */
  orders: OrderDto[]
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

/** 点 hiprint 模板入口 → 交给 Home 开预览弹窗（本抽屉不关自己，由 Home 决定）。 */
function openMode(mode: string, title: string) {
  emit('openMode', mode, title)
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
</style>
