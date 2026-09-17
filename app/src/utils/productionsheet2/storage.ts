// 自定义生产单2 · localStorage 读写层 —— 实现已上移到公共底座 `../docsheet/storage.ts`。
//
// **只有 2 个键**（§8）—— 别把收据单那 7 个键的心智模型带过来：
//   - `production_sheet2_template_v1` —— 整份 `{paper,table,print}` JSON。
//     **两个弹窗共用这一个键**：打印设置的「保存并应用」(PS2:155-162) 与
//     布局编辑的「保存布局」(PS2:163-170) 写的是**同一份配置**。
//   - `production_sheet2_printer_v1` —— 裸字符串（打印机名），**不 JSON**。
//
// 键名定义在 `profile.ts`（档案的一部分），这里原样转出。

import {
  loadDocSheetSettings,
  saveDocSheetConfig as baseSaveConfig,
  saveDocSheetPrinter as baseSavePrinter,
  type DocSheetLoadedSettings,
} from '../docsheet/storage'
import { PRODUCTIONSHEET2_PROFILE, PRODUCTIONSHEET2_STORAGE_KEYS } from './profile'
import type { ProductionSheet2Config } from './types'

export { PRODUCTIONSHEET2_STORAGE_KEYS }

/** 一次载入的两项（`config` + 裸字符串打印机名）。 */
export type ProductionSheet2LoadedSettings = DocSheetLoadedSettings

/**
 * `onMounted` 的载入段（PS2:709-803）。
 *
 * - 配置：`getItem` 拿不到 / 是空串 → **直接用默认**（PS2:713-714 提前 return）；
 *   否则 `JSON.parse` → 逐字段清洗。整段在 `try/catch` 里，抛错 → 默认。
 * - 打印机：独立的 `try/catch`，异常也落到 `""`（PS2:795-800）。
 */
export function loadProductionSheet2Settings(): ProductionSheet2LoadedSettings {
  return loadDocSheetSettings(PRODUCTIONSHEET2_PROFILE)
}

/**
 * 配置落盘（旧版 `C`，PS2:124-129）。
 *
 * ⚠️ 这里**不做任何清洗/trim** —— 旧版是直接把生效 ref `i.value` JSON 出来，
 * 清洗只发生在读盘时。调用方先 `cloneConfig()` 再存是旧版的做法。
 * 旧版 `try{}catch{}` 是**空 catch**（localStorage 满/被禁时不报错），照抄。
 */
export function saveProductionSheet2Config(config: ProductionSheet2Config): void {
  baseSaveConfig(PRODUCTIONSHEET2_PROFILE, config)
}

/**
 * 打印机落盘（旧版 `z`，PS2:130-135）—— `el-select` 的 `@change` **选中即写**，
 * 存**裸字符串（不是 JSON）**，同样是空 `try{}catch{}`。
 */
export function saveProductionSheet2Printer(name: string): void {
  baseSavePrinter(PRODUCTIONSHEET2_PROFILE, name)
}
