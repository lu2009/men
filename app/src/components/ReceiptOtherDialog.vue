<!--
  「回执单-其它」抽屉 —— 旧版「打印选项」抽屉**顶部**那颗 `回执单-其它` 点开的**第二层**抽屉。

  ★ 旧版结构（`legacy/js/Home.formatted.js` 渲染函数 `:11873-11897`）：

      「打印选项」抽屉（`Bn`，size 350）
        ├ [ 查看回执单 ]  `ki`  :9103
        ├ [ 回执单-其它 ] `Nn`  :8184   —— 只 `Mn.value = true`
        └ 【本抽屉】（`Mn`，`title:dr[931]="回执单-其它"`，`direction:"rtl"`，`size:350`，
                       `destroy-on-close:false`，`append-to-body`）
             [ 直接打印回执单 ]  `zi` :8691   `v-if=Yt`
             [ 手动打印回执单 ]  `Fi` :9871   `v-if=Yt`
             [ 复制回执单 ]      `Mi` :8827   `v-if=!z`（文案在 `dr[1194]`「复制中...」↔ `dr[1392]` 间切）
             [ 分享回执单(手机) ] `Ni` :8859   （文案在「分享中...」↔ `dr[541]` 间切）
             [ 下载回执单 ]      `xi` :8747   `v-if=Yt`（文案在「下载中....」↔ `dr[851]` 间切）

    抽屉体是 `div.drawer-content` —— 旧版 SFC 的 `scoped` 样式逐字：
      `.drawer-content[data-v-7e2e1e6b]{padding:10px;display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-start}`
    五颗按钮**全是** `type:"primary"`、`size` 用默认值（旧版没传 size，别跟「打印选项」抽屉里的 `small` 混）。

  ★ **本抽屉里没有任何预览 DOM**：旧版 `Mi`/`Ni`/`xi` 都是**临时**建一个离屏 `<div>` 塞渲染结果、
  截完图就摘掉（`utils/receiptImage.ts` 逐字复刻）。「打印选项」抽屉本身也只列入口，不显示回执。

  ★ **两处有意偏离**（都在文末「按钮」小节再展开一次）：
    ① 旧版是**嵌套**抽屉（外层「打印选项」不关，内层叠在它上面）；新版沿用本项目既有的
       「先关抽屉再开目标」口径（`Home.vue` 的 `onOpenDoc` 同理，那里的注释记了原因：
       两层 `n-drawer` 都从右侧出、叠着会互相压）。
    ② 少了「直接打印回执单」—— 查证见下。

  ## `zi`（直接打印回执单）查证结果

  `zi`（:8691-8746）**不是**本机打印，是**静默直打**（不出浏览器打印对话框）：

      ElLoading("打印中...")                    // dr[1393]
      d = qn.length ? qn : Object.keys(wn).map(取 customerInfo + hui_picture)
      V = await x()                              // 用户配置：registrant
      await lc.value?.getPrinter("receipt")
      printer = V.registrant.pagesize.receipt    // dr[1293]=pagesize
      copies  = V.registrant.copy.receipt        // dr[793]=copy
      if (ll.value) It.printLandscape("receipt", d, {printer, copies, color:true})     // 本地 hiprint 客户端
      else          Ut.transitPrintMultiple("receipt", d, {silent:true, printer, copies, color:true})  // 云中转

  · `ll`（:7589 `Vue.ref(!1)`，默认 **false**）是「云打印开关」⇒ **默认走的是云中转**那条。
  · `It` = `printService`（`legacy/js/printService-48210c48.js`），其字符串表里是
    `http://localhost:17521` / `hiprint.hiwebSocket` / `ensureConnection` / `getPrinterName` ——
    即**桌面 hiprint 客户端**（WebSocket 常驻进程），不是 `window.print`。
  · `Ut` = `mutilPrintService`，字符串表里有 `socket` / `17521` / `printjs` / `silent` —— printjs 云中转。
  · ⚠️ 源码里那句「云打印失败: ，正在尝试本地打印...」**只是文案**，`zi` 的 catch 里
    **没有任何本地打印调用** —— 别被它骗了。

  ⇒ 新版两条载体**都没有**：`docs/2026-09-17-home-print.md` §5 已拍板不做云打印（依赖第三方服务与账号），
  新版也没有 hiprint 桌面客户端（`printByMode` 走的是浏览器 hiprint ⇒ 弹系统打印对话框）。
  **按「预览弹窗省略『云打印』按钮」的同一先例，这里省略「直接打印回执单」。**
  不硬塞一颗改成本机打印的按钮 —— 那会与「手动打印回执单」完全重合、且名字对不上行为。

  ## `Yt`（工厂态）/ `z`（手机端）两个标志

  | 标志 | 旧版判据 | 新版处理 |
  |---|---|---|
  | `Yt` 工厂 | `Vue.ref(!0)`（:7581），仅在 `userinfo.defaulted === 3`（**终端账号**）时置 `false`（:8147、:7885） | 新版后端 `users.role` 只有 `admin`/`staff`（`backend/migrations/0002_auth.sql`），**没有终端账号**这个概念，终端只读页也未实现 ⇒ 恒为工厂态，见 `isFactory` |
  | `z` 手机 | `Vue.onMounted`(:7579)：`z.value = v.isNativePlatform() \|\| /iPad\|iPhone\|iPod/.test(navigator.userAgent)` | 新版的壳是 **Tauri 2 桌面端**（`app/src-tauri/`）而非 Capacitor **移动端**，`isNativePlatform()` 那一半没有对应物 ⇒ 只留 UA 那半，见 `isMobile` |
