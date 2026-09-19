/*
 * 扫码生产（`/Qrscanner`）的两块**逐字差分台**：同一批夹具，左边跑**旧版真代码**、
 * 右边跑**新版真代码**，逐字段比。
 *
 *   ① **扫码查单**：旧版 `param1=getScanQRcode`（服务端纯过滤） vs 新版
 *      `utils/scanStats.ts` 的 `matchByScanCode`（客户端过滤）。
 *      ⇒ 钉住「**我们不是漏做了那条端点，是换成了等价实现**」这个结论。
 *   ② **扫码标记的解析**（`parseScanMarker`）：这是统计看板「扫码日期/扫码员工」**现推**的
 *      唯一判据（分析文档 §8.6-(b)），正则抄错一个字符**不报错**、只是筛出来的行数不一样。
 *
 * 左边（旧版）：`/Users/aaa/Downloads/server/src/modules/progress/progress.service.ts`
 *   —— 用 `docs/legacy-finance/lib/run-legacy-fn.mjs` **切源码跑**（不手抄，见项目约定）。
 * 右边（新版）：`app/src/utils/scanStats.ts`（esbuild 现 bundling 出来 import）。
 *
 * ⚠️ 写这台差分台时**顺手修了 `sliceFnFrom` 一个静默切歪的 bug**
 * （签名里带花括号时把类型注解当函数体起点），详见 `docs/2026-09-19-progress-server.md` §7.1
 * ——那里早先也踩到过、当时是复制到 `/tmp` 绕过的。这里**就地修了公共件**，
 * 并用「两份源码里每一个 `function` 都切一遍」做了回归。
 *
 * ## ⚠️ 这台差分台**不覆盖**的东西（别以为它绿了就全都对）
 *
 * 1. **`GET /v1/progress` 那份全量门行本身**。右边喂进去的「全量行」就是把旧版
 *    `doorRowsFromSpecs` 的产物（同一批夹具），比的是**筛法**，不是新后端的行构造。
 *    行构造归 `docs/2026-09-19-progress-*.md` 那边管。
 * 2. **整行字段**。旧版 `getScanQrCode` 会 `enrichDoorRow(..., {gmtDate:true})`，
 *    新版那份来自 `build_row`（中文键只有少数几个）—— 两边**字段集合本来就不同**
 *    （这是分析文档 §8.6 里写明的有意偏离）。所以这里**只比「哪些行被选中」**（按 `单号` 序列），
 *    **不比整行**。`enrichDoorRow` 本身是**切真源码**跑的（筛选发生在那句 `.filter(...)` 里、
 *    在 `.map(enrichDoorRow)` 之前，它坏不坏都不该影响结论 —— 但既然能切，就用真的）。
 * 3. **`safeLoads` 是注入的桩**（夹具传的是**对象**、不是 JSON 字符串，那个分支根本没走到）。
 *
 * ⚠️ 夹具只有能说清「夹具本身与旧版口径不符」时才能改，且要写明理由 —— 不许为了让测试变绿改夹具。
 *
 * 用法：node docs/qrscanner-scan-logiccheck.mjs
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { legacySrc, runLegacyFns } from './legacy-finance/lib/run-legacy-fn.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const ESBUILD = resolve(ROOT, 'app/node_modules/.bin/esbuild')
const OUT = '/tmp/qrscanner-scan-new.mjs'

let fails = 0
const ok = (msg) => console.log(`  ✓ ${msg}`)
const bad = (msg) => {
  fails++
  console.log(`  ✗ ${msg}`)
}

// ------------------------------------------------------------ 新版真代码 //
// esbuild 现把 `scanStats.ts`（含它 import 的 productionStats / useOpenDirection）打成 ESM 再 import
// —— 保证右边跑的是**仓库里那份**，不是这儿重写一遍。
writeFileSync(
  '/tmp/qrscanner-scan-entry.ts',
  `export { matchByScanCode, parseScanMarker, deriveScanMarker } from ${JSON.stringify(
    resolve(ROOT, 'app/src/utils/scanStats.ts'),
  )}\n`,
)
execFileSync(ESBUILD, ['/tmp/qrscanner-scan-entry.ts', '--bundle', '--platform=node', '--format=esm', `--outfile=${OUT}`, '--log-level=error'])
const NEW = await import(OUT)

// ------------------------------------------------------------ 旧版真代码 //
const SVC = legacySrc('modules/progress/progress.service.ts')

/** `getScanQrCode` 直接/间接用到的那些纯函数（`prisma` 由 scope 注入桩，见文件头）。 */
const LEGACY_FNS = [
  'parseDs', 'isRecord', 'asRecordArray', 'parseSpecs', 'firstNonBlank', 'dateText',
  'normalizeRefs', 'rowRefs', 'rowRef', 'doorRowsFromSpecs', 'buildProgressText', 'withProgressText',
  'enrichDoorRow', 'parseScanMarker', 'getScanQrCode',
]

