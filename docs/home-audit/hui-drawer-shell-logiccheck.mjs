/*
 * 差分台：Hui 页两个抽屉（「添加门类」/「视频教程」）里**每一颗控件**的清单。
 *
 *   左 = 旧版 `Hui.formatted.js` 的 `render` 里那两个抽屉的 `createVNode(...)` **整段切出来真的跑**
 *        （`Vue` 换成只会记录调用的桩 ⇒ 不需要 Element Plus、不需要浏览器）
 *   右 = **仓库里那一份** `app/src/views/Hui.vue`，用 `@vue/compiler-sfc` **真解析**它的模板 AST
 *
 * ── 为什么要这台子 ────────────────────────────────────────────────────────
 * 用户 2026-09-19 的原话：「添加门类的弹窗内按钮和原版不一致，我们做到了外边」。
 * 先前手工核对只核了**抽屉外壳**（宽度 / 关闭钮 / 标题），**里面一项都没逐条比过** ——
 * 于是「8 项只做了 3 项、另外 4 项被搬到工具栏、type 大半是错的、`导入上次订单` 掉了
 * warning、`custom-button-btn` 的蓝色整个没有」一直没被发现。
 * 这类漂移靠肉眼防不住，所以把「抽屉里每一颗控件长什么样」变成可执行断言。
 *
 * ── 六条口径，先说清楚，免得后人以为在比字符串 ───────────────────────────
 *   ① **EP → naive 的取名映射**：EP `danger` ⇒ naive `error`（naive 的 `ButtonType` 没有
 *      `danger`，全仓库一致，见 `GlassEditDialog.vue` 等）。比之前先把我们的 `error` 还原成
 *      `danger`；**其余四档同名**（`primary`/`info`/`success`/`warning`）。
 *      ⚠️ 同名**不等于同色**：EP 的 `info` 是实心灰、naive 的 `info` 是蓝。那是全局调色板的事
 *      （`App.vue` 只覆盖了 `primaryColor`），本台子比的是**档位名**，不是色值 —— 有意的。
 *   ② `size:"default"` 在 naive 里**没有对应档**（只有 `tiny|small|medium|large`，默认 `medium`）
 *      ⇒ 我们的等价物是**不写 `size`**。比对时把「不写」还原成 `"default"`。
 *   ③ 满宽：旧版靠 CSS `.door-buttons .el-button{width:100%}`，naive 的等价物是 `block` 属性
 *      ⇒ 我们的 `block` 记成 `wide:true`，旧版**一律** `wide:true`。
 *   ④ **动态 `type` 记成「两个状态各观察到什么」**：旧版那个三元素在渲染时求值，单跑一遍只能
 *      看到一支。所以左边**跑两遍**（开关全关 / 全开），把它压成 `[开, 关]`；我们源码里
 *      `cond ? 'a' : 'b'` 同样取 `['a','b']`（consequent 在前）。**这样比的是"哪些档会用到"，
 *      顺序还顺带证明了「开/关各是哪一档」。**
 *   ⑤ **class 只比静态那一截**：旧版 `custom-button-btn` / `orange-button` 都是**真的在本页
 *      生效**的（`Hui-39b802eb.css` 里 `data-v-f7f86ced` 正是 `.door-buttons` 那个 scope id）；
 *      只有 `connected-btn`（`setting-95715826.css` 里的）在本页没样式。「辅助菜单设置」的
 *      class 是个数组、里面混着三元 ⇒ 本台子只比静态部分（`custom-button-btn`），
 *      三元那一支由源码断言看。
 *   ⑥ **开关不逐条进清单，只数个数**：我们的模板是静态 AST，`v-if` 看不见 —— 见
 *      `countSwitches()` 的长注释。
 *
 * ── 断网 ─────────────────────────────────────────────────────────────────
 * 本台子只读本地文件。`fetch` 仍被换成抛错的断网闸 —— 规则是「**不要请求 samrtdoor**」
 * （那是旧版的**旧**地址，当前地址是 `www.19901110.xyz`），不是「不许出网」；这里两样都不做。
 *
 * 用法：node docs/home-audit/hui-drawer-shell-logiccheck.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { HUI, matchBracket, huiDecoder, resolveDecoders, deobf } from './lib/hui-decode.mjs'

const ROOT = '/Users/aaa/Desktop/door-main'

// ───────────────────────────────────────────────────────────────────────────
// ⛔ 断网闸：本台子只读本地文件，谁真去发请求立刻红。
// ───────────────────────────────────────────────────────────────────────────
globalThis.fetch = async (url) => {
  throw new Error(`本差分台禁止真实网络请求，但有人调了 fetch(${String(url).slice(0, 80)})`)
}

const HUI_TABLES = { _0x250a: huiDecoder() }

// ───────────────────────────────────────────────────────────────────────────
// 左：把两个抽屉的 render 切片、反混淆、用**桩 Vue** 跑出来
// ───────────────────────────────────────────────────────────────────────────

/**
 * 桩 Vue —— 只要把 `createVNode` 的入参原样记下来就够了，不需要真渲染。
 *
 * 切片里出现的每个 `Vue.*` 都得在这儿有对应实现，**缺一个就 TypeError**
 * （好事：说明切多了，切到别的组件上去了）。
 */
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

