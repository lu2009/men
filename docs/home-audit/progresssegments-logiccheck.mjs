/*
 * 「生产状态 + 手动进度项 → 进度段序列」的**差分台**。
 *
 *   左 = 旧版真代码 `ua`（`legacy/js/Home.formatted.js` 的 `,ua=e=>{…}`，
 *        位置紧挨着 `sa`（`:7973`）前面 434 字节）—— 从混淆 bundle **切出来真跑**
 *        （`balanced` + `deobf` + `runLegacy`），不是照着写一遍。
 *   右 = `app/src/utils/homeConstants.ts` 的 `progressSegments` —— **真 import，不是抄一份**。
 *
 * ## 为什么要有这台（2026-09-20 补）
 *
 * `progressSegments` 是 Home 里**唯一**吃 `manualActions` 这个注入参数的纯函数，
 * 而它此前的覆盖**只来自搬迁守卫** —— 守卫比的是「新旧文本是否一致」，
 * **规则本身写错时两侧同错、照样绿**（守卫第一类盲区）。也就是说：
 * 「`fin`/`manualActions` 的参数化是语义中性的」这句话，守卫**证明不了**。
 *
 * `rowtip-logiccheck.mjs` 虽然也在这一带切片，但它把 `ua` 当**手写桩**注入
 * （`ua: (row) => row.segments`），验的是 `sa` 的 HTML 拼装，**没有验过 `ua` 自己**。
 * 这台补的就是那个缺口。
 *
 * ## 顺带钉住段表本身
 *
 * `na`（那 5 个固定段）也**从 bundle 里切出来**，与我们的 `PROGRESS_STEPS` 逐字段比。
 * 两边驱动各自那一份，所以只要两张表一致 + 输出一致，整条链路就都验到了。
 *
 * ## 旧版读的字段名不是 `production_status`
 *
 * 切出来才看清：旧版 `ua` 读的是 **`e["打单操作"]`**（列名，中文），不是我们的
 * `production_status`。两者是同一个字段 —— `backend/migrations/0018_home_order_head_fields.sql:6`
 * 明写 `打单操作 -> production_status`。所以夹具喂的是 `{ '打单操作': status }`，
 * 并且**把这个事实本身也钉了一条断言**（万一哪天解码表变了，这条会先响）。
 *
 * ## 两条**已知的、先于本次拆分**的偏离（不是这台台子在洗白它们）
 *
 * 1. **键名 `flexVal` → `flex`**：旧版 `na` 每项是 `{label,color,flexVal}`、`ua` 取 `e["flexVal"]`；
 *    我们叫 `flex`。`flexVal` 在全仓（`app/src` + `docs/`）**0 命中** ⇒ 这个改名**没有别处文档**，
 *    但它是**原移植时**就改的。本台比之前把键名归一（`norm()`），并把这个事实写在这里。
 * 2. **`String(x || "")` 兜底被去掉**：旧版是 `String((null==x?void 0:x.production_status)||"")`，
 *    对 `null`/`undefined` 兜成 `""`；我们签名收 `status: string` 直接 `.length` ⇒ 传 `null` 会炸。
 *    **这不是本次拆分造成的** —— 拆分参照点 `9a544a53` 的 `Home.vue:2591-2609` **本来就没有**这层兜底
 *    （它是 `155cf6e8` 那轮前端还原时就落下的）。因为本分支的口径是「纯搬迁、零行为变化」，
 *    **不在这里顺手改**（改它就是从「能炸」变「不炸」，是行为变化）。⇒ 夹具只喂**字符串**。
 *
 * ⚠️ 第 2 条的真实性我**没有**去验「后端到底会不会给出 null 的 `production_status`」——
 *    `api/types.ts:183` 声明成必填 `string`。这条只记「我们比旧版少一层兜底」这个**事实**。
 *
 * 用法：node docs/home-audit/progresssegments-logiccheck.mjs
 */
import { SRC, assertDecoder, balanced, deobf, runLegacy } from './legacy-slice.mjs'

assertDecoder()

const { PROGRESS_STEPS, progressSegments } = await import(
  new URL('../../app/src/utils/homeConstants.ts', import.meta.url).href
)

