// 自定义合格标签 · CSS 发生器 —— 逐字移植旧版 `R`（`QL:633-661`）。
//
// 验收夹具（§4.3 / §10.4）：
//   · `docs/custom-docs-recon/ql-default.css`  —— 默认 70×90 不旋转，**838 字符**
//   · `docs/custom-docs-recon/ql-rotate90.css` —— 同一份配置开 `printRotate90`，**1108 字符**
//   两份都由 `ql-csscheck.mjs` 逐字节比对。
//
// ⚠️ **底座的 `css.ts` 一行都用不上** —— 不是前缀替换（§0.1 判定「必须新写」）：
//   |                        | 底座（GS2/PS2）              | QL                     |
//   |------------------------|------------------------------|------------------------|
//   | 规模                    | 23 条 / 1739 字符            | **11 条 / 838**        |
//   | 根规则                  | `background:#fff; color:#111; width:{a}mm;` | `background:#fff; color:#000;`（**无 width**）|
//   | sheet 规则              | 无此规则                      | `background:#fff; display:block;` |
//   | `@media print` html,body| 有宽高 + `overflow:visible`   | **只有 margin/padding/background** |
//   | `@media print` URL 重置  | 无                            | **本单独有**（旋转时多一行 `html,body{width…}`）|
//   | `:last-child` 取消分页   | 无                            | **本单独有**（`page-break-after:avoid`）|
//   | 打印色准                 | 无                            | **本单独有**（`* { -webkit-print-color-adjust… }`）|

import type { QualifiedLabelConfig } from './types'

/**
 * 生成整段 CSS（旧版 `R`，`QL:633-661`）。
 *
 * ★ **只代入 3 个值**：`paper.widthMm`(`o`) / `paper.heightMm`(`a`) / `paper.printRotate90`(`n`)。
 *   **`paddingMm` / `globalFont` / 全部字段都不参与 CSS** —— 它们在 `<section>` 的内联样式里
 *   （见 `html.ts`）。这与底座的 C 家族相反（那边 `paddingMm` 会进 CSS 做页码定位，本单没有页码）。
 *
 * 三处旋转分支（`QL:646-658`，`printRotate90 = true` 时**只有这 3 处变**，§4.3）：
 * 1. `@page { size: {h}mm {w}mm; }` —— 宽高**交换**（`u = n ? heightMm : widthMm`）；
 * 2. `@media print` 内**新增一行** `html,body{width:{u}mm !important;height:{r}mm !important;overflow:hidden !important;}`
 *    （位置在 `html, body` 那行之后、`.qlabel-root` 之前）；
 * 3. 原 `.qlabel-root{…}` 那行被**整行替换**为带 `position:fixed` + `transform:rotate(-90deg)` 的长串。
 *    ⚠️ 其中 `top` 用的是**未旋转的高**（`o` = `widthMm` 的兄弟变量，即 `paper.widthMm`）——
 *    施工图 §4.3 明确写「照抄，别『修正』」。
 *
 * ⚠️ **`@media screen` 块与旋转无关** —— 屏幕上永远是竖着的那张（§4.3 的末注）。
 * ⚠️ 用「单串拼接」而不是行数组 + `join`：旧版就是一个串，
 *    且**首字符是 `\n`、末字符也是 `\n`**（`@media print` 块闭合之后）—— 别格式化、别重排。
 */
export function qualifiedLabelCss(config: QualifiedLabelConfig): string {
  const widthMm = config.paper.widthMm // 旧版 `o`，`QL:635`
  const heightMm = config.paper.heightMm // 旧版 `a`，`QL:636`
  const printRotate90 = config.paper.printRotate90 // 旧版 `n`，`QL:637`

  const pageWidthMm = printRotate90 ? heightMm : widthMm // 旧版 `u`，`QL:638`
  const pageHeightMm = printRotate90 ? widthMm : heightMm // 旧版 `r`，`QL:639`

  const printRootRule = printRotate90
    ? // `QL:647-657` —— ⚠️ `top` 用 `o`（= widthMm），不是旋转后的 pageHeightMm
      'html,body{width:' +
      pageWidthMm +
      'mm !important;height:' +
      pageHeightMm +
      'mm !important;overflow:hidden !important;}\n    ' +
      '.qlabel-root{position:fixed !important;top:' +
      widthMm +
      'mm !important;left:0 !important;width:' +
      widthMm +
      'mm !important;height:' +
      heightMm +
      'mm !important;padding:0 !important;gap:0 !important;display:block !important;background:#fff !important;transform-origin:top left !important;transform:rotate(-90deg) !important;}'
    : // `QL:658` —— 不旋转时的原行
      '.qlabel-root{background:#fff !important;padding:0 !important;gap:0 !important;display:block !important;}'

  return (
    '\n  .qlabel-root { background:#fff; color:#000; }\n' +
    '  .qlabel { background:#fff; display:block; }\n' +
    '  .qfield { box-sizing:border-box; }\n' +
    '  @page { size: ' +
    pageWidthMm +
    'mm ' +
    pageHeightMm +
    'mm; margin: 0; }\n' +
    '  @media screen {\n' +
    '    .qlabel-root { background:#c0c0c0; padding:12mm; display:flex; flex-wrap:wrap; gap:8mm; align-items:flex-start; justify-content:flex-start; min-width:fit-content; }\n' +
    '    .qlabel { box-shadow:0 2px 10px rgba(0,0,0,0.25); }\n' +
    '  }\n' +
    '  @media print {\n' +
    '    html, body { margin:0 !important; padding:0 !important; background:#fff; }\n' +
    '    ' +
    printRootRule +
    '\n    .qlabel { box-shadow:none !important; }\n' +
    '    .qlabel:last-child { page-break-after: avoid !important; break-after: avoid !important; }\n' +
    '    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n' +
    '  }\n'
  )
}
