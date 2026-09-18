// 自定义生产单（ic=14） · 分页 / 清洗 逻辑比对。
//
// 覆盖施工图 §5.2（行高估算）/ §5.3（打包 —— ★ **首页与后续页预算不同**）/ §5.4（两联）/
// §2.4（读盘清洗 `z`）/ §2.1–§2.3（默认值）。
//
// ★ 期望值是**从 §5.2/§5.3 的公式独立算出来的**（不是抄实现），并在注释里给出推导。
//
// —— 自带打包 ——
import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')
const _OUT = _ROOT + '/app/node_modules/.cache/ps-logiccheck-bundle.mjs'
await _build({
  entryPoints: ['/Users/aaa/Desktop/door-main/app/src/utils/productionsheet/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT, logLevel: 'warning',
})
const m = await import(_OUT)
const {
  createDefaultConfig,
  normalizeProductionSheetConfig,
  fullPageBudgets,
  halfPageBudgets,
  estimateRowHeight,
  estimateRowHeightTwin,
  packPages,
  resolveTableTopMm,
  pageCellHeightMm,
  pageTableTopMm,
  tableWrapWidth,
  isTwinRow,
  buildProductionSheetHtml,
  PX_TO_MM,
} = m

const results = []
const eq = (name, actual, expected) => {
  // 数值容差比较；★ ±Infinity 与 NaN 不能用 Math.abs 差（会得到 NaN）⇒ 先挡掉非有限值
  const ok =
    typeof actual === 'number' && typeof expected === 'number'
      ? Number.isFinite(actual) && Number.isFinite(expected)
        ? Math.abs(actual - expected) < 1e-9
        : Object.is(actual, expected)
      : actual === expected
  results.push({ name, ok })
  if (!ok) {
    console.log(`✗ ${name}`)
    console.log('  expected:', JSON.stringify(expected))
    console.log('  actual  :', JSON.stringify(actual))
  } else {
    console.log(`✓ ${name}`)
  }
}
const ok = (name, cond) => eq(name, !!cond, true)

const cfg = createDefaultConfig()

// ---------------------------------------------------------------- //
// §5.2 行高估算（★ 不是量测）
// ---------------------------------------------------------------- //
// d = 0.2646 * 37 = 9.7902；单行 = 1 * d + 1（至少 1 行）
eq('§5.2 px→mm 系数 = 0.2646', PX_TO_MM, 0.2646)
eq('§5.2 单行（1 行文本）= d*1 + 1', estimateRowHeight({ doorsheet: 'a' }, cfg), 0.2646 * 37 + 1)
eq('§5.2 两行文本（<br>）= d*2 + 1', estimateRowHeight({ doorsheet: 'a<br>b' }, cfg), 0.2646 * 37 * 2 + 1)
eq('§5.2 空串仍算 1 行（不塌成 0）', estimateRowHeight({ doorsheet: '' }, cfg), 0.2646 * 37 + 1)
eq('§5.2 取各列最大行数', estimateRowHeight({ doorsheet: 'a', doorframe: 'a<br>b<br>c' }, cfg), 0.2646 * 37 * 3 + 1)
// 有门图（且该格有 url）→ min(1.5 * 可用页宽/可见列数, 60)
// 可用页宽 = 210 - 2*5 = 200；可见列 4 ⇒ 200/4 = 50 ⇒ min(75, 60) = 60
eq(
  '§5.2 有门图 → min(1.5 * (200/4), 60) = 60',
  estimateRowHeight({ doorsheet: 'a', doorImg: 'https://x/d.png' }, cfg),
  60,
)
// ★ 门图列为 0 宽/不可见时进不了这一支；且该支**忽略文本行数**
// 2-up 的同一支用的是「可见列平均宽」—— 默认 4 列各 50 ⇒ 平均 50 ⇒ 同样 60（此处不可分辨）
eq(
  '§5.2 2-up 有门图 → min(1.5 * (Σ列宽/列数), 60) = 60',
  estimateRowHeightTwin({ doorsheet: 'a', doorImg: 'https://x/d.png' }, cfg),
  60,
)
// 两者在「列宽不等」时**必须不同**（非 2-up 用可用页宽÷列数，2-up 用平均列宽）
const uneven = createDefaultConfig()
uneven.tableConfig.columns = [
  { key: 'doorsheet', label: 'A', visible: true, width: 10 },
  { key: 'doorframe', label: 'B', visible: true, width: 10 },
  { key: 'doorImg', label: 'C', visible: true, width: 80 },
]
// 非 2-up：(210-10)/3 = 66.667 ⇒ min(100, 60) = 60
// 2-up：   (10+10+80)/3 = 33.333 ⇒ min(50, 60) = 50
eq('§5.2 非 2-up 用可用页宽÷列数 → 60', estimateRowHeight({ doorImg: 'x' }, uneven), 60)
eq('§5.2 2-up 用可见列平均宽 → 50', estimateRowHeightTwin({ doorImg: 'x' }, uneven), 50)

// ---------------------------------------------------------------- //
// §5.3 预算 —— ★ 首页与后续页不同
// ---------------------------------------------------------------- //
// V = d + 2 = 11.7902；usable = 148 - 2*5 = 138；top = 42.5（默认 tableTopMm >= 0）
//   首页 = 138 - 42.5 - 11.7902 - 4 = 79.7098
//   后续 = 138 -        11.7902 - 6 = 120.2098
const d = 0.2646 * 37
const V = d + 2
eq('§5.3 默认首页预算 = 79.7098mm', Number(fullPageBudgets(cfg).first.toFixed(6)), 79.7098)
eq('§5.3 默认后续页预算 = 120.2098mm', Number(fullPageBudgets(cfg).later.toFixed(6)), 120.2098)
eq('§5.3 与公式独立重算一致（首页）', fullPageBudgets(cfg).first, 148 - 2 * 5 - 42.5 - V - 4)
eq('§5.3 与公式独立重算一致（后续）', fullPageBudgets(cfg).later, 148 - 2 * 5 - V - 6)
ok('§5.3 ★ 首页预算 ≠ 后续页预算（底座是相同的）', fullPageBudgets(cfg).first !== fullPageBudgets(cfg).later)
// ★ 底座那两个常数 8/10 在 PS 没有对应物 —— 若误用底座公式会得到不同数
eq('§5.3 不是底座的 heightMm-2P-8-10', fullPageBudgets(cfg).first !== 148 - 2 * 5 - 8 - 10, true)

// tableTopMm = -1 → 自动 = max(可见字段 y) + 12；默认最大 y = 36（maker）
eq('§2.1注2 tableTopMm = -1 → 自动 top = max(y)+12 = 48', resolveTableTopMm({ ...cfg, tableConfig: { ...cfg.tableConfig, tableTopMm: -1 } }), 48)
eq('§2.1注2 tableTopMm >= 0 → 直接用', resolveTableTopMm(cfg), 42.5)
// 手算：148-10-48-11.7902-4 = 74.2098
eq(
  '§5.3 自动 top 时首页预算 = 74.2098mm',
  Number(fullPageBudgets({ ...cfg, tableConfig: { ...cfg.tableConfig, tableTopMm: -1 } }).first.toFixed(6)),
  74.2098,
)

// ★ TODO(未确认) §9.1：可见字段全不可见 → Math.max(...[]) = -Infinity → 首页预算 +Infinity → 永不翻页
const noneVisible = createDefaultConfig()
noneVisible.headerFields.forEach((f) => (f.visible = false))
const autoTopCfg = { ...noneVisible, tableConfig: { ...noneVisible.tableConfig, tableTopMm: -1 } }
eq('§9.1 可见字段全不可见 → top = -Infinity（照抄旧版缺陷）', resolveTableTopMm(autoTopCfg), -Infinity)
eq('§9.1 → 首页预算 = +Infinity ⇒ 永不翻页', fullPageBudgets(autoTopCfg).first, Infinity)

// ---------------------------------------------------------------- //
// §5.3 打包 —— 每页行数（★ 首页 7 行 / 后续 11 行）
// ---------------------------------------------------------------- //
// 单行 10.7902mm。首页 79.7098：7 行 = 75.5314 ≤ 79.7098，8 行 = 86.3216 > 79.7098 ⇒ 首页 7 行
// 后续 120.2098：11 行 = 118.6922 ≤ 120.2098，12 行 = 129.4824 > ⇒ 后续页 11 行
const mkCells = (n, extra = {}) =>
  Array.from({ length: n }, () => ({ doorsheet: 'a', ...extra }))

const sectionsOf = (doc) => doc.split('<section').slice(1)
// 减掉 thead 那一个；无表的 section（0 行数据）没有 <tr>，夹到 0
const trCount = (section) => Math.max(0, (section.match(/<tr>/g) || []).length - 1)

const pageRows = async (n, extra = {}) => {
  const doc = await buildProductionSheetHtml(
    [{ orderID: 'X', oldSheet: mkCells(n, extra) }],
    cfg,
  )
  return sectionsOf(doc).map(trCount)
}

eq('§5.3 0 行 → 1 个 section（无表）', (await pageRows(0)).join(','), '0')
eq('§5.3 1 行 → 1 页 1 行', (await pageRows(1)).join(','), '1')
eq('§5.3 7 行 → 1 页 7 行（首页容量）', (await pageRows(7)).join(','), '7')
eq('§5.3 ★ 8 行 → 2 页 [7,1]（首页挤掉一行）', (await pageRows(8)).join(','), '7,1')
eq('§5.3 ★ 18 行 → 2 页 [7,11]（后续页容量 11）', (await pageRows(18)).join(','), '7,11')
eq('§5.3 ★ 19 行 → 3 页 [7,11,1]', (await pageRows(19)).join(','), '7,11,1')
eq('§5.3 29 行 → 3 页 [7,11,11]', (await pageRows(29)).join(','), '7,11,11')
// 若预算**每页相同**（底座的模型），8/18/19 行的切法都不会是上面这样 —— 这条差异靠上面几条锁住
ok('§5.3 首页容量 < 后续页容量', 7 < 11)

// packPages 本身的边界：单行超一整页也不切分（每页至少一行）
eq('§5.3 每页至少一行（超长行不切分）', packPages([1, 2, 3], 0, 0, () => 999).length, 3)
eq('§5.3 空数组 → 0 页（两联的 [[]] 兜底在调用点）', packPages([], 10, 10, () => 1).length, 0)

// 首页/后续页的表格 top 与门图格高度
eq('§5.3 首页表格 top = tableTopMm', pageTableTopMm(cfg, true), 42.5)
eq('§5.3 后续页表格 top = paddingMm + 2', pageTableTopMm(cfg, false), 7)
eq('§5.3 首页门图格高 = max(10, first-6) = 73.7098', Number(pageCellHeightMm(fullPageBudgets(cfg).first).toFixed(6)), 73.7098)
eq('§5.3 后续页门图格高 = max(10, later-6) = 114.2098', Number(pageCellHeightMm(fullPageBudgets(cfg).later).toFixed(6)), 114.2098)
ok('§5.3 ★ 首页与后续页的门图格高度不同', pageCellHeightMm(fullPageBudgets(cfg).first) !== pageCellHeightMm(fullPageBudgets(cfg).later))
eq('§5.3 表格宽 = Σ可见列宽', tableWrapWidth(cfg), '200mm')
const zeroCols = createDefaultConfig()
zeroCols.tableConfig.columns.forEach((c) => (c.visible = false))
eq('§5.3 可见列宽和 0 → calc(100% - 2*paddingMm mm)', tableWrapWidth(zeroCols), 'calc(100% - 10mm)')

// 表头字段/门图框**只在第 1 页**；后续页只有表
const multi = await buildProductionSheetHtml([{ orderID: 'X', oldSheet: mkCells(8) }], cfg)
const secs = sectionsOf(multi)
eq('§4.7 第 1 页有表头字段（单号：X）', secs[0].includes('单号：X'), true)
eq('§4.7 第 2 页没有表头字段', secs[1].includes('单号：X'), false)

// ---------------------------------------------------------------- //
// §5.4 两联（itemsPerPage = 2）
// ---------------------------------------------------------------- //
// half = 74；s = d + 2 = 11.7902
//   首页 = 74 - 42.5 - 11.7902 - 4 = 15.7098
//   后续 = 74 - (5+2) - 11.7902 - 6 = 49.2098
eq('§5.4 半页高 = 74mm', halfPageBudgets(cfg).halfHeightMm, 74)
eq('§5.4 两联首页预算 = 15.7098mm', Number(halfPageBudgets(cfg).first.toFixed(6)), 15.7098)
eq('§5.4 两联后续页预算 = 49.2098mm', Number(halfPageBudgets(cfg).later.toFixed(6)), 49.2098)
eq('§5.4 与公式独立重算一致（首页）', halfPageBudgets(cfg).first, 74 - 42.5 - V - 4)
eq('§5.4 与公式独立重算一致（后续）', halfPageBudgets(cfg).later, 74 - (5 + 2) - V - 6)
// ★ 两联的首页预算比单联小得多（15.71 vs 79.71）—— 因为半页还要再放一份表头预算
ok('§5.4 两联首页预算 < 单联首页预算', halfPageBudgets(cfg).first < fullPageBudgets(cfg).first)

// 触发条件：两个都要满足
const twinCfg = createDefaultConfig()
twinCfg.print.itemsPerPage = 2
eq('§5.4 itemsPerPage=1 → 不触发', isTwinRow({ orderID1: 'B' }, cfg), false)
eq('§5.4 itemsPerPage=2 但行无 1 后缀 → 不触发', isTwinRow({ orderID: 'A' }, twinCfg), false)
eq('§5.4 触发（orderID1）', isTwinRow({ orderID1: 'B' }, twinCfg), true)
eq('§5.4 触发（oldSheet1）', isTwinRow({ oldSheet1: [] }, twinCfg), true)
eq('§5.4 触发（size1）', isTwinRow({ size1: 's' }, twinCfg), true)

// 两联每页行数：首页 1 行、后续 4 行（10.7902：1 行 ≤ 15.7098 < 2 行；4 行 = 43.1608 ≤ 49.2098 < 5 行）
const twinRowCounts = async (upperN, lowerN) => {
  const doc = await buildProductionSheetHtml(
    [
      {
        orderID: 'A',
        oldSheet: mkCells(upperN),
        orderID1: 'B',
        oldSheet1: mkCells(lowerN),
      },
    ],
    twinCfg,
  )
  // 每个 section 里两个半页 div，各自一张表 ⇒ 上半联/下半联的 <tr> 各算一遍
  return sectionsOf(doc).map((s) => {
    const halves = s.split('height:74mm;overflow:hidden;box-sizing:border-box;">').slice(1)
    return halves.map((h) => (h.match(/<tr>/g) || []).length - 1)
  })
}
eq('§5.4 上下联各 1 行 → 1 页 [[1,1]]', JSON.stringify(await twinRowCounts(1, 1)), JSON.stringify([[1, 1]]))
eq(
  '§5.4 ★ 上下联各 6 行 → 3 页 [[1,1],[4,4],[1,1]]（首页 1 行 / 后续 4 行）',
  JSON.stringify(await twinRowCounts(6, 6)),
  JSON.stringify([[1, 1], [4, 4], [1, 1]]),
)
eq(
  '§5.4 上下联各 5 行 → 2 页 [[1,1],[4,4]]',
  JSON.stringify(await twinRowCounts(5, 5)),
  JSON.stringify([[1, 1], [4, 4]]),
)
// ★ 两联**共用同一对预算** ⇒ 两条半联的切页位置一致
eq('§5.4 两条半联用同一对预算（切页位置一致）', JSON.stringify((await twinRowCounts(9, 9)).map((p) => p[0] === p[1])), JSON.stringify([true, true, true]))

// 空行数据（两联）
const twinEmpty = await buildProductionSheetHtml(
  [{ orderID: 'A', oldSheet: [], orderID1: 'B', oldSheet1: [] }],
  twinCfg,
)
eq('§5.4 两联 + 两联都空 → 仍是 1 个 section', (twinEmpty.match(/<section/g) || []).length, 1)
eq('§5.4 两联都空 → 两个半页 div 都在（表为空）', (twinEmpty.match(/height:74mm;overflow:hidden/g) || []).length, 2)
// 可见列为 0 时两联走 `[[]]` 分支（不是 0 页）
const twinNoCols = createDefaultConfig()
twinNoCols.print.itemsPerPage = 2
twinNoCols.tableConfig.columns.forEach((c) => (c.visible = false))
const twinNoColsDoc = await buildProductionSheetHtml(
  [{ orderID: 'A', oldSheet: mkCells(3), orderID1: 'B', oldSheet1: mkCells(3) }],
  twinNoCols,
)
eq('§5.4 可见列 0 → 两联退化成单页（[[]] 分支）', (twinNoColsDoc.match(/<section/g) || []).length, 1)

// ---------------------------------------------------------------- //
// §2.4 读盘清洗 `z`
// ---------------------------------------------------------------- //
const defaults = createDefaultConfig()
eq('§2.4 normalize(undefined) ≡ 默认配置', JSON.stringify(normalizeProductionSheetConfig(undefined)), JSON.stringify(defaults))
eq('§2.4 normalize(null) ≡ 默认配置', JSON.stringify(normalizeProductionSheetConfig(null)), JSON.stringify(defaults))
eq('§2.4 normalize(垃圾) ≡ 默认配置', JSON.stringify(normalizeProductionSheetConfig({ paper: 'x', headerFields: 5 })), JSON.stringify(defaults))

// N() 的 clamp 语义：null/'' → min（因为 Number(null)===0 是有限值）；undefined → fallback
const clamped = normalizeProductionSheetConfig({ paper: { widthMm: null, heightMm: '', paddingMm: 'abc' } })
eq('§2.4 N(null) → 夹到下界 50（不是回落）', clamped.paper.widthMm, 50)
eq('§2.4 N("") → 夹到下界 50', clamped.paper.heightMm, 50)
eq('§2.4 N("abc") → 回落默认 5', clamped.paper.paddingMm, 5)
eq('§2.4 paddingMm = 0 保留（0 是有限值）', normalizeProductionSheetConfig({ paper: { paddingMm: 0 } }).paper.paddingMm, 0)

// orientation：★ 只认 landscape（与底座相反）
eq('§2.1注3 orientation="landscape" → landscape', normalizeProductionSheetConfig({ paper: { orientation: 'landscape' } }).paper.orientation, 'landscape')
eq('§2.1注3 orientation="portrait" → portrait', normalizeProductionSheetConfig({ paper: { orientation: 'portrait' } }).paper.orientation, 'portrait')
eq('§2.1注3 orientation 缺失 → portrait（兜底与底座相反）', normalizeProductionSheetConfig({}).paper.orientation, 'portrait')

// itemsPerPage：只有严格等于 2 才保留 2
eq('§2.4 itemsPerPage=2 → 2', normalizeProductionSheetConfig({ print: { itemsPerPage: 2 } }).print.itemsPerPage, 2)
eq('§2.4 itemsPerPage="2" → 2（Number 转换）', normalizeProductionSheetConfig({ print: { itemsPerPage: '2' } }).print.itemsPerPage, 2)
eq('§2.4 itemsPerPage=3 → 回落 1', normalizeProductionSheetConfig({ print: { itemsPerPage: 3 } }).print.itemsPerPage, 1)
eq('§2.4 itemsPerPage=0 → 回落 1', normalizeProductionSheetConfig({ print: { itemsPerPage: 0 } }).print.itemsPerPage, 1)
eq('§2.4 itemsPerPage 缺失 → 1', normalizeProductionSheetConfig({}).print.itemsPerPage, 1)
// copies：Math.max(1, Math.min(99, Number(v) || 1))
eq('§2.4 copies=0 → 1（`||` 先兜底）', normalizeProductionSheetConfig({ print: { copies: 0 } }).print.copies, 1)
eq('§2.4 copies=200 → 夹到 99', normalizeProductionSheetConfig({ print: { copies: 200 } }).print.copies, 99)

// headerFields：以默认表为主干 ⇒ 顺序恒为默认顺序，多出的 key 丢弃，key/label/prefix 强制默认
const reordered = normalizeProductionSheetConfig({
  headerFields: [
    { key: 'qrcode', label: '改名', prefix: '改前缀', x: 1, y: 2, width: 30 },
    { key: 'material', visible: false },
    { key: 'notAField', x: 9 },
  ],
})
eq('§2.4 headerFields 顺序恒为默认顺序', reordered.headerFields.map((f) => f.key).join(','), defaults.headerFields.map((f) => f.key).join(','))
eq('§2.4 headerFields 存盘多出的 key 丢弃', reordered.headerFields.some((f) => f.key === 'notAField'), false)
eq('§2.4 key/label/prefix 强制取默认（不允许改名）', reordered.headerFields.find((f) => f.key === 'qrcode').label, '二维码')
eq('§2.4 prefix 强制默认', reordered.headerFields.find((f) => f.key === 'qrcode').prefix, '')
eq('§2.4 存盘的 x/y/width 生效', reordered.headerFields.find((f) => f.key === 'qrcode').x, 1)
eq('§2.4 visible:false 保留（undefined 才回落）', reordered.headerFields.find((f) => f.key === 'material').visible, false)
eq('§2.4 未出现的字段用默认值', reordered.headerFields.find((f) => f.key === 'client').x, 5)

// lineHeight：★ 唯一用 Number.isFinite(Number(v)) 的一处
eq('§2.4 lineHeight NaN → 默认 1.4', normalizeProductionSheetConfig({ headerFields: [{ key: 'size', lineHeight: 'x' }] }).headerFields.find((f) => f.key === 'size').lineHeight, 1.4)
eq('§2.4 lineHeight=5 → 夹到 3', normalizeProductionSheetConfig({ headerFields: [{ key: 'size', lineHeight: 5 }] }).headerFields.find((f) => f.key === 'size').lineHeight, 3)
eq('§2.4 lineHeight=0.1 → 夹到 0.8', normalizeProductionSheetConfig({ headerFields: [{ key: 'size', lineHeight: 0.1 }] }).headerFields.find((f) => f.key === 'size').lineHeight, 0.8)

// columns：★ 顺序跟随存盘（与 headerFields 相反），未知 key 丢弃，缺失的追加到末尾
const cols = normalizeProductionSheetConfig({
  tableConfig: { columns: [{ key: 'doorImg' }, { key: 'nope' }, { key: 'doorsheet' }] },
}).tableConfig.columns
eq('§2.4 columns 顺序跟随存盘 + 未知 key 丢弃 + 缺失追加末尾', cols.map((c) => c.key).join(','), 'doorImg,doorsheet,doorframe,windows')
eq('§2.4 存盘 columns 为空 → 用默认 4 列', normalizeProductionSheetConfig({ tableConfig: { columns: [] } }).tableConfig.columns.map((c) => c.key).join(','), 'doorsheet,doorframe,windows,doorImg')
eq('§2.4 列宽 clamp 5–300', normalizeProductionSheetConfig({ tableConfig: { columns: [{ key: 'doorsheet', width: 9999 }] } }).tableConfig.columns[0].width, 300)
eq('§2.4 列 visible:false 保留', normalizeProductionSheetConfig({ tableConfig: { columns: [{ key: 'doorsheet', visible: false }] } }).tableConfig.columns[0].visible, false)

// tableTopMm 的哨兵下界是 -1（UI 下界是 0，两者故意不同）
eq('§2.1注2 tableTopMm=-1 保留（哨兵）', normalizeProductionSheetConfig({ tableConfig: { tableTopMm: -1 } }).tableConfig.tableTopMm, -1)
eq('§2.1注2 tableTopMm=-5 夹到 -1', normalizeProductionSheetConfig({ tableConfig: { tableTopMm: -5 } }).tableConfig.tableTopMm, -1)
eq('§2.4 rowHeight clamp 16–60', normalizeProductionSheetConfig({ tableConfig: { rowHeight: 5 } }).tableConfig.rowHeight, 16)
eq('§2.4 tableFontSize clamp 6–24', normalizeProductionSheetConfig({ tableConfig: { tableFontSize: 99 } }).tableConfig.tableFontSize, 24)
eq('§2.4 showBodyBorder:false 保留', normalizeProductionSheetConfig({ tableConfig: { showBodyBorder: false } }).tableConfig.showBodyBorder, false)
eq('§2.4 doorImgBox.enabled 缺失 → false', normalizeProductionSheetConfig({}).doorImgBox.enabled, false)
eq('§2.4 globalHeaderFont 空串 → 回落（`||` 不是 `??`）', normalizeProductionSheetConfig({ globalHeaderFont: { fontFamily: '' } }).globalHeaderFont.fontFamily, 'Microsoft YaHei')

// ★ 合并写法的**不对称**（以源码为准，与施工图 §2.4「未知键都会丢」的措辞有出入）：
//   headerFields 是 `{...default, ...stored, …12 个受管字段}` ⇒ 存盘对象上**多出的杂键会漏进来**；
//   columns 是 `{...default, visible, width}` ⇒ 存盘对象的多余属性**不漏**。
//   只有「数组里多出的**整条**字段/列」才会被丢（那条施工图说对了）。见 `sanitize.ts` 的注。
const leaked = normalizeProductionSheetConfig({
  headerFields: [{ key: 'size', zzzNotAField: 1 }],
  tableConfig: { columns: [{ key: 'doorsheet', zzzNotAColumn: 1 }] },
})
eq('§2.4 headerFields 保留存盘对象上多出的杂键（照抄源码的 spread）', leaked.headerFields.find((f) => f.key === 'size').zzzNotAField, 1)
eq('§2.4 columns 不吃存盘对象上的杂键（写法不同）', 'zzzNotAColumn' in leaked.tableConfig.columns[0], false)

// ★ 读盘与写回两端都调用：z(z(x)) ≡ z(x)（幂等）—— 旧版靠这条保证双端清洗不出偏差
const once = normalizeProductionSheetConfig({ headerFields: [{ key: 'qrcode', x: 1 }], print: { itemsPerPage: 2 } })
eq('§2.2 z 幂等（读盘/写回双端调用安全）', JSON.stringify(normalizeProductionSheetConfig(once)), JSON.stringify(once))

// ---------------------------------------------------------------- //
// 汇总
// ---------------------------------------------------------------- //
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '))
  process.exitCode = 1
}
