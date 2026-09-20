/**
 * 「自动加价设置」（本地开关 `smartdoor_disable_auto_markup`）—— 2026-09-20 从 `Hui.vue` 搬出
 * （逻辑逐字未改，C8）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）是**两段**（中间隔着「刷新 / 视频教程」那几件，没跟着搬）：
 *   · `Hui.vue:961-971` —— `openAutoMarkup`（含其 JSDoc 961-966），**1 个声明**
 *   · `Hui.vue:1226-1256` —— `autoMarkupOpen` / `autoMarkupDraft` / `onAutoMarkupDraft` / `saveAutoMarkup`，
 *     **4 个声明**
 * 段内合计 **5 个声明**。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C8 一条）。
 *
 * ## 落盘格式（**别改**，改了从旧版迁过来的浏览器里那份设置会被读反）
 *
 * 键名 `smartdoor_disable_auto_markup`，值是**布尔值的字符串** `"true"` / `"false"` ——
 * **不是** `"1"`/`"0"`。旧版读写都是 `=== "true"` / `String(v)`
 * （`Hui.formatted.js:835` / `:8009-8014`）。**读的一侧在页面**（脊梁那行
 * `const disableAutoMarkup = ref(LS.get('smartdoor_disable_auto_markup') === 'true')`），
 * **写的一侧在本块**（`saveAutoMarkup`）——**两边必须同一套口径**。
 *
 * ⚠️ 落盘的是 `String(布尔)`，但**派出去的事件 `detail` 是布尔值本身**
 *    （旧版 `detail: _0x963b41.value`）—— 两者别搞混，本块里两处紧挨着。
 *
 * ## 🔴 注入面 = **2 项**，其中 `disableAutoMarkup` 是**引用注入、不是值注入**
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | 🔴 `disableAutoMarkup` | **脊梁** `ref<boolean>`（页面 `:841`） | 读（开了弹窗同步草稿）**+ 写**（保存时提交） |
 * | `message` | 页面 `useMessage()` | 「设置已保存」 |
 *
 * `LS` 是 `composables/useOrderLines.ts` 的**模块级导出** ⇒ 直接 `import`，**不进注入面**。
 *
 * ### 为什么必须传 **ref 本身**（传值就废了 —— spec §6.1-1 / §6.3 那一族）
 *
 * `autoMarkupDraft` 的初值是**即时读值** `ref(disableAutoMarkup.value)`（旧版就是这形状）：
 * 它在 **composable 被调用那一刻**读一次开关状态。
 *   · ✅ 传 `{ disableAutoMarkup }`（ref）⇒ 读的是**当时**的值，与搬之前**同一时刻**（页面在
 *     骨架里同样位置调本 composable，中间没有任何一处写过它）；
 *   · ❌ 传 `{ disableAutoMarkup: disableAutoMarkup.value }`（布尔值）⇒ `saveAutoMarkup` 里那句
 *     `disableAutoMarkup.value = …` **写不进页面**，而且**编译不报错**：`deps.disableAutoMarkup`
 *     会变成布尔值上的 `.value`（`vue-tsc` 会抓成 `TS2339`，但**守卫完全不看这个**）
 *     ⇒ 界面上的表现是：点「保存」后提示照弹、弹窗照关、**开关状态却不生效**（表格里的自动加价照样算）。
 * ⇒ **这一类守卫验不了**（它只做逐字文本比对），所以页面调用点也写了同款提示，改这块的人两处都要看。
 *
 * ## 回传面 = **4 项**（`autoMarkupDraft` **有意不回传**）
 *
 * | 名字 | 页面（`Hui.vue`）里剩下的读者 |
 * |---|---|---|
 * | `openAutoMarkup` | 模板 `:273`（「添加门类」抽屉里那颗按钮的 `@click`） |
 * | `autoMarkupOpen` | 模板 `:418`（`v-model:show`，**读+写**）· `:428`（「取消」写 false） |
 * | `onAutoMarkupDraft` | 模板 `:423`（`@update:checked`） |
 * | `saveAutoMarkup` | 模板 `:429`（`@click`） |
 *
 * ⚠️ `autoMarkupDraft` **不回传** —— 2026-09-20 逐个实测：它在 `Hui.vue` 里**只剩块内引用**
 *    （`openAutoMarkup` / `onAutoMarkupDraft` / `saveAutoMarkup`，都已随本块搬走），
 *    `<template>` 里**零命中**。
 *    ⚠️ 注意模板那个勾选框绑的是 **`disableAutoMarkup`（脊梁那个 ref）**、不是草稿
 *    （`:423` `:checked="disableAutoMarkup"`）—— 即「弹窗里显示的是**已存值**，改动先落在草稿上，
 *    点保存才提交」。**这是旧版口径，别顺手改成绑草稿**。
 */
import { ref, type Ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { LS } from '../useOrderLines'

/** `useHuiAutoMarkup()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HuiAutoMarkupDeps {
  /** **脊梁**：去自动加价开关（`Hui.vue` 的 `disableAutoMarkup`）—— **传 ref 本身**，读+写。 */
  disableAutoMarkup: Ref<boolean>
  /** 页面 `useMessage()`。 */
  message: MessageApi
}

/** 「自动加价设置」弹窗（本地开关，仿旧版 `smartdoor_disable_auto_markup`）。 */
export function useHuiAutoMarkup(deps: HuiAutoMarkupDeps) {
  function openAutoMarkup() {
    // 打开时把草稿同步成已存值（旧版点「保存」才落盘，取消应丢弃改动）
    autoMarkupDraft.value = deps.disableAutoMarkup.value
    autoMarkupOpen.value = true
  }

  const autoMarkupOpen = ref(false)

  const autoMarkupDraft = ref(deps.disableAutoMarkup.value)

  function onAutoMarkupDraft(v: boolean) {
    autoMarkupDraft.value = v
  }

  function saveAutoMarkup() {
    deps.disableAutoMarkup.value = autoMarkupDraft.value
    LS.set('smartdoor_disable_auto_markup', String(autoMarkupDraft.value))
    // ⚠️ 旧版这里**还派一个事件**（`H:8019`，`_0x23343f`）：
    //     `window.dispatchEvent(new CustomEvent('auto-markup-setting-changed', { detail: 值 }))`
    //     —— 与「辅助菜单设置」那两个是同一族（写 localStorage + 派事件给手机端外壳）。
    //     bundle 里搜不到监听者（事件名在旧版是 token `e(725)`，不是字面量；解码后才认得出来），
    //     所以监听方在外壳那边。我们先前漏了这一句，现补上。
    //     ⚠️ 落盘的是 `String(布尔)`（`"true"`/`"false"`），但**派出去的是布尔值本身**
    //     （旧版 `detail:_0x963b41.value`）—— 两者别搞混。
    try {
      window.dispatchEvent(
        new CustomEvent('auto-markup-setting-changed', { detail: autoMarkupDraft.value }),
      )
    } catch {
      /* 没有 CustomEvent 的环境跳过派发 */
    }
    autoMarkupOpen.value = false
    deps.message.success('设置已保存')
  }

  return {
    // 4 项回传（`autoMarkupDraft` **有意不回传** —— 页面里零读者，见文件头「回传面」）。
    openAutoMarkup,
    autoMarkupOpen,
    onAutoMarkupDraft,
    saveAutoMarkup,
  }
}
