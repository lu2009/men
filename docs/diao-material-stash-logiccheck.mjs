/*
 * 「新增材料」抽屉里「常规材料」那一段 = **撤销删除** 的差分台。
 *
 * 左边跑**旧版真代码**（`Diao.deobfuscated.js:1785-1794` 的 `_0x59235b`，切出来真跑），
 * 右边跑新版纯函数 `data/formulaExtra.ts` 的 `insertKeyAt`。
 *
 * ## 为什么值得单独钉
 *
 * 我们原先把这一段**整个理解错了** —— 当成"一张还没加过的常用材料表"，
 * 加过就从候选里划掉。旧版是**暂存区**：预置 5 个 + 你删掉的每一行，
 * 「恢复」是**按删除时的行号插回原位**（预置那 5 个没有行号 ⇒ 追加到末尾）。
 *
 * 那 5 个预置项是 `Diao.deobfuscated.js:1196-1215` 的 `_0x3a3e48.value.delete`：
 * `分体亮窗边封 / 单轨2扇收口 / 单轨2扇上下方 / 亮窗扣板高 / 亮窗F槽高`
 * —— 与 `data/formulaMaterials.ts` 的 `COMMON_MATERIALS` 逐条同源。
 *
 * ## 边界（最容易写错的地方）
 *
 * 旧版那句是
 * `typeof t === "number" && t >= 0 && t <= rows.length ? rows.splice(t,0,c) : rows.push(c)`。
 * 上界是 **`<=`**：`position` 正好等于长度时插到**末尾**（与 push 同效）；
 * `undefined`（预置那 5 个）/ 越界 / 负数一律**追加**。
 *
 * ⚠️ 这台**只比「恢复后它落在第几位」**。不比：
 *   1. 恢复时 def 的内容（旧版 `{...l}` 原样写回 —— 我们照做，但没有可比的纯函数）；
 *   2. DOM id 那套编码（旧版把名字塞进 `"delete-"+name`、点击时 `split("-")[1]` 取回来，
 *      **名字里含 `-` 会被截断**，是旧版的坑）。我们直接传名字，不复制这个技巧。
 *
 * ⚠️ 夹具只有能说清「夹具本身与旧版口径不符」时才能改，且要写明理由 —— 不许为了让测试变绿改夹具。
 *
 * 用法：node docs/diao-material-stash-logiccheck.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const LEGACY = resolve(ROOT, 'legacy/js/Diao.deobfuscated.js')
const EXTRA_TS = resolve(ROOT, 'app/src/data/formulaExtra.ts')

const src = readFileSync(LEGACY, 'utf8')

/** 唯一命中才肯用 —— 不唯一就说明源码变了，先看一眼再改锚点。 */
function cut(startAnchor, endAnchor, what) {
  const a = src.indexOf(startAnchor)
  if (a < 0) throw new Error(`旧版锚点没命中（${what} 起点）：${startAnchor}`)
  if (src.indexOf(startAnchor, a + 1) >= 0) throw new Error(`旧版锚点不唯一（${what} 起点）`)
  const b = src.indexOf(endAnchor, a)
  if (b < 0) throw new Error(`旧版锚点没命中（${what} 终点）：${endAnchor}`)
  return src.slice(a, b + endAnchor.length)
}

/*
 * `_0x59235b` 整个函数。它用到的作用域：
 *  - `_0x3a3e48` 材料库（只读 `.value.delete`，即暂存区）
 *  - `_0x3bd2b8` defs（写回 def）
 *  - `_0xb4b9f`  行数组（**顺序以它为准**，这才是要比的东西）
 *  - `_0xe7317c` 行 id 计数器
 *  - `_0x5a2c87` 混淆器哨兵
 */
