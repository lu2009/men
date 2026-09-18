# 各单据「编辑」弹窗全表（Home 订单管理页 · 旧版逆向）

> 证据文件：`legacy/js/Home-d6b13b9a.js`（单行文件，用**字符偏移**引用）、`legacy/js/Hui.formatted.js`（行号）。
> `dr` 解码表 = `legacy/decode-home-map.mjs` 产出（offset 467，1025 项）。
> 生成脚本：`/tmp/edit-recon/*.mjs`（region2.mjs / toolbar2.mjs / handlers.mjs / fn.mjs / hui.mjs）。
> 全部条目带 **CONFIRMED / INTERPRETED**。

---

## 0. 三条先说清的结论

**① 「编辑」按钮全部长在「打印预览弹窗」的工具栏里，不在 `打印选项` 抽屉里。**
预览弹窗 = `C` 组件（`el-dialog`），`modelValue: eo`，宽度 `15==ic||16==ic ? "95%" : "1180px"`，工具栏容器 `div.Ru`，起始偏移 `487568`（`关闭`），一直排到 `499531`（`导出PDF`）。
抽屉（`title:【打印选项】`, `size:350`，偏移 `501700`）里只有**打开各单据的入口按钮**，每个入口把 `ic` 设成 1–16 之一。

**② `ic` 不是「单据 ID」，是「预览模式」。** 多个入口复用同一个 `ic`
（`生产单`/`平开门生产单`/`移门生产单`/表格行内点击 全是 `ic=2`；`标签`/`平开标签`/`推拉标签` 全是 `ic=4`）。
所以「有没有编辑按钮」是**按 ic 分支**的，不是按入口。

**③ 所有编辑都是「只改内存」** —— 见 §5。除了 `ReceiptEdit` 里那条**账号级「声明」**的 POST，没有任何一处把编辑结果写回服务端或写回 Hui 组件。

---

## 1. 主表：逐 ic（1–16）总览

