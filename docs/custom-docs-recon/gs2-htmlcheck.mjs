// 玻璃合片单 HTML 结构比对 —— 期望串**逐字抄自逆向报告 §3**（不是抄自实现）。
import { createDefaultConfig } from '/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/defaults.ts'
import {
  buildDocumentHtml,
  buildRootHtml,
  escapeHtml,
  renderMultiline,
  renderOrderCaption,
  renderPage,
  renderRow,
  renderCell,
  renderPreviewTable,
  createQrSvgProvider,
} from '/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/html.ts'
import { css } from '/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/css.ts'

const cfg = createDefaultConfig()
const D = escapeHtml

const row = {
  client: '张三',
  door: '断桥铝<br>香槟色',
  OrderID: '2026/09/17-001',
  basicInfo: '2000*1000*100<br>开向：左开',
  lockImg: 'https://x/lock.png',
  doorsheet: '中空玻璃:5+12A+5<br>数量:2',
  doorImg: 'https://x/door.png',
  remark: '五金：执手',
}

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

// ---------------------------------------------------------------- //
// §3.4 表头
// ---------------------------------------------------------------- //
const visible = cfg.table.columns.filter((c) => c.visible)
const expThead = visible.map((c) => `<th style="width:${c.widthMm}mm">${c.label}</th>`).join('')
const actualThead = renderPage([], 0, 1, cfg).match(/<thead><tr>(.*?)<\/tr><\/thead>/)[1]
eq('§3.4 表头逐字（无内联 font-size / label 不转义）', actualThead, expThead)

// ---------------------------------------------------------------- //
// §3.6(a) 多行文本
// ---------------------------------------------------------------- //
eq(
  '§3.6a 多行文本',
  renderMultiline('a<br>b<br/> c '),
  '<div class="gs2-line">a</div><div class="gs2-line">b</div><div class="gs2-line">c</div>',
)
eq('§3.6a 空段丢弃 → 空串', renderMultiline('  <br> <br> '), '')
eq('§3.6a 转义 &<>"\'', renderMultiline('&<>"\''), '<div class="gs2-line">&amp;&lt;&gt;&quot;&#39;</div>')

// ---------------------------------------------------------------- //
// §3.6(b) 图片：结尾 ` />` 带空格、url 不转义、空串整格空
// ---------------------------------------------------------------- //
const IMG = 'width:100%;display:block;margin:0 auto;object-fit:contain;'
eq(
  '§3.6b 图片单元格',
  renderCell('doorImg', row),
  `<img style="${IMG}" src="https://x/door.png" />`,
)
eq('§3.6b 空 url → 整格空串', renderCell('lockImg', { ...row, lockImg: '   ' }), '')

// ---------------------------------------------------------------- //
// §3.6(c) 二维码 + 单号字幕
// ---------------------------------------------------------------- //
// 4 段：`2026/09/17-001` → `D(a[0]+"/"+a[1]) + "<br>" + D(a.slice(2).join("/"))` = `2026/09<br>17/001`
eq(
  '§3.6c 无编码器 → 只有字幕（= 旧版编码器抛错分支）',
  renderCell('order', row),
  '<div style="text-align:center;line-height:1.4;">' + D('2026/09') + '<br>' + D('17-001') + '</div>',
)

// 走真入口 createQrSvgProvider：顺带验证 viewBox 回退与缓存键
const qrProvider = createQrSvgProvider((text) => ({ viewBox: '', inner: `<path data-t="${text}"/>` }))
const orderCell = renderCell('order', row, { qr: qrProvider })
eq(
  '§3.6c 有编码器 → svg + 字幕，17mm/viewBox 回退/preserveAspectRatio',
  orderCell,
  '<svg style="width:17mm;height:17mm;display:block;margin:0 auto 0.5mm;" viewBox="0 0 180 180" preserveAspectRatio="xMidYMid meet"><path data-t="2026/09/17-001"/></svg>' +
    '<div style="text-align:center;line-height:1.4;">' +
    D('2026/09') +
    '<br>' +
    D('17-001') +
    '</div>',
)
// 缓存：第二次同文本应命中缓存、不再调编码器
let encodeCalls = 0
const counted = createQrSvgProvider((text) => {
  encodeCalls++
  return { viewBox: '0 0 180 180', inner: '<p/>' }
})
counted('X')
counted('X')
counted('Y')
eq('二维码缓存（键 text+"::m1"，同文本只编码一次）', encodeCalls, 2)
eq('空文本不编码（旧版 GS:247）', counted(''), null)
eq('§3.6c 单号为空 → 整格空串', renderCell('order', { OrderID: '' }), '')
eq('B() 2 段', renderOrderCaption('a/b'), 'a<br>b')
eq('B() 1 段', renderOrderCaption('abc'), 'abc')
eq('B() 3 段', renderOrderCaption('a/b/c/d'), 'a/b<br>c/d')

