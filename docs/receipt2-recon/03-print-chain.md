# 收据单2 · 打印链路（2026-09-17）

**对象**：`legacy/js/Receipt2.deobfuscated.js`（组件 `Receipt2PrintManager`，2637 行）
**调用方**：`legacy/js/Home-d6b13b9a.js`（单行压缩 532KB）+ 格式化版 `legacy/js/Home.formatted.js`（12281 行）
**注意**：`Home-d6b13b9a.js` 是单行文件，本文对它的引用一律用 **字节偏移**（`@415965`）；对 `Home.formatted.js` 用 **行号**。字符串下标已用 `legacy/decode-home-map.mjs` 解出（`dr` = 主表解码器，offset 467；`Jo` = `_o` 别名，offset 338，组件内 `const l = _o`）。

---

## 0. 一页结论

| 路径 | 入口 | 打印载体 | 走的引擎 |
|---|---|---|---|
| `printDirect()` | 组件 expose，**Home 从未调用** | 从数据重建 HTML → iframe | 浏览器 `window.print()` |
| `exportReceipt2PdfToBrowserPrint()` = 内部 `ye` | 同上 | 同上 | 同上 |
| `printFromContainer(container)` | Home「打印」按钮 | clone 预览 DOM → iframe | 浏览器 `window.print()` |
| `printSilent(container)` | Home「直接打印」按钮 | clone 预览 DOM → iframe HTML 字符串 | **Electron IPC** `electronAPI.silentPrint` |

**收据单2 完全自绘，与 hiprint / 云打印 / socket 无关**（第 9 节）。
**三条路径的「纸」都不是浏览器纸型，而是 CSS 自己画的**：`@page { size: …; margin: 0 }` + `.receipt2-page` 固定 mm 尺寸 + `padding: 4mm 4mm 3mm`。
**浏览器原样复刻完全可行**，去掉的只有第 3 节那一条 Electron 路径和第 6 节那一块 UI（第 10 节给了清单）。

---

## 1. 三条路径总览与「什么时候走哪条」

**CONFIRMED** — Home 里 `ic.value === 12` 表示当前预览的是收据单2。工具栏按钮（`Home.formatted.js:11648–11672`，`Home-d6b13b9a.js@608332` 起）：

```
ic==12 → 「直接打印」 onClick:Ji   →  Xn.value.printSilent(ao.value)
ic==12 → 「打印」     onClick:_i   →  Xn.value.printFromContainer(ao.value)
ic==12 → 「字体调节」 onClick:vi   →  Xn.value.openFontDialog()
ic==12 → 「编辑收据单 / 完成编辑」 onClick:Ri
```

- `_i`（`Home.formatted.js:9836`，`@415965`）：
  ```js
  if (!Xn.value) return ElMessage.error("收据单2组件未就绪")
  await Xn.value.printFromContainer(ao.value)   // ao = 预览容器 ref
  ```
  **注意 `printFromContainer` 是唯一一个能走到浏览器打印的「收据单2」入口。**

- `Ji`（`Home.formatted.js:9829`，`@516008`）：
  ```js
  if (await Xn.value.printSilent(ao.value)) { /* 关预览、刷新列表 */ }
  ```
  **CONFIRMED**：这里**没有** `isElectronEnv` 判断——判断在 `printSilent` 内部（不满足时弹 warning 并 return false）。所以在浏览器里这个按钮仍然显示，点了只弹一条「直接打印仅在 Electron 客户端可用」。

对比「生产单2」（ic==15）的「直接打印」按钮：
`Fr = async()=>{ … if (t.isElectronEnv) l = await t.printSilent(); else { await t.printDirect(); l = true } … }`（`Home.formatted.js:8457`，`Home-d6b13b9a.js@361840`）。
玻璃合片单2 也是同一套（`di`，`Home.formatted.js:8508`，`Home-d6b13b9a.js@363534`，else 分支换成了 `buildGlassSheet2Html`）。

**收据单2 没有这个二选一封装**——它把两条路做成了两个并列按钮（`Ji` / `_i`）。原因很可能是 `printSilent(container)` 需要容器参数、而其它组件的 `printSilent()` 是零参（自己内部重新生成 HTML），签名不同；`printDirect()` 又是从零重建 HTML，做不到「按当前预览原样打」。

`ao`（`Home.formatted.js:7652` 的 `ao = Vue.ref(null)`）是 Home 预览区 `ref_key: 'previewContainer'` 的 DOM 元素，即 `<div class="receipt2-root"><style>…</style>…页面…</div>`。
`Xn`（收据单2 组件 ref）定义在 `Home.formatted.js:8266`。

---

## 2. `printFromContainer(container)` 逐步

**CONFIRMED** — `Receipt2.deobfuscated.js:1226–1270`

