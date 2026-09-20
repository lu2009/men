/*
 * 差分台：`/hui` 那两个「设置」弹窗 —— **自动加价设置** / **排序方式**。
 *
 *   左 = 旧版 `Hui.formatted.js` 里那两个 `el-dialog` 的 `createVNode(...)` **整段切出来真跑**
 *        （桩 Vue 记下入参）；两个「保存」处理器（`_0x23343f` / `_0x2a0b61`）也**切出来真跑**，
 *        记下 `localStorage.setItem` / `dispatchEvent` / `ElMessage.success` 三件事
 *   右 = 仓库里那一份 `app/src/views/Hui.vue`：模板用 `@vue/compiler-sfc` **真解析** AST；
 *        处理器里的那几个字面量（键名 / 事件名 / 提示语）**按源码断言**
 *        （SFC 的 setup 函数差分台 import 不到 —— 这一点在文件头如实写明，不装作比了）
 *
 * ── 为什么要这台子 ────────────────────────────────────────────────────────
 * 2026-09-19 收口 `/hui` 时逐项核这两个弹窗，**四处偏离**是靠这台子比出来的：
 *   ① 「排序方式」宽度我们写 **420**，旧版 `a(1040)` = **320**（和「自动加价设置」同一个值）；
 *   ② 单选文案「型材优先**（默认）**」—— 旧版没有那个后缀；
 *   ③ 下面那行说明我们**自己写了一长句**，旧版是一句裸字面量
 *      **「序号优先：按订单号从小到大排列」**（`H:13268`）；
 *   ④ 容器我们用了 `class="vis-col"`（那是「列显隐设置」那套的类，在本页**没有样式**），
 *      旧版是内联 `padding:10px 0`。
 * 另外还比出**一处漏做**：旧版「自动加价设置」保存时**会派一个 CustomEvent**
 * （`auto-markup-setting-changed`，`H:8019`），我们漏了那一下。
 *
 * ── 口径（先说清楚） ─────────────────────────────────────────────────────
 *   · EP → naive 的 `type` 映射同 `hui-drawer-shell-logiccheck.mjs`：`danger` ⇒ `error`；
 *   · EP `el-dialog` 的 `center:""`（垂直居中）在 naive 的 `n-modal preset="card"` 里是**默认**
 *     ⇒ 我们没写、旧版写了，这一条**不参与比对**（写了也只是个空字符串）；
 *   · 旧版 `el-radio label="profile"` 里 `label` **就是值**（EP 2.x 的写法），
 *     naive 是 `value="profile"` —— 比的是**值**，不是属性名。
 *
 * ── 断网 ─────────────────────────────────────────────────────────────────
 * 本台子只读本地文件。`fetch` 被换成抛错的断网闸 —— 规则是「**不要请求 samrtdoor**」
 * （那是旧版的**旧**地址，当前地址是 `www.19901110.xyz`），不是「不许出网」；这里两样都不做。
 *
 * 用法：node docs/home-audit/hui-settings-dialogs-logiccheck.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { HUI, matchBracket, huiDecoder, resolveDecoders, deobf } from './lib/hui-decode.mjs'
// 配平法切片 —— 与两个搬迁守卫**同一个** `sliceFn`（`decl-sweep.mjs` / `home-extract-movecheck.mjs` 同款）。
// 2026-09-20 终审修复轮：原来这里用的是 `indexOf('\n}\n')`，见下面 `src()` 的说明。
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

/**
 * 哨兵：旧版桩里注入的「开关值」。
 *
 * ⚠️ 旧版模板编译后传的是 `_0x963b41[a(691)]`（即 `ref.value`，一个标量），
 *    所以桩里**拿不到那个 ref 本身**，也就比不了「这颗勾选框接的是哪个开关」。
 *    喂一个哨兵字符串，就又能比了 —— 而且比出来的**直接就是我们那边的变量名**。
 */
const REF_SENTINEL = {
  disableAutoMarkup: '@@ref:disableAutoMarkup',
  sortMethodDraft: '@@ref:sortMethodDraft',
}
const sentinelName = (v) =>
  typeof v === 'string' && v.startsWith('@@ref:') ? v.slice('@@ref:'.length) : null

