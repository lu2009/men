/**
 * 行级状态类（旧版 `Qo` + `Zo`/`Xo`/`jo`）—— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）：`Home.vue:2016-2103` —— **整段一段**，
 * 含分区头、四个声明与它们各自的 JSDoc（`rowClass` 那份 30 行）。
 * ⚠️ 方案 §3.1 把它写成 `2016-2064` —— **少算 39 行，会把 `rowClass` 整条切掉**
 *    （`2064` 正好是 `expandedIds` 那一行）。以 `2016-2103` 为准（实测）。
 *
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（B7 一条：4 个声明逐字一致）。
 *
 * ## 注入 3 项 / 回传 **1** 项
 *
 * | 注入项 | 正主 | 体里怎么用 |
 * |---|---|---|
 * | `filtered` | B3 `useHomeFilterView` | `duplicateKeys` 的样本（旧版 `ps.value`，全量、非当前页） |
 * | `expandedRowKeys` | B6 `useHomeExpand` | `expandedIds` 由它派生 |
 * | `loadedIds` | B6 | `rowClass` 的 `loaded-row` |
 *
 * ⚠️ **只回传 `rowClass` 一项** —— `dupKey` / `duplicateKeys` / `expandedIds` 在段外**零命中**
 *    （实测），回传了页面也没人解构，解构出来就是未使用变量（`vue-tsc` 的 TS6133）。
 *    **别照「把返回的全解构一遍」办。**
 *
 * ## 与 B4 相反的一条（别互相类推）
 *
 * `rowClass` 是**真模板绑定**：`Home.vue` 的 `<DataTable :row-class-name="rowClass">`。
 * ⇒ 页面侧**必须**把它当**顶层绑定**（解构），写成 `rowStatus.rowClass` 会让模板拿到
 * **Ref 对象**而不是函数（naive 会当成非函数处理 ⇒ 类名全丢，**不报错**）。
 * （对照：B4 那 6 个名字在模板里零命中，那边解构只是约定。见 `useHomeOrderNo.ts` 文件头。）
 *
 * ⚠️ **本块与 `docs/home-audit/rowstate-logiccheck.mjs` 的关系**：那个台子**不读本文件** ——
 *    它自己留了一份**照抄的副本**（同逻辑、同夹具）来跟旧版逐字比。
 *    ⇒ 本块搬走时它**不会报红**（实测：105 条照过），只在注释里留了指针。
 *    ⇒ 也就是说：**这份文件改了而台子里那份没跟着改，两边会静默漂开**，台子照样绿。
 *    改本文件里那几个判据时，**记得同步改台子里那份副本**（那是它文件头自己写明的约定）。
 */
import { computed, type Ref } from 'vue'
import type { DataTableRowKey } from 'naive-ui'
import type { OrderSummaryDto } from '../../api/types'

/** `useHomeRowStatus()` 的注入面。**只放页面拥有的东西**（见文件头那张表）。 */
export interface HomeRowStatusDeps {
  /** B3 拥有（`useHomeFilterView` 借出）—— 旧版 `ps.value`。 */
  filtered: Ref<OrderSummaryDto[]>
  /** B6 拥有（`useHomeExpand` 借出）—— 旧版 `jo` 的来源。 */
  expandedRowKeys: Ref<DataTableRowKey[]>
  /** B6 拥有（`useHomeExpand` 借出）—— 旧版 `_o`。 */
  loadedIds: Ref<Set<number>>
}

/**
 * 行级状态类（§3 的 `row-class-name`）。
 *
 * ⚠️ **构造顺序**：三项注入都来自 B3 / B6，都是 setup 顶层即时求值 ⇒ 本调用必须在
 * `useHomeExpand`(B6) **之后** —— 传早了拿到 `undefined`，且**不一定报错**
 * （只有表格渲染那一瞬间才炸）。
 */
