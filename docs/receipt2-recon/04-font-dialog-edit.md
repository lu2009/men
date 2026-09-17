# 收据单2 · 字体调节弹窗 + 就地编辑（逆向）

范围：**字体调节弹窗**（`openFontDialog`）+ **列宽拖拽**（`pe`）+ **就地编辑**（`Ce/Y/ze/Be/k/P/I/U/T/S` 与父级 contentEditable 模式）。

主要来源：
- `legacy/js/Receipt2.deobfuscated.js`（组件全文 2637 行，行号直接引用）
- 父级 `Home` 组件（`legacy/js/Home.formatted.js` 的 `Home` SFC，offset 406795 起）。
  我把它按 `decode-receipt2.mjs` 的同款别名链逻辑解成 `/tmp/Home.Home.decoded.js`（下文引用其行号，并同时给出**原始符号名**，因为该文件是我临时生成的）。

---

## 0. 先纠正一处：分析文档里的数据模型是错的

`docs/2026-09-16-print-font.md` 第 3 节写的是：

```js
{ paper:{widthMm,heightMm,orientation,paddingMm},
  globalFont:{fontFamily,fontSize,fontWeight,lineHeight},
  fields:[{key,label,x,y,width,fontSize,fontFamily,fontColor,fontWeight,wrap,lineHeight}],
  tableConfig:{tableFontSize,rowHeight,columns:[{key,label,visible,width}]} }
```

**这份是猜的，全部对不上。** 逐条核实（CONFIRMED，全文 `grep` 过）：

| 文档说法 | 实际 |
|---|---|
| `globalFont` / 「统一字体」 | **不存在**。整个组件没有 `globalFont`，也没有任何「一键改全部字段」的功能 |
| `fontFamily` / `fontColor` / `fontWeight` / `wrap` / `lineHeight`（每字段） | **不存在**。字体族、字重、行高全部硬编码在 CSS 模板里 |
| `paddingMm` | **不存在**。页边距硬编码 `padding: 4mm 4mm 3mm`（`Receipt2.deobfuscated.js:375`） |
| `tableConfig.columns[]`（key/label/visible/width） | **不存在**。列只有一份裸的**百分比数组**（`n`，10 个数字），列名/显隐都在 CSS 与 HTML 里写死 |
| 「字号分五类」 | 实际是**六类**（多了「基础信息字体」`metaFontSize`） |
| 「标签是 70×90」 | 那是**合格标签**组件。收据单2 默认纸是 **200×140 横向** |

真实的模型只有五块，全部是**扁平的对象/数组**，没有嵌套的 fields/columns：

```
fontSettings      { headerFontSize, tableFontSize, amountFontSize,
                    metaFontSize, declarationFontSize, orderDateFontSize }   → localStorage 收据单2字体
printSettings     { copies, widthMm, heightMm, orientation }                   → localStorage 纸张/份数
visibilitySettings{ 9×show*, 3×*Position, metaOrder[4] }                       → localStorage 显隐
brandSettings     { enabled, name }                                            → localStorage 品牌
elementConfigs    { <10 个 data-r2-el key>: { offsetXMm, offsetYMm,
                       fontSize, widthMm, visible } }                          → localStorage 元素微调
columnWidths      [ 10 个百分比数字 ]                                          → localStorage 列宽
selectedPrinter   string                                                       → localStorage 打印机（立即写）
```

---

## 1. 字体调节弹窗

### 1.1 入口与显隐（CONFIRMED）

| 处 | 内容 |
|---|---|
| 父级按钮 | `12 == ic.value` 时渲染「字体调节」按钮，`onClick: vi`（`/tmp/Home.Home.decoded.js:4096-4100`） |
| `vi` | `Xn.value?.openFontDialog ? Xn.value.openFontDialog() : ElMessage.error("收据单2组件未就绪")`（同文件 1002-1006） |
| 组件内 `openFontDialog` | `Receipt2.deobfuscated.js:1102-1112` |
| dialog | `title:"收据单2 设置"`, `width:"460px"`, `destroy-on-close:false`, `onOpen: J`（保证点开时拉打印机列表）`Receipt2.deobfuscated.js:1360-1370` |

**`openFontDialog` 只做一件事：把「草稿 ref」从「已保存 ref」重新同步一遍**（`Receipt2.deobfuscated.js:1102-1112`）：

```js
f.value = {...v.value}                     // 字体草稿 ← 已存字体
p.value = {...h.value}                     // 纸张草稿 ← 已存纸张
c.value = {...i.value}                     // 品牌草稿 ← 已存品牌
z.value = {...C.value, metaOrder:[...C.value.metaOrder]}   // 显隐草稿 ← 已存显隐
y.value = true                             // 开弹窗
```

**双向 ref 对照表**（这是整套 UI 的核心：草稿 / 已存分离，取消即丢）：

