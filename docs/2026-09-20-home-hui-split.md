# Home.vue / Hui.vue 拆分：方案（含决策记录）

> **目标**：把两个巨型 SFC 的 `script setup` 切成可独立理解、可独立改的件，
> **一行行为都不改**。为 `ui-upgrade` 的重设计铺路 —— 在一个 3650 行的文件里改 UI，
> 改一行要看一屏，diff 也分不清是设计改动还是顺手碰到的东西。
>
> **验收** = `npm run verify`（35 台子全绿）+ `npm run build` + 搬迁件逐字一致。
> **不是**「我觉得没坏」。
>
> ⚠️ **本文所有行号是 `28e36d21`（2026-09-20）的快照**。这个文件一旦开始拆，
> 行号立刻全部漂移 —— **动手前必须按当时的工作区重新核一遍段界**（见 §7）。
> 本仓库已有教训：`2026-09-19-hui-shell-audit.md:445` 记着「原先写『我们 `Hui.vue:142-155`』
> —— 行号早已漂移」。

---

## §0 结论

1. **病在 `script setup`，不在模板。** Home 的 template 只有 413 行，12 个外挂组件早就挂好了；
   臃肿全在 2891 行的 script。所以这次**基本不动模板与 CSS** —— 这一条直接消掉了最大的一类风险
   （见 §6.6）。
2. **`columns`（Home 的 335 行）不能抽**，它引用 30 个标识符、横跨 9 个分区。
   抽出来只是把「一个长文件」换成「一个长参数表」。同理 Hui 的 `onMoreSelect`/`onMounted`/`saveOrder`
   必须留在页面。
3. **三处「引用同一性」是静默失效点**（`colVis` / `engine` / `detailHooks`），
   搬错**不报错、类型也对**，只是界面悄悄不对。这是本次最需要钉住的机制。
4. **仓库里唯一能证明「搬迁没改逻辑」的机器造好了却没通电**：
   `docs/home-audit/hui-extract-movecheck.mjs` 以 `-movecheck` 结尾，而统一入口的收集正则要 `-check`
   —— 差一个字符，它既不在 `npm run verify` 也不在 CI。本次要用它，**得先接上**（§4 步 0）。
5. **顺带发现一批当前不生效的 CSS**（15 条规则，§1.5）。属**现存 bug，不是拆分造成的**；
   本次**只记账不动**（用户 2026-09-20 拍板），理由是修它 = 行为变化，
   而重设计时这批样式本来就要重写。

---

## §1 现状实测

### 1.1 结构数字（`28e36d21`）

| | 总行 | 字节 | template | **script setup** | style scoped |
|---|---|---|---|---|---|
| `app/src/views/Home.vue` | 3650 | 169076 | 1–413 | **416–3305（2890）** | 3308–3650（343） |
| `app/src/views/Hui.vue` | 2605 | 112313 | 1–595 | **598–2214（1617）** | 2217–2605（389） |

> 数字是 2026-09-20 实测（`grep -n '^<script setup' / '^</script>'`）。括号里是**纯内容行数**
> （不含 `<script>` / `</script>` 两行标签）—— 引用时以内容区间为准，别把标签行算进去。

两个文件的 `<style>` **都是纯 scoped，没有会外溢的全局块**。

### 1.2 Home script 的 23 处分区（按体量）

Home 的 script 有 23 处 `// -----` 分区注释，缝是现成的：

| 段 | 行 | 行数 |
|---|---|---|
| tooltip + `renderEditable` + `headerFilter` + `columns` | 2678–3306 | **629** |
| 删除选中 | 1550–1804 | 255 |
| 行级状态类（`dupKey`/`rowClass`/`renderExpandDetail`） | 2016–2258 | 243 |
| 手动更新进度 + 自定义进度项 | 2340–2565 | 226 |
| 「查询更多」弹窗 | 1205–1383 | 179 |
| 列头原生筛选 | 716–884 | 169 |
| 改客户名 / 改日期 | 1060–1204 | 145 |
| 展开明细 | 1888–2015 | 128 |
| 打印选中订单 | 1411–1528 | 118 |
| 列定义 | 2566–2677 | 112 |
| 查单号 | 614–715 | 102 |
| 清账 | 1805–1887 | 83 |
| 查单号的两个动作 | 2259–2339 | 81 |
| 分页 | 885–957 | 73 |
| imports | 415–486 | 72 |
| 行状态色 | 958–1017 | 60 |
| 常量 | 487–537 | 51 |
| 内联编辑 | 1018–1059 | 42 |
| 数据 / 加载 | 538–577 | 40 |
| 财务 / 进度口径 | 578–605 | 28 |
| 财务抽屉 | 1384–1410 | 27 |
| 电子回执单 / 经营看板 | 1529–1549 | 21 |
| 筛选 | 606–613 | 8 |

⚠️ **但按这 23 段一对一抽是错的** —— 实测有 3 段是错位的：
`filtered`(689) 被塞进「查单号」段、`summary`(864) 被塞进「列头原生筛选」段、
`pad`(1108) 定义在「改客户名/改日期」段却服务 3 个分区；另有 1 段（1060–1203）混了 5 件事。
**切缝按 §3 重新划过，不按这 23 段。**

### 1.3 共享状态拓扑（Home）

**真横切**（必须设计接口，不能靠相邻切）：

| 状态 | 定义 | 读写点数 |
|---|---|---|
| `load()` | 546 | **11 个调用点 / 9 个分区** |
| `unpaidOf` | `utils/homeMetrics.ts:16`（`28e36d21` 时在 `Home.vue:583`；2026-09-20 随 B2 搬走） | 9 个分区 |
| `rawOrders` | 542 | 8 个分区（`submitQuery` 读写、`deleteSelected`、`clearAccounts`、`dashboardOrders`…） |
| `fmt` | `utils/homeMetrics.ts:14`（`28e36d21` 时在 `Home.vue:581`；2026-09-20 随 B2 搬走） | 7 个分区 |
| `filtered` | 689 | 6 个分区 |
| `checkedRowKeys` | 1558 | 6 个分区 + 模板 5 处 |
| `financeSummary` | 544 | 5 个分区 |
| `page` | 888 | 4 个分区 |
| `expandedRowKeys` / `expandedIds` | 1891 / 2064 | 4 个分区 |
| `details` | 1892 | 4 个分区 |
| `searchText` | 609 | 4 个分区 |
| `auth` | 483 | 4 个分区 |
| `message` / `dialog` | 484 / 485 | 约 15 / 4 个分区 |

**只是偶发共用**（别为它们设计跨块接口，应就地重排）：
`progressFilter` 被「手动更新进度」段写(2447) —— 是**全文件唯一的跨区写**，是「右键删自定义操作项时顺带清筛选」。
它不该变成两块之间的接口，应改成注入一个 `clearProgressFilterIfEqual(v)` 回调。

