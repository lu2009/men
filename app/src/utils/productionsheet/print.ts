// 自定义生产单 · 打印链路 —— 移植自旧版 expose 的 `printDirect`（`PS:1394-1442`）。
//
// 与 C 家族的逐字对照（§6.1 CONFIRMED）：
//   | 项         | 底座（GS2/PS2）                                  | PS                        | 判定 |
//   |------------|--------------------------------------------------|---------------------------|------|
//   | iframe 样式 | `position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;` | **逐字相同**（`PS:1404-1405`）| ✅ |
//   | 等图        | `complete` / `onload` / `onerror`，**无超时**        | **逐字相同**（`PS:1412-1424`）| ✅ |
//   | 延时        | 300ms → focus+print → 1000ms 摘                    | 同（`PS:1425-1433`）       | ✅ |
//   | 文案        | `已打开打印对话框` / `打印失败: `                     | 同（`PS:1434-1438`）       | ✅ |
//   | 文档        | `buildDocumentHtml`（无 head style）                | **`ne`（head 多一段 `<style>`，§4.3）** | ⚠️ **唯一差异** |
//
// ⇒ **骨架复用底座的 `printHtmlViaIframe`**（§8.2 #15 那次参数化的产物），
//    文档构造走本单据的 `buildProductionSheetDocument`。
//
// ⚠️ **一处与旧版不同、已显式标注的偏离（见下）**：旧版把 300ms 延时**不 await**，
//    把 focus/print 塞在定时器回调里；新版复用的骨架是 `await sleep(300)` 后再 focus/print。
//    两者**打点时刻完全相同**（都在 t≈300ms 调 `print()`、t≈1300ms 摘 iframe），
//    差别只在**调用方拿回控制权的时机**（旧版 t≈0，新版 t≈300ms）。
//
// `printSilent`（`PS:1443-1486`，Electron IPC 静默打印）**新版不做** —— 没有 Electron 载体，
// 与 PS2/GS2 同一处置（§diff §10）。
//
// 提示文案（旧版 `ElMessage.success("已打开打印对话框")` / 失败的 `ElMessage.error("打印失败: …")`）
// **留给组件层** —— Naive 的 `useMessage()` 只能在 setup 里拿。异常照旧版**向上抛**。
//
// ⚠️ 旧版 `printDirect` 会自己弹一个 `ElLoading`（`PS:1396-1400`，文案「正在生成生产单...」），
//    并在 `finally` 里关掉（`PS:1439-1441`）。**那是组件层的事**（新版用 Naive 的 loading）。

import { printHtmlViaIframe } from '../docsheet/print'
import { buildProductionSheetDocument } from './build'
import type {
  ProductionSheetConfig,
  ProductionSheetRenderOptions,
  ProductionSheetRow,
} from './types'

/**
 * 「直接打印」—— 重建整份单据文档，塞进隐藏 iframe，唤起浏览器打印对话框（`PS:1394-1442`）。
 *
 * ⚠️ **有意偏离（1 处，已标注）**：旧版是
 * ```js
 * setTimeout(() => { o.focus(); o.print(); setTimeout(remove, 1e3) }, 300)
 * ```
 * —— 300ms **不被 await**，`printDirect()` 立刻返回（`finally` 里的 `ElLoading.close()`
 * 也随之立刻执行，**早于**打印对话框弹出）。新版复用的 `printHtmlViaIframe` 是
 * `await sleep(300)` → `focus()` / `print()` → `setTimeout(remove, 1000)`。
 *
 * **打点时刻逐条相同**（`print()` 都在 t≈300ms、摘 iframe 都在 t≈1300ms），
 * 唯一差别是**调用方的 promise 何时 resolve**（旧版 t≈0 vs 新版 t≈300ms）。
 * 理由：骨架要能同时服务 C 家族与 PS，而 C 家族那条链路本来就 await（GS:830-841）；
 * 为 PS 单独分叉出一个「不 await」的骨架，会让 §8.2 #15 那次参数化失去意义，
 * 而收益只是一个 loading 遮罩早关 300ms（实际上新版顺序**更合理**：
 * 遮罩恰好在对话框弹出时关闭）。
 * 组件层若想完全复刻旧版的遮罩时序，可在 `await` 之前先关遮罩。
 *
 * @param rows 行数据（`oldSheetProduces(paired)` 的产物）
 */
export async function printProductionSheetDirect(
  rows: ProductionSheetRow[] | undefined,
  config: ProductionSheetConfig,
  opts: ProductionSheetRenderOptions = {},
): Promise<void> {
  const html = await buildProductionSheetDocument(rows, config, opts) // 旧版 `await ne()`，PS:1402
  await printHtmlViaIframe(html) // PS:1403-1433 —— 骨架见 `docsheet/print.ts`
}
