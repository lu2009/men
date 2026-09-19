/*
 * 生产分析看板（旧版 `ProductionDashboard`）的**纯口径层**。
 *
 * 依据 `docs/2026-09-19-progress-dashboard.md`（下称「看板文档」），逐条对着写。
 * 这里只放**可单测的纯函数**：不碰 echarts、不碰 DOM、不碰 Vue 响应式 ——
 * 差分台 `docs/progress-dashboard-logiccheck.mjs` 就是拿这个文件去和**旧版真代码**逐字节比的。
 *
 * ## 与旧版逐条对应的函数
 *
 * | 旧版 | 这里 | 文档 |
 * |---|---|---|
 * | `Me` 里的门数分类器 | `classifyDoor()` | §4 |
 * | `xe` | `computeFans()` | §5 |
 * | `Me` | `aggregateRows()` | §6 |
 * | `ke` | `aggregateRows()` + `countProduction()` | §7 |
 * | `fe` | `filterByTime()` | §3.1 |
 * | `Ue` | `buildTrend()` | §9.1 |
 * | `Ae` / `De` / `be` / `Pe` | `groupBy()` | §10.2 |
 * | `Se` | `buildProcedureGroups()` | §10.3 |
 * | `he` / `Ce` | `dateRangeOf()` / `dashboardTitle()` | §3.6 |
 *
 * ## 有意偏离旧版的地方（都在这一个文件里，别在别处再写一遍）
 *
 * 1. **「本周」按周一**（看板文档 §16④）。旧版是**周日** —— 那是 dayjs 默认 en locale
 *    （`weekStart=0`）的事故，不是决策。我们已有的 `DashboardBigScreen.vue` 也是周一，
 *    两个看板对「本周」给不同答案比丢一点保真更糟。
 * 2. **`日期` trim 后为空的行不进标题区间**（§16③）。旧版 `filter(e => e)` 只剔 falsy，
 *    夹具里的 `" "`（纯空格）会被 `sort()` 排到最前，标题变成 `生产分析看板 (  ~ 2026-09-20)`。
 * 3. **数量 / 平方数 / 金额一律先 `Number()` 再 `|| 0`**。旧版是裸 `|| 0`，
 *    遇到字符串（`数量:'3'`）会 `0 + '3'` → `"03"`，随后 KPI 卡的 `totalArea.toFixed(2)`
 *    直接 `TypeError` **整张卡渲染失败**（看板文档 §12 第 4 条，实跑证实）。
 *    新版后端 DTO 给的是数字，但让一个脏字段炸掉整个面板不值得 —— 这里兜住。
 *    ⚠️ 这是**有意偏离**，差分台里单列一条断言（夹具不放字符串，另有一条单独比）。
 */
import type { ProgressRowDto } from '../api/types'
import { getOriginalOpenDirection } from '../composables/useOpenDirection'

// ── 常量表（旧版 `@10374` / `@10425` / `@10569`，逐字照抄） ──────────────────

/** 平开门开向**全集**（14 项，旧版 `Ee`）。 */
export const SWING_DIRECTIONS = [
  '内左', '内右', '外左', '外右',
  '左锁内开', '右锁内开', '左锁外开', '右锁外开',
  '双开内开', '双开外开', '双开内左', '双开内右', '双开外左', '双开外右',
] as const

/** 单开（8 项，旧版 `Ne`）—— 扇数 = 数量。 */
const SINGLE_OPEN = [
  '内左', '内右', '外左', '外右',
  '左锁内开', '右锁内开', '左锁外开', '右锁外开',
] as const

/** 双开（6 项，旧版 `Be`）—— 扇数 = 2 × 数量。 */
const DOUBLE_OPEN = [
  '双开内开', '双开外开', '双开内左', '双开内右', '双开外左', '双开外右',
] as const

/** 移门扇数清单（**22 项**，旧版 `xe`/分类器里那段字面量数组）。 */
export const SLIDING_FAN_COUNTS = [
  '2轨2扇', '2轨3扇', '2轨4扇', '3轨2扇1纱', '3轨4扇2纱', '3轨3扇', '4轨4扇',
  '5轨5扇', '6轨6扇', '7轨7扇', '8轨8扇', '9轨9扇', '单轨单扇', '单轨2扇',
  '折叠2扇', '折叠3扇', '折叠4扇', '折叠5扇', '折叠6扇', '折叠7扇', '折叠8扇', '折叠9扇',
] as const

