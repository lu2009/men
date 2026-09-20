/**
 * Progress 订单进度页的**「导出表格」**（2026-09-20 从 `Progress.vue` 搬出，逻辑逐字未改）。
 *
 * 搬出前的行段（参照提交 `f097a9b1`，即本次拆分动工前）：`Progress.vue:1984-2153`
 * （连续一整段，170 行，**2 个声明**）—— 拆分方案里的 **P11**。段首那行分区横幅
 * （`// ── C2. 导出表格（旧版 z，§4.6）…`）与它下面 13 行的块注释（五条反直觉的照抄点：
 * 导的是筛选后、标题/统计两行文案、**会多出一行重复表头**、行高按 `➞` 个数、第 4 列 `wrapText`）
 * **一起搬来**；工厂体内**与 REF 一字不差、相对顺序也不动**（除下表那 10 项注入面上的 11 条规则 / 14 处改写）。
 *
 * ⚠️ **横幅与段内注释的保真不在守卫里**（核心 `sliceFn` 从**声明**起切，它们根本不进切片）——
 *   唯一证据是「整段与 REF 同区间逐字节比」（判据 R39：归一化掉工厂那层统一缩进之后，
 *   剩余差异必须**恰好等于在案的注入改写，不多不少**）。别拿「守卫绿」当它的证据。
 *
 * ⚠️ **本段里没有顶层非声明语句**（没有 `watch(` / `if(` 那一类）—— 实测 REF 1984–2153
 *   的顶层语句**全是那 2 个声明**（`async function exportTable` 1998 · `function exportStamp` 2140）
 *   ⇒ memory `split-guard-blind-spots` 第 4 类不适用。
 *
 * ⚠️ **工厂式**（`useProgressExport(deps)`）⇒ **一条 `export` 改写都没有**
 *   （函数体内写 `export` 是 `TS1184`；与 P2/P3/P5/P7/P8/P9/P10/P6 同形）。
 *
 * ── 注入面：**10 项**（真 TS 解析器量出段外引用 11 个，减掉走 `import` 的 `ExcelJSInterop`）──
 *
 * | 名字 | REF 声明行 | 来自 | 段内用点 |
 * |---|---|---|---|
 * | `filteredRows` | 1250 | **P6（本文件同批搬的 `useProgressColumns`）** | 2054, 2075 |
 * | `searchText` | 1396 | P7 / Task 4（`useProgressToolbar`） | 2040 |
 * | `exporting` | 1389 | P7 / Task 4（**写**：`= true` / `= false`） | 1999, 2135 |
 * | `message` | 352 | 壳区（`useMessage()`） | 2131, 2133 |
 * | `dateRange` | 1960 | P10 / Task 6（`useProgressStats`） | 2055（同行两处） |
 * | `moveFans` `pingFans` | 1875 / 1898 | P10 | 2056 |
 * | `lightWindows` `showerFans` | 1912 / 1923 | P10 | 2057 |
 * | `others` | 1941 | P10 | 2058 |
 *
 * ⚠️ **`ExcelJSInterop` 走 `import type`、不进 `deps`**：它是模块级 `type`（REF 1383），
 *   归 **P7 / Task 4** 搬（因为它物理上落在 P7 的连续可搬区间 1374–1449 里 ——
 *   「归谁消费 ≠ 归谁搬」，见方案 R35 裁决），由 `useProgressToolbar.ts` `export`
 *   ⇒ 本文件从那里 `import type`。段内只有 2005 一处用它（`as unknown as ExcelJSInterop`）。
 *
 * ⚠️ **P6 那个 `columns` 不在注入清单里**（简报里曾经有，是凭空多出来的）：本段用的是
 *   **自己的局部变量 `cols`**（`const cols = [` @ REF 2012、`ws.columns = cols` @ 2037），
 *   与 P6 那个 `DataTableColumn<ProgressRow>[]` **同名不同物**。配上就是一个没人用的形参
 *   （`noUnusedParameters` 开着 ⇒ 直接红）。
 *
 * ── 回传 1 项（2 个声明里真被段外消费的 1 个）──
 *   · `exportTable` —— **只被模板用**（1 处，模板 REF **129** 的 `@click="exportTable"`）。
 *   ⚠️ **不回传的 1 个**：`exportStamp`（段外脚本 0、模板 0）—— 它只被 `exportTable`
 *     自己内部用（REF **2128** 的 `筛选结果_${exportStamp()}.xlsx`）⇒ **跟着本块走，不借出去**。
 *
 * ⚠️ **调用点必须在 P10（统计行）之后**：本块注入 P10 的 6 个统计量 ⇒ 放回原位会早读
 *   一堆 TDZ 变量（`TS2448`）。壳侧因此把 `useProgressStats(...)` 的**结果先接住**
 *   （`const progressStats = …`）再从中取那 6 个喂进来 —— 与壳里 `progressUpdateDialog`
 *   那个「先接住工厂结果再解构」同形。
 *
 * ⚠️ **搬迁时的文本改写 = 11 条规则、命中 14 处**（`deps.` 化），逐条登记在守卫的 `rewrites` 里。
 *   两条已单独核过的边界：
 *   · `message.success(` / `message.error(` **写成带左括号的整串**（不是裸 `message.`）——
 *     段内 2133 那句 `e instanceof Error ? e.message : String(t)` 里的 `message` 后面跟的是
 *     **空格**，裸 `message.` 恰好不会打到它，但带 `(` 才是能自证的那一种，不靠「碰巧」；
 *   · 9 个统计量各自带 `.value`（`dateRange.value` 命中 2 处 —— `.earliest` 与 `.latest`）。
 *
 * ⚠️ **`await import('exceljs')` 那一句一个字都没动** —— 差分台把它换成 `__exceljs()` 是
 *   台子自己的事（测的是**导出内容**，不是打包/互操作），搬迁不许碰它。
 */

