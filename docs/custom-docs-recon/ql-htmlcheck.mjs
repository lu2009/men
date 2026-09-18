// 自定义合格标签（ic=13） · HTML 逐字节比对 —— 与 `gs2-htmlcheck.mjs` / `ps2-htmlcheck.mjs` 同款。
//
// 夹具 `ql-sample.html`（5619 字符）= `ae()` 的产物，由 `/tmp/ql-recon/ae.js` 用**下面这两条行数据**
// 跑旧版源码得到；`ql-document.html`（6636 字符）= `de()` 的全文档（body 与前者**逐字节相同**）。
//
// ★★ **夹具的出处必须说清楚（本脚本最重要的一个前提）**：
//    `ae.js` 里那句 `K = new y()`（`QL:523`）把**编码器换成了 `new y()` 而 `y` 是空函数**
//    —— 所以 `K.write(...)` 是 `undefined is not a function`，**每次都抛**、
//    被 `QL:581-583` 的 `catch` 接住 → `return null` → `QL:585` 的 `return ""`。
//    ⇒ 夹具里**第一张标签根本没有二维码节点**（不是"没画对"，是"编码器是个桩"）。
//    第二张的 `<svg … viewBox="0 0 1 1">` 是**空值占位**分支（`QL:560-567`），
//    那条路**不碰编码器**，所以它照常出现。
//    ⇒ **夹具只能用「编码失败的 provider」逐字节复现**（用例 1）。
//      「编码成功」那条分支的**形状**由用例 4 单独钉死（旧版那个桩覆盖不到它）。
//
// **本脚本六组用例**：
//   1. `ql-sample.html` 逐字节（`qr: () => null`，复现夹具的桩编码器）
//   2. `ql-document.html` 逐字节（同一份 body + head 多一段 `<style>`）
//   3. §4.2 的三分支 / `<br>` 不解释 / `autoHideEmpty` / 空 qrcode 占位 / package 的特例
//   4. 编码成功分支的结构（`viewBox` + `preserveAspectRatio` + inner）
//   5. 「无可显示字段」兜底占位 + 真编码器冒烟
//   6. §5.1 打印 iframe 的真实尺寸（纯函数逐字 + 最小 DOM 桩跑通接线）
import fs from 'node:fs'

