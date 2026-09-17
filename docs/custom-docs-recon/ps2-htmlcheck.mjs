// 自定义生产单2 · HTML 结构比对 —— 期望串**逐字抄自施工图 §3 / §7**（不是抄自实现）。
//
// 与 `gs2-htmlcheck.mjs` 的分工：那份钉死 GS2 的骨架（两边逐字节相同），
// 这份只钉 **PS2 相对 GS2 的四处差异**在 HTML 上的落点 —— 前缀 `ps` / 9 列 / 空行占位 / case 表。
import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')
const _OUT = _ROOT + '/app/node_modules/.cache/ps2-htmlcheck-bundle.mjs'
await _build({
  entryPoints: ['/Users/aaa/Desktop/door-main/app/src/utils/productionsheet2/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT, logLevel: 'warning',
})
const _m = await import(_OUT)
const {
  createDefaultConfig,
  css,
  escapeHtml,
  renderMultiline,
  renderPage,
  renderRow,
  renderCell,
  renderPreviewTable,
  createQrSvgProvider,
  buildRootHtml,
  buildDocumentHtml,
  buildMeasureTable,
} = _m
import fs from 'node:fs'

const cfg = createDefaultConfig()
const D = escapeHtml

const row = {
  door: '张三<br>断桥铝<br>香槟色',
  doorImg: 'https://x/door.png',
  OrderID: '2026/09/17-001',
  basicInfo: '2000*1000*100<br>开向：左开',
  lockImg: 'https://x/lock.png',
  doorsheet: '门扇料:5*2',
  doorframe: '门框:100*2<br>前框:50',
  windows: '扣板:20*3',
  remark: '五金：执手',
}

const results = []
const eq = (name, actual, expected) => {
  // 用 JSON 比对：本文件里有数组/对象断言，`===` 会在值相同时仍判失败。
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) console.log('  expected:', JSON.stringify(expected), '\n  actual  :', JSON.stringify(actual))
}

// ---------------------------------------------------------------- //
// §2.2 列集：9 列、顺序、键/标签/宽/字号/行高/颜色
// ---------------------------------------------------------------- //
const visible = cfg.table.columns.filter((c) => c.visible)
eq('§2.2 默认可见列 = 9 列', visible.length, 9)
eq(
  '§2.2 列序与全字段（逐字照抄 PS2:22-104）',
  visible.map((c) => [c.key, c.label, c.widthMm, c.fontSize, c.rowHeightMm, c.fontColor]),
  [
    ['door', '客户/门类', 32, 13, 7, '#000000'],
    ['doorImg', '门图', 28, 12, 6.2, '#111111'],
    ['order', '单号', 22, 12, 7, '#111111'],
    ['basicInfo', '订单信息', 30, 13, 7, '#111111'],
    ['lockImg', '方向', 14, 10, 8, '#111111'],
    ['doorsheet', '门扇', 35, 15, 9, '#111111'],
    ['doorframe', '外框', 39, 15, 9, '#111111'],
    ['windows', '亮窗/扣板', 36, 15, 9, '#111111'],
    ['remark', '备注', 30, 12, 7, '#111111'],
  ],
)
eq('§2.2 可见列宽合计 = 266mm（GS2 是 230）', visible.reduce((s, c) => s + c.widthMm, 0), 266)
eq('§2.1 表格标题 = 生产单', cfg.table.title, '生产单')
eq('§2.1 paper 与 GS2 全同', cfg.paper, { widthMm: 297, heightMm: 210, paddingMm: 3, orientation: 'landscape' })
eq('§2.1 print 与 GS2 全同', cfg.print, { copies: 1 })

// ---------------------------------------------------------------- //
// §3.4 表头
// ---------------------------------------------------------------- //
const expThead = visible.map((c) => `<th style="width:${c.widthMm}mm">${c.label}</th>`).join('')
const page1 = renderPage([], 0, 1, cfg)
eq(
  '§3.4 表头逐字（无内联 font-size / label 不转义）',
  page1.match(/<thead><tr>(.*?)<\/tr><\/thead>/)[1],
  expThead,
)