**放错位置的工具/常量**（不是状态横切，是「在文件里放错了」）：
`pad`(1108，三处共用)、`headWithStatus`(2489，被 1139/2526/2557 调)、
`AUTOCOMPLETE_ALWAYS_SHOW`(536)、`progressSegments`(2592)、`PROGRESS_OPTIONS`(495)、
`EMPTY_FILTER_VALUE`(735)。**搬迁前先归位到 `utils/`，再谈切块。**

### 1.4 Hui script 的功能分段

Hui 只有 **4 处** `// =====` 分区注释（693 加价目录、1005 列显隐、1108 加价项目管理、1988 预览），
中段约 900 行是**无分区的连续代码**。

⚠️ **本节的段划分初版是按「顶层声明清单」盘出来的，不是逐行读出来的** —— 结果漏了
1532–1940 整段（409 行）。**已在 2026-09-20 自查时补测**，修订后的块划分见 §3.3，
漏项与教训见 §8.2-3。以下是关键顺序约束（**都是 setup 顶层即时求值，搬错就炸**）：

关键顺序约束（**都是 setup 顶层即时求值，搬错就炸**）：

| 行 | 约束 |
|---|---|
| 874 | `useOrderLines({lines, formulas, order, orderId, disableAutoMarkup})` 必须晚于 785/851/856/861/863 |
| 1233 | `ref(disableAutoMarkup.value)` **即时读值** ⇒ 必须晚于 863 |
| 1353 | `ref(strToTs(order.order_date))` ⇒ 必须晚于 785 |
| 1429 | `savedSnap = serializeOrder()` **即时调用** ⇒ 必须晚于 785/851 |
| 1631 | `useDetailLineDialogs({lineRefresh: engine.lineRefresh})` ⇒ 必须晚于 874 |

**Hui 全文件没有键盘快捷键**。两个 window 监听只有 `beforeunload`(2191) 与 `storage`(2192)，
且 `storage` 那个**从不摘除**，`onBeforeUnmount`(2148–2150) 只摘 `beforeunload` —— 这个不对称**不要顺手修**。

### 1.5 现存问题：15 条当前不生效的 CSS（**本次不修**）

单元格 vnode 是在 `NDataTable` 的 `render` 回调里建的，`currentRenderingInstance` 是表本身，
**vnode 拿不到本组件的 `data-v`** ⇒ 普通 `<style scoped>` 一条都不命中。
本仓库已有两次实测记录（`2026-09-16-hui-table-audit.md:149-150`、
`2026-09-16-markup-gap.md:199-203`，后者留有「实测 display 仍是 block、字号 12px、
颜色也不是 #1302fa」的数据）。

Home.vue 里下列规则**是裸类名、没有 `:deep()` 版本，且目标元素全在 render 回调里**
（已核实：这些类名在模板 1–413 里出现 **0** 次，在 script 里出现在活代码行上）：

| 规则 | 行 | 目标元素由谁建 |
|---|---|---|
| `.editable-cell` / `.clickable-cell` | 3427 / 3435 | `renderEditable`(2821)、已付列(3200)、客户列(3088)、日期列(3118) |
| `.action-buttons` | 3440 | 操作列(2977/2981) |
| `.progress-cell` / `.progress-bar` / `.progress-seg` | 3446 / 3450 / 3458 | 打单操作列(3269)、`renderProgress`(2640/2643) |
| `.header-filter` / `.filter-item` | 3472 / 3479 | `headerFilter`(2890/2936) |
| `.order-no-pop` | 3516 | 单号集列(3068) |
| `.expand-detail` | 3522 | `renderExpandDetail`(2137/2180) |
| `.input-style` / `.borderless-input` | 3397 / 3413 | `renderEditable`(2821) |
| `.detail-block` / `.detail-title` | 3526 / 3529 | **谁都不建 —— 纯死码** |

⚠️ 关于 `.input-style` / `.borderless-input` 要说准：这两条**是带 `:deep()` 的**
（`.input-style :deep(.n-input__textarea-el)`）。机制更细一层 —— `:deep()` 只能穿透到
**头选择器那个元素的内部**，而头选择器 `.input-style` 自己仍然需要 `data-v`。
所以不生效的**不是** `:deep()` 那一半，是头选择器那一半。结论相同，理由不同。

**处置**（用户 2026-09-20 拍板）：**只记账，不动。** 把它们改成 `:deep()` 是**行为变化**
（规则从死变活，格子会突然长成另一个样子），与「零行为变化」冲突。
等 `ui-upgrade` 重设计时一并处置 —— 那时本来就重写样式，不存在「不能修」。

---

## §2 决策记录（2026-09-20 用户拍板）

| # | 问题 | 决定 |
|---|---|---|
| 1 | 这次拆分和 `ui-upgrade` 重设计的关系 | **纯搬迁，零行为变化。** 每步用 build + 35 台子验收，拆完再在干净的小文件上做重设计 |
| 2 | 切分粒度 | **按 §3 的方案**（Home 12 块 / Hui 10 块）。`columns` 那 335 行不让动。⚠️ **见 §8.2-3**：用户拍板时我给的 Hui 清单是**按声明清单盘出来的、不完整**；2026-09-20 自查时实测出漏了 3 块（1532–1940 那 409 行整段没认领）。**Hui 半边需按 §3.3 修订版重新确认。** |
| 3 | 新文件放哪里 | **新建子目录分家**：`composables/home/`、`composables/hui/`、`components/home/`、`components/hui/`。现有 7 个 composables 与 36 个平铺 components **不搬**（不顺手改无关结构） |
| 4 | 那批不生效的 CSS | **只记账，不动**（§1.5） |

---

## §3 切分方案

### 3.1 Home：切出去的 12 块

