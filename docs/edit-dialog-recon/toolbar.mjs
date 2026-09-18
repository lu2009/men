import { readFileSync } from 'node:fs'
const s = readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home-d6b13b9a.js', 'utf8')
const map = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
const tbl = map.decoders.dr
const dec = (t) => t.replace(/([A-Za-z_$][A-Za-z0-9_$]*)\(\s*(\d+)\s*\)/g, (m, id, n) => (tbl[n] === undefined ? m : tbl[n]))
// 按 createVNode(w,{...},{default...createTextVNode(LABEL)}) 切块
const A = Number(process.argv[2] || 486500)
const B = Number(process.argv[3] || 500600)
const seg = s.slice(A, B)
const re = /Vue\.createVNode\(w,\{[^}]*?onClick:([A-Za-z_$][\w$]*|t\[\d+\])[\s\S]{0,260}?createTextVNode\(([^)]{0,120})\)/g
let m
while ((m = re.exec(seg)) !== null) {
  // 向前找最近的 ic 条件
  const head = seg.slice(Math.max(0, m.index - 900), m.index)
  const conds = [...head.matchAll(/(\d+)===(?:ic(?:\[[^\]]*\]|\.value))|(\d+)==(?:ic(?:\[[^\]]*\]|\.value))|(?:ic(?:\[[^\]]*\]|\.value))!==(\d+)/g)]
  const last = conds.slice(-6).map((c) => c[0])
  console.log(
    String(A + m.index).padStart(7),
    '|',
    (conds.length ? conds[conds.length - 1][0] : 'always').padEnd(22),
    '|',
    m[1].padEnd(10),
    '|',
    JSON.stringify(dec(m[2]))
  )
}
