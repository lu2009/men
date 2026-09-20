/*
 * 差分台：「导入上次订单」这条流程（提示语 / 确认框 / 分支 / 写入口）。
 *
 *   左 = 旧版 `Hui.formatted.js:8899-8925` 那个 `importLastOrder` 的**整段声明切出来真跑**
 *        （`ElementPlus.ElMessage(*)` / `ElMessageBox.confirm` / `localStorage` / `Vue.nextTick`
 *         全换成记录器 —— 不需要 Element Plus、不需要浏览器）
 *   右 = 仓库里那一份 `app/src/utils/lastOrder.ts`（**真 import，不是抄一遍**）
 *
 * ── 为什么要这台子 ────────────────────────────────────────────────────────
 * 用户 2026-09-19 报：「每次刷新页面都会自动恢复上次订单」。
 * 根因不是这颗按钮，而是**我们自造的一整套「实时草稿 + onMounted 无条件恢复」**——
 * 旧版那个键只有两处（`H:8853` 保存成功时**写**、`H:8903` 导入时**读**），
 * `onMounted`（`H:8261-8264`）里连碰都没碰。修的时候顺手把这颗按钮也照旧版对齐了
 * （旧版是 `warning`「没有找到上次保存的订单数据」+ 确认框，我们是 `info`「没有可导入的上次订单」），
 * 所以这里把「文案与分支」钉成可执行断言，免得下次又被顺手改掉。
 *
 * ── 比什么 ───────────────────────────────────────────────────────────────
 *   ① 没存过 → 旧版 `ElMessage.warning(…)`，我们 `io.warning(…)`，**文案逐字比**；
 *   ② 有数据 → 旧版 `ElMessageBox.confirm(正文, 标题, {confirmButtonText, cancelButtonText, type})`，
 *      我们 `io.confirm({title, content, positiveText, negativeText})`，**四处文案逐字比**；
 *   ③ **确认之前**两边都**不许**动过数据（确认框是**异步**的 —— 这一条得在 resolve 之前查，
 *      所以两边都做成「跑到 `await confirm` 就停住」的两段式）；
 *   ④ 确认后 → 旧版落 12 个表单字段 + 两个显隐 + 整表 splice + `success(…)`；
 *      我们 `apply(snap)` + `success(…)`，**success 文案逐字比**，且 `apply` 恰好调一次；
 *   ⑤ 取消 → 两边都**什么都不做**（旧版靠拒绝值 `'cancel'` 静默返回；
 *      naive 的 `dialog` 不调 `onPositiveClick` ⇒ 语义等价，见 `lastOrder.ts` 的注释）；
 *   ⑥ 存的是坏 JSON → 两边都是 `error('导入订单数据失败')`；
 *   ⑦ 键名必须是 `smartdoor_last_order`（旧版：字面量写一次 + token 读一次，见 ⑥）。
 *
 * ⚠️ **不比**字段映射：旧版存的是**整单载荷**（`customerInfo` 里是「客户/客户编号/电话/…」
 *    这些中文键），我们存的是自己的 `{header, lines, showPing, showDiao, savedAt}`。
 *    形状本来就不同（我们的订单模型是自己那套），所以只比**流程与文案**，
 *    字段映射由 `Hui.vue` 里的 `applyLastOrder` 负责，不在本台子范围。
 *
 * ── 断网 ─────────────────────────────────────────────────────────────────
 * 本台子只读本地文件。`fetch` 被换成抛错的断网闸 —— 规则是「**不要请求 samrtdoor**」
 * （那是旧版的**旧**地址，当前地址是 `www.19901110.xyz`），不是「不许出网」；这里两样都不做。
 *
 * 用法：node docs/home-audit/last-order-logiccheck.mjs
 */
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { HUI, matchBracket, huiDecoder, resolveDecoders, deobf, balanced } from './lib/hui-decode.mjs'
// 配平法切片 —— 与两个搬迁守卫**同一个** `sliceFn`。2026-09-20 终审修复轮：见下面 ⑧ 的说明。
import { sliceFn } from './lib/extract-movecheck-core.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 仓库根从**本文件位置**推出（本文件在 `docs/home-audit/` ⇒ 往上**两级**才是仓库根）。
// 原来这里写死的是 `'/Users/aaa/Desktop/door-main'`：本机跑得通，换台机器或进 CI
// （checkout 路径不同）就直接崩。`docs/*.mjs` 那几个台子早就这么写了，差的正是这一层深度。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

