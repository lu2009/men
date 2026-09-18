# 打印预览弹窗工具条 —— 新版还没做的按钮（逐颗逆向）

> 证据：`legacy/js/Home-d6b13b9a.js`（单行，字符偏移）、`legacy/js/Home.formatted.js`（Hui 用行号）。
> 本轮新解码并落盘（可复核）：
> - `/tmp/printService.dec.js` —— `legacy/js/printService-48210c48.js` 全解码（含 `exportToPDF`）
> - `/tmp/mutilPrintService.dec.js` —— `legacy/js/mutilPrintService-0d5f4920.js` 全解码（含 `transitPrintSingle`）
> - `/tmp/ps-map.json` / `/tmp/mps-map.json` / `/tmp/idx-map.json` —— 三张字符串表（已解旋转）
>
> 新版对照物：`app/src/components/PrintPreviewDialog.vue`（现只有 4 类按钮）、
> `app/src/utils/receiptImage.ts`、`app/src/utils/printService.ts`、`app/src/composables/useOrderPrint.ts`。
> 每条标 **CONFIRMED / INTERPRETED**；读不出的单列「未确认」。

---

## 0. 先销一个新版 TODO：`FinalReceipt` / `ReceiptList` 是哪个 ic

`PrintPreviewDialog.vue` 的 `EDIT_SPECS` 里留了「`FinalReceipt`/`ReceiptList` 对应旧版哪个 ic 没查实」。**查到了（CONFIRMED，两条独立证据互证）**：

| 模板 key | 旧版 ic | 旧版单据名 | 证据 |
|---|---|---|---|
| `FinalReceipt` | **5** | 收据单 | `hi` 偏移 **366755**：`Kn.value = registrant.template.FinalReceipt`，随后 `await Rn()`；`Xc` 的 `5==ic` 分支取 `FinalReceipt`，标题 `D=【收据单】` |
| `ReceiptList` | **6** | 订单汇总 | `Ci` 偏移 **368822**：`b = registrant.template.ReceiptList`，随后 `It.commentPreview(b, jn)`；`Xc` 的 `6==ic` 分支取 `ReceiptList`，`D=【收据清单】` |
| `receipt` | — | 客户回执单 | **不在 ic 1–16 里**。`ki`（「查看回执单」，偏移 381604）→ `It.preview('receipt', qn)` |

其余 ic ↔ 模板 key 的对应（`Xc` 逐分支读出，CONFIRMED）：
`1→glass`、`2→product`、`3→glassHole`、`4→lable`、`7→product1`、`8→product2`、`9→product3`、`10→product10`、`11→product4`；
`12/13/14/15/16` 是自绘单据（新版走 `doc`，不在本弹窗）。

---

## 1. 三个态标志 `oo` / `al` / `lo` —— 它们决定按钮显隐

做法：对 `al`/`oo`/`lo` 做**穷举**扫描（`.value` 与 `[解码器(N)]` 两种写法都算），因为 Home 里有大量同名**作用域局部别名**（如 2559 处的 `al={class:...}` 是 CSS 类对象，不是这个 ref），只按字面 grep 会误判。

| 标志 | 声明偏移 | 置 `true` 的地方 | 结论 |
|---|---|---|---|
| `oo` 收据单态 | 334471 `oo=Vue.ref(!1)` | **366580**（`hi` 内，同处 `ic=5`）；**367215**（`pi` 内，同处 `ic=12`） | `oo` ≡ **ic=5 或 ic=12** |
| `al` 汇总态 | 329253 `al=Vue.ref(!1)` | **367568 唯一一处**（`Ci` 内，随后同处 `ic=6`） | `al` ≡ **ic=6（订单汇总）** |
| `lo` 玻璃单态 | 334456 `lo=Vue.ref(!1)` | **434450 唯一一处**（`Uc` 内，随后 `ic=3`） | `lo` ≡ **ic=3（玻璃订单）** |

**`al` 的穷举证据（CONFIRMED）**：全文 `al[...]=` 共 24 处、`al.value=` 共 5 处，其中只有 **367568** 是 `=!0`，其余全是 `=!1`（各入口 handler 开头统一复位）+ 工具条上 2 处读取（497789 / 498056）。
⇒ **`al` 没有第二条置真路径。** 一旦用户点抽屉里的「订单汇总」，`al` 就为真并保持到下一次点别的入口。

