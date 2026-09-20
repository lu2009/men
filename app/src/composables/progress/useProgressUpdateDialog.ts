/**
 * Progress 订单进度页的**「更新进度」弹窗**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）—— **三段，不是一个连续区间**
 * （拆分方案里的 **P3**，共 **82 行** = 13 + 9 + 60）：
 *   · `Progress.vue:420-432` —— `// ===== 更新进度 =====` 那三行分区横幅 + 7 个 `upd*` ref
 *     + `slotOptions` 上方那行 JSDoc
 *   · `Progress.vue:434-442` —— `slotOptions` + 空行 + `today()`
 *   · `Progress.vue:453-512` —— `updValue` / `openUpdateDialog` / `openUpdate` / `updTitle` /
 *     `submitUpdate`
 *   ⚠️ 中间 `433`（`const procedures`）与 `443-452`（空行 + `async function loadSlots` + 空行）
 *     **留在 `Progress.vue`** —— 它们是壳里的东西（`procedures` 被 P2 与 `loadSlots` 共用），
 *     不属于本块 ⇒ **删段必须是三段具名区间**，绝不是一整段 `sed '420,512d'`。
 *   ⇒ 本文件那 82 行是**拼接**出来的：`434-442` 之后直接接 `453-512`（中间留壳的 `loadSlots`
 *     被抽掉）⇒ 新家里 `today()` 的 `}` 后面**紧接** `updValue` 的 JSDoc、中间**没有空行**。
 *     那不是漏抄，是那两行本来就被 `loadSlots` 隔着。
 *
 * 边界怎么复量（R32 的动手前量法，两端各看一眼）：
 *   `REF:419` 空行 · `REF:420` = 本段横幅 · `REF:432` 是 `procedures` 的 JSDoc（`433` 是它本体）
 *   `REF:512` 空行 · `REF:513` 已是 P4 的横幅（`// ===== 行内「删除」（§4.3）=====`）
 *   命令：`git show f097a9b1:app/src/views/Progress.vue | sed -n '418,421p'`
 *        `git show f097a9b1:app/src/views/Progress.vue | sed -n '510,514p'`
 *
 * 搬迁保真由 `docs/progress-extract-movecheck.mjs` 机核（P3 一条，参照 `f097a9b1`）。
 * ⚠️ **注释的保真不在那个守卫里**（`sliceFn` 从**声明**起切，横幅与段内注释不进切片）——
 *   它的唯一证据是「三段与 REF 同区间逐字节比」，别拿「守卫绿」当它的证据。
 *
 * ⚠️ **注入 4 项**（都是页面拥有的东西；**传 ref / 函数本身，不是 `.value` 副本**）：
 *   · `procedures`（**只读**）—— 页面 `ref<ProcedureSlotDto[]>([])`。本块两个 `computed`
 *     靠它响应式重算（`slotOptions` 的候选、`updValue` 的拼接）。
 *     ⚠️ 它**留壳**：本块只读不写（写它的是壳里那个 `loadSlots`）。
 *   · `selectedRows` —— 页面 `computed(() => rows.value.filter((r) => r.isSelected))`。
 *   · `message` —— 页面 `useMessage()`（成功 / 失败两种提示）。
 *   · `load` —— 页面 `async function load()`。⚠️ **这一项是派活清单上没有的**：清单只写了
 *     `procedures` / `selectedRows` / `message`，而 `submitUpdate` 最后一句是 `await load()`
 *     （REF 505）—— 不注入就是 `TS2304`。计划里「P3 上游依赖（实测）」那一条漏了它
 *     （它同时被 P7a 依赖，「`load` 只在 P7a」那句话就是这么漏过去的）。
 *   模块级依赖（`api` 与类型 `ProcedureSlotDto` / `ProgressRowDto`）本文件**直接 import 不注入**。
 *
 * ⚠️ **搬迁时的文本改写 = 4 条规则、命中 7 处**（逐条登记在守卫的 `rewrites` 里）：
 *   `procedures.value`(×2) · `selectedRows.value`(×2) · `message.`(×2) · `load()`(×1)。
 *   ⚠️ `load` 那条**带括号**是有意的（核心文件头「规则一律要带边界」：裸名会顺手打到
 *     `loadedIds` 这类名字上）。
 *   复量法：`applyRewrites` 的 `from` 在文本里找不到就**抛** ⇒ 上面这 7 个计数一旦漂了，
 *   守卫直接红（不是静默放过）。
 *
 * ⚠️ **回传 14 项 = 本块声明的全部**（`today` 也在内，理由同 P2：本块的产出面就是这 14 个，
 *   日后别的块要用 `today` 不必回来改本文件 —— 方案那句「别的块要用就从 `utils` 取」是
 *   条件句，`utils` 里目前并没有它）。
 *   ⚠️ **`Progress.vue` 侧只解构段外真有活读者的 11 个**：模板
 *     `264`（`updOpen` `updTitle`）`268`（`updSlot` `slotOptions`）`272`（`updOperator`）
 *     `276`（`updDate`）`278`（`updValue`）`282`（`updOpen`）`283`（`updSaving` `submitUpdate`）
 *     + `columns` 的 `openUpdate`(879) + `openBatchUpdate` 的 `openUpdateDialog`(1203)。
 *     ⚠️ `updOpen` / `updSlot` / `updOperator` / `updDate` 在模板里是 `v-model` 的**写**
 *       ⇒ **必须解构**：写成 `d.updOpen` 会退化成普通属性赋值，**把 ref 对象整个换成字符串**
 *       （**静默**，弹窗再也不响应）。
 *     ⚠️ 另 3 个（`updTarget` `updBatch` `today`）段外**代码里**零引用 —— 解构了就是死局部
 *       （`TS6133`）。方案给的「回传」那张表把 `updTarget` / `updBatch` 也列进去了，
 *       实测两者段外一次都没有（`updTarget` 只在一条注释里出现过）⇒ 照表面抄会红。
 *
 * ⚠️ **构造顺序（本块与 P2 不同的一处）**：`selectedRows` 在 REF **1408**，比本段晚近 900 行
 *   ⇒ `.vue` 里那句 `useProgressUpdateDialog({…})` **不能**放在本段的原位置上
 *   （那会 `TS2448`「Block-scoped variable used before its declaration」，运行期是 TDZ）
 *   ⇒ 它放在 `selectedRows` 的声明**之后**，本段的原位置只留一段指路注释
 *   （与 `Home.vue` 对 `useHomeManualProgress` 的处理同一形状）。
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { MessageApi } from 'naive-ui'
import { api } from '../../api/client'
import type { ProcedureSlotDto, ProgressRowDto } from '../../api/types'

/** `useProgressUpdateDialog()` 的注入面。**只放页面拥有的东西**（见文件头「注入 4 项」）。 */
export interface ProgressUpdateDialogDeps {
  /** 工序槽位（`GET /v1/procedures` 的 `slots`）。**本块只读**（写它的是壳里的 `loadSlots`）。 */
  procedures: Ref<ProcedureSlotDto[]>
  /** 页面勾选行（派生于行上的 `isSelected`）—— 「批量更新」的条数从这儿来。 */
  selectedRows: ComputedRef<ProgressRowDto[]>
  /** 提交成功 / 失败的提示。 */
  message: MessageApi
  /** 提交成功后重拉整表（页面 `load`）。 */
  load: () => Promise<void>
}

