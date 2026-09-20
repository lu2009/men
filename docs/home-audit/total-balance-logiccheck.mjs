/*
 * 差分台：「总余额显示」开关 + 客户总余额取值（旧版 `showTotalBalance` / `TotalBalance`）。
 *
 *   左 = 旧版**三个打印入口**的 gating 段**原文切出来真的跑**
 *        （Hui `Hui.formatted.js` · Home `Home.formatted.js` · Progress `Progress-f4bdef35.js`）
 *   右 = 我们的**真代码**（`app/src/utils/totalBalance.ts`，靠 node 的类型擦除直接 import）
 *
 * 逐例比「开关 on/off × 客户编号有/无 × 接口各种返回」下**回执表头 `TotalBalance` 该是什么**。
 *
 * ── 为什么是这一格、而不是「电子回执上的一行」 ────────────────────────────────
 * 旧版的「总余额」**只出现在打印出来的回执单上**：它是打印模板字段
 * （`legacy/templates/print-templates-import.json` 的 `receipt` / `FinalReceipt` / `ReceiptList`
 * 三张各有一个 `field:"TotalBalance"`、`title:"总余额"` 的 text 元素），
 * 而电子回执那一族（`ReceiptMobile` / `ReceiptShare` / `ReceiptView` / `receiptBuilder`）
 * 里 `TotalBalance` 出现 **0 次**。详见 `app/src/utils/totalBalance.ts` 的文件头。
 *
 * ── 三个入口的差异（本台子把三条都跑了，不是只跑一条）─────────────────────────
 *   Hui      开关读的是 `Vue.ref`（`_0x2ffe36`，初值 `false`，`onMounted` 从 localStorage 灌一次）
 *   Home     开关**直接读 localStorage**
 *   Progress 开关**直接读 localStorage**
 * ⇒ 「改完开关要不要刷新页面」旧版三条路本来就不一致；我们统一成一个模块，见下方 DEVIATIONS。
 *
 * ── ⛔ 本台子**不发任何真实请求** ─────────────────────────────────────────
 * 旧版 URL 只作为字符串被 inline，`fetch` 全程是注入的桩；全局 `fetch` 还被换成了抛错的断网闸
 * （见下面 `globalThis.fetch`），谁真去发请求立刻红。**不要**把桩去掉。
 *
 * 用法：node docs/home-audit/total-balance-logiccheck.mjs
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { register } from 'node:module'
import {
  HUI,
  matchBracket,
  iifeAt,
  between,
  huiDecoder,
  resolveDecoders,
  deobf,
} from './lib/hui-decode.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 仓库根从**本文件位置**推出（本文件在 `docs/home-audit/` ⇒ 往上**两级**才是仓库根）。
// 原来这里写死的是 `'/Users/aaa/Desktop/door-main'`：本机跑得通，换台机器或进 CI
// （checkout 路径不同）就直接崩。`docs/*.mjs` 那几个台子早就这么写了，差的正是这一层深度。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

// ───────────────────────────────────────────────────────────────────────────
// ⛔ 断网闸：本台子**绝不发任何真实请求**
//
// 旧版那段代码里的 URL（`r(804)` 解出来是 `https://…/1?param1=finance_getCustomerBalance…`）
// 只是被 inlined 成字符串，真正调用的 `fetch` 是**注入的桩**（见 `legacyFetch` / `oursPayload`）。
// 但为了「万一哪次改坏了也出不了网」，这里把全局 `fetch` 换成抛错的 —— 谁真去发请求，
// 本台子立刻红，而不是悄悄连到旧版生产站上去。
//
// ⚠️ 地址口径（2026-09-19 用户更正，别记反）：旧版**当前**地址是 **`www.19901110.xyz`**，
//    那才是「旧版生产站」；`samrtdoor`（拼写就是这个，少个 `t`）是**更早的旧地址**，已废弃。
//    ⇒ 规则是「**不要请求 samrtdoor**」，不是「不要请求旧站」。本台子两处都不请求（用桩），
//    这条注释是为了防止后人把「不许出网」和「不许碰 samrtdoor」混成一条。
// ───────────────────────────────────────────────────────────────────────────
globalThis.fetch = async (url) => {
  throw new Error(`本差分台禁止真实网络请求，但有人调了 fetch(${String(url).slice(0, 80)})`)
}

// ───────────────────────────────────────────────────────────────────────────
// 左：旧版三个入口
// ───────────────────────────────────────────────────────────────────────────

const HOME = readFileSync(`${ROOT}/legacy/js/Home.formatted.js`, 'utf8')
/** 本台子把 Hui 的解码器**当值**传给切出来的旧版函数（`huiInit(storage, ref, huiDec)`）。 */
const huiDec = huiDecoder()

