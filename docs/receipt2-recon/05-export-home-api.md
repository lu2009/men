# 收据单2 · 导出/复制 + 与 Home 的接口 + UI 外壳 + 依赖清单

分析对象：
- 组件：`/Users/aaa/Desktop/door-main/legacy/js/Receipt2.deobfuscated.js`（2637 行，已解码，变量名单字母）
- 宿主：`/Users/aaa/Desktop/door-main/legacy/js/Home-d6b13b9a.js`

> **关于 Home 的行号**：`Home-d6b13b9a.js` 是**单行压缩文件**（519303 字符），没有行号可言，
> 所以下文 Home 的引用一律写成 `Home-d6b13b9a.js(单行)@<字符偏移>`，并附一段**唯一可 grep 的锚点串**。
> 旁边那份 `legacy/js/Home.formatted.js` 是 `deobfuscate-home.mjs` 生成的镜像，行号可读，
> 但**分析期间发现它正在被其它 agent 重新生成**（本次会话中 mtime 12:35:56、长度从 579737 变成 657656，
> 同一字符串的偏移从 537961 漂到 609803）。**所有结论都以 raw 文件为准**，镜像只作交叉验证。

---

## A. 导出与复制

### A1. `copyPreviewToClipboard(container)` — `Receipt2.deobfuscated.js:1154-1185`

流程（**CONFIRMED**）：

1. `if (!container) return ElMessage.error("预览容器未就绪")`（`:1157`）
2. `ElLoading.service({ lock:true, text:"生成图片中...", background:"rgba(0,0,0,0.7)" })`
3. `await document.fonts.ready`（`:1164`）—— 等字体加载完再截图
4. `const canvas = await m(container, { useCORS: true, scale: 2, backgroundColor: "#ffffff" })`
   - 这里的 `m` 就是 **html2canvas**（见 D 节证据链）
5. `await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob失败")), "image/png"))`
6. `const item = new ClipboardItem({ "image/png": blob })`
7. `await navigator.clipboard.write([item])`
8. 成功 → `ElMessage.success("收据单2已复制到剪切板！")`
9. 失败 → `ElMessage.error("复制失败: " + (err?.message || err))`；`finally` 关掉 loading

**依赖**：html2canvas 1.4.1（外部库，见 D 节）+ 浏览器原生 `ClipboardItem` / `navigator.clipboard.write`。
**没有任何 Electron 判断**，也没有 polyfill / execCommand 回退。

**MIME**：`"image/png"`（`toBlob` 与 `ClipboardItem` 两处都是）。
**scale**：2（2 倍像素密度）。

---

### A2. `exportPreviewToPdf(container)` — `Receipt2.deobfuscated.js:1186-1225`

流程（**CONFIRMED**）：

1. `if (!container) return ElMessage.error("预览容器未就绪")`
2. `ElLoading.service({ lock:true, text:"导出PDF中...", background:"rgba(0,0,0,0.7)" })`
3. `await document.fonts.ready`
4. `const pages = Array.from(container.querySelectorAll(".receipt2-page"))`
   - 空数组 → `throw new Error("未找到收据页面")`（`:1194`）
5. `const ps = X(h.value)` —— 取**已归一的打印设置**（`X` 在 `:290`，做 1..99 份数、50..500mm、横/纵校验，默认 `{copies:1,widthMm:200,heightMm:140,orientation:"landscape"}`，`s` 在 `:24`）
6. `orientation = ps.widthMm >= ps.heightMm ? "landscape" : "portrait"`
7. `const pdf = new w({ orientation, unit: "mm", format: [ps.widthMm, ps.heightMm] })`
   - 这里的 `w` 就是 **jsPDF 构造器**（见 D 节证据链）
8. **逐页**：
   - `await m(pageEl, { useCORS: true, scale: 2, backgroundColor: "#ffffff" })` → html2canvas
   - `.toDataURL("image/jpeg", 0.95)` —— **注意：PDF 里嵌的是 JPEG 0.95，不是 PNG**
   - `i > 0 && pdf.addPage([ps.widthMm, ps.heightMm], orientation)`
   - `pdf.addImage(dataUrl, "JPEG", 0, 0, ps.widthMm, ps.heightMm)` —— 一页一张整版图，**无分页/缩放计算**
9. `pdf.save("收据单2.pdf")` —— 触发浏览器下载
10. 成功 → `ElMessage.success("收据单2已导出PDF")`；失败 → `ElMessage.error("导出PDF失败: " + ...)`

**依赖**：html2canvas 1.4.1 + jsPDF。两者都是**打包进 vendor chunk 的静态 import**（不是动态 `import()`）。
**没有任何 Electron 判断**。

> 对比：Home 自己那份 `导出PDF`（`Home-d6b13b9a.js(单行)@449717`，变量名 `Xc`）在 **其它 ic 模式**（13/14/15/16…）下
> 用的是 Home 自己内联的 html2canvas+jsPDF 实现；**只有 ic===12（收据单2）时它把活转交给组件**
> （见 B 节最后）。

---

### A3. 是否只支持 Electron？

**CONFIRMED：这两个方法都不看 `isElectronEnv`，纯浏览器实现。**

| 方法 | Electron 门槛 | 浏览器里的行为 |
|---|---|---|
| `copyPreviewToClipboard` | 无 | 需要安全上下文（https/localhost）+ Chrome/Edge 的 `ClipboardItem`。非安全上下文下 `navigator.clipboard` 为 `undefined` → 抛错被 catch → `ElMessage.error("复制失败: ...")` |
| `exportPreviewToPdf` | 无 | 正常导出并下载 `收据单2.pdf` |
| `printFromContainer` | 无 | iframe 隐藏 + `contentWindow.print()`，走浏览器打印对话框 |
| **`printSilent`** | **有** | `if (!W.value) return ElMessage.warning("直接打印仅在 Electron 客户端可用"), false`（`:1273-1279`） |

