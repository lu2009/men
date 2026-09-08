// 反混淆 Diao-1afe5586.js（第二步：用索引→字符串映射替换所有解码器调用 + 美化）
const fs = require('fs')

const SRC = 'legacy/js/Diao-1afe5586.js'
const MAPS = 'legacy/diao-stringmaps.json'
const OUT = 'legacy/js/Diao.deobfuscated.js'

const maps = JSON.parse(fs.readFileSync(MAPS, 'utf8'))
const biz = maps['_0x2aaf69']?.map || {}
const ui = maps['_0x13b1bc']?.map || {}
const minor186 = maps['_0x186210']?.map || {}
const minor52 = maps['_0x52fd13']?.map || {}

// 业务串是否覆盖连续范围
const bizMin = 409
const bizMax = 1216

let s = fs.readFileSync(SRC, 'utf8')

// 1) 去 import / export
const impEnd = s.indexOf('const _imports_0=')
s = s.slice(impEnd)
s = s.replace(/export\{Diao as default\};?\s*$/, '')

// 2) 单遍替换：命名解码器 + 短别名（范围校验）
let named = 0
let short = 0

const combined = /_0x([0-9a-f]+)\((\d+)\)|\b([a-zA-Z])\((\d+)\)/g
s = s.replace(combined, (m, hex, num1, letter, num2) => {
  if (hex !== undefined) {
    // 命名解码器：_0xHEX(N)
    const n = parseInt(num1, 10)
    let map = null
    if (hex === '2aaf69' || hex === 'd002' || hex === '5a2c87' || hex === '5c2514' || hex === '3f6624') map = biz
    else if (hex === '13b1bc' || hex === '5b12') map = ui
    else if (hex === '186210') map = minor186
    else if (hex === '52fd13') map = minor52
    if (map && map[n] !== undefined) { named++; return JSON.stringify(map[n]) }
    return m
  }
  // 短别名：X(N)
  const n = parseInt(num2, 10)
  if (biz[n] !== undefined) { short++; return JSON.stringify(biz[n]) }
  if (ui[n] !== undefined) { short++; return JSON.stringify(ui[n]) }
  return m
})

// 3) 美化（字符串/模板/注释感知，遇 { ; } 换行）
function pretty(src) {
  let res = ''
  let i = 0
  let indent = 0
  let quote = null // null | ' | " | `
  let lineStart = true
  const pushIndent = () => { if (lineStart) { res += '  '.repeat(indent); lineStart = false } }
  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1]

    if (quote) {
      res += ch
      if (ch === '\\') { res += next; i += 2; continue }
      if (ch === quote) quote = null
      i++
      continue
    }
    // 行注释 / 块注释
    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') { res += src[i++]; lineStart = false }
      continue
    }
    if (ch === '/' && next === '*') {
      res += '/*'; i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { res += src[i++] }
      res += '*/'; i += 2; continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; pushIndent(); res += ch; i++; continue }

    if (ch === '{') {
      pushIndent(); res += '{\n'; indent++; lineStart = true
    } else if (ch === '}') {
      indent = Math.max(0, indent - 1)
      if (!lineStart) res += '\n'
      res += '  '.repeat(indent) + '}'
      lineStart = false
      if (next === ';' || next === ',' || next === ')') { res += next; i += 2; continue }
      res += '\n'; lineStart = true
    } else if (ch === ';') {
      res += ';\n'; lineStart = true
    } else {
      pushIndent(); res += ch
    }
    i++
  }
  return res
}

const out = pretty(s)

const header = `// Diao.deobfuscated.js —— 由 legacy/deobfuscate-diao.js 自动反混淆生成（勿手工编辑）。\n// 说明：字符串表混淆已还原；文件顶部与组件之间残留的 function _0xXXXX / 数组字面量为死代码，可忽略。\n// 关注点：Vue.defineComponent({ name:"Diao" ... }) 的 setup() 与 render()。\n\n`
fs.writeFileSync(OUT, header + out)

console.log('命名解码器替换:', named, ' 短别名替换:', short)
console.log('输出字节:', out.length, '->', OUT)
