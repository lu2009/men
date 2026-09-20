/**
 * 「列单元格渲染 / 列头筛选 / 行提示」—— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）—— **五段，中间夹着 Task 4 的地盘**：
 *   · `Home.vue:2566-2587` —— 「列定义」分区头（`2566-2568`）+ `la()` 底色那 19 行说明
 *   · `Home.vue:2612-2676` —— 分隔符口径冲突注释 + `progressPrefix` / `progressSuffix` / `renderProgress`
 *   · `Home.vue:2678-2783` —— 行提示（row-tip）区域头 + 状态 + 三个函数 + `rowTipHandlers`
 *   · `Home.vue:2785-2830` —— `renderEditable`（JSDoc `2785-2806` 共 22 行 + 函数 `2807-2830`）
 *   · `Home.vue:2832-2963` —— `headerFilter`（JSDoc `2832-2865` 共 34 行 + 函数 `2866-2963`）
 *   ⛔ **`2588-2610` 不是本块的** —— 那是 `progressSegments`，**Task 4 已搬去 `utils/homeConstants.ts`**；
 *   ⛔ **`2965-2966`（`paymentPopShow` / `progressPopShow`）留在页面** —— 它们是 `columns` 的弹窗状态，
 *      与单元格渲染无关。
 *   方案 §3.1 只写了 `2678–2963`（把段①②整段漏了，也把 Task 4 的段算了进来）。
 *   （按用户 2026-09-20 的令「不必写的文档不要写」，**本轮不改 `docs/`** —— 更正记在这里。）
 *
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（B12 一条）。
 *
 * ## ⚠️ 注入 **5** 项（简报写 4 —— 少的那一项是 `financeSummary`）
 *
 * 简报的注入面（`editingId` / `draft` / `startEdit` / `manualActions`）是照 **REF 的文本**列的，
 * 而 **Task 4 改过两个被本块调用的函数签名**，那两个改动把 `financeSummary` 拉了进来：
 *
 * | REF 里的形态 | 现在 | `financeSummary` 从哪来 |
 * |---|---|---|
 * | `unpaidOf(row)`（那是个**页面局部**的闭包，体内读 `financeSummary.value`） | `unpaidOf(row, deps.financeSummary.value)` | 改成显式第二实参 |
 * | `progressSegments(status)` | `progressSegments(status, deps.manualActions)` | 由 `manualActions` 顶 |
 *
 * ⇒ **`financeSummary` 必须注入**（它是 B1 `useHomeData` 拥有并借出的页面状态）。
 *    这是**既有的**签名改动带出来的，不是本任务引入的 —— 但它确实让本块不再是「最干净的一块」。
 * ⚠️ 注入的 `draft` 是 `reactive` **对象本身**（不是 ref、不是 `.value`）：体里对它**写**
 *    （`(deps.draft as unknown as Record<string, string>)[field] = v`）——传副本＝白写（**静默**）。
 *
 * 模块级依赖（`h` / naive-ui 的 `NButton` `NDivider` `NInput` `NPopover` / `unpaidOf` /
 * `progressSegments` / 各类型）本文件**直接 import 不注入** —— 与 `useHomeSelection.ts` 同一口径。
 *
 * ## 回传 9 项
 *
 * `renderProgress`（`columns`）· `rowTipShow` `rowTipLines` `rowTipPaid` `rowTipEl` `rowTipInitStyle`
 * （模板 `153/154/159`）· `rowTipHandlers`（`columns` 四处）· `renderEditable` `headerFilter`（`columns` 各两处）。
 * ⇒ `Home.vue` 侧**必须解构**：`rowTipEl` 是**模板 ref**（`ref="rowTipEl"`）、其余被模板读 ——
 * 写成 `cell.rowTipShow` 会拿到 **Ref 对象**而不是值（**静默**坏）。
 * 零外部读者、不回传（但**仍原样搬进本文件**）：`progressPrefix` · `progressSuffix` · `rowTipContent` ·
 * `moveRowTip` · `hideRowTip` · `showRowTip` · `rowTipMove`。
 *
 * ## ⚠️ `rowTipMove` 是 `let`，搬成**模块级**是**有意选择**
 *
 * REF 里它在 `<script setup>` 顶层 ⇒ **每实例**一份；搬进本文件后成了**每模块**一份。
 * `Home` 是**单例页面**（同一时刻只可能有一个实例在用行提示）⇒ **无可观测差异**。
 * 这是有意选择，不是顺手 —— 别当成 bug 改回去。
 *
 * ## ⚠️ 两个 JSDoc 块是本文件最值钱的东西，一个字都不能漏
 *
 * `renderEditable` 的 22 行 与 `headerFilter` 的 34 行 —— 后者载着**旧版 HTML 骨架**、
 * **C7/C8/C13/C14 四条「别再改回去」**、`Mo`/`zo` 的**空串哨兵规则**、`.stop`/`stopPropagation`
 * 要求。**丢了它 = 那四条有意偏离的唯一记录没了**（本项目已栽过 6 次同类：注释孤儿/漏注释）。
 *
 * ⚠️ 本块还带走了 `Home.vue` 里那句「`tip-cell` …（见 `showRowTip`）」的指针（在 `columns` 里，
 *    **留在页面**）—— 已在**同一笔**里改成指向本文件，不然那个指针就悬空了。
 */

