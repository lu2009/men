/*
 * 扫码统计面板（旧版 `/Qrscanner` 的 `div.process-stats-mobile`）的**纯口径层**。
 *
 * 依据：`docs/2026-09-19-qrscanner-analysis.md` §2.9（DOM 结构 + `Ma` 26 列）、
 * §3.6（导出 CSV），以及**反混淆源码**里那几个函数的逐行核对
 * （`Qrscanner-195163c4.js` 反混淆产物，变量名保持原名并在下面逐条注明）。
 *
 * 这里只放**可单测的纯函数**：不碰 Vue 响应式、不碰 DOM、不碰接口。
 *
 * ## 与 `utils/productionStats.ts`（Progress 的生产分析看板）的关系 —— ⚠️ 先读这段
 *
 * 两边的口径函数**长得几乎一模一样**，因为它们确实是同一族的旧代码：
 *
 * | 扫码页 | 看板页 | 权威实现 |
 * |---|---|---|
 * | `ql(rows)` | `Me(rows)` | `productionStats.aggregateRows()` |
 * | `Ql(row)` | `xe(row)` | `productionStats.computeFans()` |
 * | `ql` 里的门型分类器 | `Me` 里的分类器 | `productionStats.classifyDoor()` |
 *
 * **门型分类器两边完全等价 ⇒ 直接复用 `classifyDoor`。**
 *
 * ### ★ 唯一的实质差异：`扇数 === "3轨6扇"`
 *
 * 旧版**扫码页自己前后不一致**（这是逐字比对两段字面量得到的，不是推断）：
 * - `Ql` 里那张「算不算移门」的扇数表有 **23** 项，**含 `"3轨6扇"`**，且它的乘数链里
 *   `3轨6扇 → k = 6`；
 * - 而 `ql` 里**门数分类**用的那张表只有 **22** 项，**不含 `"3轨6扇"`**。
 *
 * 后果：`扇数 === "3轨6扇"` 且型材不含「哑口」的行 ——
 * **扇数**按移门算（`数量 × 6`），**门数**却落进「淋浴房/平开门/其它」。
 * 而看板页那份 `xe`/`Me` 用的是自洽的 22 项表，所以 `productionStats.computeFans` 对这一行给出 0 扇。
 *
 * ⚠️ `"3轨6扇"` 在新版是**真实可达**的扇数选项（`utils/detailOptions.ts:8`）⇒ 不是死差异。
 * 所以本文件**不能**直接复用 `computeFans`/`aggregateRows`，得按扫码页那份 23 项表另写一遍。
 * 别为了「消重」把它并回 `productionStats` —— 那会改掉看板页已被差分台钉住的数字。
 *
 * ## ⚠️ 有意没实现的东西
 *
 * 1. **`匹配工序键列表` 那套「非管理员过滤」**（旧版 `Wl`/`Gl`/`Kl`）。
 *    旧版按 `row["匹配工序键列表"]` 决定一行算不算数，新版后端**不返回这个字段**
 *    （`backend/src/modules/progress/service.rs` 的行构造里没有）。
 *    ⇒ 这里**不做任何行过滤**，等价于旧版「1 号账号（管理员）」那条路。
 *    真要做，得先有那个字段 —— 这是**给后端的输入**，不是前端能绕的。
 * 2. **`totalAmount` / `swingAmount` / … 那 5 个金额桶**照抄累加（旧版 `ql` 里确实算了），
 *    但页面与导出**都不读它们**（旧版也是）—— 留着是为了和旧版字段一一对应，方便日后核对。
 */
import type { ProgressRowDto } from '../api/types'
import { classifyDoor, SLIDING_FAN_COUNTS, SWING_DIRECTIONS, type Metrics } from './productionStats'
import { getOriginalOpenDirection } from '../composables/useOpenDirection'

// ── 常量表 ─────────────────────────────────────────────────────────────────

/**
 * 单开 8 项（旧版 `Ul`）—— 扇数 = `数量 × 1`。
 * ⚠️ 就是 `SWING_DIRECTIONS` 的前 8 项，但这里**照抄字面量**不 `slice`
 * （`slice` 会把「顺序」变成一个隐含前提，那种前提最容易在改常量表时悄悄失效）。
 */
const SINGLE_OPEN = [
  '内左', '内右', '外左', '外右',
  '左锁内开', '右锁内开', '左锁外开', '右锁外开',
] as const

