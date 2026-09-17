// 收据单2 的 CSS 发生器。
//
// 逐字移植旧版 `ue(fonts, print)`（`Receipt2.deobfuscated.js:371-438`）。
//
// **与旧版的唯一接口差异**：旧版的列宽是闭包捕获的 ref `n.value`（`:11`、`:389-408`），
// 不从参数传；新版改成显式参数 `columnWidths`。除此之外产出必须逐字节一致 ——
// 验收基准就是 `docs/receipt2-recon/css-landscape.css` 与 `css-portrait.css`
// （这两个文件已实测与旧版 `ue()` 的返回值全等，4888 / 4221 字符）。
//
// 实现方式：按「**行数组 join('\n')**」组装，而不是拼一个巨大的字符串字面量 ——
// 因为产出里含**内容为 2 个或 4 个空格的整行**（`:413`、`:424`、`:437` 三处 `+` 拼接缝），
// 写成源码里的裸行尾空白会被编辑器/格式化器剥掉，放进字符串里则不会。
// 首元素 `''` 与末元素 `''` 对应产出开头与结尾的那个 `\n`。

import type { ColumnWidths, FontSettings, PaperSettings } from './types'

/**
 * 生成收据单2 的整段打印样式。
 *
 * @param fonts 已清洗的 6 类字号（`Z()` :252-289 的产物）
 * @param paper 已清洗的纸张设置（`X()` :290-306 的产物）
 * @param columnWidths 10 列列宽（裸百分比）。旧版走闭包 ref，这里显式传。
 */
