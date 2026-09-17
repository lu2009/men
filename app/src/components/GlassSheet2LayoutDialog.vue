<!--
  「自定义玻璃合片单 - 布局编辑」全屏弹窗 —— **薄包装**。
  旧版 `GlassSheet2PrintManager.openLayoutEditor`（GS:788-798 打开流程 + GS:1371-1852 模板）。

  整套外壳（左栏控件 / 右栏实时预览 / 草稿-生效成对 / 8 条 `gs2-layout-*` CSS）都在共用的
  `DocSheetLayoutDialog.vue` 里，这里只递 GS2 的组件层档案。

  逆向定稿：`docs/custom-docs-recon/02-glasssheet2.md` §7（§7.1 打开 / §7.2 骨架 /
  §7.3 控件全清单 / §7.4 右侧预览）。

  ⚠️ 它改的是**版式**，存在 `glass_sheet2_template_v1`，跨会话生效；与「打印设置」弹窗
  **共用同一个 localStorage 键**（§6.3）—— 两者可以同时开着，谁后保存谁生效（照抄旧版）。

  ⚠️ `show` 是 prop（不可写），所以不能用 `v-model:show` —— 显式往两头转（props 进、emit 出）。
-->
<template>
  <DocSheetLayoutDialog
    :show="show"
    :config="config"
    :rows="rows"
    :profile="GLASSSHEET2_UI_PROFILE"
    @update:show="(v: boolean) => emit('update:show', v)"
    @saved="() => emit('saved')"
  />
</template>

<script setup lang="ts">
import type { DocSheetConfig, DocSheetRow } from '../utils/docsheet/types'
import DocSheetLayoutDialog from './DocSheetLayoutDialog.vue'
import { GLASSSHEET2_UI_PROFILE } from './glassSheet2UiProfile'

defineProps<{
  show: boolean
  /** 已生效的配置（父组件持有）。弹窗只读它，**打开时**深拷贝一份当草稿。 */
  config: DocSheetConfig
  /** 预览行数据 —— 旧版 `d`（`openLayoutEditor` 里每次重新取 `props.getData()`，GS:792-793）。 */
  rows: DocSheetRow[]
}>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'saved'): void
}>()
</script>