| ic | 单据名（抽屉入口，逐字） | 有「编辑」按钮？ | 按钮文案（逐字） | 开的弹窗 | 喂的数据 ref | 该 ref 由谁填充 | onSave | 保存后做什么 |
|---|---|---|---|---|---|---|---|---|
| **1** | `玻璃合片单`(`Sc`,503990) | ✅ | ` 编辑玻璃合片单 ` (key33,496809) | `ProductionEdit`(`cc`) | `uc` | `Sc`: `lc.calculateGlass()` | `gc` | 写回 `uc`；若预览开着 → 用 `template.glass` + `{produces:uc}` 经 `It.commentPreview` 重渲 `Wn` |
| **2** | `生产单`(`Tc`)/`平开门生产单`(`Gc`)/`移门生产单`(`qc`)/表格行内(`Dn`) | ✅ | ` 编辑生产单 ` (key29,495932) | `ProductionEdit`(`cc`) | `uc` | `Gc`/`Tc`/`Dn`: `lc.calculateReceipt(...)` | `gc` | 同上，改用 `template.product` |
| **3** | `玻璃订单`(`Uc`,504138) | ✅ | ` 编辑玻璃单 ` (key42,499099) | `GlassEdit`(`Ec`) | `Nc` | `Uc`: `lc.Glasslist()` → `rc[0].glassInfoList` | `Ac` | 写回 `Nc` **并回写 `rc[0].glassInfoList`**；预览开 → `template.glassHole` + `rc` 重渲 |
| **4** | `标签`(`xc`)/`平开标签`(`kr`)/`推拉标签`(`Pr`) | ✅ | ` 编辑标签 ` (key43,499315) | `LabelEdit`(`Lc`) | `bc` | `kc` 从 `Cc` 拷贝（`bc=Cc; Lc=true`） | `Pc` | 写回 `Cc`；预览开 → `template.lable` + `Cc` 重渲（ic=4 分支） |
| **5** | `收据单`(`hi`,505148) | ✅ | ` 编辑收据单 ` (key27,495453) | `ReceiptEdit`(`_n`) | `jn[0]` | `hi`: 由 `wn` 映射出 `jn` | `qi` | `jn[0]=e`；`ic===5` → `await Rn()` 重渲 `Wn`；提示「收据单预览已更新」 |
| **6** | `订单汇总`(`Ci`,505386) | ❌ | — | — | — | `jn`（但不给编辑） | — | — |
| **7** | `平开门生产单(定制)`(`jc`,505015) | ❌ | — | — | — | `uc`（但不给编辑） | — | — |
| **8** | `生产单定制`(`Wc`,503687) | ✅ | ` 编辑生产单 ` (key32,496577) | `ProductionEditOld`(`Vc`) | `uc`（`14!=ic` 分支） | `Wc`: `lc.calculateReceiptOld()` | `wc` | 写回 `uc`；预览开 && `ic===8` → `template.product2` 重渲 |
| **9** | `生产单定制(竖版)`(`Oc`,503835) | ✅ | ` 编辑生产单 ` (key32,496577) | `ProductionEditOld`(`Vc`) | `uc`（已被 `sc()` 两并一切分） | `Oc`: `calculateReceiptOld()` 后 `uc=sc(uc)` | `wc` | 写回 `uc`；预览开 && `ic===9` → `template.product3` 重渲 |
| **10** | `生产标签`(`Mc`,504429) | ❌ | — | — | — | `Bc`（但不给编辑） | — | — |
| **11** | `料标签`(`Hc`,504574) | ❌ | — | — | — | `Cc`（但不给编辑） | — | — |
| **12** | `自定义收据单`(`pi`,506253) | ✅（**无弹窗**） | ` 编辑收据单 ` / ` 完成编辑 ` (key5/key6,490730) | 无 —— 预览 div 就地 `contentEditable` | `ao`（预览容器 DOM） | — | `Ri` 直接改 DOM | 退出编辑时 `initColumnResize()`+`initElementEditor()`；提示「编辑完成，复制/打印/导出将使用当前内容」 |
| **13** | `自定义合格标签`(`br`)/`平开合格标签`(`Dr`)/`推拉合格标签`(`Ar`) | ✅ | ` 编辑标签 ` (key11,491980) | `LabelEdit`(`Lc`) | `bc` | `kc` 从 `Cc` 拷贝 | `Pc` | 写回 `Cc`；`fr.buildQualifiedLabelHtml(Cc)` 重渲 `Wn`（ic=13 分支） |
| **14** | `自定义生产单`(`gi`,506842) | ✅ | ` 编辑生产单 ` (key13,492416) | `ProductionEditOld`(`Vc`) | **`Sr()`**（返回值，非 ref） | `gi`: `calculateReceiptOld()` → `Ur` | `wc` | `Ur=e`；`Ir.buildProductionSheetHtml(Sr())` 重渲 |
| **15** | `自定义生产单2`(`ti`,506989) | ✅ | ` 编辑生产单 ` (key18,493502) | `ProductionEdit`(`Zr`) | `qr` | `ti`: `lc.calculateReceipt()` | `Qr` | `qr=e`；`jr.refreshPreview()` |
| **16** | `自定义玻璃合片单`(`wi`,507138) | ✅ | ` 编辑合片单 ` (key23,494584) | `ProductionEdit`(`ri`) | `oi` | `wi`: `lc.calculateGlass()` | `ci` | `oi=e`；`li.refreshPreview()` |

**完全没有编辑按钮的 ic：`6`、`7`、`10`、`11`**（CONFIRMED）。
这四个 ic 只落进「非 12–16」那条兜底分支：`12!==ic && 13!==ic && 14!==ic && 15!==ic && 16!==ic → { 云打印(Zc), 手动打印(Qc) }`（488578 / 489752），外加始终存在的 `关闭`(487568) 和 ` 导出PDF `(Xc,499531)。

---

## 2. 每个 ic 工具栏的**全部**按钮（逐条列全）