/**
 * 切完必须过的**语义自检**：这段代码得认出这几个关键串（认不出就是段切错 / 解错了）。
 * 比「能编译」强得多 —— 切到隔壁函数一样能编译。
 *
 * 三个入口的**开关读法本来就不一样**（Hui 读 ref、Home/Progress 直接读 localStorage），
 * 所以针脚按入口给，不是一套糊上去。
 */
function assertGatingShape(code, label, needles) {
  for (const needle of needles) {
    if (!code.includes(needle)) throw new Error(`${label}: 解码后缺 ${needle}，切错段了`)
  }
}

/** 取余额那段的公共针脚。 */
const GATING_COMMON = ['"&param3="', '"客户余额"', '"code"', '"data"', '"json"']

/** Home 的 10 张表（由 `legacy/decode-home-map.mjs` 生成；自检 `dr(755)==='value'`）。 */
function homeDecoders() {
  const m = JSON.parse(readFileSync('/tmp/home-map.json', 'utf8'))
  if (m.decoders.dr?.[755] !== 'value') throw new Error('Home 解码表假设不成立：dr(755) ≠ "value"')
  const out = {}
  for (const d of Object.keys(m.decoders)) out[d] = (i) => m.decoders[d][i]
  return out
}

/**
 * Progress：用现成的**带作用域**反混淆产物 `/tmp/progress.decoded.js`。
 * （它的解码器别名按词法作用域解析，全局闭包版是错的 —— 见该脚本头注。）
 * 产物不在就先现生成，保证这台子从零可复现。
 */
function progressDecoded() {
  const OUT = '/tmp/progress.decoded.js'
  try {
    return readFileSync(OUT, 'utf8')
  } catch {
    execFileSync('node', [`${ROOT}/legacy/decode-progress-map.mjs`], { stdio: 'inherit' })
    execFileSync('node', [`${ROOT}/legacy/decode-progress-scoped.mjs`], { stdio: 'inherit' })
    return readFileSync(OUT, 'utf8')
  }
}

/**
 * 切出三个入口的 gating 段并**原样编译成可跑函数**。
 *
 * 各自要注入的自由变量（都是原函数里的东西，本台子只搭作用域、不改逻辑）：
 *   · Hui：`_0x2ffe36`（开关 ref）、`_0x5240d3`（客户编号 ref）、`u`（userinfo 载体）、`localStorage`
 *   · Home：`localStorage`、`fetch`、`w`（userinfo 载体）、`f`（客户编号）
 *   · Progress：`localStorage`、`fetch`、`B`（userinfo 载体）、`y`（客户编号）
 * `o` / `l` / `n` 是原函数里**外层 `var` 提升**的临时变量（切出来的片段只用到赋值），
 * 这里补一句 `var` 声明，语义不变 —— 否则在 sloppy 模式下会落到 globalThis 上跨例串味。
 */
