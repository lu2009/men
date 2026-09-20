/**
 * Progress 订单进度页的**列头交互**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）：`Progress.vue:998-1225`
 * （连续一整段，228 行，**14 个声明**）—— 拆分方案里的 **P5**。
 * 段内三段分区横幅（`// ═══ / // B. 列头交互 / // ═══` 与 `// ── B1.` / `// ── B2.`）
 * 连整段旧版原文注释一起搬来，工厂体内**与 REF 一字不差、相对顺序也不动**。
 *
 * 边界怎么复量（R32 动手前量法，两端各看一眼）：
 *   `REF:997` 是**上一段（P2 颜色口径）**的收尾、`REF:998` = 本段段首横幅的上横线
 *   ⇒ **起点 = 998**（写 999 会把上横线留在 `Progress.vue` 里当孤儿 —— 与 R38 同类的病）。
 *   `REF:1225` 空行、`REF:1226` 起已是 **B3「筛选链 + 分页」**（**P6**，Task 7 才搬）
 *   ⇒ 止点在 1225，不许多吃一行。
 *   命令：`git show f097a9b1:app/src/views/Progress.vue | sed -n '995,1000p'` ·
 *        `… | sed -n '1223,1228p'`。
 *
 * 搬迁保真由 `docs/progress-extract-movecheck.mjs` 机核（P5 一条，参照 `f097a9b1`）。
 * ⚠️ **横幅与段内注释的保真不在那个守卫里**（`sliceFn` 从**声明**起切，它们根本不进切片）——
 *   唯一证据是「整段与 REF 同区间逐字节比」，别拿「守卫绿」当它的证据。
 *
 * ⚠️ **注入 7 项**（本块在页面上够不着的 7 个名字；**传 ref / 函数本身，不是 `.value` 副本**）：
 *   · `page`（REF 368）—— 「改筛选 → 回第 1 页」那一跳，段内 **6 处**。
 *   · `rows`（REF 364）—— `confirmOrderNoQuery` 候选集的兜底分支（旧版 `Bo ? xo : oo`）。
 *   · `message`（REF 352）—— 「查不到「{关键字}」单号！」那句 warning。
 *   · `moreActive`（REF **1465**）/ `moreRows`（REF **1456**）—— 「查询更多」结果集，**P8** 拥有。
 *     ⚠️ 这两个在 REF 里**排在本块之后** ⇒ 见下面「调用点为什么后移」。
 *   · `colorKeyOf`（REF **933**）/ `colorFilterOptions`（REF **975**）—— **P2** 回传
 *     （`useProgressColors.ts`，Task 2 已搬）。
 *   ⚠️ **派活清单只写了 6 项、漏了 `colorKeyOf`**（R52 更正）—— 不注入就是 `TS2304`。
 *     本节以**实测**为准（真 TS 解析器：段内引用 ∩ 全文顶层声明 − 本块自己的声明，剥注释）。
 *   模块级依赖（`h`/`ref` 与类型 `VNodeChild`/`DataTableFilterState`/`MessageApi`/`ProgressRowDto`）
 *   本文件**直接 import 不注入**（与 `useProgressColors.ts` 等同一口径）。
 *
 * ⚠️ **搬迁时的文本改写 = 7 条规则、命中 12 处**（逐条登记在守卫的 `rewrites` 里）：
 *   `page.value`(×6) · `moreActive.value`(×1) · `moreRows.value`(×1) · `rows.value`(×1) ·
 *   `colorKeyOf(`(×1) · `message.warning`(×1) · `colorFilterOptions.value`(×1)。
 *   ⚠️ 规则一律**带边界**（核心文件头：「朴素 split/join，裸名会顺手打到别的标识符上」）：
 *     `colorKeyOf` 写成带左括号的 `colorKeyOf(`、`message` 写成 `message.warning`。
 *   ⚠️ **`rows.value` 与 `moreRows.value` 不构成子串关系**（差在 `Rows` 的**大写 R**，
 *     且 split/join 大小写敏感）⇒ 两条规则互不误伤。`page.value` 与页面的 `pageSize` 同理
 *     （本段内根本没有 `pageSize`）。
 *   ⚠️ 12 处命中**全部落在活代码里**（逐条核过；段内注释里一处都没有）⇒ 不存在
 *     「规则改到注释里、注释内容就漂了」的风险（P4 栽过的那一类）。
 *   复量法：`applyRewrites` 的 `from` 在文本里找不到就**抛** ⇒ 上面这些计数一旦漂了，守卫直接红。
 *
 * ⚠️ **`SEARCH_FIELDS` 的处理与其余 13 个不同**：它是**模块级常量**，必须放在工厂**外面**
 *   并 `export`（工厂体内写 `export` 是 `TS1184`）。
 *   ⚠️ 实测它**全部**引用点只有两处：**1213（定义）与 1273（P6 的 `filteredRows`）** ——
 *     **P5 自己一次都没用它** ⇒ 它落在本区间里纯粹是**位置**如此。
 *   归口照裁决：按「按块归口」归本文件，由 P6 `import { SEARCH_FIELDS } from './useProgressHeader'`，
 *   **不 `return` 出来当注入**。
 *   ⚠️ 顺带**重排**：REF 里它在 `progressHeader` 之后（区间末尾），这里提到工厂前面
 *     （它必须出工厂）。**工厂体内的相对顺序与 REF 一字不差。**
 *
 * ⚠️ **回传 7 项 = 本块 14 个声明里真的被段外消费的 7 个**（`SEARCH_FIELDS` 走 `export` 不走
 *   `return`；其余 6 个是本块内部件）。`.vue` 侧**7 个全解构**（都有段外活读者，一个不多一个不少
 *   —— 多一个就是死局部 `TS6133`）：
 *     模板 `182`(`onUpdateFilters`) ·
 *     P6 `filteredRows`(`matchesOrderNoOption` `orderNoFilterValues` `orderNoQuery` `colorFilter`) ·
 *     P6 `columns`(`matchesOrderNoOption` `orderNoFilterValues` `orderNoHeader` `progressHeader`)。
 *   ⚠️ **不回传、也不许解构的 6 个**：`columnFilterState` `orderNoInput` `orderNoPopShow`
 *     `orderNoRestoring` `confirmOrderNoQuery` `clearOrderNoQuery`
 *     —— 段外脚本 0 引用、模板 0 引用（R54 实测）。
 *     ⚠️ 但**它们不是「没用的」**：这 6 个在本块内部互相用（`orderNoHeader` 那个 popover 里的
 *       「清除」/「确认」按钮就是 `clearOrderNoQuery`/`confirmOrderNoQuery`）—— **别顺手删**。
 *     ⚠️ `columnFilterState` 在 `.vue` 的 `columns` 段里有一处**同名文字**，但那是一句**注释**
 *       （REF 1347「受控：`computed` 里读 `columnFilterState`…」）⇒ **不是活读者**
 *       （memory `grep-hits-are-usually-comments`：grep 命中 ≠ 活代码）。
 *
 * ⚠️ **调用点为什么后移**（壳侧那处 `useProgressHeader(...)` 不在本块原位置）：
 *   本块注入的 `moreRows`(REF 1456) / `moreActive`(REF 1465) 在 REF 里**排在本块之后**
 *   （它们属 P8）⇒ 把工厂调用放回原位置会**早读两个 TDZ 变量**（`TS2448`）。
 *   处置与 `useProgressUpdateDialog.ts` / Home.vue 的 `useHomeManualProgress` 同一套：
 *   **调用点后移到那两个声明之后，原位置留一段指路注释**。
 *   安全性：本块 7 个产出**全部只在 `computed` 体内或模板里被读**
 *   （`filteredRows` REF 1250 起 / `columns` REF ~1300 起都是 **lazy 的 computed**，
 *     模板更是在 setup 之后才求值）⇒ 调用后移对求值时机**零影响**。
 */