工具栏按渲染顺序（`div.Ru` 内），偏移为 `Home-d6b13b9a.js` 字符偏移（CONFIRMED，来自 `toolbar2.mjs`）：

| ic | 按钮（逐字） | onClick | 偏移 |
|---|---|---|---|
| 全部 | ` 关闭 ` | `t[15]` 直接置 `eo=false` | 487568 |
| 非 12–16 | ` 云打印 ` | `Zc` | 488578 |
| 非 12–16 | ` 手动打印 ` | `Qc` | 489752 |
| 12 | ` 直接打印 ` | `Ji` | 490035 |
| 12 | ` 打印 ` | `_i` | 490248 |
| 12 | ` 字体调节 ` | `vi` | 490461 |
| 12 | ` 编辑收据单 `（`!Ll` 时） / ` 完成编辑 `（`Ll` 时，type=danger） | `Ri` | 490730 / 491061 |
| 13 | ` 手动打印 ` | `Er` | 491125 |
| 13 | ` 标签机设置 ` | `Mr` | 491338 |
| 13 | ` 直接打印 ` | `Lr` | 491551 |
| 13 | ` 编辑布局 ` | `Nr` → `fr.openLayoutEditor()` | 491764 |
| 13 | **` 编辑标签 `** | `kc` | 491980 |
| 14 | ` 手动打印 ` | `Hr` | 492200 |
| 14 | **` 编辑生产单 `** | `mc` | 492416 |
| 14 | ` 生产单设置 ` | `Wr` | 492635 |
| 14 | ` 直接打印 ` | `Gr` | 492850 |
| 14 | ` 编辑布局 ` | `Or` | 493069 |
| 15 | ` 手动打印 ` | `Rr` | 493284 |
| 15 | **` 编辑生产单 `** | `Xr` | 493502 |
| 15 | ` 打印设置 ` | `$r` | 493720 |
| 15 | ` 直接打印 ` | `Fr` | 493936 |
| 15 | ` 布局设置 ` | `ei` | 494152 |
| 16 | ` 手动打印 ` | `si` | 494365 |
| 16 | **` 编辑合片单 `** | `ii` | 494584 |
| 16 | ` 打印设置 ` | `Vi` | 494801 |
| 16 | ` 直接打印 ` | `di` | 495017 |
| 16 | ` 布局设置 ` | `mi` | 495233 |
| 5 | **` 编辑收据单 `** | `t[16]` 直接置 `_n=true` | 495453 |
| 5 | `显示金额`/`去除金额` | `Vr` | 495696 |
| 2 | **` 编辑生产单 `** | `dc` | 495932 |
| 2 | ` 生成扣板 ` | `Yc` → `lc.generateKouBanPreview()` | 496147 |
| 2 | ` 导出excel ` | `tc` | 496365 |
| **8 或 9** | **` 编辑生产单 `** | `mc`（条件是 `8==ic||9==ic`，496577 前 40 字符） | 496577 |
| 1 | **` 编辑玻璃合片单 `** | `dc` | 496809 |
| `oo`（收据单态）&& `!z` | `复制收据单` | `hc` | 497024 |
| `oo` && `z` | `微信分享(手机)` | `pc` | 497302 |
| `al`（汇总态）&& `!z` | `导出订单汇总` | `bi` | 497577 |
| `al` && `!z` | `复制成图片` | `Ei` | 497788 |
| `al` && `z` | `微信分享(手机)` | `Li` | 498055 |
| `lo`（玻璃单态）&& `!z` | `复制玻璃单` | `vc` | 498316 |
| `lo` && `z` | `微信分享(手机)` | `fc` | 498596 |
| `lo` && `!z` | ` 导出玻璃订单 ` | `Ic` | 498874 |
| 3 | **` 编辑玻璃单 `** | `Dc` | 499099 |
| 4 | **` 编辑标签 `** | `kc` | 499315 |
| 全部 | ` 导出PDF ` | `Xc` | 499531 |