/**
 * 切出 `Vue.createVNode(` 那一整句（括号配平）。
 *
 * ⚠️ 锚点必须带上下文：只有 `modelValue:_0x5b48c7` 这种**唯一串**才敢用；
 * 光用 `Vue.createVNode(m,` 会切到前面几个 `el-drawer`（设置抽屉、订单列表抽屉…）上去。
 */
function sliceCreateVNode(anchor, label) {
  const at = HUI.indexOf(anchor)
  if (at < 0) throw new Error(`${label}: 锚点没找到: ${anchor}`)
  const callAt = HUI.lastIndexOf('Vue.createVNode(', at)
  if (callAt < 0) throw new Error(`${label}: 锚点前面找不到 Vue.createVNode(`)
  const open = HUI.indexOf('(', callAt)
  return HUI.slice(callAt, matchBracket(HUI, open) + 1)
}

/**
 * 跑一个抽屉切片。
 *
 * 自由变量逐条给值 —— 值的**语义**也要对，否则「type 跟着哪个开关走」就比不出来了
 * （那件事另有一段专项断言，见 `assertToggleMapping()`）。
 */
function runDrawer(anchor, label, opts) {
  const raw = sliceCreateVNode(anchor, label)
  const code = deobf(raw, resolveDecoders(raw, HUI_TABLES, label), label)
  const fn = new Function(
    'Vue',
    // 旧版 setup 里 `resolveComponent` 出来的组件标识符（`H:12848`）：
    //   x = el-button、m = el-drawer、b = el-popover、V = el-switch
    'x',
    'm',
    'b',
    'V',
    // `_hoisted_*` 是编译期提出去的静态描述（class / style 常量）
    '_hoisted_32',
    '_hoisted_33',
    '_hoisted_34',
    '_hoisted_35',
    '_hoisted_36',
    '_hoisted_37',
    '_hoisted_38',
    // 两个抽屉各自的开关 ref（`H:7916` / `H:7931` / 视频教程的 `_0x3b5987`）
    '_0x5b48c7',
    '_0x3b5987',
    '_0x515a7c',
    '_0xcf05a4',
    '_0x2ffe36',
    '_0x187cf8',
    '_0x21c393',
    // 回调
    '_0x431f92',
    'importLastOrder',
    '_0x5e1bf7',
    '_0x38bc9b',
    '_0xff1972',
    '_0x14b5ca',
    '_0x1bdba1',
    '_0x13d6a9',
    // 视频教程那 9 颗按钮共用的「打开教程」回调（`H:12872` 起那张名字→链接表）
    '_0x1ca662',
    // 渲染缓存（模板里 `t[47]||(t[47]=…)` 的 `t`）
    't',
    `return ${code}`,
  )
  return fn(
    stubVue(),
    'el-button',
    'el-drawer',
    'el-popover',
    'el-switch',
    { class: 'door-buttons' },
    { style: { 'text-align': 'center', padding: '10px' } },
    { key: 0, style: { 'margin-left': '5px', color: '#67c23a' } },
    { style: { 'text-align': 'center', padding: '10px' } },
    { style: { 'text-align': 'center', padding: '10px' } },
    { style: { 'text-align': 'center', padding: '10px' } },
    { class: 'door-buttons' },
    { value: !!opts.menuOpen }, //   _0x5b48c7 「添加门类」抽屉开关
    { value: !!opts.videoOpen }, //  _0x3b5987 「视频教程」抽屉开关
    { value: !!opts.ping }, //       _0x515a7c 平开门显示中
    { value: !!opts.diao }, //       _0xcf05a4 移门显示中
    { value: !!opts.balance }, //    _0x2ffe36 总余额显示
    { value: !!opts.assistive }, //  _0x187cf8 手机辅助菜单
    { value: !!opts.fullscreen }, // _0x21c393 全面屏
    (k) => `toggle:${k}`, //         _0x431f92
    'importLastOrder', //            不透明即可 —— 比的是「哪颗按钮挂哪个回调」
    'openMarkupMgmt', //
    'openAutoMarkup', //
    'openSortMethod', //
    'onTotalBalanceChange', //
    'onAssistiveMenuChange', //
    'onAssistiveFullscreenChange', //
    (name) => `openVideo:${name}`, // _0x1ca662
    [],
  )
}

