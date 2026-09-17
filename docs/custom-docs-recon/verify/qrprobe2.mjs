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
for (const t of ['HT00000067，3', 'HT00000067-3', '']) {
  const r = p(t)
  console.log(`文本 ${JSON.stringify(t)}`)
  console.log(`  → ${r ? `viewBox="${r.viewBox}"  inner ${r.inner.length} 字符` : 'null（只画字幕）'}`)
}
