

// —— 自带打包 ——
// 原本这里直接 `import ... from '.../*.ts'`，但 Node 的 ESM 解析不了 TS 内部的无扩展名导入
// （`./defaults`）。之前能跑是因为 /tmp 里有预打的 bundle，那是临时产物、仓库里存不住。
// 现在脚本自己在开头调一次 esbuild 打包，于是能长期留在仓库里、可重跑。
import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')
const _OUT = _ROOT + '/app/node_modules/.cache/gs2-logiccheck-bundle.mjs'
await _build({
  entryPoints: ['/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT, logLevel: 'warning',
})
const _m = await import(_OUT)
const { createDefaultConfig, sanitizeConfig, sanitizePaper, paginate, PAGE_BUDGET_TITLE_MM, PAGE_BUDGET_EXTRA_MM, FALLBACK_ROW_HEIGHT_MM, renderPage, buildRootHtml, buildDocumentHtml, css } = _m

const results = []
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n  expected: ${JSON.stringify(expected)}\n  actual  : ${JSON.stringify(actual)}`}`)
}

const def = createDefaultConfig()

// ---------------- sanitize: §6.4 逐字段 ----------------
eq('读盘 undefined → 全默认', sanitizeConfig(undefined), def)

// 决策 1：paddingMm 缺字段 —— 旧版这里是 NaN
const noPadding = sanitizeConfig({ paper: { widthMm: 200, heightMm: 100 }, table: {}, print: {} })
eq('决策1 paddingMm 缺字段 → 3（旧版 NaN）', noPadding.paper.paddingMm, 3)
eq('决策1 修复后分页预算不再是 NaN', noPadding.paper.heightMm - 2 * noPadding.paper.paddingMm - 18, 76)

// 缺陷 2 照抄：null → 0（不回落 3）
eq('缺陷2 paddingMm:null → 0（照抄）', sanitizePaper({ paddingMm: null }, def.paper).paddingMm, 0)
eq('paddingMm:0 → 0（合法值）', sanitizePaper({ paddingMm: 0 }, def.paper).paddingMm, 0)
eq('paddingMm:"abc" → 3', sanitizePaper({ paddingMm: 'abc' }, def.paper).paddingMm, 3)
eq('paddingMm:5 → 5', sanitizePaper({ paddingMm: 5 }, def.paper).paddingMm, 5)

eq('widthMm:0 → 297（|| 语义）', sanitizePaper({ widthMm: 0 }, def.paper).widthMm, 297)
eq('heightMm:"210" → 210', sanitizePaper({ heightMm: '210' }, def.paper).heightMm, 210)
eq('orientation:"portrait" 保留', sanitizePaper({ orientation: 'portrait' }, def.paper).orientation, 'portrait')
eq('orientation:乱码 → landscape', sanitizePaper({ orientation: 'x' }, def.paper).orientation, 'landscape')

eq('title 空串 → 默认', sanitizeConfig({ table: { title: '' } }).table.title, '玻璃合片单')
eq('borderColor 空串 → 默认', sanitizeConfig({ table: { borderColor: '' } }).table.borderColor, '#444444')
eq('headerFontSize:0 → 13.5', sanitizeConfig({ table: { headerFontSize: 0 } }).table.headerFontSize, 13.5)
eq('headerFontSize:"12" → 12', sanitizeConfig({ table: { headerFontSize: '12' } }).table.headerFontSize, 12)

// columns：按下标合并（缺字段补默认、多出的列原样保留、key 不校验）
const merged = sanitizeConfig({ table: { columns: [{ key: 'client', widthMm: 99 }, { extra: true }] } }).table.columns
eq('columns 按下标合并，长度照存盘（不是 8）', merged.length, 2)
eq('columns[0] 覆盖 widthMm、其余补默认', merged[0], { ...def.table.columns[0], widthMm: 99 })
// `{...默认列[i], ...存盘列[i]}` —— 存盘对象**叠在**默认之上，不是替换
eq('columns[1] 存盘字段叠在默认列之上', merged[1], { ...def.table.columns[1], extra: true })
eq('columns 存盘为空数组 → 回默认 8 列', sanitizeConfig({ table: { columns: [] } }).table.columns.length, 8)
eq('columns 存盘非法 → 回默认 8 列', sanitizeConfig({ table: { columns: 'x' } }).table.columns.length, 8)
eq(
  'columns 存 10 列 → 后 2 列无默认可补，原样保留',
  sanitizeConfig({ table: { columns: Array.from({ length: 10 }, (_, i) => ({ key: 'k' + i })) } }).table.columns.length,
  10,
)
eq('未知 key 的列渲染成空单元格', renderPage([{ client: 'A' }], 0, 1, { ...def, table: { ...def.table, columns: [{ key: 'nope', label: 'X', widthMm: 10, fontSize: 10, rowHeightMm: 5, fontColor: '#000', visible: true }] } }).includes('<td style="width:10mm;font-size:10pt;color:#000;line-height:5mm;"></td>'), true)