| # | 步骤 | 代码 |
|---|---|---|
| 1 | 空守卫 | `if (!e) return;` |
| 2 | 归一化字体设置 | `o = Z(v.value)`（`v` = 已提交的 fontSettings）|
| 3 | **深克隆预览容器** | `a = e.cloneNode(true)` |
| 4 | 剔除缩放手柄 | `a.querySelectorAll(".r2-resize-handle").forEach(el => el.remove())` |
| 5 | **拼 HTML 字符串** | `'<!DOCTYPE html><html><head><meta charset="utf-8"><title>收据单2</title>\n    <style>html,body{margin:0;padding:0;background:#fff;}' + ue(o, X(h.value)) + '</style>\n  </head><body><div class="receipt2-root">' + a.innerHTML + '</div></body></html>'` |
| 6 | 建 iframe | `document.createElement("iframe")`，`style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;"`，`document.body.appendChild(it)` |
| 7 | 取文档 | `r = it.contentWindow; i = it.contentDocument \|\| r.document` |
| 8 | `i.open()` → `i.write(html)` → `i.close()` | 同源 `document.write` |
| 9 | **等所有 img** | 收集 `i.querySelectorAll("img")`；0 张直接 resolve；否则计数，`img.complete ? 立即计 : onload=onerror=计`，凑齐才 resolve |
| 10 | `setTimeout(…, 500)` | 500ms 后： |
| 11 | `r.focus(); r.print()` | 焦点给 iframe 的 window，再调 print |
| 12 | 内层 `setTimeout(…, 1000)` | 1000ms 后 `document.body.contains(it) && document.body.removeChild(it)` |

**没有** `await document.fonts.ready`（`copyPreviewToClipboard` / `exportPreviewToPdf` 有，打印没有）。
**没有** 复制任何 `<link>` 或外部样式表；`<style>` 是纯字符串内联。
**没有** 读 `copies`。
**没有** `.r2-page-wrap` 包装（对比第 3 节 `printSilent` 有）——见第 5 节的横向隐患。

---

## 3. `printSilent(container)` 逐步（Electron 专属）

**CONFIRMED** — `Receipt2.deobfuscated.js:1271–1336`

| # | 步骤 | 代码 |
|---|---|---|
| 1 | 环境守卫 | `if (!W.value) return ElMessage.warning("直接打印仅在 Electron 客户端可用"), false` |
| 2 | 容器守卫 | `if (!e) return ElMessage.error("预览容器未就绪"), false` |
| 3 | 全屏 loading | `ElLoading.service({lock:true, text:"正在发送到打印机...", background:"rgba(0,0,0,0.7)"})` |
| 4 | 归一化 | `l = Z(v.value)`（字体）、`o = X(h.value)`（纸张，含 copies） |
| 5 | 克隆 + 去手柄 | 同 `printFromContainer` |
| 6 | **横向时插包装层** | `if (o.orientation === "landscape")` 对每个 `.receipt2-page`：新建 `<div class="r2-page-wrap">`，`page.parentNode.insertBefore(wrap, page)`，`wrap.appendChild(page)` |
| 7 | 拼 HTML | 与 `printFromContainer` 同一模板（缩进细节略不同），同样只有内联 `<style>` |
| 8 | 算物理尺寸 | `u = o.orientation === "landscape"`；`pageWidthMm = u ? o.heightMm : o.widthMm`；`pageHeightMm = u ? o.widthMm : o.heightMm` |
| 9 | **IPC** | `await window.electronAPI.silentPrint(html, H.value \|\| "", { landscape: false, copies: o.copies, pageWidthMm, pageHeightMm })` |
| 10 | 反馈 | `res.success` → success「收据单2已发送至打印机：{printer \|\| 系统默认}」，return true；否则 error「打印失败：{reason \|\| 未知错误}」，return false |
| 11 | finally | `loading.close()` |

要点：

- **`landscape: false` 是恒定的**（`Receipt2.deobfuscated.js:1311`）。横向不是交给 Electron，而是**在第 6 步把每页包一层，再用 CSS 把内容转 -90° 塞进纵向纸**（第 5 节）。其它单据组件是 `landscape: paper.widthMm > paper.heightMm`（`Home-d6b13b9a.js@242608`），收据单2 不一样。
- **`pageWidthMm/pageHeightMm` 在横向时是交换过的**，正好等于 `@page { size: A B }` 里的 `A B`。
- **IPC 只发一次**，不是每页一次。对比「标签」组件是 `for` 循环逐张 `silentPrint` 并显示「第 N/M 张打印中…」（`Home-d6b13b9a.js@192965`）。
- 打印完**不清理**（没有 iframe，HTML 是纯字符串直接交给主进程）。

### `isElectronEnv` 怎么判定

**CONFIRMED** — `Receipt2.deobfuscated.js:212`

```js
W = Vue.computed(() => !!window["electronAPI"])
```

全库只有这一种判定：`Home-d6b13b9a.js` 里 `userAgent` 出现 **0 次**，`Electron` 字样只出现在提示文案里。所以判据就是「preload 有没有挂 `window.electronAPI`」。

---

## 4. `printDirect()` 与它调用的 `ye()`

### `printDirect` —— **收据单2 的 `printDirect` 是死代码**

**CONFIRMED** — `Receipt2.deobfuscated.js:1113–1137`

```js
printDirect: async () => {
  const t = {
    fontSettings:   { ...v.value },     // 已提交字体
    columnWidths:   [...n.value],        // 10 列宽度百分比
    printSettings:  { ...h.value },      // 纸张 + copies
    printer:        H.value || "系统默认",
  };
  JSON.stringify(t, null, 2);           // ← 结果被丢弃（原版遗留的调试语句）
  const o = ElLoading.service({ lock:true, text:"正在生成收据单2..." });
  try { await ye(); ElMessage.success("收据单2已打开浏览器打印"); }
  catch (a) { ElMessage.error("收据单2打印失败: " + (a?.message || a)); }
  finally { o.close(); }
}
```

