// 自定义玻璃合片单 · CSS 发生器 —— 实现已上移到公共底座 `../docsheet/css.ts`
// （逐字移植自旧版 `j` 内嵌的 IIFE，GS:626-666）。
//
// 本单据的差异只有**类名前缀**（`gs`），由 `GLASSSHEET2_PROFILE` 注入 —— 见 `profile.ts`。
// 验收夹具：`docs/custom-docs-recon/gs2-default.css`（1739 字符，`gs2-csscheck.mjs` 逐字节比对）。

import { docSheetCss } from '../docsheet/css'
import { GLASSSHEET2_PROFILE } from './profile'
import type { GlassSheet2Config } from './types'

/** 生成整段内联 CSS（旧版 GS:634-660）。`css(config)` 的对外签名与抽取前一致。 */
export function css(config: GlassSheet2Config): string {
  return docSheetCss(config, GLASSSHEET2_PROFILE)
}
