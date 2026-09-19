/*
 * Diao 页界面保真守卫台：**弹窗标题 / 删除确认 / 编辑器显隐**。
 *
 * ## 为什么值得单独守
 *
 * 这两样都是**改错了不报错、界面上也不显眼**的东西：
 *
 * 1. **弹窗标题 ≠ 触发它的按钮文案**。旧版有 **3** 处是这样
 *    （按钮叫「洞尺设置」而弹窗叫「洞尺减尺」…）。我们原先 3 处全照按钮文案起名，
 *    一直没人发现 —— 因为「标题和按钮一样」看起来才"正常"。
 *    最危险的是**下一个人会觉得标题"不一致"、顺手把它改回按钮文案**。
 * 2. **删除确认**。我们原先用原生 `window.confirm`（浏览器自带弹窗，样式和整站完全脱节），
 *    旧版是带标题「删除确认」的 `ElMessageBox`，按钮是 **确定/取消**（naive 默认「确认/取消」，
 *    差一个字，不显式给就错）。
 *
 * ## 这台怎么保证自己不过期
 *
 * 期望值**不写死** —— 每个标题都去 `legacy/js/Diao.deobfuscated.js` 里**验一遍它还在**，
 * 旧版变了这台会先在「旧版自校验」那节报出来，而不是拿一份陈年常量继续比。
 *
 * ⚠️ 这台**只比字符串与源码形状**，不挂载组件、不点按钮。
 *    「点开那个弹窗标题真的显示成这个吗」不在覆盖内（那是 `n-card` 的 `title` prop 直传，
 *    风险极低，但别把这台当成端到端验收）。
 *
 * 用法：node docs/diao-ui-check.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const LEGACY = resolve(ROOT, 'legacy/js/Diao.deobfuscated.js')
const VUE = resolve(ROOT, 'app/src/views/Formulas.vue')

const legacy = readFileSync(LEGACY, 'utf8')
const vue = readFileSync(VUE, 'utf8')

let pass = 0
const failures = []
function check(ok, name) {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(name)
    console.log(`  ✗ ${name}`)
  }
}

/*
 * 7 个「快捷设置」弹窗的标题。
 * 注意这**不是**按钮文案 —— 按钮是 洞尺设置 / 包边洞尺 / 平开门丁墙 / 平开门合页 /
 * 边封增量 / 固定配件 / 亮窗示意图，其中 3 个与标题不同。
 */
const DIALOG_TITLES = [
  ['洞尺减尺', '按钮叫「洞尺设置」'],
  ['包边洞尺', '按钮同名'],
  ['平开门单双丁', '按钮叫「平开门丁墙」'],
  ['平开门合页', '按钮同名'],
  ['增量设置', '按钮叫「边封增量」'],
  ['配件设置', '按钮叫「固定配件」'],
  ['亮窗示意图', '按钮同名'],
]

console.log('① 旧版自校验：这 7 个标题现在还在 Diao.deobfuscated.js 里吗')
for (const [t] of DIALOG_TITLES) {
  // 旧版是 `title:"洞尺减尺"` 这种写法。用带引号的原文找，避免撞上正文里的同名词。
  check(legacy.includes(`title:"${t}"`), `旧版里还有 title:"${t}"`)
}

console.log('\n② 新版的 7 个弹窗标题与旧版**逐个一致**')
const cards = [...vue.matchAll(/<n-card[^>]*\stitle="([^"]*)"/g)].map((m) => m[1])
for (const [t, why] of DIALOG_TITLES) {
  check(cards.includes(t), `Formulas.vue 里有弹窗标题「${t}」（${why}）`)
}
// 反向：别把按钮文案当成标题写进 n-card —— 这 3 个是「按钮名」而不是「弹窗名」，不该出现。
const BUTTON_ONLY = ['洞尺设置', '平开门丁墙', '边封增量']
for (const t of BUTTON_ONLY) {
  check(!cards.includes(t), `没把按钮文案「${t}」误当成弹窗标题`)
}