// ⚠️ 终点锚点落在函数**体中间**（`if(...){…}` 还没收），所以要把两层收尾括号补回来。
const STASH_FN =
  cut(
    '_0x59235b=e=>{',
    '_0x3a3e48["value"].delete[e],ElementPlus.ElMessage["success"]("恢复成功")',
    '恢复函数 _0x59235b',
  ) + '\n      }\n    }'
if (STASH_FN.length < 500 || !STASH_FN.includes('splice')) {
  throw new Error(`旧版恢复函数形状不对（len=${STASH_FN.length}）`)
}
// 那句判据必须逐字在里面 —— 本台的意义就是钉它。
if (!/typeof t==="number"&&t>=0&&t<=_0xb4b9f\.value\["length"\]/.test(STASH_FN)) {
  throw new Error('旧版恢复函数里那句位置判据变了 —— 先看一眼再改本台，别直接放过')
}
// 切出来的必须是**语法完整**的一段 —— 括号没配平就当场报，别等到 new Function 抛。
try {
  new Function(`_0x5a2c87`, `${STASH_FN};`)
} catch (e) {
  throw new Error(`切出来的旧版恢复函数语法不完整（锚点少切/多切了）：${e.message}`)
}

/**
 * 跑旧版那一段。`rows` 是当前行数组（每项 `{name}` 够用），返回**恢复后的 name 顺序**。
 */
function runLegacy({ keys, stashEntry, name }) {
  const rows = keys.filter((k) => k !== name).map((k, i) => ({ id: i + 1, name: k }))
  const defs = { value: {} } // ⚠️ `_0x3bd2b8` 是 ref（`Vue.ref({})`）⇒ 要包一层 `.value`
  const library = { value: { delete: { [name]: stashEntry } } }
  const counter = { value: 1000 }
  const ElMessage = { success: () => {}, error: () => {} }
  // ⚠️ `STASH_FN` 是一句**赋值**（`_0x59235b=e=>{…}`）不是声明 —— 求值只是把它挂上去，
  //    **必须再调一次**。第一版就是漏了这步，旧版侧全程"什么都没做"，
  //    红的夹具看着像"新版抄错"，其实是**旧版没跑**。
  const fn = new Function(
    '_0x5a2c87', '_0x3a3e48', '_0x3bd2b8', '_0xb4b9f', '_0xe7317c', 'ElementPlus', 'NAME',
    `${STASH_FN};\n _0x59235b(NAME);\n return { rows: _0xb4b9f.value, called: typeof _0x59235b === 'function' };`,
  )
  const out = fn(undefined, library, defs, { value: rows }, counter, { ElMessage }, name)
  if (!out.called) throw new Error('旧版恢复函数没被挂上 —— 切段出问题了')
  return out.rows.map((r) => r.name).join(',')
}

// ---------------------------------------------------------------- 新版侧 //
const require = createRequire(resolve(ROOT, 'app/package.json'))
const esbuild = require('esbuild')
const OUT = resolve(tmpdir(), `formula-extra-stash-${process.pid}.mjs`)
writeFileSync(
  OUT,
  esbuild.transformSync(readFileSync(EXTRA_TS, 'utf8'), { loader: 'ts', format: 'esm', charset: 'utf8' }).code,
)
const { insertKeyAt } = await import(OUT + `?v=${process.pid}`)

/** 新版：`rows` 的 name 顺序 = `parts` 的键序，所以直接比键序。 */
function runNew({ keys, name, position }) {
  return insertKeyAt(keys, name, position).join(',')
}

// ------------------------------------------------------------------ 夹具 //
/** 一个部件的最小形状：旧版恢复时只读它自己的字段，位置无关。 */
const def = (materialName) => ({
  state: false,
  quantity: 2,
  materialName,
  track: '',
  formula: '=h-v',
  result: 0,
  v: 0,
  title: '',
  calculate: '=h-result',
  color: 'green',
})

const KEYS = ['甲', '乙', '丙', '丁', '戊']

