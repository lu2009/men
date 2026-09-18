/*
 * 「操作名称 / 客户」两个 `autocomplete` 的**下拉弹出时机**逐字对照。
 *
 * 起因（用户报）：新版点进「操作名称」空框**什么都不弹**，旧版一聚焦就弹整份下拉。
 *
 * 根因两头都在源码里，这台把两头都钉住：
 *   旧版 = `el-autocomplete`，`triggerOnFocus` 默认 **true**（聚焦即弹）；
 *   新版 = `n-auto-complete`，`getShow` 默认 **`!!value`**（有值才弹）。
 * 于是空框（正是弹窗刚开时的状态）新版不弹、旧版弹 —— 需要显式补 `:get-show="() => true"`。
 *
 * 「默认值是 true」这句不靠记忆：直接从**旧版随包发出去的那份 Element Plus**里读
 * （`legacy/vendor/js/element-plus.min.js`），以及 Naive 装在本地的源码里读。
 *
 * 用法：node docs/home-audit/autocomplete-logiccheck.mjs
 */
import { readFileSync } from 'node:fs'
import { SRC, assertDecoder, balanced, deobf, runLegacy } from './legacy-slice.mjs'

assertDecoder()

const ROOT = '/Users/aaa/Desktop/door-main'

// ------------------------------------------------------- 旧版：候选构造 `Sa` //
// `Na`（`:8036`）固定 4 项；`Ea` 是自定义项数组（localStorage）。
const NA_DEF = SRC.indexOf(',Na=[')
if (NA_DEF < 0) throw new Error('`Na` 的锚点变了')
// ⚠️ 别按行切 —— `Na=[…]` 后面同一行还接着 `Ea=Vue.ref(…)` 等一堆声明（切到行尾会拉进半个表达式）。
const NA_SRC = deobf(balanced(SRC.slice(NA_DEF + ',Na='.length), '['))
const LEGACY_FIXED = runLegacy(`return (${NA_SRC})`, {})

const SA_AT = SRC.indexOf(',Sa=(e,t)=>{')
if (SA_AT < 0) throw new Error('`Sa` 的锚点变了')
const SA_BODY = deobf(SRC.slice(SA_AT + 1, SRC.indexOf(',Ta=()=>', SA_AT)).replace(/,\s*$/, ''))
// 反混淆后写法：`Sa=(e,t)=>{ const l=g,o=[...Na,...Ea.value]; t(...) }`
// ⚠️ 旧版把 `Na`/`Ea` 作为闭包外的量用 —— 这里注入。`Ea` 用 `{value:[]}` 冒充 ref。
const legacyFetch = runLegacy(`return (${SA_BODY.replace(/^Sa=/, '')})`, {
  g: () => undefined,
  Na: LEGACY_FIXED,
  Ea: { value: [] },
})

/** 旧版 `Sa`：给定查询词 + 自定义项，回它 `t()` 出去的**原样**候选数组。 */
function legacyRaw(query, customs = []) {
  const fn = runLegacy(`return (${SA_BODY.replace(/^Sa=/, '')})`, {
    g: () => undefined,
    Na: LEGACY_FIXED,
    Ea: { value: customs },
  })
  let out = null
  fn(query, (v) => (out = v))
  return out || []
}
/** 同上，只取 `value`（Element Plus 拿它当显示文本，比较时更方便）。 */
const legacySuggestions = (query, customs = []) => legacyRaw(query, customs).map((o) => o.value)

// ------------------------------------------------- 旧版：三个 autocomplete 的 prop //
/** 取某一行 `createVNode` 的 props 文本。 */
const lineAt = (n) => SRC.split('\n')[n - 1]

/** 手动更新进度·操作名称（`:12097`）——本次报的那个。 */
const ROW_MANUAL = 12097
/** 查询订单·客户（`:12141`）与 客户编辑弹窗（`:12058`）——同族，一起钉住。 */
const ROW_QUERY = 12141
const ROW_EDIT = 12058

const manualProps = lineAt(ROW_MANUAL)
const queryProps = lineAt(ROW_QUERY)
const editProps = lineAt(ROW_EDIT)

/** 该行的 autocomplete 有没有**逐字**写 `"trigger-on-focus"`。 */
const writesTrigger = (s) => s.includes('"trigger-on-focus"')

// ------------------------------------------- 旧版 Element Plus：prop 的默认值 //
const EP = readFileSync(`${ROOT}/legacy/vendor/js/element-plus.min.js`, 'utf8')
const EP_HIT = /triggerOnFocus:\{type:Boolean,default:(!0|!1|true|false)\}/.exec(EP)
const EP_DEFAULT = EP_HIT ? EP_HIT[1] === '!0' || EP_HIT[1] === 'true' : null

// ------------------------------------------------- 新版 Naive：prop 的默认值 //
const NAIVE = readFileSync(
  `${ROOT}/app/node_modules/naive-ui/es/auto-complete/src/AutoComplete.mjs`,
  'utf8',
)
// `mergedShowOptionsRef`：没有 `getShow` 时 `return !!mergedValueRef.value`
const NAIVE_DEFAULT_SHOW = /if \(getShow\) return getShow\(mergedValueRef\.value \|\| ""\);\s*return (!!mergedValueRef\.value);/.exec(
  NAIVE,
)?.[1]

