<!--
  「自定义合格标签族」抽屉 —— 旧版 Home 上那一套（组件叫 `QualifiedLabelPrintManager`，`ic=13`）。
  **本文件是薄包装**：整套外壳在共用的 `DocSheetDrawer.vue` 里，这里只递四样东西 ——
  本单据的组件层档案（`qualifiedLabelUiProfile.ts`）+ 两个设置弹窗 + 一个行数据弹窗。

  ★★ **本单据最要紧的特性：三个入口共用同一个实现**（施工图 §6.1，CONFIRMED）。
  旧版三个入口（`自定义合格标签` / `平开合格标签` / `推拉合格标签`）打开的是**同一个组件实例**，
  差别**只有喂给 `lable()` 的参数**：
  | 入口 | 旧版调用 | 本组件的 `entry` |
  |---|---|---|
  | 自定义合格标签 | `lable()`（默认 `{ping:true,diao:true}`） | `'all'` |
  | 平开合格标签   | `lable({ping:!0,diao:!1})` | `'ping'` |
  | 推拉合格标签   | `lable({ping:!1,diao:!0})` | `'diao'` |
  ⇒ **不要**把它做成三个组件（施工图 §6.1 已证组件无感：props 里没有 `mode`/`kind`/`ic`，
  全文 grep `ping`/`diao`/`平开`/`推拉` **零命中**，两个弹窗标题与文档 `<title>` 恒为常量）。
  版式、标题、输出格式三入口完全一致。

  ⚠️ **过滤落在档案里、不在 `printPayloads.ts`** ——施工图 §10.1 D1 推荐给 `labelRows` 加
  `opts?: {ping, diao}`，但那要改 `app/src/utils/`（本次任务的硬边界），而 `produceRows(ctx)`
  拿到的 `ctx` 本就是可自由裁剪的普通对象 ⇒ 在档案里换掉 `ctx.lines` 再构造 payloads，
  与「给 `labelRows` 加参数」逐条等价。详见 `qualifiedLabelUiProfile.ts` 的文件头注。

  **数据来源**：`printPayloads.ts` 的 `labelRows('lable')`（§9 逐键核对 CONFIRMED：
  11 个 field key 全部命中，含 `remark` 的 `<br>` 语义 —— 本单**不解释 `<br>`**，会逐字显示），
  再按**固定张数**补齐 —— 两者都在 `profile.produceRows` 里（见 `qualifiedLabelUiProfile.ts`）。
  固定张数的两个键由**设置弹窗**写，档案里的 `rowsDependOnConfig: true` 保证保存后抽屉会重跑一次
  行构造（= 旧版 `onFixedQuantityChange` → `Cc = Cr(zc)` 那条链）。
-->
<template>
  <DocSheetDrawer
    :show="show"
    :orders="orders"
    :profile="uiProfile"
    :layout-dialog="QualifiedLabelLayoutDialog"
    :settings-dialog="QualifiedLabelSettingsDialog"
    :edit-dialog="QualifiedLabelEditDialog"
    @update:show="(v: boolean) => emit('update:show', v)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { OrderDto } from '../api/types'
import DocSheetDrawer from './DocSheetDrawer.vue'
import QualifiedLabelEditDialog from './QualifiedLabelEditDialog.vue'
import QualifiedLabelLayoutDialog from './QualifiedLabelLayoutDialog.vue'
import QualifiedLabelSettingsDialog from './QualifiedLabelSettingsDialog.vue'
import { createQualifiedLabelUiProfile, type QualifiedLabelEntry } from './qualifiedLabelUiProfile'

const props = withDefaults(
  defineProps<{
    show: boolean
    /** 选中订单的**完整**明细（由调用方保证已 `getOrder`）。 */
    orders: OrderDto[]
    /**
     * **入口**（三个按钮的唯一差别）—— 决定行集合，其余一切相同（见文件头注的对照表）。
     * 缺省 `'all'` = 旧版不传参的 `lable()`。
     */
    entry?: QualifiedLabelEntry
  }>(),
  { entry: 'all' },
)
const emit = defineEmits<{ 'update:show': [boolean] }>()

/**
 * 组件层档案（**按入口造**）。
 *
 * ⚠️ 用 `computed` 而不是在 setup 里算一次：`entry` 会随 Home 的按钮变化
 * （同一个抽屉实例被三个入口复用），档案里的 `produceRows` 必须跟着变。
 * `computed` 对同一个 `entry` 值是缓存的，所以不会每次渲染都造新对象。
 * ⚠️ 抽屉重建行的时机是**它自己的 `show` watcher**（`false → true`），而 Home 侧
 * 「设 `entry`」与「设 `show = true`」在**同一个 tick** 里发生 ⇒ watcher 跑时档案已是新的。
 *
 * TODO(未确认): 若将来出现「抽屉**已经开着**时直接切入口」的用法（当前 UI 走不到：
 * 抽屉遮住右侧、三个入口都要先勾选订单），`DocSheetDrawer` 不会自动重建行 ——
 * 届时需要给它加一个「档案变了就重建」的 watcher（属它的事，不在本次范围）。
 */
const uiProfile = computed(() => createQualifiedLabelUiProfile(props.entry))
</script>
