// 收据单2 的配置清洗器 —— 逐字移植自旧版 `Receipt2.deobfuscated.js`。
//
// 所有函数都是**纯函数**（不碰 Vue、不碰 localStorage），旧版里它们读的是 `l`（模块级解码器别名）
// 和几个常量对象，新版改成从 `defaults.ts` 取。注释里的 `:N` 均指旧版行号。
//
// ⚠️ 这些清洗器有若干「反直觉但不是 bug」的语义（`K(null,…)` 返回 min、orientation 合法值优先于
// 尺寸反推、元素配置的 fontSize 无上界……），全部由逆向报告 `docs/receipt2-recon/01-config-persistence.md`
// §9 的 Node 实跑验证过。**移植时不要"顺手改进"**，唯一有意偏离的是 `sanitizeVisibility`
// 的 metaOrder 去重（见该函数注释）。

import {
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_PAPER,
  DEFAULT_VISIBILITY,
  ELEMENT_KEYS,
  FONT_RANGES,
  META_KEYS,
  PAPER_PRESETS,
  POSITIONS,
  defaultElementConfigs,
} from './defaults'
import type {
  BrandSettings,
  ColumnWidths,
  ElementConfigs,
  FontSettings,
  MetaKey,
  Orientation,
  PaperPresetKey,
  PaperSettings,
  Position,
  VisibilitySettings,
} from './types'

/**
 * 把任意输入当成"可能的配置对象"取字段。
 *
 * 旧版用的是 `e?.headerFontSize`（可选链）—— 对原始值（数字/字符串/布尔）取属性一样是 `undefined`，
 * 所以这里统一归一成 `{}`，语义完全等价，也避免了在 TS 里对 `unknown` 做属性访问。
 */
function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

/**
 * 数值清洗（旧版 `K` :245-251）：
 *
 * ```js
 * K = (e, t, o, a) => { const u = Number(e);
 *   return Number.isFinite(u) ? Math.max(t, Math.min(o, Math.round(u))) : a; };
 * ```
 *
 * ⚠️ `Number()` 的强制转换会"吃掉"很多东西，于是 `null` / `""` / `[]` / `false` 全都变成 `0`
 * 并被 clamp 到 **min**（不是 fallback）；只有 `undefined` / `NaN` / `±Infinity` / 非数字串
 * 才走 fallback。见逆向报告 §2.2 的对照表。
 *
 * `Math.round` 半值朝 +∞（`14.5 → 15`），且是**先 round 再 clamp**（`13.5 → 14 → 14`）。
 */
export function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback
}

/**
 * 六类字号清洗（旧版 `Z` :252-289）。
 *
 * 返回**恰好 6 个字段**的新对象（多出来的字段被丢弃），每个字段逐个 `K`。
 * 绝不读写 `DEFAULT_FONT_SETTINGS` 本身，所以 `Z({})` / `Z(undefined)` / `Z(null)` 都等于默认值。
 *
 * ⚠️ 已知的真实可达行为：Element Plus 的 `el-input-number` 清空时 emit `null`，
 * `K(null,…)` 会 clamp 到 **min**（品牌字体掉到 14），而不是回到默认 30。旧版就是这个表现，
 * 新版若想要"清空=恢复默认"，必须在这里之前把 `null` 归一成 `undefined`。
 */
export function sanitizeFonts(raw: unknown): FontSettings {
  const e = asRecord(raw)
  return {
    headerFontSize: clamp(e.headerFontSize, FONT_RANGES.headerFontSize.min, FONT_RANGES.headerFontSize.max, FONT_RANGES.headerFontSize.default), // :253-258
    tableFontSize: clamp(e.tableFontSize, FONT_RANGES.tableFontSize.min, FONT_RANGES.tableFontSize.max, FONT_RANGES.tableFontSize.default), // :259-264
    amountFontSize: clamp(e.amountFontSize, FONT_RANGES.amountFontSize.min, FONT_RANGES.amountFontSize.max, FONT_RANGES.amountFontSize.default), // :265-270
    metaFontSize: clamp(e.metaFontSize, FONT_RANGES.metaFontSize.min, FONT_RANGES.metaFontSize.max, FONT_RANGES.metaFontSize.default), // :271-276
    declarationFontSize: clamp(e.declarationFontSize, FONT_RANGES.declarationFontSize.min, FONT_RANGES.declarationFontSize.max, FONT_RANGES.declarationFontSize.default), // :277-282
    orderDateFontSize: clamp(e.orderDateFontSize, FONT_RANGES.orderDateFontSize.min, FONT_RANGES.orderDateFontSize.max, FONT_RANGES.orderDateFontSize.default), // :283-288
  }
}