// ---------------------------------------------------------------- 夹具 //
/*
 * 门行夹具。`单号` 故意做出三种形状：
 *   · 正常值；
 *   · **前后带空格**（旧版 `String(row['单号']).trim()` 后再 `Set.has`，新版 `matchByScanCode`
 *     也是两侧 trim —— 两边都必须能命中，这是「trim 精确匹配」这条口径的核心）；
 *   · 同一单号出现两次（旧版**两次都返回**、不去重 —— 新版 filter 同理）。
 * 另外留一个**任何查询都命不中**的单号，用来做反向自检。
 */
const DOOR = (no, extra = {}) => ({ 单号: no, 数量: 1, 平方数: 2.5, 型材: '80断桥', ...extra })
const ORDERS = [
  {
    orderNo: 'A-001',
    customerName: '张三',
    orderDate: new Date('2026-09-14T00:00:00Z'),
    client: { address: '合肥市', clientCode: 'C1' },
    doorSpecs: { ping_hui: [DOOR('85-26/09/14'), DOOR('86-26/09/15')] },
  },
  {
    orderNo: 'A-002',
    customerName: '李四',
    orderDate: new Date('2026-09-15T00:00:00Z'),
    client: { address: '芜湖市', clientCode: 'C2' },
    doorSpecs: {
      ping_hui: [DOOR('87-26/09/16')],
      // ★ 前后带空格的那个
      diao_hui: [DOOR('  88-26/09/17  ')],
    },
  },
  {
    orderNo: 'A-003',
    customerName: '王五',
    orderDate: new Date('2026-09-16T00:00:00Z'),
    client: { address: '蚌埠市', clientCode: 'C3' },
    // ★ 同一单号出现两次（两张单里各一行）
    doorSpecs: { ping_hui: [DOOR('85-26/09/14')] },
  },
]

const prismaStub = {
  order: { findMany: async () => ORDERS },
  // 旧版这条路径不写库；真被调用到就说明夹具或切片跑偏了。
  progress: { upsert: async () => { throw new Error('夹具不该走到写库') } },
}

const legacy = await runLegacyFns(
  LEGACY_FNS,
  // `safeLoads` 是唯一的桩：夹具传的是**对象**、不是 JSON 字符串，那个分支根本没走到
  // （它来自 `utils/helpers`，与 `progress.service.ts` 不同文件、切不出来）。见文件头第 3 条。
  { prisma: prismaStub, safeLoads: () => null },
  'return { getScanQrCode, parseScanMarker, enrichDoorRow, doorRowsFromSpecs, parseSpecs, normalizeRefs };\n',
  SVC,
)

/** 新版 `GET /v1/progress` 的等价物：把同一批夹具摊平成「全量门行」。 */
const ALL_ROWS = ORDERS.flatMap((o) =>
  legacy.doorRowsFromSpecs(legacy.parseSpecs(o.doorSpecs)),
)

