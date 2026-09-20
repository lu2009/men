/*
 * 「搬迁保真」比对**核心** —— `{home,hui}-extract-movecheck.mjs` 共用的那一份实现。
 *
 * ## 为什么抽出来（2026-09-20，Task 3.5）
 *
 * 两台守卫同源：Home 版是照着 Hui 版写的，`sliceFn` / `norm` **逐字相同**（当初用 `node -e`
 * 比对过），`applyRewrites` 只差「规则从哪来」。两份文件头的注释都写着「改其中一份的
 * `sliceFn`/`norm` 时**必须同步另一份**」。
 *
 * 那句规矩在 Task 3 撞出了死结：Home 侧实测出 `sliceFn` 有个洞（签名跨行 ⇒ 切不到函数体），
 * 而**修它就必须动两边**，于是「改一份」与「别碰另一份」互相矛盾。**这个模块就是解那个死结的**
 * —— 比对语义从此只有一份实现，不存在「同步」这件事。
 *
 * ## 这个模块里没有的东西（有意）
 *
 * · **清单**（搬了哪些名字、往哪个文件、有哪些声明的改写）**留在各自的守卫里** ——
 *   Home 是多目标 manifest（按 block 传 `rules`），Hui 是模块级 `MOVED`/`REWRITES`，
 *   形状本来就不同，硬合并只会让两边都变难懂。
 * · **判定与输出文案**（怎么算 pass、怎么打勾、退出码）也留在各自守卫里。
 * · `declares()`（反查「搬走后旧文件里不该再有同名定义」）只有 Home 版用，留在 Home 版。
 *
 * ## ⚠️ 能力边界（别把它当成「全都验过了」）
 *
 * 它是**文本切片器**，不是解析器：不认注释里的括号（`sliceFn` 的签名扫描跳过 `//` 与
 * `/* *\/`，函数体扫描**不跳**）、不认正则字面量里的括号、不认 JSX/模板串里的 `${}`。
 * 遇到括号收支为负（典型：正则字面量 `/)/`）会**退回按行切**而不是切出垃圾 —— 宁可少验，
 * 不可错验。
 */

/**
 * 比对的**核心**：返回首个不同行的行号（1 基），两串一致则返回 0。
 *
 * ⚠️ 主比对循环与 `--selftest` **共用这一个函数**（不是各写一份）——
 * 否则自测验的就不是主循环真正跑的那段代码，等于没测。
 */
export function firstDiffLine(a, b) {
  const A = a.split('\n')
  const B = b.split('\n')
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] !== B[i]) return i + 1
  }
  return 0
}

/**
 * 归一化：逐行去行首缩进、去行尾空白、丢空行。
 *
 * ⚠️ **不 strip `export`** —— 新文件里每个搬出去的东西都多一个 `export`，
 * 而那正是靠 `rewrites` 逐条声明的（见各守卫的 `rewrites`）。
 * 顺手 strip 掉的话，「多加了 `export` 却没登记」就再也看不见了。
 *
 * ⚠️ `//` 注释**保留**：注释也是文档，改了要看得见。
 */
export const norm = (s) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n')