/** 把桩出来的 vnode 树压成「控件清单」。 */
function flatten(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (node.k === 'text') {
    out.push({ k: 'text', text: node.text })
    return out
  }
  if (node.k === 'el') {
    out.push({ k: 'el', tag: node.tag })
    for (const c of [].concat(node.children || [])) flatten(c, out)
    return out
  }
  if (node.k !== 'vnode') return out
  const p = node.props || {}
  const slots = node.children && typeof node.children === 'object' ? node.children : {}
  const call = (fn) => (typeof fn === 'function' ? fn() : fn)

  if (node.type === 'el-drawer') {
    out.push({
      role: 'drawer',
      placement: p.direction === 'rtl' ? 'right' : p.direction,
      size: p.size == null ? null : String(p.size).replace(/px$/, ''),
      title: p.title ?? null,
      closable: p['show-close'] !== false,
    })
    for (const child of [].concat(call(slots.default) || [])) flatten(child, out)
    return out
  }
  if (node.type === 'el-button') {
    const texts = []
    for (const c of [].concat(call(slots.default) || [])) collectText(c, texts)
    out.push({
      role: 'button',
      text: texts.join('').trim(),
      type: p.type == null ? 'default' : String(p.type),
      size: p.size == null ? 'default' : String(p.size).replace(/px$/, ''),
      cls: clsOf(p.class),
      round: p.round !== undefined,
      wide: true, // 旧版一律靠 CSS 满宽
      ...(p.onClick !== undefined ? {} : {}),
    })
    return out
  }
  if (node.type === 'el-popover') {
    out.push({
      role: 'popover',
      placement: p.placement,
      width: p.width == null ? null : Number(p.width),
      trigger: p.trigger,
    })
    for (const c of [].concat(call(slots.reference) || [])) flatten(c, out)
    for (const c of [].concat(call(slots.default) || [])) flatten(c, out)
    return out
  }
  // 普通元素（`div` 等）：往下钻
  for (const c of [].concat(call(slots.default) || [])) flatten(c, out)
  return out
}

function collectText(node, sink) {
  if (!node || typeof node !== 'object') return
  if (node.k === 'text') {
    sink.push(node.text)
    return
  }
  if (node.k === 'el') {
    // `<span …>✓</span>`（总余额 / 辅助菜单的勾）
    if (node.tag === 'span') sink.push('✓')
    for (const c of [].concat(node.children || [])) collectText(c, sink)
  }
}

function clsOf(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x).join(' ')
  return String(v)
}

// ───────────────────────────────────────────────────────────────────────────
// 左 · 前置：先证明「type 跟着哪个开关走」这件事本身是对的
//
// 光比「用到了 danger/info 两档」是不够的 —— 集合对了但**挂错了开关**（拿移门的开关去控
// 平开门的颜色）照样抓不到。所以把旧版那个 toggle 函数切出来**真的跑一遍**，看它翻的是哪个
// ref，再和 type 的条件对上。
// ───────────────────────────────────────────────────────────────────────────
function assertToggleMapping() {
  const at = HUI.indexOf('_0x431f92=e=>{')
  if (at < 0) throw new Error('找不到 _0x431f92')
  const open = HUI.indexOf('{', at)
  // ⚠️ 要连 `_0x431f92=e=>` 一起切。只取 `{…}` 会切出一个**对象字面量**，
  //    跑起来是 `ReferenceError: e is not defined`（本台子第一版就栽在这）。
  const decl = HUI.slice(at, matchBracket(HUI, open) + 1)
  const code = deobf(decl, resolveDecoders(decl, HUI_TABLES, 'toggle'), 'toggle')
  const seen = {}
  for (const key of ['pingkai', 'diao']) {
    const ping = { value: false }
    const diao = { value: false }
    // `const t=_0x43b0d8;` 那句在 deobf 后已无人用（token 被就地换成了字面量），
    // 但名字还在 ⇒ 注入一个 `_0x43b0d8` 即可，不必删源码。
    const fn = new Function(
      '_0x43b0d8',
      '_0x515a7c',
      '_0xcf05a4',
      `const ${code}; _0x431f92(${JSON.stringify(key)}); return [_0x515a7c.value, _0xcf05a4.value]`,
    )
    seen[key] = fn(null, ping, diao)
  }
  const want = { pingkai: [true, false], diao: [false, true] }
  if (JSON.stringify(seen) !== JSON.stringify(want)) {
    throw new Error(`旧版 toggle 映射变了：${JSON.stringify(seen)} ≠ ${JSON.stringify(want)}`)
  }
  return want
}
assertToggleMapping()