**入参**：无。团队 lead 描述里「打包了 fontSettings/columnWidths/printSettings/printer 的对象」——**CONFIRMED 存在，但它是函数内的局部变量 `t`，唯一用途是 `JSON.stringify` 后丢弃**（第 1121 行，返回值没被赋值给任何东西）。它不是入参、不参与打印、不影响输出。原文大概是开发期的 debug 快照，发布时没删。

**是否被外部调用**：**没有**。在 `Home-d6b13b9a.js` 全文搜 `printDirect`，命中 6 处 —— 5 处是定义、1 处是调用：
- `@113673` 收据单2 自身定义（**就是本节这个**）
- `@152998` 标签
- `@203126` 生产单
- `@241597` 生产单2
- `@279475` 玻璃合片单
- `@363534` `si` —— **唯一的调用点**，但它绑的是玻璃合片单的 ref

即 `Er` / `Hr` / `Rr` / `si` 四个调用点，每个都绑在**非收据单2**的 ref 上：
- `Er`（`Home.formatted.js:8304`）→ `fr`（标签）
- `Hr`（`:8432`）→ `Ir`（生产单）
- `Rr`（`:8453`）→ `jr`（生产单2）
- `si`（`Home.formatted.js:8504`，`Home-d6b13b9a.js@363534`）→ `li`（玻璃合片单2，因为同一段 `di`（`:8508`）里用的是 `li.buildGlassSheet2Html`）

⇒ **`Xn.value.printDirect()` 这个调用在全库不存在。** 收据单2 的浏览器打印走的是 `printFromContainer`，不是 `printDirect`。

### `ye`（= expose 出来的 `exportReceipt2PdfToBrowserPrint`）

**CONFIRMED** — `Receipt2.deobfuscated.js:740–804`

它是另一条**不依赖预览 DOM** 的浏览器打印路径：

1. `_()` 取全部订单（`props.getCustomers()`）
2. 对每单 `await we(order, fontSettings)` → 分页后的 `.receipt2-page` HTML 数组（`we` = 行高测量 + 贪心分页，见第 5 节）
3. 拼 `<!DOCTYPE html>…<style>html,body{…}` + `ue(o, X(h.value))` + 页面 HTML
4. iframe（同上 `visibility:hidden` 0×0）+ `open/write/close`
5. 等 img 加载（同 `printFromContainer`）
6. `setTimeout(500)` →
   - **额外一步**：对 `i.querySelectorAll("[data-shrink-fit]")` 逐个**缩字号**——清 `fontSize` → 量 `getBoundingClientRect().width` → `scrollWidth > width+1` 就以 0.5px 递减，下限 `max(6, 0.5*原字号)`。只对「客户/电话/安装地址」三个 `<span data-shrink-fit>` 生效（`Receipt2.deobfuscated.js:522/528/534`）。
   - `r.focus(); r.print()`
   - 内层 `setTimeout(1000)` 移除 iframe

**关键差别**：`printFromContainer` **没有**这一段缩字。原因是它克隆的是预览 DOM，预览里这些 span 已经被同一套逻辑处理过（预览侧另有一处），而 `ye` 是从零重建 HTML，必须在 iframe 里补做一次。

---

## 5. 页边距 / 布局计算

### 5.1 结论先行：**没有「纸型 → 边距」对照表**

**CONFIRMED** — 全组件搜 `margin` / `padding`：

- 唯一的页面外边距是 `@page { size: …; margin: 0 }`（`Receipt2.deobfuscated.js:417–421`）
- 唯一的页面内边距是 `.receipt2-page { padding: 4mm 4mm 3mm; }`（`:376`）——**与纸型无关，恒定**
- 其余是元素级固定值：`.receipt2-header{margin-bottom:2mm}`、`.receipt2-meta-row{gap:1.5mm;margin-bottom:1.5mm}`、`.receipt2-table{margin-bottom:1.5mm}`、`.receipt2-table th,td{padding:1mm 0.8mm}`、`.receipt2-amounts{margin-bottom:1.2mm}`、`.receipt2-declaration{padding-top:1.2mm}`、`.receipt2-qrcode{18mm×18mm}`

**与「标签」组件不同**：那个的 paper 配置里有 `paddingMm` 字段（见 `docs/2026-09-16-print-font.md` §3 的 `paper: {widthMm, heightMm, orientation, paddingMm}`）。**收据单2 的 `X()` 归一化里没有 `paddingMm`，设置弹窗里也没有这项控件**（`Receipt2.deobfuscated.js:290–306` 与 `1628–1709`）。

### 5.2 纸型预设表（`d`，`Receipt2.deobfuscated.js:25–50`）

| key | 按钮文案（`:1724–1868`） | widthMm | heightMm | orientation |
|---|---|---|---|---|
| `pin-210-140` | 210×140 | 210 | 140 | landscape |
| `pin-200-140` | 200×140 | 200 | 140 | landscape |
| `pin-210-90` | 210×90 | 210 | 90 | landscape |
| `pin-200-90` | 200×90 | 200 | 90 | landscape |
| `a4-landscape` | A4横向 | 297 | 210 | landscape |
| `a4-portrait` | A4纵向 | 210 | 297 | portrait |
| `a5-landscape` | A5横向 | 210 | 148 | landscape |
| `a5-portrait` | A5纵向 | 148 | 210 | portrait |
| （默认/出厂 `s`，`:24`） | — | **200** | **140** | **landscape** |

