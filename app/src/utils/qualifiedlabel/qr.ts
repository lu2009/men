// 自定义合格标签 · 二维码 —— 复用底座的编码器与 provider，只改一处常量。
//
// 旧版三个成员（`QL:523-525`）：
//   `K = new y()`                   —— 编码器（模块级单例）
//   `Z = new Map([[g.MARGIN, 1]])`  —— hints：静默区 1 模块
//   `X = new Map()`                 —— ★ **本组件自己的缓存**：`text + "::m1"` → JSON
//
// 与 GS2/PS2 的 `k/P/I`（§diff §1）**逐字相同**，唯一差别是：
//   · 旧版 `K.write(text, 200, 200, Z)`（`QL:575`）—— GS2 是 `write(text, 180, 180, X)`。
//     ⚠️ 这个 200 **不进产物**（同 PS 的 INTERPRETED 结论，见 `profile.ts` 的
//     `QL_QR_FALLBACK_VIEW_BOX`），只在回退路径上看得出来 —— 仍然照抄 200。
//
// ⚠️ 底座的 `createQrSvgProvider` 的回退 viewBox 已参数化（`docsheet/html.ts` 第 2 参），
//    缺省 `'0 0 180 180'` 保持 C 家族逐字未动 —— 这正是 §0.1 判定的「PARAM：QR 回退 viewBox」。
//
// ⚠️ 组件层**必须复用一个 provider 实例**（旧版是组件级 Map 缓存 `X`）；
//    每次构建都新建会把缓存废掉（产物不变，只是白算）。

import { createQrSvgProvider } from '../docsheet/html'
import { createQrEncoder } from '../docsheet/qr'
import { QL_QR_FALLBACK_VIEW_BOX } from './profile'
import type { QrEncoder, QrSvg } from '../docsheet/types'

export { createQrEncoder }
export type { QrEncoder, QrSvg }

/**
 * 造一个二维码 provider（旧版 `X` 缓存 + `QL:568-584` 的编码 IIFE）。
 *
 * 缓存键仍是 `text + "::m1"`、失败**不进缓存**（`QL:581-583` 的 `try/catch` 直接 `return null`）。
 *
 * ⚠️ **旧版有两条「返回 null」的上游分支，新版都不在这里**（分工与旧版一致，别搬进来）：
 *   · **空文本**：旧版在 `QL:570` 的 `if (!e) return null`，但**调用点根本到不了** ——
 *     空值早在 `QL:560` 就 `return` 了那个 `viewBox="0 0 1 1"` 的空占位。
 *     新版同理：`renderField` 的空值分支在调 provider **之前**（见 `html.ts`）。
 *   · **`qr` 缺失**：`renderField` 直接当 `null` 处理。
 *
 * @param encode 编码器。留空则用新版默认的 `createQrEncoder()`（`qrcode-generator`）。
 *               ⚠️ 旧版内嵌的是 vendor chunk 里的 `@zxing/library` 系编码器，本仓库没有该依赖，
 *               用户 2026-09-17 拍板改用 `qrcode-generator`（见 `docsheet/qr.ts` 顶部说明）。
 */
export function createQualifiedLabelQrProvider(
  encode: QrEncoder = createQrEncoder(),
): (text: string) => QrSvg | null {
  return createQrSvgProvider(encode, QL_QR_FALLBACK_VIEW_BOX) // `QL:571` 的 200 → 回退 `0 0 200 200`
}