| 语义 | 已存（真正渲染用） | 草稿（弹窗绑定） | localStorage 键 | 常量 |
|---|---|---|---|---|
| 字号六项 | `v` (:74) | `f` (:75) | `receipt2_font_settings` | `sa` |
| 纸张+份数 | `h` (:76) | `p` (:77) | `receipt2_print_settings` | `ma` |
| 显隐/位置/排序 | `C` (:78) | `z` (:79) | `receipt2_visibility_settings` | `wa` |
| 品牌 | `i` (:22) | `c` (:23) | `receipt2_brand_settings` | `ga` |
| 元素微调 | `b` (:137) | `P`/`I`（单元素） | `receipt2_element_configs` | `ya` |
| 列宽 | `n` (:12) | 无草稿（直接改） | `receipt2_column_widths` | `da` |
| 打印机 | `H` (:214) | 无草稿（立即写） | `receipt2_selected_printer` | `Va` |
| 弹窗开关 | — | `y` (:73) | — | — |

键名常量定义在 `Home.formatted.js` 的 Receipt2 模块顶部：
`sa="receipt2_font_settings", da="receipt2_column_widths", Va="receipt2_selected_printer", ma="receipt2_print_settings", wa="receipt2_visibility_settings", ga="receipt2_brand_settings", ya="receipt2_element_configs"`。

> **CONFIRMED：这 7 个键只被 Receipt2PrintManager 用。** 我把组件体花括号配平取全文（offset 120452–165202），组件之后到本模块结束（offset 165202–174835）里 `sa/da/Va/ma/wa/ga/ya` 出现次数均为 **0**；且 7 个键字符串在整个 `legacy/` 里各只出现一次（就是那行赋值）。

### 1.2 弹窗控件全清单（CONFIRMED）

`el-form label-width:"110px"`（`Receipt2.deobfuscated.js:1411`）。

**字号区**（无分组标题，直接跟在品牌后面）

| 控件标签 | 绑定 | 范围/步长 | 默认值 | 落盘字段 | 行号 |
|---|---|---|---|---|---|
| 品牌字体 | `f.headerFontSize` | 14–36，step 1 | **30** | `receipt2_font_settings.headerFontSize` | :1465-1489 |
| 编号日期字体 | `f.orderDateFontSize` | 8–18，step 1 | **13** | `.orderDateFontSize` | :1490-1514 |
| 表格字体 | `f.tableFontSize` | 8–18，step 1 | **15** | `.tableFontSize` | :1515-1539 |
| 金额字体 | `f.amountFontSize` | 16–40，step 1 | **20** | `.amountFontSize` | :1540-1564 |
| 基础信息字体 | `f.metaFontSize` | 8–18，step 1 | **18** | `.metaFontSize` | :1565-1589 |
| 说明字体 | `f.declarationFontSize` | 8–18，step 1 | **15** | `.declarationFontSize` | :1590-1615 |

默认值 = `u`（`Receipt2.deobfuscated.js:13-20`）。保存时由 `Z()` 逐项 `K(x, min, max, default)` 钳位（:252-289，`K` 在 :245-251：`round` 后钳到 `[min,max]`，非有限数取默认）。

**品牌区**

| 控件标签 | 绑定 | 说明 | 行号 |
|---|---|---|---|
| 自定义品牌名 | `c.enabled` (`el-switch`) | 关 → 后面的名称输入框整行不渲染 | :1414-1435 |
| 品牌名称 | `c.name` (`el-input`) | 仅 `c.enabled` 时出现；`placeholder:"请输入品牌名"`, `maxlength:40`, `show-word-limit`, `width:200px` | :1436-1464 |

品牌最终落在标题上：`i.enabled && i.name ? i.name : (row.brand || "收据单2")`（`Receipt2.deobfuscated.js:568-572`）。

**纸张设置**（`el-divider` 标题「纸张设置」:1616-1627）

| 控件标签 | 绑定 | 范围/步长 | 默认 | 行号 |
|---|---|---|---|---|
| 宽度 (mm) | `p.widthMm` | 50–500，step 1 | **200** | :1628-1651 |
| 高度 (mm) | `p.heightMm` | 50–500，step 1 | **140** | :1652-1676 |
| 方向 | `p.orientation` (`el-select`) | `portrait`=纵向 / `landscape`=横向，宽 200px | **landscape** | :1677-1711 |
| 常用尺寸 | 8 个 `el-button size=small` | 见下表 | — | :1712-1874 |

默认纸张 `s = {copies:1, widthMm:200, heightMm:140, orientation:"landscape"}`（:24）。

「常用尺寸」预设表 `d`（:25-50），点击走 `V(key)`（:51-57），**只写 `widthMm/heightMm/orientation`，不动 `copies`**：

| 按钮文字 | key | 写入 |
|---|---|---|
| 210×140 | `pin-210-140` | 210×140 landscape |
| 200×140 | `pin-200-140` | 200×140 landscape |
| 210×90 | `pin-210-90` | 210×90 landscape |
| 200×90 | `pin-200-90` | 200×90 landscape |
| A4横向 | `a4-landscape` | 297×210 landscape |
| A4纵向 | `a4-portrait` | 210×297 portrait |
| A5横向 | `a5-landscape` | 210×148 landscape |
| A5纵向 | `a5-portrait` | 148×210 portrait |

保存时 `X()`（:290-306）钳位：`copies` 1–99、`widthMm`/`heightMm` 各 50–500；
`orientation` 只有在**已是合法字面量**时才保留，否则按 `widthMm >= heightMm ? "landscape" : "portrait"` 兜底（`Jo[385]="landscape"`、`Jo[659]="portrait"` 已解码核对）。
> 注意：预设按钮写的是合法字面量，所以兜底分支实际只在脏数据上生效。