> `z` = 手机端标志。`oo/al/lo` 分别是「收据单/订单汇总/玻璃单」态标志，与 `ic` 正交。

---

## 3. 编辑弹窗本体（5 个，全在 `Hui.formatted.js`）

**共同点（CONFIRMED）**：`props: { modelValue, <X>Data }`，`emits: ['update:modelValue','save']`；
`el-dialog` **无 `title`、无 header**，`append-to-body:true`、`destroy-on-close:false`，只有顶部一排按钮 + 内容。
关闭（取消 / 右上 X）都走同一个 `watch(modelValue)` 副作用：`!e && emit('update:modelValue', false)`。

| 组件 | `__name` | Hui 行 | props | 弹窗宽 | 布局 | 按钮（逐字） | 列数 | Home 侧用途 |
|---|---|---|---|---|---|---|---|---|
| `n`(Hui export `c`) | `GlassEdit` | 5663 | `glassData` | `1200px` | `el-table` | `确认修改`/`取消`/`增加`/`删除`/`上传` | 9 + `操作` | ic=3 |
| `r`(Hui export `e`) | `LabelEdit` | 5955 | `labelData` | `1400px` | `el-table` | `确认修改`/`取消`/`复制`/`删除` | 11 + `操作` | ic=4, 13 |
| `i`(Hui export `f`) | `ProductionEdit` | 6228 | `productionData` | `1400px` | `el-table` | `确认修改`/`取消` | 8（无操作列，动作内嵌门图格） | ic=1, 2, 15, 16 |
| `c`(Hui export `g`) | `ProductionEditOld` | 6530 | `productionData` | `1500px` | `el-table` | `确认修改`/`取消` | 11，或 22（第二组 11 列 `v-if` 见 §3.2） | ic=8, 9, 14 |
| `u`(Hui export `d`) | `ReceiptEdit` | 6981 | `customerData` | `1400px` | `el-form` 表头 + `el-table` 明细 | `确认修改`/`取消` | 表头 8 项 + 明细 7 列 | ic=5（及 §7 的 `编辑回执单`） |

### 3.1 `ProductionEdit` 列定义（8 列，CONFIRMED，行 6290–6540）

| # | prop | label | width | 控件 |
|---|---|---|---|---|
| 1 | `OrderID` | `单号` | `150` | `el-input` small |
| 2 | `door` | `型材/颜色` | `180` | `el-input` type=textarea rows=4 |
| 3 | `basicInfo` | `基本信息` | `200` | textarea rows=4, autosize 4–8 |
| 4 | `doorsheet` | `门扇材料` | `200` | textarea rows=5, autosize 5–10 |
| 5 | `doorframe` | `门框材料` | `200` | textarea |
| 6 | `windows` | `亮窗/扣板` | `200` | textarea |
| 7 | `doorImg` | `门图` | `180` | `el-image` + `door-image-actions`（上传/删除，`accept=image/*`，FileReader→base64） |
| 8 | `remark` | `备注` | `200` | textarea |

**无「操作」列**（操作内嵌在门图格子里）。

**进出场转换（CONFIRMED）**：打开时 `<br>` → `\n`（`basicInfo/doorsheet/doorframe/windows/door` 五个字段）；`确认修改` 时 `\n` → `<br>` 写回，然后 `emit('save', rows)`，`ElMessage.success`。

### 3.2 `ProductionEditOld` 列定义（`el-table`，11 列 / 22 列两态，CONFIRMED，行 6540–6990）

**是 `el-table`，不是表单。** 列组共 11 列；当数据里存在 `orderID1` 时**再加 11 列**（拼在右侧）：

`r = computed(() => o.value.length > 0 && o.value.some(e => e.orderID1 !== undefined))`（`orderID1` 由解码 `a(364)` 得来），
模板里第二组整块是 `r.value ? (…) : …`。也就是说 **「每页 2 条」的数据才会长出那 11 列**。