// ───────────────────────────────────────────────────────────────────────────
// 右：真解析 `app/src/views/Hui.vue`
// ───────────────────────────────────────────────────────────────────────────

const require = createRequire(`${ROOT}/app/package.json`)
const { parse } = require('@vue/compiler-sfc')

const HUI_VUE_SRC = readFileSync(`${ROOT}/app/src/views/Hui.vue`, 'utf8')

function ourDrawerNodes() {
  const { descriptor, errors } = parse(HUI_VUE_SRC, { filename: 'Hui.vue' })
  if (errors.length) throw new Error(`Hui.vue 解析失败: ${errors[0].message}`)
  const found = []
  // ⚠️ 根节点是 `type === 0`（ROOT），**不是** 1 —— 别把「是元素才往下走」当过滤条件，
  //    那样连根都进不去，结果一个抽屉都找不到（本台子第一版就栽在这）。
  const walk = (n) => {
    if (n.type === 1 && n.tag === 'n-drawer') found.push(n)
    for (const c of n.children || []) walk(c)
  }
  walk(descriptor.template.ast)
  return found
}

/**
 * `Hui.vue` 的 `<script>` 里那张「视频教程」名字→链接表 —— **抠出来给 v-for 展开用**。
 *
 * 我们模板里 9 条教程是 `v-for="[label, link] in VIDEO_LINKS"`：AST 上**只有一颗**按钮，
 * 文字还是个 `{{label}}` 插值。不展开的话右边永远 1 项、左边 9 项（本台子第一版就这样红的）。
 * 这里只读**名字**（第二列链接另有 `openVideo` 的断言管不着，本台子不比链接）。
 */
const VIDEO_LINKS_ROWS = (() => {
  const m = HUI_VUE_SRC.match(/const VIDEO_LINKS[^=]*=\s*\[([\s\S]*?)\n\]/)
  if (!m) throw new Error('Hui.vue 里找不到 VIDEO_LINKS')
  return [...m[1].matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g)].map((x) => [x[1], x[2]])
})()
const VFOR_LISTS = { VIDEO_LINKS: VIDEO_LINKS_ROWS }