/** 双开 6 项（旧版 `Dl`）—— 扇数 = `数量 × 2`。 */
const DOUBLE_OPEN = [
  '双开内开', '双开外开', '双开内左', '双开内右', '双开外左', '双开外右',
] as const

/**
 * `Ql` 里那张「算移门」的扇数表 —— **23 项**（比 `SLIDING_FAN_COUNTS` 多一个 `"3轨6扇"`）。
 * 见文件头那段差异说明。构造方式：共享的 22 项 + 单独补上 `"3轨6扇"`。
 */
const SLIDING_FAN_COUNTS_23: readonly string[] = [...SLIDING_FAN_COUNTS, '3轨6扇']

/**
 * 扇数档位 → 每樘的扇数乘数（旧版 `Ql` 里那串三元链）。
 * 逐项从那条链抄下来；`"3轨6扇" → 6` 是扫码页**有**而看板页没有的那一项。
 */
const FAN_MULTIPLIER: Record<string, number> = {
  '2轨2扇': 2, 单轨2扇: 2, 折叠2扇: 2,
  '2轨3扇': 3, '3轨3扇': 3, 折叠3扇: 3, '3轨2扇1纱': 3,
  '2轨4扇': 4, 折叠4扇: 4, '4轨4扇': 4,
  '3轨4扇2纱': 6, 折叠6扇: 6, '6轨6扇': 6, '3轨6扇': 6,
  单轨单扇: 1,
  折叠5扇: 5, '5轨5扇': 5,
  折叠7扇: 7, '7轨7扇': 7,
  折叠8扇: 8, '8轨8扇': 8,
  折叠9扇: 9, '9轨9扇': 9,
}

// ── 安全数 / 取字段 ─────────────────────────────────────────────────────────

/**
 * 安全数（旧版 `bl`）：`Number(v)` 有限就用它，否则 0。
 * ⚠️ **不是 `|| 0`** —— 旧版从 `Me`/`ql` 全程用这个函数，`'3'` 这种字符串会被正常转成 3。
 */