第一组（列标签 → prop）：`单号`→`orderID`、`型材`→`material`、`颜色`→`color`、`尺寸`→`_size`、`玻璃`→`glass`、`地址`→`address`、`门扇材料`→`_doorsheet`、`门框材料`→`_doorframe`、`亮窗/扣板`→`_windows`、`门图`→`doorImg`、`备注`→`remark`。

第二组列标签是 `单号2 / 型材2 / 颜色2 / 尺寸2 / 玻璃2 / 门扇2 / 门框2 / 亮窗/扣板2 / 门图2 / 备注2`，
但**数据键是 `<field>1`**（`orderID1`/`material1`/`color1`/`_size1`/`_doorsheet1`/…），由 `sc()` 合并时加 `1` 后缀产生。
> ⚠️ **UI 写「2」、数据键后缀是「1」** —— 这是旧版的一处不一致，不是笔误（`sc` 在 Home 偏移 421628，源码是 `e[t+"1"]=n[t]`）。
> ⚠️ 每个第二组的格子外面还包一层 `void 0 !== e.orderID1 ? <input> : <span>-</span>`（其余字段同理），逐格判空。

派生/回写规则（CONFIRMED）：
- 进（`row`）：`_size = Array.isArray(size) ? size.join("\n") : (size||"")`；`_doorsheet/_doorframe/_windows` 优先取 `oldSheet[0].{doorsheet,doorframe,windows}`（`<br>`→`\n`），否则取记录自身的 `windows`。第二组同理，读 `size1/oldSheet1/windows1`。
- 出（`save`）：`x.size = _size.split("\n").filter(非空)`，然后 `delete x._size`；`doorsheet/doorframe/windows` 由 `_doorsheet/_doorframe/_windows` 做 `\n`→`<br>` 后写进 `x.oldSheet[0]`，随后 `delete x._doorsheet/_doorframe/_windows`。第二组同样处理 `*1`。

### 3.3 `GlassEdit` 列定义（`el-table`，9 列 + 操作，CONFIRMED，行 5697–5960）

`OrderID`→`单号` / `client`→`客户` / `glassName`→`玻璃名称` / `width`→`宽度(mm)` / `height`→`高度(mm)` / `thickness`→`厚度(mm)` / `quantity`→`数量` / `doorImg`→`挖孔图` / `remark`→`备注` / `操作`（`fixed`，删行、上传）。
额外交互：`增加` 按钮（加行）、`删除`（删行）。

### 3.4 `LabelEdit` 列定义（`el-table`，11 列 + 操作，CONFIRMED，行 5965–6230）

`client`→`客户` / `storeAddress`→`位置` / `door`→`门型` / `size`→`尺寸` / `color`→`颜色` / `lockway`→`开向` / `orderID`→`单号` / `address`→`地址` / `glass`→`玻璃` / `package`→`包号` / `remark`→`备注` / `操作`。
按钮：`确认修改`/`取消`/`复制`/`删除`。

### 3.5 `ReceiptEdit`（`customerData`，CONFIRMED，行 6981–7440）

`el-form` 表头 + `el-table` 明细：

- 表头（`el-form` + `label-width:80px`，`class="customer-form"`）：`客户` / `电话` / `日期` / （一个 number 字段）/ `总价` / `定金` / `余款` / `单号` / `声明`（多行）；下面还有收货信息与图片上传。
- 明细（`el-table`，7 列）：`型材` / `开向` / `颜色` / `玻璃` / `尺寸` / `数量` / `金额`。
- `确认修改` 走 `g()` 组装 `{...customerData, balance: 总价-定金, receipt:[…]}` 后 `emit('save')`。
**弹窗标题硬编码为 `编辑回执单`**（`_0x4407[308]`）—— 即使它被 ic=5 的「` 编辑收据单 `」按钮打开，标题也写「回执单」。CONFIRMED。
⚠️ 组件内还有一个独立的「改声明」流程：`POST https://www.samrtdoor.com.cn/1?param1=changeDecleration&param2=<registrant>`，body `{declaration}`；成功后清 token 并跳登录（提示「新的温馨提示要重新登陆账号才生效！」）。**这是账号级声明，不是订单数据**，与「订单编辑不持久化」不矛盾。