console.log('\n③ 删除确认：不该再有原生弹窗；按钮文案是 确定/取消')
// 只看**代码**：注释里提「原先用的是 window.confirm」是在解释历史，不算。
const code = vue
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '')
check(!/window\.confirm/.test(code), 'Formulas.vue 里没有 window.confirm 调用')
check(/title:\s*'删除确认'/.test(code), '公式删除用的是带标题「删除确认」的 dialog')
check(
  /content:\s*'确定要删除该公式吗？此操作不可恢复。'/.test(code),
  '删除确认文案与旧版逐字一致（旧版 `:2250`）',
)
check(/<n-popconfirm[\s\S]{0,200}?positive-text="确定"/.test(vue), '行删除的 popconfirm 确认按钮是「确定」')
check(/<n-popconfirm[\s\S]{0,200}?negative-text="取消"/.test(vue), '行删除的 popconfirm 取消按钮是「取消」')
// 旧版那两处的按钮文案都要能在旧版里找到，别是凭印象写的。
// ⚠️ 行删除那处的键是**带引号**的（`"confirm-button-text":"确定"`），
//    与公式删除那处的 `confirmButtonText:"确定"` 写法不同 —— 别「顺手统一」成一个正则。
check(
  /"confirm-button-text":"确定","cancel-button-text":"取消"/.test(legacy),
  '旧版行删除的按钮文案确实是 确定/取消（`:3478`）',
)
check(/confirmButtonText:"确定",cancelButtonText:"取消"/.test(legacy), '旧版公式删除的按钮文案确实是 确定/取消')

/*
 * ④ 编辑器显隐（旧版 `_0x579c3d`，一个**单向闩**）
 *
 * 旧版把「尺寸区 + 配置区 + 搜索区」和「新增材料 / 确认」两颗按钮一起挂在
 * `v-show="_0x579c3d"` 上（渲染区**三处**：`D:3428` + 那两颗按钮），
 * 而这个 ref 声明为 `ref(!1)`、19 处赋值**全是 `!0`、从不回 false** ——
 * 也就是"进页面先藏起来，一旦显示就永远显示"。
 *
 * 打开它的：10 个模板加载器 + 公式模板按钮 + 3D创建公式 + 复制。
 *
 * 打开它的动作还有**查询/加载公式**（`_0x23658f` 里 `queryFormula` 返回 200 之后那句
 * `_0x579c3d["value"]=!0`）—— 我们在 `loadFormula` 里对应的那行是**照抄，不是偏离**。
 *
 * ⚠️ 写这一节时我一度以为"查询那条路径不设它"，还据此写了条"有意偏离" —— **是错的**，
 * 是我把另一处的行号归到了这个函数上。下面那条断言就是用来**钉死这个事实**的：
 * 旧版那条路径**确实设了**。哪天有人（包括我）又想当然地改口，这条会红。
 */
console.log('\n④ 编辑器显隐（旧版 `_0x579c3d` 单向闩）')
{
  check(/const editorVisible = ref\(false\)/.test(vue), 'editorVisible 初值为 false（旧版 `D:947` 也是 ref(!1)）')
  // 四块都要挂上 —— 旧版是三处 v-show（尺寸/配置/搜索算一处），我们是四块分开挂。
  const shown = [...vue.matchAll(/class="(dims|config-row|search-row|formula-actions)" v-show="editorVisible"/g)].map((m) => m[1])
  for (const c of ['dims', 'config-row', 'search-row', 'formula-actions']) {
    check(shown.includes(c), `.${c} 挂了 v-show="editorVisible"`)
  }
  check(/function openTemplateDrawer\(\)\s*\{\s*editorVisible\.value = true/.test(vue), '「公式模板」按钮会打开它（旧版 `D:1178`）')
  check(/function applyTemplate\(key: string\) \{\s*editorVisible\.value = true/.test(vue), '模板加载会打开它（旧版 10 个加载器）')
  // 加载公式也打开 —— **与旧版一致**（不是偏离）
  check(
    /async function loadFormula[\s\S]{0,900}?editorVisible\.value = true/.test(vue),
    '`loadFormula` 会打开它（旧版 `_0x23658f` 在 `queryFormula` 返回 200 后同样设 `_0x579c3d`）',
  )
  // ★ 钉死"旧版那条路径设了它"这个事实 —— 我先前读反过一次，别再被想当然带跑。
  const loadStart = legacy.indexOf('_0x23658f=async(e=!0)=>{')
  const loadEnd = legacy.indexOf(',_0x436e63=async()=>{', loadStart)
  check(loadStart > 0 && loadEnd > loadStart, '能在旧版里框出查询/加载函数 `_0x23658f` 的范围')
  check(
    /_0x579c3d\["value"\]=!0/.test(legacy.slice(loadStart, loadEnd)),
    '★ 旧版那条路径**确实设了** `_0x579c3d`（所以我们是照抄；我一度读成"没设"并据此写过一条假偏离）',
  )
}

console.log(`\n# 通过 ${pass} 项，失败 ${failures.length} 项`)
if (failures.length) {
  console.log('✗ 有断言不成立：')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('✓ 全部一致')