`W = Vue.computed(() => !!window["electronAPI"])`（`Receipt2.deobfuscated.js:212`），expose 成 `isElectronEnv`（`:1337`）。

Electron API 面（组件里用到的 `window.electronAPI`）：
- `getPrinters()` → 打印机列表（`:227`，`q` 函数，失败提示"获取打印机列表失败"）
- `silentPrint(html, printerName, {landscape:false, copies, pageWidthMm, pageHeightMm})` → 返回 `{success, reason}`（`:1310`）

---

### A4. 还有没有别的导出路径（下载 PNG 等）？

**CONFIRMED：没有。**

在 `Receipt2.deobfuscated.js` 全文件里搜 `download` / `createObjectURL` / `new Blob` / `.href` / `showSaveFilePicker`
—— **0 命中**。唯一一次 `toDataURL` 在 `:1212`，且只喂给 jsPDF。

所以组件的导出面只有三条：
1. 剪贴板（PNG）
2. PDF（jsPDF `save()`）
3. 打印（iframe / Electron silentPrint）

> 注：Home 侧另有一堆"复制成图片 / 导出订单汇总 / 导出excel"按钮（`@427350` 附近 `hc`、`@4277xx` 等），
> 但那些是**其它 ic 模式**（玻璃合片单 / 合格标签 / 生产单）自己的实现，与收据单2 无关。
> 唯一交集是 ic===12 时 `hc` 内部转调组件的 `copyPreviewToClipboard`。

---

## B. 与 Home 的接口

### B0. 组件怎么被 Home 挂载

**CONFIRMED** —— `Home-d6b13b9a.js(单行)@500022`，锚点串 `Vue.createVNode(va,{ref_key:s(642),ref:Xn,`：

```js
Vue.createVNode(va, {
  ref_key: s(642),                 // 解码 = "receipt2ManagerRef"
  ref: Xn,                         // Home 侧 Vue.ref(null)，@354805
  "get-customers": yr,             // @355313  yr = () => jn
  "is-receipt2-active": vr,        // @355323  vr = () => 12 === ic.value
  "on-preview-html-change": yi     // @365702
}, null, 512)
```

- 组件变量 `va = Vue.defineComponent({__name:"Receipt2PrintManager", ...})`（raw `@95536` 起，`__name` 在 `@95648`；组件体约到 `@152000`）
- props 用 **kebab-case** 传入（`"get-customers"` 等），因为这是编译后的 render 函数
- 组件 ref 名：`"receipt2ManagerRef"`（`dr[642]`），绑到 Home 的 `Xn`
- 注意：Home 的 render 里并没有 `Receipt2PrintManager` 的可见 DOM —— 它就是两个 `<Vue.createVNode(va,...)>` 之一，与
  `Oa`(合格标签) / `sn`(生产单) / `xn`(生产单2) / `Sn`(玻璃合片单) 并排（`@500022` 起连续 5 个 createVNode）

Home 侧关键 ref/变量（**CONFIRMED**）：

| 名字 | 定义位置 | 含义 |
|---|---|---|
| `Xn` | `@354805` `Vue.ref(null)` | 收据单2 组件实例（模板 ref） |
| `Wn` | `@354653` `Vue.ref("")` | **预览 HTML 字符串**（喂给预览容器 `innerHTML`） |
| `jn` | `@354700` 附近 `let jn = []` | **喂给组件的订单数据**（非响应式普通变量） |
| `ao` | `@334486` `Vue.ref(null)` | 预览容器 DOM（`ref_key:"commentPreviewContainer"`） |
| `eo` | `@334426` `Vue.ref(false)` | 预览大对话框显隐 |
| `Ll` | `@333058` `Vue.ref(false)` | "编辑收据单"模式开关（Home 侧） |
| `bl` | `@333074` `Vue.ref(false)` | Home 自己的二维码/元素编辑浮层显隐（与组件内部的 `k` 无关） |
| `ic` | `@421613` `Vue.ref(1)` | 当前打印业务模式；**12 = 收据单2** |
| `z` | `@406760+` `Vue.ref(false)` | **isMobile**（`/iPad\|iPhone\|iPod/.test(navigator.userAgent) || 某检测函数`）|
| `yr` | `@355313` `() => jn` | getCustomers |
| `vr` | `@355323` `() => 12 === ic.value` | isReceipt2Active |

---

### B1. `ic === 12` 时 Home 暴露的按钮

**CONFIRMED** —— 按钮条整体在 `Home-d6b13b9a.js(单行)@489265`
（锚点 `Vue.createElementBlock(s(1177),Ru,[`），`Ru = {key:0, class:"button-group"}`（`dr[1060]="button-group"`）。
**只有当 `Wn.value` 非空（有预览 HTML）时这一整条才渲染。**

在 `ic===12` 下会出现的按钮（逐个对照）：

| key | 文案 | type | onClick | 触发条件 | 调组件的什么 |
|---|---|---|---|---|---|
| — | ` 关闭 ` | primary | inline `eo=false` | 恒显示 | 无 |
| 2 | ` 直接打印 ` | primary | `Ji` `@415703` | `12==ic` | **`Xn.value.printSilent(ao.value)`** |
| 3 | ` 打印 ` | primary | `_i` `@415863` | `12==ic` | **`Xn.value.printFromContainer(ao.value)`** |
| 4 | ` 字体调节 ` | warning | `vi` `@365917` | `12==ic` | **`Xn.value.openFontDialog()`** |
| 5 | ` 编辑收据单 ` | success | `Ri` `@416757` | `12==ic && !Ll` | 本地切换编辑态（`contentEditable`），**不调组件** |
| 6 | ` 完成编辑 ` | danger | `Ri` | `12==ic && Ll` | 退出编辑后调 `initColumnResize` + `initElementEditor` |
| 34 | `复制收据单` / `复制中...` | success | `hc` `@427350` | `oo.value && !z.value`（桌面） | **`Xn.value.copyPreviewToClipboard(ao.value)`** |
| 35 | `微信分享(手机)` / `分享中...` | success | `pc` | `oo.value && z.value`（手机） | 无（Home 自己的分享逻辑） |
| — | ` 导出PDF ` | warning | `Xc` `@449717` | **无 ic 条件**（只要预览非空） | ic===12 时转调 **`Xn.value.exportPreviewToPdf(ao.value)`** |

