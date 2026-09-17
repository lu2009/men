// 自定义生产单2 · 打印链路 —— 实现已上移到公共底座 `../docsheet/print.ts`
// （逐字移植自旧版组件 expose 的 `printDirect`，PS2:825-874）。
//
// ⚠️ **§10 CONFIRMED：本单据与 GS2 的 `printDirect` 逐字相同**，唯一差异是 `<title>`
// （由 `PRODUCTIONSHEET2_PROFILE.documentTitle`「自定义生产单2」给）；Loading 文案
// 「正在生成生产单...」属于组件层，不在本层。
//
// ⚠️ 顺带记一处**无行为差异**的旧版噪声：GS2 的 `printDirect` 里有一段没用的 `const a = l,`
// （GS:823），PS2 把它去掉了（PS2:849）—— 纯噪声，不用管。
//
// ⚠️ **expose 面与 GS2 一模一样**（§7.2）：`buildProductionSheet2Html` / `refreshPreview` /
// `openSettingsDialog` / `openLayoutEditor` / `printDirect` / `printSilent` / `isElectronEnv`。
// `printSilent`（Electron IPC，PS2:875-915）**新版不做**（没有 Electron 载体），
// 但其四句文案与 GS2 逐字相同，将来接入时两边可共用。

import { printDocSheetDirect } from '../docsheet/print'
import { PRODUCTIONSHEET2_PROFILE } from './profile'
import type { ProductionSheet2Config, ProductionSheet2Row, RenderOptions } from './types'

/**
 * `doc.write` 之后、`print()` 之前的固定等待 ms（PS2:872 的 `300`）。
 * ⚠️ **照抄 300，不要向收据单的 500 看齐**（§10.2 对照表）。
 */
export { PRINT_BEFORE_DIALOG_MS, PRINT_IFRAME_REMOVE_MS } from '../docsheet/print'

/**
 * 「直接打印」—— 重建整份单据文档，塞进隐藏 iframe，唤起浏览器打印对话框。
 *
 * 时序（PS2:825-874）：构建完整文档 → 隐藏 iframe + `document.write` → 等图（**带 2s 兜底**）
 * → 300ms → `focus()` + `print()` → 1000ms 后摘 iframe。
 *
 * 提示文案（`已打开打印对话框` / `打印失败: …`）留给组件层 —— Naive 的 `useMessage()`
 * 只能在 setup 里拿。异常照旧版**向上抛**。
 */
export function printProductionSheet2Direct(
  rows: ProductionSheet2Row[],
  config: ProductionSheet2Config,
  opts: RenderOptions = {},
): Promise<void> {
  return printDocSheetDirect(rows, config, opts, PRODUCTIONSHEET2_PROFILE)
}