// ───────────────────────────────────────────────────────────────────────────
// ⛔ 断网闸：本台子只读本地文件，谁真去发请求立刻红。
// ───────────────────────────────────────────────────────────────────────────
globalThis.fetch = async (url) => {
  throw new Error(`本差分台禁止真实网络请求，但有人调了 fetch(${String(url).slice(0, 80)})`)
}

const HUI_TABLES = { _0x250a: huiDecoder() }

const LEGACY_KEY = 'smartdoor_last_order'

// ───────────────────────────────────────────────────────────────────────────
// 左：切出旧版 `importLastOrder` 的整段声明，真跑
// ───────────────────────────────────────────────────────────────────────────

/** 切 `importLastOrder=async()=>{…}` —— **连 `importLastOrder=async()=>` 一起切**。
 *  只取 `{…}` 会切出一个块语句（`await` 在非 async 上下文里直接语法错）。 */
function legacyImportDecl() {
  const at = HUI.indexOf('importLastOrder=async()=>{')
  if (at < 0) throw new Error('找不到旧版 importLastOrder')
  const open = HUI.indexOf('{', at)
  return HUI.slice(at, matchBracket(HUI, open) + 1)
}

/**
 * 跑旧版 `importLastOrder` —— **两段式**：跑到 `await ElMessageBox.confirm` 就停住，
 * 等调用方 `settle()` 再走完。这样才能真的观察到「确认之前」的状态。
 *
 * 注入的全是**记录器**：`ElementPlus.ElMessage.*` / `ElMessageBox.confirm` /
 * `localStorage` / `Vue.nextTick` / 那一堆表单 ref 和两个表格 ref。
 */