/** 扇数档位 → 每樘的门扇数（旧版 `xe` 里那串三元链，**全部 22 项都覆盖到了**）。 */
const FAN_MULTIPLIER: Record<string, number> = {
  '2轨2扇': 2, 单轨2扇: 2, 折叠2扇: 2,
  '2轨3扇': 3, '3轨3扇': 3, 折叠3扇: 3, '3轨2扇1纱': 3,
  '2轨4扇': 4, 折叠4扇: 4, '4轨4扇': 4,
  '3轨4扇2纱': 6, 折叠6扇: 6, '6轨6扇': 6,
  单轨单扇: 1,
  折叠5扇: 5, '5轨5扇': 5,
  折叠7扇: 7, '7轨7扇': 7,
  折叠8扇: 8, '8轨8扇': 8,
  折叠9扇: 9, '9轨9扇': 9,
}

/** 门数分类（旧版 `Me` 里内联的那个分类器，**互斥**，先中先赢）。 */
export type DoorKind = '平开门' | '移门' | '淋浴房' | '其它'

export interface StatsOptions {
  /** 「不含单玻」开关（旧版 `h`）。**只影响扇数**，不影响门数/平方/金额。 */
  excludeSingleGlass?: boolean
  /**
   * 开向归一化（旧版 `openDirectionNaming` 的 `g`）。默认取新版那份 composable ——
   * 注入口是给差分台留的（那边用真件 `legacy/js/openDirectionNaming-92dbc91d.js`）。
   */
  normalizeDirection?: (direction: string) => string
}

/*
 * ── 字段名映射（**不是口径改动**） ─────────────────────────────────────────
 * 旧版的行是旧服务端 `enrichDoorRow` 拼出来的**中文字段名**一坨（`数量`/`型材`/`扇数`/…）；
 * 新版的 `ProgressRowDto` = `OrderLineDto` 的**英文字段名** + 几个中文补充键
 * （`单号`/`客户`/`业务员`/`日期`/`安装地址`/`备注`/`工序N`/`生产进度`/`打单人`…）。
 * 下面这段公式是逐条照旧版抄的，所以留一层取值函数，让公式读起来还是旧版那个样子；
 * **映射依据是 `Progress.vue` 的列渲染**（`profileColorCell` / `fansDirectionCell` /
 * `amountCell` / `lightWindowCell` …），不是猜的：
 *
 *   旧 `数量` → `quantity` 、`平方数` → `square` 、`金额` → `amount` 、`型材` → `profile` 、
 *   `扇数` → `fans` 、`开向` → `direction` 、`底玻` → `bottom_glass` 、
 *   `亮窗总高` → `light_window_height` 、`轨道种类` → `track`。
 */
const qtyOf = (r: ProgressRowDto) => r.quantity
const areaOf = (r: ProgressRowDto) => r.square
const amountOf = (r: ProgressRowDto) => r.amount
const profileOf = (r: ProgressRowDto) => r.profile
const fansOf = (r: ProgressRowDto) => r.fans
const directionOf = (r: ProgressRowDto) => r.direction
const lightHeightOf = (r: ProgressRowDto) => r.light_window_height
const trackOf = (r: ProgressRowDto) => r.track

