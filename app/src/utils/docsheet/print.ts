// C 家族自绘单据 · 打印链路 —— 移植自旧版组件 expose 的 `printDirect`
// （GS:799-848 / PS2:825-874）。
//
// ⚠️ 本文件是**组件层新增**的（旧版没有这个模块，只有组件里的一个方法）——
//    与 `qr.ts` 同理：整段都是「造 HTML → 隐藏 iframe → 打印」的纯逻辑，与 Vue 无关。
//
// 旧版有**三条**打印路径（报告 §10.1），新版两张单据都只做第一条：
//   · `printDirect()`          —— 本文件。**无参**，自己重建 HTML 字符串（不是 clone 预览 DOM）。
//                                 Home 的「手动打印」按钮走它（§11.4 key=22）。
//   · `printSilent()`          —— Electron IPC 静默打印（GS:849-889 / PS2:875-915）。
//                                 **新版没有 Electron**，载体不存在 ⇒ 不做（与收据单2 同一处理）。
//                                 ⚠️ 但两张单据的 `printSilent` 文案逐字相同（§10 CONFIRMED），
//                                 将来接入 Electron 时两边可共用一份。
//   · 预览 + 浏览器 Ctrl+P      —— 旧版由 Home 的预览容器承担。新版抽屉自己就有预览容器，
//                                 用户直接 Ctrl+P 即可（等价物，不需要代码）。
//
// ⚠️ **§10 CONFIRMED：两张单据的 `printDirect` 逐字相同**，唯一差别是 `<title>`
// （由 `profile.documentTitle` 给）与 Loading 文案（组件层的 `正在生成生产单...` /
// `正在生成玻璃合片单...`，不在本层）。所以这里一份实现服务两张单据。
//
// ⚠️ **与收据单的关键差异（别照搬 `receipt2/print.ts` 的心智模型）**：
//   |            | 收据单 `printFromContainer(容器)` | 本家族 `printDirect()` |
//   | 输入        | 预览 DOM 的 **clone**              | **重新构建的 HTML 字符串**（无参）|
//   | 等待后延时  | **500ms**                          | **300ms**                  |
//   | 摘 iframe   | 1000ms                             | 1000ms                     |
//   | 等图片      | 有，无超时                          | 有，**旧版也无超时**（见下）|

import type { DocSheetConfig, DocSheetRow, RenderOptions } from './types'
import type { DocSheetProfile } from './profile'
import { MEASURE_IMAGE_TIMEOUT_MS, buildDocSheetDocument, waitForImages } from './paginate'

/**
 * `doc.write` 之后、`print()` 之前的固定等待 ms（GS:846 / PS2:872 的 `300`）。
 *
 * ⚠️ **照抄 300，不要向收据单的 500 看齐** —— 两个数是各自旧版里的既有事实（§10.2 对照表）。
 */
export const PRINT_BEFORE_DIALOG_MS = 300

/** `print()` 之后多久摘掉 iframe（GS:847 的 `1e3`）。提前摘会让部分浏览器打出空白。 */
export const PRINT_IFRAME_REMOVE_MS = 1000

/**
 * 隐藏 iframe 的样式（GS:802-803 **逐字**）—— C 家族与 PS 的缺省值。
 *
 * ⚠️ 与量测用的那个（`top:-9999px`）不同：打印这个在 `top:0;left:0`，**照抄别统一**。
 */
export const PRINT_IFRAME_STYLE =
  'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;'

