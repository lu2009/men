// C 家族自绘单据 · 二维码编码器 —— 把 `qrcode-generator` 接到核心层的 `QrEncoder` 上。
//
// ⚠️ 本文件是**组件层新增**的（旧版没有这个模块），且**与具体单据无关** ——
//    GS2 与 PS2 用的是同一个编码器（§1：`k,P,I` 三个成员「完全相同」，`MARGIN=1` / `text+"::m1"` /
//    失败不缓存）。所以它住在底座层，两张单据各自 `qr.ts` 只做一次转出。
//
// 旧版（GS:203 / GS:245-260；PS2:213 / PS2:255-270）用的是 vendor chunk 里内嵌的
// `@zxing/library` 系编码器：
//   `k = new QRCodeClass()`
//   `k.write(text, 180, 180, hints)`  → 返回一个 `<svg>` **元素**
//   `hints = new Map([[EncodeHintType.MARGIN, 1]])`   ← 静默区 1 模块
// 本仓库没有该依赖，用户 2026-09-17 拍板改用 **`qrcode-generator`**（~10KB 零依赖）。
//
// 对齐报告 §9.2 的五个点，逐条落到哪里：
//   · **`MARGIN=1`**        → `createSvgTag({ margin: 1 })`（`cellSize:1` 时 margin 的单位就是「模块」）
//   · **`viewBox`**         → 取库产出 SVG 的 `viewBox`，与旧版 `svg.getAttribute("viewBox")` 同一件事。
//                             旧版取不到时回退 `"0 0 180 180"`，那个回退在底座层
//                             `createQrSvgProvider` 里（`html.ts`），**不在这里重复**。
//   · **`preserveAspectRatio="xMidYMid meet"`** / **尺寸 17mm** / **外边距 0.5mm**
//                           → 全部由底座层 `renderCell` 写在**外层** `<svg>` 上；
//                             本编码器只交 `{viewBox, inner}`，不参与那三处
//                             （库自己那个 `<svg>` 标签连同它的 width/height/preserveAspectRatio
//                              会被丢掉，只留 `innerHTML` —— 与旧版 `svg.innerHTML` 一致）。
//   · 库抛错 → 返回 `null` → 底座层只渲染单号字幕（GS:257-259）。

import qrcode from 'qrcode-generator'

import type { QrEncoder, QrSvg } from './types'

/**
 * 每模块几像素。取 1 —— `createSvgTag` 的坐标单位是「cellSize」，`margin` 也用同一单位，
 * 所以 `cellSize:1` + `margin:1` 就是「静默区 1 模块」，与旧版 `EncodeHintType.MARGIN = 1` 等价。
 * 因为外层 `<svg>` 用 `viewBox` + 17mm 尺寸做矢量缩放，这里的像素数**不影响成图**。
 */
const QR_CELL_SIZE = 1

/** 静默区宽度，单位「模块」（旧版 `EncodeHintType.MARGIN = 1`）。 */
const QR_MARGIN_MODULES = 1

/**
 * 纠错等级。旧版 zxing `QRCodeWriter` 在**没有传** `ERROR_CORRECTION` hint 时用 **L**
 * （`MultiFormatWriter` 的缺省分支），旧版那行 hints 里只有 MARGIN，所以是 L。
 */
const QR_ERROR_CORRECTION = 'L'

/**
 * ⚠️ **有意偏离（一处很小但必要的加固）**：把文本→字节的编码换成 **UTF-8**。
 *
 * `qrcode-generator` 自带的 `stringToBytes` 是 `c & 0xff`（逐字符截断到低 8 位）——
 * 对纯 ASCII 完全正确（单号正常都是 `2026-09-17-01` 这种），但**非 ASCII 会被编错**
 * （「单」的 charCode 0x5355 会被截成 0x55，扫出来是乱码）。
 * 旧版 zxing 走的是它自己的字符集编码（默认 ISO-8859-1，非 ASCII 会直接抛错）。
 *
 * 结论：**对纯 ASCII 单号，新旧逐字节相同**（ISO-8859-1 与 UTF-8 在 ASCII 区一致）；
 * 对含中文的单号，旧版大概率抛错 → 不画二维码（只剩字幕），新版能正常出码。
 * 这是「补一个旧版本就该有的能力」，不是改变既有产物的形状。
 *
 * 注意这是写在库对象上的**全局**开关；全库只有本文件用它（`grep qrcode-generator` 只有这一处），
 * 所以不会串味。
 *
 * TODO(未确认): 旧版 zxing 那条链路的**实际字符集**没有实测（报告 §13 没有这一条，
 * 是本次实现时才暴露出的新未知量）。对纯 ASCII 单号，任何常见字符集都一样，QR 内容逐字节相同；
 * 只有含中文的单号才可能出现「新版能出码、旧版不出码」的差别。要彻底对齐需在旧版里跑一次
 * 中文单号看它画不画得出来。
 */
qrcode.stringToBytes = (s: string): number[] => Array.from(new TextEncoder().encode(s))

/**
 * 把库产出的 `<svg>` 文本拆成 `{viewBox, inner}`（等价于旧版在 SVG **元素**上取
 * `getAttribute("viewBox")` 与 `innerHTML`）。
 *
 * 解析失败 / 环境没有 `DOMParser` → `null`（上层等价于「编码器抛错」，只画字幕）。
 */
function svgToParts(svgText: string): QrSvg | null {
  if (typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement
  if (!svg) return null
  return {
    // 空串交给底座层的 `|| "0 0 180 180"` 回退（与旧版同一条路径）
    viewBox: svg.getAttribute('viewBox') || '',
    inner: svg.innerHTML,
  }
}

/**
 * 造一个 `QrEncoder`（底座层 `createQrSvgProvider` 的入参）。
 *
 * 旧版是模块级单例 `k = new y()`；`qrcode-generator` 的用法本来就「一次文本一个实例」，
 * 所以这里每次调用新建，缓存由底座层的 provider 负责（`text + "::m1"` 那张表）。
 *
 * 返回 `null` 的两条分支都照旧版：
 *   · 空文本（底座层 provider 已经先挡了一道，这里再挡一次防直调）；
 *   · 编码抛错（超长单号 → 库抛 `code length overflow`，被 provider 的 try/catch 接住）。
 */
export function createQrEncoder(): QrEncoder {
  return (text: string): QrSvg | null => {
    if (!text) return null
    const qr = qrcode(0, QR_ERROR_CORRECTION) // 0 = 自动选版本（旧版 zxing 也是自动）
    qr.addData(text)
    qr.make()
    // 第三个参数 `scalable:true` 让库别在标签上写 width/height（我们只用 innerHTML，其实无所谓，
    // 写成 scalable 是为了「拿到的就是一份纯矢量片段」这件事在代码上自解释）。
    return svgToParts(
      qr.createSvgTag({ cellSize: QR_CELL_SIZE, margin: QR_MARGIN_MODULES, scalable: true }),
    )
  }
}
