/**
 * 「排序方式」（生产类单据的行顺序）—— 2026-09-20 从 `Hui.vue` 搬出（逻辑逐字未改，C13）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）是**一段**：`Hui.vue:1919-1932`，段内 **5 个声明**：
 * `sortMethod` / `sortMethodOpen` / `sortMethodDraft` / `openSortMethod` / `saveSortMethod`。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C13 一条）。
 *
 * ## 注入面 = **1 项**
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `message` | 页面 `useMessage()` | 「排序方式已保存」 |
 *
 * `localStorage` 是全局 ⇒ 不进注入面（键名 `smartdoor_sort_method` 见下）。
 *
 * ## 🔴 回传面 = **5 项，一项都不能少** —— `sortMethod` 尤其（spec §3.3 点名的雷）
 *
 * | 名字 | 段外的活读者 |
 * |---|---|
 * | 🔴 `sortMethod` | **打印载荷构造** `sortMethod: sortMethod.value`（`:1775`）—— 生产类单据的行顺序就是按它选的 |
 * | `sortMethodOpen` | 模板 `:453`（`v-model:show`）· `:463`（**写**） |
 * | `sortMethodDraft` | 模板 `:455`（`v-model:value`） |
 * | `openSortMethod` | 模板 `:306` 的 `@click` |
 * | `saveSortMethod` | 模板 `:464` 的 `@click` |
 *
 * ⚠️ **只回传对话框那两件（`sortMethodOpen`/`saveSortMethod`）是不够的**：`sortMethod` 本身
 *    还被**打印载荷**读 ⇒ 少回传它 ⇒ 生成的单据行顺序**永远走默认**，而且**不报错**。
 * ⚠️ 初值是**即时求值**：`ref(localStorage.getItem('smartdoor_sort_method') || 'profile')`
 *    —— 在 setup 顶层读一次 localStorage。搬进 composable 后仍然只读一次（**别**改成 watch/监听，
 *    那是行为变化，属 spec §6.3 那一族）。
 * ⚠️ 落盘键名与取值都由旧版口径定死：`'profile' | 'order'`，写在 `smartdoor_sort_method`。
 */
import { ref } from 'vue'
import type { MessageApi } from 'naive-ui'

/** `useHuiSortMethod()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HuiSortMethodDeps {
  /** 页面 `useMessage()`。 */
  message: MessageApi
}

/** 「排序方式」：生效值 + 对话框草稿（打印载荷要读生效值）。 */
export function useHuiSortMethod(deps: HuiSortMethodDeps) {
  const sortMethod = ref(localStorage.getItem('smartdoor_sort_method') || 'profile')
  // 「排序方式」对话框（原版 `_0xff1972` 打开 / `_0x2a0b61` 保存）
  const sortMethodOpen = ref(false)
  const sortMethodDraft = ref(sortMethod.value)
  function openSortMethod() {
    sortMethodDraft.value = sortMethod.value
    sortMethodOpen.value = true
  }
  function saveSortMethod() {
    sortMethod.value = sortMethodDraft.value === 'order' ? 'order' : 'profile'
    localStorage.setItem('smartdoor_sort_method', sortMethod.value)
    sortMethodOpen.value = false
    deps.message.success('排序方式已保存')
  }
  return {
    // 5 项**全回传** —— `sortMethod` 那条最要紧：打印载荷要读它（少回传 ⇒ 行顺序永远走默认，且不报错）。
    sortMethod,
    sortMethodOpen,
    sortMethodDraft,
    openSortMethod,
    saveSortMethod,
  }
}