// ───────────────────────────────────────────────────────────────────────────
// 左：两个弹窗的 render 切片 + 两个保存处理器
// ───────────────────────────────────────────────────────────────────────────
function stubVue() {
  return {
    withCtx: (fn) => fn,
    openBlock: () => {},
    createTextVNode: (t) => ({ k: 'text', text: String(t) }),
    createCommentVNode: () => null,
    createElementVNode: (tag, props, children) => ({ k: 'el', tag, props, children }),
    createElementBlock: (tag, props, children) => ({ k: 'el', tag, props, children }),
    normalizeClass: (c) => c,
    toDisplayString: (v) => String(v),
    createVNode: (type, props, children) => ({ k: 'vnode', type, props, children }),
  }
}

/** 切出锚点所在的那一整句 `Vue.createVNode(`（括号配平）。 */
function sliceCreateVNode(anchor, label) {
  const at = HUI.indexOf(anchor)
  if (at < 0) throw new Error(`${label}: 锚点没找到: ${anchor}`)
  const callAt = HUI.lastIndexOf('Vue.createVNode(', at)
  if (callAt < 0) throw new Error(`${label}: 锚点前面找不到 Vue.createVNode(`)
  const open = HUI.indexOf('(', callAt)
  return HUI.slice(callAt, matchBracket(HUI, open) + 1)
}

/**
 * 跑一个弹窗切片。
 *
 * ⚠️ 两个弹窗用的是**同一批组件标识符**（旧版 setup 里 `resolveComponent` 出来的）：
 *    `_`=el-dialog、`x`=el-button、`u`=el-checkbox、`f`=el-radio-group、`i`=el-radio。
 *    切片里出现别的 `Vue.*` 就会 TypeError —— 那是好事，说明切多了。
 */
function runDialog(anchor, label, opts = {}) {
  const raw = sliceCreateVNode(anchor, label)
  const code = deobf(raw, resolveDecoders(raw, HUI_TABLES, label), label)
  const fn = new Function(
    'Vue',
    '_',
    'x',
    'u',
    'f',
    'i',
    '_hoisted_30',
    '_hoisted_31',
    '_0x439e56',
    '_0x24527c',
    '_0x963b41',
    '_0x5d666e',
    // footer 两颗按钮挂的保存处理器（不透明即可 —— 比的是「哪颗按钮挂哪个」）
    '_0x23343f',
    '_0x2a0b61',
    't',
    `return ${code}`,
  )
  return fn(
    stubVue(),
    'el-dialog',
    'el-button',
    'el-checkbox',
    'el-radio-group',
    'el-radio',
    { style: { padding: '10px 0' } },
    { style: { padding: '10px 0' } },
    { value: !!opts.autoOpen },
    { value: !!opts.sortOpen },
    // ⚠️ 这两个**故意喂哨兵字符串**：模板编译后传的是 `ref.value`（标量），
    //    桩里拿不到 ref 本身 ⇒ 比不了「接的是哪个开关」。哨兵让「接对了没有」重新可比。
    { value: REF_SENTINEL.disableAutoMarkup },
    { value: REF_SENTINEL.sortMethodDraft },
    'saveAutoMarkup',
    'saveSortMethod',
    [],
  )
}