/**
 * 纸张 / 份数清洗（旧版 `X` :290-306）：
 *
 * ```js
 * const o = K(e?.copies,   1,  99, s.copies);
 * const a = K(e?.widthMm,  50, 500, s.widthMm);
 * const n = K(e?.heightMm, 50, 500, s.heightMm);
 * const u = t(a >= n ? 385 : 659);   // 385→"landscape", 659→"portrait"
 * orientation: (e?.orientation === "landscape" || e?.orientation === "portrait") ? e.orientation : u
 * ```
 *
 * ⚠️ **orientation 的优先级（逆向报告 §9.4 实跑更正）**：已存的合法字面量**直接保留，哪怕它和
 * width/height 自相矛盾**（`{100,200,"landscape"}` → `"landscape"`）—— 反推只是缺失/非法时的兜底。
 * 大小写敏感（`"LANDSCAPE"` 算非法 → 反推）。
 * 反推时 `widthMm >= heightMm` **相等走 landscape**（`a >= n` 为真）。
 *
 * 返回值**只有这 4 个字段**，多余字段丢弃。
 */
export function sanitizePaper(raw: unknown): PaperSettings {
  const e = asRecord(raw)
  const copies = clamp(e.copies, 1, 99, DEFAULT_PAPER.copies) // :292
  const widthMm = clamp(e.widthMm, 50, 500, DEFAULT_PAPER.widthMm) // :293
  const heightMm = clamp(e.heightMm, 50, 500, DEFAULT_PAPER.heightMm) // :294
  const inferred: Orientation = widthMm >= heightMm ? 'landscape' : 'portrait' // :295
  const orientation: Orientation =
    e.orientation === 'landscape' || e.orientation === 'portrait'
      ? (e.orientation as Orientation)
      : inferred // :300-304
  return { copies, widthMm, heightMm, orientation }
}

/** 9 个布尔显隐字段（旧版 `te` :328-338 的局部数组 `l`）。 */
const VISIBILITY_BOOLEAN_KEYS = [
  'showOrderNo',
  'showDate',
  'showQrcode',
  'showClient',
  'showTel',
  'showAddress',
  'showProductionDays',
  'showAmounts',
  'showDeclaration',
] as const satisfies readonly (keyof VisibilitySettings)[]

/** 3 个位置字段（旧版 `te` :340）。 */
const VISIBILITY_POSITION_KEYS = [
  'orderNoPosition',
  'datePosition',
  'qrcodePosition',
] as const satisfies readonly (keyof VisibilitySettings)[]

/**
 * 元素显隐归一化（旧版 `te` :324-349）：
 *
 * ```js
 * const o = { ...g };                                   // 从默认起
 * for (const a of [9 个 showXxx]) typeof e[a]==="boolean" && (o[a]=e[a]);
 * for (const a of ["orderNoPosition","datePosition","qrcodePosition"])
 *                                 R.includes(e[a]) && (o[a]=e[a]);   // R = ["left","right"] :308
 * if (Array.isArray(e.metaOrder)) { … }
 * ```
 *
 * - 布尔**只认 `typeof === "boolean"`**：`0` / `1` / `"true"` 一律忽略，走默认 `true`。
 * - position 只认 `"left"` / `"right"`，其它值忽略走默认（三个默认值不一致，照抄）。
 * - 非对象（含 `undefined` / 字符串 / 数字）→ 整块跳过，全默认。
 * - `metaOrder`：先过滤出合法项（**保持已存顺序**），再把 `META_KEYS` 中缺席的按 `META_KEYS`
 *   顺序追加到尾部；非数组（含 `undefined`）→ 走默认。
 *
 * ⚠️ **有意偏离旧版**：这里补了一道 `Set` 去重。旧版 `filter(x => F.includes(x))` 不去重，
 * 存了 `["client","client"]` 会产出长度 5 的数组，渲染侧 :553 会把「客户」渲染两次（逆向报告
 * §3.2 / §9.2 已实跑证实，属旧版 bug）。只在脏数据下触发，正常数据的结果与旧版逐字一致。
 */
