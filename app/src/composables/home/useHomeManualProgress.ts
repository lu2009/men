/**
 * 「手动更新进度 / 自定义进度项」+「审核确认」—— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）—— **三段，不是一个连续区间**：
 *   · `Home.vue:1121-1153` —— `confirmAudit`（含头顶 15 行 JSDoc：`1121-1135`）
 *   · `Home.vue:2340-2397` + `2409-2564` —— 手动进度的主体
 *     （⚠️ `2398-2408` 是 `legacyToday` 连它头上三行注释，**归 Task 4**，已搬去 `utils/homeDate.ts`
 *      ⇒ 本块的两段在 REF 里其实是被它**切开**的，不是连续的 `2340-2564`）
 *   · `Home.vue:506-518` 中属于本块的 4 个模块级常量（`MANUAL_ACTION_OPTIONS` /
 *     `MANUAL_ACTIONS_KEY` / `RECORD_DATE_KEY` / `PROGRESS_FIXED_FILTERS`）—— 那 13 行是
 *     「六个常量共用」的一段注释 + 6 个常量，其中 `CUSTOM_SEGMENT_COLOR` / `CUSTOM_SEGMENT_FLEX`
 *     归 Task 4（已随常量块一并归位到 `app/src/utils/homeConstants.ts`）。
 *     本文件带的这份注释在 Task 4 那一笔里已经改成「四个常量逐个有据」的真陈述，原样接下。
 *
 * ⚠️ **`1121-2564` 是一个连续区间，但中间 `1154-2339` 全是别的块的**（B2/B3/B4/B5/B6/B7/B9/B10）——
 *    **删段必须是三段具名区间，绝不是 `sed '1121,2564d'`**。方案 §3.1 的 B11 行把段写成一整段，
 *    与实测不符（判据：`2566-2568` 是「列定义」分区头 ⇒ `2566-2676` 划归 **B12**）。
 *    （按用户 2026-09-20 的令「不必写的文档不要写」，**本轮不改 `docs/`** —— 更正记在这里。）
 *
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（B11 一条）。
 *
 * ⚠️ **注入 3 项**：`message`（页面 `useMessage()`）· `load`（B1 `useHomeData` 回传）·
 *    `progressFilter`（**B3 `useHomeFilterView` 的 ref，本块要「写」它** —— 删掉的正是当前筛选项时
 *    把筛选清成「显示全部」）。传的是**那个 ref 本身**，不是 `.value` 副本（写副本＝白写）。
 *    模块级依赖（`api` / `pad` `localToday` `legacyToday` / 各类型）本文件**直接 import 不注入**
 *    —— 与 `useHomeSelection.ts` / `useOrderPrint.ts` 同一口径。
 *
 * ⚠️ **回传 16 项**（实测每一项在段外都有**活**读者：模板 227/235/239/240/241/245/246/247/252/261/262/
 *    270/272/273 · `columns` 1710/1828/1830/1857）—— 解构之后模板与 `columns` **一行都不用改**。
 *    `manualActions` 是段外**唯一**的跨块依赖：**B12**（`useHomeCellRender`）的 `progressSegments(status,
 *    manualActions)` 要它（现在还在 `Home.vue`，调用点两处）⇒ 必须回传，回的**是 ref 本身**。
 *    ⚠️ 页面侧**必须解构**，不许写成 `manual.manualName`：模板 245/246 是**写**（`@update:value` /
 *    `@select`）⇒ 属性访问会退化成普通属性赋值，**把 ref 对象整个换成字符串**（**静默**）——
 *    输入框失去响应式、`manualNameOptions` 不再跟着变。
 *
 * ⚠️ **四个 localStorage 触点全部只在「建立时」读一次，全文件没有任何 `watch`/`watchEffect`/
 *    `onMounted` —— 这是既有行为，别好心加 watcher**（加了就是行为变化）：
 *    `readManualActions`（`manualActions` 的初值）· `manualRecordDate` 的初值 ·
 *    `saveManualActions`（写）· `onRecordDateChange`（写）。
 *    实测：REF 全文件 `watch` 只在 B3 两处、`onMounted` 只在 B1 一处，本块一处都没有。
 *    （`manualRecordDate` 是「持久化偏好」：从未设置过 ⇒ false；存过 `"1"` ⇒ 勾上 —— **不是**
 *    每次默认勾选。）
 */

