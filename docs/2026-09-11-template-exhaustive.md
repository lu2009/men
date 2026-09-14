# 模板穷举审计：**模板 JSON 到底控制了什么**（17 张，逐元素）

> 生成：2026-09-11。数据源 = 本机后端 `print_templates`（`docker exec smartdoor-db psql …`，同一份 `select mode, template from print_templates`，17 行）。
> 引擎 = `vue-plugin-hiprint@0.0.60`（`app/node_modules/vue-plugin-hiprint/dist/vue-plugin-hiprint.js`，下文所有「引擎行为」均在该 bundle 内定位到源码行后写出，非推测）。
> 本文只描述**模板 JSON 本身控制什么**；原版字段的**值**由 `Hui.vue` 的行构造器决定，不在本文范围（见 `2026-09-10-template-field-audit.md`）。
> 复核方式：`json.loads` 后逐元素逐属性遍历（脚本见 §附录 A），并用 `Hui.vue` 的 `extractTableColumns` / `templatePayload` 对照。

---

## 0. 一句话结论

模板 JSON 控制的**全部**是：**版式**（纸张尺寸/页边/页码/水印）、**元素清单与坐标**（谁的字段显示在哪个位置、多大字号、什么颜色）、**表格列集合**（哪些字段成为列、顺序、标题、宽度、对齐、以及**每列是否显示 / 以 text/image/qrcode 哪种形态渲染**）、**分页上限 `maxRows`**。
模板**不控制**任何「值怎么算」——同一字段在不同模板里值相同；同一张模板换数据就换值。
**17 张里没有任何一张用到 `formatter` / `rowspan>1` / `colspan>1` / `fixed:true`**；真正被用到、而我们实现层没显式处理的，是 `checked`、`tableTextType`、`maxRows`、`lHeight`（详见 §5）。

---

## 1. 模板 × 控制项 总表

纸面单位 = pt（hiprint 坐标）。「行字段」= 表格元素 `options.field` 所指数组的**逐行字段，按 `columns` 顺序**（✓=checked，✗=checked:false 隐藏）。

| 模板(mode) | 名称 | 面板 w×h / footer·header | 表元素 `field` | 行字段（按列序） | 表外元素（字段） | 静态文本 / 特殊 |
|---|---|---|---|---|---|---|
| `product` | 生产单 | 296.6×210 / 585·28.5 | `produces` | door, doorImg, OrderID, basicInfo, lockImg, doorsheet, doorframe, windows, remark | — | 静态「生产单」；`maxRows:4` |
| `product1` | 生产单1 | 296.6×210 / 585·7.5 | `produces` | client, OrderID, goods, color, doorSize, glassSize, lockway, thickness, sheetHeigth, sheetWidth, frameHeigth, frameWidth, kouWidth, kouHeigth, kouThickness, remark, **lockway✗** | — | 无表外元素 |
| `product2` | 生产单定制 | 197×140 / 382.5·7.5 | `oldSheet` | doorsheet, doorframe, windows, doorImg | material, size, glass, color, lockImg, lockway, client, address, qrcode, orderID, remark | `maxRows:2`、`orient:1` |
| `product3` | 生产单3 | **210×297** / 832.5·27 | `oldSheet` + `oldSheet1` | 同 product2 ×2 组（第 2 组 2 个空列✗） | material…remark **+ 全字段 `1` 后缀版**，doorImg/doorImg1 | 2×`hline`；双联版式 |
| `product4`…`product9` | 切料标签 / 生产单5…9 | 297×210 / 585·28.5 | `produces` | **与 `product` 逐字相同** | — | 静态「生产单」；**6 张字节级完全相同** |
| `glass` | 玻璃合片单 | 297×210 / 588·27 | `produces` | client, door, OrderID, basicInfo, lockImg, doorsheet, doorImg, remark | — | 静态「玻璃合片单」 |
| `glassHole` | 玻璃订单 | 297×210 / 589.5·28.5 | `glassInfoList` | OrderID, client, glassName, width, height, thickness, quantity, doorImg, remark | date | 静态「玻璃订单」；表格外 `date` 在**顶层对象** |
| `receipt` | 客户回执单 | 297×210 / 589.5·57 | `receipt` | profile2, direction, openImg, doorImg, glass, size, quantity, price, amount, pricing, remark | payQrcode, brand, date, orderNo, tel, address, productionDays, client, deposit, total, balance, declaration, orderQrcode, (静态「长按识别查单」), TotalBalance | `maxRows:7` |
| `FinalReceipt` | 收据单 | 197×140 / 390·7.5 | `receipt` | profile, direction, color, glass, size, quantity, price, amount, pricing, remark, **openImg✗** | brand, date, payQrcode, orderNo, address, tel, client, productionDays, deposit, balance, total, declaration, TotalBalance | 小票版式 |
| `ReceiptList` | 出货清单 | 297×210 / 589.5·52.5 | `receipt` | profile, **date**, direction, color, glass, size, quantity, price, amount, pricing, **payment**, remark | brand, client, deposit, balance, total, TotalBalance | — |
| `lable` | 标签 | 70×90 / 250.5·0 | —（无表） | — | orderID, qrcode, client, door, size, lockway, color, glass, address, remark, package | `paperNumberDisabled`；全部 `hideTitle:true` |
| `product10` | 生产标签 | 70×90 / 250.5·0 | —（无表） | — | orderID, client, size, lockway, color, glass, address, remark, GlassSize | `paperNumberDisabled`；全部 `hideTitle:true`；**无 qrcode / door / package** |