**`oo` 的穷举证据（CONFIRMED）**：`oo[...]` 20 处，`=!0` 只有 366580（`hi`，ic=5）与 367215（`pi`，ic=12）。
⚠️ 也就是说「复制收据单 / 微信分享(手机)」这两族按钮在 **ic=12 也会出现**（新版 ic=12 走 `receipt2` 自绘抽屉，不归本弹窗管）。

**`lo` 的穷举证据（CONFIRMED）**：`lo[...]` 18 处，`=!0` 只有 434450（`Uc`，ic=3）。

### 对「按钮挂哪个 mode」的直接推论

- `oo` 那三颗（`复制收据单`/`微信分享`）→ 旧版 **ic=5 与 ic=12** 都能看到，新版拆开后 `ic=12` 归 `receipt2` 自绘抽屉，所以本弹窗只管 **ic=5 = mode `FinalReceipt`**。
- `al` 那三颗 → **mode `ReceiptList`（= ic=6 订单汇总）**，与 `EditSpec` 里的 TODO 结论一致。
- `lo` 那三颗 → **mode `glassHole`（= ic=3 玻璃订单）**。

因为 `al`/`lo` 都只有**唯一一处置真**且置真处紧接着就把 `ic` 设成对应值，「态」与「ic」在旧版里实际是**一一绑定**的；新版按 `mode` 挂按钮不会丢行为。

---

## 2. 逐颗分析

### 2.1 ` 导出PDF ` — `Xc` @449717（按钮 @499531，onClick @499584，文案是字面量 `" 导出PDF "`）

| 项 | 结论 |
|---|---|
| 显隐 | **全部 ic**（渲染顺序里排在最后，488578–499584 这一长串之外，无条件） |
| ① 做什么 | 按 ic 选「模板 key + 数据 + 标题」，调 `It.exportToPDF(key, data, title, onProgress)` |
| ② 依赖 | **纯前端**：jsPDF（`vue-ade658be.js` 导出 `E`）+ html2canvas（同文件导出 `d`）+ hiprint `PrintTemplate.getHtml`。无服务端、无第三方服务 |
| ③ 新版 | **能做** |
| ④ 落在 | **所有 mode** |

`exportToPDF` 全解码见 `/tmp/printService.dec.js`（CONFIRMED）：

1. `key` → `this.templates.get(key)`（模板表来自 `getTemplates` 接口，见 §2.1 末）；取不到 → reject `模板 "<key>" 不存在`。
2. 纸张：key 含 `lable` 或 `label` → **70×90 纵向**；否则 **297×210 横向（A4）**。
3. `key` 是标签族且 `data` 是数组 → **逐个元素一页**；否则 `getHtml(data)` 整份渲染，再数第一页里的 `.hiprint-printPaper`（没有就数 `.hiprint-printPanel`）：≤1 → 每个返回节点一页；否则**克隆节点 + 把非当前页 `display:none`** 后逐页截图。
4. 每页：离屏 div → `html2canvas(el, {scale:2, useCORS:true, allowTaint:true, backgroundColor:'#ffffff'})` → 按 `min(页宽/图宽, 页高/图高)` 等比缩放居中 → `addPage` + `addImage`。
5. `output('blob')` → 移动端/原生壳走分享；否则 `<a download>`，文件名 **`${title}_${Date.now()}.pdf`**。

**旧版自身的两个洞（都比新做一颗按钮更有价值）**：

- 🔴 **ic=13 与 ic=16 没有分支**（CONFIRMED：把 `Xc` 函数体 3921 字符里所有 `N==ic` 比较列出来，只有 `2,7,8,9,1,3,4,5,12,14,15,6,10,11`）。
  这两条落进 `else{}` 后什么都没设，`b` 保持 `""`、`g` 保持 `{}` → `templates.get("")` 是 `undefined` → reject → 提示 **「PDF导出失败: 模板 "" 不存在」**。
  ⇒ 旧版在「自定义合格标签族（ic=13）」和「自定义玻璃合片单（ic=16）」上点「导出PDF」**必定失败**。
- 🟡 **ic=10 / ic=11 的文件名是错的**：这两个分支忘了给标题变量 `D` 赋值，`D` 停在初始值 `【生产单】`，导出的 PDF 叫 `生产单_….pdf`。

**新版落地**：`app/package.json` 里 **没有 `jspdf`**，但它作为 `vue-plugin-hiprint@0.0.60` 的依赖已经躺在 `app/node_modules/jspdf`（`^2.5.1`）。
⇒ 能用，但**必须显式加进 `dependencies`**（吃传递依赖迟早被 hoisting/升级坑掉）。分页/截图那段可以照抄上面 3–5 步；`html2canvas` 新版已有。

