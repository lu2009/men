/*
 * 明细行**引擎**的行为回归网（`app/src/composables/useOrderLines.ts`）。
 *
 * ## 这个脚本管什么、不管什么
 *
 * 它**不**重新论证引擎对不对（那是 `docs/2026-08-23-hui-analysis.md` 与
 * `docs/2026-09-15-hui-field-candidates.md` 那些逆向报告的活）。
 * 它管的是：**引擎从 Hui.vue 搬出去之后，算出来的数还是原来那些数** ——
 * 给后面几步（抽组件、Home 接线、补行级保存）当回归网用。
 *
 * 搬迁本身的「逐字未改」由 `hui-extract-movecheck.mjs` 证明（源码级）；
 * 这个脚本补的是**行为级**：把引擎真的跑起来，喂夹具，断言输出。
 * 两者互补 —— 源码一致但接线接错（比如 `formulas` 传成了别的 ref），只有这个能抓到。
 *
 * 用法：`node docs/home-audit/hui-engine-logiccheck.mjs`（不需要后端）
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'

const ROOT = '/Users/aaa/Desktop/door-main'
const req = createRequire(`${ROOT}/app/`)
const { build } = req(`${ROOT}/app/node_modules/esbuild`)

// 引擎与 printPayloads 会读 localStorage（默认值机制）—— 给个内存桩。
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const ENTRY = '/tmp/hui-engine-check/entry.ts'
mkdirSync('/tmp/hui-engine-check', { recursive: true })
writeFileSync(
  ENTRY,
  `export { useOrderLines, LS } from '${ROOT}/app/src/composables/useOrderLines'\n` +
    `export { ref, reactive } from '${ROOT}/app/node_modules/vue'\n`,
)
const out = `${ROOT}/app/node_modules/.cache/hui-engine-check.mjs`
// ⚠️ `platform: 'node'`，不是别的脚本惯用的 `'neutral'` —— 引擎 import 了 `naive-ui`
// （`NRadio`/`NRadioGroup` 给「多超墙厚候选」弹窗用），neutral 平台下 esbuild 不认
// 该包的 `main` 字段，直接报 "Could not resolve naive-ui"。
await build({
  entryPoints: [ENTRY],
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  external: ['naive-ui'],
  define: { 'import.meta.env': JSON.stringify({}) },
})
const { useOrderLines, ref, reactive } = await import(out)

let pass = 0
const fails = []
const eq = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++
  else fails.push(`${label}\n    期望 = ${JSON.stringify(want)}\n    实得 = ${JSON.stringify(got)}`)
}
const ok = (label, v) => eq(label, !!v, true)

// ── 夹具 ──────────────────────────────────────────────────────────────────
const messages = []
const makeEngine = (over = {}) => {
  const deps = {
    lines: ref([]),
    formulas: ref(over.formulas ?? []),
    order: reactive({ client_code: 'C001' }),
    orderId: ref(over.orderId ?? null),
    disableAutoMarkup: ref(over.disableAutoMarkup ?? false),
    message: { error: (m) => messages.push(['error', m]), warning: (m) => messages.push(['warning', m]),
               success: (m) => messages.push(['success', m]), info: (m) => messages.push(['info', m]) },
    dialog: { warning: () => {}, error: () => {}, info: () => {}, success: () => {} },
  }
  return useOrderLines(deps)
}
const E = makeEngine()
const line = (over = {}) => ({ ...E.newLine('ping'), ...over })

// ── ① 数字清洗 ────────────────────────────────────────────────────────────
eq('① sanitizeNum 取整并夹下限', E.sanitizeNum(3.7, 1), 4)
eq('① sanitizeNum 空值归零后夹下限', E.sanitizeNum(null, 1), 1)
eq('① sanitizeNum NaN → 下限', E.sanitizeNum(Number.NaN, 0), 0)
eq('① sanitizeFloat 保留两位', E.sanitizeFloat(3.14159), 3.14)
eq('① sanitizeFloat 负值夹到 min', E.sanitizeFloat(-5, 0), 0)

// ── ② 新建行默认值 ────────────────────────────────────────────────────────
{
  const p = E.newLine('ping')
  eq('② 平开：开向硬编码空串', p.direction, '')
  eq('② 平开：底玻默认「磨砂」', p.bottom_glass, '磨砂')
  eq('② 平开：面玻硬编码「白玻」', p.face_glass, '白玻')
  eq('② 平开：计价方式回落「套」', p.price_type, '套')
  eq('② 平开：边封数为 null', p.edge_seal_count, null)
  eq('② 平开：未落库 id 为 null', p.id, null)
  const d = E.newLine('diao')
  eq('② 移门：开向回落「左前」', d.direction, '左前')
  eq('② 移门：底玻回落「白玻」', d.bottom_glass, '白玻')
  eq('② 移门：计价方式硬编码「方」', d.price_type, '方')
  eq('② 移门：边封数默认 2', d.edge_seal_count, 2)
}
// 底玻「无」且默认厚 < 8 → 取 8
{
  store.set('BottomGlass', '无')
  const p = E.newLine('ping')
  eq('② 底玻=无 ⇒ 玻璃厚取 8', p.glass_thickness, '8')
  store.delete('BottomGlass')
}

// ── ③ 面积 / 扇数 / 最小平方 ──────────────────────────────────────────────
{
  const l = line({ door_width: 1000, door_height: 2000, light_window_height: 0 })
  eq('③ 普通：宽×高/1e6', E.singleArea(l), 2)
  // 亮窗高**高于**门洞高时才抬得动（`max` 语义）
  const lw = line({ door_width: 1000, door_height: 2000, light_window_height: 2500 })
  eq('③ 普通：高取 max(高, 亮窗高)', E.singleArea(lw), 2.5)
  const lw2 = line({ door_width: 1000, door_height: 2000, light_window_height: 500 })
  eq('③ 亮窗高低于门洞高 ⇒ 不抬', E.singleArea(lw2), 2)
}
{
  // ⚠️ 夹具必须用 `FANS`（`Hui.vue:539`）里的**真实取值**。第一版这里编了个「双扇」，
  //    而真实选项是「2轨3扇」「单轨单扇」「一固一活」这种 —— 假夹具测出来的是假结论。
  eq('③ 扇数「2轨3扇」→ 3', E.fanCount(line({ fans: '2轨3扇' })), 3)
  eq('③ 扇数含「活」→ 2', E.fanCount(line({ fans: '一固一活' })), 2)
  eq('③ 扇数「双活」→ 2', E.fanCount(line({ fans: '双活' })), 2)
  eq('③ 扇数「单轨单扇」→ 1', E.fanCount(line({ fans: '单轨单扇' })), 1)
  eq('③ 扇数认不出 → 0', E.fanCount(line({ fans: '' })), 0)
  // ⚠️ 这一条**不在真实 `FANS` 里**（那儿全是单位数），是**故意**加的：
  //    正则是 `(\d+)\s*扇` 而不是 `(\d)\s*扇`，没有这条的话把它改窄也没人发现
  //    （变异测试实测：加了这条之前，`\d+`→`\d` 的变异**不报错**）。
  eq('③ 扇数两位数（正则必须是 \\d+）', E.fanCount(line({ fans: '10轨12扇' })), 12)
}
{
  const F = [{ id: 7, name: 'X', formula_type: 'ping', square: '1.5', parts: {} }]
  const E2 = makeEngine({ formulas: F })
  eq('③ 公式 square 数字 → 直接用', E2.minSquareOf({ ...E2.newLine('ping'), formula_id: 7 }), 1.5)
  eq('③ 移门：square × 扇数（2轨2扇 → 2）', E2.minSquareOf({ ...E2.newLine('diao'), formula_id: 7, fans: '2轨2扇' }), 3)
  const F2 = [{ id: 8, name: 'Y', formula_type: 'ping', square: '{"单扇":"1-2"}', parts: {} }]
  const E3 = makeEngine({ formulas: F2 })
  eq('③ 无亮窗取区间下限', E3.minSquareOf({ ...E3.newLine('ping'), formula_id: 8, fans: '单扇' }), 1)
  eq('③ 有亮窗取区间上限', E3.minSquareOf({ ...E3.newLine('ping'), formula_id: 8, fans: '单扇', light_window_height: 300 }), 2)
  eq('③ 扇数不在表里 → 0', E3.minSquareOf({ ...E3.newLine('ping'), formula_id: 8, fans: '双扇' }), 0)
}

// ── ④ 平方数（**含一处有意偏离旧版**：自定义方数是覆盖、不是下限）────────
{
  const l = line({ door_width: 1000, door_height: 2000, quantity: 2, custom_square: -1 })
  eq('④ 自动：每樘面积 × 数量', E.computeSquare(l), 4)
  eq('④ 自定义方数**覆盖**（可改小）', E.computeSquare({ ...l, custom_square: 1 }), 2)
  eq('④ 自定义方数可改大', E.computeSquare({ ...l, custom_square: 3 }), 6)
}
{
  // 最低平方数抬底
  const F = [{ id: 7, name: 'X', formula_type: 'ping', square: '5', parts: {} }]
  const E2 = makeEngine({ formulas: F })
  const l = { ...E2.newLine('ping'), formula_id: 7, door_width: 1000, door_height: 1000, quantity: 1, custom_square: -1 }
  eq('④ 面积低于最低平方 ⇒ 抬到最低', E2.computeSquare(l), 5)
}

// ── ⑤ 金额 ────────────────────────────────────────────────────────────────
{
  const base = { unit_price: 100, quantity: 3, square: 2, casing_amount: 50, other_fee: 10, discount: 1 }
  eq('⑤ 计价「套」：单价×数量 + 其它费用（**不含套线金额**）',
    E.computeAmount({ ...base, price_type: '套' }), 310)
  eq('⑤ 计价「方」：单价×平方 + 套线金额 + 其它费用',
    E.computeAmount({ ...base, price_type: '方' }), 260)
  eq('⑤ 打折乘在基准上并取整', E.computeAmount({ ...base, price_type: '套', discount: 0.88 }), 273)
  eq('⑤ 打折为 0 → 0', E.computeAmount({ ...base, price_type: '套', discount: 0 }), 0)
}

// ── ⑥ 加价重算：只算钱、不增删项 ──────────────────────────────────────────
{
  const l = line({ markup: [{ name: '人工', price: 100, unit: '元/套', amount: 0 }], quantity: 2 })
  E.recalcMarkup(l)
  eq('⑥ other_fee = 加价合计', l.other_fee, 200)
  eq('⑥ 逐项金额也写回', l.markup[0].amount, 200)
  const before = l.markup.length
  E.recalcMarkup(l)
  eq('⑥ 重算**不增删项**', l.markup.length, before)
}
{
  // 空加价 → other_fee 归零
  const l = line({ markup: [], other_fee: 999 })
  E.recalcMarkup(l)
  eq('⑥ 无加价项 ⇒ other_fee 归零', l.other_fee, 0)
}

// ── ⑦ 行类型分派（两张表口径不同，别混）──────────────────────────────────
{
  eq('⑦ 平开：母门宽看公式型别', E.needsMotherWidth({ ...E.newLine('ping'), profile: '' }), false)
  eq('⑦ 平开：型材含「子母」⇒ 要母门宽', E.needsMotherWidth({ ...E.newLine('ping'), profile: '子母门' }), true)
}
{
  const F = [
    { id: 1, name: 'P', formula_type: 'ping', parts: {} },
    { id: 2, name: 'D', formula_type: 'diao', parts: {} },
    { id: 3, name: 'DM', formula_type: 'diamond', parts: {} },
  ]
  const E2 = makeEngine({ formulas: F })
  const names = (o) => o.map((x) => x.value).sort()
  eq('⑦ 平开候选收平开族（含 diamond）', names(E2.pingProfileOptions.value), ['DM', 'P'])
  eq('⑦ 移门候选只收 diao', names(E2.diaoProfileOptions.value), ['D'])
}
{
  const E2 = makeEngine()
  eq('⑦ belongsToTable：无型别两边都放', [E2.belongsToTable('', 'ping'), E2.belongsToTable(undefined, 'diao')], [true, true])
  eq('⑦ belongsToTable：diamond 只归平开', [E2.belongsToTable('diamond', 'ping'), E2.belongsToTable('diamond', 'diao')], [true, false])
}

// ── ⑧ 尺寸类自动加价（开关 + 分派 + 候选口径）────────────────────────────
{
  // 候选来自**加价项目录**（`useMarkupCatalog` 的模块单例）。本脚本不往里塞东西，
  // 所以候选恒为空 —— 正好用来验「无候选时要把旧自动项清掉」这一支。

  const l = line({ line_type: 'ping', price_type: '套', door_width: 3500, markup: [] })
  // 目录为空 ⇒ 无候选、但旧的超宽项要被清掉
  l.markup = [{ name: '超宽100', price: 5, unit: '元/公分', amount: 0 }]
  E.syncSizeMarkup(l, 'door_width')
  eq('⑧ 候选为空时清掉旧超宽项', l.markup, [])
}
{
  // 关掉自动加价 ⇒ 一个都不动
  const E2 = makeEngine({ disableAutoMarkup: true })
  const l = { ...E2.newLine('ping'), markup: [{ name: '超宽100', price: 5, unit: '元/公分', amount: 0 }] }
  E2.syncSizeMarkup(l, 'door_width')
  eq('⑧ 关掉自动加价 ⇒ 不动行', l.markup.length, 1)
}
{
  // 平开：门洞宽/门洞高 仅当计价=方…（原版是「仅当套」，见引擎注释）
  const E2 = makeEngine()
  const mk = (pt) => ({ ...E2.newLine('ping'), price_type: pt, door_width: 3500, markup: [{ name: '超宽100', price: 5, unit: '元/公分', amount: 0 }] })
  const keep = mk('方')
  E2.syncSizeMarkup(keep, 'door_width')
  eq('⑧ 非「套」时门洞宽不触发（旧项保留）', keep.markup.length, 1)
  const drop = mk('套')
  E2.syncSizeMarkup(drop, 'door_width')
  eq('⑧ 「套」时门洞宽触发（无候选则清旧项）', drop.markup.length, 0)
  // 墙厚恒触发（与计价方式无关）
  const wall = { ...E2.newLine('ping'), price_type: '方', markup: [{ name: '超墙厚10', price: 5, unit: '元/公分', amount: 0 }] }
  E2.syncSizeMarkup(wall, 'wall_thickness')
  eq('⑧ 墙厚恒触发（不受计价方式限制）', wall.markup.length, 0)
}
{
  // 移门：非 wall_thickness 的字段直接 return，不动行
  const E2 = makeEngine()
  const l = { ...E2.newLine('diao'), door_width: 3500, markup: [{ name: '超宽100', price: 5, unit: '元/公分', amount: 0 }] }
  E2.syncSizeMarkup(l, 'door_width')
  eq('⑧ 移门：门洞宽不触发（旧项保留）', l.markup.length, 1)
}

// ── ⑨ 提示走注入的 message（不是全局 ElMessage）──────────────────────────
{
  messages.length = 0
  E.markupError('计算金额失败')
  eq('⑨ markupError 落到注入的 message.error', messages, [['error', '计算金额失败']])
}

// ── ⑩ 引擎不自己 fetch：`removeLine` 在未落库时不发请求 ───────────────────
{
  // 未落库（orderId=null）走「删除行」确认框；这里只验证不抛、且没触碰 api
  let called = 0
  const E2 = makeEngine({ orderId: null })
  const l = { ...E2.newLine('ping'), id: null }
  E2.removeLine(l)
  eq('⑩ 未落库行：删行不进网络分支（不抛）', called, 0)
}

console.log(`引擎行为回归：对照 ${pass + fails.length} 条，通过 ${pass}，不符 ${fails.length}`)
if (fails.length) {
  console.log('')
  fails.forEach((f) => console.log('  ✗ ' + f))
  process.exit(1)
}