补充面板级（全部 17 张都有，值见 §附录 B）：`paperNumberTop` / `paperNumberLeft` / `paperNumberContinue:true` / `panelLayoutOptions:{layoutType:"column",…}`；14 张有 `rotate:true`（仅 `FinalReceipt` / `lable` / `product10` 没有）；2 张有 `paperNumberDisabled:true`（`lable` / `product10`）；1 张有 `orient:1`（`product2`）。

---

## 2. 元素类型与属性总清单

**元素类型分布（全 17 张合计 117 个元素）**：`text` 85、`image` 7、`table` 16、`qrcode` 5、`longText` 2、`hline` 2。
**没有** `vline`、`barcode`、`custom`、`html`、`tableCustom` 等类型。

### 2.1 表格元素（16 个）用到的 `options` 键

`field, columns, top/left/right/bottom/width/height/hCenter/vCenter（几何）, fontSize, textAlign, lineHeight, coordinateSync, widthHeightSync` +
`tableBodyRowHeight`(5)、`tableHeaderFontSize`(13)、`tableHeaderRowHeight`(1)、`tableHeaderFontWeight`(1)、`tableHeaderBorder`/`tableFooterBorder`/`tableBodyRowBorder`(3)、`tableHeaderCellBorder`(3)、`gridColumnsGutter`(3)、`maxRows`(4)、`lHeight`(3)、`fontFamily`(1，glassHole)。
> `maxRows` 由引擎用于**分页**（引擎源码 `…||this.options.maxRows&&y.length>+this.options.maxRows` → 满行强制翻页）。
> `lHeight` 是引擎的表内行高相关选项，`glass`/`glassHole`/`product3.oldSheet` 携带。

### 2.2 表格列（145 列）用到的键

`field, title, width, checked, colspan, rowspan, columnId, fixed`（全部列都有）+ `align`(11)、`halign`(12)、`tableSummary`(56)、`tableSummaryTitle`(53)、`tableTextType`(33)、`tableColumnHeight`(31)、`tableQRCodeLevel`(53)、`showCodeTitle`(9)。

- `align` / `halign`：**只有 11 列有 `align`、12 列有 `halign`**，其余列无对齐声明（引擎按默认）。注意两者**不同时出现**在同一列。
- `tableTextType` 取值只有 `"image"` / `"qrcode"` / `"text"` → **决定该列单元格按图片/二维码/文本渲染**。例：`glass.OrderID` 列 `tableTextType:"qrcode"`（单号在表内渲染成二维码）；`product1.client` 是 `"text"` 且带 `tableColumnHeight:"150"`（无实际影响）。
- `tableColumnHeight`：图片/二维码列的高度（pt 字符串，如 `"40"`/`"150"`/`"190"`）。
- `showCodeTitle`：9 列有（`glass.OrderID`、`product/product4-9.OrderID`、`product1.OrderID`），引擎里只作为列属性携带（设计器用途），实打无可见差异。
- `tableSummary` / `tableSummaryTitle`：全 17 张里**值全为空串**，且没有任何表定义 `tableSummaryText/Colspan/Align/NumFormat` → **汇总行功能未被使用**。

### 2.3 表外元素用到的 `options` 键

- 通用几何：`top/left/right/bottom/width/height/hCenter/vCenter/coordinateSync/widthHeightSync`。
- 内容：`field`、`title`、`testData`、`hideTitle`(27，text+qrcode)、`qid`(61)。
- 排版：`fontSize`、`fontWeight`(14)、`fontFamily`(20)、`color`(40，红字)、`lineHeight`、`textAlign`、`letterSpacing`(18)、`textContentWrap`(16)、`textContentVerticalAlign`(1)、`draggable`(3，designer 锁)。
- 类型专属：`qrcodeType`(5，全 `"qrcode"`)、`qrCodeLevel`(90)、`fit`(7，image，`"fill"` 或 `""`)、`borderWidth`(2，hline)。
- **`formatter` / `renderFormatter` / `styler` / `upperCase` / `format` / `dataType` 在所有 17 张里均不出现** → 模板层没有任何格式化逻辑。

### 2.4 ★ `field` / `title` / `hideTitle` 的精确语义（引擎源码实证）

引擎 `getText(title, value)`（bundle @352573 / @360214）：

```
field 存在  → ( !hideTitle && title ? title+"：" : "" ) + value
field 不存在 → formatter ? formatter(title,…) : title || ""
```

即：

| 情形 | 渲染结果 |
|---|---|
| 有 `field`，`hideTitle:true` | **只显示值**（如 `lable`/`product10` 全部元素） |
| 有 `field`，无 `hideTitle` | **`标题：值`**（如 `FinalReceipt.date` → `日期：2025-03-31`） |
| 无 `field`，有 `title` | **`title` 即静态文本**（`product`/`glass`/`product4-9` 的「生产单」「玻璃合片单」等标题） |

