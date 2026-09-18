<!--
  「自定义生产单2」抽屉 —— 旧版 Home 上那一套（组件叫 `ProductionSheet2PrintManager`，`ic=15`）。
  **本文件是薄包装**：整套外壳在共用的 `DocSheetDialog.vue` 里，这里只递三样东西 ——
  本单据的组件层档案（`productionSheet2UiProfile.ts`）+ 两个设置弹窗的 PS2 包装组件。

  ⚠️ **本组件尚未接进 Home**（Home 的 `ic=15` 分支还没做）—— 这次只交付组件层，
  接线是下一步。对外 props 与 GS2 侧**故意保持对称**（`show` / `orders` + `update:show`），
  将来 Home 侧照 `openGlassSheet2` 再来一遍即可。

  逆向定稿：`docs/custom-docs-recon/01-diff.md`（施工图）。与 GS2 的三处结构性差异
  （不渲染预览进 Home、用 `DocEditDialog` 顶 `ProductionEdit`、去掉「直接打印」）**完全同一条**，
  已写在共用组件头注里；本单据的差异只有 4 个字面量 + 类名前缀 + **行来源**。

  **数据来源（本单据最要紧的一处）**：`profile.produceRows` =
  `printPayloads.ts` 的 `productionProduces()`（引擎 B）= 旧版 `calculateReceipt(
  {ping:!0,diao:!0,single:!1,singleRowData:null})` 那条口径（§7.2 CONFIRMED，键名已核实
  全覆盖 PS2 要的 9 个字段）。⚠️ 与 GS2 的 `glassProduces()`（引擎 A）不是同一套 ——
  后者的 `doorframe`/`windows` 恒为 `""`（§7.3），换过去会让「外框」「亮窗/扣板」两列整片塌掉。
-->
<template>
  <DocSheetDialog
    :show="show"
    :orders="orders"
    width="95%"
    :profile="PRODUCTIONSHEET2_UI_PROFILE"
    :layout-dialog="ProductionSheet2LayoutDialog"
    :settings-dialog="ProductionSheet2SettingsDialog"
    @update:show="(v: boolean) => emit('update:show', v)"
  />
</template>

<script setup lang="ts">
import type { OrderDto } from '../api/types'
import DocSheetDialog from './DocSheetDialog.vue'
import ProductionSheet2LayoutDialog from './ProductionSheet2LayoutDialog.vue'
import ProductionSheet2SettingsDialog from './ProductionSheet2SettingsDialog.vue'
import { PRODUCTIONSHEET2_UI_PROFILE } from './productionSheet2UiProfile'

defineProps<{
  show: boolean
  /** 选中订单的**完整**明细（由调用方保证已 `getOrder`）。 */
  orders: OrderDto[]
}>()
const emit = defineEmits<{ 'update:show': [boolean] }>()
</script>