eq('copies clamp 1–99', [
  sanitizeConfig({ print: { copies: 0 } }).print.copies,
  sanitizeConfig({ print: { copies: 500 } }).print.copies,
  sanitizeConfig({ print: { copies: '3' } }).print.copies,
], [1, 99, 3])

// ---------------- paginate: §5.2 ----------------
eq('空数据 → [[]]', paginate([], [], def), [[]])
eq('常量照抄', [PAGE_BUDGET_TITLE_MM, PAGE_BUDGET_EXTRA_MM, FALLBACK_ROW_HEIGHT_MM], [8, 10, 20])

// 默认纸：budget = 210 - 6 - 18 = 186
const budget = 210 - 6 - PAGE_BUDGET_TITLE_MM - PAGE_BUDGET_EXTRA_MM
eq('默认配置预算 = 186mm', budget, 186)

const rows = Array.from({ length: 5 }, (_, i) => ({ client: 'r' + i }))
const heights = [100, 50, 100, 50, 100]
// 100 → 100; +50=150; +100=250>186 → 翻页。页1=[r0,r1]; 100; +50=150; +100=250>186 → 翻页。页2=[r2,r3]; 页3=[r4]
eq('贪心切页', paginate(rows, heights, def).map((p) => p.map((r) => r.client)), [['r0', 'r1'], ['r2', 'r3'], ['r4']])
eq('每页预算相同（无页脚）—— 末页也能装满', paginate(rows, [60, 60, 60, 60, 60], def).map((p) => p.length), [3, 2])
eq('量测缺失 → 按 20mm 估', paginate(rows, [], def).map((p) => p.length), [5])
eq('量测值 0 不被 ?? 替换成 20', paginate(Array.from({ length: 12 }, (_, i) => ({ i })), Array(12).fill(0), def).length, 1)
eq('单行超页 → 静默溢出，不切分', paginate([{ a: 1 }, { a: 2 }], [500, 10], def).map((p) => p.length), [1, 1])
eq('每页至少一行（首行必进）', paginate([{ a: 1 }], [999], def).length, 1)

// ---------------- §3.7 完整样子 dump ----------------
const row = {
  client: '张三',
  door: '断桥铝<br>香槟色',
  OrderID: '20260917-001',
  basicInfo: '2000*1000*100<br>开向：左开',
  lockImg: 'https://x/lock.png',
  doorsheet: '中空玻璃:5+12A+5<br>数量:2',
  doorImg: 'https://x/door.png',
  remark: '五金：执手<br>加配：无',
}
// §3.3 逐字模板是 `\n      <tbody>{{rows}}</tbody>`，§3.5 说「行与行直接首尾相接、</tr> 前无换行」
// ⇒ 末行 </tr> 必须**紧贴** </tbody>。（§3.7 的示意把 </tbody> 另起一行，与 §3.3/§3.5 冲突，
//    也与 GS:619-621 的源码拼接不符 —— 以源码和 §3.3/§3.5 为准。）
const adj = renderPage([row, row], 0, 1, def)
eq('末行 </tr> 紧贴 </tbody>（§3.3，非 §3.7 示意）', adj.includes('</tr></tbody>\n    </table>'), true)
// 行与行之间只靠下一行的前导 `\n  ` 分行
eq('行与行首尾相接', adj.includes('</tr>\n  <tr>'), true)

const pageHtml = renderPage([row, row], 0, 2, def)
const root = buildRootHtml([pageHtml, renderPage([row], 1, 2, def)], css(def))
console.log('\n================ §3.7 还原后的完整样子（默认配置，2 页，QR 未注入） ================')
console.log(root.slice(0, root.indexOf('.gs-root { background:#c0c0c0')) + '…[CSS 余下部分已省略]…' + root.slice(root.indexOf('</style>') ) )
console.log('\n================ 完整文档外壳 ================')
const doc = buildDocumentHtml('<X>')
console.log(doc)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
if (failed.length) process.exitCode = 1