/** 把 `<n-drawer>` 的 AST 压成和旧版同一套口径的控件清单。 */
function normalizeOurDrawer(node) {
  /**
   * 取属性 —— **静态和动态一起找**。
   *
   * ⚠️ 两个坑，本台子第一版全踩了（症状是「右边所有属性都读成了默认值」）：
   *   ① 静态属性 `type="warning"` 是 `type:6`，动态 `:type="…"` 是 `type:7` ⇒ 分开找必然漏一半；
   *   ② 动态绑定的 `p.name` **不是** `width` 而是 `'bind'`，真正的名字在 `p.arg.content` 里
   *      （`v-model:show` 同理是 `name:'model'` + `arg:'show'`）。
   */
  const prop = (n, name) =>
    n.props.find(
      (p) =>
        (p.type === 6 && p.name === name) ||
        (p.type === 7 && p.arg && p.arg.content === name && (p.name === 'bind' || p.name === name)),
    )

  /** 取静态值；动态绑定只认「字面量」「字面量三元」「字面量数组」，其余抛 —— **不猜**。 */
  function val(p, ctx) {
    if (!p) return undefined
    if (p.type === 6) return p.value ? p.value.content : true
    const e = p.exp
    if (!e || !e.ast) throw new Error(`${ctx}: 绑定解析不出 AST：${e ? e.content : p.loc.source}`)
    return lit(e.ast, ctx)
  }
  function lit(a, ctx) {
    if (a.type === 'StringLiteral' || a.type === 'NumericLiteral') return String(a.value)
    if (a.type === 'BooleanLiteral') return a.value
    if (a.type === 'ArrayExpression') {
      const vals = []
      for (const el of a.elements) vals.push(lit(el, ctx))
      return vals
    }
    if (a.type === 'ConditionalExpression') {
      // consequent 在前 —— 与旧版「开 / 关」两次观察的顺序对齐（见文件头口径 ④）
      return [].concat(lit(a.consequent, ctx), lit(a.alternate, ctx))
    }
    throw new Error(`${ctx}: 这个绑定本台子解析不了（${a.type}），不许猜`)
  }

  /**
   * 取 class 的**静态那一截**。
   *
   * 「辅助菜单设置」写的是 `:class="['custom-button-btn', showAssistiveMenu ? 'connected-btn' : '']"`：
   * 数组里混着一个三元。本台子比**静态部分**（`custom-button-btn`），三元那一支
   * （`connected-btn`）另用源码断言看 —— 它在旧版里也没有样式，只留个名字。
   */
  function cls(p, ctx) {
    if (!p) return ''
    if (p.type === 6) return p.value ? p.value.content : ''
    const a = p.exp && p.exp.ast
    if (!a) throw new Error(`${ctx}: class 绑定解析不出 AST`)
    if (a.type === 'StringLiteral') return a.value
    if (a.type !== 'ArrayExpression') throw new Error(`${ctx}: class 绑定形态本台子解析不了（${a.type}）`)
    return a.elements
      .filter((e) => e.type === 'StringLiteral')
      .map((e) => e.value)
      .join(' ')
  }

  /** `v-for="[label, link] in VIDEO_LINKS"` ⇒ 逐项展开成若干行；没有 v-for 返回 null。 */
  function vforRows(el) {
    // ⚠️ `v-for` 是**唯一没有 `arg`** 的指令（`name:'for'`、`arg:null`）⇒ 不能走 `prop()`，
    //    否则永远找不到，右边的视频抽屉就只剩 1 项（本台子第一版就这样红的）。
    const p = el.props.find((x) => x.type === 7 && x.name === 'for')
    if (!p) return null
    const src = String(p.exp.content).trim()
    const m = src.match(/^\[([^\]]+)\]\s+in\s+([A-Za-z_$][\w$]*)$/)
    if (!m) throw new Error(`v-for 形态本台子解析不了：${src}`)
    const vars = m[1].split(',').map((s) => s.trim())
    const rows = VFOR_LISTS[m[2]]
    if (!rows) throw new Error(`v-for 的列表 \`${m[2]}\` 本台子没读出来`)
    return rows.map((r) => Object.fromEntries(vars.map((v, i) => [v, r[i]])))
  }

  const els = (n) => (n.children || []).filter((c) => c.type === 1)
  const out = []

  const content = els(node).find((c) => c.tag === 'n-drawer-content')
  if (!content) throw new Error('这个 n-drawer 里没有 n-drawer-content')
  out.push({
    role: 'drawer',
    placement: val(prop(node, 'placement'), 'drawer.placement') ?? 'right',
    size: val(prop(node, 'width'), 'drawer.width') ?? null,
    title: val(prop(content, 'title'), 'drawer.title') ?? null,
    closable: val(prop(content, 'closable'), 'drawer.closable') === true,
  })

  const body = els(content).find((c) => c.tag === 'div')
  if (!body) throw new Error('n-drawer-content 里没有那个 div')
  for (const el of els(body)) {
    const rows = vforRows(el)
    if (rows) for (const row of rows) out.push(button(el, row))
    else if (el.tag === 'n-button') out.push(button(el))
    else if (el.tag === 'n-popover') out.push(...popover(el))
  }
  return out

  function button(el, row) {
    const text = (el.children || [])
      .map((c) => (c.type === 2 ? c.content : c.type === 5 ? `{{${c.content.content}}}` : ''))
      .join('')
      .trim()
      // v-for 展开时把 `{{label}}` 换成当前那一项（`button(el, row)` 传进来的）
      .replace(/\{\{(\w+)\}\}/g, (all, name) => (row && name in row ? row[name] : all))
    return {
      role: 'button',
      text,
      // 静态 `type="warning"` → 'warning'；没写 → naive 的默认档 `default`
      type: val(prop(el, 'type'), 'button.type') ?? 'default',
      size: val(prop(el, 'size'), 'button.size') ?? 'default',
      cls: cls(prop(el, 'class'), 'button.class'),
      round: prop(el, 'round') !== undefined,
      wide: prop(el, 'block') !== undefined,
    }
  }

  function popover(el) {
    const trig = els(el).find((c) => c.tag === 'template')
    const inner = els(el).find((c) => c.tag === 'div')
    const rows = [
      {
        role: 'popover',
        placement: val(prop(el, 'placement'), 'popover.placement') ?? 'bottom',
        width: Number(val(prop(el, 'width'), 'popover.width')),
        trigger: val(prop(el, 'trigger'), 'popover.trigger') ?? 'hover',
      },
    ]
    for (const b of els(trig)) if (b.tag === 'n-button') rows.push(button(b))
    return rows
  }
}