---

### 2.2 ` 云打印 ` — `Zc` @441847（按钮 @488578，onClick @489631）

| 项 | 结论 |
|---|---|
| 显隐 | `12!==ic && 13!==ic && 14!==ic && 15!==ic && 16!==ic` ⇒ **ic 1–11**（`Zc` 内分支覆盖 2,7,8,9,1,3,4,5,6,10,11，正好齐） |
| ① 做什么 | 两条路：先试**本机 hiprint 客户端**，失败退**厂商中转服务器** |
| ② 依赖 | ①用户机器上的 electron-hiprint/hiprint 客户端（`localStorage.printServerIP` 或 `http://localhost:17521`）；②**厂商的 socket.io 中转服务** |
| ③ 新版 | **不能** |
| ④ 落在 | —（维持「不做」） |

两段式（`Zc` 尾部，CONFIRMED）：

- `ll.value` 为真时先 `ElementPlus.ElMessage.info('本地打印...')` →
  `It.printProduct2(key, data, {silent:true, printer, copies, registrant, margins:{0,0,0,0}, color:true})`。
  这条在 printService 里是 `hiprint.hiwebSocket.setHost(host)`，`host = localStorage.getItem('printServerIP') || 'http://localhost:17521'`，且**移动端强制用 `printServerIP`**；连不上会提示「连接失败: …」，3 秒后重试。
- 失败 → `ElMessage.warning('本地打印失败，正在尝试云打印...')` → `Ut.transitPrintSingle(key, data, {...})`。
- `ll` 为假直接走 `transitPrintSingle`。
- 两条都失败 → `throw new Error('本地打印和云打印都失败了。')`。

`transitPrintSingle` 全解码见 `/tmp/mutilPrintService.dec.js`（CONFIRMED）：

- `socket.io-client` 连 **`https://www.samrtdoor.com.cn:17521`**（白名单门店走 `https://v4.printjs.cn:17521`）。
- `auth.token = 'hiprint-smartdoor-' + (1088 + N)`，`N` 从 `userinfo.ds` 里 `/smartdoor(\d+)?/i` 抠；抠不到就是 `hiprint-smartdoor-1088`。
- emit `getClients`，**必须有一台已注册的 electron-hiprint 客户端**；一台都没有就抛
  **「没有可用的客户端，请确保有 electron-hiprint 客户端连接到中转服务」**。
- 然后把 `new PrintTemplate({template}).getHtml(data)[0].outerHTML` 塞进
  `{html, client, templateId, printer, type, copies, color, landscape, margins, silent}` emit `news`。

⇒ **“云打印”= 厂商服务器中转 + 用户端 electron-hiprint 客户端 + 打印机名。我们既没有那台中转服务器，也没有客户端。**
新版 `PrintPreviewDialog.vue` 头注释里已经写了「新版不做云打印」——**本轮找到确证，维持该决定**。半成品（只做「本地打印」那半）也不划算：那需要在 Hui/设置里补 `printServerIP` + 打印机列表 UI，而新版壳是 Tauri 桌面端，本机 17521 端口上没有那个服务。

---

### 2.3 ` 生成扣板 ` — `Yc` @436423（按钮 @496147，onClick @496241）

| 项 | 结论 |
|---|---|
| 显隐 | **只在 ic=2** |
| ① 做什么 | 遥控**Home 里挂着的隐藏 Hui 汇算组件**，让它弹**它自己的**扣板预览窗 |
| ② 依赖 | Hui 组件实例（`lc`）。本体是纯前端 HTML 拼串 + html2canvas |
| ③ 新版 | **不能照抄** |
| ④ 落在 | 不该落在 `product`（见下） |

`Yc` 体（CONFIRMED）：`lc.value.generateKouBanPreview()`，三道守卫——
`lc` 为空 → 「Hui 组件引用不存在」；方法不是函数 → 「generateKouBanPreview 方法不存在」；抛错 → 「生成扣板预览失败」。

`lc` 是什么：**Home 偏移 507352** —
`createVNode(a, {ref_key:'…', ref:lc, receiptData1:oc.value, style:{display:'none'}}, …)`，整块包在 `[[Vue.vShow, false]]` 里。
即 **Home 挂了一个隐藏的 Hui 汇算组件**，用 `ref` 驱动它：`calculateReceipt()` / `calculateReceiptOld()` / `calculateGlass()` / `Glasslist()` / `generateKouBanPreview()` / `lable()` 全靠它。
（Hui 的 exposed 名单在 `Hui.formatted.js:12846`，`generateKouBanPreview: _0xb16ece`。）