/**
 * 切出一个声明的整段。认这几种声明形式：
 *
 *   · `function NAME(...) {...}` / `const NAME = ...`（含箭头、computed、ref）
 *   · `type NAME = ...` / `interface NAME {...}`（2026-09-20 Task 3.5 补的，见下）
 *
 * 切不出来返回 `null`（调用侧据此报「找不到」，别静默放过）。
 *
 * ## 起点判据
 *
 * `^[ \t]*(?:export\s+)?(?:async\s+)?(?:function|const|let|var|type|interface)\s+NAME\b`
 *
 * ⚠️ 用 `[ \t]*` 而不是 `\s*`：`\s` 会把**前一个换行**也吃进去，`m.index` 就落在空行上，
 *    后面按行切全错（表现为「旧文件里找不到」）。
 * ⚠️ 允许行首缩进 —— 新文件里它们缩在工厂函数内部（多 2 格）。
 * ⚠️ `(?:async\s+)?` **不能删**：删了 `async function foo()` 就认不出来，反查会**静默漏报**。
 *    `--selftest` 有一例专门钉住它（只在单侧钉住是不够的，见下）。
 *
 * ## 单行声明
 *
 * 整行括号收支为 0 ⇒ 就返回这一行（`const x = ref([])`、`const N = 3`、
 * 一行式 `type X = { a: string }`、一行式箭头 `const f = () => true`）。
 * ⚠️ 不能靠「行尾有分号」判 —— 本仓库这些行大多不写分号，会一路扫进下一个函数的体里
 *    （这两台守卫的前几版都栽在这）。
 *
 * ## 跨行声明（2026-09-20 Task 3.5 重写）
 *
 * 起点那一行括号收支不为 0 ⇒ 要跨行找**函数体**，判据仍是
 * **「后面紧跟换行的 `{`」** —— 本仓库里返回类型字面量一律写在一行内
 * （`{ label: string; value: string }`），从不换行；而所有函数/对象字面量的体都换行。
 * 按「参数表后第一个 `{`」会切到返回类型上（姊妹件前两版都栽在这）。
 *
 * 跨行扫描用一个**括号栈**，两处与旧版不同：
 *
 * 1. **允许参数表换行**：旧版尾部有一句 `if (c === '\n') break`，参数表一旦换行，
 *    函数体 `{` 就在那个换行之后，永远找不到 ⇒ 退化成「只返回签名那一行」。
 *    现在改成「只在**栈空**时遇到换行才停」。实测（Task 3）：`onCheckedKeys` 这类
 *    签名跨行的函数旧版只切出 `function onCheckedKeys(`，**函数体一行都不比** ——
 *    而它看起来是绿的。这是本仓库栽过的「守卫自身的洞」的重演。
 *    注意 `if (c === '\n') break` 只放开了「参数表里出现换行」这一类；
 *    `const X = [\n {\n…`（多行数组）在旧版也退化成按行切，现在靠**语句末**那条路修好，见下。
 *
 * 2. **函数体 `{` 必须是「栈空时」看到的那个**：参数里的对象字面量默认值
 *    （`opts: X = {\n a: 1,\n },`）后面也紧跟换行，但它出现在 `(` 之内 ⇒ 栈非空 ⇒ 不是函数体。
 *    同理 `const selCol = (): T => ({ … })` 的 `{` 在 `(` 之内，不算函数体
 *    （它由下面的「语句末」那条路整条切出）。
 *
 * ### 找不到函数体 `{` 时：切「整条语句」
 *
 * 表达式体箭头函数（`const pingColumns = computed<T[]>(() =>\n  x.filter(…),\n)`）、
 * 多行数组常量（`const PROGRESS_STEPS = [\n …\n]`）、多行 `type`（`type K =\n  | 'a'\n  | 'b'`）
 * **本来就没有函数体 `{`**。旧版对它们一律退化成「只返回第一行」，于是**第二行起改掉也看不出**。
 * 现在改成切到**语句末** —— 定义是「括号栈回到空之后遇到的第一个换行」。
 * （Task 4 要在 `PROGRESS_STEPS` 上做「改第二行必须报红」的变异测试，靠的就是这条。）
 *
 * ⚠️ 兜底：扫描中途**括号收支为负**（典型是正则字面量里的 `)`）或**走到文件尾栈都不空**
 *    ⇒ 退回旧版的「只返回第一行」。宁可少验，不可错验 —— 切出一段垃圾拼接会比报红更难查。
 *
 * ⚠️ 已知残留：函数体扫描**不跳注释**（签名扫描跳）。函数体里一段带不平衡花括号的注释
 *    仍会骗走配对。这是旧版就有的洞，本笔未动。
 *
 * ⚠️⚠️ **已知残留（Task 3.5 量出来的，别踩）——「首行括号正好配平、声明却在下一行继续」的声明，
 *     仍然只比首行。** 典型：
 *
 * ```ts
 * type TextFilterKey =        ← 这一行括号收支为 0 ⇒ 直接命中「单行声明」快车道
 *   | 'client_name'
 *   | 'order_date'
 * ```
 *
 *     ⇒ 切出来只有 `type TextFilterKey =`，**下面 9 行一行都不比**。
 *     同类还有 `const engine: OrderLines =`（`DetailLinesTable.vue:149`）、
 *     `const saved =`（`Hui.vue:1764`）这种「等号在行尾」的写法。
 *     注意这与「洞①」不同源：洞① 靠括号栈修，这一类**首行根本没有未闭合的括号**，
 *     要修得再加一层「行尾是不是续行记号（`=` `|` `&` …）」的判据 —— 是**第四个机制**，
 *     本笔**有意不做**（Task 3.5 的委托只点了三个洞；且它对**当时已登记的名字零影响**，
 *     也对 Task 4 要登记的四个形状零影响 —— `ProgressSegment` 一行式、`PROGRESS_STEPS`
 *     多行数组、`pad`/`AUTOCOMPLETE_ALWAYS_SHOW` 一行式箭头，全部切得完整）。
 *
 *     ⇒ **往 `BLOCKS` 里登记「等号在行尾」的多行声明之前，先按各守卫文件头的
 *       「改第二行必须报红」那套变异法验一遍**，别直接信绿勾。
 */
