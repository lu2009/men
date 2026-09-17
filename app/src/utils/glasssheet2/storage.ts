// 自定义玻璃合片单 · localStorage 读写层 —— 移植自旧版 `GlassSheet2.deobfuscated.js`。
//
// **只有 2 个键**（§6.3）—— 别把收据单那 7 个键的心智模型带过来：
//   - `glass_sheet2_template_v1` —— 整份 `{paper,table,print}` JSON。
//     **两个弹窗共用这一个键**：打印设置的「保存并应用」(GS:146-153) 与
//     布局编辑的「保存布局」(GS:154-161) 写的是**同一份配置**。
//   - `glass_sheet2_printer_v1` —— 裸字符串（打印机名），**不 JSON**。
//
// 旧版里这两个键存在 `Dn` / `An` 两个模块级常量里（报告 §1 已解出真实值）。

import { sanitizeConfig } from './sanitize'
import type { GlassSheet2Config } from './types'

/** 2 个 localStorage 键（旧版变量名见注释）。 */
export const GLASSSHEET2_STORAGE_KEYS = {
  /** 整份配置。旧版 `Dn`，GS:118 写 / GS:690 读 */
  template: 'glass_sheet2_template_v1',
  /** 打印机名，裸字符串。旧版 `An`，GS:124 写 / GS:772 读 */
  selectedPrinter: 'glass_sheet2_printer_v1',
} as const

/** 一次载入的两项。 */
export interface GlassSheet2LoadedSettings {
  config: GlassSheet2Config
  /** 裸字符串，空串 = 用系统默认打印机（GS:792 `selectedPrinter || ""`）。 */
  selectedPrinter: string
}

/**
 * `onMounted` 的载入段（GS:686-774）。
 *
 * - 配置：`getItem` 拿不到 / 是空串 → **直接用默认**（GS:690-691 提前 return）；
 *   否则 `JSON.parse` → 逐字段清洗（`sanitizeConfig`）。整段在 `try/catch` 里，抛错 → 默认。
 * - 打印机：独立的 `try/catch`，异常也落到 `""`（GS:769-774）。
 */
export function loadGlassSheet2Settings(): GlassSheet2LoadedSettings {
  let config: GlassSheet2Config
  try {
    const raw = localStorage.getItem(GLASSSHEET2_STORAGE_KEYS.template) // :690
    // 旧版 `if (!l) return void (i.value = a())` —— 没有存盘记录就用默认，**不清洗**。
    // `sanitizeConfig(undefined)` 的产物与 `createDefaultConfig()` 逐字段相同。
    config = raw ? sanitizeConfig(JSON.parse(raw)) : sanitizeConfig(undefined)
  } catch {
    config = sanitizeConfig(undefined) // :765-767
  }

  let selectedPrinter = ''
  try {
    selectedPrinter = localStorage.getItem(GLASSSHEET2_STORAGE_KEYS.selectedPrinter) || '' // :772
  } catch {
    selectedPrinter = ''
  }

  return { config, selectedPrinter }
}

/**
 * 配置落盘（旧版 `C`，GS:115-120）。
 *
 * ⚠️ 这里**不做任何清洗/trim** —— 旧版是直接把生效 ref `i.value` JSON 出来，
 * 清洗只发生在读盘时。调用方先 `cloneConfig()` 再存是旧版的做法（GS:149）。
 *
 * 写入方有两处且**共用这一个键**：
 *   - 「保存并应用」（GS:146-153）：`i = clone(c)` → 写盘 → 关窗
 *   - 「保存布局」（GS:154-161）：`i = clone(s)` → 写盘 → 关窗
 *
 * 旧版 `try{}catch{}` 是**空 catch**（localStorage 满/被禁时不报错），照抄。
 */
export function saveGlassSheet2Config(config: GlassSheet2Config): void {
  try {
    localStorage.setItem(GLASSSHEET2_STORAGE_KEYS.template, JSON.stringify(config)) // :118
  } catch {
    /* 旧版就是空 catch，照抄 */
  }
}

/**
 * 打印机落盘（旧版 `z`，GS:121-126）—— `el-select` 的 `@change` **选中即写**，
 * 存**裸字符串（不是 JSON）**，同样是空 `try{}catch{}`。
 */
export function saveGlassSheet2Printer(name: string): void {
  try {
    localStorage.setItem(GLASSSHEET2_STORAGE_KEYS.selectedPrinter, name) // :124
  } catch {
    /* 旧版就是空 catch，照抄 */
  }
}
