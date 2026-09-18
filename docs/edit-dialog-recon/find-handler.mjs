import { readFileSync } from 'node:fs'
const FILE = process.argv[2] || 'legacy/js/Home-d6b13b9a.js'
const s = readFileSync(FILE, 'utf8')
const map = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
const tbl = map.decoders.dr
const dec = (t) => t.replace(/([A-Za-z_$][A-Za-z0-9_$]*)\(\s*(\d+)\s*\)/g, (m, id, n) => (tbl[n] === undefined ? m : '【' + tbl[n] + '】'))
for (const h of process.argv.slice(3)) {
  const re = new RegExp('onClick:\\s*' + h + '\\b', 'g')
  let m
  const hits = []
  while ((m = re.exec(s)) !== null) hits.push(m.index)
  console.log('### ' + h + ' → ' + (hits.length ? hits.join(', ') : '(none)'))
  for (const i of hits) console.log('   ' + dec(s.slice(i, i + 330)).replace(/\n/g, ' '))
}
