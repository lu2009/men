// 验收：新版 paginate.ts 与旧版参考实现 paginate.mjs **行为完全一致**。
//
// 做法：随机造大量 (rowHeights, 预算, penalty) 输入，两边各跑一遍比结果。
// 参考实现是从旧版源码逐字移植并已被 20 万组模糊测试验证过的，所以它就是基准。
import { createRequire } from 'node:module'

const ROOT = '/Users/aaa/Desktop/door-main'
const { build } = createRequire(`${ROOT}/app/`)(`${ROOT}/app/node_modules/esbuild`)

const out = `${ROOT}/app/node_modules/.cache/r2-paginate-check.mjs`
await build({
  entryPoints: [`${ROOT}/app/src/utils/receipt2/paginate.ts`],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: out,
  logLevel: 'warning',
})
const mine = await import(out)
const ref = await import(`${ROOT}/docs/receipt2-recon/paginate.mjs`)

const refFn = ref.paginate ?? ref.default
const mineFn = mine.paginate
if (typeof refFn !== 'function' || typeof mineFn !== 'function') {
  console.error('拿不到 paginate 函数：ref=', typeof refFn, ' mine=', typeof mineFn)
  process.exit(2)
}

// 固定用例（含边界）+ 随机用例
let fail = 0
let n = 0
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const run = (rows, noF, withF, pen) => {
  n++
  const a = refFn(rows, noF, withF, pen)
  const b = mineFn(rows, noF, withF, pen)
  if (!eq(a, b)) {
    fail++
    if (fail <= 5) {
      console.log(`✗ rows=${JSON.stringify(rows)} noF=${noF} withF=${withF} pen=${pen}`)
      console.log(`   参考=${JSON.stringify(a)}  新版=${JSON.stringify(b)}`)
    }
  }
}

// 边界
run([], 100, 90, 0)
run([30], 100, 90, 0)
run([30, 30, 35], 100, 90, 0)
run([30, 30, 35], 100, 90, 1)
run([50, 50, 30], 100, 90, 0)
run([50, 50, 30], 100, 90, 1)
run([30, 30, 30], 100, 90, 0)
run([30, 30, 30], 100, 90, 1)
run([200, 200], 100, 90, 0)
run([100], 100, 90, 0)
run([0, 0, 0], 100, 90, 0)

// 随机
let seed = 20260917
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
for (let k = 0; k < 200000; k++) {
  const len = Math.floor(rnd() * 15)
  const rows = Array.from({ length: len }, () => {
    const r = rnd()
    if (r < 0.1) return 0
    if (r < 0.2) return Math.round(rnd() * 400) // 超高单行
    return Math.round(rnd() * 60 * 10) / 10
  })
  const c = Math.round(rnd() * 300)
  const s = Math.max(0, c - Math.round(rnd() * 40))
  run(rows, c, s, rnd() < 0.5 ? 0 : 1)
}

console.log(`\n对拍 ${n} 组；不一致 ${fail} 组`)
console.log(fail === 0 ? 'RESULT: ALL PASS' : `RESULT: ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
