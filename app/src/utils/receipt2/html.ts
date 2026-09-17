// 收据单2 的 HTML 构造器（订单数据 → HTML 字符串）。
//
// 逐字移植旧版 `Receipt2.deobfuscated.js` 的渲染链：
//   `le` :350 / `oe` :356 / `ae` :365 / `ne` :366 / `M` :104-124 /
//   `ce` :463-469 / `se` :470 / `re` :439 / `ie` :441-462 /
//   `de` :475-577（页头+客户信息）/ `Ve` :579-601（页脚）/ `me` :603-613（单页）
//
// **与旧版的接口差异**：旧版的显隐设置、元素配置、品牌设置都读全局响应式 ref
// （`C.value` / `b.value` / `i.value`），新版全部改成显式传参。
// 除此之外**产出必须逐字节一致**（基准：`docs/receipt2-recon/07-golden-sample.md`）。
//
// 空白是产物的一部分：`me()` 的页首有一行「4 空格」空行（`:604` 的 `"\n    "` 紧接
// `de()` 开头的 `"\n    <div class=..."`），页脚为空时表尾留下 `</table>\n    \n  </section>`。

import { DEFAULT_BRAND } from './defaults'
import type {
  BrandSettings,
  ElementConfig,
  ElementConfigs,
  ElementKey,
  MetaKey,
  Receipt2Line,
  Receipt2Order,
  VisibilitySettings,
} from './types'

/** 渲染一页所需的全部配置（旧版是从三个全局 ref 里现读的）。 */
export interface RenderContext {
  visibility: VisibilitySettings
  elementConfigs: ElementConfigs
  brand: BrandSettings
}

/**
 * HTML 转义（`le` :350）。
 *
 * ⚠️ **不做 `String()` 包裹** —— 传非字符串会抛 `e.replace is not a function`。
 * 旧版的分工是「调用方先包」，`multiLine` / `singleLine` 都先 `String()` 过；
 * 这里用 `value: string` 把同一分工固化在类型上。
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 多行文本（`oe` :356）：`String(value ?? "")` → `<br>` 换 `\n` → `\r\n` 换 `\n` → 转义。
 * 配 `.receipt2-table .cell-multi { white-space: pre-line }` 显示换行。
 *
 * 两步替换的**顺序**是语义的一部分：先拆 `<br>` 再归一 `\r\n`。
 */
export function multiLine(value: unknown): string {
  return escapeHtml(String(value ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/\r\n/g, '\n'))
}

/** 单行文本（`ae` :365）：只转义，**不**处理 `<br>`。 */
export function singleLine(value: unknown): string {
  return escapeHtml(String(value ?? ''))
}

/** 两位小数（`ne` :366）：`Number(value)` 有限则 `toFixed(2)`，否则字面量 `"0.00"`。永不抛错、永不留空。 */
export function money2(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : '0.00'
}

/**
 * 元素配置 → 内联 style 串（`M` :104-124）。
 *
 * **段序恒为 `display → position → font-size → width`**，`;` 连接，不换行。
 * 全零且 `visible` 为真时**返回空串**（旧版是空数组 `join(";")`）。
 * 注意 `width` 段自己带两条声明：`width:Nmm;max-width:Nmm`。
 */
export function inlineStyle(cfg: ElementConfig): string {
  const parts: string[] = []
  if (!cfg.visible) parts.push('display:none')
  if (cfg.offsetXMm !== 0 || cfg.offsetYMm !== 0) {
    parts.push(`position:relative;left:${cfg.offsetXMm}mm;top:${cfg.offsetYMm}mm;z-index:10`)
  }
  if (cfg.fontSize > 0) parts.push(`font-size:${cfg.fontSize}px`)
  if (cfg.widthMm > 0) parts.push(`width:${cfg.widthMm}mm;max-width:${cfg.widthMm}mm`)
  return parts.join(';')
}

/**
 * 生成 `data-r2-el="..."`，配置产出非空 style 时才追加 ` style="..."`（`ce` :463-469）。
 * 缺配置（`undefined`）→ 只有裸属性；配了但全零 → 同样只有裸属性。
 */
export function elementAttr(key: ElementKey, configs: ElementConfigs): string {
  const cfg = configs[key]
  const style = cfg ? inlineStyle(cfg) : ''
  return `data-r2-el="${key}"` + (style ? ` style="${style}"` : '')
}