| 块 | 落点 | 覆盖行段 | 注入 | 自洽性说明 |
|---|---|---|---|---|
| **B2** | `utils/homeMetrics.ts` | **实测**：578–604 + 757–764 + 974–1016<br>（方案原写 578–604 + 761–764 + 1001–1016 —— 差在「紧贴函数上方的文档注释」，见 §8.2 #7） | `financeSummary` | 纯函数集（`fmt`/`unpaidOf`/`paidOf`/`paymentStatus`/`progressMatch`/`isUnaudited`/`dateCellClass`）。**最安全的一刀**。<br>✅ **2026-09-20 实做完毕**：7 个导出逐字搬迁（守卫 `home-extract-movecheck.mjs` 的第一条），`npm run verify` 35/35。**搬走 78 行**（含 3 行空行 `587`/`594`/`1010`，非空 **75** 行）；`Home.vue` 实际删 **81** 行（78 + 三段**尾部**的 3 行空行 `605`/`765`/`1017`），另 16 行原地改（15 个调用点 + 1 句注释）、+1 行 import |
| **B10** | `composables/home/useHomeSelection.ts` | **实测**：1550–1886 + 1155–1189<br>（方案原写 1550–1886 + 1167–1189 —— 差在「紧贴 `combineSelected` 上方的文档注释」，与 B2 的 §8.2 #7 同类） | **实测 6 项**：`filtered` · `rawOrders` · `financeSummary` · `load` · `message` · `dialog`。<br>⚠️ 方案写 8、简报写 7，**两个数都不对**：`loadedIds` **不在内**（本块根本没读它，简报误列）；`api` / `fmt` / `unpaidOf` 走**直接 `import`** 不走注入（同 `useOrderPrint.ts` 口径）。见 §8.2 #8 | 删除选中 + 清账 + 合并订单。**唯一没有第三方写入者的一块**（`checkedRowKeys` 是它「拥有并借出」的状态）⇒ **第一刀**。<br>✅ **2026-09-20 实做完毕**：6 个声明逐字搬迁（守卫 `home-extract-movecheck.mjs` 第二条），`npm run verify` 35/35，`vue-tsc` 与 `npm run build` 均零错。**搬走 372 行**（含 10 行空行，非空 **362**）；`Home.vue` 实际删 **373** 行（372 + 1 行变成无用的 `type DataTableRowData` import）、**+17** 行（1 import + 16 调用点块）、**原地改动 0 行**，净 −356（3570 → 3214）。<br>⚠️ 本块有一个**守卫验不到**的声明（`onCheckedKeys`，签名跨行）—— 见 §8.2 #9 |
| **B3** | `composables/home/useHomeFilterView.ts` | 606–613 + 689–714 + 716–883 + 885–956 | 7 项 | **必须四段合一**：`watch`(945) 监听 4 个筛选 ref、`watch`(954) 读 `querySearchPreset`。分开就互相注入。全文件最大的 hub：7 项注入换 25+ 项输出 |
| **B4** | `composables/home/useHomeOrderNo.ts` | 617–664 + 2259–2338 | 8 项 | 注入偏多但都是薄胶水。**不得吞 `filtered`**（那是 B3 的） |
| **B5** | `composables/home/useHomeQueryMore.ts` | 1205–1382 | 6 项 | 动作块；写 `rawOrders`/`financeSummary` 的权利靠 ref 注入 |
| **B6** | `composables/home/useHomeExpand.ts` | 1888–2014 + 2134–2257 | 3 项 + 1 回调 | ⚠️ **前置**：先把 2238–2242 对 `printOrders`/`onOpenMode` 的直写改成注入的 `openPrintPreview(orders, autoLineNumbers)`，否则它会反向依赖 B9 |
| **B7** | `composables/home/useHomeRowStatus.ts` | 2016–2064 | `filtered`/`expandedRowKeys`/`loadedIds` | 3 进 4 出。**顺序依赖**（必须在 B6 之后构造） |
| **B8** | `composables/home/useHomeRowEditing.ts` | 1018–1058 + 1060–1108 + 1116–1119 + 1191–1203 | 3 项 | ⚠️ 现在这一段混了 5 件事，先归位：`confirmAudit`→B11、`combineSelected`→B10、`pad`/`localToday`→`utils/` |
| **B9** | `composables/home/useHomePrint.ts` | 1411–1538 | 5 项 | 与 B6 的接口就是那个回调 |
| **B11** | `composables/home/useHomeManualProgress.ts` | 1136–1153 + 2340–2676 | 4 项 + 1 回调 | 真边界是约 330 行。`headWithStatus`(2489) 与 `confirmAudit`(1136) **必须一起进**；`progressFilter` 的写(2447) 改成注入回调 |
| **B12** | `composables/home/useHomeCellRender.ts` | 2678–2783 + 2807–2830 + 2866–2963 | 2–3 项 | 三个独立小件可放一个文件三个导出。`headerFilter` 本来就是「参数即依赖」的纯工厂（0 注入）。⚠️ 紧邻的 `paymentPopShow`(2965)/`progressPopShow`(2966) 两个 popover ref **既被本块/ B11 用、又被 `columns` 的 render 回调用 ⇒ 留在页面**，别顺手带走 |
| **B1** | `composables/home/useHomeData.ts` | 538–576 + 1540–1548 | 4 项 | 干净的根块（`loading`/`rawOrders`/`financeSummary`/`load` + 看板） |

**预期终局**：`Home.vue` script 2891 → 约 **950–1100 行**（`columns` 占着 335 行不让动）。

### 3.2 Home：不切的 4 件

| 件 | 行 | 为什么 |
|---|---|---|
| **`columns`** | 2968–3305（335 行） | 直接引用 **30 个标识符、横跨 9 个分区**（`renderExpandDetail`、`editingId`/`draft`、`openFinance`、`openReceipt`、`orderNoQuery` 家族 6 个、9 个 options computed、`headerFilter`、`PAYMENT_/PROGRESS_` 常量、`renderEditable`、`fmt`/`unpaidOf`、`dateCellClass`…）。抽成 composable 必然变成 `useHomeColumns({...30 项})` |
| `renderExpandDetail` | 2134–2181 | 它是 `columns` 的 `{type:'expand', renderExpand}`(2970) 的产物，**离了 `columns` 就没有调用者**。只能「跟 columns 一起走」或「留在原地」 |
| `homeDialogs` / `homeCalcEngine` / `homeDetailHooks` | 1938 / 1977 / 1942 | **三件必须当一件**：`homeDetailHooks.calcSingleRow`(1950) 是一个**默认实现**（`homeCalcEngine.calcRowParts`），靠 **2169** 的 `hooks: {...homeDetailHooks, calcSingleRow: (l) => void calcSingleRowInExpand(id, l)}` **逐单覆盖**去绑本单 id（注释 2168 明说是「每张单一份」）；拆开就失效 |
| `<style>` 3626–3647 | | 「悬停还原」靠**写在后面决胜**（`.loaded-row.expanded-row` 与 `.loaded-row:hover` 同为 (0,5,0)，3632 的注释明说）。跨组件的样式注入顺序由模块求值顺序决定 ⇒ 这条 tie-break 不再可控 |

> 想再压 `columns` 的行数，只能先把它的 4 个纯渲染件（`headerFilter` 0 依赖、
> `renderEditable` 3 依赖、tooltip 2 依赖、`renderProgress` 2 依赖）搬走 —— 那已在 B12/B11 里，
> 搬完后 `columns` 从 ~335 行降到 ~250 行，**依赖不变**。

### 3.3 Hui：切出去的 13 块

