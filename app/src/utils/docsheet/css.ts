// C 家族自绘单据 · CSS 发生器 —— 逐字移植自旧版 `j` 内嵌的 IIFE（GS:626-666 / PS2:652-692）。
//
// 产出**整段内联样式**，会被拼进 `<div class="{prefix}-root"><style>…</style>…`。
// 首字符是 `\n`、末字符也是 `\n`（`@media print` 块闭合之后），中间全是字面量 ——
// **别格式化、别重排**。验收夹具：`docs/custom-docs-recon/gs2-default.css`（1739 字符）/
// `docs/custom-docs-recon/ps2-default.css`（**同一份内容，只是 `gs`→`ps`**，§4.2 CONFIRMED）。
//
// 代入点只有 5 处（GS:302-303 的变量表 / PS2:640-641）：
//   `a` = `paper.widthMm`、`n` = `paper.heightMm`、`paper.paddingMm`、
//   `table.borderColor`、`table.headerFontSize`；外加 profile 的**类名前缀**。

import type { DocSheetConfig } from './types'
import type { DocSheetProfile } from './profile'

/**
 * 生成整段 CSS（旧版 GS:634-660 / PS2:660-686）。
 *
 * 用「行数组 + `join('\n')`」而不是单个模板串，是为了让那两份夹具能**逐行**比对
 * （首尾各一个空串 = 首尾各一个 `\n`）。
 *
 * ⚠️ 三个**死选择器**照抄不删（§4.1）：`.{ns}-qr` / `.{ns}-order` / `.{ns}-lock-img`+`.{ns}-door-img`
 * 在这两张单据产出的 markup 里**从不用到**（二维码/图片/字幕全走内联样式）—— PS2 里同样是死的。
 * 删掉它们 CSS 就不等于夹具了。
 *
 * ⚠️ 宽/高**只取数值**：横纵版式完全由 `widthMm`/`heightMm` 决定，
 * `paper.orientation` **不参与**（§6.1 / 差异表 #20：收据单是 `@page size` 交换 + `rotate(-90deg)`，
 * 这里完全不做旋转）。CSS 里若出现旋转，就是抄错了。
 */
export function docSheetCss(config: DocSheetConfig, profile: DocSheetProfile): string {
  const { paper, table } = config
  const c = profile.classes
  const a = paper.widthMm // 旧版 `a`
  const n = paper.heightMm // 旧版 `n`
  const p = paper.paddingMm // 旧版直接读 `t.paddingMm`
  const borderColor = table.borderColor // 旧版 `o.borderColor`
  const headerFontSize = table.headerFontSize // 旧版 `o.headerFontSize`

  const lines: string[] = [
    '', // GS:634 —— 首字符 `\n`
    // ⚠️ 注意 `.gs-root` / `.gs-sheet` 是**不带 2** 的（见 `profile.ts` 的 `DocSheetClasses`）
    `.${c.root} { background:#fff; color:#111; width:${a}mm; }`,
    `.${c.title} { text-align:center; font-size:7mm; line-height:8mm; font-weight:500; margin-bottom:0.5mm; }`,
    `.${c.pageNum} { position:absolute; top:${p}mm; right:${p}mm; font-size:9pt; color:#666; }`,
    `.${c.table} { width:100%; border-collapse:collapse; table-layout:fixed; }`,
    `.${c.table} th, .${c.table} td { border:0.2mm solid ${borderColor}; vertical-align:top; padding:1mm 1.2mm; word-break:break-all; }`,
    `.${c.table} th { text-align:center; font-weight:600; background:#fff; font-size:${headerFontSize}pt; }`,
    `.${c.line} { line-height:inherit; }`,
    // 死选择器（尺寸 17mm 与打印 QR 一致，但它并不生效 —— QR 走内联样式）
    `.${c.qr} { width:17mm; height:17mm; display:block; margin:0 auto 0.8mm; }`,
    `.${c.order} { text-align:center; line-height:1.4; }`,
    `.${c.lockImg}, .${c.doorImg} { width:100%; height:100%; display:block; margin:0 auto; object-fit:contain; }`,
    `@page { size: ${a}mm ${n}mm; margin: 0; }`,
    '@media screen {',
    `  .${c.root} { background:#c0c0c0; padding:8mm; display:flex; flex-wrap:wrap; gap:8mm; align-items:flex-start; justify-content:flex-start; min-width:fit-content; width:auto; }`,
    `  .${c.sheet} { box-shadow:0 2px 10px rgba(0,0,0,0.25); height:${n}mm; overflow:hidden; }`,
    '}',
    '@media print {',
    `  html, body { width:${a}mm !important; height:${n}mm !important; margin:0 !important; padding:0 !important; background:#fff; overflow:visible !important; }`,
    `  .${c.root} { width:${a}mm !important; background:#fff !important; padding:0 !important; gap:0 !important; display:block !important; }`,
    `  .${c.sheet} { width:${a}mm !important; height:${n}mm !important; box-shadow:none !important; margin:0 !important; break-after:page; page-break-after:always; page-break-inside:avoid; }`,
    `  .${c.sheet}:last-child { break-after:auto; page-break-after:auto; }`,
    '  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    '}',
    '', // GS:660 —— 末字符 `\n`
  ]

  return lines.join('\n')
}