function runLegacy({ raw, confirmAction = 'ok' }) {
  const decl = legacyImportDecl()
  const code = deobf(decl, resolveDecoders(decl, HUI_TABLES, 'importLastOrder'), 'importLastOrder')

  const calls = []
  const store = new Map()
  if (raw !== undefined) store.set(LEGACY_KEY, raw)

  const ref = (v) => ({ value: v })
  // 旧版往这些 ref 上落 customerInfo 的 12 个字段 + 两个显隐
  const fields = {
    _0x340df0: ref(''), // 客户
    _0x5240d3: ref(0), //  客户编号
    _0x546bb0: ref(0), //  电话
    _0x5220a4: ref(''), // 品牌
    _0x2bcafc: ref(0), //  生产天数
    _0x48f822: ref(''), // 回执单号
    _0x3c4d97: ref(0), //  定金
    _0x2f1634: ref(''), // 订单备注
    _0x4fc122: ref(''), // 业务员
    _0xa53a8d: ref(''), // 打单人
    _0x27e38a: ref(''), // 地址
    _0x184c0c: ref(new Date('2000-01-01')), // 日期
    _0x515a7c: ref(false), // showPingkai
    _0xcf05a4: ref(false), // showDiao
  }
  const pingTable = { tableData: [] }
  const diaoTable = { tableData: [] }

  // 把 `confirm` 的兑现**捏在手里**，好让调用方在两段之间查状态
  let releaseConfirm = null
  const confirmGate = new Promise((res, rej) => {
    releaseConfirm = { res, rej }
  })

  const fn = new Function(
    // 解码器别名（`const _=_0x43b0d8;` 那句在 deobf 之后还在，只是没人用了）
    '_0x43b0d8',
    'localStorage',
    'ElementPlus',
    'Vue',
    // 「生产天数」的默认值函数（`H:8141`）—— 只要是个可调用的就行，取值不参与比对
    '_0x132ba2',
    // 两个表格组件的 ref（`H:8242`）
    '_0x23e965',
    '_0x1be4d9',
    ...Object.keys(fields),
    `return (async()=>{ ${code}; await importLastOrder() })()`,
  )

  const done = fn(
    null,
    {
      getItem: (k) => {
        const v = store.has(k) ? store.get(k) : null
        calls.push(['getItem', k])
        return v
      },
      setItem: (k, v) => {
        calls.push(['setItem', k])
        store.set(k, v)
      },
    },
    {
      ElMessage: {
        warning: (m) => calls.push(['warning', m]),
        success: (m) => calls.push(['success', m]),
        error: (m) => calls.push(['error', m]),
      },
      ElMessageBox: {
        confirm: (content, title, opts) => {
          calls.push([
            'confirm',
            content,
            title,
            opts.confirmButtonText,
            opts.cancelButtonText,
            opts.type,
          ])
          // 旧版判的是**拒绝值** `'cancel'`（`o === _(865)`）；这里如实模拟
          if (confirmAction === 'cancel') releaseConfirm.rej('cancel')
          if (confirmAction === 'other-error') releaseConfirm.rej(new Error('boom'))
          return confirmGate
        },
      },
    },
    { nextTick: () => Promise.resolve() },
    () => 7,
    { value: pingTable },
    { value: diaoTable },
    ...Object.values(fields),
  )

  return {
    calls,
    fields,
    pingTable,
    diaoTable,
    /** 让 `confirm` 兑现（没走到 confirm 时是个空操作）。 */
    settle: () => releaseConfirm?.res(),
    /** 整个函数走完。 */
    done: done.catch((e) => {
      throw e
    }),
    /** 等一拍，让函数跑到 `await confirm`（或直接跑完）。 */
    settleMicrotasks: () => new Promise((r) => setTimeout(r, 0)),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 右：仓库里那一份（真 import）
// ───────────────────────────────────────────────────────────────────────────
// 与 `total-balance-logiccheck.mjs` 同一套 hooks：让 node 直接 import 仓库里的 `.ts`
// （Vite 风格的「无扩展名相对导入」+ `import.meta.env` 垫片，见 `lib/ts-hooks.mjs` 头注）。
register(new URL('./lib/ts-hooks.mjs', import.meta.url).href)
const ours = await import(`${ROOT}/app/src/utils/lastOrder.ts`)

/** 跑我们的 `importLastOrder`，同样两段式（`onPositiveClick` 捏在手里）。 */
function runOurs({ raw, confirmAction = 'ok' }) {
  const calls = []
  const store = new Map()
  if (raw !== undefined) store.set(ours.LAST_ORDER_KEY, raw)
  const applied = []
  let positive = null
  ours.importLastOrder(
    {
      storage: {
        getItem: (k) => {
          calls.push(['getItem', k])
          return store.has(k) ? store.get(k) : null
        },
        setItem: (k, v) => {
          calls.push(['setItem', k])
          store.set(k, v)
        },
      },
      warning: (m) => calls.push(['warning', m]),
      success: (m) => calls.push(['success', m]),
      error: (m) => calls.push(['error', m]),
      confirm: (o) => {
        calls.push([
          'confirm',
          o.content,
          o.title,
          o.positiveText,
          o.negativeText,
          // 旧版那个 `type:'warning'`，在 naive 这边是 **`dialog.warning` 这个函数名本身**
          'warning',
        ])
        positive = o.onPositiveClick
      },
    },
    (snap) => applied.push(snap),
  )
  return {
    calls,
    applied,
    // naive 的 dialog 只有点了确认才回调；取消 = 不调
    settle: () => {
      if (confirmAction === 'ok' && positive) positive()
    },
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 比对
// ───────────────────────────────────────────────────────────────────────────
const failures = []
const cmp = (label, want, got) => {
  const a = JSON.stringify(want)
  const b = JSON.stringify(got)
  if (a !== b) failures.push(`${label}\n      旧版 ${a}\n      我们 ${b}`)
}

// ⚠️ 两边喂的**不是同一坨 JSON** —— 存的东西形状本来就不同（见文件头「不比字段映射」）：
//    旧版存整单载荷（中文键的 `customerInfo` + `ping_hui` / `diao_hui`），
//    我们存 `{header, lines, showPing, showDiao, savedAt}`。
//    但 **`savedAt` 必须相同** —— 确认框正文里的时间是它渲染出来的，比的就是那一句。
const SAVED_AT = 1735689600000 // 2025-01-01T00:00:00Z（**固定值** ⇒ 两边同机同时区必然一致）
const SAMPLE_LEGACY = JSON.stringify({
  customerInfo: { 客户: '昊艺门窗', 回执单号: 'A-1' },
  ping_hui: [{ a: 1 }],
  diao_hui: [{ b: 2 }],
  showPingkai: true,
  showDiao: true,
  savedAt: SAVED_AT,
})
const SAMPLE_OURS = JSON.stringify({
  header: { client_name: '昊艺门窗', receipt_no: 'A-1' },
  lines: [{ a: 1 }],
  showPing: true,
  showDiao: true,
  savedAt: SAVED_AT,
})

// ① 没存过 —— 两边都不该弹确认框，都该 warning，且文案逐字相同
{
  const L = runLegacy({ raw: undefined })
  await L.settleMicrotasks()
  const O = runOurs({ raw: undefined })
  if (O.calls.some((c) => c[0] === 'confirm')) throw new Error('没存过不该弹确认框')
  cmp('没存过 · 调用序列', L.calls, O.calls)
  // 除读键之外，**唯一**的对外动作就是那句 warning（不是 info）
  cmp('没存过 · 唯一提示是 warning', ['warning'], L.calls.filter((c) => c[0] !== 'getItem').map((c) => c[0]))
  await L.done
}

// ② 有数据 —— 确认**之前**两边都不许动数据；确认**之后**两边都落地 + success
{
  const L = runLegacy({ raw: SAMPLE_LEGACY })
  await L.settleMicrotasks()
  const O = runOurs({ raw: SAMPLE_OURS })

  cmp('有数据 · 确认前的调用序列', L.calls, O.calls)
  // —— 确认之前：旧版只读了键、只弹了框，一个字段都没落
  cmp('确认前 · 旧版不该动过表单字段', ['getItem', 'confirm'], L.calls.map((c) => c[0]))
  if (O.applied.length !== 0) throw new Error('确认**之前**不该已经应用了数据')
  // 旧版：确认前两表也不许被改
  cmp('确认前 · 旧版两表行数', [0, 0], [L.pingTable.tableData.length, L.diaoTable.tableData.length])

  // —— 点「确认导入」
  L.settle()
  O.settle()
  await L.done

  cmp(
    '有数据 · 确认后的完整调用序列',
    L.calls,
    O.calls,
  )
  if (O.applied.length !== 1) throw new Error(`确认之后应恰好应用 1 次，实得 ${O.applied.length}`)
  // 旧版落地：12 个表单字段（`|| 默认`）+ 两个显隐 + 两表整表替换
  cmp(
    '旧版确认后 · 落到哪儿',
    {
      _0x340df0: '昊艺门窗', // 客户
      _0x5240d3: 0, //         客户编号（数据里没有 ⇒ 0）
      _0x48f822: 'A-1', //      回执单号
      _0x515a7c: true, //       showPingkai
      _0xcf05a4: true, //       showDiao
      pingRows: 1,
      diaoRows: 1,
    },
    {
      _0x340df0: L.fields._0x340df0.value,
      _0x5240d3: L.fields._0x5240d3.value,
      _0x48f822: L.fields._0x48f822.value,
      _0x515a7c: L.fields._0x515a7c.value,
      _0xcf05a4: L.fields._0xcf05a4.value,
      pingRows: L.pingTable.tableData.length,
      diaoRows: L.diaoTable.tableData.length,
    },
  )
  // 我们那边：应用到的快照必须带着 header / lines / 两个显隐
  const snap = O.applied[0]
  if (!snap || !snap.header || !Array.isArray(snap.lines)) {
    throw new Error(`我们应用到的快照形状不对：${JSON.stringify(snap)?.slice(0, 120)}`)
  }
}

// ③ 取消 —— 两边都什么都不做
{
  const L = runLegacy({ raw: SAMPLE_LEGACY, confirmAction: 'cancel' })
  await L.settleMicrotasks()
  L.settle() // 取消时 `settle()` 走的是 rej 分支（在 confirm 里已经 reject 了）
  await L.done
  const O = runOurs({ raw: SAMPLE_OURS, confirmAction: 'cancel' })
  O.settle()
  if (O.applied.length !== 0) throw new Error('取消之后不该应用数据')
  const tail = (calls) => calls.filter((c) => c[0] !== 'getItem' && c[0] !== 'confirm')
  cmp('取消后 · 旧版不该有任何提示', [], tail(L.calls))
  cmp('取消后 · 我们不该有任何提示', [], tail(O.calls))
  cmp('取消后 · 旧版两表没被改', [0, 0], [L.pingTable.tableData.length, L.diaoTable.tableData.length])
}

// ④ 坏 JSON —— 两边都走 error('导入订单数据失败')
{
  const L = runLegacy({ raw: '{不是 json' })
  await L.settleMicrotasks()
  await L.done
  const O = runOurs({ raw: '{不是 json' })
  O.settle()
  cmp('坏 JSON · 调用序列', L.calls, O.calls)
  cmp('坏 JSON · 唯一提示是 error', ['error'], L.calls.filter((c) => c[0] !== 'getItem').map((c) => c[0]))
  if (O.applied.length !== 0) throw new Error('坏 JSON 之后不该应用数据')
}

// ⑤ 提示语必须是这三条原文（逐字）—— 上面对比已经覆盖，这里再单独钉一次，
//    免得将来「比对逻辑」本身被改坏之后整批放行。
{
  cmp('空数据文案', '没有找到上次保存的订单数据', ours.LAST_ORDER_EMPTY_MSG)
  cmp('成功文案', '上次订单数据已导入', ours.LAST_ORDER_OK_MSG)
  cmp('失败文案', '导入订单数据失败', ours.LAST_ORDER_ERROR_MSG)
  cmp('确认框标题', '导入上次订单', ours.LAST_ORDER_CONFIRM_TITLE)
  cmp('确认框按钮', ['确认导入', '取消'], [
    ours.LAST_ORDER_CONFIRM_OK,
    ours.LAST_ORDER_CONFIRM_CANCEL,
  ])
  cmp('确认框正文', '将导入 2025/1/1 00:00:00 保存的订单数据，当前数据将被覆盖，是否继续？'.replace(
    '2025/1/1 00:00:00',
    new Date(SAVED_AT).toLocaleString(),
  ), ours.lastOrderConfirmText(SAVED_AT))
  cmp('没有 savedAt 时的兜底', '未知时间', ours.lastOrderSavedAtText(undefined))
}

// ⑥ 键名 + 旧版全文件只出现两次（一次写、一次读）
{
  cmp('键名', LEGACY_KEY, ours.LAST_ORDER_KEY)
  const src = readFileSync(`${ROOT}/legacy/js/Hui.formatted.js`, 'utf8')
  const dec = huiDecoder()
  // ⚠️ 这个键在旧版里**一处是字面量、一处是 token**（别用 `grep` 数出来的「2 行」当依据）：
  //    · 写 `H:8853`：`localStorage[r(663)]("smartdoor_last_order", …)` —— 键是**字面量**，方法名是 token；
  //    · 读 `H:8903`：`localStorage[_(991)](_(1102))` —— **键也是 token**（`_(1102)`）。
  //    所以「字面量出现 1 次」才对；判定要用解码器。
  const hits = [...src.matchAll(/smartdoor_last_order/g)]
  cmp('旧版字面量出现次数', 1, hits.length)
  const head = src.slice(Math.max(0, hits[0].index - 60), hits[0].index)
  const mm = head.match(/localStorage\[([A-Za-z_$][\w$]*)\((\d+)\)\]\("$/)
  if (!mm) throw new Error(`旧版写入处的形态变了：${JSON.stringify(head)}`)
  cmp('旧版那一处是「写」', 'setItem', dec(Number(mm[2])))
  cmp('读入口的键 token', LEGACY_KEY, dec(1102))
  // 读入口形态：`localStorage[<alias>(991)](<alias>(1102))`
  if (!/localStorage\[[A-Za-z_$][\w$]*\(991\)\]\([A-Za-z_$][\w$]*\(1102\)\)/.test(src)) {
    throw new Error('旧版读入口（`localStorage[_(991)](_(1102))`）形态变了')
  }
  cmp('读入口那个方法 token', 'getItem', dec(991))
}

// ⑦ 我们这边：**不许**再有「页面加载时自动恢复」那套
{
  const vue = readFileSync(`${ROOT}/app/src/views/Hui.vue`, 'utf8')
  for (const banned of ['restoreDraft', 'hui_order_draft_v1', '已恢复上次未保存的订单', 'persistDraft']) {
    if (vue.includes(banned)) {
      throw new Error(`Hui.vue 里还留着「自动恢复草稿」那套的痕迹：${banned}`)
    }
  }
  // `onMounted` 里不能再碰「上次订单」
  const at = vue.indexOf('onMounted(async () => {')
  if (at < 0) throw new Error('Hui.vue 里找不到 onMounted')
  /*
   * ⚠️ **2026-09-20 终审修复轮：与上面 ⑧ 一起换成配平法 —— 同一颗雷，同一页里别留两种切法。**
   *
   * 原来这里是 `vue.slice(at, vue.indexOf('\n})', at))`，与 ⑧ 的 `'\n}\n'` 同族：
   * **锚的是「列 0 的收尾」**。`onMounted` 今天在 `Hui.vue` **顶层**，那个 `'\n})'`
   * 正好落在它自己的收尾上 ⇒ **今天是对的**（实测：旧切法 1277 字符 / 配平法 1271，
   * 差的只是末尾那个 `})` —— 对下面这条判定的**结论无影响**，两者都不命中那四个词）。
   * 但 `onMounted` 哪天被挪进 `setup()`、或前面出现别的 `'\n})'`，终止符就会**解析到别处**：
   *   · 落在**里面**⇒ 切短 ⇒ **下面这条是「不该出现」的否定断言**，切短了就看不见后面的内容
   *     ⇒ **假绿**（最危险的方向：那句话本来就是「确认没写回去」）；
   *   · 干脆找不到（`-1`）⇒ `slice(at, -1)` 一路切到 EOF ⇒ 切长 ⇒ 只会**吵**（误报红），不假绿。
   * ⇒ 换 `balanced()`（`matchBracket` 配平，且能吃字符串 / 注释 / 正则字面量）。
   * **判据（下面那条正则）一字未动**，只换被检文本的来路 —— 加固，不是放宽。
   */
  const body = balanced(vue, vue.indexOf('(', at))
  if (/persistLastOrder|writeLastOrder|restoreLastOrder|importLastOrder/.test(body)) {
    throw new Error('onMounted 里出现了「上次订单」的读写 —— 旧版加载时什么都不恢复')
  }
}

// ⑧ 写入口的位置：旧版写在**「3.保存回执单」**里（`H:8853` 那段紧挨着 POST 那一段），
//    我们必须在 `saveOrder` 里写、而且**只在那儿**写（别又在哪个 watch 里落盘回去）。
{
  const vue = readFileSync(`${ROOT}/app/src/views/Hui.vue`, 'utf8')
  if (!vue.includes('async function saveOrder(')) throw new Error('Hui.vue 里找不到 saveOrder')
  /*
   * ⚠️ **2026-09-20 终审修复轮：切片器从 `indexOf('\n}\n')` 换成配平法（`sliceFn`）。**
   *
   * `'\n}\n'` **只能匹配「列 0 的收尾括号」**。`saveOrder` 今天还在 `Hui.vue` 顶层，
   * 那个终止符正好落在它自己的收尾上 ⇒ **今天没坏**（实测：切到 2395 字符 vs 完整 2403，
   * 少的只是收尾那个 `}` —— 对 `includes` 判定无影响）。
   * 但**它哪天被抽出 `Hui.vue`，就会静默变成** `hui-settings-dialogs-logiccheck.mjs`
   * 刚刚修掉的那种假绿：函数搬进工厂后收尾是 `'\n  }\n'`，终止符会**穿过函数自己的收尾**、
   * 命中**外层工厂的**收尾 ⇒ haystack 一路多切进工厂的 `return {…}`。
   * ⇒ 那两处是**同一个雷**（本轮一起换掉），不是两个独立缺陷。
   *
   * **断言一字未动**（下面 `persistLastOrder()` 与「全页调用次数 = 1」两条判据原样保留），
   * 只换被检文本的**来路** —— 这是**加固**，不是放宽。
   */
  const body = sliceFn(vue, 'saveOrder')
  if (!body.includes('persistLastOrder()')) {
    throw new Error('saveOrder 里没有写「上次订单」—— 旧版就是保存成功那一刻写的')
  }
  // ⚠️ 要排除**函数声明**本身（`function persistLastOrder() {` 也匹配 `persistLastOrder()`）
  const allCalls = [...vue.matchAll(/(?<!function )\bpersistLastOrder\(\)/g)]
  cmp('全页调用 persistLastOrder 的次数', 1, allCalls.length)
  // 页面上**不该**再有任何去抖/监听式的落盘（那正是被删掉的那套）
  if (/\bwatch\s*\(/.test(vue)) {
    throw new Error('Hui.vue 里又出现了 `watch(` —— 确认不是又把「编辑中就落盘」加回来了')
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 变异测试：把「我们」故意改坏，每个变异体都**必须**被抓到
// ───────────────────────────────────────────────────────────────────────────
const MUTANTS = [
  ['把 warning 换成 info（旧版就是 warning）', (c) => c.map((x) => (x[0] === 'warning' ? ['info', ...x.slice(1)] : x))],
  ['空数据文案改成「没有可导入的上次订单」', (c) => c.map((x) => (x[0] === 'warning' ? ['warning', '没有可导入的上次订单'] : x))],
  ['确认框标题写成「导入订单」', (c) => c.map((x) => (x[0] === 'confirm' ? [x[0], x[1], '导入订单', ...x.slice(3)] : x))],
  ['确认按钮写成「确定」', (c) => c.map((x) => (x[0] === 'confirm' ? [x[0], x[1], x[2], '确定', ...x.slice(4)] : x))],
  ['取消按钮写成「否」', (c) => c.map((x) => (x[0] === 'confirm' ? [x[0], x[1], x[2], x[3], '否', x[5]] : x))],
  ['正文少了「，当前数据将被覆盖」', (c) => c.map((x) => (x[0] === 'confirm' ? [x[0], String(x[1]).replace('，当前数据将被覆盖', ''), ...x.slice(2)] : x))],
  ['正文的时间没走 toLocaleString', (c) => c.map((x) => (x[0] === 'confirm' ? [x[0], String(x[1]).replace(/\d/, 'X'), ...x.slice(2)] : x))],
  ['成功提示改成「已导入上次订单」', (c) => c.map((x) => (x[0] === 'success' ? ['success', '已导入上次订单'] : x))],
  ['失败提示改成「导入失败」', (c) => c.map((x) => (x[0] === 'error' ? ['error', '导入失败'] : x))],
  ['没存过也弹确认框', (c) => [...c, ['confirm', 'x', 'y', 'z', 'w', 'warning']]],
  ['键名换成 hui_order_draft_v1', (c) => c.map((x) => (x[1] === LEGACY_KEY ? [x[0], 'hui_order_draft_v1'] : x))],
]

/**
 * 把四个场景（没存过 / 有数据+确认 / 取消 / 坏 JSON）的调用**连起来**记一份。
 *
 * ⚠️ 变异测试必须拿这份**全场景**日志当基线：只看「有数据+确认」那一条的话，
 *    `warning` / `error` 两个分支压根不出现在序列里 ⇒ 针对它们的变异体全成「漏网」
 *    （本台子第一版就是这样，报了 3 个假漏网）。
 * ⚠️ 旧版那边必须 `await done`：`settle()` 只是兑现 promise，续体是**微任务**，
 *    不等它跑完就取 `calls` 会少掉最后那句 `success`（第一版也漏在这儿）。
 */
async function legacyLog() {
  const out = []
  const take = async (opts) => {
    const L = runLegacy(opts)
    await L.settleMicrotasks()
    L.settle()
    await L.done
    out.push(...L.calls)
  }
  await take({ raw: undefined })
  await take({ raw: SAMPLE_LEGACY })
  await take({ raw: SAMPLE_LEGACY, confirmAction: 'cancel' })
  await take({ raw: '{不是 json' })
  return out
}

/** 同上，我们那边。 */
function oursLog() {
  const out = []
  const take = (opts) => {
    const O = runOurs(opts)
    O.settle()
    out.push(...O.calls)
  }
  take({ raw: undefined })
  take({ raw: SAMPLE_OURS })
  take({ raw: SAMPLE_OURS, confirmAction: 'cancel' })
  take({ raw: '{不是 json' })
  return out
}

const LEGACY_LOG = await legacyLog()
const OURS_LOG = oursLog()
cmp('四个场景连起来的调用日志', LEGACY_LOG, OURS_LOG)

// ⚠️ 变异体拿**旧版**的全场景日志去改：改完之后必须**不再等于我们** ⇒
//    说明「我们 == 旧版」这条断言真的在挡事（等价于「把我们改坏，它就和旧版对不上了」）。
const baseline = { calls: OURS_LOG, legacyCalls: LEGACY_LOG }
const mutantResults = MUTANTS.map(([name, mutate]) => [
  name,
  JSON.stringify(mutate(baseline.legacyCalls)) !== JSON.stringify(baseline.calls),
])
// 键名那条不放进变异体：`LAST_ORDER_KEY` 本身相等与否在 ⑥ 里**直接断言**了
// （变异体是「把我们改坏看抓不抓得到」，而这里根本没有可改的输入）。

// ───────────────────────────────────────────────────────────────────────────
// 输出
// ───────────────────────────────────────────────────────────────────────────
const show = (title, list) => {
  console.log(`\n${title}`)
  for (const [i, d] of list.entries()) console.log(`  ${String(i).padStart(2)}. ${JSON.stringify(d)}`)
}
// 全场景日志的分段：[0,1]=没存过 [2,3,4]=有数据+确认 [5,6]=取消 [7,8]=坏 JSON
show('旧版「导入上次订单」—— 有数据、点确认、走完', LEGACY_LOG.slice(2, 5))
show('我们「导入上次订单」—— 同上', OURS_LOG.slice(2, 5))

console.log('\n-- 变异测试（每个变异体都必须被抓到）--')
let mutantsAllCaught = true
for (const [name, caught] of mutantResults) {
  console.log(`  ${caught ? '✓' : '✗ 漏网'} ${name}`)
  if (!caught) mutantsAllCaught = false
}

if (failures.length) {
  console.log('\n❌ 不一致：')
  for (const f of failures) console.log(`  · ${f}`)
}
const ok = failures.length === 0 && mutantsAllCaught
console.log(
  `\n${ok ? '✅ 通过' : '❌ 不通过'}（不一致 ${failures.length} 处，变异漏网 ${mutantResults.filter(([, c]) => !c).length} 个）`,
)
process.exitCode = ok ? 0 : 1
