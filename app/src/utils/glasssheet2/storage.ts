// 自定义玻璃合片单 · localStorage 读写层 —— 实现已上移到公共底座 `../docsheet/storage.ts`。
//
// **只有 2 个键**（§6.3）—— 别把收据单那 7 个键的心智模型带过来：
//   - `glass_sheet2_template_v1` —— 整份 `{paper,table,print}` JSON。
//     **两个弹窗共用这一个键**：打印设置的「保存并应用」(GS:146-153) 与
//     布局编辑的「保存布局」(GS:154-161) 写的是**同一份配置**。
//   - `glass_sheet2_printer_v1` —— 裸字符串（打印机名），**不 JSON**。
//
// 键名定义在 `profile.ts`（档案的一部分），这里原样转出以保持对外 API 不变。

import {
  loadDocSheetSettings,
  saveDocSheetConfig as baseSaveConfig,
  saveDocSheetPrinter as baseSavePrinter,
  type DocSheetLoadedSettings,
} from '../docsheet/storage'
import { GLASSSHEET2_PROFILE, GLASSSHEET2_STORAGE_KEYS } from './profile'
import type { GlassSheet2Config } from './types'

export { GLASSSHEET2_STORAGE_KEYS }

/** 一次载入的两项（`config` + 裸字符串打印机名）。 */
export type GlassSheet2LoadedSettings = DocSheetLoadedSettings

/**
 * `onMounted` 的载入段（GS:686-774）。
 *
 * - 配置：`getItem` 拿不到 / 是空串 → **直接用默认**（GS:690-691 提前 return）；
 *   否则 `JSON.parse` → 逐字段清洗。整段在 `try/catch` 里，抛错 → 默认。
 * - 打印机：独立的 `try/catch`，异常也落到 `""`（GS:769-774）。
 */
export function loadGlassSheet2Settings(): GlassSheet2LoadedSettings {
  return loadDocSheetSettings(GLASSSHEET2_PROFILE)
}

/**
 * 配置落盘（旧版 `C`，GS:115-120）。
 *
 * ⚠️ 这里**不做任何清洗/trim** —— 旧版是直接把生效 ref `i.value` JSON 出来，
 * 清洗只发生在读盘时。调用方先 `cloneConfig()` 再存是旧版的做法（GS:149）。
 * 旧版 `try{}catch{}` 是**空 catch**（localStorage 满/被禁时不报错），照抄。
 */
export function saveGlassSheet2Config(config: GlassSheet2Config): void {
  baseSaveConfig(GLASSSHEET2_PROFILE, config)
}

/**
 * 打印机落盘（旧版 `z`，GS:121-126）—— `el-select` 的 `@change` **选中即写**，
 * 存**裸字符串（不是 JSON）**，同样是空 `try{}catch{}`。
 */
export function saveGlassSheet2Printer(name: string): void {
  baseSavePrinter(GLASSSHEET2_PROFILE, name)
}