扣板预览本体 = Hui 的 `useKoubanPreview`（`Hui.formatted.js:7613`，CONFIRMED）：

1. 读 Hui 内部的算料结果 map（`_0x4d19f5`），按 `produce.<某字段>` **升序排序**，取每条的 `.data`；
2. 空 → `warning`「暂无扣板数据」；再过滤 `kou` 字段非空的，仍空 → 同一提示；
3. 拼 HTML 表格（表头 `扣板下单表`，列 **单号 / 门型 / 扣板**，`<br>`→`\n`）；
4. 写 `htmlContent` 并 `previewVisible = true` → **弹的是 Hui 自己内部的 el-dialog**（`Hui.formatted.js:12934`），里面还有一颗复制（`copyPreview`：html2canvas → 剪贴板，失败回退 `<a download>扣板.png`）。

⇒ 这颗按钮**在结构上根本不属于 Home 的预览弹窗**，它只是「远程遥控 Hui 弹它自己的窗」。

**新版落地**：新版 Home 与 Hui 是两个路由（`app/src/router/index.ts`），Home 里**没有 Hui 实例**，`lc` 没有对应物。
要做只有两条路：①用新版 `partsEngine` 的算料结果自己拼「扣板」HTML + 自带一个抽屉（走现行自绘单据那套）；②跳去 Hui。
**建议单独立项，不要塞进 `PrintPreviewDialog`。**

---

### 2.4 ` 导出excel ` — `tc` @418345（按钮 @496365，onClick @496454，`type:"success"`）

| 项 | 结论 |
|---|---|
| 显隐 | **只在 ic=2** |
| ① 做什么 | `uc`（生产单行）→ ExcelJS 单 sheet「生产单」，含门图嵌图 |
| ② 依赖 | **ExcelJS**（旧版是 `legacy/index.html` 的全局 `/vendor/js/exceljs.min.js`） |
| ③ 新版 | **能做，需新依赖** |
| ④ 落在 | **mode `product`**（ic=2） |

细节（CONFIRMED）：

- 空数组 → `warning`「没有可导出的生产单数据」。
- sheet「生产单」；`A1:I1` 合并大标题；第 2 行表头（紫底加粗）：
  `客户/门类 | 门图 | 单号 | 订单信息 | 方向 | 门扇 | 外框 | 亮窗/扣板 | 备注`。
- 列宽固定：`12,15,9,17,9,17,17,17,17`。
- 每行字段：`door`/`OrderID||orderID||qrcode`/`basicInfo`/`doorsheet`/`doorframe`/`windows||kou`/`remark`，全部 `<br>`→`\n`；行高由 `ec(text, 每行字数)` 估行数后 `Math.max(30, 15*c+15)`。
- `doorImg`（或 `lockImg`）是 dataURL 时用 `workbook.addImage` 插到第 2 列。

**新版落地**：`app/package.json` **没有 `exceljs`** ⇒ 需新增。数据源正好是新版 `buildBatchPayload(...).rows`（`productionProduces()`，字段名基本对齐）。
⚠️ ExcelJS 编译后 ~900KB，用 `await import('exceljs')` 按需加载，别进首屏。

---

### 2.5 `显示金额` / `去除金额` — `Vr` @355200（按钮 key28 @495696，`type:"warning"`）

| 项 | 结论 |
|---|---|
| 显隐 | **只在 ic=5** |
| ① 做什么 | 翻转 `Zn` → 重渲预览 → 提示 |
| ② 依赖 | 无 |
| ③ 新版 | **能做**（最便宜之一） |
| ④ 落在 | **mode `FinalReceipt`**（ic=5） |

按钮文案是动态的、而且**是反的**（CONFIRMED，@495696 解出来）：
`Zn.value ? 【显示金额】 : 【去除金额】`。即 `Zn=true`（当前已去除）时按钮写「显示金额」。

`Vr` 体（偏移 355200，CONFIRMED）：
`Zn.value=!Zn.value` → `await Rn()` → `ElMessage.success(Zn ? '已去除金额字段' : '已恢复金额字段')`。