function bl(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 取字符串字段（`undefined`/`null` → `''`）。 */
function str(v: unknown): string {
  return v == null ? '' : String(v)
}

/** 包含判断，先挡掉空值（旧版 `r["型材"] && String(...).includes(...)`）。 */
function has(v: unknown, s: string): boolean {
  return !!v && String(v).includes(s)
}

// ── 扇数（旧版 `Ql`） ──────────────────────────────────────────────────────

/** 扇数 5 桶（与 `productionStats.FanBuckets` 同形）。 */
export interface ScanFanBuckets {
  swingFans: number
  slidingFans: number
  showerFans: number
  otherFans: number
  brightFans: number
}

/**
 * 逐行扇数（旧版 `Ql`，`dec@29408`）。
 *
 * ⚠️ 与 `productionStats.computeFans` 的**唯一**差别：这里的「算移门」表是 23 项、含 `"3轨6扇"`。
 *
 * ⚠️ 5 个桶**不是互斥的**（旧版如此，照抄）：一行可以同时进多个桶。
 * 比如型材含「钻石」**且** `亮窗总高 > 0` **且** `轨道种类` 非空、非 `"NULL"` 的一行，
 * `showerFans` 与 `brightFans` **各加一次数量** ⇒ 总扇数会大于实际扇数。
 * 只有 `otherFans` 是真兜底（前四个 + 平开全不中才给）。
 *
 * ⚠️ 旧版那句 `if ( y || (三元), V )` 是**逗号运算符**（`dec@29408`，已用最小复现验证过）：
 * 真条件只有 `V`，但**三元那段在 `y` 为假时一定会求值**。下面拆成两个 `if` 写，
 * 语义等价 —— **别把它"简化"回一行**，那样 `swingFans` 会被错算。
 */
export function computeScanFans(row: ProgressRowDto): ScanFanBuckets {
  const qty = bl(row.quantity)
  const profile = str(row.profile)
  const fans = str(row.fans)

  const isYakou = has(profile, '哑口')
  const isSliding = SLIDING_FAN_COUNTS_23.includes(fans) && !isYakou
  const isShowerByFans = fans === '一固一活' || fans === '双活'
  const isDiamond = has(profile, '钻石')
  const direction = getOriginalOpenDirection(str(row.direction))
  const isSwing = (SWING_DIRECTIONS as readonly string[]).includes(direction)
  const hasBright =
    bl(row.light_window_height) > 0 && !!row.track && row.track !== 'NULL' && row.track !== ''

  let swingFans = 0
  // 「y || (三元)」展开：`y` 为真时短路 ⇒ swingFans 保持 0。
  if (!isDiamond) {
    if ((SINGLE_OPEN as readonly string[]).includes(direction)) swingFans = qty
    else if ((DOUBLE_OPEN as readonly string[]).includes(direction)) swingFans = 2 * qty
  }

  let slidingFans = 0
  if (isSliding) slidingFans = qty * (FAN_MULTIPLIER[fans] ?? 1)

  const showerFans = isShowerByFans ? 2 * qty : isDiamond ? qty : 0
  const brightFans = hasBright ? qty : 0
  // 「其它扇」是**补集**（旧版 `V || g || d || y || w || (otherFans = qty)`）。
  const otherFans = !isSliding && !hasBright && !isShowerByFans && !isDiamond && !isSwing ? qty : 0

  return { swingFans, slidingFans, showerFans, otherFans, brightFans }
}

// ── 聚合（旧版 `ql`） ──────────────────────────────────────────────────────

/**
 * 聚合器（旧版 `ql`，`dec@30523`）。
 *
 * ⚠️ **门数** 4 桶走 `if / else if` 链 ⇒ **互斥**，`totalQuantity` = 各桶之和。
 * ⚠️ **扇数** 5 桶来自 `computeScanFans` ⇒ **可叠加**；`totalFans` 是 5 桶**直接相加**。
 * ⚠️ `brightFans` 无条件累进 `slidingBrightFans`（「亮窗」桶）——
 *    该*行*的门数却可能落进「其它」⇒ 两份口径分解的不是同一批行（旧版如此）。
 *
 * 逐字段来源见文件头与 `Metrics` 的注释；`queryEmployee` 那一栏**不在这里**加，
 * 由调用方（页面）挂在行上（旧版也是 `Zl` 里 `{...e, "查询员工": ul.value}`）。
 */
export function aggregateScanRows(rows: ProgressRowDto[]): Metrics {
  const m: Metrics = {
    totalQuantity: 0, swingQuantity: 0, slidingQuantity: 0, showerQuantity: 0, otherQuantity: 0,
    totalArea: 0, swingArea: 0, slidingArea: 0, showerArea: 0, otherArea: 0,
    totalAmount: 0, swingAmount: 0, slidingAmount: 0, showerAmount: 0, otherAmount: 0,
    totalFans: 0, swingFans: 0, slidingFans: 0, slidingBrightFans: 0, showerFans: 0, otherFans: 0,
  }

  for (const row of rows) {
    const qty = bl(row.quantity)
    const area = bl(row.square)
    const amount = bl(row.amount)
    // 门型分类器与看板页**完全等价**，直接复用（见文件头那张表）。
    const kind = classifyDoor(row)

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

    const f = computeScanFans(row)
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

// ── 「按工序统计」（旧版 `Jl`，`dec@32540`） ────────────────────────────────

export interface ProcedureGroup {
  /** 槽号，如 `"工序3"` —— 旧版拿它当分组键（**不是**工序名）。 */
  name: string
  /** 显示名，`"工序3-钻孔"` / 没配名字时 `"工序3"`（旧版 `Hl`）。 */
  displayName: string
  metrics: Metrics
}

/**
 * 工序显示名（旧版 `Hl`，`dec@27521`）：`"工序3"` + 有名字就接 `"-钻孔"`。
 *
 * @param nameMap 槽号 → 工序名（来自 `GET /v1/procedures`）。
 */
export function procedureDisplayName(slot: string, nameMap: Record<string, string>): string {
  const name = str(nameMap[slot]).trim()
  return name ? `${slot}-${name}` : slot
}

/** `工序N` 的 N；不匹配给 0（排序兜底，旧版也是 `|| "0"`）。 */
function slotNo(slot: string): number {
  return Number(slot.match(/工序(\d+)/)?.[1] ?? 0) || 0
}

/**
 * 按工序分组（旧版 `Jl`）。
 *
 * 分组键是**行对象自己的 `工序N` 键名**（槽号），数据来源是**行里的 `工序N` 字段**
 * —— **不是** `GetProcedures`。某行的某槽只要有值（`null`/`''` 之外的，**`0` 也算**）就进那一组。
 *
 * ⚠️ **硬编码排掉 `工序10`** —— 与「设置工序」弹窗那边的排除同源（分析文档 §4.4-(c)）。
 *    新版「设置工序」已经 15 槽一视同仁（§8.3-1），但**这里照旧排掉**：
 *    这一条是**展示口径**，改成 15 槽会让「回款」（Progress 侧仍在用工序10 语义的历史数据）
 *    混进工序统计。两处要不要一起放开，等口径定了再说。
 */
export function buildProcedureGroups(
  rows: ProgressRowDto[],
  nameMap: Record<string, string>,
): ProcedureGroup[] {
  const groups = new Map<string, ProgressRowDto[]>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const m = key.match(/^工序(\d+)$/)
      if (!m) continue
      if (m[1] === '10') continue
      const v = (row as unknown as Record<string, unknown>)[key]
      if (v == null || v === '') continue
      const list = groups.get(key)
      if (list) list.push(row)
      else groups.set(key, [row])
    }
  }
  return [...groups.entries()]
    .map(([name, groupRows]) => ({
      name,
      displayName: procedureDisplayName(name, nameMap),
      metrics: aggregateScanRows(groupRows),
    }))
    .sort((a, b) => slotNo(a.name) - slotNo(b.name))
}

// ── ★ 已删除：扫码查单的匹配 + 「扫码员工/扫码日期」的现推 + 日期标签换算 ──
//
// 2026-09-19 用户纠正：**这三段都搬回服务端了，前端一份都不留。**
//
// ## 为什么删（别在这里再加回来）
//
// 本文件原先有 `matchByScanCode`（客户端筛单号）、`parseScanMarker` / `deriveScanMarker`
// （从 `工序1..15` 里现推「扫码员工/扫码日期」）、`resolveDateLabel`（`当天/本周/本月` → 起止）。
// 它们存在的前提是「**前端手里有全量行**」—— 而那个前提本身是错的：
// `GET /v1/progress` 是全量门行（含客户名/金额/安装地址），扫码页跑在**车间工人的手机**上。
// 旧版每次扫码只请求**命中的那几行**（`getScanQRcode` / `getProcessCounts`），
// 本版一度改成了「拉全量 + 前端 filter」，把整库订单摊到了那台手机上。
//
// 现在恢复成两条**窄接口**（`api.scanQrcode` / `api.scanStats`），于是：
//
// | 原来的前端函数 | 现在归谁 |
// |---|---|
// | `matchByScanCode` | 服务端 `GET /v1/scan/qrcode`（`btrim(单号)` 后精确相等） |
// | `parseScanMarker` / `deriveScanMarker` | 服务端 `GET /v1/scan/stats`（同一个正则，**只有一份**） |
// | `resolveDateLabel` | 服务端（`本周` 从**周一**算起；前端直接传 `当天`/`本周`/`本月` 字面标签） |
//
// ⚠️ **推导只留服务端那一份。** 两处各写一份正则/日期口径，迟早会在某次改动里漂开
//    —— 而这两处的漂移**不报错**，只是筛出来的行数不一样，看板上少了几个数字没人会发现。
//    所以这里删干净，不留「以防万一」的副本。
//
// 差分台也跟着搬：`docs/qrscanner-scan-logiccheck.mjs` 原先比的是
// 「旧版服务端 vs **新版前端**」，右边那一半已经不存在了（见那个脚本的头注）。

/**
 * 日期标签（旧版前端传的字面标签，`当天`/`本周`/`本月`）。
 *
 * ⚠️ 现在**只是线上格式的文档** —— 换算（`本周` 从周一算起等）在服务端做，
 * 前端把这个字面量原样传给 `GET /v1/scan/stats?range=`。`"起,止"` 那一支不走这个类型。
 */
export type ScanDateLabel = '当天' | '本周' | '本月'

// ── 26 列订单详情（旧版 `Ma`，`dec@44893`） ─────────────────────────────────

export interface DetailColumn {
  /** `row` 上的字段名。 */
  key: string
  /** 表头/标签文案。 */
  label: string
}

/**
 * 订单详情的 26 列 —— **顺序即显示顺序**，逐字取自旧版 `Ma`（`dec@44893`）。
 *
 * ## ⚠️ `key` 为什么大多是**英文**
 *
 * 旧版 `Ma` 里每一列都是一个中文 `key`（`{key:"型材"}`），因为旧服务端的门行是**中文键**的。
 * 新版全栈统一英文键（`Progress.vue` 文件头已写明这条口径），`build_row` 给的行是
 * `OrderLineDto` 摊平 ⇒ `profile`/`door_width`/`fans`/… 都是英文；
 * **只有少数几格仍是中文键**（`单号`/`客户`/`日期`/`备注`/`安装地址`/`生产进度`/`扫码日期`，
 * 由 `build_row` 从订单头补进来）。
 *
 * ⇒ 这里的 `key` 是**新版行对象上真实存在的那个键名**，`label` 才是旧版界面上那几个字。
 * **别把 `key` 改回中文** —— 改了整张详情表会只剩 客户/日期/安装地址/备注/生产进度 五格。
 *
 * ⚠️ **第一列 `key` 与 `label` 也不同名**：`key: "查询员工"` / `label: "员工"`。
 *    那个字段**不在服务端返回里**，是前端补的（旧版 `Zl` 里 `{...row, "查询员工": ul.value}`）。
 *    扫码查单拿回来的行**没有**这一格 ⇒ 界面上那一行整个不渲染、导出里是空串（旧版也这样）。
 */
export const SCAN_DETAIL_COLUMNS: DetailColumn[] = [
  { key: '查询员工', label: '员工' },
  { key: '客户', label: '客户' },
  { key: '日期', label: '日期' },
  { key: '扫码日期', label: '扫码日期' },
  { key: 'profile', label: '型材' },
  { key: '安装地址', label: '安装地址' },
  { key: '备注', label: '备注' },
  { key: '生产进度', label: '生产进度' },
  { key: 'door_width', label: '门洞宽' },
  { key: 'door_height', label: '门洞高' },
  { key: 'wall_thickness', label: '墙厚' },
  { key: 'jiao', label: '吊脚' },
  { key: 'light_window_height', label: '亮窗总高' },
  { key: 'light_window_count', label: '亮窗数量' },
  { key: 'fans', label: '扇数' },
  { key: 'direction', label: '开向' },
  { key: 'color', label: '颜色' },
  { key: 'bottom_glass', label: '底玻' },
  { key: 'face_glass', label: '面玻' },
  { key: 'glass_thickness', label: '玻璃厚' },
  { key: 'casing', label: '套线种类' },
  { key: 'track', label: '轨道种类' },
  { key: 'edge_seal_count', label: '边封数' },
  { key: 'track_length', label: '轨道长' },
  { key: 'quantity', label: '数量' },
  { key: 'square', label: '平方数' },
]

/** 取一行上某列的原始值（`unknown`，因为行是接口来的 JSON）。 */
function rawOf(row: ProgressRowDto, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key]
}