import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')
const _OUT = _ROOT + '/app/node_modules/.cache/ql-htmlcheck-bundle.mjs'
await _build({
  entryPoints: [_ROOT + '/app/src/utils/qualifiedlabel/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT, logLevel: 'warning',
})
const m = await import(_OUT)
const {
  createDefaultConfig,
  buildQualifiedLabelHtml,
  buildQualifiedLabelDocument,
  renderField,
  renderLabel,
  createQualifiedLabelQrProvider,
  qualifiedLabelIframeStyle,
  QL_CLASSES,
  QL_EMPTY_QR_VIEW_BOX,
} = m

// `createQrSvgProvider` 是**底座**的工厂（本单只做参数化转出，按惯例不在 QL 桶文件里再转一次），
// 所以单独打一份底座的包来取它。
const _OUT_DS = _ROOT + '/app/node_modules/.cache/ql-htmlcheck-docsheet.mjs'
await _build({
  entryPoints: [_ROOT + '/app/src/utils/docsheet/html.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT_DS, logLevel: 'warning',
})
const { createQrSvgProvider } = await import(_OUT_DS)

const DIR = _ROOT + '/docs/custom-docs-recon'
const fixtSample = fs.readFileSync(DIR + '/ql-sample.html', 'utf8')
const fixtDocument = fs.readFileSync(DIR + '/ql-document.html', 'utf8')

let failed = false
const results = []
const eq = (name, actual, expected) => {
  const ok = actual === expected
  results.push({ name, ok })
  if (!ok) failed = true
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) {
    console.log('  expected:', JSON.stringify(expected))
    console.log('  actual  :', JSON.stringify(actual))
  }
}
const ok = (name, cond) => eq(name, !!cond, true)

// —— 夹具用的两条行数据（逐字抄自 `/tmp/ql-recon/ae.js` 的 `rows`）——
const ROWS = [
  {
    orderID: '2305-1', qrcode: '2305-1', client: '张先生',
    door: '型材:80断桥', size: '尺寸:2200*900*30*120*400',
    lockway: '开向:单包边左内开', color: '颜色:香槟',
    glass: '玻璃:5+12A+5-5+12A+5', address: '地址:某某小区1栋2单元',
    remark: '备注:加急<br>加配:拉手', package: '3-1',
  },
  {
    orderID: '2305-2', qrcode: '', client: '', door: '型材:',
    size: '尺寸:1800*800', lockway: '开向:右外开', color: '颜色:',
    glass: '玻璃:单玻-', address: '地址:', remark: '', package: '1-1',
  },
]

// ---------------------------------------------------------------- //
// 1. ql-sample.html 逐字节
// ---------------------------------------------------------------- //
console.log('—— 1. ql-sample.html（桩编码器：恒 null）——')
const cfg = createDefaultConfig()
const failingQr = () => null // 等价于旧版 `K = new y()` 每次抛
const html = buildQualifiedLabelHtml(ROWS, cfg, { qr: failingQr })
console.log('  fixture bytes :', Buffer.byteLength(fixtSample))
console.log('  output  bytes :', Buffer.byteLength(html))
eq('ql-sample.html 逐字节相等', html, fixtSample)
eq('ql-sample.html 是 5619 字符', Buffer.byteLength(fixtSample), 5619)
eq('样本里恰好 2 张标签', (html.match(/<section class="qlabel"/g) || []).length, 2)

// ---------------------------------------------------------------- //
// 2. ql-document.html 逐字节
// ---------------------------------------------------------------- //
console.log('—— 2. ql-document.html ——')
const doc = buildQualifiedLabelDocument(ROWS, cfg, { qr: failingQr })
eq('ql-document.html 逐字节相等', doc, fixtDocument)
eq('ql-document.html 是 6636 字符', Buffer.byteLength(fixtDocument), 6636)
eq('title 恒为「自定义合格标签」', doc.startsWith('<!DOCTYPE html><html><head><meta charset="utf-8"><title>自定义合格标签</title>\n'), true)
// ★ head 里多一段 <style>（§4.4）：文档里 CSS 出现两次
eq('文档里 `<style>` 出现 2 次（head + root 内）', (doc.match(/<style>/g) || []).length, 2)
eq('body 与 sample 逐字节相同', doc.slice(doc.indexOf('<body>') + 6, doc.indexOf('</body>')), fixtSample)
// head 的 style = `html,body{…}` 重置 + **同一份** R（R 自己以 `\n` 开头，所以这里到 `\n  .qlabel-root` 为止）
eq(
  'head 的 style 前缀逐字',
  doc.slice(doc.indexOf('<title>'), doc.indexOf('\n  .qlabel-root {')),
  '<title>自定义合格标签</title>\n  <style>html,body{margin:0;padding:0;background:#fff;}',
)

// ---------------------------------------------------------------- //
// 3. §4.2 的字段级事实（从夹具里逐条取出来对）
// ---------------------------------------------------------------- //
console.log('—— 3. §4.2 字段渲染的六个事实 ——')
const label1 = html.slice(html.indexOf('<section'), html.indexOf('</section>') + 10)
const label2 = html.slice(html.lastIndexOf('<section'), html.lastIndexOf('</section>') + 10)

// 3-① ★ `<br>` **不解释**，整串转义（本单最容易搞混的一处）
ok('① `备注:加急<br>加配:拉手` → 逐字显示 `&lt;br&gt;`（不切行）',
  label1.includes('>备注:加急&lt;br&gt;加配:拉手</div>'))
// ⚠️ 别用 `includes('-line')` 判 —— `-webkit-line-clamp` 里也有 `-line`。
//    底座那套按 `<br>` 切行会产出 `<div class="…-line">`，本单必须**一个都没有**。
ok('① 没有把 `<br>` 切成底座那套 `…-line` div',
  !/class="[^"]*-line"/.test(label1) && (label1.match(/<div class="qfield qfield-text"/g) || []).length === 10)

// 3-② 空值 + autoHideEmpty → 整字段消失（第 2 张少 5 个字段）
const keys2 = [...label2.matchAll(/data-key="([^"]+)"/g)].map((x) => x[1])
eq('② 第 2 张的字段集（autoHideEmpty 命中 5 个）', keys2.join(','), 'qrcode,orderID,size,lockway,glass,package')
ok('② 五个空字段确实不在', ['door', 'client', 'color', 'address', 'remark'].every((k) => !keys2.includes(k)))

// 3-③ 空 qrcode → 空占位（仍占满框，且**不**受 autoHideEmpty 影响）
ok('③ 空 qrcode → viewBox="0 0 1 1" 的空占位',
  label2.includes('<svg class="qfield qfield-qr" data-key="qrcode" style="position:absolute;left:0.5mm;top:0mm;width:20mm;height:20mm;display:block;overflow:hidden;" viewBox="' + QL_EMPTY_QR_VIEW_BOX + '"></svg>'))
eq('③ 占位常量是 0 0 1 1', QL_EMPTY_QR_VIEW_BOX, '0 0 1 1')

// 3-④ 编码失败 → **整个字段消失**（夹具第 1 张就是这条路，没有任何兜底占位）
ok('④ 第 1 张没有 qrcode 节点（编码失败 → 空串）', !label1.includes('qrcode'))

// 3-⑤ 前缀：showPrefix=true 的字段「剥一次再拼一次」，净效果 = 原值
ok('⑤ `型材:80断桥` → 剥前缀再拼回 → 仍是 `型材:80断桥`', label1.includes('>型材:80断桥</div>'))
ok('⑤ `3-1` + 包装前缀 → `包装:3-1`', label1.includes('>包装:3-1</div>'))
ok('⑤ showPrefix=false 的 orderID/client 不加前缀', label1.includes('>2305-1</div>') && label1.includes('>张先生</div>'))

// 3-⑥ package 的 10pt / center（「应用到全部」必须排除它）
ok('⑥ package 是 10pt + 居中', label1.includes('>包装:3-1</div>') && /data-key="package"[^>]*font-size:10pt[^>]*text-align:center/.test(label1))
ok('⑥ wrap=true 的 remark 有三条互斥样式',
  /data-key="remark"[^>]*white-space:normal;word-break:break-all;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden/.test(label1))
ok('⑥ wrap=false 的 orderID 是 nowrap + 省略号',
  /data-key="orderID"[^>]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis/.test(label1))
// ★ globalFont 里唯一「一键改全部」的键：**每个文本字段**都内联写死（10 个字段 + 1 个 section = 11 处）
ok('⑥ 10 个文本字段各自写死 line-height，加上 section 共 11 处',
  (label1.match(/line-height:1\.1/g) || []).length === 11)
ok('⑥ section 的 font-family 引号已换成单引号',
  label1.includes("font-family:'Microsoft YaHei', sans-serif;"))
ok('⑥ section 以 page-break-after:always 收尾',
  label1.includes('overflow:hidden;page-break-after:always">'))
ok('⑥ 根容器的 4 个 class',
  html.startsWith('<div class="' + QL_CLASSES.root + '"><style>') &&
  label1.includes('class="' + QL_CLASSES.label + '" data-qlabel'))

// ---------------------------------------------------------------- //
// 4. 编码成功分支（夹具的桩编码器覆盖不到）
// ---------------------------------------------------------------- //
console.log('—— 4. 编码成功分支的结构 ——')
const stubProvider = createQrSvgProvider((text) => ({
  viewBox: '0 0 21 21',
  inner: '<rect x="0" y="0" width="21" height="21"/>',
}))
const label1Qr = renderField(cfg.fields[0], ROWS[0], cfg, stubProvider)
eq(
  '成功分支逐字',
  label1Qr,
  '<svg class="qfield qfield-qr" data-key="qrcode" style="position:absolute;left:0.5mm;top:0mm;width:20mm;height:20mm;display:block;overflow:hidden;" viewBox="0 0 21 21" preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width="21" height="21"/></svg>',
)
ok('宽高都用 field.width（20mm），与 field.height 无关', label1Qr.includes('width:20mm;height:20mm'))
// 缓存键必须是 text + "::m1"
let calls = 0
const counting = createQrSvgProvider((text) => { calls++; return { viewBox: '0 0 21 21', inner: text } })
counting('A'); counting('A'); counting('B')
eq('缓存键 text+"::m1"：同文本只编码一次', calls, 2)
eq('失败不缓存：provider 抛错 → null，再调仍会重试', (() => {
  let n = 0
  const p = createQrSvgProvider(() => { n++; throw new Error('boom') })
  p('X'); p('X')
  return n
})(), 2)
// ★ 本单专属的回退常量：底座缺省是 '0 0 180 180'，QL 传 200（`QL:571-577`）
eq('QL provider 的回退 viewBox 是 200',
  createQualifiedLabelQrProvider(() => ({ viewBox: '', inner: 'i' }))('Z').viewBox, '0 0 200 200')
eq('底座缺省仍是 180（C 家族逐字未动）',
  createQrSvgProvider(() => ({ viewBox: '', inner: 'i' }))('Z').viewBox, '0 0 180 180')

// ---------------------------------------------------------------- //
// 5. 兜底占位 + 真编码器冒烟
// ---------------------------------------------------------------- //
console.log('—— 5. 无可显示字段 + 真编码器 ——')
const hidden = createDefaultConfig()
hidden.fields.forEach((f) => { f.visible = false })
ok('全部字段隐藏 → 「无可显示字段」内联占位（无 class）',
  renderLabel(ROWS[0], hidden).includes('<div style="position:absolute;left:2mm;top:2mm;font-size:8pt;color:#666;">无可显示字段</div>'))
ok('占位仅在该张标签内出现一次（不影响别的标签）',
  (buildQualifiedLabelHtml([ROWS[0], ROWS[1]], hidden).match(/无可显示字段/g) || []).length === 2)

// ⚠️ **Node 没有 `DOMParser`**（本机 v24 实测 `typeof DOMParser === 'undefined'`），
//    而 `docsheet/qr.ts` 的 `svgToParts` 靠它把库产出的 `<svg>` 文本拆成 `{viewBox, inner}`
//    —— 所以**真实编码器链路在 Node 里默认走不到**（`svgToParts` 返回 `null`）。
//    这里装一个**最小 shim**（正则版），只为让「`createQrEncoder` → `createSvgTag` → 拆解」
//    这条链路端到端跑一遍。**浏览器里走的是真 `DOMParser`**，本 shim 不参与运行时代码。
//    ⇒ 下面这条冒烟用例的定位是「链路通不通」，**不是**「产物逐字节对不对」——
//      产物比对由用例 1/2 的夹具负责（那两条不依赖 DOMParser）。
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = class {
    parseFromString(text) {
      const viewBox = (text.match(/viewBox="([^"]*)"/) || [])[1] || ''
      const inner = (text.match(/<svg[^>]*>([\s\S]*)<\/svg>/) || [])[1] || ''
      return { documentElement: { getAttribute: (n) => (n === 'viewBox' ? viewBox : null), innerHTML: inner } }
    }
  }
}
const real = createQualifiedLabelQrProvider()
const svg = real('2305-1')
ok('真编码器能出图（qrcode-generator）', !!svg && !!svg.inner)
ok('真编码器产出的 viewBox 是 4 段（矩阵尺寸决定，与 200/180 无关）',
  typeof svg?.viewBox === 'string' && svg.viewBox.split(' ').length === 4 && svg.viewBox !== '0 0 200 200')