`Zn` 的语义在 `Qn()`（偏移 354822，CONFIRMED）：真时
`jn.map(t => ({...t, total:0, deposit:0, balance:0, receipt: t.receipt.map(e => ({...e, price:0, amount:0, pricing:""}))}))`；假时原样 `jn`。

🔑 **关键：`Qn()` 不只服务这颗按钮。** 穷举 `Qn()` 的调用点（全文 8 处，其中 3 处是别的作用域里的同名字符串解码器，属别名陷阱），真实的 5 处是：

| 调用点 | 偏移 | 用途 |
|---|---|---|
| `Rn()` | 355100 | **预览重渲**（`commentPreview(FinalReceipt, Qn())`） |
| `hc` | 427802 | **复制收据单** |
| `Zc` ic=5 分支 | 446215 | 云打印 |
| `Xc` ic=5 分支 | 451644 | **导出PDF** |
| `Qc` ic=5 分支 | 455348 | **手动打印** |

⇒ 这个开关**同时作用于 预览 / 手动打印 / 导出PDF / 复制收据单**，CONFIRMED。
另外每次进 ic=5 时 `hi` 会把 `Zn` 复位成 `!1`（3664xx）。

**新版落地**：在 `buildBatchPayload` 之后对回执族载荷做一次「金额归零」变换即可（收据族是 `wrap` 无 key 的对象数组 `payload`），并让**预览、打印、导出PDF 共用同一份变换**。
落在 `mode === 'FinalReceipt'`（= ic=5，见 §0）。

---

### 2.6 `导出订单汇总` — `bi` @377920（按钮 @497577，onClick @497663，字面量 `"导出订单汇总"`）

| 项 | 结论 |
|---|---|
| 显隐 | `al && !z` ⇒ **ic=6 且非手机端** |
| ① 做什么 | ExcelJS；**每个客户一个 sheet**；末尾汇总行 |
| ② 依赖 | **ExcelJS**（新依赖） |
| ③ 新版 | 能做，**但缺一层「按客户聚合」** |
| ④ 落在 | **mode `ReceiptList`**（ic=6） |

`bi` 体（CONFIRMED）：`new ExcelJS.Workbook()`，遍历 `jn`（`Ci` 建好的**聚合数组**）——
sheet 名 = `e.client || '未知客户'`；`A1:B1` 合并「客户: XXX」；表头 12 列
`日期 | 型材 | 开向 | 颜色 | 玻璃 | 尺寸 | 数量 | 单价 | 金额 | 计价方式 | 付款状态 | 备注`；
逐行 `<br>`→`\n`；末尾 `A{n}:F{n}` 合并「订单汇总」+ Σ数量 + Σ金额，再 4 行
`订单总额 / 已付金额 / 剩余尾款 / 总门数`（取 `e.total / e.deposit / e.balance / e.门数`）；
最后给 3..i 行 × 12 列描边；下载 **`订单汇总_${new Date().toLocaleDateString()}.xlsx`**。

`jn` 的形状（`Ci` @367568，CONFIRMED）：按 `client` 分组——
- 组内只有 1 条 → 原样（补 `date` 到每行）；
- 多条 → 合成 `{client, total:Σ, deposit:Σ, balance: total-deposit, 门数:Σ, receipt: 各行拼起来并补 date}`。

**顺带一个副作用（新版不需要跟）**：`Ci` 渲染前会**就地改模板** —— 若 `ReceiptList` 的 `receipt` 列里没有 `payment` 字段，就在 `remark` 列前 `splice` 进一列 `{width:56, title:'付款状态', field:'payment', …, tableSummary:""}`。
而**导入的模板本来就带 `payment`**（`legacy/templates/print-templates-source-raw.json` 的 `ReceiptListTemplate` 含 `"payment"`），且该注入有 `some(field==='payment')` 幂等守卫 ⇒ 新版不需要复刻这一步。

**新版落地**：需要先补 `Ci` 的聚合层。新版 `printPayloads.ts` 的 `receiptPrintData()` 是**每单一个对象**（`buildBatchPayload` 的 `wrap` 无 key 分支），没有「按客户合并」，也**没有 `门数` 字段**
（`app/src/utils/printPayloads.ts:478` 只是注释里提到 `门数: i`；`receiptPrintData` 的返回字面量自 `:483` 起，实无此键 —— CONFIRMED）。
⇒ 「导出订单汇总」的前置 = 把 `Ci` 的聚合函数搬过来。落了它之后 `exceljs` 那部分照抄。

---

### 2.7 `复制成图片` — `Ei` @375712（按钮 @497788，onClick @497876）

