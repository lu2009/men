// 自定义玻璃合片单 · 打印链路 —— 实现已上移到公共底座 `../docsheet/print.ts`
// （逐字移植自旧版组件 expose 的 `printDirect`，GS:799-848；与收据单的三处时序差异、
//  以及「等图补 2s 兜底」那处有意改进见该文件头注）。
//
// ⚠️ 本文件相对 PS2 **逐字相同**（§10 CONFIRMED），唯一差异是 `<title>` ——
// 由 `GLASSSHEET2_PROFILE.documentTitle`（「自定义玻璃合片单」）给；
// Loading 文案「正在生成玻璃合片单...」属于组件层，不在本层。

import { printDocSheetDirect } from '../docsheet/print'
import { GLASSSHEET2_PROFILE } from './profile'
import type { GlassSheet2Config, GlassSheet2Row, RenderOptions } from './types'

/**
 * `doc.write` 之后、`print()` 之前的固定等待 ms（GS:846 的 `300`）。
 * ⚠️ **照抄 300，不要向收据单的 500 看齐**（§10.2 对照表）。
 */
export { PRINT_BEFORE_DIALOG_MS, PRINT_IFRAME_REMOVE_MS } from '../docsheet/print'

/**
 * 「直接打印」—— 重建整份单据文档，塞进隐藏 iframe，唤起浏览器打印对话框。
 *
 * 时序（GS:799-848）：构建完整文档 → 隐藏 iframe + `document.write` → 等图（**带 2s 兜底**）
 * → 300ms → `focus()` + `print()` → 1000ms 后摘 iframe。
 *
 * 提示文案（`已打开打印对话框` / `打印失败: …`）留给组件层 —— Naive 的 `useMessage()`
 * 只能在 setup 里拿。异常照旧版**向上抛**。
 */
export function printGlassSheet2Direct(
  rows: GlassSheet2Row[],
  config: GlassSheet2Config,
  opts: RenderOptions = {},
): Promise<void> {
  return printDocSheetDirect(rows, config, opts, GLASSSHEET2_PROFILE)
}
