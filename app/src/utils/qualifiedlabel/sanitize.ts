// 自定义合格标签 · 读盘清洗 —— 逐字移植旧版 `N(e)`（`QL:241-369`，1552 字符）。
//
// 施工图：`docs/custom-docs-recon/01-ql.md` §2.6（R1–R11 那张逐条规则表）。
//
// ⚠️ **与底座 `docsheet/sanitize.ts` 无一处同构**（§0.1 判定「必须新写」）：
//    · schema 完全不同（自由定位字段表 vs 列宽表）；
//    · **读盘与写回两端都调用**（§骨架 §1.3 CONFIRMED）——
//      三个调用点：`onMounted`(`QL:879/881`) / 保存设置 `k`(`QL:404`) / 保存布局 `oe`(`QL:714`)。
//      ⚠️ 只有 `openLayoutEditor`(`QL:914`) **也**调（`d = N(clone(r))`），
//      而 `openSettingsDialog`(`QL:905`) **不调**（只 `JSON.parse(JSON.stringify(...))`）。
//    · 合并规则是「按 **key** 合并、以**默认表为主干**」（R9）—— 底座是「按下标合并、多出的列保留」。

import { createDefaultConfig } from './defaults'
import type {
  LabelField,
  LabelFontWeight,
  LabelTextAlign,
  QualifiedLabelConfig,
} from './types'

/**
 * 数值 clamp 工具（旧版 `N` 内部的 `m`，`QL:245-249`）。
 *
 * ```js
 * const n = Number(e)
 * return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
 * ```
 *
 * ★ **`Number(null) === 0`、`Number("") === 0` 都是有限值** ⇒ 存盘里的 `null`/`""`
 *   会被夹到 **`min`**（不是回落）；只有 `undefined` → `NaN` → 才走 `fallback`。
 *   这是旧版既有语义，**照抄**（与 PS 的 `clampNumber` 逐字同构）。
 */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

/** 取一个可选的嵌套属性，等价于旧版 `e?.paper?.widthMm` 的长链（`QL:254-277`）。 */
function read(source: unknown, key: string): unknown {
  if (source === null || typeof source !== 'object') return undefined
  return (source as Record<string, unknown>)[key]
}

/** 把值当对象展开用；非对象（含 `null`/数组/字符串）→ 空对象，等价于旧版的 `|| {}`。 */
function spread(source: unknown): Record<string, unknown> {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) return {}
  return source as Record<string, unknown>
}

/** 文本对齐白名单（`QL:357` 的 `["left","center","right"]`，**顺序照抄**）。 */
const TEXT_ALIGNS: readonly string[] = ['left', 'center', 'right']

/**
 * 把任意存盘数据归一化成一份**必定合法**的配置（旧版 `N`，`QL:241-369`）。
 *
 * 传 `undefined` / `null` / 垃圾数据 → 产物与 `createDefaultConfig()` **逐字段相同**
 * （每一条都走 fallback 分支）。这保证「没有存盘记录」这条路径不需要特判
 * —— 与底座 `loadDocSheetSettingsWith` 的处理一致（那边也是「没记录就用默认」）。
 *
 * 逐条对应 §2.6 的 R1–R11，实现顺序与旧版一致：
 *
 * | # | 规则 | 行 |
 * |---|---|---|
 * | R1 | `paper`/`globalFont`/`print` 三块 `{...默认, ...存档}` 展开 | 245/283/297 |
 * | R2 | `m(v,min,max,fallback)` clamp 工具 | 246-250 |
 * | R3 | `widthMm` 20–300 / `heightMm` 20–400 / `paddingMm` 0–20 | 252-277 |
 * | R4 | `orientation` 只认 `"landscape"`，其余 `"portrait"` | 278-282 |
 * | R5 | `fontSize` 5–30 / `lineHeight` 1–2 / `fontWeight` 只认 bold；**`fontFamily` 不校验** | 284-296 |
 * | R6 | `autoHideEmpty`：`!== undefined ? !!v : 默认` | 297-300 |
 * | R7 | `print.copies`：`max(1, min(99, Number(v) \|\| 默认))`（★ 与 R3 的 clamp 写法**不同**） | 301-308 |
 * | R8 | 存档 `fields` 非数组 → `[]`；否则建成 `Map(key → 存档项)` | 309-312 |
 * | R9 | ★ 遍历**默认字段表**（不是存档的）→ `{...默认项, ...存档项}` | 318-320 |
 * | R10 | width/height/x/y/fontSize/maxLines/fontWeight/textAlign 的逐条 clamp | 322-359 |
 * | R11 | ★ **全字段不可见 → 整体回落默认字段表** | 364-366 |
 *
 * @param raw 存盘里 `JSON.parse` 出来的东西（或 `undefined`）
 */