| 项 | 结论 |
|---|---|
| 显隐 | `al && !z` ⇒ **ic=6 且非手机端** |
| ① 做什么 | 把**当前预览那一份 HTML** 截图进剪贴板 |
| ② 依赖 | html2canvas + `navigator.clipboard` / `ClipboardItem`（需安全上下文） |
| ③ 新版 | **能做，最便宜的一颗** |
| ④ 落在 | **mode `ReceiptList`**（ic=6） |

`Ei` 体（CONFIRMED）：取 `Wn.value`（当前预览 HTML）——
空 → `error`「未找到订单汇总内容，请先生成订单汇总」；
离屏 `div` 设 `position:absolute; left:-9999px; width:1123px; background:white` → `innerHTML` → 挂 body →
`html2canvas(el, {useCORS:true, scale:2, backgroundColor:'white'})` → `toBlob('image/png')` →
`new ClipboardItem({'image/png': blob})` → `navigator.clipboard.write` → 「订单汇总图片已复制到剪切板！可直接粘贴」；
`finally` 用 `document.querySelector('body > div[style*="-9999px"]')` 清理。

**新版落地**：`utils/receiptImage.ts` 的 `copyReceiptImage(html)` 就是同一套。
两处参数差异要留意：旧版这里 **`width:1123px` + `scale:2`**，而 `copyReceiptImage` 是**裸容器 + 默认 scale 1**。
要「一像素不差」就得给 `receiptImage.ts` 加可选参数（宽度/scale），别另写一份。

---

### 2.8 `复制玻璃单` — `vc` @424179（按钮 @498316，onClick @498438）

| 项 | 结论 |
|---|---|
| 显隐 | `lo && !z` ⇒ **ic=3 且非手机端** |
| ① 做什么 | 玻璃订单预览整份截图进剪贴板（失败时顺手记「已打印」） |
| ② 依赖 | html2canvas + clipboard |
| ③ 新版 | **能做** |
| ④ 落在 | **mode `glassHole`**（ic=3） |

`vc` 体（CONFIRMED）：`x()` 取用户数据 → `n = registrant.template.glassHole` → `It.commentPreview(n, rc.value)`（`rc` 是 ic=3 入口 `Uc` 里 `lc.value.Glasslist()` 的返回，`rc[0].glassInfoList` 才是 `Nc`）→
离屏 `div` 设 **`width:1200px; font-size:30px; font-family:Arial; line-height:3.5`** →
`await document.fonts.ready` → `html2canvas({useCORS:true, scale:2})` → `toBlob` → `ClipboardItem` → 「图片已复制到剪切板！可直接粘贴」；
`catch` 分支里还捎带做了「标记已打印」（`Kc`/`Hl`/`Gl` 三个：写已打印单号集合）。

**新版落地**：复用 `copyReceiptImage`（新版预览 HTML 就是 hiprint 渲的 glassHole）。
⚠️ 同样要注意旧版这里**显式设了容器 style + `scale:2`**，与 `receiptImage.ts` 的默认口径不同。

---

### 2.9 ` 导出玻璃订单 ` — `Ic` @432452（按钮 @498874，onClick @498975，`type:"primary"`）

| 项 | 结论 |
|---|---|
| 显隐 | `lo && !z` ⇒ **ic=3 且非手机端** |
| ① 做什么 | ExcelJS 单 sheet「玻璃订单」，含挖孔图嵌图 |
| ② 依赖 | **ExcelJS**（新依赖） |
| ③ 新版 | 能做，需 exceljs |
| ④ 落在 | **mode `glassHole`**（ic=3） |

`Ic` 体（CONFIRMED）：表头 9 列 `单号 | 客户 | 玻璃名称 | 宽度(mm) | 高度(mm) | 厚度(mm) | 数量 | 挖孔图 | 备注`，列宽 `15,15,15,12,12,12,8,25,30`；
**数据源是 `Nc`（`rc.flatMap(e => e.glassInfoList)` 的扁平数组），不是 `rc`**（和 `vc` 用的不是同一份）；
`x()` 取 `userinfo.registrant`，**`=== '名甸门业'` 时把 `remark` 清空**；
`doorImg` 以 `data:image` 开头时 atob→Uint8Array→`workbook.addImage({buffer, extension:'jpeg'})` 塞进第 8 列（并把该列宽改成 12）。

