// 按解码表索引反查调用点（顺带看它附近设的 ic 值）。
import { readFileSync } from 'node:fs'

const s = readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home-d6b13b9a.js', 'utf8')
const idxs = process.argv.slice(2).map(Number)

for (const idx of idxs) {
  const pat = new RegExp(`([A-Za-z_$][\\w$]*)\\(${idx}\\)`, 'g')
  let m
  let n = 0
  while ((m = pat.exec(s))) {
    n++
    const ctx = s.slice(Math.max(0, m.index - 400), m.index + 200).replace(/\s+/g, ' ')
    const ic = [...ctx.matchAll(/ic(?:\.value)?\s*=\s*(\d+)/g)].map((x) => x[1])
    console.log(`--- ${m[1]}(${idx}) @${m.index}  ${ic.length ? 'ic=' + ic.join(',') : '(附近无 ic)'} ---`)
    console.log(ctx)
    console.log()
  }
  if (!n) console.log(`(${idx}) 未找到调用点`)
}