> ⚠️ **本表是 2026-09-20 自查后的修订版。** 初版（用户拍板时所依据的那份）只列了 10 块，
> 因为它是按「声明清单」盘出来的、**没有逐段读中段**，结果整段漏了 **1532–1940**（409 行）。
> 下面 C11–C13 是实测补出来的。**详见 §8.2-3。**

**低风险（C1–C7 + C13）**

| 块 | 落点 | 覆盖行段 | 风险 |
|---|---|---|---|
| C1 | `composables/hui/useHuiMarkupMgmt.ts` | 1108–1224 | 低（`markupCatalog` 家族本来就是模块单例） |
| C2 | `composables/hui/useHuiColumnConfig.ts` | 1005–1107 + 1258–1310 | 低。⚠️ **必须返回同一 reactive 引用**（§6.1-1） |
| C3 | `composables/hui/useHuiPayQrcode.ts` | 810–848（`payQrcodeOpen` 在 825） | 低。⚠️ `payQrcodeOpen` 被 `onMoreSelect` 的 `case 'payQrcode'` 写 ⇒ 必须回传该 ref |
| C4 | `composables/hui/useHuiShellToggles.ts` | 883–896 + 918–959 | 低 |
| C5 | `composables/hui/useHuiClients.ts` | 1370–1410 + 2091–2093 | 低，但 ⚠️ `lastAppliedClient` 是**裸 `let`**（§6.2） |
| C6 | `composables/hui/useHuiPreview.ts` | 1988–2037 | 低。⚠️ `openTemplatePreview`(2019) 是 `onMoreSelect` 的分支目标，且被 `calcSingleRow`(1658) 调 |
| C7 | `composables/hui/useTerminalLink.ts` | 2084–2129 | 低。⚠️ `tenantName`/`currentUserName` 的 ref 必须回传（onMounted 2198–2200 要写） |
| C13 | `composables/hui/useHuiSortMethod.ts` | 1919–1932 | 低。⚠️ `sortMethod` 同时被打印载荷构造读（1917 注释那条规则）⇒ 必须回传该 ref，不能只回传对话框开关 |

**中风险**

| 块 | 落点 | 覆盖行段 | 风险 |
|---|---|---|---|
| C11 | `utils/huiLineChecks.ts` | 1537–1584（`missingFieldsOf` / `rowHasContent`） | 低（两函数都以 `l: Line` 为参 ⇒ 纯函数，按 §3.5 进 `utils/` 而非 `composables/`）。**实为最低风险，但出于「先立骨架」的顺序放这儿** |
| C12 | `composables/hui/useHuiLineSelection.ts` | 1587–1620（`checkboxTick` / `selectedLines` / `batchDeleteRows`） | **中**。⚠️ `checkboxTick` 是**组件通过页面级回调写**的（见 1626 注释：「勾选计数是两表共用一个」）—— 抽出后那个回调必须接到抽出的状态上，属 §6.1 那类「引用同一性」失效点 |

**高风险（脊梁耦合）**

| 块 | 落点 | 覆盖行段 | 风险 |
|---|---|---|---|
| C8 | `composables/hui/useHuiAutoMarkup.ts` | 961–972 + 1226–1256 | **高**（需注入 `disableAutoMarkup`；1233 的 `ref(disableAutoMarkup.value)` 是**即时读值**） |
| C9 | `composables/hui/useHuiOrderIo.ts` | 1419–1531 + 2131–2146 | **高**（注入 11 项）。⚠️ 必须导出 `markSaved`（外部 5 个调用点）；`savedSnap` 是**裸 `let`**；`onBeforeRouteLeave`(1436) 绝不能挪进 async/回调 |
| C10 | `composables/hui/useHuiPrint.ts` | 1941–1980 + 2039–2079 + 2152–2175 | **高**（注入 12 项）。⚠️ 入参必须是 ref/对象引用，传值 ⇒ 打印内容冻结在注入那一刻 |

### 3.4 Hui：不切的 6 件

| 件 | 为什么 |
|---|---|
| `onMoreSelect`(1324–1338) + `moreMenuOptions`(904) | **扇出之王**。实测它 11 个分支的目标分布（2026-09-20 逐个定位）：3 个是**导入的**（`openCustomNames`/`openOpenDirSettings`/`reverseOpenDirNames`，674/676/679 —— 早已在 `useOpenDirection.ts` 里），其余 8 个横跨 **C2**(`openVisDialog` 1072)、**C3**(`payQrcodeOpen` 825)、**C6**(`openTemplatePreview` 2019)、**C10**(`printLabels` 1941 / `printGlass` 2039 / `printGlassHole` 2052 / `printProductionCustom` 2069)、**C7**(`copyTerminalLink` 2118)，**外加一块没被任何块认领的 `openOrderList`(1814)**。搬它 = 注入 5 块的回调 + 把打印和终端链接耦合进列显隐。**留在页面当 shell dispatcher 是唯一不亏的选择** |
| **「订单列表」弹窗 1788–1897**（`listOpen`/`orders`/`loadingOrders`/`orderColumns`/`openOrderList`/`refreshOrders`/`loadOrder`/`removeOrder`，约 110 行） | **不切的理由是 `loadOrder`(1830–1879)**：它往脊梁里深写 —— 14 个 `order.*` 头字段 + **整条 `lines.value` 重建**（1851–1871，逐字段白名单，注释 1845/1868 明说漏一个字段就被整头覆盖抹空）+ `hydrateRowImages`(1872) + `markSaved()`(1874) + 关弹窗。与 `saveOrder` 同一类 |
| `onMounted`(2177–2214) | 顺序敏感地写 **11 个段**的状态。切法只能是「每块暴露自己的 `init()`，页面在 onMounted 里**按原顺序**调」 |
| `saveOrder`(1711–1785) | 要把整根脊梁全注入（`lines`/`order`/`orderId`/`saving`…），还要返回 `OrderDto \| null` 给 `fillLineNumbers`(725) 用 |
| `fillLineNumbers`(719–741) | 同时调 `saveOrder` 与 `loadOrder`，**先切任何一个都会产生双向注入** |
| 脊梁 850–882 | `lines`/`formulas`/`order`/`orderId`/`disableAutoMarkup` + `engine = useOrderLines(...)`。见 §6.1 |

### 3.5 落点约定

```
app/src/composables/home/    ← Home 切出来的 composable（新目录）
app/src/composables/hui/     ← Hui 切出来的 composable（新目录）
app/src/components/home/     ← 若某块连模板一起搬（新目录）
app/src/components/hui/      ← 同上
```

- 现有 `app/src/composables/` 下的 7 个文件、`app/src/components/` 下的 36 个平铺 `.vue`
  **本次不搬、不改名** —— 那属另一笔（重设计时再收拾）。
- 纯函数（无响应式依赖）进 `utils/`，不进 `composables/`：B2 → `utils/homeMetrics.ts`。

