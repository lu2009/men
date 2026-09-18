// 自定义合格标签（ic=13） · CSS 逐字节比对 —— 与 `gs2-csscheck.mjs` / `ps2-csscheck.mjs` / `ps-csscheck.mjs` 同款。
//
// 两份夹具都来自源码 `R`（`QL:633-661`）的字符串拼接直接求值，**同一份默认配置**（70×90）：
//   · `ql-default.css`  —— `printRotate90 = false`，**838 字符 / 11 条规则**
//   · `ql-rotate90.css` —— `printRotate90 = true`（其余不动），**1108 字符**
// 两者都**首字符 `\n`、末字符 `\n`**（与底座 `docSheetCss` 的做法一致）。
//
// **本脚本做三件事**：
//   1. 两份夹具逐字节相等；
//   2. §4.3 的「只代 3 个值」—— 改 `paddingMm`/`globalFont`/字段**不动 CSS**，改 `printRotate90` 才动；
//   3. 旋转分支的 3 处变化逐条钉死（`@page` 交换 / 新增 html,body 行 / 整行替换的 .qlabel-root）。
import fs from 'node:fs'

// —— 自带打包 ——
// 与另几个 csscheck 同因：Node 的 ESM 解析不了 TS 内部的无扩展名导入（`./types`、`./profile`），
// 所以脚本自己在开头调一次 esbuild 打包。
import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')
const _OUT = _ROOT + '/app/node_modules/.cache/ql-csscheck-bundle.mjs'
await _build({
  entryPoints: [_ROOT + '/app/src/utils/qualifiedlabel/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT, logLevel: 'warning',
})
const m = await import(_OUT)
const { createDefaultConfig, qualifiedLabelCss } = m

const DIR = _ROOT + '/docs/custom-docs-recon'
const fixtDefault = fs.readFileSync(DIR + '/ql-default.css', 'utf8')
const fixtRotate = fs.readFileSync(DIR + '/ql-rotate90.css', 'utf8')

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

// ---------------------------------------------------------------- //
// 1. 两份夹具逐字节
// ---------------------------------------------------------------- //
const cfgDefault = createDefaultConfig()
const outDefault = qualifiedLabelCss(cfgDefault)

console.log('—— 默认 70×90（不旋转）——')
console.log('  fixture bytes :', Buffer.byteLength(fixtDefault))
console.log('  output  bytes :', Buffer.byteLength(outDefault))
eq('ql-default.css 逐字节相等', outDefault, fixtDefault)
eq('ql-default.css 是 838 字符', Buffer.byteLength(fixtDefault), 838)
eq('ql-default.css 首字符是 \\n', fixtDefault[0], '\n')
eq('ql-default.css 末字符是 \\n', fixtDefault[fixtDefault.length - 1], '\n')

const cfgRotate = createDefaultConfig()
cfgRotate.paper.printRotate90 = true
const outRotate = qualifiedLabelCss(cfgRotate)

console.log('—— 同一份配置 + printRotate90 ——')
console.log('  fixture bytes :', Buffer.byteLength(fixtRotate))
console.log('  output  bytes :', Buffer.byteLength(outRotate))
eq('ql-rotate90.css 逐字节相等', outRotate, fixtRotate)
eq('ql-rotate90.css 是 1108 字符', Buffer.byteLength(fixtRotate), 1108)

// ---------------------------------------------------------------- //
// 2. §4.3：只有 3 个值进 CSS
// ---------------------------------------------------------------- //
console.log('—— §4.3 代入面 ——')
const touched = createDefaultConfig()
touched.paper.paddingMm = 20
touched.globalFont.fontSize = 30
touched.globalFont.fontFamily = 'Arial, sans-serif'
touched.globalFont.lineHeight = 2
touched.autoHideEmpty = false
touched.fields.forEach((f) => { f.x = 33; f.y = 44; f.width = 55; f.fontSize = 12 })
eq('改 paddingMm/globalFont/autoHideEmpty/全部字段 → CSS 不动', qualifiedLabelCss(touched), fixtDefault)

const widthOnly = createDefaultConfig()
widthOnly.paper.widthMm = 100
eq(
  '改 widthMm → @page 第一个数变',
  qualifiedLabelCss(widthOnly).includes('@page { size: 100mm 90mm; margin: 0; }'),
  true,
)

// ---------------------------------------------------------------- //
// 3. 旋转分支的 3 处变化（§4.3）
// ---------------------------------------------------------------- //
console.log('—— §4.3 旋转的 3 处变化 ——')
const dLines = fixtDefault.split('\n')
const rLines = fixtRotate.split('\n')
// 3-① @page 宽高交换
eq('① @page 宽高交换', rLines[4], '  @page { size: 90mm 70mm; margin: 0; }')
eq('① 不旋转时是 70mm 90mm', dLines[4], '  @page { size: 70mm 90mm; margin: 0; }')
// 3-② html,body 行**新增**（在 `html, body` 之后、`.qlabel-root` 之前）
eq(
  '② 新增 html,body 宽高行',
  rLines[11],
  '    html,body{width:90mm !important;height:70mm !important;overflow:hidden !important;}',
)
eq('② 不旋转时该行不存在', dLines[11], '    .qlabel-root{background:#fff !important;padding:0 !important;gap:0 !important;display:block !important;}')
// 3-③ .qlabel-root 整行替换；★ `top` 用的是**未旋转的高** = widthMm(70)，"照抄别修正"
eq(
  '③ .qlabel-root 整行替换（top 用未旋转的 widthMm=70）',
  rLines[12],
  '    .qlabel-root{position:fixed !important;top:70mm !important;left:0 !important;width:70mm !important;height:90mm !important;padding:0 !important;gap:0 !important;display:block !important;background:#fff !important;transform-origin:top left !important;transform:rotate(-90deg) !important;}',
)
eq('③ 仅此 2 行差异（旋转只多 1 行）', rLines.length, dLines.length + 1)
eq(
  '@media screen 块与旋转无关',
  rLines.slice(5, 10).join('\n'),
  dLines.slice(5, 10).join('\n'),
)

// ---------------------------------------------------------------- //
// 4. 非默认纸张的旋转（防止把 70/90 写死）
// ---------------------------------------------------------------- //
console.log('—— 非默认纸张 ——')
const odd = createDefaultConfig()
odd.paper.widthMm = 60
odd.paper.heightMm = 40
odd.paper.printRotate90 = true
const oddCss = qualifiedLabelCss(odd)
eq('60×40 旋转 → @page 40mm 60mm', oddCss.includes('@page { size: 40mm 60mm; margin: 0; }'), true)
eq(
  '60×40 旋转 → top 用未旋转宽 60mm、height 用 40mm',
  oddCss.includes(
    '.qlabel-root{position:fixed !important;top:60mm !important;left:0 !important;width:60mm !important;height:40mm !important;',
  ),
  true,
)

console.log('')
console.log('通过', results.filter((r) => r.ok).length, '/', results.length)
if (failed) process.exitCode = 1