/**
 * 数一个抽屉里 `n-switch` 的个数（连浮层里、连 `v-if` 里的都数）。
 *
 * ⚠️ 为什么开关只数个数、不逐条进清单：**我们的模板是静态 AST，`v-if` 看不见** ——
 *    旧版「全面屏」那个开关关态下压根不渲染、开态才多一颗，而我们的 AST 里永远有 3 颗。
 *    逐条比必然对不齐（本台子第一版就是列表长度都不一样）。所以：
 *      · 清单里**两边都不放**开关（`role` 只留 drawer/button/popover）；
 *      · 旧版按「开态 / 关态」各数一次（3 / 2），证明那个 `v-if` 的语义；
 *      · 我们数静态的 3，`v-if` 挂在哪由下面的源码断言管。
 */
function countSwitches(node) {
  let n = 0
  const walk = (x) => {
    if (x.type === 1 && x.tag === 'n-switch') n++
    for (const c of x.children || []) walk(c)
  }
  walk(node)
  return n
}

// ───────────────────────────────────────────────────────────────────────────
// 比对
// ───────────────────────────────────────────────────────────────────────────
const NAIVE2EP = { error: 'danger' } // 只有这一档改名，其余同名

/** 把我们的描述**还原成旧版口径**（见文件头四条口径）。 */
function oursToLegacy(d) {
  const x = { ...d }
  if (x.role === 'button') {
    const t = [].concat(x.type).map((v) => NAIVE2EP[v] ?? v)
    x.type = t.length === 1 ? t[0] : t
  }
  if (x.role === 'drawer') x.size = x.size == null ? null : String(x.size)
  return x
}

/** 清单里只留这三类；`el-switch` / 裸 `div` / 文本节点都不进（理由见 `countSwitches()`）。 */
const KEEP = new Set(['drawer', 'button', 'popover'])

/** 左边跑两遍（关 / 开），压成「开、关」两个状态各自的清单。 */
function legacySide(anchor, label) {
  const off = flatten(runDrawer(anchor, label, {})).filter((d) => KEEP.has(d.role))
  const on = flatten(
    runDrawer(anchor, label, { menuOpen: true, ping: true, diao: true, balance: true, assistive: true, fullscreen: true }),
  ).filter((d) => KEEP.has(d.role))
  if (off.length !== on.length) {
    throw new Error(`${label}: 开/关两种状态下控件数不同（${off.length} vs ${on.length}）—— 有 v-if 在改结构？`)
  }
  return { off, on }
}

/**
 * 把「开 / 关」两次观察合成一条：动态 type ⇒ `[开, 关]`，静态 ⇒ 单值。
 *
 * ⚠️ 这里**只**断言一件事：**关态下不该出现 ✓**。本台子第一版额外写了
 *    「开态下每颗按钮都必须长出 ✓」，那是**夹具自己与旧版口径不符** ——
 *    `H:13300-13310` 明摆着只有 `总余额显示` 和 `辅助菜单设置` 两处挂了
 *    `_0x2ffe36.value ? createElementBlock('span', …, '✓') : createCommentVNode()`，
 *    其余按钮开态照旧。照第一版那个写法，跑起来先在抽屉节点上就抛了
 *    （`开状态下缺 ✓：{"role":"drawer",…}`）。开态的勾改由下面两条**专项断言**管。
 */
function mergeStates({ off, on }) {
  return off.map((d, i) => {
    const o = on[i]
    const x = { ...d }
    if (d.role === 'button' && d.type !== o.type) x.type = [o.type, d.type]
    // 勾（✓）挂的是 v-if：关态没有，开态才有（仅上述两颗）
    const hasCheckOff = d.role === 'button' && d.text.endsWith('✓')
    if (hasCheckOff) throw new Error(`关状态下不该出现 ✓：${d.text}`)
    if (o.role === 'button' && o.text.endsWith('✓')) x.text = `${d.text} ✓`
    return x
  })
}

// ⚠️ 我们模板里 8 项是**静态**写的（✓ 挂 `v-if`，AST 上看不到）⇒ 用一个固定状态比对：
//    左边按「关」态取，只有 `辅助菜单设置` 的 ✓ 例外 —— 旧版它的 class 本身就是动态的。
//    所以比对时统一把 ✓ 去掉，另用下面两条**专项断言**补上「开态长什么样」。
const stripCheck = (d) =>
  d.role === 'button' ? { ...d, text: d.text.replace(/\s*✓$/, '') } : d