import { h, reactive, ref, type Ref } from 'vue'
import { NButton, NDivider, NInput, NPopover } from 'naive-ui'
import type { OrderFinance, OrderHeadInput, OrderSummaryDto } from '../../api/types'
import { progressSegments } from '../../utils/homeConstants'
import { unpaidOf } from '../../utils/homeMetrics'

/** `useHomeCellRender()` 的注入面。**只放页面拥有的东西**（见文件头）。 */
export interface HomeCellRenderDeps {
  /** B8 `useHomeRowEditing` 回传：正在编辑的订单 id（判断这一格是不是走草稿）。 */
  editingId: Ref<number | null>
  /** B8 回传：可编辑单元格的草稿。⚠️ `reactive` 对象 ⇒ 传**对象本身**（不是 ref、不是 `.value`）。 */
  draft: OrderHeadInput
  /**
   * B8 回传：进入编辑态。
   *
   * ⚠️ **只有一个实参** —— 简报（`task-14-brief.md` 修正 D）把它写成
   *    `(row, field) => void`，而 REF 里就是 `startEdit(row)`（B8 的 `startEdit(row: OrderSummaryDto)`）。
   *    照简报写会让本块两处调用报 TS2554（**实测踩到**）。
   */
  startEdit: (row: OrderSummaryDto) => void
  /** B11 `useHomeManualProgress` 回传：自定义进度项 —— `progressSegments` 的第二实参。 */
  manualActions: Ref<string[]>
  /**
   * B1 `useHomeData` 回传：财务摘要 —— `unpaidOf` 的第二实参。
   *
   * ⚠️ 这一项**简报的注入面里没有**：REF 里 `unpaidOf` 是页面局部的闭包、自己读 `financeSummary.value`，
   *    而 Task 4 把它改成 `utils/homeMetrics.ts` 的 `unpaidOf(r, fin)`（显式第二实参）。
   */
  financeSummary: Ref<Record<string, OrderFinance>>
}

/**
 * 列单元格渲染 / 列头筛选 / 行提示。
 *
 * ⚠️ **构造顺序**：`editingId`/`draft`/`startEdit` 来自 **B8**、`manualActions` 来自 **B11**、
 *    `financeSummary` 来自 **B1** ⇒ 必须在三块**之后**调用。传早了拿到的是 `undefined`，
 *    且**不一定报错**。
 */