// ---------------------------------------------------------------- //
// §7.1 case 表：删 client、加 doorframe/windows
// ---------------------------------------------------------------- //
eq('§7.1 client 列已删（旧版 GS2 的 case 没了）', renderCell('client', { client: '张三' }), '')
eq('§7.1 doorframe 走多行文本（PS2 新增）', renderCell('doorframe', row), '<div class="ps2-line">门框:100*2</div><div class="ps2-line">前框:50</div>')
eq('§7.1 windows 走多行文本（PS2 新增）', renderCell('windows', row), '<div class="ps2-line">扣板:20*3</div>')
eq('§7.1 windows 空串 → 占位行（不是空串）', renderCell('windows', { windows: '' }), '<div class="ps2-line">&nbsp;</div>')
eq('§7.1 未知 key → 空串', renderCell('nope', row), '')

const IMG = 'width:100%;display:block;margin:0 auto;object-fit:contain;'
eq('§3.6b 门图单元格（url 不转义、结尾 ` />`）', renderCell('doorImg', row), `<img style="${IMG}" src="https://x/door.png" />`)
eq('§3.6b 空 url → 整格空串', renderCell('doorImg', { ...row, doorImg: '   ' }), '')
eq('§3.6b 方向图同款', renderCell('lockImg', row), `<img style="${IMG}" src="https://x/lock.png" />`)

// 单号：无编码器时只有字幕；4 段 → `D(a[0]+"/"+a[1])` + `<br>` + `D(a.slice(2).join("/"))`
eq(
  '§3.6c 单号字幕（无编码器）',
  renderCell('order', row),
  '<div style="text-align:center;line-height:1.4;">' + D('2026/09') + '<br>' + D('17-001') + '</div>',
)
const qrProvider = createQrSvgProvider((text) => ({ viewBox: '', inner: `<path data-t="${text}"/>` }))
eq(
  '§3.6c 有编码器 → 17mm / viewBox 回退 / preserveAspectRatio',
  renderCell('order', row, { qr: qrProvider }),
  '<svg style="width:17mm;height:17mm;display:block;margin:0 auto 0.5mm;" viewBox="0 0 180 180" preserveAspectRatio="xMidYMid meet"><path data-t="2026/09/17-001"/></svg>' +
    '<div style="text-align:center;line-height:1.4;">' + D('2026/09') + '<br>' + D('17-001') + '</div>',
)
eq('§7.1 单号为空 → 整格空串（order 不受空行占位影响）', renderCell('order', { OrderID: '' }), '')

// ---------------------------------------------------------------- //
// §3.5 明细行：前导 `\n  `、`</tr>` 前无换行
// ---------------------------------------------------------------- //
const expCells = visible
  .map((c) => `<td style="width:${c.widthMm}mm;font-size:${c.fontSize}pt;color:${c.fontColor};line-height:${c.rowHeightMm}mm;">` + renderCell(c.key, row) + '</td>')
  .join('')
eq('§3.5 明细行（前导 \\n  + 2 空格）', renderRow(row, cfg.table), `\n  <tr>${expCells}</tr>`)

// ---------------------------------------------------------------- //
// §3.3 单页骨架（前缀 ps- / ns ps2-）
// ---------------------------------------------------------------- //
const paperStyle = 'width:297mm;height:210mm;padding:3mm;position:relative;box-sizing:border-box;background:#fff;overflow:hidden'
const expPage1 = (rows) =>
  `\n  <section class="ps-sheet" style="${paperStyle}">\n    ` +
  '' +
  `\n    <div class="ps2-title">${D(cfg.table.title)}</div>\n    <table class="ps2-table">\n      <thead><tr>${expThead}</tr></thead>\n      <tbody>` +
  rows.map((r) => renderRow(r, cfg.table)).join('') +
  `</tbody>\n    </table>\n  </section>`
