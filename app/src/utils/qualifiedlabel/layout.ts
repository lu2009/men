// 自定义合格标签 · 布局编辑器的**纯函数**（旧版 `j` / `q` / `J` / `W` / `O` / `H` / `G` / `P` / `ee` / `te`）。
//
// ⚠️ **本文件是施工图 §10.2 之外的一处收拢**（有意偏离，已在报告里标注）：
//    施工图把 `j`/`ee`/`te`/`W` 划给组件层的 composable（§10.2 C3）。但它们是
//    **「配置数组 → 配置数组」的纯变换**，不含任何 Vue 状态 —— 放在核心层可以
//    离线逐条钉死（`ql-logiccheck.mjs` 的 §3.2/§3.3 用例表），组件层直接 import 即可，
//    也避免「同一段语义在 composable 里再抄一遍」。
//    **不变的是语义**：每个函数都逐字对应旧版一行，行号标在注释里。
//
// ★ 这些函数**全部就地修改传入的字段数组**（旧版就是 `forEach` 就地改 `e.x = …`），
//   返回同一数组引用。传**草稿**（`d.value.fields` / `i.value.fields`），不是生效配置。

import { createDefaultConfig, BATCH_INITIAL_VALUES, BODY_FIELD_KEYS, ORDER_FIELD_KEYS, APPLY_TO_ALL_EXCLUDED_KEYS, LONG_EDGE_BASE } from './defaults'
import type { LabelField, LabelFieldKey, LabelPaper } from './types'

/** 保留一位小数（旧版 `Math.round(v * 10) / 10`，在 `j` 里出现 5 次）。 */
function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * **整体自适应**（旧版 `j`，`QL:459-478`）—— ★ **不是「按当前版式缩放」**。
 *
 * ```js
 * const u = a();                    // ← 基准恒为【默认配置】的 70×90 版式（不是当前字段）
 * const r = t / 70, i = o / 90, c = Math.min(r, i);
 * fields.forEach(field => {
 *   const l = u.fields.find(l => l.key === field.key);
 *   if (!l) return;
 *   field.x     = round(l.x     * r * 10) / 10;   // ← 按宽比，非等比
 *   field.y     = round(l.y     * i * 10) / 10;   // ← 按高比，非等比
 *   field.width = round(l.width * r * 10) / 10;   // ← 按宽比，非等比
 *   if (field.key === 'qrcode') { field.width = round(l.width * c * 10) / 10; field.height = field.width; }
 *   else field.height = l.height;                 // ← 不缩放，直接抄默认
 *   field.fontSize = round(l.fontSize * c * 2) / 2;   // ← 等比 min(r,i)，取到 0.5
 * });
 * ```
 *
 * ★ **它的语义是「把 70×90 的出厂版式按新纸张重铺一遍」** ——
 *   用户之前的所有手工调整**会被覆盖**。UI 提示语
 *   「以 70×90mm 为基准，按比例缩放所有字段位置、宽度、字号及二维码」是准确的。
 *
 * ⚠️ 三处不直观、但都是旧版事实：
 *   1. `x`/`y`/`width` 用的是**各自轴的比值**（`r` 或 `i`），**不是** `min(r,i)`；
 *   2. `height` **完全不缩放**，直接抄默认版式的 `height`（反正它只限制 `y` 的上界）；
 *   3. `fontSize` 用 `Math.round(v * 2) / 2` —— **取到 0.5**，与 `x`/`y`/`width` 的 0.1 精度不同。
 *   4. `qrcode` 的 `width` 被**覆盖两次**：先按 `r`、再按 `c`（后者胜），且 `height = width`。
 *
 * 📌 **`field.height` 不在 `BODY_FIELD_KEYS` 之类任何白名单里** —— 本函数对**全部 11 条**生效
 *   （遍历的是传进来的整个 `fields`），没有排除项。
 *
 * @param fields    就地修改（草稿的 `fields`）
 * @param widthMm   新纸张宽（旧版 `t`）
 * @param heightMm  新纸张高（旧版 `o`）
 */