/**
 * 字段值格式化（旧版 `aa`，`dec@35216`）—— **只有 `"日期"` 会被加工**。
 *
 * 旧版是 `new Date(v)` + `getFullYear/getMonth/getDate` + `padStart`（**没用 dayjs**）。
 * ⚠️ 旧版的 `try/catch` 形同虚设：`new Date('乱写')` **不抛异常**，
 *    只会让 `getFullYear()` 返回 `NaN` ⇒ 输出 `"NaN-NaN-NaN"`。这里给个兜底：
 *    解析不出有效日期就**原样返回**（比把 `NaN-NaN-NaN` 摆到界面上强），并注明是偏离。
 */
export function formatScanField(key: string, val: unknown): unknown {
  if (key !== '日期' || !val) return val
  const d = new Date(String(val))
  if (Number.isNaN(d.getTime())) return val
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 界面上这一格要不要渲染（旧版 render 里的过滤）。
 *
 * 逐字照抄旧版条件：`null != v && 0 !== v && "" !== v` —— 注意
 * ① `0`（数字）不渲染，但字符串 `"0"` **会**渲染；② `null` 与 `undefined` 都不渲染。
 * ⚠️ **导出走的是另一套**（只把空值变空串），所以导出会比界面多出几格 —— 旧版如此。
 */
export function isScanFieldVisible(val: unknown): boolean {
  return val != null && val !== 0 && val !== ''
}

// ── 导出 CSV（旧版 `Tl`，`dec@27796`） ──────────────────────────────────────

/**
 * CSV 单元格转义（旧版 `Yl`，`dec@27740`）。
 * ⚠️ `null`/`undefined` → 空串；数字**也会被引号包住**（`"12"`）；内部 `"` 翻倍。
 */
export function csvCell(v: unknown): string {
  return '"' + (v == null ? '' : String(v)).replace(/"/g, '""') + '"'
}

const CSV_HEADER = ['工序', '门数', '门数单价', '门数合计', '扇数', '扇数单价', '扇数合计', '面积', '面积单价', '面积合计']

/** 一份单价（旧版 `xl` 的三个全局单价 + `Al` 里按槽存的三个工序单价）。 */
export interface UnitPrices {
  quantity: number
  fans: number
  area: number
}
export const ZERO_PRICES: UnitPrices = { quantity: 0, fans: 0, area: 0 }

/** 单价 × 数量，两位小数（旧版一律 `.toFixed(2)`）。 */
function total(qty: number, price: number): string {
  return (qty * price).toFixed(2)
}

/**
 * 导出 CSV 的正文（旧版 `Tl`）。**不含 BOM**，调用方自己加（旧版是 `"﻿" + ...`）。
 *
 * 两段：① 「扫码统计」（按工序，逐组一行 + 一行「汇总」）、② 「订单详情」（26 列）。
 * - 每行是 `,` 连接、每格都过 `csvCell`、行之间 `\n`（**LF，不是 CRLF**）。
 * - 两段之间**恰好 1 个空行**，且只在**前面真有内容、且订单段也要输出**时才 push。
 * - 「汇总」行用的是**全局 `Rl` + 全局单价**，**不是**工序各行相加 —— 两者可能在
 *   过滤口径下不相等（旧版如此，照抄）。
 *
 * @returns CSV 正文；两段都没有内容时返回 `null`（调用方提示「暂无可导出的数据」）。
 */
export function buildScanCsv(
  rows: ProgressRowDto[],
  groups: ProcedureGroup[],
  total0: Metrics,
  totalPrices: UnitPrices,
  procedurePrices: Record<string, UnitPrices>,
  fileNameDate: string,
): { content: string; fileName: string } | null {
  const hasProcs = groups.length > 0
  const hasOrders = rows.length > 0
  if (!hasProcs && !hasOrders) return null

  const lines: string[] = []

  if (hasProcs) {
    lines.push(['扫码统计'].map(csvCell).join(','))
    lines.push(CSV_HEADER.map(csvCell).join(','))
    for (const p of groups) {
      const price = procedurePrices[p.name] ?? ZERO_PRICES
      const mm = p.metrics
      lines.push(
        [
          p.displayName,
          mm.totalQuantity, price.quantity, total(mm.totalQuantity, price.quantity),
          mm.totalFans, price.fans, total(mm.totalFans, price.fans),
          mm.totalArea.toFixed(2), price.area, total(mm.totalArea, price.area),
        ]
          .map(csvCell)
          .join(','),
      )
    }
    lines.push(
      [
        '汇总',
        total0.totalQuantity, totalPrices.quantity, total(total0.totalQuantity, totalPrices.quantity),
        total0.totalFans, totalPrices.fans, total(total0.totalFans, totalPrices.fans),
        total0.totalArea.toFixed(2), totalPrices.area, total(total0.totalArea, totalPrices.area),
      ]
        .map(csvCell)
        .join(','),
    )
  }

  if (hasOrders) {
    // ⚠️ `lines.length > 0 &&`：只有统计段真的写了东西才加这个空行（旧版原文如此）。
    if (lines.length > 0) lines.push('')
    lines.push(['订单详情'].map(csvCell).join(','))
    lines.push(['序号', ...SCAN_DETAIL_COLUMNS.map((c) => c.label)].map(csvCell).join(','))
    rows.forEach((row, i) => {
      const cells: unknown[] = [
        i + 1,
        // ⚠️ 导出**不做** `0`/`''` 的过滤，只把空值变空串 —— 所以列比界面多（旧版如此）。
        ...SCAN_DETAIL_COLUMNS.map((c) => {
          const v = rawOf(row, c.key)
          return v == null ? '' : formatScanField(c.key, v)
        }),
      ]
      lines.push(cells.map(csvCell).join(','))
    })
  }

  // 文件名里的日期：旧版用 `toISOString()`（**UTC**），与提交进度那处是同一个毛病。
  // 这里用调用方给的**本地**日期（有意偏离，理由同 `Qrscanner.vue` 文件头偏离 2）。
  return {
    content: '﻿' + lines.join('\n'),
    fileName: `扫码统计_${fileNameDate}.csv`,
  }
}
