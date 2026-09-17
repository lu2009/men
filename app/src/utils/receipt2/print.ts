// 收据单2 的打印 / 复制 / 导出。
//
// 逐字对应旧版 `Receipt2.deobfuscated.js`：
//   · `printFromContainer`    :1226-1270
//   · `copyPreviewToClipboard` :1154-1185
//   · `exportPreviewToPdf`     :1186-1225
//
// ⚠️ 旧版另两条路**新版有意不做**（见 `docs/2026-09-17-receipt2-analysis.md` §9）：
//   · `printSilent`(:1271-1336) —— Electron IPC 静默打印，新版只有浏览器，无载体；
//   · `printDirect`(:1113-1137) —— **死代码**，Home 全库 0 调用点，内含一句被丢弃的调试 `JSON.stringify`。
//
// ⚠️ **一处有意的偏离**：旧版 `.r2-page-wrap` 包装层**只在 Electron 路径生成**，
// 而 `@media print` 的横向旋转块依赖它提供的 `overflow:hidden` 裁切与 `page-break-after:always` 分页
// （旋转本身不依赖它——`.receipt2-page` 那条规则不带 wrap 前缀，仍会命中）。
// 结果是浏览器路径打**横版多页**时分页/裁切异常。新版**两条路径都插包装层**：属修 bug。

import html2canvas from 'html2canvas'

import { css } from './css'
import type { ColumnWidths, FontSettings, PaperSettings } from './types'

/** 打印前要摘掉的列宽拖拽手柄 —— 不摘会打进纸里。 */
const RESIZE_HANDLE_SEL = '.r2-resize-handle'

/** 单张收据页的选择器（导出 PDF 用）。 */
const PAGE_SEL = '.receipt2-page'

/**
 * 等容器内所有 `<img>` 加载完。无图立即 resolve。
 * 照抄旧版 :1247-1259：已 `complete` 的直接计数，否则挂 `onload`/`onerror`。
 */
function waitForImages(root: ParentNode): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  if (imgs.length === 0) return Promise.resolve()
  return new Promise((resolve) => {
    let done = 0
    const step = () => {
      done++
      if (done === imgs.length) resolve()
    }
    for (const img of imgs) {
      if (img.complete) step()
      else {
        img.onload = step
        img.onerror = step
      }
    }
  })
}

export interface PrintDeps {
  fonts: FontSettings
  paper: PaperSettings
  columnWidths: ColumnWidths
}

/**
 * 从预览容器打印 —— Home「打印」按钮走的就是这条。
 *
 * ⚠️ **不是**「把预览 DOM 原样搬过去」：旧版是**重新生成 CSS**（用当前生效的字号/纸张/列宽），
 * 再与克隆体的 `innerHTML` 拼成一个完整 HTML 文档写进 iframe。
 * 这样打印用的样式永远是最新的，不受预览渲染时机影响。
 *
 * 时序照抄旧版：`document.write` → 等图片 → **500ms** → `focus()` + `print()`
 * → 再 **1000ms** 且 iframe 仍在 body 里才移除。两段等待是旧版就有的，去掉会让部分浏览器打出空白。
 */
export async function printFromContainer(container: HTMLElement, deps: PrintDeps): Promise<void> {
  if (!container) return

  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll(RESIZE_HANDLE_SEL).forEach((el) => el.remove())

  const doc0 =
    // ⚠️ 旧版这行 `<title>` 写的是「收据单2」。新版改成「自定义收据单」——
    // 它是**用户可见**的（浏览器打印对话框标题、另存为 PDF 的默认文件名），
    // 而功能名已按入口按钮定为「自定义收据单」。不属排版保真范围（`check-html/css` 不查这段）。
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义收据单</title>\n    <style>' +
    'html,body{margin:0;padding:0;background:#fff;}' +
    css(deps.fonts, deps.paper, deps.columnWidths) +
    '</style>\n  </head><body><div class="receipt2-root">' +
    clone.innerHTML +
    '</div></body></html>'

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;'
  document.body.appendChild(iframe)

  const win = iframe.contentWindow
  const doc = iframe.contentDocument || win?.document
  if (!win || !doc) {
    document.body.removeChild(iframe)
    throw new Error('打印失败：无法创建打印框架')
  }

  doc.open()
  doc.write(doc0)
  doc.close()

  await waitForImages(doc)

  setTimeout(() => {
    win.focus()
    win.print()
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe)
    }, 1000)
  }, 500)
}

/**
 * 把预览容器截成 PNG 放进剪贴板。
 *
 * 照抄旧版 :1154-1185：**截的是传入的整个容器**（不是单页），
 * `scale:2`、白底，先 `await document.fonts.ready` 再截 —— 不等字体的话截出来的字会掉字形。
 * 需要安全上下文（https / localhost），否则 `navigator.clipboard` 是 `undefined`。
 */
export async function copyPreviewToClipboard(container: HTMLElement): Promise<void> {
  if (!container) throw new Error('预览容器未就绪')
  await document.fonts.ready
  const canvas = await html2canvas(container, { useCORS: true, scale: 2, backgroundColor: '#ffffff' })
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob失败'))), 'image/png')
  })
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('当前环境不支持剪贴板写入（需 https 或 localhost）')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

/**
 * 导出 PDF —— **走浏览器打印对话框**（用户在目标里选「另存为 PDF」）。
 *
 * ⚠️ **这是对旧版的有意偏离**（用户 2026-09-17 拍板）。
 * 旧版 `exportPreviewToPdf`(:1186-1225) 用 **jsPDF**：逐页 html2canvas → JPEG 0.95 → 拼成 PDF 下载。
 * 新版**不引 jsPDF**，理由：它只服务这一颗按钮，体积不小；而浏览器打印对话框
 * 本身就能「另存为 PDF」，且出来的 PDF 是**矢量文字**、可选中可搜索，比 jsPDF 那种整页贴图更好。
 *
 * 代价：文件名与保存位置由浏览器决定（不再固定叫「收据单2.pdf」），且会先弹打印对话框。
 */
export async function exportPreviewToPdf(container: HTMLElement, deps: PrintDeps): Promise<void> {
  await printFromContainer(container, deps)
}

export { PAGE_SEL as RECEIPT2_PAGE_SEL, RESIZE_HANDLE_SEL as RECEIPT2_RESIZE_HANDLE_SEL }