-->
<template>
  <n-drawer
    :show="show"
    :width="350"
    placement="right"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <n-drawer-content title="回执单-其它" closable>
      <!-- 旧版 `div.drawer-content`：padding:10px; flex; flex-wrap; gap:10px; justify-content:flex-start -->
      <div class="ro-body">
        <!-- `v-if=Yt`：终端态不显示。「直接打印回执单」(`zi`) 不在此列，见文件头查证 -->
        <n-button v-if="isFactory" type="primary" :loading="printing" @click="doManualPrint">
          手动打印回执单
        </n-button>

        <!-- `v-if=!z`：手机端隐藏（旧版手机上这颗与「分享」重复，故只留分享） -->
        <n-button v-if="!isMobile" type="primary" :loading="copying" @click="doCopy">
          {{ copying ? '复制中...' : '复制回执单' }}
        </n-button>

        <n-button type="primary" :loading="sharing" @click="doShare">
          {{ sharing ? '分享中...' : '分享回执单(手机)' }}
        </n-button>

        <!-- `v-if=Yt` -->
        <n-button v-if="isFactory" type="primary" :loading="downloading" @click="doDownload">
          {{ downloading ? '下载中....' : '下载回执单' }}
        </n-button>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NDrawer, NDrawerContent, useMessage } from 'naive-ui'

import { api } from '../api/client'
import type { OrderDto } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { printByMode, renderByMode } from '../utils/printService'
import {
  buildBatchPayload,
  loadPrintPrereqs,
  type PrintPrereqs,
} from '../composables/useOrderPrint'
import { copyReceiptImage, downloadReceiptImage, shareReceiptImage } from '../utils/receiptImage'

const props = defineProps<{
  show: boolean
  /** 选中订单（由 Home 的 `openPrint` 做过明细兜底 —— 未展开过的订单也已 `getOrder` 补全）。 */
  orders: OrderDto[]
}>()

const emit = defineEmits<{ 'update:show': [boolean] }>()

const message = useMessage()
const auth = useAuthStore()

/**
 * 旧版 `Yt`（工厂态）。判据与处理见文件头表格 —— 新版**判不了**（后端无终端账号），恒为 `true`。
 *
 * `// TODO(未确认)`：等「终端只读页 / 终端账号」在 `users.role` 上落地后，这里必须回来改成按角色判
 * （旧版判的是 `userinfo.defaulted === 3`），届时「手动打印 / 下载」两颗按钮要跟着隐藏。
 */
const isFactory = computed(() => true)

/**
 * 旧版 `z`（手机端）。判据 = `Capacitor.isNativePlatform() || /iPad|iPhone|iPod/.test(ua)`；
 * 新版的壳是 Tauri 2 **桌面端**，`isNativePlatform()` 那一半没有对应物 ⇒ 只留 UA 那半
 * （旧版也是在 `onMounted` 里算的，照抄时机）。
 */
const isMobile = ref(false)
onMounted(() => {
  isMobile.value = /iPad|iPhone|iPod/.test(navigator.userAgent)
})

/** 四颗按钮各自的 loading（旧版是四个独立 ref：`mn`/`wl`/`yl`/`gl`）。 */
const printing = ref(false)
const copying = ref(false)
const sharing = ref(false)
const downloading = ref(false)

/** 打印前置数据（公式 / 客户 / 收款码 / 挖孔图）—— 本次会话内只拉一次。 */
let prereqs: PrintPrereqs | null = null
/** 渲染好的回执 HTML —— 本次会话内只渲一次（旧版每次动作各渲一次，产物相同）。 */
let htmlCache = ''

// 每次开抽屉都是新会话：清掉上一轮的缓存与标志（旧版每次动作都会重取 `wn`，等价）。
watch(
  () => props.show,
  (open) => {
    if (!open) return
    prereqs = null
    htmlCache = ''
    printing.value = false
    copying.value = false
    sharing.value = false
    downloading.value = false
  },
)

