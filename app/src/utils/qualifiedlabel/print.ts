// 自定义合格标签 · 打印链路 —— 移植自旧版 expose 的 `printDirect`（`QL:931-985`）。
//
// 与另三张单据的逐字对照（§0.1 / §5.1 CONFIRMED）：
//   | 项          | 底座（GS2/PS2）与 PS                    | QL                             | 判定 |
//   |-------------|----------------------------------------|--------------------------------|------|
//   | iframe 样式  | `top:0;left:0;width:0;height:0`        | **真实尺寸**（见下）             | ⚠️ **唯一结构性差异** |
//   | 等图         | `complete` / `onload` / `onerror`，无超时 | **逐字相同**（`QL:956-965`）    | ✅ |
//   | 延时         | 300ms → focus+print → 1000ms 摘          | 同（`QL:967-975`）             | ✅ |
//   | 文案         | `已打开打印对话框` / `打印失败: `          | 同（`QL:977/979`）             | ✅ |
//   | 文档         | `buildDocumentHtml`（无 head style）     | **`de`（head 多一段 `<style>`）** | ⚠️ 差异（见 `html.ts`）|
//
// ⇒ **骨架复用底座的 `printHtmlViaIframe`**（第 2 参就是为本单加的参数化），
//    文档构造走本单据的 `buildQualifiedLabelDocument`。
//
// ★★ **iframe 是真实尺寸**（`QL:943-947`，§5.1 的 ⚠️）：
// ```
// position:fixed;top:-9999px;left:-9999px;width:{paper.widthMm}mm;height:{paper.heightMm}mm;border:none;visibility:hidden;
// ```
// ⚠️ **不随 `printRotate90` 交换** —— 旋转靠文档内 CSS 的 `transform` 自己转（§2.4）。
//    底座是 `0×0` 的隐藏框（量测用的那个是 `top:-9999px` 但仍是 `0×0`）——这里两者都不是。
//
// `printSilent`（`QL:986-1057`，Electron 静默打印，**逐张循环**）**新版不做** ——
// 没有 Electron 载体，与 PS/PS2/GS2 同一处置（§10.1 D3）。
// ⚠️ 但 `paper.printRotate90` 与 `orientation` 仍是配置的一部分，
//    **CSS 的旋转分支必须实现**（`css.ts`），否则「打印旋转90°」开关会变成摆设。
//
// 提示文案（旧版 `ElMessage.success("已打开打印对话框")` / 失败的 `ElMessage.error("打印失败: …")`）
// **留给组件层** —— Naive 的 `useMessage()` 只能在 setup 里拿。异常照旧版**向上抛**。
//
// ⚠️ 旧版 `printDirect` 会自己弹一个 `ElLoading`（文案「正在生成标签...」，`QL:933-937`），
//    并在 `finally` 里关掉（`QL:982-984`）。**那是组件层的事**（新版用 Naive 的 loading）。

import { printHtmlViaIframe } from '../docsheet/print'
import { buildQualifiedLabelDocument } from './html'
import type { LabelPaper, LabelRow, QualifiedLabelConfig } from './types'
import type { QualifiedLabelRenderOptions } from './html'

/**
 * 本单专属的打印 iframe 样式（`QL:942-947` **逐字**）。
 *
 * ★ 与底座的 `PRINT_IFRAME_STYLE`（`0×0`）**不是同一个东西** ——
 *   本单要一个**真实纸张尺寸**的框：部分浏览器在 `0×0` 的 iframe 里算不出
 *   `mm` → `px` 的换算（`@page` 与 `width:{n}mm` 都依赖它），会打出空白或缩放的图。
 *   这是四张自绘单据里**唯一的结构性差异**（§骨架 §5.1）。
 *
 * ⚠️ **仍用 `paper.widthMm` / `heightMm`，不交换**（旋转交给文档内 CSS）。
 */
export function qualifiedLabelIframeStyle(paper: LabelPaper): string {
  return (
    'position:fixed;top:-9999px;left:-9999px;width:' +
    paper.widthMm +
    'mm;height:' +
    paper.heightMm +
    'mm;border:none;visibility:hidden;' // `QL:943-947`
  )
}

/**
 * 「直接打印」—— 重建整份标签文档，塞进真实尺寸的隐藏 iframe，唤起浏览器打印对话框
 * （`QL:931-985`）。
 *
 * ⚠️ **与本单的 `printSilent` 的分工**（新版不做后者）：`printDirect` 传**全部行**
 *   （`de()` 无参 → `ae` 回落 `getLabels()`），一次文档里放**所有标签**，
 *   由 CSS 的 `page-break-after:always` 分张；
 *   `printSilent` 是**逐张** `de([单条])`（每张一个独立文档）。**别把两条混起来**。
 *
 * @param rows   行数据。**传空/不传 → 空文档**（新版由组件层负责「不传就取 getLabels」，
 *               与 `buildQualifiedLabelHtml` 的契约一致）
 * @param config 生效配置（`r.value`）
 * @param opts   渲染选项（二维码 provider）
 */
export async function printQualifiedLabelDirect(
  rows: readonly LabelRow[] | undefined | null,
  config: QualifiedLabelConfig,
  opts: QualifiedLabelRenderOptions = {},
): Promise<void> {
  const html = buildQualifiedLabelDocument(rows, config, opts) // 旧版 `await de()`，`QL:939`
  await printHtmlViaIframe(html, qualifiedLabelIframeStyle(config.paper)) // `QL:940-976` —— 骨架见 `docsheet/print.ts`
}