点按钮 → `V(key)`（`:51–57`）把这三项写进草稿 `p`；确定时 `he`（`:817–849`）经 `X(p)` 归一化后落到 `h` 并写 `localStorage["receipt2_print_settings"]`。

`X(e)`（`:290–306`）范围：`copies 1–99 默认1`、`widthMm 50–500 默认200`、`heightMm 50–500 默认140`、`orientation` 只接受 `"landscape"`/`"portrait"`，否则按 `widthMm >= heightMm ? "landscape" : "portrait"` 推。UI 控件：宽/高 `el-input-number min=50 max=500 step=1`（`:1628–1676`），方向 `el-select`（`:1677–1707`）。

### 5.3 纸型 → 打印几何（这才是「按纸型算」的部分）

`ue(fontSettings, printSettings)` 里（`:371–438`），设 `W = widthMm`、`H = heightMm`：

**`@page`**（与方向无关地交换）：

| orientation | `@page size` | `margin` |
|---|---|---|
| landscape | `H mm  W mm`（**交换**，物理上是纵向纸） | 0 |
| portrait | `W mm  H mm` | 0 |

**`@media print` 里的横向块**（仅 landscape 时注入）：

```css
.receipt2-root { display:block !important; background:#fff !important; padding:0 !important; gap:0 !important; }
.r2-page-wrap { width: Hmm !important; height: Wmm !important; overflow:hidden !important;
                position:relative !important; page-break-after: always !important; }
.r2-page-wrap:last-child { page-break-after: auto !important; }
.receipt2-page { position:absolute !important; top:0 !important; left:0 !important;
                 width: Wmm !important; height: Hmm !important;
                 transform-origin: top left !important;
                 transform: translateY(Wmm) rotate(-90deg) !important;
                 box-shadow:none !important; page-break-after: auto !important; }
```

即：**横版 = 把 W×H 的内容逆时针转 90° 塞进一张 H×W 的纵向纸**。验算 `transform: translateY(Wmm) rotate(-90deg)`（CSS 右先左后）：元素 (0,0)-(W,H) 先 rotate(-90°) → x∈[0,H], y∈[-W,0]，再 `translateY(W)` → x∈[0,H], y∈[0,W]，正好铺满 `@page size: Hmm Wmm`。

**`@media screen` 里**：`.receipt2-root{background:#c0c0c0; padding:12mm; display:flex; …gap:8mm}`、`.receipt2-page{box-shadow:…}`、`[data-r2-el]:hover{outline:2px dashed #409eff}`。

### 5.4 被误认成「页边距」的 `i`

团队 lead 提到的 `(e)=>{const t=l; switch(e){case "pin-210-140": … }}` 在 **`Receipt2.deobfuscated.js:667–692`**。

**它不是边距函数，是分页算法的 1px 修正量。** 逐行读：

```js
// we(order, fontSettings)：行高测量 + 贪心分页   :615 起
const { rowHeights: n, availNoFooter: u, availWithFooter: r } = await <测量 Promise>
//   测量：离屏插入一份 .receipt2-page（带 ue() 样式），量
//     i = 整页渲染高 px
//     c = 页宽 px * (H/W)          ≈ 整页高 px
//     s = 页脚(.receipt2-declaration) 高 px
//     d = 每个 <tr> 的高 px[]
//     V = i - Σd - s               = 页眉等非行高度
//     availNoFooter  = c - V
//     availWithFooter= c - V - s
i = ((e) => { const t = l;
      switch (e) {
        case "pin-210-140": case "pin-200-140":            return 0;
        case "pin-210-90":  case "pin-200-90":             return 1;
        case "a4-landscape": case "a4-portrait": default:  return 0;
      }})( <纸型探测> )
c = Math.max(0, u - i);   // 无页脚可用高
s = Math.max(0, r - i);   // 有页脚可用高
```

纸型探测（`:682–692`）：把 `X(h.value)` 与 `d` 的 8 个预设逐一比，`Q(a,b) = Math.abs(a-b) <= 2`（±2mm 容差，`:307`），命中第一个就返回 key，都不中返回 `"custom"`。

⇒ **`i` 的真实语义**：纸型 key → **在可用高度上减 0/1 px**。只有 `pin-210-90` / `pin-200-90` 这两种 90mm 高的窄纸减 1px，其余（含 `a5-*` 落到 default）减 0。对照表如下：

| 纸型 key | `i` |
|---|---|
| `pin-210-140` | 0 |
| `pin-200-140` | 0 |
| `pin-210-90` | **1** |
| `pin-200-90` | **1** |
| `a4-landscape` | 0 |
| `a4-portrait` | 0 |
| `a5-landscape`（未列出 → default） | 0 |
| `a5-portrait`（未列出 → default） | 0 |
| `"custom"`（未列出 → default） | 0 |

**INTERPRETED**：这是给 90mm 纸留 1px 防溢出的补丁，量级是像素不是毫米，**与边距无关**。`a5-*` 明显是被漏写的（本意大概是也想给 ≥1），但值为 0 不会出错。