---

## §4 分步（每步独立可验收）

| 步 | 内容 | 验收 |
|---|---|---|
| **0** | 把 `hui-extract-movecheck.mjs` 接进统一入口（**不改它的 `REF`**，见 §8.2-4）；给 CI 的 checkout 加 `fetch-depth: 0`（见 §8.2-6） | `npm run verify` 里能看到它、台子数 33 → 34，且它报绿（**已手工跑过：47+46 逐字一致，退出 0**） |
| **1** | 立本次的搬迁保真守卫骨架（Home 版，照 `hui-extract-movecheck.mjs` 写） | **变异测试**：故意把 `Math.round` 改 `Math.floor`、删一个 `?? 0`，守卫须精确报红到具体行；还原后回绿 |
| **2** | `utils/homeMetrics.ts`（B2，纯函数，0 风险） | 35 台子 + build + 逐字一致 |
| **3** | `composables/home/useHomeSelection.ts`（B10，第一刀真拆分） | 同上 + `rowstate-logiccheck` / `editable-cell-logiccheck` |
| **4…N** | 其余各块，**一块一笔** | 每笔：35 台子 + build + 逐字一致 + 该块对应的行为台子 |
| **最后** | Hui 的 10 块（低风险 7 块在前，高风险 C2/C7/C10 在后） | 同上 |

### 每笔的两条附加纪律

1. **先归位、再切块**：`pad`/`localToday`/`headWithStatus`/`AUTOCOMPLETE_ALWAYS_SHOW`/`progressSegments`
   这些「放错位置」的件，进 `utils/` 的那一步**单独一笔**，不要混进某个块的搬迁里
   —— 否则那一笔的 diff 里既有「搬家」又有「切缝」，出问题分不清。
2. **量小的先做**：每块搬完立刻跑全套。35 台子跑一轮约 20 秒（`npm run verify` 含
   postgres + 后端约 1 分钟），这个成本必须付。

---

## §5 守卫设计

### 5.1 三层，缺一层有洞

| 层 | 抓什么 | **抓不到什么** |
|---|---|---|
| **源码层**：`-movecheck` 逐字比 | 「少个 `?? 0`」「`Math.max` 写成 `Math.min`」「注释被吃掉」 | 接线接错（`formulas` 传成了别的 ref） |
| **行为层**：现有 35 台子 + 新增断言 | 接线、语义、落库效果 | 根本没想到去测的角落 |
| **CSS 产物层**：构建前后剥掉 `data-v-*` 比规则多重集 | 规则静默不命中 | ——（**只在动了模板/CSS 时才需要**；本方案基本不动，见 §6.6） |

`npm run build` 与 `vue-tsc` **两层都抓不到**：`vue-tsc` 对缺失的 `.vue` 导入是盲区
（`declare module '*.vue'` 通配），build 绿也证明不了语义没变。

### 5.2 源码层守卫的做法（照先例）

`docs/home-audit/hui-extract-movecheck.mjs` 已跑通过一次（引擎 → `useOrderLines.ts`，
组件 → `DetailLinesTable.vue`）。做法：

- 拿 `git show <ref>:<旧文件>` 的**搬迁前原文**，与新文件里的同名件**逐字比**。
- 比的是**函数体归一化后的文本**：去行首缩进、折叠行尾空白、**`//` 注释保留**（注释也是文档）。
- **声明的改写**（`REWRITES` / `COMPONENT_REWRITES`）逐条列出，且**每条自带自检**
  —— 在旧文里找不到 `from` 就抛错，防止写出永不生效的规则把真实差异放过。
- 切声明的难点：参数表**后面还有返回类型**，而返回类型里自己带花括号
  （`function f(l: Line): { label: string }[] {`）。按「参数表后第一个 `{`」会切到返回类型上
  —— 该脚本前两版都栽在这。
- **反向检查**：搬走的定义**不该在旧文件里留下第二份**（否则两份实现各自漂移）。

⚠️ **参照必须钉在本次重构之前的那个提交**。`REF` 不能用 `HEAD`
—— 重构提交一落，`HEAD` 就是「搬完」的状态，两边的函数都已被删，全部会报「找不到」。
**本次新建的 Home 守卫用 `28e36d21`**（2026-09-20，工作区干净，已验证 `git show` 能取到两个文件的原文）。
⚠️ 但**现有的 Hui 守卫保持它自己的 `d6057283` 不动** —— 它钉的是更早的那次抽取，改了就全红（§8.2-4 有实测）。

### 5.3 守卫自身必须做变异测试

先例对两台守卫都做过：反转 `cellError` 的判定、反转 `recomputeDirty` 的比较、
把 `computeAmount` 的 `Math.round` 改 `Math.floor`、删掉 `singleArea` 的钻石型分支
—— 每次都**精确报红到具体行**。

⚠️ 先例还记着一条**守卫自身的洞**：扇数正则是 `(\d+)\s*扇`，夹具全是单位数，
把它改窄成 `(\d)` 时**测试不报错**。已补一条两位数断言才发现。
⇒ **守卫造好后，必须故意改坏被测代码，确认它真的红。**

### 5.4 CSS 产物层（本方案基本用不上，但先例的教训要留着）

先例 3a 步用的那台「CSS 产物差分台」（构建两次、剥掉 `data-v-*`、比规则**多重集**，
526 → 526 逐条一致、0 消失 0 新增）**是临时写的、没入库**。
本方案因为基本不动模板/CSS（§6.6），**暂不重建**；
若中途不得不动 CSS，**先补这台机器再动**。

---

## §6 必须原样跟走的雷（漏一条就是静默回退）

### 6.1 三处「引用同一性」（搬错不报错、类型也对）

| # | 件 | 机制 | 失效表现 |
|---|---|---|---|
| 1 | `pingColVis` / `diaoColVis`（Hui 1062/1063） | `reactive({})` + 原地 `delete` / `Object.assign`；`DetailLinesTable.vue:72` 声明为 `colVis: Record<string, boolean>` 普通 prop，读 `props.colVis` | **返回副本 ⇒ 保存列显隐后表格列不变**，无任何报错 |
| 2 | `engine`（Hui 874） | `DetailLinesTable.vue`：prop 声明 `85–86`，实现是 `props.engine ?? useOrderLines(...)`（**短路**）在 `149–150`，注释 146 明说「传了 `engine` 就不自建」 | 再 `createPartsEngine` 一份 ⇒ `isDiamond`/候选/算料**分叉** |
| 3 | `detailHooks`（Hui 1642） | 普通对象、**一次性捕获** 9 个闭包；类型定义在 `DetailLinesTable.vue:101–111` | 各自构造 ⇒ `useDetailLineDialogs` 实例化多次，四个弹窗**各持一份状态** |

