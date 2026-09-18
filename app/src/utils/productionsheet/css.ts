// 自定义生产单 · CSS 发生器 —— 逐字移植旧版 `le`（`PS:1024-1034`）。
//
// 验收夹具：`docs/custom-docs-recon/ps-default.css`
//   **709 字符 / 8 条规则 / `shasum 4cc2aca8a830039602bd53b40f87e242f697dccb`**（§4.2 CONFIRMED）。
//
// ⚠️ **底座的 `css.ts` 一行都用不上** —— 不是前缀替换（§4.2 那张逐条差异表）：
//   |                        | 底座（GS2/PS2）                        | PS                          |
//   |------------------------|----------------------------------------|-----------------------------|
//   | 规则条数 / 字符数       | 23 条 / 1739                           | **8 条 / 709**              |
//   | `.ps-root`（基础）      | `background:#fff; color:#111; width:{a}mm;` | `background:#fff; color:#000;`（**无 width**）|
//   | `.ps-sheet`（基础）     | **无此规则**                            | `background:#fff; display:block;` |
//   | `@media screen` padding | `8mm`                                  | **`12mm`**                  |
//   | `@media screen` sheet   | `box-shadow + height:{n}mm + overflow:hidden` | **只有 `box-shadow`**  |
//   | `@media print` html,body| 有宽高 + `overflow:visible !important`  | **无宽高、无 overflow**      |
//   | `@media print` sheet    | 宽高 + `break-after:page` + `:last-child` 例外 | **只有 `box-shadow:none !important;`** |
//   | `.{ns}-title/-page-num/-table/-line/-qr/-order/-lock-img/-door-img` | 全有（含 4 个死选择器）| **全无** |
//
// ⚠️ **PS 在 `@media print` 里没有 `break-after:page` / `page-break-inside`**：
//    分页靠 `sheetStyle` 里的**内联** `page-break-after:always`（`PS:1057`，见 `html.ts`）。
//    TODO(未确认): 现代 Chromium 是否仍认内联 `page-break-after` 而不认 `break-after`
//    （§9.7）。旧版就是这么写的，**照抄**；若实测分页不对，第一处要怀疑这里。

import type { ProductionSheetConfig } from './types'

/**
 * 生成整段 CSS（旧版 `le`，`PS:1024-1034`）。
 *
 * ★ **只代入两个数**：`paper.widthMm` / `paper.heightMm`
 *   —— **不读 `paddingMm`、不读 `orientation`、不读 `globalHeaderFont`**（§4.2 注）。
 *   所以改内边距/方向/全局字体的**数值**不会改动这段 CSS（改宽度/高度才会）。
 *
 * 用「单串拼接」而不是底座的「行数组 + `join('\n')`」：旧版就是一个串，
 * 且首字符是 `\n`、末字符也是 `\n`（`@media print` 块闭合之后）—— **别格式化、别重排**。
 */
export function productionSheetCss(config: ProductionSheetConfig): string {
  const widthMm = config.paper.widthMm // 旧版 `o`
  const heightMm = config.paper.heightMm // 旧版 `a`

  return (
    `\n  .ps-root { background:#fff; color:#000; }\n` +
    `  .ps-sheet { background:#fff; display:block; }\n` +
    `  @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }\n` +
    `  @media screen {\n` +
    `    .ps-root { background:#c0c0c0; padding:12mm; display:flex; flex-wrap:wrap; gap:8mm; align-items:flex-start; justify-content:flex-start; min-width:fit-content; }\n` +
    `    .ps-sheet { box-shadow:0 2px 10px rgba(0,0,0,0.25); }\n` +
    `  }\n` +
    `  @media print {\n` +
    `    html, body { margin:0 !important; padding:0 !important; background:#fff; }\n` +
    `    .ps-root { background:#fff !important; padding:0 !important; gap:0 !important; display:block !important; }\n` +
    `    .ps-sheet { box-shadow:none !important; }\n` +
    `    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n` +
    `  }\n`
  )
}