export function autoFitFields(
  fields: LabelField[],
  widthMm: number,
  heightMm: number,
): LabelField[] {
  const base = createDefaultConfig().fields // 旧版 `a()`，`QL:461`
  const ratioW = widthMm / LONG_EDGE_BASE.widthMm // 旧版 `r`，`QL:462`
  const ratioH = heightMm / LONG_EDGE_BASE.heightMm // 旧版 `i`，`QL:463`
  const ratioMin = Math.min(ratioW, ratioH) // 旧版 `c`，`QL:464`

  for (const field of fields) {
    const def = base.find((f) => f.key === field.key) // `QL:467`
    if (!def) continue // `QL:468` —— 默认表里没有的 key 直接跳过（本单不可达）

    field.x = round1(def.x * ratioW) // `QL:469`
    field.y = round1(def.y * ratioH) // `QL:470`
    field.width = round1(def.width * ratioW) // `QL:471`

    if (field.key === 'qrcode') {
      // `QL:472-474` —— ★ width **再覆盖一次**（这一次按 min 比），height 跟着 width
      field.width = round1(def.width * ratioMin)
      field.height = field.width
    } else {
      field.height = def.height // `QL:475` —— ★ 不缩放
    }

    field.fontSize = Math.round(def.fontSize * ratioMin * 2) / 2 // `QL:476` —— 取到 0.5
  }
  return fields
}

/**
 * **应用到全部**字号（旧版 `ee`，`QL:691-701`）—— ★ **排除 `qrcode` 与 `package`**。
 *
 * ```js
 * const t = d.value.globalFont.fontSize;              // ← 只取 fontSize，不取 fontWeight/fontFamily
 * d.value.fields.forEach(l => {
 *   if (l.key !== 'qrcode' && l.key !== 'package') l.fontSize = t;
 * });
 * ```
 *
 * ★ 这条排除是 CONFIRMED 且**必须照抄**（§2.5 / §10.3 #1）：
 *   无脑「应用到全部字段」会让 `package` 从 10pt 变成 16.5pt，把包装行撑成正文大小。
 *   `qrcode` 被排除是因为它没有字号概念（渲染时根本不读 `fontSize`）。
 *
 * ⚠️ **只写 `fontSize`** —— 不写 `fontWeight`、不写 `fontFamily`
 *   （全组件也**没有任何「应用到全部分粗细」按钮**）。
 * ⚠️ 只在**布局编辑器**出现（`QL:2083`）；设置弹窗的「字体」tab 里没有这个按钮。
 *
 * @param fields   就地修改（草稿的 `fields`）
 * @param fontSize 取 `globalFont.fontSize`（旧版 `QL:693`）
 */
export function applyToAllFontSize(fields: LabelField[], fontSize: number): LabelField[] {
  for (const field of fields) {
    if (!APPLY_TO_ALL_EXCLUDED_KEYS.includes(field.key)) field.fontSize = fontSize
  }
  return fields
}

/**
 * **适应纸张宽度**（旧版 `te`，`QL:701-708`）。
 *
 * ```js
 * const o = Math.max(1, t.widthMm - 2 * t.paddingMm);   // 可用宽
 * d.value.fields.forEach(t => { if (t.key !== 'qrcode') t.width = o; });
 * ```
 *
 * ★ `Math.max(1, …)` 的下限 1 —— 纸宽 20、内边距 20 时可用宽会是 `-20`，被夹到 1。
 * ★ **只排除 `qrcode`**（与 `ee` 排除两个 key **不同**）——
 *   `package` 在这里**会被改宽**（它默认 `width:66`，本来就是正文宽）。
 *
 * @param fields 就地修改（草稿的 `fields`）
 * @param paper  取 `widthMm` 与 `paddingMm` 两个值
 */
export function fitPaperWidth(fields: LabelField[], paper: LabelPaper): LabelField[] {
  const usable = Math.max(1, paper.widthMm - 2 * paper.paddingMm) // `QL:704`
  for (const field of fields) {
    if (field.key !== 'qrcode') field.width = usable // `QL:706` —— ★ 只排除 qrcode
  }
  return fields
}

/** 「快捷批量调整」三个控件的当前值（旧版 refs `S` / `T` / `Y`）。 */
export interface BatchValues {
  fontSize: number
  bodyWidth: number
  orderWidth: number
}

