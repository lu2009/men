// 打印数据计算：玻璃张数（calculateGlass）+ 标签数量（lable）。
// 复刻旧版 Hui 页逻辑，公式见 docs/2026-08-23-hui-recon.md §2/§3。
//
// 租户配置 ping_tabs/diao_tabs 当前使用旧系统「昊艺门窗」真实值兜底；
// 接入租户配置表后应按 tenant 读取。

export interface TabsConfig {
  sheets: number
  add: number
  add_2: number
}

/** 昊艺门窗真实配置：ping_tabs={sheets:1,add:0,add_2:0} */
export const DEFAULT_PING_TABS: TabsConfig = { sheets: 1, add: 0, add_2: 0 }
/** 昊艺门窗真实配置：diao_tabs={sheets:1,add:1,add_2:0} */
export const DEFAULT_DIAO_TABS: TabsConfig = { sheets: 1, add: 1, add_2: 0 }

/** 扇数字符串 → 扇数 N（含「纱」追加）。 */
export function fansToCount(fans: string): number {
  if (!fans) return 1
  if (fans === '单轨单扇') return 1
  if (fans === '一固一活' || fans === '双活') return 2
  const shan = fans.match(/(\d+)扇/)?.[1]
  const sha = fans.match(/(\d+)纱/)?.[1]
  return (shan ? Number(shan) : 0) + (sha ? Number(sha) : 0) || 1
}

export interface GlassCountInput {
  /** 玻璃部件名（含「单玻」关键字按双玻计） */
  partName: string
  /** 单樘玻璃张数（算料玻璃部件的 quantity） */
  partQuantity: number
  /** 底玻，「无」=单玻 */
  bottomGlass: string
  /** 面玻，「无」=单玻 */
  faceGlass: string
  /** 公式类型（diamond=钻石型 / parentSubsidiary=母子） */
  formulaType: string
  /** 订单行数量（樘数） */
  quantity: number
}

/**
 * 单玻/双玻判定：底玻/面玻恰一为「无」即单玻；名称含「单玻」按双玻计。
 */
function isDoubleGlass(bottomGlass: string, faceGlass: string, partName = ''): boolean {
  const b = bottomGlass || '无'
  const f = faceGlass || '无'
  return (
    (b !== '无' || f === '无' || partName.includes('单玻')) &&
    (f !== '无' || b === '无' || partName.includes('单玻'))
  )
}

/**
 * 玻璃张数计算（calculateGlass 核心）。
 * 钻石型 → 3×数量；母子 → 4×数量(双玻)/2×数量(单玻)；其余 → partQuantity×数量 或 半量。
 */
export function calculateGlassCount(g: GlassCountInput): number {
  const full = isDoubleGlass(g.bottomGlass, g.faceGlass, g.partName)
  const ft = g.formulaType.toLowerCase()
  if (ft === 'diamond') return 3 * g.quantity
  if (ft === 'parentsubsidiary') return (full ? 4 : 2) * g.quantity
  return (full ? g.partQuantity : g.partQuantity / 2) * g.quantity
}

/** 算料玻璃部件（供尺寸映射用）：key/materialName/quantity/result。 */
export interface GlassPartInput {
  /** 公式部件 key（如「2轨2扇玻璃宽」），同名玻璃（不同轨）据此区分。 */
  key?: string
  materialName: string
  quantity: number
  result: number
}

/** 一片玻璃：名称、宽、高、厚度、张数。 */
export interface GlassPiece {
  /** 部件名（如「母门玻璃」「上亮玻璃」「玻璃」）。 */
  name: string
  width: number
  height: number
  thickness: string
  count: number
}

export interface GlassPiecesOptions {
  bottomGlass: string
  faceGlass: string
  glassThickness: string
  quantity: number
}

/** 「门玻」→「门玻璃」，「左固玻」→「左固玻璃」。 */
function glassDisplayName(prefix: string): string {
  return prefix.endsWith('玻') ? `${prefix}璃` : prefix
}