### 5.5 横向 + 多页：两条浏览器路径缺包装层（**潜在缺陷**）

**CONFIRMED（代码事实）**：`.r2-page-wrap` 只由 `printSilent` 插入（`:1293–1302`）。
`printFromContainer`（`:1226–1270`）和 `ye`（`:740–804`）**都不插**。

**INTERPRETED（据 CSS 推演，未实机验证）**：横向时 `@media print` 把 `.receipt2-page` 设成 `position:absolute; top:0; left:0` 且 `page-break-after: auto !important`。没有 `.r2-page-wrap` 承担 `page-break-after: always`，多于一页时**所有页会重叠在同一张纸上**。纵向（portrait）路径不受影响，因为 `.receipt2-page` 保留 `page-break-after: always`（`:375`）。

⇒ 若要新版兼容旧版，浏览器路径的横向多页**要么照 `printSilent` 补包装层，要么干脆也走「每页绝对定位 + 自己算分页」**。这一条需要实机验证后再定，见第 11 节。

---

## 6. 打印机枚举与选择（**全部 Electron 专属**）

变量组（`Receipt2.deobfuscated.js:212–238`）：

| 变量 | 行 | 含义 |
|---|---|---|
| `W` | `:212` | `isElectronEnv` = `computed(() => !!window.electronAPI)` |
| `O` | `:213` | `ref([])` 打印机数组（**内存态，不持久化**） |
| `H` | `:214` | `ref("")` 当前选中的打印机 **name**（空串 = 系统默认） |
| `G` | `:215` | `ref(false)` 刷新按钮 loading |
| `j` | `:216–221` | `localStorage.setItem("receipt2_selected_printer", H.value)`，`try/catch` 吞异常 |
| `q` | `:222–234` | 刷新：`if (!W.value) return; G=true; O.value = await window.electronAPI.getPrinters(); catch → ElMessage.error("获取打印机列表失败"); finally G=false` |
| `J` | `:235–238` | `if (W.value && O.value.length === 0) await q()` —— 挂在设置弹窗 `onOpen: J`（`:1369`） |

**数据来自哪**：`window.electronAPI.getPrinters()`（`Home-d6b13b9a.js@144359` 同款）。**每项的字段（由模板用法反推，CONFIRMED）**：`{ name, displayName, isDefault }` —— 选项 `value: item.name`、`label: item.isDefault ? item.displayName + "（默认）" : item.displayName`（`:2294–2313`）。

**存在哪**：
- 列表 `O`：只在内存，每次开弹窗若为空才拉一次（`J`），另有「刷新打印机列表」按钮手动 `q`（`:2334–2355`）。
- 选择 `H`：localStorage 键 **`receipt2_selected_printer`**（`Va`，`Home-d6b13b9a.js@95571` 的 `Va=_o(672)` → 解出该字面量）。挂载时读（`:1090–1095`），`el-select` 的 `onChange: j` 时写（`:2286`）。

**UI**（`:2269–2368`，整块被 `W.value ?` 包住，**非 Electron 完全不渲染**）：

```
el-form-item label="打印机设置"   ← 节标题
el-form-item label="选择打印机"
  el-select  v-model=H  placeholder="使用系统默认打印机"  clearable  onChange=j  width:100%
    el-option  v-for=O  :label=(isDefault? displayName+"（默认）" : displayName)  :value=name
el-form-item
  el-button size=small :loading=G @click=q   「刷新打印机列表」
  <span>已选：{{ H || "系统默认" }}</span>
```

`H` 的最终去处只有一处：`printSilent` 的第 2 个 IPC 实参（`:1310` `H.value || ""`）。**浏览器路径完全不用它**（`printer: H.value || "系统默认"` 那次出现是 `printDirect` 里被 `JSON.stringify` 丢掉的死对象，`:1119`）。

---

## 7. 份数 `copies`

**CONFIRMED**

| 环节 | 位置 | 值 |
|---|---|---|
| 出厂默认 | `:24` | `s = { copies: 1, widthMm: 200, heightMm: 140, orientation: "landscape" }` |
| 归一化范围 | `:290–292` `K(e.copies, 1, 99, 1)` | **1–99**，非有限数回落 1 |
| UI 控件 | `:2370–2396` | `el-input-number min=1 max=99 step=1`，label「打印份数」，同样被 `W.value ?` 包住 |
| 持久化 | `:841` | `localStorage["receipt2_print_settings"]`（与纸张同一个对象，`he` 提交时写） |
| 消费点 | `:1312` | **只有一处**：`electronAPI.silentPrint(html, printer, { …, copies: o.copies, … })` |

**多份是循环还是交给打印机**：**交给打印机**（Electron 主进程）。
- 收据单2 的 `printSilent` 对 `copies` 只做参数透传，**没有循环**。
- 对比「标签」组件是**逐张循环**（`for (let o=0; o<u.length; o++) { … await silentPrint(单张html, …) ; 显示 "第(o+1)/N张打印中…" }`，`Home.formatted.js` 附近 `@192965`）——那是「多个标签项」而不是「份数」。
- **浏览器两条路径完全不读 `copies`**（`printFromContainer` / `ye` 全文无 `copies`）。浏览器里份数只能由用户在系统打印对话框里自己选。因此在新版（不接 Electron）里，这个设置项对浏览器打印**无意义**，应当隐藏或改文案。

