import { readFileSync } from 'node:fs'
const FILE = process.argv[2] || 'legacy/js/Home-d6b13b9a.js'
const s = readFileSync(FILE, 'utf8')
const map = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
const tbl = map.decoders.dr
const dec = (t) => t.replace(/([A-Za-z_$][A-Za-z0-9_$]*)\(\s*(\d+)\s*\)/g, (m, id, n) => (tbl[n] === undefined ? m : '【' + tbl[n] + '】'))

// 1. 所有 ic 赋值点 → 归属函数
const re = /ic(\[[A-Za-z_$][\w$]*\(\d+\)\]|\.value)\s*=\s*(\d+)/g
let m
const assigns = []
while ((m = re.exec(s)) !== null) assigns.push({ idx: m.index, ic: Number(m[2]) })

// 2. 反向找最近的函数定义名
function ownerName(idx) {
  const head = s.slice(Math.max(0, idx - 4000), idx)
  const pats = [/[,;]\s*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g, /function\s+([A-Za-z_$][\w$]*)\s*\(/g, /[,;{]\s*([A-Za-z_$][\w$]*)\s*=\s*function/g]
  let best = null
  for (const p of pats) {
    let mm
    while ((mm = p.exec(head)) !== null) if (!best || mm.index > best.i) best = { i: mm.index, name: mm[1] }
  }
  return best ? best.name : '?'
}

for (const a of assigns) {
  const name = ownerName(a.idx)
  // 找 onClick:name 绑定点
  const b = []
  const r2 = new RegExp('onClick:\\s*' + name.replace(/\$/g, '\\$') + '\\b', 'g')
  let mm
  while ((mm = r2.exec(s)) !== null) b.push(mm.index)
  const labels = b.map((i) => {
    const seg = s.slice(i, i + 260)
    const t = /createTextVNode\(([^)]{0,80})/.exec(seg)
    return (t ? t[1] : '?')
  })
  console.log(`ic=${String(a.ic).padStart(2)}  fn=${name.padEnd(6)} @${a.idx}  onClick@[${b.join(',')}]  label=${dec(labels.join(' / '))}`)
}