import { h, ref, type ComputedRef, type Ref, type VNodeChild } from 'vue'
import { NButton, NInput, NPopover, type DataTableFilterState, type MessageApi } from 'naive-ui'
import type { ProgressRowDto } from '../../api/types'

/**
 * `useProgressHeader()` 的注入面。**只放页面 / P2 / P8 拥有的东西**（见文件头「注入 7 项」）。
 *
 * ⚠️ **行类型**：`rows` / `moreRows` 直接写 `ProgressRowDto[]`，**本文件不另立 `ProgressRow`
 *   type**（那个 `ProgressRowDto & { isSelected: boolean }` 归 Task 5 的 `utils/progressRow.ts`）
 *   —— 本块只读 `单号` / `生产进度` 这些 DTO 字段，**从不碰 `isSelected`**
 *   （段内 0 处引用，实测）⇒ 结构上 `Ref<ProgressRow[]>` 传给 `Ref<ProgressRowDto[]>` 是
 *   合法协变赋值，`vue-tsc` 干净。
 */
export interface ProgressHeaderDeps {
  /** 分页页码（页面 `ref(1)`）—— 改筛选 / 查单号 / 清筛选都要「回第 1 页」，段内共 6 处。 */
  page: Ref<number>
  /** 全量行（页面 `ref<ProgressRow[]>([])`）—— `confirmOrderNoQuery` 候选集的兜底分支。 */
  rows: Ref<ProgressRowDto[]>
  /** 「查不到单号」的 warning（页面 `useMessage()`）。 */
  message: MessageApi
  /** 「查询更多」是否生效（P8，REF 1465）—— 生效时候选集取 `moreRows` 而不是 `rows`。 */
  moreActive: Ref<boolean>
  /** 「查询更多」的结果集（P8，REF 1456）。 */
  moreRows: Ref<ProgressRowDto[]>
  /** 颜色键归一（P2 `useProgressColors` 回传，REF 933）—— 候选集按颜色筛时用。 */
  colorKeyOf: (raw: string | null | undefined) => string
  /** 「颜色筛选」popover 的候选色块（P2 `useProgressColors` 回传，REF 975）。 */
  colorFilterOptions: ComputedRef<{ colorKey: string; color: string; label: string }[]>
}