`ic===12` 下**不出现**的：key 0/1（云打印/手动打印，条件是 `12..16 都不等于 ic`）、key 7–33、36–43
（那些绑在 `13/14/15/16/1/2/3/4/5` 或 `al.value` / `lo.value` 上，而 `pi` 进 ic=12 时把 `al`、`lo` 都置 `false`）。

生成 handler 的关键代码（**CONFIRMED**）：

```js
// @427350
hc = async () => {
  if (12 === ic.value) return xl.value = !0,
    await Xn.value?.copyPreviewToClipboard(ao.value),      // dr[1274] = copyPreviewToClipboard
    void (xl.value = !1)
  /* ...其它 ic 模式的复制成图片实现... */
}

// @415703
Ji = async () => {
  if (await Xn.value?.printSilent(ao.value)) {             // dr[1160] = printSilent
    const e = "收据单"; Kc(e), Hl(e, Kt.value), Gl(e), await Ca(), eo.value = !1
  }
}

// @415863
_i = async () => {
  if (!Xn.value) return void ElMessage.error(dr[657])       // "收据单2组件未就绪"
  await Xn.value.printFromContainer(ao.value)               // 字面量属性名
  const t = "收据单"; Kc(t), Hl(t, Kt.value), Gl(t), await Ca()
}

// @451740（在 Xc 里，Xc 是一个 10+ 分支的大函数）
if (12 == ic.value) return L.close(), void (await Xn.value?.exportPreviewToPdf(ao.value))  // dr[1381]
```

> 注意 `hc` 里的 `xl` 是 `复制收据单` 按钮的 loading 标志，但 `copyPreviewToClipboard` **自己又开了一个 ElLoading**，
> 所以点一下会出现**两层 loading**。这是旧版的既有行为，新版可自行决定是否保留。

---

### B2. 「组件未就绪」的确切条件

三个不同的地方会报**同一个字符串** `"收据单2组件未就绪"`（`dr[657]`，raw `@366033`）：

| 触发点 | 位置 | 确切条件 |
|---|---|---|
| `字体调节` 按钮 `vi` | `@365917` | `Xn.value?.openFontDialog ? Xn.value.openFontDialog() : ElMessage.error("收据单2组件未就绪")` —— 即 **`Xn.value` 为 null，或组件没暴露 `openFontDialog`** |
| `打印` 按钮 `_i` | `@415863` | `if (!Xn.value) return ElMessage.error("收据单2组件未就绪")` —— 即 **ref 为 null** |
| `buildReceipt2Html` 包装 `fi` | `@366045` | `if (!Xn.value?.buildReceipt2Html) throw new Error("收据单2组件未就绪")` |

所以「组件未就绪」= **模板 ref `Xn` 还是 null（组件没挂载）**，或**挂载了但 expose 面不完整**。
`Xn` 是 `Vue.ref(null)`，由 `ref:"receipt2ManagerRef"` 填充 —— 正常情况下在 Home 的同一个 render 里必然挂载，
所以这条报错在实践中几乎只在**组件抛异常导致 setup 失败**时出现。

---

### B3. `onPreviewHtmlChange` 把 HTML 送回 Home 之后

**CONFIRMED** —— `yi` 定义在 `@365702`，锚点 `yi=async e=>{var t,l;const o=g;Wn[o(755)]=e,`：

```js
yi = async (html) => {
  Wn.value = html
  await Vue.nextTick()
  Hn.value = ao.value ? ao.value.scrollWidth : 0        // 记录预览区滚动宽度
  if (ao.value) {
    Xn.value?.initColumnResize(ao.value)                // dr[1329]
    Xn.value?.initElementEditor(ao.value)               // dr[1345]
  }
}
```

Home 拿它做三件事：
1. **`Wn.value = html`** —— 这个字符串直接绑到预览容器的 `innerHTML`：
   `Vue.createElementVNode("div", { ref_key:"commentPreviewContainer", ref:ao, innerHTML:Wn.value,
   style:{ width: (ic==15||16 ? "fit-content" : "1123px"), margin:"0 auto", maxWidth:"100%",
           overflowX: (ic==15||16 ? "auto" : undefined), position:"relative", zIndex:1 } }, null, 12, Fu)`
   （`Home-d6b13b9a.js(单行)@4999xx`，`Fu=[dr[1249]]` = `["innerHTML"]`）
   注意 **`v-html` 语义**：预览是纯字符串注入，不是子组件。
2. **量 `scrollWidth`** 存进 `Hn`（另有 `onPreviewHtmlChange` 的兄弟 `ui` 做同样的事）
3. **回调组件** 重新挂列宽拖拽手柄 + 元素点击编辑 —— 因为 HTML 被整体替换了，DOM 上的监听全丢

组件侧谁触发 `onPreviewHtmlChange`（**CONFIRMED**，`Receipt2.deobfuscated.js`）：

| 组件内函数 | 位置 | 说明 |
|---|---|---|
| `ve`（expose 名 `refreshPreview`） | `:805-809` | `const t = await ge(); await o.onPreviewHtmlChange(t)` —— **唯一的推送口** |
| `ge`（expose 名 `buildReceipt2Html`） | `:723-739` | 生成 HTML，包成 `<div class="receipt2-root"><style>…</style>…</div>` |
| `he`（设置弹窗"保存"） | `:817-850` | 存 localStorage 后，`isReceipt2Active()` 为真才 `await ve()` |
| `xe`（元素编辑器"确认"） | `:989-1003` | 同上，另外再 `requestAnimationFrame(() => { pe(S); ze(S) })` |
| `resetAllElementConfigs` | `:1147-1153` | 同上（**但 Home 从不调它**） |

---

### B4. 数据是怎么喂进去的