> 这解释了两类模板的写法差异：`lable`/`product10` 把「门类：」「尺寸：」这类前缀**写进了数据值**（见 testData），所以 `hideTitle:true` 只显示值也不会丢标签；`product2`/`product3` 则用 `title`（型材/尺寸/…）当标签，所以**没有** `hideTitle`。

### 2.5 `testData` 是**惰性**的（重要）

引擎取值（bundle @369929 text、@372343 qrcode、@268884 table）：

```
getData(data) = data ? (按 field 取值 || "") : (options.testData || …)
```

**只要调用方传了 data（我们 `printByJson(tpl, data)` 恒传），`testData` 永远不会被渲染**。
→ `testData` 对打印**无任何影响**，它的唯一价值是**记录旧版设计时的样例值**（反推真实数据形状/含义），见 §4。同理，若某字段我们没提供，引擎渲染**空白**而非 testData 占位。

---

## 3. 逐张模板

> 坐标略（见 §附录 A 的 dump 方法），这里只列**决定视觉输出的项**：表列（field→title，宽度 pt，对齐，checked，tableTextType）、表外元素（field / title / hideTitle / testData）、静态文本、面板几何与分页项。

### 3.1 `product`（生产单）
- 面板 296.6×210，`paperFooter 585`、`paperHeader 28.5`、页码 573/819、`rotate:true`。
- 表外：**1 个静态 text**（无 field，`title:"生产单"`，top 12/left 370.5，fontSize 13.5）。
- 表 `produces`（9 列，无 `textAlign` 之外的列对齐，`maxRows:4`，`lineHeight 22.25`）：

| # | field | title | width | 备注 |
|---|---|---|---|---|
|1|door|客户/门类|73.77||
|2|doorImg|门图|94.72|`tableTextType:"image"`, h=150|
|3|OrderID|单号|61.19|`tableTextType:"qrcode"`, h=50, showCodeTitle|
|4|basicInfo|订单信息|106.62||
|5|lockImg|方向|44.74|`tableTextType:"image"`, h=40|
|6|doorsheet|门扇|112.99||
|7|doorframe|外框|119.38||
|8|windows|亮窗/扣板|108.88||
|9|remark|备注|107.72||

### 3.2 `product4`–`product9`（切料标签 / 生产单5–9）
- **product4/5/6/7/8/9 六份 JSON 的 md5 完全相同**（`329208ad676cf3097704143dd68d4769`）。
- 与 `product` 的**唯一差异**：面板 297（vs 296.6）、表 `top 33/left 22.5/right 827.5/width 805/bottom 94/height 61`（vs 31.5/3/832.25/830/93/61.5）、各列 `width` 微调、`lineHeight 20.25`（vs 22.25）、**无 `maxRows`**（product 有 `maxRows:4`）、页码 571.5/820.5（vs 573/819）。
- **列集合 field+title+顺序逐字相同**（脚本验证 `True`），静态标题同为「生产单」。
- ⚠️ 语义提示：`product4` 的名字是「切料标签」，但**模板内容是一张不折不扣的生产单**（表 `produces`、列集合同 product）。旧系统 mode 4/11 可能喂标签行，但模板本身没为标签做过任何定制；6 张全部是同一份未定制的生产单。

### 3.3 `product1`（生产单1）
- 面板 296.6×210，footer 585，header **7.5**，`rotate:true`。**无任何表外元素**（既无静态标题也无字段文本）。
- 表 `produces` 17 列（16 ✓ + 1 ✗），全部 `width≈33–76`、`fontSize 12.75`、`lineHeight 14.25`：

`client/客户, OrderID/单号(qrcode,h50), goods/型材, color/颜色, doorSize/门洞尺寸, glassSize/玻璃尺寸, lockway/锁向, thickness/墙厚, sheetHeigth/光企高, sheetWidth/上下方, frameHeigth/门框高, frameWidth/门框宽, kouWidth/扣板宽, kouHeigth/扣板高, kouThickness/扣板厚, remark/备注, lockway/方向(✗隐藏)`
- **`lockway` 出现两次**：第 7 列「锁向」(✓)、第 17 列「方向」(✗)。同一字段两个标题，第二个被 `checked:false` 关掉——**列顺序/标题就是 JSON 顺序，含重复项**。

### 3.4 `glass`（玻璃合片单）
- 面板 297×210，footer **588**，header 27，`rotate:true`。静态 text「玻璃合片单」(top 10.5/left 369)。
- 表 `produces`（8 列，`fontSize 13.5`，`tableBodyRowHeight 36`，`lHeight 90`）：

`client/客户, door/门类, OrderID/单号(qrcode,h190), basicInfo/订单信息, lockImg/方向(image,h40), doorsheet/玻璃尺寸, doorImg/门图(image,h160), remark/备注`
- **同样 field=`produces`，列标题却与 product 不同**：`door`→「门类」(product 是「客户/门类」)、`doorsheet`→「玻璃尺寸」(product 是「门扇」)、且顺序为 client→door（product 是 door→…）。→ 模板层就能把同一数组渲染成不同单据，**但前提是数据形状也要匹配**（见 §4.2）。

