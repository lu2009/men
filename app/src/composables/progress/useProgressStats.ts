/**
 * Progress 订单进度页的**统计行**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）：`Progress.vue:1800-1983`
 * （连续一整段，184 行，**12 个声明**）—— 拆分方案里的 **P10**。
 * 段首那行分区横幅（`// ── C1. 统计数字…`）与它下面 11 行的块注释（「五个数全是前端逐行算的」·
 * 「读的是筛选后」「旧版读中文键、我们的 DTO 是英文列名」）**一起搬来**；
 * 工厂体内**与 REF 一字不差、相对顺序也不动**。
 *
 * ⚠️ **横幅与段内注释的保真不在守卫里**（核心 `sliceFn` 从**声明**起切，它们根本不进切片）——
 *   唯一证据是「整段与 REF 同区间逐字节比」（判据 R39：归一化掉工厂那层统一缩进之后，
 *   剩余差异必须**恰好等于在案的注入改写，不多不少**）。别拿「守卫绿」当它的证据。
 *
 * ⚠️ **本段里没有顶层非声明语句**（没有 `watch(` / `if(` 那一类）—— 实测 REF 1800–1983
 *   的顶层语句**全是那 12 个声明** ⇒ 不存在 P9 那种「切片器切不到、对它们恒绿」的盲区。
 *
 * ⚠️ **注入只有 1 项**：`filteredRows`（REF **1250** 的 `computed`）。
 *   本块是全计划唯一**壳区零依赖**的块 —— 剥掉注释后，它在 REF 1–827 的壳区声明里
 *   **一个都不用**（真 TS 解析器数标识符节点实测）。段内 6 处读取，**全在活代码里**
 *   （`moveFans` / `pingFans` / `lightWindows` / `showerFans` / `others` 各自的 reduce 开头，
 *   以及 `dateRange` 的第一行）；段内注释里那处 `filteredRows`（「全部读的是筛选后的」）
 *   是**裸名、不带 `.value`** ⇒ 规则写成 `filteredRows.value` 时不会碰到它（已核）。
 *   ⚠️ `normDirection` 依赖的 `getOriginalOpenDirection` 是**模块级 import，不注入**。
 *   ⚠️ **注入的是 ref 本身，不是 `.value` 副本**（与 P2/P3/P5/P7/P8/P9 同一口径）。
 *
 * ⚠️ **搬迁时的文本改写 = 1 条规则、命中 6 处**：`filteredRows.value` →
 *   `deps.filteredRows.value`（逐条登记在守卫的 `rewrites` 里，分挂在 6 个吃它的声明下）。
 *   规则**带边界**（核心文件头：「朴素 split/join，裸名会顺手打到别的标识符上」）。
 *
 * ⚠️ **回传 7 项**（12 个声明里真被段外消费的 7 个）：
 *   · **段外脚本**的 6 个，**全部落在 `exportTable`（P11，Task 7 才搬）里**：
 *     `moveFans`(REF **2056**) · `pingFans`(2056) · `lightWindows`(2057) · `showerFans`(2057) ·
 *     `others`(2058) —— 正是 `ws.addRow([...])` 那几行用的；`dateRange`(REF **2055**，
 *     同行**两处** —— `.earliest` 与 `.latest`)。
 *   · **只被模板读**的 1 个：`statsTail`（模板 REF 167 / 170 —— 两处 `<span class="total-info">`）。
 *     ⚠️ 段外脚本里那处 `statsTail`（REF 2050）是**注释里的一个词**
 *     （「这句与工具条上的 `statsTail` 不是同一串」）—— **不是活引用**
 *     （memory `split-brief-interface-traps` 第 1 类：P1 `va` / P2 `orderedProcedureNames`
 *     都栽在「grep 命中其实是注释」上；本处反过来核过一遍）。
 *   ⚠️ **不回传、也不许解构的 5 个**：`MOVE_FAN_NAMES` `PING_SINGLE_DIRECTIONS`
 *     `PING_DOUBLE_DIRECTIONS` `ALL_PING_DIRECTIONS` `normDirection`
 *     —— 段外脚本 0 引用、模板 0 引用（真 TS 解析器 + 整文件纯文本搜，各量一遍）。
 *     ⚠️ 但**「不回传」≠「可以删」**：它们是本块内部算 `moveFans` / `pingFans` / `others`
 *       用的常量与辅助函数 ⇒ **跟着本块搬走，只是不借出去**。
 *     ⚠️ 简报原先那句「全部回传（`exportTable` 要用）」是**错的**（R55 已更正）：
 *       照它办会在壳里多出 5 个没人用的解构（`TS6133`）。当时为什么看不出来 ——
 *       唯一的段外消费者 `exportTable` 在 **Task 7** 才搬，在那之前壳里那份还在，
 *       编译器不红。**到 Task 7 才炸**。⇒ **按 7 个配**。
 *
 * ⚠️ **调用点为什么在壳里那个位置**：本块**只注入 `filteredRows`**，它在 REF 里
 *   （1250）就排在本块（1800）之前 ⇒ **没有 TDZ 约束**；本块段外的**脚本**引用
 *   （`exportTable` 那 6 处）全部排在本块**之后** ⇒ 也不需要提前。
 *   两条合起来：**调用点原地不动**（`filteredRows` 此刻还是壳里的 `computed`；
 *   **Task 7 搬走 P6 时才回来把回传接上** —— 那是 Task 7 的活，不是本任务的）。
 */
