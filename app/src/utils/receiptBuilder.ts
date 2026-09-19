// 电子回执单载荷构造：逐字复刻旧版 `receiptBuilder-76e5b538.js` 导出的两个函数
// （`ps` = 回执行数组 / `gs` = 客户信息），供 `/receipt-view/:receiptNo`（已登录）与
// `/receipt-share`（分享）两张页面共用。
//
// ⚠️ **不要**改去复用 `Hui.vue` 的打印回执函数（`glassSpecPrintable` / `dimSizeLabel` /
// `pricingDetail` / `receiptRemark`）—— 两者**不是同一份格式化**，旧版也是两套代码：
//
//   | 项 | 打印回执（Hui，`NEW_SIZE_FORMAT=true`） | 电子回执（这里） |
//   |----|----|----|
//   | 玻璃 | `无`（不是「无玻璃」）/ 钻石→`固玻:…<br>门玻:…` / 厚 0→`背板:`+`面板:` | `无玻璃` / 钻石同上 / **无「背板」支** |
//   | 尺寸 | `高:H<br/>宽:W<br/>亮高:…` | `高H宽W亮高…`（无标签、无换行，` 亮窗`/` 墙厚:`/` 轨道长:` 空格分隔） |
//   | 计价 | 含**套线金额** | 平开**不含套线**；吊趟含套线且长度公式与打印不同 |
//   | 备注 | `打折:` + 轨道/五金/墙型… | 平开只有 `折价:`+安装地址+备注；吊趟多 扇数/轨道种类/套线种类 |
//   | 开向 | 自定义显示名 | **原始开向**（平开带 `套线种类` 前缀） |
//
// 玻璃厚后缀：打印回执对「家家发门业 / 星之铝门窗」两家不加 `*{厚}mm`，`ps` 里**没有**这条特判，
// 故这里一律加 —— 与旧版电子回执一致。

import { DIRECTION_IMAGES, PING_DIRECTION_IMAGES } from '../data/directionImages'
import { getOriginalOpenDirection } from '../composables/useOpenDirection'
import { markupLines, type MarkupItem } from './markupLines'
import type { OrderLineDto, ReceiptDto } from '../api/types'

/** 电子回执行（`ReceiptMobile` 的一张门卡片）。 */
export interface ReceiptPictureLine {
  profile: string
  direction: string
  openImg: string
  /** 无价时为 `'/'`（原版字面量），故是联合类型。 */
  price: number | '/'
  color: string
  glass: string
  size: string
  quantity: number
  amount: number
  pricing: string
  remark: string
  imageId: string | null
  /** 门图 dataURL（新版落库在 `order_lines.image_url`；为空时回退本地 IndexedDB）。 */
  imageUrl: string
  processing: string
  doorType: 'swing' | 'sliding'
  originalDirection: string
  门洞宽: number
  门洞高: number
  亮窗总高: number
  // 仅吊趟
  扇数?: string
  亮窗数量?: number
  轨道长?: number
}

/** 回执表头（`gs` 的返回值），供卡片顶部与费用汇总使用。 */
export interface ReceiptCustomerInfo {
  client: string
  tel: string
  date: string
  productionDays: number
  orderNo: string
  lastDay: string
  total: number
  deposit: number
  订单备注: string
  address: string
  balance: number
  门数: number
  安装地址: string
  declaration: string
  payQrcode: string
}

const round2 = (v: number) => Math.round(v * 100) / 100

type Line = OrderLineDto

/** 加价项目文本（原版行字段 `加价项目`，多行用 `\n` 连接）。 */
function addPriceText(l: Line): string {
  // JSONB 落库后拿回来是 `unknown`：非数组一律按「没有加价项」处理（不猜字符串内容）。
  const markup = Array.isArray(l.markup) ? (l.markup as MarkupItem[]) : []
  return markupLines({ ...l, markup }).join('\n')
}

// ---------------------------------------------------------------------------
// 行内格式化（`ps` 逐字）
// ---------------------------------------------------------------------------

/** 玻璃列。原版是**嵌套三元**，判定顺序：单玻 → 无玻璃 → 钻石固玻 → 底玻/面玻。 */
function glassText(l: Line): string {
  const bottom = l.bottom_glass || ''
  const face = l.face_glass || ''
  const thick = l.glass_thickness || ''
  if (bottom === '无' && face !== '无') return `单玻:${face}*${thick}mm`
  if (bottom === '无' && face === '无') return '无玻璃'
  if ((l.profile || '').includes('钻石')) return `固玻:${bottom}<br>门玻:${face}*${thick}mm`
  return `底玻:${bottom}<br>面玻:${face}*${thick}mm`
}