export function sliceFn(src, name) {
  // 允许行首缩进 —— 新文件里它们缩在工厂函数内部（多 2 格）。
  // ⚠️ 用 `[ \t]*` 而不是 `\s*`：`\s` 会把**前一个换行**也吃进去，`m.index` 就落在空行上，
  //    后面按行切全错（表现为「HEAD 里找不到」）。
  const re = new RegExp(
    `^[ \\t]*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var|type|interface)\\s+${name}\\b`,
    'm',
  )
  const m = re.exec(src)
  if (!m) return null
  const i = m.index

  // 单行声明（`const x = computed(() => f(y))` / `const N = 3` / 一行式 `type`）
  // 先按行判：整行括号收支为 0 就到此为止。
  // ⚠️ 不能靠「行尾有分号」判 —— 本仓库这两行都没写分号，会一路扫进下一个函数的体里（本脚本前几版就栽在这）。
  const firstNl = src.indexOf('\n', i)
  const firstLine = src.slice(i, firstNl < 0 ? src.length : firstNl)
  let lineDepth = 0
  for (const c of firstLine) {
    if (c === '{' || c === '(' || c === '[') lineDepth++
    else if (c === '}' || c === ')' || c === ']') lineDepth--
  }
  if (lineDepth === 0) return firstLine.replace(/\s+$/, '')

  /*
   * 跨行扫描。三种结局：找到函数体（`body`）· 找到语句末（`stmtEnd`）· 兜底（`bail`）。
   *
   * `stack` 记未闭合的 `(` `[` `{`。它同时干两件事：决定「换行能不能跨过去」，
   * 以及「这个 `{` 够不够格当函数体」。
   */
  const stack = []
  let body = -1
  let stmtEnd = -1
  let bail = false
  let inStr = null
  for (let k = i; k < src.length; k++) {
    const c = src[k]
    if (inStr) { if (c === '\\') { k++; continue } if (c === inStr) inStr = null; continue }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue }
    // 注释：参数表跨行时，注释里出现括号是常事（`onCheckedKeys` 的参数表里就有两行注释）。
    // 不跳过去的话它们会进栈，函数体 `{` 就再也等不到「栈空」。
    if (c === '/' && src[k + 1] === '/') { const nl = src.indexOf('\n', k); k = nl < 0 ? src.length : nl - 1; continue }
    if (c === '/' && src[k + 1] === '*') { const e = src.indexOf('*/', k + 2); k = e < 0 ? src.length : e + 1; continue }
    if (c === '\n') {
      // 只在**栈空**时收工 —— 栈非空说明还在参数表/表达式里面，继续走。
      if (stack.length === 0) { stmtEnd = k; break }
      continue
    }
    if (c === '{' && stack.length === 0) {
      const rest = src.slice(k + 1)
      if (/^\s*\n/.test(rest)) { body = k; break }
      // 否则是类型字面量/对象一行写法，跳过它的配对
      let d = 0
      for (let j = k; j < src.length; j++) {
        if (src[j] === '{') d++
        else if (src[j] === '}') { d--; if (d === 0) { k = j; break } }
      }
      continue
    }
    if (c === '(' || c === '[' || c === '{') stack.push(c)
    else if (c === ')' || c === ']' || c === '}') {
      // 多出来的右括号（正则字面量等）—— 栈已经不可信了，整段退回按行切。
      if (stack.length === 0) { bail = true; break }
      stack.pop()
    }
  }

  if (body < 0) {
    // 没有函数体：切「整条语句」。
    if (bail) return firstLine.replace(/\s+$/, '')
    if (stmtEnd >= 0) return src.slice(i, stmtEnd).replace(/\s+$/, '')
    // ⚠️ 走到**文件尾**、且括号已配平 ⇒ 这条语句就在文件尾收口，只是后面没有换行可停 ——
    //    切到文件尾。（Task 3.5 实测踩到：`fixtures/hui-pre-3b.ts` 的最后一个声明
    //    `diaoColumns` 就是这么收尾的，其组件侧同名声明在文件中间、后面有换行
    //    ⇒ 两边一个切 1 行、一个切 3 行，报出一处**假**差异。不补这条就是自己制造噪声。）
    if (stack.length === 0) return src.slice(i).replace(/\s+$/, '')
    // 括号没配平（正则字面量、被注释吃掉的括号…）⇒ 退回旧口径「只切第一行」。宁可少验，不可错验。
    return firstLine.replace(/\s+$/, '')
  }

  // 找到函数体 `{` 了：花括号配对，切到配对的 `}`。
  let d = 0
  inStr = null
  for (let k = body; k < src.length; k++) {
    const c = src[k]
    if (inStr) { if (c === '\\') { k++; continue } if (c === inStr) inStr = null; continue }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue }
    if (c === '{') d++
    else if (c === '}') { d--; if (d === 0) return src.slice(i, k + 1) }
  }
  return null
}

