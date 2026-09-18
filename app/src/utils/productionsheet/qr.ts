// 自定义生产单 · 二维码 —— 复用底座的编码器与 provider，只改一处常量。
//
// 旧版三个成员（`PS:785-787`）：
//   `Z = new y()`                        —— 编码器（模块级单例）
//   `X = new Map([[g.MARGIN, 1]])`       —— hints：静默区 1 模块
//   `Q = new Map()`                      —— 缓存：`text + "::m1"` → JSON
//
// 与 GS2/PS2 的 `k/P/I`（§diff §1）**逐字相同**，唯一差别是：
//   · 旧版 `Z.write(text, 200, 200, X)`（`PS:828`）—— GS2 是 `write(text, 180, 180, X)`。
//
// ★ **这个 200 不进产物**（INTERPRETED，§1 #33）：新版编码器用
//   `createSvgTag({scalable:true})` **不写 `width`/`height`**，`viewBox` 只由 QR 矩阵尺寸决定
//   ⇒ 走真编码器时两边的 SVG **逐字节相同**。200 只在「库产出取不到 `viewBox`」那条
//   **回退路径**上看得出来（`0 0 200 200` vs `0 0 180 180`）—— 仍然照抄 200。
//
// ⚠️ 组件层**必须复用一个 provider 实例**（旧版是模块级单例的缓存表）；
//    每次构建都新建会把缓存废掉（产物不变，只是白算）。

import { createQrSvgProvider } from '../docsheet/html'
import { createQrEncoder } from '../docsheet/qr'
import { PS_QR_FALLBACK_VIEW_BOX } from './profile'
import type { QrEncoder, QrSvg } from '../docsheet/types'

export { createQrEncoder }

/**
 * 造一个二维码 provider（旧版 `Q`，`PS:787`）—— 底座工厂 + 本单据的回退视口。
 *
 * 缓存键仍是 `text + "::m1"`、失败**不进缓存**（`PS:826-836` 的 `try/catch` 直接 `return null`）。
 *
 * @param encode 编码器。留空则用新版默认的 `createQrEncoder()`（`qrcode-generator`）。
 *               ⚠️ 旧版内嵌的是 vendor chunk 里的 `@zxing/library` 系编码器，本仓库没有该依赖，
 *               用户 2026-09-17 拍板改用 `qrcode-generator`（见 `docsheet/qr.ts` 顶部说明）。
 */
export function createProductionSheetQrProvider(
  encode: QrEncoder = createQrEncoder(),
): (text: string) => QrSvg | null {
  return createQrSvgProvider(encode, PS_QR_FALLBACK_VIEW_BOX) // PS:830 —— 回退 `0 0 200 200`
}
