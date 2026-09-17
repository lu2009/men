// 自定义生产单2 · CSS 逐字节比对 —— 与 `gs2-csscheck.mjs` 同款。
//
// 夹具 `ps2-default.css` 的来源（§4.1）：从 PS2 源码 `PS2:652-687` 的字符串拼接直接求值得到
// （代入 `widthMm=297, heightMm=210, paddingMm=3, borderColor=#444444, headerFontSize=13.5`），
// `shasum = 2ac1613b620a8df39c06d4221d38ed87ce25e1d3`，1739 字符。
// **本脚本只做一件事：把新版实现产出的 CSS 与它逐字节比。**
import fs from 'node:fs'

// —— 自带打包 ——
// 与 `gs2-csscheck.mjs` 同因：Node 的 ESM 解析不了 TS 内部的无扩展名导入（`./defaults`、
// `../docsheet/css`），所以脚本自己在开头调一次 esbuild 打包。
import { createRequire } from 'node:module'
const _ROOT = '/Users/aaa/Desktop/door-main'
const _req = createRequire(_ROOT + '/app/')
const { build: _build } = _req(_ROOT + '/app/node_modules/esbuild')
const _OUT = _ROOT + '/app/node_modules/.cache/ps2-csscheck-bundle.mjs'
await _build({
  entryPoints: ['/Users/aaa/Desktop/door-main/app/src/utils/productionsheet2/index.ts'],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: _OUT, logLevel: 'warning',
})
const _m = await import(_OUT)
const { createDefaultConfig, css } = _m

const fixturePath = '/Users/aaa/Desktop/door-main/docs/custom-docs-recon/ps2-default.css'
const fixture = fs.readFileSync(fixturePath, 'utf8')
const out = css(createDefaultConfig())

console.log('fixture bytes :', Buffer.byteLength(fixture))
console.log('output  bytes :', Buffer.byteLength(out))
console.log('byte-equal    :', out === fixture)

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