export function sanitizeVisibility(raw: unknown): VisibilitySettings {
  const out: VisibilitySettings = {
    ...DEFAULT_VISIBILITY,
    metaOrder: [...DEFAULT_VISIBILITY.metaOrder], // 断开与默认常量的引用共享
  } // :326
  if (raw && typeof raw === 'object') {
    const e = raw as Record<string, unknown>
    for (const k of VISIBILITY_BOOLEAN_KEYS) {
      const v = e[k]
      if (typeof v === 'boolean') out[k] = v // :339
    }
    for (const k of VISIBILITY_POSITION_KEYS) {
      const v = e[k]
      if (POSITIONS.includes(v as Position)) out[k] = v as Position // :340-341
    }
    if (Array.isArray(e.metaOrder)) {
      const kept = e.metaOrder.filter((x) => META_KEYS.includes(x as MetaKey)) as MetaKey[] // :343
      const missing = META_KEYS.filter((x) => !kept.includes(x)) // :344
      out.metaOrder = [...new Set([...kept, ...missing])] // :345 —— ⚠️ 此处偏离：旧版无 Set
    }
  }
  return out
}

/**
 * 品牌设置清洗（`onMounted` :1060-1075 里的手工校验）：
 *
 * ```js
 * i = { enabled: !!l.enabled, name: "string" == typeof l.name ? l.name : "" };
 * ```
 *
 * - `enabled` 用 `!!` 强转（**不是** `te` 那样只认布尔）—— `"false"` / `1` / `[]` 等按 JS 真值表来。
 * - `name` 非字符串则 `""`，**不 trim**（trim 只发生在保存时，见 `storage.saveDialogSettings`）。
 *
 * 与旧版唯一无需保留的差异：旧版把 `JSON.parse("null")` 的结果直接取属性会抛错 → 走 catch 用默认值；
 * 这里返回 `{enabled:false,name:""}`，与默认值 `DEFAULT_BRAND` 相等，结果一致。
 */
export function sanitizeBrand(raw: unknown): BrandSettings {
  const e = asRecord(raw)
  return {
    enabled: !!e.enabled, // :1067
    name: typeof e.name === 'string' ? e.name : '', // :1068
  }
}

/**
 * 元素几何配置清洗（旧版 `D` :138-176 里的内联归一化器 :143-171）：
 *
 * ```js
 * const o = L();                                        // 先拿全零底
 * if (e && typeof e === "object")
 *   for (const l of x)                                  // 只遍历 x 的 10 个 key
 *     if (e[l] && typeof e[l] === "object") { … }
 * ```
 *
 * - **只遍历 `ELEMENT_KEYS`**：存盘里多出来的非法元素名被静默丢弃；缺的 key 补零值。
 *   结果对象的 key 数**恒为 10**。
 * - `offsetXMm` / `offsetYMm`：`isFinite(Number(x))` 才接受，**无上下限**（可负）。
 *   数字字符串会被接受（`"-3.5"` → `-3.5`），非数字串 → `0`。
 * - `fontSize` / `widthMm`：必须有限**且 ≥0** 才接受，否则 `0`。**读盘只卡下界，没有上界** ——
 *   存了 `fontSize:9999` 就原样保留（UI 上限 60 / 300 形同虚设，逆向报告 §9.6 实证）。
 * - `visible`：`typeof x !== "boolean" || x` —— 非布尔一律 `true`。
 * - 子项为 `null` / 非对象 → 该项保持零值，不抛错。
 * - 整体 `try/catch`，**任何异常 → 全部零值**（旧版是外层 catch 落到 `L()`，不是部分保留）。
 */