### 6.2 两个「裸 `let`」（对响应式完全隐身）

| 件 | 行 | 约束 |
|---|---|---|
| `lastAppliedClient` | Hui 1375 | 跨块访问**必须导出 getter + setter 一对函数**，不能导出值（导出值 = 一次快照，之后不更新） |
| `savedSnap` | Hui 1429 | 同上；且它在 setup 顶层**即时求值** |

### 6.3 顺序敏感的语义

| # | 件 | 约束 |
|---|---|---|
| 1 | `serializeOrder`(Hui 1419) | `JSON.stringify({h:{...order}, l:lines.value.map(...)})` —— **对 key 顺序敏感**。`newLine()` 产生的行对象与 `loadOrder`(1851–1871) 手写的字面量**字段顺序不同**，而 `JSON.stringify` 保留插入顺序 ⇒ 函数体**必须逐字不动**，否则出现「载入订单后立刻被判脏」的假阳性，触发 1438 的 `window.confirm` |
| 2 | `renderEditable`（声明 Home 2807；**顺序关键区 2822–2828**） | 「先 `startEdit` 再写草稿」的顺序是防「极快输入赶在重渲染之前」（注释 2804–2805）。**抽成子组件并改成 `v-model` 会丢掉这层语义** |
| 3 | `onCheckedKeys`(Home 1601) | 依赖 Naive 回的**第三参 `meta.action`**(1606) 才能区分表头全选。简化成「写 `keys`」⇒ `selectAllMode` 的跨页全选语义没了 |
| 4 | `onPageSizeChange`(Home 936–943) | 里面的 `nextTick` 复位顺序不能动；`pageSizeJustChanged`(920) 是**普通 `let`**，靠「同一次同步流程里传话」 |
| 5 | `clearOrderNoQuery`（声明 Home 2325；**`setTimeout` 区 2327–2337**） | 50ms `setTimeout` 是**照抄旧版的时间轴**（注释 2322–2323），**不要顺手改成 `await`** |
| 6 | `onMounted`(Hui 2177–2214) | 2185→2188→2189 是旧版 `H:8263` 一排连调；`markSaved()`(2190) 必须在初始化之后、加监听之前 |
| 7 | `beforeunload` / `storage` 监听的不对称 | `onBeforeUnmount`(2148–2150) 只摘 `beforeunload`；`storage`(2192) **从不摘**。**不得顺手「修好」** |
| 8 | `manualActions` 的 localStorage 语义(Home 2344–2362) | 注释 2356 强调「只在组件建立时读一次，不跨标签页同步」。抽成 composable 时**加 `watch` 持久化或加 `storage` 事件 = 行为变化** |
| 9 | `localToday`(Home 1116) vs `legacyToday`(Home 2401) | **两套口径**：前者本地时区返回字符串、后者 `toISOString()`（UTC）返回时间戳。合并进 `utils/date.ts` 时**不要合并这两个函数**，也不要让 `submitDate`(Home 1191–1194) 与它们共用实现 |
| 10 | `headWithStatus`(Home 2489) | **全头覆盖**（后端 `update_head` 绑全字段）。被 1139/2526/2557 三处调用。搬它时**不能改成「只传要改的字段」** —— 否则 `order_date`/`install_address` 等会被抹空（性质同 `hui-save-clobber-check` 那条护栏） |

### 6.4 只读的属性/常量，别当死码删

| 件 | 位置 |
|---|---|
| 死 prop | 旧版 `DetailLinesTable` 那串 prop 里 `oderColumn`/`disable-editing`/`addPriceItems` 只声明零读取 —— 已处理过，别回头「补上」 |
| `fillLineNumbers` 按钮只有平开表有 | 平开表挂了（`@fill-line-numbers` 在 Hui 模板 **147**，全文件**只出现这一次**）；移门表（150–164）**没挂**。搬迁时**不要顺手补齐** |
| `AUTOCOMPLETE_ALWAYS_SHOW`(536) | `() => true` 的函数常量，被两处 `:get-show` + `manualNameInputProps` 依赖；注释 520–535 说明了为什么不能省 |
| `homeDetailHooks.calcSingleRow`（Home 1950） | 是**默认实现**，靠 2169 **逐单覆盖**绑 id —— 看到它「没被调用」不要删 |

### 6.5 模板搬迁时的判定规则（本方案基本用不上，留作后手）

- 只抽 **composable**（返回 ref/函数）：**模板不用动**，引用的名字仍在同一作用域。
- 抽成 **子组件**：模板那段**必须跟着搬**。本方案里若真要搬，只有这几处是「逻辑 + 模板一起走」：
  单元格 tooltip（Home 152–163 + 2682–2783，`ref="rowTipEl"` 被命令式写 `style`）、
  手动更新进度弹窗（Home 226–276 + 2340–2564）、查询更多弹窗（Home 291–349 + 1205–1382）、
  改名/改期弹窗（Home 166–209）、`<DetailLineDialogs :d="homeDialogs" />`（Home 411 + 1938）。
- **子组件的根元素会继承父组件的 `data-v`**（`setScopeId` 递归）。三种情形会失效：
  ① 新组件 **Teleport 到 body**（祖先链离开 Home，`[data-v-home]` 全没）；
  ② 新组件是**多根 Fragment**；③ 把 CSS 的宿主组件换掉却没把规则一起搬。

### 6.6 为什么「基本不动模板/CSS」值这么多

先例 3a 步最大的风险就是「规则静默不命中」，代价是 8 段 CSS、约 230 行 `:deep()`
必须**整段跟走**，否则格子变宽、字号回 14px、蓝标签丢、未保存行不粉。
**本方案把模板与 CSS 基本原地不动 ⇒ 这一类风险整体不适用。**
唯一例外：若某块不得不搬模板，就必须先补 §5.4 那台 CSS 差分台。

---

## §7 行号引用的处置（这次拆分的副作用）

拆分会让**两个文件的行号全部漂移**。现状实测：

| 项 | 数量 |
|---|---|
| 带 `Home.vue:<行号>` / `Hui.vue:<行号>` 引用的**文件** | **20** |
| 其中 `.md` 文档 | 18 |
| 其中 `.mjs` 脚本（**会真的红**） | 2 —— `hui-save-clobber-check.mjs`、`hui-engine-logiccheck.mjs` |
| **引用总条数** | **238** |

集中度（前 4）：`home-audit/01-table.md` 75 条、`home-audit/02-actions.md` 56 条、
`home-audit/03-shell.md` 28 条、`2026-09-18-detail-table-extraction.md` 16 条。

**处置策略**：

1. **脚本里的行号引用**：搬动某块时，**同一笔**把踩到它的脚本引用改对
   （§5.2 的**反向检查**已经覆盖了「搬走的定义不许在旧文件里留第二份」，行号引用则要手工核）。