---

## 8. `@page` 与 CSS 注入 —— 旧版怎么保证 iframe 里一定有样式

**CONFIRMED** — 旧版**没有**用 `print-lock.css`，**没有**任何 `<link>`，**没有**引用 hiprint。

三条打印路径注入的样式，**完全相同的一份**——**一个** `<style>` 块，内容是「一段固定 CSS」+「`ue()` 的返回值」直接拼接：

```html
<style>html,body{margin:0;padding:0;background:#fff;}«ue(fontSettings, printSettings) 的完整 CSS»</style>
```

- `printFromContainer`：`:1232–1237`
- `printSilent`：`:1304`
- `ye`：`:750`
- （分页测量用的离屏节点也吃同一份：`we` 里 `l.innerHTML = "<style>" + ue(g, X(h.value)) + " #r2mp{height:auto!important;overflow:visible!important} #r2mf .receipt2-declaration{flex:0 0 auto!important;min-height:0!important}" + …`，`:633–644` —— 那两条 `!important` 是为了让测量节点**不被裁剪、页脚不被压缩**，量出的行高才是真值）

`ue` 返回的是一整段**自足**的 CSS：`* { box-sizing }`、`.receipt2-root`（含 `font-family: "Microsoft YaHei", "PingFang SC", sans-serif`）、`.receipt2-page`、header / meta / table 及其 10 列宽度、amounts、declaration、`@page`、`@media print`、`@media screen`。

**这就是旧版不会「实打白纸」的原因**：
样式是**字符串内联**、与 `document.write` 同一次写入 iframe。不存在「外部样式表还没加载完就 `print()`」的竞态，也不依赖父页面（预览页）挂的任何样式表。而新版的坑（`docs/2026-09-16-print-font.md` §1）恰恰是 hiprint 那条路：它要把 `link[media=print][href*="print-lock"]` 从**父文档**里 XHR 拉出来再塞进 iframe（`vue-ade658be.js@2779245` / `@3099975`），一旦 `index.html` 没引入 `print-lock.css`，hiprint 的 `print2` 直接 `throw`、`printByHtml2`/`hiwprint` 则静默无样式。

**两条路的差别一句话**：
- hiprint 单据 = 从**父文档**借样式表 → 父文档缺 `<link>` 就白纸。
- 收据单2 = **自带**样式字符串 → 父文档是什么样都无所谓。

**另外要注意**：`printFromContainer` / `printSilent` / `ye` 都**没有** `await document.fonts.ready`，只等 `<img>`。字体栈写死在 `.receipt2-root` 上（`Microsoft YaHei` → `PingFang SC` → `sans-serif`），所以实打与预览的字体差异风险比 hiprint 单据小得多（后者 16/17 张模板没写 `fontFamily`，会落回浏览器默认）。

---

## 9. 有没有走 hiprint / socket.io 云打印

**没有。收据单2 与 hiprint、云打印、socket 完全无关。CONFIRMED，三条独立证据：**

1. **组件源码里零命中**。在 `Home-d6b13b9a.js` 的收据单2 组件区间 `[95655, 147500)` 内搜
   `hiprint` / `hiwprint` / `print-lock` / `printService` / `PrintService` / `getHtml` / `hiwebSocket`
   → **全部 -1**。
   组件用到的打印机制只有：`document.createElement("iframe")` + `document.write` + `contentWindow.print()`，以及 `window.electronAPI.{getPrinters,silentPrint}`。图像/PDF 另用 html2canvas + jsPDF（见第 11 节）。

2. **`ic == 12` 分支上没有云打印按钮**。工具栏那两颗按钮的渲染条件（`Home.formatted.js:11648`、`:11652`）是
   `12!==ic && 13!==ic && 14!==ic && 15!==ic && 16!==ic`，
   即 **ic∈{12..16} 全部不显示「云打印」和「手动打印」**。

3. **即便被调到，ic==12 也走本地**。
   - 「云打印」`Zc`（`Home.formatted.js:10652`）的兜底 else 里：`if (12==ic.value) return L.close(), void(await Xn.value.exportPreviewToPdf(ao.value))`（`:10860`）—— 走 **jsPDF 本地导出**，不是 `It.commentPreview`/`It.exportToPDF`（那才是 hiprint 云打印，`It` = `printService-48210c48.js`）。
   - 「手动打印」`Qc`（`Home.formatted.js:10911`）的 ic 分支只有 **1–11**，根本没有 12。

**`8.5 socket.io`**：`Home-d6b13b9a.js` 里 `socket` 出现 **0 次**（`grep` 命中数为 0）。`hiwebSocket` 只存在于 `vue-ade658be.js` 里的 hiprint 库内部。

**旁证**：`printService-48210c48.js` / `mutilPrintService-0d5f4920.js` / `printConnector-24e8e9dc.js` / `setting-872a24e9.js` 这几个文件确实含 hiprint 与 `print-lock`，但 Home 只把它们用于**其它**单据（`It.commentPreview` / `It.print` / `It.printProduct` / `It.exportToPDF` / `Ut.transitPrintSingle` 等，分布在第 8234–11137 行的非 12 分支里），跟收据单2 不沾边。

---