/** 把桩出来的 vnode 树压成「控件清单」。 */
function flatten(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (node.k === 'text') {
    out.push({ role: 'text', text: node.text })
    return out
  }
  if (node.k === 'el') {
    // `div` 之类的普通元素：把它的 style 与文字也记下来（两个弹窗的「说明行」就是这种）
    const p = node.props || {}
    const kids = [].concat(node.children || [])
    // ⚠️ 旧版 `createElementVNode('div',{style},'文字',-1)` 的第三个参数是**字符串**，
    //    不是 text vnode ⇒ `c.k === 'text'` 会漏掉（本台子第一版就把说明行读成了 null）。
    const text = kids
      .map((c) => (typeof c === 'string' ? c : c && c.k === 'text' ? c.text : ''))
      .join('')
      .trim()
    if (p.style || text) {
      out.push({
        role: 'el',
        tag: node.tag,
        style: p.style ? normStyle(p.style) : null,
        cls: p.class ?? null,
        text: text || null,
      })
    }
    for (const c of kids) flatten(c, out)
    return out
  }
  if (node.k !== 'vnode') return out
  const p = node.props || {}
  const slots = node.children && typeof node.children === 'object' ? node.children : {}
  const call = (fn) => (typeof fn === 'function' ? fn() : fn)

  if (node.type === 'el-dialog') {
    out.push({
      role: 'dialog',
      title: p.title,
      width: String(p.width),
      // `center:""` 在 naive 是默认行为 ⇒ 只记「有没有」，但**不参与比对**（见文件头口径）
      centered: p.center !== undefined,
      appendToBody: p['append-to-body'] === true,
    })
    for (const c of [].concat(call(slots.default) || [])) flatten(c, out)
    for (const c of [].concat(call(slots.footer) || [])) flatten(c, out)
    return out
  }
  if (node.type === 'el-button') {
    const texts = []
    for (const c of [].concat(call(slots.default) || [])) {
      if (c && c.k === 'text') texts.push(c.text)
    }
    out.push({
      role: 'button',
      text: texts.join('').trim(),
      type: p.type == null ? 'default' : String(p.type),
    })
    return out
  }
  if (node.type === 'el-checkbox') {
    const texts = []
    for (const c of [].concat(call(slots.default) || [])) {
      if (c && c.k === 'text') texts.push(c.text)
    }
    out.push({
      role: 'checkbox',
      binding: sentinelName(p.modelValue),
      text: texts.join('').trim(),
    })
    return out
  }
  if (node.type === 'el-radio-group') {
    out.push({ role: 'radiogroup', binding: sentinelName(p.modelValue) })
    for (const c of [].concat(call(slots.default) || [])) flatten(c, out)
    return out
  }
  if (node.type === 'el-radio') {
    const texts = []
    for (const c of [].concat(call(slots.default) || [])) {
      if (c && c.k === 'text') texts.push(c.text)
    }
    // ⚠️ EP 2.x 的 `el-radio`：`label` **就是值**（naive 那边叫 `value`）
    out.push({ role: 'radio', value: p.label, text: texts.join('').trim() })
    return out
  }
  for (const c of [].concat(call(slots.default) || [])) flatten(c, out)
  return out
}

/** 内联 style 归一（键排序，免得顺序不同被当成差异）。 */
function normStyle(s) {
  const o = {}
  for (const k of Object.keys(s).sort()) o[k] = String(s[k])
  return o
}

/** 切一个「保存」处理器并真跑，记下它对外干了什么。 */
function runSaveHandler(name) {
  const at = HUI.indexOf(`${name}=`)
  if (at < 0) throw new Error(`找不到 ${name}`)
  const open = HUI.indexOf('{', HUI.indexOf('=>', at))
  const decl = HUI.slice(at, matchBracket(HUI, open) + 1)
  const code = deobf(decl, resolveDecoders(decl, HUI_TABLES, name), name)

  const effects = []
  const ref = (v) => ({ value: v })
  const fn = new Function(
    '_0x43b0d8',
    'localStorage',
    'window',
    'ElementPlus',
    '_0x439e56',
    '_0x24527c',
    '_0x963b41',
    '_0x5d666e',
    `const ${code}; ${name}(); return { 弹窗开着: ${name === '_0x23343f' ? '_0x439e56' : '_0x24527c'}.value }`,
  )
  const ret = fn(
    null,
    {
      setItem: (k, v) => effects.push(['setItem', k, String(v)]),
      getItem: () => null,
    },
    {
      dispatchEvent: (e) =>
        effects.push(['dispatchEvent', e.type, typeof e.__detail, String(e.__detail)]),
    },
    {
      ElMessage: {
        success: (m) => effects.push(['success', m]),
        warning: (m) => effects.push(['warning', m]),
        error: (m) => effects.push(['error', m]),
      },
    },
    ref(false),
    ref(false),
    ref(true), // _0x963b41「去除自动加价」当前值
    ref('order'), // _0x5d666e 当前排序方式
  )
  return { effects, ret }
}

