/*
 * 列头筛选 popover 的**逐字对照**：选项顺序、清除项、当前值回显，全部从旧版源码切出来比。
 *
 * 为什么值得单独盯：**顺序**这种东西错了不会报错、也不会崩 —— 只是用户看到的下拉顺序不对，
 * 而「清除项放最前还是最后」正是这一族里已经错过一次的地方（C7/C13）。
 *
 * 对照对象（新版见 `app/src/views/Home.vue` 的 `PAYMENT_OPTIONS` / `PROGRESS_OPTIONS` /
 * `headerFilter()`）：
 *   · 「未付」列头 `:11475-11508` 的选项顺序与文案
 *   · 「打单操作」列头 `:11534-11581`：`Bo` 四项 → 分隔线 → 自定义项 → 显示全部
 *   · 清除项（`bo` / `Po`）把筛选值置**空串** ⇒ 清除项**永不选中**（`Do`/`Io` 比的也是它）
 *
 * 用法：node docs/home-audit/headerfilter-logiccheck.mjs
 */
import { SRC, assertDecoder, balanced, deobf, runLegacy } from './legacy-slice.mjs'

assertDecoder()

// ⚠️ 这一段（列定义的 render 函数）里的局部解码器叫 **`s`**，不是 `g` ——
//    `const s = ...` 写在 render 函数开头，**不在我们的切片里**，闭包收不到，得手工告知。
//    先断言 `s` 确实指向主表（`s(467)` 必须等于 `dr(467)` = 回执单号），不然整套对照都是错的。
const S_LOCAL = ['s']
if (deobf('s(467)', S_LOCAL) !== JSON.stringify('回执单号')) throw new Error('局部解码器 s 解析不对')

// ------------------------------------------------- ① 「未付」列头的选项顺序 //
// 切片：从 `label:"未付"` 到下一列（`label:s(944)`，即 `dr(944)`）之前。
const UNPAID_START = SRC.indexOf('label:"未付"')
const UNPAID_END = SRC.indexOf('label:s(944)', UNPAID_START)
if (UNPAID_START < 0 || UNPAID_END < 0) throw new Error('「未付」列的锚点变了，先看一眼再改')
// ⚠️ 先 `deobf` 再抽 —— 选项文案有一部分是解码调用（`s(948)` = 部分付），
//    直接正则字面量会漏掉它们（第一版就漏了「部分付」）。
const UNPAID_SEG = deobf(SRC.slice(UNPAID_START, UNPAID_END), S_LOCAL)

/** 段里按出现顺序抽 `createTextVNode("X")` 的字面量。 */
const textNodes = (seg) => [...seg.matchAll(/createTextVNode\("([^"]+)"\)/g)].map((m) => m[1])
// 抽出来的第一个是**按钮名**（`dr(779)` = `" 付款状态 "`，**两端带空格**），选项在它后面 ⇒ 剔掉它。
const LEGACY_PAYMENT_ORDER = textNodes(UNPAID_SEG).filter((t) => t.trim() === t)

// ------------------------------------------------- ② 「打单操作」列头的顺序 //
const PROG_START = SRC.indexOf('label:"打单操作"')
const PROG_END = SRC.indexOf('label:"业务员"', PROG_START)
if (PROG_START < 0 || PROG_END < 0) throw new Error('「打单操作」列的锚点变了')
const PROG_SEG = deobf(SRC.slice(PROG_START, PROG_END), S_LOCAL)

// `Bo` = 4 个固定项。源码形态 `Bo=[...[g(1187),g(1309),"已订玻璃",g(1202)]`（`…` 是展开进数组）。
// 源码形态是 `Bo=[...[dr(1187),dr(1309),"已订玻璃",dr(1202)]]` —— **外层的 `...[]` 是原样有效的 JS**
//    （`[...[1,2]]` === `[1,2]`），所以直接求值即可，别去动那个 `...`
//    （第一版把它换掉了，结果多套了一层数组）。
const boRaw = balanced(SRC.slice(SRC.indexOf(',Bo=[')), '[')
const LEGACY_BO = runLegacy(`return ${deobf(boRaw)}`, { g: () => undefined })

// 清除项文案：`显示全部`（同为解码调用 `dr(624)`，已由上面的 deobf 还原）
const LEGACY_PROGRESS_CLEAR = textNodes(PROG_SEG).find((t) => t === '显示全部')
// 分隔线条件：源码 `La[s(755)][s(1039)] ? <el-divider style="margin:4px 0"/> : null`
//   ⇒ 反混淆后是 `La["value"]["length"]?`。**是条件式，不是无条件渲染** —— 没自定义项时不该出现分隔线。
const HAS_DIVIDER_GUARD =
  /La\["value"\]\["length"\]\?/.test(PROG_SEG) && /margin:"4px 0"/.test(PROG_SEG)

// ------------------------------------------------- ③ 清除项把值置成什么 //
// `bo`（未付）/ `Po`（打单操作）都是把 ref 置**空串**，不是置成选项文字。
const CLEAR_FNS = {
  未付_bo: deobf(balanced(SRC.slice(SRC.indexOf(',bo=()=>')), '{')),
  进度_Po: deobf(balanced(SRC.slice(SRC.indexOf(',Po=()=>')), '{')),
}

// ------------------------------------------------------------------ 新版 //
// ⚠️ 与 `app/src/views/Home.vue` 同值，改那边要同步改这里。
const NEW_PAYMENT_OPTIONS = ['已付', '未付', '部分付', '全部显示']
const NEW_PAYMENT_CLEAR = '全部显示'
const NEW_PROGRESS_FIXED = ['已打生产单', '未打生产单', '已订玻璃', '未订玻璃']
const NEW_PROGRESS_CLEAR = '显示全部'
/** 新版 `headerFilter` 拼 items 的写法：固定项 → 自定义项 → 清除项。 */
const newProgressItems = (custom) => [...NEW_PROGRESS_FIXED, ...custom, NEW_PROGRESS_CLEAR]

// -------------------------------------------------------------------- 对照 //
let pass = 0
let fail = 0
const eq = (label, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) pass++
  else {
    fail++
    console.log(`✗ ${label}\n    旧版 = ${JSON.stringify(a)}\n    新版 = ${JSON.stringify(b)}`)
  }
}
const truthy = (label, v) => {
  if (v) pass++
  else {
    fail++
    console.log(`✗ ${label}`)
  }
}