## 10. 浏览器里能原样复刻吗

**能。** 逐条拆：

### 可以直接照搬（纯浏览器 API，无 Electron 依赖）

| 能力 | 依据 |
|---|---|
| 「打印」按钮 → `printFromContainer(容器)` | 全程 `cloneNode` / `createElement("iframe")` / `document.write` / `contentWindow.print()`，`:1226–1270` |
| iframe 自足样式（`ue()` 字符串 + `document.write`） | `:371–438`、`:1233` |
| 等图片再打印、`focus()` + `print()`、500ms/1000ms 两段 `setTimeout` | `:1247–1269` |
| `@page { size; margin:0 }` + `.receipt2-page` 固定 mm + `padding: 4mm 4mm 3mm` | `:376`、`:417–421` |
| 横向 = 交换 `@page` 尺寸 + `translateY(Wmm) rotate(-90deg)` | `:424–437` |
| 纸型预设 8 种 + 宽高范围 50–500 + 方向 | `:25–50`、`:290–306` |
| 从数据重建 HTML 那条路（`ye` / 缩字兜底） | `:740–804`，全程浏览器 API |
| 分页算法（行高测量 + 贪心打包 + `i` 修正） | `:615–721`，`requestAnimationFrame` + `getBoundingClientRect` |

### Electron 专属，去掉后消失

| 能力 | 位置 | 去掉后的形态 |
|---|---|---|
| `isElectronEnv` | `:212` | 恒 `false` |
| `getPrinters` 打印机组 + `receipt2_selected_printer` | `:222–238`、`:1090–1095`、`:2269–2368` | 整块 UI 不渲染（已被 `W.value ?` 包住，天然降级），存储键也不再写 |
| 「直接打印」按钮（`printSilent`） | `:1271–1336`、Home `Ji` | 按钮可保留但点了只弹 warning；**建议新版直接不渲染这颗按钮** |
| `copies` | UI `:2370–2396`、参数 `:1312` | 浏览器路径本就忽略它；建议隐藏或改文案「份数请在打印对话框中设置」 |
| `.r2-page-wrap` 包装层 | `:1293–1302` | 只服务 Electron 的横向多页；**若浏览器路径要打横向多页，需要把它搬过来**（见 §5.5） |

### 去掉 Electron 后的最小可用集合

```
printFromContainer(容器)   ← 「打印」按钮，唯一必需
ue(fontSettings, paper)    ← 样式字符串
we / me / ge               ← 分页与 HTML 生成（printFromContainer 用不到 we，因为它克隆预览 DOM；
                             但如果要脱离预览 DOM 打印，就需要 ye 那条路）
```

**注意**：`printFromContainer` 依赖「预览 DOM 里已经带好 `data-r2-el` 内联样式」。如果新版打算**不看预览、直接打印**，就得用 `ye` 那条路（从数据重建），并**记得补 `[data-shrink-fit]` 缩字**——否则客户名过长会溢出，这正是 §4 里 `printFromContainer` 不需要、`ye` 必须做的那一步。

---

## 11. 未确认

以下几条我读不出来或无法只靠静态阅读定论，**没有猜着填**：

1. **`electronAPI.getPrinters()` / `silentPrint()` 的实现与契约**。
   Electron 主进程/preload 代码不在 `legacy/js` 里，全库也搜不到 `electronAPI` 的任何定义（只有 6 处调用）。因此：
   - 打印机组里除了 `name` / `displayName` / `isDefault` 还有没有别的字段 —— 未知（模板只用了这三个）。
   - `silentPrint` 返回的 `{ success, reason }` 以外还有什么 —— 未知。
   - `pageWidthMm` / `pageHeightMm` 主进程怎么用（是否转成打印机 DEVMODE / 是否只作参考）—— 未知。
   - `landscape: false` 恒定值是否被主进程读 —— 未知。可以确定的是**代码里就是常量 `false`**，旋转由 CSS 负责。
   - 打印机 name 用什么编码传主进程（Windows 上中文打印机名是否会乱码）—— 未知。

2. **横向多页在浏览器路径下是否真的重叠**（§5.5）。
   这是我从「`.r2-page-wrap` 只在 `printSilent` 里插」+「`@media print` 横向块把 `.receipt2-page` 设成 `position:absolute` 且 `page-break-after:auto !important`」推出来的。**没有实机打印验证**。也可能是浏览器对 `position:absolute` + `page-break-after:auto` 的处理与我预期不同。建议实现时用 3 页以上的横向单据实打一次再定。

3. **`i`（纸型 0/1 修正，`:667–692`）的设计意图**。
   能确定的是它减 0 或 1 **像素**、只对 `pin-*-90` 返回 1。但「为什么是 90mm 高的纸」「为什么 1px」「为什么把 `a5-*` 漏成 default」都读不出来，也没有注释。**不影响复刻**（照抄即可，或直接取 0 也不会差 1px 以外的东西）。

4. **`printDirect` 里 `JSON.stringify(t, null, 2)`（`:1121`）的返回值被丢弃**。
   我 100% 确认它没被赋值、没被打印、没被传出去。但**无法确认原始意图**——推测是开发期 debug 快照漏删。因该函数本身是死代码（§4），这条对复刻无影响。