**头部元素**（divider :1875-1886）

三行，每行 = 一个 `el-switch`(width 80px) + 一个 `el-radio-group size=small`（左/右；`disabled = !对应的 show*`）：

| 行 | 开关绑定 | 位置绑定 | 位置选项 | 行号 |
|---|---|---|---|---|
| 编号 | `z.showOrderNo` | `z.orderNoPosition` | 左侧 `left` / 右侧 `right` | :1887-1957 |
| 日期 | `z.showDate` | `z.datePosition` | 同上 | :1958-2026 |
| 二维码 | `z.showQrcode` | `z.qrcodePosition` | 同上 | :2027-2097 |

**信息栏（拖动排序）**（divider :2098-2111）— `Receipt2.deobfuscated.js:2112-2198`

遍历 `z.metaOrder`（4 项 `["client","tel","address","productionDays"]`，`F` :309），每行：

- `el-checkbox`，绑定是**动态算出来的**：`z["show" + item[0].toUpperCase() + item.slice(1)]`（:2138-2157）
  → 即 `showClient / showTel / showAddress / showProductionDays`
- 标签文字取自 `$`（:310-315）：`client=客户, tel=电话, address=安装地址, productionDays=生产天数`
- 两个圆形小按钮：上移 `ee(i,-1)`、下移 `ee(i,1)`，首/末项分别 `disabled`（:2164-2191）

`ee(e,t)`（:316-323）：交换 `metaOrder[e]` 与 `metaOrder[e+t]`，越界直接 return。

**底部元素**（divider :2199-2210）

| 控件 | 绑定 | 行号 |
|---|---|---|
| 金额 | `z.showAmounts` | :2211-2230 |
| 说明 | `z.showDeclaration` | :2231-2251 |

**打印机设置**（只在 `W = !!window.electronAPI` 时为真，`Receipt2.deobfuscated.js:212`；divider + 3 个 form-item :2252-2397）

| 控件标签 | 绑定 | 选项/范围 | 备注 | 行号 |
|---|---|---|---|---|
| 选择打印机 | `H`（**注意：不是草稿，是已存 ref**） | `O`（`getPrinters()` 结果），label = `displayName + (isDefault ? "（默认）" : "")`，value = `name` | `placeholder:"使用系统默认打印机"`, `clearable`, `width:100%`, `onChange: j` | :2269-2326 |
| （无标签） | — | 「刷新打印机列表」按钮（`loading:G`，`onClick:q`）+ 文本「已选：X」（X = `H \|\| "系统默认"`） | | :2327-2369 |
| 打印份数 | `p.copies` | 1–99，step 1 | **草稿**，随保存一起写 | :2370-2397 |

> **CONFIRMED：打印机是「改了就写盘」的**——`j()`（:216-221）在 `onChange` 里直接 `localStorage.setItem(Va, H.value)`，不走保存按钮，也不随「取消」回滚。

### 1.3 三个底部按钮（`Receipt2.deobfuscated.js:1372-1407`）

| 按钮 | 处理函数 | 行为（CONFIRMED） | 写盘？ |
|---|---|---|---|
| 重置默认 | `fe` (:810-816) | **只重置草稿**：`f={...u}`、`p={...s}`、`z={...g, metaOrder:[...g.metaOrder]}`、`c={...r}`。**不动已存 ref、不关弹窗、不刷新预览** | ❌ 不写 |
| 取消 | `y.value = false` (:1387) | 只关弹窗。已存 ref 从未被改过，所以「取消」天然等价于回滚 | ❌ 不写 |
| 保存 | `he` (:817-850) | 见下 | ✅ 写 4 个键 |

`he` 逐步（:817-850）：

```js
v.value = Z(f.value);  f.value = {...v.value}         // 字号钳位，草稿回写
h.value = X(p.value);  p.value = {...h.value}         // 纸张钳位
C.value = te(z.value); z.value = {...C.value, metaOrder:[...C.value.metaOrder]}   // 显隐归一化
i.value = { enabled: c.value.enabled, name: c.value.name.trim() }; c.value = {...i.value}
localStorage.setItem(ga, JSON.stringify(i.value))     // 品牌
localStorage.setItem(sa, JSON.stringify(v.value))     // 字号
localStorage.setItem(ma, JSON.stringify(h.value))     // 纸张+份数
localStorage.setItem(wa, JSON.stringify(C.value))     // 显隐
y.value = false
isReceipt2Active() && await ve()                      // 刷新预览
```

`te()`（:324-349）归一化规则：9 个 `show*` 只接受 boolean；3 个 `*Position` 只接受 `["left","right"]`（`R` :308）；`metaOrder` 先按 `F` 过滤掉非法值，再把缺的按 `F` 原序补到尾部——**保证恒为 4 项**。

### 1.4 改一个值 → 渲染上体现为什么

整条链路（CONFIRMED）：

```
字体调节按钮 → vi → Xn.openFontDialog() → 草稿 ref ← 已存 ref，y=true
   ↓ 用户改草稿
保存 he → 钳位 → 已存 ref 更新 + 4 个键写盘 → isReceipt2Active() && ve()
   ↓
ve() → ge() 拼 HTML 字符串：'<div class="receipt2-root"><style>' + ue(v, X(h)) + '</style>' + 各页 + '</div>'
   ↓
ge/ve 调 props.onPreviewHtmlChange(html)
   ↓ 父级 yi(html)：「/tmp/Home.Home.decoded.js:998-1001」
   Wn.value = html; await nextTick(); ao.value.innerHTML 更新
   → Xn.initColumnResize(ao.value) → Xn.initElementEditor(ao.value)   ← 两个初始化都在这
```

