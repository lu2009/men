/**
 * 「模板预览」（模板预览 / 算料共用）—— 2026-09-20 从 `Hui.vue` 搬出（逻辑逐字未改，C6）。
 *
 * 搬出前的行段（参照提交 `28e36d21`）是**一段**：`Hui.vue:1988-2037`，段内 **7 个声明**：
 * `templatePreviewOpen` / `templatePreviewLoading` / `templateList` / `templatePreviewMode` /
 * `templatePreviewTitle` / `templatePreviewOrders` / `openTemplatePreview`。
 *
 * 搬迁保真由 `docs/home-audit/hui-extract-movecheck.mjs` 机核（`SPLIT_BLOCKS` 里 C6 一条）。
 *
 * ## 注入面 = **4 项**
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `lines` | 页面脊梁（`ref`） | 判「有没有订单行」；并**显式拼进**预览订单（见下） |
 * | `order` | 页面脊梁（`reactive`） | `templatePreviewOrders` 里整体展开（`{ ...order, id, lines }`） |
 * | `orderId` | 页面脊梁（`ref`） | 同上：未落库的单 `id` 是 `0` |
 * | `message` | 页面 `useMessage()` | 「暂无订单行」/「加载模板失败」 |
 *
 * `api.listPrintTemplates()` 走模块单例 ⇒ 新家直接 `import`，**不注入**。
 *
 * ## 回传面 = **6 项**（`templatePreviewLoading` **不回传**）
 *
 * | 名字 | 段外的活读者 |
 * |---|---|
 * | `templatePreviewOpen` | `<PrintPreviewDialog v-model:show>`（模板 `:587`，是**写**） |
 * | `templatePreviewOrders` | 同上 `:orders`（`:588`） |
 * | `templatePreviewMode` | 同上 `:mode`（`:589`） |
 * | `templatePreviewTitle` | 同上 `:title`（`:590`） |
 * | `templateList` | 同上 `:templates`（`:591`） |
 * | `openTemplatePreview` | ⚠️ **两处调用**：`onMoreSelect` 的 `case 'templates'`（`:1029`）与 **`calcSingleRow`（`:1341`，传 `'product'`）** |
 * ⚠️ `templatePreviewLoading` **段外零命中**（它只在本块内部置位；那个弹窗自己管 loading）⇒
 *    页面**不解构**它 —— 解构出来就是 TS6133。
 *
 * ⚠️ **两处容易改错的语义**（本块只搬、不改，但后续别踩）：
 *   ① `templatePreviewOrders` **显式带 `lines`** —— 弹窗里那句
 *      `o.lines?.length ? o : await api.getOrder(o.id)` 就是靠它免掉回拉的（**未落库的单没有 id 可拉**）。
 *   ② 模板上写死 `:auto-line-numbers="false"` —— **Hui 这条链路从不补行级单号**（旧版也是；
 *      Hui 有独立的「填入单号」按钮）。
 *   ③ `order` 与 `lines` 都是**整体断言成 `OrderDto`** 的（编辑器里的行与 DTO 形状不完全一致），
 *      这是**有意为之**，别"顺手"改成逐字段构造 —— 那会漏字段。
 */
import { computed, ref, type Ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import type { OrderDto } from '../../api/types'
import type { Line } from '../../utils/partsEngine'
import { api } from '../../api/client'

/** `useHuiPreview()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HuiPreviewDeps {
  /** 页面脊梁：订单行（`ref`）。 */
  lines: Ref<Line[]>
  /**
   * 页面脊梁：订单草稿（`reactive`）。
   * ⚠️ 这里收成 `object` 是**有意的**：本块只把它**整体**断言成 `OrderDto` 后展开，
   *    逐字段声明反而会与订单字段表耦合、漏一个就静默丢字段。
   */
  order: object
  /** 页面脊梁：当前订单 id（未落库为 `null` ⇒ 预览里按 `0` 给）。 */
  orderId: Ref<number | null>
  /** 页面 `useMessage()`。 */
  message: MessageApi
}

/** 模板预览：给 `PrintPreviewDialog` 的那份订单 + 打开入口（拉模板清单、定初始 mode）。 */
export function useHuiPreview(deps: HuiPreviewDeps) {
  const templatePreviewOpen = ref(false)
  const templatePreviewLoading = ref(false)
  const templateList = ref<{ mode: string; name: string }[]>([])
  const templatePreviewMode = ref<string | null>(null)
  const templatePreviewTitle = ref('模板预览')

  /**
   * 给 `PrintPreviewDialog` 的订单 = **Hui 当前编辑中的这一单**（可能还没落库）。
   *
   * ⚠️ 显式给 `lines`：弹窗里那句 `o.lines?.length ? o : await api.getOrder(o.id)` 就是靠它
   *    免掉回拉的（未落库的单根本没有 id 可拉）。
   */
  const templatePreviewOrders = computed<OrderDto[]>(() =>
    deps.lines.value.length
      ? [{ ...(deps.order as unknown as OrderDto), id: deps.orderId.value ?? 0, lines: deps.lines.value as unknown as OrderDto['lines'] }]
      : [],
  )

  /**
   * 打开预览（`:1004` 的「模板预览」入口，以及「算料」都走它）。
   *
   * 与旧版自绘那套的差别：预览/打印的**渲染与按钮**都交给 `PrintPreviewDialog` 了，
   * 这里只负责拉模板清单、定初始 mode、给标题。
   *
   * ⚠️ `auto-line-numbers: false`（在模板上）—— Hui 这条链路**从不补行级单号**
   *    （旧版也是；Hui 有独立的「填入单号」按钮）。
   */
  async function openTemplatePreview(initialMode?: string) {
    if (!deps.lines.value.length) {
      deps.message.warning('暂无订单行')
      return
    }
    templatePreviewOpen.value = true
    templatePreviewLoading.value = true
    try {
      const all = await api.listPrintTemplates()
      templateList.value = all.map((t) => ({ mode: t.mode, name: t.name }))
      const want = initialMode ?? templatePreviewMode.value ?? all[0]?.mode
      templatePreviewMode.value = want || all[0]?.mode || null
      templatePreviewTitle.value = templateList.value.find((t) => t.mode === templatePreviewMode.value)?.name || '模板预览'
    } catch (e) {
      deps.message.error(e instanceof Error ? e.message : '加载模板失败')
    } finally {
      templatePreviewLoading.value = false
    }
  }
  return {
    // 6 项回传 —— 5 个模板绑定（`:587`-`:591`）+ `openTemplatePreview`（两处调用，见文件头）。
    templatePreviewOpen,
    templatePreviewOrders,
    templatePreviewMode,
    templatePreviewTitle,
    templateList,
    openTemplatePreview,
    // 不回传 `templatePreviewLoading`：段外零命中（那个弹窗自己管 loading）⇒ 解构即 TS6133。
  }
}
