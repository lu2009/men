// C 家族自绘单据 · 读盘归一化 —— 逐字移植自旧版 `onMounted` 的清洗段
// （GS:686-768 / PS2:709-803）。
//
// 旧版把整段包在一个 IIFE + `try/catch` 里，**任何异常都落到 `i.value = a()`**（GS:765-767）。
// 新版保持这个语义：`sanitizeDocSheetConfig()` 内部不抛，出错就返回默认配置。
//
// 字段规则表见逆向报告 §6.4。**§2.3 已核实：PS2 与 GS2 在这条路径上逐字段相同**，
// 唯一的差异是两个 localStorage 键名（那在 `storage.ts`，不在本文件）。
// 两个实打实的旧版缺陷在那里标了 CONFIRMED 且对两张单据同样适用：
//   - 缺陷 1（`paddingMm` 的 `??` 语义给 `NaN`）—— **新版修**，见 `sanitizePaper`；
//   - 缺陷 2（`paddingMm: null` → `0` 而不是回落到 3）—— **照抄**，见同一个函数。

import { DEFAULT_PADDING_MM } from './defaults'
import type { ColumnConfig, DocSheetConfig, Orientation, PaperConfig, PrintConfig, TableConfig } from './types'
import type { DocSheetProfile } from './profile'

/** 把 `unknown` 当字典用（旧版全靠 `null == x ? void 0 : x["k"]`，等价于此）。 */
function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : undefined
}

/**
 * 纸张清洗（GS:695-723 / PS2:718-746）。**与 profile 无关** —— 两张单据的纸张完全一样。
 *
 * | 字段 | 旧版规则 | 新版 |
 * |---|---|---|
 * | `widthMm` | `Number(v) \|\| 297` | 照抄 |
 * | `heightMm` | `Number(v) \|\| 210` | 照抄 |
 * | `paddingMm` | ⚠️ `Number(v) != null ? Number(v) : 3` | **改成 `Number.isFinite(...)`**（见下） |
 * | `orientation` | `v === "portrait" ? "portrait" : "landscape"` | 照抄 |
 */
export function sanitizePaper(raw: unknown, fallback: PaperConfig): PaperConfig {
  const p = asRecord(raw)

  // ⚠️⚠️ 有意偏离（逆向报告 §6.4 决策 1，用户 2026-09-17 拍板）⚠️⚠️
  //
  // 旧版（GS:708-716）写的是：
  //     paddingMm: null != (n = Number(w?.paper?.paddingMm)) ? n : 返回默认 3
  // 即 **`??` 语义**。存盘对象里**缺 `paddingMm` 字段**时 `Number(undefined) === NaN`，
  // 而 `NaN != null` 为 **true** ⇒ 生效值变成 **`NaN`**。
  // 后果有两处，都很实：
  //   1. 内联样式拼出 `padding:NaNmm`，浏览器整条声明作废（视觉上等于 0 边距）；
  //   2. 分页预算 `heightMm - 2*NaN - 8 - 10` 也变 `NaN`，
  //      而 `used + h > NaN` **恒为 false** ⇒ 永远不翻页 ⇒ **整份单据退化成单页**（§5.2）。
  //
  // 新版改成 `Number.isFinite(...)` 判定：`undefined` / `NaN` / 非数字串 → 回落 **3**，
  // 与同段的 `widthMm`/`heightMm`/`headerFontSize` 写法一致。
  // 理由：`NaN` 从来不是有意值；且新版是全新 app、localStorage 不会带着旧版数据过来，
  // 这条路径实际不可达，修它零风险。
  //
  // ⚠️ 但**缺陷 2 照抄**：`Number(null) === 0` 且 `Number.isFinite(0)` 为真 ⇒ 存盘里
  //    `paddingMm: null` 仍然变成 **`0`**（不是回落默认的 3）。这一条不改 ——
  //    `0` 是合法值（输入框 min 就是 0），旧版行为就是这个，改它才是偏离。
  //    ⚠️ 注意这正是**不能**简单写成 `Number(v) || 3` 的原因：`||` 会把 `null`(→0) 也一并
  //    回落成 3，那就把缺陷 2 一起「修」了，与决策不符。
  const rawPadding = Number(p?.paddingMm)
  const paddingMm = Number.isFinite(rawPadding) ? rawPadding : DEFAULT_PADDING_MM

  // 只认 "portrait" 这一个合法值，其余一切（含 undefined / "landscape" / 乱码）→ "landscape"（GS:717-722）
  const orientation: Orientation = p?.orientation === 'portrait' ? 'portrait' : 'landscape'

  return {
    widthMm: Number(p?.widthMm) || fallback.widthMm, // :696-701
    heightMm: Number(p?.heightMm) || fallback.heightMm, // :702-707
    paddingMm, // :708-716（见上方偏离说明）
    orientation, // :717-722
  }
}