import type { MessageApi } from 'naive-ui'
import type { ComputedRef, Ref } from 'vue'
import type { ExcelJSInterop } from './useProgressToolbar'
import type { ProgressRow } from '../../utils/progressRow'

/**
 * `useProgressExport()` 的注入面。**10 项**（见文件头那张表）。
 *
 * ⚠️ **注入的是 ref / API 对象本身，不是 `.value` 副本**（与 P2/P3/P5/P6/P7/P8/P9/P10 同一口径）——
 *   `exporting` 本块还要**写**（`deps.exporting.value = true/false`）。
 */
export interface ProgressExportDeps {
  /** 筛选后的行（P6 `useProgressColumns` 回传，REF 1250 = 旧版 `no`）—— 导的就是它，不是当前页。 */
  filteredRows: ComputedRef<ProgressRow[]>
  /** 搜索词（P7 `useProgressToolbar` 回传，REF 1396）—— 标题行 `筛选结果: {搜索词}`。 */
  searchText: Ref<string>
  /** 导出中（P7 回传，REF 1389）—— 本块**写**它两次（进 try 置 true、finally 置 false）。 */
  exporting: Ref<boolean>
  /** 成功 / 失败提示（页面 `useMessage()`）。 */
  message: MessageApi
  /** 日期区间（P10 `useProgressStats` 回传，REF 1960）—— 统计行那句「时间: a 至 b」。 */
  dateRange: ComputedRef<{ earliest: string; latest: string }>
  /** 移门扇数（P10 回传，REF 1875）—— 统计行。 */
  moveFans: ComputedRef<number>
  /** 平开门扇数（P10 回传，REF 1898）—— 统计行。 */
  pingFans: ComputedRef<number>
  /** 移门亮窗（P10 回传，REF 1912）—— 统计行。⚠️ 措辞与工具条的 `statsTail` **不同**（少了「个数」）。 */
  lightWindows: ComputedRef<number>
  /** 淋浴房扇数（P10 回传，REF 1923）—— 统计行。 */
  showerFans: ComputedRef<number>
  /** 其它（P10 回传，REF 1941）—— 统计行。 */
  others: ComputedRef<number>
}