**新版落地**：行 = `buildBatchPayload(...).rows`（正是 `glassInfoList`）。注意保留「名甸门业 remark 清空」这条门店特判（新版 `printPayloads.ts:211` 已经有同一个特判，可复用判据）。

---

### 2.10 `微信分享(手机)` — `pc` @428424 / `Li` @376525 / `fc` @425381

| 项 | 结论 |
|---|---|
| 显隐 | 三颗同名按钮，分别挂 `oo && z`（收据单）/ `al && z`（订单汇总）/ `lo && z`（玻璃单） |
| ① 做什么 | 当前预览 HTML → 图 → 系统分享面板 |
| ② 依赖 | Web Share **Level 2**（`navigator.canShare({files})`）；原生壳那半要 Capacitor |
| ③ 新版 | **载体不存在** |
| ④ 落在 | — |

`z`（手机端）不重查：Home 偏移 **327954** —
`Vue.onMounted(() => { const t=/iPad|iPhone|iPod/.test(navigator.userAgent); z.value = v.isNativePlatform() || t })`。
已见 `docs/2026-09-17-home-print.md:84` 与 `app/src/components/ReceiptOtherDialog.vue:56-61`（新版壳是 Tauri 2 桌面端，`isNativePlatform()` 那半没有对应物 ⇒ 只留 UA 那半）。

三颗的共同动作（CONFIRMED）：`Wn`（当前预览 HTML；汇总那颗显式 `width:1123px`）→ 离屏 div → `await document.fonts.ready` → `html2canvas` → blob →
`new File([blob], 'receipt.png'|'glass.png', {type:'image/png'})` → `navigator.canShare({files})` 为假就抛「浏览器不支持文件分享」→ `navigator.share({files, title, text})`；
否则若 `isNativePlatform()` 走 Capacitor `Filesystem.writeFile(Cache)` + `Share.share`；
**两样都不支持时静默什么都不做**（桌面浏览器上的典型结果）。

🟡 顺带一个旧版 bug（@498140，CONFIRMED）：`Li`（汇总那颗）的 loading 文案读的是 **`vl.value`**（`Ei` 的 loading ref），不是它自己的 `fl` ——
所以它**永远不显示「分享中...」**。`pc`/`fc` 各自读 `Ml`/`yl`，是对的。

**新版落地**：`z` 在新版只保 UA 那半 ⇒ 桌面 UA 恒为假 ⇒ **这三颗没有出现条件**。
处置：并入既有的「分享回执单(手机)」那条路（`receiptImage.shareReceiptImage` + `ReceiptOtherDialog.vue` 的回退下载），
**不要在新弹窗里复制成三颗**。

---

### 2.11（补一颗，任务表外但同一排）`复制收据单` — `hc` @427351

`oo && !z` ⇒ ic=5（和 ic=12）且非手机端。体（偏移 427351，CONFIRMED）：

- **先判 ic=12**：`Xn.value.copyPreviewToClipboard(ao.value)` —— 委托给自绘收据单组件，直接 return。
- ic=5：`b = registrant.template.FinalReceipt` → **`It.commentPreview(b, Qn())`**（注意吃了 `Qn()`，见 §2.5）→
  离屏 div `position:absolute; left:-9999px; width:auto; display:inline-block; font-size:30px; Arial; line-height:3.5` →
  `await document.fonts.ready` → `html2canvas(el, {useCORS:true, scale:2, width: scrollWidth, height: scrollHeight})` →
  `toBlob` → `ClipboardItem` → 「图片已复制到剪切板！可直接粘贴」。

与 `vc` 的差别：模板/数据源不同、提示文案不同、**旧版为它显式传了 width/height（`scrollWidth`/`scrollHeight`）**。
新版已用 `PrintPreviewDialog` 的「复制回执单」覆盖了 `receipt` mode；
**若补 §2.5 那颗（`FinalReceipt` mode），可以顺手把 `hc` 也挂上去**（同一份 `copyReceiptImage`，但要注意上面那组显式尺寸）。

---

## 3. 旧版里的死代码 / 坏按钮（比实现它们更有价值）