/** 旧版 `|| 0` 的加强版：先 `Number()` 再兜底（见文件头「有意偏离 3」）。 */
function numOr0(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function norm(direction: string | null | undefined, opts: StatsOptions): string {
  const f = opts.normalizeDirection ?? getOriginalOpenDirection
  if (!direction) return ''
  return f(direction)
}

/** 旧版 `ze`：开向（归一化后）落在 14 项平开清单里。 */
export function isSwingDirection(
  direction: string | null | undefined,
  opts: StatsOptions = {},
): boolean {
  if (!direction) return false
  return (SWING_DIRECTIONS as readonly string[]).includes(norm(direction, opts))
}

const has = (v: unknown, s: string) => !!v && String(v).includes(s)

/**
 * 门数分类（旧版 `Me` 内联分类器，**互斥**）。
 *
 * 优先级（先中先赢）：
 *   ① `扇数` ∈ 22 项移门清单 **且** `型材` 不含「哑口」 → 移门
 *   ② `扇数` ∈ {一固一活, 双活} **或** `型材` 含「钻石」  → 淋浴房
 *   ③ `型材` 不含「钻石」**且** `开向` 是平开方向     → 平开门
 *   ④ 其余                                        → 其它
 *
 * ⚠️ `开向` **只在第 ③ 条参与**，且必须同时不含「钻石」—— 钻石行的平开开向不算平开门。
 *    夹具 `扇数:'2轨2扇', 型材:'哑口', 开向:'内左'` 落进**平开门**（哑口排除了第 ① 条）。
 */
export function classifyDoor(row: ProgressRowDto, opts: StatsOptions = {}): DoorKind {
  const isYakou = has(profileOf(row), '哑口')
  if ((SLIDING_FAN_COUNTS as readonly string[]).includes(fansOf(row)) && !isYakou) return '移门'
  const isShowerByFans = fansOf(row) === '一固一活' || fansOf(row) === '双活'
  const isDiamond = has(profileOf(row), '钻石')
  if (isShowerByFans || isDiamond) return '淋浴房'
  if (!isDiamond && isSwingDirection(directionOf(row), opts)) return '平开门'
  return '其它'
}

/** 扇数 5 桶（旧版 `xe` 的返回结构）。 */
export interface FanBuckets {
  swingFans: number
  slidingFans: number
  showerFans: number
  otherFans: number
  brightFans: number
}

const ZERO_FANS: FanBuckets = {
  swingFans: 0,
  slidingFans: 0,
  showerFans: 0,
  otherFans: 0,
  brightFans: 0,
}

/**
 * 逐行扇数（旧版 `xe`）。**唯一吃「不含单玻」的地方。**
 *
 * ⚠️ 5 个桶**不是互斥的**：`swingFans` 与 `slidingFans` 是两个独立分支，
 *    一行可以同时进多个桶（夹具 `扇数:'单轨单扇', 开向:'内左'` → 平开 1 **且** 移门 1）。
 *    所以「总扇数」（5 桶相加）**可能大于**逐行数出来的扇数 —— 旧版算法如此，照抄。
 *
 * ⚠️ 「不含单玻」判定是 **`底玻 === "无"`（严格相等）**，只看 `底玻`。
 *    命中时该行 5 桶全归零，但**门数/平方/金额一行不变**（那三样在 `aggregateRows` 里，不看 `底玻`）。
 *    ⚠️ 别和打印文案里的「单玻」共用一个函数 —— 那是**另一个定义**
 *    （`底玻==='无' && 面玻!=='无'`，见看板文档 §5.3）。
 *
 * ⚠️ 旧版搬门分支里有一句 `e["型材"] && e["型材"]["includes"]("+0")` **空转**（求值后丢弃）。
 *    新版**不实现它** —— 那是死代码（看板文档 §5.4）。
 */
export function computeFans(row: ProgressRowDto, opts: StatsOptions = {}): FanBuckets {
  // ★ 「不含单玻」
  if (opts.excludeSingleGlass && row.bottom_glass === '无') return { ...ZERO_FANS }

  const qty = numOr0(qtyOf(row))
  const isYakou = has(profileOf(row), '哑口')
  const isSliding = (SLIDING_FAN_COUNTS as readonly string[]).includes(fansOf(row)) && !isYakou
  const isShowerByFans = fansOf(row) === '一固一活' || fansOf(row) === '双活'
  const isDiamond = has(profileOf(row), '钻石')
  const isSwing = isSwingDirection(directionOf(row), opts)
  const hasBright =
    numOr0(lightHeightOf(row)) > 0 &&
    !!trackOf(row) &&
    trackOf(row) !== 'NULL' &&
    trackOf(row) !== ''

  let swingFans = 0
  // 旧版是 `if (m || (三元), w)` —— **逗号运算符**：三元那段的副作用**总是**执行（`m` 为真时短路跳过），
  // 但 `if` 的真条件是 `w`（是否移门）。这里把它拆开写，别合并成一个 `if`。
  if (!isDiamond) {
    const dir = norm(directionOf(row), opts)
    if ((SINGLE_OPEN as readonly string[]).includes(dir)) swingFans = qty
    else if ((DOUBLE_OPEN as readonly string[]).includes(dir)) swingFans = 2 * qty
  }

  let slidingFans = 0
  if (isSliding) slidingFans = qty * (FAN_MULTIPLIER[fansOf(row)] ?? 1)

  const showerFans = isShowerByFans ? 2 * qty : isDiamond ? qty : 0
  const brightFans = hasBright ? qty : 0
  // 「其它扇」是**补集**（旧版 `!w && !v && !y && !m && !g`）。
  const otherFans = !isSliding && !hasBright && !isShowerByFans && !isDiamond && !isSwing ? qty : 0

  return { swingFans, slidingFans, showerFans, otherFans, brightFans }
}

/** 聚合结果（旧版 `Me` 返回的那个 21 字段对象，字段名逐字照抄）。 */
export interface Metrics {
  totalQuantity: number
  swingQuantity: number
  slidingQuantity: number
  showerQuantity: number
  otherQuantity: number
  totalArea: number
  swingArea: number
  slidingArea: number
  showerArea: number
  otherArea: number
  totalAmount: number
  swingAmount: number
  slidingAmount: number
  showerAmount: number
  otherAmount: number
  totalFans: number
  swingFans: number
  slidingFans: number
  slidingBrightFans: number
  showerFans: number
  otherFans: number
}

function emptyMetrics(): Metrics {
  return {
    totalQuantity: 0, swingQuantity: 0, slidingQuantity: 0, showerQuantity: 0, otherQuantity: 0,
    totalArea: 0, swingArea: 0, slidingArea: 0, showerArea: 0, otherArea: 0,
    totalAmount: 0, swingAmount: 0, slidingAmount: 0, showerAmount: 0, otherAmount: 0,
    totalFans: 0, swingFans: 0, slidingFans: 0, slidingBrightFans: 0, showerFans: 0, otherFans: 0,
  }
}

/**
 * 聚合器（旧版 `Me`）。
 *
 * ⚠️ **门数** 4 桶走 `if / else if` 链 ⇒ **互斥**，`totalQuantity` = 各桶之和。
 * ⚠️ **扇数** 5 桶来自 `computeFans` ⇒ **可叠加**；`totalFans` 是 5 桶**直接相加**。
 * ⚠️ `brightFans` 无条件累进 `slidingBrightFans`（「移门亮窗」桶）——
 *    该**行**的门数却可能落进「其它」⇒ 「按门数」饼和「按扇数」饼分解的不是同一批行。
 */
export function aggregateRows(rows: ProgressRowDto[], opts: StatsOptions = {}): Metrics {
  const m = emptyMetrics()
  for (const row of rows) {
    const qty = numOr0(qtyOf(row))
    const area = numOr0(areaOf(row))
    const amount = numOr0(amountOf(row))
    const kind = classifyDoor(row, opts)

    m.totalQuantity += qty
    m.totalArea += area
    m.totalAmount += amount
    if (kind === '平开门') {
      m.swingQuantity += qty; m.swingArea += area; m.swingAmount += amount
    } else if (kind === '移门') {
      m.slidingQuantity += qty; m.slidingArea += area; m.slidingAmount += amount
    } else if (kind === '淋浴房') {
      m.showerQuantity += qty; m.showerArea += area; m.showerAmount += amount
    } else {
      m.otherQuantity += qty; m.otherArea += area; m.otherAmount += amount
    }

    const f = computeFans(row, opts)
    m.swingFans += f.swingFans
    m.slidingFans += f.slidingFans
    m.slidingBrightFans += f.brightFans
    m.showerFans += f.showerFans
    m.otherFans += f.otherFans
  }
  m.totalFans =
    m.swingFans + m.slidingFans + m.slidingBrightFans + m.showerFans + m.otherFans
  return m
}

// ── 生产进度（旧版 `ke` 的 startedCount / notStartedCount） ────────────────

/**
 * 「这一行已进入生产吗」——**新版统一口径，全看板只有一个判定**。
 *
 * 🔴 **有意偏离旧版**（看板文档 §16③）：旧版同一块面板上有**两个相反的判定** ——
 *    · 「生产状态」筛选：`null !== 单号 && "" !== 单号` ⇒ `单号 === undefined` 或 `0` **算已生产**；
 *    · 「生产进度」卡：`filter(e => e['单号'])`（裸真值）⇒ 上面两种**算未生产**。
 *    于是筛选器筛出 1 行、卡片却写「已生产: 0」。这是瑕疵，不照抄。
 *
 * 新版取**页面「单号」列筛**的同一口径（`Progress.vue` 的 `matchesOrderNoOption('有单号')`）：
 * `单号` 有值 **且** `trim()` 后非空 ⇒ 已生产。`undefined` / `null` / `0` / `""` / `" "` 一律算未生产。
 */
export function isProduced(row: ProgressRowDto): boolean {
  return !!row['单号'] && String(row['单号']).trim() !== ''
}

/** 生产进度（旧版 `ke` 的 `startedCount` / `notStartedCount`）。 */
export function countProduction(rows: ProgressRowDto[]): { started: number; notStarted: number } {
  let started = 0
  for (const r of rows) if (isProduced(r)) started++
  return { started, notStarted: rows.length - started }
}

// ── 时间筛选（旧版 `fe`） ──────────────────────────────────────────────────

/** 时间档位（旧版 `w`）。 */
export type TimeMode = 'all' | 'today' | 'week' | 'month' | 'lastMonth' | 'custom'

export const TIME_MODE_LABELS: { value: TimeMode; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'lastMonth', label: '上月' },
  { value: 'custom', label: '自定义查询' },
]

