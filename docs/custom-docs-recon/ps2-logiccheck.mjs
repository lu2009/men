// 自定义生产单2 · 逻辑层比对 —— 与 `gs2-logiccheck.mjs` 同款。
//
// 三块：
//   A. 读盘清洗（§2.3：与 GS2 逐字段相同，只有默认列是 9 列）
//   B. 分页（§5：与 GS2 完全一致，无本单据独有分支）
//   C. **空行渲染（§6）—— 本单据唯一的真逻辑差异**，逐例打印对照表
import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')

const _PS2 = _ROOT + '/app/node_modules/.cache/ps2-logiccheck-bundle.mjs'
const _GS2 = _ROOT + '/app/node_modules/.cache/ps2-logiccheck-gs2.mjs'
await _build({
  entryPoints: ['/Users/aaa/Desktop/door-main/app/src/utils/productionsheet2/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral', outfile: _PS2, logLevel: 'warning',
})
await _build({
  entryPoints: ['/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral', outfile: _GS2, logLevel: 'warning',
})
const ps2 = await import(_PS2)
const gs2 = await import(_GS2)

const results = []
const eq = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n  expected: ${JSON.stringify(expected)}\n  actual  : ${JSON.stringify(actual)}`}`)
}

const def = ps2.createDefaultConfig()

// ---------------- A. sanitize（§2.3） ----------------
eq('读盘 undefined → 全默认', ps2.sanitizeConfig(undefined), def)
eq('默认列 = 9 列', def.table.columns.length, 9)

const noPadding = ps2.sanitizeConfig({ paper: { widthMm: 200, heightMm: 100 }, table: {}, print: {} })
eq('决策1 paddingMm 缺字段 → 3（旧版 NaN）', noPadding.paper.paddingMm, 3)
eq('缺陷2 paddingMm:null → 0（照抄）', ps2.sanitizePaper({ paddingMm: null }, def.paper).paddingMm, 0)
eq('paddingMm:0 → 0（合法值）', ps2.sanitizePaper({ paddingMm: 0 }, def.paper).paddingMm, 0)
eq('paddingMm:"abc" → 3', ps2.sanitizePaper({ paddingMm: 'abc' }, def.paper).paddingMm, 3)
eq('widthMm:0 → 297（|| 语义）', ps2.sanitizePaper({ widthMm: 0 }, def.paper).widthMm, 297)
eq('orientation:乱码 → landscape', ps2.sanitizePaper({ orientation: 'x' }, def.paper).orientation, 'landscape')

eq('title 空串 → 「生产单」', ps2.sanitizeConfig({ table: { title: '' } }).table.title, '生产单')
eq('headerFontSize:0 → 13.5', ps2.sanitizeConfig({ table: { headerFontSize: 0 } }).table.headerFontSize, 13.5)

const merged = ps2.sanitizeConfig({ table: { columns: [{ key: 'door', widthMm: 99 }, { extra: true }] } }).table.columns
eq('columns 按下标合并，长度照存盘', merged.length, 2)
eq('columns[0] 覆盖 widthMm、其余补默认（第 1 列是 door）', merged[0], { ...def.table.columns[0], widthMm: 99 })
// `{...默认列[i], ...存盘列[i]}` —— 存盘对象**叠在**默认之上，连 `key` 也能被改掉
eq(
  'columns[0] 存盘的 key 会盖掉默认列的 key（不做合法性校验）',
  ps2.sanitizeConfig({ table: { columns: [{ key: 'doorsheet' }] } }).table.columns[0],
  { ...def.table.columns[0], key: 'doorsheet' },
)
eq('columns[1] 存盘字段叠在默认列之上', merged[1], { ...def.table.columns[1], extra: true })
eq('columns 存盘为空数组 → 回默认 9 列', ps2.sanitizeConfig({ table: { columns: [] } }).table.columns.length, 9)
eq('columns 存 11 列 → 后 2 列原样保留', ps2.sanitizeConfig({ table: { columns: Array.from({ length: 11 }, (_, i) => ({ key: 'k' + i })) } }).table.columns.length, 11)

eq('copies clamp 1–99', [
  ps2.sanitizeConfig({ print: { copies: 0 } }).print.copies,
  ps2.sanitizeConfig({ print: { copies: 500 } }).print.copies,
  ps2.sanitizeConfig({ print: { copies: '3' } }).print.copies,
], [1, 99, 3])

eq('§8 两个 localStorage 键名', ps2.PRODUCTIONSHEET2_STORAGE_KEYS, {
  template: 'production_sheet2_template_v1',
  selectedPrinter: 'production_sheet2_printer_v1',
})

