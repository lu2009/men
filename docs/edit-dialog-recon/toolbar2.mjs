import { readFileSync } from 'node:fs'
const s = readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home-d6b13b9a.js', 'utf8')
const map = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
const tbl = map.decoders.dr
const dec = (t) => t.replace(/([A-Za-z_$][A-Za-z0-9_$]*)\(\s*(\d+)\s*\)/g, (m, id, n) => (tbl[n] === undefined ? m : tbl[n]))
const A = Number(process.argv[2] || 486500)
const B = Number(process.argv[3] || 500600)
const seg = s.slice(A, B)
// 按注释节点切分支，取每个分支的尾部作为一条
const chunks = seg.split('Vue.createCommentVNode("",!0)')
for (const c of chunks) {
  const lab = /createTextVNode\(([^)]{0,140})\)/.exec(c)
  const oc = /onClick:([A-Za-z_$][\w$]*|t\[\d+\]\|\|)/.exec(c)
  if (!lab && !oc) continue
  // 该分支的条件：chunk 里第一处 ? 前的比较式
  const q = c.indexOf('?(')
  let cond = q > 0 ? c.slice(Math.max(0, q - 260), q) : c.slice(0, 120)
  const cc = [...cond.matchAll(/(?:(\d+)\s*[!=]==?\s*ic(?:\[[^\]]*\]|\.value))|(?:ic(?:\[[^\]]*\]|\.value)\s*[!=]==?\s*(\d+))/g)].map((x) => x[0])
  const ds = /Vue\.toDisplayString\(([^)]{0,160})/.exec(c)
  console.log(
    String(A + seg.indexOf(c)).padStart(7),
    '|',
    (cc.length ? cc[cc.length - 1] : '—').padEnd(24),
    '|',
    (oc ? oc[1] : '?').padEnd(12),
    '|',
    lab ? JSON.stringify(dec(lab[1])) : '(动态) ' + dec(ds ? ds[1] : '')
  )
}
