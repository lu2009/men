/**
 * 「单号集」拆分 —— 2026-09-20 从 `Home.vue` 搬出（逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `28e36d21`，即本次拆分动工前）：
 *   · `Home.vue:626-643` —— `splitOrderNos`（含其 JSDoc 626-635）
 *   · `Home.vue:644` —— `orderNosOf`
 * 搬迁保真由 `docs/home-audit/home-extract-movecheck.mjs` 机核（`homeOrderNo.ts` 那一条）。
 *
 * ⚠️ **按下划线 `_` 切**（不是空白）。依据是**旧版源码**：
 *    `backend/migrations/0018_home_order_head_fields.sql:4` 的注释把「单号集」写成「空格串」，
 *    **与旧版源码不符** —— 旧版 `Uo`（`:7694-7697`）用的是 `split("_")`，
 *    全 bundle 查不到按空白切单号集的地方。**以旧版源码为准。**
 *    ⚠️ 这句理由**必须留着**：下一个读到那份 migration 注释的人会想改回按空格切。
 *
 * ⚠️ **别与 `app/src/composables/home/useHomeOrderNo.ts` 混** —— 本仓库有两个名字相近的文件：
 *   · 本文件 = **纯函数**（`splitOrderNos` / `orderNosOf`），不读任何页面状态，谁都能 `import`；
 *   · `composables/home/useHomeOrderNo.ts` = **B4 的 composable**（Task 7 才建，带 `use` 前缀、
 *     注入页面依赖、拥有 `orderNoQuery` 那类状态）。
 *   两者**同名域、不同层**：纯件放本文件，带状态的放那个 —— 起早的人别 `import` 错一个。
 *
 * ⚠️ `splitOrderNos` 的 JSDoc 里那句「见 `progressPrefix` 上方那段说明」指向的是
 *    **`Home.vue` 里的**注释（`progressPrefix` 没搬走）—— 指针跨文件了，故在此点明。
 */
import type { OrderSummaryDto } from '../api/types'

/**
 * 单号集 → 单号数组（旧版 `Uo`，`:7694-7697`）：
 * ```js
 * Uo = e => { const l = String(e ?? "").trim()
 *             return l ? l.split("_").map(x => String(x ?? "").trim()).filter(Boolean) : [] }
 * ```
 * ⚠️ **按下划线 `_` 切**（不是空白）。`backend/migrations/0018_home_order_head_fields.sql:4`
 * 的注释写的是「空格串」，与旧版源码不符 —— 这里沿用本文件对 `打单操作` 已经定下的口径
 * （**以旧版源码为准**，见 `progressPrefix` 上方那段说明），两处保持同一套。
 */
export function splitOrderNos(v: unknown): string[] {
  const s = String(v ?? '').trim()
  if (!s) return []
  return s
    .split('_')
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
}
export const orderNosOf = (r: OrderSummaryDto) => splitOrderNos(r.order_no_set)