**两条路都有，以「Home 主动传参」为主**（**CONFIRMED**）：

**路 1（主路）：Home 显式传数组**
`pi`（`Home-d6b13b9a.js(单行)@366895`）是进入 ic=12 的入口，锚点 `pi=async()=>{const e=g;al[e(755)]=!1;try{`：

```js
pi = async () => {
  al.value = false
  try {
    const t = Object.keys(wn).map(t => {
      const a = wn[t]["customerInfo"] || {}, n = wn[t]["hui_picture"] || []
      return { ...a,
        brand: a.brand?.replace("回执单", "收据单") || "",
        receipt: n }
    })
    jn = t                                   // ← 存进 Home 的 jn
    Wn.value = ""; Yn.value = ""; On.value = ""
    ic.value = 12; lo.value = false; oo.value = true
    Kn.value = "FinalReceipt2"
    Wn.value = await fi(jn)                  // ← fi = Xn.value.buildReceipt2Html(jn)
    await Vue.nextTick()
    Hn.value = ao.value ? ao.value.scrollWidth : 0
    eo.value = true                          // ← 打开预览大对话框
    setTimeout(() => {
      ao.value && (Xn.value?.initColumnResize(ao.value),
                   Xn.value?.initElementEditor(ao.value))
    }, 150)
  } catch (t) {}
}
```

`fi`（`@366045`）：
```js
fi = async (e) => {
  if (!Xn.value?.buildReceipt2Html) throw new Error("收据单2组件未就绪")
  return await Xn.value.buildReceipt2Html(e)   // dr[645]
}
```

所以数据形状是 **`Array<{ ...customerInfo字段, brand: string, receipt: any[] }>`**，
数组本身来自 Home 的 `wn`（按客户分组的订单数据），**不是 props 也不是直接从订单列表读**。

**路 2（回退路）：`getCustomers` prop**
组件内部 `_()`（`Receipt2.deobfuscated.js:239-243`）：
```js
_ = () => {
  const a = o["getCustomers"]?.call(o)
  return Array.isArray(a) ? a : []
}
```
`ge(e)` 的入参不是数组时就回退到 `_()`（`:723-725`），`ye()`（浏览器打印）也无参 → 用 `_()`。
而 Home 传进来的 `getCustomers = yr = () => jn`（`@355313`）—— **就是同一个 `jn`**。

结论：**两条路指向同一份数据**，`buildReceipt2Html(arr)` 是 Home 主动推，`getCustomers()` 是组件自己拉；
`refreshPreview`/`printDirect`/`printSilent` 走的是拉那条（拿 `jn`）。

---

### B5. 组件 `expose` 清单（**新版要对齐的 API 面**）

`expose` 块 = `Receipt2.deobfuscated.js:1097-1338`（结构是 `return (t({...}), (props, ctx) => {render})`，
`t` 就是 `setup(e, { expose: t })` 里的 `expose`）。

| # | 方法 | 行号 | 入参 | 作用 | Home 是否调用 |
|---|---|---|---|---|---|
| 1 | `buildReceipt2Html` | `:1098` → `ge` `:723` | `orders?: Array`（省略则用 `getCustomers()`） | 生成完整预览 HTML 字符串（含 `<style>`，外层 `.receipt2-root`），**await**（内部要测量分页） | ✅ `fi` 转调，ic=12 入口 `pi` 必调 |
| 2 | `exportReceipt2PdfToBrowserPrint` | `:1099-1101` | 无 | `async () => { await ye() }`，即"浏览器打印"（**名字有误导性，不产 PDF**，也没有任何 ElMessage） | ❌ **全代码库 0 调用点（死代码）** |
| 3 | `openFontDialog` | `:1102-1112` | 无 | 把编辑态设置拷贝成草稿（`f←v`、`p←h`、`c←i`、`z←C`），`y.value = true` 打开「收据单2 设置」弹窗 | ✅ `vi`（`字体调节` 按钮） |
| 4 | `printDirect` | `:1113-1137` | 无 | ElLoading「正在生成收据单2...」→ `await ye()`（iframe 浏览器打印）→ success「收据单2已打开浏览器打印」。**里面有一句 `JSON.stringify(t, null, 2);` 是丢弃结果的无副作用死代码** | ❌ 0 调用点 |
| 5 | `refreshPreview` | `:1138` → `ve` `:805` | 无 | `onPreviewHtmlChange(await buildReceipt2Html())` —— **组件主动推新 HTML 回 Home** | ❌ Home 不直接调；组件内部 `he`/`xe`/`resetAllElementConfigs` 调 |
| 6 | `initColumnResize` | `:1139` → `pe` `:851-946` | `container: HTMLElement` | 先做 `[data-shrink-fit]` 自适应缩字号，再清掉旧 `.r2-resize-handle`，给第一张 `.receipt2-page` 的 `thead th` 逐个挂 6px 拖拽手柄；`mouseup` 时把列宽百分比写进 `n.value` + `localStorage[da]` | ✅ `yi`（`@365844`）、`pi` 的 setTimeout（`@367445`）、`Ri`（`@416971`） |
| 7 | `initElementEditor` | `:1140` → `ze` `:983-988` | `container: HTMLElement \| null` | 绑定/解绑容器上的 `click` → `Ce`；点击 `[data-r2-el]` 元素弹出元素编辑浮层（`k.value = 元素 key`） | ✅ `yi`（`@365897`）、`pi`（`@367498`）、`Ri`（`@417007`） |
| 8 | `destroyElementEditor` | `:1141-1146` | 无 | 解绑 click、清 `k.value` / `T` | ❌ 0 调用点 |
| 9 | `resetAllElementConfigs` | `:1147-1153` | 无 | `b.value = L()`（重置所有元素配置）、`A()`，若 `isReceipt2Active()` 为真再 `await ve()` | ❌ 0 调用点 |
| 10 | `copyPreviewToClipboard` | `:1154-1185` | `container: HTMLElement` | 见 A1 | ✅ `hc`（`@427457`），仅 ic=12 且桌面 |
| 11 | `exportPreviewToPdf` | `:1186-1225` | `container: HTMLElement` | 见 A2 | ✅ `Xc`（`@451740`），仅 ic=12 |
| 12 | `printFromContainer` | `:1226-1270` | `container: HTMLElement` | clone 容器 → 去掉 `.r2-resize-handle` → 塞进隐藏 iframe（内联 `ue()` 打印 CSS）→ 等图片加载 → 500ms 后 `contentWindow.focus(); print()` → 1s 后移除 iframe。**无 Electron 判断** | ✅ `_i`（`打印` 按钮，`@415966`） |
| 13 | `printSilent` | `:1271-1336` | `container: HTMLElement` | **仅 Electron**。先判 `W.value`，再 clone+去手柄+**给横版把每页包一层 `.r2-page-wrap`**，然后 `window.electronAPI.silentPrint(html, printerName, {landscape:false, copies, pageWidthMm, pageHeightMm})`。**返回 boolean** | ✅ `Ji`（`直接打印` 按钮，`@415772`） |
| 14 | `isElectronEnv` | `:1337` | — | `ComputedRef<boolean>`，读 `.value` | ❌ Home 不读（其它 4 个打印管理器的同名 expose 被各自宿主读） |