---

## 4. 保存回调逐个（CONFIRMED，偏移为 Home 字符偏移）

| onSave | 偏移 | 干什么 |
|---|---|---|
| `gc` | 422851 | `uc.value = e`；若 `eo.value && ic===2` → `template.product` + `{produces:uc}` 经 `It.commentPreview` 重渲 `Wn`；若 `eo.value && ic===1` → `template.glass` + `{produces:uc}` 重渲。**预览开着就地重渲**，预览关着就只落 ref。 |
| `wc` | 422122 | `if (14 !== ic)`：`uc.value = e`；`eo && ic===8` → `template.product2` 重渲；`eo && ic===9` → `template.product3` 重渲。`else`（ic=14）：`Ur.value = Array.isArray(e) ? e : []`，并 `Ir.buildProductionSheetHtml(Sr())` 重渲 `Wn`。 |
| `Ac` | 431502 | `Nc.value = e`；再把 `rc[0].glassInfoList = Nc.value`；`eo && ic===3` → `template.glassHole` + `rc` 重渲。 |
| `Pc` | 431982 | `Cc = e`；`eo && ic===4` → `template.lable` + `Cc` 重渲；`else if eo && ic===13` → `fr.buildQualifiedLabelHtml(Cc)` 重渲。 |
| `Qr` | 361434 | `qr.value = Array.isArray(e)?e:[]`；`eo && ic===15` → `jr.refreshPreview()`。 |
| `ci` | 363242 | `oi.value = Array.isArray(e)?e:[]`；`eo && ic===16` → `li.refreshPreview()`。 |
| `qi` | 415407 | `jn[0] = e`；`ic===12` → `Wn = await fi(jn)`；`ic===5` → `await Rn()`；否则 `commentPreview(Kn, jn)`。提示「收据单预览已更新」。 |
| `ji` | 415162 | `qn[0] = e`；`Yn = It.preview('receipt', qn)[0].outerHTML`。提示「回执单预览已更新」。 |

**任务里的关键疑问：`gc`（ic=1/2）呢？**
> **CONFIRMED：`gc` 只在 `eo.value`（预览弹窗开着）时才重渲 `Wn`。** 它不去调 `Ir/jr/li` 那几个 manager，而是自己在 Home 里读 `template`（`e.registrant.template.{product,glass}`）再跑 `It.commentPreview`。
> 所以：预览开着 → 编辑完立刻看到新内容；预览关着 → 只改 ref，下次开预览时自然用新数据。
> **不再回写 Hui**（不像 ic=15/16 走 `refreshPreview()`）。这是「生产单走 `build*`/`commentPreview` 重建，PS2/GS2 走 `refreshPreview()`」这条不一致的又一处体现。

---

## 5. 是否持久化 —— 全部「只改内存」（CONFIRMED）

对 8 个数据 ref 做了全量用途扫描（`qr/oi/bc/Nc/Ur/jn/qn/uc` 的每一次读写都过了一遍）：

| ref | 写入点 | 读取点 | 落盘？ |
|---|---|---|---|
| `uc` | 9 个入口 handler + `gc`(422890) + `wc`(422122) | 打印/云打印（448214/448615/449085）、导出Excel（`tc`，419593）、导出PDF（450114…454761）、`复制成图片` | ❌ |
| `qr` | `ti`(362610) + `Qr`(361554) | `Jr`（喂给 PS2 manager 的 `get-data`） | ❌ |
| `oi` | `wi`(364515) + `ci`(363361) | `ai`（喂给 GS2 manager） | ❌ |
| `Nc` | `Uc`(434636) + `Ac`(431502) | 导出Excel（433018）、`rc[0].glassInfoList` | ❌ |
| `Ur` | `gi`(365298) + `wc`(422670) | `Sr()` | ❌ |
| `bc` | `kc`(431914) | `label-data` 传给 LabelEdit | ❌ |
| `jn` | `hi`(366473)/`pi`(367119)/`Ci`(368559) + `qi`(415431) | `Rn`/`fi`/`Qn`/导出 | ❌ |
| `qn` | `ki`(381733) + `ji`(415186) | `It.preview('receipt', qn)` | ❌ |

