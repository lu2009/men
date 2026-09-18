// 自定义合格标签 · localStorage 读写 —— 转发底座 `../docsheet/storage.ts` 的键版原语（薄层）。
//
// **4 个键**（§2.6 末 / §骨架 §8.1；键名见 `profile.ts` 的 `QL_STORAGE_KEYS`）：
//   | 键 | 值 | 读回 |
//   |---|---|---|
//   | `qualified_label_template_v2`      | 整份配置 JSON   | `JSON.parse` → `N()` 清洗 |
//   | `qualified_label_printer`          | 打印机名**裸串** | `|| ""` |
//   | `qualified_label_quantity_enabled` | `"1"` / `"0"`   | `"1" === getItem(...)` |
//   | `qualified_label_quantity_value`   | 数字串          | `L(getItem(...) \|\| 1)` |
//
// 前两个走底座的 `loadDocSheetSettingsWith` / `saveDocSheetConfigByKey` /
// `saveDocSheetPrinterByKey`（§0.1 判定「可直接用」，只是键不同）；
// **后两个是裸串键**，走底座新增的 `loadRawString` / `saveRawString`
// （§10.2 A3 那次参数化的产物），语义在 `fixedQuantity.ts`。
//
// ⚠️ 旧版的**读盘是四段独立的 `try/catch`**（`QL:873-898`：配置一段、打印机一段、
//    两个固定张数键**合在第三段**）—— 所以一段抛错不影响别的段。
//    `loadDocSheetSettingsWith` 内部已经是两段独立 try/catch，与旧版前两段一一对应；
//    固定张数那一段由 `fixedQuantity.ts` 的 `loadFixedQuantitySetting` 自己包。

import {
  loadDocSheetSettingsWith,
  saveDocSheetConfigByKey,
  saveDocSheetPrinterByKey,
} from '../docsheet/storage'
import { normalizeQualifiedLabelConfig } from './sanitize'
import { QL_STORAGE_KEYS } from './profile'
import type { QualifiedLabelConfig } from './types'

/** 一次载入的两项（与底座 `DocSheetLoadedSettings` 同形）。 */
export interface QualifiedLabelLoadedSettings {
  config: QualifiedLabelConfig
  /** 裸字符串，空串 = 未选打印机（旧版 `h.value = localStorage.getItem(ka) || ""`，`QL:887`）。 */
  selectedPrinter: string
}

/**
 * `onMounted` 的**配置 + 打印机**载入段（旧版 `QL:873-889` 的前两段）。
 *
 * 旧版逐条（CONFIRMED）：
 *   · `getItem(Aa)` 取整份配置 → **空串/`null` → 直接用 `N(a())`**（`QL:877`）；
 *   · 否则 `JSON.parse` → `N()` 清洗（`QL:879`）；
 *   · 整段 `try/catch`，抛错 → `N(a())`（`QL:880-882`）；
 *   · 打印机名独立 `try/catch` → `|| ""`（`QL:884-889`）。
 *
 * ⚠️ 旧版「没有存盘记录」走的是 `N(a())`（**默认值也过一次清洗**）而不是直接 `a()` ——
 *    两者产物逐字段相同（清洗对合法配置是恒等的），所以这里统一成「清洗 `undefined`」。
 * ⚠️ **固定张数的两个键不在这里**（旧版是第三段），见 `fixedQuantity.ts`。
 */
export function loadQualifiedLabelSettings(): QualifiedLabelLoadedSettings {
  return loadDocSheetSettingsWith(QL_STORAGE_KEYS, normalizeQualifiedLabelConfig)
}

/**
 * 配置落盘（旧版 `M`，`QL:235-240`）—— 存**生效配置** `r`，空 `try{}catch{}`。
 *
 * ⚠️ **本函数不做清洗** —— 清洗由**调用方**在写入前做（旧版 `k` 是
 * `r.value = N(clone(i.value))` 再 `M()`，`QL:404-407`；`oe` 同款，`QL:714-715`）。
 *    新版保持这个分工（§2.6 末的 ⚠️：清洗在**读盘与写回两端都调用**，但调用点在调用方）。
 */
export function saveQualifiedLabelConfig(config: QualifiedLabelConfig): void {
  saveDocSheetConfigByKey(QL_STORAGE_KEYS, config)
}

/**
 * 打印机落盘（旧版 `E`，`QL:369-374`）—— 存**裸字符串（不是 JSON）**，空 `try{}catch{}`。
 *
 * ⚠️ 旧版的调用点只有一个：设置弹窗里 `el-select` 的 `@change`（**选中即写**），
 *    而不是「保存并应用」。
 */
export function saveQualifiedLabelPrinter(name: string): void {
  saveDocSheetPrinterByKey(QL_STORAGE_KEYS, name)
}
