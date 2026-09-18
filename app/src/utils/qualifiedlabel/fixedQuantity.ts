// 自定义合格标签 · 固定张数（§5.2，**本单独有**：底座 / PS / C 家族都没有这个概念）。
//
// 一条链上三个不同位置的东西，放在一起才看得清：
//   1. **组件侧**（`QL:231-234` / `QL:401-416` / `QL:927-930`）：两组 ref（生效 `C`/`z`、
//      设置草稿 `x`/`B`）+ `getFixedQuantitySetting()`；
//   2. **Home 侧**（`HOME:8279-8294`，`H@≈355640` 的 `Cr`）：把行集**循环取模补齐**到 N 条；
//   3. **两个裸串 localStorage 键**（`QL:406-415` / `QL:893-897`）。
//
// ★ **它是「张数」不是「页数」**：`Cr` 只把**数组长度**改成 N（循环取模），
//   不做任何截断语义上的分页，也不与 `autoHideEmpty` 交互（后者只影响单张里有啥字段）。
//
// ★ **三个入口都一致生效**（§5.2 末）：`br`/`Dr`/`Ar` 三个 handler 都是
//   `Cc = Cr(zc)` 之后才 `buildQualifiedLabelHtml(Cc)` —— 新版对应物是
//   「组件层在 build 之前先调一次 `padToFixedQuantity`」。

import { loadRawString, saveRawString } from '../docsheet/storage'
import { COPY_RANGE } from './defaults'
import { QL_STORAGE_KEYS } from './profile'
import type { FixedQuantitySetting, LabelRow } from './types'

/**
 * 「固定标签数」数量归一化（旧版 `L`，`QL:375-379`）。
 *
 * ```js
 * const o = Math.round(Number(e))
 * return Number.isFinite(o) ? Math.max(1, Math.min(99, o)) : 1
 * ```
 *
 * ★ 非有限（`NaN` / `±Infinity` / 非数字串）→ **回 1**（不是回落「默认值」，本函数没有默认值概念）；
 *   `Math.round` 在 clamp **之前** ⇒ `0.4` → `0` → clamp → 1；`98.6` → `99`。
 * ⚠️ `getFixedQuantitySetting`（`QL:929`，本文件 `createFixedQuantitySetting`）与
 *   `k` 的 IIFE（`QL:410`）**都会再调一次**，两次 clamp 幂等（§2.6 末的 ⚠️），照抄。
 */
export function normalizeFixedQuantity(value: unknown): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.max(1, Math.min(99, n)) : 1
}

/**
 * 把行集**循环取模补齐**到固定张数（旧版 `Cr`，`HOME:8280`，`H@≈355640`）。
 *
 * ```js
 * const a = Array.isArray(e) ? e : [];
 * const n = fr.value?.getFixedQuantitySetting?.();
 * if (!n?.enabled || a.length === 0) return a;          // 关闭 或 空 → 原样
 * const u = Math.max(1, Math.min(99, Math.round(Number(n.value) || 1)));
 * return Array.from({ length: u }, (_, t) => a[t % a.length]);
 * ```
 *
 * ★ **两条早退**：开关关着、**或行集为空**（空集取模会得到 `undefined`，所以必须挡住）。
 * ★ **不截断**：N 比行数少时也只是「取前 N 条」（`t % a.length === t`），
 *   而 N 比行数多时是**从头再来一遍**，不是复制最后一条。
 * ★ `Number(n.value) || 1` —— 与 `normalizeFixedQuantity` 里的 `Math.round(Number(v))`
 *   写法不同（多了 `|| 1`），但 `0`/`NaN` 两条路径的结果都是 1，**产物一致**，故这里直接复用。
 *
 * ⚠️ **两条早退路径返回的是「同一个数组引用」**（旧版 `return a`）而补齐路径返回**新数组**
 *   （`Array.from`）。新版照抄这个引用语义（下游只读，不依赖它，但没必要制造差别）。
 *   元素**不是深拷贝** —— 补齐只是重复引用同一批行对象。
 *
 * @param rows    行集（新版是 `printPayloads.labelRows('lable')` 的产物）
 * @param setting `getFixedQuantitySetting()` 的返回值；`undefined` → 原样返回
 */