const pad2 = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/**
 * 时间区间（旧版 `fe` 的前半段）。返回 `null` = **不筛**（`all` / `custom` 还没选区间）。
 *
 * ⚠️ **右端一律是「今天」**（`today` / `week` / `month` 三个档都是），
 *    不是周末/月末 ⇒ **未来日期的行会被排除**。
 *
 * 🔴 **有意偏离**：`week` 的**左端是周一**（看板文档 §16④）。
 *    旧版是**周日** —— dayjs 默认 en locale 的 `weekStart=0`，是事故不是决策。
 */
export function timeRange(
  mode: TimeMode,
  custom: [string, string] | null,
  now: Date = new Date(),
): { start: string; end: string } | null {
  const today = ymd(now)
  switch (mode) {
    case 'today':
      return { start: today, end: today }
    case 'week': {
      const day = now.getDay()
      const mondayOffset = day === 0 ? -6 : 1 - day
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
      return { start: ymd(monday), end: today }
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: ymd(first), end: today }
    }
    case 'lastMonth': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: ymd(first), end: ymd(last) }
    }
    case 'custom':
      if (!custom) return null
      return { start: custom[0], end: custom[1] }
    default:
      return null
  }
}

/**
 * 时间筛选（旧版 `fe`）。
 *
 * ⚠️ 比较是**字符串比较**（`日期` 是 `YYYY-MM-DD`）。旧版如此，照抄。
 * ⚠️ `all` / `custom` 未选区间时**原样返回**（空日期的行也保留）；其余档位
 *    `!!日期` 为假的行**一律剔除**。
 */
