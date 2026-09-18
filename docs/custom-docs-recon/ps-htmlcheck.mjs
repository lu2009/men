// 自定义生产单（ic=14） · HTML 结构比对 —— 期望串**逐字抄自施工图 §4**（不是抄自实现）。
//
// 覆盖：§4.1 顶层结构 / §4.3 完整文档 / §4.4 头部字段 / §4.5 表格 / §4.6 门图框 /
//       §5.4 两联 / §0.3 class 枚举。
//
// —— 自带打包（同另两个 htmlcheck）——
import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')
const _OUT = _ROOT + '/app/node_modules/.cache/ps-htmlcheck-bundle.mjs'
await _build({
  entryPoints: ['/Users/aaa/Desktop/door-main/app/src/utils/productionsheet/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT, logLevel: 'warning',
})
const m = await import(_OUT)
const {
  createDefaultConfig,
  productionSheetCss,
  buildSheetStyle,
  buildRootHtml,
  buildDocumentHtml,
  buildProductionSheetHtml,
  buildProductionSheetDocument,
  renderHeaderFields,
  renderTable,
  renderDoorImgBox,
  readFieldValue,
  skipBySuffix,
  createProductionSheetQrProvider,
  escapeHtml,
} = m

const results = []
const eq = (name, actual, expected) => {
  const ok = actual === expected
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
const D = escapeHtml
const S = (n) => JSON.stringify(n)

const row = {
  material: '断桥铝',
  size: '1800*900,亮窗高：300',
  color: '香槟色',
  glass: '中空5+12A+5',
  client: '张三',
  maker: '李四',
  lockway: '左开',
  orderID: '2026-09-17-01',
  address: '某某路 1 号',
  remark: '五金：执手',
  lockImg: 'https://x/lock.png',
  doorImg: 'https://x/door.png',
  oldSheet: [
    { doorsheet: '门扇<br>第二行', doorframe: '', windows: '亮窗', doorImg: 'https://x/cell.png' },
  ],
}

// ---------------------------------------------------------------- //
// §4.1 顶层结构 · sheetStyle 逐字
// ---------------------------------------------------------------- //
eq(
  '§4.1 sheetStyle 逐字（顺序即数组顺序，font-family 单引号）',
  buildSheetStyle(cfg),
  "width:210mm;height:148mm;padding:5mm;position:relative;box-sizing:border-box;background:#fff;color:#000;overflow:hidden;page-break-after:always;font-family:'Microsoft YaHei', sans-serif;font-size:19pt",
)

eq(
  '§4.1 根容器 = <div class="ps-root"><style>{CSS}</style>{sheets}</div>',
  buildRootHtml('SECTION', cfg),
  '<div class="ps-root"><style>' + productionSheetCss(cfg) + '</style>SECTION</div>',
)

// ★ 空行数组 → 一个 section 都不产出（与底座「空 → 1 个空页」不同）
const emptyDoc = await buildProductionSheetHtml([], cfg)
eq('§4.1 空数组 → 0 个 <section>', (emptyDoc.match(/<section/g) || []).length, 0)
eq(
  '§4.1 空数组 → 只有根容器',
  emptyDoc,
  '<div class="ps-root"><style>' + productionSheetCss(cfg) + '</style></div>',
)

// ---------------------------------------------------------------- //
// §0.3 class 枚举 —— 产出 HTML 只有 ps-root / ps-sheet
// ---------------------------------------------------------------- //
const fullDoc = await buildProductionSheetHtml([row], cfg)
const classes = [...fullDoc.matchAll(/class="([^"]*)"/g)].map((x) => x[1])
eq('§0.3 产出 HTML 的 class 只有 ps-root / ps-sheet', classes.join(','), 'ps-root,ps-sheet')
eq('§0.3 没有 ps2-/gs2-/page-num', /ps2-|gs2-|page-num/.test(fullDoc), false)

// ---------------------------------------------------------------- //
// §4.4 头部字段
// ---------------------------------------------------------------- //
const hf = renderHeaderFields(row, cfg, {})

eq(
  '§4.4 普通字段 div 逐字（wrap:false → nowrap/ellipsis）',
  hf.includes(
    '<div style="position:absolute;left:5mm;top:17mm;width:75mm;font-size:15pt;font-family:\'Microsoft YaHei\', sans-serif;color:#000000;font-weight:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4">客户：张三</div>',
  ),
  true,
)
eq('§4.4 material 是红色 #F70505（12 条里唯一）', hf.includes('color:#F70505'), true)
eq('§4.4 wrap:true → white-space:normal;word-break:break-all', hf.includes('white-space:normal;word-break:break-all'), true)

// remark / address 即使为空也渲染
const emptyRemark = renderHeaderFields({ ...row, remark: '', address: '' }, cfg, {})
eq(
  '§4.4 remark/address 取值为空也渲染（只剩前缀）',
  emptyRemark.includes('>备注：</div>') && emptyRemark.includes('>地址：</div>'),
  true,
)
// 其余字段为空则整块不渲染
const noColor = renderHeaderFields({ ...row, color: '' }, cfg, {})
eq('§4.4 其余字段为空 → 整块不渲染', noColor.includes('color:#000000" >') || noColor.includes('>颜色：'), false)

// qrcode：需要 provider；★ 回退 viewBox 必须是 0 0 200 200（§2.6 / §8.2 #14）
const qrProvider = createProductionSheetQrProvider((text) => ({ viewBox: '', inner: `<path data-t="${text}"/>` }))
const hfQr = renderHeaderFields(row, cfg, { qrSvg: qrProvider })
eq(
  '§4.4 qrcode：方形（height = width = 18mm）+ 回退 viewBox 0 0 200 200 + 无字幕',
  hfQr.includes(
    '<svg style="position:absolute;left:186mm;top:3.5mm;width:18mm;height:18mm;display:block;" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet"><path data-t="2026-09-17-01"/></svg>',
  ),
  true,
)
// 编码失败（provider 返回 null）→ 整块 ""
eq('§4.4 qrcode 编码失败 → 整块空串', renderHeaderFields(row, cfg, { qrSvg: () => null }).includes('<svg'), false)
// ★ R() 读的是 orderID（小写 d）
eq('§2.6 readFieldValue(qrcode) 读小写 orderID', readFieldValue({ orderID: 'A', OrderID: 'B' }, 'qrcode'), 'A')
eq('§2.6 readFieldValue(size) 数组 → join(",")', readFieldValue({ size: ['1800*900', '亮窗高：300'] }, 'size'), '1800*900,亮窗高：300')

// lockImg
eq(
  '§4.4 lockImg：height:auto、src 不转义',
  hfQr.includes('<img src="https://x/lock.png" style="position:absolute;left:187.5mm;top:24mm;width:14mm;height:auto;" />'),
  true,
)

// ---------------------------------------------------------------- //
// §4.5 表格
// ---------------------------------------------------------------- //
const table = renderTable(row.oldSheet, cfg)
eq(
  '§4.5 <table> 逐字（width = Σ可见列宽、margin-top:2mm）',
  table.startsWith('<table style="width:200mm;border-collapse:collapse;table-layout:fixed;margin-top:2mm;font-size:16.5pt;">'),
  true,
)
eq(
  '§4.5 <th> 边框硬编码 1px solid #000（不读 showBodyBorder）+ label 转义',
  table.includes('<th style="border:1px solid #000;padding:2px 4px;text-align:center;width:50mm;box-sizing:border-box;">门扇</th>'),
  true,
)
eq('§4.5 <tr> 无换行无缩进', table.includes('<tbody><tr><td style="'), true)

// 非 doorImg 的 td 逐字
eq(
  '§4.5 普通 td 逐字（padding:1px 4px; line-height:37px）',
  table.includes(
    '<td style="border:1px solid #000;padding:1px 4px;vertical-align:top;line-height:37px;width:50mm;box-sizing:border-box;">' +
      '<div style="text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:1px;line-height:37px;">门扇</div>' +
      '<div style="text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:1px;line-height:37px;">第二行</div>' +
      '</td>',
  ),
  true,
)
// 空段：永远保留 + 多一个 min-height（PS 独有）
eq(
  '§4.5 空段 → &nbsp; 占位且带 min-height',
  table.includes('<div style="line-height:37px;min-height:37px;">&nbsp;</div>'),
  true,
)
// 关掉「加下划线」
const noUnderline = createDefaultConfig()
noUnderline.tableConfig.underlineBrElements = false
eq(
  '§4.5 underlineBrElements:false → 只留 line-height',
  renderTable([{ doorsheet: 'a' }], noUnderline).includes('<div style="line-height:37px;">a</div>'),
  true,
)
// 关掉「外边框」→ td 无框，但 th 仍有框（§2.3 CONFIRMED）
const noBorder = createDefaultConfig()
noBorder.tableConfig.showBodyBorder = false
const t2 = renderTable([{ doorsheet: 'a' }], noBorder)
eq('§4.5 showBodyBorder:false → td border:none', t2.includes('<td style="border:none;padding:1px 4px;'), true)
eq('§4.5 showBodyBorder:false → th 仍有框', t2.includes('<th style="border:1px solid #000;'), true)

// doorImg 格 + 第 3 参（首页/后续页给的值不同）
eq(
  '§4.5 doorImg td 逐字（有第 3 参 → height:{n}mm）',
  renderTable(row.oldSheet, cfg, 20).includes(
    '<td style="border:1px solid #000;padding:0;position:relative;vertical-align:middle;text-align:center;width:50mm;box-sizing:border-box;overflow:hidden;height:20mm;">' +
      '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="https://x/cell.png" style="height:100%;width:auto;max-width:100%;display:block;object-fit:contain;" /></div>' +
      '</td>',
  ),
  true,
)
// 第 3 参 <= 0（或该格无图）→ 不写 height（`PS:968` 的 `o > 0 && u`）
eq(
  '§4.5 doorImg 无第 3 参 → 不写 height',
  table.includes('<td style="border:1px solid #000;padding:0;position:relative;vertical-align:middle;text-align:center;width:50mm;box-sizing:border-box;overflow:hidden;">'),
  true,
)
eq(
  '§4.5 第 3 参 > 0 但该格无图 → 不写 height',
  renderTable([{ doorImg: '' }], cfg, 20).includes('overflow:hidden;">'),
  true,
)
// 可见列为 0 → 空串（★ 没有「无可见列」占位）
const noCols = createDefaultConfig()
noCols.tableConfig.columns.forEach((c) => (c.visible = false))
eq('§4.5 可见列 0 → 空串（无占位）', renderTable(row.oldSheet, noCols), '')
eq('§4.5 空行数组 → 空串', renderTable([], cfg), '')

// ★ <br> 正则无 i 标志：大写 <BR> 不切（§9.3，照抄）
eq(
  '§9.3 大写 <BR> 不切行（正则无 i 标志）',
  renderTable([{ doorsheet: 'a<BR>b' }], cfg).includes('a&lt;BR&gt;b'),
  true,
)
eq(
  '§4.5 <br/> 与 <br /> 都切',
  renderTable([{ doorsheet: 'a<br/>b<br />c' }], cfg).match(/<div style="text-decoration/g).length,
  3,
)

// ---------------------------------------------------------------- //
// §4.6 门图框
// ---------------------------------------------------------------- //
const boxCfg = createDefaultConfig()
boxCfg.doorImgBox.enabled = true
eq(
  '§4.6 门图框逐字（虚线框 #333 会真打印）',
  renderDoorImgBox(row, boxCfg),
  '<div style="position:absolute;left:128.5mm;top:80.5mm;width:43mm;height:50mm;border:1px dashed #333;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="https://x/door.png" style="max-width:100%;max-height:100%;" /></div>',
)
eq('§4.6 enabled:false → 空串', renderDoorImgBox(row, cfg), '')
// 两级回退：row.doorImg || row.oldSheet[0].doorImg
eq(
  '§4.6 回退到 oldSheet[0].doorImg',
  renderDoorImgBox({ oldSheet: [{ doorImg: 'https://x/fallback.png' }] }, boxCfg).includes(
    '<img src="https://x/fallback.png"',
  ),
  true,
)
eq(
  '§4.6 都缺 → 空内容但框还在',
  renderDoorImgBox({ oldSheet: [{}] }, boxCfg).endsWith('overflow:hidden"></div>'),
  true,
)

// ---------------------------------------------------------------- //
// §4.3 完整文档（head 多一段 <style>）
// ---------------------------------------------------------------- //
const docHtml = await buildProductionSheetDocument([row], cfg)
eq(
  '§4.3 完整文档逐字（含 head <style>，CSS 出现两次）',
  docHtml,
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义生产单</title>\n  <style>html,body{margin:0;padding:0;background:#fff;}' +
    productionSheetCss(cfg) +
    '</style>\n  </head><body>' +
    fullDoc +
    '</body></html>',
)
eq('§4.3 CSS 在文档里出现两次', docHtml.split(productionSheetCss(cfg)).length - 1, 2)

// ---------------------------------------------------------------- //
// §4.7 / §5.3 首页与后续页的差异（端到端）
// ---------------------------------------------------------------- //
// 8 行 → 2 页 [7,1]。首页被 header 挤掉 ⇒ 表格 top 与门图格高度都与后续页不同（§5.3）
const boxOn = createDefaultConfig()
boxOn.doorImgBox.enabled = true
const paged = await buildProductionSheetHtml(
  [{ orderID: 'X', oldSheet: Array.from({ length: 8 }, () => ({ doorsheet: 'a', doorImg: 'https://x/c.png' })) }],
  boxOn,
)
const pagedSecs = paged.split('<section').slice(1)
// ⚠️ 这些行**带 doorImg** ⇒ 单行 60mm（`min(1.5 * 200/4, 60)`，§5.2 的门图支）
// ⇒ 首页 1 行（60 ≤ 79.7098 < 120）、后续页 2 行（120 ≤ 120.2098 < 180）
// ⇒ 8 行 = [1,2,2,2,1] = 5 页（**不是** 7/11 那种不含门图的切法）
eq('§5.3 8 行（带门图，单行 60mm）→ 5 页', pagedSecs.length, 5)
eq(
  '§5.3 ★ 首页表格 top = tableTopMm(42.5)，后续页 top = paddingMm+2(7)',
  pagedSecs[0].includes('position:absolute;left:5mm;top:42.5mm;width:200mm;') &&
    pagedSecs[1].includes('position:absolute;left:5mm;top:7mm;width:200mm;'),
  true,
)
eq(
  '§5.3 ★ 首页门图格高 73.7098mm、后续页 114.2098mm（同一个 $ 的第 3 参不同）',
  pagedSecs[0].includes('overflow:hidden;height:73.7098mm;') &&
    pagedSecs[1].includes('overflow:hidden;height:114.2098mm;'),
  true,
)
// ★ 顺序：header → 表格 → 门图框（PS:1306-1308）
const iHeader = pagedSecs[0].indexOf('单号：X')
const iTable = pagedSecs[0].indexOf('<table ')
const iBox = pagedSecs[0].indexOf('border:1px dashed #333')
eq('§4.7 首页 DOM 顺序 = 表头字段 → 表格 → 门图框', iHeader < iTable && iTable < iBox, true)
// ★ 门图框与表头字段**只在第 1 页**
eq('§4.7 第 2 页没有门图框', pagedSecs[1].includes('border:1px dashed #333'), false)

// ---------------------------------------------------------------- //
// §5.4 两联（te 拆键 + 上浮）
// ---------------------------------------------------------------- //
const paired = {
  orderID: 'A',
  oldSheet: [{ doorsheet: '上联' }],
  size: 's',
  orderID1: 'B',
  oldSheet1: [{ doorsheet: '下联' }],
  size1: 's1',
}
// ★ guard：空后缀必须原样返回（否则 slice(0,-0) 会把每个键变成 ""）
eq('§5.4 skipBySuffix(row,"") 原样返回（guard）', skipBySuffix(paired, ''), paired)
eq('§5.4 skipBySuffix(row,"1") 剥后缀', Object.keys(skipBySuffix(paired, '1')).sort().join(','), 'oldSheet,orderID,size')

const twinCfg = createDefaultConfig()
twinCfg.print.itemsPerPage = 2
const mkCellsForFloat = (n) => Array.from({ length: n }, () => ({ doorsheet: 'a' }))
const twinDoc = await buildProductionSheetHtml([paired], twinCfg)
eq('§5.4 两联 → 1 个 section', (twinDoc.match(/<section/g) || []).length, 1)
eq('§5.4 一页两个半页 div', (twinDoc.match(/height:74mm;overflow:hidden/g) || []).length, 2)
eq('§5.4 上联 top:0mm、下联 top:74mm', /top:0mm;width:100%;height:74mm/.test(twinDoc) && /top:74mm;width:100%;height:74mm/.test(twinDoc), true)
eq('§5.4 上联渲染了表头字段（下联没有）', (twinDoc.match(/单号：A/g) || []).length, 1)
eq('§5.4 两联各用自己的 oldSheet（上联/下联）', twinDoc.includes('上联') && twinDoc.includes('下联'), true)

// ★ 上浮的真实触发条件：**下联页数比上联多**（`g[e]` 取到 undefined ⇒ `t` 为空串）。
// ⚠️ 不是「上联数据为空」——旧版 `m` 对空数据返回 `[[]]`（`PS:1108`），半联**永远至少 1 页**，
// 所以「上联空数据」根本不触发上浮（它产出一个空半页 div）。
// 这里：上联 1 格（1 页）、下联 6 格（3 页：首页 1 + 后续 4 + 1）⇒ 第 2、3 页下联上浮。
const floatDoc = await buildProductionSheetHtml(
  [{ orderID: 'A', oldSheet: [{ doorsheet: '上联' }], orderID1: 'B', oldSheet1: mkCellsForFloat(6) }],
  twinCfg,
)
const floatSecs = floatDoc.split('<section').slice(1)
eq('§5.4 下联页数多 → 3 个 section', floatSecs.length, 3)
eq('§5.4 第 1 页两个半页 div（上 top:0 / 下 top:74）', (floatSecs[0].match(/height:74mm;overflow:hidden/g) || []).length, 2)
eq('§5.4 ★ 第 2、3 页只剩一个半页 div（下联上浮）', floatSecs.slice(1).every((s) => (s.match(/height:74mm;overflow:hidden/g) || []).length === 1), true)
eq('§5.4 ★ 上浮后 top:74mm 只剩第 1 页那一处', (floatDoc.match(/top:74mm;/g) || []).length, 1)
eq('§5.4 ★ 上浮是字符串替换 top:74mm; → top:0mm;', floatSecs[1].includes('top:0mm;width:100%;height:74mm'), true)
eq('§5.4 上浮的那一页没有残留 top:74mm', floatSecs[1].includes('top:74mm;'), false)

// 上联数据为空（但可见列 > 0）→ 半联产出**一个空页**（`[[]]`），**不触发上浮**
const emptyUpperDoc = await buildProductionSheetHtml(
  [{ orderID: 'A', oldSheet: [], orderID1: 'B', oldSheet1: [{ doorsheet: '下联' }] }],
  twinCfg,
)
eq('§5.4 上联空数据 → 仍 1 个 section、两个半页 div', (emptyUpperDoc.match(/height:74mm;overflow:hidden/g) || []).length, 2)
eq('§5.4 上联空数据 → 下联留在 top:74mm（不触发上浮）', emptyUpperDoc.includes('top:74mm;'), true)

// itemsPerPage=1 时，l 同样的配对行走普通版式（不触发两联）
const singleCfg = createDefaultConfig()
eq(
  '§5.4 itemsPerPage=1 → 配对行也走单联（半页 div 不出现）',
  (await buildProductionSheetHtml([paired], singleCfg)).includes('height:74mm;overflow:hidden'),
  false,
)

// ---------------------------------------------------------------- //
// 汇总
// ---------------------------------------------------------------- //
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '))
  process.exitCode = 1
}
