/*
 * 扫码生产（`/Qrscanner`）两条窄接口的**真差分台**：
 * 左边跑**旧版真源码**（切 `progress.service.ts`，不手抄，见项目约定），
 * 右边**打我们新后端的真接口**，逐条比「哪些行被选中」。
 *
 * ## 为什么是这种形状（读这段再改）
 *
 * 这脚本**原先**比的是「旧版服务端 vs **新版前端** `utils/scanStats.ts`」。
 * 2026-09-19 用户推翻了那个设计：扫码页不再拉全量（全量门行含客户名/金额/安装地址，
 * 而这一页跑在车间工人的手机上），改成两条窄接口 —— 于是**推导搬到了服务端**，
 * 右边那一半（前端函数）不存在了。
 *
 * lead 拍板：**改成打真后端**，不要只写一句「比对已移到后端」就放着 —— 那样这台就死了。
 * ⇒ 现在比的是「旧版口径 vs 新版**真实现**」，比原来更强（以前右边是前端函数，现在是真接口）。
 *
 * 三块：
 *   ① `GET /v1/scan/qrcode`  ←→ 旧版 `getScanQrCode`（按单号取行，含 trim / 逗号批量）
 *   ② `GET /v1/scan/stats`   ←→ 旧版 `getProcessCounts`（扫码标记的现推 + 员工/日期筛）
 *   ③ 日期档位标签           ←→ 旧版 `resolveDateLabel`（★ 钉住 `本周` 从**周一**算起）
 *   ④ 守卫：前端 `utils/scanStats.ts` 不许把那几个函数加回来
 *   ⑤ 提交进度：扫码页「确认」发的 `line_nos` 落在正确的行上（前端已不再解析行 id）
 *
 * ## 数据是怎么对齐的（★ 关键）
 *
 * 旧版读的是 `orders.doorSpecs` 那段 JSON，新后端读的是 `order_lines` 表 —— 两边**不同源**。
 * 所以本台**造一批一次性夹具**：用 `POST /v1/orders` 真建单（每行给一个已知的**行级单号**），
 * 再用 `POST /v1/progress/update` 把槽值真写进去；左边那份 legacy 夹具是**同一批行**的
 * 等价 JSON。跑完在 `finally` 里删掉（走 `docker exec … psql`，与
 * `docs/home-audit/hui-row-save-check.mjs` 同一套清理手法）。
 *
 * ★ **员工名带一次性后缀**（`验收NNNNNN`）：`scan/stats` 是**按整个租户**扫的，
 * 用唯一的员工名把夹具行从库里其它行里择出来，才不用去建临时租户。
 *
 * ## ⚠️ 前提（不满足就**报错退出**，不静默跳过）
 *
 * 1. **后端在跑**（默认 `127.0.0.1:3000`，`E2E_PORT` 可改），admin/`Admin@12345` 能登；
 * 2. **`docker exec smartdoor-db psql` 可用**（清理一次性数据要用）。
 *
 * 用法：`node docs/qrscanner-scan-logiccheck.mjs`
 *
 * ⚠️ 夹具只有能说清「夹具本身与旧版口径不符」时才能改，且要写明理由 —— 不许为了让测试变绿改夹具。
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { legacySrc, runLegacyFns, sliceFnFrom, toJs } from './legacy-finance/lib/run-legacy-fn.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const ESBUILD = resolve(ROOT, 'app/node_modules/.bin/esbuild')
const OUT = '/tmp/qrscanner-scan-new.mjs'
const API = `http://127.0.0.1:${process.env.E2E_PORT || '3000'}/api`
// 库/容器/用户可用环境变量覆盖。缺省值 = 开发库，行为与改动前**逐字相同**。
// 为什么必须能覆盖：`npm run verify` 跑在自己的 `smartdoor_verify` 库上，而这些台子原来
// 把库名写死成开发库 —— 清理用的 DELETE 拿的是**新库里的 id**，两个库的序列都从 1 开始、
// id 必然撞上 ⇒ 会删掉开发库里的真数据。
// （这几行必须在 `preflight()` 之前 —— 它在 197 行就被 await 了。）
const DB_CONTAINER = process.env.DB_CONTAINER || 'smartdoor-db'
const DB_USER = process.env.DB_USER || 'smartdoor'
const DB_NAME = process.env.DB_NAME || 'smartdoor'

let fails = 0
const ok = (msg) => console.log(`  ✓ ${msg}`)
const bad = (msg) => {
  fails++
  console.log(`  ✗ ${msg}`)
}
const eqList = (label, got, want) => {
  const a = JSON.stringify(got)
  const b = JSON.stringify(want)
  a === b ? ok(`${label} → ${b}`) : bad(`${label}\n      旧版 = ${b}\n      新端 = ${a}`)
}

// ---------------------------------------------------------------- 日期锚点 //
const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const NOW = new Date()
const TODAY = ymd(NOW)
const MONDAY = new Date(NOW)
MONDAY.setDate(NOW.getDate() - (NOW.getDay() || 7) + 1)
const WEEK_MON = ymd(MONDAY)
/** 本周一的前一天 = 上一个周日。用来钉「本周从周一算起」：它**不该**进本周。 */
const SUN_BEFORE = ymd(new Date(MONDAY.getFullYear(), MONDAY.getMonth(), MONDAY.getDate() - 1))
const MONTH_START = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-01`

const RUN = String(Date.now()).slice(-6)
/** ★ 一次性员工名：把夹具行从库里其它行里择出来（`scan/stats` 是全租户扫的）。 */
const EMP = `验收${RUN}`
/** 带**空格**的员工名 —— 这是 `.+/\\S+` 那条分野的夹具（见 ② 末）。 */
const EMP_SPACE = `李 四${RUN}`

// ------------------------------------------------------------ 新版前端真代码 //
// ④ 那段守卫要读的是**仓库里那份**导出表（确认推导没被加回前端）。
writeFileSync(
  '/tmp/qrscanner-scan-entry.ts',
  `export * from ${JSON.stringify(resolve(ROOT, 'app/src/utils/scanStats.ts'))}\n`,
)
execFileSync(ESBUILD, ['/tmp/qrscanner-scan-entry.ts', '--bundle', '--platform=node', '--format=esm', `--outfile=${OUT}`, '--log-level=error'])
const NEW = await import(OUT)

// ------------------------------------------------------------ 旧版真代码 //
const SVC = legacySrc('modules/progress/progress.service.ts')
const LEGACY_FNS = [
  'parseDs', 'isRecord', 'asRecordArray', 'parseSpecs', 'firstNonBlank', 'dateText',
  'normalizeRefs', 'rowRefs', 'rowRef', 'doorRowsFromSpecs', 'buildProgressText', 'withProgressText',
  'enrichDoorRow', 'parseScanMarker', 'getScanQrCode', 'getProcessCounts', 'resolveDateLabel',
  // ⑤ 用：旧版那条**写**路径，拿来和新 `update` 的 `line_nos` 逐条比
  'updateProgress', 'countMatchingDoorRows', 'updateSpecsRows', 'mergePrintStatus',
]

/*
 * `parseDate` 在 `progress.service.ts` 里是 **import 进来的**（`utils/helpers`），
 * 切不到 —— 所以**从它自己那个文件再切一份真源码**，别用手写的桩：
 * 「日期怎么解析」正是本台要钉的口径之一，桩一个 `new Date(...)` 就等于把左边那一半
 * 换成了我们自己写的实现，比出来不算数。
 */
const legacyParseDate = new Function(
  `${await toJs(sliceFnFrom(legacySrc('utils/helpers.ts'), 'parseDate'))}\nreturn parseDate;`,
)()

/*
 * ── 夹具：**一份定义，两边用** ─────────────────────────────────────────────
 *
 * `slot` 就是写给 `工序1` 的值。`lineNo` 是**行级单号**（故意有三种形状：正常、
 * **前后带空格**、以及一个任何查询都命不中的）。
 * `inStats` 是「**理论上**该不该进扫码统计」——它是**人写的期望**，用来给两边做**反向自检**
 * （两边都算错成一样时，这条会红）。
 */
const NO_MATCH = `无此单${RUN}`
const ROWS = [
  // ① 正常标记（两个下划线）→ 进
  { lineNo: `T${RUN}-01`, slot: `下料_${EMP}_${TODAY}`, inStats: true, why: '正常标记' },
  // ② 行级单号**前后带空格**：匹配时 trim（旧版 `String(row['单号']).trim()`）
  { lineNo: `  T${RUN}-02  `, slot: `下料_${EMP}_${TODAY}`, inStats: true, why: '单号带空格' },
  // ③ **一个下划线**（/Progress 页提交的形状）→ parseScanMarker 不匹配 → **不进**
  { lineNo: `T${RUN}-03`, slot: `下料_${TODAY}`, inStats: false, why: '一个下划线不是扫码标记' },
  // ④ 标记日期 = 本周一 → 进「本周」
  { lineNo: `T${RUN}-04`, slot: `下料_${EMP}_${WEEK_MON}`, inStats: true, why: '本周一' },
  // ⑤ 标记日期 = 本周一的前一天（上个周日）→ 在月内，但**不进「本周」**（钉周一起算）
  { lineNo: `T${RUN}-05`, slot: `下料_${EMP}_${SUN_BEFORE}`, inStats: true, why: '上个周日' },
  // ⑥ 一个槽都没写 → 没有标记 → 不进
  { lineNo: `T${RUN}-06`, slot: null, inStats: false, why: '没有任何工序值' },
  // ⑦ 员工名里**带空格** → `.` 与 `\S` 的分野（旧版正则中间是 `.+`）
  { lineNo: `T${RUN}-07`, slot: `下料_${EMP_SPACE}_${TODAY}`, inStats: true, why: '员工名含空格' },
]

// ------------------------------------------------------------ 后端连通性 //
/** 连不上就**明确报错退出** —— 不许静默跳过（lead 定的）。 */
async function preflight() {
  let r
  try {
    r = await fetch(`${API}/v1/health`)
  } catch (e) {
    console.error(`\n✗ 连不上后端 ${API} —— 本台是**真差分台**，必须打真接口。`)
    console.error(`  起后端：cd backend && cargo run    （或设 E2E_PORT 指向别的实例）`)
    console.error(`  原始错误：${e.message}`)
    process.exit(1)
  }
  if (!r.ok) {
    console.error(`\n✗ 后端 ${API}/v1/health 返回 ${r.status} —— 没法跑。`)
    process.exit(1)
  }
  try {
    execFileSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tAc', 'select 1'], { encoding: 'utf8' })
  } catch (e) {
    console.error(`\n✗ 连不上 docker 里的 ${DB_CONTAINER}（清理一次性数据要用）：${e.message}`)
    process.exit(1)
  }
}

const psql = (sql) => {
  const out = execFileSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tAc', sql], { encoding: 'utf8' })
  return out.trim()
}

// ------------------------------------------------------------ 建夹具（真接口）//
const createdOrderIds = []
/** 旧版那一侧的夹具订单（`let` —— 桩惰性读它，见下面「旧版那一侧」的说明）。 */
let LEGACY_ORDERS = []
let ORDER_ID = null
let API_ROWS = [] // 真建出来的行（带 id / 单号）

/** 一行 `OrderLineInput`（形状照 `docs/home-audit/hui-row-save-check.mjs`）。 */
const lineInput = (lineNo) => ({
  line_type: 'ping', profile: '8888', color: '白', direction: '左开', fans: '', track: '',
  casing: '', hardware: '', bottom_glass: '5mm', face_glass: '5mm', glass_thickness: '5',
  door_width: 100, door_height: 200, light_window_height: 0, wall_thickness: 0, jiao: 0,
  mother_door_width: 0, quantity: 1, unit_price: 100, price_type: '套', discount: 1, square: 0,
  custom_square: -1, other_fee: 0, casing_price: 0, casing_amount: 0, amount: 100,
  parts: [], markup: [], formula_id: null, remark: `夹具${RUN}`, install_address: '夹具地址',
  open_img: '', edge_seal_count: null, seal_board_height: 0, track_length: 0,
  front_casing_add: null, back_casing_add: null, double_ding: null, light_window_count: 0,
  image_id: null, image_url: null, progress: '', hole_size: '', line_no: lineNo,
})

await preflight()

const loginRes = await fetch(`${API}/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@12345' }),
})
if (!loginRes.ok) {
  console.error(`\n✗ admin 登录失败 ${loginRes.status} —— 检查 ADMIN 账号/密码（可用 ADMIN_USER/ADMIN_PW 覆盖）。`)
  process.exit(1)
}
const loginJson = await loginRes.json()
const TOKEN = loginJson?.data?.token ?? loginJson?.token
const H = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
const call = async (p, o = {}) => {
  const r = await fetch(`${API}${p}`, { headers: H, ...o })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${p} → ${r.status} ${JSON.stringify(j)}`)
  return j?.data ?? j
}
/** 与 `call` 同，但**不抛** —— 404 是要断言的正常出口。 */
const callRaw = async (p, o = {}) => {
  const r = await fetch(`${API}${p}`, { headers: H, ...o })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

try {
  // ---- 建单 + 行 ----
  const order = await call('/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      receipt_no: `QR${RUN}`, client_code: `__TMP_QR${RUN}__`, client_name: '夹具客户', phone: '',
      brand: 'B', order_date: TODAY, production_days: 7, deposit: 0, remark: '',
      salesperson: '', install_address: '夹具地址', lines: ROWS.map((r) => lineInput(r.lineNo)),
    }),
  })
  createdOrderIds.push(order.id)
  ORDER_ID = order.id

  const full = await call(`/v1/orders/${ORDER_ID}`)
  if (full.lines.length !== ROWS.length) {
    console.error(`\n✗ 夹具没建全：要 ${ROWS.length} 行，实际 ${full.lines.length}`)
    process.exit(1)
  }
  // 行顺序 = 建单时给的顺序（`row_index`）⇒ 与 ROWS 一一对应。
  API_ROWS = full.lines

  // ---- 写槽值（走真接口；这正是扫码页「确认」那条路）----
  for (let i = 0; i < ROWS.length; i++) {
    if (!ROWS[i].slot) continue
    const r = await callRaw('/v1/progress/update', {
      method: 'POST',
      body: JSON.stringify({ slot: '工序1', value: ROWS[i].slot, line_ids: [API_ROWS[i].id] }),
    })
    if (r.status !== 200) {
      console.error(`\n✗ 写夹具槽失败（第 ${i + 1} 行）：${r.status} ${JSON.stringify(r.json)}`)
      console.error('  ⚠️ 若报的是缺字段，可能是后端还没落地本次的 line_ids / line_nos 改动。')
      process.exit(1)
    }
  }
  console.log(`夹具已就位：单 #${ORDER_ID}，${ROWS.length} 行，员工名 \`${EMP}\``)

  // ---------------- 旧版那一侧：同一批夹具，用旧版真代码 ----------------
  //
  // 先把旧版真函数切出来（**只用它的 `parseScanMarker` 来补夹具里那两格**，见下）。
  const legacy = await runLegacyFns(
    LEGACY_FNS,
    {
      // ⚠️ 惰性：`LEGACY_ORDERS` 在这一段末尾才赋值，桩被调用时它已经在手上。
      prisma: {
        order: {
          findMany: async () => LEGACY_ORDERS,
          // ★ 旧版 `updateProgress` 写完会把整段 specs **回写**（`progress.service.ts:647`）
          //   —— 桩里照做，⑤ 里 legacy 那一侧的状态才和右边（真库）同步。
          update: async ({ where, data }) => {
            const o = LEGACY_ORDERS.find((x) => x.orderNo === where?.orderNo) ?? LEGACY_ORDERS[0]
            if (o && data?.doorSpecs) o.doorSpecs = JSON.parse(data.doorSpecs)
            return o
          },
        },
        progress: { upsert: async () => ({}) },
      },
      safeLoads: () => null,
      parseDate: legacyParseDate,
    },
    'return { getScanQrCode, getProcessCounts, parseScanMarker, resolveDateLabel, updateProgress };\n',
    SVC,
  )

  //
  // 旧版读的是 `orders.doorSpecs` JSON，所以这里把同一批行**等价地**表达成那种形状：
  // `单号` + `工序1` + 扫码标记两格。
  //
  // ⚠️ 那两格（`扫码员工`/`扫码日期`）在旧版里是 `updateProgress` **写**进去的
  //    （`progress.service.ts:622-627`）：
  //    `const scanInfo = parseScanMarker(nextValue); … ...(scanInfo ? {'扫码员工':…,'扫码日期':…} : {})`
  //    这里照那一句补上（**解析用旧版真函数** `parseScanMarker`，不是我们重写一遍正则）。
  const LEGACY_ROWS = ROWS.map((r) => {
    const row = { 单号: r.lineNo, 数量: 1, 平方数: 2.5, 型材: '80断桥' }
    if (!r.slot) return row
    const scanInfo = legacy.parseScanMarker(r.slot)
    return {
      ...row,
      工序1: r.slot,
      ...(scanInfo ? { 扫码员工: scanInfo.employee, 扫码日期: scanInfo.date } : {}),
    }
  })
  // ⚠️ **顺序要紧**：`legacy` 必须**先**加载（下面构造夹具要用它的 `parseScanMarker`），
  //    而 prisma 桩里的 `LEGACY_ORDERS` 要等到真被查询时才读 ⇒ 用 `let` 承接、惰性取。
  LEGACY_ORDERS = [{
    orderNo: `QR${RUN}`,
    customerName: '夹具客户',
    orderDate: new Date(`${TODAY}T00:00:00Z`),
    client: { address: '夹具地址', clientCode: `__TMP_QR${RUN}__` },
    doorSpecs: { ping_hui: LEGACY_ROWS },
  }]

  /**
   * 旧版「扫码查单」→ 命中的**单号**序列（404 解析成空）。
   *
   * ⚠️ **逗号要在这里按旧版路由的写法拆开**：`getScanQrCode` **自己不拆**，
   *    拆的是那两条路由 ——
   *    · REST：`progress.routes.ts:56` `const refs = orderNo ? orderNo.split(',').filter(Boolean) : []`
   *    · dispatch：`legacy-dispatch.ts:789` 直接把单个值塞进 `refs`（**不拆**）
   *    两条路旧版都有，新后端取了**并集**（`scan_qrcode` 内部 `split(',')`，见 `model.rs` 的注释）。
   *    ⇒ 这里照**REST 那条**（能拆的那条）normalize，否则拿 `'a,b'` 去比就是拿
   *      「旧版服务端函数」比「旧版路由 + 服务端」，第一版这里红过一次，是harness 错了不是实现对错。
   */
  const legacyQr = async (code) => {
    const refs = code ? code.split(',').filter(Boolean) : []
    const r = await legacy.getScanQrCode('tenantX', refs)
    return r.code === 404 ? [] : r.data.map((x) => x['单号'])
  }
  /** 旧版 `getProcessCounts` → 命中的**单号**序列。 */
  const legacyStats = async (employee, range) => {
    const r = await legacy.getProcessCounts('tenantX', employee, range)
    if (r.code !== 200) throw new Error(`旧版 getProcessCounts 返回 ${r.code} ${r.message}`)
    return r.data.progressData.map((x) => x['单号'])
  }

  // ================================================================ ① 扫码查单 //
  console.log('\n① 扫码查单 · 旧版 `getScanQrCode` vs 新后端 `GET /v1/scan/qrcode`')
  {
    const cases = [
      ['精确单号', `T${RUN}-01`, { 404: false }],
      ['查询串前后带空格', `  T${RUN}-01  `, { 404: false }],
      // ★ 行上单号带空格：**匹配 trim、回来的值原样**（旧版如此；后端 `btrim` 同理）
      ['行上单号带空格', `T${RUN}-02`, { 404: false }],
      ['同一个不存在', NO_MATCH, { 404: true }],
      // ★ 逗号批量（旧版 REST 路由 `?orderNo=a,b` 的形态；`resolveLineIds` 已经不用了，
      //    但 `scan/qrcode` 仍支持，这里把它钉住）
      ['逗号批量两个', `T${RUN}-01,T${RUN}-04`, { 404: false }],
    ]
    for (const [label, code, exp] of cases) {
      const want = await legacyQr(code)
      const got = await callRaw(`/v1/scan/qrcode?code=${encodeURIComponent(code)}`)
      if (exp['404']) {
        got.status === 404
          ? ok(`${label} → 404（旧版也是 404，前端走 error 分支）`)
          : bad(`${label}：期望 404，实际 ${got.status} ${JSON.stringify(got.json)}`)
      } else if (got.status !== 200) {
        bad(`${label}：期望 200，实际 ${got.status} ${JSON.stringify(got.json)}`)
      } else {
        eqList(label, (got.json?.data?.rows ?? []).map((x) => x['单号']), want)
      }
    }

    // 反向自检：夹具得**真的能被筛掉** —— 否则「两边都返回全部」也会绿
    const all = await callRaw(`/v1/scan/qrcode?code=${encodeURIComponent(`${NO_MATCH}x`)}`)
    all.status === 404
      ? ok('反向自检：查一个不存在的单号确实 404（不是「返回全部」）')
      : bad(`反向自检失败：查不存在的单号回了 ${all.status} —— 夹具或筛选坏了`)

    // `code` 为空 → 200 + 空列表（不是 404）；前端本来也先判空
    const empty = await callRaw('/v1/scan/qrcode?code=')
    empty.status === 200 && (empty.json?.data?.rows ?? []).length === 0
      ? ok('空 code → 200 + 空列表（旧版 `wanted.length === 0` 那一支）')
      : bad(`空 code：期望 200+[]，实际 ${empty.status} ${JSON.stringify(empty.json)}`)
  }

  // ============================================================ ② 扫码统计 //
  console.log('\n② 扫码统计 · 旧版 `getProcessCounts` vs 新后端 `GET /v1/scan/stats`')
  {
    /** 整月（覆盖夹具里所有日期）。 */
    const MONTH = `${MONTH_START},${TODAY}`
    const want = await legacyStats(EMP, MONTH)
    const got = (await call(`/v1/scan/stats?employee=${encodeURIComponent(EMP)}&range=${encodeURIComponent(MONTH)}`))?.progressData ?? []
    eqList('整月 · 本员工', got.map((x) => x['单号']), want)

    // ★ 反向自检：人写的期望（哪些行**该**进）要与「旧版算出来的」一致 ——
    //   两边都错成一样时，这条会红。
    const expectIn = ROWS.filter((r) => r.inStats && r.slot?.includes(`_${EMP}_`)).map((r) => r.lineNo)
    const missing = expectIn.filter((no) => !want.includes(no))
    const extra = want.filter((no) => !expectIn.includes(no))
    missing.length === 0 && extra.length === 0
      ? ok(`反向自检：旧版选中的正是「该进」的那 ${expectIn.length} 行（一个下划线 / 无槽的行被滤掉）`)
      : bad(`反向自检失败：该进没进 ${JSON.stringify(missing)}，不该进却进了 ${JSON.stringify(extra)}`)

    // `"1"` = 全部员工的哨兵：至少要把本员工的这几行包进来
    const all = (await call(`/v1/scan/stats?employee=1&range=${encodeURIComponent(MONTH)}`))?.progressData ?? []
    expectIn.every((no) => all.some((x) => x['单号'] === no))
      ? ok('`employee=1`（全部员工）把本员工的行也包含进来了')
      : bad('`employee=1` 没包含本员工的行 —— 哨兵值没生效')

    // ★ 员工名里含空格：旧版正则中间是 `.+` 不是 `\S+`（`progress.service.ts:118` 逐字）
    const spaceWant = await legacyStats(EMP_SPACE, MONTH)
    const spaceGot = (await call(`/v1/scan/stats?employee=${encodeURIComponent(EMP_SPACE)}&range=${encodeURIComponent(MONTH)}`))?.progressData ?? []
    eqList('员工名含空格（`.+` 与 `\\S+` 的分野）', spaceGot.map((x) => x['单号']), spaceWant)
    spaceWant.length === 1
      ? ok('已确认：含空格的员工名**是**一个合法标记（`(.+)` 匹配 / `(\\S+)` 不匹配）')
      : bad(`夹具失效：期望正好 1 行，实际 ${spaceWant.length} 行`)

    // 回来的行要带 `扫码日期`（26 列的「订单详情」有一列就是它；前端已经不推了）
    got.length && got.every((x) => typeof x['扫码日期'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x['扫码日期']))
      ? ok('每行都带 `扫码日期`（前端不再现推，这一格归服务端）')
      : bad(`有行没带合法的 \`扫码日期\`：${JSON.stringify(got.map((x) => x['扫码日期']))}`)

    // 缺参数 → 400（旧版是 500 + 裸 HTML，后端有意改成 400）
    const noEmp = await callRaw(`/v1/scan/stats?range=${encodeURIComponent('当天')}`)
    noEmp.status === 400 ? ok('缺 employee → 400') : bad(`缺 employee：期望 400，实际 ${noEmp.status}`)
    const noRange = await callRaw(`/v1/scan/stats?employee=${encodeURIComponent(EMP)}`)
    noRange.status === 400 ? ok('缺 range → 400') : bad(`缺 range：期望 400，实际 ${noRange.status}`)
  }

  // ================================================== ③ 日期档位（周一起算）//
  console.log('\n③ 日期档位 · 旧版 `resolveDateLabel` vs 新后端把标签换算成的区间')
  {
    /*
     * 不比「前端算出来的日期字符串」（那会变成重写一遍旧函数），而是**比选中的行**：
     *   `GET /scan/stats?range=<标签>` 与 `GET /scan/stats?range=<旧版换算出的起,止>`
     * 必须选中**同一批行**。服务端要是把「本周」算成了周日开头，这两者就会分叉。
     */
    for (const label of ['当天', '本周', '本月']) {
      const resolved = legacy.resolveDateLabel(label)
      const viaLabel = (await call(`/v1/scan/stats?employee=${encodeURIComponent(EMP)}&range=${encodeURIComponent(label)}`))?.progressData ?? []
      const viaRange = (await call(`/v1/scan/stats?employee=${encodeURIComponent(EMP)}&range=${encodeURIComponent(resolved)}`))?.progressData ?? []
      eqList(`${label}（旧版换算出 ${resolved}）`,
        viaLabel.map((x) => x['单号']), viaRange.map((x) => x['单号']))
    }

    // ★ 钉「本周从周一算起」：标在上个周日的行**不该**进本周
    const week = (await call(`/v1/scan/stats?employee=${encodeURIComponent(EMP)}&range=${encodeURIComponent('本周')}`))?.progressData ?? []
    const weekNos = week.map((x) => x['单号'])
    !weekNos.includes(`T${RUN}-05`) && weekNos.includes(`T${RUN}-04`)
      ? ok(`本周含周一(${WEEK_MON})那行、**不含**上个周日(${SUN_BEFORE})那行 —— 起点是周一`)
      : bad(`本周的边界不对：含 ${JSON.stringify(weekNos)}（周一 ${WEEK_MON} / 上个周日 ${SUN_BEFORE}）`)

    // 当天：只有标了今天的那两行（01/02/07 里 07 是另一个员工）
    const day = (await call(`/v1/scan/stats?employee=${encodeURIComponent(EMP)}&range=${encodeURIComponent('当天')}`))?.progressData ?? []
    day.every((x) => x['扫码日期'] === TODAY)
      ? ok(`当天：每行的扫码日期都是 ${TODAY}`)
      : bad(`当天里混进了别的日期：${JSON.stringify(day.map((x) => x['扫码日期']))}`)

    // 非法的日期串 → 400（旧版也是 400，只是文案是 Go 味的，后端换成了人话）
    const badRange = await callRaw(`/v1/scan/stats?employee=${encodeURIComponent(EMP)}&range=${encodeURIComponent('不是日期')}`)
    badRange.status === 400 ? ok('日期串非法 → 400') : bad(`非法日期：期望 400，实际 ${badRange.status}`)
  }

  // ========================= ⑤ 提交进度 · 扫码页「确认」那条路（`line_nos`）//
  console.log('\n⑤ 提交进度 · 扫码页「确认」发的 `line_nos`（不是 `line_ids`）落在**正确的行**上')
  {
    /*
     * 前端 `submitProgress` 现在发的是 `{ slot, value, line_nos: [...勾选的单号] }`
     * —— **不再自己解析行 id**（`resolveLineIds` 已删）。
     * 这一段把**那条真实调用**走一遍：写进去 → 拉回来看**是不是落在对的那一行**。
     *
     * ⚠️ 两处刻意的选择：
     *  · 值用 `钻孔${RUN}`（**不含两个下划线**）⇒ **不是**扫码标记，不会污染上面 ②③ 的统计夹具
     *    （服务端本来也不校验 value 的格式）。这一条测的是**路由到哪一行**，不是值的形状。
     *  · 目标行用夹具里**没写过槽**的那一行（`-06`）。
     */
    const target = `T${RUN}-06`
    const value = `钻孔${RUN}`
    const post = (body) => callRaw('/v1/progress/update', { method: 'POST', body: JSON.stringify(body) })

    const r1 = await post({ slot: '工序2', value, line_nos: [target] })
    const d1 = r1.json?.data ?? {}
    r1.status === 200 && d1.updated === 1 && (d1.failed ?? []).length === 0
      ? ok(`按单号提交 → updated=1、failed=[]`)
      : bad(`按单号提交：${r1.status} ${JSON.stringify(r1.json)}`)

    const back = (await callRaw(`/v1/scan/qrcode?code=${encodeURIComponent(target)}`)).json?.data?.rows ?? []
    const got = back[0] ?? {}
    got['工序2'] === value
      ? ok(`★ 值落在**这一行**上（工序2 = ${JSON.stringify(value)}）`)
      : bad(`值没落对：工序2 = ${JSON.stringify(got['工序2'])}`)
    // 同一行**别的槽**不许被牵连（update 是单槽写入，不是整行替换）
    got['工序1'] === null
      ? ok('同一行的其它槽没被牵连（工序1 仍是 null）')
      : bad(`工序1 被牵连了：${JSON.stringify(got['工序1'])}`)

    // ★ 单号**前后带空格**也要命中（前端 `addCode` 存的是**扫码原文**，可能带空白；
    //   服务端 trim —— 与 `scan/qrcode` 的 `btrim` 同一个口径）
    const padded = `  T${RUN}-02  `
    const r2 = await post({ slot: '工序3', value, line_nos: [padded] })
    ;(r2.json?.data?.updated === 1 && (r2.json?.data?.failed ?? []).length === 0)
      ? ok('单号前后带空格照样命中（trim 匹配，与扫码查单同口径）')
      : bad(`带空格单号：${r2.status} ${JSON.stringify(r2.json)}`)

    // `failed` = 没对上的那些（★ 字段名照旧版 `data.failed`），**只统计 `line_nos`**
    const r3 = await post({ slot: '工序4', value, line_nos: [target, NO_MATCH] })
    const d3 = r3.json?.data ?? {}
    JSON.stringify(d3.failed) === JSON.stringify([NO_MATCH]) && d3.updated === 1
      ? ok(`一个命中一个没有 → updated=1、failed=${JSON.stringify(d3.failed)}`)
      : bad(`混合提交：${r3.status} ${JSON.stringify(r3.json)}`)

    // ★★ 真正的那一条：**旧版 `updateProgress` 跑一遍同一件事**，逐条比。
    //
    // 旧版（`progress.service.ts:654`）：
    //   if (failed.size > 0 && totalUpdated === 0) return { code: 400, data:{ failed } }
    //   return { code: 200, message: '更新成功，共更新 N 条记录…' }
    // ⇒ 「零命中 → 400」「部分命中 → 200」**本来就是旧版的口径**，新后端照做了。
    //    所以这条不是「读别人的注释猜」，是**两边各跑一次比出来的**。
    const legacyUpd = async (slot, value, refs) =>
      legacy.updateProgress('tenantX', slot, refs, value)

    // 部分命中：一个真单号 + 一个查不到的
    const lPartial = await legacyUpd('工序6', value, [target, NO_MATCH])
    const nPartial = await post({ slot: '工序6', value, line_nos: [target, NO_MATCH] })
    const nPartialData = nPartial.json?.data ?? {}
    lPartial.code === 200 && nPartial.status === 200 && nPartialData.updated === 1 &&
    JSON.stringify(nPartialData.failed) === JSON.stringify([NO_MATCH])
      ? ok(`部分命中：旧版 code=200 / 新端 200 + updated=1 + failed=${JSON.stringify(nPartialData.failed)} —— 一致`)
      : bad(`部分命中不一致：旧版 code=${lPartial.code} / 新端 ${nPartial.status} ${JSON.stringify(nPartial.json)}`)

    // 零命中：旧版**也给 400**（不是「那条 ❌ 注释」说的 200）
    const lMiss = await legacyUpd('工序6', value, [NO_MATCH])
    const nMiss = await post({ slot: '工序6', value, line_nos: [NO_MATCH] })
    lMiss.code === 400 && nMiss.status === 400
      ? ok('零命中：旧版 code=400 / 新端 400 —— 一致（与 `handler.rs:80` 那张状态码表也对得上）')
      : bad(`零命中不一致：旧版 code=${lMiss.code} / 新端 ${nMiss.status} ${JSON.stringify(nMiss.json)}`)

    // 反向自检：上面两条不能是「什么都算过」——一个**正常**的提交必须两边都 200
    const lOk = await legacyUpd('工序5', value, [target])
    const rOk = await post({ slot: '工序5', value, line_nos: [target] })
    const dOk = rOk.json?.data ?? {}
    lOk.code === 200 && rOk.status === 200 && dOk.updated === 1 && (dOk.failed ?? []).length === 0
      ? ok('反向自检：正常提交两侧都 200 + updated=1 + failed 空')
      : bad(`正常提交异常：旧版 code=${lOk.code} / 新端 ${rOk.status} ${JSON.stringify(rOk.json)}`)

    // 两个都不给 → 400
    const r5 = await post({ slot: '工序4', value })
    r5.status === 400 ? ok('line_ids / line_nos 都不给 → 400') : bad(`都不给：期望 400，实际 ${r5.status}`)
  }

  // ============================ ④ 守卫：推导只许留服务端一份（别在前端加回来）//
  console.log('\n④ 守卫 · 前端 `utils/scanStats.ts` 不许再带这几样（数据不再全量给前端，推不出来也不该推）')
  {
    /*
     * 这几样**都搬到服务端了**（就是上面 ①②③ 打的那两条接口）。
     * 前端再写一份，两处迟早会漂，而**漂了不报错** —— 只是筛出来的行数不一样，
     * 看板上少几个数字，没人会发现。所以这里守着。
     */
    const MOVED = ['matchByScanCode', 'parseScanMarker', 'deriveScanMarker', 'filterScanRows', 'resolveDateLabel']
    const back = MOVED.filter((n) => typeof NEW[n] === 'function')
    back.length
      ? bad(`这些已经搬到服务端了，别在 scanStats.ts 里加回来：${back.join('、')}`)
      : ok(`确认 ${MOVED.length} 个函数都不在前端了：${MOVED.join('、')}`)

    // 反向自检：`NEW` 得**真的**是这个模块（否则「什么都没导出」也会绿）
    typeof NEW.aggregateScanRows === 'function'
      ? ok('反向自检：`aggregateScanRows` 在（说明模块确实加载到了）')
      : bad('取不到 `aggregateScanRows` —— `NEW` 不是 scanStats.ts，上面那条守卫等于没跑')
  }
} finally {
  // ---------------------------------------------------------- 清理一次性数据 //
  if (createdOrderIds.length) {
    const list = createdOrderIds.join(',')
    try {
      psql(`DELETE FROM order_lines WHERE order_id IN (${list}); DELETE FROM orders WHERE id IN (${list});`)
      console.log(`\n（一次性夹具已清理：单 #${list}）`)
    } catch (e) {
      console.error(`\n⚠️ 夹具清理失败，请手工删单 #${list}：${e.message}`)
    }
  }
}

console.log('')
if (fails) {
  console.log(`✗ 有 ${fails} 处不一致`)
  process.exit(1)
}
console.log('✓ 全部一致')