const CASES = [
  { name: '★ 预置项（**没有 position**）⇒ 追加到末尾', keys: KEYS, key: '分体亮窗边封', position: undefined },
  { name: 'position=0 ⇒ 插到最前', keys: KEYS, key: '丙', position: 0 },
  { name: 'position=2 ⇒ 插到第 3 位（中间）', keys: KEYS, key: '丙', position: 2 },
  {
    name: '★ position=长度（=4，此时 rows 已被排除掉 丙 ⇒ len 4）⇒ 末尾，与 push 同效',
    keys: KEYS,
    key: '丙',
    position: 4,
  },
  { name: '★ position 越界（9 > len）⇒ 追加', keys: KEYS, key: '丙', position: 9 },
  { name: '★ position 负数 ⇒ 追加', keys: KEYS, key: '丙', position: -1 },
  { name: 'position 为小数 1.5 ⇒ 落在 1 与 2 之间（splice 的行为）', keys: KEYS, key: '丙', position: 1.5 },
  { name: '空表 + 无 position ⇒ 只有一个', keys: [], key: '甲', position: undefined },
  { name: '空表 + position=0 ⇒ 只有一个', keys: [], key: '甲', position: 0 },
  { name: '表里只剩一个 + position=0 ⇒ 插到它前面', keys: ['乙'], key: '甲', position: 0 },
]

// ------------------------------------------------------------------ 跑比 //
let failed = 0
for (const c of CASES) {
  const legacy = runLegacy({
    keys: c.keys,
    name: c.key,
    stashEntry: { ...def(c.key), ...(c.position === undefined ? {} : { position: c.position }) },
  })
  const now = runNew({ keys: c.keys, name: c.key, position: c.position })
  if (legacy === now) {
    console.log(`✓ ${c.name}`)
  } else {
    failed++
    console.log(`✗ ${c.name}`)
    console.log(`    旧版: ${legacy}`)
    console.log(`    新版: ${now}`)
  }
}

// ------------------------------------------- 预置那 5 个与 COMMON_MATERIALS 同源 //
/*
 * 旧版暂存区 `_0x3a3e48.value.delete` 是**预置了 5 个**的。我们那份数据在
 * `data/formulaMaterials.ts` 的 `COMMON_MATERIALS` —— 本台顺手验一下两边**键名一致**，
 * 免得哪天有人改了其中一边。
 */
console.log('\n预置项：旧版暂存区 vs 我们的 COMMON_MATERIALS')
{
  const i = src.indexOf('_0x3a3e48=Vue.ref({')
  const seg = src.slice(i, i + 2500)
  const dur = seg.indexOf('delete:{') + 8
  const legacyKeys = [...seg.slice(dur, seg.indexOf('},"平开门复古门下封板"')).matchAll(/"([^"]+)":\{/g)].map(
    (m) => m[1],
  )
  const mats = readFileSync(resolve(ROOT, 'app/src/data/formulaMaterials.ts'), 'utf8')
  const ci = mats.indexOf('COMMON_MATERIALS')
  const ourKeys = [...mats.slice(ci, mats.indexOf('EXTRA_MATERIAL_GROUPS')).matchAll(/^\s*"([^"]+)":/gm)].map(
    (m) => m[1],
  )
  const same =
    legacyKeys.length > 0 &&
    legacyKeys.length === ourKeys.length &&
    legacyKeys.every((k, n) => k === ourKeys[n])
  if (same) {
    console.log(`✓ 逐条一致（${legacyKeys.join(' / ')}）`)
  } else {
    failed++
    console.log(`✗ 不一致\n    旧版暂存区: ${legacyKeys.join(' / ')}\n    我们的:     ${ourKeys.join(' / ')}`)
  }
}

if (failed) {
  console.log('\n✗ 有夹具不一致 —— 要么新版抄错了，要么夹具与旧版口径不符（后者要写明理由）。')
  process.exit(1)
}
console.log('\n✓ 全部一致')