// `CustomEvent` 在 node 里没有 ⇒ 塞一个只记录 detail 的最小实现，
// 好让「派了什么事件、detail 是什么类型」也能被记下来。
class LegacyCustomEvent {
  constructor(type, init) {
    this.type = type
    const d = init && init.detail
    this.__detail = d
    this.detail = d
  }
}
globalThis.CustomEvent = LegacyCustomEvent

// ───────────────────────────────────────────────────────────────────────────
// 右：真解析 `app/src/views/Hui.vue`
// ───────────────────────────────────────────────────────────────────────────
const require = createRequire(`${ROOT}/app/package.json`)
const { parse } = require('@vue/compiler-sfc')

const HUI_VUE_SRC = readFileSync(`${ROOT}/app/src/views/Hui.vue`, 'utf8')
/**
 * ⚠️ **2026-09-20 C13**：`saveSortMethod` 的**声明**已随 C13 搬到
 * `app/src/composables/hui/useHuiSortMethod.ts`（逐字搬迁，零行为变化）⇒ 下面那条
 * **源码断言**得改读新家。改的理由不是「让闸变绿」：那段断言的判据（落盘键名 / 成功提示 /
 * 保存后关窗 / **不派事件**）**一条都没动**，只是被检文本搬了家 ——
 * 它此前抛 `Hui.vue 里找不到 saveSortMethod`，是**照实报**（函数确实不在那儿了），
 * 不是判据失效。`HUI_VUE_SRC` **保留**：两个 `n-modal` 的解析还在读它。
 *
 * ⚠️ **2026-09-20 C8**（同款、同理由）：`saveAutoMarkup` 的**声明**也随 C8 搬到
 * `app/src/composables/hui/useHuiAutoMarkup.ts`（逐字搬迁，零行为变化）⇒ 那条源码断言再改一次读入口。
 * 判据（落盘键名 / **落盘的是 `String(布尔)`** / 派事件、且 `detail` 是**布尔值** / 成功提示 / 保存后关窗）
 * **五条一条都没动**，只是被检文本搬了家。它此前抛 `Hui.vue 里找不到 saveAutoMarkup`，
 * 是**照实报**（函数确实不在那儿了），不是判据失效 —— 与 C13 那次是同一件事。
 */
const HUI_SORTMETHOD_SRC = readFileSync(`${ROOT}/app/src/composables/hui/useHuiSortMethod.ts`, 'utf8')
const HUI_AUTOMARKUP_SRC = readFileSync(`${ROOT}/app/src/composables/hui/useHuiAutoMarkup.ts`, 'utf8')

/**
 * 取出两个 `n-modal` 的 AST。
 *
 * ⚠️ 拿 `title` **静态属性**认人（`title="自动加价设置"` / `title="排序方式"`），
 *    比按下标或「第几个 n-modal」稳。
 */
function ourModals() {
  const { descriptor, errors } = parse(HUI_VUE_SRC, { filename: 'Hui.vue' })
  if (errors.length) throw new Error(`Hui.vue 解析失败: ${errors[0].message}`)
  const found = []
  const walk = (n) => {
    if (n.type === 1 && n.tag === 'n-modal') found.push(n)
    for (const c of n.children || []) walk(c)
  }
  walk(descriptor.template.ast)
  return found
}

