/*
 * 「可编辑单元格」形态的**逐字对照**。
 *
 * 结论（本脚本负责把它钉住，而不是靠读一遍就下判断）：
 *   · 旧版**没有**「先显示文本、点击才变输入框」这一态 —— 那几列**常驻输入框**，
 *     靠 `onFocus={nn}` 进编辑态（`za.value = row`）。
 *   · 业务员 / 打单人那两列在 `qt.value ? … : …` 两支里选，**带底色的 `la()` 是 `!qt` 那一支**。
 *   · `qt = (data.registrant === userinfo.name)` —— 「正在看的这份数据是不是自己租户的」，
 *     是旧版**代看别的租户**时的只读闸门。新版没有租户切换 ⇒ **`qt ≡ true`**
 *     ⇒ `la()` 分支不可达 ⇒ 那几个底色（收据单/标签/玻璃订单/生产单/自助下单）**本系统里不渲染**。
 *
 * 这正是本仓库先前一处改动的更正（提交 `a70ac477` 把 `la()` 的底色挂到了业务员/打单人的
 * 「非编辑态显示」上）—— 函数没挂错，**挂到了一个永远进不去的分支**。
 *
 * 用法：node docs/home-audit/editable-cell-logiccheck.mjs
 */
import { SRC, assertDecoder, deobf } from './legacy-slice.mjs'

assertDecoder()

// ⚠️ 列定义那个 render 函数里的局部解码器叫 `s`（不在切片里，见 headerfilter-logiccheck 的说明）。
const S_LOCAL = ['s']
if (deobf('s(467)', S_LOCAL) !== JSON.stringify('回执单号')) throw new Error('局部解码器 s 解析不对')

let pass = 0
let fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`✗ ${label}${extra ? `\n    ${extra}` : ''}`)
  }
}

// ---------------------------------------------------------- ① `la()` 的调用点 //
/** `la(` 的所有调用点（排除定义本身 `,la=e=>{` 与被 `la=` 引用的地方）。 */
const LA_CALLS = [...SRC.matchAll(/(?<![a-zA-Z0-9_$.])la\(/g)].map((m) => m.index)
ok('`la(` 恰好两处调用（业务员 / 打单人）', LA_CALLS.length === 2, `实际 ${LA_CALLS.length} 处`)

// 每一处都必须落在 `qt[..]?` 起头的三元里（即 `!qt` 那一支）。
// 三元形如 `qt[s(755)]?(...):(...style:normalizeStyle(la(...))...)`。
for (const at of LA_CALLS) {
  const before = SRC.slice(Math.max(0, at - 400), at)
  ok(`@${at} 落在 qt 三元里`, /qt\[[a-z]\(\d+\)\]\?/.test(before), before.slice(-120))
  // `qt ? A : B` 编译成 `qt[..]?(A):(B)` —— `la(` 必须出现在 `):(` 之后，即假分支里
  ok(`@${at} 落在 qt 的假分支`, before.lastIndexOf('):(') > before.lastIndexOf('qt['))
}

// ------------------------------------------------------------- ② `qt` 怎么算 //
// 整段 `onBeforeMount` 里找：`l = t.userinfo.registrant`、`a = t.userinfo.name`、`qt = (l === a)`。
// 只看 `qt[..]=` 那一句不够 —— 右边是变量 `l===a`，得连着两个来源一起看。
// ⚠️ 这一段里的局部解码器叫 **`e`**（`const e=g`），与列定义那段的 `s` **不是同一个局部名** ——
//    两段各用各的，别合并成一个 extraLocals（`e` 在列定义那段是 slot 作用域变量，混用会误替换）。
const MOUNT_AT = SRC.indexOf('Vue.onBeforeMount')
// ⚠️ 结束锚点用 `rowHeight` 而不是「+900 字符」：再往后一点有 `e(462)`，而 **`dr` 表里没有 462 这个下标**
//    （表有空洞），`deobf` 遇洞即抛。我们要的三句都在 `rowHeight` 之前。
const MOUNT_END = SRC.indexOf('rowHeight', MOUNT_AT)
if (MOUNT_AT < 0 || MOUNT_END < 0) throw new Error('onBeforeMount 的锚点变了')
const MOUNT_SEG = deobf(SRC.slice(MOUNT_AT, MOUNT_END), ['e']).replace(/\s+/g, ' ')
ok(
  '`l` 取自 `userinfo.registrant`',
  /l=t\["userinfo"\]\["registrant"\]/.test(MOUNT_SEG),
  MOUNT_SEG.slice(0, 160),
)
ok('`a` 取自 `userinfo.name`', /a=t\["userinfo"\]\["name"\]/.test(MOUNT_SEG))
ok('`qt` = (`l` === `a`) ⇒「看的这份数据是不是自己租户的」', /qt\["value"\]=l===a/.test(MOUNT_SEG))
ok('`qt` 全文只被赋值这一处', [...SRC.matchAll(/qt\[[a-z]\(\d+\)\]=/g)].length === 1)

// --------------------------------------- ③ 订单备注 / 安装地址 是**无条件**输入框 //
/** 取某个列标签到下一个列标签之间的列定义源码。 */
const colSeg = (label, nextLabel) => {
  const a = SRC.indexOf(`label:${label}`)
  const b = SRC.indexOf(`label:${nextLabel}`, a)
  if (a < 0 || b < 0) throw new Error(`列的锚点变了：${label} → ${nextLabel}`)
  // ⚠️ 切片要从 `label:` **之前**起 —— `deobf` 只看切片内的 `const x=y` 闭包，
  //    把 `label:` 本身切掉不影响；但列的 `default` 渲染函数在 `label:` 之后，必须包含进来。
  return deobf(SRC.slice(a, b), S_LOCAL)
}
// 列序（实测）：未付 → `s(944)`订单备注 → `s(869)`安装地址 → 打单操作 → 业务员。
const REMARK_SEG = colSeg('s(944)', 's(869)')
const ADDRESS_SEG = colSeg('s(869)', '"打单操作"')

for (const [name, seg] of [
  ['订单备注', REMARK_SEG],
  ['安装地址', ADDRESS_SEG],
]) {
  ok(
    `${name} 列渲染 textarea 且 autosize {minRows:1, maxRows:3}`,
    /type:"textarea"/.test(seg) && /autosize:\{\s*minRows:1,\s*maxRows:3\s*\}/.test(seg.replace(/\s+/g, ' ')),
  )
  ok(`${name} 列没有 qt 门控（无条件渲染）`, !/qt\[[a-z]\(\d+\)\]\?/.test(seg))
}

// ------------------------------------------------ ④ 进编辑态靠 onFocus（`nn`） //
const NN_BODY = deobf(SRC.slice(SRC.indexOf(',nn=e=>'), SRC.indexOf(',nn=e=>') + 220), S_LOCAL)
ok(
  '`nn(row)` = 置 `za.value = row`（进编辑态）+ 快照三个字段',
  /za\["value"\]!==e&&\(za\["value"\]=e/.test(NN_BODY.replace(/\s+/g, '')),
  NN_BODY.replace(/\s+/g, ' ').slice(0, 160),
)
ok('订单备注 / 安装地址 的输入框都挂了 `onFocus` 进编辑态', /onFocus:/.test(REMARK_SEG) && /onFocus:/.test(ADDRESS_SEG))

console.log(`\n对照 ${pass + fail} 条：通过 ${pass}，不符 ${fail}`)
process.exit(fail ? 1 : 0)