5. **`m` / `w` 的确切身份**。
   - `m` = **html2canvas**：**CONFIRMED**。Home 的 `import { d as m } from "./vue-ade658be.js"`，该 chunk 的导出 `_0x43de51 as d`，而 `_0x43de51 = getDefaultExportFromCjs(html2canvasExports)`（`vue-ade658be.js@3302950`）。调用形态 `m(el, {useCORS, scale, backgroundColor})` 也吻合。
   - `w` = **jsPDF**：**INTERPRETED**。`new w({orientation, unit:"mm", format:[W,H]})` + `addPage` / `addImage` / `save` 与 jsPDF API 完全吻合，且 `vue-ade658be.js` 里确实打包了 jsPDF（`@1584756` 等处）。但我没把 `w` 到 jsPDF 的导出别名链完整走通（该 chunk 有多个重复的 JS 副本，导出表是另一个 chunk 的）。
   - 这两条都只在「复制到剪贴板 / 导出 PDF」用，**不在打印链路上**，对本次复刻无影响。

6. **`printFromContainer` 是否还有别的调用点**。
   在 `Home-d6b13b9a.js` 全文搜 `printFromContainer` 只有 **2 处命中**：`@115714` 组件内定义、`@415965` `_i` 调用。⇒ 确认**只有 `_i` 一个调用点**。但不排除有动态字符串调用（例如 `ref[name](...)`），这类我无法穷举。

7. **`Qc`（手动打印）函数体边界**。
   `Qc` 从 `Home.formatted.js:10911` 起，我按「下一个顶层 `async` 赋值」找结尾没找到（格式化版里函数体是压成一行的长字符串，正则切不准）。**已确认的是它没有 `12==ic` 分支**（在 `549971..564761` 之外的窗口里扫到的 ic 值集合不含 12，但那个窗口可能跨函数，所以这条按「未完全确认」记）。不过第 9 节的论点是靠**按钮渲染条件**（`12!==ic && …`）成立的，不依赖这条。

---

## 附：关键行号速查

| 主题 | `Receipt2.deobfuscated.js` |
|---|---|
| 默认纸张 `s` | `:24` |
| 纸型预设 `d` / 应用 `V` | `:25–50` / `:51–57` |
| 默认可见性 `g` | `:58–72` |
| 元素内联样式 `M` | `:104–124` |
| 字体归一化 `Z` | `:252–289` |
| 纸张归一化 `X` | `:290–306` |
| 容差比较 `Q` | `:307` |
| 打印 CSS 生成器 `ue` | `:371–438` |
| 分页/行高测量 `we` | `:615–721` |
| 纸型→1px 修正 `i` | `:667–692` |
| `buildReceipt2Html` = `ge` | `:723–739` |
| `ye` = `exportReceipt2PdfToBrowserPrint` | `:740–804` |
| 设置提交 `he`（写 localStorage） | `:817–849` |
| `printDirect`（死代码） | `:1113–1137` |
| `printFromContainer` | `:1226–1270` |
| `printSilent` | `:1271–1336` |
| `isElectronEnv` | `:212` |
| 打印机 状态/取/存/刷新 | `:212–238` |
| 打印机 + 份数 UI | `:2269–2396` |
| `onMounted` 读全部 localStorage | `:1018–1096` |

Home 侧：

| 主题 | `Home.formatted.js` 行 / `Home-d6b13b9a.js` 偏移 |
|---|---|
| 收据单2 组件区间 | `Home-d6b13b9a.js@95655–147500` |
| `Xn`（收据单2 ref）定义 | `Home.formatted.js:8266` |
| `ao`（预览容器 ref） | `Home.formatted.js:7652` |
| `yi`（绑预览 resize/editor） | `Home.formatted.js:8565` |
| `vi`（字体调节） | `Home.formatted.js:8569` |
| `fi`（buildReceipt2Html 包装） | `Home.formatted.js:8573` |
| `_i`（打印） | `Home.formatted.js:9836` / `Home-d6b13b9a.js@415965` |
| `Ji`（直接打印） | `Home.formatted.js:9829` / `Home-d6b13b9a.js@516008` |
| `si`（其它单据的 printDirect 调用） | `Home.formatted.js:8504` / `Home-d6b13b9a.js@363534` |
| `di`（其它单据的 printSilent/printDirect 二选一） | `Home.formatted.js:8508` |
| ic==12 工具栏按钮 | `:11648–11672` / `@608332` 起 |
| `Zc`（云打印，ic 12 被排除） | `:10652`（12 分支在 `:10860`） |
| `Qc`（手动打印，ic 12 被排除） | `:10911` |
| 收据单2 localStorage 键声明 | `Home-d6b13b9a.js@95563–95571` |
| `ic` 定义与 `12` 的含义 | `Home.formatted.js` 全文，`ic.value===12` ⇒ 收据单2（由 8 处 `12==ic` 分支一致推出） |

localStorage 键（全部确认自 `Home-d6b13b9a.js@95563–95571` + 解码）：

| 源码变量 | 键名 |
|---|---|
| `sa` | `receipt2_font_settings` |
| `ma` | `receipt2_print_settings` |
| `wa` | `receipt2_visibility_settings` |
| `ga` | `receipt2_brand_settings` |
| `ya` | `receipt2_element_configs` |
| `da` | `receipt2_column_widths` |
| `Va` | `receipt2_selected_printer` |