/** 把 `<n-modal>` 压成和旧版同一套口径的清单。 */
function normalizeOurModal(node) {
  /**
   * 静态属性和动态绑定**一起找**。
   *
   * ⚠️ 动态指令的真名在 `p.arg` 里，`p.name` 只是指令名：`:checked` ⇒ `name:'bind'`、
   *    **`v-model:value` ⇒ `name:'model'`**。所以判据是「`arg` 对上」，**不要**再卡 `p.name`
   *    —— 卡了就会读不到 `v-model` 绑的那个开关（本台子第一版就这样）。
   */
  const prop = (n, name) =>
    n.props.find(
      (p) => (p.type === 6 && p.name === name) || (p.type === 7 && p.arg && p.arg.content === name),
    )
  const stat = (n, name) => {
    const p = prop(n, name)
    if (!p) return undefined
    if (p.type === 6) return p.value ? p.value.content : true
    const e = p.exp
    if (!e || !e.ast) throw new Error(`#${name}: 绑定解析不出 AST`)
    const a = e.ast
    if (a.type === 'StringLiteral' || a.type === 'NumericLiteral') return String(a.value)
    if (a.type === 'BooleanLiteral') return a.value
    throw new Error(`#${name}: 这个绑定形态本台子解析不了（${a.type}），不许猜`)
  }
  /**
   * 取「绑的是哪个变量」—— `v-model:value="sortMethodDraft"` ⇒ `sortMethodDraft`。
   *
   * ⚠️ 和旧版那边对齐：旧版桩里记的是 ref 的**变量名**（`_0x5d666e`），不是当时的值 ——
   *    值是我们喂进去的，比它没有意义。这一条比的是「开关接对了没有」。
   */
  const bindName = (n, name) => {
    const p = prop(n, name)
    if (!p || p.type !== 7) return null
    const c = p.exp && p.exp.content
    if (!c || !/^[A-Za-z_$][\w$]*$/.test(c)) {
      throw new Error(`#${name}: 绑定表达式不是单个变量名（${c}），本台子比不了`)
    }
    return c
  }
  /** 行内 style 字符串 → 归一化的对象（`width: 320px` / `width:320px` 都认）。 */
  const styleOf = (n) => {
    const s = stat(n, 'style')
    if (typeof s !== 'string') return null
    const o = {}
    for (const part of s.split(';')) {
      const i = part.indexOf(':')
      if (i < 0) continue
      const k = part.slice(0, i).trim()
      const v = part.slice(i + 1).trim()
      if (k) o[k] = v
    }
    return o
  }
  const els = (n) => (n.children || []).filter((c) => c.type === 1)
  const textOf = (n) =>
    (n.children || [])
      .map((c) => (c.type === 2 ? c.content : ''))
      .join('')
      .trim()

  const out = []
  const style = styleOf(node)
  out.push({
    role: 'dialog',
    title: stat(node, 'title'),
    width: String(style?.width ?? ''),
    centered: null, // naive 的 preset card 本来就居中 ⇒ 不参与比对
    appendToBody: null, // naive 没有这个概念
  })
  // 主体：第一个 div（以及它里面的说明行）
  for (const el of els(node)) {
    if (el.tag === 'template') continue
    if (el.tag === 'div') {
      out.push({
        role: 'el',
        tag: 'div',
        style: styleOf(el),
        cls: typeof stat(el, 'class') === 'string' ? stat(el, 'class') : null,
        text: textOf(el) || null,
      })
      for (const inner of els(el)) {
        if (inner.tag === 'n-checkbox') {
          out.push({
            role: 'checkbox',
            binding: bindName(inner, 'checked'),
            text: String(stat(inner, 'label') ?? ''),
          })
        } else if (inner.tag === 'n-radio-group') {
          out.push({ role: 'radiogroup', binding: bindName(inner, 'value') })
          for (const r of els(inner)) {
            if (r.tag === 'n-radio') {
              out.push({ role: 'radio', value: stat(r, 'value'), text: textOf(r) })
            }
          }
        } else if (inner.tag === 'div') {
          out.push({
            role: 'el',
            tag: 'div',
            style: styleOf(inner),
            cls: null,
            text: textOf(inner) || null,
          })
        }
      }
    }
  }
  // footer 里的两颗按钮
  const footer = els(node).find((c) => c.tag === 'template')
  for (const b of els(footer).flatMap((x) => els(x))) {
    if (b.tag === 'n-button') {
      out.push({
        role: 'button',
        text: textOf(b),
        type: stat(b, 'type') ?? 'default',
      })
    }
  }
  return out
}

