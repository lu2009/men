// 自定义玻璃合片单 · 读盘归一化 —— 实现已上移到公共底座 `../docsheet/sanitize.ts`
// （逐字移植自旧版 `onMounted` 的清洗段 GS:686-768，两条旧版缺陷的处置说明见该文件头注）。
//
// 本单据的差异只有「回落的默认列是 8 列」这一处，由 `GLASSSHEET2_PROFILE` 注入。

import {
  cloneConfig as baseCloneConfig,
  sanitizeDocSheetConfig,
  sanitizePaper,
  sanitizePrint,
  sanitizeTable as baseSanitizeTable,
} from '../docsheet/sanitize'
import { GLASSSHEET2_PROFILE } from './profile'
import type { GlassSheet2Config, TableConfig } from './types'

/**
 * 纸张清洗（GS:695-723）—— **与 profile 无关**，两张单据逐字段相同。
 *
 * ⚠️ 两处旧版缺陷的处置（详见底座头注）：`paddingMm` 缺字段的 `??` 语义**新版修**（回落 3）；
 * `paddingMm: null → 0` **照抄不改**。
 */
/** 打印参数清洗（GS:751-763）：`copies` clamp 到 **1–99**。 */
export { sanitizePaper, sanitizePrint }

/**
 * 表格清洗（GS:724-750）。`columns` 按下标合并（缺字段补默认、多出的列原样保留）——
 * 本单据的默认列是 8 列（GS:23-94）。
 */
export function sanitizeTable(raw: unknown, fallback: TableConfig): TableConfig {
  return baseSanitizeTable(raw, fallback, GLASSSHEET2_PROFILE)
}

/**
 * 整份配置清洗（GS:686-768）。
 *
 * ⚠️ 旧版是「读不到键 → **提前 return，直接用默认**」（GS:690-691），
 * 新版由 `storage.ts` 把「键不存在」变成传 `undefined` 进来 —— 等价。
 */
export function sanitizeConfig(raw: unknown): GlassSheet2Config {
  return sanitizeDocSheetConfig(raw, GLASSSHEET2_PROFILE)
}

/** 深拷贝配置（旧版到处用的 `JSON.parse(JSON.stringify(x))`，GS:149/157/366/783/791 等）。 */
export const cloneConfig = baseCloneConfig
