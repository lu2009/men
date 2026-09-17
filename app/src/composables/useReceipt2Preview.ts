// 「收据单2」预览容器的两件 DOM 后处理：**缩字自适应**与**列宽拖拽手柄**。
//
// 逐字移植旧版 `legacy/js/Receipt2.deobfuscated.js` 的 `pe`（:851-946）：
//   · 缩字 `applyShrinkFit`  —— 预览侧 :857-872；打印侧 `ye` :779-795 是同构的第二份实现
//   · 列宽 `initColumnResize` —— :874-945
// 逆向依据：`docs/receipt2-recon/04-font-dialog-edit.md` §2（列宽）、§6.5（缩字副作用），
// `docs/receipt2-recon/06-style-geometry.md` §1.5（手柄 CSS 原文）、§6（缩字算法原文）。
//
// 调用时机（旧版）：预览 HTML 更新后由父级 `yi` 调一次 `pe(容器)`
// （`/tmp/Home.Home.decoded.js:1000`，在 `requestAnimationFrame` 里）；元素微调「确认」后
// `xe` 又调一次（幂等）。
//
// ⚠️ **写盘职责**：列宽在拖拽 `mouseup` 里**直接写 localStorage**（旧版 :936-939），
// 没有保存按钮 —— 所以 `initColumnResize` 内部会自己调 `saveColumnWidths`，
// **调用方不要重复写盘**。

import { saveColumnWidths } from '../utils/receipt2/storage'
import type { ColumnWidths } from '../utils/receipt2/types'

/** 拖拽手柄的内联样式（旧版 :889-890，逐字照抄）。 */
const HANDLE_CSS =
  'position:absolute;right:-3px;top:0;width:6px;height:100%;cursor:col-resize;z-index:20;background:transparent;user-select:none;'

/** hover 中（旧版 :893） */
const HANDLE_BG_HOVER = 'rgba(64,158,255,0.35)'
/** 拖拽中（旧版 :909） */
const HANDLE_BG_ACTIVE = 'rgba(64,158,255,0.55)'

/** 单列下限（旧版 :913-914 的 `Math.max(3, …)`，百分比）。 */
const MIN_COLUMN_WIDTH = 3

/** 最近一次 `initColumnResize` 的容器 —— 只给 `disposeColumnResize` 用。 */
let activeContainer: HTMLElement | null = null
/** 正在进行的拖拽的摘钩函数（`disposeColumnResize` 要能中途打断）。 */
let detachDrag: (() => void) | null = null

/**
 * 缩字自适应 —— 对容器内**所有** `[data-shrink-fit]` 元素跑一遍（旧版 :857-872）。
 *
 * 只有客户 / 电话 / 安装地址三个 `<span>` 带这个属性（`productionDays` **不带**）。
 * 算法（逐字照抄，步长 0.5px，下限 `max(6, base/2)`，停止条件 `scrollWidth > width + 1`）：
 *
 * ```js
 * el.style.fontSize = "";                    // ① 清掉内联字号，回到 CSS 的 metaFontSize
 * const w = el.getBoundingClientRect().width;
 * if (w <= 0) return;                        // ② 不可见就跳过
 * const prevOverflow = el.style.overflow;
 * el.style.overflow = "visible";             // ③ 测量期间别被 overflow:hidden 干扰
 * const base = parseFloat(getComputedStyle(el).fontSize);
 * const floor = Math.max(6, 0.5 * base);
 * let f = base;
 * while (el.scrollWidth > w + 1 && f > floor) { f -= 0.5; el.style.fontSize = f + "px"; }
 * el.style.overflow = prevOverflow;          // ④ 复原
 * ```
 *
 * ⚠️ **第 ① 步会抹掉「元素微调」面板给这三个字段设的字号**（`el.style.fontSize = ""`
 * 清的是**整条内联声明**，而元素配置的 `font-size` 正是靠内联样式生效的）。
 * **这是旧版的真实行为（:860），不是 bug，照抄**：面板里设的字号当下能看到，
 * 但下一次预览刷新 / 打印都会先被清掉，再按内容长度重算。7 个不带 `data-shrink-fit`
 * 的元素（编号/日期/标题/二维码/生产天数/金额/说明）不受影响。
 *
 * 本函数**幂等**（每次跑都先清内联字号），可重复调用。
 */
