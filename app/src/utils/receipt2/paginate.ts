// 收据单2 · 分页（旧版 `we`，`Receipt2.deobfuscated.js:615-721`）
//
// 旧版把「量测」和「打包」揉在一个 async 函数里。这里拆成两半：
//   - `paginate()`      —— 纯函数「打包半」，逐字移植自 `:693-714`
//   - `paginateOrder()` —— 「量测半 + 调度」，对应 `:621-665` + `:715-721`
//
// 纯函数那半已被 `docs/receipt2-recon/08-pagination.md` 用 24 个用例 + 20 万组随机模糊
// 实证覆盖（参考实现 `docs/receipt2-recon/paginate.mjs`），本文件是它的 TS 逐字移植。
// 量测半无法静态验证，只能照抄旧版原码。

import type {
  ColumnWidths,
  FontSettings,
  PaperPresetKey,
  PaperSettings,
  Receipt2Line,
  Receipt2Order,
} from './types'
import { PAPER_PRESETS } from './defaults'
import { css } from './css'
import {
  renderFooter,
  renderHeaderInfo,
  renderPage,
  renderRow,
  renderTableHead,
  type RenderContext,
} from './html'

/**
 * 渲染上下文：`css()` / `renderPage()` 需要、但订单里没有的那部分设置。
 *
 * ⚠️ `columnWidths` 是我加的 —— team-lead 给的 ctx 只有 `RenderContext` 那三个字段，
 * 但 `css()` 的签名是 `(fonts, paper, columnWidths)`，而列宽既不在 order 也不在
 * fonts/paper 里（它是独立的一项设置，见 `storage.ts` 的 `Receipt2LoadedSettings.columnWidths`）。
 * 若约定把列宽放别处，改这一处即可。
 */
export interface Receipt2RenderContext extends RenderContext {
  columnWidths: ColumnWidths
}

// ------------------------------------------------------------------ //
// 纸型 → penalty
// ------------------------------------------------------------------ //

/** 旧版 `Q`（`:307`）：`Math.abs(e - t) <= o`，`o` 默认 2 —— 即 **2mm 容差**。 */
const PAPER_MATCH_TOLERANCE_MM = 2

/**
 * 纸型反查预设 key（旧版 `:682-691` 的匿名函数）。
 *
 * 按 `PAPER_PRESETS` 的**声明顺序**取第一个满足「方向相同 + 宽高各在 2mm 内」的预设，
 * 找不到返回 `'custom'`。方向也参与比较，所以 210×140 横向不会匹配 140×210 纵向。
 */
export function findPaperPresetKey(paper: PaperSettings): PaperPresetKey | 'custom' {
  const hit = PAPER_PRESETS.find(
    (p) =>
      p.settings.orientation === paper.orientation &&
      Math.abs(p.settings.widthMm - paper.widthMm) <= PAPER_MATCH_TOLERANCE_MM &&
      Math.abs(p.settings.heightMm - paper.heightMm) <= PAPER_MATCH_TOLERANCE_MM,
  )
  return hit ? hit.key : 'custom'
}

/**
 * 纸型修正量 penalty（旧版 `:667-692` 的 switch）。
 *
 * **只有 210×90 与 200×90 这两个 90mm 高的预设返回 1，其余一律 0** ——
 * 包括 `a5-*`（旧版 switch 里根本没列它们，落到 `default`）和 `custom`。
 * 这 1px 是干什么的，逆向未确认（见 `08-pagination.md` §7.5）；
 * 但它的效果是实打实的：用例 6c/6d 里 1px 就能把单页文档变成两页。
 */
export function paperPenalty(paper: PaperSettings): number {
  const key = findPaperPresetKey(paper)
  return key === 'pin-210-90' || key === 'pin-200-90' ? 1 : 0
}

// ------------------------------------------------------------------ //
// A. 打包半（纯函数）
// ------------------------------------------------------------------ //

