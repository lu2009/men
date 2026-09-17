// 收据单2 的 localStorage 读写层 —— 移植自旧版 `Receipt2.deobfuscated.js`。
//
// 共 **7 个键**（全文件 14 处 `localStorage` 调用去重后的结果，无 `removeItem` / 无 `sessionStorage`）。
// 键名逐字照抄，见逆向报告 `docs/receipt2-recon/01-config-persistence.md` §5.1。
//
// 旧版把「读盘 → 清洗」写成了 7 个互不依赖的 IIFE（`onMounted` :1019-1095），
// 新版收进 `loadAllReceipt2Settings()`；每个键仍然**各自 try/catch**，任何异常都落到默认值。

import {
  sanitizeBrand,
  sanitizeColumnWidths,
  sanitizeElementConfigs,
  sanitizeFonts,
  sanitizePaper,
  sanitizeVisibility,
} from './sanitize'
import type {
  BrandSettings,
  ColumnWidths,
  ElementConfigs,
  FontSettings,
  PaperSettings,
  VisibilitySettings,
} from './types'

/**
 * 7 个 localStorage 键（旧版变量名见注释）。
 * `sa`/`da`/`Va`/`ma`/`wa` 在旧 bundle 里是模块级常量，键名由 `decode-token.mjs` 还原；
 * `ga`(:833/:1061) 与 `ya`(:141/:179) 在原 bundle 里就是字面量，可交叉验证命名风格。
 */
export const RECEIPT2_STORAGE_KEYS = {
  fontSettings: 'receipt2_font_settings', // sa  :837 / :1022
  printSettings: 'receipt2_print_settings', // ma  :841 / :1034
  visibilitySettings: 'receipt2_visibility_settings', // wa  :845 / :1046
  brandSettings: 'receipt2_brand_settings', // ga  :833 / :1063
  elementConfigs: 'receipt2_element_configs', // ya  :179 / :141
  columnWidths: 'receipt2_column_widths', // da  :938 / :1080
  selectedPrinter: 'receipt2_selected_printer', // Va  :219 / :1093
} as const

/** 读 JSON。缺失 / 空串 / `JSON.parse` 抛错 → `undefined`（调用方落到默认值）。 */
function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined // 旧版是各处自己写的 `if (!t) return …默认…`
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** 写 JSON。旧版的 `setItem` 区（`he` :831-846 / `A` :179 / 拖拽 :938）都没包 try/catch，照抄。 */
function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/** 一次载入的 7 项（对应旧版的 `v` / `h` / `C` / `i` / `b` / `n` / `H` 这 7 个 ref）。 */
export interface Receipt2LoadedSettings {
  fontSettings: FontSettings
  printSettings: PaperSettings
  visibilitySettings: VisibilitySettings
  brandSettings: BrandSettings
  elementConfigs: ElementConfigs
  columnWidths: ColumnWidths
  /** 裸字符串，空串 = 用系统默认打印机。 */
  selectedPrinter: string
}

/**
 * `onMounted` :1018-1095 的 7 步载入。**顺序照抄**（7 项互不依赖，保持顺序只为省心）：
 *
 * 1. `sa` → `Z(JSON.parse(t))` → `v`，无值/异常 → `{...u}`（:1019-1030）
 * 2. `ma` → `X(JSON.parse(t))` → `h`，无值/异常 → `{...s}`（:1031-1042）
 * 3. `wa` → `te(JSON.parse(t))` → `C`，无值/异常 → `{...g, metaOrder:[...g.metaOrder]}`（:1043-1059）
 * 4. `ga` → 手工校验（`!!enabled` + `name` 必须是字符串，**不 trim**）（:1060-1075）
 * 5. `D()` → `ya` → 元素配置归一化（:1076，实现见 `sanitizeElementConfigs`）
 * 6. `da` → 必须是长度 10 的数组（:1077-1089）
 * 7. `Va` → `getItem(Va) || ""`，**裸字符串不 JSON**（:1090-1095）
 *
 * 草稿副本（`f`/`p`/`z`/`c`）由调用方自行从生效值浅拷贝 —— 旧版就是这么做的，
 * 所以这里只返回"生效值"这一套。`visibilitySettings.metaOrder` 每次都是新数组，不会被共享引用坑到。
 */