/** 可见性判定（`se` :470）：`!cfg || cfg.visible` —— **默认可见**，只有显式 `visible:false` 才隐藏。 */
export function isElementVisible(key: ElementKey, configs: ElementConfigs): boolean {
  const cfg = configs[key]
  return !cfg || cfg.visible
}

/**
 * 页头 + 客户信息区（`de` :475-577）。
 *
 * 页头三件套（编号/日期/二维码）同侧内按 `orderNo → date → qrcode` **固定顺序**入队，
 * **不受 `metaOrder` 影响**；位置配置只有 `"left"` 进左侧，**其余一切值都进右侧**。
 * 左侧为空时输出字面量 `<div></div>`。
 *
 * `brand` 是旧版 `i.value`（品牌设置），这里作为第 4 个参数补上（默认「关闭」）。
 */
export function renderHeaderInfo(
  order: Receipt2Order,
  visibility: VisibilitySettings,
  elementConfigs: ElementConfigs,
  brand: BrandSettings = DEFAULT_BRAND,
): string {
  // 二维码二选一（:479-488）。判空条件是「是字符串且 trim 后非空」，
  // ⚠️ `src` **不做 HTML 转义**（直接拼 `payQrcode`）—— 照抄旧版。
  const qrcode =
    typeof order.payQrcode === 'string' && order.payQrcode.trim() !== ''
      ? `<img class="receipt2-qrcode" ${elementAttr('qrcode', elementConfigs)} src="${order.payQrcode}" alt="收款二维码" />`
      : `<div class="receipt2-qrcode receipt2-qrcode-empty" ${elementAttr('qrcode', elementConfigs)}></div>`

  const orderNo = `<div class="receipt2-order" ${elementAttr('orderNo', elementConfigs)}>编号：${singleLine(order.orderNo)}</div>`
  const date = `<div class="receipt2-date" ${elementAttr('date', elementConfigs)}>日期：${singleLine(order.date)}</div>`

  const leftItems: string[] = []
  const rightItems: string[] = []
  // 只有 `"left"` 进左侧，**其余一切值都进右侧**（:503-511）
  const take = (position: string) => (position === 'left' ? leftItems : rightItems)
  if (visibility.showOrderNo && isElementVisible('orderNo', elementConfigs)) {
    take(visibility.orderNoPosition).push(orderNo)
  }
  if (visibility.showDate && isElementVisible('date', elementConfigs)) {
    take(visibility.datePosition).push(date)
  }
  if (visibility.showQrcode && isElementVisible('qrcode', elementConfigs)) {
    take(visibility.qrcodePosition).push(qrcode)
  }

  const left =
    leftItems.length > 0
      ? `<div class="receipt2-header-left">${leftItems.join('')}</div>`
      : '<div></div>'
  const right =
    rightItems.length > 0
      ? `<div class="receipt2-header-right">${rightItems.join('')}</div>`
      : '<div></div>'

  // 客户信息 span（:520-545）。前三个带 `data-shrink-fit`，`productionDays` **不带**。
  // ⚠️ 安装地址读的是**中文键** `order["安装地址"]`，不是英文 `address`。
  const spanFactories: Record<MetaKey, () => string> = {
    client: () =>
      `<span data-shrink-fit ${elementAttr('client', elementConfigs)}>客户：${singleLine(order.client)}</span>`,
    tel: () =>
      `<span data-shrink-fit ${elementAttr('tel', elementConfigs)}>电话：${singleLine(order.tel)}</span>`,
    address: () =>
      `<span data-shrink-fit ${elementAttr('address', elementConfigs)}>安装地址：${singleLine(order['安装地址'])}</span>`,
    productionDays: () =>
      `<span ${elementAttr('productionDays', elementConfigs)}>生产天数：${singleLine(order.productionDays)}</span>`,
  }
  const spanShown: Record<MetaKey, boolean> = {
    client: visibility.showClient && isElementVisible('client', elementConfigs),
    tel: visibility.showTel && isElementVisible('tel', elementConfigs),
    address: visibility.showAddress && isElementVisible('address', elementConfigs),
    productionDays: visibility.showProductionDays && isElementVisible('productionDays', elementConfigs),
  }

  // 顺序由 `metaOrder` 决定（旧版在这里会重复渲染未去重的脏数据，新版已在清洗层去重）
  const spans: string[] = []
  for (const key of visibility.metaOrder) {
    if (spanShown[key] && spanFactories[key]) spans.push(spanFactories[key]())
  }

  // 内联 `grid-template-columns` 的列数 = **可见 span 数**；全部不可见时整个 meta 行是空串
  const metaRow =
    spans.length > 0
      ? `<div class="receipt2-meta-row" style="grid-template-columns:${spans.map(() => '1fr').join(' ')};">${spans.join('')}</div>`
      : ''

  const title = brand.enabled && brand.name ? brand.name : order.brand || '收据单2'

  return `\n    <div class="receipt2-header">\n      ${left}\n      <div class="receipt2-title" ${elementAttr('title', elementConfigs)}>${singleLine(title)}</div>\n      ${right}\n    </div>\n    ${metaRow}`
}

