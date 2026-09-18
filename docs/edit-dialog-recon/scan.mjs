import { readFileSync } from 'node:fs'
const FILE = process.argv[2]
const s = readFileSync(FILE, 'utf8')
const nums = process.argv.slice(3).map(Number)
for (const n of nums) {
  const re = new RegExp('[A-Za-z_$][A-Za-z0-9_$]*\\(\\s*' + n + '\\s*\\)', 'g')
  const hits = []
  let m
  while ((m = re.exec(s)) !== null) {
    hits.push(m.index + ':' + m[0])
    if (hits.length > 15) break
  }
  console.log(n, hits.length ? hits.join('  |  ') : '(none)')
}