export function sanitizeElementConfigs(raw: unknown): ElementConfigs {
  try {
    const out = defaultElementConfigs() // :145
    if (raw && typeof raw === 'object') {
      const e = raw as Record<string, unknown>
      for (const key of ELEMENT_KEYS) {
        const v = e[key] // :147-148
        if (v && typeof v === 'object') {
          const a = v as Record<string, unknown>
          const offsetXMm = Number(a.offsetXMm) // :151-153
          const offsetYMm = Number(a.offsetYMm) // :154-156
          const fontSize = Number(a.fontSize) // :157-161
          const widthMm = Number(a.widthMm) // :162-166
          out[key] = {
            offsetXMm: Number.isFinite(offsetXMm) ? offsetXMm : 0,
            offsetYMm: Number.isFinite(offsetYMm) ? offsetYMm : 0,
            // 旧版比较的是**原始值** `a.fontSize >= 0`；`Number(x) >= 0` 与 `x >= 0`
            // 都走 ToPrimitive(hint number)，对所有非抛错输入等价（`Number.isFinite` 已经先挡掉 NaN）。
            fontSize: Number.isFinite(fontSize) && fontSize >= 0 ? fontSize : 0,
            widthMm: Number.isFinite(widthMm) && widthMm >= 0 ? widthMm : 0,
            visible: typeof a.visible === 'boolean' ? a.visible : true, // :167
          }
        }
      }
    }
    return out
  } catch {
    return defaultElementConfigs() // :173-175
  }
}

/**
 * 10 列列宽清洗（`onMounted` :1077-1089）：
 *
 * ```js
 * const l = JSON.parse(t);
 * Array.isArray(l) && l.length === a.length && (n.value = l.map(e => Math.max(3, Number(e) || 3)));
 * ```
 *
 * `Array.isArray` 且 **`length === 10`** 才接受（长度不符整组丢弃，旧版**没有迁移**），
 * 逐项 `Math.max(3, Number(x) || 3)` —— 注意 `|| 3` 让 `0` / `NaN` 也变成 3，
 * 且**不做小数取整**（拖拽侧才 `Math.round(x*10)/10`，见 :929-935）。
 */
export function sanitizeColumnWidths(raw: unknown): ColumnWidths {
  if (Array.isArray(raw) && raw.length === DEFAULT_COLUMN_WIDTHS.length) {
    return raw.map((x) => Math.max(3, Number(x) || 3)) // :1085
  }
  return [...DEFAULT_COLUMN_WIDTHS] // :1081 / :1087
}

/**
 * 近似相等（旧版 `Q` :307）：`Math.abs(a - b) <= tol`，默认容差 **2mm**。
 * ⚠️ 是 `<=` 不是 `<` —— 差恰好 2 算命中（`Q(100,102) === true`，§9.5 实证）。
 */
export function approx(a: number, b: number, tol = 2): boolean {
  return Math.abs(a - b) <= tol
}

/**
 * 按尺寸反查纸型预设 key（旧版 :682-692）：
 *
 * ```js
 * const o = Object.entries(d).find(([, l]) =>
 *   e.orientation === l.orientation && Q(e.widthMm, l.widthMm) && Q(e.heightMm, l.heightMm));
 * return o ? o[0] : "custom";
 * ```
 *
 * 三项全等（orientation 必须**严格相等**，尺寸容差 2mm）才算命中，取**先声明**的那个。
 * 找不到返回字面量 `"custom"`。
 *
 * ⚠️ 这个结果**只用于分页**（喂给可用高度计算），不参与配置、不落盘、不上 UI —— 预设 key 从不持久化。
 */
export function findPaperPresetKey(
  paper: Pick<PaperSettings, 'widthMm' | 'heightMm' | 'orientation'>,
): PaperPresetKey | 'custom' {
  const hit = PAPER_PRESETS.find(
    (p) =>
      paper.orientation === p.settings.orientation &&
      approx(paper.widthMm, p.settings.widthMm) &&
      approx(paper.heightMm, p.settings.heightMm),
  ) // :684-689
  return hit ? hit.key : 'custom' // :690
}