export function css(fonts: FontSettings, paper: PaperSettings, columnWidths: ColumnWidths): string {
  const { widthMm, heightMm } = paper
  // 旧版一律用 `=== "landscape"` 正向判定，非 "landscape" 的一切值都走纵向分支（:418、:425）。
  const isLandscape = paper.orientation === 'landscape'

  const lines: string[] = [
    '',
    '  * { box-sizing: border-box; }',
    '  .receipt2-root { color: #000; background: #fff; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }',
    '  .receipt2-page {',
    `    width: ${widthMm}mm; height: ${heightMm}mm;`,
    '    padding: 4mm 4mm 3mm; background: #fff;',
    '    display: flex; flex-direction: column; overflow: hidden;',
    '    page-break-after: always;',
    '  }',
    '  .receipt2-page:last-child { page-break-after: auto; }',
    '  .receipt2-header {',
    '    display: grid; grid-template-columns: 1fr 2fr 1fr;',
    '    align-items: start; margin-bottom: 2mm; flex-shrink: 0;',
    '  }',
    `  .receipt2-order { font-size: ${fonts.orderDateFontSize}px; padding-top: 1mm; }`,
    `  .receipt2-title { text-align: center; font-size: ${fonts.headerFontSize}px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.05; }`,
    '  .receipt2-header-left { display: flex; align-items: flex-start; justify-content: flex-start; gap: 2mm; }',
    '  .receipt2-header-right { display: flex; align-items: flex-start; justify-content: flex-end; gap: 2mm; }',
    `  .receipt2-date { font-size: ${fonts.orderDateFontSize}px; padding-top: 1mm; white-space: nowrap; }`,
    // 二维码尺寸写死 18mm×18mm，**不随字号/纸张变化**（:382-384 里的 `"18" + "mm"` 与裸 `18` 就是原样）
    '  .receipt2-qrcode { width: 18mm; height: 18mm; object-fit: contain; border: 1px solid #bbb; }',
    '  .receipt2-qrcode-empty { border-style: dashed; }',
    '  .receipt2-meta-row {',
    '    display: grid; grid-template-columns: 1.2fr 1.5fr 1.7fr 0.8fr;',
    `    gap: 1.5mm; margin-bottom: 1.5mm; font-size: ${fonts.metaFontSize}px; line-height: 1.2; flex-shrink: 0;`,
    '  }',
    '  .receipt2-meta-row span { overflow: hidden; white-space: nowrap; display: flex; align-items: center; }',
    // 注意：这条按 **DOM 位置**生效，不绑定 address。排序/显隐一动，缩进就漂（07 文档 §5.4）
    '  .receipt2-meta-row span:nth-child(3) { padding-left: 6mm; }',
    '  .receipt2-table {',
    '    width: 100%; border-collapse: collapse; table-layout: fixed;',
    `    font-size: ${fonts.tableFontSize}px; margin-bottom: 1.5mm;`,
    '  }',
    '  .receipt2-table th, .receipt2-table td {',
    '    border: 1px solid #000; padding: 1mm 0.8mm;',
    '    vertical-align: top; line-height: 1.18; word-break: break-all;',
    '  }',
    '  .receipt2-table th { text-align: center; font-weight: 600; }',
    '  .receipt2-table td { text-align: left; }',
    '  .receipt2-table .cell-multi { white-space: pre-line; }',
    // 10 列列宽，逐列 th/td 成对。第 2/3/6/7/8 列额外居中（:390-408）
    `  .receipt2-table th:nth-child(1), .receipt2-table td:nth-child(1) { width: ${columnWidths[0]}%; }`,
    `  .receipt2-table th:nth-child(2), .receipt2-table td:nth-child(2) { width: ${columnWidths[1]}%; text-align: center; }`,
    `  .receipt2-table th:nth-child(3), .receipt2-table td:nth-child(3) { width: ${columnWidths[2]}%; text-align: center; }`,
    `  .receipt2-table th:nth-child(4), .receipt2-table td:nth-child(4) { width: ${columnWidths[3]}%; }`,
    `  .receipt2-table th:nth-child(5), .receipt2-table td:nth-child(5) { width: ${columnWidths[4]}%; }`,
    `  .receipt2-table th:nth-child(6), .receipt2-table td:nth-child(6) { width: ${columnWidths[5]}%; text-align: center; }`,
    `  .receipt2-table th:nth-child(7), .receipt2-table td:nth-child(7) { width: ${columnWidths[6]}%; text-align: center; }`,
    `  .receipt2-table th:nth-child(8), .receipt2-table td:nth-child(8) { width: ${columnWidths[7]}%; text-align: center; }`,
    `  .receipt2-table th:nth-child(9), .receipt2-table td:nth-child(9) { width: ${columnWidths[8]}%; }`,
    `  .receipt2-table th:nth-child(10), .receipt2-table td:nth-child(10) { width: ${columnWidths[9]}%; }`,
    '  .empty-row { text-align: center !important; vertical-align: middle !important; color: #666; }',
    '  .receipt2-amounts {',
    '    display: grid; grid-template-columns: repeat(3, 1fr);',
    `    margin-bottom: 1.2mm; color: #d9001b; font-size: ${fonts.amountFontSize}px; line-height: 1; flex-shrink: 0;`,
    '  }',
    '  .receipt2-amounts span { white-space: nowrap; }',
    '  .receipt2-declaration {',
    '    border-top: 1px dashed #999; padding-top: 1.2mm;',
    `    white-space: pre-line; line-height: 1.16; font-size: ${fonts.declarationFontSize}px; flex: 1; overflow: hidden;`,
    '  }',
    // ↑ 以上对应 :372-413（基础样式），此处拼接缝是 `"\n  " + @page`，即上一行末的 2 空格换行
    // `@page`（:414-423）：横向**交换**宽高，靠下面 @media print 的 rotate(-90deg) 把内容转正
    `  @page { size: ${isLandscape ? heightMm : widthMm}mm ${isLandscape ? widthMm : heightMm}mm; margin: 0; }`,
    // `@media print`（:424-437）
    '  @media print {',
    '    html, body { margin: 0 !important; padding: 0 !important; background: #fff; }',
    '    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
  ]

  // 拼接缝 `"\n    " + (landscape ? 横向旋转块 : "")` —— 横向多注入 4 条规则 + 一个收尾的 4 空格行。
  // ⚠️ 最后那条 `.receipt2-page` **不带 `.r2-page-wrap` 前缀**（07 文档 §5.3 已实测坐实，别自作主张加）。
  // ⚠️ 三条 `.r2-page-wrap` 规则只在静默打印路径（`printSilent` 会插 wrap div）下命中；
  //    `ye()` 浏览器打印与 `printFromContainer` 不生成 wrap，属于旧版已知缺陷，此处仍照抄。
  lines.push('    ')
  if (isLandscape) {
    lines.push(
      '    .receipt2-root { display: block !important; background: #fff !important; padding: 0 !important; gap: 0 !important; }',
      `    .r2-page-wrap { width: ${heightMm}mm !important; height: ${widthMm}mm !important; overflow: hidden !important; position: relative !important; page-break-after: always !important; }`,
      '    .r2-page-wrap:last-child { page-break-after: auto !important; }',
      `    .receipt2-page { position: absolute !important; top: 0 !important; left: 0 !important; width: ${widthMm}mm !important; height: ${heightMm}mm !important; transform-origin: top left !important; transform: translateY(${widthMm}mm) rotate(-90deg) !important; box-shadow: none !important; page-break-after: auto !important; }`,
      '    ',
    )
  }

  lines.push(
    '    .receipt2-table { border-collapse: collapse !important; }',
    '    .receipt2-table th, .receipt2-table td { border: 1px solid #000 !important; }',
    '  }',
    // `@media screen`（:438）—— 屏幕态灰底 + 卡片阴影 + 可编辑元素的 hover 提示
    '  @media screen {',
    '    .receipt2-root { background: #c0c0c0; padding: 12mm; display: flex; flex-direction: column; align-items: center; gap: 8mm; min-width: fit-content; }',
    '    .receipt2-page { position: relative; box-shadow: 0 3px 14px rgba(0,0,0,0.28); }',
    '    [data-r2-el] { cursor: pointer; transition: outline 0.15s; border-radius: 2px; position: relative; z-index: 5; }',
    '    [data-r2-el]:hover { outline: 2px dashed #409eff; outline-offset: 1px; z-index: 10; }',
    '  }',
    '',
  )

  return lines.join('\n')
}

/** `css` 的别名 —— 对齐 `07-golden-sample.md` §6.2 建议的 `buildPageCss` 命名。 */
export { css as buildPageCss }