export function filterByTime(
  rows: ProgressRowDto[],
  mode: TimeMode,
  custom: [string, string] | null = null,
  now: Date = new Date(),
): ProgressRowDto[] {
  const range = timeRange(mode, custom, now)
  if (!range) return rows
  const { start, end } = range
  return rows.filter((r) => {
    const d = r['日期']
    return !!d && d >= start && d <= end
  })
}

/**
 * 看板自己那四个筛选器（旧版 `pe`）。
 *
 * ⚠️ 客户 / 业务员都是**严格 `===`**：不 trim、不 toLowerCase、不支持多选。
 *    业务员候选表那一步虽然用 `trim()` 判空，但**存进候选的是原值** ⇒
 *    `" 张三"` 与 `"张三"` 是**两个不同的组**。
 */
export function applyDashboardFilters(
  rows: ProgressRowDto[],
  f: { time: TimeMode; custom?: [string, string] | null; client?: string; salesman?: string; produced?: boolean | null },
  now: Date = new Date(),
): ProgressRowDto[] {
  let list = filterByTime(rows, f.time, f.custom ?? null, now)
  if (f.client) list = list.filter((r) => r['客户'] === f.client)
  if (f.salesman) list = list.filter((r) => r['业务员'] === f.salesman)
  if (typeof f.produced === 'boolean') list = list.filter((r) => isProduced(r) === f.produced)
  return list
}

/** 客户候选（旧版 `Ve`）：全量行去重 + **默认字符串 `sort()`**。 */
export function clientOptions(rows: ProgressRowDto[]): string[] {
  const s = new Set<string>()
  for (const r of rows) if (r['客户']) s.add(r['客户'])
  return Array.from(s).sort()
}