export function useHomeCellRender(deps: HomeCellRenderDeps) {
  // ---------------------------------------------------------------------------
  // 列定义（§3；Phase 1 = 工厂视图 Yt）
  // ---------------------------------------------------------------------------
  /*
   * ⚠️ 旧版 `la`（`:7940-7942`）那套底色（收据单/标签/玻璃订单/生产单/自助下单）
   * **本系统里不渲染，已删** —— 不是漏做，是**到不了**。
   *
   * `la()` 全组件只有两个调用点（`grep` 实测：`:11589` 业务员、`:11597` 打单人），
   * 两处都长这样：
   *   ```js
   *   qt.value ? <el-input class="borderless-input" onFocus={nn}>
   *            : <div style={la(row["业务员"])}>{row["业务员"]}</div>
   *   ```
   * 即带底色的 `div` 是 **`!qt`（只读）分支**。而 `qt`（`:8147`）是
   *   `qt.value = data.registrant === userinfo.name`
   * ——「**正在看的这份数据是不是自己租户的**」，是旧版**租户切换/代看**的只读闸门。
   * 新版没有租户切换 ⇒ **`qt ≡ true`** ⇒ 永远走输入框那一支，`la()` 分支不可达。
   *
   * ★ 这同时更正了本文件先前的一处改动（`a70ac477`）：那次把 `la()` 的底色挂到了
   *   业务员/打单人的「非编辑态显示」上 —— 挂是挂对了函数，但**挂到了一个我们永远进不去的分支**。
   *   正确形态是这两列**常驻输入框**（见 `renderEditable`），没有任何底色。
   */

  // ⚠️ 分隔符口径冲突（需上游拍板）：旧版源码**只用下划线**——`oa`/`aa`（`:7943-7952`）`split("_")`，
  // 删除时摘段也是 `x_` / `_x`（`:8100-8103`），全 bundle 查不到按空格切 `打单操作` 的地方；
  // 而 `backend/migrations/0018_home_order_head_fields.sql` 的注释把 `打单操作 -> production_status`
  // 写成「"生产单 玻璃订单 标签 收据单" 等，**空格串**」（同一段注释里 `单号集` 才是空格串）。
  // 这里按**旧版源码**取 `_`；新版自身写入的是单个 token（无分隔符），所以只影响旧数据/多段串。
  // 若上游确认新口径是空格串，改这两处的 split 即可。
  // 旧版 `oa`（`:7943-7947`）：按 `_` 切分去空段，去掉最后一段后**再补回一个 `_`**；只有一段时返回空串。
  function progressPrefix(status: string): string {
    if (!status) return ''
    const parts = status.split('_').filter((p) => p !== '')
    if (parts.length <= 1) return ''
    return parts.slice(0, -1).join('_') + '_'
  }

  // 旧版 `aa`（`:7948-7952`）：最后一段；全是空段时原样返回。
  function progressSuffix(status: string): string {
    if (!status) return ''
    const parts = status.split('_').filter((p) => p !== '')
    return parts.length ? parts[parts.length - 1] : status
  }

  // 旧版 `Yt` 分支的格子内容（`:11578-11582`）：色条 + 一行「`前段_` + **深红加粗末段**」+ `✓已付` 徽标。
  function renderProgress(row: OrderSummaryDto) {
    const status = row.production_status || ''
    const prefix = progressPrefix(status)
    return [
      h(
        'div',
        { class: 'progress-bar' },
        progressSegments(status, deps.manualActions).map((seg) =>
          h('div', {
            class: 'progress-seg',
            title: `${seg.label}${seg.done ? ' ✓' : ''}`,
            style: {
              flex: seg.flex,
              minWidth: '4px',
              background: seg.done ? seg.color : '#e0e0e0',
            },
          }),
        ),
      ),
      h('span', null, [
        // 旧版 `qu` 样式：`{font-weight:400}`。
        prefix ? h('span', { style: { fontWeight: '400' } }, prefix) : null,
        // 旧版 `Ju` 样式：`{color:#d9001b; font-weight:700}`。
        h('span', { style: { color: '#d9001b', fontWeight: '700' } }, progressSuffix(status)),
      ]),
      // 旧版 `Vo(row)` = 未收 **=== 0**（是 `===` 不是 `<=`，见 `:7664`）；徽标样式 `_u`。
      unpaidOf(row, deps.financeSummary.value) === 0
        ? h(
            'span',
            {
              style: {
                marginLeft: '4px',
                color: '#52c41a',
                fontSize: '10px',
                fontWeight: '700',
                verticalAlign: 'middle',
              },
            },
            '✓已付',
          )
        : null,
    ]
  }

  // ---------------------------------------------------------------------------
  // 单元格 hover tooltip（旧版 `sa`/`da`，`:7973-7985`）
  // ---------------------------------------------------------------------------
  /** 是否显示（旧版 `ra`）。 */
  const rowTipShow = ref(false)
  /** 内容（旧版 `ia`，那边存的是 HTML 串；我们用 VNode 渲染）。 */
  const rowTipLines = ref<{ text: string; done: boolean }[]>([])
  const rowTipPaid = ref(false)
  /** 提示元素本身 —— 位置**直接写它的 `style`**，不走响应式（见下）。 */
  const rowTipEl = ref<HTMLElement | null>(null)
  /** 首帧位置。只在**刚显示**那一下用；之后跟随鼠标都是直接改 DOM。 */
  const rowTipInitStyle = reactive({ left: '0px', top: '0px' })

  /**
   * 打单操作 / 客户两列 hover 时的进度提示（旧版 `sa`/`da`，`:7973-7985`）。
   *
   * ## 旧版行为
   * ```js
   * sa = (row, column, event) => { …… ca.x = event.clientX; ca.y = event.clientY; ra.value = true }
   * da = () => { ra.value = false }
   * ```
   * 内容为空时不显示（旧版 `n && (…)`）。
   *
   * ## ⚠️ 三处**有意偏离**（先前照着旧版做，用户实测报了三样毛病）
   *
   * ① **跟随鼠标**。旧版另有个 `Va`（`:7983`）就是干这个的
   *    （`ra.value && (ca.x = e.clientX, ca.y = e.clientY)`），但 **`Va(` 全文件零调用**——
   *    写了没接上。结果是提示只在鼠标**进入单元格那一刻**的位置出现、之后不动，
   *    鼠标一动就显得「挂在那儿」。这里把旧版的意图接上：**跟随鼠标**。
   *
   * ② **收起不再依赖单元格的 `mouseleave`**。先前把它挂在单元格内层 div 上，
   *    而 `rowTipShow` 一变 Home 就整体重渲染 ⇒ Naive 重建那一行 ⇒ **承载 `mouseleave`
   *    的节点被换掉**。节点被移除时浏览器**不会**补发 `mouseleave` ⇒ 提示**永远收不掉**。
   *    现在改为：显示期间挂一个 **document 级 `mousemove`**，每次移动检查指针是否还在
   *    触发格（`.tip-cell`）里，不在就收 —— 不管节点有没有被重建都能收尾。
   *
   * ③ **位置直接写 DOM，不走响应式**。先前坐标是 `reactive`，鼠标每动一次就触发一轮
   *    Vue 重渲染（整个表格跟着重渲）⇒ 卡顿。现在 `mousemove` 里只改 `el.style.left/top`，
   *    零重渲染。内容仍然走响应式（它变得少）。
   */
  function rowTipContent(row: OrderSummaryDto) {
    const segs = progressSegments(row.production_status, deps.manualActions)
    if (!segs.length && unpaidOf(row, deps.financeSummary.value) !== 0) return null
    return { lines: segs.map((s) => ({ text: s.label, done: s.done })), paid: unpaidOf(row, deps.financeSummary.value) === 0 }
  }

  /**
   * 把提示挪到鼠标处。
   *
   * ⚠️ **这是有意偏离**（2026-09-19 更正注释）：原写「和旧版 `Va` 的意图一致」——
   *   而旧版那个 `Va`（`Home.formatted.js:7983`）**全文件零调用，是死码**，
   *   所以旧版**根本不跟手**（位置只在进入单元格那一刻取一次）。
   *   我们是照它的「意图」实现的 ⇒ 行为与旧版不同，已按 ⚠️ 记在
   *   `docs/home-audit/00-summary.md` §五.2（**改回「不跟手」与否待拍板**）。
   */
  function moveRowTip(ev: MouseEvent) {
    const el = rowTipEl.value
    if (!el) return
    el.style.left = `${ev.clientX}px`
    el.style.top = `${ev.clientY}px`
  }

  /** 显示期间挂在 document 上的移动监听（一次性装上，收起时摘掉）。 */
  let rowTipMove: ((ev: MouseEvent) => void) | null = null

  function hideRowTip() {
    rowTipShow.value = false
    if (rowTipMove) {
      document.removeEventListener('mousemove', rowTipMove)
      document.removeEventListener('mouseleave', hideRowTip)
      rowTipMove = null
    }
  }

  /** 鼠标进入「客户」「打单操作」两列的单元格（旧版 `sa`）。 */
  function showRowTip(row: OrderSummaryDto, ev: MouseEvent) {
    const content = rowTipContent(row)
    if (!content) return
    rowTipLines.value = content.lines
    rowTipPaid.value = content.paid
    rowTipInitStyle.left = `${ev.clientX}px`
    rowTipInitStyle.top = `${ev.clientY}px`
    rowTipShow.value = true

    if (!rowTipMove) {
      rowTipMove = (e: MouseEvent) => {
        const t = e.target
        // 指针已经离开触发格（或跑出文档）⇒ 收掉。**不依赖节点还在**，所以重建也能收。
        // `e.target` 可能是 document/Window，`closest` 得先确认是 Element。
        if (!(t instanceof Element) || !t.closest('.tip-cell')) {
          hideRowTip()
          return
        }
        moveRowTip(e)
      }
      document.addEventListener('mousemove', rowTipMove, { passive: true })
      // 指针直接移出整个窗口时不会有 mousemove，再兜一层
      document.addEventListener('mouseleave', hideRowTip, { passive: true })
    }
  }

  /** 挂在「客户」「打单操作」两列单元格上的处理（`mouseleave` 只作兜底）。 */
  const rowTipHandlers = {
    onMouseenter: (row: OrderSummaryDto) => (ev: MouseEvent) => showRowTip(row, ev),
    onMouseleave: () => hideRowTip,
  }

  /**
   * 可编辑单元格：**常驻一个无边框输入框**（旧版 `订单备注`/`安装地址` `:11527-11531`、
   * `业务员`/`打单人` `:11583-11598`）。旧版**没有「先显示文本、点击才变输入框」这一态**：
   *
   * ```js
   * // 订单备注 / 安装地址（无条件）
   * <el-input type="textarea" autosize={{minRows:1,maxRows:3}} class="input-style"
   *           modelValue={row[字段]} onUpdate:modelValue={v => row[字段] = v} onFocus={() => nn(row)} />
   * // 业务员 / 打单人
   * qt ? <el-input class="borderless-input" onFocus={() => nn(row)} /> : <div style={la(值)}>…
   * ```
   *
   * `nn(row)`（`:8112-8114`）就是「进编辑态」：`za.value = row` 并把
   * 定金/订单备注/安装地址三个字段快照进草稿（`:8112-8114`）。`qt` 恒真，见上面那段说明。
   *
   * 所以这里也**始终**渲染输入框：
   *   · 非编辑态 → 显示行上的值，`onFocus` 进编辑态（旧版的 `onFocus={nn}`）；
   *   · 编辑态   → 绑定草稿。
   *
   * ⚠️ `onUpdate:value` 里要**先确保已进编辑态**再写草稿：极快的一次输入可能赶在
   *    `editingId` 触发的重渲染之前到达，那时 `draft` 还没快照过。先 `startEdit` 再写，两种情况都对。
   */
  function renderEditable(
    row: OrderSummaryDto,
    field: 'install_address' | 'remark' | 'salesperson' | 'creator_name',
  ) {
    const editing = deps.editingId.value === row.id
    // 旧版这两列是 `type="textarea"`、`autosize {minRows:1, maxRows:3}`、`class="input-style"`；
    // 业务员/打单人是单行 `el-input`、`class="borderless-input"`。
    const isTextarea = field === 'install_address' || field === 'remark'
    return h(NInput, {
      value: editing ? (deps.draft as unknown as Record<string, string>)[field] : row[field] || '',
      size: 'small',
      type: isTextarea ? 'textarea' : 'text',
      autosize: isTextarea ? { minRows: 1, maxRows: 3 } : undefined,
      borderless: true,
      class: isTextarea ? 'input-style' : 'borderless-input',
      onFocus: () => {
        if (deps.editingId.value !== row.id) deps.startEdit(row)
      },
      'onUpdate:value': (v: string) => {
        if (deps.editingId.value !== row.id) deps.startEdit(row)
        ;(deps.draft as unknown as Record<string, string>)[field] = v
      },
    })
  }

  /**
   * 列头筛选 popover（旧版「未付」`:11475-11508`、「打单操作」`:11534-11581`）。
   *
   * 结构逐字对齐旧版：
   * ```html
   * <div>                                        <!-- 列头容器 -->
   *   <span>列名</span>
   *   <el-popover placement="bottom" trigger="click" width="220">
   *     #reference <el-button text size="small"> 按钮名 (当前值) </el-button>
   *     #default
   *       <div>
   *         固定项…                               <!-- 每项 text 按钮，flex-start / 宽 100% -->
   *         分隔线                                <!-- 仅当有自定义项（旧版 `La.length`） -->
   *         自定义项…
   *         清除项                                <!-- 「全部显示 / 显示全部」，**无**选中色 -->
   *       </div>
   *   </el-popover>
   * </div>
   * ```
   *
   * ⚠️ 三处先前与旧版不符（C7/C8/C13/C14），别再改回去：
   *   ① **顺序**：旧版清除项「全部显示 / 显示全部」排在**最后**，先前放**最前**。
   *   ② **当前值回显**：旧版按钮后面带 ` (值)`（`:11481` / `:11541`），先前完全没有。
   *   ③ **popover 里没有标题**：旧版 `#default` 只有选项；先前多渲染了一行 `filter-title`。
   *   另：先前触发器自带一个 `▾`，旧版没有 —— 旧版靠 `text` 按钮自己的观感表示可点。
   *
   * ⚠️ **选中判定**：旧版比的是 `Mo`/`zo`，而「清除」时它俩被置成**空串** ⇒ 清除项**永不选中**，
   *    所以它连 `color`/`fontWeight` 两个条件都没有（`:11507` 那条 style 只有布局三项）。
   *    新版清除态用的是哨兵值（`'全部显示'` / `'显示全部'`，与选项文字同一个串），
   *    必须**显式排除**，否则没筛选时「全部显示」会一直高亮成蓝色加粗。
   *
   * ⚠️ 旧版每个选项的 `onClick` 都带 `.stop`（`:11491` 等的 `withModifiers(..., ["stop"])`）——
   *    列头在 el-table 里，不拦会冒泡到排序/筛选处理器。这里照抄 `stopPropagation`。
   */
  function headerFilter(opt: {
    /** 列名（旧版 `<span>未付</span>` / `打单操作`） */
    columnLabel: string
    /** 按钮上的名字（` 付款状态 ` / ` 生产进度 `） */
    buttonLabel: string
    /** 全部选项，**按旧版渲染顺序**（清除项在最后） */
    items: string[]
    /** 哪一项是「清除」（旧版 `bo`/`Po`：置空 + 关弹窗 + 回第 1 页） */
    clearLabel: string
    /** 在这一项**之前**插分隔线（旧版只在「有自定义项」时插；不传就不插） */
    dividerBefore?: string
    /**
     * 当前值那一段要不要高亮。
     * ⚠️ **两列不一样，别统一**：`打单操作` 的值包在
     *    `<span style="color:#409eff;font-weight:700;margin-left:4px"> (" 生产进度 " 的 `Ou`，`:11541`)；
     *    `未付` 的值是**裸文本节点**（`:11481`，无任何样式）。
     */
    highlightValue?: boolean
    current: Ref<string>
    show: Ref<boolean>
    onPick: (v: string) => void
    onClear: () => void
  }) {
    return () =>
      h('div', { class: 'header-filter' }, [
        h('span', null, opt.columnLabel),
        h(
          NPopover,
          {
            placement: 'bottom',
            trigger: 'click',
            width: 220,
            show: opt.show.value,
            'onUpdate:show': (v: boolean) => (opt.show.value = v),
          },
          {
            trigger: () =>
              h(
                NButton,
                { text: true, size: 'small' },
                // 当前值回显（旧版 `dr(779)`「 付款状态 」/ `dr(1216)`「 生产进度 」+ `" ("+值+") "`）
                {
                  default: () =>
                    opt.current.value
                      ? [
                          opt.buttonLabel,
                          opt.highlightValue
                            ? h(
                                'span',
                                { style: { color: '#409eff', fontWeight: '700', marginLeft: '4px' } },
                                ` (${opt.current.value}) `,
                              )
                            : ` (${opt.current.value}) `,
                        ]
                      : opt.buttonLabel,
                },
              ),
            default: () =>
              h(
                // 旧版选项容器 `Yu`(`:11485 区`) / `Hu`(`:11545 区`)：
                // `display:flex; flex-direction:column; gap:6px`
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                opt.items.flatMap((item) => {
                  const isClear = item === opt.clearLabel
                  // 清除项永不选中（见上方说明）
                  const active = !isClear && opt.current.value === item
                  const node = h(
                    'div',
                    {
                      class: 'filter-item',
                      style: {
                        // 旧版四项的布局完全一样，只有 color/fontWeight 分岔
                        justifyContent: 'flex-start',
                        width: '100%',
                        marginLeft: '0',
                        color: isClear ? undefined : active ? '#409eff' : '#606266',
                        fontWeight: isClear ? undefined : active ? '700' : '400',
                      },
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        opt.show.value = false
                        if (isClear) opt.onClear()
                        else opt.onPick(item)
                      },
                    },
                    item,
                  )
                  // 旧版 `<el-divider style="margin:4px 0"/>`，插在自定义项之前
                  return opt.dividerBefore === item
                    ? [h(NDivider, { style: { margin: '4px 0' } }), node]
                    : [node]
                }),
              ),
          },
        ),
      ])
  }

  return {
    renderProgress,
    rowTipShow, rowTipLines, rowTipPaid, rowTipEl, rowTipInitStyle, rowTipHandlers,
    renderEditable, headerFilter,
  }
}
