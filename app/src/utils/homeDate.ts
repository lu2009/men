/**
 * Home 页的「今天」与两套日期口径 —— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）：
 *   · `Home.vue:1108` —— `pad`
 *   · `Home.vue:1110-1119` —— `localToday`（含其 JSDoc 1110-1115）
 *   · `Home.vue:2398-2408` —— `legacyToday`（含其上方三行注释 2398-2400）
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（`homeDate.ts` 那一条）。
 *
 * ⚠️ **`localToday()` 与 `legacyToday()` 是两套口径，绝不合并**（spec §6.3-9）：
 *   · `localToday()` —— **本地时区**，返回 `YYYY-MM-DD` **字符串**；
 *   · `legacyToday()` —— 经 `toISOString()`（**UTC**），返回**时间戳**。
 * 这两个函数体一字未改 —— 下面 `localToday` 的 JSDoc 里那句「别与 `legacyToday()` 混」
 * 就是随搬迁一起过来的原文，**别删**。
 *
 * ⚠️ 本文件**只**放这两个口径与它们的公共件 `pad`；页面自己的日期格式化
 *    （`isoDate` 等）**仍留在 `Home.vue`** —— 它们不是「放错位置」的纯件。
 */
export const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 「今天」的 **YYYY-MM-DD**，按**本地时区**（旧版口径：`getFullYear/getMonth/getDate`）。
 *
 * ⚠️ 别与 `legacyToday()` 混 —— 那个返回的是 date-picker 用的**时间戳**、且走 `toISOString()`（**UTC**）。
 * 跨层写日期一律用本函数（`submitDate` 早就自己拼了一份等价的，这里抽出来共用）。
 */
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 旧版 `ka` 初值（`:8036`）= `new Date().toISOString().split("T")[0]` —— **UTC** 日期串。
// 这里取同一个串再按本地日历还原成时间戳，保证与旧版显示同一天
//（含 UTC+8 凌晨会取到"昨天"这一旧版行为，属有意保真）。
export function legacyToday(): number {
  const [y, m, d] = new Date()
    .toISOString()
    .split('T')[0]
    .split('-')
    .map(Number)
  return new Date(y, m - 1, d).getTime()
}
