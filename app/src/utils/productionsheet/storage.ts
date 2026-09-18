// 自定义生产单 · localStorage 读写 —— 转发底座 `../docsheet/storage.ts` 的键版原语（薄层）。
//
// 底座那三个函数的**读写逻辑逐字相同**，差别只有两处（§0.1 判定「可直接用」，但要参数化）：
//   1. **键名**：`production_sheet_template_v1` / `production_sheet_printer`（§6.3，
//      ⚠️ 打印机键**没有 `_v1`**，命名不统一是旧版事实）；
//   2. **清洗函数**：本单据的 `z`（`PS:271-513`）与底座的 `sanitizeDocSheetConfig` 完全不同构，
//      且**读盘与写回两端都调用**（底座只在读盘用，§2.4）。
//
// ⇒ 用 `loadDocSheetSettingsWith(keys, sanitize)` 复用底座的**读写骨架**，清洗传本单据的
//    `normalizeProductionSheetConfig`。`save*` 两个函数**不做清洗**（与旧版一致：
//    清洗由调用方在写入前显式做一次，见 `PS:543`/`PS:774` 的 `z(clone(...))`）。

import { loadDocSheetSettingsWith, saveDocSheetConfigByKey, saveDocSheetPrinterByKey } from '../docsheet/storage'
import { normalizeProductionSheetConfig } from './sanitize'
import { PS_STORAGE_KEYS } from './profile'
import type { ProductionSheetConfig } from './types'

/** 一次载入的两项。 */
export interface ProductionSheetLoadedSettings {
  config: ProductionSheetConfig
  /** 裸字符串，空串 = 用系统默认打印机（`PS:1354` 的 `|| ""`）。 */
  selectedPrinter: string
}

/**
 * `onMounted` 的载入段（`PS:1340-1357`）。
 *
 * 旧版逐条（CONFIRMED）：
 *   · `getItem(on)` 取整份配置 → 空串/`null` → **直接用默认 `a()`**（`PS:1345`）；
 *   · 否则 `JSON.parse` → **`z()` 清洗**（`PS:1346`）；
 *   · 整段 `try/catch`，抛错 → 默认（`PS:1347-1349`）；
 *   · 打印机名独立 `try/catch`（`PS:1351-1356`）。
 *
 * ⚠️ **`onMounted` 不拉打印机列表**（`PS:1340-1357` 里没有 `B()` 调用）——
 * 拉取只发生在设置弹窗的 `onOpen`（`PS:533-536`，且要求 Electron 且列表为空）。
 * 新版没有 Electron ⇒ 整个 `B`/`M` 不做（同 §diff §10 对 PS2 的处置）。
 */
export function loadProductionSheetSettings(): ProductionSheetLoadedSettings {
  return loadDocSheetSettingsWith(PS_STORAGE_KEYS, normalizeProductionSheetConfig)
}

/**
 * 配置落盘（旧版 `C`，`PS:265-270`）。
 *
 * ⚠️ **本函数不做清洗** —— 旧版是 `localStorage.setItem(on, JSON.stringify(r.value))`，
 * 写的是**生效配置**（`r`）；归一化由**调用方**在写入前做（`PS:543` 的
 * `r.value = z(clone(i.value))` 与 `PS:774` 的同款）。新版保持这个分工：
 * 调用方先 `normalizeProductionSheetConfig(cloneProductionSheetConfig(draft))`，再调本函数。
 *
 * 旧版 `try{}catch{}` 是空 catch，照抄。
 */
export function saveProductionSheetConfig(config: ProductionSheetConfig): void {
  saveDocSheetConfigByKey(PS_STORAGE_KEYS, config)
}

/**
 * 打印机落盘（旧版 `x`，`PS:514-519`）—— 存**裸字符串（不是 JSON）**，空 `try{}catch{}`。
 *
 * 旧版是设置弹窗里 `el-select` 的 `@change` 触发的「**选中即写**」。
 */
export function saveProductionSheetPrinter(name: string): void {
  saveDocSheetPrinterByKey(PS_STORAGE_KEYS, name)
}
