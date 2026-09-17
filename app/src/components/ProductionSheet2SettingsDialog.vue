<!--
  「自定义生产单2 - 打印设置」弹窗 —— **薄包装**。
  旧版 `ProductionSheet2PrintManager.openSettingsDialog`（PS2:807-813 打开流程 + PS2:1128-1392 模板）。

  整套外壳在共用的 `DocSheetSettingsDialog.vue` 里，这里只递 PS2 的组件层档案。

  ⚠️ 与 GS2 的**唯一**差异是标题（`自定义生产单2 - 打印设置`，PS2:946）与前缀
  （`ps2-settings-presets` / `ps2-settings-footer`）—— 两页控件、常用尺寸 3 个预设、
  `orientation` 那个无消费者的下拉**逐字相同**（§10 CONFIRMED）。

  ⚠️ `show` 是 prop（不可写），所以不能用 `v-model:show` —— 显式往两头转（props 进、emit 出）。
-->
<template>
  <DocSheetSettingsDialog
    :show="show"
    :config="config"
    :profile="PRODUCTIONSHEET2_UI_PROFILE"
    @update:show="(v: boolean) => emit('update:show', v)"
    @saved="() => emit('saved')"
  />
</template>

<script setup lang="ts">
import type { DocSheetConfig } from '../utils/docsheet/types'
import DocSheetSettingsDialog from './DocSheetSettingsDialog.vue'
import { PRODUCTIONSHEET2_UI_PROFILE } from './productionSheet2UiProfile'

defineProps<{
  show: boolean
  /** 已生效的配置（父组件持有）。弹窗只读它，**打开时**深拷贝一份当草稿。 */
  config: DocSheetConfig
}>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'saved'): void
}>()
</script>