`ue(字体, 纸张)`（`Receipt2.deobfuscated.js:371-438`）就是**唯一**的样式出口——一个手拼的 CSS 字符串，各字段的 px 值直接内插进去：

| 落盘字段 | 进 CSS 的位置 | 作用范围 |
|---|---|---|
| `headerFontSize` | `.receipt2-title { font-size: Npx; font-weight:700; letter-spacing:.5px; line-height:1.05 }` | 标题（品牌名/订单 brand） |
| `orderDateFontSize` | `.receipt2-order` 和 `.receipt2-date` 的 `font-size:Npx` | 编号、日期 |
| `metaFontSize` | `.receipt2-meta-row { font-size:Npx; line-height:1.2 }` | 客户/电话/安装地址/生产天数 那一行 |
| `tableFontSize` | `.receipt2-table { font-size:Npx }` | 明细表全部单元格 |
| `amountFontSize` | `.receipt2-amounts { color:#d9001b; font-size:Npx }` | 总额/已付/未付 |
| `declarationFontSize` | `.receipt2-declaration { font-size:Npx }` | 说明 |
| `widthMm`/`heightMm`/`orientation` | `.receipt2-page{width/height}` + `@page{size:...}` + `@media print` 的横排旋转（`transform: translateY(Wmm) rotate(-90deg)` + `.r2-page-wrap` 尺寸互换） | 整页 |
| `copies` | **不进 CSS**。只在 Electron 静默打印时作为 `silentPrint(..., {copies})` 参数（:1312） | 打印份数 |
| `show*` / `*Position` | 在 `de()` 里控制**要不要拼那段 HTML**、拼进 left 还是 right 数组（`Receipt2.deobfuscated.js:501-577`） | 头部/底部 |
| `metaOrder` | `de()` 按顺序 push 出 `V[l]()`，并据此生成 `grid-template-columns: 1fr 1fr ...`（:552-561） | 信息栏列数与顺序 |
| 品牌名 | `de()` 里标题文字（:568-572） | 标题 |

**字体族是写死的**（:372）：`font-family: "Microsoft YaHei", "PingFang SC", sans-serif;`（挂在 `.receipt2-root`）。这是**收据单2 全组件唯一一处 font-family**（`grep -c` = 1）。所以旧版「字体调节」**只能调字号，不能换字体**——这点和 `docs/2026-09-16-print-font.md` 的期待相反，该文档说「字体调节是原版唯一真正能自定义字体的地方」，实际它只自定义**字号/纸张/显隐/元素微调**，字体族不能改。

---

## 2. 列宽拖拽 `pe`（`Receipt2.deobfuscated.js:851-946`）

**列宽数据**：`n = Vue.ref([...a])`，`a = [13.2, 4.2, 6.6, 12.1, 13.6, 4, 4.4, 5.4, 22.8, 13.5]`（:11-12）
→ 对应表头 **型材 / 开向 / 颜色 / 玻璃 / 尺寸 / 数量 / 单价 / 金额 / 计价方式 / 备注**，
单位是**百分比**，默认和 = **99.8%**（不是 100）。列宽**没有** key/label/visible 结构，只有这 10 个裸数字。

**注入方式**：`.receipt2-table th:nth-child(k), td:nth-child(k) { width: X% }` 逐列一条（`ue`，:389-408）。
顺带在同一批规则里写死了列对齐：第 2/3/6/7/8 列 `text-align:center`，其余左对齐。

**手柄生成**（:874-890）：

- 入口先清场：`container.querySelectorAll(".r2-resize-handle").forEach(e=>e.remove())`（**幂等**，可重复调用）
- 先跑一次 `[data-shrink-fit]` 缩字（:854-873，见 §5.4）
- `page = container.querySelector(".receipt2-page")` → **只看第一页**
- 取 `thead th` 数组，`length < 2` 直接返回；**最后一列不给手柄**（`if (u === a.length-1) return`）
- 每个 th 加 `position:relative; overflow:visible`，再 append 一个 `div.r2-resize-handle`：
  `position:absolute; right:-3px; top:0; width:6px; height:100%; cursor:col-resize; z-index:20; background:transparent; user-select:none;`，`title="拖动调整列宽"`
- hover 走进/出把背景在 `rgba(64,158,255,0.35)` / `transparent` 之间切

**拖拽算法**（:899-943）：

1. `mousedown`（手柄上）：`preventDefault()`；记 `startX = e.clientX`；
   `table = container.querySelectorAll(".receipt2-table")[0] || page.closest("table")`；
   `V = table.getBoundingClientRect().width`（**px**）；
   `m = 首表所有 th 的 (rect.width / V) * 100`（**按实测宽度换算成百分比，不读 style**，只算这一次）
2. `mousemove`（**document** 上）：`delta = (e.clientX - startX) / V * 100`；
   `newLeft = Math.max(3, m[i] + delta)`；`newRight = Math.max(3, m[i+1] - delta)`；
   然后遍历**容器里所有** `.receipt2-table`，把第 i / i+1 个 th 的 `style.width` 设成 `newLeft%` / `newRight%`
   → 多页时所有页同步，只动相邻两列，**合计守恒**（除非撞到 3% 下限）
