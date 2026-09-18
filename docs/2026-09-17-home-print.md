# Home 打印（2026-09-17）

> 本文记录两件事：① 把打印**数据构造层**从 `Hui.vue` 抽成公共模块（Home 与 Hui 共用同一份实现）；
> ② Home 的「打印选中订单」抽屉。旧版 Home 打印的完整逆向见文末 §4 的结论汇总。

## 1. 为什么必须抽公共模块

Home 的打印是**按同一批模板**出单据的，和 Hui 的「模板预览/打印」走的是**同一套载荷构造器**
（`Hui.vue` 里的 `templatePayload` 及其下游 17 张模板各自的数据源）。旧版也是同一份代码
（Home 与 Hui 共用 `printService`）。

新版原先这些构造器全在 `Hui.vue` 组件作用域里、直接读组件 ref（`lines.value` / `order` /
`tenantName.value` …），Home 拿不到。两条路：复制一份（必然漂）或抽出来（一次到位）。
选了后者。

### 抽出的三个文件

| 文件 | 内容 | 谁用 |
|---|---|---|
| `utils/partsEngine.ts` | 算料引擎：`formulas + 行` → 部件数组（`PartPreview[]`）；含 `Line`/`PartPreview`/`EngineId` 类型、`pk`/`round2`/`partsCache` | Hui 的表格、Hui/Home 的打印 |
| `utils/printPayloads.ts` | 17 张模板的载荷构造（`createPrintPayloads(ctx)`）+ 单行文本工具（`dimSizeLabel`/`glassSpecPrintable`/`pricingDetail`/`receiptRemark`/`lineLockImage`/`casingAmountOf` …） | Hui、Home |
| `composables/useOrderPrint.ts` | 「订单 → `PrintContext`」装配 + **批量合并成一次打印任务** | Home（Hui 用自己组件内的 ctx） |

`Hui.vue` 因此净减 **~2300 行**，只剩下薄封装（`formulaOf`/`isDiamond`/`computeParts` 各一行转发）
与 `printCtx` 计算属性 —— 调用点一行没改。

### 搬运的忠实性怎么保证

- 只改「状态从哪来」：`lines.value → ctx.lines`、`order. → ctx.order.`、`formulas → ctx.formulas` 等，
  **格式化逻辑逐字未动**（`docs/2026-09-10-template-field-audit.md` 的逐字段结论仍然适用）。
- 搬完做了一次**全行匹配核对**：被搬走的 2029 个非空行逐行在新文件里能对上（12 处例外全部核实过是
  注释改写、`MarkupItem` 改用 `markupLines.ts` 里已有的那份、以及三个 `computed` 改普通函数的括号）。
- 用真实订单跑了 17 张模板的载荷构造，逐张产出正常；又跑了「选中 2 单」的批量形状（见 §3）。

## 2. Home 的打印 UI

工具栏「打印选中订单（N）」→「打印选项」抽屉（右侧 900px）：

- **单据按钮**：按模板列，分组为 生产类(10) / 玻璃类(2) / 标签类(2) / 收据类(3)。
  旧版按钮组是 ~24 个入口、`ic` 1–16，其中好几个是**同一张模板换引擎/换行过滤**
  （如「平开门生产单」「移门生产单」都是 `ic=2`）；新版一张模板一个按钮。
- **预览 / 打印**两个动作。预览 = `renderByMode`（hiprint 真渲染，与实打同一套渲染核心）。
- 进抽屉时统一拉齐：订单明细（没展开过的也拉）、`formulas`、`clients`、收款码（IndexedDB）、
  各行公式的挖孔图。

### 取数对照（旧版 → 新版）

| 项 | 旧版 | 新版 |
|---|---|---|
| 明细 | 只消费**已展开行**的子表数据，未展开就打空白 | 进抽屉时**统一兜底 `getOrder`**（有意改进） |
| 算料 | `calculateReceipt` 等按 `ic` 各跑一套引擎 | `partsEngine` 按模板列特征选引擎（同一份） |
| 模板 | `userinfo.registrant.template.*` | 后端 `print_templates`（同 17 张） |
| 打印 | 本地 hiprint + socket.io 云打印两路 | 只用本机 hiprint |
| 批 | 一次构造整批、打**一个任务**（N 页） | 同左 |

## 3. 批量形状（`buildBatchPayload`）

| `templatePayload` 形状 | 合并方式 | 例子 |
|---|---|---|
| `wrap`（表头 + 行数组） | **每单一个对象** → 一份单据一页 | 回执族、玻璃订单 |
| 有 `key`（`produces`） | 各单行**拼成一张表**，模板 `maxRows` 翻页 | 生产单、玻璃合片单 |
| 无 `key`（本身就是行数组） | 各单行**直接串起来**，一行一页 | 标签、生产标签、oldSheet |