// ───────────────────────────────────────────────────────────────────────────
// 比对
// ───────────────────────────────────────────────────────────────────────────
const NAIVE2EP = { error: 'danger' }
/**
 * 把我们的描述**还原成旧版口径**。
 *
 * `binding` 这一列两边**已经同名**了 —— 旧版那边通过哨兵（见 `REF_SENTINEL`）直接吐出的
 * 就是我们的变量名，所以这里不用再映射：比的是「这颗控件接的是哪个开关」，
 * 旧版 `_0x963b41` ↔ 我们 `disableAutoMarkup`、旧版 `_0x5d666e` ↔ 我们 `sortMethodDraft`
 * （弹窗里走的是**草稿态**，不是生效值 —— 旧版也是）。
 */
const oursToLegacy = (d) =>
  d.role === 'button' ? { ...d, type: NAIVE2EP[d.type] ?? d.type } : d

const failures = []
const cmp = (label, want, got) => {
  const a = JSON.stringify(want)
  const b = JSON.stringify(got)
  if (a !== b) failures.push(`${label}\n      旧版 ${a}\n      我们 ${b}`)
}

const ANCHOR_AUTO = 'title:a(1165),width:a(1040)'
const ANCHOR_SORT = 'title:a(524),width:a(1040)'

const modals = ourModals()
if (modals.length !== 9) {
  // 金丝雀：Hui.vue 现在 9 个 `n-modal`。数量变了就得回来确认新弹窗归谁管
  //（另有一批弹窗在 `components/*.vue` 里，不在本台子范围）。
  throw new Error(`Hui.vue 里 n-modal 数量变了：${modals.length}（预期 9）`)
}
const ourAuto = modals.find((n) => HUI_VUE_SRC.slice(n.loc.start.offset, n.loc.end.offset).includes('去除自动加价'))
const ourSort = modals.find((n) => {
  const src = HUI_VUE_SRC.slice(n.loc.start.offset, n.loc.end.offset)
  return src.includes('序号优先') && !src.includes('去除自动加价')
})
if (!ourAuto || !ourSort) throw new Error('两个设置弹窗没认出来')

/** 弹窗本体：左边跑两遍（勾选开着 / 关着、单选 profile / order）压成一条。 */
function legacyDialog(anchor, label) {
  return flatten(runDialog(anchor, label, { disableAuto: true, sort: 'order' })).filter((d) => d.role)
}

cmp('自动加价设置 · 控件清单', legacyDialog(ANCHOR_AUTO, '自动加价设置').map(slim), normalizeOurModal(ourAuto).map(oursToLegacy).map(slim))
cmp('排序方式 · 控件清单', legacyDialog(ANCHOR_SORT, '排序方式').map(slim), normalizeOurModal(ourSort).map(oursToLegacy).map(slim))

/** 只比「两边都有意义」的字段（`centered` / `appendToBody` 见文件头口径，不比）。 */
function slim(d) {
  const x = { ...d }
  delete x.centered // naive 的 preset card 本来就居中（见文件头口径）
  delete x.appendToBody // naive 没有这个概念
  return x
}

// —— 保存处理器：左边真跑，右边按源码断言 ——
const saveAuto = runSaveHandler('_0x23343f')
const saveSort = runSaveHandler('_0x2a0b61')
cmp('自动加价 · 保存的副作用', [['setItem', 'smartdoor_disable_auto_markup', 'true'], ['dispatchEvent', 'auto-markup-setting-changed', 'boolean', 'true'], ['success', '设置已保存']], saveAuto.effects)
cmp('排序方式 · 保存的副作用', [['setItem', 'smartdoor_sort_method', 'order'], ['success', '排序方式已保存']], saveSort.effects)
cmp('保存后弹窗要关', { 弹窗开着: false }, saveAuto.ret)
cmp('保存后弹窗要关（排序方式）', { 弹窗开着: false }, saveSort.ret)