function buildLegacyRunners() {
  const homeTable = homeDecoders()
  const HUI_TABLES = { _0x250a: huiDec }

  // —— Hui ——（片段里 token 走作用域别名 `r(...)`，`r` 最终指向 `_0x250a`）
  const huiRaw = between(HUI, 'let L="";', '_0xcf38c7={', 'Hui')
  const huiCode = deobf(huiRaw, resolveDecoders(huiRaw, HUI_TABLES, 'Hui'), 'Hui')
  // Hui 这段的开关是 **ref**（`_0x2ffe36.value`），localStorage 是在 `_0x1c743a` 里读的。
  assertGatingShape(huiCode, 'Hui', ['_0x2ffe36.value', '_0x5240d3', ...GATING_COMMON])
  // 开关初值那一段（`_0x1c743a`）：`const t=localStorage.getItem("showTotalBalance"); null!==t&&(ref.value = t==="true")`
  const huiInitRaw = between(HUI, '_0x1c743a=()=>{', '},_0x14b5ca=()=>{', 'Hui')
  const huiInitBody = huiInitRaw.replace(/^_0x1c743a=\(\)=>\{/, '')
  const huiInitCode = deobf(huiInitBody, resolveDecoders(huiInitBody, HUI_TABLES, 'Hui:init'), 'Hui:init')
  // 开关写回那一段（`_0x14b5ca`）：`setItem("showTotalBalance", ref.value.toString())` + 提示语。
  const huiWriteRaw = between(HUI, '_0x14b5ca=()=>{', '},_0xa4b9b3=', 'Hui')
  const huiWriteBody = huiWriteRaw.replace(/^_0x14b5ca=\(\)=>\{/, '')
  const huiWriteCode = deobf(huiWriteBody, resolveDecoders(huiWriteBody, HUI_TABLES, 'Hui:write'), 'Hui:write')

  const huiRun = new Function(
    'localStorage',
    'fetch',
    '_0x2ffe36',
    '_0x5240d3',
    'u',
    `var o,c,n,d;return (async()=>{ ${huiCode}\n return L })()`,
  )
  // ⚠️ 这两段**自带 `const e=…,t=…`**，别再补 `var e/t` —— 重名直接 SyntaxError。
  //    `_0x43b0d8` 是页面里 `_0x250a` 的别名（`const _0x43b0d8=_0x3a973c`），token 已被就地替换成字面量，
  //    只剩这句 `const e=_0x43b0d8` 还引用它，所以注入一个同物即可。
  const huiInit = new Function('localStorage', '_0x2ffe36', '_0x43b0d8', huiInitCode)
  const huiWrite = new Function(
    'localStorage',
    '_0x2ffe36',
    '_0x43b0d8',
    'ElementPlus',
    huiWriteCode,
  )

  // —— Home ——
  const homeRaw = between(HOME, 'let D="";', 'wn[t].customerInfo={', 'Home')
  const homeCode = deobf(homeRaw, resolveDecoders(homeRaw, homeTable, 'Home'), 'Home')
  assertGatingShape(homeCode, 'Home', ['"showTotalBalance"', '"true"', ...GATING_COMMON])
  const homeRun = new Function(
    'localStorage',
    'fetch',
    'w',
    'f',
    `var o,l;return (async()=>{ ${homeCode}\n return D })()`,
  )

  // —— Progress ——（已反混淆，无需再替换）
  const progSrc = progressDecoded()
  const progRaw = between(progSrc, 'let x="";', 'te["value"].customerInfo={', 'Progress')
  if (/(?<![.\w$])[A-Za-z_$][\w$]*\(\d+\)/.test(progRaw)) throw new Error('Progress 片段里还有未解 token')
  assertGatingShape(progRaw, 'Progress', ['"showTotalBalance"', '"true"', ...GATING_COMMON])
  const progRun = new Function(
    'localStorage',
    'fetch',
    'B',
    'y',
    `var l,n;return (async()=>{ ${progRaw}\n return x })()`,
  )

  return { huiRun, huiInit, huiWrite, homeRun, progRun }
}

// ───────────────────────────────────────────────────────────────────────────
// 右：我们的真代码
//
// ⚠️ 这里 import 的是**仓库里那一份**，不是抄一遍 —— 抄一遍等于没比。
// 靠 `lib/ts-hooks.mjs` 把 Vite 风格的解析规则补上（见该文件头注）。
// ───────────────────────────────────────────────────────────────────────────
register(new URL('./lib/ts-hooks.mjs', import.meta.url).href)

const ours = await import(`${ROOT}/app/src/utils/totalBalance.ts`)
const { createPrintPayloads } = await import(`${ROOT}/app/src/utils/printPayloads.ts`)
const { loadPrintPrereqs, buildOrderPrintContext } = await import(
  `${ROOT}/app/src/composables/useOrderPrint.ts`
)
const { api } = await import(`${ROOT}/app/src/api/client.ts`)

// ───────────────────────────────────────────────────────────────────────────
// 用例矩阵
// ───────────────────────────────────────────────────────────────────────────

/** `localStorage` 里存了什么（`null` = 没有这条记录）。 */
const STORED = [null, 'true', 'false', '1']
/** 客户编号。 */
const CODES = ['', 'C001']
/** 租户 ds（旧版要非空才发请求；我们没有这个字段 —— 见 DEVIATIONS）。 */
const DS = ['smartdoor', '']
/** 接口返回。`客户余额` 为 `undefined` 表示 `data` 里没这个键。 */
const APIS = [
  { name: 'code=200,余额=880', code: 200, bal: 880 },
  { name: 'code=200,余额=null', code: 200, bal: null },
  { name: 'code=200,余额=0', code: 200, bal: 0 },
  { name: 'code=200,data无该键', code: 200, bal: undefined },
  { name: 'code=500', code: 500, bal: 880 },
  { name: '请求抛异常', throws: true },
]

function fakeStorage(stored) {
  return {
    getItem: (k) => (k === 'showTotalBalance' ? stored : null),
    setItem: () => {},
  }
}

/** 旧版那个 `fetch`：返回 `{ code, data: { 客户余额 } }`。 */
function legacyFetch(api) {
  return async () => {
    if (api.throws) throw new Error('boom')
    return {
      json: async () => {
        const data = api.bal === undefined ? {} : { 客户余额: api.bal }
        return { code: api.code, data }
      },
    }
  }
}

/** 我们的 `api.getCustomerBalance` 等价物：HTTP 层非 2xx 是**抛**（见 `api/client.ts` 的 `request`）。 */
function ourFetcher(api) {
  return async () => {
    if (api.throws) throw new Error('boom')
    if (api.code !== 200) throw new Error(`HTTP ${api.code}`)
    return api.bal === undefined ? null : api.bal
  }
}

const { huiRun, huiInit, huiWrite, homeRun, progRun } = buildLegacyRunners()

/** 跑左：三个入口。返回 `{ hui, home, progress }`（可能抛，由调用方兜）。 */
async function legacyAll(c) {
  const storage = fakeStorage(c.stored)
  const user = { userinfo: { ds: c.ds } }

  const huiRef = { value: false }
  huiInit(storage, huiRef, huiDec) // 旧版 `onMounted` 里那一次灌值
  const hui = await huiRun(storage, legacyFetch(c.api), huiRef, { value: c.code_ }, user)

  const home = await homeRun(storage, legacyFetch(c.api), user, c.code_)
  const progress = await progRun(storage, legacyFetch(c.api), user, c.code_)
  return { hui, home, progress }
}

/**
 * 跑右（**比对 A**）：我们的取值口径 —— `readShowTotalBalance` → `loadTotalBalance`。
 * 这两支都是仓库里的真代码。
 */
async function oursOne(c) {
  const show = ours.readShowTotalBalance(fakeStorage(c.stored))
  return ours.loadTotalBalance(show, c.code_, ourFetcher(c.api))
}

/**
 * 跑右（**比对 B**）：**这一格真的填进回执载荷了吗**。
 *
 * 走的是仓库里那条真链路 —— `loadPrintPrereqs`（真）→ `buildOrderPrintContext`（真）
 * → `createPrintPayloads(...).receiptPrintData()`（真），只把 `api` 的几个方法换成桩。
 * 比对 A 只能说明「取对了值」，比对 B 才说明「那个值真的到了模板要读的那一格」。
 *
 * 桩说明：
 *   · `api.getCustomerBalance` —— 真实现走 `request()`，**HTTP 非 2xx 会抛**（`api/client.ts`），
 *     所以桩在 `code !== 200` 时也抛，口径一致；
 *   · `api.listFormulas` / `listClients` —— 回执不需要，回空数组（真实现挂了也是 `.catch(()=>[])`）；
 *   · `globalThis.localStorage` —— `loadPrintPrereqs` 里 `readShowTotalBalance()` 走**默认参数**
 *     读全局，所以这里必须挂上去（node 没有这个全局，缺了会静默按「关」处理）；
 *   · `idbGetImage` 在 node 里取不到 IndexedDB，它自己 try/catch 成 `null`，不用管；
 *   · 订单的 `lines: []` ⇒ `ensureLineNumbersForPrint` 无事可做，`listFormulaImages` 不会被调。
 */
function makeOrder(c) {
  return {
    id: 1,
    receipt_no: 'R-1',
    client_code: c.code_,
    client_name: '客户',
    brand: '',
    order_date: '2026-09-19',
    production_days: 0,
    deposit: 0,
    remark: '',
    install_address: '',
    phone: '',
    lines: [],
  }
}

async function oursPayload(c) {
  globalThis.localStorage = fakeStorage(c.stored)
  api.listFormulas = async () => []
  api.listClients = async () => []
  api.fillLineNumbers = async () => ({})
  api.listFormulaImages = async () => []
  api.getCustomerBalance = async (code) => ({
    customer_code: code,
    customer_name: '',
    customer_balance: await ourFetcher(c.api)(code),
  })

  const order = makeOrder(c)
  const prereqs = await loadPrintPrereqs([order])
  const ctx = buildOrderPrintContext(order, prereqs, { tenantName: '门店', maker: '张三' })
  return createPrintPayloads(ctx).receiptPrintData('回执单').TotalBalance
}

/** 写开关（**比对 C** 用）：旧版 `_0x14b5ca` 对 `writeShowTotalBalance`。 */
function legacyWrite(on) {
  const store = new Map()
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  }
  huiWrite(storage, { value: on }, huiDec, { ElMessage: { success() {} } })
  return store.get('showTotalBalance')
}

function ourWrite(on) {
  const store = new Map()
  ours.writeShowTotalBalance(on, {
    setItem: (k, v) => store.set(k, v),
  })
  return store.get('showTotalBalance')
}

// ───────────────────────────────────────────────────────────────────────────
// 比对
// ───────────────────────────────────────────────────────────────────────────

/**
 * `ds === ''` 这一轴是**旧版自己内部就不一致**，不是我们算错 —— 单独拎出来按既定形状断言。
 *
 * 三条路对 `ds` 的处理**逐字不同**（已从切出来的源码确认，不是推测）：
 *   · Hui      `const e=u["userinfo"].ds, t=await fetch(URL+encodeURIComponent(e)+"&param3="+…)`
 *              —— **不判空，照发**（URL 里 `param2=` 空着）；
 *   · Home     `const e=…w["userinfo"]…ds; if(e){ … }` —— 空就**压根不发**；
 *   · Progress 与 Home 同形（`if(e)`）。
 *
 * 我们这边没有 `ds` 概念（新后端是单租户上下文，旧版 `docs/2026-09-10-template-field-audit.md`
 * 已记：`ds` 该落成 `tenants` 列）⇒ 我们的行为**等同 Hui 那支**（照常取值）。
 *
 * 所以这一轴不是「放行」，而是**按已知形状断言**：`home === progress === ''` 且 `我们 === hui`。
 * 形状对不上照样红灯 —— 不许拿它当免死金牌。
 * 正常登录态 `ds` 恒非空，这条轴在真实使用中不出现。
 */
function isKnownDeviation(c) {
  return c.ds === ''
}

let total = 0
let pass = 0
const failures = []
const deviationHits = []
/** 比对 B（载荷那一格）只在 `ds` 非空、且旧版三入口一致的组合上做 —— 口径不同的组合比不出东西。 */
let payloadCases = 0
let payloadPass = 0
/** 比对 B 的逐例结果，变异测试要用。 */
const payloadPairs = []

for (const stored of STORED) {
  for (const code_ of CODES) {
    for (const ds of DS) {
      for (const api of APIS) {
        const c = { stored, code_, ds, api }
        total++
        const L = await legacyAll(c)
        const mine = await oursOne(c)
        const label = `stored=${JSON.stringify(stored)} 编号=${JSON.stringify(code_)} ds=${JSON.stringify(ds)} api=${api.name}`
        const shown = `hui=${JSON.stringify(L.hui)} home=${JSON.stringify(L.home)} progress=${JSON.stringify(L.progress)} 我们=${JSON.stringify(mine)}`

        if (isKnownDeviation(c)) {
          const ok = L.home === '' && L.progress === '' && mine === L.hui
          if (ok) deviationHits.push(label)
          else failures.push({ c, why: `${label} → 已知偏离形状对不上（应为 home=progress=""、我们=hui）：${shown}` })
          continue
        }

        // 其余所有组合：三个旧版入口**必须互相一致**，且**必须等于我们**。
        if (L.hui !== L.home || L.home !== L.progress) {
          failures.push({ c, why: `${label} → 旧版三个入口互不一致: ${shown}` })
          continue
        }
        if (L.hui !== mine) {
          failures.push({ c, why: `${label} → 旧版≠我们: ${shown}` })
          continue
        }

        // —— 比对 B：同一例再走一遍真链路，看那**一格**是不是真的填上了 ——
        payloadCases++
        let got
        try {
          got = await oursPayload(c)
        } catch (e) {
          failures.push({ c, why: `${label} → 真链路抛了：${e.message}` })
          continue
        }
        if (got !== L.hui) {
          failures.push({
            c,
            why: `${label} → 载荷里 TotalBalance=${JSON.stringify(got)} ≠ 旧版 L=${JSON.stringify(L.hui)}`,
          })
          continue
        }
        payloadPairs.push({ label, legacy: L.hui, got })
        payloadPass++
        pass++
      }
    }
  }
}

// —— 比对 C：开关写回（旧版 `_0x14b5ca` vs `writeShowTotalBalance`）——
const writeFailures = []
// 先把锚钉住：切出来的旧版那段**真的写了**才算数 —— 否则两边都是 `undefined` 也会「相等」。
if (legacyWrite(true) !== 'true' || legacyWrite(false) !== 'false') {
  throw new Error('旧版 `_0x14b5ca` 切出来没写对 localStorage —— 比对 C 会假绿，先修切片')
}
for (const on of [true, false]) {
  const a = legacyWrite(on)
  const b = ourWrite(on)
  if (a !== b) writeFailures.push(`开关=${on} → 旧版写 ${JSON.stringify(a)}，我们写 ${JSON.stringify(b)}`)
}

// ───────────────────────────────────────────────────────────────────────────
// 变异测试：这台子**得能红**，否则绿灯不算数
// ───────────────────────────────────────────────────────────────────────────
const MUTANTS = [
  { name: '忽略开关，一律取值', fn: async (c) => ours.loadTotalBalance(true, c.code_, ourFetcher(c.api)) },
  { name: '忽略客户编号空', fn: async (c) => ours.loadTotalBalance(ours.readShowTotalBalance(fakeStorage(c.stored)), c.code_ || 'X', ourFetcher(c.api)) },
  { name: '非 200 也当成功', fn: async (c) => ours.loadTotalBalance(ours.readShowTotalBalance(fakeStorage(c.stored)), c.code_, async () => (c.api.throws ? (() => { throw new Error('boom') })() : c.api.bal ?? null)) },
  { name: 'null 当 0', fn: async (c) => ours.loadTotalBalance(ours.readShowTotalBalance(fakeStorage(c.stored)), c.code_, async () => (c.api.code === 200 ? (c.api.bal === undefined ? null : c.api.bal ?? 0) : (() => { throw new Error('HTTP') })())) },
  { name: '用「总价-定金」冒充（旧版早期误判）', fn: async () => '999' },
]

const mutantResults = []
for (const m of MUTANTS) {
  let caught = 0
  let ran = 0
  for (const stored of STORED) {
    for (const code_ of CODES) {
      for (const ds of DS) {
        for (const api of APIS) {
          const c = { stored, code_, ds, api }
          if (isKnownDeviation(c)) continue
          ran++
          let L
          try {
            L = (await legacyAll(c)).hui
          } catch {
            continue
          }
          let got
          try {
            got = await m.fn(c)
          } catch {
            got = '<threw>'
          }
          if (got !== L) caught++
        }
      }
    }
  }
  mutantResults.push({ name: m.name, caught, ran })
}

/**
 * 比对 B 也得能红。这里不是改我们的代码，而是把**真载荷里那一格**按两种常见的写错方式
 * 变一下，看 B 那台比较器认不认得出 —— 尤其是 `0` 被 `||` 吞掉这一类
 * （旧版 `??` 只挡 null/undefined，`0` 是值）。
 */
const PAYLOAD_MUTANTS = [
  { name: '[B] TotalBalance 写成 `|| ""`（余额 0 被吞成空）', fn: (v) => v || '' },
  { name: '[B] 模板字段名写错（那一格永远取不到）', fn: () => undefined },
]
for (const m of PAYLOAD_MUTANTS) {
  const caught = payloadPairs.filter((p) => m.fn(p.got) !== p.legacy).length
  mutantResults.push({ name: m.name, caught, ran: payloadPairs.length })
}

// ───────────────────────────────────────────────────────────────────────────
// 输出
// ───────────────────────────────────────────────────────────────────────────
console.log(`\n=== 「总余额显示」差分台 ===`)
console.log(
  `比对 A（取值口径）用例 ${total} 条：一致 ${pass} 条 · 已知偏离放行 ${deviationHits.length} 条 · 不一致 ${failures.length} 条`,
)
console.log(
  `比对 B（真链路→回执载荷 TotalBalance 那一格）${payloadPass}/${payloadCases} 条一致` +
    `（只在不含已知偏离的组合上做）`,
)
console.log(
  `比对 C（开关写回 localStorage）${writeFailures.length === 0 ? '2/2 一致' : '不一致'}`,
)

if (deviationHits.length) {
  console.log(
    `\n-- 已知偏离（ds 为空：旧版 Hui 不判空照发、Home/Progress 判空不发 ⇒ 旧版自己三入口不一致；` +
      `我们没有 ds 概念，行为等同 Hui）${deviationHits.length} 条，已按既定形状断言 --`,
  )
  for (const d of deviationHits.slice(0, 3)) console.log(`   ${d}`)
  if (deviationHits.length > 3) console.log(`   …其余 ${deviationHits.length - 3} 条同类`)
}

if (writeFailures.length) {
  console.log(`\n❌ 开关写回不一致：`)
  for (const w of writeFailures) console.log(`   ${w}`)
}

if (failures.length) {
  console.log(`\n❌ 不一致：`)
  for (const f of failures.slice(0, 20)) console.log(`   ${f.why}`)
  if (failures.length > 20) console.log(`   …其余 ${failures.length - 20} 条`)
}

console.log(`\n-- 变异测试（每个变异体都**必须**被抓到）--`)
let mutantsAllCaught = true
for (const r of mutantResults) {
  const ok = r.caught > 0
  if (!ok) mutantsAllCaught = false
  console.log(`   ${ok ? '✓' : '✗'} ${r.name} —— 抓到 ${r.caught}/${r.ran} 例`)
}

const ok = failures.length === 0 && writeFailures.length === 0 && mutantsAllCaught
console.log(`\n${ok ? '✅ 通过' : '❌ 未通过'}\n`)
process.exit(ok ? 0 : 1)
