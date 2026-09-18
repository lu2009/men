// 「回执单-其它」三颗图片动作（复制 / 分享 / 下载）的公共实现。
//
// 逐字对应旧版 Home（行号取 `legacy/js/Home.formatted.js`）：
//   · `Mi` 复制回执单（旧版 `:8827-8858`）—— html2canvas → `toBlob` → `ClipboardItem` → `navigator.clipboard.write`
//   · `Ni` 分享回执单(手机)（旧版 `:8859-8907`）—— html2canvas → `toBlob` → `File` → `navigator.share`
//   · `xi` 下载回执单（旧版 `:8747-8802`）—— html2canvas(scale:2) → `toDataURL` → `<a download>` 点击
//
// 三条路的公共骨架（旧版把同一段抄了三遍，这里抽出来）：
//   ① 离屏 `<div style="position:absolute;left:-9999px">` + `innerHTML` = 渲染好的回执 HTML → 挂到 body
//      （旧版 `:8761` / `:8843` / `:8888`，三处逐字相同；宽度/背景**都不设**，比原版节点自然宽度）
//   ② `html2canvas(el, { useCORS: true [, scale: 2] })`
//   ③ 复制 / 分享取 `canvas.toBlob`，下载取 `canvas.toDataURL('image/png')`
//   ④ `finally` 里把离屏 `<div>` 摘掉
//
// ★ **有意偏离（3 处，全部在注释里标明理由）**：
//   · `shareReceiptImage`：旧版在没有 `navigator.share` 的环境下**静默无反馈**（桌面 Chrome 常见），
//     新版按「不支持分享」报错；调用方（`ReceiptOtherDialog.vue`）据此回退到下载 —— 与旧版
//     `fn` 抛错时的 `catch { xi() }` 形态一致，只是把「彻底没反馈」补成了「有提示 + 有兜底」。
//   · `shareReceiptImage`：旧版还有一条 Capacitor 分支（`Filesystem.writeFile` + `Share.share`），
//     新版是**浏览器 + Tauri 2 桌面壳**（`app/src-tauri/`，`package.json` 无 `@capacitor/*`，
//     也没装 Tauri 的 fs/share 插件），没有该载体，一律走浏览器路径。
//   · `downloadReceiptImage`：旧版在 Capacitor 下写 `Documents` 目录，同上无载体，一律走 `<a download>`。
//
// ⚠️ 文件名里的时间戳旧版用的是 **UTC**（`new Date().toISOString()`），不是本地时区。
// 逐字照抄（`dr[1382]`+`dr[936]`）：`回执单_` + ISO 串把 `[T:]` 换成 `-`、去掉毫秒、截前 16 位 + `.png`。

import html2canvas from 'html2canvas'

/** 分享出去的文件名（旧版 `dr[1442]`）。 */
const SHARE_FILE_NAME = 'receipt.png'

/** 分享面板的标题 / 文案（旧版 `dr[753]` / `dr[773]`）。 */
const SHARE_TITLE = '客户回执单'
const SHARE_TEXT = '请分享到微信或其他应用'

/** 文件下载名前缀（旧版 `dr[1382]`）。 */
const DOWNLOAD_PREFIX = '回执单_'

/**
 * 把渲染好的回执 HTML 挂进一个离屏 `<div>`（旧版 `:8761`/`:8843`/`:8888`，三处逐字相同）。
 *
 * ⚠️ 只设 `position:absolute; left:-9999px` —— **不设宽高、不设背景**。
 * html2canvas 会按节点自然尺寸截，跟旧版截出来的图一致。
 */