/** 明细表头行（`re` :439）。列序固定 10 列，与 `TABLE_COLUMNS` 一致。 */
export function renderTableHead(): string {
  return '<thead><tr><th>型材</th><th>开向</th><th>颜色</th><th>玻璃</th><th>尺寸</th><th>数量</th><th>单价</th><th>金额</th><th>计价方式</th><th>备注</th></tr></thead>'
}

/**
 * 单条明细行（`ie` :441-462）。
 *
 * 第 1/4/5/9/10 列用 `cell-multi` + `multiLine()`（`<br>` 换行），其余用 `singleLine()`。
 * **明细行没有任何 `data-r2-el`** —— 元素编辑器管不到表格。
 */
export function renderRow(line: Receipt2Line): string {
  return `<tr>\n    <td class="cell-multi">${multiLine(line.profile)}</td>\n    <td>${singleLine(line.direction)}</td>\n    <td>${singleLine(line.color)}</td>\n    <td class="cell-multi">${multiLine(line.glass)}</td>\n    <td class="cell-multi">${multiLine(line.size)}</td>\n    <td>${singleLine(line.quantity)}</td>\n    <td>${singleLine(line.price)}</td>\n    <td>${singleLine(line.amount)}</td>\n    <td class="cell-multi">${multiLine(line.pricing)}</td>\n    <td class="cell-multi">${multiLine(line.remark)}</td>\n  </tr>`
}

/**
 * 页脚 = 金额块 + 说明块（`Ve` :579-601）。
 *
 * 两块**互相独立**门控（`showAmounts && se("amounts")` / `showDeclaration && se("declaration")`）。
 * ⚠️ 两块之间**没有换行** —— 旧版是两个三元表达式直接 `+` 拼接（07 文档 §5.2 实测坐实）。
 */
export function renderFooter(
  order: Receipt2Order,
  visibility: VisibilitySettings,
  elementConfigs: ElementConfigs,
): string {
  const amounts =
    visibility.showAmounts && isElementVisible('amounts', elementConfigs)
      ? `<div class="receipt2-amounts" ${elementAttr('amounts', elementConfigs)}>\n        <span>总额：${money2(order.total)}</span>\n        <span>已付：${money2(order.deposit)}</span>\n        <span>未付：${money2(order.balance)}</span>\n      </div>`
      : ''

  const declaration =
    visibility.showDeclaration && isElementVisible('declaration', elementConfigs)
      ? `<div class="receipt2-declaration" ${elementAttr('declaration', elementConfigs)}>${multiLine(order.declaration)}</div>`
      : ''

  return amounts + declaration
}

/**
 * 单页组装（`me` :603-613）—— **唯一的「页面模板」函数**。
 *
 * - 页首：`<section ...>` 后是 `\n` + 4 空格，紧接 `renderHeaderInfo()` 开头的 `\n` + 4 空格，
 *   所以产出的**第 2 行是一行只有 4 个空格的空行**。
 * - 页脚**只在最后一页**渲染（由调用方传 `withFooter`）；无页脚时表尾留下
 *   `</table>\n    \n  </section>`。
 * - 空明细 → `<tr><td colspan="10" class="empty-row">暂无明细</td></tr>`。
 */
export function renderPage(
  order: Receipt2Order,
  rows: Receipt2Line[],
  withFooter: boolean,
  ctx: RenderContext,
): string {
  const rowsHtml =
    rows.length > 0
      ? rows.map((line) => renderRow(line)).join('')
      : '<tr><td colspan="10" class="empty-row">暂无明细</td></tr>'

  return `<section class="receipt2-page">\n    ${renderHeaderInfo(order, ctx.visibility, ctx.elementConfigs, ctx.brand)}\n    <table class="receipt2-table">\n      ${renderTableHead()}\n      <tbody>${rowsHtml}</tbody>\n    </table>\n    ${withFooter ? renderFooter(order, ctx.visibility, ctx.elementConfigs) : ''}\n  </section>`
}
