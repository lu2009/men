// Progress 整包反混淆（**带作用域**版）。
//
// 为什么不能用「全局名字→解码器」的传递闭包（我先写的那版就是错的）：
// 混淆包把解码器别名成 `N`，组件里又写 `const r=N,u=e,s=n` —— 其中
// `u=e` 是 **props**、`s=n` 是 **emit**，不是解码器。全局闭包会把 `e`/`n` 也算成解码器
// （它们恰好是轮转 IIFE 里的 `const e=E`），于是 `u(x)`、`s(x)` 全被错替。
// 同理模块顶层的 `import{g as o,f as n,...}` 也让 `n` 是 import 而非解码器。
// ⇒ 必须按**词法作用域**解析：参数/import/catch 一律遮蔽，只有真的 `const X=<解码器>` 才算别名。
//
// 实现：@babel/parser 出 AST（app/node_modules 里有），手写作用域链遍历，
// 把 `X(数字)` 调用点记成文本替换（不重新生成代码，避免动到别处）。
//
// 用法：node legacy/decode-progress-map.mjs && node legacy/decode-progress-scoped.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// `@babel/parser` 装在 `app/node_modules` 里 ⇒ 锚点必须是**本仓库的** `app/package.json`。
// 原来写死的是 `'/Users/aaa/Desktop/door-main/app/package.json'`：本机跑得通，换台机器或进 CI
// （checkout 在 `/home/runner/work/men/men`）就 `MODULE_NOT_FOUND`；而 `docs/progress-*.mjs`
// 那 5 个台子会**现调本脚本**生成夹具，于是跟着一起红（2026-09-20 CI run #1）。
// 本文件在 `legacy/` ⇒ 往上**一级**才是仓库根。
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(ROOT, 'app/package.json'))
const parser = require('@babel/parser')

const IN = process.argv[2] || 'legacy/js/Progress-f4bdef35.js'
const MAP = process.argv[3] || '/tmp/progress-map.json'
const OUT = process.argv[4] || '/tmp/progress.decoded.js'

const src = readFileSync(IN, 'utf8')
const { sets } = JSON.parse(readFileSync(MAP, 'utf8'))

const DECODERS = new Set(Object.keys(sets))
const ARRAY_FNS = new Set(Object.values(sets).map((s) => s.arrayFn))

const ast = parser.parse(src, { sourceType: 'module', ranges: false, errorRecovery: true })

const edits = []
const stats = { replaced: 0, unresolved: new Map() }
let skipNodes = null

/** 作用域链：每层是 Map<名字, 解码器名|null>。`null` = 已绑定但不是解码器（遮蔽）。 */
class Scope {
  constructor(parent) { this.parent = parent; this.names = new Map() }
  declare(name, dec) { this.names.set(name, dec) }
  lookup(name) {
    for (let s = this; s; s = s.parent) if (s.names.has(name)) return s.names.get(name)
    return undefined
  }
}

/** 把 `X(123)` 记为一次替换。 */
function record(node) {
  const { callee, arguments: args } = node
  if (callee.type !== 'Identifier' || args.length !== 1) return
  const a = args[0]
  if (a.type !== 'NumericLiteral') return
  const dec = current.lookup(callee.name)
  if (!dec) {
    if (DECODERS.has(callee.name)) stats.unresolved.set(callee.name, (stats.unresolved.get(callee.name) ?? 0) + 1)
    return
  }
  const v = sets[dec].table[a.value]
  if (typeof v !== 'string') return
  edits.push({ start: node.start, end: node.end, text: JSON.stringify(v) })
  stats.replaced++
}

/** 取参数名（含解构 / 默认值 / rest）。 */
function paramNames(pats, out = []) {
  for (const p of pats) {
    if (!p) continue
    switch (p.type) {
      case 'Identifier': out.push(p.name); break
      case 'AssignmentPattern': paramNames([p.left], out); break
      case 'RestElement': paramNames([p.argument], out); break
      case 'ObjectPattern':
        for (const pr of p.properties) paramNames([pr.type === 'RestElement' ? pr.argument : pr.value], out)
        break
      case 'ArrayPattern': paramNames(p.elements, out); break
      default: break
    }
  }
  return out
}

/** 从 `const X = <标识符>` 里取「被绑定的名字 → 右侧名字」。 */
function declaratorAlias(d) {
  if (d.id?.type !== 'Identifier' || d.init?.type !== 'Identifier') return null
  return { name: d.id.name, from: d.init.name }
}

let current = new Scope(null)

function walk(node, scope) {
  if (!node || typeof node.type !== 'string') return
  if (skipNodes && skipNodes.has(node)) return
  const prev = current
  current = scope
  try {
    walkInner(node, scope)
  } finally {
    current = prev
  }
}