// ---------------- B. paginate（§5） ----------------
eq('空数据 → [[]]', ps2.paginate([], [], def), [[]])
eq('常量照抄（8 / 10 / 20）', [ps2.PAGE_BUDGET_TITLE_MM, ps2.PAGE_BUDGET_EXTRA_MM, ps2.FALLBACK_ROW_HEIGHT_MM], [8, 10, 20])
eq('默认配置预算 = 186mm（与 GS2 同纸同边距）', 210 - 6 - ps2.PAGE_BUDGET_TITLE_MM - ps2.PAGE_BUDGET_EXTRA_MM, 186)

const rows = Array.from({ length: 5 }, (_, i) => ({ door: 'r' + i }))
eq('贪心切页', ps2.paginate(rows, [100, 50, 100, 50, 100], def).map((p) => p.map((r) => r.door)), [['r0', 'r1'], ['r2', 'r3'], ['r4']])
eq('每页预算相同（无页脚）—— 末页也能装满', ps2.paginate(rows, [60, 60, 60, 60, 60], def).map((p) => p.length), [3, 2])
eq('量测缺失 → 按 20mm 估', ps2.paginate(rows, [], def).map((p) => p.length), [5])
eq('量测值 0 不被 ?? 替换成 20', ps2.paginate(Array.from({ length: 12 }, (_, i) => ({ i })), Array(12).fill(0), def).length, 1)
eq('单行超页 → 静默溢出，不切分', ps2.paginate([{ a: 1 }, { a: 2 }], [500, 10], def).map((p) => p.length), [1, 1])
eq('§9 本单据没有 getItemsPerPage（导出面里不存在）', 'getItemsPerPage' in ps2, false)

// ---------------- C. 空行渲染（§6）—— 本单据唯一的真逻辑差异 ----------------
// 期望值**逐字抄自 §6.2 那张表**（不是抄自实现）：
//   PS2 `A`：不 filter；空段 → `<div class="ps2-line">&nbsp;</div>`；`o.length === 0` 是死分支。
//   GS2 `A`：`filter(Boolean)` 丢空段；全空 → 空串。
const L = (s) => `<div class="ps2-line">${s}</div>`
const N = '<div class="ps2-line">&nbsp;</div>'
const G = (s) => `<div class="gs2-line">${s}</div>`

const cases = [
  ['`""`（空串）', '', [N], []],
  ['`"  "`（全空格）', '  ', [N], []],
  ['`"A<br>B"`', 'A<br>B', [L('A'), L('B')], [G('A'), G('B')]],
  ['`"A<br><br>B"`', 'A<br><br>B', [L('A'), N, L('B')], [G('A'), G('B')]],
  ['`"A<br>"`', 'A<br>', [L('A'), N], [G('A')]],
  ['`"<br>A"`', '<br>A', [N, L('A')], [G('A')]],
]

console.log('\n========== §6.2 空行渲染逐例对照（PS2 vs GS2） ==========')
console.log('| 输入 e | 段数(PS2) | PS2 输出 | GS2 输出 |')
console.log('|---|---|---|---|')
for (const [label, input, expPs2, expGs2] of cases) {
  const actualPs2 = ps2.renderMultiline(input)
  const actualGs2 = gs2.renderMultiline(input)
  eq(`§6.2 ${label} → PS2`, actualPs2, expPs2.join(''))
  eq(`§6.2 ${label} → GS2（对照组，未被改动）`, actualGs2, expGs2.join(''))
  const segs = actualPs2.split('</div>').length - 1
  console.log(`| ${label} | ${segs} | \`${actualPs2}\` | \`${actualGs2}\` |`)
}
eq('§6.2 PS2 永不返回空串（`o.length === 0` 是死分支）', ps2.renderMultiline('  <br> <br> '), N + N + N)
eq('§6.2 GS2 对照：全空 → 空串', gs2.renderMultiline('  <br> <br> '), '')
eq('§6.2 undefined → PS2 占位行 / GS2 空串', [ps2.renderMultiline(undefined), gs2.renderMultiline(undefined)], [N, ''])

// 转义仍走同一套（`&` 必须第一个替换）
eq('§6.2 占位行不吞转义', ps2.renderMultiline('&<>"\''), '<div class="ps2-line">&amp;&lt;&gt;&quot;&#39;</div>')

// §6.3 连带影响：常为空串的列不再塌成 0（行高 9mm ⇒ 改变分页）
const emptyRow = { doorframe: '', windows: '' }
eq(
  '§6.3 doorframe 空串 → PS2 出占位行',
  ps2.renderCell('doorframe', emptyRow),
  N,
)
eq('§6.3 同一行 GS2 落到 default → 空串', gs2.renderCell('doorframe', emptyRow), '')
eq(
  '§6.3 windows 空串 → PS2 出占位行',
  ps2.renderCell('windows', emptyRow),
  N,
)
eq('§6.3 doorImg 不受影响（不走 renderMultiline）', ps2.renderCell('doorImg', { doorImg: '' }), '')
eq('§6.3 order 不受影响', ps2.renderCell('order', { OrderID: '' }), '')

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
if (failed.length) process.exitCode = 1