### 3.5 `product2`（生产单定制）
- 面板 197×140，footer 382.5，header 7.5，`rotate:true`，**`orient:1`**（全 17 张唯一）。
- 表外 11 个元素（top 层字段，**行对象即顶层对象**）：
  `material/型材, size/尺寸, glass/玻璃, color/颜色, lockImg(图片), lockway/开向, client/客户, address/地址, qrcode(二维码), orderID/单号, remark/备注` — 都有 `title` 且**无 `hideTitle`**（会渲染成「型材：16*35推拉门」）。
- 表 `oldSheet` 4 列：`doorsheet/门扇, doorframe/外框, windows/亮窗/扣板, doorImg/门图(image,h150)`，`maxRows:2`，宽 541.5。

### 3.6 `product3`（生产单3，双联）
- 面板 **210×297（纵向）**，footer 832.5，header 27，`rotate:true`。
- **整套元素做了两份**：无后缀一份 + 全字段 `1` 后缀一份。共 26 个表外元素 + 2 个 `table` + 2 个 `hline` + 2 个大 `doorImg`(132×184.5)：
  - 第一份：`material/size/glass/color/lockImg(图片)/lockway/client/address/qrcode/orderID/remark`
  - 第二份：`size1/material1/lockImg1(图片)/glass1/color1/lockway1/client1/qrcode1/address1/orderID1/remark1`
  - 表格：`oldSheet`（4 列，`doorImg`✗隐藏）+ `oldSheet1`（**6 列** = 同 4 列 + 2 个 `field:""` 空列，全 ✗）
  - `hline`（top 31.5 / 418.5，`borderWidth:"1.5"`）作为两条单子的分隔线
- 颜色与其他模板不同：`material/size/color` 用 **`#fc0303` 红色**，其余 `#000000`。

### 3.7 `glassHole`（玻璃订单）
- 面板 297×210，footer 589.5，header 28.5，`rotate:true`，有 `watermarkOptions`（content 为空 → 不显示水印）。
- 表外：静态 text「玻璃订单」（**`fontWeight:"bold"`**）+ 文本 `date/订单日期`（top 层字段，**非表格行**）。
- 表 `glassInfoList`（9 列，`fontFamily:"Microsoft YaHei"`，`tableHeaderFontWeight:"bold"`，`lHeight 90`）：
  `OrderID/单号, client/客户, glassName/玻璃类别, width/宽度, height/高度, thickness/厚度, quantity/数量, doorImg/开孔图(image,h190), remark/备注`
- **此模板的 `date` 在表格外**，需 `{ date, glassInfoList:[…] }` 顶层形状（我们已用 `extra:{date}` 处理）。

### 3.8 `receipt`（客户回执单）
- 面板 297×210，footer 589.5，header **57**，`rotate:true`，`maxRows:7`。
- 表外 14 个会出值的元素 + 1 个静态：
  `payQrcode(图片,fit:fill,55×55), brand/客户回执单, date/日期, orderNo/编号, tel/电话, address/地址, productionDays/生产天数, client/客户, deposit/定金(#f50808), total/总价(#f50808), balance/余额(#f50808), declaration/温馨提示(longText 738×40), orderQrcode(二维码69×69), [无 field]"长按识别查单"(#fa1414,9.75), TotalBalance/总余额(#f50808)`
- 表 `receipt` 11 列：`profile2/型材, direction/开向, openImg/开向图(image), doorImg/门图(image,h120), glass/玻璃, size/尺寸, quantity/数量, price/单价, amount/金额, pricing/计价方式(align:left), remark/备注(align:left)`
- **注意列名是 `profile2`（不是 `profile`）且含 `doorImg`**——与 FinalReceipt/ReceiptList 不同。

### 3.9 `FinalReceipt`（收据单，小票）
- 面板 197×140，footer 390，header 7.5，**无 `rotate`**，有 `watermarkOptions`（空）。
- 表外：`brand/收据单, date/日期, payQrcode(图片,fit:fill,35×35), orderNo/编号, address/地址, tel/电话, client/客户, productionDays/生产天数, deposit/定金(#f50808), balance/余额(#f50808), total/总价(#f50808), declaration(longText), TotalBalance/总余额(#f50808)`
- 表 `receipt` 11 列（含 1 ✗）：`profile/型材, direction/开向, color/颜色, glass/玻璃, size/尺寸, quantity/数量, price/单价, amount/金额, pricing/计价方式(left), remark/备注(left), openImg/开向图(✗隐藏,image)`
- → 与 `receipt` 相比：用 `profile` 不用 `profile2`，有 `color` 无 `doorImg/openImg`（openImg 列存在但被关掉）。

### 3.10 `ReceiptList`（出货清单）
- 面板 297×210，footer 589.5，header 52.5，`rotate:true`。
- 表外：`brand/订货清单, client/客户, deposit/定金(#f50808), balance/余额(#f50808), total/总价(#f50808), TotalBalance/总余额(#f50808)`
- 表 `receipt` 12 列：`profile/型材, date/日期, direction/开向, color/颜色, glass/玻璃, size/尺寸, quantity/数量, price/单价, amount/金额, pricing/计价方式(left), payment/付款状态, remark/备注(left)`
- → **`date` / `payment` 两列只在 ReceiptList 出现**；原版行对象没有这两个键（`receiptPrintData` 也未提供）→ 引擎渲染为空串（引擎 `getData` 有 data 时缺失字段返回 `""`，不会回落到 testData）。**这是「与原版一致的空」，不是缺陷。**