/**
 * 「更新进度」弹窗：单行与批量**共用同一个弹窗**，值是三段拼的 `工序名[_操作员]_YYYY-MM-DD`。
 *
 * ⚠️ **构造顺序**：`procedures` / `selectedRows` / `message` / `load` 都是 setup 顶层即时求值
 *    ⇒ 四者在调用 `useProgressUpdateDialog(...)` **之前**必须都已声明好（`selectedRows` 最晚）。
 */
export function useProgressUpdateDialog(deps: ProgressUpdateDialogDeps) {
  // ===== 更新进度 =====
  // 旧版是行内那颗「更新进度」链接开的弹窗；值是三段拼的 `工序名[_操作员]_YYYY-MM-DD`。
  // ⚠️ 服务端**不校验**这个格式（它只当字符串存），拼错了也是自己负责。
  const updOpen = ref(false)
  const updSaving = ref(false)
  const updTarget = ref<ProgressRowDto | null>(null)
  /** 批量模式（旧版 `O`）：勾选多行时开的是同一个弹窗，只换标题、改发一批 id。 */
  const updBatch = ref(false)
  const updSlot = ref<string | null>(null)
  const updOperator = ref('')
  const updDate = ref(today())

  /** 工序下拉：本租户配过的槽。没配名的槽**不给选**（旧版也是先丢掉空槽）。 */
  const slotOptions = computed(() =>
    deps.procedures.value.filter((p) => p.name.trim()).map((p) => ({ label: p.name, value: p.slot })),
  )

  function today() {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }
  /** 拼值：`工序名_操作员_日期`，操作员留空就省略那一段（旧版也是可省）。 */
  const updValue = computed(() => {
    const name = deps.procedures.value.find((p) => p.slot === updSlot.value)?.name || ''
    if (!name) return ''
    const parts = [name]
    if (updOperator.value.trim()) parts.push(updOperator.value.trim())
    parts.push(updDate.value.trim() || today())
    return parts.join('_')
  })

  /**
   * 打开「更新进度」弹窗。`r = null` ⇒ **批量模式**（旧版 `O=true`，标题换成
   * `批量更新进度 (n条)`、footer 不出现「收款/删除」那两颗）。
   *
   * ⚠️ 单行模式旧版有一道 `if (!row.单号) return ElMessage.warning("未开始生产的单无法更新进度")`
   *    —— 那颗链接本来就是 `v-if="单号"`，够不着，新版同样不加。
   */
  function openUpdateDialog(r: ProgressRowDto | null) {
    updBatch.value = r === null
    updTarget.value = r
    updSlot.value = null
    updOperator.value = ''
    updDate.value = today()
    updOpen.value = true
  }

  function openUpdate(r: ProgressRowDto) {
    openUpdateDialog(r)
  }

  /** 弹窗标题：旧版 `O.value ? "批量更新进度 (" + ea + "条)" : "更新进度"`。 */
  const updTitle = computed(() =>
    updBatch.value ? `批量更新进度 (${deps.selectedRows.value.length}条)` : '更新进度',
  )

  async function submitUpdate() {
    const batch = updBatch.value
    const r = updTarget.value
    if (!batch && !r) return
    if (!updSlot.value || !updValue.value) return
    const ids = batch ? deps.selectedRows.value.map((x) => x.id) : [r!.id]
    if (!ids.length) return
    updSaving.value = true
    try {
      // 旧版批量时发的是**行 id**（槽 = 工序10）或**行级单号**（其余槽）——那是它服务端的分流口径。
      // 新版 `/v1/progress/update` **两种都收**（`line_ids` / `line_nos`，二选一取并集；
      // 见 `api.updateProgress` 的注释，以及分析文档 §10 去掉的「回款→工序10」特判）。
      // 这一页手里本来就是行 id ⇒ 继续发 id，与旧版那条批量路一致。
      await api.updateProgress({ slot: updSlot.value, value: updValue.value, lineIds: ids })
      updOpen.value = false
      // 成功提示照旧版分两种：批量「批量更新成功，共 N 条」/ 单行「进度已更新」。
      deps.message.success(batch ? `批量更新成功，共 ${ids.length} 条` : '进度已更新')
      await deps.load()
    } catch (e) {
      deps.message.error(e instanceof Error ? e.message : '更新失败')
    } finally {
      updSaving.value = false
    }
  }

  /*
   * 14 个**全部**回传 —— 本块的产出面就是它们（同 P2 的口径）。`.vue` 只解构段外
   * 真有活读者的那 11 个，见文件头；其余 3 个（`updTarget`/`updBatch`/`today`）段外零引用。
   */
  return {
    updOpen, updSaving, updTarget, updBatch,
    updSlot, updOperator, updDate, slotOptions,
    today, updValue, openUpdateDialog, openUpdate, updTitle, submitUpdate,
  }
}
