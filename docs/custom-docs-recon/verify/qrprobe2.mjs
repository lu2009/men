// 给 Node 补一个最小 DOMParser 桩，验证「浏览器里能出码」这条路是通的。
import { createRequire } from 'node:module'
const ROOT = '/Users/aaa/Desktop/door-main'
const req = createRequire(`${ROOT}/app/`)
const { build } = req(`${ROOT}/app/node_modules/esbuild`)
const out = `${ROOT}/app/node_modules/.cache/gs2-qrprobe.mjs`
await build({ entryPoints: ['/tmp/gs2-verify/qrentry.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'warning' })

// 极简桩：只实现 qr.ts 用到的两个能力（documentElement + getAttribute + innerHTML）
globalThis.DOMParser = class {
  parseFromString(text) {
    const open = /<svg([^>]*)>/.exec(text)
    const attrs = open ? open[1] : ''
    const inner = open ? text.slice(open.index + open[0].length).replace(/<\/svg>\s*$/, '') : ''
    return {
      documentElement: {
        getAttribute: (n) => (new RegExp(n + '="([^"]*)"').exec(attrs) || [])[1] ?? null,
        innerHTML: inner,
      },
    }
  }
}

const m = await import(out)
const p = m.createQrSvgProvider(m.createQrEncoder())
// ⚠️ 探的是「非 ASCII / 带后缀」这两条编码边界，样本本身不重要；
//    但原先用的 `HT00000067…` 是**改口径之前**的回执单号形态，容易让人以为二维码内容就该长那样。
//    二维码扫出来的应当是**行级单号**（`N-YY/MM/DD`），所以换成这个形态。
//    见 `docs/2026-09-18-order-no-semantics.md` §4.1。
for (const t of ['85-26/09/14，3', '85-26/09/14-3', '']) {
  const r = p(t)
  console.log(`文本 ${JSON.stringify(t)}`)
  console.log(`  → ${r ? `viewBox="${r.viewBox}"  inner ${r.inner.length} 字符` : 'null（只画字幕）'}`)
}