### 3.11 `lable`（标签）
- 面板 **70×90**，footer 250.5，header 0，**`paperNumberDisabled:true`**，无 `rotate`。
- 11 个元素，**全部 `hideTitle:true`**，`letterSpacing:0.75`，`fontFamily:"STHeitiSC-Light"`，`textContentWrap` 多为 `ellipsis`（`door` 是 `clip`）：
  `orderID/单号, qrcode(二维码,50×50), client/客户, door/门类, size/尺寸, lockway/锁向, color/颜色, glass/玻璃, address/地址, remark/备注, package/文本`
- 因 `hideTitle:true`，标签上的「门类：」「尺寸：」等前缀**必须在数据值里**（testData 印证：`door` 样例值就是 `"门类："`）。

### 3.12 `product10`（生产标签）
- 面板 **70×90**，footer 250.5，header 0，`paperNumberDisabled:true`。
- 9 个元素，全 `hideTitle:true`，同款字体/字距：
  `orderID, client, size, lockway, color, glass, address, remark, GlassSize`
- 与 `lable` 相比：**无 `qrcode`、无 `door`、无 `package`，多了 `GlassSize`**。

---

## 4. `testData` 全文导出（旧版真实样例值）

> 提醒：§2.5 已证 `testData` 在真打印中不参与渲染；以下是**设计期样例**，用于验证字段语义。

**`product` / `product1` / `product4`–`product9` / `glass` / `glassHole`**：**没有任何 testData**（表外元素全是静态标题或无 testData 的图片）。

**`FinalReceipt`**
| field | testData |
|---|---|
|date|`"2025-03-31"`|
|orderNo|`"123465789"`|
|address|`"北京路"`|
|tel|`"1223456789"`|
|client|`"张三"`|
|productionDays|`"12"`|
|deposit|`"600"`|
|balance|`"600"`|
|total|`"12344565"`|
|TotalBalance|`"600"`|

**`ReceiptList`**：client `"张三"`、deposit `"600"`、balance `"600"`、total `"12344565"`、TotalBalance `"600"`

**`receipt`**：brand `"客户回执单"`、date `"2025-03-31"`、orderNo `"123465789"`、tel `"1223456789"`、address `"北京路"`、productionDays `"12"`、client `"张三"`、deposit `"600"`、total `"12344565"`、balance `"600"`、orderQrcode `"qrcode"`、**（无 field 的静态文本）`"长按识别查单"`**、TotalBalance `"0"`

**`lable`**
| field | testData |
|---|---|
|orderID|`"1234567"`|
|qrcode|`"22-25/09/05"`|
|client|`"张三门业"`|
|door|`"门类："`|
|size|`"尺寸："`|
|lockway|`"锁向："`|
|color|`"颜色："`|
|glass|`"玻璃："`|
|address|`"地址："`|
|remark|`"备注："`|
|package|`"4-1"`|

**`product10`**
| field | testData |
|---|---|
|orderID|`"1234567"`|
|client|`"张三门业"`|
|size|`"尺寸："`|
|lockway|`"锁向："`|
|color|`"颜色："`|
|glass|`"玻璃："`|
|address|`"地址："`|
|remark|`"备注："`|
|GlassSize|`"玻璃尺寸："`|

**`product2` / `product3`**
| field | testData |
|---|---|
|material|`"16*35推拉门"`|
|size|`"2000*1800*300*2500*3格"`|
|glass|`"普通长虹+超白长虹*4"`|
|color|`"月光灰"`|
|lockway|`"2轨2扇中左外"`|
|client|`"16*35推拉门"`|
|address|`"17-25/09/07"`|
|qrcode|`"qrcode"`|
|orderID|`"17-25/09/07"`|
|remark|`"加急"`|
|product3 追加|`size1/material1/glass1/color1/lockway1/client1/qrcode1/address1/orderID1/remark1` 同值；`qrcode1:"qrcode"`|

> 语义提示：`product2/3` 的 `client` 样例值等于 `material`（`"16*35推拉门"`），`address` 等于 `orderID`（`"17-25/09/07"`）——**设计器里是随手复制的占位值**，不代表字段语义（真实 `client` 仍是客户名），不要据此反推。

---

## 5. 特别问题

### 5.1 同一批 `produces` 数据配不同模板，差异从何而来？

**纯版式差异，数据完全同源：**只有 `product`、`product4`–`product9` 这 7 张真正共用 `productionProduces()` 的输出。其余两张虽然表 `field` 也叫 `produces`，但**列 schema 不同，需要截然不同的数据形状**：