/**
 * **回读**批量调整的当前值（旧版 `W`，`QL:431-437`）。
 *
 * ```js
 * const t = fields.find(f => BODY_FIELD_KEYS.includes(f.key));    // 组内【第一个】命中
 * const o = fields.find(f => ORDER_FIELD_KEYS.includes(f.key));
 * if (t) { S = t.fontSize; T = t.width; }
 * if (o) Y = o.width;
 * ```
 *
 * ★ **取的是组内第一个命中字段的值**（不是平均、不是第一个字段）——
 *   因为 `BODY_FIELD_KEYS` 的顺序是 `["door","size",…]`，所以实际取到的是
 *   **`door` 的字号与宽度**（若 `door` 存在）。`ORDER_FIELD_KEYS` 同理取 **`client`**。
 *
 * ⚠️ **调用时机只有三处**（`openLayoutEditor` / `le` / `J`）⇒ 用户逐个改字段后
 *   这三个数**会变陈旧**（旧版行为，照抄）。返回初值兜底，避免拿不到命中字段时是 `undefined`。
 */
export function readBatchValues(fields: LabelField[]): BatchValues {
  const body = fields.find((f) => BODY_FIELD_KEYS.includes(f.key)) // `QL:433`
  const order = fields.find((f) => ORDER_FIELD_KEYS.includes(f.key)) // `QL:434`
  return {
    fontSize: body ? body.fontSize : BATCH_INITIAL_VALUES.fontSize, // `QL:435`
    bodyWidth: body ? body.width : BATCH_INITIAL_VALUES.bodyWidth,
    orderWidth: order ? order.width : BATCH_INITIAL_VALUES.orderWidth, // `QL:436`
  }
}

/** 批量改**正文字号**（旧版 `O`，`QL:438-444`）。作用于 `BODY_FIELD_KEYS` 7 条。 */
export function applyBatchFontSize(fields: LabelField[], fontSize: number): LabelField[] {
  for (const field of fields) {
    if (BODY_FIELD_KEYS.includes(field.key)) field.fontSize = fontSize
  }
  return fields
}

/** 批量改**正文行宽**（旧版 `H`，`QL:445-451`）。作用于 `BODY_FIELD_KEYS` 7 条。 */
export function applyBatchBodyWidth(fields: LabelField[], width: number): LabelField[] {
  for (const field of fields) {
    if (BODY_FIELD_KEYS.includes(field.key)) field.width = width
  }
  return fields
}

/** 批量改**客户/单号宽**（旧版 `G`，`QL:452-458`）。作用于 `ORDER_FIELD_KEYS` 2 条（`client`/`orderID`）。 */
export function applyBatchOrderWidth(fields: LabelField[], width: number): LabelField[] {
  for (const field of fields) {
    if (ORDER_FIELD_KEYS.includes(field.key)) field.width = width
  }
  return fields
}

/**
 * **常用尺寸按钮**（旧版 `P`，`QL:422-425`）—— ★ **只写宽高两个数，不重排字段**。
 *
 * ```js
 * i.value.paper.widthMm = e;  i.value.paper.heightMm = t;
 * ```
 *
 * ⚠️ 它**不调 `autoFit`**（“整体自适应”是另一个按钮 `q`/`J`）——
 *   所以点了「60×40」之后字段还停在旧坐标上，要用户再点一次「整体自适应」。
 *   这是旧版行为，**照抄**。
 *
 * @param paper 就地修改（草稿的 `paper`）
 */
export function applyPaperPreset(paper: LabelPaper, widthMm: number, heightMm: number): LabelPaper {
  paper.widthMm = widthMm // `QL:424`
  paper.heightMm = heightMm
  return paper
}

/** 字段 key 在不在某个组里（UI 层的 `v-if` 判断，避免各处重复 `includes`）。 */
export function isBodyField(key: LabelFieldKey): boolean {
  return BODY_FIELD_KEYS.includes(key)
}

/** 见 `isBodyField`。 */
export function isOrderField(key: LabelFieldKey): boolean {
  return ORDER_FIELD_KEYS.includes(key)
}