/**
 * 应用声明的改写；`from` 找不到就报错（规则失效比差异漏网更危险）。
 *
 * ⚠️ 语义是**逐条朴素 `split/join`**（不是正则）。所以规则一律要**带边界**：
 *    写 `dialog.warning({` 而不是 `dialog` —— 裸名会把别的标识符一起改坏
 *    （例：写 `load` 会顺手打到 `loadedIds` 上）。
 *
 * ⚠️ `rules` 的形状是 `{ 名字: [{from, to}, …] }`。**规则从哪来由调用侧决定**
 *    （Home 版按 block 传、Hui 版传它的模块级 `REWRITES`）—— 这正是两版原本唯一的分歧，
 *    也是这个参数存在的理由。
 *
 * ⚠️ 调用顺序：**先 `norm()` 再 `applyRewrites()`**。`norm()` 去了行首缩进，
 *    多行的 `from` 片段匹配不上 —— 所以 `from` 要写成**归一化后**的样子。
 */
export function applyRewrites(name, text, rules) {
  let out = text
  for (const r of rules[name] || []) {
    if (!out.includes(r.from)) {
      throw new Error(`声明的改写失效：${name} 里找不到 from 片段\n  ${r.from.slice(0, 120)}`)
    }
    out = out.split(r.from).join(r.to)
  }
  return out
}