| 模板 | 行字段集合 | 我们实际喂的数据 |
|---|---|---|
| `product` / `product4`–`product9` | door, doorImg, OrderID, basicInfo, lockImg, doorsheet, doorframe, windows, remark | `productionProduces()` |
| `product1` | client, OrderID, goods, color, doorSize, glassSize, lockway, thickness, sheetHeigth, sheetWidth, frameHeigth, frameWidth, kouWidth, kouHeigth, kouThickness, remark | `product1Produces()` |
| `glass` | client, door, OrderID, basicInfo, lockImg, doorsheet, doorImg, remark | `glassProduces()` |

→ **「同数据不同模板」只成立于 product / product4-9**；`product1`、`glass` 虽同字段名，实为三套不同 payload（我们的 `templatePayload` 目前靠 **mode 名**（`mode==='product1'` / `mode==='glass'`）区分，见 §6）。

对比 `glass` vs `product` 的同一字段不同呈现：
- `client`：glass 第 1 列「客户」；product 无此列（该信息并进 `door` 列）。
- `door`：glass 标题「门类」；product 标题「客户/门类」。
- `doorsheet`：glass 标题「玻璃尺寸」、列宽 124；product 标题「门扇」、列宽 113。
- 列顺序：glass 是 client→door→OrderID…；product 是 door→doorImg→OrderID…。

### 5.2 哪些模板是「同一数据源的不同版式」？

| 组 | 成员 | 关系 |
|---|---|---|
| A | `product` 与 `product4`–`product9` | 同列 schema（field+title+顺序逐字相同）。**product4–9 六张字节级完全相同**；`product` 仅几何/`maxRows:4` 不同 |
| B | `product2` 与 `product3` | 同表 schema（oldSheet 4 列相同）；product3 = product2 的**双联版**（第二份字段全加 `1`，多 `oldSheet1`/2 条 hline） |
| C | `receipt` / `FinalReceipt` / `ReceiptList` | 同表 field `receipt`，三套不同列集：<br>• receipt：`profile2` + openImg + doorImg（无 color/date/payment）<br>• FinalReceipt：`profile` + color（openImg 隐藏）<br>• ReceiptList：`profile` + date + color + payment |
| D | `lable` / `product10` | 同面板(70×90)、同字体样式、同 `hideTitle:true`；字段集不同（product10 无 qrcode/door/package，多 GlassSize） |
| E | `glass` / `glassHole` | 都属玻璃，但表 field 不同（produces vs glassInfoList），非同一版式 |

**`receipt` 组的逐字 diff：**

`receipt` 11 列：`profile2, direction, openImg, doorImg, glass, size, quantity, price, amount, pricing, remark`
`FinalReceipt` 11 列：`profile, direction, color, glass, size, quantity, price, amount, pricing, remark, openImg(✗)`
`ReceiptList` 12 列：`profile, date, direction, color, glass, size, quantity, price, amount, pricing, payment, remark`

→ 三张唯一的公共列是 `direction, glass, size, quantity, price, amount, pricing, remark`；`profile`/`profile2`、`color`、`date`、`payment`、`openImg`、`doorImg` 各有取舍。

### 5.3 列顺序 = JSON 里 `columns` 的顺序吗？

**是。** `columns` 是 `[[col, col, …]]`（单分组数组，全 16 张表都只有 1 个分组）。`extractTableColumns` 展开时**保序** `.map()`，实测输出顺序与 JSON 逐字一致（含 `product1` 的重复 `lockway`）。
⚠️ 唯一注意：`extractTableColumns` 遇到嵌套 `columns` 时**只取第 0 组**（`Array.isArray(cols[0])` 分支），且**不过滤 `checked:false`**（见 §6）。

### 5.4 有没有我们完全没用到 / 不知道的元素或属性？

按「模板里实际出现」统计：

