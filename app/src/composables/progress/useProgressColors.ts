/**
 * Progress 订单进度页的**颜色口径**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）：`Progress.vue:828-997` —— **连续一段**，
 * 本段**全部**声明（14 个；拆分方案里的 **P2**）。段头那三行分区横幅（`// B. 颜色口径`）与
 * 段内所有注释**原样搬来**。
 *
 * 边界与内容怎么复量（这两个数字承重 ⇒ 命令写在这里）：
 *   `diff <(git show f097a9b1:app/src/views/Progress.vue | sed -n '828,997p' \
 *            | sed 's/^./  &/' | sed 's/procedures\.value/deps.procedures.value/g') \
 *          <(sed -n '58,227p' app/src/composables/progress/useProgressColors.ts)`
 *   应为空。那两个 `sed` 是这次搬迁**全部的差异**：前者 = 本文件给整段**统一加的 +2 缩进**
 *   （声明缩在工厂里；空行不动），后者 = 上面那唯一的注入改写。
 *   去掉第二个 `sed` 再跑，应当**恰好剩 3 行**（就是那三处改写）—— 多一行就说明边界或注释漂了。
 *   14 这个数怎么复量：数 `docs/progress-extract-movecheck.mjs` 里 P2 那条的 `names` + `consts`
 *   （守卫收尾打的「清单内 N 条」是**全清单**的，不是本块的）。
 *
 * 搬迁保真由 `docs/progress-extract-movecheck.mjs` 机核（P2 一条，参照 `f097a9b1`）。
 * ⚠️ **注释的保真不在那个守卫里**：`sliceFn` 从**声明**起切，注释不进任何切片
 *   ⇒ 它们的唯一来源是上面那条 `diff`，别拿「守卫绿」当它的证据。
 *
 * ⚠️ **注入 1 项**：`procedures`（页面 `ref`，`Progress.vue` 的 `ref<ProcedureSlotDto[]>([])`）
 *    —— 传 **ref 本身**、不是 `.value`：`nameColorMap` / `orderedProcedureNames` /
 *    `colorFilterOptions` 三个 `computed` 靠它响应式重算。
 *    **搬迁时唯一的文本改写**就是它：`procedures.value` → `deps.procedures.value`（段内 3 处，
 *    集中在上面那三个 `computed` 里），逐条登记在守卫的 `rewrites` 里；其余 11 个声明零改写。
 *    模块级依赖本文件直接 `import`（`computed` 从 `vue`、`DATE_RE` 从 `utils/progressCells`），
 *    **不走注入** —— 与 Home/Hui 已经这么搬过的那批同一口径（那批的名单由
 *    `docs/home-audit/{home,hui}-extract-movecheck.mjs` 的 `BLOCKS` 定义，这里不逐一点名：
 *    点名和 glob 一样会漂）。
 *
 * ⚠️ **本块拥有并借出的状态：无。** 段内没有一个 `ref` —— 三个 `computed` 都是**派生值**，
 *    源状态 `procedures` 仍归页面所有（本文件只读它，不写）。
 *
 * ⚠️ **声明缩在工厂里 ⇒ 一个都不带 `export`**（函数体内写 `export` 是 `TS1184`），全部由
 *    `return` 借出。`.vue` 只解构**真的在段外被引用**的那几个；其余留在返回值里是**有意的**：
 *    本块的产出面就是这 14 个，日后要用不必回来改本文件。
 *    ⚠️ 反过来，**解构了却不用**要撞 `noUnusedLocals`（`TS6133`）—— 所以要解构哪几个
 *      **不能照方案表格抄**，得按 `Progress.vue` 里的真实引用点数；复量它 = `vue-tsc` 干净
 *      （多解构一个没人用的进去必红 `TS6133` —— 实测方案那张表里就有一个是这样）。
 */
import { computed, type Ref } from 'vue'
import type { ProcedureSlotDto } from '../../api/types'
import { DATE_RE } from '../../utils/progressCells'

/** `useProgressColors()` 的注入面。**只放页面拥有的东西**（见文件头「注入 1 项」）。 */
export interface ProgressColorsDeps {
  /** 工序槽位（`GET /v1/procedures` 的 `slots`）：名字 + 颜色都从这儿来。 */
  procedures: Ref<ProcedureSlotDto[]>
}

/**
 * 颜色口径：进度串 → 底色/颜色键/筛选下拉项。
 *
 * ⚠️ **构造顺序**：`procedures` 要在调用**之前**声明好（它是页面 `ref`）。
 */
