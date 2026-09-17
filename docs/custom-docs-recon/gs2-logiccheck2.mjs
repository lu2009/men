

// —— 自带打包 ——
// 原本这里直接 `import ... from '.../*.ts'`，但 Node 的 ESM 解析不了 TS 内部的无扩展名导入
// （`./defaults`）。之前能跑是因为 /tmp 里有预打的 bundle，那是临时产物、仓库里存不住。
// 现在脚本自己在开头调一次 esbuild 打包，于是能长期留在仓库里、可重跑。
import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')
const _OUT = _ROOT + '/app/node_modules/.cache/gs2-logiccheck2-bundle.mjs'
await _build({
  entryPoints: ['/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT, logLevel: 'warning',
})
const _m = await import(_OUT)
const { createDefaultConfig, buildMeasureTable, waitForImages, renderPage } = _m

const def = createDefaultConfig()
let results = []
const eq = (n, a, e) => { const ok = a === e; results.push(ok); console.log(`${ok ? '✓' : '✗'} ${n}${ok ? '' : `\n  exp: ${JSON.stringify(e)}\n  act: ${JSON.stringify(a)}`}`) }
const row = { client: '张三', OrderID: 'A1' }

// ---- 单页模板的字面量边界（§3.3）----
const one = renderPage([row], 0, 1, def)
eq('单页：pageNum 空串 → 连续两个 \\n    ', one.includes('overflow:hidden">\n    \n    <div class="gs2-title">'), true)
eq('多页：pageNum 占位在第一个 \\n    后', renderPage([row], 0, 2, def).includes('overflow:hidden">\n    <div class="gs2-page-num">1 / 2</div>\n    <div class="gs2-title">'), true)
eq('</tr></thead> 与 <tbody> 之间无空格', one.includes('</tr></thead>\n      <tbody>'), true)
eq('</table> 与 </section> 之间是 \\n  ', one.includes('</table>\n  </section>'), true)
eq('<section> 前是 \\n  （2 空格）', one.startsWith('\n  <section class="gs-sheet" style="'), true)
eq('paperStyle 顺序照抄', one.includes('style="width:297mm;height:210mm;padding:3mm;position:relative;box-sizing:border-box;background:#fff;overflow:hidden"'), true)
eq('引号 style 属性外加引号", 结尾无分号', one.includes('overflow:hidden"'), true)

// ---- 量测表格（O）的三处「别抄成打印版」----
const mt = buildMeasureTable([row], def)
eq('量测：th 带内联 font-size（打印版没有）', mt.includes('<th style="width:30mm;font-size:13.5pt;">客户</th>'), true)
eq('量测：tr 带 data-ridx', mt.includes('<tr data-ridx="0">'), true)
eq('量测：</thead><tbody> 紧接无换行', mt.includes('</tr></thead><tbody>'), true)
eq('量测：裸 table style', mt.startsWith('<table style="width:100%;border-collapse:collapse;table-layout:fixed;">\n    <thead><tr>'), true)
eq('量测：tr 无前导换行', mt.includes('<tbody><tr data-ridx="0">'), true)
eq('量测/打印：二维码同 17mm（无 provider 时只有字幕）', mt.includes('line-height:1.4;">A1<'), true)

// ---- waitForImages：无 img 立即 resolve；超时兜底 ----
const fakeDoc = (n) => ({ querySelectorAll: () => Array.from({ length: n }, () => ({ complete: false, onload: null, onerror: null })) })
const t0 = Date.now()
await waitForImages(fakeDoc(0))
eq('waitForImages 无图立即返回', Date.now() - t0 < 50, true)
const t1 = Date.now()
await waitForImages(fakeDoc(2), 100)
const dt = Date.now() - t1
eq('waitForImages 超时兜底生效（≈100ms）', dt >= 90 && dt < 400, true)

console.log(`\n${results.filter(Boolean).length}/${results.length} 通过`)
if (results.some((r) => !r)) process.exitCode = 1