| 属性 | 出现 | 引擎是否使用 | 我们 |
|---|---|---|---|
| `formatter` / `renderFormatter` / `styler` / `upperCase` / `format` / `dataType` | **0 次** | 支持 | ✅ 无需处理（模板没用到） |
| `rowspan` / `colspan` | 145 列都有，但**全为 1** | 支持合并 | ✅ 无合并 |
| `fixed` | 145 列都有，但**全为 false** | 支持 | ✅ 无固定列 |
| **`checked:false`** | **6 列**（FinalReceipt.openImg；product1.lockway/方向；product3.oldSheet.doorImg；product3.oldSheet1.doorImg + 2 空列） | 引擎 `rowColumns.filter(t=>t.checked)` 过滤表头+表体+宽度计算 | ⚠️ 渲染正确（模板原样交给 hiprint），但 `extractTableColumns` **不会**跳过隐藏列（见 §6） |
| **`tableTextType`** | 33 列（`image`/`qrcode`/`text`） | 决定单元格按图/码/文本渲染 | ✅ 引擎处理（我们没显式用，也没有额外逻辑需要） |
| `tableColumnHeight` | 31 列 | 图/码列高 | ✅ 引擎处理 |
| `maxRows` | 4 张表（product 4 / receipt 7 / product2·3 各 2） | **分页**：满 N 行强制翻页 | ✅ 引擎处理（模板自带） |
| `lHeight` | 3 张表（glass / glassHole / product3.oldSheet） | 引擎行高选项 | ✅ 引擎处理 |
| `paperNumberDisabled` | lable / product10 | 不打印页码 | ✅ 引擎处理 |
| `paperHeader/paperFooter/paperNumberTop/paperNumberLeft/paperNumberContinue` | 17 张全有 | 页边/页码 | ✅ 引擎处理 |
| `rotate` / `orient` | 14 张 / product2 | 纸向 | ✅ 引擎处理 |
| `watermarkOptions` | 5 张（FinalReceipt/glassHole/lable/product2/receipt），**content 均为空串** | 水印 | ✅ 无可见水印 |
| `panelLayoutOptions` | 17 张全有（`layoutType:"column"`），单面板 → 无效果 | 多面板分栏 | ✅ 无影响 |
| `testData` | 78 个 text/qrcode 元素 | **仅当未传 data 时**才用 | ⚠️ 我们从不读它；真打印走 data → 不影响渲染（§2.5） |
| `qid` | 61 个元素 | 设计器内部 id | ✅ 无渲染影响 |
| `coordinateSync` / `widthHeightSync` / `draggable` | 117 / 117 / 3 | 设计器 | ✅ 无渲染影响 |
| `editable` / `columnResizable` / `isEnable*` / `column*Editable` | 15 张模板的元素上有 | **设计器元数据**，无渲染影响 | ✅ 无影响 |
| `color` / `fontWeight` / `letterSpacing` / `fontFamily` / `textContentWrap` / `textContentVerticalAlign` / `fit` / `borderWidth` | 40/14/18/20/16/1/7/2 | 引擎样式 | ✅ 引擎处理 |
| `tableSummary`(56)/`tableSummaryTitle`(53)/`showCodeTitle`(9)/`tableQRCodeLevel`(53) | 见左 | summary 全空串；showCodeTitle 仅设计器 | ✅ 无可见影响 |

---

## 6. 与我们实现的差异清单（`app/src/views/Hui.vue` + `app/src/utils/printService.ts`）

我们的渲染路径 = **hiprint 真渲染**：`renderByMode/printByMode` → `new hiprint.PrintTemplate({template}).print(data)` / `getHtml(data)`，模板 JSON 原样交给引擎。因此**所有由模板控制的视觉项（坐标/字号/颜色/列/标题/宽度/checked/maxRows/页码/纸向）天然一致 ✅**。差异只可能出现在「我们喂什么数据」与「我们怎么解读模板」两处。

| # | 级别 | 位置 | 事实 | 影响 / 建议 |
|---|---|---|---|---|
| 1 | ⚠️ | `extractTableColumns`（Hui.vue:4102） | 过滤条件是 `typeof c==='object' && c?.field`，**不读 `checked`**。FinalReceipt 的 `openImg(✗)`、product1 的 `lockway/方向(✗)`、product3 的 `doorImg(✗)` 都会被返回 | 目前该函数**只被 `templatePayload` 用于 `.length` 判族**，返回多几列不影响结果。但一旦有人拿它当列源（比如恢复自绘表格），就会把隐藏列画出来。建议加 `&& c.checked !== false` |
| 2 | ⚠️ | `extractTableColumns` 同上 | 嵌套 `columns` 时**只展开第 0 组** | 现网 16 张表都只有 1 组 → 无影响；建议加断言/展平全部组 |
| 3 | ⚠️ | `templatePayload`（Hui.vue:4122） | `produces` 表按 **mode 名**分叉：`mode==='product1'`→`product1Produces`，`mode==='glass'`→`glassProduces`，其余→`productionProduces` | 若新增/改名一张 `produces` 表模板（例如把 `product4` 改名），会静默喂错数据形状（列大面积空白）。建议**按列特征判族**（如含 `goods`/`doorSize` → product1；含 `basicInfo` 且首列 `client` → glass）。product4–9 目前靠「不含 goods」落到 `productionProduces` 是对的 ✅ |
| 4 | ⚠️ | `templatePayload` 返回值 | 返回 `imgFields`，但两个调用点（4146 / 4189）`const { key, data, extra, wrap } = …` **丢弃了 `imgFields`** | 死代码。引擎按字段名自行取图，目前无功能影响；建议删掉或接上 |
| 5 | ✅ | product / product4–9 | 7 张共用 `productionProduces()`，列 schema 完全匹配（9/9 字段齐全） | 一致 |
| 6 | ✅ | product1 | `product1Produces()` 覆盖 16 个可见列 + 隐藏 `lockway`，字段齐全 | 一致 |
| 7 | ✅ | glass | `glassProduces()` 覆盖 8 列 | 一致 |
| 8 | ✅ | glassHole | `glassInfoProduces()` 覆盖 9 列；表外 `date` 通过 `extra:{date}` 提到顶层 + `wrap:true` → `[{date, glassInfoList}]`，与模板 `date` 在表外一致 | 一致 |
| 9 | ✅ | product2 / product3 | `oldSheetProduces(paired)`：product2 返回行对象数组（每行一页）；product3 `pairRows` 给第二行全字段加 `1` 后缀（含 `oldSheet1`、`doorImg1`）→ 与模板的双份字段/表一致 | 一致 |
| 10 | ✅ | receipt / FinalReceipt / ReceiptList | `receiptPrintData()` 同时提供 `profile`+`profile2`+`color`+`openImg`+`doorImg`，三张模板各取所需。ReceiptList 的 `date`/`payment` **不提供** → 引擎渲染空白，与旧版行对象无这两键一致 | 一致（注：`2026-09-10-template-field-audit.md` §9 第 8 条称「我们逐行填了日期与付款状态」，**与当前代码不符**，该条已过时） |
| 11 | ✅ | lable / product10 | `labelRows(kind)` 按 `mode==='product10'` 选 `product10Row`（含 `GlassSize`、无 `door/qrcode`），否则 `lableRow`（含 `door/qrcode/package`）；`hideTitle:true` 使前缀必须内嵌值 → 两个构造器都自带「门类:/尺寸:/颜色:」等前缀 | 一致（字段集与模板元素一一对应） |
| 12 | ⚠️ | lable 的 `door` 值 | 模板 testData 显示旧版样例值为 `"门类："`，而 `lableRow` 产出 `型材:{型材}` | **非缺陷**：`2026-09-10-template-field-audit.md` §7 已用原始 chunk 证实原版真值是 `型材:{型材}`，testData 只是设计器占位。记录以免被误判 |
| 13 | ✅ | 面板级全部属性 | `paperFooter/header/paperNumber*/rotate/orient/paperNumberDisabled/watermarkOptions/panelLayoutOptions/maxRows/lHeight` 全部在模板 JSON 内，原样传入引擎 | 一致 |
| 14 | ✅ | `formatter`/`rowspan`/`colspan`/`fixed` | 17 张模板 **0 处使用**（rowspan/colspan 恒 1、fixed 恒 false、无 formatter） | 无需实现 |