/**
 * 导出表格（旧版 `z`，§4.6）：纯前端 ExcelJS 造表 → `writeBuffer()` → Blob → `<a download>`。
 *
 * ⚠️ 本块**写** `deps.exporting`（不是只读）—— 与其余九项不同。
 */
export function useProgressExport(deps: ProgressExportDeps) {
  // ── C2. 导出表格（旧版 `z`，§4.6）──────────────────────────────────────────
  /*
   * 旧版是**纯前端** ExcelJS 造一个「筛选结果」表 → `writeBuffer()` → Blob → `<a download>`。
   * 列 / 底色 / 行高 / 文案**逐项照抄**，包括下面这些反直觉的地方：
   *
   *  ① 导的是**筛选后**的 `no`（= 本页 `filteredRows`），不是当前页、也不是全量；
   *  ② 标题行 `筛选结果: {搜索词}`、统计行 `统计信息: {n}条记录 | …`（⚠️ 见下面的文案差异）；
   *  ③ **会多出一行重复表头** —— `ws.columns = cols` 让 ExcelJS 自己插了一行表头，
   *     随后旧版又 `addRow(cols.map(c => c.header))` 手工加了一行带样式（蓝底/居中/高 25）的表头，
   *     于是成品里 row3 / row4 是两行一样的表头。**这是旧版线上导出的真实样子，照抄不清理**
   *     （真要清理属于「改输出」，得先拍板；已记在 `docs/2026-09-19-progress-analysis.md` §4.6）。
   *  ④ 行高按 `生产进度` 里 `➞` 的个数算：`max(22, 18*(n+1))`（`n=0` 时按 1 算 ⇒ 22）；
   *  ⑤ 「生产进度」是**第 4 列**，只有它的对齐带 `wrapText`。
   */
  async function exportTable() {
    deps.exporting.value = true
    try {
      // exceljs 只在**真点导出**时才下载（浏览器包 ~950KB，不能进主 chunk）。
      // ⚠️ 写法与 `utils/printService.ts` 引 vue-plugin-hiprint 同一套路：exceljs 的
      //    `browser` 字段指向 UMD 包（`dist/exceljs.min.js`），**没有 ESM 默认导出**，
      //    所以「类型走 type-only import、运行期双取（命名空间 / default）」。
      const mod = (await import('exceljs')) as unknown as ExcelJSInterop
      const WorkbookCtor = mod.Workbook ?? mod.default?.Workbook
      if (!WorkbookCtor) throw new Error('exceljs 未正确加载')
      const wb = new WorkbookCtor()
      const ws = wb.addWorksheet('筛选结果')

      // 列定义（header / key / width）逐字照抄旧版。
      const cols = [
        { header: '日期', key: 'date', width: 15 },
        { header: '客户', key: 'customer', width: 15 },
        { header: '单号', key: 'orderNo', width: 15 },
        { header: '生产进度', key: 'progress', width: 30 },
        { header: '型材', key: 'profile', width: 12 },
        { header: '颜色', key: 'color', width: 12 },
        { header: '底玻', key: 'bottomGlass', width: 12 },
        { header: '面玻', key: 'topGlass', width: 12 },
        { header: '玻璃厚', key: 'glassThick', width: 10 },
        { header: '开向', key: 'direction', width: 12 },
        { header: '扇数', key: 'fanCount', width: 12 },
        { header: '门洞高', key: 'height', width: 10 },
        { header: '门洞宽', key: 'width', width: 10 },
        { header: '墙厚', key: 'wallThick', width: 10 },
        { header: '轨道长', key: 'trackLen', width: 10 },
        { header: '亮窗总高', key: 'brightHeight', width: 12 },
        { header: '数量', key: 'quantity', width: 10 },
        { header: '平方数', key: 'area', width: 10 },
        { header: '金额', key: 'amount', width: 12 },
        { header: '备注', key: 'remark', width: 20 },
        { header: '安装地址', key: 'address', width: 20 },
        { header: '打单人', key: 'creator', width: 12 },
        { header: '业务员', key: 'salesman', width: 12 },
      ]
      ws.columns = cols

      // 第 1 行：标题（合并 → 蓝底 FFE6F4FF → 16 号粗体居中 → 高 30）
      ws.insertRow(1, [`筛选结果: ${deps.searchText.value}`])
      ws.mergeCells(1, 1, 1, cols.length)
      const title = ws.getRow(1)
      title.height = 30
      title.font = { size: 16, bold: true }
      title.alignment = { vertical: 'middle', horizontal: 'center' }
      title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4FF' } }

      // 第 2 行：统计（黄底 FFFFF7E6；行高按**字符数** `max(25, 18*ceil(len/80))`，不是按行数）
      //
      // ⚠️ 这句与工具条上的 `statsTail` **不是同一串**，两处措辞不同、别合并成一个函数：
      //    · 「N条记录」后面**直接**跟 `" | 时间:"`（工具条那句是「N 条记录 | 时间:」，中间有空格）；
      //    · 这里是「**移门亮窗**」，工具条上是「**移门亮窗个数**」。
      const statLine =
        `统计信息: ${deps.filteredRows.value.length}条记录` +
        ` | 时间: ${deps.dateRange.value.earliest} 至 ${deps.dateRange.value.latest}` +
        ` | 移门扇数: ${deps.moveFans.value} | 平开门扇数: ${deps.pingFans.value}` +
        ` | 移门亮窗: ${deps.lightWindows.value} | 淋浴房扇数: ${deps.showerFans.value}` +
        ` | 其它: ${deps.others.value}`
      ws.insertRow(2, [statLine])
      ws.mergeCells(2, 1, 2, cols.length)
      const statRow = ws.getRow(2)
      statRow.height = Math.max(25, 18 * Math.ceil(statLine.length / 80))
      statRow.font = { size: 11, bold: true }
      statRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      statRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E6' } }

      // 第 3/4 行：表头（见函数头 ③，旧版就是这么摆的）
      const header = ws.addRow(cols.map((c) => c.header))
      header.height = 25
      header.font = { bold: true, size: 10 }
      header.alignment = { vertical: 'middle', horizontal: 'center' }
      header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9ECFF' } }

      // 数据行：值全部 `|| ''`（`0` 也会落成空串，与旧版一致）；整行居中，第 4 列带 wrapText。
      for (const r of deps.filteredRows.value) {
        const row = ws.addRow([
          r['日期'] || '',
          r['客户'] || '',
          r['单号'] || '',
          r['生产进度'] || '',
          r.profile || '',
          r.color || '',
          r.bottom_glass || '',
          r.face_glass || '',
          r.glass_thickness || '',
          r.direction || '',
          r.fans || '',
          r.door_height || '',
          r.door_width || '',
          r.wall_thickness || '',
          r.track_length || '',
          r.light_window_height || '',
          r.quantity || '',
          r.square || '',
          r.amount || '',
          r.remark || '',
          r.install_address || '',
          r['打单人'] || '',
          r['业务员'] || '',
        ])
        row.alignment = { vertical: 'middle', horizontal: 'center' }
        row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        const arrows = ((r['生产进度'] || '').match(/➞/g) || []).length
        row.height = Math.max(22, 18 * (arrows > 0 ? arrows + 1 : 1))
      }

      // 所有单元格加细边框（旧版在写完数据后统一 `eachRow`/`eachCell` 刷一遍）
      ws.eachRow((row) =>
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          }
        }),
      )

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // 文件名：`筛选结果_{YYYY-MM-DD_HH-mm-ss}.xlsx`（旧版把 `toLocaleString('zh-CN')` 的
      // `/` `:` 空格分别换成 `-` `-` `_`；照抄它的**字符替换**而不是手写日期格式）
      a.download = `筛选结果_${exportStamp()}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      deps.message.success('导出成功')
    } catch (e) {
      deps.message.error('导出失败: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      deps.exporting.value = false
    }
  }

  /** 旧版导出文件名里的时间戳（`toLocaleString('zh-CN', …)` 后逐字符替换）。 */
  function exportStamp(): string {
    return new Date()
      .toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      .replace(/\//g, '-')
      .replace(/:/g, '-')
      .replace(/\s/g, '_')
  }

  return { exportTable }
}