**新版必须实现的（被 Home 真正调用的）只有 6 个**：
`buildReceipt2Html`、`openFontDialog`、`initColumnResize`、`initElementEditor`、
`printFromContainer`、`printSilent`、`copyPreviewToClipboard`、`exportPreviewToPdf` —— 共 **8 个**。
其余 6 个（`exportReceipt2PdfToBrowserPrint`、`printDirect`、`refreshPreview`、`destroyElementEditor`、
`resetAllElementConfigs`、`isElectronEnv`）**Home 一次都没调**，属于组件内部/预留 API。
但 `refreshPreview` 是组件自己刷新预览的关键内部通路，**功能上不能省**。

**调用矩阵（Home → 组件，全部 CONFIRMED）**

| 组件方法 | 调用者 | 位置 |
|---|---|---|
| `buildReceipt2Html` | `fi` ← `pi` | `@366177` |
| `openFontDialog` | `vi`（字体调节） | `@365971` / `@365990` |
| `initColumnResize` | `yi`, `pi`, `Ri` | `@365844` / `@367445` / `@416971` |
| `initElementEditor` | `yi`, `pi`, `Ri` | `@365897` / `@367498` / `@417007` |
| `printFromContainer` | `_i`（打印） | `@415966` |
| `printSilent` | `Ji`（直接打印） | `@415772` |
| `copyPreviewToClipboard` | `hc`（复制收据单） | `@427457` |
| `exportPreviewToPdf` | `Xc`（导出PDF） | `@451740` |
| 其余 6 个 | — | 无 |

---

## C. UI 外壳

### C1. 组件自己的模板（render 函数 `Receipt2.deobfuscated.js:1339-2637`）

整个组件只有 **2 个根节点**（`Fragment`），而且**都不含预览**：

**根 1：`el-dialog`「收据单2 设置」（`:1361-2406`）**

```js
Vue.createVNode(C /* el-dialog */, {
  modelValue: y.value,                       // y = Vue.ref(false)，:73
  "onUpdate:modelValue": e => (y.value = e),
  title: "收据单2 设置",                      // :1366
  width: "460px",                            // :1367
  "destroy-on-close": false,
  onOpen: J,                                 // J(:235) = Electron 下才拉打印机列表，且只在列表为空时
}, {
  footer: [ 重置默认(fe) / 取消(y=false) / 保存(he) ],
  default: [ el-form(label-width:"110px") … ]   // 品牌名 / 打印设置 / 字体 / 列宽 / 打印机 …
})
```

用到的 Element Plus 组件（`Vue.resolveComponent`，`:1341-1353`）：
`el-switch, el-form-item, el-input, el-input-number, el-divider, el-option, el-select, el-button,
el-checkbox, el-radio-button, el-radio-group, el-form, el-dialog`（13 个）。

**根 2：`Vue.Teleport to="body"` 元素编辑浮层（`:2409-2636`）**

- `.r2-el-editor-mask`：`k.value` 非 null 时显示，`@click.self` 关闭
- `.r2-el-editor`：绝对定位（`top/left` 来自 `U.value`），内容 = 元素中文名 + X偏移(mm)/Y偏移(mm)/字体(px)/宽度(mm) 四个 `el-input-number` + 显示 checkbox + 重置/取消/确认三个按钮
- 由 `k` 控制显隐，`k` 由 `initElementEditor` 绑的 click 处理器 `Ce`（`:947-982`）设置

**结论（CONFIRMED）：组件自己不渲染任何"预览容器"。**
页面上它的可见输出只有那两个按需弹出的浮层。真正的预览是 **Home 的**容器
（`ref_key:"commentPreviewContainer"`，`innerHTML = Wn.value`，`Home-d6b13b9a.js(单行)@4999xx`）。

**显隐由谁控制**

| UI 部分 | 控制变量 | 属于 | 打开方式 |
|---|---|---|---|
| 「收据单2 设置」弹窗 | `y`（`Receipt2.deobfuscated.js:73`） | 组件 | expose `openFontDialog()`；footer「取消」或 `he` 关闭 |
| 元素编辑浮层 | `k`（`:181`） | 组件 | `initElementEditor(container)` 绑的 click → `Ce` |
| 预览大对话框 | `eo`（Home `@334426`） | **Home** | `pi` 里 `eo.value = true`；按钮条「关闭」置 false |
| 预览内容 | `Wn`（Home `@354653`） | **Home** | `yi`（onPreviewHtmlChange）/ `pi` 赋值 → `innerHTML` |
| 「编辑收据单」模式 | `Ll`（Home `@333058`） | **Home** | `Ri` 切换 `contentEditable` + 增删 click 监听 |