3. `mouseup`（document）：摘掉 mousemove/mouseup 监听、手柄背景复位；
   取首表 `thead th`，`o = table.getBoundingClientRect().width`；
   `n.value = ths.map(th => round10(th.style.width ? parseFloat(th.style.width) : rect.width/o*100))`
   （**没被写 style 的列回退到实测百分比**；`Math.round(10*a)/10` 保留 1 位小数）
   → 立刻 `localStorage.setItem(da, JSON.stringify(n.value))`（:936-939）

**边界**：单列下限 **3%**，无上限；未做总和归一化，反复拖会让总和偏离 100。
**写盘**：`receipt2_column_widths`（`da`），在 **mouseup** 时写，不走任何「保存」。
**读盘**：onMounted（:1077-1089）——**必须是长度 10 的数组**，否则整份作废用默认；每项 `Math.max(3, Number(x) || 3)`。

**谁调用 `pe`**：只有两处 —— ① 父级 `yi`（每次预览 HTML 更新后，`Home.Home.decoded.js:1000`）；② `xe`（元素面板确认后重渲染完，`Receipt2.deobfuscated.js:1001`）。「编辑收据单」进入时父级会把所有手柄删掉，退出时再重建。

---

## 3. 「元素微调」面板（Receipt2 自带，`Ce` 那一组）

**先把一句话说清（重要）**：

> **这套面板在旧版 app 里几乎是死代码** —— 它唯一的绑定点是 `initElementEditor`，而 `initElementEditor` 只在父级 `yi` 里被调用一次；父级的「编辑收据单」走的是**另一套**（contentEditable + 二维码弹窗，见 §4），**从不调用** `initElementEditor`/`destroyElementEditor`/`resetAllElementConfigs`。
> 但 `yi` 是 `onPreviewHtmlChange`，所以**每次预览刷新都会绑上 `Ce`** —— 也就是说：**在「编辑收据单」模式下点任意字段，Receipt2 的面板也会同时弹出来**（两条 click 监听挂在同一个容器上，都会跑）。见 §6「未确认」。

### 3.1 状态与分工（CONFIRMED）

| 符号 | 定义 | 角色 |
|---|---|---|
| `b` | `Vue.ref(L())` :137 | **已存**元素配置表（10 个 key）；localStorage 唯一来源 |
| `k` | `Vue.ref(null)` :181 | 当前打开面板的 **key**（null = 面板关） |
| `P` | :182-188 | **草稿**（面板各控件绑定它） |
| `I` | :189-195 | 打开面板那一刻的**快照**（供「取消」回滚） |
| `U` | `Vue.ref({top:0,left:0})` :196 | 面板定位（px） |
| `S` | `let S = null` :197 | **绑了 click 监听的容器元素**（父级传入） |
| `T` | `let T = null` :198 | **当前被编辑的真实 DOM 元素** |

| 函数 | 行号 | 分工 |
|---|---|---|
| `L()` | :125-136 | 造默认配置表：10 个 key 各 `{offsetXMm:0, offsetYMm:0, fontSize:0, widthMm:0, visible:true}` |
| `M(cfg)` | :104-124 | **配置 → 内联 style 字符串**（渲染链路核心） |
| `D()` | :138-176 | **读盘** `receipt2_element_configs`，逐字段校验后填 `b` |
| `A()` | :177-180 | **写盘** `receipt2_element_configs` = `b.value` |
| `Y()` | :199-204 | 把 `P` 立刻刷到 `T` 上：`M(P)` 非空则 `T.setAttribute("style", s)`，空则 `T.removeAttribute("style")` |
| — | :205-211 | `Vue.watch(P, () => Y(), {deep:true})` —— **改控件即时预览** |
| `ze(container)` | :983-988 | `initElementEditor`：先 `S.removeEventListener("click", Ce)`，再 `S = container; container.addEventListener("click", Ce)` |
| `Ce(e)` | :947-982 | 点击命中 → 开面板 |
| `xe()` | :989-1003 | **确认**：写 `b[k] = {...P}` → `A()` → 关面板 → 若 `isReceipt2Active()` 则 `await ve()`，然后 rAF 里 `pe(S); ze(S)` |
| `Be()` | :1004-1007 | **取消**：`P = {...I}` → `Y()`（当场还原 DOM）→ 关面板 |
| `Me()` | :1008-1016 | **重置**：`P = 全零默认`（走 watcher 即时生效）。注意是「恢复默认样式」，**不是**回到 `I` |
| `destroyElementEditor()` | :1141-1146 | 摘监听、`S=null`、`k=null`、`T=null`（父级从不调用） |
| `resetAllElementConfigs()` | :1147-1153 | `b = L(); A(); isReceipt2Active() && ve()`（父级从不调用） |

### 3.2 `Ce` 命中逻辑（:947-982）