/**
 * 把行高数组切成若干页，返回**每页起始行的下标**（首项恒为 0）。
 *
 * 逐字移植自旧版 `:693-714`。规则：
 * - **中间页**按 `availNoFooter`（不带页脚）的预算贪心装，**只有末页**按 `availWithFooter`
 *   （带页脚）判定 —— 因为页脚只在末页渲染。`c >= s` 恒成立。
 * - 若「剩余所有行高之和 <= s」，全部收进当前页并收工（当前页即末页）。
 * - 每页**至少 1 行**：贪心循环第一次必然进入（见 ③ 的注释）。
 * - 单行本身就超过一整页预算时**不切分行**，只能溢出（旧版行为，静默裁掉）。
 *
 * @param rowHeights      每行高度 px（旧版 `n` / `d`，来自 `getBoundingClientRect().height`）
 * @param availNoFooter   无页脚时的行高预算 px（旧版 `u`）
 * @param availWithFooter 带页脚时的行高预算 px（旧版 `r`）
 * @param penalty         纸型修正量 0|1（旧版 `i`）
 */
export function paginate(
  rowHeights: number[],
  availNoFooter: number,
  availWithFooter: number,
  penalty: number,
): number[] {
  const len = rowHeights.length

  // 原 :693-694
  const c = Math.max(0, availNoFooter - penalty)
  const s = Math.max(0, availWithFooter - penalty)

  // 原 :695-714
  const pages: number[] = [0]
  let y = 0
  while (y < len) {
    let rest = 0
    for (let k = y; k < len; k++) rest += rowHeights[k] // 剩余所有行高之和
    if (rest <= s) break // 连页脚一起塞得下 → 收工

    let t = 0
    let l = y
    // 贪心装到 `c`。**第一次一定进循环**：`l === y` 使 `l > y` 为假 → `&&` 短路 →
    // `!(…)` 为真。「每页至少一行」正是由这一点保证的，不是由下面的 ③。
    while (l < len && !(l > y && t + rowHeights[l] > c)) {
      t += rowHeights[l]
      l++
    }

    // ③ 原 :707 —— **死代码，永不触发**（CONFIRMED：24 用例 + 20 万组模糊共 644,400 次
    //    翻页决策里 0 次）。因为 `l` 初值就是 `y`，上面 while 的第一项 `l > y` 为假、
    //    `&&` 短路，循环体必然执行一次 ⇒ 退出时恒有 `l >= y + 1`。
    //    保留它只为与旧版逐字对齐；**不要**以为它在保证「至少前进一行」。
    if (l <= y) l = y + 1

    // ④ 原 :708 —— 必须给带页脚的末页留至少一行（页脚只在末页渲染）。
    //    走到这里说明 ① 不成立（剩余总和 > s），所以当前页不可能是末页；
    //    若贪心恰好装到了末尾，就强行退一行出去，否则末页没有内容、页脚无处安放。
    //    ⚠️ 旧逆向文档 `02-render-pipeline.md:268` 把它注释成「别把最后一行单独留下」——
    //    语义**正好相反**，它恰恰是在**制造**「最后一行单独一页」（用例 1b）。已更正。
    if (l >= len && len - y > 1) l = len - 1

    y = l
    // 退出在 push 之前，所以不会产生空页（`pages` 严格递增）。
    if (!(y < len)) break
    pages.push(y)
  }
  return pages
}

// ------------------------------------------------------------------ //
// B. 量测半 + 调度
// ------------------------------------------------------------------ //

/** 量测节点的 id（旧版 :636 的覆盖 CSS 就写死这两个 id）。 */
const MEASURE_PAGE_ID = 'r2mp'
const MEASURE_BODY_ID = 'r2mb'
const MEASURE_FOOTER_ID = 'r2mf'

/** 量测容器本体的样式（旧版 :631-632 逐字）。 */
const MEASURE_HOST_STYLE = 'position:absolute;visibility:hidden;top:0;left:0;'

