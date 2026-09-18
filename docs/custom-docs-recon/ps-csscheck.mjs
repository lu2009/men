// 自定义生产单（ic=14） · CSS 逐字节比对 —— 与 `gs2-csscheck.mjs` / `ps2-csscheck.mjs` 同款。
//
// 夹具 `ps-default.css` 的来源（§4.2）：从源码 `le`（`PS:1024-1034`）的字符串拼接直接求值得到
// （代入 `widthMm=210, heightMm=148`；★ `le` **只读 paper 的两个数**，
//  不读 paddingMm / orientation / globalHeaderFont）。
// `shasum = 4cc2aca8a830039602bd53b40f87e242f697dccb`，**709 字符 / 8 条规则**
// （底座是 1739 字符 / 23 条 —— 不是前缀替换，见 §4.2 的逐条差异表）。
//
// **本脚本只做一件事：把新版实现产出的 CSS 与它逐字节比。**
import fs from 'node:fs'

// —— 自带打包 ——
// 与另两个 csscheck 同因：Node 的 ESM 解析不了 TS 内部的无扩展名导入（`./types`、`./profile`），
// 所以脚本自己在开头调一次 esbuild 打包。
import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')
const _OUT = _ROOT + '/app/node_modules/.cache/ps-csscheck-bundle.mjs'
await _build({
  entryPoints: ['/Users/aaa/Desktop/door-main/app/src/utils/productionsheet/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT, logLevel: 'warning',
})
const _m = await import(_OUT)
const { createDefaultConfig, productionSheetCss } = _m

const fixturePath = '/Users/aaa/Desktop/door-main/docs/custom-docs-recon/ps-default.css'
const fixture = fs.readFileSync(fixturePath, 'utf8')
const out = productionSheetCss(createDefaultConfig())

console.log('fixture bytes :', Buffer.byteLength(fixture))
console.log('output  bytes :', Buffer.byteLength(out))
console.log('byte-equal    :', out === fixture)

// §4.2 的规模对照（信息性，不判成败）：PS 是 8 条选择器规则 / 709 字符，
// 底座是 23 条 / 1739 字符 ⇒ 「不是前缀替换」。这里数的是 `}` 出现次数（含 @page/@media 闭合）。
const braces = (s) => (s.match(/\}/g) || []).length
console.log('fixture `}` :', braces(fixture), ' output `}` :', braces(out), '（底座同口径为', braces(fs.readFileSync('/Users/aaa/Desktop/door-main/docs/custom-docs-recon/gs2-default.css', 'utf8')), '）')
console.log('fixture bytes === 709 :', Buffer.byteLength(fixture) === 709)
if (Buffer.byteLength(fixture) !== 709) process.exitCode = 1

if (out !== fixture) {
  const a = fixture.split('\n')
  const b = out.split('\n')
  console.log('fixture lines :', a.length, ' output lines :', b.length)
  const max = Math.max(a.length, b.length)
  let diffs = 0
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) {
      diffs++
      console.log(`line ${i + 1} DIFF`)
      console.log('  fixture:', JSON.stringify(a[i]))
      console.log('  output :', JSON.stringify(b[i]))
      if (diffs > 8) break
    }
  }
  if (diffs === 0) console.log('(no line-level diff — 差异在行尾/换行符)')
  process.exitCode = 1
}

// §4.2：宽度/高度**只代两个数**，改 padding / orientation / 全局字体**不动 CSS**
const touched = createDefaultConfig()
touched.paper.paddingMm = 30
touched.paper.orientation = 'landscape'
touched.globalHeaderFont.fontSize = 36
if (productionSheetCss(touched) !== fixture) {
  console.log('✗ paddingMm / orientation / globalHeaderFont 不该进 CSS')
  process.exitCode = 1
} else {
  console.log('✓ 只有 widthMm / heightMm 进 CSS（padding/orientation/全局字体不进）')
}