```js
let o = e.target.closest("[data-r2-el]")
if (!o) {                                   // 目标不在元素上（比如点在 th 的 padding / 手柄上）
  for (const x of document.elementsFromPoint(e.clientX, e.clientY) || []) {
    const c = x.closest && x.closest("[data-r2-el]")
    if (c && B[c.getAttribute("data-r2-el") || ""]) { o = c; break }
  }
}
if (!o) return
const key = o.getAttribute("data-r2-el")
if (!key || !B[key]) return                  // B = 10 个合法 key 的标签表
e.preventDefault(); e.stopPropagation()
const r = o.getBoundingClientRect()
let top = r.bottom + 8, left = r.left
if (top + 240 > innerHeight) top = Math.max(8, r.top - 240 - 8)   // 下方放不下 → 翻到上方
if (left + 280 > innerWidth) left = Math.max(8, innerWidth - 280 - 8)
U.value = { top, left }
k.value = key
const cfg = b.value[key] || {offsetXMm:0, offsetYMm:0, fontSize:0, widthMm:0, visible:true}
I.value = {...cfg}; P.value = {...cfg}; T = o
```

面板尺寸假设是 **280×240**（两个魔数）。

### 3.3 面板控件（`Receipt2.deobfuscated.js:2408-2628`，`Teleport to body`）

两个同级块：遮罩 `div.r2-el-editor-mask`（`onClick.self = Be`，:2412-2416）+ 面板 `div.r2-el-editor`（`position:fixed; top/left 来自 U`，:2418-2627）。
CSS 在 `legacy/css/Home-97d96482.css`：

```
.r2-el-editor-mask{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.15)}
.r2-el-editor{position:fixed;z-index:9999;background:#fff;border:1px solid #dcdfe6;border-radius:8px;
  box-shadow:0 4px 20px #0000002e;padding:14px 16px;min-width:270px;font-size:13px}
.r2-el-editor-title{font-size:15px;font-weight:600;…}
.r2-el-editor-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.r2-el-editor-row label{width:72px;text-align:right;color:#606266;flex-shrink:0}
.r2-el-editor-actions{display:flex;justify-content:flex-end;gap:6px;…}
```

标题 = `B[k] || k`（中文标签）。

| 控件 | 绑定 | 类型 / 范围 | 备注 | 行号 |
|---|---|---|---|---|
| X偏移(mm) | `P.offsetXMm` | `el-input-number` step **0.5**, precision 1, width 120px | **无 min/max** | :2437-2461 |
| Y偏移(mm) | `P.offsetYMm` | 同上 | **无 min/max** | :2462-2486 |
| 字体(px) | `P.fontSize` | min **0**, max **60**, step 1 | 旁边灰字「0=默认」 | :2487-2525 |
| 宽度(mm) | `P.widthMm` | min **0**, max **300**, step 0.5, precision 1 | 旁边灰字「0=默认」 | :2526-2565 |
| 显示 | `P.visible` | `el-checkbox` | | :2566-2586 |
| 重置 / 取消 / 确认 | `Me` / `Be` / `xe` | 3 个 `el-button size=small`（确认 primary） | | :2587-2624 |

**这个面板不支持改文字** —— 没有任何文字输入控件；文字靠父级 contentEditable（§4）。

### 3.4 `M(cfg)` —— 配置怎么进渲染（`Receipt2.deobfuscated.js:104-124`）

```js
const parts = []
if (!cfg.visible)                 parts.push("display:none")
if (cfg.offsetXMm !== 0 || cfg.offsetYMm !== 0)
                                  parts.push(`position:relative;left:${offsetXMm}mm;top:${offsetYMm}mm;z-index:10`)
if (cfg.fontSize > 0)             parts.push(`font-size:${fontSize}px`)
if (cfg.widthMm > 0)              parts.push(`width:${widthMm}mm;max-width:${widthMm}mm`)
return parts.join(";")
```

再由 `ce(key)`（:463-469）打成 HTML 属性：

```js
'data-r2-el="' + key + '"' + (style ? ' style="' + style + '"' : "")
```

调用点（:475-601）：`qrcode`(img 或占位 div)、`orderNo`、`date`、`title`、`client`、`tel`、`address`、`productionDays`、`amounts`、`declaration` —— 正好 10 个。
另有 `se(key) = !cfg || cfg.visible`（:470-474），只用在 `client/tel/address/productionDays/orderNo/date/qrcode/amounts/declaration` 的**拼装前**判断，与 `C` 里的 `show*` 是**与**关系（`de`/`Ve` 里 `o.showOrderNo && se("orderNo")` 这类）。

**叠加优先级（从低到高）**：`ue()` 的类选择器 → `M()` 的内联 style。
所以元素面板里设的 `fontSize` **会覆盖**「字体调节」里的分类字号（内联赢样式表）；`widthMm` 会给元素加固定宽。

### 3.5 「重置 / 取消 / 确认」的差别（易混，单列）

| | 改 `P` | 立刻改 DOM | 改 `b` | 写盘 | 关面板 | 重渲染 |
|---|---|---|---|---|---|---|
| 重置 `Me` | → 全零默认 | ✅（watcher→`Y`） | ❌ | ❌ | ❌ | ❌ |
| 取消 `Be` | → 回到 `I` | ✅（显式 `Y`） | ❌ | ❌ | ✅ | ❌ |
| 确认 `xe` | 不动 | — | ✅ | ✅ `A()` | ✅ | ✅（`ve()`→`pe`,`ze`） |

---

## 4. 父级的「编辑收据单」= 真正的 contentEditable 模式（CONFIRMED）