export function applyShrinkFit(container: HTMLElement | null): void {
  if (!container) return // :856
  for (const el of Array.from(container.querySelectorAll<HTMLElement>('[data-shrink-fit]'))) {
    el.style.fontSize = '' // :860 ⚠️ 见上：会抹掉元素微调设的字号，旧版如此
    const width = el.getBoundingClientRect().width // :861
    if (width <= 0) continue // :862
    const prevOverflow = el.style.overflow // :863
    el.style.overflow = 'visible' // :864
    const base = parseFloat(getComputedStyle(el).fontSize) // :865
    const floor = Math.max(6, 0.5 * base) // :866
    let size = base
    while (el.scrollWidth > width + 1 && size > floor) {
      size -= 0.5
      el.style.fontSize = size + 'px' // :868-869
    }
    el.style.overflow = prevOverflow // :870
  }
}

/**
 * 列宽拖拽 —— 给**第一张** `.receipt2-page` 的 `thead th` 逐个挂 6px 手柄（旧版 `pe` :874-945）。
 *
 * 行为要点（全部照旧版）：
 * - 入口先跑一次 `applyShrinkFit(container)`（:854-873），再删光旧手柄（:874-876，**幂等**）；
 * - **只看第一页**，`thead th` 少于 2 个直接返回，**最后一列不给手柄**（:883）；
 * - 拖拽时把像素位移换算成百分比（`(clientX - startX) / 表宽 * 100`），
 *   **成对调整相邻两列**（当前列 `+Δ`、右列 `-Δ`，各自下限 3%），并同步写到容器内**所有** `.receipt2-table`
 *   的 `thead th`（多页同步，:915-920）—— 只写 `th`，`td` 靠 `table-layout: fixed` 跟随；
 * - `mouseup` 时用**实测宽度**重算全部 10 列（写过 style 的读 style，没写过的按
 *   `rect.width / 表宽 * 100` 回退），`Math.round(x * 10) / 10` 保留 1 位小数，
 *   **当场写盘**（:927-939）。
 *
 * 有意偏离（共 1 处，见函数内 `表宽为 0` 的注释）。
 *
 * @param container 预览容器（里面是 `.receipt2-page` / `.receipt2-table` 那套 HTML）
 * @param widths    当前列宽数组（10 个百分比）。`mouseup` 时**原地写回**（等价旧版 `n.value = [...]`）；
 *                  传 `ref` 的 `.value` 进来即可拿到响应式更新。
 * @param onChange  写完盘后的通知口（旧版没有这个参数 —— 旧版直接改自己的 ref）。
 */
