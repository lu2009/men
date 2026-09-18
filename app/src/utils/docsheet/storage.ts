// C 家族自绘单据 · localStorage 读写层。
//
// **每张单据只有 2 个键**（§8）—— 别把收据单那 7 个键的心智模型带过来：
//   - `{prefix}_sheet2_template_v1` —— 整份 `{paper,table,print}` JSON。
//     **两个弹窗共用这一个键**：打印设置的「保存并应用」(GS:146-153) 与
//     布局编辑的「保存布局」(GS:154-161) 写的是**同一份配置**。
//   - `{prefix}_sheet2_printer_v1` —— 裸字符串（打印机名），**不 JSON**。
//
// 两张单据**只有键名不同**（§8 那张表，CONFIRMED）：
//   · GS2：`glass_sheet2_template_v1` / `glass_sheet2_printer_v1`（旧版 module 级常量 `Dn` / `An`）
//   · PS2：`production_sheet2_template_v1` / `production_sheet2_printer_v1`（旧版 `yn` / `vn`）
// 键名由 profile 给（`profile.storageKeys`）—— 本文件里**没有一个键名字面量**。
//
// ⚠️ **§8.2 #14/#15 之外的一处参数化（本单新增）**：自定义生产单（ic=14）用的是**另外两个键名**
//    （`production_sheet_template_v1` / `production_sheet_printer`，§6.3），且它的清洗函数
//    `z` 与底座的 `sanitizeDocSheetConfig` **完全不同构**，**也不共用 `DocSheetProfile`**。
//    但三个函数的**读写逻辑本身逐字相同** ⇒ 把「键 + 清洗函数」提成入参
//    （`DocSheetStorageKeys` + `loadDocSheetSettingsWith` / `saveDocSheetConfigByKey` /
//     `saveDocSheetPrinterByKey`），C 家族那三个 profile 版函数改成薄包装。**行为零变化。**

import { sanitizeDocSheetConfig } from './sanitize'
import type { DocSheetConfig } from './types'
import type { DocSheetProfile } from './profile'

/**
 * 存盘坐标 —— 只有两个键。
 *
 * `DocSheetProfile.storageKeys` 在结构上就是本类型，所以 profile 可以直接传进来。
 */
export interface DocSheetStorageKeys {
  /** 整份配置 JSON */
  template: string
  /** 打印机名，裸串（不是 JSON） */
  selectedPrinter: string
}

/** 一次载入的两项。 */
export interface DocSheetLoadedSettings<C = DocSheetConfig> {
  config: C
  /** 裸字符串，空串 = 用系统默认打印机（GS:792 `selectedPrinter || ""`）。 */
  selectedPrinter: string
}

/**
 * `onMounted` 的载入段（GS:686-774 / PS2:709-803）—— 通用版，清洗函数由调用方给。
 *
 * - 配置：`getItem` 拿不到 / 是空串 → **直接用默认**（GS:690-691 提前 return）；
 *   否则 `JSON.parse` → 逐字段清洗。整段在 `try/catch` 里，抛错 → 默认。
 * - 打印机：独立的 `try/catch`，异常也落到 `""`（GS:769-774）。
 *
 * ⚠️ 旧版 `if (!l) return void (i.value = a())` —— **没有存盘记录就「不清洗」直接用默认**。
 * 这里统一成「清洗 `undefined`」：只要 `sanitize` 对 `undefined` 的产物与默认配置逐字段相同，
 * 两条路径就**产物等价**（C 家族与 PS 两边都满足这条，各自的 `normalize` 都以此为契约）。
 *
 * @param keys     两个 localStorage 键
 * @param sanitize 本单据的读盘清洗函数（`(raw) => config`）
 */
export function loadDocSheetSettingsWith<C>(
  keys: DocSheetStorageKeys,
  sanitize: (raw: unknown) => C,
): DocSheetLoadedSettings<C> {
  let config: C
  try {
    const raw = localStorage.getItem(keys.template) // :690
    config = raw ? sanitize(JSON.parse(raw)) : sanitize(undefined)
  } catch {
    config = sanitize(undefined) // :765-767
  }

  let selectedPrinter = ''
  try {
    selectedPrinter = localStorage.getItem(keys.selectedPrinter) || '' // :772
  } catch {
    selectedPrinter = ''
  }

  return { config, selectedPrinter }
}