/**
 * 搜索框命中的十个字段 —— **顺序与旧版逐字一致**
 * （旧版：`客户 日期 型材 安装地址 备注 单号 业务员 打单人 生产进度 回执单号`）。
 * ⚠️ 这里的键名按 `ProgressRowDto` 的真实字段写：后端 DTO 是英文列名（见 `api/types.ts`
 *    的 `OrderLineDto`），所以「型材」在这个 DTO 里叫 **`profile`** —— 其余九个恰好是中文键。
 *    别照抄旧版的中文 `型材`（那个键在 `ProgressRowDto` 上不存在，会静默筛不到东西）。
 */
export const SEARCH_FIELDS = [
  '客户',
  '日期',
  'profile',
  '安装地址',
  '备注',
  '单号',
  '业务员',
  '打单人',
  '生产进度',
  '回执单号',
] as const satisfies readonly (keyof ProgressRowDto)[]

/**
 * 列头交互（旧版「单号」列表头筛 + 「查单号」popover + 「生产进度」列颜色筛选）。
 *
 * ⚠️ **构造顺序**：七个注入项都是 setup 顶层即时求值 ⇒ 调用本工厂之前它们必须都已声明好
 *   （`moreActive` 最晚，REF 1465）。见 `.vue` 里那段指路注释。
 */
