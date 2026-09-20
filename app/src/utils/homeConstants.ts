/**
 * Home 页的进度/选项常量 + 进度段构造 —— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）：
 *   · `Home.vue:495` —— `PROGRESS_OPTIONS`
 *   · `Home.vue:497-504` —— `PROGRESS_STEPS`（含其上方一行注释 497）
 *   · `Home.vue:515` —— `CUSTOM_SEGMENT_COLOR`（依据那行原属 506-511 的共用注释块，见下）
 *   · `Home.vue:517-518` —— `CUSTOM_SEGMENT_FLEX`（含其上方一行注释 517）
 *   · `Home.vue:520-536` —— `AUTOCOMPLETE_ALWAYS_SHOW`（含 520-535 整段 JSDoc）
 *   · `Home.vue:735` —— `EMPTY_FILTER_VALUE`
 *   · `Home.vue:2589-2590` —— `type ProgressSegment`（含其上方一行注释 2589）
 *   · `Home.vue:2592-2610` —— `progressSegments`
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（`homeConstants.ts` 那一条）。
 *
 * ⚠️ **下面这两条「依据」注释不是照抄来的**：`Home.vue` 里 506-511 那段注释描述的是
 *    **六个**常量（三个 `MANUAL_*` + `RECORD_DATE_KEY` + `CUSTOM_SEGMENT_COLOR` +
 *    `PROGRESS_FIXED_FILTERS`）。本文件只搬走了其中**两个**（颜色 / flex），
 *    另外四个仍留在 `Home.vue`（B11 / Task 13 处置）⇒ 引导语按本文件的实况**重写**，
 *    不整段照抄（照抄就是对剩下的四个做**假陈述**）。
 *
 * ⚠️ 名字相近、但**不在**本文件里的：`PROGRESS_CLEAR` / `EMPTY_FILTER_LABEL` /
 *    `MANUAL_ACTION_OPTIONS` / `MANUAL_ACTIONS_KEY` / `RECORD_DATE_KEY` /
 *    `PROGRESS_FIXED_FILTERS` —— 它们仍留在 `Home.vue`，别照着本文件的名字去猜。
 *    同理 `PAYMENT_OPTIONS` / `PAYMENT_CLEAR` 也不在这里。
 */
import type { Ref } from 'vue'

export const PROGRESS_OPTIONS = ['已打生产单', '未打生产单', '已订玻璃', '未订玻璃']

// 打单操作 5 固定步骤（§3 `ua`）：label + 完成色 + flex 比例。
export const PROGRESS_STEPS = [
  { label: '确认下单', color: '#389e0d', flex: 1 },
  { label: '生产单', color: '#d48806', flex: 2 },
  { label: '玻璃订单', color: '#096dd9', flex: 2 },
  { label: '标签', color: '#c41d7f', flex: 2 },
  { label: '收据单', color: '#237804', flex: 2 },
]

// 本文件这两个常量各自的依据（原 `Home.vue` 506-511 那段描述的是六个常量，搬过来的只有这两条）：
//   `dr(1012)`（`:7968`）= 自定义进度段的颜色
export const CUSTOM_SEGMENT_COLOR = '#531dab'
// `ua`（`:7964`）：自定义段总 flex = 3（5 个固定段 1+2+2+2+2 = 9，合计 12）。
export const CUSTOM_SEGMENT_FLEX = 3

/**
 * Naive 的 `n-auto-complete` **默认「框里有值才弹」** —— `getShow` 缺省是 `!!value`
 * （`naive-ui/es/auto-complete/src/AutoComplete.mjs` 的 `mergedShowOptionsRef`），
 * 所以空框聚焦时什么都不显示。
 *
 * 旧版用的是 `el-autocomplete`，**聚焦即弹**：Home 里三处（`:12058` 客户编辑弹窗、
 * `:12097` 手动更新进度的「操作名称」、`:12141` 查询订单的「客户」）前两处逐字写了
 * `"trigger-on-focus":!0`，第三处没写 —— 而 Element Plus 这个 prop 的默认值就是 `true`
 * （`element-plus/es/components/autocomplete/src/autocomplete.mjs`，`triggerOnFocus.default = true`）。
 * 又因为 `Sa`/`jl` 在查询词为空时回的是**全量候选**（`Sa`：`e ? o.filter(...) : o`），
 * 旧版点进空框就能看到整份下拉。
 *
 * 传 `() => true` 把这层补回来。**不会**导致面板乱弹：Naive 真正决定显隐的是
 * `active = 本函数 && 聚焦中(canBeActivated) && 有候选`，失焦、选中、点面板外都会把它关掉；
 * 查询词滤不出候选时面板同样不弹（Naive 比旧版少一个「空面板」的瞬间，属有意）。
 */
export const AUTOCOMPLETE_ALWAYS_SHOW = () => true

export const EMPTY_FILTER_VALUE = '__EMPTY__'

// 旧版 `ua`（`:7964-7970`）：5 固定段 + 自定义段（flex = 3/个数，色 `#531dab`）。
export type ProgressSegment = { label: string; color: string; flex: number; done: boolean }

export function progressSegments(status: string, manualActions: Ref<string[]>): ProgressSegment[] {
  const custom = manualActions.value
  const flex = custom.length > 0 ? CUSTOM_SEGMENT_FLEX / custom.length : 0
  return [
    ...PROGRESS_STEPS.map((step) => ({
      label: step.label,
      color: step.color,
      flex: step.flex,
      // 旧版 `:7967`：`确认下单` 段只看整串是否非空，不要求真的含「确认下单」四个字。
      done: step.label === '确认下单' ? status.length > 0 : status.includes(step.label),
    })),
    ...custom.map((label) => ({
      label,
      color: CUSTOM_SEGMENT_COLOR,
      flex,
      done: status.includes(label),
    })),
  ]
}