/**
 * `onMounted` 的载入段（C 家族版）—— 清洗函数固定为 `sanitizeDocSheetConfig`。
 *
 * - 配置：`getItem` 拿不到 / 是空串 → **直接用默认**（GS:690-691 提前 return）；
 *   否则 `JSON.parse` → 逐字段清洗（`sanitizeDocSheetConfig`）。整段在 `try/catch` 里，抛错 → 默认。
 * - 打印机：独立的 `try/catch`，异常也落到 `""`（GS:769-774）。
 */
export function loadDocSheetSettings(profile: DocSheetProfile): DocSheetLoadedSettings {
  return loadDocSheetSettingsWith(profile.storageKeys, (raw) => sanitizeDocSheetConfig(raw, profile))
}

/**
 * 配置落盘（旧版 `C`，GS:115-120 / PS2:124-129）—— 通用版。
 *
 * ⚠️ 这里**不做任何清洗/trim** —— 旧版是直接把生效 ref JSON 出来，
 * 清洗只发生在读盘时（PS 是双端清洗的例外，见下）。调用方先 `cloneConfig()` 再存是旧版的做法（GS:149）。
 *
 * 写入方有两处且**共用这一个键**：
 *   - 「保存并应用」（GS:146-153）：`i = clone(c)` → 写盘 → 关窗
 *   - 「保存布局」（GS:154-161）：`i = clone(s)` → 写盘 → 关窗
 *
 * 旧版 `try{}catch{}` 是**空 catch**（localStorage 满/被禁时不报错），照抄。
 */
export function saveDocSheetConfigByKey(keys: DocSheetStorageKeys, config: unknown): void {
  try {
    localStorage.setItem(keys.template, JSON.stringify(config)) // :118
  } catch {
    /* 旧版就是空 catch，照抄 */
  }
}

/**
 * 打印机落盘（旧版 `z`，GS:121-126 / PS2:130-135）—— 通用版。
 *
 * `el-select` 的 `@change` **选中即写**，存**裸字符串（不是 JSON）**，同样是空 `try{}catch{}`。
 */
export function saveDocSheetPrinterByKey(keys: DocSheetStorageKeys, name: string): void {
  try {
    localStorage.setItem(keys.selectedPrinter, name) // :124
  } catch {
    /* 旧版就是空 catch，照抄 */
  }
}

// ------------------------------------------------------------------ //
// 裸字符串键（本单/自定义合格标签新增，§10.2 A3）
// ------------------------------------------------------------------ //

/**
 * 读一个**裸字符串** localStorage 键（不是 JSON）。
 *
 * ★ 为自定义合格标签（ic=13）的两个**固定张数键**新增（§2.6 末）：
 *   `qualified_label_quantity_enabled` 存 `"1"`/`"0"`、
 *   `qualified_label_quantity_value` 存数字串。
 *   它们与 `loadDocSheetSettingsWith` 认的那两个键**形状不同**（那两个一个是 JSON 一个才是裸串），
 *   所以单独两个小工具，而不是把 `DocSheetStorageKeys` 撑大。
 *
 * ⚠️ 与旧版一致：**空 `try{}catch{}`**，异常时回落 `fallback`（localStorage 被禁时不抛）。
 * ⚠️ 返回**原始字符串**（不做 `|| ''` 之类的空串归一化）—— 归一化是调用方的事，
 *   因为 QL 的两个键一个判 `=== "1"`、一个判 `|| 1`，语义不同（见 `qualifiedlabel/storage.ts`）。
 */
export function loadRawString(key: string, fallback: string): string {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}

/** 写一个**裸字符串** localStorage 键。空 `try{}catch{}`（旧版同款）。 */
export function saveRawString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 旧版就是空 catch，照抄 */
  }
}

/** 配置落盘（C 家族版）。 */
export function saveDocSheetConfig(profile: DocSheetProfile, config: DocSheetConfig): void {
  saveDocSheetConfigByKey(profile.storageKeys, config)
}

/** 打印机落盘（C 家族版）。 */
export function saveDocSheetPrinter(profile: DocSheetProfile, name: string): void {
  saveDocSheetPrinterByKey(profile.storageKeys, name)
}
