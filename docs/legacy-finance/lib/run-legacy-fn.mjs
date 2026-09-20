/*
 * 把**旧服务端的 TS 函数原样切出来跑** —— 与 `docs/home-audit/legacy-slice.mjs` 同一套手法，
 * 只是那边切的是混淆后的前端 bundle，这边切的是可读的 TS 源码。
 *
 * 为什么不用手抄：本项目已经栽过「照着读一遍再写」的坑（见 `docs/home-audit/00-summary.md`
 * 末尾的教训）。**切源码跑**，转写错误就无从发生。
 *
 * 做法：
 *   ① 按函数名 + 花括号配平切出源码（认识字符串/模板串/注释/正则）；
 *   ② 用 esbuild（拿 `app/node_modules` 里的）把 TS 转成 JS —— 只是剥类型，不改语义；
 *   ③ `new Function` 跑，外部依赖由调用方注入。
 *
 * ⚠️ 只对**纯函数**用这个。碰 Prisma / 网络的函数切不出来也跑不了，
 *    那些只能靠两份独立阅读 + 回源码裁决。
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 仓库根从**本文件位置**推出（本文件在 `docs/*/lib/` ⇒ 往上**三级**才是仓库根）。
// 原来是写死的 `'/Users/aaa/Desktop/door-main'`：本机跑得通，换台机器或进 CI 就直接崩。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
// 旧版**服务端**源码在仓库外（用户本机 `/Users/aaa/Downloads/server`）—— 这是本仓库唯一
// 一处「跑台子需要仓库外文件」的依赖，CI 上不存在。路径可用 `LEGACY_SERVER_SRC` 覆盖，
// 将来若把那几个 `.ts` 收进仓库（或 CI 里挂上去），把变量指过来即可，这边不用再改。
// 注意：本模块**顶层就读** `finance.service.ts` ⇒ 文件不在时 import 就抛 ENOENT。
const LEGACY_SERVER = process.env.LEGACY_SERVER_SRC || '/Users/aaa/Downloads/server/src'
const LEGACY_SVC = `${LEGACY_SERVER}/modules/finance/finance.service.ts`
export const SVC_SRC = readFileSync(LEGACY_SVC, 'utf8')

/** 别的旧服务端源文件（要切别的模块时用它，见 `sliceFnFrom`）。 */
export const legacySrc = (rel) => readFileSync(`${LEGACY_SERVER}/${rel}`, 'utf8')

/**
 * 花括号配平切出**任意源文件**里 `name` 的完整定义。
 * `sliceFn` 是本函数在 finance.service.ts 上的绑定（保持既有调用方不受影响）。
 */
export function sliceFnFrom(src, name) {
  const SVC_SRC = src
  const re = new RegExp(`(?:^|\\n)(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`)
  let at = re.exec(SVC_SRC)?.index ?? -1
  let start = at
  if (at >= 0) {
    start = SVC_SRC.indexOf('\n', at) + 1
  } else {
    // `const name = (...) => {...}` 形态
    const re2 = new RegExp(`(?:^|\\n)(?:export\\s+)?(?:const|let)\\s+${name}\\s*=`)
    at = re2.exec(SVC_SRC)?.index ?? -1
    if (at < 0) throw new Error(`切不到函数：${name}`)
    start = SVC_SRC.indexOf('\n', at) + 1
  }
  // 从定义起点往后找**函数体**的那个 `{`，再配平。
  //
  // 🔴 2026-09-19 修：原来是「从定义起点往后找**第一个** `{`」。那个写法在
  //    **签名里带内联对象类型**时会切错 —— 例如
  //      `function parseScanMarker(value: unknown): { employee: string; date: string } | null {`
  //    第一个 `{` 是**返回类型**里的那个，配平到它自己的 `}` 就收工，
  //    于是返回一段**残缺源码**（`"function parseScanMarker(value: unknown): { employee: string; date: string }"`）。
  //    症状极隐蔽：`sliceFnFrom` 不报错，`toJs` 打出**空串**，最后在 `new Function` 里才炸成
  //    「xxx is not defined」—— 看着像名字写错，其实是切歪了。
  //    （`enrichDoorRow` 也是这种签名，同一个坑。）
  //
  //    改法：**先配平参数列表的括号**，再从 `)` 之后找函数体的 `{`。
  //    对「签名里没有 `{`」的函数（绝大多数）结果与改前**完全一样**；
  //    只对上面那种签名修好。`const f = x => {…}` 这种没有 `(` 在 `{` 之前的形态走原路。
  let searchFrom = start
  const paren = SVC_SRC.indexOf('(', start)
  const firstBrace = SVC_SRC.indexOf('{', start)
  if (paren >= 0 && (firstBrace < 0 || paren < firstBrace)) {
    let depth = 0
    let str = null
    for (let i = paren; i < SVC_SRC.length; i++) {
      const c = SVC_SRC[i]
      if (str) {
        if (c === '\\') i++
        else if (c === str) str = null
        continue
      }
      if (c === '"' || c === "'" || c === '`') { str = c; continue }
      if (c === '/' && SVC_SRC[i + 1] === '/') { while (i < SVC_SRC.length && SVC_SRC[i] !== '\n') i++; continue }
      if (c === '/' && SVC_SRC[i + 1] === '*') { i = SVC_SRC.indexOf('*/', i) + 1; continue }
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) { searchFrom = i + 1; break }
      }
    }
    // 参数表之后还可能是**返回类型**，而类型里同样可能有 `{…}`：
    //   `… ): { employee: string; date: string } | null {`  ← 返回类型那个 `{` 不是函数体。
    // 判据：**函数体的 `{` 前面一个非空白字符不是 `:`**（类型字面量前面必定是 `:`）。
    // 类型内部的括号计入 `d2`，免得钻进类型里面去。
    const prevNonSpace = (i) => {
      for (let j = i - 1; j >= start; j--) if (!/\s/.test(SVC_SRC[j])) return SVC_SRC[j]
      return ''
    }
    let d2 = 0
    let str2 = null
    for (let i = searchFrom; i < SVC_SRC.length; i++) {
      const c = SVC_SRC[i]
      if (str2) {
        if (c === '\\') i++
        else if (c === str2) str2 = null
        continue
      }
      if (c === '"' || c === "'" || c === '`') { str2 = c; continue }
      if (c === '/' && SVC_SRC[i + 1] === '/') { while (i < SVC_SRC.length && SVC_SRC[i] !== '\n') i++; continue }
      if (c === '/' && SVC_SRC[i + 1] === '*') { i = SVC_SRC.indexOf('*/', i) + 1; continue }
      if (c === '{') {
        if (d2 === 0 && prevNonSpace(i) !== ':') { searchFrom = i; break } // ★ 这就是函数体
        d2++
        continue
      }
      if (c === '}') { d2--; continue }
      // 到 `;` 还没见到函数体 ⇒ 这大概是**重载签名**之类，不认识 ⇒ 退回旧行为（第一个 `{`）。
      if (c === ';' && d2 === 0) break
    }
  }
  const open = SVC_SRC.indexOf('{', searchFrom)
  if (open < 0) throw new Error(`找不到函数体：${name}`)
  let depth = 0
  let str = null
  for (let i = open; i < SVC_SRC.length; i++) {
    const c = SVC_SRC[i]
    if (str) {
      if (c === '\\') i++
      else if (c === str) str = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      str = c
      continue
    }
    if (c === '/' && SVC_SRC[i + 1] === '/') {
      while (i < SVC_SRC.length && SVC_SRC[i] !== '\n') i++
      continue
    }
    if (c === '/' && SVC_SRC[i + 1] === '*') {
      i = SVC_SRC.indexOf('*/', i) + 1
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        // 箭头函数形态还要把 `=` 之前的部分补上；这里统一返回「从定义行到右花括号」
        return SVC_SRC.slice(start, i + 1)
      }
    }
  }
  throw new Error(`括号未配平：${name}`)
}

/** 用 esbuild 剥掉类型（不改语义），返回可 eval 的 JS 源码。 */
export async function toJs(tsSource) {
  const require_ = createRequire(`${ROOT}/app/`)
  const esbuild = require_('esbuild')
  const out = await esbuild.transform(tsSource, { loader: 'ts', format: 'esm', target: 'es2020' })
  // esbuild 会给带 `export` 的函数补一个尾部 `export { … };` 块，`new Function` 里不认 ⇒ 剥掉。
  return out.code
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
    .replace(/^export\s+(?=(async\s+)?(function|const|let|class))/gm, '')
}

/** `sliceFn` 在 finance.service.ts 上的绑定（既有调用方不变）。 */
export function sliceFn(name) {
  return sliceFnFrom(SVC_SRC, name)
}

/**
 * 把若干函数切出来一起跑。
 * `names` 里每个函数都会按**源码原样**注入；`scope` 里是它们引用的外部量。
 * `src` 可选 —— 缺省是 finance.service.ts；切别的模块时传 `legacySrc('...')`。
 */
export async function runLegacyFns(names, scope, body, src = SVC_SRC) {
  const parts = []
  for (const n of names) parts.push(await toJs(sliceFnFrom(src, n)))
  const code = `${parts.join('\n')}\n${body}`
  const keys = Object.keys(scope)
  const fn = new Function(...keys, code)
  return fn(...keys.map((k) => scope[k]))
}
