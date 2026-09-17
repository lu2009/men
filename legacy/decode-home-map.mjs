import { readFileSync, writeFileSync } from 'node:fs'
const FILE = process.argv[2] || 'legacy/js/Home-d6b13b9a.js'
const OUT = process.argv[3] || '/tmp/home-map.json'
const s = readFileSync(FILE, 'utf8')
const ID = '[A-Za-z_$][A-Za-z0-9_$]*'

// 1. builders
const builders = new Map()
for (const m of s.matchAll(new RegExp(`function (${ID})\\(\\)\\{const (${ID})=(\\[[\\s\\S]*?\\]);return\\(\\1=function\\(\\)\\{return \\2\\}\\)\\(\\)\\}`, 'g'))) {
  try { builders.set(m[1], JSON.parse(m[3])) } catch {}
}

// 2. rotations → decoder/builder 对
const rotations = []
const rotRe = new RegExp(`!function\\(\\)\\{(?:const ${ID}=(${ID}),${ID}=(${ID})\\(\\);|for\\(var ${ID}=(${ID}),${ID}=(${ID})\\(\\);;\\))for\\(;;\\)try\\{if\\(([\\s\\S]*?)\\)break;${ID}\\.push\\(${ID}\\.shift\\(\\)\\)\\}catch\\([^)]*\\)\\{${ID}\\.push\\(${ID}\\.shift\\(\\)\\)\\}\\}\\(\\)`, 'g')
for (const m of s.matchAll(rotRe)) {
  const dec = m[1] || m[3]; const bld = m[2] || m[4]; const cond = m[5]
  rotations.push({ decoder: dec, builder: bld, cond })
}

// 3. 每个 decoder 的 offset：function DEC(...){ ... [t-=OFF]（首个）
const decoders = new Map()
for (const r of rotations) {
  if (decoders.has(r.decoder)) continue
  const re = new RegExp(`function ${r.decoder}\\([^)]*\\)\\{[\\s\\S]*?\\[t-=(\\d+)\\]`)
  const m = re.exec(s)
  if (m) decoders.set(r.decoder, { builder: r.builder, offset: Number(m[1]) })
  else console.error('找不到 offset:', r.decoder)
}

const B64 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/='
function b64decode(e) {
  let t = '', a = ''
  for (let x, _, l = 0, o = 0; (_ = e.charAt(o++)); ~_ && (x = l % 4 ? 64 * x + _ : _, l++ % 4) ? t += String.fromCharCode(255 & x >> (-2 * l & 6)) : 0) _ = B64.indexOf(_)
  for (let x = 0, n = t.length; x < n; x++) a += '%' + ('00' + t.charCodeAt(x).toString(16)).slice(-2)
  return decodeURIComponent(a)
}

const shift = new Map([...builders.keys()].map((k) => [k, 0]))
function valueAt(decName, idx) {
  const d = decoders.get(decName)
  if (!d) return null
  const arr = builders.get(d.builder)
  const k = shift.get(d.builder)
  return b64decode(arr[((idx - d.offset + k) % arr.length + arr.length) % arr.length])
}
for (const r of rotations) {
  if (!decoders.has(r.decoder)) continue
  const builder = decoders.get(r.decoder).builder
  const arr = builders.get(builder)
  const start = shift.get(builder)
  const cond = r.cond.replace(/\be\((\d+)\)/g, (_, n) => `parseInt(valueAt(${JSON.stringify(r.decoder)}, ${n}))`)
  let solved = false
  for (let k = start; k < start + arr.length; k++) {
    shift.set(builder, k)
    let ok = false
    try { ok = !!eval(cond) } catch { ok = false }
    if (ok) { solved = true; break }
  }
  if (!solved) console.error('未解出旋转:', r.decoder, cond.slice(0, 80))
}

// 4. aliases (>=2 chars)
const raw = new Map()
for (const m of s.matchAll(new RegExp(`(?:const |,)(${ID})=(${ID})[,;]`, 'g'))) raw.set(m[1], m[2])
const aliases = {}
for (const [a, b] of raw) {
  if (a.length < 2) continue
  let n = b, seen = new Set()
  while (!decoders.has(n) && raw.has(n) && !seen.has(n)) { seen.add(n); n = raw.get(n) }
  if (decoders.has(n)) aliases[a] = n
}

const dec = {}
for (const [name, d] of decoders) {
  const arr = builders.get(d.builder)
  const map = {}
  for (let i = d.offset; i < d.offset + arr.length; i++) { try { map[i] = valueAt(name, i) } catch {} }
  dec[name] = map
}
writeFileSync(OUT, JSON.stringify({ decoders: dec, aliases }, null, 0))
console.error(`builders=${builders.size} decoders=${decoders.size} rotations=${rotations.length} aliases=${Object.keys(aliases).length}`)
console.error('decoders:', [...decoders.keys()].map(k=>`${k}(off=${decoders.get(k).offset},bld=${decoders.get(k).builder},len=${builders.get(decoders.get(k).builder).length})`).join(' '))
console.error('aliases:', Object.entries(aliases).map(([a,b])=>`${a}=${b}`).join(' '))
console.error(`已写出 ${OUT}`)