对话框尺寸（Home 侧）：外框 `width = (ic==15||16) ? "95%" : "1180px"`；
预览容器 `width = (ic==15||16) ? "fit-content" : "1123px"`，`margin:"0 auto"`，`maxWidth:"100%"`，
`overflowX = (ic==15||16) ? "auto" : undefined`，`position:"relative"`，`zIndex:1`。
**ic===12 时就是 1180px 外框 + 1123px 内容。**
el-dialog **没有 title 属性、没有 header/footer slot** —— body 直接是 `[按钮条, 预览容器]`。

---

### C2. `#r2mp` / `#r2mf` 的真相（重要，别搞错）

**CONFIRMED：这两个 id 不在预览 HTML 里，只存在于一个临时的离屏测量 DOM 中。**

`we`（`Receipt2.deobfuscated.js:615-722`）为了算分页，会：

1. `document.createElement("div")`，`style.cssText = "position:absolute;visibility:hidden;top:0;left:0;"`
2. `innerHTML = "<style>" + ue(fontSettings, X(h.value)) + "\n  #r2mp { height:auto !important; overflow:visible !important; }\n  #r2mf .receipt2-declaration { flex:0 0 auto !important; min-height:0 !important; }\n</style>\n  <div class=\"receipt2-root\">\n    <section class=\"receipt2-page\" id=\"r2mp\">\n      " + header + "\n      <table class=\"receipt2-table\">…<tbody id=\"r2mb\">…</tbody></table>\n      <div id=\"r2mf\">" + footer + "</div>\n    </section>\n  </div>"`（`:630-645`）
3. `document.body.appendChild(l)`，`requestAnimationFrame` 里量：
   - `#r2mp` 的 `getBoundingClientRect().height` → 整页自然高度 `i`
   - `#r2mp` 的 `width × (heightMm/widthMm)` → 目标可用高度 `c`
   - `#r2mf` 的高度 `s`（页脚块）
   - `#r2mb` 里每个 `<tr>` 的高度 → `rowHeights`
   - 推出 `availNoFooter = c - (i - Σtr - s)`、`availWithFooter = c - (i - Σtr - s) - s`
4. `document.body.removeChild(l)`（`:658`），把结果 resolve 出去
5. `we` 再用这些数做**贪心装页**（`:680-720`），每页交给 `me(e, slice, isLast)` 生成
   `<section class="receipt2-page">…</section>`（`:603-614`）—— **注意 `me()` 产出的页没有 id**

全文件 `r2mp` 只出现在字符偏移 `23682 / 23931 / 24493`，`r2mf` 只在 `23754 / 24235 / 24592` —— **全部在 `we` 内**。

> 给新版：**`#r2mp`/`#r2mf` 是私有测量脚手架，不是对外契约**，可以自由重写（甚至改成不挂 DOM 的算法）。

---

### C3. `.receipt2-root` 的「不打印时怎么显示」规则

组件所有样式都由 `ue(fontSettings, printSettings)`（`Receipt2.deobfuscated.js:371-439`）拼成**一整段 `<style>` 字符串**，
插在 `<div class="receipt2-root">` 里（`ge()` `:731-737`），或写进 iframe 的 `<head>`（`printFromContainer` `:1232-1237`、`ye` `:749-754`）。

**`@media screen` 段（`:438-440`）—— 这就是"不打印时怎么显示"**：

```css
@media screen {
  .receipt2-root   { background:#c0c0c0; padding:12mm; display:flex; flex-direction:column;
                     align-items:center; gap:8mm; min-width:fit-content; }
  .receipt2-page   { position:relative; box-shadow:0 3px 14px rgba(0,0,0,0.28); }
  [data-r2-el]     { cursor:pointer; transition:outline .15s; border-radius:2px;
                     position:relative; z-index:5; }
  [data-r2-el]:hover { outline:2px dashed #409eff; outline-offset:1px; z-index:10; }
}
```

即：**屏幕上是灰底（#c0c0c0）+ 12mm 内边距 + 纵向 flex 居中 + 8mm 纸间距 + 白纸投影**，
可编辑元素平时带 hover 蓝色虚线框提示。

**`@media print` 段（`:426-437`）**：

```css
@media print {
  html, body { margin:0 !important; padding:0 !important; background:#fff; }
  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  /* 下面这段【只在横版时】才追加 */
  .receipt2-root { display:block !important; background:#fff !important; padding:0 !important; gap:0 !important; }
  .r2-page-wrap  { width:<heightMm>mm !important; height:<widthMm>mm !important; overflow:hidden !important;
                   position:relative !important; page-break-after:always !important; }
  .r2-page-wrap:last-child { page-break-after:auto !important; }
  .receipt2-page { position:absolute !important; top:0 !important; left:0 !important;
                   width:<widthMm>mm !important; height:<heightMm>mm !important;
                   transform-origin:top left !important;
                   transform:translateY(<widthMm>mm) rotate(-90deg) !important;
                   box-shadow:none !important; page-break-after:auto !important; }
  .receipt2-table { border-collapse:collapse !important; }
  .receipt2-table th, .receipt2-table td { border:1px solid #000 !important; }
}
```

还有一条独立的 `@page`（`:411-418`）：
```css
@page { size: <横版?heightMm:widthMm>mm <横版?widthMm:heightMm>mm; margin:0; }
```

**横版用「旋转」实现**：页面本身按 `widthMm × heightMm`（如 200×140，横向），
但打印时 `@page` 按 140×200 竖版出纸，再把 `.receipt2-page` 顺时针转 -90° 塞进 `.r2-page-wrap`。
`printSilent`（Electron）走的是「DOM 里包 `.r2-page-wrap`」（`:1291-1299`）而不是靠 `@media print`，
因为 Electron 的 `silentPrint` 不吃 CSS 媒体查询。