// Hui.vue 里一共 **3** 个 `n-drawer`：视频教程、添加门类、订单列表（`:width="760"`）。
// 前两个是本台子的对象；**订单列表不在这里比** —— 它是订单管理那条链路的，另有审计。
// 数量写死是为了当**金丝雀**：以后谁再加一个抽屉，这里会红，逼着他来确认归谁管。
const drawers = ourDrawerNodes()
if (drawers.length !== 3) {
  throw new Error(`Hui.vue 里 n-drawer 数量变了：${drawers.length}（预期 3：视频教程 / 添加门类 / 订单列表）`)
}
const addDrawer = drawers.find((n) => JSON.stringify(n).includes('导入上次订单'))
const videoDrawer = drawers.find((n) => JSON.stringify(n).includes('VIDEO_LINKS'))
if (!addDrawer || !videoDrawer) throw new Error('两个抽屉没认出来（锚点串变了？）')

const legacyAdd = legacySide('modelValue:_0x5b48c7', '添加门类')
const legacyVideo = // ⚠️ 锚点要用**混淆原文**（`a(949)`），不是 deobf 之后的 `"视频教程"` —— 切片发生在反混淆**之前**
legacySide('title:a(949),modelValue:_0x3b5987', '视频教程')

const failures = []
function cmp(label, want, got) {
  const a = JSON.stringify(want)
  const b = JSON.stringify(got)
  if (a !== b) failures.push(`${label}\n      旧版 ${a}\n      我们 ${b}`)
}

cmp('添加门类 · 控件清单', mergeStates(legacyAdd).map(stripCheck), normalizeOurDrawer(addDrawer).map(oursToLegacy))
cmp('视频教程 · 控件清单', mergeStates(legacyVideo).map(stripCheck), normalizeOurDrawer(videoDrawer).map(oursToLegacy))

// —— 专项断言一：勾（✓）只在开态、且**恰好两颗** ——
const addOn = mergeStates(legacyAdd)
const countCheck = (list) => list.filter((d) => d.role === 'button' && d.text.endsWith('✓')).length
if (countCheck(legacyAdd.off) !== 0) throw new Error('旧版关态不该有 ✓')
if (countCheck(legacyAdd.on) !== 2) throw new Error(`旧版开态应有 2 个 ✓，实得 ${countCheck(legacyAdd.on)}`)
if (!addOn.some((d) => d.text === '总余额显示 ✓')) throw new Error('开态应出现「总余额显示 ✓」')
if (!addOn.some((d) => d.text === '辅助菜单设置 ✓')) throw new Error('开态应出现「辅助菜单设置 ✓」')
// 我们那边是静态 AST，✓ / 全面屏都只能靠 `v-if` 表达 ⇒ 断言源码里那两个 `v-if` 真在。
for (const [needle, why] of [
  ['v-if="showTotalBalance"', '「总余额显示」的 ✓'],
  ['v-if="showAssistiveMenu"', '「辅助菜单设置」的 ✓'],
]) {
  if (!HUI_VUE_SRC.includes(needle)) throw new Error(`我们模板里找不到 ${needle} —— ${why}没接上`)
}
if (!/v-if="showAssistiveMenu"[\s\S]{0,40}class="fullscreen-row"/.test(HUI_VUE_SRC)) {
  throw new Error('「全面屏（不预留底部空间）」那一块没挂在 `showAssistiveMenu` 上 —— 旧版它是嵌套 v-if')
}

// —— 专项断言二：开关的**个数**（清单里不放开关，理由见 `countSwitches()`）——
function legacySwitchCount(anchor, label, opts) {
  let n = 0
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.k === 'vnode') {
      if (node.type === 'el-switch') n++
      const slots = node.children && typeof node.children === 'object' ? node.children : {}
      for (const v of Object.values(slots)) {
        for (const c of [].concat(typeof v === 'function' ? v() : v || [])) walk(c)
      }
      return
    }
    if (node.k === 'el') for (const c of [].concat(node.children || [])) walk(c)
  }
  walk(runDrawer(anchor, label, opts))
  return n
}
const SW_ADD = 'modelValue:_0x5b48c7'
const legacySwOff = legacySwitchCount(SW_ADD, '添加门类', {})
const legacySwOn = legacySwitchCount(SW_ADD, '添加门类', {
  menuOpen: true,
  ping: true,
  diao: true,
  balance: true,
  assistive: true,
  fullscreen: true,
})
if (legacySwOff !== 2) throw new Error(`旧版关态应有 2 个开关（总余额 / 辅助菜单），实得 ${legacySwOff}`)
if (legacySwOn !== 3) throw new Error(`旧版开态应有 3 个开关（多出「全面屏」），实得 ${legacySwOn}`)
const ourSwAdd = countSwitches(addDrawer)
if (ourSwAdd !== legacySwOn) {
  throw new Error(`「添加门类」抽屉的 n-switch 个数：我们 ${ourSwAdd}，旧版开态 ${legacySwOn}`)
}
const legacySwVideo = legacySwitchCount('title:a(949),modelValue:_0x3b5987', '视频教程', {
  videoOpen: true,
})
if (legacySwVideo !== 0 || countSwitches(videoDrawer) !== 0) {
  throw new Error(`「视频教程」抽屉不该有开关：旧版 ${legacySwVideo} / 我们 ${countSwitches(videoDrawer)}`)
}

