<!--
  「自定义生产单」抽屉 —— 旧版 Home 上那一套（组件叫 `ProductionSheetPrintManager`，`ic=14`）。

  **本文件是薄包装**：整套外壳在共用的 `DocSheetDrawer.vue` 里，这里只递四样东西 ——
  本单据的组件层档案 + **三个**弹窗组件。

  ⚠️ **为什么 C 家族只递两个、这里要递三个**：ic=14 的「编辑XX」是旧版的**另一个组件**
  （`ProductionEditOld`，oldSheet 嵌套族 + 双联），与 `ProductionEdit`（平铺行）不是一回事
  （施工图 §6.5）。`DocSheetDrawer` 为此留了 `editDialog` 注入口 —— 方案选择与理由写在
  `ProductionSheetEditDialog.vue` 的文件头注里。

  ⚠️ **本组件尚未接进 Home**（Home 的 `ic=14` 分支还没做）—— 这次只交付组件层，接线是下一步。
  对外 props 与 C 家族侧**故意保持对称**（`show` / `orders` + `update:show`）。

  与本单据相关的三份逆向定稿：
    · `docs/custom-docs-recon/01-ps.md` —— 施工图（§3 布局编辑器 / §6.1 expose / §6.5 编辑弹窗）；
    · `docs/custom-docs-recon/ps-layout.css` —— B 家族编辑器的 11+2 条 CSS；
    · `docs/custom-docs-recon/ps-default.css` —— 产出 HTML 的 8 条 CSS（**核心层**的事）。

  **数据来源（本单据最要紧的一处）**：`profile.produceRows(ctx, config)` =
  `printPayloads.ts` 的 `oldSheetProduces(config.print.itemsPerPage === 2)`（§6.4 CONFIRMED），
  且 `rowsDependOnConfig: true` —— 改了「每页数据数」会重跑配对（决策 D2/D3）。
-->
<template>
  <DocSheetDrawer
    :show="show"
    :orders="orders"
    :profile="PRODUCTION_SHEET_UI_PROFILE"
    :layout-dialog="ProductionSheetLayoutDialog"
    :settings-dialog="ProductionSheetSettingsDialog"
    :edit-dialog="ProductionSheetEditDialog"
    @update:show="(v: boolean) => emit('update:show', v)"
  />
</template>

<script setup lang="ts">
import type { OrderDto } from '../api/types'
import DocSheetDrawer from './DocSheetDrawer.vue'
import ProductionSheetEditDialog from './ProductionSheetEditDialog.vue'
import ProductionSheetLayoutDialog from './ProductionSheetLayoutDialog.vue'
import ProductionSheetSettingsDialog from './ProductionSheetSettingsDialog.vue'
import { PRODUCTION_SHEET_UI_PROFILE } from './productionSheetUiProfile'

defineProps<{
  show: boolean
  /** 选中订单的**完整**明细（由调用方保证已 `getOrder`）。 */
  orders: OrderDto[]
}>()
const emit = defineEmits<{ 'update:show': [boolean] }>()
</script>