**净结论**：模板层没有任何「未实现」的渲染特性（formatter/合并/固定列/条件显示都不存在）；真正需要修的只有 **#1/#2/#3/#4 四处「我们读模板的方式」**，其中 **#3 是唯一有实际风险的一条**（mode 名硬编码分叉）。

---

## 附录 A：复核脚本

```bash
# 1) 取模板（本机无 psql，走 docker）
docker exec smartdoor-db psql -U smartdoor -d smartdoor -t -A \
  -c "select mode||E'\t'||template::text from print_templates" > /tmp/tpl.tsv
# 2) 拆成 /tmp/tpls/<mode>.json 后逐元素遍历（options 全键、columns 全列、checked/formatter/rowspan/colspan/fixed 扫描）
python3 - <<'PY'
import json,glob,os
for p in sorted(glob.glob('/tmp/tpls/*.json')):
    j=json.load(open(p))
    for pan in j['config']['panels']:
        for e in pan['printElements']:
            t=e['printElementType']['type']; o=e.get('options',{})
            # table: o['field'], o['columns'][0] 每列 field/title/width/align/checked/tableTextType
            # 其它: o['field'], o['title'], o.get('testData'), o.get('hideTitle')
PY
```

引擎行为定位（`app/node_modules/vue-plugin-hiprint/dist/vue-plugin-hiprint.js`）：
- `checked` 过滤：`rowColumns.filter(t=>t.checked)`（@77889 / @82929 / @86387）
- `hideTitle` / `field` 语义：`getText`（@352573 / @360214）
- `testData` 仅无 data 时使用：`getData`（@369929 text / @372343 qrcode / @268884 table）
- `maxRows` 分页：@265769
- `fit` → `object-fit`：@148609

## 附录 B：面板级参数全表

| mode | w×h | paperFooter | paperHeader | numTop | numLeft | rotate | orient | numDisabled | watermark |
|---|---|---|---|---|---|---|---|---|---|
| FinalReceipt | 197×140 | 390 | 7.5 | 373.5 | 538.5 | — | — | — | 有(空) |
| ReceiptList | 297×210 | 589.5 | 52.5 | 576 | 807 | ✓ | — | — | — |
| glass | 297×210 | 588 | 27 | 577.5 | 778.5 | ✓ | — | — | — |
| glassHole | 297×210 | 589.5 | 28.5 | 577.5 | 778.5 | ✓ | — | — | 有(空) |
| lable | 70×90 | 250.5 | 0 | 233 | 168 | — | — | ✓ | 有(空) |
| product | 296.6×210 | 585 | 28.5 | 573 | 819 | ✓ | — | — | — |
| product1 | 296.6×210 | 585 | 7.5 | 573 | 819 | ✓ | — | — | — |
| product10 | 70×90 | 250.5 | 0 | 233 | 168 | — | — | ✓ | — |
| product2 | 197×140 | 382.5 | 7.5 | 364.5 | 522 | ✓ | **1** | — | 有(空) |
| product3 | 210×297 | 832.5 | 27 | 573 | 819 | ✓ | — | — | — |
| product4–9 | 297×210 | 585 | 28.5 | 571.5 | 820.5 | ✓ | — | — | — |
| receipt | 297×210 | 589.5 | 57 | 576 | 807 | ✓ | — | — | 有(空) |

全部 17 张：`paperNumberContinue:true`、`panelLayoutOptions:{layoutType:"column",layoutRowGap:0,layoutColumnGap:0}`、`name:"1"`、`index:0`。
