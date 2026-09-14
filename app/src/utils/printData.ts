// 打印数据计算：标签数量（lable）。
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
const DEFAULT_PING_TABS: TabsConfig = { sheets: 1, add: 0, add_2: 0 }
/** 昊艺门窗真实配置：diao_tabs={sheets:1,add:1,add_2:0} */
const DEFAULT_DIAO_TABS: TabsConfig = { sheets: 1, add: 1, add_2: 0 }

/** 扇数字符串 → 扇数 N（含「纱」追加）。 */
function fansToCount(fans: string): number {
  if (!fans) return 1
  if (fans === '单轨单扇') return 1
  if (fans === '一固一活' || fans === '双活') return 2
  const shan = fans.match(/(\d+)扇/)?.[1]
  const sha = fans.match(/(\d+)纱/)?.[1]
  return (shan ? Number(shan) : 0) + (sha ? Number(sha) : 0) || 1
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
