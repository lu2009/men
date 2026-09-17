// 行上加价项目的**明细文本**计算（原版行字段 `加价项目`）。
//
// 从 `views/Hui.vue` 原样搬出，供两处共用：Hui 的打印回执（`pricingDetail`）与
// 电子回执单（`receiptBuilder` 的 `ps`）。两边算的都是同一个串，重复实现迟早会漂。
//
// ⚠️ 平开与吊趟是**两套**分支，旧版各写了一份，不能共用：
//   - 平开 `wt`  `Hui.formatted.js:1256-1307`
//   - 吊趟 `ft`  `Hui.formatted.js:4170-4204`
// 三处实质差异（金额会不同）：
//   ① `元/方`：平开有「超平米」特判 → `(平方数 − N)`；**吊趟没有**，就是 `price × 平方数`
//   ② `元/米`：平开**只有名字含「门套」才算**，长度 `(2×max(门洞高,亮窗总高)+门洞宽)/1000`；
//              **吊趟不判门套**，长度恒为 `门洞宽/1000`
//   ③ `元/公分`：平开只有 超高/超宽/超墙厚；**吊趟多一个「轨道超长」**，且结果 `Math.round` 取整
//
// ⚠️ 两处**原版就有的怪癖，照抄**：
//   - 平开的基准量 `o`、吊趟的 `c` 都是**循环外变量**（`:1259` / `:4173`），
//     `元/公分` 项的名字若不含任何已知前缀，会**沿用上一条算出来的值**；平开 `元/米` 不含「门套」时
//     连 `o` 也一并沿用。这里用 `carry` 复刻同一行为。
//   - 吊趟 `超宽N` 的基准是 `Math.max(门洞宽)`（单参数取 max，等于原值），照抄。

export interface MarkupItem {
  name: string
  price: number
  unit: string
  amount: number
}

export interface MarkupDetail {
  amount: number
  text: string
}

/** 加价计算用到的最小行字段集（`Hui.Line` / `OrderLineDto` 都满足）。 */
export interface MarkupLineInput {
  line_type: string
  quantity: number
  door_width: number
  door_height: number
  light_window_height: number
  wall_thickness: number
  square: number
}

/** 计算异常时的上报回调（Hui 传 `message.error`，回执构造器不需要）。 */
export type MarkupErrorHandler = (message: string) => void

/** 平开 `wt`（`Hui.formatted.js:1256-1307`）。 */
export function markupDetailPing(
  item: MarkupItem,
  l: MarkupLineInput,
  carry: { v: number },
  onError?: MarkupErrorHandler,
): MarkupDetail {
  const p = item.price || 0
  const q = l.quantity || 0
  const w = l.door_width || 0
  const h = Math.max(l.door_height || 0, l.light_window_height || 0)
  const t = l.wall_thickness || 0
  const sq = l.square || 0
  const name = item.name
  let r = 0
  let s = ''

  if (item.unit === '元/套' || item.unit === '元/支') {
    // 文案条件原版是 `r>0||r<0`（等价于 r!==0，且 -0 走 else）
    r = p * q
    s = r > 0 || r < 0 ? `${name} ${p}${item.unit}*${q}=${r}元` : `${name} `
  } else if (item.unit === '元/方') {
    try {
      if (name.includes('超平米')) {
        carry.v = Number((sq - Number(name.replace(/超平米/g, ''))).toFixed(3))
        r = p * carry.v * q
        s = r > 0 ? `超平米: ${p}${item.unit}*${carry.v}平方*${q}=${r}元` : `${name} `
      } else {
        r = Number((p * sq).toFixed(3))
        s = r > 0 ? `${name} ${p}${item.unit}*${sq}=${r}元` : `${name} `
      }
    } catch {
      onError?.('计算金额失败')
    }
  } else if (item.unit === '元/米') {
    try {
      // 不含「门套」时 r/s 保持初值，**carry 也保持上一轮的值**（原版如此）
      if (name.includes('门套')) {
        carry.v = (2 * h + w) / 1e3
        r = Number((p * carry.v * q).toFixed(3))
        s = r > 0 ? `${name} ${p}${item.unit}*${carry.v}米*${q}=${r}元` : `${name} `
      }
    } catch {
      onError?.('计算金额失败')
    }
  } else if (item.unit === '元/公分') {
    try {
      let x = ''
      if (name.includes('超高')) {
        carry.v = (h - Number(name.replace(/超高/g, ''))) / 10
        x = '超高:'
      } else if (name.includes('超宽')) {
        carry.v = (w - Number(name.replace(/超宽/g, ''))) / 10
        x = '超宽:'
      } else if (name.includes('超墙厚')) {
        carry.v = (t - Number(name.replace(/超墙厚/g, ''))) / 10
        x = '超墙厚:'
      }
      r = p * carry.v * q
      s = r > 0 ? `${x} ${p}${item.unit}*${carry.v}公分*${q}=${r}元` : `${x} `
    } catch {
      onError?.('计算金额失败')
    }
  } else if (item.unit === '无') {
    r = p * q
    if (q > 1) s = `${name} ${p}*${q}=${r}元`
    else if (q === 1) s = `${name} ${p}元`
  }
  return { amount: r, text: s }
}