// ---------------------------------------------------------------- //
// §3.5 明细行：前导 `\n  `、`</tr>` 前无换行
// ---------------------------------------------------------------- //
const expCells = visible
  .map(
    (c) =>
      `<td style="width:${c.widthMm}mm;font-size:${c.fontSize}pt;color:${c.fontColor};line-height:${c.rowHeightMm}mm;">` +
      renderCell(c.key, row) +
      '</td>',
  )
  .join('')
eq('§3.5 明细行（前导 \\n  + 2 空格）', renderRow(row, cfg.table), `\n  <tr>${expCells}</tr>`)

// ---------------------------------------------------------------- //
// §3.3 单页 —— 多页（带页码）与单页（连续两个 \n    ）
// ---------------------------------------------------------------- //
const paperStyle =
  'width:297mm;height:210mm;padding:3mm;position:relative;box-sizing:border-box;background:#fff;overflow:hidden'
const expPage2 = (i, n, rows) =>
  `\n  <section class="gs-sheet" style="${paperStyle}">\n    ` +
  `<div class="gs2-page-num">${i} / ${n}</div>` +
  `\n    <div class="gs2-title">${D(cfg.table.title)}</div>\n    <table class="gs2-table">\n      <thead><tr>${expThead}</tr></thead>\n      <tbody>` +
  rows.map((r) => renderRow(r, cfg.table)).join('') +
  `</tbody>\n    </table>\n  </section>`
eq('§3.3 单页 · 多页时带页码', renderPage([row], 0, 2, cfg), expPage2(1, 2, [row]))

const expPage1 = (rows) =>
  `\n  <section class="gs-sheet" style="${paperStyle}">\n    ` +
  '' +
  `\n    <div class="gs2-title">${D(cfg.table.title)}</div>\n    <table class="gs2-table">\n      <thead><tr>${expThead}</tr></thead>\n      <tbody>` +
  rows.map((r) => renderRow(r, cfg.table)).join('') +
  `</tbody>\n    </table>\n  </section>`
eq('§3.3 单页 · 单页无页码（留下连续两个 \\n    ）', renderPage([row], 0, 1, cfg), expPage1([row]))
eq(
  '§3.3 空数据页（表头在、tbody 空、无页码）',
  renderPage([], 0, 1, cfg),
  expPage1([]),
)

// ---------------------------------------------------------------- //
// §3.2 根容器 / §3.1 完整文档
// ---------------------------------------------------------------- //
eq(
  '§3.2 根容器',
  buildRootHtml(['P1', 'P2'], 'CSS'),
  '<div class="gs-root"><style>CSS</style>P1P2</div>',
)
eq(
  '§3.1 完整文档（逐字，title 是字面量）',
  buildDocumentHtml('ROOT'),
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义玻璃合片单</title></head><body>ROOT</body></html>',
)

// ---------------------------------------------------------------- //
// §7.4 S（编辑器预览）与打印版的 4 处不同 + 17mm 决策
// ---------------------------------------------------------------- //
const prev = renderPreviewTable([row], cfg)
eq('S: 可见列为 0 早退', renderPreviewTable([row], { ...cfg, table: { ...cfg.table, columns: cfg.table.columns.map((c) => ({ ...c, visible: false })) } }), '<div style="text-align:center;color:#999;padding:20px;">无可见列</div>')
eq('S: 裸 table + 自带 style（无 class）', /^<div style="text-align:center;font-size:7mm[^"]*">玻璃合片单<\/div>\n    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">\n      <thead><tr>/.test(prev), true)
eq('S: th 有内联 font-size（打印版没有）', prev.includes(`<th style="width:30mm;font-size:13.5pt;">客户</th>`), true)
eq('S: tr 无前导换行（<tbody> 后直接接 <tr>）', prev.includes('\n      <tbody><tr>'), true)
eq('S: 带 .gs2-prev-table style，borderColor 走配置', prev.includes(`.gs2-prev-table th, .gs2-prev-table td { border:0.2mm solid ${cfg.table.borderColor};`), true)

// ---------------------------------------------------------------- //
// CSS 夹具比对（复跑一遍，确认没被改动）
// ---------------------------------------------------------------- //
import fs from 'node:fs'
eq(
  '§4 CSS 与 gs2-default.css 逐字节一致',
  css(createDefaultConfig()),
  fs.readFileSync('/Users/aaa/Desktop/door-main/docs/custom-docs-recon/gs2-default.css', 'utf8'),
)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
if (failed.length) process.exitCode = 1