2. **文档里的行号引用**：**不在搬迁笔里逐条改**（238 条 × N 笔，且每退一步就全错）。
   改为 **搬迁全部结束后一笔「行号引用复核」**，并在本文 §7 记下「哪些文档需要复核」。
   ⚠️ 这一条**必须在实施计划里显式排期**，否则会变成「等用户问起才想起来」——
   那正是本仓库 `CLAUDE.md` 里记的三次事故的共同点。
3. 每笔提交信息里写明「本笔改动了哪些行段 ⇒ 哪些文档的行号引用暂时失效」，便于最后那一笔核算。
4. ⚠️ **引用口径要放宽（2026-09-20 补，B2 一笔实测出来的）**：上面那张表统计的 238 条**只认 `Home.vue:<行号>` 这一种字面形式**，而同样会失效、却**一条都没被统计进去**的还有一整类 ——
   **「符号名 + 文件名」**：`docs/home-audit/rowstate-logiccheck.mjs:72` 写着「与 `app/src/views/Home.vue` 的 `dupKey()` / … / `unpaidOf()` 同逻辑」、`:101` 写着「新版 `Home.vue` 的 `unpaidOf` 回退分支」，以及本文 §1.3 那种 **`| unpaidOf | 583 |` 裸行号**。
   B2 一笔就踩出 **3 处**（两行 `.mjs` + §1.3 的两行），**已在本笔按第 1 条策略改掉**。
   ⇒ **Task 29 复核引用时必须用放宽后的口径**（`Home.vue` 与任一「本方案搬走的符号名」同现；以及**任何指向 `Home.vue` 的裸行号**），否则那个「238 条」会漏掉整整一类。
   ⚠️ 这类的危险**比带行号的那种更大**：带行号的会**指错位置**（读者一对就发现），不带行号的**不会报任何错**，只是静默指到已经不存在的符号 —— 正是本仓库最忌讳的「文档与代码不一致」。

---

## §8 不做的、与不确定

### 8.1 有意不做

| 项 | 为什么 |
|---|---|
| 修那 15 条不生效的 CSS（§1.5） | 行为变化；重设计时本来要重写（用户 2026-09-20 拍板） |
| 修 `beforeunload`/`storage` 监听的不对称（§6.3-7） | 行为变化 |
| 把 `columns` 拆掉 | 30 依赖 / 9 分区 ⇒ 伪解。要拆得先造「表格上下文」对象，那是重构不是搬迁 |
| 搬/改现有 7 个 composables 与 36 个平铺 components | 不顺手改无关结构。重设计时再收拾 |
| 动 `Progress.vue`（118 KB，**比 Hui 还大**）/ `Formulas.vue`（68 KB） | 本次范围是 Home + Hui。⚠️ **记一笔**：`Progress.vue` 的体量问题与这两个同级，用户若要一并处置，得另立方案 |
| 删 §1.5 里那两条纯死码 `.detail-block`/`.detail-title` | 与「零行为变化」同笔会混 diff；记账即可 |

### 8.2 不确定 / 未核实（**实施前要复核**）

