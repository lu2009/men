/**
 * Home 订单管理页的**纯口径函数**（2026-09-20 从 Home.vue §财务/进度口径 搬出，逻辑逐字未改）。
 *
 * `fin` 就是页面上的 `financeSummary`（`ref<Record<string, OrderFinance>>`）。
 * 之前这几个函数闭包捕获 `financeSummary.value`，搬出来后改成形参注入 —— 除此之外一字未动。
 *
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs`（参照提交 `28e36d21`）逐字守着。
 */
import type { OrderFinance, OrderSummaryDto } from '../api/types'

// ---------------------------------------------------------------------------
// 财务/进度口径（§7.1）
// ---------------------------------------------------------------------------
export const fmt = (v: number) => (v ?? 0).toFixed(2)
// 未收金额：优先取财务摘要（服务端下发的「未收金额」），否则回退 总价-定金（§7.1）。
export const unpaidOf = (r: OrderSummaryDto, fin: Record<string, OrderFinance>) => {
  const s = fin[r.id]
  return s ? s.unpaid_amount : r.total_price - r.deposit
}

export function paymentStatus(r: OrderSummaryDto, fin: Record<string, OrderFinance>): string {
  const unpaid = unpaidOf(r, fin)
  if (unpaid <= 0) return '已付'
  if (r.total_price > 0 && unpaid >= r.total_price) return '未付'
  return '部分付'
}

export function progressMatch(r: OrderSummaryDto, opt: string): boolean {
  const s = r.production_status || ''
  if (opt === '已打生产单') return s.includes('生产单')
  if (opt === '未打生产单') return !s.includes('生产单')
  if (opt === '已订玻璃') return s.includes('玻璃订单')
  if (opt === '未订玻璃') return !s.includes('玻璃订单')
  if (opt === '显示全部') return true
  // 旧版 `Ao`（`:7684-7686`）的收尾分支：`n.includes(a)` —— 自定义项按「打单操作里含该串」命中。
  return s.includes(opt)
}

// 旧版 `ma`（`:7986-7991`，已付列 `:11469`）：distinct 的是 **`co(row)` 金额数字**，不是「已付」标签。
// `co`（`:7660`）= `Ht && 已分配金额 != null ? 已分配金额 : 定金||0`；
// 新版财务摘要的 `allocated_amount`（后端注释即「已分配金额」，finance/service.rs:39-42）就是那个字段，
// 取不到摘要时回退 `定金||0` —— 与既有 `unpaidOf`（旧版 `so`）同构。
export function paidOf(r: OrderSummaryDto, fin: Record<string, OrderFinance>): number {
  const s = fin[r.id]
  return s ? s.allocated_amount : r.deposit || 0
}

/**
 * 日期单元格的状态类（旧版 `Ls`，`:11221-11227`）—— **两个类互斥**，且**挂在单元格上**（不是整行）。
 *
 * ```js
 * Ls = e => bs(e) ? "date-audit"                       // 未审核优先，命中就 return
 *                : (0 !== so(e) && 截止日期 &&
 *                   Math.ceil((new Date(截止日期) - now) / 864e5) < 4) ? "date-warning"
 *                : ""
 * ```
 *
 * ⚠️ **`ceil` 不是 `floor`**（`dr(1091)` 解出来就是 `ceil`）—— 这条注释 2026-09-19 更正过，
 *    原写 `floor`。**而且我们的实现目前用的正是 `floor` + 本地午夜**（见下面 `dateCellClass`），
 *    与旧版的 `ceil` + UTC 午夜**不等价**：到期差 4 天那一档旧版不标、我们标，
 *    跨 UTC/本地 8 小时也会差 ⇒ **我们会把「临近截止」标早一天**。
 *    已记为待拍板的行为偏离（`docs/home-audit/00-summary.md` §五），**不是**本注释改了就算对齐。
 *
 * ⚠️ **与旧版对齐时踩过三处，别再改回去**：
 *   ① **`< 4` 没有下界** ⇒ **已逾期（负数）同样命中**。先前写成 `diff >= 0 && diff <= 4`，
 *      把逾期的排除了 —— 而逾期恰恰是最该标红的。
 *   ② **开区间** `< 4`，先前 `<= 4` 多含一天。
 *   ③ 要求 **`未收 != 0`**（已付清不加），先前完全不看付款状态。
 *   另：`Ls` 是**互斥**的（`date-audit` 命中就 return）；先前两个类可以同时命中，
 *      而 CSS 里 `.date-warning` 在后面 ⇒ 后者胜，于是「未审核 + 临近截止」的行颜色也错了。
 *
 * ⚠️ 层级：旧版 CSS 是 **cell 级**（`.date-audit` / `.date-warning`），挂在日期那一格上。
 *    先前用 `rowProps` 挂到了整行 —— 一并改成挂在日期单元格。
 */
export function dateCellClass(r: OrderSummaryDto, fin: Record<string, OrderFinance>): string {
  if (isUnaudited(r)) return 'date-audit'
  const due = r.due_date
  if (!due || unpaidOf(r, fin) === 0) return ''
  const [y, m, d] = due.split('-').map(Number)
  if (!y || !m || !d) return ''
  const diff = Math.floor((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000)
  return diff < 4 ? 'date-warning' : ''
}

/**
 * 「未审核」判据（旧版 `bs`）。`dateCellClass` 与「审核确认」按钮两处共用 —— 抽出来免得两处漂开。
 */
export function isUnaudited(r: OrderSummaryDto): boolean {
  return !r.production_status?.trim() && !r.order_no_set?.trim()
}