export function useProgressColors(deps: ProgressColorsDeps) {
  // ═══════════════════════════════════════════════════════════════════════════
  // B. 颜色口径（旧版 §5.3 的 `J` / `R` / `re` / `$`）
  // ═══════════════════════════════════════════════════════════════════════════
  /*
   * ★ 颜色来源**与旧版不同**：
   *   旧版 `procedure_name_color_map` = localStorage 里的 `{工序名: 颜色}`，全局键、按**名字**存；
   *   新版 = `GET /v1/procedures` 的 `slots[].color`（迁移 `0022`），按 **slot** 存。
   *   ⇒ 本页**不读写任何 localStorage**。
   *   ⇒ 匹配仍然按**工序名**（进度串里只有名字），所以要先摊成 `名字 → 颜色`。
   *     好处（旧版没有的）：改名不丢色（颜色挂在 slot 上）。
   */
  const UNPRODUCED_KEY = '__unproduced__'
  /** 旧版 `F`：去空白 + 小写。颜色键统一用它归一化。 */
  const normColor = (c: string) => (c || '').replace(/\s+/g, '').toLowerCase()
  const EMPTY_COLOR = '#b71c1c'

  /** 点了颜色筛但**颜色表里没命中**时，旧版按关键词兜底（与配置无关，照抄）。 */
  const BUILTIN_COLORS: [string, string][] = [
    ['#90EE90', '发货/收据单/回款'],
    ['#FFC0CB', '标签'],
    ['#87CEEB', '玻璃订单'],
    ['#FFFF99', '生产单'],
    ['#FFA500', '自助下单'],
  ]

  /** 名字 → 颜色（名和色都 trim 后非空才收；旧版 `procedure_name_color_map` 的写入侧也是这个规则）。 */
  const nameColorMap = computed(() => {
    const m = new Map<string, string>()
    for (const p of deps.procedures.value) {
      const name = (p.name || '').trim()
      const color = (p.color || '').trim()
      if (name && color) m.set(name, color)
    }
    return m
  })

  const slotNo = (slot: string) => {
    const m = slot.match(/(\d+)/)
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY
  }

  /**
   * 工序名列表，**按槽号从大到小** —— 这是旧版 `procedure_name_order_list` 的**等价物**。
   *
   * ⚠️ **旧版那个 localStorage 键新版不存在**（`docs/2026-09-19-qrscanner-analysis.md` §4.3：
   *    它是 `/Qrscanner` 保存时写的 `[工序名,…]`，**按槽号升序、且不含工序10**）。旧版 `J()` 的用法是
   *    「**从后往前**找第一个 `进度串.includes(名字)`」⇒ 等价于「**按槽号从高到低**找第一个命中的名字」。
   *    所以这里直接把 `procedures` 按槽号**降序**排 —— 与旧版 order_list 的实际效果一致，
   *    且**不排掉工序10**（新版已去掉「回款→工序10」的全部特判，见文件头「有意偏离」）。
   *
   *    旧版在 order_list **为空**时还有一条「取日期最大那一段再按名字长度倒序匹配」的退路 ——
   *    这里保留（`latestSegment`），只是新版有工序名时走不到它。
   */
  const orderedProcedureNames = computed(() =>
    deps.procedures.value
      .filter((p) => (p.name || '').trim())
      .slice()
      .sort((a, b) => slotNo(b.slot) - slotNo(a.slot))
      .map((p) => p.name.trim()),
  )

  /**
   * 旧版 `J()` 里那条退路用的辅助：取「日期最大的那一段」（日期全同取最后一段，都没日期也取最后一段）。
   * 空串/无段返回 `''`。
   */
  function latestSegment(text: string): string {
    const t = typeof text === 'string' ? text.trim() : ''
    if (!t) return ''
    if (!t.includes('➞')) return t
    const segs = t
      .split('➞')
      .map((x) => x.trim())
      .filter(Boolean)
    if (segs.length === 0) return ''
    const dated = segs
      .map((part, index) => {
        const m = part.match(DATE_RE)
        return m ? { index, part, date: new Date(m[0]).getTime() } : null
      })
      .filter((x): x is { index: number; part: string; date: number } => !!x)
    if (dated.length === 0) return segs[segs.length - 1]
    if (dated.every((d) => d.date === dated[0].date)) return dated[dated.length - 1].part
    return dated.reduce((a, b) => (b.date > a.date ? b : a)).part
  }

  /** 旧版 `J()`：按配置表解析出**原始**颜色（没命中返回 `null`）。 */
  function resolveConfiguredColor(text: string): string | null {
    const names = orderedProcedureNames.value
    if (names.length > 0) {
      // 「从后往前找第一个命中」⇒ 上面已经按槽号降序排好了，正序扫即可
      for (const n of names) {
        const c = nameColorMap.value.get(n)
        if (c && text.includes(n)) return c
      }
      return null
    }
    // 退路：一个工序名都没配 ⇒ 取「日期最大那一段」，颜色表的 key 按**长度倒序**匹配
    const seg = latestSegment(text)
    if (!seg) return null
    const keys = [...nameColorMap.value.keys()].sort((a, b) => b.length - a.length)
    for (const k of keys) if (seg.includes(k)) return nameColorMap.value.get(k) || null
    return null
  }

  /** 旧版 `R()`：**归一化**的颜色键；空串 → `#b71c1c`；都没命中 → `''`。 */
  function colorKeyOf(text: unknown): string {
    const s = typeof text === 'string' ? text.trim() : text == null ? '' : String(text).trim()
    if (!s) return normColor(EMPTY_COLOR)
    const c = rawColorOf(s)
    return c ? normColor(c) : ''
  }

  /** 旧版 `R()`/`re()` 共用的「原始颜色」解析（配置表 → 5 个关键词兜底 → 空）。 */
  function rawColorOf(s: string): string {
    const hit = resolveConfiguredColor(s)
    if (hit) return hit
    if (s.includes('发货')) return '#90EE90'
    if (s.includes('收据单') || s.includes('回款')) return '#90EE90'
    if (s.includes('标签')) return '#FFC0CB'
    if (s.includes('玻璃订单')) return '#87CEEB'
    if (s.includes('生产单')) return '#FFFF99'
    if (s.includes('自助下单')) return '#FFA500'
    return ''
  }

  /**
   * 旧版 `re()`：**整格**的样式（不是内容）——
   * 空进度 ⇒ 红底白字粗体；命中 ⇒ 该色底 + 粗体；都没命中 ⇒ 只有 `padding`。
   * ⚠️ 旧版挂在 `el-table` 的 `cell-style`，只对「生产进度」列生效 ⇒ 这里走 naive 的 `cellProps`。
   */
  function progressCellStyle(text: unknown) {
    const s = typeof text === 'string' ? text.trim() : text == null ? '' : String(text).trim()
    if (!s) return { backgroundColor: EMPTY_COLOR, color: '#fff', fontWeight: 'bold' }
    const c = rawColorOf(s)
    return c ? { backgroundColor: c, fontWeight: 'bold' } : {}
  }

  /** 旧版 `ue`：**所有**格都拿 `padding:1px`；「生产进度」再叠底色。 */
  const cellPad = () => ({ style: { padding: '1px' } })

  /**
   * 旧版 `$`（「颜色筛选」下拉项）：`未生产` + 5 个内置关键词色 + **颜色表里出现过的颜色**，
   * 同色合并、`label` = 该色下所有工序名用 `' / '` 连接（去重、按加入顺序）。
   *
   * ★ 第 2 项的来源改了：旧版从 localStorage 的 `procedure_name_color_map` 取，
   *   新版从 `GET /v1/procedures` 的 `slots[].color` 取（配置在 `/Qrscanner` 的「设置工序」里改）。
   */
  const colorFilterOptions = computed(() => {
    const map = new Map<string, { color: string; labels: Set<string> }>()
    const add = (color: string, label: string) => {
      const c = (color || '').trim()
      const n = (label || '').trim()
      if (!c || !n) return
      const k = normColor(c)
      if (!k) return
      if (!map.has(k)) map.set(k, { color: c, labels: new Set() })
      map.get(k)!.labels.add(n)
    }
    for (const [c, l] of BUILTIN_COLORS) add(c, l)
    for (const p of deps.procedures.value) add(p.color, p.name)
    return [
      { colorKey: UNPRODUCED_KEY, color: '#f44336', label: '未生产' },
      ...[...map.entries()].map(([k, v]) => ({
        colorKey: k,
        color: v.color,
        label: [...v.labels].join(' / '),
      })),
    ]
  })

  /*
   * 14 个**全部**回传 —— 本块的产出面就是它们。`.vue` 只解构段外真用到的那几个
   * （`computed` 类型的两个是 `ComputedRef`，模板/`columns` 侧按原样用，别在这儿取 `.value`）。
   */
  return {
    UNPRODUCED_KEY,
    normColor,
    EMPTY_COLOR,
    BUILTIN_COLORS,
    nameColorMap,
    slotNo,
    orderedProcedureNames,
    latestSegment,
    resolveConfiguredColor,
    colorKeyOf,
    rawColorOf,
    progressCellStyle,
    cellPad,
    colorFilterOptions,
  }
}