function walkInner(node, scope) {
  switch (node.type) {
    // ---- 作用域引入点 ----
    case 'Program': {
      const s = new Scope(null)
      // 解码器函数声明先登记（函数声明会提升）
      for (const st of node.body) {
        if (st.type === 'FunctionDeclaration' && st.id) {
          s.declare(st.id.name, DECODERS.has(st.id.name) ? st.id.name : null)
        } else if (st.type === 'ImportDeclaration') {
          for (const sp of st.specifiers) s.declare(sp.local.name, null)
        } else if (st.type === 'VariableDeclaration') {
          for (const d of st.declarations) if (d.id?.type === 'Identifier') s.declare(d.id.name, null)
        } else if (st.type === 'ClassDeclaration' && st.id) {
          s.declare(st.id.name, null)
        }
      }
      current = s
      for (const st of node.body) walk(st, s)
      return
    }

    case 'FunctionDeclaration': {
      const s = new Scope(scope)
      for (const n of paramNames(node.params)) s.declare(n, null)
      if (node.id) s.declare(node.id.name, null)
      // 函数体内部的 var/function 提升：先粗登记一层
      current = s
      walk(node.body, s)
      return
    }
    case 'FunctionExpression':
    case 'ArrowFunctionExpression': {
      const s = new Scope(scope)
      for (const n of paramNames(node.params)) s.declare(n, null)
      if (node.id) s.declare(node.id.name, null)
      current = s
      walk(node.body, s)
      return
    }
    case 'BlockStatement':
    case 'StaticBlock': {
      const s = new Scope(scope)
      current = s
      for (const st of node.body) walk(st, s)
      return
    }
    case 'CatchClause': {
      const s = new Scope(scope)
      if (node.param) for (const n of paramNames([node.param])) s.declare(n, null)
      current = s
      walk(node.body, s)
      return
    }
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement': {
      const s = new Scope(scope)
      current = s
      // 循环头里的声明也算
      if (node.type === 'ForStatement') { walk(node.init, s); walk(node.test, s); walk(node.update, s) }
      else { walk(node.left, s); walk(node.right, s) }
      walk(node.body, s)
      return
    }

    // ---- 声明：别名解析就在这里 ----
    case 'VariableDeclaration': {
      for (const d of node.declarations) {
        walk(d.init, scope)
        const alias = declaratorAlias(d)
        if (alias && d.id.type === 'Identifier') {
          const fromDec = scope.lookup(alias.from)
          // ⚠️ 这里原来还有半句 `&& !ARRAY_FNS.has(alias.name)` —— **判断错对象了**：
          //    它查的是「别名自己的名字」，而该防的是「从数组函数别名过来」——
          //    后者由 `fromDec` 为空天然挡住，不需要额外条件。
          //    后果（2026-09-19 在 Qrscanner 包上撞见）：组件内的局部解码器别名
          //    一旦与**别的**包里某个数组函数同名（例：`m`），这条别名就被漏声明，
          //    它管的一大片调用点全部解不出来 —— **而且不报错**（Qrscanner 包
          //    140 处 vs 应有 1615 处）。修完 Progress 包仍是 4173 处、0 残留。
          if (fromDec) scope.declare(alias.name, fromDec)
          else scope.declare(alias.name, null)
        } else {
          // 解构声明：一律遮蔽
          for (const n of paramNames([d.id])) scope.declare(n, null)
        }
      }
      return
    }

    // ---- 调用点 ----
    case 'CallExpression':
    case 'OptionalCallExpression':
    case 'NewExpression':
      record(node)
      break

    default: break
  }

  // 通用子节点遍历
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue
    const v = node[key]
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, scope) }
    else if (v && typeof v.type === 'string') walk(v, scope)
  }
}

walk(ast, current)

// 逆序应用替换，避免位移失效
edits.sort((a, b) => b.start - a.start)
let out = src
for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)

writeFileSync(OUT, out)
console.error(`替换 ${stats.replaced} 处；写出 ${OUT}（${src.length} → ${out.length} 字符）`)
if (stats.unresolved.size) {
  console.error(`⚠️ 见到但解析不出解码器的调用名：${[...stats.unresolved].map(([k, v]) => `${k}×${v}`).join(', ')}`)
}
// 收尾：还有没有 `X(三位数)` 形状的残留
const left = [...out.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]{0,3})\((\d{2,4})\)/g)].slice(0, 30)
console.error(`残留「名字(数字)」形状 ${left.length} 处：${left.map((m) => `${m[1]}(${m[2]})@${m.index}`).join(' ')}`)