import { computed, type ComputedRef } from 'vue'
import { getOriginalOpenDirection } from '../useOpenDirection'
import type { ProgressRow } from '../../utils/progressRow'

/** `useProgressStats()` 的注入面。**只有 1 项**（本块是唯一「壳区零依赖」的块）。 */
export interface ProgressStatsDeps {
  /**
   * 筛选后的行（壳里那个 `computed`，REF **1250** = 旧版 `no`）—— 段内 6 处**只读**。
   * ⚠️ 收 `ComputedRef` 就够（本块一处都不写它）。
   */
  filteredRows: ComputedRef<ProgressRow[]>
}

/** 统计行：旧版 `yo` / `vo` / `mo` / `go` / `fo` / `po` 六个数 + 模板上的 `total-info`。 */
export function useProgressStats(deps: ProgressStatsDeps) {
  // ── C1. 统计数字（旧版 `yo` / `vo` / `mo` / `go` / `fo` / `po`，全部作用在 `no` = 筛选后）──
  /*
   * ⚠️ 五个数都是**前端逐行算的**，后端不参与；口径与看板的 `ke2` **不完全一样**（看板另有
   *    「不含单玻」开关），**别把这两处合并**。
   *
   * ⚠️ 全部读的是**筛选后**的 `filteredRows`（= 旧版 `no`）。
   *
   * ⚠️ 旧版这一大段是从 `ProgressRowDto` 的**中文键**上读的（`型材` / `扇数` / `开向` / `数量` /
   *    `亮窗总高` / `轨道种类`）；我们的 DTO 是英文列名 ⇒ 逐项换成
   *    `profile` / `fans` / `direction` / `quantity` / `light_window_height` / `track`。
   */

  /**
   * 「移门」判据用的扇数枚举（**旧版 `fo` 里那张独立数组** `d` 的原样，顺序照抄）。
   *
   * ⚠️ 旧版把同一批字面量写了**两份**：`yo` 是一条 if 链（每项还带「每樘几扇」的值）、
   *    `fo` 是这张只看「是不是移门扇数」的数组。改动时**两处都要改**
   *    （`moveFans` 的 if 链 / 这张表），差分台 `docs/progress-toolbar-logiccheck.mjs`
   *    里有一条自检会比对这两份的字面量集合，漏改一处会红。
   */
  const MOVE_FAN_NAMES = [
    '2轨2扇',
    '2轨3扇',
    '2轨4扇',
    '3轨2扇1纱',
    '3轨4扇2纱',
    '3轨3扇',
    '4轨4扇',
    '5轨5扇',
    '6轨6扇',
    '7轨7扇',
    '8轨8扇',
    '9轨9扇',
    '单轨单扇',
    '单轨2扇',
    '折叠2扇',
    '折叠3扇',
    '折叠4扇',
    '折叠5扇',
    '折叠6扇',
    '折叠7扇',
    '折叠8扇',
    '折叠9扇',
  ] as const

  /** 平开门「单开」的 8 个开向（旧版 `vo` 的 `o` 数组，顺序照抄）。 */
  const PING_SINGLE_DIRECTIONS = [
    '内左',
    '内右',
    '外左',
    '外右',
    '左锁内开',
    '右锁内开',
    '左锁外开',
    '右锁外开',
  ]

  /** 平开门「双开」的 6 个开向（旧版 `vo` 的 `n` 数组）。 */
  const PING_DOUBLE_DIRECTIONS = ['双开内开', '双开外开', '双开内左', '双开内右', '双开外左', '双开外右']

  /** `其它` 用的 14 项合并表（旧版 `fo` 的 `o` 数组 = 单开 8 + 双开 6）。 */
  const ALL_PING_DIRECTIONS = [...PING_SINGLE_DIRECTIONS, ...PING_DOUBLE_DIRECTIONS]

  /** 旧版 `vo`/`fo` 都用的开向归一化：显示名 → 原始开向（`openDirectionNaming` 的 `g`）。 */
  const normDirection = (d: string) => getOriginalOpenDirection(d)

  /**
   * `yo` 移门扇数：逐行按 `扇数` 查表得「每樘几扇」，再乘 `数量` 累加。
   *
   * ⚠️ 三处照抄的细节：
   *  ① 型材含「哑口」的行**直接跳过**（注意：只在这里跳，不影响「其它」的判定 —— 见 `others`）；
   *  ② 查不到对应扇数 ⇒ `r` 保持 0 ⇒ **跳过**（不按 1 扇算）；
   *  ③ 旧版那句 `(l["型材"]&&l["型材"].includes("+0"), t+o*r)` 里 `includes("+0")` 是个
   *     **没有任何作用的残留表达式**（逗号运算符左边），不复制。
   */
  const moveFans = computed(() =>
    deps.filteredRows.value.reduce((acc, r) => {
      if (r.profile && r.profile.includes('哑口')) return acc
      const n = r.fans
      let per = 0
      if (n === '2轨2扇' || n === '单轨2扇' || n === '折叠2扇') per = 2
      else if (n === '2轨3扇' || n === '3轨3扇' || n === '折叠3扇' || n === '3轨2扇1纱') per = 3
      else if (n === '2轨4扇' || n === '4轨4扇' || n === '折叠4扇') per = 4
      else if (n === '3轨4扇2纱' || n === '折叠6扇' || n === '6轨6扇') per = 6
      else if (n === '单轨单扇') per = 1
      else if (n === '折叠5扇' || n === '5轨5扇') per = 5
      else if (n === '折叠7扇' || n === '7轨7扇') per = 7
      else if (n === '折叠8扇' || n === '8轨8扇') per = 8
      else if (n === '折叠9扇' || n === '9轨9扇') per = 9
      if (per === 0) return acc
      return acc + (r.quantity || 0) * per
    }, 0),
  )

  /**
   * `vo` 平开门扇数：型材含「钻石」跳过；归一化后的开向 ∈ 单开 8 项 `+数量`、
   * ∈ 双开 6 项 `+2×数量`、其余不计。
   */
  const pingFans = computed(() =>
    deps.filteredRows.value.reduce((acc, r) => {
      if (r.profile && r.profile.includes('钻石')) return acc
      const d = normDirection(r.direction)
      if (PING_SINGLE_DIRECTIONS.includes(d)) return acc + (r.quantity || 0)
      if (PING_DOUBLE_DIRECTIONS.includes(d)) return acc + 2 * (r.quantity || 0)
      return acc
    }, 0),
  )

  /**
   * `mo` 移门亮窗个数：`亮窗总高 > 0` 且 `轨道种类` 非空且**不等于字符串 `"NULL"`** ⇒ `+数量`。
   * ⚠️ `"NULL"` 是**四个字母的字符串**（旧库里真出现过），不是 `null` —— 别改成 `!= null`。
   */
  const lightWindows = computed(() =>
    deps.filteredRows.value.reduce(
      (acc, r) =>
        r.light_window_height > 0 && r.track && r.track !== 'NULL' && r.track !== ''
          ? acc + (r.quantity || 0)
          : acc,
      0,
    ),
  )

  /** `go` 淋浴房扇数：扇数 ∈ {一固一活, 双活} ⇒ `+2×数量`；否则型材含「钻石」⇒ `+数量`。 */
  const showerFans = computed(() =>
    deps.filteredRows.value.reduce((acc, r) => {
      if (r.fans === '一固一活' || r.fans === '双活') return acc + 2 * (r.quantity || 0)
      if (r.profile && r.profile.includes('钻石')) return acc + (r.quantity || 0)
      return acc
    }, 0),
  )

  /**
   * `fo` 其它：**不属于上面任何一类**的行才 `+数量`。
   *
   * ⚠️ 这里有个**容易照文档写错**的地方：分析文档 §5.4 把「其它」写成「（且非哑口）」，
   *    但旧版源码里「哑口」**只参与「移门」那一条判据**（`d = 是移门扇数 && !哑口`），
   *    并没有一个总的「哑口 ⇒ 不算其它」的分支。所以一行「哑口」如果没有亮窗 / 不是淋浴 /
   *    不是钻石 / 开向不在 14 项里，它**是会被算进「其它」的**。
   *    这里**照源码写**（`includes(哑口)` 只影响 `isMove`），并已在
   *    `docs/2026-09-19-progress-analysis.md` §5.4 记明这处措辞与源码的差别。
   */
  const others = computed(() =>
    deps.filteredRows.value.reduce((acc, r) => {
      const isYakou = !!r.profile && r.profile.includes('哑口')
      const isMove = (MOVE_FAN_NAMES as readonly string[]).includes(r.fans) && !isYakou
      const isLight =
        r.light_window_height > 0 && !!r.track && r.track !== 'NULL' && r.track !== ''
      const isShower = r.fans === '一固一活' || r.fans === '双活'
      const isDiamond = !!r.profile && r.profile.includes('钻石')
      const isPing = ALL_PING_DIRECTIONS.includes(normDirection(r.direction))
      return isMove || isLight || isShower || isDiamond || isPing ? acc : acc + (r.quantity || 0)
    }, 0),
  )

  /**
   * `po` 时间区间：`no` 里所有 `日期` 的 min/max，格式化成 `YYYY-MM-DD`（`toISOString().slice(0,10)`）。
   * 空集 ⇒ `{earliest:'', latest:''}`。
   * ⚠️ 旧版对**解析不出来的日期**没有防护（`new Date(x)` 得到 Invalid Date ⇒ `toISOString()` 会抛）。
   *    日期是后端 `dateText()` 格式化过的串，这里不改口径、也不加兜底。
   */
  const dateRange = computed(() => {
    const list = deps.filteredRows.value
    if (list.length === 0) return { earliest: '', latest: '' }
    const stamps = list
      .map((r) => r['日期'])
      .filter((d) => d)
      .map((d) => new Date(d).getTime())
    if (stamps.length === 0) return { earliest: '', latest: '' }
    const fmt = (ms: number) => new Date(ms).toISOString().split('T')[0]
    return { earliest: fmt(Math.min(...stamps)), latest: fmt(Math.max(...stamps)) }
  })

  /**
   * 统计行的后半段（旧版那个 `<span class="total-info">` 的内容，**含开头的空格与竖线**）。
   * ⚠️ 导出用的那句**不是**直接拼它 —— 旧版两处文案**有两处不同**（见 `exportTable` 的注释）。
   */
  const statsTail = computed(
    () =>
      ` | 时间: ${dateRange.value.earliest} 至 ${dateRange.value.latest}` +
      ` | 移门扇数: ${moveFans.value} | 平开门扇数: ${pingFans.value}` +
      ` | 移门亮窗个数: ${lightWindows.value} | 淋浴房扇数: ${showerFans.value}` +
      ` | 其它: ${others.value}`,
  )

  /*
   * 7 个**回传** —— 本块的产出面就是它们（同 P2/P3/P5/P7/P8/P9 的口径）：
   * 6 个给 `exportTable`（P11，Task 7）+ 1 个（`statsTail`）给模板。
   * 另 5 个（`MOVE_FAN_NAMES` / `PING_SINGLE_DIRECTIONS` / `PING_DOUBLE_DIRECTIONS` /
   * `ALL_PING_DIRECTIONS` / `normDirection`）**不回传**、壳里也不解构 ——
   * 但**别把它们从本文件删掉**：它们是本块内部算 `moveFans` / `pingFans` / `others` 用的
   * 常量与辅助函数（见文件头最后一段 ⚠️）。
   */
  return {
    moveFans, pingFans, lightWindows, showerFans, others, dateRange, statsTail,
  }
}
