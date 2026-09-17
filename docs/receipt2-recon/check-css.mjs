// 验收：新版 css.ts 的产出是否与旧版黄金样本**逐字节相等**。
//
// 对齐物：docs/receipt2-recon/css-landscape.css / css-portrait.css
// —— 那是用旧版代码实跑出来的原文（默认字号 + 默认纸型）。
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const ROOT = '/Users/aaa/Desktop/door-main'
// 脚本在 /tmp 下，node 解析不到 app 的 node_modules —— 显式从那里 require。
const { build } = createRequire(`${ROOT}/app/`)(`${ROOT}/app/node_modules/esbuild`)

// 把 css.ts（连同它 import 的 defaults/types）打成一个临时 ESM，再动态 import。
const out = `${ROOT}/app/node_modules/.cache/r2-css-check.mjs`
await build({
  entryPoints: [`${ROOT}/app/src/utils/receipt2/css.ts`],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: out,
  logLevel: 'warning',
})

const { css } = await import(out)

const fonts = {
  headerFontSize: 30,
  tableFontSize: 15,
  amountFontSize: 20,
  metaFontSize: 18,
  declarationFontSize: 15,
  orderDateFontSize: 13,
}
const widths = [13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5]

const cases = [
  ['landscape', { copies: 1, widthMm: 200, heightMm: 140, orientation: 'landscape' }],
  // 这个尺寸取自生成夹具的脚本 docs/receipt2-recon/extract-css.cjs:12（a5-portrait）
  ['portrait', { copies: 1, widthMm: 148, heightMm: 210, orientation: 'portrait' }],
]

let fail = 0
for (const [name, paper] of cases) {
  const file = `${ROOT}/docs/receipt2-recon/css-${name}.css`
  const expected = readFileSync(file, 'utf8')
  const actual = css(fonts, paper, widths)

  if (actual === expected) {
    console.log(`✓ ${name}: 逐字节相等（${actual.length} 字符）`)
    continue
  }
  fail++
  console.log(`✗ ${name}: 不等 —— 期望 ${expected.length} 字符，实际 ${actual.length} 字符`)
  // 找到第一处差异并给出上下文
  const n = Math.min(actual.length, expected.length)
  let i = 0
  while (i < n && actual[i] === expected[i]) i++
  console.log(`  首个差异在第 ${i} 字符：`)
  console.log(`    期望 ...${JSON.stringify(expected.slice(Math.max(0, i - 60), i + 60))}`)
  console.log(`    实际 ...${JSON.stringify(actual.slice(Math.max(0, i - 60), i + 60))}`)
}

console.log(fail === 0 ? '\nRESULT: ALL PASS' : `\nRESULT: ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