/**
 * 玻璃部件 → 尺寸映射（补全玻璃合片单）。
 *
 * 从算料部件里识别玻璃部件：materialName 含「玻」且以「宽/高」结尾
 * （排除「固玻上下方」「门玻光企」等非玻璃件），按 key 前缀配对「宽」「高」成一片玻璃
 * （同名「玻璃宽」在 2轨/3轨 等不同轨道下 key 前缀不同，据此区分）。
 * 宽/高沿用算料 result（不重算），张数按单/双玻计算：
 *   双玻 → partQuantity × 数量；单玻 → partQuantity / 2 × 数量。
 * 钻石型/子母门天然由多片玻璃拼出总张数（各片 partQuantity×数量 累加），无需特殊公式。
 */
export function glassPiecesOf(
  parts: GlassPartInput[],
  opts: GlassPiecesOptions,
): GlassPiece[] {
  const bottom = opts.bottomGlass || '无'
  const face = opts.faceGlass || '无'
  if (bottom === '无' && face === '无') return [] // 无玻璃

  const widthByPrefix = new Map<string, { width: number; qty: number; name: string }>()
  const heightByPrefix = new Map<string, number>()
  for (const p of parts) {
    const key = p?.key || p?.materialName || ''
    if (!key.includes('玻')) continue
    // 配对用部件 key（区分「玻璃宽」在 2轨/3轨 等不同轨道下的同名件）；
    // 展示名用 materialName（更简洁，如「上亮玻璃」）。
    const displayRaw = p?.materialName || key
    const display = displayRaw.endsWith('宽') || displayRaw.endsWith('高')
      ? displayRaw.slice(0, -1)
      : displayRaw
    if (key.endsWith('宽')) {
      widthByPrefix.set(key.slice(0, -1), {
        width: p.result || 0,
        qty: p.quantity || 0,
        name: display,
      })
    } else if (key.endsWith('高')) {
      heightByPrefix.set(key.slice(0, -1), p.result || 0)
    }
  }

  const pieces: GlassPiece[] = []
  for (const [prefix, w] of widthByPrefix) {
    const height = heightByPrefix.get(prefix)
    if (height === undefined) continue
    const full = isDoubleGlass(bottom, face, prefix)
    const count = (full ? w.qty : w.qty / 2) * (opts.quantity || 1)
    pieces.push({
      name: glassDisplayName(w.name),
      width: w.width,
      height,
      thickness: opts.glassThickness,
      count: Math.round(count),
    })
  }
  return pieces
}

export interface LabelQuantityInput {
  lineType: 'ping' | 'diao'
  /** 扇数字符串（diao 用于提取扇数 N） */
  fans: string
  quantity: number
  lightWindowHeight: number
  wallThickness: number
  casingPrice: number
  profile: string
  pingTabs?: TabsConfig
  diaoTabs?: TabsConfig
  /** 工厂（租户名），用于特判 */
  registrant?: string
}

/** 标签数量计算（lable）。 */
export function labelQuantity(input: LabelQuantityInput): number {
  const ping = input.pingTabs ?? DEFAULT_PING_TABS
  const diao = input.diaoTabs ?? DEFAULT_DIAO_TABS
  const qty = input.quantity
  let t: number

  if (input.lineType === 'ping') {
    t = qty * ping.sheets
    if (input.lightWindowHeight > 0) t += ping.add
    if (input.wallThickness > 0) t += ping.add_2
    if (input.profile.includes('钻石')) t = 4 * qty
  } else {
    const n = fansToCount(input.fans)
    t = qty * (n * diao.sheets + 1)
    if (input.lightWindowHeight > 0) t += diao.add
    if (input.casingPrice > 0) t += diao.add_2

    const r = input.registrant ?? ''
    // 工厂特判
    if (['名甸门业', '旺达名门', '名扬门业', '临泉县品匠移门'].includes(r)) t -= 1
    if (r === '宏叶芯诚') t += 3
    if (r === '美居门业有限公司') t = 1
    if (input.fans.startsWith('折叠') && r === '鑫隆迪门厂') t = 1
    // 型材特判
    if (input.profile.includes('哑口套') || input.profile.includes('门套')) t = qty
    if (input.profile.includes('+0')) t -= 1
  }

  return Math.max(0, Math.round(t))
}