// —— 专项断言三：「视频教程」9 条的名字与顺序（旧版是 9 个字面量，我们是 `VIDEO_LINKS`）——
const legacyVideoNames = mergeStates(legacyVideo)
  .filter((d) => d.role === 'button')
  .map((d) => d.text)
const ourVideoNames = VIDEO_LINKS_ROWS.map((r) => r[0])
cmp('视频教程 · 9 条名字与顺序', legacyVideoNames, ourVideoNames)

// ───────────────────────────────────────────────────────────────────────────
// 变异测试：把「我们」故意改坏，每个变异体都**必须**被抓到
// ───────────────────────────────────────────────────────────────────────────
const oursAdd = normalizeOurDrawer(addDrawer).map(oursToLegacy).map(stripCheck)
const MUTANTS = [
  ['少一颗（删「排序方式」）', (l) => l.filter((d) => d.text !== '排序方式')],
  // 「忘了还原」= 我们导出时**留着 naive 的 `error`**：静态档和三元数组里都得改到
  [
    '忘了把 naive 的 error 还原成 danger',
    (l) =>
      l.map((d) => {
        const t = [].concat(d.type).map((v) => (v === 'danger' ? 'error' : v))
        return { ...d, type: t.length === 1 ? t[0] : t }
      }),
  ],
  ['「导入上次订单」掉了 warning', (l) => l.map((d) => (d.text === '导入上次订单' ? { ...d, type: 'default' } : d))],
  ['文案多后缀（「平开门（已显示）」）', (l) => l.map((d) => (d.text === '平开门' ? { ...d, text: '平开门（已显示）' } : d))],
  ['抽屉宽度 200 → 240', (l) => l.map((d) => (d.role === 'drawer' ? { ...d, size: '240' } : d))],
  ['抽屉多一个关闭钮', (l) => l.map((d) => (d.role === 'drawer' ? { ...d, closable: true } : d))],
  ['摆动开关两档顺序反了', (l) => l.map((d) => (Array.isArray(d.type) ? { ...d, type: [...d.type].reverse() } : d))],
  ['「加价项目管理」丢了 orange-button', (l) => l.map((d) => (d.cls === 'orange-button' ? { ...d, cls: '' } : d))],
  ['「辅助菜单设置」丢了 custom-button-btn', (l) => l.map((d) => (String(d.cls || '').includes('custom-button-btn') ? { ...d, cls: '' } : d))],
  ['按钮不满了（丢了 block）', (l) => l.map((d) => (d.role === 'button' ? { ...d, wide: false } : d))],
  ['按钮变圆了（视频教程多了 round）', (l) => l.map((d) => (d.role === 'button' ? { ...d, round: true } : d))],
]
const mutantResults = MUTANTS.map(([name, mutate]) => [
  name,
  JSON.stringify(mutate(oursAdd)) !== JSON.stringify(oursAdd),
])
// 开关个数不在上面那份清单里（见 `countSwitches()`），单独当一条变异体：
// 「全面屏」那颗掉了 = 我们只剩 2 颗 ⇒ 必须与「旧版开态 3 颗」不符。
mutantResults.push(['「全面屏」那颗开关掉了（3 → 2）', ourSwAdd - 1 !== legacySwOn])

// ───────────────────────────────────────────────────────────────────────────
// 输出
// ───────────────────────────────────────────────────────────────────────────
const show = (title, list) => {
  console.log(`\n${title}`)
  for (const [i, d] of list.entries()) console.log(`  ${String(i).padStart(2)}. ${JSON.stringify(d)}`)
}
show('添加门类抽屉 —— 旧版口径（开态）', mergeStates(legacyAdd))
show('视频教程抽屉 —— 旧版口径', mergeStates(legacyVideo))

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
process.exit(ok ? 0 : 1)