/** 平开尺寸：钻石 / 子母 / 普通 三支。 */
function pingSizeText(l: Line): string {
  const h = l.door_height || 0
  const w = l.door_width || 0
  const lw = (l.light_window_height || 0) > 0
  const wall = (l.wall_thickness || 0) > 0
  const jiao = (l.jiao || 0) > 0
  const profile = l.profile || ''
  if (profile.includes('钻石')) {
    return `高${h}左宽${w}${lw ? `门宽${l.light_window_height}` : ''}${wall ? `右宽${l.wall_thickness}` : ''}`
  }
  if (profile.includes('子母')) {
    // 母门取的是 `轨道长`（原版 `o(318)`），且**无条件拼**（不判 >0）
    return `高${h}宽${w}母门${l.track_length || 0}${lw ? `*亮高${l.light_window_height}` : ''}${wall ? `*${l.wall_thickness}` : ''}${jiao ? `*${l.jiao}` : ''}`
  }
  return `高${h}宽${w}${lw ? `亮高${l.light_window_height}` : ''}${wall ? `*${l.wall_thickness}` : ''}${jiao ? `吊脚${l.jiao}` : ''}`
}

/** 吊趟尺寸：` 亮窗` / ` 亮窗数:` / ` 墙厚:` / ` 轨道长:` 四段依次追加（**前导空格**，与打印版不同）。 */
function diaoSizeText(l: Line): string {
  const h = l.door_height || 0
  const w = l.door_width || 0
  const lw = (l.light_window_height || 0) > 0
  const lwc = (l.light_window_count || 0) > 0
  const wall = (l.wall_thickness || 0) > 0
  const track = (l.track_length || 0) > 0
  return `高${h}宽${w}${lw ? ` 亮窗${l.light_window_height}` : ''}${lwc ? ` 亮窗数:${l.light_window_count}` : ''}${wall ? ` 墙厚:${l.wall_thickness}` : ''}${track ? ` 轨道长:${l.track_length}` : ''}`
}

/** 单价行：套 = `•单价元/套*数量=金额元`；方 = `•单价元/方*平方数=四舍五入3位元`。 */
function unitPriceText(l: Line): string {
  const priceType = l.price_type
  const unit = l.unit_price || 0
  const qty = l.quantity || 0
  if (priceType === '套' && unit > 0) return `•${unit}元/套*${qty}=${qty * unit}元`
  if (priceType === '方' && unit > 0) {
    const sq = l.square || 0
    // 原版：`Number((Math.round(100*a)/100).toFixed(3))` —— 先两位取整再补足三位
    const amt = Number((Math.round(100 * sq * unit) / 100).toFixed(3))
    return `•${unit}元/方*${sq}=${amt}元`
  }
  return ''
}

/** 吊趟套线行（原版只在 `套线金额 > 0` 时拼）。长度恒用「一宽两高」公式，不判套线种类。 */
function diaoCasingText(l: Line): string {
  if (!((l.casing_amount || 0) > 0)) return ''
  // 套线种类形如 `一高一宽-30`，`-` 后是增量（非数字/空则按 0）
  let inc = 0
  const casing = l.casing || ''
  if (casing.includes('-')) {
    try {
      const parts = casing.split('-')
      if (parts.length > 1) {
        const n = parts[1]
        if (!isNaN(Number(n)) && n.trim() !== '') inc = Number(n)
      }
    } catch {
      inc = 0
    }
  }
  const len = (2 * Math.max(l.door_height || 0, l.light_window_height || 0) + (l.door_width || 0) + 2 * inc) / 1e3
  const price = l.casing_price || 0
  const amount = (l.casing_amount || 0).toFixed(3)
  return l.quantity === 1
    ? `<br>•${price}元/米*${len}=${amount}元`
    : `<br>•${price}元/米*${len}*${l.quantity}=${amount}元`
}

/** 打折文案（原版：`(100*折扣).toString().replace(/0$/,"")` + `折`）。 */
function discountText(discount: number): string {
  return `${(100 * discount).toString().replace(/0$/, '')}折`
}

// ---------------------------------------------------------------------------
// 对外：`ps`
// ---------------------------------------------------------------------------

/**
 * 回执行数组。原版顺序：**先全部平开、再全部吊趟**，各自保持原序（无排序）。
 * `openImg`：平开按「原始开向」查表；吊趟按「扇数+开向」查，查不到回落「开向」。
 */