/**
 * 量测用的两条 `!important` 覆盖（旧版 :635-636 逐字）。
 *
 * - 第一条：正常 `.receipt2-page` 是 `height: {heightMm}mm; overflow: hidden`，
 *   会把超出的行**裁掉（量不到）**；`height:auto` 让它自然长高、`overflow:visible` 保证不裁。
 * - 第二条：防止 `.receipt2-declaration { flex: 1 }` 在量测节点里干扰页脚高度。
 */
const MEASURE_OVERRIDE_CSS =
  `\n      #${MEASURE_PAGE_ID} { height: auto !important; overflow: visible !important; }\n` +
  `      #${MEASURE_FOOTER_ID} .receipt2-declaration { flex: 0 0 auto !important; min-height: 0 !important; }\n    `

/**
 * 造量测节点的 innerHTML（旧版 :633-644 **逐字**）。
 *
 * 注意这里**不走 `renderPage()`** —— 旧版 `we` 也是拿零件现拼的，因为量测节点要挂
 * 三个 id（`#r2mp` / `#r2mb` / `#r2mf`），而 `me()` 产出的页面模板挂不了。
 * 用的是同一批零件函数，所以除了外层包裹与缩进，结构与被渲染的页完全一致。
 *
 * **只造一页**，里面塞**全部**明细行 —— 目的就是让页面自然长高，一次量完所有行。
 * 这段 HTML **不进入最终产物**，只为量尺寸。
 */
function buildMeasureHtml(
  order: Receipt2Order,
  rows: Receipt2Line[],
  fonts: FontSettings,
  paper: PaperSettings,
  ctx: Receipt2RenderContext,
): string {
  const { visibility, elementConfigs, brand } = ctx
  return (
    '<style>' +
    css(fonts, paper, ctx.columnWidths) +
    MEASURE_OVERRIDE_CSS +
    '</style>\n' +
    '      <div class="receipt2-root">\n' +
    `        <section class="receipt2-page" id="${MEASURE_PAGE_ID}">\n` +
    '          ' +
    renderHeaderInfo(order, visibility, elementConfigs, brand) +
    '\n          <table class="receipt2-table">\n            ' +
    renderTableHead() +
    `\n            <tbody id="${MEASURE_BODY_ID}">` +
    rows.map((line) => renderRow(line)).join('') +
    '</tbody>\n          </table>\n' +
    `          <div id="${MEASURE_FOOTER_ID}">` +
    renderFooter(order, visibility, elementConfigs) +
    '</div>\n        </section>\n      </div>'
  )
}

/**
 * 渲染一张收据的**全部页**（旧版 `we`，`:615-721`）。
 *
 * 流程：
 * 1. 空明细短路 → 直接渲染「暂无明细 + 页脚」一页（`:620`）。
 * 2. 造离线量测节点挂到 body，`requestAnimationFrame` 后量出每行高度与两个预算。
 * 3. 调 `paginate()` 切页，逐页渲染；`isLast = (end === len)` 决定这一页带不带页脚。
 * 4. 量测节点在 `finally` 里 removeChild，异常路径也不泄漏。
 *
 * @param rows 明细行（旧版从 `order.receipt` 取，这里显式传入以便调用方复用同一份切片）
 */