按钮（`/tmp/Home.Home.decoded.js:4101-4113`）：

```
12==ic.value && !Ll.value  → <button success> 编辑收据单  onClick:Ri
12==ic.value &&  Ll.value  → <button danger>  完成编辑    onClick:Ri
```

`Ll = Vue.ref(false)`（同文件 **42**），`ao` = 预览容器 `div`（`ao=Vue.ref(null)` 同文件 **85**；渲染处 `ref_key:"commentPreviewContainer"`, `innerHTML: Wn.value`，同文件 **4260-4264**）。
`Wn.value` 就是 Receipt2 通过 `onPreviewHtmlChange` 交上来的 HTML。

### 4.1 `Ri`（同文件 2300-2303）

**进入**：
```js
Ll.value = true
o.querySelectorAll(".r2-resize-handle").forEach(e => e.remove())   // 撤掉列宽手柄
o.contentEditable = "true"
o.style.outline = "2px solid #409eff"
o.style.cursor  = "text"
o.addEventListener("click", Ki)
ElMessage.info("已进入编辑模式，可直接点击文字修改；点击二维码可删除或替换")
```

**退出**：
```js
Ll.value = false
o.contentEditable = "false"
o.style.outline = ""; o.style.cursor = ""
o.removeEventListener("click", Ki)
bl.value = false
await nextTick()
Xn.value?.initColumnResize(o)     // 重建列宽手柄
Xn.value?.initElementEditor(o)    // 重挂 Receipt2 的 Ce
ElMessage.success("编辑完成，复制/打印/导出将使用当前内容")
```

- **文字改动没有任何持久化**：改的是 `ao` 的 DOM（`contentEditable` 直接改文本节点），既不入库也不写 localStorage。
- 提示语说的是「复制/打印/导出将使用当前内容」—— 因为 `printFromContainer`（`Receipt2.deobfuscated.js:1226-1270`）是 **clone 容器 DOM** 再 `innerHTML` 进 iframe，所以改过的文字会跟着去打印；但 `printDirect`/`buildReceipt2Html`（走 `ye`/`ge` 重新拼 HTML）**不会**带上改动。

### 4.2 `Ki` / `Zi` / `Xi` / `Qi` —— 二维码弹窗（同文件 2275-2299）

```js
Ki = e => {
  const el = e.target
  if (el.tagName === "IMG" &&
      (el.classList.contains("receipt2-qrcode") || el.classList.contains("receipt2-qrcode-empty"))) {
    e.preventDefault(); e.stopPropagation()
    Pl.value = el
    const r = el.getBoundingClientRect()
    Al.value = { top: r.bottom + 6, left: r.left }
    bl.value = true
  } else bl.value = false            // 点别处 → 关弹窗
}
Zi = () => { Pl.value?.remove(); Pl.value = null; bl.value = false }        // 删除
Xi = () => Il.value?.click()                                              // 触发隐藏 file input
Qi = e => {                                                               // 换图
  const f = e.target.files?.[0]; if (!f || !Pl.value) return
  const fr = new FileReader
  fr.onload = t => {
    Pl.value.src = t.target.result
    Pl.value.classList.remove("receipt2-qrcode-empty")
    Pl.value.classList.add("receipt2-qrcode")
    bl.value = false; e.target.value = ""
  }
  fr.readAsDataURL(f)
}
```

弹窗模板（同文件 **4646-4669**，`Teleport to body`）：`position:fixed; top/left 来自 Al; z-index:3000; background:#fff; border:1px solid #ddd; border-radius:6px; padding:6px 8px`，
三个按钮 **删除(danger, Zi) / 替换图片(primary, Xi) / 关闭(bl=false)**，外层 `onClick.stop`。
配套隐藏 `<input ref=Il type=file accept="image/*" style="display:none" onChange=Qi>`（ref_key `qrFileInput`）。

⚠️ 这说明旧版的「换二维码」**只改 DOM 的 `src`**（dataURL），**不写任何存储**——重渲染即丢。

---

## 5. `data-r2-el` 稳定标识全清单

`x`（:80-91）与标签表 `B`（:92-103）—— 全文只出现这 10 个值：

| # | `data-r2-el` | `B[key]`（面板标题） | 对应 `C`(g) 里的 show 开关 | 位置开关 | 渲染处 |
|---|---|---|---|---|---|
| 1 | `orderNo` | 编号 | `showOrderNo` | `orderNoPosition` | `de` :490-494 |
| 2 | `date` | 日期 | `showDate` | `datePosition` | `de` :495-500 |
| 3 | `title` | 品牌标题 | **无**（只能靠元素面板的「显示」关） | — | `de` :565-572 |
| 4 | `qrcode` | 二维码 | `showQrcode` | `qrcodePosition` | `de` :478-488 |
| 5 | `client` | 客户 | `showClient`（经 `metaOrder`） | metaOrder 序 | `de` :521-526（带 `data-shrink-fit`） |
| 6 | `tel` | 电话 | `showTel` | 同上 | `de` :527-532（带 `data-shrink-fit`） |
| 7 | `address` | 安装地址 | `showAddress` | 同上 | `de` :533-538（带 `data-shrink-fit`） |
| 8 | `productionDays` | 生产天数 | `showProductionDays` | 同上 | `de` :539-544（**不带** shrink） |
| 9 | `amounts` | 金额 | `showAmounts` | — | `Ve` :583-593 |
| 10 | `declaration` | 说明 | `showDeclaration` | — | `Ve` :594-600 |