/** 吊趟 `ft`（`Hui.formatted.js:4170-4204`）。 */
export function markupDetailDiao(
  item: MarkupItem,
  l: MarkupLineInput,
  carry: { v: number },
  onError?: MarkupErrorHandler,
): MarkupDetail {
  const p = item.price || 0
  const q = l.quantity || 0
  const w = l.door_width || 0
  const h = Math.max(l.door_height || 0, l.light_window_height || 0)
  const t = l.wall_thickness || 0
  const sq = l.square || 0
  const name = item.name
  let d = 0
  let s = ''

  if (item.unit === '元/套' || item.unit === '元/支') {
    d = p * q
    s = d !== 0 ? `${name} ${p}${item.unit}*${q}=${d}元` : `${name} `
  } else if (item.unit === '元/方') {
    // 吊趟**没有**「超平米」特判
    d = Number((p * sq).toFixed(3))
    s = d > 0 ? `${name} ${p}${item.unit}*${sq}=${d}元` : `${name} `
  } else if (item.unit === '元/公分') {
    try {
      let x = ''
      if (name.includes('超高')) {
        carry.v = (h - Number(name.replace(/超高/g, ''))) / 10
        x = '超高:'
      } else if (name.includes('超宽')) {
        // 原版是 `Math.max(门洞宽)`（单参数，等于原值）
        carry.v = (Math.max(w) - Number(name.replace(/超宽/g, ''))) / 10
        x = '超宽:'
      } else if (name.includes('超墙厚')) {
        carry.v = (t - Number(name.replace(/超墙厚/g, ''))) / 10
        x = '超墙厚:'
      } else if (name.includes('轨道超长')) {
        carry.v = Number(name.replace(/轨道超长/g, '')) / 10
        x = '轨道超长:'
      }
      d = Math.round(p * carry.v * q)
      s = d > 0 ? `${x} ${p}${item.unit}*${carry.v}公分*${q}=${d}元` : `${name} `
    } catch {
      onError?.('计算金额失败')
    }
  } else if (item.unit === '元/米') {
    // 吊趟不判「门套」，长度恒为 门洞宽/1000
    carry.v = w / 1e3
    d = Number((p * carry.v * q).toFixed(3))
    s = d > 0 ? `${name} ${p}${item.unit}*${carry.v}米*${q}=${d}元` : `${name} `
  } else if (item.unit === '无') {
    d = p * q
    s = `${name} ${d}元`
  }
  return { amount: d, text: s }
}

/** 按行类型分发到平开 / 吊趟两套分支。`carry` 由调用方在**一次重算内**贯穿整行（复刻原版的循环外变量）。 */
export function markupDetail(
  item: MarkupItem,
  l: MarkupLineInput,
  carry: { v: number },
  onError?: MarkupErrorHandler,
): MarkupDetail {
  return l.line_type === 'diao'
    ? markupDetailDiao(item, l, carry, onError)
    : markupDetailPing(item, l, carry, onError)
}

/**
 * 行上加价项目的**明细文本**多行（对应原版行上的 `加价项目` 字段）。
 *
 * 原版在 `wt`/`ft` 里把每项算出的文本 `join("\n")` 写进行字段（`Hui.formatted.js:1308`），
 * 单元格按 `\n` 渲染成 `.expression-line`（`:2515`），打印的计价明细也用它（`:8721`/`:8819`）。
 *
 * 新版**不加这个字段、改为现算**，依据是：该文本是
 *   (已选项的 name/price/unit) × (行上 数量/门洞宽/门洞高/亮窗总高/墙厚/平方数) × line_type
 * 的**纯函数**，而这些输入两边都持久化（旧版存 `加价项目原始数据` + 行字段；新版存 `markup` + 行字段），
 * 且旧版大 watch（`:1470`）的依赖数组恰好覆盖 `markupDetail` 用到的全部字段
 * —— 因此现算的串与原版存下来的串逐字相同。
 */
export function markupLines(
  l: MarkupLineInput & { markup?: MarkupItem[] | null },
  onError?: MarkupErrorHandler,
): string[] {
  const carry = { v: 0 }
  return (l.markup ?? [])
    .filter((m) => m && m.name)
    .map((m) => markupDetail(m, l, carry, onError).text)
}