// 我们那边：这三个常量在 `Hui.vue` 里是字面量，按源码断言。
// ⚠️ SFC 的 setup 函数差分台 import 不到，所以这一段是**源码断言**，不是「跑起来比」——
//    如实写明，别当成等价物。
{
  /**
   * ⚠️ `srcFile` **默认仍是 `Hui.vue`** —— 只有**搬走了**的函数才显式传新家
   * （C13 之后 `saveSortMethod`；C8 之后 `saveAutoMarkup` 也走了 ⇒ **两个都显式传**）。
   */
  /**
   * ⚠️ **2026-09-20 终审修复轮：切片器从 `indexOf('\n}\n')` 换成配平法（`sliceFn`）。**
   *
   * 原来那行是 `srcFile.slice(at, srcFile.indexOf('\n}\n', at))`，而 `'\n}\n'`
   * **只能匹配「列 0 的收尾括号」**。这两个函数搬进工厂函数之后收尾变成了 `'\n  }\n'`
   * ⇒ 那个 `indexOf` **穿过了函数自己的收尾、命中的是外层工厂的收尾括号**，
   * haystack 一路多切到**工厂的 `return {…}` 对象里**。
   * 实测（本笔）：`saveAutoMarkup` 切到 **1010** 字符、配平法真实 **850** ⇒ **多 160 字符**，
   * 尾巴正是 `…toMarkupOpen, onAutoMarkupDraft, saveAutoMarkup, }`；`saveSortMethod` 同理。
   *
   * ⚠️ **这是「放宽判定」，不是「换被检文本」** —— 与 C8/C13 那两笔性质不同，别混：
   * 下面 8 条断言走的是 `haystack.includes(needle)`，haystack **变长**之后，
   * needle 可能在**尾随的无关文本**里被找到 ⇒ **真的漂了也不报（假绿）**。
   * （本笔实测：这 8 条 needle 今天都仍落在配平区间内 ⇒ **改完不会变红**；
   *   也就是说这是一次**加固**——把一个潜伏的假绿堵掉，没有放松任何判据。）
   *
   * **判据（下面那 8 条 needle）一条都没动**，只换被检文本的**来路**。
   */
  const src = (fn, srcFile = HUI_VUE_SRC, where = 'Hui.vue') => {
    // 保留显式的「找不到」报错：`sliceFn` 自己也抛，但它抛的是「切片不平衡」，
    // 分不出「函数不在这个文件里」和「函数在、只是括号数不对」—— 前者是搬走了，后者才是真漂。
    if (!srcFile.includes(`function ${fn}(`)) throw new Error(`${where} 里找不到 ${fn}`)
    return sliceFn(srcFile, fn)
  }
  // 2026-09-20 C8：声明已搬到 `composables/hui/useHuiAutoMarkup.ts`（判据一字未动，只换了被检文本）。
  const auto = src('saveAutoMarkup', HUI_AUTOMARKUP_SRC, 'composables/hui/useHuiAutoMarkup.ts')
  // 2026-09-20 C13：声明已搬到 `composables/hui/useHuiSortMethod.ts`（判据一字未动，只换了被检文本）。
  const sort = src('saveSortMethod', HUI_SORTMETHOD_SRC, 'composables/hui/useHuiSortMethod.ts')
  for (const [needle, why] of [
    ["LS.set('smartdoor_disable_auto_markup', String(autoMarkupDraft.value))", '键名/写入形态'],
    ["new CustomEvent('auto-markup-setting-changed'", '给手机端外壳的事件'],
    ['{ detail: autoMarkupDraft.value }', 'detail 是**布尔值**（不是字符串）'],
    ["message.success('设置已保存')", '成功提示'],
    ['autoMarkupOpen.value = false', '保存后关窗'],
  ]) {
    if (!auto.includes(needle)) throw new Error(`saveAutoMarkup 缺：${needle}（${why}）`)
  }
  for (const [needle, why] of [
    ["localStorage.setItem('smartdoor_sort_method', sortMethod.value)", '键名'],
    ["message.success('排序方式已保存')", '成功提示'],
    ['sortMethodOpen.value = false', '保存后关窗'],
  ]) {
    if (!sort.includes(needle)) throw new Error(`saveSortMethod 缺：${needle}（${why}）`)
  }
  // 排序方式的保存**不该**派事件（旧版 `_0x2a0b61` 里没有 dispatchEvent）
  if (/dispatchEvent/.test(sort)) throw new Error('saveSortMethod 派了事件 —— 旧版这里没有')
}

