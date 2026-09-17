<!--
  「自定义生产单2 - 布局编辑」全屏弹窗 —— **薄包装**。
  旧版 `ProductionSheet2PrintManager.openLayoutEditor`（PS2:814-824 打开流程 + PS2:1394-1878 模板）。

  整套外壳在共用的 `DocSheetLayoutDialog.vue` 里，这里只递 PS2 的组件层档案。

  ⚠️ 与 GS2 的**唯一**差异是标题（`自定义生产单2 - 布局编辑`，PS2:1400）与前缀
  （`ps2-layout-*` / `ps2-column-order`）—— 左栏控件、`el-input-number` 的 min/max/step、
  常用尺寸预设、排序上下箭头**逐字相同**（§10 CONFIRMED）。

  ⚠️ `show` 是 prop（不可写），所以不能用 `v-model:show` —— 显式往两头转（props 进、emit 出）。
-->
<template>
  <DocSheetLayoutDialog
    :show="show"
    :config="config"
    :rows="rows"
    :profile="PRODUCTIONSHEET2_UI_PROFILE"
    @update:show="(v: boolean) => emit('update:show', v)"
    @saved="() => emit('saved')"
  />
</template>

<script setup lang="ts">
import type { DocSheetConfig, DocSheetRow } from '../utils/docsheet/types'
import DocSheetLayoutDialog from './DocSheetLayoutDialog.vue'
import { PRODUCTIONSHEET2_UI_PROFILE } from './productionSheet2UiProfile'

defineProps<{
  show: boolean
  /** 已生效的配置（父组件持有）。弹窗只读它，**打开时**深拷贝一份当草稿。 */
  config: DocSheetConfig
  /** 预览行数据 —— 旧版 `d`（`openLayoutEditor` 里每次重新取 `props.getData()`，PS2:818-819）。 */
  rows: DocSheetRow[]
}>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'saved'): void
}>()
</script>
