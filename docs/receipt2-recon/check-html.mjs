// 验收：新版 html.ts 的产出是否与旧版黄金样本**逐字节相等**。
//
// 对齐物：docs/receipt2-recon/07-golden-sample.md §1 的合成订单 + §2.1 的期望 HTML。
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const ROOT = '/Users/aaa/Desktop/door-main'
const { build } = createRequire(`${ROOT}/app/`)(`${ROOT}/app/node_modules/esbuild`)

const out = `${ROOT}/app/node_modules/.cache/r2-html-check.mjs`
await build({
  entryPoints: [`${ROOT}/app/src/utils/receipt2/html.ts`],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: out,
  logLevel: 'warning',
})
const html = await import(out)
const defaults = await import(
  await (async () => {
    const o = `${ROOT}/app/node_modules/.cache/r2-defaults-check.mjs`
    await build({
      entryPoints: [`${ROOT}/app/src/utils/receipt2/defaults.ts`],
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      outfile: o,
      logLevel: 'warning',
    })
    return o
  })()
)

const doc = readFileSync(`${ROOT}/docs/receipt2-recon/07-golden-sample.md`, 'utf8')

/** 取出「### <标题>」之后第一个 ```<lang> 代码块的内容。 */
function codeBlockAfter(title) {
  const at = doc.indexOf(title)
  if (at < 0) throw new Error(`找不到小节：${title}`)
  const start = doc.indexOf('```', at)
  const nl = doc.indexOf('\n', start)
  const end = doc.indexOf('\n```', nl)
  return doc.slice(nl + 1, end)
}

const order = JSON.parse(codeBlockAfter('## 1. 合成订单输入'))
const expected = codeBlockAfter('### 2.1 HTML')

const ctx = {
  visibility: { ...defaults.DEFAULT_VISIBILITY },
  brand: { ...defaults.DEFAULT_BRAND },
  elementConfigs: defaults.defaultElementConfigs(),
}

const actual = html.renderPage(order, order.receipt, true, ctx)

if (actual === expected) {
  console.log(`✓ HTML 逐字节相等（${actual.length} 字符）`)
  console.log('RESULT: ALL PASS')
  process.exit(0)
}

console.log(`✗ HTML 不等 —— 期望 ${expected.length} 字符，实际 ${actual.length} 字符`)
const n = Math.min(actual.length, expected.length)
let i = 0
while (i < n && actual[i] === expected[i]) i++
console.log(`\n首个差异在第 ${i} 字符（行 ${expected.slice(0, i).split('\n').length}）：`)
console.log(`  期望 …${JSON.stringify(expected.slice(Math.max(0, i - 100), i + 100))}`)
console.log(`  实际 …${JSON.stringify(actual.slice(Math.max(0, i - 100), i + 100))}`)
process.exit(1)