export function useHomeRowStatus(deps: HomeRowStatusDeps) {
  // ---------------------------------------------------------------------------
  // 行级状态类（旧版 `Qo`，`:7842-7849`）
  // ---------------------------------------------------------------------------
  /**
   * 重复单判据键（旧版 `Zo`，`:7827-7831`）：
   *
   * ```js
   * Ko = e => e == null ? "" : String(e).trim()
   * Zo = e => { const t=Ko(e.客户), l=Ko(e.门数), o=Ko(e.总价)
   *             return t && l && o ? t + "__" + l + "__" + o : "" }
   * ```
   *
   * 三个字段**各自 trim 后都非空**才成键；任一个为空（`""` 是 falsy）⇒ 返回 `""` ⇒ **不参与重复判定**。
   * ⚠️ 数值 `0` 经 `String()` 是 `"0"`（真值）⇒ 门数/总价为 0 的单**仍然参与**。
   */
  function dupKey(r: OrderSummaryDto): string {
    const k = (v: unknown) => (v == null ? '' : String(v).trim())
    const client = k(r.client_name)
    const doors = k(r.door_count)
    const total = k(r.total_price)
    return client && doors && total ? `${client}__${doors}__${total}` : ''
  }

  /**
   * 「重复单」键集合（旧版 `Xo`，`:7830-7841`）—— 在样本里出现**超过 1 次**的键。
   *
   * ⚠️ **样本是 `ps`**（旧版 `:7832` 读 `ps.value`）＝ **筛选链的全量结果，不是当前页**
   *    （分页切片 `Cs` 是 `ps.slice(...)`，`:11180-11183`）。新版对应 `filtered`。
   *
   * ⚠️ **有意偏离**：新版 `filtered` 里还含**列头筛选**，而旧版那一步在 el-table 内部、**分页之后**
   *    （见 `columnFilterState` 的注释）。⇒ 勾了列头筛选时，新版做重复判定的样本**比旧版大**。
   *    这是「列头筛选改全量」那次拍板（用户 2026-09-18）的连带结果，不另开分支。
   */
  const duplicateKeys = computed(() => {
    const counts = new Map<string, number>()
    for (const r of deps.filtered.value) {
      const k = dupKey(r)
      if (!k) continue
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const out = new Set<string>()
    counts.forEach((n, k) => {
      if (n > 1) out.add(k)
    })
    return out
  })

  /** 当前展开的订单 id（旧版 `jo`，`:7772` 展开时 add、`:7826` 收起时 delete）。 */
  const expandedIds = computed(() => new Set(deps.expandedRowKeys.value.map((k) => Number(k))))

  /**
   * `n-data-table` 的 `row-class-name`（旧版 `Qo`，`:7842-7849`）：
   *
   * ```js
   * Qo = ({ row }) => {
   *   const l = []
   *   jo.value.has(row.回执单号) && l.push("expanded-row")
   *   _o.value.has(row.回执单号) && l.push("loaded-row")
   *   0 === so(row) && l.push("paid-row")            // ← 死码，不实现，见下
   *   const o = Zo(row)
   *   o && Xo.value.has(o) && l.push("duplicate-order-row")
   *   return l.join(" ")
   * }
   * ```
   *
   * ⚠️ **`paid-row` 不实现**：`grep -r paid-row legacy/` **零命中** —— 旧版加了类，但
   *    `legacy/css/*.css`（含 `Home-97d96482.css`）里**没有任何 `.paid-row` 规则**，
   *    渲染出来不产生任何效果。照抄只会多一个不生效的类名，故略去（旧版侧是死码）。
   *
   * ⚠️ **键的等价映射**：旧版这三个集合都按 `回执单号` 建，因为旧版的 `row-key` 就是它
   *    （`:11300` `"row-key":s(467)`，`dr(467)` = 回执单号）。新版 `row-key` 是 DB `id`
   *    （见模板）⇒ 这里一并换成 `id`。
   *    唯一不严格等价的边角：`receipt_no` 在新库里**允许为空串**（`0009_orders.sql:8`
   *    `TEXT NOT NULL DEFAULT ''`，唯一索引是 `WHERE receipt_no <> ''`）。旧版按 `''` 成键时，
   *    展开**任意一条**空号单会让**所有**空号单一起亮；新版按 `id` 只亮展开的那一条。
   *    取值更合理的一侧（真实数据里回执单号必填），且与旧版在「回执单号非空」时逐字一致。
   *
   * ⚠️ 类的**顺序**与旧版一致（`expanded-row` → `loaded-row` → `duplicate-order-row`）；
   *    但 CSS 的层叠不靠顺序，见 `<style>` 里那段说明。
   */
  function rowClass(r: OrderSummaryDto): string {
    const classes: string[] = []
    if (expandedIds.value.has(r.id)) classes.push('expanded-row')
    if (deps.loadedIds.value.has(r.id)) classes.push('loaded-row')
    const k = dupKey(r)
    if (k && duplicateKeys.value.has(k)) classes.push('duplicate-order-row')
    return classes.join(' ')
  }

  return {
    // ⚠️ **只回传这一项** —— 另外三个（`dupKey` / `duplicateKeys` / `expandedIds`）段外零命中，
    // 回传了也没人解构（解构出来就是 TS6133）。见文件头。
    rowClass,
  }
}
