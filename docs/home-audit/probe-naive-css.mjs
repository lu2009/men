/*
 * 把 **Naive 真实生成的 CSS** 打出来 —— 用来核对选择器权重，别靠读它的 cssr 源码猜。
 *
 * 为什么要这个：`naive-ui` 的样式是 cssr（CSS-in-JS）写的，源码长这样
 *
 *     cB("data-table-tr", [ cNotM("summary", [ c("&:hover", "...", [ c(">", [ cB("data-table-td", "...") ]) ]) ]) ])
 *
 * 展开成真实选择器是
 *
 *     .n-data-table .n-data-table-tr:not(.n-data-table-tr--summary):hover > .n-data-table-td
 *
 * —— `:not(...)` 里的类**是要计入权重的**（(0,5,0)，不是 (0,3,0)），凭空读源码极容易算错。
 * Home 的「行状态底色」就踩在这上面：算错一格，「已加载+已展开」的行悬停不变色。
 *
 * 用法（任意目录）：node docs/home-audit/probe-naive-css.mjs
 *
 * 输出：与 `data-table-td` / `data-table-tr` 相关、且设置了 `background-color` 的每条规则原文，
 * 外加 `--n-merged-td-color-hover` 的定义处（含 modal / popover 变体）。
 *
 * ⚠️ 依赖从 `app/node_modules` 解析（本文件在 `docs/` 下，Node 的 ESM 解析是按**脚本所在目录**
 *    找 `node_modules` 的，直接 `import 'vue'` 会 ERR_MODULE_NOT_FOUND）。
 *    这里沿用本仓库既有口径：`createRequire` 指到 `app/` 再解析。
 */
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

// 仓库根从**本文件位置**推出（本文件在 `docs/home-audit/` ⇒ 往上**两级**才是仓库根）。
// 原来这里写死的是 `'/Users/aaa/Desktop/door-main'`：本机跑得通，换台机器或进 CI
// （checkout 路径不同）就直接崩。`docs/*.mjs` 那几个台子早就这么写了，差的正是这一层深度。
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const require_ = createRequire(`${ROOT}/app/`)
const load = (name) => import(pathToFileURL(require_.resolve(name)).href)

const { createSSRApp, h } = await load('vue')
const { renderToString } = await load('@vue/server-renderer')
const { setup } = await load('@css-render/vue3-ssr')
const { NDataTable } = await load('naive-ui')

const app = createSSRApp({
  render: () =>
    h(NDataTable, {
      columns: [{ title: '名称', key: 'name' }],
      data: [{ id: 1, name: 'x' }],
      rowKey: (r) => r.id,
    }),
})

// `setup(app)` 装上 cssr 的 SSR 适配器 ⇒ 组件渲染时把生成的样式收集进 `collect()`。
const { collect } = setup(app)
await renderToString(app)

// 粗切规则（够用：这些规则里没有 `}` 出现在声明值中的情况）。
const rules = collect()
  .split('}')
  .map((s) => s.trim())
  .filter(Boolean)

console.log('=== 背景色规则 ===')
for (const r of rules) {
  if (/data-table-td|data-table-tr\b/.test(r) && /background-color/.test(r)) console.log(r + '}')
}

console.log('\n=== --n-merged-td-color-hover 的定义处 ===')
for (const r of rules) {
  if (/--n-merged-td-color-hover/.test(r)) console.log(r.slice(0, 400) + '}')
}