| # | 项 |
|---|---|
| 1 | 本文所有行段界都是 `28e36d21` 的快照；**每块动手前必须按当时工作区重新核一遍** |
| 2 | Home §3.1 的 12 块是按「依赖内聚度」划的，**尚未逐块实做验证**。第一刀（B10）做完后要用实测结果回头修这份方案 —— 先例就有过「§3.3 立项不完整、实际范围比写的大」 |
| 3 | ⚠️ **Hui 的块划分初版是错的，已更正 —— 用户拍板时依据的是那份错的。** 初版按「顶层声明清单」盘点，漏了 **1532–1940（409 行）**整段。2026-09-20 自查实测补出 **C11**（`utils/huiLineChecks.ts`，`missingFieldsOf` 1537 + `rowHasContent` 1569，纯函数）、**C12**（`useHuiLineSelection.ts`，勾选/批量删除 1587–1620）、**C13**（`useHuiSortMethod.ts`，1919–1932），并把「订单列表」弹窗 1788–1897 判为**不切**（理由见 §3.4）。**⇒ Hui 半边须按 §3.3 修订版重新确认，不能在旧清单上开工。** 另：Home 的 12 块虽经两次通读，但**同样未逐块实做验证**（见 #2） |
| 3b | 顺带实测到一处**文档漂移**（非本次范围）：`Hui.vue:1899–1918` 是 **20 行纯注释/空行、零代码**，其中 1899–1900（`shouldUseNewSizeFormat`）与 1911（行安装地址）描述的**函数已不在本文件**（早先抽打印层时留下的孤儿注释）。删它不动行为，但要用户拍板是否在本轮清掉 —— 记在此处以免丢失 |
| 4 | ⚠️ **更正：现有 `hui-extract-movecheck.mjs` 的 `REF=d6057283` 必须原样保留，不能改成 `28e36d21`。** 实测（2026-09-20）：默认 REF **退出 0**（47 + 46 逐字一致）；换成 `28e36d21` **退出 1**，12 处报「在 28e36d21:Hui.vue 里找不到」—— 因为那个脚本钉的是**抽 `useOrderLines` 之前**，而 28e36d21 上那些函数早已搬走。**本次新建的 Home 守卫才用 `REF=28e36d21`**（它钉的是「拆分之前」）。两个守卫的参照各钉各的，别合并 |
| 6 | ⚠️ **接进统一入口会踩 CI 的浅克隆。** `ci.yml` 用 `actions/checkout@v4` 且**没设 `fetch-depth`** ⇒ 默认只取 1 个提交 ⇒ movecheck 的 `git show <旧提交>` 在 CI 上必然失败（`execSync` 抛错 ⇒ 退出非 0 ⇒ 记 ❌ 真失败，**是 fail-loud 的，不会静默放过**）。处置：给 checkout 加 `fetch-depth: 0`。代价实测：本仓库 `size-pack` 651 MiB / 283 提交，比 Rust 构建小一个量级，可接受 |
| 5 | §1.5 那批死 CSS 的「不生效」依据是**本仓库两次实测记录 + 机制分析**，我**没有**跑浏览器复现（本仓库无浏览器驱动）。若哪天有了浏览器验收手段，这一条应重新实测 |
| 7 | **B2 实测 vs 方案**（2026-09-20，实做后补记）。① **行段比方案大**：§3.1 原写 `578–604 + 761–764 + 1001–1016`，实测搬的是 `578–604 + 757–764 + 974–1016` —— 多出的 `757–760`、`974–1000` 是**紧贴在 `paidOf` / `dateCellClass` 上方的文档注释**。不跟着搬就会在 `Home.vue` 留下**指向已删函数的悬空注释**（`974–1000` 那条 JSDoc 里写着「见下面 `dateCellClass`」），即本仓库明令禁止的「文档与代码不一致」⇒ 已**随函数一起搬进 `utils/homeMetrics.ts`**（信息零丢失），并同步改掉 `Home.vue` 里「⇒ 下面 `dateCellClass()`」的「下面」二字。**其余 11 块很可能同样比方案写的大**，见 #2。<br>② **方案漏了一种调用点形态**：简报只列了 `unpaidOf(r)` 这类**调用**，而 `Home.vue` 还有两处**裸引用** —— `distinctOptions(paidOf)` / `distinctOptions(unpaidOf)`（把函数本身当 `pick` 回调传走）。加了 `fin` 形参后必须改成 `distinctOptions((r) => paidOf(r, financeSummary.value))`，否则 `fin` 是 `undefined`、`fin[r.id]` 直接抛。**⇒ 后续各块搬迁时，「grep 调用点」要连「把函数当值传走」一起 grep**（`grep -nE '\bname\b'` 而不是 `grep 'name('`） |
| 8 | **B10 实测 vs 方案**（2026-09-20，实做后补记 —— 这是「第一刀真切」，**注入面这一栏的方案值可以认为整体不可信，后续各块一律实读**）。① **注入面实测 6 项**，方案写 8、简报写 7，**两个数都不对**。逐个核过：`filtered`（`computed`，表头全选要用）· `rawOrders`（`ref<OrderSummaryDto[]>`）· `financeSummary`（`ref<Record<string, OrderFinance>>`）· `load`（`() => Promise<void>`）· `message` · `dialog` —— 共 6 个。**`loadedIds` 是简报误列**：全文 grep 过，本块六个声明里**一次都没出现它**（它住 `Home.vue:1910`，被「已加载行」的行 class 逻辑用，与本块无关）⇒ **不进 `deps`**。另有三类**不进注入、直接 `import`**：`api`（模块单例，同 `useOrderPrint.ts` 的既有口径）、`fmt` / `unpaidOf`（B2 已搬进 `utils/homeMetrics.ts` 的纯函数，注入它们纯属绕路）、naive-ui 的类型。<br>② **行段比方案大 12 行**：方案写的 `1550–1886 + 1167–1189` 漏了**紧贴 `combineSelected` 上方的 JSDoc（`1155–1166`）** —— 不跟着搬就会在 `Home.vue` 留下指向已删函数的悬空注释（= 本仓库明令禁止的「文档与代码不一致」，与 #7① 同因）。**⇒ 与 #7① 合并成一条通则：方案给的行段只算了「声明本体」，`Home.vue` 里每个函数头上那几段 JSDoc 都得跟着走，动手前先往上看到 `*/` 或空行为止。**<br>③ **`rewrites` 里混着一条「不是注入」的差异**：`clearAccounts` 的第一条 `unpaidOf(r) → unpaidOf(r, deps.financeSummary.value)` 是 **B2 那一刀留下的调用点变化**，不是本笔的注入改写。⇒ **`rewrites` 记的是「相对参照提交的全部文本差异」，不只是「注入面」**；只顾着列注入项会漏掉上游各刀攒下的差异，而漏列**不报错**（只表现成 diff）。<br>④ **改写规则必须带边界**（实测确认过一次险情）：`applyRewrites` 是朴素 `split/join`，写裸名会把别的标识符一起改坏。本块 6 个注入名逐一验证过「本块内不存在把它当子串的别的标识符」，21 处替换点全部人工核过上下文，改完再全文查 `.deps` 出现 **0** 次（防止把 `(e as Error).message` 这种「属性名恰好叫 message」的改坏）。<br>⑤ **一处编译期约束**：`selectAllMode` 是「拥有并借出」的状态，但**模板从不读它**（旧版那个 `Wl` 是纯开关记忆、不参与渲染），`Home.vue` 里解构它就是一个未使用变量 ⇒ `vue-tsc --noEmit` 的 **TS6133 直接报错**。处置：composable 的返回值里**保留**它（接口完整），但 `Home.vue` **只解构它实际用的 5 个**。⇒ 后续各块别照抄简报的「把返回的 6 个全解构」 |
| 9 | ⚠️⚠️ **守卫自身的洞（2026-09-20 实测，B10 那一刀撞出来的）：`sliceFn` 对「签名跨行」的函数只切到第一行，整个函数体一行都不比。** 触发条件是参数表换行（如 `Home.vue` 的 `onCheckedKeys`）。根因：`sliceFn` 找函数体 `{` 的那个循环末尾有一句 `if (c === '\\n') break` —— 参数表一旦换行，函数体 `{` 就在那个换行之后，永远找不到 ⇒ 退化成「按行切」，只返回 `function onCheckedKeys(`。**后果比「少验一点」严重**：往里写任何 `rewrites` 都会抛「声明的改写失效」（B10 实测踩到），而**不写规则、任它绿**才是最危险的 —— 那个「✓ 逐字一致」是假的，只比了签名那一行。**波及范围已实测**：整个 `Home.vue` 只有 **3 个**这种函数 —— `onCheckedKeys`（REF:1601，属 B10）、`renderEditable`（REF:2807）、`headerFilter`（REF:2866，后两个属 **B12**）。⇒ **搬 B12 时那两处同样验不到，别被绿勾骗了**；B10 的 `onCheckedKeys` 已用**另一套切片器手工复核**过（见 `task-3-report.md`，14 行逐字一致）。**根因修复要动 `sliceFn`，而它与 `hui-extract-movecheck.mjs` 必须逐字同步（见其文件头）**，所以没在本笔单方面改 —— 已把这条写进 `home-extract-movecheck.mjs` 的 `BLOCKS`（`onCheckedKeys: []` 处）与文件头「能力边界」。**待用户拍板是否同步改两份 `sliceFn` + 给 `--selftest` 补一例（现有 8 条自测全不覆盖签名跨行）。** |

---

## §9 与 `ui-upgrade` 的接缝

这次拆分是重设计的**前置**，不是重设计本身。两件事的接口：

- `docs/ui-upgrade/01-hardcoded-styles.md` 给 Home.vue 点名的 6 处写死颜色里，
  **4 处（`:2656` `:2914` `:3188` `:3221`）全在 `columns` 那个块里**
  —— 也就是 §3.2 判定「不切」的那 335 行。所以重设计的第一步（抽语义 token）
  **整片落在 `columns` 里**，而这块**必须留在 `Home.vue`**。
  ⇒ 重设计时要么就地改，要么那时再做「表格上下文」对象的重构。**这是本次拆分没解决的问题**，
  写在这里以免将来以为「拆完了就该很好改」。
- Hui 点名的 6 处（`:424`–`:481`）全在**模板的表头区**，与本次切分（全在 script）**不相交**。
