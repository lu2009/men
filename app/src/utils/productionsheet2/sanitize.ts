// 自定义生产单2 · 读盘归一化 —— 实现已上移到公共底座 `../docsheet/sanitize.ts`
// （逐字移植自旧版 `onMounted` 的清洗段 PS2:709-803；两条旧版缺陷的处置说明见该文件头注）。
//
// ⚠️ **§2.3 CONFIRMED：本条路径与 GS2 逐字段相同** —— `Number(v) || 默认`、
// `paddingMm` 用 `??` 的旧版缺陷、`columns` 按**下标**合并默认列并保留多出的列、
// `copies` 夹到 1–99。**唯一差异是两个 localStorage 键名**（那在 `profile.ts` / `storage.ts`）。
//
// 本单据注入的只有「回落的默认列是 **9** 列」这一处。

import {
  cloneConfig as baseCloneConfig,
  sanitizeDocSheetConfig,
  sanitizePaper,
  sanitizePrint,
  sanitizeTable as baseSanitizeTable,
} from '../docsheet/sanitize'
import { PRODUCTIONSHEET2_PROFILE } from './profile'
import type { ProductionSheet2Config, TableConfig } from './types'

/**
 * 纸张清洗（PS2:718-746）—— **与 profile 无关**，两张单据逐字段相同。
 *
 * ⚠️ 两处旧版缺陷的处置（详见底座头注）：`paddingMm` 缺字段的 `??` 语义**新版修**（回落 3，
 * 否则分页预算变 `NaN` ⇒ 整份单据退化成单页）；`paddingMm: null → 0` **照抄不改**。
 */
export { sanitizePaper }

/** 打印参数清洗（PS2:774-786）：`copies` clamp 到 **1–99**。 */
export { sanitizePrint }

/**
 * 表格清洗（PS2:747-773）。`columns` 按下标合并（缺字段补默认、多出的列原样保留）——
 * 本单据的默认列是 **9** 列（PS2:22-104），比 GS2 多 `doorframe`/`windows`、少 `client`。
 */
export function sanitizeTable(raw: unknown, fallback: TableConfig): TableConfig {
  return baseSanitizeTable(raw, fallback, PRODUCTIONSHEET2_PROFILE)
}

/**
 * 整份配置清洗（PS2:709-803）。
 *
 * ⚠️ 旧版是「读不到键 → **提前 return，直接用默认**」（PS2:713-714），
 * 新版由 `storage.ts` 把「键不存在」变成传 `undefined` 进来 —— 等价。
 */
export function sanitizeConfig(raw: unknown): ProductionSheet2Config {
  return sanitizeDocSheetConfig(raw, PRODUCTIONSHEET2_PROFILE)
}

/** 深拷贝配置（旧版到处用的 `JSON.parse(JSON.stringify(x))`）。 */
export const cloneConfig = baseCloneConfig