export function buildReceiptPicture(lines: Line[]): ReceiptPictureLine[] {
  const out: ReceiptPictureLine[] = []

  for (const l of lines) {
    if (l.line_type !== 'ping') continue
    const originalDirection = getOriginalOpenDirection(l.direction || '')
    const add = addPriceText(l)
    // 原版：`套线种类 ? 套线种类 + 开向 : 开向`（打印回执同构，见 `receiptPrintData` 的方向列注释）
    const direction = (l.casing || '') + (l.direction || '')
    let pricing = unitPriceText(l)
    if (add) pricing += `<br>•${add.replace(/\n/g, '<br>•')}`

    const discount = l.discount ?? 1
    const remark = (discount < 1
      ? [`折价:${discountText(discount)}`, l.install_address, l.remark]
      : [l.install_address, l.remark]
    )
      .filter(Boolean)
      .join('<br>')

    out.push({
      profile: l.profile || '',
      direction,
      openImg: PING_DIRECTION_IMAGES[originalDirection] || '',
      price: (l.unit_price || 0) > 0 ? l.unit_price : '/',
      color: l.color || '',
      glass: glassText(l),
      size: pingSizeText(l),
      quantity: l.quantity || 0,
      amount: Math.round(100 * (l.amount || 0)) / 100,
      pricing,
      remark,
      imageId: l.image_id || null,
      imageUrl: l.image_url || '',
      processing: l.progress || '',
      doorType: 'swing',
      originalDirection,
      门洞宽: l.door_width || 0,
      门洞高: l.door_height || 0,
      亮窗总高: l.light_window_height || 0,
    })
  }

  for (const l of lines) {
    if (l.line_type !== 'diao') continue
    const fans = l.fans || ''
    const rawDir = l.direction || ''
    const key = fans ? `${fans}${rawDir}` : rawDir
    const add = addPriceText(l)
    let pricing = unitPriceText(l) + diaoCasingText(l)
    if (add) pricing += `<br>•${add.replace(/\n/g, '<br>•')}`

    const discount = l.discount ?? 1
    const profile = l.profile || ''
    // 原版两条分支只有「折价」一项之差；` 只做门套`（哑口）/` 口袋门`（+0）的替换恒生效
    const fanLabel = `扇数:${profile.includes('哑口') ? ' 只做门套' : profile.includes('+0') ? ' 口袋门' : fans}`
    const head = discount < 1 ? [`折价:${discountText(discount)}`, fanLabel] : [fanLabel]
    const remark = [
      ...head,
      `轨道种类:${l.track || ''}`,
      l.casing ? `套线种类:${l.casing}` : null,
      l.install_address,
      l.remark,
    ]
      .filter(Boolean)
      .join('<br>')

    out.push({
      profile,
      direction: rawDir,
      openImg: DIRECTION_IMAGES[key] || DIRECTION_IMAGES[rawDir] || '',
      price: (l.unit_price || 0) > 0 ? l.unit_price : '/',
      color: l.color || '',
      glass: glassText(l),
      size: diaoSizeText(l),
      quantity: l.quantity || 0,
      amount: Math.round(100 * (l.amount || 0)) / 100,
      pricing,
      remark,
      imageId: l.image_id || null,
      imageUrl: l.image_url || '',
      processing: l.progress || '',
      doorType: 'sliding',
      originalDirection: getOriginalOpenDirection(rawDir),
      扇数: fans,
      门洞宽: l.door_width || 0,
      门洞高: l.door_height || 0,
      亮窗总高: l.light_window_height || 0,
      亮窗数量: l.light_window_count || 0,
      轨道长: l.track_length || 0,
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// 对外：`gs`
// ---------------------------------------------------------------------------

/**
 * 回执表头。
 *
 * 与原版 `gs` 的两处**有意差异**（都已核实，不是漏抄）：
 * ① `productionDays`：原版用 `Math.ceil((截止日期 − 日期)/天)` 现算，新版直接取库里的
 *    `production_days`（该字段的真正来源）—— 两者**本来就等价**：旧版 `截止 = 日期 + 生产天数`
 *    （`Hui.formatted.js:8843`），所以那个 `ceil` 除下来正好等于生产天数。
 *    ⚠️ 2026-09-19 更正：这里原来写着「新版 `due_date` 是 `+ 1` 推出来的，照抄公式会恒比真实值大 1」
 *    —— 那是因为我们自己的 `due_date` 多算了一天（已修）。**取 `production_days` 这个做法不变**，
 *    变的只是理由。
 * ② `total` / `门数`：原版是前端遍历 `ping_hui`/`diao_hui` 现加；新版订单头早已落库
 *    `total_price`/`door_count`（同一口径：Σ金额 / Σ数量），直接取，避免两处口径漂移。
 */
export function buildReceiptCustomerInfo(
  receipt: ReceiptDto,
  declaration: string,
  payQrcode = '',
): ReceiptCustomerInfo {
  return {
    client: receipt.client_name || '',
    tel: receipt.phone || '',
    date: receipt.order_date,
    productionDays: receipt.production_days,
    orderNo: receipt.receipt_no,
    lastDay: receipt.due_date || '',
    total: round2(receipt.total_price),
    deposit: receipt.deposit || 0,
    // 原版取的是**表头**的安装地址/备注，不是首行的
    订单备注: receipt.remark || '',
    address: receipt.install_address || '',
    balance: round2(receipt.total_price - (receipt.deposit || 0)),
    门数: receipt.door_count || 0,
    安装地址: receipt.install_address || '',
    declaration,
    payQrcode,
  }
}

export { round2 as receiptRound2 }