/** 业务员候选（旧版 `we`）：`trim()` 判空，但**存原值**。 */
export function salesmanOptions(rows: ProgressRowDto[]): string[] {
  const s = new Set<string>()
  for (const r of rows) if (r['业务员'] && String(r['业务员']).trim()) s.add(r['业务员'])
  return Array.from(s).sort()
}

// ── 标题区间（旧版 `he` / `Ce`） ───────────────────────────────────────────

/**
 * 日期区间。作用在**看板自己筛完的行**上（`pe`），所以切时间/客户都会改标题。
 *
 * 🔴 **有意偏离**（看板文档 §16③）：旧版 `filter(e => e)` 只剔 falsy，
 *    纯空格 `" "` 会被当成有效日期、又被 `sort()` 排到最前 ⇒ 标题变成 `生产分析看板 (  ~ 2026-09-20)`。
 *    新版按 `trim()` 后为空剔除。
 */
export function dateRangeOf(rows: ProgressRowDto[]): { start: string; end: string } {
  const dates = rows
    .map((r) => (r['日期'] == null ? '' : String(r['日期']).trim()))
    .filter((d) => d !== '')
    .sort()
  if (!dates.length) return { start: '', end: '' }
  return { start: dates[0], end: dates[dates.length - 1] }
}

/** 标题（旧版 `Ce`）。区间只有一天时不带 ` ~ `。 */
export function dashboardTitle(rows: ProgressRowDto[]): string {
  const { start, end } = dateRangeOf(rows)
  if (!start || !end) return '生产分析看板'
  return start === end ? `生产分析看板 (${start})` : `生产分析看板 (${start} ~ ${end})`
}

// ── 趋势（旧版 `Ue`） ─────────────────────────────────────────────────────

export interface TrendData {
  dates: string[]
  doors: number[]
  fans: number[]
  area: number[]
  amount: number[]
  /** `true` = 已按月聚合（标题要写「月度趋势」）。 */
  isMonthly: boolean
}

/** 转月阈值（旧版 `a.length > 30`，**31 个不同日期才转**，30 不转）。 */
export const MONTHLY_THRESHOLD = 30

/** 空日期归到这个桶，**最后被剔除**（旧版 `"未知日期"`）。 */
export const UNKNOWN_DATE = '未知日期'

/** 趋势数据（旧版 `Ue`）。**超过 30 个不同日期**自动按月聚合。 */
export function buildTrend(rows: ProgressRowDto[], opts: StatsOptions = {}): TrendData {
  const daily = new Map<string, { doors: number; fans: number; area: number; amount: number }>()
  for (const row of rows) {
    const key = row['日期'] || UNKNOWN_DATE
    if (!daily.has(key)) daily.set(key, { doors: 0, fans: 0, area: 0, amount: 0 })
    const b = daily.get(key)!
    const f = computeFans(row, opts)
    b.doors += numOr0(qtyOf(row))
    b.fans += f.swingFans + f.slidingFans + f.brightFans + f.showerFans + f.otherFans
    b.area += numOr0(areaOf(row))
    b.amount += numOr0(amountOf(row))
  }

  const dates = Array.from(daily.keys()).filter((d) => d !== UNKNOWN_DATE).sort()

  if (dates.length > MONTHLY_THRESHOLD) {
    const monthly = new Map<string, { doors: number; fans: number; area: number; amount: number }>()
    for (const d of dates) {
      const key = d.substring(0, 7)
      if (!monthly.has(key)) monthly.set(key, { doors: 0, fans: 0, area: 0, amount: 0 })
      const dst = monthly.get(key)!
      const src = daily.get(d)!
      dst.doors += src.doors
      dst.fans += src.fans
      dst.area += src.area
      dst.amount += src.amount
    }
    const keys = Array.from(monthly.keys()).sort()
    return {
      dates: keys,
      doors: keys.map((k) => monthly.get(k)!.doors),
      fans: keys.map((k) => monthly.get(k)!.fans),
      // ⚠️ 面积**聚合后再 `toFixed(2)`**（旧版如此）；金额**不取整**。
      area: keys.map((k) => parseFloat(monthly.get(k)!.area.toFixed(2))),
      amount: keys.map((k) => monthly.get(k)!.amount),
      isMonthly: true,
    }
  }

  return {
    dates,
    doors: dates.map((d) => daily.get(d)!.doors),
    fans: dates.map((d) => daily.get(d)!.fans),
    area: dates.map((d) => parseFloat(daily.get(d)!.area.toFixed(2))),
    amount: dates.map((d) => daily.get(d)!.amount),
    isMonthly: false,
  }
}