eq('§3.3 单页骨架逐字（ps-sheet / ps2-title / ps2-table）', renderPage([row], 0, 1, cfg), expPage1([row]))
eq('§3.3 单页无页码（留下连续两个 \\n    ）', page1.includes('overflow:hidden">\n    \n    <div class="ps2-title">'), true)
eq(
  '§3.3 多页时页码在第一个 \\n    后',
  renderPage([row], 0, 2, cfg).includes('overflow:hidden">\n    <div class="ps2-page-num">1 / 2</div>\n    <div class="ps2-title">'),
  true,
)
eq('§3.3 空数据 → 1 个空页（表头在、tbody 空、无页码）', renderPage([], 0, 1, cfg), expPage1([]))

// ---------------------------------------------------------------- //
// §3.2 根容器 / §3.1 完整文档
// ---------------------------------------------------------------- //
eq('§3.2 根容器（ps-root）', buildRootHtml(['P1', 'P2'], 'CSS'), '<div class="ps-root"><style>CSS</style>P1P2</div>')
eq(
  '§3.1 完整文档（title 字面量 = 自定义生产单2，不是「生产单」）',
  buildDocumentHtml('ROOT'),
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义生产单2</title></head><body>ROOT</body></html>',
)

// ---------------------------------------------------------------- //
// §7.4 S（编辑器预览）
// ---------------------------------------------------------------- //
const prev = renderPreviewTable([row], cfg)
eq(
  'S: 可见列为 0 早退',
  renderPreviewTable([row], { ...cfg, table: { ...cfg.table, columns: cfg.table.columns.map((c) => ({ ...c, visible: false })) } }),
  '<div style="text-align:center;color:#999;padding:20px;">无可见列</div>',
)
eq('S: th 有内联 font-size（打印版没有）', prev.includes('<th style="width:32mm;font-size:13.5pt;">客户/门类</th>'), true)
eq('S: tr 无前导换行', prev.includes('\n      <tbody><tr>'), true)
eq('S: 带 .ps2-prev-table style，borderColor 走配置', prev.includes('.ps2-prev-table th, .ps2-prev-table td { border:0.2mm solid #444444;'), true)

// ---------------------------------------------------------------- //
// §5 量测表：与打印版三处必须不同
// ---------------------------------------------------------------- //
const mt = buildMeasureTable([row], cfg)
eq('量测：th 带内联 font-size', mt.includes('<th style="width:32mm;font-size:13.5pt;">客户/门类</th>'), true)
eq('量测：tr 带 data-ridx', mt.includes('<tr data-ridx="0">'), true)
eq('量测：</thead><tbody> 紧接无换行', mt.includes('</tr></thead><tbody>'), true)

// ---------------------------------------------------------------- //
// §4 CSS 夹具比对（复跑一遍，确认没被改动）
// ---------------------------------------------------------------- //
eq(
  '§4 CSS 与 ps2-default.css 逐字节一致',
  css(createDefaultConfig()),
  fs.readFileSync('/Users/aaa/Desktop/door-main/docs/custom-docs-recon/ps2-default.css', 'utf8'),
)