实测（真实订单 ×2）：

```
receipt/FinalReceipt/ReceiptList  payloads=2 rows=4      glass    payloads=1 rows=4
glassHole                         payloads=2 rows=8      lable    payloads=12 rows=0
product/product1/product4..9      payloads=1 rows=4      product10 payloads=6 rows=0
product2                          payloads=4 rows=4      product3 payloads=2 rows=4
```

## 4. 旧版 Home 打印逆向结论（供后续对照）

- 工具栏**只有一个**按钮：工厂 `Yt` →「打印选中订单」、终端 →「查看回执单」，**onClick 是同一个** `Gi`。
- `Gi`：建 socket.io 云打印通道（`$t` 默认 `http://localhost:17521`；`mutilPrintService` 内默认
  `https://v4.printjs.cn:17521`，token = `ds` 数字段 + 1088）→ 聚合选中订单 → 打开「打印选项」抽屉。
- 抽屉内 24 个按钮，按钮 handler 内部同时写 `ic`（1–16，默认 1）；操作按钮栏随 `ic` 变。
- **抽屉最上面**还有一组（`ki` / `Nn`，`div.drawer-content`）：
  - 「查看回执单」`ki`：`It.preview("receipt", …)` 出 HTML → **它自己的**预览弹窗（`Ai`，宽 1180px；
    工具条 = 关闭 / 打印(= `zi`) / 手动打印(= `Fi`) / 编辑回执单 / 复制回执单(`!z`)）。
  - 「回执单-其它」`Nn`：只 `Mn.value = true` → 开第二层**嵌套**抽屉（`size:350`，与外层同宽同侧）。
    工具条 = 直接打印(`zi`,`Yt`) / 手动打印(`Fi`,`Yt`) / 复制(`Mi`,`!z`) / 分享(`Ni`) / 下载(`xi`,`Yt`)。
    `z` = 手机端（`isNativePlatform() || /iPad|iPhone|iPod/.test(ua)`，:7579）；
    `Yt` = 工厂态（:7581 `ref(true)`，仅 `userinfo.defaulted === 3` 终端账号置 false，:8147/:7885）。
  - `zi`（直接打印回执单，:8691）**是静默直打、不是本机对话框**：`ElLoading` → 取 `registrant.pagesize.receipt`
    /`registrant.copy.receipt` 作 printer/copies → `ll`(云打印开关，默认 false) ? `Ut.transitPrintMultiple`
    (printjs 云中转, `silent:true`) : `It.printLandscape`(桌面 hiprint 客户端 localhost:17521)。
    源码里那句「正在尝试本地打印」**只是文案，catch 里没有任何本地打印调用**。
- 终端用户：只有「查看回执单」+「回执单-其它」，Yt 专属按钮全部隐藏。

## 5. 未做（有意）

| 项 | 原因 |
|---|---|
| **收据单2**（`ic=12`，`Receipt2PrintManager`） | 不是 hiprint 模板，是 Home 里一个自绘组件（手拼 HTML + 十项元素级偏移/字号配置 + 就地 `contentEditable` 编辑 + 复制 PNG）。工作量与 17 张模板之和相当，需要单独排期。见 `docs/2026-09-16-print-font.md` |
| 云打印（socket.io → `v4.printjs.cn:17521`） | 依赖第三方服务与账号；新版只用本机 hiprint |
| 合格标签 / 生产单2 / 玻璃合片单2（`ic=13–16`） | 旧版是自绘 HTML 组件，不在 17 张模板里 |
| 「查看回执单」预览弹窗 | **已由「电子回执单」覆盖**：Home 行操作列的「电子回执单」进 `/receipt-view/:回执单号`，可复制分享链接发客户。旧版那个弹窗的实质价值（给客户看 + 分享）都在。⚠️ **2026-09-18 更新**：抽屉顶部的「查看回执单」入口**已做**（走 `openMode('receipt')`），只是与「电子回执单」并存 |
| 回执单-其它里的「直接打印回执单」(`zi`) | 它是**云中转/hiprint 客户端静默打印**（见 §4），新版两条载体都没有 ⇒ 与「云打印」同理省略。其余四颗（手动打印 / 复制 / 分享 / 下载）**2026-09-18 已做**：`ReceiptOtherDialog.vue` + `utils/receiptImage.ts` |
| 复制/下载单据为 PNG（html2canvas） | **2026-09-18 已做**（仅限回执族，`utils/receiptImage.ts`）：html2canvas 早已作为依赖装上（`utils/receipt2/print.ts` 在用） |
| `orderQrcode`（订单查询二维码 / 终端只读页） | 终端页新版未做，模板里那一格留空（旧版取不到值时也是空） |