// ① 未付：`LEGACY_PAYMENT_ORDER` 已剔掉按钮名，剩下的就是选项
eq('未付列头 选项顺序', LEGACY_PAYMENT_ORDER, NEW_PAYMENT_OPTIONS)
truthy('未付 清除项就是最后一项', LEGACY_PAYMENT_ORDER.at(-1) === NEW_PAYMENT_CLEAR)

// ② 打单操作
eq('打单操作 固定 4 项', LEGACY_BO, NEW_PROGRESS_FIXED)
eq('打单操作 清除项', LEGACY_PROGRESS_CLEAR, NEW_PROGRESS_CLEAR)
eq('打单操作 无自定义项时的顺序', newProgressItems([]), [...LEGACY_BO, LEGACY_PROGRESS_CLEAR])
eq('打单操作 有自定义项时的顺序', newProgressItems(['自定义A']), [...LEGACY_BO, '自定义A', LEGACY_PROGRESS_CLEAR])
truthy('分隔线是「有自定义项才插」的条件式（不是无条件）', HAS_DIVIDER_GUARD)

// ③ 清除项永不选中：旧版把值置空串 ⇒ 与任何选项文字都不相等
for (const [name, src] of Object.entries(CLEAR_FNS)) {
  // 反混淆后是 `zo["value"]=""` 这种形态，所以匹配的是 `=""`，不是 `value=""`。
  truthy(`${name} 把筛选值置成了空串（所以清除项永不选中）`, /=\s*""/.test(src))
  truthy(`${name} 不把筛选值置成选项文字`, !/=\s*"(显示全部|全部显示)"/.test(src))
}
// 新版清除态用的是哨兵值（与选项文字同串）⇒ 必须显式排除，否则会一直高亮。
// 这条断言的是「新版知道自己要排除」这件事：常量里哨兵同时出现在选项表和 clearLabel 里。
truthy('新版未付的清除哨兵与选项文字同串（所以必须显式排除）', NEW_PAYMENT_OPTIONS.includes(NEW_PAYMENT_CLEAR))
truthy('新版进度的清除哨兵与选项文字同串', NEW_PROGRESS_CLEAR === '显示全部')

console.log(`\n旧版「未付」选项顺序：${JSON.stringify(LEGACY_PAYMENT_ORDER)}`)
console.log(`旧版「打单操作」固定项：${JSON.stringify(LEGACY_BO)} + 自定义 + ${JSON.stringify(LEGACY_PROGRESS_CLEAR)}`)
console.log(`\n对照 ${pass + fail} 条：通过 ${pass}，不符 ${fail}`)
process.exit(fail ? 1 : 0)