基础样式（`:372-410`，节选）：
`.receipt2-root` 黑字白底、字体 `"Microsoft YaHei","PingFang SC",sans-serif`；
`.receipt2-page` `padding:4mm 4mm 3mm`、`display:flex;flex-direction:column;overflow:hidden`、`page-break-after:always`；
`.receipt2-header` 三列 grid `1fr 2fr 1fr`；`.receipt2-qrcode` 18mm×18mm；
`.receipt2-meta-row` 四列 grid `1.2fr 1.5fr 1.7fr 0.8fr`；
`.receipt2-amounts` 三列 grid、`color:#d9001b`；`.receipt2-declaration` 虚线顶边 + `flex:1`。
列宽由 `n.value`（10 个百分比）注入 `:nth-child(k)` 规则。

---

## D. 依赖清单

### D1. 外部库（**关键：都是打包进 vendor chunk 的静态 import，不是 CDN**）

`Receipt2` 组件所在的 Home bundle 头部 import（`Home-d6b13b9a.js(单行)@0` 附近）：

```js
import{ c as V, d as m, E as w, e as g, B as y, C as v, F as f, f as h, g as p, h as C }
  from "./vue-ade658be.js"
```

| chunk 里的导出 | 本地名 | 真身 | 证据 |
|---|---|---|---|
| `d` | **`m`** | **html2canvas 1.4.1** | `vue-ade658be.js@3302950`：`const _0x43de51=getDefaultExportFromCjs(html2canvasExports)`；`@1888051` 有 banner `/*! html2canvas 1.4.1 <https://html2canvas.hertzen.com> Copyright (c) 2022 Niklas von Hertzen ... */`；export 表 `_0x43de51 as d` |
| `E` | **`w`** | **jsPDF 构造器** | `@3533690`：`E.API={events:[]},E.version="3.0.0"`；另有一份 `E$1` 在 `@1604954` `version="2.5.2"`，被 `jspdf_es_min` 导出（`default:E$1, jsPDF:E$1`）。**版本哪个生效见「未确认」§2** |

用法（组件里）：
- `m(el, { useCORS:true, scale:2, backgroundColor:"#ffffff" })` → `Promise<HTMLCanvasElement>`
- `new w({ orientation, unit:"mm", format:[w,h] })` → `.addPage([w,h], orient)` / `.addImage(dataUrl,"JPEG",0,0,w,h)` / `.save("收据单2.pdf")`

**项目记忆里 `Hui` 页也用 html2canvas**（`legacy/js/Hui-d088417c.js` 里有 html2canvas 痕迹），
所以新版如果引 html2canvas，是 **Home + Hui 共用** 的依赖，值得引。

### D2. 全局（未 import）

| 名字 | 用在哪 | 说明 |
|---|---|---|
| `Vue` | `Vue.ref/computed/watch/onMounted/nextTick/Teleport/resolveComponent/createVNode/...` 全组件 | Home bundle 的 11 条 import 里**没有** `Vue`，也搜不到 `window.Vue=`。**未确认绑定来源**（见下） |
| `ElementPlus` | 365 处 `ElementPlus.ElMessage/ElLoading` | 同上，未在 bundle 内 import。`import{a as N,b as E,s as L,c as b}from"./element-plus-1cb3551d.js"` 只进了 4 个符号 |

### D3. 浏览器原生 API

| API | 用在哪 | 备注 |
|---|---|---|
| `document.fonts.ready` | `:1164`、`:1198` | 截图前等字体 |
| `ClipboardItem` + `navigator.clipboard.write` | `:1175-1178` | 需安全上下文 |
| `canvas.toBlob` / `toDataURL` | `:1168-1172`、`:1212` | |
| `iframe` + `contentWindow.print()` | `printFromContainer` `:1239-1270`、`ye` `:756-804` | |
| `localStorage` | 7 个 key，见 D4 | |
| `document.elementsFromPoint` | `Ce` `:950` | 元素点选容错 |

### D4. localStorage key（组件读写的全部 7 个，**CONFIRMED**）

| 变量 | key | 内容 | 读 | 写 |
|---|---|---|---|---|
| `sa` | `receipt2_font_settings` | 字号六项 | `:1022` | `:837` |
| `ma` | `receipt2_print_settings` | `{copies,widthMm,heightMm,orientation}` | `:1034` | `:841` |
| `wa` | `receipt2_visibility_settings` | 显隐/顺序 `{showXxx, xxxPosition, metaOrder}` | `:1046` | `:845` |
| `ga` | `receipt2_brand_settings` | `{enabled, name}` | `:1063` | `:833` |
| `da` | `receipt2_column_widths` | 10 个百分比 | `:1080` | `:938`（拖拽结束） |
| `Va` | `receipt2_selected_printer` | 打印机名 | `:1093` | `:219` |
| `ya` | `receipt2_element_configs` | 元素级 `{offsetXMm,offsetYMm,fontSize,widthMm,visible}` | `:141` | `:179` |

> **注意**：`ya`（`"receipt2_element_configs"`）是在**组件外面**的模块作用域声明的
> （`Home-d6b13b9a.js(单行)` 里 `ya="receipt2_element_configs",va=Vue.defineComponent({__name:"Receipt2PrintManager"...`
> —— 紧挨着组件定义之前），组件直接引用这个外部常量。这是旧版打包的耦合，新版应改成组件内部常量。

### D5. Electron API（仅 `printSilent` / 打印机列表）

| API | 位置 | 用途 |
|---|---|---|
| `window.electronAPI.getPrinters()` | `:227` | `q()`，取打印机列表；失败 `ElMessage.error("获取打印机列表失败")` |
| `window.electronAPI.silentPrint(html, printer, opts)` | `:1310` | 静默打印；返回 `{success, reason}` |

存在性检测：`W = Vue.computed(() => !!window.electronAPI)`（`:212`）。

### D6. 依赖决策表（给新版）

