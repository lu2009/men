/**
 * 「加价项目管理」（旧版主页三个弹窗：管理 → 新增 / 修改删除）—— 2026-09-20 从 `Hui.vue` 搬出
 * （逻辑逐字未改，C1）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）是**一段**：
 *   · `Hui.vue:1108-1224` —— 分区注释 + 三个开关 ref + 两个草稿 + 8 个函数 + `markupEditOptions`，
 *     段内合计 **13 个声明**（与 spec §3.3 的 C1 对得上）。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C1 一条：13 个声明逐字一致）。
 *
 * ## 注入面 = **2 项**（本块很薄）
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `message` | 页面 `useMessage()` | 各处的成功/失败/警告提示 |
 * | `dialog` | 页面 `useDialog()` | 删除前的二次确认 |
 *
 * ⚠️ **`markupCatalog` 家族不注入 —— 直接 `import`**：它们在
 *    `composables/useMarkupCatalog.ts` 里是**模块级导出**（`export const markupCatalog = ref(…)`
 *    + 四个模块级函数）⇒ 全应用天然同一份，本块再 import 一次**不会**多出第二个实例。
 *    （spec §3.3 判 C1「风险低」，理由正是这条 —— `markupCatalog` 家族本来就是模块单例。）
 *
 * ## 回传面 = 13 项，**全部是模板绑定**（2026-09-20 逐条实测，不是照惯例推的）
 *
 * 这 13 个名字在 `Hui.vue` 的 `<template>` 里**每一个都有活读者**：
 *   · `markupMgmtOpen`(`:351`) / `markupAddOpen`(`:359`，且 `:376` 是**写**) /
 *     `markupEditOpen`(`:383`，且 `:410` 是**写**) —— 三个 `v-model:show`
 *   · `mgmtAdd`(`:363`/`:367`/`:371`) / `mgmtEdit`(`:388`/`:397`/`:401`/`:405`) —— `v-model:value`
 *   · `markupEditOptions`(`:389`) —— `:options`
 *   · 8 个函数 —— `:270`/`:353`/`:354`/`:377`/`:392`/`:411`/`:412` 各处 `@click` / `@update:value`
 * ⇒ 页面侧**必须全部解构**：`<script setup>` 的模板只对**顶层绑定**自动解包，
 *    写成 `m.mgmtAdd.name` 会让 `v-model:value` 绑到一个属性上而**静默失效**（不报错）。
 * ⚠️ `mgmtAdd` / `mgmtEdit` 是 `reactive`（**没有** `.value`）—— 解构出来就是那个对象本身，模板照旧。
 * ⚠️ 别把这条「全解构」当成通用规则：本次拆分里有几块是**零模板绑定**的（如 Home 的 B4/B7 各有取舍），
 *    **一律按实测**，不按惯例。
 */
import { computed, reactive, ref } from 'vue'
import type { DialogApi, MessageApi } from 'naive-ui'
import {
  loadMarkupCatalog,
  markupCatalog,
  removeCatalogItem,
  syncAddCatalogItem,
  updateCatalogItem,
} from '../useMarkupCatalog'

/** `useHuiMarkupMgmt()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HuiMarkupMgmtDeps {
  /** 页面 `useMessage()`。 */
  message: MessageApi
  /** 页面 `useDialog()`。 */
  dialog: DialogApi
}

