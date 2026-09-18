// 自定义合格标签 · 字段取值（别名表 + 前缀剥除）—— 逐字移植旧版 `_` 与 `Q` 的前置段。
//
// 施工图 §4.2 的「共同前置」（`QL:529-556`）。★ **这是新版必须对齐的数据契约**（§9）。
//
// ⚠️ 底座 / PS / C 家族**都没有「别名」这个概念**（底座靠 `cellCases` 把列 key 直接映射到
//    一个字段名）—— 本单是「一个 key 依次尝试若干个行字段名」，所以单独一层。

import type { LabelFieldKey, LabelRow } from './types'

/**
 * 字段 key → 行字段别名表（旧版 `_`，`QL:510-522`，**11 组，逐字**）。
 *
 * ★ 取值规则：**依次尝试**候选名，命中**第一个**「既不是 `undefined` 也不是 `null`」的即返回
 *   （空串 `""` 算命中 —— 见 `readFieldValue`）。
 *
 * ⚠️ 只有 `qrcode` 这一行是**多字母大小写变体**；其余都是「英文 key + 中文 key」两三个候选。
 * ⚠️ **别名表里没有 `storeAddress`** —— 旧版 `lable()` 的行对象**不带**这个键
 *   （§4.2 的注），所以别名表里没有它、也**不需要**加：它命中下面「分支 C」的同名回退
 *   （`FIELD_ALIASES[key] || [key]`），直接读 `row.storeAddress` 即可。
 *   2026-09-18 起 `printPayloads.ts` 的 `lableRow` **已补上这个键**
 *   （取**客户资料地址**），所以「位置」现在既能进「编辑标签」弹窗那一列、也能当版式字段用。
 * ⚠️ `orderID` 的最后一个候选是中文 **`编号`**（不是「订单号」）—— 照抄。
 */
export const FIELD_ALIASES: Record<string, readonly string[]> = {
  qrcode: ['qrcode', 'qrCode', 'QRCode', 'orderQrcode'],
  client: ['client', 'customer', '客户'],
  door: ['door', 'profile', '型材'],
  size: ['size', '尺寸'],
  lockway: ['lockway', 'direction', '开向'],
  color: ['color', '颜色'],
  glass: ['glass', '玻璃'],
  address: ['address', '安装地址', '地址'],
  remark: ['remark', '备注'],
  package: ['package', '包装'],
  orderID: ['orderID', 'orderId', 'orderNo', '编号'],
}

/**
 * 按别名表取值（旧版 `Q` 的内层 IIFE，`QL:534-547`）。
 *
 * 逐字语义：
 * ```js
 * const aliases = FIELD_ALIASES[key] || [key]          // ← 未登记的 key 回落 [key]（分支 C）
 * for (const a of aliases)
 *   if (row?.[a] !== undefined && row?.[a] !== null) return String(row[a])
 * return ""
 * ```
 *
 * ★ **判空用的是 `undefined` / `null` 两个**，**不是**真值判断：
 *   空串 `""` 与数字 `0` **都算命中**并原样返回（`String(0)` → `"0"`）。
 *   这一点很要紧 —— 它与下游 `autoHideEmpty` 的「空值」判断是**两件事**：
 *   命中空串后仍会因 `!n` 被判为空（§4.2 分支 B 的第一行）。
 *
 * @returns 恒为字符串（取不到 → `""`）
 */
export function readFieldValue(row: LabelRow | undefined | null, key: string): string {
  const aliases = FIELD_ALIASES[key] || [key] // 分支 C：未知 key 直接取同名属性
  for (const alias of aliases) {
    const value = row?.[alias]
    if (value !== undefined && value !== null) return String(value)
  }
  return ''
}

/**
 * 剥掉值开头的 `label:` / `label：`（旧版 `Q` 的外层 IIFE，`QL:528-534`）。
 *
 * ★ **全角与半角冒号都剥**，且**半角先试**（旧版数组顺序 `[t + ":", t + "："]`）。
 * ★ 只剥**开头一处**（`startsWith` + `slice`），不剥中间的、不重复剥。
 *
 * 为什么需要它：旧 `lable()` 的行值**已经带前缀**（`型材:80断桥`），
 * 而 `showPrefix:true` 的字段渲染时又要把 `label + ":"` 拼回去 ——
 * 一剥一拼**净效果相同**，但若字段把 `showPrefix` 关掉，剥除就让它变成**无前缀**的值。
 * ⇒ 这个函数是「同一份行数据既能带前缀又能不带前缀地显示」的关键（§9 的表格逐行核过）。
 */
export function stripLabelPrefix(value: string, label: string): string {
  const candidates = [label + ':', label + '：'] // 半角在前（`QL:530`）
  for (const prefix of candidates) {
    if (value.startsWith(prefix)) return value.slice(prefix.length)
  }
  return value
}

/** 全字段 key 的稳定顺序（= 默认表顺序）。供用例与 UI 遍历用。 */
export const FIELD_KEYS: readonly LabelFieldKey[] = [
  'qrcode',
  'orderID',
  'client',
  'door',
  'size',
  'lockway',
  'color',
  'glass',
  'address',
  'remark',
  'package',
]
