// 精确定位某个 ic 值是谁设的 —— 用「最小的包含函数」而不是「往前找最近的定义」，
// 避免窗口跨过函数边界把 ic 归错人（上一版就是这么把 ic=4/10 归给 pc 的）。
import { readFileSync } from 'node:fs'

const s = readFileSync('/Users/aaa/Desktop/door-main/legacy/js/Home-d6b13b9a.js', 'utf8')

/** 找到所有 `NAME=async(...)=>{` 的定义及其函数体范围（花括号配平）。 */
function functions() {
  const out = []
  const re = /[,;{]\s*(?:const\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g
  let m
  while ((m = re.exec(s))) {
    const open = s.indexOf('{', m.index + m[0].length - 1)
    let depth = 0
    let i = open
    let str = null
    for (; i < s.length; i++) {
      const c = s[i]
      if (str) {
        if (c === '\\') { i++; continue }
        if (c === str) str = null
        continue
      }
      if (c === '"' || c === "'" || c === '`') { str = c; continue }
      if (c === '{') depth++
      else if (c === '}' && --depth === 0) break
    }
    out.push({ name: m[1], a: open, b: i })
  }
  return out
}

const fns = functions()
const targets = process.argv.slice(2).map(Number)

for (const ic of targets) {
  const re = new RegExp(`ic(?:\\[[^\\]]+\\]|\\.value)?\\s*=\\s*${ic}\\b`, 'g')
  let m
  while ((m = re.exec(s))) {
    const at = m.index
    // 包含该位置的**最小**函数 = 区间长度最小的那个
    const owner = fns
      .filter((f) => f.a < at && at < f.b)
      .sort((x, y) => x.b - x.a - (y.b - y.a))[0]
    console.log(`ic=${ic} @${at}  归属函数: ${owner ? owner.name : '（顶层）'}`)
  }
}