export function useProgressHeader(deps: ProgressHeaderDeps) {
  // ═══════════════════════════════════════════════════════════════════════════
  // B. 列头交互
  // ═══════════════════════════════════════════════════════════════════════════

  // ── B1. 「单号」列：表头筛（有单号 / 空单号）+「查单号」popover ─────────────
  /*
   * 旧版 `filter-method: ga` + `filters:[{text:"有单号",…},{text:"空单号",…}]`：
   *
   *   ga = (value, row) =>
   *     value === '有单号' ? (row.单号 && row.单号.toString().trim() !== '')
   *                       : (value !== '空单号' || (!row.单号 || row.单号.toString().trim() === ''))
   *
   * ⚠️ 第二个分支的写法（`value !== '空单号' || …`）等价于「**不是空单号这个选项** 就放行」，
   *    也就是「选了未知选项不筛」。照抄，别化简。
   */
  function matchesOrderNoOption(value: string | number, r: ProgressRowDto): boolean {
    if (value === '有单号') return !!r['单号'] && String(r['单号']).trim() !== ''
    return value !== '空单号' || !r['单号'] || String(r['单号']).trim() === ''
  }

  // 受控写法，与 `views/Home.vue:852-865` 同一套路：naive 2.45 的 n-data-table **没有表级
  // `filters` prop**，受控只能落在列的 `filterOptionValues` 上；每次变更回抛**整个**筛选状态。
  const columnFilterState = ref<DataTableFilterState>({})
  function onUpdateFilters(state: DataTableFilterState) {
    columnFilterState.value = { ...state }
    deps.page.value = 1
  }
  function orderNoFilterValues(): (string | number)[] {
    const v = columnFilterState.value['单号']
    if (v == null) return []
    return Array.isArray(v) ? [...v] : [v]
  }

  // 「查单号」（旧版 `ca` = 输入框、`Va` = 已生效的关键字、`wa` = popover 开关、`da` = 「恢复中」闪一下）
  const orderNoInput = ref('')
  const orderNoQuery = ref('')
  const orderNoPopShow = ref(false)
  const orderNoRestoring = ref(false)

  /**
   * 「确认」/ 输入框回车（旧版 `ya`）。
   *
   * ① **补年份后缀**：输入里若没有 `-两位数字`（`/-\d{2}\b/`）就补 `-` + 当前年份后两位。
   *    ⚠️ 与 `views/Home.vue:2262` 同一套规则（Home 的「查单号」是另一个函数，但正则/后缀一致）。
   * ② 候选集 = 已过「单号列筛 `ia`」「颜色筛 `Z`」的行（旧版 `ya` 里 `a` 就是这么构造的）
   *    —— **不含**搜索框那一步。⚠️ 这是**旧版原样**（`ya` 里那两句只筛 `ia`/`Z`），
   *    不是「搜索框还没做」：搜索框已经做了（见 `filteredRows`），但这里**照旧版**不带上它 ——
   *    带上会让「查单号」的命中判定依赖当前搜索词，行为就和旧版不一样了。
   * ③ 没命中 → `warning("查不到「{关键字}」单号！")`，且**清空** `Va`（不留下一个筛不出东西的关键字）。
   * ④ 命中 → 写 `Va`、回第 1 页、关 popover。
   */
  function confirmOrderNoQuery() {
    const raw = orderNoInput.value.trim()
    const q = raw ? (/-\d{2}\b/.test(raw) ? raw : `${raw}-${String(new Date().getFullYear()).slice(-2)}`) : ''
    orderNoInput.value = q
    if (!q) {
      orderNoQuery.value = ''
      deps.page.value = 1
      orderNoPopShow.value = false
      return
    }
    // ⚠️ 候选集同样走 `Bo ? xo : oo`（旧版 `ya` 的第一句就是 `let a = (Bo.value ? xo.value : oo.value) || []`）
    //    —— 查出来的结果集生效时，「查单号」只在这个结果集里找，不去全量里捞。
    let pool = deps.moreActive.value ? deps.moreRows.value : deps.rows.value
    const sel = orderNoFilterValues()
    if (sel.length) pool = pool.filter((r) => sel.some((v) => matchesOrderNoOption(v, r)))
    if (colorFilter.value) pool = pool.filter((r) => deps.colorKeyOf(r['生产进度']) === colorFilter.value)
    const key = q.toLowerCase()
    const hit = pool.some((r) => String(r['单号'] ?? '').toLowerCase().startsWith(key))
    if (!hit) deps.message.warning(`查不到「${q}」单号！`)
    orderNoQuery.value = hit ? q : ''
    deps.page.value = 1
    orderNoPopShow.value = false
  }

  /**
   * 「清除」（旧版 `ma`）：先置 `da=true`（按钮变红字「恢复中...」），**50ms 后**才真清，
   * 干完才 `da=false`。那个 `setTimeout(..., 50)` 是旧版原样（`:7741-7743` 同款），不是我们加的。
   */
  function clearOrderNoQuery() {
    orderNoRestoring.value = true
    setTimeout(() => {
      orderNoInput.value = ''
      orderNoQuery.value = ''
      deps.page.value = 1
      orderNoPopShow.value = false
      orderNoRestoring.value = false
    }, 50)
  }

  /** 「单号」列表头（旧版 `Ne` + `Be` + 内联样式，逐字照搬）。 */
  const orderNoHeader = (): VNodeChild =>
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', textAlign: 'center' } },
      [
        h('span', null, '单号'),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
          orderNoQuery.value
            ? h(
                NButton,
                { text: true, size: 'small', onClick: clearOrderNoQuery },
                {
                  default: () =>
                    // 旧版这里是 `<span style="color:red">恢复中...</span>`（`Me`）
                    orderNoRestoring.value
                      ? h('span', { style: { color: 'red' } }, '恢复中...')
                      : h('span', null, '清除'),
                },
              )
            : h(
                NPopover,
                {
                  show: orderNoPopShow.value,
                  'onUpdate:show': (v: boolean) => (orderNoPopShow.value = v),
                  placement: 'bottom',
                  trigger: 'click',
                  width: 240,
                },
                {
                  trigger: () => h(NButton, { text: true, size: 'small' }, { default: () => '查单号' }),
                  default: () =>
                    // 旧版这两层是内联样式（`ze`/`xe`），不是类 —— 这里也写内联
                    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
                      h(NInput, {
                        value: orderNoInput.value,
                        'onUpdate:value': (v: string) => (orderNoInput.value = v),
                        size: 'small',
                        placeholder: '可只输入单号“-”前数字即可，如199.',
                        clearable: true,
                        // 旧版 `onKeyup:withKeys(ya,["enter"])` —— naive 的 NInput 不接 `onKeyup`，
                        // 走 `inputProps` 透传到原生 input（同 `views/Home.vue:3008-3014`）。
                        inputProps: {
                          onKeyup: (e: KeyboardEvent) => {
                            if (e.key === 'Enter') confirmOrderNoQuery()
                          },
                        },
                      }),
                      h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }, [
                        h(NButton, { size: 'small', onClick: clearOrderNoQuery }, { default: () => '清除' }),
                        h(
                          NButton,
                          { type: 'primary', size: 'small', onClick: confirmOrderNoQuery },
                          { default: () => '确认' },
                        ),
                      ]),
                    ]),
                },
              ),
        ]),
      ],
    )

  // ── B2. 「生产进度」列：颜色筛选 popover ───────────────────────────────────
  /*
   * 旧版 `Z`（选中的颜色键）—— **不是** el-table 的列筛，而是一个自绘 popover（带色块）。
   * 所以这里**不用** naive 的 `filterOptions`（它是纯文字复选框，画不了色块），
   * 用「自己的 ref + 自己的 title popover」实现，过滤放在 `filteredRows` 里做。
   * ⚠️ 与「单号」列不同：那一列旧版用的是 el-table 原生 `filters` ⇒ 走 naive 的 `filterOptions`。
   */
  const colorFilter = ref('')

  const progressHeader = (): VNodeChild =>
    h('div', { class: 'progress-header-tools' }, [
      h('span', null, '生产进度'),
      h(
        NPopover,
        { placement: 'bottom', trigger: 'click', width: 320 },
        {
          trigger: () =>
            h(NButton, { text: true, size: 'small', class: 'progress-color-filter-btn' }, { default: () => '颜色筛选' }),
          default: () =>
            h('div', { class: 'progress-color-filter-panel' }, [
              h('div', { class: 'progress-color-filter-actions' }, [
                h(
                  NButton,
                  {
                    size: 'small',
                    onClick: () => {
                      colorFilter.value = ''
                      deps.page.value = 1
                    },
                  },
                  { default: () => '清除筛选' },
                ),
              ]),
              ...deps.colorFilterOptions.value.map((o) =>
                h(
                  'div',
                  {
                    key: o.colorKey,
                    class: ['progress-color-filter-item', { active: colorFilter.value === o.colorKey }],
                    onClick: () => {
                      colorFilter.value = o.colorKey
                      deps.page.value = 1
                    },
                  },
                  [
                    h('span', { class: 'progress-color-swatch', style: { backgroundColor: o.color } }),
                    h('span', { class: 'progress-color-label' }, o.label),
                  ],
                ),
              ),
            ]),
        },
      ),
    ])

  /*
   * 7 个**全部**回传 —— 本块的产出面就是它们（同 P2/P3/P7 的口径）。
   * `SEARCH_FIELDS` 例外：它是模块级常量，由本文件 `export`，谁要谁 import。
   * 另外 6 个（`columnFilterState` / `orderNoInput` / `orderNoPopShow` / `orderNoRestoring` /
   * `confirmOrderNoQuery` / `clearOrderNoQuery`）**只在本块内部用**，不回传。
   */
  return {
    matchesOrderNoOption, orderNoFilterValues, orderNoQuery, orderNoHeader,
    colorFilter, progressHeader, onUpdateFilters,
  }
}
