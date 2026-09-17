import fs from 'node:fs'
import { createDefaultConfig } from '/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/defaults.ts'
import { css } from '/Users/aaa/Desktop/door-main/app/src/utils/glasssheet2/css.ts'

const fixturePath = '/Users/aaa/Desktop/door-main/docs/custom-docs-recon/gs2-default.css'
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
}