// ---------------------------------------------------------------- 旧版切片 //
// `na`：5 个固定段。锚点带 `[{` 是为了不与别处同名的 `na` 撞上。
const NA_AT = SRC.indexOf(',na=[{')
if (NA_AT < 0) throw new Error('`na` 的锚点变了')
const LEGACY_STEPS = runLegacy(`return ${deobf(balanced(SRC.slice(NA_AT + ',na='.length), '['))}`, {})

// `ua`：进度段构造。`balanced(…, '{')` 取的是**函数体**（`e=>` 已在锚点里吃掉），再补回箭头头。
const UA_AT = SRC.indexOf(',ua=e=>{')
if (UA_AT < 0) throw new Error('`ua` 的锚点变了')
const UA_BODY = SRC.slice(UA_AT + ',ua='.length)
const UA_SRC = deobf(`e=>${balanced(UA_BODY, '{')}`)

// `const t=g` 反混淆后仍在（`t(NNNN)` 已全变成字面量）⇒ `g` 得给个绑定；
// `Ea` 是模块级「手动进度项」数组（ref），由夹具驱动；`na` 用上面切出来的那一份。
const Ea = { value: [] }
const legacyUa = runLegacy(`return ${UA_SRC}`, { g: () => undefined, Ea, na: LEGACY_STEPS })

// ---------------------------------------------------------------- 归一化 //
/** 旧版键名 `flexVal` → `flex`（理由见文件头第 1 条）。 */
const norm = (segs) => segs.map((s) => ({ label: s.label, color: s.color, flex: s.flex ?? s.flexVal, done: s.done }))

// ------------------------------------------------------------------ 夹具 //
// ⚠️ 旧版吃的是**行对象**，字段名是中文列名 `打单操作`（见文件头）；我们吃**状态串**。
// `[状态串, 手动进度项[]]`。**只喂字符串**（理由见文件头第 2 条）。
const CASES = [
  ['空状态 + 无自定义', '', []],
  ['只确认下单', '确认下单', []],
  ['只生产单', '生产单', []],
  ['确认下单_生产单', '确认下单_生产单', []],
  ['全固定段', '玻璃订单_标签_收据单', []],
  ['只有自定义且命中', '我的自定义', ['我的自定义']],
  ['只有自定义但未命中', '', ['我的自定义']],
  ['两个自定义都命中', '甲_乙', ['甲', '乙']],
  ['固定段 + 自定义混合', '确认下单_甲', ['甲']],
  ['自定义名与固定段同名', '生产单', ['生产单']],
  ['自定义 3 个（flex=1）', '确认下单', ['a', 'b', 'c']],
  ['自定义 7 个（flex=3/7，非整数）', 'x', ['a', 'b', 'c', 'd', 'e', 'f', 'g']],
]

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

// 先钉段表本身：两张表不一致的话，下面逐例对照就失去意义。
eq('固定段表 `na` ≡ `PROGRESS_STEPS`', norm(LEGACY_STEPS), norm(PROGRESS_STEPS))
eq('固定段表长度 = 5', LEGACY_STEPS.length, PROGRESS_STEPS.length)

for (const [name, status, actions] of CASES) {
  Ea.value = actions
  const L = norm(legacyUa({ 打单操作: status }))
  const N = norm(progressSegments(status, { value: actions })) // 只读 `.value` ⇒ 不必造真 ref
  eq(`${name}（${JSON.stringify(status)} / ${JSON.stringify(actions)}）`, L, N)
}

// 钉住「旧版读的是中文列名」这个事实本身（解码表/锚点一变，这条先响）。
truthy('旧版 `ua` 读的字段是 `打单操作`（= 我们的 `production_status`）', UA_SRC.includes('e["打单操作"]'))

// 「自定义段 flex = 3/个数」这条单独钉。**注意 0 个时没有自定义段** ⇒ 段数仍是 5。
for (const n of [0, 1, 3, 7]) {
  Ea.value = Array.from({ length: n }, (_, i) => `c${i}`)
  const L = norm(legacyUa({ 打单操作: '' }))
  const N = norm(progressSegments('', { value: Ea.value }))
  eq(`自定义 ${n} 个：段数 = 5 + ${n}`, L.length, 5 + n)
  eq(`自定义 ${n} 个：逐段`, L, N)
  if (n > 0) eq(`自定义 ${n} 个：flex = 3/${n}`, N[5].flex, 3 / n)
}

console.log(`\n对照 ${pass + fail} 条：通过 ${pass}，不符 ${fail}`)
process.exit(fail ? 1 : 0)
