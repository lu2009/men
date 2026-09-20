/**
 * 明细表的**勾选 / 批量删除** —— 2026-09-20 从 `Hui.vue` 搬出（逻辑逐字未改，C12）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）是**一段**：`Hui.vue:1587-1620`，段内 **3 个声明**：
 * `checkboxTick`(1587) / `selectedLines`(1590) / `batchDeleteRows`(1596)。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C12 一条）。
 *
 * ## 注入面 = **4 项**
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `lines` | **脊梁** `ref<Line[]>` | `selectedLines` 里 filter；`batchDeleteRows` 里原地重建 |
 * | `orderId` | **脊梁** `ref<number \| null>` | 删行前判「有单号才发 DELETE」 |
 * | `message` | 页面 `useMessage()` | 「请先勾选要删除的行」/「已删除选中行」 |
 * | `dialog` | 页面 `useDialog()` | 批量删除的二次确认 |
 *
 * `api`（`deleteOrderLine`）是**模块级导出** ⇒ 直接 `import`，**不进注入面**。
 *
 * ## 🔴 回传面 = **3 项，一项都不能少** —— 这段是 spec §3.3 点名的「引用同一性」失效点
 *
 * | 名字 | 段外的活读者 |
 * |---|---|
 * | 🔴 `checkboxTick` | `Hui.vue` 的 `detailHooks.onSelectChange`（**唯一的写入口**） |
 * | `selectedLines` | 模板 `:141` / `:158` 的 `:selected-count` |
 * | `batchDeleteRows` | 模板 `:145` / `:162` 的 `@batch-delete` |
 *
 * ### 为什么 `checkboxTick` 是这一块的**要害**（2026-09-20 特意留下这段说明）
 *
 * 勾选状态**不在本块里改** —— 是**组件通过页面级回调**改的：
 * `DetailLinesTable.vue` 勾一下 ⇒ 调 `props.hooks.onSelectChange()` ⇒ 页面把它接到
 * `detailHooks.onSelectChange = () => { checkboxTick.value++ }`（**两个表共用同一个计数器**，
 * 旧版也是）。`selectedLines` 里那句 `void checkboxTick.value` 就是为了**建立依赖**，
 * 让「`isSelected` 原地改了但数组引用没换」也能重算。
 *
 * ⇒ 于是有**两种**写法都能通过编译、都不报错，但只有一种是对的：
 *
 * | 写法 | 后果 |
 * |---|---|
 * | 页面 `const { checkboxTick, ... } = useHuiLineSelection(...)`，回调写**解构出来的**那个 | ✅ 回调与 `selectedLines` 是同一个 ref |
 * | 页面**另留一份** `const checkboxTick = ref(0)`（或回调写自己的局部 ref） | ❌ 计数涨在**另一份** ref 上，`selectedLines` **永不重算** ⇒ 勾选后「已选 N 行」与批量删除的按钮态**永远是 0/初始值**，**不报错、不抛异常** |
 *
 * ⚠️ 这一类**守卫验不了**（那是逐字文本比对）—— 所以本节把它写死在这里 + 页面侧也留了同款提示，
 *    改这一块的人**必须**同时看两处。
 * ⚠️ `checkboxTick` 的类型是 `Ref<number>`（不是 `ComputedRef`）：页面侧直接用 `checkboxTick.value++`。
 */
import { computed, ref, type Ref } from 'vue'
import type { DialogApi, MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { Line } from '../../utils/partsEngine'

/** `useHuiLineSelection()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HuiLineSelectionDeps {
  /** **脊梁**：明细行（`Hui.vue` 的 `lines`）—— 读 + 原地重建。 */
  lines: Ref<Line[]>
  /** **脊梁**：当前订单 id（`Hui.vue` 的 `orderId`）。 */
  orderId: Ref<number | null>
  /** 页面 `useMessage()`。 */
  message: MessageApi
  /** 页面 `useDialog()`。 */
  dialog: DialogApi
}

/** 明细表勾选（跨两表共用一个计数器）与批量删除。 */
export function useHuiLineSelection(deps: HuiLineSelectionDeps) {
  const checkboxTick = ref(0)

  const selectedLines = computed(() => {
    void checkboxTick.value
    return deps.lines.value.filter((l) => l.isSelected)
  })

  function batchDeleteRows() {
    const sel = selectedLines.value
    if (!sel.length) {
      deps.message.warning('请先勾选要删除的行')
      return
    }
    deps.dialog.warning({
      title: '批量删除',
      content: `确定删除选中的 ${sel.length} 行吗？`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        for (const l of sel) {
          if (deps.orderId.value != null && l.id != null) {
            try {
              await api.deleteOrderLine(deps.orderId.value, l.id)
            } catch {
              // 单行删除失败继续
            }
          }
          deps.lines.value = deps.lines.value.filter((x) => x !== l)
        }
        deps.message.success('已删除选中行')
      },
    })
  }

  return {
    // 3 项全回传 —— `checkboxTick` 那条最要紧（唯一的写入口在页面的 `detailHooks.onSelectChange`）。
    checkboxTick,
    selectedLines,
    batchDeleteRows,
  }
}