// ------------------------------------------------- ① 扫码查单：筛法等价 //
console.log('\n① 扫码查单 · 旧版 `getScanQRcode`（服务端过滤） vs 新版 `matchByScanCode`（客户端过滤）')
{
  /*
   * 查询串也是三种：精确值、**前后带空格**、以及一个查不到的。
   * ⚠️ 旧版 `normalizeRefs` 会把**查询串** trim 掉，新版 `matchByScanCode` 里 `code.trim()` 同理
   *    ⇒ 两边对「输入带空格」的反应必须一致。
   */
  const CODES = ['85-26/09/14', '  86-26/09/15  ', '88-26/09/17', '不存在的单号', '']

  for (const code of CODES) {
    // 旧版：空串在旧服务端是 `wanted.length === 0` → 直接返回空（`{code:200,data:[]}`）
    const legacyNos = code.trim()
      ? (await legacy.getScanQrCode('tenantX', [code])).data.map((r) => r['单号'])
      : []
    // 新版：`runScanQuery` 在空串时**根本不发查询**（`message.warning('请提供单号')`）⇒ 等价于空
    const newNos = code.trim()
      ? ALL_ROWS.filter((row) => NEW.matchByScanCode(row, code)).map((r) => r['单号'])
      : []

    if (JSON.stringify(legacyNos) !== JSON.stringify(newNos)) {
      bad(`查 ${JSON.stringify(code)}：旧版 ${JSON.stringify(legacyNos)} / 新版 ${JSON.stringify(newNos)}`)
    } else {
      ok(`查 ${JSON.stringify(code)} → ${JSON.stringify(legacyNos)}`)
    }
  }

  // 反向自检：夹具得**真的能被筛掉** —— 否则「两边都返回全部」也会绿
  const one = ALL_ROWS.filter((row) => NEW.matchByScanCode(row, '85-26/09/14'))
  if (one.length !== 2) {
    bad(`夹具失效：查 85-26/09/14 应有 **2** 行（两张单里各一行、且不去重），实际 ${one.length}`)
  } else {
    ok('重复单号不去重（2 行）—— 与旧版 `Set.has` 逐行判定一致')
  }
  if (ALL_ROWS.length !== 5) {
    bad(`夹具失效：全量行应有 5 行，实际 ${ALL_ROWS.length}`)
  }
  // 带空格那一行：两边都要能命中
  if (!NEW.matchByScanCode(ALL_ROWS[3], '88-26/09/17')) {
    bad('新版的 trim 匹配漏了「行上单号前后带空格」那种')
  }
}

// --------------------------------------------- ② 扫码标记正则：逐串比 //
console.log('\n② 扫码标记解析 `parseScanMarker`（统计看板「现推」的唯一判据）')
{
  /*
   * ⚠️ **这里钉住一个容易被口述带偏的细节**：旧服务端源码里那个正则写的是
   *    `/_(.+)_(\d{4}-\d{2}-\d{2})$/` —— 中间是 **`.+`**，不是 `\S+`
   *    （`progress.service.ts:118`，逐字）。差别只在「员工名里有空白」时看得出来：
   *    `.+` 能匹配 `李 四`，`\S+` 不能。下面第 3 条夹具就是为这个加的。
   */
  const VALUES = [
    '下料_李四_2026-09-19', // 正常（扫码页提交的形状，两个下划线）
    '下料_2026-09-19', // 一个下划线（/Progress 页提交的形状）→ 不匹配
    '下料_李 四_2026-09-19', // ★ 员工名里有空格：.+ 匹配 / \S+ 不匹配
    '__2026-09-19', // 中间段为空 → .+ 要求至少一个字符 → 不匹配
    '下料_李四_2026-9-19', // 日期不是两位月 → 不匹配
    '下料_李四_2026-09-19 ', // 尾部空格（两边都先 trim → 匹配）
    'a_b_c_王五_2026-09-20', // 中间段可以有下划线（.+ 贪婪，取最后一个 _ 之后为员工）
    '', // 空值
    null, // null
  ]

  for (const v of VALUES) {
    const a = legacy.parseScanMarker(v)
    const b = NEW.parseScanMarker(v)
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      bad(`${JSON.stringify(v)}：旧版 ${JSON.stringify(a)} / 新版 ${JSON.stringify(b)}`)
    } else {
      ok(`${JSON.stringify(v)} → ${JSON.stringify(a)}`)
    }
  }

  // 反向自检：确认上面第 3 条**真的**能区分 `.+` 与 `\S+`（否则那条夹具白加了）
  const withSpace = '下料_李 四_2026-09-19'
  const dotPlus = /_(.+)_(\d{4}-\d{2}-\d{2})$/.test(withSpace)
  const nonSpace = /_(\S+)_(\d{4}-\d{2}-\d{2})$/.test(withSpace)
  if (!(dotPlus === true && nonSpace === false)) {
    bad(`夹具失效：本以为 .+ 与 \\S+ 在 ${JSON.stringify(withSpace)} 上会分叉，实际 ${dotPlus}/${nonSpace}`)
  } else {
    ok('已确认：`(.+)` 与 `(\\S+)` 在「员工名含空格」时**确实分叉**（源码是前者）')
  }
}

// ---------------------------------------------------------------- 汇总 //
console.log('')
if (fails) {
  console.log(`✗ 有 ${fails} 处不一致`)
  process.exit(1)
}
console.log('✓ 全部一致')