export function initColumnResize(
  container: HTMLElement | null,
  widths: ColumnWidths,
  onChange?: (widths: ColumnWidths) => void,
): void {
  if (!container) return // :853
  applyShrinkFit(container) // :854-873 —— 缩字在挂手柄之前跑
  container.querySelectorAll('.r2-resize-handle').forEach((el) => el.remove()) // :874-876

  const page = container.querySelector<HTMLElement>('.receipt2-page') // :877 —— 只看第一页
  if (!page) return // :878
  const heads = Array.from(page.querySelectorAll<HTMLElement>('thead th')) // :879
  if (heads.length < 2) return // :880

  heads.forEach((th, i) => {
    if (i === heads.length - 1) return // :883 —— 最后一列不给手柄
    th.style.position = 'relative' // :884-885
    th.style.overflow = 'visible'

    const handle = document.createElement('div')
    handle.className = 'r2-resize-handle'
    handle.title = '拖动调整列宽' // :888
    handle.style.cssText = HANDLE_CSS // :889-890
    handle.addEventListener('mouseenter', () => {
      handle.style.background = HANDLE_BG_HOVER // :891-894
    })
    handle.addEventListener('mouseleave', () => {
      handle.style.background = 'transparent' // :895-898
    })

    handle.addEventListener('mousedown', (ev: MouseEvent) => {
      ev.preventDefault() // :901
      const startX = ev.clientX // :902

      // 多页同步用：容器内**所有**表格（旧版 :903）
      const tables = Array.from(container.querySelectorAll<HTMLElement>('.receipt2-table'))
      const table = tables[0] ?? page.closest<HTMLElement>('table') // :904
      if (!table) return
      const tableWidth = table.getBoundingClientRect().width // :905
      // 有意偏离：旧版不防 `表宽 === 0`，此时 `width / 0` 会算出 NaN，
      // 一路写进 style 与 localStorage（`sanitizeColumnWidths` 会把 NaN 变成 3，整组列宽被清零）。
      // 表宽为 0 只在表格不可见时出现，正常拖拽路径到不了；这里直接罢工更安全。
      if (!tableWidth) return

      // 基准宽**按实测换算**，不读 style（旧版 :906-908），只在 mousedown 时算这一次
      const baseWidths = Array.from(table.querySelectorAll<HTMLElement>('thead th')).map(
        (t) => (t.getBoundingClientRect().width / tableWidth) * 100,
      )

      handle.style.background = HANDLE_BG_ACTIVE // :909

      const onMove = (e: MouseEvent) => {
        const delta = ((e.clientX - startX) / tableWidth) * 100 // :912
        const newLeft = Math.max(MIN_COLUMN_WIDTH, baseWidths[i] + delta) // :913
        const newRight = Math.max(MIN_COLUMN_WIDTH, baseWidths[i + 1] - delta) // :914
        // 只动相邻两列，合计守恒（除非撞到 3% 下限）；多页一起写（:915-920）
        for (const t of tables) {
          const cells = Array.from(t.querySelectorAll<HTMLElement>('thead th'))
          if (cells[i]) cells[i].style.width = newLeft + '%'
          if (cells[i + 1]) cells[i + 1].style.width = newRight + '%'
        }
      }

      const detach = () => {
        document.removeEventListener('mousemove', onMove) // :924
        document.removeEventListener('mouseup', onUp) // :925
        detachDrag = null
      }

      const onUp = () => {
        detach()
        handle.style.background = 'transparent' // :926

        // 用实测重算全部 10 列：写过 style 的读 style，没写过的回退到实测百分比（:927-935）
        const cells = Array.from(table.querySelectorAll<HTMLElement>('thead th'))
        const tableWidth2 = table.getBoundingClientRect().width // :928
        const next = cells.map((t) => {
          const raw = t.style.width
            ? parseFloat(t.style.width)
            : (t.getBoundingClientRect().width / tableWidth2) * 100
          return Math.round(10 * raw) / 10 // :934 —— 保留 1 位小数
        })
        widths.splice(0, widths.length, ...next) // :929 写回（旧版 `n.value = [...]`）
        saveColumnWidths(next) // :936-939 —— 拖一次写一次，没有保存按钮
        onChange?.(next)
      }

      document.addEventListener('mousemove', onMove) // :941
      document.addEventListener('mouseup', onUp) // :942
      detachDrag = detach
    })

    th.appendChild(handle) // :944
  })

  activeContainer = container
}

/**
 * 摘掉手柄与事件监听。
 *
 * **新增导出**（旧版没有这个函数）：旧版靠 `pe()` 开头的幂等清场（:874-876）来换手柄，
 * 而拖拽中挂到 `document` 上的 mousemove/mouseup 只在 mouseup 里摘。
 * 新版需要一个能主动收口的入口（组件卸载 / 退出预览时用）。
 */
export function disposeColumnResize(): void {
  detachDrag?.() // 拖拽进行中被卸载 → 立刻摘掉 document 上的监听
  activeContainer?.querySelectorAll('.r2-resize-handle').forEach((el) => el.remove())
  activeContainer = null
}

/** 便捷入口 —— 三个函数本就可直接 import，这里只是给组件一个成套的引用。 */
export function useReceipt2Preview() {
  return { applyShrinkFit, initColumnResize, disposeColumnResize }
}