// ---------------------------------------------------------------- //
// §3 「PS2 = GS2 换前缀」的机器验证
//
// §3 的原话是「PS2 的 HTML 与 GS2 逐字节相同，只差 (a) 类名 gs→ps 和 (b) 列集」。
// 这条**不能靠目测** —— 这里把两张单据喂**完全相同**的列集与行数据
// （只用两者共有的 7 个 key，且每个字段都非空，绕开 §6 的空段差异），
// 再把 PS2 输出的 `ps`→`gs` 还原，与 GS2 输出逐字节比。
// ---------------------------------------------------------------- //
const _GS2OUT = _ROOT + '/app/node_modules/.cache/ps2-htmlcheck-gs2.mjs'
await _build({
  entryPoints: ['/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral', outfile: _GS2OUT, logLevel: 'warning',
})
const gs2 = await import(_GS2OUT)

const sharedColumns = [
  { key: 'door', label: '门类', widthMm: 28, fontSize: 13, rowHeightMm: 7, fontColor: '#000000', visible: true },
  { key: 'doorImg', label: '门图', widthMm: 28, fontSize: 12, rowHeightMm: 6.2, fontColor: '#111111', visible: true },
  { key: 'order', label: '单号', widthMm: 24, fontSize: 12, rowHeightMm: 7, fontColor: '#111111', visible: true },
  { key: 'basicInfo', label: '订单信息', widthMm: 34, fontSize: 13, rowHeightMm: 7, fontColor: '#111111', visible: true },
  { key: 'lockImg', label: '方向', widthMm: 20, fontSize: 10, rowHeightMm: 8, fontColor: '#111111', visible: true },
  { key: 'doorsheet', label: '玻璃尺寸', widthMm: 36, fontSize: 14, rowHeightMm: 8, fontColor: '#111111', visible: true },
  { key: 'remark', label: '备注', widthMm: 30, fontSize: 12, rowHeightMm: 7, fontColor: '#111111', visible: true },
]
const sharedRow = {
  door: 'AAA<br>BBB',
  doorImg: 'https://x/a.png',
  OrderID: '2026/09/17-001',
  basicInfo: '2000*1000*100<br>DDD',
  lockImg: 'https://x/b.png',
  doorsheet: 'EEE<br>FFF',
  remark: 'GGG',
}
const mkCfg = (base) => ({ ...base, table: { ...base.table, title: 'TITLE', columns: sharedColumns } })
const cfgPs2 = mkCfg(cfg)
const cfgGs2 = mkCfg(gs2.createDefaultConfig())
const qrBoth = { qr: createQrSvgProvider((t) => ({ viewBox: '0 0 180 180', inner: `<path d="${t}"/>` })) }

// ⚠️ 归一化必须**只动类名 token**：`\bps(?=2?-)/` 只命中 `ps-` / `ps2-`。
// 不能图省事写 `replace(/ps/g,'gs')` —— 那会把 `https://` 变成 `httgs://`、
// `border-collapse` 变成 `border-collagse`（本脚本第一版就踩了这个坑，4 条假失败）。
const toGs = (s) => s.replace(/\bps(?=2?-)/g, 'gs')

eq(
  '§3 明细行：PS2 输出 ps→gs 还原后与 GS2 逐字节相同',
  toGs(renderRow(sharedRow, cfgPs2.table, qrBoth)),
  gs2.renderRow(sharedRow, cfgGs2.table, qrBoth),
)
eq(
  '§3 单页（含表头/标题/页码）：同上',
  renderPage([sharedRow, sharedRow], 0, 2, cfgPs2, qrBoth).replace(/\bps(?=2?-)/g, 'gs'),
  gs2.renderPage([sharedRow, sharedRow], 0, 2, cfgGs2, qrBoth),
)
eq(
  '§3 根容器 + CSS + 全页：同上',
  buildRootHtml([renderPage([sharedRow], 0, 1, cfgPs2, qrBoth)], css(cfgPs2)).replace(/\bps(?=2?-)/g, 'gs'),
  gs2.buildRootHtml([gs2.renderPage([sharedRow], 0, 1, cfgGs2, qrBoth)], gs2.css(cfgGs2)),
)
eq(
  '§5 量测表：同上',
  buildMeasureTable([sharedRow], cfgPs2, qrBoth).replace(/\bps(?=2?-)/g, 'gs'),
  gs2.buildMeasureTable([sharedRow], cfgGs2, qrBoth),
)
eq(
  '§7.4 编辑器预览表：同上',
  renderPreviewTable([sharedRow], cfgPs2, qrBoth).replace(/\bps(?=2?-)/g, 'gs'),
  gs2.renderPreviewTable([sharedRow], cfgGs2, qrBoth),
)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
if (failed.length) process.exitCode = 1
