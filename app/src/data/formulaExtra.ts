// 公式附加配置（extra JSONB）类型与常量，复刻旧版「吊」页保存时写入的附加字段。
// 与旧版 _0x5c69df 保存结构一一对应。

/** 单扇最小平方数（简单门型：平开/子母/双开/钻石）。存于 square 字段，为数字。 */
export const SIMPLE_SQUARE_TYPES = ['ping', 'parentsubsidiary', 'double', 'diamond']

/** 移门最低方数设置的类型键（20 种）。存于 square 字段，为 { 类型: "最小-最大" } 对象。 */
export const MIN_SQUARE_TYPES = [
  '2轨2扇', '2轨3扇', '2轨4扇', '3轨3扇', '单轨单扇', '单轨2扇', '3轨4扇2纱', '3轨2扇1纱',
  '3轨6扇', '4轨4扇', '5轨5扇', '6轨6扇', '7轨7扇', '一固一活', '双活',
  '折叠2扇', '折叠3扇', '折叠4扇', '折叠5扇', '折叠6扇',
] as const

/** extra JSONB 的完整结构（所有字段可选，缺省即未设置）。 */
export interface FormulaExtra {
  resetSize?: { width: number; height: number }
  widthIncrement?: { SheetIncrement: number; TrackIncrement: number }
  swingWall?: { SingleWall: number; DoubleWall: number; UpWall: number }
  TaoDong?: {
    SingleDong: { 宽减: number; 高减: number }
    DubleDong: { 宽减: number; 高减: number }
  }
  hardware?: string
  hinge?: Record<string, { 上下方减尺: number; 光企减尺寸: number }>
  /**
   * 部件**声明顺序**（`Object.keys(parts)` 的保存时快照）。
   *
   * 为什么需要它：`parts` 是 JSONB 对象，**PostgreSQL 会按「长度+字节」重排对象键**，
   * 而 `serde_json::Value::Object` 默认是 `BTreeMap`（再按字节序排一次）—— 顺序被丢两次。
   * 但原版各打印列（移门外框、全部 windows 列）**直接按 `Object.entries(parts)` 的声明序输出**，
   * 且 `applyWidthIncrement` 的状态位 `a` 依赖「{扇数}上下方」是否先出现 —— **顺序会改数值**。
   *
   * 修法：顺序存成**数组**（数组在 JSONB 与 serde_json 里**都保序**），渲染时按它排。
   * 详见 `docs/2026-09-15-parts-order-fidelity.md`。
   */
  partOrder?: string[]
}

/** 移门最低方数设置：square 字段的复杂门型形态。 */
export type MinSquareMap = Record<string, string>

function numOrZero(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 将后端返回的 extra JSON 归一化为安全对象。 */
export function normalizeExtra(raw: unknown): FormulaExtra {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as FormulaExtra
  return {}
}

/** 将后端返回的 square 字段归一化：简单门型返回数字，复杂门型返回 {类型:最小-最大}。 */
export function normalizeSquare(raw: string, formulaType: string): number | MinSquareMap {
  if (SIMPLE_SQUARE_TYPES.includes(formulaType)) return numOrZero(raw)
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as MinSquareMap
  } catch {
    // 非 JSON，视为未设置
  }
  return {}
}

/** 将 square 值序列化为后端存储的字符串：数字直接转字符串，对象 JSON 序列化。 */
export function serializeSquare(value: number | MinSquareMap): string {
  if (typeof value === 'number') return String(value)
  const entries = Object.entries(value).filter(([, v]) => v && String(v).trim() !== '')
  if (!entries.length) return '0'
  return JSON.stringify(Object.fromEntries(entries))
}
