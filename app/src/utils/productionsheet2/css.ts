// 自定义生产单2 · CSS 发生器 —— 实现已上移到公共底座 `../docsheet/css.ts`
// （逐字移植自旧版 `j` 内嵌的 IIFE，PS2:652-692）。
//
// ⚠️ **§4.2 CONFIRMED：PS2 的 CSS 与 GS2 只差前缀 `gs`→`ps`** —— 机器验证过
// 「把 `gs2-default.css` 全局 `gs`→`ps` 后与 PS2 求值结果逐字节相等」。
// 所以本文件**没有一行自己的 CSS**，全部由 `PRODUCTIONSHEET2_PROFILE` 的前缀派生。
//
// ⚠️ 注意两套前缀并存：`ps-root`/`ps-sheet` 是**无 `2`** 的，`ps2-title` 等是**有 `2`** 的。
// 单一 `gs`→`ps` 替换同时覆盖两者（`gs2-` 的前两字符正好是 `gs`）—— **别"顺手统一"**。
//
// 验收夹具：`docs/custom-docs-recon/ps2-default.css`
// （1739 字符，`shasum 2ac1613b620a8df39c06d4221d38ed87ce25e1d3`）。

import { docSheetCss } from '../docsheet/css'
import { PRODUCTIONSHEET2_PROFILE } from './profile'
import type { ProductionSheet2Config } from './types'

/** 生成整段内联 CSS（旧版 PS2:660-686）。 */
export function css(config: ProductionSheet2Config): string {
  return docSheetCss(config, PRODUCTIONSHEET2_PROFILE)
}