1. 🔴 **`导出PDF` 在 ic=13 与 ic=16 必定报错**（无分支 → 模板 key 是空串 `""`）。见 §2.1。
2. 🟡 **`导出PDF` 在 ic=10 / ic=11 文件名错**（`D` 未赋值，落成「生产单_….pdf」）。见 §2.1。
3. 🟡 **`al` 全文件只有一处置真** ⇒ 「汇总态」实际上就是「ic=6」。谁若把它当通用「有汇总数据」标志来用会误用。
4. 🟡 **`Li` 的 loading 文案读错 ref**（读 `vl` 而非 `fl`），「分享中...」永不出现。见 §2.10。
5. ⚪ `pi`（ic=12）把 `Kn.value` 设成硬编码的 **`'FinalReceipt2'`**（偏移 367229）——模板表里根本没有这个 key（`getTemplates` 只返回 `receipt/product/product1..10/glass/glassHole/lable/FinalReceipt/ReceiptList`）。
   只有 `qi` 的 `else`（ic≠5 且 ≠12）分支会读它 ⇒ 是**死值**。
6. ⚪ `生成扣板` 的三道守卫文案（「Hui 组件引用不存在」/「…方法不存在」）在正常路径上永远不会触发 —— 它们恰是「Home 依赖一个隐藏的 Hui 实例」这个脆弱结构的补丁。见 §2.3。

---

## 4. 新版落地建议表（照抄用）

| 旧版按钮 | 旧版 ic / 态 | 新版 mode | 可行性 | 依赖动作 |
|---|---|---|---|---|
| ` 导出PDF ` | 全部 ic | **所有 mode** | ✅ 能（顺手补 ic=13/16 的洞） | `jspdf` 提为显式依赖 |
| ` 云打印 ` | 非 12–16 | — | ❌ **不能** | 厂商 socket.io 中转 + electron-hiprint 客户端 |
| ` 生成扣板 ` | 2 | —（不属于本弹窗） | ❌ 不能照抄 | 需单独立项重写扣板 HTML |
| ` 导出excel ` | 2 | **`product`** | ✅ 能 | 新依赖 `exceljs` |
| `显示金额`/`去除金额` | 5 | **`FinalReceipt`** | ✅ 能 | 无（载荷后处理，打印/导出共用） |
| `导出订单汇总` | `al` ≡ 6 | **`ReceiptList`** | ⚠️ 能，但**先补按客户聚合层** | `exceljs` |
| `复制成图片` | `al` ≡ 6 | **`ReceiptList`** | ✅ 能（复用 `copyReceiptImage`） | 无（建议给 `receiptImage.ts` 加 width/scale 参数） |
| `复制玻璃单` | `lo` ≡ 3 | **`glassHole`** | ✅ 能 | 同上（旧版 `1200px` + `scale:2`） |
| `导出玻璃订单` | `lo` ≡ 3 | **`glassHole`** | ✅ 能 | `exceljs` |
| `微信分享(手机)` ×3 | `oo`/`al`/`lo` && `z` | 三族 | ❌ 载体不存在 | 并入 `ReceiptOtherDialog` 那条路 |
| （补）`复制收据单` | `oo && !z` | `FinalReceipt` | ✅ 能 | 无 |

**最小可交付的一批（无新依赖）**：`显示金额/去除金额`(FinalReceipt) + `复制成图片`(ReceiptList) + `复制玻璃单`(glassHole) + `复制收据单`(FinalReceipt)。
**加一个新依赖（`exceljs`）能多拿三颗**：`导出excel` / `导出订单汇总` / `导出玻璃订单`。
**再加 `jspdf` 显式声明能拿一颗覆盖全部 mode 的**：`导出PDF`。

---

## 5. 未确认

1. **`ll`**（云打印里决定「先试本地打印」的那个开关）在哪置位、UI 长什么样 —— 只知 `Zc` 读它（`if(ll.value){…}`），没做全量扫描。**未确认**。
2. 新版 `ReceiptList` 走的 `receiptPrintData('订货清单')` 返回对象里**没有 `门数`**；是否在别处补齐未查。**未确认**（已 CONFIRMED 的是「`receiptPrintData` 的返回字面量里没有这个键」，见 `printPayloads.ts:483-508`）。
3. `wn`/`gn` 这两个 reactive map 的**键**与「表格勾选」的关系：只扫到写入点（`Rc`/`V.includes(l)`/`isSelected`，约 390333–391071 与 403376）——「打印的是勾选行还是整张表」**没有结论**。
   与本任务的三个态标志无关，但会影响「导出订单汇总」到底覆盖哪些单。**未确认**。
4. `Ei` 的 `finally` 用 `document.querySelector('body > div[style*="-9999px"]')` 清理 —— 这是**全局选择器**，同页若有别的离屏容器会被误删。是否为已知问题未查。**INTERPRETED**（读代码即可见，但未见运行时表现）。