**结论：编辑结果只影响「本次会话的预览 / 复制 / 打印 / 导出」，刷新页面即回退。**
唯一例外是 `ReceiptEdit` 内那条账号声明的 POST（§3.5），它跟的是 `registrant` 而不是订单。
> 新版决策点：如果新版要做「真持久化」，这是**唯一需要后端新增的接口**；否则照抄「内存态 + 重渲预览」即可与旧版一致。

---

## 6. 没有编辑按钮的 ic（答案的一部分）

| ic | 入口 | 为什么没有 |
|---|---|---|
| 6 | `订单汇总`(`Ci`) | 进兜底分支，只有 云打印/手动打印 |
| 7 | `平开门生产单(定制)`(`jc`) | 同上 |
| 10 | `生产标签`(`Mc`) | 同上。数据进了 `Bc`，但**没有任何按钮能编辑 `Bc`** |
| 11 | `料标签`(`Hc`) | 同上。数据进了 `Cc`，但 ` 编辑标签 ` 只在 ic=4/13 出现，ic=11 看不到 |

> 后两条值得注意：**标签数据已经在内存里了，只是没给编辑入口**。新版若要补齐，成本最低（挂 `LabelEdit` + `bc` 即可）。

---

## 7. 与 ic 无关的第二个编辑入口：`编辑回执单`

CONFIRMED（偏移 487700–488100）：`编辑回执单` **不在**上面的预览弹窗里，而在**另一个 el-dialog**（`C` 组件，`modelValue: Ai`，`width:"1180px"`，由 `ki`(「`查看回执单`」,381580) 打开）。该弹窗工具栏只有 4 个：

| 按钮（逐字） | onClick | 条件 |
|---|---|---|
| ` 关闭 ` | 置 `Ai=false` | — |
| ` 打印 ` | `zi` | — |
| ` 手动打印 ` | `Fi` | — |
| **` 编辑回执单 `** | 置 `Jn=true` | `qn.value.length > 0` |
| `复制回执单` | `Bi` | `!z` |

它开的是 `ReceiptEdit`（`u`），`"customer-data": qn.value[0]`，`onSave: ji`。
**它不设 `ic`**，所以不在 ic 1–16 的任何一行里 —— 这是「编辑按钮不止 16 个 ic 覆盖的那些」的答案。

---

## 8. Home 侧 8 个编辑器挂载点（CONFIRMED，`Home-d6b13b9a.js` 偏移 / `Home.formatted.js` 行）

| 组件符号 | Hui 导出 | 打开开关 ref | props 数据 | onSave | 挂载偏移（createVNode） | formatted 行 |
|---|---|---|---|---|---|---|
| `n` | `c` (GlassEdit) | `Ec` | `"glass-data": Nc.value` | `Ac` | 515349 | 12196 |
| `u` | `d` (ReceiptEdit) | `Jn` | `"customer-data": qn.value[0]` | `ji` | 515551（`createBlock`） | 12198 |
| `u` | `d` (ReceiptEdit) | `_n` | `"customer-data": jn[0]` | `qi` | 515794（`createBlock`） | 12200 |
| `r` | `e` (LabelEdit) | `Lc` | `"label-data": bc.value` | `Pc` | 516000 | 12202 |
| `i` | `f` (ProductionEdit) | `cc` | `"production-data": uc.value` | `gc` | 516157 | 12204 |
| `i` | `f` (ProductionEdit) | `Zr` | `"production-data": qr.value` | `Qr` | 516314 | 12206 |
| `i` | `f` (ProductionEdit) | `ri` | `"production-data": oi.value` | `ci` | 516471 | 12208 |
| `c` | `g` (ProductionEditOld) | `Vc` | `"production-data": 14==ic ? Sr() : uc.value` | `wc` | 516646 | 12210 |

