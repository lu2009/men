/**
 * Progress 订单进度页的**打印链路**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）：`Progress.vue:1653-1799`
 * （连续一整段，147 行，**11 个声明**）—— 拆分方案里的 **P9**。
 * 段首那行分区横幅（`// ── C3. 打印…`）与它下面 29 行的块注释（旧版这条链的原文、
 * 「新版怎么接」「一处**有意的粒度差异**」）**一起搬来**；工厂体内**与 REF 一字不差、
 * 相对顺序也不动**。
 *
 * ⚠️ **横幅与段内注释的保真不在守卫里**（核心 `sliceFn` 从**声明**起切，它们根本不进切片）——
 *   唯一证据是「整段与 REF 同区间逐字节比」（判据 R39：归一化掉工厂那层统一缩进之后，
 *   剩余差异必须**恰好等于在案的注入改写，不多不少**）。别拿「守卫绿」当它的证据。
 *
 * ⚠️⚠️ **本段里有两条顶层 `watch(...)`，守卫完全看不见它们**（`sliceFn` 只切声明，
 *   顶层非声明语句既不切、也不证明它没被偷改 —— memory `split-guard-blind-spots` 第四类）：
 *   · `REF 1758` —— 抽屉开着时勾选变了要重算 `printOrders`
 *     （`() => (printShow.value ? selectedRows.value.map(…)… )` / 回调体在 1760-1762）。
 *   · `REF 1796` —— 搜索词一变就回第 1 页（`watch(searchText, () => { page.value = 1 })`）。
 *   **两条都整段搬进本文件**（`watch` 的 import 也跟着走），并按 R39 的判据单独做过
 *   「与 REF 逐字比」的一次独立核对（见本次搬迁报告；**不能用守卫绿代这一条**）。
 *
 * ⚠️ **注入 4 项**（本块在页面上够不着的名字；**传 ref 本身，不是 `.value` 副本**）：
 *   · `selectedRows`（REF **1408**）—— **P7**（`useProgressToolbar.ts`，Task 4 已搬）回传的
 *     `computed`。段内 3 处：`syncPrintOrders`、上面那条 `watch` 的取值器、`onOpenPrintMode`
 *     的「不能跨客户」那道闸。
 *   · `searchText`（REF **1396**）—— **P7** 回传的 `ref`，只在那条「回第 1 页」的 `watch` 里用。
 *   · `page`（REF 368）—— **写**：那条 `watch` 里 `page.value = 1`。
 *   · `message`（REF 352）—— 「所选数据包含不同客户，不能构建收据单」那句 error。
 *   ⚠️ `ProgressRow`（REF 362）**不算注入**：它是 `type`，随本任务新建的
 *     `app/src/utils/progressRow.ts` 走 `import`（见那里的说明）。
 *   模块级依赖（`ref`/`watch` 与 `api` / `OrderDto`）本文件**直接 import 不注入**
 *   （与 `useProgressColors.ts` 等同一口径）。
 *
 * ⚠️ **搬迁时的文本改写 = 4 条规则、命中 6 处**（前 3 条在声明里，第 4 条在那条 `watch` 里）：
 *   `selectedRows.value`(×3) · `message.error(`(×1) · `page.value`(×1) · `searchText`(×1)。
 *   · 规则一律**带边界**（核心文件头：「朴素 split/join，裸名会顺手打到别的标识符上」）。
 *   · ⚠️ `searchText` 那一条**必须带上下文**：本段内它是**裸名**出现在 `watch(searchText,`
 *     里（不是 `.value` 形态）⇒ 规则写成带 `watch(` 前缀与逗号的
 *     `watch(searchText,` → `watch(deps.searchText,`。写裸 `searchText` 也碰巧安全
 *     （段内只此一处），但带上下文是**能自证**的那一种，不靠「碰巧」。
 *   · ⚠️ 6 处命中**全部落在活代码里**（逐条量过；段内注释里一处都没有）⇒ 不存在 P4 那种
 *     「规则改到注释里、注释内容就漂了」的风险。段内注释里出现的是旧版标识符
 *     （`te.ping_hui` / `ElMessage.error` / `zo`），**没有**这几个注入名的子串。
 *   复量法：`applyRewrites` 的 `from` 在文本里找不到就**抛** ⇒ 上面这些计数一旦漂了，守卫直接红。
 *
 * ⚠️ **回传 7 项，七个全是「只被模板用」**（段外脚本引用 0）：
 *   `printShow`(模板 294) · `printOrders`(296/307) · `previewShow`(306) · `previewMode`(308) ·
 *   `previewTitle`(309) · `openPrint`(107) · `onOpenPrintMode`(297)。（模板行号取自 REF。）
 *   ⚠️ **不回传、也不许解构的 4 个**：`printOrderCache` `printOrdersOf` `printToken`
 *     `syncPrintOrders`（段外脚本 0 引用、模板 0 引用，真 TS 解析器实测）。
 *     ⚠️ **`syncPrintOrders` 落在「不回传」这一列，但它绝不能删** —— 它就是上面
 *       `REF 1758` 那条顶层 `watch` 的回调体调的（`void syncPrintOrders()` 在 `REF 1761`）
 *       ⇒ 它在本块内部**有活的调用者**，只是没有外部引用。**这正是「不回传 ≠ 可以删」的实例**：
 *       本块回传的 7 个是给模板的，剩下 4 个是给**本块自己的顶层 `watch` / 内部函数**用的。
 *     ⚠️ `printOrderCache` / `printToken` 是**裸 `let`** ⇒ 整体搬走，别留半个在壳里。
 *
 * ⚠️ **构造顺序**：四个注入项都是 setup 顶层即时求值 ⇒ 调用本工厂之前它们必须都已声明好
 *   （`selectedRows` / `searchText` 最晚，都来自 P7 的工厂）。见 `.vue` 里那段指路注释。
 */
