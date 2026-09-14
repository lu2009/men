// 计算引擎：复刻旧版「吊」页的公式求值逻辑。
//
// 变量语义：
//   w  门洞宽（钻石型时为「左宽」）
//   h  门洞高
//   h1 亮窗总高（钻石型时为「右宽」）
//   t  墙厚（多义：钻石型=斜长，luiyifour=中扇宽）
//   j  吊脚
//   s  母门宽
//   v  缝隙/搭接量（每部件独立）
//   result 该部件的下料长度（计算结果）
//
// 正向公式 formula   ：尺寸 + v → 下料长度
// 逆向公式 calculate ：下料长度 result → 反推 v
// 跨部件引用 X.result ：引用名为 X 的部件的结果

export interface Dimensions {
  w: number
  h: number
  h1: number
  t: number
  j: number
  s: number
}

interface PartDef {
  state: boolean
  quantity: number
  materialName: string
  track: string
  formula: string
  result: number
  v: number
  title: string
  calculate: string
  color: string
}

export type PartsMap = Record<string, PartDef>

/** 逆向计算中引用行缺少计算结果时的哨兵（复刻旧版 1e5）。 */
export const NO_EFFECT = 1e5

const toNum = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 负数加括号，避免 `1--2` 之类的非法表达式。 */
const wrap = (n: number): string => (n < 0 ? `(${n})` : String(n))

/** 安全求值：表达式已经过变量替换，仅含数字与四则运算。 */
function evalExpr(expr: string): number {
  try {
    // 与旧版 eval 语义一致；变量替换后不含任意代码。
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${expr});`)()
  } catch {
    return 0
  }
}

/** 替换跨部件引用 X.result 与基础尺寸变量。 */
function substitute(
  expr: string,
  dims: Dimensions,
  resolveRef: (name: string) => string,
): string {
  let s = expr.replace(/^=/, '')
  s = s.replace(/([^.\s]+)\.result/g, (_m, name: string) => resolveRef(name))
  return s
    .replace(/\bw\b/g, String(toNum(dims.w)))
    .replace(/\bh\b/g, String(toNum(dims.h)))
    .replace(/\bh1\b/g, String(toNum(dims.h1)))
    .replace(/\bt\b/g, String(toNum(dims.t)))
    .replace(/\bj\b/g, String(toNum(dims.j)))
    .replace(/\bs\b/g, String(toNum(dims.s)))
}

/** 正向求值：formula → 下料长度。resolveRef 返回引用部件的计算结果字符串（缺省 "0"）。 */
export function evalForward(
  formula: string,
  dims: Dimensions,
  resolveRef: (name: string) => string,
  v: number,
  result: number,
): number {
  const s = substitute(formula, dims, resolveRef)
    .replace(/\bv\b/g, wrap(toNum(v)))
    .replace(/\bresult\b/g, wrap(toNum(result)))
  return evalExpr(s)
}

/** 逆向求值：calculate → v。引用行缺结果时返回 NO_EFFECT。 */
export function evalReverse(
  calculate: string,
  dims: Dimensions,
  resolveRef: (name: string) => string,
  result: number,
): number {
  const s = substitute(calculate, dims, resolveRef).replace(
    /\bresult\b/g,
    wrap(toNum(result)),
  )
  if (s.includes('noEffect')) return NO_EFFECT
  return evalExpr(s)
}

/** 逆向反推前的引用校验（复刻旧版警告文案）。 */
export interface ReverseCheck {
  ok: boolean
  message?: string
}

export function checkReverseRefs(parts: PartsMap, name: string): ReverseCheck {
  const part = parts[name]
  if (!part?.calculate) return { ok: true }
  const refs = Array.from(part.calculate.matchAll(/([^.\s]+)\.result/g), (m) => m[1])
  for (const ref of refs) {
    const p = parts[ref]
    if (!p) return { ok: false, message: `找不到名称为 "${ref}" 的行` }
    if (!p.result) return { ok: false, message: `请先填写 "${ref}" 的计算结果` }
  }
  return { ok: true }
}

/** 逆向反推：由用户输入的「计算结果」反推该部件的 v。 */
export function computeV(parts: PartsMap, dims: Dimensions, name: string, result: number): number {
  const part = parts[name]
  if (!part?.calculate) return 0
  return evalReverse(
    part.calculate,
    dims,
    (ref) => {
      const p = parts[ref]
      if (!p || !p.result) return 'noEffect'
      return String(p.result)
    },
    result,
  )
}

/**
 * 正向联动：尺寸变化时按部件顺序重算每个部件的下料结果。
 * 跨部件引用取「已算出的前序结果」，与旧版按表格顺序遍历一致。
 * 返回 name → 结果 的映射（供展示与后续引用）。
 */
export function recalcForward(parts: PartsMap, dims: Dimensions): Record<string, number> {
  const computed: Record<string, number> = {}
  for (const [name, part] of Object.entries(parts)) {
    if (!name || !part?.formula) continue
    const r = evalForward(
      part.formula,
      dims,
      (ref) => (computed[ref] !== undefined ? String(computed[ref]) : '0'),
      toNum(part.v),
      toNum(part.result),
    )
    computed[name] = r
  }
  return computed
}