import { computed, ref, type InputHTMLAttributes, type Ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { OrderHeadInput, OrderSummaryDto } from '../../api/types'
import { legacyToday, localToday, pad } from '../../utils/homeDate'

// ---------------------------------------------------------------------------
// 本块四个模块级常量的依据（旧版 §4.7，审计 G3–G11/B30/C12）
// ---------------------------------------------------------------------------
// 「手动更新进度」弹窗 + 自定义进度项。以下**四个**常量逐个有据：
//   `Na`（`:8036`）      = autocomplete 的 4 个固定候选
//   `wr`（`:7568`）      = localStorage 键：自定义操作项数组
//   `gr`（`:7568`）      = localStorage 键：`记录日期` 持久化偏好
//   `Bo`（`:7673`）      = 「打单操作」列头 popover 的 4 个固定项（新版把「显示全部」并进了同一个列表）
// ⚠️ 这段注释**原文描述的是六个常量**。第六行（`dr(1012)` = 自定义进度段的颜色）与后面 `ua` 那行
//    **已随 `CUSTOM_SEGMENT_COLOR` / `CUSTOM_SEGMENT_FLEX` 归位到 `app/src/utils/homeConstants.ts`**
//    （2026-09-20，纯搬迁）—— 「四个」就是照此改的，别再当回那份「六个常量」的原文。
//
// ⚠️ 这四个常量在 REF 里是 `<script setup>` 顶层（每实例一份），搬到本文件后成了**模块级**
//    （每模块一份）。四者都是**不可变字面量**（两个字符串 + 两个数组字面量，全文件零处重新赋值）
//    ⇒ 单例页面下**无可观测差异**。这是有意选择，不是顺手。
const MANUAL_ACTION_OPTIONS = ['玻璃订单', '生产单', '收据单', '确认生产']
const MANUAL_ACTIONS_KEY = 'home_manual_progress_actions'
const RECORD_DATE_KEY = 'home_manual_progress_record_date'
const PROGRESS_FIXED_FILTERS = ['已打生产单', '未打生产单', '已订玻璃', '未订玻璃']

/** `useHomeManualProgress()` 的注入面。**只放页面拥有的东西**（见文件头）。 */
export interface HomeManualProgressDeps {
  /** 提交/删除进度的提示 + `confirmAudit` 的成功/失败提示。 */
  message: MessageApi
  /** 提交/删除成功后重拉订单（B1 `useHomeData` 回传的 `load`）。 */
  load: () => Promise<void>
  /** B3 `useHomeFilterView` 的进度筛选 ref —— 本块**要写它**（删掉当前筛选项时清筛选）。 */
  progressFilter: Ref<string>
}

/**
 * 手动更新进度 / 自定义进度项（旧版 §4.7）+ 「审核确认」（旧版 `Ba`/`Ma`/`rn`）。
 *
 * ⚠️ **构造顺序**：`load`（B1）与 `progressFilter`（B3）都是 setup 顶层即时求值
 *    ⇒ 必须在 `useHomeData(...)` / `useHomeFilterView(...)` **之后**；
 *    而 B12（`useHomeCellRender`）要读本块借出的 `manualActions` ⇒ 必须在其**之前**。
 *    传早了拿到的是 `undefined`，且**不一定报错**。
 */
export function useHomeManualProgress(deps: HomeManualProgressDeps) {
  /**
   * 「审核确认」（旧版 `Ba`/`Ma`/`rn`，`:476268-476400`，审计 `02-actions.md` G2）。
   *
   * 旧版两步：① 把**下单日期改成今天**（`Ma` = 今天 → `rn()`，那条路会重算截止日期）；
   * ② `Hl("确认下单", [回执单号])` = `updataProgress`，把「确认下单」追加进进度串。
   *
   * ⚠️ 新版**不需要**手动重算截止日期 —— `due_date` 由 SQL 推导
   * （`orders/service.rs` 的 `HEADER_COLUMNS`：`order_date + production_days`），改日期自动跟随。
   * （旧版重算那一步算的是 `今天 + ceil((旧截止−旧日期)/天)`，而旧版 `截止 = 日期 + 生产天数`
   *  ⇒ 等价于「今天 + 生产天数」，与我们这条推导一致。2026-09-19 修掉了我们多算的那一天。）
   *
   * 进度串的追加沿用 `submitManualProgress` 那条既有通路（`headWithStatus` + `updateOrderHead`），
   * 不另开后端接口 —— 与「手动更新进度」写的是同一个字段。
   * 文案照旧版：成功 `dr(1279)`=「更新成功」。
   */
  async function confirmAudit(row: OrderSummaryDto) {
    try {
      await api.updateOrderHead(row.id, {
        ...headWithStatus(row, '确认下单'),
        // ⚠️ **必须用本地日期，不能用 `legacyToday()`** —— 那个走 `toISOString()`（UTC）。
        // 旧版 `:11425-11426` 用的是本地 `getFullYear/getMonth/getDate`。
        // 实测（`TZ=Asia/Shanghai`）：本地 2026-09-18 03:00 时，
        //   走 `legacyToday()` 写的是 **2026-09-17**（早一天，推导出的截止日期也跟着早一天）；
        //   走本地口径写的才是 2026-09-18。
        // ⇒ UTC+8 每天 00:00–08:00 点「审核确认」，日期与截止日期都会错一天。
        order_date: localToday(),
      })
      deps.message.success('更新成功')
      await deps.load()
    } catch (e) {
      deps.message.error((e as Error).message || '更新失败')
    }
  }

  // ---------------------------------------------------------------------------
  // 手动更新进度 + 自定义进度项（§3 `Ea`/`La`/`ua`；§4.7 `Ha`/`ln`/`on`/`Ua`/`Ia`/`Sa`/`Ta`/`Ya`/`Wa`）
  // ---------------------------------------------------------------------------
  // 旧版 `Ea`（`:8036`）：读 localStorage 的 JSON 数组，只留非空字符串；解析失败/非数组 ⇒ []。
  function readManualActions(): string[] {
    try {
      const raw = localStorage.getItem(MANUAL_ACTIONS_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    } catch {
      return []
    }
  }

  // 旧版是 `Vue.ref(立即求值)` —— 只在组件建立时读一次，不跨标签页同步。新版照此。
  const manualActions = ref<string[]>(readManualActions())

  // 旧版 `Ia`（`:8030`）：整数组回写。
  function saveManualActions() {
    localStorage.setItem(MANUAL_ACTIONS_KEY, JSON.stringify(manualActions.value))
  }

  // 旧版 `La`（`:8036`）：列头 popover 追加的自定义项 = 自定义项里不在固定表 `Bo` 里的那些。
  // （`Ua` 只挡 `Na` 的 4 项，`Ea` 里仍可能出现与 `Bo` 同名的项，所以这里要再滤一次。）
  const customProgressOptions = computed(() =>
    Array.from(new Set(manualActions.value.filter((v) => !PROGRESS_FIXED_FILTERS.includes(v)))),
  )

  // 旧版 `Ua`（`:8032`）：失焦/确认时把新名字入库；固定候选与已有项不重复入库。
  function rememberManualAction(name: string) {
    const v = name.trim()
    if (!v || MANUAL_ACTION_OPTIONS.includes(v) || manualActions.value.includes(v)) return
    manualActions.value.push(v)
    saveManualActions()
  }

  // 旧版 `Ya` 内联的删除逻辑（`:8044-8049`）：固定项一律 false。
  function forgetManualAction(name: string): boolean {
    const v = name.trim()
    if (!v || MANUAL_ACTION_OPTIONS.includes(v)) return false
    const before = manualActions.value.length
    manualActions.value = manualActions.value.filter((a) => a !== v)
    if (manualActions.value.length === before) return false
    saveManualActions()
    return true
  }

  // 弹窗状态（旧版 `ba`/`Da`/`Aa`/`ka`/`Pa`，`:8036-:8064`）。
  const manualShow = ref(false)
  const manualTarget = ref<OrderSummaryDto | null>(null)
  const manualName = ref('')
  const manualDate = ref<number | null>(null)
  // 旧版 `Pa = ref("1" === localStorage.getItem(gr))` —— 持久化偏好：
  // 从未设置过 ⇒ false；存过 "1" ⇒ 勾上。**不是**每次默认勾选。
  const manualRecordDate = ref(localStorage.getItem(RECORD_DATE_KEY) === '1')

  // 旧版 `value-format: "YYYY-MM-DD"` ⇒ 提交时拼进操作名的是 `YYYY-MM-DD` 串。
  function isoDate(ts: number): string {
    const d = new Date(ts)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  // 旧版 `Sa`（`:8041`）：候选 = 固定 4 项 + 自定义项，按**输入原值**（不 trim）`includes` 过滤。
  // 旧版给 Element Plus 的只有 `{value}`（它的 value 同时当显示文本）；Naive 的 autocomplete
  // 用 `label` 显示、选中回填的也是 `label`，故这里两者都填同一个串。
  const manualNameOptions = computed(() => {
    const all = [...MANUAL_ACTION_OPTIONS, ...manualActions.value]
    const q = manualName.value
    return (q ? all.filter((v) => v.includes(q)) : all).map((v) => ({ label: v, value: v }))
  })

  // 旧版 `Ta`（`:8040`）：失焦即入库。
  function onManualNameBlur() {
    rememberManualAction(manualName.value)
  }

  // 旧版 `Ya`（`:8042`）：在「操作名称」输入框上右键 = 删除自定义操作项。
  function onManualNameContextMenu(e: MouseEvent) {
    e.preventDefault()
    const v = manualName.value.trim()
    if (!v) {
      deps.message.warning('请先输入要删除的操作项')
      return
    }
    if (MANUAL_ACTION_OPTIONS.includes(v)) {
      deps.message.warning('固定项不允许删除')
      return
    }
    if (!forgetManualAction(v)) {
      deps.message.warning('未找到该自定义操作项')
      return
    }
    // 旧版 `Mo.value === l && Po()`：删掉的正是当前筛选值时清掉筛选（新版「清掉」= 显示全部）。
    if (deps.progressFilter.value === v) deps.progressFilter.value = '显示全部'
    manualName.value = ''
    deps.message.success('已删除自定义操作项')
  }

  // Naive 的 AutoComplete 不认 `onContextmenu` 顶层 prop，要走 `inputProps` 透传到内层 input。
  const manualNameInputProps: InputHTMLAttributes = { onContextmenu: onManualNameContextMenu }

  // 旧版 `Wa`（`:8057`）：`记录日期` 是持久化偏好，写 "1"/"0"。
  function onRecordDateChange(v: boolean) {
    manualRecordDate.value = v
    localStorage.setItem(RECORD_DATE_KEY, v ? '1' : '0')
  }

  // 旧版 `Ha`（`:8067`）：无回执单号 ⇒ warning 不开窗；开窗时重置操作名与日期（**不动** `记录日期`）。
  function openManualProgress(row: OrderSummaryDto) {
    if (!row.receipt_no) {
      deps.message.warning('当前行缺少回执单号，无法更新进度')
      return
    }
    manualTarget.value = row
    manualName.value = ''
    manualDate.value = legacyToday()
    manualShow.value = true
  }

  // 旧版 `tn`（`:8072`）：取消。
  function closeManualProgress() {
    manualShow.value = false
    manualTarget.value = null
    manualName.value = ''
  }

  // 旧版 `ln`（`:8079`）/`on`（`:8089`）：勾了「记录日期」就把日期拼在操作名后面（`param3`）。
  function manualProgressParam(): string {
    const name = manualName.value.trim()
    const date = manualDate.value
    return manualRecordDate.value && date != null ? `${name}${isoDate(date)}` : name
  }

  // `PATCH /orders/{id}` 是**整头覆盖**（后端 `update_head` 绑的是全字段），
  // 所以必须带上原行的全部头字段，只换 `production_status`。
  function headWithStatus(row: OrderSummaryDto, productionStatus: string): OrderHeadInput {
    return {
      client_code: row.client_code,
      client_name: row.client_name,
      phone: row.phone,
      brand: row.brand,
      order_date: row.order_date,
      production_days: row.production_days,
      deposit: row.deposit,
      remark: row.remark,
      salesperson: row.salesperson,
      // `order_no_set` 是服务端派生值，不回传（发过去也会被忽略）。
      install_address: row.install_address,
      production_status: productionStatus,
      creator_name: row.creator_name,
      lock_direction: row.lock_direction,
    }
  }

  // 旧版 `ln`（`:8074`）：确认 → `Hl(param3 = 操作名[+日期])` → 「进度更新成功」。
  // 旧版紧接着 `t["打单操作"] = o`（**整串覆盖**，不是追加），新版照此语义写 `production_status`。
  // 旧版的 `updataProgress` 是旧服务端不透明接口，新版后端没有对应端点 ⇒ 落到订单头字段。
  // TODO(未确认): 旧服务端 `updataProgress` 自身是否还会做合并/追加（旧版前端不刷新，看不到服务端结果），
  //               无法从 bundle 观测；新版按旧版**前端可见**的「整串覆盖」实现。
  async function submitManualProgress() {
    const row = manualTarget.value
    if (!row) return
    if (!row.receipt_no) {
      deps.message.error('缺少回执单号，无法更新进度')
      return
    }
    if (!manualName.value.trim()) {
      deps.message.warning('请先选择或输入操作名称')
      return
    }
    rememberManualAction(manualName.value)
    try {
      await api.updateOrderHead(row.id, headWithStatus(row, manualProgressParam()))
      deps.message.success('进度更新成功')
      closeManualProgress()
      await deps.load()
    } catch (e) {
      deps.message.error((e as Error).message || '更新进度失败')
    }
  }

  // 旧版 `on`（`:8088`）：删除 → `deleteProgressForFullOrder` → 「进度删除成功」，
  // 成功后从 `打单操作` 串里摘掉该段（处理 `x` / `x_` / `_x` 三种形态）。
  // 旧版对旧服务端最多重试 5 次；新版后端自洽，PATCH 即持久化 ⇒ 无重试（有意偏离，理由见上）。
  async function deleteManualProgress() {
    const row = manualTarget.value
    if (!row) return
    if (!row.receipt_no) {
      deps.message.error('缺少回执单号，无法删除进度')
      return
    }
    if (!manualName.value.trim()) {
      deps.message.warning('请先选择或输入要删除的操作名称')
      return
    }
    const param = manualProgressParam()
    let status = row.production_status
    if (status) {
      if (status === param) status = ''
      else if (status.includes(`_${param}`)) status = status.replace(`_${param}`, '')
      else if (status.includes(`${param}_`)) status = status.replace(`${param}_`, '')
    }
    try {
      await api.updateOrderHead(row.id, headWithStatus(row, status))
      deps.message.success('进度删除成功')
      closeManualProgress()
      await deps.load()
    } catch (e) {
      deps.message.error((e as Error).message || '删除进度失败')
    }
  }

  return {
    confirmAudit, customProgressOptions,
    manualShow, manualTarget, manualName, manualDate, manualRecordDate,
    manualNameOptions, manualNameInputProps, onManualNameBlur, onRecordDateChange,
    openManualProgress, closeManualProgress, submitManualProgress, deleteManualProgress,
    // ⚠️ 页面自己不用它（`Home.vue` 里只有 B12 的 `progressSegments(status, manualActions)` 读）
    //    —— 但 B12 还没搬，所以这一项**现下确实被页面读**，解构出来不会 TS6133。
    manualActions,
  }
}