export function normalizeQualifiedLabelConfig(raw: unknown): QualifiedLabelConfig {
  const defaults = createDefaultConfig()

  const rawPaper = read(raw, 'paper')
  const rawFont = read(raw, 'globalFont')
  const rawPrint = read(raw, 'print')

  // ---------------------------------------------------------------- //
  // paper（R1/R3/R4，`QL:250-283`）
  // ---------------------------------------------------------------- //
  // ⚠️ 展开在前、逐键覆盖在后 ⇒ **`printRotate90` 只来自展开**（旧版没有为它写 clamp，§2.4）。
  //    旧版全程按**真值**消费它（`n ? … : …`、`!n && …`），所以这里 `!!` 是**保真**的
  //    （对 boolean 恒等；对存盘里的 `"false"` 字符串，旧版也当真值用）。
  const mergedPaper = { ...defaults.paper, ...spread(rawPaper) }
  const paper = {
    ...mergedPaper,
    widthMm: clampNumber(read(rawPaper, 'widthMm'), 20, 300, defaults.paper.widthMm),
    heightMm: clampNumber(read(rawPaper, 'heightMm'), 20, 400, defaults.paper.heightMm),
    paddingMm: clampNumber(read(rawPaper, 'paddingMm'), 0, 20, defaults.paper.paddingMm),
    orientation: read(rawPaper, 'orientation') === 'landscape' ? 'landscape' : 'portrait',
    printRotate90: !!mergedPaper.printRotate90,
  } as QualifiedLabelConfig['paper']

  // ---------------------------------------------------------------- //
  // globalFont（R1/R5，`QL:284-296`）
  // ---------------------------------------------------------------- //
  const mergedFont = { ...defaults.globalFont, ...spread(rawFont) }
  const globalFont = {
    ...mergedFont,
    // ⚠️ R5 明说 fontFamily **不校验**（靠 R1 展开原样带过）。旧版在 `QL:732` 直接
    //    `fontFamily.replace(...)`，非字符串会**抛异常**、整张标签画不出来。
    //    新版在这里把非字符串挡回默认值 —— **有意偏离**（唯一的偏离点）：
    //    理由是本层的类型契约要求 `string`，而「存盘里塞了个数字」这条路径在旧版是崩，
    //    新版是回默认，属**加固**不属行为改变（正常存盘里它恒为字符串）。
    fontFamily:
      typeof mergedFont.fontFamily === 'string'
        ? mergedFont.fontFamily
        : defaults.globalFont.fontFamily,
    fontSize: clampNumber(read(rawFont, 'fontSize'), 5, 30, defaults.globalFont.fontSize),
    lineHeight: clampNumber(read(rawFont, 'lineHeight'), 1, 2, defaults.globalFont.lineHeight),
    fontWeight: read(rawFont, 'fontWeight') === 'bold' ? 'bold' : 'normal',
  } as QualifiedLabelConfig['globalFont']

  // ---------------------------------------------------------------- //
  // autoHideEmpty（R6，`QL:297-300`）
  // ---------------------------------------------------------------- //
  // ⚠️ 判的是**存的原始值** `e?.autoHideEmpty`，不是展开后的 —— 两者只在
  //    「存盘里根本没有这个键」时同值，其它情况取 `!!存值` 也与展开后再 `!!` 同值。
  const rawAutoHide = read(raw, 'autoHideEmpty')
  const autoHideEmpty = rawAutoHide !== undefined ? !!rawAutoHide : defaults.autoHideEmpty

  // ---------------------------------------------------------------- //
  // print（R1/R7，`QL:301-308`）
  // ---------------------------------------------------------------- //
  // ★ **R7 的写法与 R3 不同**（§2.6 的表格）：这里是
  //   `Number(v) || 默认` 再 `max(1, min(99, …))`，**不是** `m()`。
  //   差别在 `0` 与 `""`：`m()` 会把它们夹到 min，R7 会因为 `|| ` 而**回落默认值**（1）。
  const mergedPrint = { ...defaults.print, ...spread(rawPrint) }
  const print = {
    ...mergedPrint,
    copies: Math.max(
      1,
      Math.min(99, Number(read(rawPrint, 'copies')) || defaults.print.copies),
    ),
  } as QualifiedLabelConfig['print']

  // ---------------------------------------------------------------- //
  // fields（R8/R9/R10，`QL:309-359`）
  // ---------------------------------------------------------------- //
  const rawFields = read(raw, 'fields')
  const storedFields = Array.isArray(rawFields) ? rawFields : [] // R8：非数组 → []
  // ★ 按 key 建 Map。⚠️ 重复 key 时**后者胜**（Map 语义），与旧版 `new Map(...)` 一致。
  const byKey = new Map<string, unknown>(
    storedFields.map((f) => [String(read(f, 'key')), f] as const),
  )

  const paperWidth = paper.widthMm
  const paperHeight = paper.heightMm
  const fields: LabelField[] = []

  // ★ R9：**遍历默认表**（不是存档表）⇒ 存盘里多出来的 key 被静默丢弃、
  //    缺失的 key 回默认、顺序恒为默认顺序。
  //    ⚠️ 合并方向是 `{...默认, ...存档}` ⇒ **存档里被手工改过的 `label` 会覆盖默认**
  //    （尽管 UI 没有改 label 的入口）。§2.6 特别提醒「很容易搞反」。
  for (const def of defaults.fields) {
    const merged = { ...def, ...spread(byKey.get(def.key)) } as LabelField

    // R10 —— 顺序照抄 `QL:342-360`，别重排（`y` 的上界依赖**已经算好的** `height`）
    merged.width = clampNumber(merged.width, 1, paperWidth, def.width) // :342
    merged.height =
      merged.key === 'qrcode' // :343-345
        ? merged.width // ★ qrcode 的 height 强制 = width
        : clampNumber(merged.height, 1, paperHeight, def.height)
    merged.x = clampNumber(merged.x, 0, Math.max(0, paperWidth - merged.width), def.x) // :346
    merged.y = clampNumber(merged.y, 0, Math.max(0, paperHeight - merged.height), def.y) // :347
    merged.fontSize = clampNumber(merged.fontSize, 5, 30, def.fontSize) // :348
    merged.maxLines = Math.max(1, Math.min(10, Math.round(Number(merged.maxLines) || def.maxLines))) // :349-355
    merged.fontWeight = (merged.fontWeight === 'bold' ? 'bold' : 'normal') as LabelFontWeight // :356
    merged.textAlign = (
      TEXT_ALIGNS.includes(merged.textAlign) ? merged.textAlign : 'left'
    ) as LabelTextAlign // :357-360

    // ⚠️ `visible` / `showPrefix` / `wrap` 旧版**一律不校验**（§2.3 的表），消费点全是**真值**判断
    //    （`filter(f => f.visible)`、`e.showPrefix && e.label`、`e.wrap ? … : …`）。
    //    所以这里用 `!!` —— 对 boolean 恒等、对其它类型保住旧版真值语义，且满足严格类型。
    merged.visible = !!merged.visible
    merged.showPrefix = !!merged.showPrefix
    merged.wrap = !!merged.wrap

    // ⚠️ `label` 旧版也不校验（只做字符串拼接）。存盘里的 `null` → `String(null)` 会得到 `"null"`，
    //    与旧版 `null + ":"` 的产物**字面相同**，故此处等价；`undefined` 不可达（默认表给了值）。
    if (typeof merged.label !== 'string') merged.label = String(merged.label ?? '')

    fields.push(merged)
  }

  // ---------------------------------------------------------------- //
  // R11 —— ★ 全字段不可见 → 整体回落默认（`QL:364-366`）
  // ---------------------------------------------------------------- //
  // 本单独有的兜底（PS 的 `z` 没有对应物）：用户若把 11 个字段的显隐全部取消，
  // 保存后**整份版式静默回默认**。⚠️ 漏掉它就会打出一张白纸，且用户无法从 UI 恢复（§10.3 #2）。
  // ⚠️ 回落的是 `默认字段表.map(e => ({...e}))` —— **浅拷贝**，不是清洗过的这份 fields。
  const finalFields = fields.some((f) => f.visible)
    ? fields
    : defaults.fields.map((f) => ({ ...f }))

  return { paper, globalFont, autoHideEmpty, fields: finalFields, print }
}
