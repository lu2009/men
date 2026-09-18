import { readFileSync } from 'node:fs'
const FILE = '/Users/aaa/Desktop/door-main/legacy/js/Home-d6b13b9a.js'
const s = readFileSync(FILE, 'utf8')
const map = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
const tbl = map.decoders.dr
const dec = (t) => t.replace(/([A-Za-z_$][A-Za-z0-9_$]*)\(\s*(\d+)\s*\)/g, (m, id, n) => (tbl[n] === undefined ? m : '【' + tbl[n] + '】'))
for (const name of process.argv.slice(2)) {
  const re = new RegExp('(?:,|;|\\{)\\s*' + name.replace(/\$/g, '\\$') + '\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>', 'g')
  let m
  const hits = []
  while ((m = re.exec(s)) !== null) hits.push(m.index)
  console.log('### ' + name + ' 定义点: ' + (hits.length ? hits.join(', ') : '(无)'))
  for (const i of hits) console.log('>>> ' + dec(s.slice(i, i + 900)))
  console.log()
}