function who() {
  return { tenantName: auth.tenant?.name || '', maker: auth.user?.name || '' }
}

/** 回执模板 + 选中订单一 → hiprint 载荷。与 `PrintPreviewDialog` / 旧版 `{...customerInfo, receipt}` 同一形状。 */
async function buildPayload(forPreview: boolean) {
  if (!props.orders.length) throw new Error('请先在订单列表里勾选要打印的订单')
  const templates = await api.getPrintTemplatesByMode('receipt')
  const tpl = templates[0]?.template
  if (!tpl) throw new Error('未配置打印模板：receipt')
  if (!prereqs) prereqs = await loadPrintPrereqs(props.orders)
  return buildBatchPayload(props.orders, prereqs, who(), tpl, 'receipt', forPreview).payload
}

/** 渲染回执 HTML（复制 / 分享 / 下载三条路共用）。旧版三条路各自 `It.preview("receipt", …)` 取 `[0]`。 */
async function receiptHtml(): Promise<string> {
  if (htmlCache) return htmlCache
  const html = await renderByMode('receipt', await buildPayload(true))
  if (!html) throw new Error('回执单渲染为空')
  htmlCache = html
  return html
}

/**
 * 「手动打印回执单」—— 旧版 `Fi`（:9871-9878），原样三行：
 * ```js
 * al.value = !1
 * const t = qn.value.length > 0 ? qn.value : Object.keys(wn).map(e => ({...wn[e].customerInfo||{}, receipt: wn[e].hui_picture||[]}))
 * It.print("receipt", t)          // dr[902] = "print"
 * ```
 * 新版等价 = `printByMode('receipt', payload)`（本机 hiprint，弹系统打印对话框），
 * 与「打印预览」弹窗里那颗「打印」同一条链路。
 */
async function doManualPrint(): Promise<void> {
  if (printing.value) return
  printing.value = true
  try {
    await printByMode('receipt', await buildPayload(false))
  } catch (e) {
    message.error((e as Error).message || '打印失败')
  } finally {
    printing.value = false
  }
}

/**
 * 「复制回执单」—— 旧版 `Mi`（:8827）。
 *
 * ⚠️ 旧版 `catch` 里是 `xi()` —— **复制失败自动回退成下载**（`Mi` 的 `finally` 与 `catch` 都调了 `xi`）。
 * 这里保留该回退，但**先提示原因**（旧版是「复制失败，请重试」`dr[752]` + 静默下载）。
 */
async function doCopy(): Promise<void> {
  if (copying.value) return
  copying.value = true
  try {
    await copyReceiptImage(await receiptHtml())
    // dr[695]
    message.success('图片已复制到剪切板！可直接粘贴')
  } catch (e) {
    message.error((e as Error).message || '复制失败，请重试')
    await fallbackDownload()
  } finally {
    copying.value = false
  }
}

/**
 * 「分享回执单(手机)」—— 旧版 `Ni`（:8859）。`catch` 里同样是 `xi()` 回退下载。
 * 成功文案 `dr[1149]`。
 */
async function doShare(): Promise<void> {
  if (sharing.value) return
  sharing.value = true
  try {
    await shareReceiptImage(await receiptHtml())
    message.success('已打开系统分享面板，可直接分享到微信')
  } catch (e) {
    message.error((e as Error).message || '分享失败，请重试')
    await fallbackDownload()
  } finally {
    sharing.value = false
  }
}

/**
 * 「下载回执单」—— 旧版 `xi`（:8747）。
 * 浏览器路径成功文案固定「下载成功」（`:8800` 字面量，不是 token）。
 */
async function doDownload(): Promise<void> {
  if (downloading.value) return
  downloading.value = true
  try {
    await downloadReceiptImage(await receiptHtml())
    message.success('下载成功')
  } catch (e) {
    // dr[479]
    message.error((e as Error).message || '下载失败，请重试')
  } finally {
    downloading.value = false
  }
}

/**
 * 复制 / 分享失败时的下载兜底（旧版 `Mi`/`Ni` 的 `catch { xi() }`）。
 * 不走 `doDownload` —— 那颗按钮有自己的 loading 与提示，这里只是静默兜底。
 */
async function fallbackDownload(): Promise<void> {
  try {
    await downloadReceiptImage(await receiptHtml())
    message.success('下载成功')
  } catch {
    // 兜底也失败：上面已经提示过原因，这里不再叠加第二条错误
  }
}
</script>

<style scoped>
/*
  旧版 `scoped` 样式逐字（`legacy/css/Home-97d96482.css`）：
  `.drawer-content[data-v-7e2e1e6b]{padding:10px;display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-start}`
  `n-drawer-content` 自己已有内边距，这里只补它没有的那几项，避免叠加出双倍留白。
*/
.ro-body {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-start;
}
</style>