export async function paginateOrder(
  order: Receipt2Order,
  rows: Receipt2Line[],
  fonts: FontSettings,
  paper: PaperSettings,
  ctx: Receipt2RenderContext,
): Promise<string[]> {
  // 原 :620 —— 空明细根本不走分页，直接给「暂无明细」的一页（且带页脚）。
  if (rows.length === 0) return [renderPage(order, [], true, ctx)]

  const host = document.createElement('div')
  host.style.cssText = MEASURE_HOST_STYLE
  host.innerHTML = buildMeasureHtml(order, rows, fonts, paper, ctx)

  let measured: MeasureResult
  document.body.appendChild(host)
  try {
    measured = await measure(host, paper)
  } finally {
    // 原 :663 —— 量完立即摘掉，别泄漏。
    document.body.removeChild(host)
  }

  const penalty = paperPenalty(paper)
  const pages = paginate(
    measured.rowHeights,
    measured.availNoFooter,
    measured.availWithFooter,
    penalty,
  )

  // 原 :715-720 的页切片
  const out: string[] = []
  for (let k = 0; k < pages.length; k++) {
    const start = pages[k]
    const end = k + 1 < pages.length ? pages[k + 1] : rows.length
    out.push(renderPage(order, rows.slice(start, end), end === rows.length, ctx))
  }
  return out
}

interface MeasureResult {
  /** 各明细行高 px（旧版 `d`，只取 `#r2mb` 里的 `<tr>`，**不含 thead**） */
  rowHeights: number[]
  /** 不带页脚时留给明细行的预算 px（旧版 `u`） */
  availNoFooter: number
  /** 带页脚时留给明细行的预算 px（旧版 `r`） */
  availWithFooter: number
}

/**
 * 量测（旧版 `:646-665`）。必须在 `requestAnimationFrame` 之后量，
 * 否则量测节点还没排版，`getBoundingClientRect()` 全是 0。
 *
 * ⚠️ **有意偏离**：旧版的 `new Promise(e => { requestAnimationFrame(() => { …量… }) })`
 * 没有 reject 路径 —— rAF 回调里一抛，Promise 永远不 settle，调用方**永久挂起**，
 * `removeChild` 也永远不执行（量测节点赖在 body 上）。这里把回调体包进 try/catch 转 reject，
 * 只为让调用方的 `finally` 真的能跑到。正常路径逐字未动。
 */
function measure(host: HTMLElement, paper: PaperSettings): Promise<MeasureResult> {
  return new Promise((resolve, reject) => {
    requestAnimationFrame(() => {
      try {
        resolve(measureNow(host, paper))
      } catch (err) {
        reject(err)
      }
    })
  })
}

/** `measure()` 的同步体 —— 与旧版 `:646-665` 一一对应。 */
function measureNow(host: HTMLElement, paper: PaperSettings): MeasureResult {
  const page = host.querySelector<HTMLElement>('#' + MEASURE_PAGE_ID)!
  const body = host.querySelector<HTMLElement>('#' + MEASURE_BODY_ID)!
  const footer = host.querySelector<HTMLElement>('#' + MEASURE_FOOTER_ID)!

  const contentHeight = page.getBoundingClientRect().height // i
  // c = 目标页高(px)。`#r2mp` 被 height:auto 覆盖了，量不到「真实一页有多高」，
  // 只能从宽度反推：`.receipt2-page` 的显式 `width: {widthMm}mm` 保证
  // `rect.width` 就是 widthMm 在 CSS px 下的值，乘上高宽比即得目标页高。
  // 这样对 DPI/缩放免疫（宽高用同一标度，比值消掉）。
  const targetPageHeight = page.getBoundingClientRect().width * (paper.heightMm / paper.widthMm) // c
  const footerHeight = footer.getBoundingClientRect().height // s

  // 只取 tbody 里的 tr —— **thead 那行不在里面**，它被算进下面的固定开销。
  const rowHeights = Array.from(body.querySelectorAll('tr')).map(
    (el) => el.getBoundingClientRect().height,
  )

  // 固定开销 = 页面上除明细行和页脚以外的一切
  //   = page padding + 页头 + margin + 信息栏 + **表头行** + 表格 margin + 边框
  const chrome = contentHeight - rowHeights.reduce((a, b) => a + b, 0) - footerHeight

  return {
    rowHeights,
    availNoFooter: targetPageHeight - chrome, // u
    availWithFooter: targetPageHeight - chrome - footerHeight, // r
  }
}