function mountOffscreen(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

/** 摘掉离屏容器（旧版 `finally` 里的 `document.body.removeChild(a)`）。 */
function unmountOffscreen(el: HTMLDivElement): void {
  if (el.parentNode) document.body.removeChild(el)
}

/**
 * 离屏渲染 → canvas。
 *
 * ⚠️ `scale` 照旧版分档：**复制 / 分享用默认 1**（`:8844` / `:8875` 都只传 `{useCORS:true}`），
 * **下载用 2**（`:8765` 的 `{useCORS:true, scale:2}`）。别图省事统一 —— 下载件是给客户的高清图。
 */
async function renderOffscreenCanvas(html: string, scale?: number): Promise<{ el: HTMLDivElement; canvas: HTMLCanvasElement }> {
  const el = mountOffscreen(html)
  try {
    const canvas = await html2canvas(el, scale ? { useCORS: true, scale } : { useCORS: true })
    return { el, canvas }
  } catch (e) {
    unmountOffscreen(el)
    throw e
  }
}

/** canvas → PNG Blob（旧版 `:8849` 的 `new Promise(res => canvas.toBlob(res))`，含空值防守）。 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('回执单图片生成失败'))), 'image/png')
  })
}

/** 下载件文件名（旧版 `:8772`）。见文件头关于 UTC 的说明。 */
export function receiptPngName(): string {
  const stamp = new Date().toISOString().replace(/[T:]/g, '-').split('.')[0].slice(0, 16)
  return `${DOWNLOAD_PREFIX}${stamp}.png`
}

/**
 * 复制回执单 → 系统剪贴板（旧版 `Mi`，`:8827-8858`）。
 *
 * 旧版**没有**能力检测：`ClipboardItem` 不存在时是 `ReferenceError` 被 catch 掉、
 * 由调用方回退到下载。新版把这一步显式化，抛的文案取旧版 `Bi` 里那句能力提示（`dr[1203]`）。
 *
 * ⚠️ 需要安全上下文（https / localhost），否则 `navigator.clipboard` 是 `undefined`。
 */
export async function copyReceiptImage(html: string): Promise<void> {
  const { el, canvas } = await renderOffscreenCanvas(html)
  try {
    const blob = await canvasToBlob(canvas)
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      throw new Error('当前浏览器不支持复制图片，请使用 Chrome/Edge 或下载图片后发送')
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  } finally {
    unmountOffscreen(el)
  }
}

/**
 * 分享回执单(手机)（旧版 `Ni`，`:8859-8907`）。
 *
 * 旧版分支顺序（`:8876-8906`）：
 *   `navigator.share && navigator.canShare` → `File` → `canShare({files})` 为假就抛 `dr[903]`
 *   → `navigator.share({files, title, text})`；
 *   else 若 `isNativePlatform()` → Capacitor 写 Cache 再 `Share.share`；
 *   else **什么都不做**（静默）。
 *
 * ★ **有意偏离**：最后那个 else 是旧版的疏漏 —— 桌面浏览器上这颗按钮点了没任何反应。
 * 新版把它并入「不支持分享」并抛错，交由调用方提示 + 回退下载。
 */
export async function shareReceiptImage(html: string): Promise<void> {
  const { el, canvas } = await renderOffscreenCanvas(html)
  try {
    const blob = await canvasToBlob(canvas)
    if (!navigator.share || !navigator.canShare) {
      throw new Error('浏览器不支持文件分享')
    }
    const file = new File([blob], SHARE_FILE_NAME, { type: 'image/png' })
    if (!navigator.canShare({ files: [file] })) {
      throw new Error('浏览器不支持文件分享')
    }
    await navigator.share({ files: [file], title: SHARE_TITLE, text: SHARE_TEXT })
  } finally {
    unmountOffscreen(el)
  }
}

/**
 * 下载回执单为 PNG（旧版 `xi`，`:8747-8802`）。
 *
 * 旧版用 `toDataURL` + `<a href=dataURL download>` 而不是 `toBlob` + objectURL —— 逐字照抄。
 * （Capacitor 那条 `Filesystem.writeFile` 分支无载体，见文件头。）
 */
export async function downloadReceiptImage(html: string): Promise<void> {
  const { el, canvas } = await renderOffscreenCanvas(html, 2)
  try {
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = receiptPngName()
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    unmountOffscreen(el)
  }
}