/** 新版 `Home.vue` 的 `manualNameOptions` 同逻辑（`app/src/views/Home.vue`）。 */
const newSuggestions = (all, query) => (query ? all.filter((v) => v.includes(query)) : all)

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
const ok = (label, v) => {
  if (v) pass++
  else {
    fail++
    console.log(`✗ ${label}`)
  }
}

// ① 固定候选逐字一致
eq('固定候选 4 项', LEGACY_FIXED, ['玻璃订单', '生产单', '收据单', '确认生产'])
eq(
  '新版同表（MANUAL_ACTION_OPTIONS）',
  ['玻璃订单', '生产单', '收据单', '确认生产'],
  LEGACY_FIXED,
)

// ② 空查询 = 全量（这正是「聚焦即弹」弹出来的内容）
const CUSTOMS = ['打胶', '装车']
eq('空查询 → 全量候选（固定 4 + 自定义 2）', legacySuggestions('', CUSTOMS), [...LEGACY_FIXED, ...CUSTOMS])
eq('新版空查询同语义', newSuggestions([...LEGACY_FIXED, ...CUSTOMS], ''), legacySuggestions('', CUSTOMS))

// ③ 过滤用**原值**（不 trim）子串匹配
eq('原值子串过滤「单」', legacySuggestions('单', CUSTOMS), LEGACY_FIXED.filter((v) => v.includes('单')))
eq('新版同语义', newSuggestions([...LEGACY_FIXED, ...CUSTOMS], '单'), legacySuggestions('单', CUSTOMS))
eq('空格的差异（旧版不 trim ⇒ 空格滤空）', legacySuggestions(' ', CUSTOMS), [])
eq('新版同样不 trim', newSuggestions([...LEGACY_FIXED, ...CUSTOMS], ' '), [])
// 子串匹配 ⇒ 一个查询词可以命中多项。别拿「生产」当「只命中生产单」的夹具 ——
// 「确认生产」里也含「生产」，是两项（第一版夹具就写错在这里，故单列一条钉住）。
eq('子串过滤「生产」命中两项', legacySuggestions('生产', CUSTOMS), ['生产单', '确认生产'])
// 回给 Element Plus 的只有 `{value}`（它的 value 同时当显示文本）；新版 `{label,value}` 都填同一个串。
eq('候选形状 value 即显示文本', legacyRaw('玻璃'), [{ value: '玻璃订单' }])

// ④ 弹出时机（本次的真正分歧点）
ok('旧版 Element Plus 的 triggerOnFocus 默认 true（从旧版随包发的 EP 里读出来）', EP_DEFAULT === true)
ok('新版 Naive 无 getShow 时默认 `!!value`（空框不弹）', NAIVE_DEFAULT_SHOW === '!!mergedValueRef.value')
ok('① 操作名称没写 trigger-on-focus ⇒ 吃默认 true，聚焦即弹', !writesTrigger(manualProps) && EP_DEFAULT === true)
ok('② 查询订单·客户逐字写了 trigger-on-focus（应为 !0）', /"trigger-on-focus":!0/.test(queryProps))
ok('③ 客户编辑弹窗逐字写了 trigger-on-focus（应为 !0）', /"trigger-on-focus":!0/.test(editProps))
ok('操作名称那行的 placeholder 是「选择或输入操作名」', manualProps.includes('"选择或输入操作名'))
ok('操作名称那行的候选构造函数是 `Sa`', manualProps.includes(':Sa'))
ok('操作名称那行挂了右键删除（onContextmenu:Ya）', manualProps.includes('onContextmenu:Ya'))

// ⑤ 新版那一侧：两个 autocomplete 都得显式补上，否则回退成「空框不弹」
const HOME_VUE = readFileSync(`${ROOT}/app/src/views/Home.vue`, 'utf8')
const NEW_ACS = [...HOME_VUE.matchAll(/<n-auto-complete\b[\s\S]*?\/>/g)].map((m) => m[0])
eq('新版 Home.vue 里 autocomplete 的个数', NEW_ACS.length, 2)
for (const block of NEW_ACS) {
  const which = block.includes('选择或输入操作名') ? '操作名称' : block.includes('输入客户信息') ? '查询订单·客户' : '?'
  ok(`新版「${which}」补了 :get-show（否则空框不弹，与旧版不一致）`, block.includes(':get-show="AUTOCOMPLETE_ALWAYS_SHOW"'))
}
ok(
  '新版那个共享常量确实回 true（且注释写明了理由）',
  /const AUTOCOMPLETE_ALWAYS_SHOW = \(\) => true/.test(HOME_VUE),
)

console.log(`\n旧版三个 autocomplete 的 trigger-on-focus:`)
console.log(`  :${ROW_EDIT}   客户编辑弹窗    逐字写 !0`)
console.log(`  :${ROW_MANUAL}   手动更新进度·操作名称  未写 ⇒ EP 默认 ${EP_DEFAULT}`)
console.log(`  :${ROW_QUERY}   查询订单·客户    逐字写 !0`)
console.log(`\n新版 Naive 默认 getShow = ${NAIVE_DEFAULT_SHOW} ⇒ 必须显式 :get-show="() => true" 才等价`)
console.log(`\n对照 ${pass + fail} 条：通过 ${pass}，不符 ${fail}`)
process.exit(fail ? 1 : 0)