| 依赖 | 版本 | 用途 | 新版是否已有替代 | 是否值得引 |
|---|---|---|---|---|
| **html2canvas** | 1.4.1 | 复制到剪贴板（`:1167`）、导出 PDF（`:1206`） | 项目里**没有**（`app/package.json` 需确认，但 Home/Hui 新版代码里未见） | **值得引**，且 Home+Hui 共用。备选：`modern-screenshot` / `html-to-image`（对 CSS 支持更现代、体积更小）。注意 html2canvas 1.4.1 对 `transform`、`box-shadow`、部分 flex/grid 支持有限，而收据单2 **恰好大量用 grid + 横版 rotate** —— 新版若沿用，需实测横版旋转截图是否还原 |
| **jsPDF** | 2.5.2 / 3.0.0（见未确认） | 只服务「导出PDF」一个按钮（`:1186-1225`） | 无 | **可不引**：`exportPreviewToPdf` 本质是「逐页 html2canvas → JPEG → 塞满整页」。新版可直接 `window.print()` 让用户选"另存为 PDF"，省掉 ~350KB 依赖。若产品要求"一键下载 PDF 文件"，再引 |
| **ClipboardItem / navigator.clipboard** | 原生 | 复制 PNG 到剪贴板 | — | 无需引；但要注意**移动端（iPad/iPhone）不可用** —— 旧版就是因此在手机端把按钮换成「微信分享(手机)」（Home 的 `z` = isMobile，`key34` vs `key35`） |
| **Element Plus**（13 个组件 + `ElLoading.service` + `ElMessage`） | — | 设置弹窗 + 元素编辑浮层 + 4 处 loading + ≥12 处 toast | 新版用 **Naive UI**（项目已定，见记忆 `naive-ui-preference`） | **不引**，逐个换：`el-dialog→n-modal`、`el-form→n-form`、`el-button→n-button`、`el-input-number→n-input-number`、`el-switch→n-switch`、`el-checkbox→n-checkbox`、`el-radio-group/button→n-radio-group/n-radio-button`、`el-select/option→n-select`、`el-divider→n-divider`、`ElLoading.service→n-spin`/`useLoadingBar`、`ElMessage→useMessage` |
| **HTML iframe 打印** | 原生 | `printFromContainer` / `ye` | 新版可复用同一套（生成 HTML 字符串 → iframe → `print()`），**无需新依赖** | 保留 |
| **Electron `electronAPI`** | 自研 preload | `silentPrint` / `getPrinters` | 新版是 Rust 后端 + 浏览器，**没有 Electron** | 「直接打印」按钮在新版**暂缓**（见记忆 `home-phase3-status`）。若要恢复，得改成后端接打印机服务，不是前端依赖问题 |

---

## 未确认

1. **`Vue` / `ElementPlus` 这两个全局是谁提供的**（CONFIRMED 它们不是 import）。
   `Home-d6b13b9a.js` 只有 11 条 import，没有 `Vue` / `ElementPlus`；
   全仓 `legacy/js/*.js` 搜不到 `window.Vue=` / `window.ElementPlus=`；`deobfuscate-home.mjs` 也没做这种重命名。
   **推断**：由 `legacy/` 里缺失的宿主 HTML（或某个未归档的入口脚本）挂到 window 上当全局用。
   对结论无影响（新版是正常 ESM 项目），但**如果要让旧版 bundle 单独跑起来做对照，会缺这一环**。

2. **jsPDF 到底是哪个版本**。
   vendor chunk 里有**两份 jsPDF**：
   - `E$1`，`.version="2.5.2"`（`@1604954`），被 `jspdf_es_min` 导出为 `default`/`jsPDF`，紧邻 html2canvas
   - `E`，`.version="3.0.0"`（`@3533690`）
   chunk 末尾只有一条 `export{E, ...}` —— 导出的是**裸名 `E`**，指向 3.0.0 那份；
   但 `E.version="3.0.0"` 那句我无法用括号配平可靠地判定是否在顶层作用域（该 chunk 4.8MB、含大量正则字面量与模板串，我的配平脚本对它有误判）。
   **倾向 3.0.0，但标为未确认**。好在组件用到的 API（构造器 + `addPage`/`addImage`/`save`）在 2.x/3.x 完全一致，**不影响新版决策**。

3. **`Ll` 与 `bl` 的分工**（Home 侧两个 `Vue.ref(false)`，`@333058` / `@333074`）。
   `Ri`（编辑收据单）**同时**改这两个；但按钮条件只读 `Ll`。
   `bl` 还被 Home 自己的二维码编辑浮层读（`@416262` / `@416363` / `@416707`）并渲染出 Home 的
   `Vue.Teleport(to:"body")`（`@517073`）。
   **推断**：`Ll` = 收据单编辑模式，`bl` = Home 侧元素/二维码浮层开关，两者在进入编辑时被一起置位。
   没追到 `bl` 在 ic=12 分支的独立语义，**标未确认**（属于 r2-edit 的范围，建议向那位同事确认）。

4. **`exportReceipt2PdfToBrowserPrint` 为什么存在**。
   它与 `printDirect` 内部完全同源（都只调 `ye()` = iframe 浏览器打印），Home 一次也没调用。
   **推断**：早期版本「导出PDF」按钮曾直连此方法，后来 Home 改成自己内联实现（`Xc`）并在 ic=12 时转调
   `exportPreviewToPdf`，这个方法就被落下了。无法从代码证实，标未确认。

5. **`printDirect` 里的 `JSON.stringify(t, null, 2);`**（`Receipt2.deobfuscated.js:1127`）。
   结果被丢弃、无副作用，明显是调试残留。是否原版就如此（而非解码工具引入）—— 从解码脚本
   （`legacy/decode-receipt2.mjs` 只做字符串替换，不改语句结构）看是**原有代码**，但我没有原始混淆串逐字对照，标未确认。

6. **Home 侧 `Hn`（`Vue.ref(0)`，`@354684`，存 `ao.value.scrollWidth`）具体喂给谁**。
   `yi`/`ui`/`pi` 等都会写它，但本次分工没追它的读取点（应该在 Home 模板的某个横向滚动/缩放进度逻辑里）。
   与收据单2 的对外接口无关，留待整体合成时由主分析师处理。