ok('中文文本也能出图（新版加固，见 docsheet/qr.ts 的 TODO）', !!real('张三-2305-1'))
// 真链路的产物能直接进字段（宽高仍取 field.width，与编码器无关）
ok('真链路产物进 renderField 后结构正确',
  renderField(cfg.fields[0], ROWS[0], cfg, real).includes('preserveAspectRatio="xMidYMid meet"'))

// ================================================================ //
console.log('—— 6. §5.1 打印 iframe：真实尺寸（四张里唯一的结构性差异）——')
// ================================================================ //
// 纯函数先逐字节钉死（`QL:943-947`）
eq(
  'iframe 样式逐字（真实尺寸、不随 printRotate90 交换）',
  qualifiedLabelIframeStyle(cfg.paper),
  'position:fixed;top:-9999px;left:-9999px;width:70mm;height:90mm;border:none;visibility:hidden;',
)
const rotPaper = { ...cfg.paper, printRotate90: true }
eq('★ 旋转时 iframe 尺寸**不交换**（仍 70×90，靠 CSS 自己转）',
  qualifiedLabelIframeStyle(rotPaper), qualifiedLabelIframeStyle(cfg.paper))
ok('与底座 C 家族/PS 的 0×0 样式**不同**（这条差异是真的存在）',
  !qualifiedLabelIframeStyle(cfg.paper).includes('width:0;height:0'))