（后两个 ReceiptEdit 用 `Vue.createBlock` 懒渲染，因为外面包了 `qn.value.length > 0 ? … : createCommentVNode` 的条件。）

打开开关的置位（CONFIRMED）：

| ref | 声明偏移 | 谁置 true | 守卫 |
|---|---|---|---|
| `cc` | 421628 | `dc`(421825) | `uc.value.length` 否则 warning「暂无生产单数据」 |
| `Vc` | 421916 | `mc`(421930) | `Array.isArray(t)&&t.length`，`t = 14===ic ? Sr() : uc.value`，否则「暂无生产单数据」 |
| `Zr` | 361420 | `Xr`(361434) | `qr.value.length`，否则「暂无生产单数据」 |
| `ri` | 363228 | `ii`(363242) | `oi.value.length`，否则「暂无玻璃合片单数据」 |
| `Ec` | 431334 | `Dc`(431378) | `Nc.value.length`，否则「暂无玻璃单数据」 |
| `Lc` | 431349 | `kc`(431882) | `Cc.length` 否则「暂无标签数据」；置 true 前先 `bc.value = Cc` |

---

## 9. `编辑布局` / `布局设置`（不是数据编辑器，单列一行免得混）

| ic | 按钮 | onClick | 实际动作 |
|---|---|---|---|
| 13 | ` 编辑布局 ` | `Nr`(356088) | `fr.openLayoutEditor()`；失败提示「自定义合格标签**布局编辑器**未就绪」 |
| 14 | ` 编辑布局 ` | `Or`(360845) | `Ir.openLayoutEditor()`；失败提示「自定义生产单**布局编辑器**未就绪」 |
| 15 | ` 布局设置 ` | `ei` | `jr.openLayoutEditor()`；失败提示「自定义**生产单2组件**未就绪」（文案与 QL/PS 不统一） |
| 16 | ` 布局设置 ` | `mi` | `li.openLayoutEditor()`；失败提示「自定义**玻璃合片单组件**未就绪」 |

这些是「改版式」，与「改数据」的编辑弹窗是两套东西（新版已做）。

---

## 10. 未确认 / 需注意

1. **补**：`ProductionEdit` 第 1 列 `OrderID` 的 `width` 解码为 `150`（`_0x12cc[236]`）。
2. **未确认**：`ReceiptEdit` 表头里那个 number 字段的 label，以及「收货信息」区的完整字段名，未逐个解码（明细 7 列与 `客户/电话/日期/总价/定金/余款/单号/声明` 已确认）。
3. **INTERPRETED**：`8==ic||9==ic → mc` 这条的「`8` 走 `template.product2`、`9` 走 `template.product3`」依据是 `wc` 内部的两个 `if` 分支，以及 `Wc`(ic=8) 取 `template.product2`、`Oc`(ic=9) 取 `template.product3` —— 三处自洽，判 CONFIRMED 更稳妥，此处标 INTERPRETED 仅因没有单独跑运行时验证。
4. **发现（值得单独立项）**：`sc()`(421628) 把每两条合并成一条、第二条字段加 `1` 后缀，而被 `sc()` 处理的数组会**直接赋回 `uc`**（`Oc` 里 `uc.value = sc(uc.value)`）。也就是说 ic=9 时 `uc` 里存的是**合并后的行**，编辑弹窗（`ProductionEditOld` 的第二组列）看到的、以及后续打印/导出用的都是合并行。新版若照抄要注意这个副作用 —— 它把「每页 2 条」这个**打印排版设置**泄漏进了**数据模型**。
5. **发现（命名不一致，供新版统一）**：弹窗标题全部缺失（5 个编辑器都没 `title`）；ic=5 的 ` 编辑收据单 ` 打开的 `ReceiptEdit` 内部标题硬编码却是 `编辑回执单`。