// ── 分组统计（旧版 `Ae` / `De` / `be` / `Pe` / `Se`） ─────────────────────

export interface GroupRow {
  name: string
  metrics: Metrics
}

/**
 * 分组（旧版 `Ae`）：按 `totalAmount` **降序**，并列时保持插入顺序
 * （`Array.prototype.sort` 在 V8 上稳定 ⇒ 与旧版逐字节一致）。
 * **没有 TopN 截断。**
 */
export function groupBy(
  rows: ProgressRowDto[],
  keyFn: (row: ProgressRowDto) => string,
  opts: StatsOptions = {},
): GroupRow[] {
  const map = new Map<string, ProgressRowDto[]>()
  for (const row of rows) {
    const key = keyFn(row)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(row)
  }
  return Array.from(map.entries())
    .map(([name, group]) => ({ name, metrics: aggregateRows(group, opts) }))
    .sort((a, b) => b.metrics.totalAmount - a.metrics.totalAmount)
}

/** 按客户（旧版 `De`）：空 → `未知客户`。 */
export function byCustomer(rows: ProgressRowDto[], opts: StatsOptions = {}): GroupRow[] {
  return groupBy(rows, (r) => r['客户'] || '未知客户', opts)
}

/** 按业务员（旧版 `be`）：空/纯空格 → `未分配`；**键是原值**（`" 张三"` 单独成组）。 */
export function bySalesman(rows: ProgressRowDto[], opts: StatsOptions = {}): GroupRow[] {
  return groupBy(rows, (r) => (r['业务员'] && String(r['业务员']).trim() ? r['业务员'] : '未分配'), opts)
}

/** 按型材（旧版 `Pe`）：空 → `未知型材`。 */
export function byProfile(rows: ProgressRowDto[], opts: StatsOptions = {}): GroupRow[] {
  return groupBy(rows, (r) => profileOf(r) || '未知型材', opts)
}

/** 工序槽位：`1..15`，**跳过 10**（旧版 `Se` 循环 + 写入侧一致）。 */
export const PROCEDURE_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15] as const

/**
 * 按工序（旧版 `Se`）。
 *
 * | 规则 | 值 |
 * |---|---|
 * | 槽范围 | `1..15`，**跳过 `工序10`** |
 * | 行入选 | 该槽**非空**（`null` / `""` 都不算） |
 * | 分组名 | 有工序名 → `工序N-名字`；没有 → `工序N` |
 * | 排序 | **按槽号升序**（与其它三个 tab 的「金额降序」**不同**） |
 * | 一行多槽 | 可进**多个**工序组（每槽一组） |
 *
 * ⚠️ 工序名以前是**打开看板时**现拉旧版生产域名（硬编码 `https://www.samrtdoor.com.cn/1?param1=GetProcedures`）。
 *    新版走我们自己的 `GET /v1/procedures`（页面已经拉过，直接传进来）——
 *    与「颜色不再读 localStorage」同一条理由（见 `Progress.vue` 文件头「三处与旧版不同」）。
 */
export function buildProcedureGroups(
  rows: ProgressRowDto[],
  names: Record<string, string> = {},
  opts: StatsOptions = {},
): GroupRow[] {
  const map = new Map<string, ProgressRowDto[]>()
  for (const row of rows) {
    for (const slot of PROCEDURE_SLOTS) {
      const key = `工序${slot}`
      const value = row[key as keyof ProgressRowDto]
      if (value && String(value) !== '') {
        const label = names[key] || ''
        const name = label ? `${key}-${label}` : key
        if (!map.has(name)) map.set(name, [])
        map.get(name)!.push(row)
      }
    }
  }
  return Array.from(map.entries())
    .map(([name, group]) => ({ name, metrics: aggregateRows(group, opts) }))
    .sort((a, b) => slotOf(a.name) - slotOf(b.name))
}

function slotOf(name: string): number {
  const m = name.match(/工序(\d+)/)
  return parseInt(m?.[1] || '0', 10)
}