// 再钉一次**接线**：`printQualifiedLabelDirect` 真的把这个样式递到 iframe 上了吗？
// 用最小 DOM 桩跑一遍整条链路（等图那段在没有 `<img>` 时立即 resolve，只等 300ms）。
const written = { html: null, style: null, printed: false, focused: false, removed: false }
const stubDoc = {
  open() {}, write(h) { written.html = h }, close() {},
  querySelectorAll: () => [],
}
const stubWin = { focus() { written.focused = true }, print() { written.printed = true }, document: stubDoc }
const stubIframe = { style: { cssText: '' }, contentWindow: stubWin, contentDocument: stubDoc }
globalThis.document = {
  createElement: () => stubIframe,
  body: {
    appendChild() {},
    contains: () => !written.removed,
    removeChild() { written.removed = true },
  },
}
const { printQualifiedLabelDirect } = m
await printQualifiedLabelDirect(ROWS, cfg, { qr: failingQr })
written.style = stubIframe.style.cssText
eq('接线：printQualifiedLabelDirect 把 QL 的 iframe 样式写进去了', written.style, qualifiedLabelIframeStyle(cfg.paper))
eq('接线：写进 iframe 的是**完整文档**（含 DOCTYPE）', written.html === fixtDocument, true)
eq('接线：focus + print 都调了（300ms 之后）', written.focused && written.printed, true)
await new Promise((r) => setTimeout(r, 1200))
eq('接线：1000ms 后摘掉 iframe', written.removed, true)

console.log('')
console.log('通过', results.filter((r) => r.ok).length, '/', results.length)
if (failed) process.exitCode = 1