export function padToFixedQuantity(
  rows: LabelRow[] | undefined | null,
  setting: FixedQuantitySetting | undefined | null,
): LabelRow[] {
  const list = Array.isArray(rows) ? rows : []
  if (!setting?.enabled || list.length === 0) return list
  const count = normalizeFixedQuantity(setting.value)
  return Array.from({ length: count }, (_, i) => list[i % list.length])
}

/**
 * 组装暴露给宿主的设置对象（旧版 `getFixedQuantitySetting`，`QL:927-930`）。
 *
 * ★ 返回的 `value` **已经过 `normalizeFixedQuantity`**（= 旧版 `L(z.value)`），
 *   所以宿主拿到的永远是 1–99 的整数，不需要自己 clamp（旧版 Home 的 `Cr` 仍 clamp 一次，
 *   两次幂等）。
 */
export function createFixedQuantitySetting(enabled: boolean, value: unknown): FixedQuantitySetting {
  return { enabled, value: normalizeFixedQuantity(value) }
}

/**
 * 读两个裸串键（旧版 `onMounted` 第三段，`QL:890-898`）。
 *
 * ```js
 * C = "1" === getItem(Pa)
 * z = L(getItem(Ia) || 1)
 * // catch → C=false, z=1
 * ```
 *
 * ★ 开关判的是**严格 `=== "1"`**（`"true"`/`"0"`/缺失 都是 `false`）；
 *   数量先 `|| 1` 再过 `L`（所以存 `"0"` → `"0"` 是**真值串** → `Number("0")=0` → `round`→0 → clamp→1）。
 *
 * ⚠️ 旧版**两行在同一个 `try` 里** ⇒ 任一行抛错则**两个都**回落默认；
 *    新版 `loadRawString` 各自吞掉异常，行为差别只在「localStorage 抛错」这条路径上，
 *    而那种情况下旧版两行都会抛（同一 API），**产物相同**。
 */
export function loadFixedQuantitySetting(): FixedQuantitySetting {
  const enabled = loadRawString(QL_STORAGE_KEYS.fixedQuantityEnabled, '') === '1' // `QL:893`
  const value = normalizeFixedQuantity(loadRawString(QL_STORAGE_KEYS.fixedQuantityValue, '') || 1) // `QL:894`
  return { enabled, value }
}

/**
 * 写两个裸串键（旧版 `k` 里的内联 IIFE，`QL:408-415`）。
 *
 * ```js
 * z.value = L(z.value);                                  // ← 写之前**再 clamp 一次**
 * setItem(Pa, C.value ? "1" : "0")                       // ← 存 "1"/"0"，不是 JSON 布尔
 * setItem(Ia, String(z.value))                           // ← 存数字串
 * ```
 *
 * ★ **先 clamp 再写**，且把 clamp 后的值**返回**给调用方回写自己的状态
 *   （旧版是就地改 `z.value`；新版不改传入的 ref，改为返回归一化结果）。
 *
 * @returns 归一化后的设置（调用方应把它当作新的生效值）
 */
export function saveFixedQuantitySetting(enabled: boolean, value: unknown): FixedQuantitySetting {
  const normalized = normalizeFixedQuantity(value)
  saveRawString(QL_STORAGE_KEYS.fixedQuantityEnabled, enabled ? '1' : '0') // `QL:412`
  saveRawString(QL_STORAGE_KEYS.fixedQuantityValue, String(normalized)) // `QL:413`
  return { enabled, value: normalized }
}

/**
 * 固定张数的范围（`COPY_RANGE` 的再导出，UI 用；`QL:1886` 的 `el-input-number` 是 1–99 step 1）。
 *
 * ⚠️ **与 `config.print.copies` 不是一回事**，虽然范围相同：`copies` 只进 `printSilent`
 *   （Electron 静默打印的份数，新版不做），`固定标签数` 改的是**行集长度**。
 *   本模块**完全不读** `config`（故没有 `config` 参数）。
 */
export { COPY_RANGE as FIXED_QUANTITY_RANGE }