/**
 * 表格清洗（GS:724-750 / PS2:747-773）。
 *
 * `columns` 的合并规则（GS:739-749）**按下标**：`{...默认列[i], ...存盘列[i]}` ——
 * 即**缺字段补默认、多出的列原样保留**（GS2 存了 10 列就得到 10 列、PS2 存了 11 列就得到 11 列，
 * 多出的列 `key` 不在默认列集里，渲染时走 `renderCell` 的 `default` 分支 → 空单元格）。
 * 存盘列里 `key` 也**不做合法性校验**，照抄。
 *
 * ⚠️ 回落的默认列来自 **profile**（GS2 是 8 列、PS2 是 9 列）—— 这是本文件唯一读 profile 的地方。
 */
export function sanitizeTable(raw: unknown, fallback: TableConfig, profile: DocSheetProfile): TableConfig {
  const t = asRecord(raw)
  const defaults = fallback.columns

  const rawColumns = t?.columns
  const columns: ColumnConfig[] =
    Array.isArray(rawColumns) && rawColumns.length > 0
      ? rawColumns.map((col, i) => ({
          ...defaults[i],
          ...(asRecord(col) as Partial<ColumnConfig> | undefined),
        }) as ColumnConfig)
      : profile.createDefaultColumns()

  return {
    title: (t?.title as string) || fallback.title, // :725-728
    borderColor: (t?.borderColor as string) || fallback.borderColor, // :729-732
    headerFontSize: Number(t?.headerFontSize) || fallback.headerFontSize, // :733-738
    columns,
  }
}

/** 打印参数清洗（GS:751-763 / PS2:774-786）：`copies` clamp 到 **1–99**。 */
export function sanitizePrint(raw: unknown, fallback: PrintConfig): PrintConfig {
  const p = asRecord(raw)
  return {
    copies: Math.max(1, Math.min(99, Number(p?.copies) || fallback.copies)),
  }
}

/**
 * 整份配置清洗（GS:686-768 / PS2:709-803）。
 *
 * ⚠️ 旧版是「读不到键 → **提前 return，直接用默认**」（GS:690-691），
 * 新版由 `storage.ts` 把「键不存在」变成传 `undefined` 进来 —— 等价，
 * 因为 `asRecord(undefined)` 是 `undefined`、每个字段都落到 `fallback`。
 */
export function sanitizeDocSheetConfig(raw: unknown, profile: DocSheetProfile): DocSheetConfig {
  const fallback = profile.createDefaultConfig()
  try {
    // 旧版对「不是对象」的存盘值（比如存了个数字/字符串）会在 `.paper` 取值处得到 undefined，
    // 逐字段回落到默认 —— 与这里一致。
    const w = asRecord(raw)
    return {
      paper: sanitizePaper(w?.paper, fallback.paper),
      table: sanitizeTable(w?.table, fallback.table, profile),
      print: sanitizePrint(w?.print, fallback.print),
    }
  } catch {
    // 旧版 GS:765-767 —— 抛错 → 整份回默认。
    return fallback
  }
}

/** 深拷贝配置（旧版到处用的 `JSON.parse(JSON.stringify(x))`，GS:149/157/366/783/791 等）。 */
export function cloneConfig<T>(config: T): T {
  return JSON.parse(JSON.stringify(config)) as T
}