**两条开关是独立轴，都要为真才显示**（对 9 个有 show 开关的 key）：
`C.showX && se(key)`（`se` = 元素配置的 `visible`）—— 见 `de`/`Ve` 的每个三元。
`title` 没有 `show*`，所以只能靠元素面板的 `visible` 关掉。

**不可编辑 / 无标识的东西**（CONFIRMED）：
- 明细表（`re()`/`ie()`，:439-462）：表头 10 个中文列名、每行单元格、`暂无明细` 空行 —— **都没有 `data-r2-el`**，无论哪条路都改不了。
- 前缀文字「编号：」「日期：」「客户：」「电话：」「安装地址：」「生产天数：」「总额：」「已付：」「未付：」和金额的 `toFixed(2)` 格式（`ne`，:366-370）—— 都写死在拼串里。
- 页边距（`4mm 4mm 3mm`）、二维码尺寸（18mm×18mm）、二维码边框 —— 写死在 `ue()`。
- `data-shrink-fit` 是**另一个属性**（不是 `data-r2-el`），只作自动缩字标记，不参与点击命中。

---

## 6. 未确认 / 存疑

1. **`Ce` 与 `Ki` 会不会同时弹两个面板？**
   `ze(ao)` 在每次预览刷新时给容器挂 `Ce`；`Ri` 进入编辑模式又挂 `Ki`。两者是**同一个元素上的两个 click 监听**，`stopPropagation()` 拦不住同元素的其他监听。代码上：
   - 点文字字段 → `Ce` 开 Receipt2 面板（带 `inset:0` 的全屏遮罩 z-index 9998，会把 contentEditable 的下一次点击先吃掉），`Ki` 只把 `bl` 置 false；
   - 点二维码 → 两个都开。
   我**没有实机跑过旧版**，无法确认这是原本如此、还是我漏了某处抑制（例如 `Ce` 里可能有我没识别出的 `Ll` 之类的外部条件——但已逐个 token 读过 :947-982，没有）。
   复刻时的建议：**二选一**，别把两套并存。若要保留两套，至少要 `Ce` 在 `Ll`（编辑模式）为真时直接 return。

2. **`xe`（元素面板确认）里 `S` 的时序**：`await ve()` 之后 `requestAnimationFrame(() => { pe(S); ze(S) })`。`ve()` 内部 `await o.onPreviewHtmlChange(t)`，父级 `yi` 已经把 `initColumnResize`/`initElementEditor` 调过一遍了，所以这里其实是**第二次**绑定（`ze` 会先摘再挂，`pe` 幂等，无副作用）。是否原作者知道这点，不明。

3. **父级 `Zi`（删除二维码）** 在 `qrcode` 配置 `visible:true` 时把 `<img>` 从 DOM 摘掉，但 Receipt2 的 `b.qrcode.visible` 不变；下一次任何重渲染都会让它**复活**。是否有意为之，未知。

4. **`destroyElementEditor` / `resetAllElementConfigs` 是死导出**：在 `Home` 组件里 `grep` 出现次数为 0（我扫的是 `/tmp/Home.Home.decoded.js`，全文）。它们的调用者可能在其他 chunk —— 我只扫了 Home chunk（`js/*.js` 里搜 `destroyElementEditor` 命中文件仅 `Receipt2.deobfuscated.js` 本身），所以**应该**是死的，但没做跨 chunk 穷举（`vendor/` 未扫）。

5. **`data-shrink-fit` 会清掉元素面板设的字号**（CONFIRMED 代码，影响需实机确认）：`pe` 与打印链路都会对 `[data-shrink-fit]` 元素先 `el.style.fontSize = ""`（**整条内联声明清掉**）再按需缩小（:857-872、:779-795）。而 `client`/`tel`/`address` 三个字段正是 `data-shrink-fit`。所以在这三个字段上用元素面板设的「字体(px)」在屏幕预览上会被立刻抹掉。三个字段之外的 7 个 key 不受影响。

---

## 7. 复刻要点速查（给实现用）

1. **弹窗是「草稿/已存」双份**：打开时把已存拷进草稿，确认才写回 + 写盘 + 刷预览；取消天然回滚。`重置默认` 只重置草稿，不写盘、不关窗。
2. **写盘分三个时机**，别合并：`he`（保存：4 个键）、`pe` 的 mouseup（列宽）、`j`（打印机 onChange）。
3. **字号只有 6 个，且没有字体族**。字体族要复刻就照抄 `"Microsoft YaHei", "PingFang SC", sans-serif`；要「能换字体」属于**新增**功能，不是复刻。
4. **列宽是 10 个裸百分比**，默认和 99.8%，下限 3%，多页同步，只动相邻两列，写盘在 mouseup，读盘要求长度恰为 10。
5. **元素微调面板**（10 个 key × 5 个属性）与**父级 contentEditable 模式**是**两套**东西，前者改样式、后者改文字且不持久化；二维码替换只改 DOM `src`，也不持久化。
6. 元素微调的内联 style 优先级高于分类字号 —— 复刻时若用 CSS 变量/类，要保证「元素级字号」能压过「分类字号」。