/** 「加价项目管理」三个弹窗与它们的动作（旧版 `加价项目管理`/`新增加价项目`/`修改加价项目`）。 */
export function useHuiMarkupMgmt(deps: HuiMarkupMgmtDeps) {
  const markupMgmtOpen = ref(false)
  const markupAddOpen = ref(false)
  const markupEditOpen = ref(false)

  /** 新增弹窗的表单（旧版 `_0x4956b9`，打开时重置为 name:'', price:0, unit:'元/套'）。 */
  const mgmtAdd = reactive({ name: '', price: 0, unit: '元/套' })
  function openMarkupMgmt() {
    markupMgmtOpen.value = true
  }
  function openMarkupAdd() {
    mgmtAdd.name = ''
    mgmtAdd.price = 0
    mgmtAdd.unit = '元/套'
    markupMgmtOpen.value = false
    markupAddOpen.value = true
  }
  async function confirmMarkupAdd() {
    const name = mgmtAdd.name.trim()
    // 旧版校验：名称「请输入加价项目名称」；单价「单价必须大于0」（管理弹窗这份是 min:.01，:7986-7993）
    if (!name) {
      deps.message.warning('请输入加价项目名称')
      return
    }
    if (!(mgmtAdd.price > 0)) {
      deps.message.warning('单价必须大于0')
      return
    }
    const ok = await syncAddCatalogItem({ name, price: mgmtAdd.price, unit: mgmtAdd.unit || '元/套' })
    if (!ok) {
      deps.message.warning('加价项目已存在！') // 去重失败即已存在，原版提示后**不关窗**
      return
    }
    deps.message.success('加价项目添加成功')
    markupAddOpen.value = false
  }

  /** 「修改/删除加价项目」：打开前重载目录（旧版 `_0x2612ea` 先 `await _0x51e171()`）。 */
  const mgmtEdit = reactive({ index: -1, name: '', price: 0, unit: '元/套' })
  const markupEditOptions = computed(() =>
    markupCatalog.value.map((m, i) => ({ label: `${m.name} ${m.price}${m.unit}`, value: i })),
  )
  async function openMarkupEdit() {
    if (!(await loadMarkupCatalog())) deps.message.error('初始化失败')
    mgmtEdit.index = -1
    mgmtEdit.name = ''
    mgmtEdit.price = 0
    mgmtEdit.unit = '元/套'
    markupMgmtOpen.value = false
    markupEditOpen.value = true
  }
  function pickMarkupEdit(i: number) {
    const a = markupCatalog.value[i]
    mgmtEdit.index = i
    if (!a) return
    mgmtEdit.name = a.name
    mgmtEdit.price = a.price
    mgmtEdit.unit = a.unit
  }
  async function confirmMarkupEdit() {
    if (mgmtEdit.index < 0) {
      deps.message.warning('请先选择一个项目')
      return
    }
    if (!mgmtEdit.name.trim()) {
      deps.message.warning('请输入加价项目名称')
      return
    }
    if (!(mgmtEdit.price > 0)) {
      deps.message.warning('单价必须大于0')
      return
    }
    // 同名（除自己外）判重 —— 旧版 `_0x3cdb91` 的 `.some(...)`
    const dup = markupCatalog.value.some(
      (c, i) => i !== mgmtEdit.index && c.name === mgmtEdit.name.trim() && c.price === mgmtEdit.price && c.unit === mgmtEdit.unit,
    )
    if (dup) {
      deps.message.warning('加价项目已存在！')
      return
    }
    const ok = await updateCatalogItem(mgmtEdit.index, {
      name: mgmtEdit.name.trim(),
      price: mgmtEdit.price,
      unit: mgmtEdit.unit || '元/套',
    })
    if (!ok) {
      deps.message.error('编辑失败，请重试')
      return
    }
    deps.message.success('加价项目修改成功')
    markupEditOpen.value = false
  }
  async function confirmMarkupDelete() {
    if (mgmtEdit.index < 0) {
      deps.message.warning('请先选择一个项目')
      return
    }
    const target = markupCatalog.value[mgmtEdit.index]
    deps.dialog.warning({
      title: '提示',
      content: '确定要删除此加价项目吗?',
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        const ok = await removeCatalogItem(mgmtEdit.index)
        deps.message[ok ? 'success' : 'error'](ok ? '加价项目删除成功' : '加价项目删除失败')
        mgmtEdit.index = -1
        mgmtEdit.name = ''
        mgmtEdit.price = 0
        mgmtEdit.unit = '元/套'
      },
      onNegativeClick: () => deps.message.info('已取消删除'),
    })
    void target
  }

  return {
    // 13 项**全回传** —— 逐条实测在 `<template>` 里都有活读者（见文件头），
    // 所以页面侧也全部解构（少解构一个就是模板静默拿不到值）。
    markupMgmtOpen,
    markupAddOpen,
    markupEditOpen,
    mgmtAdd,
    mgmtEdit,
    markupEditOptions,
    openMarkupMgmt,
    openMarkupAdd,
    confirmMarkupAdd,
    openMarkupEdit,
    pickMarkupEdit,
    confirmMarkupEdit,
    confirmMarkupDelete,
  }
}