import { ref, watch, type ComputedRef, type Ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { OrderDto } from '../../api/types'
import type { ProgressRow } from '../../utils/progressRow'

/** `useProgressPrint()` 的注入面。**只放页面 / P7 拥有的东西**（见文件头「注入 4 项」）。 */
export interface ProgressPrintDeps {
  /** 分页页码（页面 `ref(1)`）—— 搜索词一变就回第 1 页（**写**，段内 1 处）。 */
  page: Ref<number>
  /**
   * 勾选的行（**P7** `useProgressToolbar` 回传的 `computed`，REF 1408）。
   * ⚠️ 本块**只读**它（段内 3 处），所以收 `ComputedRef` 就够。
   */
  selectedRows: ComputedRef<ProgressRow[]>
  /** 搜索框词（**P7** 回传的 `ref`，REF 1396）—— 那条「回第 1 页」的 `watch` 的取值器。 */
  searchText: Ref<string>
  /** 「收据单不能跨客户」那道闸的提醒（页面 `useMessage()`）。 */
  message: MessageApi
}

/** 打印链路（旧版 §4.5：工具条「打印选项」→ 抽屉里 12 类单据 → 预览弹窗）。 */
export function useProgressPrint(deps: ProgressPrintDeps) {
  // ── C3. 打印（旧版 §4.5：工具条「打印选项」→ 抽屉里 12 类单据 → 预览弹窗）────
  /*
   * ## 旧版这条链
   *
   * 抽屉 `zl` 里那 12 颗按钮**每一颗都是同一个形状**：
   *
   *   ① 从勾选的行（`te.ping_hui` / `te.diao_hui`）算出该单据的行
   *      （`Ca`/`Pa`/`La`/`Ba`/`Ma`/`ka`/`So` … 各自一段，很短：`Dl.value.calculateReceipt(...)`、
   *       `lableForProduct(...)`、`Glasslist()` … —— 调的是**内嵌子组件**的方法）；
   *   ② `commentPreview(registrant.template.xxx, rows)` 生成 HTML；
   *   ③ 开预览弹窗 `ml`（宽 1180px），并把 `pl`（= ic）设成该单据，弹窗据此出现对应的编辑按钮。
   *
   * ## 新版怎么接（**一行旧代码都没搬，全走共用件**）
   *
   *   勾选的行 ──(order.id 去重 + getOrder)──▶ 订单（**只留勾选的那些行**）──▶ PrintDrawer(preset="progress")
   *     ──▶ PrintPreviewDialog（= 上面①②③ 的新版等价物：`printPayloads` + hiprint 预览）
   *
   * **为什么不照旧版把子组件的方法也搬过来**：那 12 段的产出（标签行 / 生产单行 / 玻璃行…）
   * 新版**已经全部**在 `utils/printPayloads.ts` 里实现过了，而且是按**模板字段族**分发
   * （`templatePayload`），Home / Hui 打印走的就是它。再抄一份 = 同一套口径两份实现。
   *
   * ## ⚠️ 一处**有意的粒度差异**（不是等价物，别当成抄漏）
   *
   * 旧版打印的输入是**勾选的门行**（`te.ping_hui`/`diao_hui` 里就是门行本身），
   * 新版共用链路是**订单级**的（`PrintContext` 吃 `OrderDto`）。为了不把「没勾的樘数」也打出来，
   * 这里把勾选行折算成订单时**只保留勾选的那些行**（`printOrdersOf`）——
   * 于是「打出来的门」与旧版一致，差异只在「订单头字段来自整单」（旧版也是整单的：
   * `enrichDoorRow` 的客户/单号/日期本来就取自订单头）。
   */

  const printShow = ref(false)
  /** 打印用的订单（勾选行折算出来的一份**新对象**，不写回 `rows`）。 */
  const printOrders = ref<OrderDto[]>([])
  const previewShow = ref(false)
  const previewMode = ref('')
  const previewTitle = ref('')

  /** 已拉过的整单（一次抽屉会话里同一张单只拉一次；抽屉关掉就清，免得看到旧数据）。 */
  let printOrderCache = new Map<number, OrderDto>()

  /**
   * 勾选行 → 订单：按 `order.id` 归并，**每单只保留被勾选的那些行**。
   *
   * 单个订单拉失败**不拦整体**（旧版也没有「有一行取不到就整批失败」这种逻辑）——
   * 拉不到的订单直接不进打印批次，用户看到的就是少一单。
   *
   * ⚠️ **单据里各单/各行出现的顺序**：这里是**表里的顺序**（`selectedRows` 逐行过滤出来的顺序）。
   *    旧版是**点击顺序**（`Jl` 往数组里 `push`）。旧版那个顺序纯属操作痕迹（同一批勾选、
   *    换个勾选次序就换个出单次序），照抄它反而不可复现 ⇒ 取表序。**有意偏离**。
   */
  async function printOrdersOf(selected: ProgressRow[]): Promise<OrderDto[]> {
    const byOrder = new Map<number, Set<number>>()
    for (const r of selected) {
      const oid = r.order?.id
      if (!oid) continue
      if (!byOrder.has(oid)) byOrder.set(oid, new Set())
      byOrder.get(oid)!.add(r.id)
    }
    const out: OrderDto[] = []
    for (const [oid, lineIds] of byOrder) {
      try {
        let full = printOrderCache.get(oid)
        if (!full) {
          full = await api.getOrder(oid)
          printOrderCache.set(oid, full)
        }
        // ⚠️ **必须留非空的行数组**：`PrintPreviewDialog` 的明细兜底是
        //    `o.lines?.length ? o : await api.getOrder(o.id)` —— 空数组会被它当成「没展开过」
        //    再拉一整单回来，勾选过滤就白做了。（本函数只在选了该单的行时才建条目，故必然非空。）
        out.push({ ...full, lines: (full.lines ?? []).filter((l) => lineIds.has(l.id)) })
      } catch {
        // 静默跳过（见上）
      }
    }
    return out
  }

  /** 派生 `printOrders`（带一个 token：慢的响应不许盖掉新的）。 */
  let printToken = 0
  async function syncPrintOrders() {
    const token = ++printToken
    const selected = deps.selectedRows.value
    // 没勾选就别去拉订单了：抽屉照开，里面 12 颗按钮会因为 `orders` 为空而全灰（= 旧版的表现）。
    const list = selected.length ? await printOrdersOf(selected) : []
    if (token === printToken) printOrders.value = list
  }

  /**
   * 工具条「打印选项」（旧版 `zl=true`）—— 旧版**没有**「没勾选就不给开」的守卫，这里同样不守卫。
   * 抽屉会照常打开，只是没勾选时里面 12 颗全灰（每颗的 `disabled` 就是「已选条数 = 0」）。
   */
  async function openPrint() {
    printOrderCache = new Map()
    await syncPrintOrders()
    printShow.value = true
  }

  /*
   * 抽屉**开着的时候**勾选变了要跟着变。
   *
   * 旧版那 12 颗按钮是**在点击时**现读 `te.ping_hui`/`diao_hui` 的（勾选框在左侧固定列，
   * 抽屉只占右边 350px，两者同屏可点）⇒ 开着抽屉改勾选，旧版立刻按新勾选出单。
   * 新版这份 `printOrders` 是快照，不跟就会打错单据 —— 所以补这个 watch
   * （`printOrdersOf` 有整单缓存，重复触发不会重复请求；token 保证慢响应不覆盖新结果）。
   */
  watch(
    () => (printShow.value ? deps.selectedRows.value.map((r) => r.id).join(',') : ''),
    () => {
      if (printShow.value) void syncPrintOrders()
    },
  )

  /**
   * 抽屉里点了某类单据 → 开预览弹窗（与 `Home.vue` 的 `onOpenMode` 同一个口径：先关抽屉）。
   *
   * ⚠️ 多一道**「收据单不能跨客户」**的闸 —— 这是旧版 `So` 里的原话：
   *    `if (new Set(客户编号).size > 1) return ElMessage.error("所选数据包含不同客户，不能构建收据单")`
   *    （旧版一张收据单只服务一个客户；新版回执族载荷是**每单一份**，不加这道闸会把
   *     「两个客户的收据」一次全打出来 —— 那是旧版明确拒绝的事。）
   */
  function onOpenPrintMode(mode: string, title: string) {
    if (mode === 'FinalReceipt') {
      const codes = new Set(deps.selectedRows.value.map((r) => String(r['客户编号'] ?? '')))
      if (codes.size > 1) {
        deps.message.error('所选数据包含不同客户，不能构建收据单')
        return
      }
    }
    printShow.value = false
    previewMode.value = mode
    previewTitle.value = title
    previewShow.value = true
  }

  /**
   * 搜索词一变就回第 1 页。
   *
   * ⚠️ **有意偏离**：旧版动搜索框**不重置页码**（`zo` 只被 v-model 写、`ao` 只清 `Bo`），
   *    在旧版上「停在第 2 页搜一个只剩 3 条的词」就会看到空表 —— 那是毛病。
   *    本页本就把筛选放在分页**之前**（见 `filteredRows` 的注释），不重置页码只会更容易撞上它。
   *    另：旧版 `onClear`（`lo`）只清 `zo` 和 `Bo`，在「还没有查询更多」的本版里是纯空操作
   *    ⇒ 这里不复刻那个 handler，靠 `clearable` + 这个 watch 覆盖。
   */
  watch(deps.searchText, () => {
    deps.page.value = 1
  })

  /*
   * 7 个**全部**回传 —— 本块的产出面就是它们（同 P2/P3/P5/P7/P8 的口径），
   * 而且七个**都只被模板用**（段外脚本引用 0）。
   * 另 4 个（`printOrderCache` / `printOrdersOf` / `printToken` / `syncPrintOrders`）
   * **不回传**、壳里也不解构 —— 但**别把它们从本文件删掉**：后两个是 `REF 1758` 那条
   * 顶层 `watch` 的活依赖（见文件头最后一条 ⚠️），前两个是它们与 `openPrint` 的内部件。
   */
  return {
    printShow, printOrders, previewShow, previewMode, previewTitle,
    openPrint, onOpenPrintMode,
  }
}