// ───────────────────────────────────────────────────────────────────────────
// 变异测试：把「我们」故意改坏，每个变异体都**必须**被抓到
// ───────────────────────────────────────────────────────────────────────────
const oursAuto = normalizeOurModal(ourAuto).map(oursToLegacy).map(slim)
const oursSort = normalizeOurModal(ourSort).map(oursToLegacy).map(slim)
const MUTANTS = [
  ['排序方式宽度 320 → 420（改前就是这个错）', (l) => l.map((d) => (d.role === 'dialog' ? { ...d, width: '420px' } : d))],
  ['「型材优先」加了「（默认）」后缀', (l) => l.map((d) => (d.text === '型材优先' ? { ...d, text: '型材优先（默认）' } : d))],
  ['说明行换成我们自己写的那句', (l) => l.map((d) => (d.text && d.text.startsWith('序号优先：') ? { ...d, text: '影响生产单/玻璃合片单/玻璃订单/标签等单据的行顺序' } : d))],
  ['说明行丢了内联样式', (l) => l.map((d) => (d.text && d.text.startsWith('序号优先：') ? { ...d, style: null } : d))],
  ['容器用了 .vis-col（本页没这条样式）', (l) => l.map((d) => (d.role === 'el' && d.style ? { ...d, cls: 'vis-col', style: { padding: '0' } } : d))],
  ['勾选框文案改了', (l) => l.map((d) => (d.role === 'checkbox' ? { ...d, text: '去除自动加价功能' } : d))],
  ['提示行文案改了（自动加价）', (l) => l.map((d) => (d.text === '勾选后，玻璃和尺寸相关加价项目将不再自动选中' ? { ...d, text: '勾选后不再自动选中' } : d))],
  ['footer 少一颗按钮', (l) => l.filter((d) => d.text !== '取消')],
  ['「保存」掉了 primary', (l) => l.map((d) => (d.text === '保存' ? { ...d, type: 'default' } : d))],
  ['单选值写反（profile ↔ order）', (l) => l.map((d) => (d.role === 'radio' ? { ...d, value: d.value === 'order' ? 'profile' : 'order' } : d))],
  ['标题写错', (l) => l.map((d) => (d.role === 'dialog' ? { ...d, title: '设置' } : d))],
]
const mutantResults = MUTANTS.map(([name, mutate], i) => {
  const base = i === 0 || i === 5 || i === 6 || i === 7 || i === 8 || i === 10 ? oursAuto : oursSort
  return [name, JSON.stringify(mutate(base)) !== JSON.stringify(base)]
})
// 保存副作用那两条也当变异体（改键名 / 去掉事件 / detail 改成字符串）
const saveMutants = [
  ['保存时不派 auto-markup-setting-changed', saveAuto.effects.every((e) => e[0] !== 'dispatchEvent')],
  ['派事件的 detail 换成字符串', saveAuto.effects.some((e) => e[0] === 'dispatchEvent' && e[2] === 'string')],
  ['键名换成 smartdoor_disable_auto', saveAuto.effects.some((e) => e[1] === 'smartdoor_disable_auto')],
]
for (const [n, broken] of saveMutants) mutantResults.push([n, broken === false])

// ───────────────────────────────────────────────────────────────────────────
// 输出
// ───────────────────────────────────────────────────────────────────────────
const show = (title, list) => {
  console.log(`\n${title}`)
  for (const [i, d] of list.entries()) console.log(`  ${String(i).padStart(2)}. ${JSON.stringify(d)}`)
}
show('自动加价设置 —— 旧版口径', legacyDialog(ANCHOR_AUTO, '自动加价设置').map(slim))
show('自动加价设置 —— 我们', oursAuto)
show('排序方式 —— 旧版口径', legacyDialog(ANCHOR_SORT, '排序方式').map(slim))
show('排序方式 —— 我们', oursSort)
console.log('\n-- 保存处理器的副作用（左边真跑出来的）--')
for (const e of saveAuto.effects) console.log(`  · 自动加价 ${JSON.stringify(e)}`)
for (const e of saveSort.effects) console.log(`  · 排序方式 ${JSON.stringify(e)}`)

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
