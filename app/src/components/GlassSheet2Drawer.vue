<!--
  「自定义玻璃合片单」抽屉 —— 旧版 Home 上那一套（组件叫 `GlassSheet2PrintManager`，`ic=16`）。
  **本文件是薄包装**：整套外壳在共用的 `DocSheetDrawer.vue` 里，这里只递三样东西 ——
  本单据的组件层档案（`glassSheet2UiProfile.ts`）+ 两个设置弹窗的 GS2 包装组件。

  ⚠️ **对外 props 一个字都没变**（`show` / `orders` + `update:show`）—— Home 的接线不受影响
  （`Home.vue` 的 `openGlassSheet2` / `<GlassSheet2Drawer v-model:show :orders>`）。

  逆向定稿：`docs/custom-docs-recon/02-glasssheet2.md`（§11.3 Home 调用点 / §11.4 五颗工具条按钮 /
  §10 打印链路 / §15.6 三套弹窗的分工）。“三处有意的结构性差异”（不渲染预览进 Home、
  用 `DocEditDialog` 顶 `ProductionEdit`、去掉「直接打印」）现在写在共用组件的头注里 —— 两张单据同一条。

  **数据来源**：`profile.produceRows` = `printPayloads.ts` 的 `glassProduces()`（引擎 A）——
  旧版这份行数据来自 Hui 组件的 `calculateGlass()`（§2.1），新版从订单列表出发走同一套行构造，
  不重写数据层。⚠️ 与 PS2 的 `productionProduces()`（引擎 B）**不是同一套**，别换。
-->
<template>
  <DocSheetDrawer
    :show="show"
    :orders="orders"
    :profile="GLASSSHEET2_UI_PROFILE"
    :layout-dialog="GlassSheet2LayoutDialog"
    :settings-dialog="GlassSheet2SettingsDialog"
    @update:show="(v: boolean) => emit('update:show', v)"
  />
</template>

<script setup lang="ts">
import type { OrderDto } from '../api/types'
import DocSheetDrawer from './DocSheetDrawer.vue'
import GlassSheet2LayoutDialog from './GlassSheet2LayoutDialog.vue'
import GlassSheet2SettingsDialog from './GlassSheet2SettingsDialog.vue'
import { GLASSSHEET2_UI_PROFILE } from './glassSheet2UiProfile'

defineProps<{
  show: boolean
  /** 选中订单的**完整**明细（由调用方保证已 `getOrder`）。 */
  orders: OrderDto[]
}>()
const emit = defineEmits<{ 'update:show': [boolean] }>()
</script>
