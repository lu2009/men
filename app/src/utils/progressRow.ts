/**
 * Progress 订单进度页的**页面行**类型（2026-09-20 从 `Progress.vue` 搬出，纯搬迁）。
 *
 * 它原来住在 `Progress.vue` 的「壳区」（REF `f097a9b1`:**362**），**不属于任何一个搬迁块** ——
 * 这是本计划里**唯一一次「搬一个不属于任何块的声明」**。之所以要单独成一个文件：
 * `<script setup>` 里的 `type` 既搬不进别的 `.vue`、也 import 不进来，
 * 而它**有四个消费方、分属四处**：
 *   · **壳** —— `const rows = ref<ProgressRow[]>([])`（REF 364）。**仍留在页面里**，
 *     只是改成 `import type { ProgressRow } from '../utils/progressRow'`。
 *   · **P6** —— `filteredRows` 的 `computed`（REF **1250**）。**Task 7 才搬**。
 *   · **P8** —— `moreRows` 的声明（REF **1456**）与 `submitMore` 里的 `list`
 *     （REF **1541**）。**本任务搬**（`composables/progress/useProgressQueryMore.ts`）。
 *   · **P9** —— `printOrdersOf` 的形参（REF **1703**）。**本任务搬**
 *     （`composables/progress/useProgressPrint.ts`）。
 * ⇒ `export type` 一次、四处 `import type`，**不许任何一处再抄第二份**
 *   （两份同名定义会各自漂移 —— 这正是 memory `split-guard-blind-spots` 第 1 类）。
 *
 * 归属裁决（R35）：原计划两份 brief 都要求「从**新建的** `utils/progressRow.ts` import」，
 * 却没有任何任务的 `Files:` 行建它 ⇒ 归**第一个真正需要它的任务**（本任务 / Task 5）。
 * 若判错，回退办法是把 REF 362 那行留在壳里（代价是 P6/P8/P9 三个文件都 import 不到它）。
 *
 * 搬迁保真由 `docs/progress-extract-movecheck.mjs` 机核（本文件一条，参照 `f097a9b1`）。
 */
import type { ProgressRowDto } from '../api/types'

/**
 * 页面行 = 后端行 + 前端的**勾选态**。
 *
 * 旧版也是把 `isSelected` 直接挂在行对象上（`…map(e => ({...e, isSelected:!1, "生产进度": …}))`，
 * §3.1 末），勾选框就是 `modelValue: row.isSelected` —— 新版照同一套，不另开一张「已选 id」表。
 */
export type ProgressRow = ProgressRowDto & { isSelected: boolean }