export function loadAllReceipt2Settings(): Receipt2LoadedSettings {
  // 1. 字号（sa）
  const fontSettings = sanitizeFonts(readJson(RECEIPT2_STORAGE_KEYS.fontSettings)) // :1025
  // 2. 纸张（ma）
  const printSettings = sanitizePaper(readJson(RECEIPT2_STORAGE_KEYS.printSettings)) // :1037
  // 3. 显隐（wa）—— sanitizeVisibility 恒返回完整对象，等价于旧版的 `!t` 分支
  const visibilitySettings = sanitizeVisibility(readJson(RECEIPT2_STORAGE_KEYS.visibilitySettings)) // :1052
  // 4. 品牌（ga）
  const brandSettings = sanitizeBrand(readJson(RECEIPT2_STORAGE_KEYS.brandSettings)) // :1065-1069
  // 5. 元素配置（ya）
  const elementConfigs = sanitizeElementConfigs(readJson(RECEIPT2_STORAGE_KEYS.elementConfigs)) // :1076
  // 6. 列宽（da）
  const columnWidths = sanitizeColumnWidths(readJson(RECEIPT2_STORAGE_KEYS.columnWidths)) // :1082
  // 7. 打印机（Va）
  let selectedPrinter = ''
  try {
    selectedPrinter = localStorage.getItem(RECEIPT2_STORAGE_KEYS.selectedPrinter) || '' // :1093
  } catch {
    selectedPrinter = ''
  }

  return {
    fontSettings,
    printSettings,
    visibilitySettings,
    brandSettings,
    elementConfigs,
    columnWidths,
    selectedPrinter,
  }
}

/** 设置弹窗的草稿（旧版的 `f` / `p` / `z` / `c` 四个 ref）。字段收 `unknown`，清洗器自己兜底。 */
export interface Receipt2DialogDraft {
  fontSettings: unknown
  printSettings: unknown
  visibilitySettings: unknown
  brandSettings: unknown
}

/** `saveDialogSettings` 的返回：清洗后的 4 个生效值，调用方拿回填到生效 ref。 */
export interface Receipt2DialogSettings {
  fontSettings: FontSettings
  printSettings: PaperSettings
  visibilitySettings: VisibilitySettings
  brandSettings: BrandSettings
}

/**
 * 「保存」按钮（旧版 `he` :817-850）—— **只有它会写 `ga`/`sa`/`ma`/`wa` 这四个键**，一次写四发。
 *
 * 完整顺序照抄：
 * 1. `v = Z(f)` → `f = {...v}`
 * 2. `h = X(p)` → `p = {...h}`
 * 3. `C = te(z)` → `z = {...C, metaOrder:[...C.metaOrder]}`（metaOrder 必须浅拷贝断引用）
 * 4. `i = { enabled: c.enabled, name: c.value.name.trim() }` → `c = {...i}` —— **`trim()` 只在这里做**
 * 5. `setItem(ga → sa → ma → wa)`（旧版 L833/837/841/845 就是这个顺序）
 * 6. 关对话框 + 若组件激活则刷新预览（属 UI 层，不在这里）
 *
 * 返回值 = 清洗后的 `v/h/C/i`，调用方负责回填生效值、关框、刷新预览。
 */
export function saveDialogSettings(draft: Receipt2DialogDraft): Receipt2DialogSettings {
  const fontSettings = sanitizeFonts(draft.fontSettings) // :820
  const printSettings = sanitizePaper(draft.printSettings) // :822
  const visibilitySettings = sanitizeVisibility(draft.visibilitySettings) // :824
  const rawBrand = sanitizeBrand(draft.brandSettings) // :826-829
  const brandSettings: BrandSettings = { enabled: rawBrand.enabled, name: rawBrand.name.trim() } // :828

  writeJson(RECEIPT2_STORAGE_KEYS.brandSettings, brandSettings) // :833
  writeJson(RECEIPT2_STORAGE_KEYS.fontSettings, fontSettings) // :837
  writeJson(RECEIPT2_STORAGE_KEYS.printSettings, printSettings) // :841
  writeJson(RECEIPT2_STORAGE_KEYS.visibilitySettings, visibilitySettings) // :845

  return { fontSettings, printSettings, visibilitySettings, brandSettings }
}

/**
 * 元素配置落盘（旧版 `A` :177-180）—— 在**元素微调「确认」**(:994) 和
 * `resetAllElementConfigs`(:1150) 时调用，**不走设置弹窗的保存按钮**。
 */
export function saveElementConfigs(configs: ElementConfigs): void {
  writeJson(RECEIPT2_STORAGE_KEYS.elementConfigs, configs) // :179
}

/**
 * 列宽落盘（旧版 :936-939）—— **只在拖拽 mouseup 时**写，拖一次写一次，没有确认步骤。
 * 长度照旧写整组 10 个（调用方保证数组已按 :929-935 重算过）。
 */
export function saveColumnWidths(widths: ColumnWidths): void {
  writeJson(RECEIPT2_STORAGE_KEYS.columnWidths, widths) // :938
}

/**
 * 打印机落盘（旧版 `j` :216-221）—— `el-select` 的 `@change` 选中即写，
 * **存裸字符串（不是 JSON）**，且用**空 `try{}catch{}` 吞异常**（localStorage 满/被禁时不报错）。
 */
export function saveSelectedPrinter(name: string): void {
  try {
    localStorage.setItem(RECEIPT2_STORAGE_KEYS.selectedPrinter, name) // :219
  } catch {
    /* 旧版就是空 catch，照抄 */
  }
}