/**
 * **打印骨架**：把一份**完整文档 HTML** 塞进隐藏 iframe，唤起浏览器打印对话框。
 *
 * 本函数是 §8.2 #15 那次参数化的产物 —— 旧版 `printDirect` 的骨架（iframe 样式 / 等图 /
 * 300ms / focus + print / 1000ms 摘除）在 C 家族与自定义生产单之间**逐字相同**（§6.1 CONFIRMED），
 * **唯一的差别是「文档怎么造」**：C 家族走 `buildDocumentHtml`（只有 `<title>`），
 * 自定义生产单走 `ne`（head 里**多一段 `<style>`**，§4.3）。
 * ⇒ 把骨架单独提出来，两边的 `print.ts` 各自造完文档再调它。**C 家族路径逐字未动。**
 *
 * 时序（GS:799-848，逐条）：
 *   1. 建隐藏 iframe → 挂 body → `document.write` → `close`；
 *   2. 等所有 `<img>` 完成；
 *   3. **300ms** → `contentWindow.focus()` + `print()`；
 *   4. **1000ms** 后（且 iframe 还在 body 里才）摘掉。
 *
 * ⚠️ **一处有意的改进（用户 2026-09-17 报告 §9.3 / §13.9 建议）**：第 2 步**带 2s 兜底**。
 * 旧版这段等待 Promise **没有 `setTimeout`**，任一张 `<img>` 既不 `onload` 也不 `onerror`
 * （断链但连接挂起）时，**打印对话框永远不会弹**、遮罩一直转。量测那条链路本来就有 2s 兜底
 * （GS:505），打印这条**漏了** —— 这是旧版的缺陷。新版传 `MEASURE_IMAGE_TIMEOUT_MS`，
 * 与量测保持一致：等不到的图片不再阻塞打印（打出来那一格是空的，与「图片加载失败」同观感）。
 *
 * ⚠️ **第二处参数化（§8.2 #15 之后的追加，本单新增）**：`iframeStyle`。
 *    自定义合格标签（ic=13）的 iframe 是**真实尺寸**的
 *    （`position:fixed;top:-9999px;left:-9999px;width:{纸宽}mm;height:{纸高}mm;…`，`QL:943-947`），
 *    与这里的 `0×0` **不是同一回事**（§骨架 §5.1 把它列为四张自绘单据里**唯一的结构性差异**）。
 *    ⇒ 提成第 2 个可选入参，**缺省仍是 `PRINT_IFRAME_STYLE`** ——
 *      C 家族（`printDocSheetDirect`）与 PS（`printProductionSheetDirect`）**都不传**，
 *      两条现路径行为零变化。
 *
 * @param html **完整文档**（含 `<!DOCTYPE html>`）—— 调用方负责造。
 * @param iframeStyle 隐藏 iframe 的 `cssText`。缺省 `PRINT_IFRAME_STYLE`（C 家族 / PS 逐字未动）。
 */
export async function printHtmlViaIframe(
  html: string,
  iframeStyle: string = PRINT_IFRAME_STYLE,
): Promise<void> {
  const iframe = document.createElement('iframe') // GS:808
  iframe.style.cssText = iframeStyle // GS:809-810
  document.body.appendChild(iframe) // GS:811

  try {
    const win = iframe.contentWindow
    const doc = iframe.contentDocument || win?.document // GS:812
    if (!win || !doc) throw new Error('无法创建打印框架')

    doc.open() // GS:813
    doc.write(html) // GS:814
    doc.close() // GS:815

    await waitForImages(doc, MEASURE_IMAGE_TIMEOUT_MS) // GS:816-829（+ 新版补的 2s 兜底）

    // GS:830-841 —— 两段延时都是旧版就有的（300ms 在 `print()` 之前、1000ms 在之后），
    // 别把第二段也 await 掉：那样调用方要等满 1.3s 才拿到控制权，而旧版是立刻返回的。
    await new Promise<void>((resolve) => setTimeout(resolve, PRINT_BEFORE_DIALOG_MS))
    win.focus() // GS:833
    win.print() // GS:834
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe) // GS:838-840
    }, PRINT_IFRAME_REMOVE_MS)
  } catch (e) {
    // 旧版没有 finally 清理（异常时 iframe 会赖在 body 上）；这里补掉，正常路径逐字未动。
    if (document.body.contains(iframe)) document.body.removeChild(iframe)
    throw e
  }
}

/**
 * 「直接打印」（C 家族）—— 重建整份单据文档，交给 `printHtmlViaIframe`。
 *
 * 提示文案（旧版在这里弹的 `ElMessage.success("已打开打印对话框")` / 失败时的
 * `ElMessage.error("打印失败: …")`）**留给组件层** —— Naive 的 `useMessage()` 只能在 setup 里拿。
 * 异常照旧版**向上抛**（旧的 catch 只负责弹提示，没有任何清理逻辑）。
 */
export async function printDocSheetDirect<R extends DocSheetRow>(
  rows: R[],
  config: DocSheetConfig,
  opts: RenderOptions,
  profile: DocSheetProfile,
): Promise<void> {
  const html = await buildDocSheetDocument(rows, config, opts, profile) // 旧版 `J()`，GS:806
  await printHtmlViaIframe(html) // GS:808-841 —— 骨架见上
}
