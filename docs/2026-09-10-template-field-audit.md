# 打印模板逐字段审计（17 张模板）

日期：2026-09-10
范围：`app/src/views/Hui.vue` 的打印载荷构造 vs 旧版 `legacy/js/Hui-d088417c.js`（Hui 页原始 minified chunk）
结论格式：✅一致 / ⚠️部分差异 / ❌不符 / ❓无法判定

---

## 0. 方法与可信度说明（先读这一节）

### 0.1 真值来源：**必须用原始 chunk，不能用 `Hui.formatted.js`**

`legacy/js/Hui.formatted.js` 的文件头自己写明：

> 已替换所有本地解码器 _0xHEX(N)（含别名链）；组件内单字母解码器 a()/t()/x() 未处理。

也就是说：**单字母 accessor（`x(958)` 这类）没被动过，仍是真值入口**；而**被格式化器直接替换成字面量的字符串是错的**——它用了另一张串表。

反证（同一段代码）：

| 位置 | `Hui.formatted.js` | `Hui-d088417c.js` |
|---|---|---|
| 生产单 basicInfo 赋值 | `_0xcfde65["前框宽"]=...` | `_0xcfde65[_0x59f9e4(544)]=...`，`tokens[544]='basicInfo'` |
| 全文出现次数 | `前框宽` 出现 4 次 | `前框宽` 出现 **0 次** |

因此本报告的**真值全部取自 `legacy/js/Hui-d088417c.js`**（原始 minified，`_0xHEX(N)` 解码调用完整保留），用 `/tmp/huidrive/tokens.json` 解码。（工具：`/tmp/huidrive/orig.py`，按字节偏移定位并标注。）

### 0.2 tokens.json 的适用范围也有限

`Hui-d088417c.js` 里有**多个不同的本地解码器**（`_0x59f9e4`、`_0x11f592`、`_0x34750c`、`_0x5c0d14`、`_0x2938b1`、`_0xae1cd3` …）。**tokens.json 只等于 `_0x43b0d8` 这一张表。**

- 本文件里 `e=_0x43b0d8`(39 次)、`t=_0x43b0d8`(20)、`a=_0x43b0d8`(14)、`_0x59f9e4=_0x43b0d8`、`_0x11f592=_0x43b0d8`、`_0x34750c=_0x43b0d8` 等都在同一张表上 → 可靠。
- 但同一个 `(380)` 在不同解码器下含义不同（`_0x43b0d8` 下是 `registrant`，别的解码器下是 `replace`/`push`）。
  **凡本报告引用的证据，均已确认其解码器是 `_0x43b0d8` 的别名。**

### 0.2b 复核记录（每条结论的自证方式）

按"索引必须上下文自证"的要求，逐条复核如下。**自证方式**列说明为什么该解码可信。

| 区域（字节偏移） | 实际 accessor | 别名链 | 自证理由 |
|---|---|---|---|
| 回执行 ping 347366–352200 | `l`（349641 `l=r`，`r=_0x43b0d8`）/ `r` | `_0x43b0d8` ✅ | 对象字面量声明的键恰为 `profile,profile2,direction,openImg,price,color,glass,size,quantity,amount,pricing,remark,maker,doorImg`，而乱码成员访问解出的正是这 14 个名字，一一对应 |
| 回执行 diao 354000–358000 | `x`（`const x=r`） | `_0x43b0d8` ✅ | 同上；且 `x(1104)` 解出"单双丁"、`x(867)` 解出"套线单价"，与"哑口/垭口"、"元/米"拼接上下文互证 |
| 回执表头 358400–360560 | `r` | `_0x43b0d8` ✅ | `r(473)` 解"客户余额"紧跟在 `finance_getCustomerBalance` 响应 `.data[...]` 后；`r(682)` 解"回执单"紧跟 `"...客户"+` 之后 |
| 生产单行 466780 / 477842 | `_0x59f9e4` | `_0x43b0d8` ✅ | `_0x59f9e4(975)` 赋给含 `"<br>数量:"` 的拼接串 → doorsheet 列；`(544)` 赋给 basicInfo 列；与产线列名互证 |
| product2/3 平开行 534370 起 | `_0x5c0d14` | `_0x43b0d8` ✅ | `(819)` 解 "remark"，其值被 `.join("-")` 且随后接"加配："；`(1064)` 解 "边封数"，与 0/1/3/4/5→双丁墙…的映射互证 |
| product2/3 吊趟行 555011 起 | `_0x5c0d14` | `_0x43b0d8` ✅ | 同上；`(632)` 解 "oldSheet" 后跟 `[0][485]`（doorImg） |
| product1 行 568179 起 | `_` = `t` = `_0x34750c` | `_0x43b0d8` ✅ | 行对象字面量键 = 模板列全名（OrderID/client/goods/color/lockway/doorSize/…）；`_(1060)` 紧跟 `"门框高"===e&&l&&` 之后 → frameHeigth |
| lable 平开 367848 / 吊趟 369675 | `l` | `_0x43b0d8` ✅ | `l(1003)` 解 "套线种类" 用于 `"开向:"+套线种类+开向`；`l(845)` 解 "哑口套" 用于吊趟特判 |
| glassHole 411814–454100 | `_0x46841d` | `_0x43b0d8` ✅ | `(1144)` 出现在 `[备注,安装地址].filter(Boolean).join(...)` → 必为 `<br>`；`(485)` 被显式赋 `""` → doorImg |
| product10 / 玻璃 545000 起 | `_0x2938b1` | `_0x43b0d8` ✅ | `(1167)`/`(415)` 解 BoLiKuan/BoLiGao，与 `"GlassSize_"+x` 键名拼接互证 |
| 打印分发 589000+ | `se` | `_0x43b0d8` ✅ | `se(380)` 解 registrant、`se(521)` 解 template，与 `.template.product2` 取值互证 |

**与本报告不符、已按复核结果修正的项（见 §9 新增条目）：**

- ❌ 更正：product2/3 的 `remark` 原版分隔符是 **`"-"`**（534370 / 555011 明写 `.join("-")`），不是 `<br>`。加配追加用**空格**（`remark ? remark+" "+加配 : 加配`），也不是 `<br>`。
- ❌ 更正：glassHole 亮窗行 `glassName` 前缀是 **`亮窗底玻-`（token 1141）** 与 **`亮窗面璃-`（token 557，原文如此，"璃"不是"璃玻"）**，不是"亮窗玻璃-"；且是两条独立 `if`（`底玻!=="无" && !扇数.includes("活")` / `面玻!=="无"`）。
- ❌ 更正：glassHole 普通行 `glassName` 是 `扇数.includes("一固一活") ? "门玻-"(625)+面玻 : "面玻-"(1077)+面玻`，不是 `底玻-{底玻}`。
- ❌ 更正：引擎 A 的行（`_0xcfde65`/`_0x4d28ce`）**确实没有** `doorframe`/`windows` 键（已用"该行变量全部被赋值的键名集合"枚举验证）；但 `_0x1239ce`（引擎 C 平开）**是完整生产单行**，含 doorframe/windows/kou，此前被误判为"标签形态"。
- ❌ 更正：`_0x4495e3` 不是"标签形态行"，它就是 **product1 行**（键集 = product1 模板列全名）。
- ➕ 新增（原版有、报告此前遗漏）：glassHole 末尾 `glassInfoList.filter(e => 0 !== Number(e.thickness))` —— **厚度为 0 的行被丢弃**；且 `localStorage.smartdoor_sort_method === 'order'` 时按 `OrderID` 数字前缀排序。
- ✅ 复核通过：lable `size` 两种顺序（平开 吊脚→墙厚→亮窗总高 @367848；吊趟 墙厚→吊脚→亮窗总高 @369675）与我们实现一致；lable `remark` 分隔符确为 `<br>`。

### 0.3 原版打印入口只有 8 个 mode

`Hui-d088417c.js` 的打印开关（`_0x32a64c`，源码偏移 ≈ 590k）只认：

| radio | 模板 key | 载荷 | 标题 |
|---|---|---|---|
| 2 | `template.product` | `{produces: me}` | 生产单 |
| 8 | `template.product2` | `_0x290795()` | 生产单 |
| 9 | `template.product3` | `_0x290795()` | 生产单 |
| 1 | `template.glass` | `{produces: me}` | 玻璃合片单 |
| 3 | `template.glassHole` | `_0x164736` | 玻璃订单 |
| 4 | `template.lable` | `_0x46af77` | 标签 |
| 10 | `template.product10` | `_0x8c791d` | 标签 |
| 11 | `template.product4` | `_0x46af77` | 料标签 |

`me` 的定义（偏移 590k 附近）：`Object.entries(_0x4d19f5).sort(by produce.timestamp).map(([k,v])=>v.produce.data)`。

另外 **product1 有独立入口**（`template.product1` + `{produces: _0x3a843b}`，偏移 589121 / 588k），只是不在这 8 个 radio 里。
**DB 里 `product5`–`product9` 的 template JSON 与 `product4` 逐字节相同（md5 全等），且原版无对应分支** → 它们是死模板行，无独立语义。

### 0.4 载荷是"8 个不同的行构造器写进同一张表"

8 个构造器都以 `_0x4d19f5[KEY]={orderInfo, calculationResults, produce:{timestamp, data: ROW}}` 结尾：

| 偏移 | ROW 变量 | 用途 |
|---|---|---|
| 466942 | `_0xcfde65` | 生产单（平开） |
| 478052 | `_0x4d28ce` | 生产单（吊趟） |
| 498718 | `_0x551a25` | 生产单（平开·引擎B，含 doorframe/windows/kou） |
| 519154 | `_0x500ef9` | 生产单（吊趟·引擎B） |
| 537702 | `_0x34f4ac` | **product2/3 的 oldSheet 行（平开）** |
| 557251 | `_0x192067` | **product2/3 的 oldSheet 行（吊趟）** |
| 571741 | `_0x4495e3` | **product1 行**（键集 = product1 模板列全名） |
| 587754 | `_0x1239ce` | 生产单（引擎C，含 doorframe/windows/kou） |

因为 `_0x4d19f5` 在每次"计算"开头会被清空，**同一时刻只有一组行存在**。这意味着：用 product2/3 引擎算完后去打"生产单"，`door/basicInfo/doorsheet/doorframe/windows` 这些列会**整列为空**（oldSheet 行没有这些键）。我们目前对每行都填满 → 结构性偏差（见差异清单 #12）。

---

## 1. receipt / FinalReceipt / ReceiptList（回执三兄弟）

三张模板共用**同一个载荷对象** `_0xcf38c7`（原版 `preview('receipt',[_0xcf38c7])` / `commentPreview(template.receipt, [_0xcf38c7])`）。我们用 `receiptPrintData()` 统一供给三张，方向正确。

### 1.1 表头（散元素）

| 字段 | 原版真值（偏移 358400–360560） | 我们的实现（Hui.vue:3055+） | 判定 |
|---|---|---|---|
| `brand` | `(品牌 \|\| u.userinfo.registrant \|\| "客户") + "回执单"` — `_0x5220a4` 是**品牌输入框**（`Vue.ref("")`，由客户条目的 `brand`、新建客户返回的 `.brand`、导入订单的 `"品牌"` 赋值）；`userinfo.registrant` 是**门店名字符串**（同一变量在 `...param2=`+registrant 的 URL 拼接里用过） | `order.client_name \|\| tenantName \|\| '客户'` + 回执单 | ❌ 首选项错：应为**品牌**字段，不是客户名。（团队线索"客户名"有误） |
| `declaration` | `u.registrant?.declaration \|\| "含安装费"`（token 281 `declaration`、1114 `含安装费`）——注意是**顶层** `u.registrant` | `tenantDeclaration \|\| LEGACY_DECLARATION('含安装费')` | ✅ 一致 |
| `TotalBalance` | 仅当 `showTotalBalance` 开关开 **且** 客户编号非空：`GET https://www.samrtdoor.com.cn/1?param1=finance_getCustomerBalance&param2={ds}&param3={客户编号}` → `code===200 && (data[473='客户余额'] ?? "")`；否则 `""` | `total - deposit` | ❌ 语义完全不同（见 #4） |
| `date` | `_0x44ed1d(日期)` | `order.order_date \|\| today()` | ✅ |
| `orderNo` | `回执单号` | `order.receipt_no \|\| ''` | ✅ |
| `tel` | `(电话 ?? "") .toString()` | `order.phone \|\| ''` | ✅ |
| `address` | `安装地址字段非空 ? E : 地址字段`，其中 `E = [...new Set(各行安装地址)].join("_")` | `orderInstallAddress = order.install_address \|\| 行安装地址.join('、')` | ⚠️ 分隔符 `_` vs `、`；回退目标应是**地址**字段（`_0x27e38a`），我们回退到行聚合 |
| `productionDays` | 生产天数 | `order.production_days \|\| 0` | ✅ |
| `client` | 客户名 | `order.client_name \|\| ''` | ✅ |
| `deposit` | 定金 | `order.deposit` | ✅ |
| `total` | `B = Math.round(h)`，`h = Σ 行金额`（**整数**） | `round2(Σ amount)`（2 位小数） | ⚠️ 原版 total 是整数（见 #14） |
| `balance` | `B - 定金` | `total - deposit` | ✅ |
| `payQrcode` | `await getImage('qrcode') \|\| ""`（图片库里的收款码，token 472） | `''` | ❌ 永远为空 |
| `orderQrcode` | `https://www.samrtdoor.com.cn/login?param1={客户名}&param2={token}&receiptNo={回执单号}`，其中 `token = String(a)+"af"+String(x)+"wy"+String(now+888)`，`a = ds==='smartdoor' ? 1000 : Number(ds.split('smartdoor')[1])+1000`，`x = 7*客户编号+1987`；仅当客户名 && 客户编号 && userdata 都有 | `terminalLink`（`buildTerminalToken(client.id)`） | ❓ 形似但未逐项验证 token 公式 |
| `storeAddress` | `地址字段 \|\| ""` | — | ✅ 无模板引用 |
| `receipt` | 行数组（见下） | 行数组 | — |

### 1.2 行对象（回执行）

原版行对象键（两个分支都只有这些）：
`{profile, profile2, direction, openImg, price, color, glass, size, quantity, amount, pricing, remark, maker, doorImg, id}`

> **没有 `date`，也没有 `payment`。**

模板列对照：

- `receipt`：profile2, direction, openImg, doorImg, glass, size, quantity, price, amount, pricing, remark → 全部有值 ✅
- `FinalReceipt`：profile, direction, color, glass, size, quantity, price, amount, pricing, remark → 全部有值 ✅
- `ReceiptList`：profile, **date**, direction, color, glass, size, quantity, price, amount, pricing, **payment**, remark → **`date` 与 `payment` 在原版恒为空**。我们逐行填了 `date` 和 `payment` → ❌（见 #11）

逐字段规则（**平开**行，偏移 351058 起；**吊趟**行偏移 354000 起）：

| 字段 | 平开（ping_hui） | 吊趟（diao_hui） | 我们 | 判定 |
|---|---|---|---|---|
| `profile` | `型材` | 同 | `l.profile` | ✅ |
| `profile2` | `型材 + "<br>" + 颜色` | 同 | 同 | ✅ |
| `direction` | `套线种类 ? 套线种类+开向 : 开向` | **`开向`（无套线前缀）** | 同 | ✅ |
| `openImg` | `directionImageMap[getOriginalOpenDirection(开向)]` | `directionImageMap["" + 扇数 + 开向]` | `lineLockImage(l)` = `PING_DIRECTION_IMAGES[dir]` / `DIRECTION_IMAGES[fans+dir]` | ⚠️ 平开缺 `getOriginalOpenDirection()` 归一化 |
| `price` | `单价>0 ? 单价 : "/"` | 同 | 同 | ✅ |
| `color` | `颜色` | 同 | 同 | ✅ |
| `glass` | 见下 | 见下 | `glassSpecPrintable` | ⚠️ 见 #8 |
| `size` | 钻石/子母/普通 三分支 × `shouldUseNewSizeFormat(ds)`；`洞尺` 非空时前置 `洞尺+"<br>"` | 吊趟一套分支 × 新旧格式 | `dimSizeLabel` | ✅（逐字符比对新旧两套拼法一致） |
| `quantity` | `数量` | 同 | `l.quantity` | ✅ |
| `amount` | `Math.round(100*金额)/100` | 同 | 同 | ✅ |
| `pricing` | 见下 | 同 | `pricingDetail` | ⚠️ 见 #9 |
| `remark` | 见下 | 见下 | `receiptRemark` | ⚠️ 见 #7 |
| `maker` | `u.userinfo.name \|\| ""` | 同 | `currentUserName` | ✅ |
| `doorImg` | **仅** `图片ID` 非空且 `imageUrl` 有值时→`getImage(图片ID)`，并把图片登记为 `"doorImg"+z` | 同 | `l.image_url` | ⚠️ 来源不同，未验证等价 |

**glass 列（回执）** 原版顺序（两分支判定顺序一致，第三支不同）：

```
if (底玻==="无" && 面玻!=="无")  → 单玻:{面玻}                      （家家发门业/星之铝门窗 不加厚）
                                  否则 单玻:{面玻}*{玻璃厚}mm
else if (底玻==="无" && 面玻==="无") → "无"
else if (型材含"钻石")            → 固玻:{底玻}<br>门玻:{面玻}(*{厚}mm)
else if (玻璃厚 == 0)             → 背板:{底玻}<br>面板:{面玻}
else                             → 底玻:{底玻}<br>面玻:{面玻}(*{厚}mm)
```
我们的 `glassSpecPrintable` **判定顺序不同**（把"无底玻"判在前、把 `Number(thick)===0` 判在钻石之后是对的），且缺"家家发门业/星之铝门窗"特判 → ⚠️

**pricing 列**：`套` → `•{单价}元/套*{数量}={数量×单价}元`；`方` → `•{单价}元/方*{平方数.toFixed(3)}={round(100·平方·单价)/100 toFixed(3)}元`；再拼**套线金额**（`套线金额>0` 时，按 `套线种类` 是否含 `一高一宽/两高两宽/一高/一宽` 算长度 `(w+h+t)/1000 / (2w+2h+2t)/1000 / (h+t)/1000 / (w+t)/1000 / 默认(2h+w+2t)/1000`，`t` 取 `套线种类.split("-")[1]`），`数量===1` 用 ` ={套线金额}元`（等号前有空格），否则 `*{数量}={套线金额}元`；最后 `<br>•` + 加价项目（`\n`→`<br>•`）。
我们 `pricingDetail` **逐字符一致** ✅，**唯一差异**：`套` 分支我们没校验 `计价方式==='套'`，非 `方` 一律按 `套` 输出 → ⚠️（轻微）

**remark 列**（原版）：

```
平开: [打折:X折(仅 打折<1), 轨道种类, 五金, d(墙型), (订单安装地址为空 ? 行安装地址 : null), s(前后包加长), 备注]
      .filter(Boolean).join("<br>")
d = (边封数 != null && Number(边封数)!==2) ?
      0→"双丁墙" 1→"单丁墙" 3→"上丁墙" 4→"上丁加单丁" 5→"上丁加双丁" : null
s = [前包加长{v}, 后包加长{v}].filter(v>0).map(v=>{label}+v).join(" ") 或 null

吊趟: [打折:X折(仅 打折<1),
       X ? null : "扇数:"   + (型材含"+0" ? " 口袋门" : 扇数),
       X ? null : "轨道种类:" + (型材含"+0" ? " 口袋门" : 轨道种类),   ← 仅"打折"分支做这个替换
       X ? null : "轨道种类:" + 轨道种类,                              ← 非打折分支不做替换
       五金, c(=单双丁||null), (订单安装地址为空 ? 行安装地址 : null), 备注]
X = 型材含"哑口" || 型材含"垭口" || 开向==="无" || (单价===0 && 套线单价>0)
```

我们 `receiptRemark`（Hui.vue:2899）：结构、顺序、`X` 条件、`打折`、`单双丁`、`扇数:" 口袋门"` 都对 ✅，但：

1. **前后包加长分隔符**：原版 `" "`（空格），我们 `","` → ❌
2. **吊趟 `轨道种类:` 缺 `+0 → " 口袋门"` 替换**（打折分支）→ ❌
3. `wallTypeLabel` 对 `edge_seal_count == null` 会走 `Number(null)===0` → 误判成"双丁墙"；原版 `null != 边封数` 为 false → null → ⚠️

### 1.3 行顺序

原版构造前先排序：`按 formulaid.localeCompare`，相同再按 `颜色.localeCompare`；然后**先全部平开行、再全部吊趟行** push。
我们直接用 `lines.value.map(...)` → ⚠️ 顺序可能不同。

---

## 2. product / product4（+ product5–9）

两模板列完全相同：`door, doorImg, OrderID, basicInfo, lockImg, doorsheet, doorframe, windows, remark`。product5–9 与 product4 逐字节相同且无分支 → 无需独立实现 ✅。

| 列 | 原版真值 | 我们（`productionProduces` Hui.vue:3428） | 判定 |
|---|---|---|---|
| `door` | 引擎 A：`[型材,颜色].filter(Boolean).join("<br>")`（**不含客户**）；引擎 B/C：特判门店 `[型材,颜色]`，否则 `[客户,型材,颜色]` | `[client_name, profile, color].join('\n')` | ❌ 分隔符 `\n` 应 `<br>`；引擎 A 多出客户名 |
| `doorImg` | `图片ID ? getImage(图片ID) : ""` | `l.image_url \|\| ''` | ⚠️ 来源待确认 |
| `OrderID` | `单号 \|\| ""` | `order.receipt_no \|\| ''` | ✅ |
| `basicInfo` | 见下 | `basicInfoText`（3403） | ❌ 多处 |
| `lockImg` | 平开 `directionImageMap[getOriginalOpenDirection(开向)]`；吊趟 `directionImageMap[扇数+开向]` | `lineLockImage` | ⚠️ 平开缺归一化 |
| `doorsheet` | 引擎 A：`[{部件名}:{result}].join("<br>") + "<br>数量:" + qty`；引擎 B/C：`{名}:{结果}*{qty×数量}` | `partText`（固定 B/C 风格） | ❌ 按引擎分叉，见 #1 |
| `doorframe` | 引擎 A：**从不赋值 → `""`**；引擎 B（平开）：门框高→门框宽→前框→后框→门板，**无"套线名："**；引擎 B/C（吊趟）：主体 + `"<br>套线名：" + 套线种类 + "<br>" + 套线件` | `frameText`（恒加套线名） | ❌ 见 #6 |
| `windows` | 引擎 A：**从不赋值 → `""`**；引擎 B（平开）：扣板/上亮横/上亮窗玻璃/压线，**扣板厚作为独立行**；引擎 B/C（吊趟）：组1(槽\|封板高\|封板宽) + 组2(扣板) + 组3(玻璃) | `windowsPartText` | ❌/⚠️ 见 #9 |
| `remark` | 引擎 A：`[五金, 单双丁(≠正常), 备注, 安装地址]` + 加配 + 配件；引擎 B/C：平开 `[轨道种类,五金,安装地址,备注]`；吊趟 `[五金,单双丁,备注,安装地址]`，再追加墙型（`remark ? remark+"<br>"+墙型 : 墙型`）+ 加配 + 配件 | `produceRemark` | ❌ 见 #4/#5 |

**basicInfo 列**（`_0xcfde65`/`_0x4d28ce`/`_0x551a25`/`_0x500ef9`/`_0x1239ce`，偏移 466780 / 477842 / …）：

```
items = []
尺寸 = [门洞高,门洞宽,墙厚].filter(v => v && v!==0).join("*")
亮窗总高 && ≠0 → diamond ? "*{值}" : "亮窗高：{值}"
吊脚 && ≠0     → "吊脚：{值}"            ← 仅平开引擎有
洞尺非空       → items.unshift(""+洞尺)
玻璃段（[面玻,底玻,玻璃厚].filter(Boolean) 非空才算）：
  引擎A: 底无面有→"单玻*{面玻}*{厚}mm" / 双无→"无" / 否则"{面玻}+{底玻}*{厚}mm"
  引擎B: 底无面有→"单玻*{面玻}*{厚}mm" / 双无→"无玻璃" / 否则"{面玻}+{底玻}*{厚}mm"
  引擎C: 底无面有→"{面玻}*单玻"        / 双无→"无" / 否则"{面玻}+{底玻}*{厚}"（无 mm）
尾部 = "<br>" + (套线种类 ? 套线种类+开向 : 开向)          ← 平开
     或 (双无玻 ? "" : "<br>"+开向+"<br>"+扇数)           ← 吊趟
```

我们 `basicInfoText`：
1. 所有分隔符用 `\n`，原版 `<br>` → ❌
2. 底无面有分支写成 `${面玻}*单玻`，**缺 `*{厚}mm`**，且引擎 A/B 的顺序应是 `单玻*{面玻}*{厚}mm` → ❌
3. 双无分支固定"无玻璃"，引擎 A/C 应为"无" → ❌
4. 非双无分支一律不加 `mm`（引擎 A/B 要加）→ ❌
5. 吊趟尾部 = `[lineOpenLabel(l), l.fans]`，而 `lineOpenLabel` 对吊趟已返回 `扇数+开向` → **扇数重复**（如 `2双开内右\n2`），原版是 `开向` `<br>` `扇数` → ❌
6. `亮窗总高`/`吊脚` 判据用 `!==0`，原版是 `truthy && !==0` → ⚠️

**remark 列**：原版墙型分隔符是 `<br>`（`remark ? remark+"<br>"+墙型 : 墙型`），我们 `produceRemark` 用 `-` → ❌；另引擎 A 平开**没有轨道种类、没有墙型**，吊趟**没有墙型** → ❌

---

## 3. glass（玻璃合片单）

列：`client, door, OrderID, basicInfo, lockImg, doorsheet, doorImg, remark`。
**行对象与 product 完全同源**（同一个 `me` 数组、同一次 `Object.entries(_0x4d19f5)`）。

| 列 | 判定 | 说明 |
|---|---|---|
| `client` | ✅ | `客户 \|\| ""`（引擎 C/D 某些特判门店连 client 也只在特判时写）⚠️ |
| `door` | ⚠️ | 内容对引擎 A；分隔符 `\n` vs `<br>`；引擎 B/C 非特判门店原版含客户名 |
| `OrderID` | ✅ | |
| `basicInfo` | ❌ | 同 §2 |
| `lockImg` | ⚠️ | 同 §2 |
| `doorsheet` | ❌ | 我们 `glassProduces` 用"引擎 A"格式，但原版 product 与 glass 用**同一格式**（取决于引擎，不取决于模板）。我们按模板分叉 → 必有一端错（#1） |
| `doorImg` | ⚠️ | 同 §2 |
| `remark` | ❌ | 同 §2 |

`glassProduces` 的 doorsheet 数量：原版是"循环里最后一次命中的 `quantity`"并含特例（`parentSubsidiary`→`4×数量`、`diamond`→`3×数量`、`双活`→2、`一固一活`→1、玻璃件 ÷2），我们用 `Σquantity×数量` → 数值会不同 ❌

---

## 4. product2 / product3（生产单定制）

载荷：`_0x290795()` = `Object.entries(_0x4d19f5).sort(by timestamp).map(v=>v.produce.data)`，再 **仅当 mode 9(product3)** 过 `_0x1ebfe1`：

```js
for (i=0;i<len;i+=2){ a=e[i]; b=e[i+1]
  if(b){ c={...a}; Object.keys(b).forEach(k=>c[k+"1"]=b[k]); push(c) } else push(a) }
```
→ 与我们的 `pairRows` **逐字符等价** ✅（所有键加 `1` 后缀，`oldSheet`→`oldSheet1`，`doorImg`→`doorImg1`；奇数行原样）。
`mode==='product3'` 才配对的判断也与原版 `9===mode ? _0x1ebfe1(t) : t` 一致 ✅。

行键基座：`{client, material, qrcode, orderID, maker:userinfo.name, lockImg, lockway, color, glass, size, address, remark, quantity, doorImg, oldSheet:[{doorsheet,doorframe,windows,doorImg}]}`

| 字段 | 原版真值 | 我们（`oldSheetProduce` 3464） | 判定 |
|---|---|---|---|
| `client` | `客户 \|\| ""` | `order.client_name` | ✅ |
| `material` | `型材` | `l.profile` | ✅ |
| `qrcode` / `orderID` | `单号`（两者同值） | `String(receipt_no)` / `receipt_no` | ✅ |
| `color` | `颜色` | ✅ | ✅ |
| `address` | `安装地址` | `l.install_address` | ✅ |
| `quantity` | `数量 ?? ""` | ✅ | ✅ |
| `maker` | `userinfo.name` | `currentUserName` | ✅ |
| `lockImg` | 平开 `directionImageMap[getOriginalOpenDirection(开向)]`；吊趟 `directionImageMap[扇数+开向]` | `lineLockImage` | ⚠️ 平开缺归一化（风险低） |
| `lockway` | 平开：`套线种类 ? 套线种类+开向 : 开向`；吊趟：`型材含哑口套/门套 ? "" : 开向+扇数` | `lineOpenLabel(l)` | ⚠️ 平开缺套线前缀；吊趟缺"哑口套/门套→空"分支；且应用**原始开向**而非 `displayDirection` |
| `glass` | 平开：`底无面有→"{面玻}*单玻"`／`双无→"无"`／否则 `"{面玻}+{底玻}*{玻璃厚}"`；吊趟：前两支同，第三支 `"面:{面玻}-底:{底玻}"`（**不含厚**） | `[bottom,face].filter(Boolean).join('/')` | ❌ 语义完全不同 |
| `size` | 平开：`高*宽` + `亮窗高：{lw}`（diamond→`*{lw}`）+ `吊脚：{jiao}` + `洞尺` 前置；吊趟：`高*宽` + `总高{lw}*{n}格` + `洞尺` 前置（**无吊脚**） | `oldSheetSize`（只实现了吊趟形态） | ⚠️ 平开缺"吊脚："、亮窗文案不同 |
| `remark` | `[五金\|\|null, 单双丁(≠"正常")?单双丁:null, 备注].filter(Boolean).join("-")`；加配追加 `加配：{名字 join("-")}`（**空格**连接）；再按 边封数(≠null≠2) 追加墙型（`-` 连接） | `produceRemark(l)`（生产单规则） | ❌ 分隔符应为 `-` 不是 `<br>`；顺序、内容均不同 |
| `oldSheet.doorsheet` | 平开关键字 `[光企,方,龙骨横,龙骨竖,门扇高,门扇宽,收口,封边横,封边竖,玻璃高,玻璃宽]`（排除"上亮玻璃"）/钻石 `[左固玻璃,右固玻璃,门玻璃]`；吊趟 `[光企,勾企,合页,锁,收口,方,纱网,玻璃高,玻璃宽]`（排除"亮窗"）；格式 `{名}:{result}*{qty*数量}`；玻璃件在单玻且名字不含"单玻"时 `qty = round(qty/2)`；吊趟另有一固一活→1、双活→2 | `partText(pick('doorsheet'))` + `groupPart` 正则 | ⚠️ diao 基本吻合；ping 多出 `勾企/封板`；排除词应是"上亮玻璃"而非全部含"亮窗"；**完全缺 qty 修正** |
| `oldSheet.doorframe` | 平开：门框→前框(前框高+前包加长)→后框(后框高+后包加长)→门板，**无套线名**；吊趟：边封/下轨/上轨/滑/固定/移动/上横/盖板 + `"<br>套线名："+套线种类+"<br>"+包宽/包高件` | `frameText` 恒加"套线名：" | ❌ 平开凭空多出套线段；缺前/后框加长 |
| `oldSheet.windows` | 平开关键字 `[扣板,母门玻璃高,压线,封板,上亮窗玻璃]`（**不插扣板厚**）；吊趟三段 `(槽\|封板高\|封板宽)→扣板→玻璃`（扣板件取"扣板厚"部件的`门玻璃高`） | `windowsPartText` 对两行都插扣板厚.result | ⚠️ 中间值取值列不同；关键字集不同；分组顺序不同 |
| `oldSheet.doorImg` / 散图 `doorImg` | `图片ID ? getImage(图片ID) : ""` | `l.image_url` | ⚠️ 来源待确认 |

**product3 打印入口缺失**：原版有独立 mode 9 分支；我们只有"模板预览"能走到配对逻辑，没有独立打印按钮 → ⚠️（功能缺口）

---

## 5. product1（生产单1）

原版入口：源码偏移 589121 `commentPreview(registrant.template.product1, {produces: _0x3a843b})`，行由 `_0x4495e3`（偏移 568179）构造；行对象字面量键与模板列**完全一致**。

| 列 | 原版真值 | 我们（`product1Produces` 3523） | 判定 |
|---|---|---|---|
| `OrderID` / `client` / `goods` / `color` / `thickness` | `单号` / `客户` / `型材` / `颜色` / `墙厚` | 同 | ✅ |
| `lockway` | **`开向`（原始开向，无扇数）** | `lineOpenLabel(l)`（吊趟 = 扇数+开向） | ❌ |
| `doorSize` | `门洞高 + "x" + 门洞宽`；`吊脚>0` → `+"x"+吊脚`，**否则** `亮窗总高>0` → `+"x"+亮窗总高`；`数量>1` → `+"<br>数量:"+数量`；`洞尺` 非空 → `洞尺 + "<br>" + doorSize` | 基本一致，但 `洞尺` 用**空格**而非 `<br>`；且 `door_height && door_width` 都为真才输出 | ⚠️ |
| `glassSize` | `玻璃高 + "x" + 玻璃宽` | `${玻璃宽}x${玻璃高}` | ❌ 顺序反了 |
| `sheetHeigth` | `光企高` 的 result | `find(['光企高'])` | ✅ |
| `sheetWidth` | `上下方` 的 result，再 `封板宽>0` 时 `+"<br>封板宽"+封板宽` | 只有 `上下方` | ⚠️ 缺封板宽 |
| `frameHeigth` | `门框高`；`前框高` 命中 → `"前"+(前框高+前包加长)`；`后框高>0` → `+"<br>后"+后框高`（`_0x4495e3.sheetHeight` 的封板高写入是**拼错键名的死写**，可忽略） | 只有 `门框高` | ❌ |
| `frameWidth` | `门框宽`；`前框宽` → `"前"+前框宽`；`后框宽` → `+"<br>后"+后框宽` | 只有 `门框宽` | ❌ |
| `kouWidth` | `扣板宽`；**晟斐门窗厂** → `getImage(图片ID)` | `find(['扣板宽'])` | ⚠️ 缺门店特判 |
| `kouHeigth` | `扣板高`；**晟斐门窗厂** → `套线种类` | `find(['扣板高'])` | ⚠️ 缺门店特判 |
| `kouThickness` | `扣板厚` | ✅ | ✅ |
| `remark` | `[五金\|\|null, 单双丁(≠"正常")\|\|null, 备注, 安装地址].filter(Boolean).join("<br>")` + `加配：{加价项目原始数据里 name 非数字的项 join("-")}`；晟斐门窗厂 → 仅 `备注`；末尾还有 `_0xc8b731(row,…)` 追加 | `produceRemark(l)`（生产单规则：含轨道种类/墙型） | ❌ 用错了函数 |

---

## 6. glassHole（玻璃订单）

载荷：`_0x164736 = { date: _0x44ed1d(new Date), glassInfoList: [...] }`（重建于偏移 ~537k/…，使用于 mode 3）。
列：`OrderID, client, glassName, width, height, thickness, quantity, doorImg, remark` + 顶层 `date`。

| 字段 | 原版真值 | 我们（`glassInfoProduces` 3293） | 判定 |
|---|---|---|---|
| `date`（顶层） | `_0x44ed1d(new Date)` | `today()`（且**每行也塞了一份 `date`**） | ✅（多塞的 date 无模板引用） |
| `OrderID` | `单号 \|\| ""` | ✅ | ✅ |
| `client` | `客户` | ✅ | ✅ |
| `thickness` | `玻璃厚` | ✅ | ✅ |
| `width` / `height` | 命中部件的 `result`：亮窗玻璃宽/高、左固玻璃宽/高、右固玻璃宽/高、门玻璃宽/高、玻璃宽/高 | 同 | ✅ |
| `quantity`（亮窗） | 部件 `quantity × 数量` | 同 | ✅ |
| `quantity`（钻石） | `1 × 数量` | `l.quantity` | ✅ |
| `quantity`（普通） | 部件名含"单玻" → `qty×数量`；否则 `qty/2×数量`；**双玻且存在开孔图时** `qty×数量/2` 或 `qty/4×数量`，并按开向输出 **1–2 行** | `single = 底玻/面玻有"无"` → `qty×数量`，否则 `qty/2×数量`，**恒 1 行** | ⚠️ 判据与折半次数不同；双开时行数少一行 |
| `glassName`（亮窗） | **两条独立 if**：`底玻!=="无" && !扇数.includes("活")` → `亮窗底玻-{底玻}`（token 1141）；`面玻!=="无"` → `扇数.includes("活") ? "亮窗玻璃-{面玻}" : "亮窗面璃-{面玻}"`（token 557，原文如此） | 单条 if，前缀恒为 `亮窗玻璃-` | ❌ 前缀错、条件错、行数少 |
| `glassName`（钻石） | `左固玻璃-{底玻}` / `右固玻璃-{底玻}` / `门玻璃-{面玻}` | 同 | ✅ |
| `glassName`（普通） | `扇数.includes("一固一活") ? "门玻-"(625)+{面玻} : "面玻-"(1077)+{面玻}`（另有 `parentSubsidiary`/双活等前置于分支） | 统一 `底玻!=="无" ? 底玻-底玻 : 面玻-面玻` | ❌ 前缀与条件均不同；**子母分支完全未实现** |
| `doorImg` | **亮窗行恒 `""`**；左固=`左固玻图`、右固=`右固玻图`；门玻璃/普通 = `挖孔图 formularID + 开向 (+ 轨道种类)`，开向左右互换时换另一张 | `holeImageOf(l)` 按 `direction` 匹配公式图片，**所有行都填** | ❌ 亮窗行应置空；取图机制不同 |
| `remark` | `_0xa370fc ? "" : [备注, 安装地址].filter(Boolean).join("<br>")` | `.join('\n')` | ❌ 分隔符错；缺 `_0xa370fc` 置空开关 |

---

## 7. lable（标签）

列：`orderID, qrcode, client, door, size, lockway, color, glass, address, remark, package`。

| 字段 | 原版真值 | 我们（`lableRow` 3141） | 判定 |
|---|---|---|---|
| `orderID` | `单号` | `receipt_no` | ✅ |
| `qrcode` | `String(单号)` | 同 | ✅ |
| `client` | `客户` | ✅ | ✅ |
| `door` | `型材:{型材}` | 同 | ✅ |
| `size` | `尺寸:{门洞高}*{门洞宽}`；平开追加顺序 **吊脚→墙厚→亮窗总高**；吊趟 **墙厚→吊脚→亮窗总高** | 同（顺序已区分） | ✅ |
| `lockway` | 平开 `套线种类非空 → 开向:{套线种类}{开向}`，否则 `开向:{开向}`；吊趟 `开向:{扇数}{开向}`，型材含哑口套/门套 → `开向:{开向}` | 同 | ✅ |
| `color` | `颜色:{颜色}` | 同 | ✅ |
| `glass` | `玻璃:{底玻}-{面玻}` | 同 | ✅ |
| `address` | `地址:{安装地址}` | 同 | ✅ |
| `remark` | `[五金\|\|null, 备注?"备注:"+备注:null].filter(Boolean).join("<br>")` | `.join('\n')` | ❌ 分隔符 |
| `package` | `{份数}-{序号}` | 同，且 `labelQuantity` 算法一致 | ✅ |

**product4（料标签，mode 11）未实现**：原版 `_0xff5572` 每个门类行固定 **4 张**（`t=4`），平开 `size` **无吊脚**（仅 墙厚→亮窗总高）、`lockway` **无"开向:"前缀**（`套线种类?套线种类+开向:开向`）、`remark` 仅 `"备注:"+备注`；吊趟 `lockway = 扇数+开向`。我们的 `templatePayload` 按模板字段族路由，`product4Template` 命中 `produces` 表 → 返回 `productionProduces()`（生产单版式），与旧版塞进去的标签行形状不符 → ❌（`printByMode('product4')` 也没实现）

---

## 8. product10（生产标签）

列：`orderID, client, size, lockway, color, glass, address, remark, GlassSize`（**全部无前缀**）。

| 字段 | 原版真值 | 我们（`product10Row` 3171） | 判定 |
|---|---|---|---|
| `orderID` / `client` | `单号` / `客户` | ✅ | ✅ |
| `size` | 平开 `{门洞高}*{门洞宽}` + 吊脚→墙厚→亮窗总高；**吊趟仅 `亮窗总高>0` 时追加 `*{亮窗总高}`** | 平开/吊趟都用 `[吊脚, 墙厚, 亮窗总高]` | ⚠️ 吊趟多加了吊脚/墙厚 |
| `lockway` | `套线种类!=="" ? 套线种类+开向 : 开向` | 同 | ✅ |
| `color` / `address` / `remark` | `颜色` / `安装地址` / `备注` | 同 | ✅ |
| `glass` | `底玻==="无" → 单玻:{面玻}`，否则 `底:{底玻}-面:{面玻}` | 同 | ✅ |
| `GlassSize` | 由算料部件 **`BoLiKuan*` × `BoLiGao*`** 配对：`BoLiKuan.split("*")[0] + "*" + BoLiGao.split("*")[0] + "*" + parseInt(BoLiGao.split("*")[1]\|\|1)`，再统一截断为前两段（宽*高） | `glassSpecText(l)` → `单玻:x` / `底/面` | ❌ 语义完全不同 |

---

## 9. ❌/⚠️ 差异清单（按严重程度）

> ⚠️ **本表为早期轮次的历史留档，标记已滞后。**
> **权威状态见 §55「triage 结果（2026-09-14）」** —— 逐条对照当前代码重新判定：
> 38 条中 **31 条已修**、**2 条经复核作废**（#31、#38）、剩 **4 条仍存在 + 1 条待决策**。

| # | 级别 | 位置 | 原版规则 | 我们的写法 | 建议改法 |
|---|---|---|---|---|---|
| 1 | ❌ | **doorsheet 按模板分叉**（product vs glass） | product 与 glass 取**同一个 `me` 数组、同一批行对象**，格式只随"引擎"变：引擎A `{名}:{result}` + `<br>数量:{qty}`，引擎B/C `{名}:{result}*{qty×数量}` | `productionProduces` 固定 B/C 格式；`glassProduces` 固定 A 格式 | 抽成同一个 `doorsheetText(row, engine)`，**不要按模板分叉**；至少两模板共用同一函数 |
| 2 | ❌ | **product1Product1 / product2/3 的 `glass`** | 三分支：`底无面有→"{面玻}*单玻"`、`双无→"无"`、否则 product2/3 平开 `"{面玻}+{底玻}*{厚}"`、product2/3 吊趟 `"面:{面玻}-底:{底玻}"` | product1 无此列；product2/3 用 `[bottom,face].join('/')` | 按 ping/diao 实现三态拼接 |
| 3 | ❌ | **basicInfo 分隔符与玻璃段**（productionProduces） | 全部 `<br>`；引擎A/B `单玻*{面玻}*{厚}mm`；引擎C `{面玻}*单玻`（无 mm）；双无 引擎A/C=`无`、引擎B=`无玻璃` | 全部 `\n`；`{面玻}*单玻`；双无恒 `无玻璃` | 分隔符改 `<br>`；按引擎实现三条分支 |
| 4 | ❌ | **basicInfo 吊趟尾部** | `开向 + "<br>" + 扇数` | `[lineOpenLabel(l), l.fans]` → 输出 `2双开内右\n2`（扇数重复） | 改成 `[displayDirection(direction), l.fans]`（用原始开向） |
| 5 | ❌ | **回执 `brand`** | `(品牌 \|\| 门店名 \|\| "客户") + "回执单"` | `${client_name \|\| tenantName \|\| '客户'}回执单` | 首项换 `order.brand`（团队线索写"客户名"是错的） |
| 6 | ❌ | **回执 `TotalBalance`** | 开关开启且有客户编号时服务端拉取 `finance_getCustomerBalance` → `data.客户余额`；否则 `""` | `total - deposit` | 接财务接口；没有就固定 `""`（不要用 total-deposit 冒充） |
| 7 | ❌ | **回执 `payQrcode`** | `await getImage('qrcode') \|\| ""` | `''` | 取图片库收款码 |
| 8 | ❌ | **回执行 `date` / `payment`（ReceiptList）** | 行对象**没有**这两个键 → 原版渲染**空白** | 逐行填了日期与付款状态 | 保持空白，或确认业务上确实要填（当前是"比原版多"） |
| 9 | ❌ | **回执 `remark` 前后包加长分隔符** | `[前包加长{v}, 后包加长{v}].join(" ")` | `.join(',')` | 改空格 |
| 10 | ❌ | **回执 `remark` 吊趟轨道种类** | 打折分支：`轨道种类:` + `(型材含"+0" ? " 口袋门" : 轨道种类)` | 恒 `轨道种类:{l.track}` | 补 `+0 → " 口袋门"` 替换（**仅打折分支**） |
| 11 | ❌ | **receipt 列 `pricing` 套线/加价** | 见 §1.2 | `pricingDetail` 逐字符一致 | ✅ 无需改；只需补 `计价方式==='套'` 校验（非方一律按套输出是错的） |
| 12 | ❌ | **product remark 墙型分隔符** | 引擎B 平开：`remark ? remark+"<br>"+墙型 : 墙型`（**正常生产单走这条**，见 §12） | `${base}-${wall}` | 改 `<br>` |
| 13 | ❌ | **product remark 引擎 A/B** | 引擎B（**正常生产单**）平开 `[轨道种类,五金,安装地址,备注]`+加配+**墙型(`<br>`)**；吊趟 `[五金,单双丁,备注,安装地址]`+加配，**无墙型**。引擎A（仅玻璃合片单）平开 `[五金,单双丁,备注,安装地址]`，无轨道种类无墙型 | 平开恒加轨道种类+墙型（分隔符 `-`）；**吊趟恒加墙型** | 分隔符改 `<br>`；**吊趟去掉墙型**；引擎A 分支去掉轨道种类/墙型（见 §12） |
| 14 | ❌ | **`glass` 模板的 doorframe/windows（引擎A 行）** | 引擎A **只写** doorsheet/basicInfo/door/remark/lockImg/OrderID/client/doorImg；`doorframe`、`windows` 保持 `""`。**注意：这只影响 `glass` 模板；生产单走引擎B，两列有值**（§12.5-2） | 逐行全填 | product 与 glass 分开取数 |
| 15 | ❌ | **product1 `remark`** | `[五金, 单双丁(≠正常), 备注, 安装地址]` + `加配：…`；晟斐门窗厂仅 `备注` | 复用了生产单的 `produceRemark` | 单写一份 product1 remark |
| 16 | ❌ | **product1 `lockway`** | `开向`（原始开向，**无扇数**） | `lineOpenLabel`（吊趟含扇数） | 改 `l.direction` |
| 17 | ❌ | **product1 `glassSize`** | `玻璃高 x 玻璃宽` | `玻璃宽 x 玻璃高` | 交换顺序 |
| 18 | ❌ | **product1 `frameHeigth` / `frameWidth`** | 门框高/宽 + `前框高+前包加长`/`前框宽`（前缀"前"）+ `后框高`/`后框宽`（`<br>后` 追加） | 只取 `门框高`/`门框宽` | 补前后框拼接 |
| 19 | ❌ | **lable `remark` 分隔符** | `join("<br>")` | `.join('\n')` | 改 `<br>` |
| 20 | ❌ | **glassHole `remark` 分隔符** | `join("<br>")`（且 `_0xa370fc` 时整列为空） | `.join('\n')` | 改 `<br>`；补置空开关 |
| 21 | ❌ | **glassHole `doorImg` 亮窗行** | 恒 `""` | 给了公式图 | 亮窗行置空 |
| 22 | ❌ | **glassHole 子母玻璃分支** | 子母 → 出"子门玻璃/母门玻璃"两行，均 `面玻-面玻` | 完全未实现 | 补分支 |
| 23 | ❌ | **product10 `GlassSize`** | `BoLiKuan*` × `BoLiGao*` 部件配对 → `宽*高` | `glassSpecText` → `单玻:x` | 改为部件配对 |
| 24 | ❌ | **mode 11（product4 料标签）未实现** | 每行固定 4 张；无"开向:"前缀；remark 仅 `备注:` | 无该出口，且被路由到 `productionProduces()` | 需单独实现（先确认模板归属） |
| 25 | ⚠️ | **product2/3 `size`** | 平开 `亮窗高：{lw}`（diamond `*{lw}`）+ `吊脚：{jiao}`；吊趟 `总高{lw}*{n}格` | 只实现了吊趟形态 | 按 ping/diao 分叉 |
| 26 | ⚠️ | **product2/3 `lockway`** | 平开带套线种类前缀；吊趟 哑口套/门套 → 空；打印用**原始开向** | `lineOpenLabel` | 按上改造 |
| 27 | ⚠️ | **doorsheet 数量修正** | 玻璃件单玻 ÷2；`一固一活→1`、`双活→2`；`parentSubsidiary→4×数量`；`diamond→3×数量` | 统一 `p.quantity*l.quantity` | 补修正规则 |
| 28 | ⚠️ | **product1 `sheetWidth` / `kouWidth` / `kouHeigth`** | `sheetWidth` 追加 `封板宽`；晟斐门窗厂 `kouWidth=图片`、`kouHeigth=套线种类` | 只取基础部件 | 补追加与门店特判 |
| 29 | ⚠️ | **回执 `total` 取整** | `Math.round(Σ行金额)`（整数） | `round2(...)`（2 位小数） | 确认是否要取整 |
| 30 | ⚠️ | **回执行 `openImg` 平开** | `getOriginalOpenDirection(开向)` 归一化后查图 | 直接用 `l.direction` | 接 `getOriginalOpenDirection` |
| 31 | ⚠️ | **回执行顺序** | 先按 `formulaid`、再按 `颜色` localeCompare 排序；平开行整体在吊趟行之前 | `lines.value` 原序 | 补排序 |
| 32 | ⚠️ | **回执 `address`** | `安装地址字段非空 ? 各行安装地址去重 join("_") : 地址字段` | `order.install_address \|\| 行.join('、')` | 补回退与分隔符 |
| 33 | ⚠️ | **product2/3 无独立打印入口** | 原版 mode 9 有独立分支 | 只有模板预览能配对 | 补 `printByMode('product3', oldSheetProduces(true))` |
| 34 | ⚠️ | **wallTypeLabel(null)** | `边封数 == null` → null | `Number(null)===0` → "双丁墙" | 加 `== null` 早退 |
| 35 | ❌ | **product2/3 `remark` 分隔符**（复核更正） | `[五金, 单双丁(≠正常), 备注].filter(Boolean).join("-")`；加配用**空格**连接；墙型 `-` 追加 | 复用 `produceRemark`（`<br>` 连接 + 轨道种类/安装地址） | 单写 product2/3 的 remark：`join("-")` + 空格加配 + `-` 墙型 |
| 36 | ❌ | **glassHole 丢弃厚度为 0 的行**（复核新增） | 末尾 `glassInfoList.filter(e => 0 !== Number(e.thickness))` | 无过滤，厚度 0 的行照样输出 | 补 filter |
| 37 | ⚠️ | **glassHole 排序**（复核新增） | `localStorage.smartdoor_sort_method === 'order'` 时按 `OrderID` 数字前缀排序 | 按 `lines.value` 原序 | 补排序 |
| 38 | ❌ | **glassHole 亮窗 `glassName` 前缀**（复核更正） | `亮窗底玻-{底玻}`(1141) / `亮窗面璃-{面玻}`(557)，两条独立 if，最多两行 | 单行、前缀恒 `亮窗玻璃-` | 按原文前缀与条件实现 |

---

## 10. 未解码 / 无法判定

- **`payQrcode` / `orderQrcode` 的图片与 token 公式**：`orderQrcode` 的 `a/x/now+888` 公式已读出，但我们的 `terminalLink` 后端实现是否等价未逐项验证。
- **`doorImg` 来源等价性**：原版是 `getImage(图片ID)`；我们的 `l.image_url` 是否同源，需对照后端字段。
- **`_0xc8b731(row, …)`**：product1/生产单 remark 末尾的"配件"追加，函数体未展开。
- **8 个行构造器分别对应哪个业务入口**：已确认它们的 ROW 键集不同（product1 行有 `doorSize/kouWidth/…`；oldSheet 行有 `oldSheet`；生产单行有 `door/basicInfo/doorsheet/…`），但"用户在什么条件下会落到哪个构造器"未完全确定 → 影响差异 #12/#14 的**实际触发面**。
- **hiprint 对数组值的渲染**：product2/3 的 `size` 原版赋的是**数组**，我们返回 `<br>` 字符串；渲染差异未验证。
- **`_0x2ffe36`（showTotalBalance 开关）在本系统的对应物**：后端 `tenants` 表暂无该字段。

### 10.1 已降级为「未确认」的条目（只靠索引对表、未做上下文自证的）

以下条目来自并行审计、**未通过本次上下文自证复核**，请勿据其改代码：

| 原报告条目 | 降级原因 |
|---|---|
| glassHole `quantity` 普通行「部件名含"单玻"→qty×数量，否则 qty/2×数量」及「双玻+开孔图 → qty×数量/2 / qty/4×数量，输出 1–2 行」 | 该分支在 411814–454100 内共 40+ 个分支，我只验证了亮窗两条与末尾 filter；普通/子母/double 三支的 quantity 公式**未逐条自证** → 未确认 |
| glassHole `doorImg`「挖孔图 formularID + 开向(+轨道种类)」的取图机制 | 原版确有 `_0x2e5408`/`_0x51ee96` 两张图按开向左右互换，但与我们 `holeImageOf` 的等价性未验证 → 未确认 |
| 生产单 `windows` 吊趟「扣板件的中间值取"扣板厚"部件的 `门玻璃高` 列」 | 该表述源自被污染文件的反查；原版只确认扣板件写的是 `{名}:{result}*{中间值}*{数量}`，**中间值取自哪一列未自证** → 未确认 |
| 生产单引擎 B/C 的 `doorframe`/`windows`/`remark` 的具体拼接分支 | 已确认键集与大致结构，但分支内文案（如"套线名："的拼法、扣板厚是否独立成行）**未逐条自证** → 未确认 |
| lable/product10 的 `package`（份数）大链 `折叠N扇` 乘数 | 已读到该链（367k 附近），我们 `labelQuantity` 与之形似，但**未逐项比对每个折叠分支** → 未确认 |
| 引擎 A/B/C 分别对应哪个业务入口 | 未确定（见上一条） |

**已通过复核、可以据以改代码的**：§0.2b 表中列出的全部区域 + §9 中标注"复核更正/复核新增"的条目。

---

## 11. 复核更正与处置（team-lead 用原始 chunk 逐条自验，2026-09-10）

审计中几条结论经原始 chunk 复核后**需要更正**，避免照单改错：

| 审计条目 | 审计结论 | 复核结论 | 证据 |
|---|---|---|---|
| #12 product remark 墙型分隔符 | `<br>` | **分路径**：produces 行（product/glass）确为 `<br>`；**product2/3 的 oldSheet 行是 `-`** | `_0x551a25` @495101+ 用 `remark+"<br>"+e`；`_0x192067` @554700 用 `remark+"-"+e` |
| §1.2 remark 前后包加长分隔符 | `join(" ")` | **`join(" ")` 正确**（我一度误读为数组 String() 化，已改回空格） | `_0x348bfb` @347104：`a.length>0 ? a.join(" ") : null` |
| §1.2 remark 吊趟轨道种类 `+0→口袋门` | 仅打折分支替换 | **正确** | 已按此修正 `receiptRemark` |
| #3 basicInfo 分隔符 | 应 `<br>` | **正确**（我们原来用 `\n`，hiprint 不会把 `\n` 渲染成换行） | `_0x551a25` @498413 / `_0x500ef9` @518899 均 `.join("<br>")` |
| #4 basicInfo 吊趟尾部扇数重复 | 正确 | **正确** | `_0x500ef9`：`开向+"<br>"+扇数`，且型材含哑口套/门套时尾部整体省略 |
| §2 basicInfo 玻璃段 | 引擎A/B `单玻*{面玻}*{厚}mm` | **部分更正**：produces 平开/吊趟两条主引擎都是 `{面玻}*单玻`（token 948=`*单玻`），无 `*{厚}mm`；双无 平开=`无玻璃`、**吊趟=`无`** | @498413 / @518899 |
| #7 回执行 date/payment | 原版为空 | **正确**：`payment` 在整个 chunk 出现 **0 次**；行字面量无这两个键。已按原版移除以保持一致 | @350147 / @354439 |
| #21/#22 glassHole doorImg/子母 | 亮窗行空、缺子母分支 | **正确**：子母分支已补（子门/母门各一行，`底玻-{底玻}`，doorImg 空） | @420766 / @421637 |

**本次已按复核结果落地的改动**（`app/src/views/Hui.vue`）：
`basicInfoText`（`<br>` + 吊趟尾部/无玻璃/吊脚差异）、`produceRemark`（拆平开/吊趟两套，吊趟无墙型，补 `加配`）、
新增 `oldSheetRemark`（`-` 连接 + 空格加配 + `-` 墙型）、`markupNames`、`oldSheetSize`（平开/吊趟两套，逗号连接）、
`oldSheetGlass`、`oldSheetProduce.lockway`、`wallTypeLabel(null)` 早退、`receiptRemark` 打折分支 `+0` 替换、
`receiptPrintData` 行移除 `date`/`payment`、`pricingDetail` 补套线金额与加价项目、`dimSizeLabel` 三分支×新旧格式、
`lableRow` 尺寸顺序（平开/移门不同）与移门哑口套/门套 lockway、以及全部打印载荷的 `\n` → `<br>`。

**仍未处理（需用户决策或另排）**：`ds`/`declaration` 后端列、`TotalBalance` 财务接口、`payQrcode` 收款码图库、
`orderQrcode` token 公式、product1 的 `frameHeigth/frameWidth/glassSize/remark` 前后框拼接、product10 `GlassSize` 部件配对、
product4（料标签）独立入口、8 个行构造器「何时落到哪个」的入口归属（影响 #12/#14 触发面）、doorImg 的 `图片ID`→`getImage` 取图机制。

---

## 12. 行构造器入口归属

目标：确定「用户在什么操作下，落到哪个 produce 行构造器」，以判定生产单 `door` 列是否含客户名、remark 有没有墙型。

### 12.1 方法

1. 用字节偏移定位 8 个 `_0x4d19f5[KEY]={…data:ROW}`，向上取**最近的 `=async … =>{` 外层函数**；
2. 在 Hui chunk 的 setup 返回对象（偏移 **600097**）里取这些函数的**暴露名**；
3. 在本 chunk 的渲染函数里找 `onClick:` / `onXxx:` 绑定得到**按钮文案**；
4. 在父页面 `Home-d6b13b9a.js` 里找**同名暴露 API 的调用点**（该文件里方法名是明文标识符，可直读）。

### 12.2 暴露名（偏移 600097，`return _0x382f8a({…})` 即 `expose({…})`）

```
calculateReceipt:            _0x32bd6f
calculateReceiptOld:         _0x320f0e
calculateReceiptForCustomed: _0x15ef6c
calculateGlass:              _0x4f7790
Glasslist:                   _0x509b06
lable:                       _0x17d664
lableForProduct:             _0x2e25b8
lableForMaterial:            _0xff5572
exportKouBan:                _0x2b92dc
```

### 12.3 归属表（结论）

| 外层函数 | 暴露名 | 平开行 (ping_hui) | 吊趟行 (diao_hui) | 触发入口 | 证据偏移 |
|---|---|---|---|---|---|
| `_0x4f7790` | `calculateGlass` | **`_0xcfde65`** | **`_0x4d28ce`** | Hui 内工具栏按钮「**玻璃合片单**」；Home 的 `wi`（mode 16，`calculateGlass()` + `buildGlassSheet2Html`） | 466942 / 478052；按钮 @608532 |
| `_0x32bd6f` | `calculateReceipt` | **`_0x551a25`** | **`_0x500ef9`** | Hui 内按钮「**生产单**」；Home 的 `Tc`「 生产单 」、`qc`「 移门生产单 」、`Gc`、`ti`（mode 15）、`In`/`Un`「**单行算料**」 | 498718 / 519154；按钮 @608269 |
| `_0x320f0e` | `calculateReceiptOld` | **`_0x34f4ac`** | **`_0x192067`** | Hui 内按钮「**生产单定制**」(`_0x413232`, `_0x5cc934=false`→mode 8)、「**生产单定制(竖版)**」(`_0x16ef64`, `_0x5cc934=true`→mode 9 + `_0x1ebfe1` 配对)；Home 的 `Oc`「 生产单定制(竖版) 」 | 537702 / 557251；按钮 @610525 / 610767 |
| `_0x15ef6c` | `calculateReceiptForCustomed` | **`_0x4495e3`**（product1 形状） | **`_0x1239ce`**（标准生产单形状） | Hui 内**无按钮**；仅 Home 的 `jc`「 **平开门生产单(定制)** 」（mode 7，`{ping:!0,diao:!1}`） | 571741 / 587754；Home @439644 |

行变量的 ping/diao 归属由循环头直接给出，例：
- `const _0x2f4e51 = _0x5b10d7.value.ping_hui[i]`（@467168 之前的循环）→ 引擎A 平开
- `const _0x206283 = _0x5b10d7.value.diao_hui[i]`（@467168）→ 引擎A 吊趟
- `const _0x3879a6 = _0x5b10d7.value.ping_hui[i]` → 引擎B 平开；`const _0xeb5988 = …diao_hui[i]` → 引擎B 吊趟
- `const _0x520f23 = …ping_hui[i]` → oldSheet 平开；`const _0x1f4aae = …diao_hui[i]` → oldSheet 吊趟
- `const _0x55a27e = …ping_hui[i]` → product1 行；`const _0x19d928 = …diao_hui[i]` → 标准生产单行

### 12.4 对「正常算料走哪一族」的判定

**结论：正常「生产单 / 单行算料 / 平开门生产单 / 移门生产单」全部走 `calculateReceipt`（`_0x32bd6f`）→ 引擎B（平开 `_0x551a25` / 吊趟 `_0x500ef9`）。**

引擎A（`_0xcfde65`/`_0x4d28ce`）**只在点「玻璃合片单」时才产生**——它是 `calculateGlass` 独占的。

判定依据（父页面 `Home-d6b13b9a.js`，方法名明文）：

| Handler | 按钮文案 | 调用 | 参数 | `ic`(mode) |
|---|---|---|---|---|
| `Tc` | `" 生产单 "` | `calculateReceipt` | `{ping:!0,diao:!0,single:!1,singleRowData:null}` | 2 |
| `qc` | `" 移门生产单 "` | `calculateReceipt` | `{ping:!1,diao:!0,single:!1,singleRowData:null}` | 2 |
| `Gc` | (令牌) | `calculateReceipt` | `{ping:!0,diao:!1,single:!1,singleRowData:null}` | 2 |
| `In` | 单行算料（平开行内按钮） | `calculateReceipt` | `{ping:!0,diao:!1,single:!0,singleRowData:e}` | 2 |
| `Un` | 单行算料（移门行内按钮，模板绑定 `onCalculateSingleRow`） | `calculateReceipt` | `{ping:!1,diao:!0,single:!0,singleRowData:e}` | 2 |
| `ti` | (令牌) | `calculateReceipt` | `{ping:!0,diao:!0,single:!1,singleRowData:null}` | 15 |
| `Oc` | `" 生产单定制(竖版) "` | `calculateReceiptOld` | — | 9 |
| `jc` | `" 平开门生产单(定制) "` | `calculateReceiptForCustomed` | `{ping:!0,diao:!1}` | 7 |
| `kr` / `Pr` | (令牌) / `" 推拉标签 "` | `lable` | `{ping:!0,diao:!1}` / `{ping:!1,diao:!0}` | 4 |
| `Dr` / `Ar` | (令牌) | `lable` | `{ping:!0,diao:!1}` / `{ping:!1,diao:!0}` | 13 |
| `Mc` | (令牌) | `lableForProduct` | `{ping:!0,diao:!0},[BoLiKuan,BoLiGao]` | 10 |
| `wi` | (令牌) | `calculateGlass()` | — | 16 |
| `Hc` | (令牌) | `lc.value[Glasslist]()` | — | 11 |

### 12.5 这条结论对差异清单的修正（重要）

1. **§9 #12/#13 的「建议」要改**：正常生产单走**引擎B**，所以
   - 平开 remark = `[轨道种类, 五金, 安装地址, 备注]` + 加配 + **墙型（`<br>` 连接）** → 我们 `produceRemark` 的 `-` 连接 **是错的**，应改 `<br>`（而不是"去掉墙型"）；
   - 吊趟 remark = `[五金, 单双丁, 备注, 安装地址]` + 加配，**无墙型**。
   - 我们"平开恒加墙型、吊趟恒加墙型"里，**吊趟加墙型是错的**。
2. **§9 #6 的适用面收窄**：`doorframe`/`windows` 整列为空只发生在**引擎A**（即「玻璃合片单」）的行上 —— 也就是 **`glass` 模板**，不是生产单。生产单（引擎B）两列都有值。
3. **生产单 `door` 列**：非白名单门店 = `[客户, 型材, 颜色].filter(Boolean).join("<br>")`（**含客户名**）；白名单门店 = `[型材, 颜色]`。我们恒用 `[client, profile, color]` 且分隔符 `\n` → 分隔符必错，客户名只对非白名单门店对。
   白名单 `_0x743794`（@467000 附近，共 34 家）：万鑫门业、德清顾家、锦致轩门业、欧盾门业、吉雅轩门厂、极简移门、**恒业门窗**、南海移门、金雅轩门窗、度勒门窗、鑫豪轩门业、广乐名门、鑫瑞门业、圣诺派门业、帝奥名门、美高移门、鑫源移门加工厂、鑫源名门、皇丞门窗、宏泰门业、天润门业、铂卫邦铝门、欧莱富移门、顾轩门窗、润佳门窗、宜居门窗厂、欧铂尊门业、鑫美龙家居、皓雅门窗、富嘉名门…（其余见源码）
4. **product1 的定位确认**：`calculateReceiptForCustomed` 里**平开用 product1 形状行（`_0x4495e3`）、吊趟用标准生产单形状行（`_0x1239ce`）** —— 与模板名「平开门生产单(定制)」完全吻合，说明 product1 模板只服务平开门。

### 12.6 附带发现

- **三个"生成"函数都有同一个提前返回**：
  `if (props.receiptData1 && Object.keys(props.receiptData1).length > 0) return ROWS;`
  （`_0x32bd6f`@520246 返回 `_0x39bda2`；`_0x4f7790`@474259 返回 `_0x1b8d67`；`_0x509b06`@454848 返回 `_0x164736`）。
  → **父页面（传了 `receiptData1`）拿到的是行数组，自己渲染模板；Hui 自己的工具栏不传时则渲染到内置预览 `_0x3c8618`**。两条路走的是**同一个**构造器，所以引擎归属不受影响。
- **`single:!0` 的副作用**：`if(single&&singleRowData){const e={..._0x5b10d7.value}; _0x5b10d7.value={ping_hui: ping?[singleRowData]:[], diao_hui: diao?[singleRowData]:[]}}` —— 且**没有恢复**，单行算料后另一张表被清空（原版行为）。
- **行的排序**：`_0x39bda2`/`_0x1b8d67` 都按 `localStorage.smartdoor_sort_method === 'order'` 决定：按 `OrderID` 数字前缀排序，否则按 `produce.timestamp`。
- `_0xc8b731`（此前标"未解码"）已解出：`e.remark ? e.remark+"<br>配件:"+hardware : "配件:"+hardware`，其中 hardware 的 `\r\n`/`\r`/`\n` 都先转成 `<br>`（`_0x3cc851`）。
- 三个「生成」函数在 Hui 自己工具栏里的门控是 `_0x1b58e4.value && _0x5c7e83.value`。

### 12.7 本节结论的落地（team-lead，2026-09-10）

已按 §12.4/§12.5 落地到 `app/src/views/Hui.vue`：

| 模板 | 引擎 | 落地改动 |
|---|---|---|
| product / product4–9 | **B**（`calculateReceipt`） | `door` = `[客户,型材,颜色].join("<br>")`；`produceRemark` 拆平开/吊趟两套：平开 `[轨道种类,五金,安装地址,备注]`+加配+**墙型(`<br>`)**，吊趟 `[五金,单双丁,备注,安装地址]`+加配（**无墙型**）；`basicInfoText` 双无玻 平开=`无玻璃`/吊趟=`无` |
| **glass** | **A**（`calculateGlass`，独占） | 新增 `glassRemark`（`[五金,单双丁,备注,安装地址]`+加配，**无轨道种类、无墙型**）；`door` = `[型材,颜色]`（**不含客户**）；`basicInfoText(l, true)` 双无玻=`无` |
| product2 / product3 | D/E2（`calculateReceiptOld`） | `oldSheetRemark` / `oldSheetSize` / `oldSheetGlass` / `lockway` 全部按 §11 的 oldSheet 引擎规则重写 |

未落地项：
- **白名单门店 `_0x743794`（34 家）**：命中时 `door` 只留 `[型材,颜色]`。本项目为单租户（昊艺门窗，不在名单内），且用户此前明确要求**不要白名单常量**，故不实现。
- **`_0xc8b731` 的 `配件:{hardware}` 段**：源码里追加在 remark 末尾（`remark ? remark+"<br>配件:"+x : "配件:"+x`，x 的换行先转 `<br>`）。其二参疑似**公式对象**而非订单行，与用户此前「去掉 extra.hardware」的指示冲突，**未实现**。
- **行排序**：`localStorage.smartdoor_sort_method === 'order'` 时按 `OrderID` 数字前缀排，否则按 `produce.timestamp`。我们沿用订单行原序。
- **单行算料清空另一张表**（`single:!0` 副作用）——原版行为，我们无对应交互。

---

## 13. 待补：后端 `tenants` 表缺的两列（用户 2026-09-10 决定**暂不加**，先记录）

当前后端 `tenants` 只有 `id / name / created_at`（见 `backend/migrations/`）。原版有两项**租户级配置**我们没有承载，现均以常量占位：

| 列 | 类型建议 | 用途（原版语义） | 我们现在的临时做法 |
|---|---|---|---|
| `ds` | `text not null default 'smartdoor'` | 决定 `shouldUseNewSizeFormat(ds)` → 回执尺寸列走「带标签」还是「无标签」拼法；同时用于 `finance_getCustomerBalance` 等接口的 `param2` | 前端常量 `TENANT_DS = 'smartdoor'`（`app/src/views/Hui.vue`）。按规则 `^smartdoor(\d+)?$`：无数字后缀 或 408 或 >414 → 新格式；本租户 `smartdoor` → **新格式**。**2026-09-10 用户对照旧版实物确认：回执单尺寸列用「带标签」新格式，当前实现正确。**（此前「原版没有『墙厚』二字」的说法指的是无标签分支，本租户不用那一支。） |
| `declaration` | `text` | 回执单底部「温馨提示」文案 | 前端 `tenantDeclaration`（当前恒空）→ 回退常量 `LEGACY_DECLARATION = '含安装费'`（原版回退值） |

**补列时要一起做的**：
1. migration 加两列；`TenantDto`（`app/src/api/types.ts`）加 `ds?: string` / `declaration?: string`；
2. `me` 接口（`ApiResponse<MeResponse>`）返回这两列；
3. `Hui.vue` 的 `onMounted` 里把 `me.tenant.declaration` 写进 `tenantDeclaration`、`me.tenant.ds` 写进一个 ref 替代 `TENANT_DS` 常量（`NEW_SIZE_FORMAT` 改为随租户计算的 computed）；
4. 姑苏后端的 settings/租户配置页（若有）补这两个输入项。

> 另有一项**不属于 tenants 表**的缺口：回执表头 `TotalBalance` 原版是调
> `https://www.samrtdoor.com.cn/1?param1=finance_getCustomerBalance&param2={ds}&param3={客户编号}`
> 取「客户账户余额」，仅在「显示客户总余额」开关开启且有客户编号时。本系统无财务模块，
> 暂以「总价-定金」占位（`receiptPrintData` 内已注释标明）。补财务模块时一并替换。

---

## 14. 第四轮：product1 / product10 落地 + 更多审计更正（2026-09-10）

### 14.1 本轮复核出的**审计判错项**（均已用原始 chunk 证伪并改写实现）

| 审计条目 | 审计结论 | 原始 chunk 实测 | 证据 |
|---|---|---|---|
| #23 product10 `GlassSize` | `BoLiKuan[0] + "*" + BoLiGao[0] + "*" + …`（**宽在前**） | **高在前**：`BoLiGao[0] + "*" + BoLiKuan[0] + "*" + (BoLiKuan[1]\|\|1)` | @400471；部件值由 `_0x57cedf` 生成，格式 `{result}*{quantity}`（@320186） |
| #8 product10 `size` | 平开 `吊脚→墙厚→亮窗`；吊趟仅亮窗 | **两者相同**：`{门洞高}*{门洞宽}`，仅 `亮窗总高>0` 时追加 `*{亮窗总高}`。**无吊脚、无墙厚** | @399457 |
| #28 product1 `kouWidth`(晟斐) | 晟斐门窗厂 → `kouWidth=getImage(图片ID)` | 晟斐分支只覆盖 `kouHeigth=套线种类`，且 `kouWidth`/`kouHeigth` 的常规赋值都在 `else` 里 → 晟斐时 `kouWidth` 保持空 | @570279 |
| #18 product1 前后框 | 描述为「`前框高+前包加长` 前缀"前"」 | 正确，补充：**前框宽 → `"前"+前框宽`**；后框宽 → `frameWidth += "<br>后"+后框宽`；后框高 → `frameHeigth += "<br>后"+后框高` | @569937 |

### 14.2 本轮落地

- **product1（`product1Produces` 重写）**：`lockway` 改用**原始开向**（原来用了 `lineOpenLabel` 带扇数）；`glassSize` 改 `玻璃高x玻璃宽`；`frameHeigth`/`frameWidth` 补前/后框拼接（前框高带前包加长、后框以 `<br>后` 追加）；`sheetWidth` 补 `封板宽`；`doorSize` 洞尺改 `<br>` 前置；`remark` 换成 product1 专用规则（`[五金,单双丁(≠正常),备注,安装地址].join("<br>")` + 加配，**无轨道种类、无墙型**）。
- **product10（`product10Row`）**：`size` 改为 `门洞高*门洞宽[*亮窗总高]`；`remark` 补 `加配`；`GlassSize` 改为部件配对 `玻璃高.result*玻璃宽.result*(玻璃宽.quantity||1)`（原来是完全不相干的 `玻璃:底-面` 拼法）。顺手删掉因此失效的 `glassSpecText`。
- 门框/门框宽等取值改为「**同名取最后一个**」，与原版 `Object.entries(...).filter(name.includes(kw)).forEach` 的 last-wins 语义一致。

### 14.3 尚未落地（留待打印后再完善）

- **#27 doorsheet 数量修正**：玻璃件单玻 `÷2`、`一固一活→1`、`双活→2`、`parentSubsidiary→4×数量`、`diamond→3×数量`。已在 product10 的部件扁平化里读到该逻辑（@399457），**但尚未确认 produces 的 doorsheet 引擎是否同样套用** —— 需定位 `_0x551a25`/`_0x500ef9` 的 doorsheet 构造段再改，不要照搬。
- **#24 product4（料标签，mode 11）**：`_0xff5572` 每行固定 4 张、`size` 无吊脚、`lockway` 无「开向:」前缀、`remark` 仅 `备注:`。目前 `templatePayload` 按字段族把 product4 路由到 `productionProduces()`（生产单版式）。
- **#29/#30/#31/#32**：回执 `total` 取整、`openImg` 平开 `getOriginalOpenDirection` 归一化、行排序（`smartdoor_sort_method`）、`address` 回退与分隔符。
- **`配件:{五金}` 段**（`_0xc8b731`，@320186 已解出）与 **product10 部件级张数**（`GlassSize_*` 分支 + `BoLiKuan.quantity` 决定复制张数）。

---

## 15. 第五轮：doorsheet 列四套引擎全部解出并落地（2026-09-10）

### 15.1 四套构造器（原始 chunk 实证）

结构完全一致，只差**关键词数组 / 排除词 / 修正项**：

```
按关键词数组顺序，对每个 kw：
  parts.filter(name => name.includes(kw) && !name.includes(排除词)).map(p => {
     let q = p.quantity
     若 kw 是「玻璃宽/玻璃高」且单玻（底玻或面玻 === "无"）且名字不含「单玻」：
        q = diamond ? p.quantity : Math.round(p.quantity / 2)
     若（吊趟）且 扇数 === "一固一活"：q = 1
     若（吊趟）且 扇数 === "双活"：    q = 2
     c = `${name}:${result}*${q * 行数量}`
     return kw === "玻璃高" ? "<br>" + c : c      // ← 玻璃高前多一个 <br>（会多一空行）
  })
join("<br>")
```

| 引擎 | 偏移 | 关键词 | 排除词 | 吊趟扇数修正 |
|---|---|---|---|---|
| B 平开 `_0x551a25` | @509224 邻近 | 光企,方,**封板高,封板宽**,龙骨横,龙骨竖,门扇高,门扇宽,收口,封边横,封边竖,玻璃高,玻璃宽 | `亮窗玻璃` | 无 |
| B 吊趟 `_0x500ef9` | @509224 | 光企,勾企,合页,锁,收口,方,**封板高,封板宽**,纱网,玻璃高,玻璃宽 | `亮窗` | **有** |
| D 平开 `_0x34f4ac` | @530900 | 光企,方,龙骨横,龙骨竖,门扇高,门扇宽,收口,封边横,封边竖,玻璃高,玻璃宽（**无封板**） | `上亮玻璃` | 无 |
| E2 吊趟 `_0x192067` | @547901 | 光企,勾企,合页,锁,收口,方,纱网,玻璃高,玻璃宽 | `亮窗` | **有** |
| 钻石（B/D 平开） | — | 左固玻璃,右固玻璃,门玻璃 | 同上 | — |

另：**杉杉铝木极简门**（仅引擎B两套）把 `{名}:{result}` 写成 `{名}:<br>{result}`。

### 15.2 我们原来的实现错在哪

- `productionProduces` / `oldSheetProduce` 都走 `partText(sheet, l.quantity)`，其中 `sheet` 来自 `groupPart` 的正则分组 + `partOrder` 排序 —— **丢了数量修正**（单玻÷2、一固一活→1、双活→2），也丢了「玻璃高」的 `<br>` 前缀与关键词顺序。
- 平开排除词原来用 `/亮窗/`，两套引擎实际分别是 `亮窗玻璃`（B）和 `上亮玻璃`（D）。

### 15.3 落地

新增 `doorsheetText(l, oldSheetEngine)` + `DS_KW` 关键词表；`productionProduces` 传 `false`（引擎B）、`oldSheetProduce` 传 `true`（引擎D/E2）。`partText` 保留给 `frameText`（doorframe 列）使用。

### 15.4 仍未做

`doorframe` / `windows` 两列目前仍走旧的 `groupPart` 正则分组（引擎B 吊趟的 doorframe 有「套线名：」段、平开没有；windows 三段式分组等），未按本节同样的方式逐引擎重写。

---

## §16 doorframe / windows 四引擎规格

来源：`legacy/js/Hui-d088417c.js`（原始 chunk）。所有 accessor 均为 `_0x43b0d8` 别名（`_0x11f592` / `_0x5c0d14`），已按 §0.2b 标准自证。

**通用记法**
- `parts` = 该行的算料结果 map（`Object.entries(parts)` 的顺序 = 对象插入顺序，**不是关键词数组顺序**）
- `Q` = 行数量（`行["数量"]`）
- `fmt(key, v, q)` = `杉杉铝木极简门` 变体（见各引擎）
- `p.result` / `p.quantity` / `p.materialName` = 部件的 结果/数量/材料名
- **凡 `filter(kw.some(x => name.includes(x)))` 只做筛选，不排序**；出现「priority 排序」的地方我会明确写出来

---

### 16.1 引擎B平开（`_0x551a25`）— 正常「生产单」平开

#### doorframe（@493300–493420，赋值 @493415）

```js
const S = _0x298841;                       // 基础组
if (formulaType === 'diamond') {
  S = ['左边','右边','斜长','竖框']
        .filter(k => Object.prototype.hasOwnProperty.call(parts, k))
        .map(k => fmt(parts[k]))                                  // 见下 fmt
} else {
  const 高 = [], 宽 = [];
  Object.entries(parts).forEach(([k,v]) => {
    if (k.includes('门框高')) 高.push([k,v])
    else if (k.includes('门框宽')) 宽.push([k,v])
  })
  S = [...高, ...宽].map(([k,v]) => fmt(v))
}
const 前框组 = Object.entries(parts)
  .filter(([k]) => ['前框'].some(x => k.includes(x)))
  .map(([k,v]) => k.includes('前框高')
        ? fmt(v, (Number(v.result)||0) + (Number(行.前包加长)||0))
        : fmt(v))
const 后框组 = Object.entries(parts)
  .filter(([k]) => ['后框'].some(x => k.includes(x)))
  .map(([k,v]) => k.includes('后框高')
        ? fmt(v, (Number(v.result)||0) + (Number(行.后包加长)||0))
        : fmt(v))
const 门板组 = Object.entries(parts)
  .filter(([k]) => ['门板'].some(x => k.includes(x)))
  .map(([k,v]) => fmt(v))

if (前框组.length) S = S.concat(前框组)
if (后框组.length) S = S.concat(后框组)
if (门板组.length) S = S.concat(门板组)
row.doorframe = S.join('<br>')

// fmt：
// 杉杉铝木极简门 → `${materialName}:<br>${result}*${quantity*Q}`
// 其他           → `${materialName}:${result}*${quantity*Q}`
```

- 顺序：**门框高组 → 门框宽组 → 前框组 → 后框组 → 门板组**（组内保持 entries 顺序）
- **没有**「套线名：」段
- 前框/后框的 `+前包加长/后包加长` **只用 `Number()` 兜底**，不做 0 判断（即 `前包加长` 为空 → `+0`）

#### windows（@491500–493340，赋值 @493416）

```js
row.windows = Object.entries(parts)
  .filter(([k]) => ['扣板','上亮横','上亮窗玻璃','压线'].some(x => k.includes(x)))
  .map(([k,v]) => {
     let q = v.quantity
     if (k.includes('玻璃') && (底玻==='无' || 面玻==='无') && !k.includes('单玻')) {
        q = Math.round(v.quantity / 2)
        if (formulaType === 'diamond') q = v.quantity
     }
     return `${v.materialName}:${v.result}*${q*Q}`
  })
  .join('<br>')
```

- 顺序：**entries 顺序**（关键词数组只用于筛选）
- **没有扣板厚拼接**，**没有 `0<q*Q<1 → 1` 钳位**
- 玻璃件折半条件：`name.includes('玻璃') && 底玻/面玻任一为'无' && !name.includes('单玻')`；钻石不折半
- 杉杉门店变体：此处**没有**（恒用 `:`）

#### kou（@493430–494100，**模板无此列**，仅记录）

```js
const out = ['扣板宽','扣板高','扣板厚'].map(name => {
   const hit = Object.entries(parts).find(([k]) => k.includes(name))   // 每项各自 find，只取第一个命中
   if (!hit) return null
   const v = hit[1]
   return `${v.materialName}:${v.result}*${v.quantity*Q}`             // 无 clamp；扣板厚这一项也用 quantity*Q，不是扣板厚值
}).filter(Boolean)

// 封板：按名字配对（'封板宽X' → '封板高X'），名字里含 'copy' 的排除
const 宽组 = entries.filter(([k]) => k.includes('封板宽') && !String(k).toLowerCase().includes('copy'))
const 高组 = entries.filter(([k]) => k.includes('封板高') && !String(k).toLowerCase().includes('copy'))
if (宽组.length && 高组.length) {
  宽组.forEach(([k,v], i) => {
     const 名 = k.replace('封板宽','封板高')
     const hit = 高组.find(([k2]) => k2 === 名)
     const 高 = hit ? hit[1] : (高组.length===1 ? 高组[0][1] : (高组[i] ? 高组[i][1] : 高组[0][1]))
     out.push(`封板:${v.result}*${高.result}*${v.quantity*Q}`)
  })
}
row.kou = out.join('<br>')
```

---

### 16.2 引擎B吊趟（`_0x500ef9`）— 正常「生产单」吊趟

#### doorframe（@509600–512100，赋值 @514750）

```js
// 轨道组 source
const 轨源 = Object.entries(parts)
  .filter(([k]) => ['边封','下轨','上轨','滑','固定','移动','上横','盖板'].some(x => k.includes(x)))
  .filter(([k]) => !k.includes('企'))
  .filter(([k,v]) => (!k.includes('边封') || 行.边封数 !== 0) &&
                     !(行.轨道种类 && 行.轨道种类.includes('吊轨') && k.includes('下滑')))
const 下滑 = 轨源.filter(([k]) => k.includes('下滑'))
const 多下滑 = 下滑.length > 1
const 轨道组 = (多下滑
      ? 轨源.filter(([k,v]) => !k.includes('下滑') || v.materialName?.includes(行.轨道种类))
      : 轨源)
    .map(([k,v]) => {
        if (k.includes('边封') && 行.边封数 !== undefined) v.quantity = 行.边封数
        if (k.includes('滑')        && 行.轨道长 > 0) v.result = 行.轨道长
        if (k.includes('左右盖板')  && 行.轨道长 > 0) v.result = 行.轨道长
        if (k.includes('轨道盖板')  && 行.轨道长 > 0) v.result = 行.轨道长
        if (k.includes('下滑')) {
           const nm = (多下滑 && v.materialName?.includes(行.轨道种类))
                    ? v.materialName
                    : `${行.轨道种类}${v.materialName}`
           return `${nm}${杉杉?':<br>':':'}${v.result}*${v.quantity*Q}`
        }
        if (k.includes('下轨'))
           return `${行.轨道种类}${v.materialName}:${v.result}*${v.quantity*Q}`     // 杉杉同款无 <br>
        if (k.includes('上滑') && 行.轨道种类.includes('吊轨')) {
           const nm = v.materialName.includes('上滑') ? v.materialName.replace('上滑', 行.轨道种类)
                                                     : `${行.轨道种类}-${v.materialName}`
           return `${nm}:${v.result}*${v.quantity*Q}`
        }
        if (k.includes('上轨') && 行.轨道种类.includes('吊轨')) {
           const nm = v.materialName.includes('上轨') ? v.materialName.replace('上轨', 行.轨道种类)
                                                     : `${行.轨道种类}-${v.materialName}`
           return `${nm}:${v.result}*${v.quantity*Q}`
        }
        return `${杉杉? v.materialName+':<br>' : v.materialName+':'}${v.result}*${v.quantity*Q}`
    })

// 套线组
const 套线组 = Object.entries(parts)
  .filter(([k]) => k.includes('包宽') || k.includes('包高'))
  .flatMap(([k,v]) => {
     if (k.includes('包高') && (Number(行.前包加长)>0 || Number(行.后包加长)>0)) {
        const q = v.quantity * Q / 2                       // ← 注意 ÷2
        const 前 = Number(行.前包加长||0), 后 = Number(行.后包加长||0)
        return [ `${v.materialName}:${v.result+前}*${q}`,
                 `${v.materialName}:${v.result+后}*${q}` ]
     }
     return [ `${v.materialName}:${v.result}*${v.quantity*Q}` ]
  })

row.doorframe = 套线组.length > 0
  ? `${轨道组.join('<br>')}<br>套线名：${行.套线种类}<br>${套线组.join('<br>')}`
  : 轨道组.join('<br>')
```

- **「套线名：」段只出现在吊趟**（引擎B吊趟 + oldSheet吊趟），位置在**轨道组之后**
- `*<br>`（token 1098）出现在 16.4 的扣板组，**不在 doorframe**
- `轨道长` 覆盖 `result` 的条件：件名含 `滑` / `左右盖板` / `轨道盖板`，且 `行.轨道长 > 0`
- `边封数` 覆盖 `quantity` 的条件：件名含 `边封`，且 `行.边封数 !== undefined`
- 套线组「包高」在 前/后包加长 >0 时**quantity ÷ 2**，无 `Math.round`

#### windows（@512400–514730，赋值 @514745）

```js
const 亮窗类 = Object.entries(parts)
  .filter(([k]) => ['中柱','亮窗玻璃','槽','压线'].some(x => k.includes(x)))
  .map(([k,v]) => {
     let q = v.quantity
     if (k.includes('玻璃') && (底玻==='无'||面玻==='无') && !k.includes('单玻')) q = v.quantity/2   // 无 Math.round
     if (k.includes('玻璃') && 行.扇数 === '一固一活') q = 1
     if (k.includes('玻璃') && 行.扇数 === '双活')     q = 2
     const l = q * Q
     const o = (l>0 && l<1) ? 1 : l                                    // ← 钳位
     return `${杉杉? v.materialName+':<br>' : v.materialName+':'}${v.result}*${o}`
  })
const 扣板厚 = parts.find(k => k.includes('扣板厚'))?.[1].result ?? 0
const 扣板组 = Object.entries(parts)
  .filter(([k]) => k.includes('扣板') && !k.includes('扣板厚'))
  .map(([k,v]) => {
     const x = v.result, l = 扣板厚
     let o = v.quantity * Q; if (o>0 && o<1) o = 1
     if (l>0 && Q>1) return `${杉杉?v.materialName+':<br>':v.materialName+':'}${x}*<br>${l}*${o}`
     if (l>0)        return `${杉杉?v.materialName+':<br>':v.materialName+':'}${x}*<br>${l}*${o}`
     /* else l<=0 */ return `${杉杉?v.materialName+':<br>':v.materialName+':'}${x}*${l}*${o}`   // ← 会打出 "...*0*N"
  })
row.windows = [...亮窗类, ...扣板组].join('<br>')
```

- 顺序：**`[...亮窗类, ...扣板组]`**，两组内部各自保持 entries 顺序，**无 priority 排序**
- **扣板厚被拼进「扣板」件**，用 `*<br>`（token 1098）分隔
- 玻璃件的三档数量修正（÷2 / 一固一活→1 / 双活→2）**只对 `name.includes('玻璃')` 的件生效** ✓
- 钳位 `0<l<1 → 1` 出现在**亮窗类和扣板组**，不出现于引擎B平开的 windows
- ⚠️ 若行内没有「扣板厚」件，`l = 0`，走 else 分支 → 文本为 `${名}:${result}*0*${qty}`（原版行为，需照抄）

#### kou（@514700–514750，模板无此列）

```
扣板宽:${扣板宽.result}*${clamp01(扣板宽.quantity*Q)}
扣板高:${扣板高.result}*${clamp01(扣板高.quantity*Q)}
扣板厚:${扣板厚.result}*${Q}                     // ← 用的是 行数量，不是 quantity*Q
封板:${封板宽.result}*${封板高.result}*${clamp01(封板宽.quantity*Q)}
```

---

### 16.3 oldSheet平开（`_0x34f4ac`）

定位方式：oldSheet 在 @530789 初始化 `{doorsheet:"",doorframe:"",windows:"",doorImg:""}`；doorsheet @531536；doorframe `_0xdd5a55` @531560；windows `_0x3c04d6` @533230；赋值 @533720。

```js
// doorframe
let D = []
if (formulaType === 'diamond') {
  D = ['左边','右边','斜长','竖框']
        .filter(k => Object.prototype.hasOwnProperty.call(parts, k))
        .map(k => fmt(parts[k]))
} else {
  D = Object.entries(parts)
        .filter(([k]) => ['门框'].some(x => k.includes(x)))
        .map(([k,v]) => fmt(v))
}
const 前框组 = entries.filter(([k]) => ['前框'].some(x => k.includes(x)))
  .map(([k,v]) => k.includes('前框高')
        ? `${v.materialName}:${v.result + 行.前包加长}*${v.quantity*Q}`      // ← 无 Number()
        : fmt(v))
const 后框组 = entries.filter(([k]) => ['后框'].some(x => k.includes(x)))
  .map(([k,v]) => k.includes('后框高')
        ? `${v.materialName}:${v.result + 行.后包加长}*${v.quantity*Q}`
        : fmt(v))
const 门板组 = entries.filter(([k]) => ['门板'].some(x => k.includes(x))).map(v => fmt(v))

if (前框组.length) D = D.concat(前框组)
if (后框组.length) D = D.concat(后框组)
if (门板组.length) D = D.concat(门板组)
row.oldSheet[0].doorframe = D.join('<br>')

// fmt = `${materialName}:${result}*${quantity*Q}`   —— 无杉杉变体

// windows
row.oldSheet[0].windows = Object.entries(parts)
  .filter(([k]) => ['扣板','上亮横','压线','封板','上亮窗玻璃'].some(x => k.includes(x)))
  .map(([k,v]) => {
     let q = v.quantity
     if (k.includes('玻璃') && (底玻==='无'||面玻==='无') && !k.includes('单玻')) {
        q = Math.round(v.quantity/2)
        if (formulaType === 'diamond') q = v.quantity
     }
     return `${v.materialName}:${v.result}*${q*Q}`
  })
  .join('<br>')
```

与引擎B平开的差异：
| | 引擎B平开 | oldSheet平开 |
|---|---|---|
| doorframe 基础组 | 先 `门框高` 再 `门框宽` 分组 | 只按 `门框` 过滤（不分组） |
| 杉杉 `<br>` 变体 | 有 | **无** |
| 前/后包加长 | `Number(...)\|\|0` 兜底 | **直接 `+`**（字符串拼接风险） |
| windows 关键词 | `['扣板','上亮横','上亮窗玻璃','压线']` | `['扣板','上亮横','压线','封板','上亮窗玻璃']`（**多 `封板`**） |
| 扣板厚拼接 | 无 | **无** |
| 钳位 | 无 | **无** |

---

### 16.4 oldSheet吊趟（`_0x192067`）

定位：oldSheet @547764 初始化；doorsheet @548430；doorframe `_0x5d7b3d` @548620；套线组 `_0x5bff58` @549900；windows @550800–552900；doorframe 赋值 @553072。

#### doorframe

```js
const 轨源 = Object.entries(parts)
  .filter(([k]) => ['边封','下轨','上轨','滑','固定','移动','上横','盖板'].some(x => k.includes(x)))
  .filter(([k]) => !k.includes('企'))
  .filter(([k,v]) => (!k.includes('边封') || 行.边封数 !== 0) &&
                     !(行.轨道种类 && 行.轨道种类.includes('吊轨') && k.includes('下滑')))
const 多下滑 = 轨源.filter(([k]) => k.includes('下滑')).length > 1
const 轨道组 = (多下滑 ? 轨源.filter(([k,v]) => !k.includes('下滑') || v.materialName?.includes(行.轨道种类)) : 轨源)
  .map(([k,v]) => {
     if (k.includes('边封') && 行.边封数 !== undefined) v.quantity = 行.边封数
     if (k.includes('滑')       && 行.轨道长 > 0) v.result = 行.轨道长
     if (k.includes('左右盖板') && 行.轨道长 > 0) v.result = 行.轨道长
     if (k.includes('轨道盖板') && 行.轨道长 > 0) v.result = 行.轨道长
     if (k.includes('下滑')) return `${多下滑 && v.materialName?.includes(行.轨道种类) ? v.materialName : 行.轨道种类+v.materialName}:${v.result}*${v.quantity*Q}`
     if (k.includes('下轨')) return `${行.轨道种类}${v.materialName}:${v.result}*${v.quantity*Q}`
     if (k.includes('上滑') && 行.轨道种类.includes('吊轨')) { const nm = v.materialName.includes('上滑') ? v.materialName.replace('上滑',行.轨道种类) : `${行.轨道种类}-${v.materialName}`; return `${nm}:${v.result}*${v.quantity*Q}` }
     if (k.includes('上轨') && 行.轨道种类.includes('吊轨')) { const nm = v.materialName.includes('上轨') ? v.materialName.replace('上轨',行.轨道种类) : `${行.轨道种类}-${v.materialName}`; return `${nm}:${v.result}*${v.quantity*Q}` }
     return `${v.materialName}:${v.result}*${v.quantity*Q}`            // 无杉杉变体
  })
const 套线组 = Object.entries(parts)
  .filter(([k]) => k.includes('包宽') || k.includes('包高'))
  .flatMap(([k,v]) => {
     if (k.includes('包高') && (Number(行.前包加长)>0 || Number(行.后包加长)>0)) {
        const q = v.quantity * Q / 2
        return [ `${v.materialName}:${v.result+Number(行.前包加长||0)}*${q}`,
                 `${v.materialName}:${v.result+Number(行.后包加长||0)}*${q}` ]
     }
     return [ `${v.materialName}:${v.result}*${v.quantity*Q}` ]
  })

row.oldSheet[0].doorframe = 套线组.length > 0
  ? `${轨道组.join('<br>')}<br>套线名：${行.套线种类}<br>${套线组.join('<br>')}`
  : 轨道组.join('<br>')
```

与引擎B吊趟 doorframe 的差异：**除 `杉杉` 变体不存在外，结构相同**（`*<br>` 也不在其中）。

#### windows（三段，@550800–552900）

```js
// ① 亮窗段：仅当 行.亮窗总高 > 行.门洞高
if (行.亮窗总高 > 行.门洞高) {
   const e = Object.entries(parts)
     .filter(([k]) => ['中柱','亮窗玻璃','压线'].some(x => k.includes(x)))
     .map(([k,v]) => {
        const x = (k.includes('亮窗玻璃') && 底玻==='无') ? Q/2 : Q
        const t = v.quantity * x
        const o = (t>0 && t<1) ? 1 : t
        return `${v.materialName}:${v.result}*${o}`
     })
   row.oldSheet[0].windows = e.join('<br>')          // ← 注意：直接覆盖，不是 push
}

// ② 主体段（关键词 ['槽','封板高','封板宽']，排除 亮窗玻璃）
const KW = ['槽','封板高','封板宽']
const 主体 = Object.entries(parts)
  .filter(([k]) => KW.some(x => x!=='' && k.includes(x)) && !k.includes('亮窗玻璃'))
  .map(([k,v]) => {
     const prio = KW.findIndex(x => x!=='' && k.includes(x))        // ← priority = 关键词下标
     let q = v.quantity
     if (k.includes('玻璃') && (底玻==='无'||面玻==='无') && !k.includes('单玻')) q = v.quantity/2
     if (k.includes('玻璃') && 行.扇数 === '一固一活') q = 1
     if (k.includes('玻璃') && 行.扇数 === '双活')     q = 2
     const o = q * Q
     return { priority: prio, isGlass: k.includes('玻璃'), text: `${v.materialName}:${v.result}*${(o>0&&o<1)?1:o}` }
  })
  .sort((a,b) => a.priority - b.priority)                            // ← 按关键词下标排序
const 非玻璃组 = 主体.filter(x => !x.isGlass).map(x => x.text)
const 玻璃组   = 主体.filter(x =>  x.isGlass).map(x => x.text)

// ③ 扣板组
const 扣板厚 = parts.find(k => k.includes('扣板厚'))?.[1].result ?? 0
const 扣板组 = Object.entries(parts)
  .filter(([k]) => k.includes('扣板') && !k.includes('扣板厚'))
  .map(([k,v]) => {
     const x = v.result, l = 扣板厚
     let o = v.quantity * Q; if (o>0 && o<1) o = 1
     return `${v.materialName}:${x}*${l}*${o}`                       // ← 三分支文本完全相同（门店判断是死代码）
  })

// ④ 组装
const e = [...非玻璃组, ...扣板组, ...玻璃组].join('<br>')
row.oldSheet[0].windows = [row.oldSheet[0].windows || "", e].filter(Boolean).join('<br>')
```

**排序**：主体段是**唯一的 priority 排序**（`findIndex` 于 `['槽','封板高','封板宽']`），然后按 `isGlass` 拆成两组；最终顺序 = **`[亮窗段, 非玻璃组, 扣板组, 玻璃组]`**。
注意 `封板高` 命中后 `findIndex` 返回 1，`封板宽` 返回 1… 等等：`['槽','封板高','封板宽']` 中 `封板宽` 的 index 是 2（`封板高` 是 1）。而 `封板宽` 也 `includes('封板')`… 不，`封板宽.includes('槽')`=false、`.includes('封板高')`=false、`.includes('封板宽')`=true → prio 2 ✓。

**扣板厚**：oldSheet吊趟的扣板件写成 `${结果}*${扣板厚}*${qty}`（**分隔符是普通 `*`，不是 `*<br>`**），且**没有** 引擎B吊趟那种 `l>0` 分支——扣板厚缺失时打出 `...*0*N`。

---

### 16.5 钻石型（`formulaType === 'diamond'`）四处分支汇总

| 引擎 | doorframe | windows |
|---|---|---|
| 引擎B平开 | `['左边','右边','斜长','竖框'].filter(k => hasOwnProperty(parts,k)).map(fmt)` | 玻璃件**不折半**（`q = v.quantity`），其余同普通 |
| 引擎B吊趟 | **无 diamond 分支**（已全段检索 `(986)`/`"diamond"` 零命中；diamond 行会走普通轨道路径） | **无 diamond 分支**（同上） |
| oldSheet平开 | `['左边','右边','斜长','竖框'].filter(hasOwnProperty).map(fmt)` | 玻璃件**不折半** |
| oldSheet吊趟 | **无 diamond 分支**（同上，零命中） | **无 diamond 分支**（同上） |

**关于「引擎B平开 diamond 分支语义可疑」的核实**：不是可疑写法，就是普通的键存在性判断——
`Object[_0x11f592(419){prototype}].hasOwnProperty[_0x11f592(438){call}](parts, k)`，token 419=`prototype`、438=`call`。
与 oldSheet平开 @531600 的写法逐字符相同。**判定：语义正常**（按固定 4 个键取部件）。

---

### 16.6 可直接照抄的对照表

| 维度 | 引擎B平开 | 引擎B吊趟 | oldSheet平开 | oldSheet吊趟 |
|---|---|---|---|---|
| doorframe 分组 | 门框高→门框宽→前框→后框→门板 | 轨道组→套线组 | 门框→前框→后框→门板 | 轨道组→套线组 |
| 套线名段 | 无 | **有**（轨道组后） | 无 | **有**（轨道组后） |
| 杉杉 `<br>` 变体 | 有 | 有 | 无 | 无 |
| windows 关键词 | 扣板/上亮横/上亮窗玻璃/压线 | 中柱/亮窗玻璃/槽/压线 + 扣板(≠扣板厚) | 扣板/上亮横/压线/封板/上亮窗玻璃 | 中柱/亮窗玻璃/压线（亮窗段）+ 槽/封板高/封板宽（主体）+ 扣板 |
| windows 排序 | entries | entries | entries | **priority（槽=0,封板高=1,封板宽=2）** |
| 扣板厚拼接 | 无 | **有**，`*<br>` | 无 | **有**，普通 `*` |
| 玻璃件折半 | `Math.round(q/2)` | `q/2`（无 round） | `Math.round(q/2)` | `q/2`（无 round） |
| 一固一活→1 / 双活→2 | windows 无；doorsheet 有 | **有**（亮窗类+扣板组） | 无 | **有**（主体段） |
| `0<x<1 → 1` 钳位 | 无 | **有**（亮窗类+扣板组） | 无 | **有**（亮窗段+主体段+扣板段） |
| 亮窗段独立覆盖 | 无 | 无 | 无 | **有**（仅 `亮窗总高 > 门洞高`） |

### 16.7 未确定项

- 引擎B吊趟 / oldSheet吊趟 的 **diamond 段**：已全段检索确认**零命中** → 这两条路径没有 diamond 专用分支，diamond 行若进入会走普通轨道路径（**上游是否会把 diamond 行送进吊趟表，未确定**）。
- `_0x268723`（oldSheet吊趟扣板组里的门店变量）与 `_0x269d2a` 是否同一变量：**不影响结果**——该处三分支文本完全相同。
- 引擎B吊趟 `上滑`/`上轨` 的 `replace()` 是否会产生空串（当 `materialName` 恰为 `上滑` 时 `replace('上滑', 轨道种类)` → 只剩轨道种类）：按代码是，未实测。

---

## 17. 第六轮：回执表头两小项核实（2026-09-10）

| 审计条目 | 核实结果 | 处置 |
|---|---|---|
| #32 回执 `address` | **确有问题**。原版 `address = 订单安装地址 ? E : 客户地址`，其中 `E = [...new Set(各行安装地址)].join("_")`；且逐行生成时 `!行.安装地址 && (行.安装地址 = 订单安装地址)` 先回填。我原来是 `订单安装地址 \|\| 行聚合(、「、」连接)` —— **分支反了、分隔符也错**。 | 已改：`installAddresses` 改为「每行取 `行地址 \|\| 订单地址`，去重后 `_` 连接」；`orderInstallAddress = 订单安装地址 ? 该聚合 : 客户地址(取自客户资料 `address`)` |
| #29 回执 `total` 取整 | **非问题**。原版 `B = Math.round(Σ行金额)`，而我们的行金额本身已是整元（`Math.round(基准×打折)`），`Σ` 天然为整数，`round2` 与 `Math.round` 结果相同。 | 不改 |
| #30 回执行 `openImg` 平开归一化 | **非问题**。`getOriginalOpenDirection`（`openDirectionNaming-92dbc91d.js`，读 localStorage 自定义命名表）作用是把**自定义显示名反查回原始 key**；我们存的就是原始 key（自定义名只用于显示），故 `PING_DIRECTION_IMAGES[l.direction]` 与原版等价。 | 不改 |
| #31 回执行排序 | 原版按 `localStorage.smartdoor_sort_method === 'order'` 决定：按 `OrderID` 数字前缀排序，否则按 `produce.timestamp`（即算料先后）。我们沿用订单行原序。 | **未做**，待确认是否需要 |

经核实**不是问题**的条目从待办里划掉，避免后续重复排查。

---

## 18. 第七轮：doorframe / windows 四引擎落地（2026-09-10）

### 18.1 实现

新增 `doorframeText(l, oldSheetEngine)` 与 `windowsText(l, oldSheetEngine)`，逐条按 §16 规格实现；
`productionProduces` 传 `false`（引擎B）、`oldSheetProduce` 传 `true`（引擎D/E2）。

**同时删除了旧的整套正则分组机制**：`PING_RULES` / `DIAO_RULES` / `DIAMOND_RULES` / `groupPart` /
`partOrder` / `frameText` / `windowsPartText` / `partText`（以及两个 builder 里因此失效的 `parts`、`pick`）。
现在四列的取部件逻辑**全部由显式关键词驱动**，不再有正则近似。

### 18.2 落地时按原版照抄的几处「反直觉」行为（不要当 bug 改掉）

| 位置 | 行为 |
|---|---|
| doorsheet（四引擎） | 「玻璃高」项前**额外加一个 `<br>`** → 打印出来会多一空行 |
| windows 引擎B吊趟 / oldSheet吊趟 扣板组 | 行内**没有「扣板厚」件**时按 `l = 0` 走 else 分支 → 文本成 `{名}:{result}*0*{数量}` |
| windows 引擎B吊趟 扣板组 | 扣板厚用 `*<br>` 分隔（`{名}:{result}*<br>{扣板厚}*{数量}`），**不是**普通 `*` |
| windows oldSheet吊趟 | 扣板厚用**普通 `*`**；亮窗段**直接覆盖**而非追加；主体段拆「非玻璃/玻璃」两组，中间夹扣板组 |
| doorframe 吊趟 | 件名含 `滑`/`左右盖板`/`轨道盖板` 且 `轨道长>0` → **覆盖 result**；含 `边封` 且 `边封数 != null` → **覆盖 quantity** |
| doorframe 吊趟 套线组 | 「包高」件在 前/后包加长>0 时拆成两行，且 quantity **÷2**（无 round） |
| windows oldSheet吊趟 亮窗段 | `亮窗玻璃` 且 `底玻==='无'` 时乘 `Q/2`（用**行数量**而非件数量） |
| windows oldSheet吊趟 主体段 | 全四引擎中**唯一**按「关键词下标」排序的地方（`槽=0, 封板高=1, 封板宽=2`） |

### 18.3 有意未实现的

- **杉杉铝木极简门**的 `{名}:<br>{result}` 变体（引擎B 两套的 doorframe/windows/doorsheet 各有一处）：单门店特判，与「不要白名单常量」的既定决策一致，未加。
- **`kou` 列**（引擎B平开/吊趟各有一个 `kou` 字段）：现有 17 张模板均无此列，未实现（规格见 §16.1/§16.2 备查）。
- **钻石型**：仅平开两套有分支（固定 4 键 左边/右边/斜长/竖框）；吊趟两套**无 diamond 分支**（子代理已全段检索 `(986)`/`"diamond"` 零命中）。

---

## 19. 第八轮：`配件:` 段落地（跨全部 produce 构造器）

### 19.1 原版行为（原始 chunk 实证）

```js
// @320533
_0xc8b731 = (row, 公式) => {
  const x = typeof 公式?.hardware === 'string' ? 公式.hardware : ""
  if (x === "") return
  const a = "配件:" + String(x).replace(/\r\n/g,"\n").replace(/\r/g,"\n").replace(/\n/g,"<br>")
  row.remark ? (row.remark += "<br>" + a) : (row.remark = a)
}
```

调用点共 **8 处**，即全部 produce 构造器（`_0xcfde65` @465712 / `_0x4d28ce` @476617 /
`_0x551a25` @497142 / `_0x500ef9` @517630 / `_0x34f4ac` @536288 / `_0x192067` @555882 /
`_0x4495e3` @571710 / `_0x1239ce` @586372）。

**关键**：第二个参数是**公式对象**（`const 公式 = 公式表[行.formulaid]; if(!公式) continue; ... _0xc8b731(ROW, 公式)`），
不是订单行 —— 所以 `配件:` 取的是**公式级** `hardware`，与行上的「五金」字段无关。
标签类构造器（`lable` / `product10`）**不调用**它。

### 19.2 落地

新增 `appendAccessory(remark, l)`，读 `formulaOf(l)?.extra.hardware`，追加到
`produceRemark`（引擎B平开/吊趟）、`glassRemark`（引擎A）、`oldSheetRemark`（D/E2）、product1 行 remark 的末尾。

> ⚠️ 与既定决策的关系：此前用户指示「去掉 extra.hardware」，那是针对**五金下拉候选**（`app/src/views/Hui.vue` 里
> 有一行注释「无内置预设、不读 extra.hardware」）。本次是把它用于**打印 remark 的 `配件:` 段**，
> 是原版明确存在的另一处用途，两者不冲突。若不符合预期，删掉 `appendAccessory` 的四次调用即可。

### 19.3 未能验证的

想从生产端反查公式是否真有 `hardware` 字段，但 `initializPing` 的 `material` 返回**空对象**、
`queryFormula&param3=<n>` 全部 404（拿不到有效 formulaId），**探测失败**。
现有依据只是旧版代码本身 + 我们库里 `extra.hardware`（测试公式 "123" = `"1\n2\n3\n4\n"`）。

---

## 20. 第九轮：门店白名单 / 杉杉变体 / glassHole doorImg（严格按源码补齐）

用户指示「完全按照代码反推的改」，故把此前按「不要白名单常量」判断略过的分支一并补齐。

### 20.1 门店名单来源（原始 chunk @316101）

```js
_0x269d2a = getUserData().userinfo.registrant        // 门店名
_0x743794 = [ ...44 家... ]                          // 名单一
_0x2fca47 = ['艺佳家居门业','索力纳门窗']              // 名单二
```

名单一 `_0x743794` 共 **44 家**（源码顺序）：万鑫门业、德清顾家、锦致轩门业、欧盾门业、吉雅轩门厂、极简移门、
恒业门窗、南海移门、金雅轩门窗、度勒门窗、鑫豪轩门业、广乐名门、鑫瑞门业、圣诺派门业、帝奥名门、美高移门、
鑫源移门加工厂、鑫源名门、皇丞门窗、宏泰门业、天润门业、铂卫邦铝门、欧莱富移门、顾轩门窗、润佳门窗、
宜居门窗厂、欧铂尊门业、鑫美龙家居、皓雅门窗、富嘉名门、珊珊极简移门、華宇推拉、立泰金属制品有限公司、
皇牌博雅铝门窗厂、爱德益钛镁合金厂、宏辉门窗、华顺门业、喜迎门移门、天成门业、煜宸门业、粤诗丽门窗、
浩扬移门、嘉和门业、美固建材经营部。

### 20.2 落地

| 规则 | 实现 |
|---|---|
| `_0x743794.includes(门店名)` → `door` 列**不含客户名**（只 `[型材,颜色]`） | `STORE_DOOR_NO_CLIENT` 常量 + `productionProduces` 三目 |
| `门店名 === '杉杉铝木极简门'` → 部件文本 `{名}:<br>{result}` 而非 `{名}:{result}` | `partLine(name, rest)` 助手，接入 **引擎B平开/吊趟** 的 doorsheet、doorframe（含吊趟下滑分支）、windows（亮窗类+扣板组） |
| glassHole 亮窗行 `doorImg` **恒为空** | `glassInfoProduces` 亮窗行覆盖 `doorImg: ''` |

**杉杉变体只出现在引擎B 两套**：oldSheet（D/E2）两套与引擎A 都没有（源码逐处确认）；平开 windows 也没有。

> ⚠️ 对**本租户（昊艺门窗）**：两个名单都未命中、杉杉变体不触发 —— 这几处**当前是惰性分支，零行为变化**。
> 此前用户曾指示「不需要白名单常量这个功能」；本次按「完全按代码反推」补齐，若要去掉，删 `STORE_DOOR_NO_CLIENT`
> 常量与 `partLine` 里的门店判断即可。

### 20.3 仍未做

- **名单二 `_0x2fca47`（艺佳家居门业 / 索力纳门窗）**：命中时 glassHole 的 `doorImg` 不走公式挖孔图，
  而是用内置函数 `_0x5c8c94(h, w, d, 左|右)` **现场生成一张 SVG 门洞图**（`data:image/svg+xml;charset=utf-8,` + encodeURIComponent）。
  同样是本租户不命中的惰性分支，且需移植约 30 行 SVG 模板，**未实现**。
- product10 的部件级复制张数（`GlassSize_*` 分支 + `BoLiKuan.quantity`）、product4（料标签 mode 11）独立入口、行排序。

---

## 21. 第十轮：product10 复制张数 + 回执行排序 + product4 数据缺口

### 21.1 product10 复制张数（已实现）

原版 mode 10（`_0x336291`，@401676）**不用 lable 那套份数算法**：

```js
if (公式部件名.includes('BoLiKuan') && 公式部件名.includes('BoLiGao')) {
   const keys = Object.keys(row).filter(k => k.startsWith('GlassSize_'))
   if (keys.length) { keys.forEach(k => { const o = parseInt(row[前缀+'BoLiKuan'].split('*')[1] || '1', 10)
                                          for (let c=0;c<o;c++) out.push({...row, GlassSize: row[k]}) }) }
   else { const n = parseInt(row[第一个 BoLiKuan].split('*')[1] || '1', 10)
          for (let c=0;c<n;c++) out.push({...row}) }
} else out.push({...row})
```

即：**仅当公式部件同时含「玻璃宽(BoLiKuan)」与「玻璃高(BoLiGao)」时**，张数 = 玻璃宽部件的
**quantity**（部件值格式由 `_0x57cedf` 生成为 `{result}*{quantity}`，取 `split('*')[1]`），否则 1 张。

实现：新增 `product10Copies(l)`，`labelRows('product10')` 用它替代 `labelQuantity`（`lable` 仍用 `labelQuantity`）。

### 21.2 回执行排序（已实现）

原版（@521303 平开 / @559514 吊趟）：

```js
const 排序 = rows => rows
  .filter(r => r.formulaid && r.formulaid.trim() !== '')          // ← 先剔除没有公式的行
  .sort((a,b) => a.formulaid !== b.formulaid
       ? a.formulaid.localeCompare(b.formulaid)
       : (a['颜色'] || '').localeCompare(b['颜色'] || ''))
// 先 push 全部平开行（且仅当 showPingkai），再 push 全部吊趟行（且仅当 showDiao）
```

实现：新增 `receiptOrderedLines()`，**页面回执预览与 hiprint 打印共用同一顺序**。

> ⚠️ 两个可见影响：① **没有公式（`formula_id` 为空）的订单行不会出现在回执单上**；
> ② 在「更多功能」里把某张表**隐藏**后，该表所有行也不进回执单。均为原版行为。

### 21.3 product4（料标签，mode 11）—— 数据缺口，未实现

原版 mode 11 用 `template.product4` 承载 `lableForMaterial`（`_0xff5572`）产生的**标签行**。
但**我们库里的 `product4` 模板与 `product5–9` 逐字节相同**（md5 全等 `4c30cbc4…`），且版式是
**`produces` 表**（列 door/doorImg/OrderID/basicInfo/lockImg/doorsheet/doorframe/windows/remark），
**不是标签版式**。也就是说「料标签」那张模板没有随 `getTemplates` 导进来。

因此 `product4` 目前仍走 `productionProduces()`（与 product5–9 一致）—— 这是**在现有模板数据下唯一合理的路由**；
要真正实现料标签，需要先拿到旧版那张模板 JSON。

---

## 22. 第十一轮：**上一轮回执排序改错了，已回退** + 两条非问题

### 22.1 ❌ 更正：§21.2 的回执排序是我们的错误实现（已回退）

§21.2 依据审计 §1.3「回执构造前先按 `formulaid` → `颜色` 排序」做了实现。**该结论是错的**：

- **回执构造器（`_0x32252d`，offset 335271–360559）区间内 `.sort(` 出现 0 次** —— 回执**不排序**。
- 那段 `formulaid.localeCompare` 排序属于**生产单构造器**（`calculateReceipt` @521303 / `calculateReceiptOld` @559514），不是回执。
- 回执**也不会剔除缺 `formulaid` 的行**；相反它是**先回填**：
  `型材 && !formulaid && (formulaid = pingTable.material[型材])`（@350045 / @354234），行照常输出。

**已回退为**：`receiptOrderedLines()` 只做「按表显示开关纳入 + 平开行在前、吊趟行在后」，**保持表格原序、不过滤**。

回执**确实有的**两处行为（保留）：
- 分块门控 `if (showPingkai && pingTable)`（@348915）/ `if (showDiao && diaoTable)`（@353436）—— 表被隐藏则其行不进回执；
- 安装地址回填（`!行.安装地址 && (行.安装地址 = 订单安装地址)`）。

> 教训：审计报告里凡「声称原版有排序/过滤」的结论，都要在**那个具体函数区间内** grep 验证，不能跨函数套用。

### 22.2 两条经核实**非问题**

| 项 | 结论 |
|---|---|
| 日期格式 `_0x44ed1d` | @329811：`getFullYear() + "-" + pad(getMonth()+1) + "-" + pad(getDate())` → **`YYYY-MM-DD`**，与我们的 `today()` 逐字符一致。不改。 |
| glassHole 行排序 | 默认**不排序**；仅当 `localStorage.smartdoor_sort_method === 'order'` 时按 `parseInt(OrderID.split('-')[0])` 升序（@453705）。本系统无该设置 → 走默认，不改。 |

### 22.3 `_0xa370fc` 的真实含义（更正）

审计 §6 写作「`_0xa370fc ? "" : ...` 置空开关」。实际（@411200）是**门店名单**：

```js
_0xa370fc = 门店名 === '皇帥滑动门' || 门店名 === '尚航逸门窗' || 门店名 === '嘉博门业'
```

命中时 glassHole 的 `remark` 整列为空串。本租户不在其中，**当前行为正确**；按「完全按代码」可将该三门判补上（惰性分支）。

### 22.4 本轮补齐的三处（严格按源码）

| 项 | 原版 | 落地 |
|---|---|---|
| `pricingDetail` 分支 | `计价方式==='套' && 单价>0` / `==='方' && 单价>0` **两个显式分支**；其它值（含空）都不走，只可能剩套线金额与加价项目 | 由「非方即套」改为两个显式分支 |
| product1 `kouWidth`/`kouHeigth`（@570279） | `店名 === '晟斐门窗厂'` → `kouHeigth = 套线种类`，且 `kouWidth` 不再赋值（两个常规赋值都在 `else` 里） | `STORE_SHENGFEI` 常量 + 三目 |
| glassHole `remark`（@411200 `_0xa370fc`） | `店名 ∈ {皇帥滑动门, 尚航逸门窗, 嘉博门业}` → `remark` 整列为空 | `STORE_NO_GLASS_REMARK` 常量 |

> 同 §20 的说明：这三处对**本租户（昊艺门窗）均为惰性分支**，零行为变化；按「完全按代码反推」补齐。

### 22.5 回执 `orderQrcode` token 公式（已修正）

原版（@448151 邻近）：

```js
if (客户名 && 客户编号 && userdata) {
  const e = Date.now() + 888
  const t = userdata.userinfo.ds
  let a, x
  t === 'smartdoor' ? (a = 1000, x = 7*Number(客户编号) + 1987)
                    : (a = Number(t.split('smartdoor')[1]) + 1000, x = 7*Number(客户编号) + 1987)
  token = String(a) + "af" + String(x) + "wy" + String(e)
}
orderQrcode = 'https://www.samrtdoor.com.cn/login?param1=' + encodeURIComponent(客户名)
            + '&param2=' + token + '&receiptNo=' + encodeURIComponent(回执单号)
```

我们原来是 `a = tenantId + 1000` —— **原版根本没有用 tenant.id**，`a` 只由 `ds` 决定（`ds==='smartdoor'` → **1000**）。
已改为按 `ds` 计算（`TENANT_DS`）。

> 另注：原版 `orderQrcode` 的 URL 基址是 `https://www.samrtdoor.com.cn/login`（指向旧系统）。
> 我们生成的是**本系统**的 `/terminal?...` 链接（功能等价但域名不同）——这是有意为之，未改。

---

## §23 glassHole 行构造器完整骨架

来源：`legacy/js/Hui-d088417c.js`，函数 `_0x509b06`（暴露名 **`Glasslist`**，打印模式 3），范围 @410165–455394。
所有 accessor 为 `_0x46841d` → `_0x43b0d8`（tokens.json 表，已自证）。

### 23.1 顶层骨架

```
_0x509b06 = async () => {
  _0x85a3a.value = 3
  const 公式表 = await fetch(getFormulas) ; _0x239303 = data.formulas ; _0x1a364c = data.orderNumbers
  let _0x85408 = []                     // @411808 行数组
  Object.keys(_0x4d19f5).forEach(k => delete _0x4d19f5[k])     // @411847
  // ① 平开循环  @411892
  for (i = 0; i < ping_hui.length; i++) {
      _0x2c0817 = ping_hui[i]
      if (!公式表[_0x2c0817.formulaid]) continue                  // @412121 唯一 continue
      ... 算料 ...
      <B1> <B2> <B3亮窗> <B4钻石>
  }
  // ② 吊趟循环  @433886
  for (i = 0; i < diao_hui.length; i++) {
      _0xae1cd3 = diao_hui[i]
      if (底玻==='无' && 面玻==='无') continue                     // @434121
      if (!公式表[_0x4c173d]) continue
      ... 算料 ...
      <D1> <D2> <D3亮窗>
  }
  // ③ 收尾 @453705
  _0x85408 = _0x85408.filter(e => 0 !== Number(e.thickness))       // 丢弃厚度为 0 的行
  if (localStorage.smartdoor_sort_method === 'order') 按 OrderID 数字前缀排序
  else 不改（保持 push 顺序）
  _0x164736 = { date: _0x44ed1d(new Date), glassInfoList: _0x85408 }   // @454014
}
```

### 23.2 ★ 核心结论：ping 的两个顶层块 **不互斥**

@425665 的原文（第一块收尾 + 第二块开头，**中间没有 `else`、没有 `}`**）：

```js
 ..._0x85408[_0x46841d(447){push}](e)  }  if( "无"!==(null==_0x2c0817?void 0:_0x2c0817["面玻"]) && _0x238851!==_0x46841d(986){diamond} )
                                          ^^^^ 直接跟 if，无 else
```

对照第一块 @420625：`if("无"!==(...底玻) && _0x238851!=='diamond')`。

**判定：两块是同一作用域内两个独立的 `if` 语句。**

⇒ 当 `底玻 !== '无' && 面玻 !== '无' && formulaType !== 'diamond'` 时，**两块都会执行，各自 push 一行**：
- 两行的 `width` / `height` / `quantity` **完全相同**（都取同一组 `玻璃宽`/`玻璃高` 部件，同一算式）
- 只有 `glassName` 不同：`底玻-{底玻}` vs `面玻-{面玻}`
- `remark` / `doorImg` / `thickness` / `OrderID` 也相同

⇒ **每行双玻玻璃出 2 条 glassHole 记录**；单玻（另一面为 `无`）时只有对应那一块走"正常"分支，另一块走 `else` 分支 —— 也是 2 条，但内容不同（见 23.3 的 B1.else / B2.else）。
⇒ 末尾 `thickness !== 0` 的 filter **不会**把重复行去掉（两条 thickness 相同）。

**这是我们实现里最需要改的一条**：我们目前只出 1 行。

### 23.3 ping（平开）四组块 + 每块的分支与字段

行对象字面量恒为 `{OrderID:"",client:"",glassName:"",width:0,height:0,thickness:0,quantity:0,doorImg:"",remark:""}`。

`remark` 全路径统一：`_0xa370fc ? "" : [行.备注, 行.安装地址].filter(Boolean).join("<br>")`（`<br>` = token 1144）。
`_0xa370fc`（@411200）= 门店名 ∈ {皇帥滑动门, 尚航逸门窗, 嘉博…（其余见源码）}。
`thickness` = `行.玻璃厚`；`OrderID` = `行.单号 || ""`；`client` = `行.客户`。

#### B0 图片/尺寸预处理（@418159–420554）
```
_0x3a3de5 = _0x286ba9 = _0x5692f6 = _0x26a75e = _0x551056 = ""; _0x169a2c = null
if ('挖孔图' in 部件表) try {
   _0x26a75e = 开向.includes('双开')
        ? (开向.includes('左') ? formulaID+'双开左'+(轨道种类?'_'+轨道种类:'')
           : 开向.includes('右') ? formulaID+'双开右'+(轨道种类?'_'+轨道种类:'')
           :                     formulaID+'双开左'+(轨道种类?'_'+轨道种类:''))
        : formulaID + 开向 + (轨道种类?'_'+轨道种类:'')
   if (Number(行.封板高)>0 || 开向 ∈ {双开内开,双开外开,双开内左,双开内右,双开外左,双开外右}) {
       const {imageUrl, imageName, holeSize} = await getImageWithMeta(_0x26a75e)
       if (imageName.includes('_孔') && holeSize) {
           {w,h,d,r} = holeSize
           const c = max(0, d - (Number(行.封板高)||0))
           // 左右翻转：r===1 时取反，否则按开向含左/右
           _0x169a2c = {w: h, h: w, d: c, direction: '左'|'右'}
           _0x3a3de5 = _0x5c8c94(h, w, c, direction) || imageUrl       // _0x5c8c94 = SVG 生成器 @316751
           if (开向 ∈ {双开内开, 双开外开})
               _0x551056 = _0x5c8c94(h, w, c, direction==='右'?'左':'右') || imageUrl
       } else _0x3a3de5 = imageUrl
   } else _0x3a3de5 = await getImage(_0x26a75e) || ""
   // 若 _0x3a3de5 为空 → ElMessage.error('获取开孔图片失败,请确认或联系管理员')
   if (门店 ∈ _0x2fca47 /*['艺佳家居门业','索力纳门窗'] @316709*/)
       _0x551056 = _0x169a2c ? (_0x5c8c94(h,w,d, direction==='左'?'右':'左') || "")
                            : (await getImage(formulaID + 左右互换后的开向 + (轨道种类?'_'+轨道种类:'')) || "")
   if (formulaType === 'diamond')
       _0x286ba9 = await getImage(formulaID + '右固玻') || "",
       _0x5692f6 = await getImage(formulaID + '左固玻') || ""
} catch { ElMessage.error('获取开孔图片失败,请确认或联系管理员') }
```
注意 `_0x286ba9` = **右固玻**、`_0x5692f6` = **左固玻**（与 §16 之外的直觉相反），下面对应关系见 B4。

> **2026-09-16 落地修正（本轮才发现的两处取图缺口）**
>
> 1. **双开族的图键不是开向本身。** 键构造逐字是
>    `开向.includes('双开') ? (开向.includes('左') ? '双开左' : 开向.includes('右') ? '双开右' : '双开左') : 开向`
>    —— 而汇算行开向是 `双开内开/双开外开/双开内左/双开外左/双开内右/双开外右`，
>    **画图端（Glass_draw 锁向下拉）只提供 `双开左` / `双开右`**。
>    原先 `holeImageOf` 直接拿开向当键 ⇒ **双开门六种开向全部取不到图**（内开外开一样白）。
>    已改为 `holeKeyOf(开向)` 映射。原版还会在 `轨道种类` 非空时追加 `_{轨道种类}`；
>    新系统公式图按 `(formula_id, direction)` 存、无该维度，故不追加。
> 2. **B4 三行的图不是同一张。** 左固玻璃 = `{formulaID}左固玻` 图、右固玻璃 = `{formulaID}右固玻` 图、
>    门玻璃 = 行挖孔图。原先三行都填行挖孔图，已改。`左固玻`/`右固玻` 同样是画图端的两个键。
>
> 3. **内开/外开：不做归一，各方向各一张图（2026-09-16 直连旧版服务端实测定论）。**
>    取图是精确匹配 —— 原版把 `formulaID + 开向` 原样交给 `param1=getimage`，**服务端也不归一**。
>    实测（`param1=getimage&param2={formulaID}{方向}&param3=昊艺门窗`）：
>
>    | 公式 | 左锁内开 | 左锁外开 | 右锁内开 | 右锁外开 | 内左/外左… |
>    |---|---|---|---|---|---|
>    | `35*16平开` | 200 · sha `53a0cec4…` | 200 · **sha 相同** | 200 · sha `1253bfde…` | 200 · **sha 相同** | 404 |
>    | `复古平开门` | 200 | **404** | 200 | **404** | 404 |
>
>    `35*16平开` 两个方向**字节完全相同** ⇒ 店家是给两个方向**各存了一张内容一样的图**，
>    看起来「内开外开一样」是**数据如此**，不是取图兜底；`复古平开门` 只传了内开 ⇒ 外开就是 404。
>    结论：**公式没画过某方向时原版就是空图 + 报「获取开孔图片失败,请确认或联系管理员」，我们必须一致。**
>
>    ⚠️ 本轮教训（两次来回）：先据「前端 chunk 里没有内↔外替换」断言原版无兜底 → 被用户实测推翻 →
>    又据「服务端可能归一」加了个兜底 → **直连旧版实测发现还是错的，已撤销**。
>    两次都错在**用间接证据替直接证据**：能直连旧版跑一次接口时，就别停在读代码推行为上。

#### B1 `if (底玻 !== '无' && formulaType !== 'diamond')` @420625

| 子分支 | 条件（偏移） | 推几行 | 命中部件（`find`） | width/height | quantity | glassName | doorImg |
|---|---|---|---|---|---|---|---|
| B1.a 子母 | `formulaType==='parentSubsidiary'` @420703 | 1 | `子门玻璃宽`(549) / `子门玻璃高`(798)，均 `&& !includes('亮窗')` | `t[1].result` / `a[1].result` | `名.includes('单玻') ? q*Q : q/2*Q` | `"底玻-" + 行.底玻` | `""` @421571 |
| B1.b 双玻+有图 | `formulaType==='double'` 且 `_0x3a3de5` 真 @422488/422517 | 1 | `玻璃宽`(863) / `玻璃高`(877)，均 `&& !includes('亮窗')` | 同上 | `名.includes('单玻') ? q*Q/2 : q/4*Q` | `"底玻-" + 行.底玻` | 见下（三目） |
| B1.c 双玻+无图 | `formulaType==='double'` 且 `!_0x3a3de5` @423766 | 1 | 同 B1.b | 同上 | `名.includes('单玻') ? q*Q : q/2*Q` | `底玻-`(373) + 行.底玻 | `""` @424589 |
| B1.d else（`底玻==='无'` 或 diamond） | @424638 | 1 | 同 B1.b | 同上 | `名.includes('单玻') ? q*Q : q/2*Q` | `"底玻-" + 行.底玻` | 三目（下） |

> **注意 B1.d**：进入条件是 `底玻==='无' || diamond`，但它仍然输出 `底玻-{底玻}`（即 `底玻-无`）。这是原版行为。

**B1.b / B1.d 的 doorImg 三目**（@425520 / @425597 / @425625）：
```js
_0x2fca47.includes(_0x2d4eee) && _0x551056 ? e.doorImg = _0x551056
: !_0x2fca47.includes(_0x2d4eee) && _0x3a3de5 ? e.doorImg = _0x3a3de5
: e.doorImg = ""
```
（`_0x2d4eee` = 门店名 = `userdata.userinfo.registrant`；`_0x2fca47` = `['艺佳家居门业','索力纳门窗']`）

#### B2 `if (面玻 !== '无' && formulaType !== 'diamond')` @425666

子分支条件与 B1 **一一对应**（`parentSubsidiary` / `double`+`_0x3a3de5` / `double`无图 / `else`），
**宽度/高度/quantity 算式与 B1 对应分支逐字符相同**，唯一差别是 glassName：

| 子分支 | glassName |
|---|---|
| B2.a 子母 @425778 | `面玻-`(1077) + 行.面玻 |
| B2.b 双玻+有图 @427603 | `"面玻-" + 行.面玻` |
| B2.c 双玻+无图 @428882 | ⚠️ **`底玻-`(373) + 行.底玻** —— 原文如此，疑似原版拷贝粘贴遗留（与该块的"面玻"语义矛盾，但代码就是这样） |
| B2.d else @429727 | `面玻-`(1077) + 行.面玻 → 但 doorImg 是 `e.doorImg = _0x3a3de5 \|\| ""`（**无三目**，与 B1.d 不同） |

B2.c 的 doorImg = `""`（@429678）；B2.b 的三目与 B1.b 同构。

#### B3 亮窗 @430619（单块，只 push 1 行）

```js
if (行.亮窗总高 && 0 !== 行.亮窗总高 && formulaType !== 'diamond'
    && (面玻 !== '无' || 底玻 !== '无')) {
   t = find(名.includes('亮窗玻璃宽'))
   a = find(名.includes('亮窗玻璃高'))
   width    = t ? t[1].result : 0
   quantity = t ? x.quantity * Q : 0            // ← 注意用的是 x.quantity*Q，不是 x.quantity/2*Q（与吊趟不同）
   height   = a ? a[1].result : 0
   glassName = 底玻 !== '无' ? "亮窗玻璃-" + 行.底玻 : "亮窗玻璃-" + 行.面玻
   doorImg = ""                                  // @431541
   push
}
```

#### B4 钻石 @431590（单块，push 3 行）

| # | 命中部件（精确 `===`，非 includes） | quantity | glassName | doorImg |
|---|---|---|---|---|
| 1 | `左固玻璃宽`(==) @431650 / `左固玻璃高`(==) @431701 | `1 * Q` | `左固玻璃-`(395) + 行.底玻 | `_0x5692f6`（= **左固玻** 图）@432036 |
| 2 | `右固玻璃宽`(612) / `右固玻璃高`(553) | `1 * Q` | `右固玻璃-`(1147) + 行.底玻 | `_0x286ba9`（= **右固玻** 图）@432314 |
| 3 | `门玻璃宽`(981) / `门玻璃高`(597) | `1 * Q` | `"门玻璃-" + 行.面玻` | `_0x3a3de5 \|\| ""` @432342 |

（三行都无条件 push，只要进了 diamond 块；width/height 部件找不到时保持 0。
B4 与 B1/B2/B3 同层，**B1/B2 在 diamond 时走 else 分支，B3 被 `!== 'diamond'` 排除**，所以 diamond 行只出 3 条。）

### 23.4 diao（吊趟）三组块

吊趟循环行变量 `_0xae1cd3`，部件表 `_0x13d99a`（与 ping 的 `_0x2f045e` 来源同构）。
`remark` 同 ping 规则；`thickness` / `OrderID` / `client` 同 ping。

#### D1 `if (底玻 !== '无' && 扇数 !== '一固一活' && '双活' !== 扇数)` @440708
```
t = find(名.includes('玻璃宽') && !includes('亮窗') && !includes('玻璃宽小'))
a = find(名.includes('玻璃宽小') && !includes('亮窗'))
x = find(名.includes('玻璃高')   && !includes('亮窗'))
// 挖孔图：左图 _0x2e5408 = getImage(formulaID+'左')，右图 _0x51ee96 = getImage(formulaID+'右')
// 并按 扇数/开向 推出扣减量 _ 、l（单轨2扇/双活/2轨2扇/2轨3扇/3轨3扇/4轨4扇/5轨5扇/6轨6扇/3轨4扇 → _|=1；2轨4扇、3轨6扇 → |=2）
o = t ? (t名.includes('单玻') ? tq*Q - _ - l : tq/2*Q - _ - l) : 0
if (o > 0) → push { width: t.result, height: x.result, quantity: o, glassName: '底玻-'+底玻, doorImg: _0x2e5408 }
c = a ? (a名.includes('单玻') ? aq*Q - _ - l : aq/2*Q - _ - l) : 0
if (c > 0) → push { width: a.result, height: x.result, quantity: c, glassName: '底玻-'+底玻, doorImg: _0x2e5408 }   // '玻璃宽小'
if (_ > 0) → push { …, quantity: _, glassName: '底玻-'+底玻, doorImg: _0x2e5408 }
if (l > 0) → push { …, quantity: l, glassName: '底玻-'+底玻, doorImg: _0x51ee96 }                                  // @445065
```
（`a` 命中时先 `ElMessage.warning('带孔图不支持大小扇玻璃生成')` 且不做图片推导。）

#### D2 `if (面玻 !== '无')` @445352
结构与 D1 镜像，`glassName`：`扇数.includes('一固一活') ? '门玻-' + 面玻 : '面玻-' + 面玻`（@450681 / @451452）。
doorImg 同样 `_0x2e5408` / `_0x51ee96`。

#### D3 亮窗 @451863（**两个独立 `if`，可各推 1 行**）
```
if (行.亮窗总高 && 0 !== 行.亮窗总高) {
   if (底玻 !== '无' && !扇数.includes('活')) {
       t = find(includes('亮窗玻璃宽')); a = find(includes('亮窗玻璃高'))
       width = t.result ; quantity = t.quantity/2*Q ; height = a.result          // ← 除以 2，无 Math.round
       glassName = '亮窗底玻-'(1141) + 底玻 ; doorImg = ""        @452730
   }
   if (面玻 !== '无') {
       t = find(includes('亮窗玻璃宽')); a = find(includes('亮窗玻璃高'))
       width = t.result
       let q = t.quantity/2*Q ; if (q < 1) q = 1                                 // ← 钳位
       quantity = q ; height = a.result
       glassName = 扇数.includes('活') ? '亮窗玻璃-' + 面玻 : '亮窗面璃-'(557) + 面玻   @453654
       doorImg = ""
   }
}
```
⚠️ 两处 glassName 前缀是 `亮窗底玻-` 与 `亮窗面璃-`（"面璃"是原文错字，token 557），**不是**"亮窗玻璃-"。

### 23.5 两处确认项

1. **@434121 `if('无'===底玻 && '无'===面玻) continue;`** —— 属于**吊趟循环**（`_0xae1cd3 = diao_hui[i]`）。
   **平开循环没有同样的 continue**（平开循环里唯一的 continue 是 @412121 的 `if(!公式表[formulaid]) continue;`）。
   ⇒ 平开表里 双玻皆"无"的行**仍会进入** B1.d / B2.d 两个 else 分支各推一行（`glassName` 为 `底玻-无` / `面玻-无`），**但会在 @453705 被 `0 !== Number(thickness)` 过滤掉**（玻璃厚通常为 0）。
   ⚠️ 若某行 双无 但 玻璃厚 > 0，平开会推出 `底玻-无`/`面玻-无` 两条记录 —— 与原版一致。

2. **@453705 之前是否还有别的过滤/追加** —— 从 @433886 的吊趟循环结束到 @453705 之间没有其它语句；@453705 之后依次是 `filter(thickness!==0)` → `if (smartdoor_sort_method === 'order') 按 OrderID 数字前缀排序` → `_0x164736 = {date, glassInfoList}`。
   行数组没有 `.map`/`.flatMap` 之类的二次加工。

### 23.6 与我们实现的差异（`Hui.vue` `glassInfoProduces` H3293）

| # | 差异 | 原版 | 我们 |
|---|---|---|---|
| 1 | **双玻出 2 行** | 两块互不排斥，双玻各推一行 | 恒 1 行 |
| 2 | 亮窗 glassName 前缀 | `亮窗底玻-` / `亮窗面璃-`（错字照抄） | `亮窗玻璃-` |
| 3 | 普通/双玻 glassName | `门玻-`/`面玻-`/`底玻-`（按 扇数 与 B1/B2 分块） | `底玻-{底玻}` / `面玻-{面玻}` 单条 |
| 4 | 子母分支 | `子门玻璃宽/高` + 玻璃宽/高 两套 | 未实现 |
| 5 | 钻石 3 行 | `左固玻璃-`/`右固玻璃-`/`门玻璃-`，图分别是 左固玻/右固玻/挖孔图 | 有 3 行但图与名字待核 |
| 6 | 亮窗行 doorImg | 恒 `""` | 给了公式图 |
| 7 | 厚度 0 过滤 | `filter(0 !== Number(e.thickness))` | 无 |
| 8 | 排序 | `smartdoor_sort_method==='order'` 时按 OrderID 数字前缀 | 无 |
| 9 | diao 的 双无 continue | 有 | 无 |
| 10 | diao 亮窗 quantity | `q/2*Q`，面玻支再 `q<1→1` 钳位 | 不分 ping/diao |
| 11 | D1 的 `-_-l` 扣减 | 由 扇数/开向 推出的开孔图占位扣减 | 未实现 |
| 12 | remark 黑名单置空 | `_0xa370fc` 门店集合时整列为 `""` | 无 |

### 23.7 未确定

- `_0xa370fc` 黑名单的**完整门店列表**（@411200 起被截断，只确证含 皇帥滑动门、尚航逸门窗、嘉博…）。
- `_0x5c8c94`（SVG 开孔图生成器 @316751）的入参语义与输出格式未展开；我们目前没有对应物。
- （已从「未确定」升级为**代码可判定**）diamond 行的记录数：B1/B2 的首层条件是 `formulaType !== 'diamond'`，所以 diamond 行**走 B1.d 与 B2.d 两个 else**（各 push 1 行）；B3 被 `!== 'diamond'` 排除；B4 再 push 3 行 ⇒ **diamond 行共 5 条记录**。仅"未在真机实测"，代码路径本身无歧义。

---

## 24. 第十二轮：glassHole 按 §23 骨架重写（平开完整 + 吊趟部分）

### 24.1 已按骨架重写 `glassInfoProduces`

| 点 | 原版 | 落地 |
|---|---|---|
| **B1/B2 块互不排斥** | `底玻!=='无'` 与 `面玻!=='无'` 是两个独立 `if`，双玻时**各推一行**（仅 `glassName` 不同：`底玻-{底玻}` / `面玻-{面玻}`） | 抽出 `block('bottom'/'face')` 各调一次；**双玻出 2 行** |
| 数量判据 | **部件名含「单玻」**（不是底玻/面玻的值） | `isSingle(p)` + `qv(p, div)` |
| double 有图 | `单玻 ? q*Q/2 : q/4*Q` | `div=2` 分支 |
| B2.c（double 无图）的 glassName | 原文仍是 `底玻-`（**照抄，非笔误**） | 已照抄 |
| B1.d / B2.d 的 doorImg | B1.d 用三目、**B2.d 无三目直接 `_0x3a3de5 \|\| ""`**、B2.c 恒 `""` | 分别实现 |
| **B4 钻石推 3 行** | 部件按**精确名**（`===`）取，`quantity = 1*Q`；且 B1/B2 在 diamond 时仍走 `else` 各推 1 行 ⇒ **钻石行共 5 条** | 已实现（B4 3 行 + B1.d/B2.d 各 1 行） |
| **B3 亮窗** | `ft!=='diamond' && (面玻!=='无' \|\| 底玻!=='无')`，`quantity = 亮窗玻璃宽.quantity × Q`（**不折半**） | 已实现 |
| 平开无「双无 continue」 | 循环里唯一 continue 是「公式不存在」 | 已实现（只有吊趟 continue） |
| 吊趟双无 continue | `底玻==='无' && 面玻==='无'` → 跳过整行 | 已实现 |
| 吊趟 D3 亮窗 | 两个独立 `if`，**可各推一行**；`quantity = 亮窗玻璃宽.quantity/2 × Q`，面玻支再 `q<1→1` 钳位 | 已实现 |
| 吊趟 D3 的 glassName | `亮窗底玻-{底玻}` / `亮窗面璃-{面玻}`（**「面璃」是原文错字，token 557**）；`扇数含「活」` 时才是 `亮窗玻璃-` | 已照抄 |

### 24.2 未实现（已写进代码注释）

- **吊趟 D1/D2 的「开孔图占位扣减」**：原版 `quantity = q*Q - _ - l`，其中 `_`/`l` 由「扇数/开向」查表得出（单轨2扇/双活/2轨2扇/2轨3扇/3轨3扇/4轨4扇/5轨5扇/6轨6扇/3轨4扇 → `_` 或 `l` 计 1；2轨4扇、3轨6扇 → 计 2），且 `l>0` 时那行用「右」图。我们暂按不加扣减实现。
- **`_0x5c8c94`（现场生成 SVG 开孔图）** 与 `_0x2fca47` 门店分支 —— 无对应物。
- **`_0xa370fc` 门店黑名单的完整名单**（源码处被截断，只确证含 皇帥滑动门 / 尚航逸门窗 / 嘉博…）。

---

## 25. 第十三轮：吊趟 glassHole 的「开孔图占位扣减」落地

### 25.1 扣减量 `_` / `l` 的完整规则（原始 chunk @440700–443300）

```js
// ── 左图：key = 挖孔图.formulaID + "左"
if (扇数 !== '一固一活' || 开向.includes('左'))  左图 = await getImage(key) || ""
else                                              左图 = ""            // key 也一并清空
if (左图 && 开向.includes('左'))                  _ = 1
if (左图 && 扇数 ∈ {单轨2扇, 双活, 2轨2扇, 2轨3扇, 3轨3扇, 4轨4扇, 5轨5扇, **6轨6扇**, 3轨4扇})  _ = 1
if (左图 && 扇数.includes('2轨4扇'))              _ = 2
if (左图 && 扇数.includes('3轨6扇'))              _ = 2

// ── 右图：key = 挖孔图.formulaID + "右"
if (扇数 !== '一固一活' || 开向.includes('右'))  右图 = await getImage(key) || ""
else                                              右图 = ""
if (右图 && 开向.includes('右'))                  l = 1
if (右图 && 扇数 ∈ {单轨2扇, 双活, 2轨2扇, 2轨3扇, 3轨3扇, 4轨4扇, 5轨5扇, 3轨4扇})  l = 1
if (右图 && 扇数.includes('2轨4扇'))              l = 2
if (**左图** && 扇数.includes('3轨6扇'))          l = 2      // ← 原文用的是左图变量，照抄
```

> **左右两张名单不同**：右侧**没有**「6轨6扇」；最后一条 `3轨6扇` 判定用的是**左图** —— 两处均疑似原版笔误，**按要求照抄**。

### 25.2 推行规则（D1 底玻支；D2 面玻支同构但部件匹配不同）

```js
主行①：玻璃宽（排除 亮窗/玻璃宽小；D2 还要排除「固」）
        o = 名.includes('单玻') ? q*Q - _ - l : q/2*Q - _ - l
        if (o > 0) push { width, height=玻璃高.result, quantity: o, glassName: '底玻-'+底玻, doorImg 保持 "" }
主行②：玻璃宽小 —— 同上，glassName 同为 '底玻-'+底玻，doorImg 同样 ""（**主行不带图**）
扣减行③：if (_ > 0) push { width=玻璃宽.result, quantity: _, doorImg: 左图, glassName: '底玻-'+底玻 }
扣减行④：if (l > 0) push { … doorImg: 右图 … }
```

> **主行的 `doorImg` 恒为空串**（字面量初始值，全程没有赋值）—— 只有扣减行 ③④ 带图。反直觉，但原文如此，照抄。
> D2 的 glassName 是 `扇数.includes('一固一活') ? '门玻-'+面玻 : '面玻-'+面玻`。

### 25.3 落地与缺口

已实现：`holeImgByDir(l,'左'|'右')`、左右两张扇数名单、`_`/`l` 计算、主行 `o>0` 门控、扣减行 ③④、D2 的「固」排除、D2 的 `门玻-`/`面玻-` 命名。

**未实现**：**D2 在 `扇数含「一固一活」` 时换用另一组部件**（`一固一活固玻璃宽` / `一固一活固玻璃高` / `一固一活门玻璃宽` / `一固一活门玻璃高`）并另有一组 push —— 原文 @445352 起，较长，留待下一轮。（代码里已写明注释。）

### 25.4 顺带确认

- `_0xa370fc` 的完整名单**就是 3 家**：`皇帥滑动门` / `尚航逸门窗` / `嘉博门业`（@411200 全文已读，无截断）。子代理 §23.7 把它列为「未确定」是因为窗口没取全。

---

## 26. 第十四轮：吊趟 glassHole 的 D2 一固一活分支补完

### 26.1 D2 与 D1 的四处不同（原始 chunk @445352–451700）

| 维度 | D1（底玻支） | D2（面玻支） |
|---|---|---|
| 进入条件 | `底玻 !== '无' && 扇数 !== '一固一活' && 扇数 !== '双活'` | `面玻 !== '无'`（**无扇数门控**） |
| 部件匹配 | 玻璃宽/玻璃宽小：排除 `亮窗`、`玻璃宽小` | **再排除 `固`** |
| 左右扇数名单 | 左含 `6轨6扇`、右**不含** | **相反**：左不含 `6轨6扇`、右含 |
| `一固一活` 处理 | 整块跳过 | **主行作废 + 另推一行 `固玻-{面玻}`** |

> 两处名单的 `6轨6扇` 恰好互补，且 D1/D2 的 `3轨6扇 → 2` 判定**都读左图变量** —— 均疑似原版笔误，按要求照抄。

### 26.2 D2 的 `一固一活` 分支

```js
// 部件（仅在 扇数==='一固一活' 时参与）：
//   一固一活固玻璃宽 / 一固一活固玻璃高 / 一固一活门玻璃宽 / 一固一活门玻璃高
mainQ = 玻璃宽.q*Q - n - d
if (扇数 === '一固一活') {
   if (开向.includes('左')) { mainQ = 0; n = 1; d = 0; s = 1 }
   if (开向.includes('右')) { mainQ = 0; n = 0; d = 1; s = 1 }
}
if (mainQ > 0) push { glassName: '面玻-'+面玻, … }
// 玻璃宽小 行同理（'面玻-'+面玻）
if (s > 0) push {                       // ← 「固玻-」行
   glassName: '固玻-' + 面玻
   if (n===0 && 一固一活固玻璃宽) { width = …result; quantity = 1 }
   if (n===0 && 一固一活固玻璃高) { height = …result }
   if (d===0 && 一固一活固玻璃宽) { width = …result; quantity = 1 }
   if (d===0 && 一固一活固玻璃高) { height = …result }
}
// 扣减行：width 优先取 一固一活门玻璃宽（且 quantity=1），height 优先取 一固一活门玻璃高
if (n > 0) push { …, doorImg: 左图, glassName: 扇数含一固一活 ? '门玻-'+面玻 : '面玻-'+面玻 }
if (d > 0) push { …, doorImg: 右图, … }
```

### 26.3 状态

D1 + D2 + D3 已全部实现。**glassHole 这一列按源码已无已知缺口**（除下列外部依赖）。

**仍无对应物、故未实现**：
- `_0x5c8c94`（现场生成 SVG 开孔图）与 `_0x2fca47` 门店（艺佳家居门业 / 索力纳门窗）的 `doorImg` 分支；
- 挖孔图本身依赖后端 `formula_images` 里有 `{formulaID}左` / `{formulaID}右` / `{formulaID}{开向}` 这类键的数据，无数据时 `_`/`l` 恒为 0（不扣减），与原版一致。

---

## 27. 第十五轮：**玻璃合片单 doorsheet 数量规则我自己写错了，已重写**

### 27.1 原版（引擎A，原始 chunk @463400 平开 / @474200 吊趟）

```js
// 平开 _0xcfde65：关键词 ['玻璃','门扇']
let N = 0
arr = KW.reduce((acc,kw) => [...acc,
        parts.filter(name.includes(kw)).map(t => {
            N = (底玻!=='无' || 面玻==='无' || 名含单玻) && (面玻!=='无' || 底玻==='无' || 名含单玻)
                  ? t.quantity * 行数量
                  : t.quantity / 2 * 行数量
            if (formulaType === 'parentSubsidiary') N = (双玻条件 ? 4 : 2) * 行数量
            if (formulaType === 'diamond')          N = 3 * 行数量
            return `${t.materialName}:${t.result}`      // 每条**只有 名:result**
        })], [])
doorsheet = arr.join('<br>') + '<br>数量:' + N          // ← N 是**整个循环最后一次命中**的值

// 吊趟 _0x4d28ce：组1 ['玻璃']（排亮窗）、组2 ['亮窗玻璃']（排压线），各自一个 数量:
N1 同平开算法；若 扇数 ∈ {一固一活, 双活} → N1 = 2 * 行数量
N2 = (底玻!=='无' && 面玻!=='无' || 名含单玻) ? qty*数量 : qty/2*数量
if (N2 > 0) { if (N2 < 1) N2 = 1 ; doorsheet = 组1 + '<br>数量:'+N1 + '<br>' + 组2 + '<br>数量:'+N2 }
else        { doorsheet = 组1 + '<br>数量:'+N1 }
```

要点：
- **数量是「该组最后一个命中件的 quantity」算出来的，不是求和**；
- **双玻是 `qty×数量`、单玻才是 `qty/2×数量`**（与 produces/oldSheet 引擎的「单玻不折半、双玻折半」**正好相反**）；
- 平开 `parentSubsidiary` → 4×/2×，`diamond` → 3×；吊趟无这两支，但有 `一固一活/双活 → 2×数量`。

### 27.2 我们原来的写法（错）

```ts
const scale = (底玻!=='无' && 面玻!=='无') ? 0.5 : 1        // ← 方向反了
const countOf = arr => Math.round(arr.reduce((s,p)=>s+p.quantity,0) * Q * scale)   // ← 求和，不是取最后一个
```

即：**折半方向反 + 求和 vs 取末件 + 缺 parentSubsidiary/diamond/扇数 三支覆盖**。

### 27.3 已重写

`glassProduces` 现在按上面伪代码逐条实现：`doubleGlass(name)` 判据、`数量 = 末件`、平开 `parentSubsidiary`/`diamond` 分支、吊趟 `一固一活/双活 → 2×数量` 与 `N2<1→1` 钳位。

> 这条是**我自己早先从 `Hui.formatted.js` 写的**、当时没回原始 chunk 核，属于「审计之外的自查」。其余引擎（produces B / oldSheet D,E2）的 doorsheet 已在 §15 用同样方式核过并重写。

---

## 28. 第十六轮：回执 glass 列修正 + 边封增量（`applyWidthIncrement`）按原文重写

### 28.1 回执 `glass` 列（`glassSpecPrintable`）

原文（@351196 平开 / @442766 吊趟）确认：分支顺序为 `无底玻` → `都无` → **钻石（仅平开）** → `0==玻璃厚` → else。
我们缺的三处：

| 点 | 原版 | 原实现 |
|---|---|---|
| 租户特判 | `家家发门业` / `星之铝门窗` **不加** `*{厚}mm` | 恒加 |
| `mm` 拼接 | 恒为 `"*"+玻璃厚+"mm"` | 厚度为空时不拼 |
| 钻石支 | **只在平开**的表达式里；吊趟那条没有 `型材含钻石` 判断 | 两者都判 `isDiamond` |

已按原文修正（新增 `STORE_GLASS_NO_MM` 常量）。

### 28.2 边封增量 `applyWidthIncrement`（原版 @389229 计算 + @390860/@391900 施加）

```js
dw = (边封数 !== 2 && SheetIncrement !== 0) ? SheetIncrement*(2-边封数) : 0
dt = (边封数 !== 2 && TrackIncrement !== 0) ? TrackIncrement*(2-边封数) : 0
if ((dw || dt) && 边封数 !== 2) { q = 扇数.match(/(\d+)扇/)[1]
                                  if (dw) x  = dw / q      // ← 只有 Sheet 增量除以扇数
                                  if (dt) dtv = dt }       // ← Track 增量**原样**
let a = 0
对每个部件 key：
  key.includes(扇数) && key.includes('上下方')            → v += x ; a = 1
  key.includes(扇数) && key.includes('封板') && 封板高>0  → '封板高' → v = 封板高 - v
                                                          → '封板宽' && a===1 → v -= x
  key.includes(扇数) && key.includes('玻璃高') && 封板高>0 → v = 封板高 + v
  扇数前2字前缀命中 && !含'扇' && !含'扣板' && a===1 && dtv>0
        && /上滑|上轨|下滑|左右盖板|上下盖板|轨道盖板/      → v -= dtv
  含'上横' && 门洞高 < 亮窗总高 && a===1 && dtv>0          → v -= dtv
```

**我们原来缺的**：`a` 状态位（原版的轨道减量**必须**在「上下方」被加过 x 之后才生效，我们是无条件减）；封板宽 `-x`；封板高的 `v = 封板高 - v` 与玻璃高的 `v = 封板高 + v` 两处值变换；上横的 `-dtv`。已全部补齐。

> ⚠️ 这属于「审计之外的自查」：`applyWidthIncrement` 是最早一批从 `Hui.formatted.js` 写的函数，本次首次回原始 chunk 核对。
> **同类待办**（同样出自早期、尚未回原文核）：`applyHinge`、`holeDeduction`、`swingWallDeduction`、`dimsOf`、以及 §2.5 的部件激活规则。

---

## 29. 第十七轮：铰链减尺（`applyHinge`）按原文重写 + 早前函数复核结论

### 29.1 `applyHinge`（原版 @484816 / @458954 / @563710 等四处，同一逻辑）

```js
const arr = String(行.五金 || '').includes('_') ? 行.五金.split('_') : (行.五金 ? [行.五金] : [])
const x = arr.map(e => e.trim()).filter(e => e.includes('合页'))
if (x.length > 1) 确认框（多个合页提示，用第一个）
if (x.length > 0) {
   const t = x[0]
   if (公式.hinge[t] !== undefined) {
      上下方减尺   = -(Number(hinge[t]['上下方减尺'])   || 0)
      光企减尺寸   = -(Number(hinge[t]['光企减尺寸'])   || 0)
   } else 确认框（合页匹配失败，不阻断）
}
// 施加（@485700）：
e.includes('上下方')                          → v += 上下方减尺
e.includes('光企高') && !e.includes('亮窗')   → v += 光企减尺寸
e.includes('玻璃高') && 封板高>0 && !亮窗     → v = 封板高 + v        ← 见 29.3
```

**我们原来错的**：把 `五金` 拆完直接逐个去 `hinge` 里查、取**第一个能查到的**；原版是**先筛出含「合页」的项、只取第一个**，再去查（查不到就跳过/提示）。另外匹配目标原版是 **`光企高`**，我们写成了 `光企`。均已修正。

### 29.2 本轮一并复核为**一致**的（首次回原文核对）

| 函数 | 结论 |
|---|---|
| `holeDeduction` / `dimsOf`（@394539） | 一致。原版：`w/h/h1 = 门洞宽/门洞高/亮窗总高||0`；`洞尺==='洞尺'` 取 `公式.resetSize.{width,height}`，`单包/双包洞尺` 取 `公式.TaoDong.{SingleDong,DubleDong}.{宽减,高减}`；两段依次 `w -= 宽减`、`h1 > h ? h1 -= 高减 : h -= 高减`。 |
| `swingWallDeduction`（@389229 邻近） | 一致。`公式.swingWall` + `行.单双丁`（trim、≠'正常'）：单丁墙→SingleWall 减 w；双丁墙→DoubleWall 减 w；上丁墙→UpWall 减 h（h1>h 则减 h1）；上丁加单丁→SingleWall+UpWall；上丁加双丁→DoubleWall+UpWall。 |

### 29.3 一处**暂不实现**的规则（引擎相关，条件不一致）

原版多个引擎的部件循环里都有 `玻璃高 && 封板高>0 && !亮窗 → v = 封板高 + v`，但**门控不同**：
- 平开引擎（@485700）：**不带 `includes(扇数)`** 门控；
- 吊趟引擎（@390860）：**带 `includes(扇数)`** 门控。

我们的 `applyWidthIncrement` / `applyHinge` 是**按功能拆出来、两种门型共用**的，无法同时表达两种门控 —— 贸然加会把平开门漏掉或把吊趟门加错。**暂不实现**，待确认「哪些引擎在什么条件下真的会命中该规则」后再补。
（`applyWidthIncrement` 里目前带 `fans` 门控的那份，对应的是吊趟引擎那份。）

### 29.4 自查待办更新

- ✅ 已核：`applyWidthIncrement`（§28）、`applyHinge`、`holeDeduction`/`dimsOf`、`swingWallDeduction`
- ⬜ 未核：**§2.5 的部件激活规则**（`isActivePartKey` / `isCasingTrackActive` / `isLightWindowActive` / `isWallThicknessActive` / `isGlassActive` / `isShouKouActive` / `isResultActive`）—— 这是最后一块大宗未回原文核的早期代码。

---

## 31. 第十八轮：激活规则自查（进行中）——已核出的三条

> §2.5 的激活规则是最早一批从 `Hui.formatted.js` 写的，**尚未回原文核**。本轮先核出三条，完整清单正在抽取（见 §30）。

### 31.1 数值禁用阈值 **按引擎不同，不是按门型**

原文里同一段「算出结果后禁用」的代码有两种阈值，且**都带 `滑`/`单轨` 豁免**：

```js
// @396683（某平开引擎）
result = Math.round(eval(...))
result < 1 && !name.includes('滑') && !name.includes('单轨')
    ? (state = false, result = 0, quantity = 0, 名含「扣板厚」&& (kbThickNeg = true)) : …

// @506811（某吊趟引擎，多一个 `true === state` 前置）
true === state && result < 1 && !滑 && !单轨 ? (state=false, result=0, quantity=0, …) : …

// @545672（E2 引擎）—— 阈值是 **0** 而非 1
result < 0 && !滑 && !单轨 ? (state=false, result=0, quantity=0, …) : …

// @382393 还有一处  _0x40d715 < 0 ? (state…) 
```

**结论**：`result` 的禁用阈值**逐引擎不同**（有 `<1` 也有 `<0`），**不能简化成「ping 用 0、diao 用 1」**。我们现在正是按门型简化
（`isResultActive`：diao 用 `>=1`、ping 用 `>=0`），属于近似，待 §30 给出逐引擎对照后修正。

同时确认：`名含「扣板厚」且算出负值 → 置 kbThickNeg` 的联动**确实存在于多个引擎**，与我们的实现一致 ✓。

### 31.2 单/双玻（`isGlassActive`）——一致 ✓

原文（@389229 邻近）：
```js
if (单玻 = 底玻==='无' || 面玻==='无') {
   Object.keys(parts).forEach(key => {
      if (!key.includes('亮窗') && !key.includes('LiangChuang') &&
          (key.includes('玻璃宽') || key.includes('玻璃高')) && !key.includes('单玻')) {
         const alt = key + '单玻'
         if (parts[alt]) { parts[key].state = false; parts[alt].state = true }   // 有变体件 → 切过去
         else parts[key].state = true                                            // 没有变体件 → 本体照常启用
      }
   })
}
if (双玻 = 底玻!=='无' && 面玻!=='无') { 同结构，`名含单玻 → state=false` }
```
我们的 `isGlassActive` 与该语义等价 ✓。**唯一差别**：原版带 `!亮窗 && !LiangChuang` 两个排除词，我们没排除「亮窗」——待 §30 确认是否要补（`LiangChuang` 是拼音形态的同一排除）。

### 31.3 轨/扇前缀（`isActivePartKey`）——语义等价 ✓

原版：`const r = 扇数.substring(0, 2); if (r.length === 2 && name.includes(r) && !name.includes('扇') && !name.includes('扣板')) → state = true`
即「**取扇数前 2 字**，命中名字含该前缀、且不含『扇』『扣板』的件」。
我们的 `TRACK_PREFIX_RE` + `fans.startsWith(前缀)` 与之在常见取值下等价（已逐个推演 `2轨2扇`/`3轨2扇` 等组合）。

### 31.4 仍待

- **§30 完整规则清单**（子代理抽取中）：重点是 `轨道种类` 门控那几条到底会不会让未填轨道种类的件全部不激活 —— 这决定我们当初的回退是否必要、以及是否要整体改成「默认 false + 规则置 true」的原版模型。

---

## §30 部件激活规则（state）完整清单

来源：`legacy/js/Hui-d088417c.js`（原始 chunk）。引擎按 `部件表变量 / 行变量` 配对。

| 简称 | 引擎函数 | 部件表 | 行变量 | 说明 |
|---|---|---|---|---|
| A平 | `_0x4f7790` | `_0x4128ff` | `_0x2f4e51` | 玻璃合片单·平开 |
| A吊 | `_0x4f7790` | `_0x2e92e0` | `_0x206283` | 玻璃合片单·吊趟 |
| B平 | `_0x32bd6f` | `_0x31280d` | `_0x3879a6` | 生产单·平开（**正常算料**） |
| B吊 | `_0x32bd6f` | `_0x37fd28` | `_0xeb5988` | 生产单·吊趟（**正常算料**） |
| D平 | `_0x320f0e` | `_0x497f7d` | `_0x520f23` | 生产单定制·平开 |
| D吊 | `_0x320f0e` | `_0x7da398` | `_0x1f4aae` | 生产单定制·吊趟 |
| P1平 | `_0x15ef6c` | `_0x1bc7b7` | `_0x55a27e` | 平开门生产单(定制)·平开 |
| C吊 | `_0x15ef6c` | `_0x3556ef` | `_0x19d928` | 同上·吊趟 |
| G平 | `_0x509b06` | `_0x432374` | `_0x2c0817` | 玻璃订单·平开 |
| G吊 | `_0x509b06` | `_0x342a31` | `_0xae1cd3` | 玻璃订单·吊趟 |
| L1 / L2 | `_0x2e25b8` | `_0x4134a4` / `_0x3b79ec` | `_0xead7ba` / `_0x3bc4a5` | 生产标签 |
| L3 | `_0x2e25b8` | `_0x3b79ec` | `_0x3bc4a5` | 生产标签（第二块） |

### ★ 30.0 三条最关键结论

**① `state` 初值 = `false`（服务端数据决定，不是客户端）**

部件表是**服务端公式 `diao` 对象的深拷贝**（@483280 `_0x31280d = JSON.parse(JSON.stringify(_0x4a216a.diao))`；@457511 / @412232 同构）。
DB 实测（`docker exec smartdoor-db psql ... "select jsonb_pretty(parts) from formulas limit 1"`）：

```json
"F槽宽": { "v":0, "color":"lightgreen", "state": false, "title":"", "track":"",
           "result":0, "formula":"=w-v", "quantity":2, "calculate":"=w-result",
           "materialName":"F槽宽" }
```
统计 `select v->>'state', count(*) ... group by 1` → **`false` 94 项**，其余 2 项无 state 字段。
⇒ **客户端不做任何"默认保留"**：没有任何规则命中的部件**就是不激活（不出现在算料结果里）**。
⇒ 我们的「默认保留 + 逐条排除」模型**方向就错了**，必须改成「默认 false + 规则置 true」。

**② `轨道种类` 那四条是纯「置 true」使能规则，条件不成立时部件确实不激活**

B吊主块（@502185–@502270）原文：
```js
name.includes('光企') && part.track === 行.轨道种类 && name.includes(扇数) && (part.state = true)
name.includes('勾企') && part.track === 行.轨道种类 && name.includes(扇数) && (part.state = true)
name.includes('合页') && part.track === 行.轨道种类 && name.includes(扇数) && (part.state = true)
name.includes('锁')   && part.track === 行.轨道种类 && name.includes(扇数) && (part.state = true)
```
- `part.track` 是**服务端预设值**，DB 实测：`2轨2扇光企高→极简轨`、`2轨2扇勾企高→钢轨`、`2轨4扇光企高→标配`、`标配光企→标配`、`单包宽→单包`、`双包宽→双包`。
- 这四条**只置 true、从不置 false** ⇒ 条件不成立时**不会主动禁用**，但若该部件没有别的规则把它置 true，它**就保持 false（不激活）**。
- **关键**：`2轨2扇光企高` 这个名字里含 `扇`，会被前面的 `扇数.substring(0,2)` 规则用 `!name.includes('扇')` 排除 ⇒ **「光企」类部件唯一的激活途径就是这四条**。
  ⇒ **轨道种类不填（或填了与 `part.track` 不等的值）时，光企/勾企/合页/锁 一律不激活 —— 这是原版语义，不是 bug。**
  ⇒ 我们当初"回退"掉这条规则是**错的**：应当照抄，并保证 `行.轨道种类` 的下拉选项覆盖服务端 `track` 的取值域（`标配/极简轨/钢轨/单包/双包…`）。

**③ 数值阈值：平开只有 `< 0`；吊趟的"第二遍"块额外有 `< 1 && !滑 && !单轨`**

| 位置 | 条件 | 动作 |
|---|---|---|
| **所有引擎**的主 eval 块 | `Math.round(eval(...)) < 0` | `state=false; result=0` |
| B吊 @506843 / A吊? / D吊? 的 **needsSecondPass** 块 | `state===true && round < 1 && !name.includes('滑') && !name.includes('单轨')` | `state=false; result=0; quantity=0` |
| L1/L2 @396708 | `round < 1 && !name.includes('滑') && !name.includes('单轨')` | `state=false; result=0; quantity=0` |

`<1` 豁免词固定为 **`滑`** 与 **`单轨`** 两个（`!includes('滑') && !includes('单轨')`）。
**平开没有任何 `<1` 规则**。注意 B吊 的 `<1` 还额外要求 `state` 已为 `true`。

### 30.1 统一骨架（每个引擎 7 个 `Object.keys(部件表)` 位点）

以 B平（`_0x31280d`）为例，7 个位点：`485198 / 485439 / 485620 / 486888 / 487944 / 488262 / 489281`；
B吊（`_0x37fd28`）：`500279 / 500608 / 500918 / 506013 / 507283 / 507590 / 508589`。**顺序即执行顺序，后面的覆盖前面的。**

| # | 位点 | 作用 |
|---|---|---|
| ① | 单玻替换（`if (双无)`） | 给 `玻璃宽/玻璃高` 找 `+单玻` 变体，二选一 |
| ② | 双非无块（`if (双非无)`） | 含`单玻`→false；含`玻璃`且非单玻→true |
| ③ | 活扇块（**仅吊趟有**） | `if (扇数.includes('活'))` → 见 30.3 |
| ④ | **主规则块**（**仅吊趟有**） | 39 条规则，见 30.3 |
| ⑤ | 主 eval | `state` 为 true 才 eval；`<0 → state=false, result=0` |
| ⑥ | 第二遍 eval（needsSecondPass） | 同上 + 吊趟的 `<1` 规则 |
| ⑦ | 组装 `_0x1d6087`（只收 `state===true`） | 之后才生成 doorsheet/doorframe/windows |

**平开（A平/B平/D平/P1平/G平）只有 ①②⑤⑥⑦ + v调整块，没有 ③④。**

### 30.2 B平（生产单·平开）完整有序清单

> 行变量 `_0x3879a6`，部件表 `_0x31280d`。
> 先定义：`无玻 = (底玻==='无' || 面玻==='无')`；`双玻 = (底玻!=='无' && 面玻!=='无')`

| # | 偏移 | 条件 | state | 备注 |
|---|---|---|---|---|
| P1 | 485198 | `if(无玻)` 遍历；`(名含'玻璃宽'||名含'玻璃高') && !名含'单玻'` | 同名`+单玻`存在 → 本条 `false`、变体 `true`；否则本条 `true` | 单玻替换 |
| P2 | 485439 | `if(双玻)` 遍历 | `名含'单玻'` → `false`；`!名含'单玻' && 名含'玻璃'` → `true` | |
| P3 | 485620 | 遍历（v 调整块，**无 state 门控**） | 见下 | 同时改 `v` |
| P3a | | `名含'上下方'` | — | `v = (Number(v)\|\|0) + 偏移量`（上下方加长） |
| P3b | | `名含'光企高' && !名含'亮窗'` | — | `v += 光企高加长` |
| P3c | | `名含'玻璃高' && Number(封板高)>0 && !名含'亮窗'` | — | `v = Number(封板高) + v` |
| P3d | | `if(!名含'玻璃宽' && !名含'玻璃高')`：`墙厚>0` → `true`；否则 `名含'扣板'` → `false`；否则 → `true` | | |
| P3e | | `名含'封板' && Number(封板高)===0` | `false` | |
| P3f | | `名含'封板高' && Number(封板高)>0` | `true` | 且 `v = Number(封板高) - v` |
| P4 | 486888 | 主 eval：`if(part.state)` → 替换 `h/w/h1/j/t/s` 与 `v` → `eval` → `Math.round` | `round<0` → `false, result=0`；若本件 `名含'扣板厚'` 则置**联动标志** | 联动见 P6 |
| P5 | 487944 | 第二遍 eval（`state && needsSecondPass`），同上 | `round<0` → `false, result=0`；异常 → `result='error', state=false` | |
| P6 | | **扣板厚负值联动**：P4 里 `名含'扣板厚'` 且 `round<0` 时置标志；之后任一部件 `round>=0` 且 `名含'扣板' \|\| 名含'压条'` | `false` | ⚠️ 原文是 `includes('扣板')\|\|includes('扣板')\|\|includes('压条')`（**重复的 `扣板`，应为 `扣板厚` 的笔误**） |
| P7 | 488262 | 组装 `_0x1d6087`：只收 `state===true` | — | |

**平开没有**：扇数系列、轨道种类系列、套线种类系列、亮窗总高/数量系列、收口系列、F槽系列。

### 30.3 B吊（生产单·吊趟）完整有序清单

> 行变量 `_0xeb5988`，部件表 `_0x37fd28`。前置：`if(!扇数) continue;`（@500279 附近）

| # | 偏移 | 条件 | state | 备注 |
|---|---|---|---|---|
| Q1 | 500608 | 单玻替换（同 P1，含 `无玻` 定义） | 同 P1 | |
| Q2 | 500918 | `if(扇数.includes('活'))` 活扇块 | `<名含'活' && !名含'玻璃高'>` → true；`名含'玻璃高' && track===轨道种类 && 名含(扇数)` → true；`亮窗总高>0 && (名含'玻璃'\|\|名含'亮窗')` → true | 三分支 |
| Q3 | 501136 | **主规则块**，`n = 无玻`，`d = !扇数.includes('活') && n` | 见下 39 条 | 顺序执行，后覆盖前 |
| Q3.1 | | `t && !n && 名含(e) && 名含'单玻'` | `false; return` | `e`/`t` 为单玻变体循环变量 |
| Q3.2 | | `d && t && 名含(e)` | `= 名含'单玻'; return` | |
| Q3.3 | | `名含(扇数) && 名含'方'` | `true` | |
| Q3.4 | | `名含(扇数) && 名含'上下方'` | — | `v=(Number(v)\|\|0)+x`，并置局部 `a=1` |
| Q3.5 | | `名含(扇数) && 名含'固定'` | `true` | |
| Q3.6 | | `名含(扇数) && 名含'移动'` | `true` | |
| Q3.7 | | `名含(扇数) && 名含'封板' && Number(封板高)>0` | `true`；且 `名含'封板高'` 时 `v=Number(封板高)-v` | |
| Q3.8 | | `名含'扣板厚' && a===1` | — | `v=(Number(v)\|\|0)-x` |
| Q3.9 | | `名含(扇数) && 名含'玻璃'` | `true`；且 `名含'玻璃高' && Number(封板高)>0` 时 `v=Number(封板高)+v` | |
| Q3.10 | | `名含(扇数) && 名含'盖板'` | `true` | |
| Q3.11 | | `r = 扇数.substring(0,2)`；`r.length===2 && 名含(r) && !名含'扇' && !名含'扣板'` | `true`；且 `a===1 && _>0 && (名含'上滑'\|\|'上轨'\|\|'下滑'\|\|'左右盖板'\|\|'上下盖板'\|\|'轨道盖板')` 时 `v=(Number(v)\|\|0)-_` | |
| Q3.12 | | `名含'光企' && part.track===行.轨道种类 && 名含(扇数)` | `true` | ★见 30.0-② |
| Q3.13 | | `名含'勾企' && track===轨道种类 && 名含(扇数)` | `true` | ★ |
| Q3.14 | | `名含'合页' && track===轨道种类 && 名含(扇数)` | `true` | ★ |
| Q3.15 | | `名含'锁' && track===轨道种类 && 名含(扇数)` | `true` | ★ |
| Q3.16 | | `名含'边封' && 门洞高 > 亮窗总高 && 名含'无'` | `true` | 「无亮窗边封」 |
| Q3.17 | | `名含'上横' && 门洞高 < 亮窗总高` | `true`；且 `a===1 && _>0` 时 `v-=_` | |
| Q3.18 | | `名含'边封' && 门洞高 < 亮窗总高 && !名含'无'` | `true` | |
| Q3.19 | | `名含'包宽' && track===套线种类` | `true` | |
| Q3.20 | | `名含'包高' && !formula.includes('h1+') && track===套线种类 && 亮窗总高 < 门洞高` | `true` | |
| Q3.21 | | `名含'包高' && formula.includes('h1+') && track===套线种类 && 亮窗总高 > 门洞高` | `true` | |
| Q3.22 | | `墙厚>0 && 亮窗总高===0`：`名含'F槽宽'` | `true` | |
| Q3.23 | | 同上：`名含'扣板宽'` | `true` | |
| Q3.24 | | 同上：`名含'F槽高' && !名含'亮窗'` | `true` | |
| Q3.25 | | 同上：`名含'扣板高' && !名含'亮窗'` | `true` | |
| Q3.26 | | 同上：`名含'扣板厚' && 名含(r) && title===''` | `true` | |
| Q3.27 | | 同上：`名含'扣板厚' && 名含(r) && title!=='' && track===套线种类` | `true` | |
| Q3.28 | | `墙厚>0 && 亮窗总高>0`：`名含'F槽宽'` | `true` | |
| Q3.29 | | 同上：`名含'扣板宽'` | `true` | |
| Q3.30 | | 同上：`名含'亮窗F槽高'` | `true` | |
| Q3.31 | | 同上：`名含'亮窗扣板高'` | `true` | |
| Q3.32 | | 同上：`名含'扣板厚' && 名含(r) && title===''` | `true` | |
| Q3.33 | | 同上：`名含'扣板厚' && 名含(r) && title!=='' && track===套线种类` | `true` | |
| Q3.34 | | `亮窗数量>0`：`s = 亮窗数量+'格亮窗'`；`名含(s)` | `true`；且 `名含(s+'玻璃宽')` 时 `v=(Number(v)\|\|0)-x` | |
| Q3.35 | | `名含'收口' && 扇数含'4扇' && !扇数含'折叠'` | `true` | |
| Q3.36 | | `名含'收口' && 扇数含'3扇' && 扇数含'折叠' && !开向含'0'` | `true` | |
| Q3.37 | | `名含'收口' && 扇数含'4扇' && 扇数含'折叠' && !开向含'0'` | `true` | |
| Q3.38 | | `名含'收口' && 扇数含'5扇' && 扇数含'折叠' && !开向含'0'` | `true` | |
| Q3.39 | | `名含'收口' && 扇数含'6扇' && 扇数含'折叠' && !开向含'0'` | `true` | |
| Q3.40 | | `名含'收口' && 扇数含'2轨3扇'` | `true` | |
| Q3.41 | | `名含'收口' && 扇数含'单轨2扇'` | `true` | |
| Q4 | 506013 | 主 eval（同 P4）+ 扣板厚联动（`扣板`/`压条`） | `<0 → false,result=0` | |
| Q5 | 507283 | 第二遍 eval | **`state && round<1 && !滑 && !单轨` → `false, result=0, quantity=0`**；联动标志 → `名含'扣板高'\|\|名含'扣板宽'` 时 `quantity=0, state=false` | ★③ |
| Q6 | 507590 | 组装 `_0x1d6087` | — | |

### 30.4 其余引擎的差异矩阵

| 规则族 | A平 | A吊 | B平 | B吊 | D平 | D吊 | P1平 | C吊 | G平 | G吊 | L1/L2/L3 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 单玻替换 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 双非无（单玻 false / 玻璃 true） | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `["扇数"]` 引用次数 | **0** | 6 | **0** | 8 | **0** | 8 | **0** | 6 | **0** | 12 | 2/4 |
| 活扇块 | ✗ | ✅ | ✗ | ✅ | ✗ | ✅ | ✗ | ✅ | ✗ | ✅ | ✅ |
| 主规则块（39 条） | ✗ | ✅ | ✗ | ✅ | ✗ | ✅ | ✗ | ✅ | ✗ | ✅ | ✅ |
| `<0 → state=false` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<1 && !滑 && !单轨` | ✗(无平开项) | 未确认 | ✗(无平开项) | ✅@506843 | ✗(无平开项) | 未确认 | ✗(无平开项) | 未确认 | ✗(无平开项) | 未确认 | ✅@396708 |
| 扣板厚→扣板/压条 联动 | ✅@382539 | 未确认 | ✅@487605 | ✅@506843 | ✅@528787 | 未确定 | 未确定 | 未确定 | 未确定 | 未确定 | 未确定 |

> `<1` 我实测只命中 4 处：@396708（L 系）、@506843（B吊 needsSecondPass）；其余引擎**未确认**（可能在 needsSecondPass 块，但我未逐一遍历）。

**`["轨道种类"]` 引用**：A吊 1、B吊 5、D吊 3、C吊 4、G平 1、G吊 1、L1 1 —— **平开引擎（A平/B平/D平/P1平/G平）除 G平 外都不引用**。
**`["套线种类"]` 引用**：A平 1、B平 1、B吊 2、D平 2、D吊 2、C吊 3、L1 1、L2 1（平开只有 1 处，在别处而非主块）。

### 30.5 与我们实现的对照（`Hui.vue`）

| 我们的函数 | 现状 | 原版 |
|---|---|---|
| 整体模型 | **默认保留 + 逐条排除** | **默认 false + 规则置 true**（服务端数据即 false） |
| `isActivePartKey` | 主动排除关键字 | 应对应「置 true 的关键字表」 |
| `isCasingTrackActive` | 翻成排除条件 | 原版是 `名含'包宽' && track===套线种类 → true`、`名含'包高' && … && 亮窗总高 ≶ 门洞高 → true`（两分支） |
| `isLightWindowActive` | 排除 | 原版：`墙厚>0 && 亮窗总高===0` 与 `墙厚>0 && 亮窗总高>0` 两套 F槽/扣板 使能 |
| `isWallThicknessActive` | 排除 | 原版 `墙厚>0` 是**使能**条件（F槽宽/F槽高/扣板宽/扣板高），不是禁用 |
| `isGlassActive` | 排除 | 原版：单玻替换 + 双玻使能 + `亮窗总高>0 && 名含'玻璃'` |
| `isShouKouActive` | ？ | 原版 7 条收口规则（4扇/3扇折叠/4扇折叠/5扇折叠/6扇折叠/2轨3扇/单轨2扇），全部要求 `!开向.includes('0')`（折叠系列） |
| `isResultActive` | `result` 判定 | 原版分两级：主 eval `<0`、第二遍 `<1 && !滑 && !单轨` |
| 轨道种类 4 条 | **曾被回退** | 应**照抄**，并保证下拉值覆盖 `part.track` 域（标配/极简轨/钢轨/单包/双包…） |
| `partOrder` / `groupPart` | 正则分组 + 排序 | 原版用**关键字数组顺序**逐个 `reduce`，顺序即关键词数组顺序（§16 已述） |

### 30.6 未确定

- 其余引擎（A吊/D平/D吊/P1平/C吊/G平/G吊）**是否存在 `<1 && !滑 && !单轨` 规则**：我只在 @396708 / @506843 命中，其余未逐一遍历。
- D 系（`_0x320f0e`）与 G 系（`_0x509b06`）的**扣板厚→扣板/压条联动**是否存在：未逐一确认。
- `a`（局部状态位）与 `_`（开孔图占位扣减量）的完整来源：`a` 在 Q3.4 置 1，`_`/`x` 来自开孔图 `holeSize` 的推导（见 §23.3 B0），我在 §30 只标注了它们被引用的位置。
- `名含(r)` 规则里 `r = 扇数.substring(0,2)`：**当 `扇数` 长度 < 2 时 `r.length!==2`，该规则整体不生效**；原版未做其它兜底。

---

## 32. 第十九轮：§30 落地前的前提核实 —— **`state` 初值 = 服务端给的 `false`**

### 32.1 关键前提（用真实数据证实）

`legacy/data/original-formulas.json` 里每个公式部件的字面量：

```json
"门框高": { "state": false, "quantity": 1, "materialName": "门框高", "track": "", "formula": "=w-v", ... }
"玻璃宽": { "state": false, ... }
```

**平开公式的每一个部件（含 `门框高`/`门框宽`/`上下方`/`光企高`）都是 `state: false`**。
⇒ 原版模型确认为「**服务端全给 false，客户端按规则置 true**」，组装时只收 `state===true`。
⇒ 我们「默认保留 + 逐条排除」的模型与之**方向相反**（§30.5 已列）。

### 32.2 平开为什么还能显示门框/光企 —— 兜底规则（@485620，已核）

平开引擎只有 6 条 state 规则，其中**兜底**这条负责激活绝大多数部件：

```js
if (!name.includes('玻璃宽') && !name.includes('玻璃高')) {
    if (墙厚 > 0)                    a.state = true
    else if (name.includes('扣板'))   a.state = false
    else                             a.state = true          // ← 压线 / F槽 落在这里 = true
    if (name.includes('封板') && Number(封板高) === 0)        a.state = false
    if (name.includes('封板高') && Number(封板高) > 0) {      a.state = true
                                                              a.v = Number(封板高) - a.v }
}
```

**我们原来错的**：`isWallThicknessActive` 在 `墙厚<=0` 时排除 `扣板|压线|F槽` **三个**；平开原版**只排除「扣板」**。
（吊趟那边确实是 F槽/扣板 系列都要求 `墙厚>0` —— Q3.22–Q3.33。）

**已改**为按门型区分：
```ts
if (墙厚 > 0) return true
return l.line_type === 'diao' ? !/扣板|F槽/.test(key) : !/扣板/.test(key)
```

### 32.3 待决策：是否整体改成原版模型

§30 表明我们的激活实现方向是反的（排除 vs 使能），且原版规则**顺序敏感**（后面的覆盖前面的）。**这是本项目的核心算料逻辑**，两种选择：

- **A. 整体重写为原版模型**：按 §30 的逐引擎有序清单实现
  `state=false` 起手 → 「单玻替换 → 双玻 → (吊趟: 活扇块 → 39 条主规则) → eval(<0 禁用) → 第二遍 eval(<1 禁用) → 只收 state===true」。
  优点：彻底对齐，并顺带解决 `轨道种类` 门控当初误排除的问题；缺点：改动大、需逐引擎重测。
- **B. 只修已证实的偏差**：如 §32.2 这类「排除词多写了」的点，继续用排除模型近似。
  优点：风险低；缺点：**永远对不齐**，且轨道种类这类「使能型」规则无法表达。

> 建议 **A**，因为 §30.5 已指出「轨道种类那 4 条当初被回退」正是因为模型方向不对 —— 继续打补丁会在同类规则上反复翻车。
> 但这属于核心逻辑重写，**等用户确认再动手**。

---

## 33. 第二十轮：激活模型重写完成（方案 A）+ 一处待用户实测确认

### 33.1 已完成的重写

`Hui.vue` 新增 `applyPartState(parts, l)`，`calcSingleRow` 改为：

```
applyPartState(parts, l)                       // 默认 false 起手，按 §30 顺序置 true/false
逐序只对 state===true 的部件 eval（false 的部件不参与，引用它得 0）
主 eval：result < 0            → state=false, result=0（**所有引擎一致**）
吊趟二次：state && result < 1 && !名含'滑' && !名含'单轨' → state=false, result=0
含「扣板厚」算出负值 → kbThickNeg，收尾时 扣板高/扣板宽/压条 一并剔除
收尾：只保留 state===true 且 p.formula 存在的部件
```

**旧的一整套「默认保留 + 排除」谓词已删除**：`isActivePartKey` / `isCasingTrackActive`（Hui 内引用）/ `recalcForward` 引用，
以及 `isLightWindowActive` / `isWallThicknessActive` / `isGlassActive` / `isShouKouActive` / `isResultActive` 五个函数。

**顺带修正 §30 的一处读法**：吊趟的「活扇块」之后是 `else { const e = 扇数+'玻璃'; …39 条主规则… }`
—— 即 **39 条主规则只在「非活扇」时执行**；`e` = `扇数+'玻璃'`，Q3.1/Q3.2 用的就是它。
（同时确认 Q2 里的 `亮窗总高>0 && (名含玻璃||名含亮窗) → true` **在活扇 guard 内**，非活扇行不走。）

### 33.2 ⚠️ 待用户实测确认：**带亮窗的平开门，亮窗玻璃件显示吗？**

按源码：**五个平开引擎（A平/B平/D平/P1平/G平）都没有任何「亮窗」相关的 state 规则**。
平开的兜底块是 `if (!名含'玻璃宽' && !名含'玻璃高') { … }` —— **含「玻璃宽/玻璃高」的件被整块跳过**；
而 `上亮窗玻璃宽` 恰好含「玻璃宽」。

⇒ 代码推出来的结论是：**平开行里 `上亮窗玻璃宽/高` 永远保持 `state=false`，不会出现在算料结果里。**
（真实数据佐证：平开公式 `22222` 的 `上亮窗玻璃宽/高` 确实是 `state: false`。）

这与「带亮窗平开门应该要下亮窗玻璃」的直觉冲突，但**源码就是这样**。我们已按源码实现。
**请在旧版里试一行「带亮窗的平开门」算料，看亮窗玻璃件到底显不显示** —— 若显示，说明还有一个我没找到的引擎/分支，我再去挖。

### 33.3 同轮确认的两条

- `包高` 的两支判据取的是**部件自身的 `formula` 字段**（`c.formula.includes('h1+')`），不是公式级文本 ✓ 已按此实现。
- `扣板厚` 的两条（`title===''` / `title!=='' && track===套线种类`）确认无误 ✓。

---

## 34. 第二十一轮：平开无亮窗规则的二次确认 + 金额公式核对

### 34.1 平开确实没有「亮窗」激活规则（二次确认）

按已知引擎区间统计 `.state=` 出现次数与附近是否含「亮窗」：

| 引擎区间 | `.state=` | 附近含「亮窗」 |
|---|---|---|
| **B平 484900–489400** | **3** | **0** |
| B吊 500000–508700 | 8 | 5 |
| A平（380000 附近） | 3 | 2 |
| D 系 392000–394000 | 11 | 10 |
| P1平 572000–577000 | 6 | 4 |

A平那 2 处经查是**别的规则里的 `!includes('亮窗')` 守卫**（玻璃高 v 变换等），不是亮窗激活规则。
⇒ **§33.2 的结论成立**：平开没有亮窗激活规则，`上亮窗玻璃宽/高` 在平开行里保持 `state=false`。
仍需用户实测旧版确认（若显示，说明我漏了一个引擎/分支）。

### 34.2 金额公式（`computeAmount`）——与原文一致 ✓

原文（@165175 / @53314）：

```js
base = 计价方式 === '套' ? 单价 * 数量 + (附加项 || 0)
     : 计价方式 === '方' ? 单价 * 平方数 + (其它费用 || 0)
     : 0
金额 = Math.round(base * 打折)          // 先算 base，再整体乘打折，最后取整
平方数 = 单樘平方 × 数量                 // @57256
套线金额 = Number((套线单价 × 长度 × 数量).toFixed(3))   // @166555
```

我们的 `computeAmount`：`Math.round((单价 × (方 ? 平方数 : 数量) + [方时加 套线金额] + 其它费用) × 打折)` —— **结构一致** ✓
（`套` 不计套线金额，与原文 `yt` 的套分支一致；取整在乘完打折之后，也一致。）

> 具体附加项键名因 formatter 污染（`e[?374]`/`e[?333]`）未能逐个核对，但**分支结构与取整时机已确认**。

### 34.3 本轮结论：早期函数的原文核对**全部完成**

| 函数 | 结论 |
|---|---|
| `applyWidthIncrement` | ❌→已修（§28：缺 `a` 状态位、封板宽 `-x`、封板/玻璃高值变换、上横 `-dt`） |
| `applyHinge` | ❌→已修（§29：缺「合页」筛选、目标应为「光企高」） |
| `holeDeduction` / `dimsOf` / `swingWallDeduction` | ✅ 一致 |
| `isGlassActive` / `isActivePartKey` | ✅ 语义等价（已并入 `applyPartState`） |
| 部件激活整体模型 | ❌→**已按原版重写**（§33，默认 false + 规则置 true） |
| `computeAmount` / `pricingDetail` / `basicInfoText` / `dimSizeLabel` / `glassSpecPrintable` / `labelQuantity` | ✅ 一致或已修 |

**只剩 §33.2 一条待用户实测**。

---

## 35. 第二十二轮：发现「回执单预览」抽屉整块**不可达**（连带下载/分享/打印）

### 35.1 现象

`Hui.vue` 里有一套完整的回执单预览 + 下载 + 分享 + 打印：

- 抽屉：`<n-drawer v-model:show="receiptOpen">`（模板 L322–332），内含「关闭 / 下载回执单 / 分享 / 打印」
- 函数：`receiptHtml`（手写近似表）、`buildReceiptDoc()`、`downloadReceipt()`、`shareReceipt()`、`printReceipt()`

但 **`receiptOpen` 全文件只在三处出现**：模板的 `v-model`、关闭按钮、`const receiptOpen = ref(false)` ——
**没有任何地方把它置 `true`**。`onMoreSelect` 里的键只有
`orders / templates / labels / glass / glassHole / productionCustom / terminal / markupMgmt / autoMarkup / openDir / columns`，
**没有回执单预览**。

⇒ 这整块 UI **点不到**，`下载回执单` / `分享` / `打印` 三个按钮随之全部失效。

### 35.2 原因推断

早前用户要求「**移除右上角更多功能中的多余单据预览，因为模板预览中已经有了**」，
移除时把菜单项删了，但没有删掉抽屉本体与那三个按钮 —— 于是留下一个孤儿抽屉。

### 35.3 本轮处置

- `utils/printService.ts` 新增 **`renderByJson` / `renderByMode`**（用 hiprint 的 `getHtml` 渲染成 HTML，
  与打印同一套渲染核心；注意必须先 `await tpl.update(tpl.config)` 填充 `printPanels`，否则抛 `getLayoutStyle of undefined`）。
  **能力已备好，但暂无调用方**。
- `receiptHtml` 仍保持原样（手写近似表），并在注释里写明「抽屉无入口」这件事。
- **不擅自加回菜单项** —— 那与用户「移除多余单据预览」的指示冲突，需用户决定。

### 35.4 待用户决定

三选一：
1. **在「更多功能」加回「回执单预览」** → 抽屉复活，`receiptHtml` 切成 hiprint 真渲染；
2. **删掉整个抽屉 + 三个函数**（彻底承认模板预览已覆盖该功能）；
3. 保持现状（死代码留着）。

---

## 36. 第二十三轮：删除孤儿抽屉 + 模板预览改为**真渲染**

### 36.1 删除（按用户指示）

整块不可达的回执单预览已删除：

- 模板里的 `<n-drawer v-model:show="receiptOpen">` 抽屉（含「关闭/下载回执单/分享/打印」四个按钮）
- `receiptOpen` / `receiptHtml` / `buildReceiptDoc()` / `downloadReceipt()` / `shareReceipt()` /
  `printReceipt()` / `printReceiptHtml()` / `printing` / `receiptTextSummary()`
- 随之失效的辅助：`esc()` / `num()` / `typeName()` / `lineOpenLabel()`
- CSS `.receipt-host`

**保留**：`receiptOrderedLines()` 与 `receiptPrintData()` —— 回执**模板**（`receipt` / `FinalReceipt` / `ReceiptList`）
的数据源仍在使用（`printCurrentTemplate` 与模板预览）。

> 过程中两次误删（`receiptHtml` 函数体、`receiptPrintData` 函数）均已从 `dist/` 最近一次成功构建的产物
> 逐字恢复，编译通过。**教训：此文件不要再按「行号切片」改，必须用唯一锚点做定点替换。**

### 36.2 模板预览从「自绘表格」改为 **hiprint 真渲染**

**原来的预览不是真渲染**：`renderTemplatePreview` 把模板的列抽出来，用自研的 `renderTableHtml` 画一张 HTML 表 ——
样式、间距、分页、二维码与图片位置全与实打不一致。

现在改为：**先走 `renderByMode(mode, payload)`（与打印同一套渲染核心）**，返回非空即用；
异常或空则**回退**到原来的自绘表格（保留数据核对能力）。

```ts
const { key, data, extra, wrap } = templatePayload(tpl, mode)
const payload = key ? { ...extra, [key]: data } : data
const html = await renderByMode(mode, (wrap ? [payload] : payload) as Record<string, unknown>[])
if (html) { templatePreviewHtml.value = html; return }
// ↓ 失败回退：extractTableColumns + renderTableHtml（原逻辑不动）
```

`utils/printService.ts` 的 `renderByJson` / `renderByMode`：用 hiprint `getHtml` 渲染；
**必须先 `await tpl.update(tpl.config)`** 填充 `printPanels`，否则抛 `getLayoutStyle of undefined`（headless 实测确认）。

---

## 37. 第二十四轮：模板预览只保留真渲染，自绘表格体系整体删除

### 37.1 先验证：17 张模板**全部**可真渲染

用 CDP 驱动 headless Chrome，在真实 app 上下文里逐张 `new PrintTemplate({template})` →
`await T.update(tpl.config)` → `await T.getHtml(payload)`：

| 模板 | 结果 | | 模板 | 结果 |
|---|---|---|---|---|
| product | OK 14727 | | glass | OK 14722 |
| product1 | OK 4247 | | glassHole | OK 4090 |
| product2 | OK 7414 | | lable | OK 6558 |
| product3 | OK 14811 | | product10 | OK 4548 |
| product4–9 | OK 14738（6 张同版式） | | receipt | OK 10353 |
| | | | FinalReceipt | OK 8010 |
| | | | ReceiptList | OK 6285 |

**17/17 全部渲染成功** ⇒ 自绘表格回退没有存在价值。

### 37.2 删除

- `renderTableHtml()` —— 自绘 HTML 表格渲染器
- `renderLabelHtml()` —— 自绘标签渲染器
- `extractTableAlign()` / `extractLabelFields()` —— 仅供上面两者取模板信息
- `oldSheetFlat()` —— 仅供自绘表格把 `oldSheet[0]` 铺平
- `renderTemplatePreview` 里的整个回退分支（`producesCols/glassInfoCols/oldSheetCols/receiptCols` 那一段）

**保留 `extractTableColumns(tpl, field)`** —— `templatePayload` 靠它按「模板实际字段族」分发数据源，是真渲染路径的一部分。

`renderTemplatePreview` 现在只剩：

```ts
const { key, data, extra, wrap } = templatePayload(tpl, mode)
const payload = key ? { ...extra, [key]: data } : data
const html = await renderByMode(mode, (wrap ? [payload] : payload) as Record<string, unknown>[])
templatePreviewHtml.value = html || ''
```

> 顺带：`Hui.vue` 现在 **4612 行**（本会话开始时约 4700+），四列关键词驱动 + 真渲染后无任何自绘近似。

---

## 38. 第二十五轮：修掉「v 变换重复施加」+ 平开补上玻璃高规则

### 38.1 问题（上一轮重写激活模型时埋的）

`calcSingleRow` 的顺序是 `applyWidthIncrement` → `applyHinge` → `applyPartState`。
重写 `applyPartState` 时我把两条 **v 值变换**也写进了它的吊趟分支，而它们**同时在 `applyWidthIncrement` 里**：

| 规则 | 出现处 |
|---|---|
| `名含'封板高' → v = 封板高 - v` | `applyWidthIncrement` **和** `applyPartState` 吊趟分支 |
| `名含'玻璃高' && 封板高>0 → v = 封板高 + v` | 同上 |

后果（重复施加）：
- `v = sbh - (sbh - v)` = **v** → 该规则被**完全抵消**；
- `v = sbh + sbh + v` → **翻倍**。

### 38.2 修法（按 §30 的归属定死唯一位置）

- **两条 v 变换只在 `applyPartState` 里做**：吊趟分支带 `includes(扇数)` 门控（对应 Q3.7/Q3.9），
  平开分支**不带**门控（对应 P3c/P3f）。
- `applyWidthIncrement` 里删掉这两处，**只保留 `封板宽 → v -= x`**（Q3.8，依赖它自己的 `a` 状态位）。
- **平开分支补上缺失的 `玻璃高 → v = 封板高 + v`**（原来只有吊趟有，平开漏了）。

### 38.3 顺带确认：两条规则的**门控确实按引擎不同**

原文 @564600 那处施加在 `_0x55a27e`（= **product1 平开引擎**）上，形如：

```js
名含'上下方'                                  → v += 上下方减尺
名含'光企高' && !名含'亮窗'                    → v += 光企减尺寸
名含'玻璃高' && Number(封板高)>0 && !名含'亮窗' → v = 封板高 + v      // ← 无 includes(扇数)
```

而 B吊（§30.3 Q3.9）那条是**带** `includes(扇数)` 的。⇒ §29.3 里「无法表达两种门控」的顾虑，
在 `applyPartState` 拆出平开/吊趟两支之后**已解决**（此前它们共用一个函数才表达不了）。

同时确认：**铰链减尺（上下方/光企高）在平开与吊趟引擎里都存在且都不带扇数门控** ⇒ `applyHinge` 不分门型是对的。

---

## 39. 第二十六轮：端到端回归（headless 驱动真实交互）——全链路跑通

激活模型重写（§33）是核心逻辑的大改动，本轮做真实交互回归。用 CDP 驱动 headless Chrome：
登录 → 进 `/hui` → 点「＋添加行」→ 选型材（Naive 的 **filterable select**，需聚焦+输入+点选项，
直接改 DOM 的 `value` 无效）→ 点「算料」。

### 结果

```
算料完成：6 个部件
模板预览（生产单）渲染内容：
  客户/门类: 123
  门扇: 光企高:0*2  上下方:0*2  玻璃高:0*1  玻璃宽:0*1
  外框: 门框高:0*4  门框宽:0*2
  订单信息: 白玻*单玻
  备注: 配件:1 2 3 4
控制台错误: (无)
```

（数值为 0 是因为该行未填门洞高/宽，符合预期。）

### 这一跑同时验证了四件事

| # | 验证点 | 结果 |
|---|---|---|
| 1 | **激活模型重写没破坏主流程** | ✅ 正常算出 6 个部件，无异常 |
| 2 | **模板预览 = hiprint 真渲染**（§36/§37） | ✅ 预览弹窗里是渲染出的**生产单版式**（客户/门类、订单信息、方向、门扇、外框、亮窗/扣板、备注 分栏），不是自绘表格 |
| 3 | **`配件:{公式.hardware}` 段**（§19） | ✅ 备注列出现 `配件:1 2 3 4`（公式 "123" 的 `extra.hardware` = `1\n2\n3\n4\n`），与实现一致 |
| 4 | **四列关键词驱动 + 真渲染链路** | ✅ 门扇/外框分栏与 §15/§16 的关键词规则吻合 |

### 仍未验证

- **§33.2**：平开行的亮窗玻璃件是否显示 —— 需要用户在旧版对照。
- 各**具体数值**是否与原版一致（本轮只验证了链路通、不报错、版式对）。

---

## 40. 第二十七轮：**逐值数值验证**（端到端，全部命中）

上一轮只验了「链路通、不报错」。本轮填满参数做**逐值比对**。

### 40.1 测试条件

公式 = `123`（ping），部件定义（DB 实取）：

| 部件 | formula | quantity | | 部件 | formula | quantity |
|---|---|---|---|---|---|---|
| 门框高 | `=h+v` | 4 | | 扣板高 | `=h-v` | 2 |
| 门框宽 | `=w+v` | 2 | | 扣板宽 | `=w-v` | 1 |
| 上下方 | `=w-v` | 2 | | 扣板厚 | `=t-v` | 1 |
| 光企高 | `=h-v-j` | 2 | | 玻璃宽 | `=上下方.result-v` | 2 |
| | | | | 玻璃高 | `=光企高.result-v` | 2 |

全部 `v = 0`。填入 **门洞高 2000 / 门洞宽 900 / 墙厚 100**，底玻留空、面玻=白玻（即**单玻**）。

### 40.2 实测输出 vs 手算期望

| 部件 | 实测 | 手算 | |
|---|---|---|---|
| 光企高 | `2000*2` | `h-v-j` = 2000-0-0，q=2 | ✅ |
| 上下方 | `900*2` | `w-v` = 900，q=2 | ✅ |
| 玻璃高 | `2000*1` | `光企高.result-v` = 2000，**q=2→1（单玻÷2）** | ✅ |
| 玻璃宽 | `900*1` | `上下方.result-v` = 900，**q=1** | ✅ |
| 门框高 | `2000*4` | `h+v` = 2000，q=4 | ✅ |
| 门框宽 | `900*2` | `w+v` = 900，q=2 | ✅ |
| 扣板厚 | `100*1` | `t-v` = 100，q=1 | ✅ |
| 扣板宽 | `900*1` | `w-v` = 900，q=1 | ✅ |
| 扣板高 | `2000*2` | `h-v` = 2000，q=2 | ✅ |
| 订单信息 | `2000*900*100` | `门洞高*门洞宽*墙厚` | ✅ |
| 玻璃段 | `白玻*单玻` | 底玻无 → `{面玻}*单玻` | ✅ |
| 备注 | `配件:1 2 3 4` | `配件:` + `公式.hardware` | ✅ |

**9 个部件全部逐值命中，无一偏差。**

### 40.3 这一跑同时验证的三条**规则行为**

1. **单玻数量修正生效**：`玻璃宽/高` 的 quantity 由 2 变 1 —— 对应原版 doorsheet 的
   `(底玻==='无'||面玻==='无') && !名含'单玻'` → `round(q/2)`。
2. **墙厚门控生效**：上一轮（墙厚未填）输出里**没有** `扣板*` 三个件；本轮填了 墙厚=100 后
   **三个都出现** —— 对应原版平开兜底块的 `墙厚>0 → state=true；否则 名含'扣板' → false`（§32.2）。
3. **跨部件引用按顺序求值生效**：`玻璃宽` 引用 `上下方.result`、`玻璃高` 引用 `光企高.result`，
   取到的是**前面已算出的结果**（900 / 2000），说明 `calcSingleRow` 里「只对 state===true 的部件逐序 eval」是对的。

### 40.4 结论

**算料主链路（激活规则 → 逐序 eval → 数值禁用 → 生成四列 → hiprint 真渲染）端到端正确。**
剩余唯一未验证项仍是 §33.2（平开行的亮窗玻璃件是否显示），需用户在旧版对照。

---

## 41. 第二十八轮：**条件性部件**逐值验证（亮窗 / 封板；合页未跑成）

### 41.1 方法

现有库里的公式缺少封板/合页件、且吊趟件名不带轨扇前缀，不足以验证。故**临时建了两个验证用公式**
（`__验证_条件部件ping` / `__验证_条件部件diao`，含 亮窗 / 封板 / 压线 / 上亮 / 合页配置 / 单包双包 / 轨扇前缀件），
跑完**已删除**（`delete from formulas where name like '__验证_%'`，库里恢复为原 6 条）。
建表 SQL 留在 `/tmp/fixture.sql`，需要时可复现。

### 41.2 亮窗（亮窗总高 = 2500，门洞高 2000、门洞宽 900、墙厚 100）

| 部件 | 实测 | 手算 | |
|---|---|---|---|
| 门框高 | `2500*4` | `=h1+v` = 2500 | ✅ |
| 扣板高 | `2500*2` | `=h1-v` = 2500 | ✅ |
| 压线高 | `500*1` | `=h1-h-v` = 2500-2000 = 500 | ✅ |
| 上亮横 | `900*1` | `=w-v` = 900（激活） | ✅ |
| 压线宽 | `900*1` | 900（激活） | ✅ |
| 门框宽 / 上下方 / 玻璃宽 | `900` | 900 | ✅ |
| **上亮窗玻璃宽 / 高** | **未出现** | 按源码：平开兜底块 `if (!名含'玻璃宽' && !名含'玻璃高')` **跳过** → 保持 `state=false` | ✅（与源码一致） |
| 订单信息 | `2000*900*100 亮窗高：2500 吊脚：2500 白玻*单玻` | `basicInfoText` 各段 | ✅ |

> **§33.2 的答案（在我们这套实现里）已实测确认**：平开行的 `上亮窗玻璃宽/高` **不显示**。
> 是否与旧版一致，仍需用户对照原版。

### 41.3 封板（封板高 = 300）

| 部件 | 实测 | 手算 | |
|---|---|---|---|
| 封板高 | `200*1` | 激活规则置 true，且 **`v = 封板高 - v` = 300-0 = 300** → `=h1-h-v` = 2500-2000-300 = **200** | ✅ |
| 封板宽 | `900*1` | `=w-v` = 900（无 v 变换） | ✅ |

**这条最重要的意义**：`200` 只有在「`v = 封板高 - v`」被正确施加**且只施加一次**时才成立。
⇒ 同时验证了 §38 修的「v 变换重复施加」问题确实修好了（重复施加会得 `2500-2000-0 = 500` 或更离谱的值）。

### 41.4 未跑成

- **合页**：本轮尝试在「五金」框填 `测试合页` 未生效（该单元格控件类型与我的填法不匹配），故
  `v = -(上下方减尺/光企减尺寸)` 的联动**本轮未验证**。源码核对结论（§29）仍然有效。
- **单包/双包、轨扇前缀**：需要移门行的「扇数/轨道种类/套线种类」三个下拉，未在 headless 里驱动成功。

---

## 42. 第二十九轮：用户报「推拉亮窗数量没渲染」——确认为真 bug，**与渲染方式无关**

### 42.1 用户反馈

> 「表格渲染的内容和原版还是有区别，比如推拉的亮窗数量没有渲染出来。是不是之前改自绘表格时改坏了？」

### 42.2 查证：原版两条 basicInfo 的差异（原始 chunk 实证）

**平开 `_0x551a25`（@498404 前）**
```js
if (亮窗总高 && 0 !== 亮窗总高) {
    let e = "亮窗高：" + 亮窗总高
    if (formulaType === 'diamond') e = "*" + 亮窗总高
    items.push(e)                       // ← **不拼亮窗数量**
}
```

**吊趟 `_0x500ef9`（@518890 前）**
```js
if (亮窗总高 && 0 !== 亮窗总高) {
    let e = "亮窗高：" + 亮窗总高
    if (亮窗数量 && 0 !== 亮窗数量) e += "亮窗" + 亮窗数量 + "格"     // ← **只有吊趟有这句**
    items.push(e)
}
```

⇒ **`亮窗{N}格` 只出现在吊趟**。我们的 `basicInfoText` 两边都没拼 ⇒ **吊趟漏了**。

### 42.3 是不是「改自绘表格」改坏的？—— **不是**

`basicInfoText` 是会话早期从 `Hui.formatted.js` 写的，**从一开始就没有这半句**。
换成 hiprint 真渲染**不会丢数据** —— 真渲染展示的就是我们 payload 里的那个字符串，与自绘表格当时展示的**完全相同**；
只是真渲染把版式还原后，缺字段变得更容易被看出来。

### 42.4 已修

```ts
if (lw) {
  if (l.line_type === 'diao') {
    let e = `亮窗高：${lw}`
    if ((l.light_window_count || 0) !== 0) e += `亮窗${l.light_window_count}格`
    items.push(e)
  } else {
    items.push(isDiamond(l) ? `*${lw}` : `亮窗高：${lw}`)   // 平开不拼数量
  }
}
```

### 42.5 本轮未能 E2E 验证

移门行的算料需先填「扇数 / 轨道种类 / 开向」等多个下拉，headless 未驱动成功（点算料后无预览弹出，被必填校验拦下）。
**该修复目前只有源码对照证据**，建议用户在页面用一行移门（填亮窗总高 + 亮窗数量）确认订单信息显示为
`…亮窗高：2500亮窗3格…`。

> 顺带：本轮又临时建/删了一次验证夹具（`__验证_条件部件*`），库里仍是原来 6 条公式。

---

## 43. 第三十轮：`basicInfoText` 全量补齐（原版共 **5 处不同实现**）

用户要求「查验 basicInfoText 是否还有遗漏，全部补齐」。全量检索后确认：原版 `basicInfo` 有 **5 处独立实现**
（`.basicInfo=` 2 处 + `[token(544){basicInfo}]` 3 处）：

| # | 引擎 | 偏移 | 用在哪 |
|---|---|---|---|
| 1 | `_0x551a25` | @498529 | 引擎B 平开（生产单） |
| 2 | `_0x500ef9` | @518899 | 引擎B 吊趟（生产单） |
| 3 | `_0xcfde65` | @466789 | **引擎A 平开（玻璃合片单）** |
| 4 | `_0x4d28ce` | @477851 | **引擎A 吊趟（玻璃合片单）** |
| 5 | `_0x1239ce` | @587554 | product1 的吊趟支（product1 模板无 basicInfo 列，**用不到**） |

### 43.1 引擎A 与 引擎B 的四处差异（此前只实现了 B）

| 点 | 引擎B（生产单） | **引擎A（玻璃合片单）** |
|---|---|---|
| 玻璃段·单玻 | `{面玻}*单玻` | **`单玻*{面玻}*{厚}mm`** |
| 玻璃段·双无 | 平开 `无玻璃` / 吊趟 `无` | **平开 `无` / 吊趟 `无玻璃`**（与 B 正好相反） |
| 玻璃段·一般 | `{面玻}+{底玻}*{厚}` | **`{面玻}+{底玻}*{厚}mm`** |
| 吊趟尾部**抑制条件** | 型材含「哑口套/门套」→ 尾部为空 | **底玻与面玻都为「无」→ 尾部为空** |

相同的部分：尺寸段 `门洞高*门洞宽*墙厚`、亮窗段（**只有吊趟**拼 `亮窗{N}格`）、洞尺前置、吊脚段（**只有平开**有）、
平开尾部 `套线种类?套线种类+开向:开向`、吊趟尾部 `开向<br>扇数`。

### 43.2 已重写

`basicInfoText(l, engineA = false)` 现在四个变体全覆盖：

```ts
// 玻璃段
bottomNone && !faceNone → engineA ? `单玻*${面玻}*${厚}mm` : `${面玻}*单玻`
bottomNone && faceNone  → engineA ? (diao ? '无玻璃' : '无') : (diao ? '无' : '无玻璃')
否则                     → `${面玻}+${底玻}*${厚}${engineA ? 'mm' : ''}`
// 吊趟尾部
suppress = engineA ? (底玻与面玻俱为「无」) : /哑口套|门套/.test(型材)
```

`glassProduces`（引擎A）传 `true`，`productionProduces`（引擎B）传默认 `false` ✓。

### 43.3 回归验证

重跑平开 E2E（临时夹具，跑完已删）：

```
订单信息: 2000*900*100 亮窗高：2500 吊脚：2500 白玻*单玻
```

✅ 引擎B平开路径与重写前**逐字一致**（含「平开不拼亮窗数量」）。全部部件数值亦无变化。

### 43.4 仍未验证

**引擎A（玻璃合片单）的 basicInfo** 本轮未 E2E —— 需要走 glass 模板算料（`glassProduces`），
本轮未驱动。其正确性目前**只有源码对照证据**。

---

## 44. 第三十一轮：**全量实现点普查**（72 个模板字段 × 原始 chunk 全部赋值点）

用户要求「全量实现点普查，全部补齐」。做法：

1. 从 17 张模板提取全部 `field`（去重去 `*1` 后缀与容器字段）→ **72 个字段**；
2. 对每个字段在 `Hui-d088417c.js` 里检索**两种赋值形态**：
   - 点号：`<var>.字段 =`
   - 串表：`<var>[<accessor>(<idx>)] =`（idx 由 `tokens.json` 反查）
3. 按**被赋值的对象变量**归组 → 该变量即「引擎/构造器」。

### 44.1 普查结果：多引擎字段

| 字段 | 出现于几个引擎 | 处理 |
|---|---|---|
| `remark` | 10 | ✅ produceRemark / glassRemark / oldSheetRemark / product1 / lable / product10 |
| `client` | 10 | ✅ |
| `door` | 8 | ✅ |
| `doorImg` / `lockImg` | 7 | ✅（图片字段，统一取 `image_url` / `lineLockImage`） |
| `OrderID` / `qrcode` | 6 / 9 | ✅ |
| `basicInfo` | **5** | ✅ §43 已按 5 个变体重写 |
| `doorframe` / `windows` | 3 | ✅ §16/§18 |
| `doorsheet` | 5 | ✅ §15 |
| `glass` | 4 | ✅（`_0x34f4ac`/`_0x192067` = oldSheet 两套；`_0x159bea`/`_0x336291` = product10 两套，规则**相同**） |
| `size` | 4 + 回执/标签 | ⚠️ **发现遗漏，见 44.2** |
| `lockway` | 5 | ✅ |
| `GlassSize` | 2（product10 平开/吊趟） | ✅ 规则相同 |
| `address` / `orderID` / `material` / `color` | 2–5 | ✅ |
| 单引擎字段（doorSize/glassSize/sheetHeigth/frameHeigth/kouWidth/…） | 1（product1） | ✅ §14 |
| 回执表头（total/balance/deposit/brand/date/declaration/payQrcode/orderQrcode/payment/productionDays/orderNo/TotalBalance） | 对象字面量 | ✅ §1.1、§30 |

### 44.2 ❌ 新发现：**product10 有两个构造器（一门型一个）**，size 规则不同

`_0x159bea` 用行变量 `_0xead7ba`（**平开**），`_0x336291` 用 `_0x3bc4a5`（**吊趟**）：

```js
// 平开 _0x159bea
size = 门洞高 + "*" + 门洞宽
if (吊脚 > 0)     size += "*" + 吊脚
if (墙厚 > 0)     size += "*" + 墙厚
if (亮窗总高 > 0) size += "*" + 亮窗总高

// 吊趟 _0x336291
size = 门洞高 + "*" + 门洞宽
if (亮窗总高 > 0) size += "*" + 亮窗总高          // 无吊脚、无墙厚
```

其余字段（`glass` / `lockway` / `address` / `orderID` / `color` / `GlassSize` / `remark`）**两者相同**。

**这条是我们自己先前改错的**：§14 先读到吊趟那个构造器，就断定「平开吊趟同一套」，并把 §8.5/§9 里审计原文
「平开 吊脚→墙厚→亮窗；吊趟仅亮窗」**当成错误「改正」掉了** —— 审计原本是对的。
本轮已按两个构造器分别实现：

```ts
let size = `${门洞高}*${门洞宽}`
if (line_type === 'ping') { if (吊脚>0) size += `*${吊脚}`; if (墙厚>0) size += `*${墙厚}` }
if (亮窗总高>0) size += `*${亮窗总高}`
```

> 教训（第二次同类）：**同一字段在原版常有「一门型一个构造器」的实现**，
> 读到其中一个就推广到两个，是本项目最容易犯的错。普查法（先枚举全部赋值点再逐个核）能系统性避免。

### 44.3 字段 × 构造器 **覆盖矩阵**（机器核验，零缺失）

用脚本把「每张模板声明的全部 `field`」与「对应 builder 源码里的返回键」做差集：

| 模板 | builder | 覆盖 |
|---|---|---|
| product / product4–9 | `productionProduces` | ✅ 全 |
| product1 | `product1Produces` | ✅ 全 |
| product2 / product3 | `oldSheetProduce`（+ 运行时 `pairRows`） | ✅ 全 |
| glass | `glassProduces` | ✅ 全 |
| glassHole | `glassInfoProduces` | ✅ 全 |
| lable | `lableRow` | ✅ 全 |
| product10 | `product10Row` | ✅ 全 |
| receipt / FinalReceipt / ReceiptList | `receiptPrintData` | ✅ 全 |
| FinalReceipt / ReceiptList 表头 | 同上 | ✅ 全 |

**仅两处「缺」是有意为之**：
1. `ReceiptList` 的 `payment`（连 `date`）—— 原版回执行字面量里**没有**这两个键，列恒空（§1.2 / §21.2）；
2. `product3` 的 `*1` 系列（`client1`/`size1`/`oldSheet1`…）—— 由 `pairRows()` 在**运行时**给第二行逐键加 `1` 后缀生成，
   静态提取看不到属正常。

### 44.4 本轮新增确认（逐点核对未读过的赋值点）

- **`_0x1239ce`**（product1 的吊趟支）：读全了，它只设 produce 形状的键（door/basicInfo/doorsheet/doorframe/windows/kou…），
  **不设 product1 模板的任何尺寸列**。⇒ product1 模板 + 移门行在原版就是**空白**，与我们无关。
- **`door`（8 处）**：引擎A `[型材,颜色]`；引擎B 白名单外 `[客户,型材,颜色]`；product10 是 `型材+颜色` **字符串拼接**（无分隔符，
  但该模板无 `door` 列，不影响）。
- **`lockway`（5 处）**：product10 两套 = `套线种类!==''?套线种类+开向:开向`；oldSheet平开 = `开向`/`套线种类+开向`；
  oldSheet吊趟 = 哑口套门套?`''`:`开向+扇数`；product1 = `开向`；lable = 带 `开向:` 前缀版。**全部已实现**。
- **`remark`（10 处）**：逐一核对，全部已有对应实现（§11/§19/§20）。

---

## 45. 第三十二轮：普查**行级计算字段**（平方数 / 套线金额 / 金额）

上一轮普查的是「打印载荷字段」。本轮把**驱动金额的行级计算字段**也普查一遍。

### 45.1 已确认一致

| 字段 | 原版 | 我们 | |
|---|---|---|---|
| `金额` | `Math.round(base × 打折)`；`base` = 套 `单价×数量+其它费用` / 方 `单价×平方数+其它费用` | `computeAmount` 同构 | ✅ |
| `平方数` | `= 单樘平方(gt) × 数量`（@57005） | `computeSquare` = `max(singleArea, min) × 数量` | ✅ |
| `单樘平方 gt` | `max(门洞宽 × max(门洞高,亮窗总高) / 1e6, 最小平方)`；`自定义方数 > -1` 时优先 | `singleArea` + `minSquareOf` | ✅（常规支） |
| `套线金额` | `Number((套线长度(mt) × 数量 × 套线单价).toFixed(3))` | `casingAmountOf` = `round2(casingLength × 数量 × casing_price)` | ✅ |
| `套线长度 mt` | 按套线种类子串（一高一宽/两高两宽/一高一宽）取 `(宽+高+丁)/1e3` 等 | `casingLength` | ✅ |

### 45.2 ~~❗**新发现的未实现分支**：`gt` 里由公式级标签控制的一支~~

> **【2026-09-11 更正】本条系误判，已作废。**
> §46 已解出 `token 420` 的真值 = **`'diamond'`**（该 accessor 属另一张表 `_0x1260`，不是 tokens.json）。
> 因此这一支是**钻石型分支**，`Hui.vue` 的 `singleArea()` **早已实现**（`isDiamond(l) → (w+wall+lw)*h/1e6`）。
> 本节以下内容仅作误判过程留档，**不要再据此改代码**。

原版 `gt`（@52720）除常规支外还有一支：

```js
const c = L.value[公式id]                       // 公式级**标签字符串**（同组件内还用它做输入框标题：
                                                //   '面玻：' / '左宽：' / '宽度：' / '一固一活固玻璃高' 等）
if (c === <token 420>) {
    return Number(Math.max((门洞宽 + 墙厚 + 亮窗总高) * 门洞高 / 1e6, 最小平方).toFixed(3))
}
return Number(Math.max(门洞宽 * max(门洞高,亮窗总高) / 1e6, 最小平方).toFixed(3))
```

即：**当该公式的 `L` 标签取某个特定值时，单樘平方改用 `(门洞宽+墙厚+亮窗总高) × 门洞高 / 1e6`**（多算了墙厚与亮窗总高）。

**我们没实现这一支**（只实现了常规支）。

**未解决**：`token 420` 用 `tokens.json` 解出的是 `'未找到对应单号'`（一条 UI 文案），明显不是标签值 ——
说明该 accessor 与 tokens.json 不是同一张表（§0.2 已知问题），**该标签的真实取值未能解出**。
同类比较点还有 @73190 / @83638 / @84081 / @87134，均已确认是**输入框标题**用法（`L.value[formulaid]` 存标签串）。

⇒ 要补齐这一支，需先解出 index 420 的真值（或直接观察旧版：**哪些公式的平方会把墙厚/亮窗总高算进去**）。

---

## §46 `x` accessor 串表定位

结论先行：**`t(420)` = `'diamond'`**。
即 `gt` 里那段特殊面积公式的进入条件是 **`L.value[行.formulaid] === 'diamond'`**（该公式的 `formulaType` 是 diamond）。

### 46.1 `x` 是谁（证据链）

| 步骤 | 偏移 | 证据 |
|---|---|---|
| 1 | @52689 | `gt=e=>{const t=x, ...}` — accessor 是 `x` |
| 2 | @30839 | `setup(e,{expose:t,emit:a}){const x=_0x4017e5,` —— **`x = _0x4017e5`**（该组件 setup 顶部，作用域覆盖 `gt`） |
| 3 | @14482 | `_0x4017e5=_0x2d32;!function(e,t){...}(_0x2d32,_0x1260)` —— `_0x4017e5` 是 `_0x2d32` 的别名，紧接着是**数组旋转 IIFE** |
| 4 | @17662 | `function _0x2d32(e,t){const a=_0x1260(); ... let _=a[t-=136]; ...}` —— **索引基数 136**（`t(420)` → `a[284]`），值经 `KwKJQI()` 表解码 |
| 5 | @18242 | `function _0x1260(){const e=["y3vZDg9T...","6zEO5RsE5A69",...]; return(_0x1260=function(){return e})()}` —— 串表本体 |

⇒ **`x` 用的是 `_0x1260()` 这张表，与 tokens.json（`_0x43b0d8`）无关。**

### 46.2 重建方式

用 Node 直接**执行原文件里的三个片段**（不改动语义）：
`function _0x2d32` + `function _0x1260` + 旋转 IIFE `!function(e,t){...}(_0x2d32,_0x1260);`，
再遍历索引取值。旋转 IIFE 的校验和是
`647784 === -parseInt(a(514))/1*(parseInt(a(513))/2) + -parseInt(a(140))/3 + -parseInt(a(136))/4 + parseInt(a(147))/5*(parseInt(a(600))/6) + -parseInt(a(558))/7*(parseInt(a(417))/8) + -parseInt(a(527))/9 + parseInt(a(328))/10`
（即那些"看起来像乱码"的条目 `4qzmgiF / 56650UIMDbL / 129120nuhTRx / …` **本来就是表的成员**，是旋转次数校验用的，不是解码失败）。

脚本：`/tmp/huidrive/gt_table2.js`；**全表导出：`/tmp/huidrive/tokens_x_4017e5.json`（563 项，有效索引 136–698）**。

### 46.3 验证（你给的三个索引 + 上下文自证）

| 索引 | 期望 | 新表真值 | 上下文自证 |
|---|---|---|---|
| `484` | 门洞宽 | **`门洞宽`** ✅ | 同函数另一分支直接写 `(e["门洞宽"] + e["墙厚"] + e["亮窗总高"]) * e["门洞高"]`，`t(484)` 与该 `e["门洞宽"]` 同位 |
| `324` | 亮窗总高 | **`亮窗总高`** ✅ | `Math.max(e["门洞高"]||0, e[t(324)]||0)` |
| `420` | ？ | **`diamond`** | `c = L.value[e.formulaid]`，而 `L.value` = formulaType 映射（见 46.4） |

**附加旁证**（同表解出、与上下文吻合）：

| 索引 | 真值 | 用处 |
|---|---|---|
| `462` | `formulaid` | `P.value[e[t(462)]]` / `L.value[e[t(462)]]` 的键 |
| `167` | `自定义方数` | `e[t(167)] > -1` 时的**手工平方覆盖值** |
| `335` | `toFixed` | `l[t(335)](3)` 即 `l.toFixed(3)`（tokens.json 在 335 给的是"亮窗总高"，**再次证明两表不同**） |
| `691` | `value` | `P[t(691)]` / `L[t(691)]` |
| `679` | `max` | `Math[t(679)]` |
| `559` | `data` | 响应解构 |
| `156` / `550` / `641` / `248` | `error` / `message` / `获取基础信息失败` / `length` | 错误分支与 `Object.keys(L.value).length<=1` |

> 注意：**同一个数字索引在两张表里含义不同**。`335` 在 `_0x43b0d8` 是"亮窗总高"，在 `_0x1260` 是"toFixed" —— 这正是 §0.2b 那条警告的又一实例。

### 46.4 `L.value` 到底是什么（推翻了"输入框标题串"的假设）

@46241 原文（同组件）：

```js
const { material: t, square: a, formulaType: x, hingeNames: l } = _[e(559){data}];
t && (O.value = t), a && (P.value = a), x && (L.value = x), l && (S.value = l)
```

接口：`GET https://www.samrtdoor.com.cn/1?param1=initializPing&param2={registrant}`（@46111），返回 `{material, square, formulaType, hingeNames}`。

⇒ **`L.value` = `formulaType` 映射**（`formulaid → formulaType`），不是输入框标题。
⇒ **`P.value` = `square` 映射**（`formulaid → 最小平方`）；`O.value` = `material`；`S.value` = `hingeNames`。
⇒ `L.value[formulaid] === 'diamond'` 就是「这个公式是钻石型」。
（你看到的那几个 `面玻：`/`左宽：`/`宽度：`/`一固一活固玻璃高` 是**另一个组件里的另一个 `L`**；本组件的 `L` 在 @35198 声明为 `L=Vue.ref([{}])`，随后被 @46241 的接口数据覆盖。）

### 46.5 `gt` 的完整解码（供直接照抄）

```js
gt = e => {
  const t = x,
        a = e.门洞宽 || 0,
        _ = Math.max(e.门洞高 || 0, e.亮窗总高 || 0)
  let l = -1
  const o = P.value[e.formulaid]        // P.value  = square 映射（最小平方）
  const c = L.value[e.formulaid]        // L.value  = formulaType 映射
  if (o === undefined && !e.formulaid)
    return (e.自定义方数 !== null && e.自定义方数 > -1)
        ? (l = e.自定义方数, Number(l.toFixed(3)))
        : (l = Number((a * _ / 1e3 / 1e3).toFixed(3)), Number(l.toFixed(3)))

  if (e.自定义方数 !== null && e.自定义方数 > -1) l = e.自定义方数
  else if (e.formulaid && P.value) {
     const a = P.value[e.formulaid]
     if (a !== undefined) l = a
  }

  if (c === 'diamond') {                                          // ← t(420)
     const a = Math.max((e.门洞宽 + e.墙厚 + e.亮窗总高) * e.门洞高 / 1e3 / 1e3, l)
     return Number(a.toFixed(3))
  }
  { const v = Math.max(a * _ / 1e3 / 1e3, l); return Number(v.toFixed(3)) }
}
```

**业务含义**：
- 默认单樘面积 = `门洞宽 × max(门洞高, 亮窗总高) / 1e6`
- **diamond 型** = `(门洞宽 + 墙厚 + 亮窗总高) × 门洞高 / 1e6` ← **墙厚与亮窗总高都计入**
- 两条路径最后都 `Math.max(面积, 单价表里的 rate 值)`（`l` 初值 `-1`，所以没有 rate 时就是面积本身）
- ⚠️ **`自定义方数 > -1` 时是「每樘下限」，不是覆盖**（2026-09-16 更正）。
  本节上方贴的代码是对的：`l = 自定义方数` → `Math.max(面积, l)`；调用方 `平方数 = gt(行) × 数量`（`:1478`）。
  即它**只会把面积抬上去、不会压下来**，且 **× 数量在外层**。
  原句「完全覆盖」是本节写的错，`Hui.vue` 的 `computeSquare` 曾照此实现（当总额直接返回）⇒ 已修。
- ⚠️⚠️ **新版随后又故意改成「覆盖」**（2026-09-16，用户拍板「业务上真要手动改小」）：
  `自定义方数 > -1` 时直接取该值（可低于面积、可低于最低平方数），留空 → 自动。
  **这是有意偏离旧版**，不是本节解码有误。旧版语义见本条上两行。

### 46.6 未确定

- ~~`P.value`（rate 映射）的写入点未逐一定位~~ → **已于 @46111/@46241 定位：`P.value = data.square`（`initializPing` 接口）**，见 46.4。
- `_0x1260` 表是否被其它组件复用（该表定义在 @18242，作用域够大，但我只验证了 offset 30839 起这个组件）。

---

### 46.7 补充（team-lead）：与实现对照 —— §45.2 的「未实现」确系误判

`Hui.vue` 的 `singleArea()` **早已实现了 46.5 的两条路径**：

```ts
/** 单樘面积（未乘数量）。钻石型：(宽+墙厚+亮窗高)×高/1e6；普通：宽×max(高,亮窗高)/1e6。 */
function singleArea(l: Line): number {
  if (isDiamond(l)) return ((w + wall + lw) * h) / 1_000_000
  return (w * Math.max(h, lw)) / 1_000_000
}
```

⇒ **§45.2 记的「新发现的未实现分支」是误判**：那支一直在，只是当时解不出 `t(420)`、无法确认它是 `'diamond'`。
（同组另外 4 处 `L.value[formulaid] === t(420)` 也随之确认是「钻石型走另一套输入框标题」。）

### 46.8 两张已破解串表对照

| 表 | accessor | 索引偏移 | 旋转 | 适用区域 | 已验证导出 |
|---|---|---|---|---|---|
| `_0x43b0d8` | 多种别名 | 无 | **497** | 打印/回执主逻辑 offset 430000–680000 | `tokens.json`（1010 项） |
| **`_0x1260`** | **`_0x4017e5` / `_0x2d32` / `x`** | **−136** | **216** | 前段组件（offset 10000–90000，含 `gt`/`mt`/算料 UI） | `/tmp/huidrive/tokens_x_4017e5.json`（563 项，有效 136–698） |

**取真值前必须先确认 accessor 属于哪张表** —— 同一索引在两张表里含义不同（如 `335`：`_0x43b0d8` 是「亮窗总高」、`_0x1260` 是「toFixed」）。
这解释了此前多轮里「索引查表解出无意义字符串」的现象。

### 46.9 ✅ 已解决：`P.value` 就是 `square`（先前的「rate」是格式化器污染）

46.4 引的那句在原文件里（offset 45800 附近）实为：

```js
const x = await fetch('https://www.samrtdoor.com.cn/1?param1=DrawingBehaviors&param2=' + t[488][443], { method:'POST', … })
const _ = await x.json()
if (200 === _.code) {
   const { material: t, square: a, formulaType: x, hingeNames: l } = _.data   // ← 键名是**字面量**，未被污染
   t && (O.value = t)
   a && (P.value = a)          // ← **P.value = data.square**
   x && (L.value = x)          //    L.value = data.formulaType
   l && (S.value = l)
}
```

⇒ **`P.value` = `square` 映射**。先前看到的 `{ rate: a, … }` 是**格式化器把 `square` 换成了随机串 `rate`**
（本项目已知污染模式 —— 不要相信 `Hui.formatted.js` 里的字面量）。

⇒ `gt` 的最小值来源**就是 `square`**；我们的 `minSquareOf()` 读 `formulas.square`
（平开为数字、吊趟为按扇数的 `"lo-hi"` 映射）**来源正确** ✅。
**原记的「潜在错配」撤回，不存在。**

附带确认：该数据来自接口 **`param1=DrawingBehaviors&param2=<租户>`**，响应 `data.{material, square, formulaType, hingeNames}`。


---

## 47. 第三十四轮：用新表普查「前段组件」（offset 10000–90000）——发现五金候选缺一路来源

`_0x1260` 表破解后，此前「解码出无意义字符串」的前段组件现在可读了。本轮用它普查该组件。

### 47.1 澄清一处先前的错误信息

上一轮我记「数据来自 `param1=DrawingBehaviors`」—— **错了**。用 `_0x1260` 表解码后，那段实为：

```js
const a = t[userinfo][registrant]
const x = await fetch('https://www.samrtdoor.com.cn/1?param1=initializPing&param2=' + a, { method:'GET', headers:{'Content-Type':'application/json'} })
const _ = await x.json()
if (200 === _.code) {
   const { material: t, square: a, formulaType: x, hingeNames: l } = _.data
   t && (O.value = t)      // 型材 → formulaId
   a && (P.value = a)      // square
   x && (L.value = x)      // formulaType
   l && (S.value = l)      // **hingeNames**
}
```

（`DrawingBehaviors` 是污染串，实为 `initializPing` —— 与 memory 里记的 `initializPing → material/square/hingeNames/formulaType` 完全吻合。）

### 47.2 ❗`hingeNames` 是**订单行「五金」格的候选来源**，我们没接

`S.value`（= `hingeNames`）全文件只在两处出现：赋值（@46181）与**消费**（@89220，紧挨着 `封板高` 单元格代码）：

```js
Vue.renderList(
    S.value.filter(e => !D.value.includes(e)),          // 全部 hingeNames − 已选项
    e => createBlock(H, { key: 'hinge_' + e, label: e, value: e })
)
```

即：**五金格是多选，候选来自服务端 `initializPing.hingeNames`，且过滤掉已选项**。

我们 `hardwareOptionsFor(l)` 现有四路来源：

| # | 来源 | 有？ |
|---|---|---|
| 1 | 当前公式 `extra.hinge` 的键（合页名） | ✅（用户先前要求加的） |
| 2 | `readFieldHistory('hardware')` 五金历史 | ✅ |
| 3 | `readFieldHistory('lock')` + `lockOptions`（锁具） | ✅ |
| 4 | **服务端 `hingeNames`（全局合页名列表）** | ❌ **缺** |

### 47.3 ✅ 已按原版改（用户裁定），并 E2E 验证

**原版语义**：五金格候选 = 服务端 `initializPing.hingeNames`（**租户级全局合页名清单**，与本行公式无关）
− 已选项。

**落地**：本系统后端没有该字段，用「**所有公式 `extra.hinge` 键的并集**」等价近似（同一语义：租户的合页名清单）。
`hardwareOptionsFor(l)` 的候选来源现为：

1. 本行公式 `extra.hinge` 的键（优先）
2. **所有公式 `extra.hinge` 键的并集** ← 新增，对应原版 `hingeNames`
3. 五金历史 `readFieldHistory('hardware')`
4. 锁具：`readFieldHistory('lock')` + `lockOptions`

**E2E 验证**（headless，行用公式 `123`，其 `hinge` 只有 `"1"`）：

```
五金格候选 = ["1", "2", "3", "二期", "锁具B", "锁具A"]
```

`2` / `3` / `二期` 来自公式 `33333` 的 `hinge` —— 说明**跨公式的全局并集生效**，与原版 `hingeNames` 行为一致 ✅
（此前用户反馈的「33333 里填的合页名『二期』不显示」也由此彻底解决。）


---

## 48. 第三十五轮：用新表普查前段组件（offset 10000–90000）——发现自动加价缺「单位」判定

`_0x1260` 破译后该组件可读。用脚本枚举其 57 个函数并解码各自的字符串，分类如下：

| 类 | 函数 |
|---|---|
| **业务计算** | `gt`(单樘平方)、`mt`(套线长度)、`yt`(金额 base)、**`wt`(加价项金额)**、**`Qt`(自动加价)**、`Ye`(按型材取价/匹配公式) |
| 字段 onChange | `Te`颜色 / `We`底玻 / `He`面玻 / `qe`开向 / `Ke`套线种类 / `Je`轨道种类 / `Re`安装地址 / `Xe`单价 / `Ze`门洞高 / `$e`门洞宽 / `Fe`亮窗总高 |
| 接口/其它 | `et`(拉 initializPing)、`ot`(图片上传)、`Ut`(更新回调)、`qt`(自定义方数)、`It`(未保存提醒)、`Lt`(开向图/门花图) 等 |

### 48.1 ❗`Qt`（自动加价）的候选判定：**名字 + 单位**两个条件

```js
if (t !== '墙厚' && e.计价方式 !== '套') return          // 超宽/超高**只在「套」时**自动加；超墙厚不限计价方式
const re = new RegExp("^" + (超宽|超高|超墙厚) + "\\d+$")
nt.value.forEach((item) => {
   if (re.test(item.name) && item.unit === '元/公分') { ...收集... }   // ← **单位必须是「元/公分」**
})
// 先移除本行已挂的同类项（同前缀 + 元/公分），再加入
// 选「阈值最接近且不超过当前值」的一项（n − 阈值 最小）
```

对照我们的 `parseAutoMarkup` + `markupAmount` / `recalcMarkup`：

| 点 | 原版 | 我们（改前） | |
|---|---|---|---|
| 超宽/超高 仅「套」 | ✅ | ✅ | 一致 |
| 超墙厚 不限计价方式 | ✅ | ✅ | 一致 |
| 选阈值最接近且不超 | ✅ | ✅（按阈值降序取首个） | 一致 |
| **候选须 `unit === '元/公分'`** | ✅ | ❌ **只判名字** | **已修** |

### 48.2 已修

新增 `isAutoCmMarkup(item)`：`parseAutoMarkup(item.name) && kind ∈ {超宽,超高,超墙厚} && item.unit === '元/公分'`。
`markupAmount` 的自动分支与 `recalcMarkup` 的分组/winner 判定**都改用它**。
（`轨道超长` / `超平米` 不在原版这条判定内，保持原逻辑不动。）

⇒ 一个叫「超宽1500」但单位是「元/米」的加价项，改前被当自动项算，改后按**普通项**算 —— 与原版一致。

### 48.3 ✅ 已按原版改为「移除」（用户裁定）

原版 `Qt` 在字段变化时：

```js
// 先移除本行已挂的同类项（同前缀 + 元/公分）
const rm = []
ft.value[e.id].forEach(k => { const it = nt.value[k]; if (it && it.name.startsWith(前缀) && it.unit === '元/公分') rm.push(k) })
if (rm.length) { ft.value[e.id] = ft.value[e.id].filter(k => !rm.includes(k)); nextTick(() => wt(ft.value[e.id], e)) }
// 再按「阈值最接近且不超过」补入一项
```

我们原来是把落选项 `item.amount = 0` 留在列表里，**改为直接剔除**：

```ts
const kept: MarkupItem[] = []
for (const item of l.markup) {
  if (isAutoCmMarkup(item) && !winners.has(item)) continue   // ← 原版：移除
  item.amount = round2(markupAmount(item, l))
  total += item.amount
  kept.push(item)
}
l.markup = kept
l.other_fee = round2(total)
```

⇒ `other_fee` 合计不变，但**页面加价列表与原版一致**（不再残留已失效的自动项）。

> ⚠️ 已知差异（比原版**更激进**一点）：原版只在 **门洞宽/门洞高/墙厚变化**时才触发移除；
> 我们的 `recalcMarkup` 在**任意加价列表变化**时都会剔除「阈值不满足」的自动项。
> 因此「手动添加一个当前不满阈值的自动项」在本版会被立即剔除，而原版会保留（金额按 `wt` 公式算）。
> 若实测发现这不合预期，可把剔除条件收紧为「仅在该行三个尺寸字段变化时」。


---

## 49. 第三十六轮：加价项金额 `wt` 全解码 —— 修正 `元/米`，确认 `轨道超长`/`元/方`/`元/公分`

### 49.1 `wt`（@50868，前段组件）完整规则

```js
wt = (已选index数组 e, 行 t) => {
  ft.value[t.id] = e
  for (const k of e) {
    const item = nt.value[k]; if (!item) continue
    let r = 0, s = ''
    if (item.unit === '元/套' || item.unit === '元/支')  r = item.price * t.数量
    else if (item.unit === '元/方') {
        if (item.name.includes('超平米')) { o = Number((t.平方数 - Number(名去前缀)).toFixed(3)); r = item.price * o * t.数量 }
        else                              { r = Number((item.price * t.平方数).toFixed(3)) }   // ← **不乘数量**
    }
    else if (item.unit === '元/米') {
        if (item.name.includes('门套'))   { o = (2*max(t.门洞高, t.亮窗总高) + t.门洞宽)/1e3; r = Number((item.price * o * t.数量).toFixed(3)) }
        // ← 名字不含「门套」的元/米项：**r 保持 0**
    }
    else if (item.unit === '元/公分') {
        item.name.includes('超高')   ? (o = (max(门洞高,亮窗总高) - 阈值)/10, x='超高:')
      : item.name.includes('超宽')   ? (o = (门洞宽 - 阈值)/10,               x='超宽:')
      : item.name.includes('超墙厚') ? (o = (墙厚  - 阈值)/10,               x='超墙厚:')
        r = item.price * o * t.数量
    }
    else if (item.unit === '无') r = item.price * t.数量
    total += r
  }
  t.加价项目 = texts.join('\n')      // ← 注意分隔符是 `\n`
  t.其它费用 = total
}
```

### 49.2 对照结果

| 单位 | 原版 | 我们（改前） | 处置 |
|---|---|---|---|
| `元/套`·`元/支` | `单价×数量` | ✅ | — |
| `元/方`（普通） | `单价×平方数`，**不乘数量** | ✅ | — |
| `元/方`（超平米） | `(平方数−阈值)×单价×数量` | ✅ | — |
| **`元/米`** | **只有名字含「门套」才计算**；长度 = `(2×max(门洞高,亮窗总高) + 门洞宽)/1000` | ❌ 用 `门洞宽/1000`，且不判「门套」 | **已修** |
| `元/公分` | `(实际−阈值)/10 × 单价 × 数量` | ✅ | — |
| `无` | `单价×数量` | ✅ | — |

### 49.3 `轨道超长` 不在 `wt` 里，另有实现（**与我们的写法一致**）

全文件 `轨道超长` 只出现 4 次，其中一处（offset ≈163066，**另一张表/另一个组件**）的加价金额计算里有：

```js
else if (e.name.includes('轨道超长')) { c = Number(名称去前缀) / 10; x = '轨道超长:' }   // ← **阈值/10**，不是「实际−阈值」
d = Math.round(e.price * c * t.数量)
```

⇒ 我们的 `case '轨道超长': return (th / 10) * p * q` **与原版一致** ✅（此前注释里写的「直接用阈值数字/10」是对的）。

> ⚠️ 本轮**未能**把 offsets 163000 那个函数完整解码：该区域用**另一张串表**，而我在临时脚本里把两张表混用导致译文不可信。
> 因此上面只采信「`轨道超长` 分支的算式」这一条（算式里的数字与标识符是明文，不依赖串表）。
> 该函数的其余分支（是否还有 `元/米` 等其它处理）**未确认**。


---

## 50. 第三十七轮：确认「加价金额」有**两份并行实现**，并判定哪份是活的

上轮在 offset ≈163066 发现另一处 `轨道超长` 分支，本轮把它读完，发现**文件里有两个近乎重复的「加价金额」函数**。

| | `wt`（**@50868**，前段组件） | `ft`（**@≈162000**，另一组件） |
|---|---|---|
| `元/套`·`元/支` | `price × 数量` | 同 |
| `元/方` | 普通 `price×平方数`；名字含「超平米」→ `(平方数−阈值)×price×数量` | 只有普通支（**无「超平米」**） |
| **`元/米`** | **只有名字含「门套」才计算**，长度 `(2×max(门洞高,亮窗总高) + 门洞宽)/1000` | **`门洞宽/1000`**（文案带「米」可证） |
| `元/公分` | 超高/超宽/超墙厚；`(实际−阈值)/10` | 超高/超宽/超墙厚 **＋`轨道超长`→`阈值/10`** |
| 金额取整 | 不取整（`元/方` 用 `toFixed(3)`） | **`Math.round(...)`** |
| 加价项目分隔 | `\n` | `\n` |

（`ft` 的串表与 `_0x1260` 不同，直接解码是乱码；但其中**中文单位字面量与属性名是明文**，
故上表按明文结构整理，可靠。）

### 50.1 判定：**`wt` 是活的**

- `wt` 所在的前段组件（offset 10000–90000）**就是订单行表格组件** ——
  证据：`hingeNames` 的消费点（@89220，五金格候选）在同一组件；`Qt`（自动加价）在同一组件里 `Vue.nextTick(() => wt(ft.value[e.id], e))` 调用 `wt`。
- `ft` 在另一个组件（offset ≈162000），本项目其余分析未在该区域发现与订单行表格相关的调用。

⇒ **`元/米` 以 `wt` 为准**（§49.2 的修正成立）：只有「门套」项计算，长度 `(2×max(门洞高,亮窗总高) + 门洞宽)/1000`。

### 50.2 但我们目前是「两份混着实现」的

| 分支 | 我们现状 | 来源判定 |
|---|---|---|
| `元/米` 门套支 | ✅ 已按 `wt` 改 | `wt`（活） |
| `轨道超长` → `阈值/10` | 有 | **只存在于 `ft`** —— 按 `wt` 应该**不算**（落进 `元/公分` 的 else，`o` 保持 0） |
| `超平米` | 有 | **只存在于 `wt`** ✓ |
| 金额取整 | 不取整 | 与 `wt` 一致 ✓ |

### 50.3 待用户实测确认（唯一悬案）

**`轨道超长` 项到底算不算钱？**

- 按**活的 `wt`**：`元/公分` 只处理 超高/超宽/超墙厚，`轨道超长` 落空 → **金额 0**；
- 按另一个 `ft`：`阈值/10 × 单价 × 数量`（**非零**）。

我们目前按 `ft` 实现（非零）。**请在旧版里加一个「轨道超长3000」的加价项试一下**：
若它算出了金额 → 我们是对的；若为 0 → 要按 `wt` 去掉这个分支。


---

# 附：实现点普查台账（全量索引）

> 本节汇总「全量实现点普查」的覆盖范围与结论，作为索引使用。逐项证据见前文各节。

## A. 已普查区域

| # | 区域 | 方法 | 结论 | 节 |
|---|---|---|---|---|
| 1 | **17 张打印模板 × 全部字段**（72 个 `field`） | 机器核验：模板声明的 field 集合 vs 各 builder 源码返回键 | **零缺失**（仅 `ReceiptList.payment` 与原版一致地为空；`product3` 的 `*1` 由 `pairRows` 运行时生成） | §44.3 |
| 2 | **打印载荷形状**（produces/glassInfoList/oldSheet/receipt/label 五类） | headless 真引擎实测 | ✅ | §8.3b |
| 3 | **打印引擎** | headless 实测 | ✅ 必须 `vue-plugin-hiprint@0.0.60`（fork 缺 qrcode 元素类型） | §8.3d |
| 4 | **doorsheet 四引擎** | 全量赋值点 → 逐点核 | ✅ | §15 |
| 5 | **doorframe / windows 四引擎** | 同上 | ✅ | §16 §18 |
| 6 | **basicInfo 五引擎** | 同上 | ✅（引擎A 四处差异已补） | §43 |
| 7 | **remark 十引擎** | 同上 | ✅ | §11 §19 §20 |
| 8 | **glass / size / lockway / GlassSize 多引擎** | 同上 | ✅（product10 平开 size 已修） | §44.2 |
| 9 | **回执表头 + 回执行字段** | 赋值点 + 实测 | ✅ | §1 §21 §22 |
| 10 | **glassHole 行构造器（B1–B4 / D1–D3）** | 控制流骨架全抽 | ✅ | §23 §25 §26 |
| 11 | **部件激活规则（state）** | 78 处 `.state=` 全枚举 → 按引擎重建 | ✅ 已改「默认 false + 规则置 true」模型 | §30 §32 §33 |
| 12 | **减量规则**（洞尺/墙型/边封增量/铰链） | 逐点核 | ✅（`applyWidthIncrement`/`applyHinge` 两处修正） | §28 §29 |
| 13 | **行级计算字段**（平方/套线长度/金额/加价金额） | 逐点核 | ✅（`元/米` 与自动加价单位门控两处修正） | §45 §48 §49 §50 |
| 14 | **前段组件（offset 10000–90000，57 个函数）** | 新表解码后枚举分类 | ✅ 业务函数 6 个全部核对 | §47 §48 §49 |
| 15 | **门店特判**（白名单/杉杉/晟斐/glassHole 三家） | 全量检索 | ✅ | §20 §22.4 |

## B. 串表基础设施（**关键**）

| 表 | accessor | 索引偏移 | 旋转 | 导出 |
|---|---|---|---|---|
| `_0x43b0d8` | 多种别名 | 无 | **497** | `/tmp/huidrive/tokens.json` |
| `_0x1260` | `_0x4017e5` / `_0x2d32` / `x` | **−136** | **216** | `/tmp/huidrive/tokens_x_4017e5.json` |

⚠️ **同一索引在两张表里含义不同**。取真值前必须先确认 accessor 属哪张表 —— 这是本项目多轮误判的根因。
⚠️ **`Hui.formatted.js` 的字面量不可信**（`.join`/`.push`/键名会被替换成随机串，如 `square`→`rate`）。

## C. 待用户实测确认（**仅剩 2 条**）

| # | 问题 | 两种可能 | 我们的现状 |
|---|---|---|---|
| 1 | **平开行的「亮窗玻璃」件显示吗？**（§33.2） | 源码推出：平开引擎无亮窗激活规则 → **不显示**；若旧版显示，则另有分支 | 按「不显示」实现 |
| 2 | **`轨道超长` 加价项算钱吗？**（§50.3） | 活组件 `wt` 无此分支 → **0**；另一组件 `ft` → **`阈值/10×单价×数量`** | 按 `ft` 实现（非零） |

## D. 有意不实现（有据可查，非遗漏）

| 项 | 原因 |
|---|---|
| `kou` 列（引擎B 有该字段） | 17 张模板均无此列（§18.3） |
| product4「料标签」版式 | 库里 `product4` 与 `product5–9` md5 全等且是 produces 表，该版式**未随 getTemplates 导入**（§21.3） |
| 名单二 `_0x2fca47`（艺佳/索力纳）的 SVG 挖孔图 | 需移植 30 行 SVG 生成器，本租户不命中（§20.3） |
| `_0x5c8c94` 现场生成 SVG | 同上 |
| 杉杉 / 晟斐 / glassHole 三家的门店特判 | **已实现**（§20 §22.4）—— 对昊艺门窗为惰性分支 |
| 回执 `TotalBalance`（客户账户余额） | 需财务模块；现以「总价−定金」占位（§13） |
| 回执 `payQrcode`（收款码图） | 需图片库；现为空 |


---

## 51. 第三十八轮：**用户实测推翻 §33.2** —— 平开确实显示亮窗玻璃件，我们的排除是错的

用户反馈：「**平开显示上亮玻璃，不是亮窗玻璃；我看移门和平开不同**」。

### 51.1 复查原文：单玻/双玻块**没有 `亮窗` 排除**

我上一轮用 `.state\s*=` 正则扫「B平只有 3 条规则」，**漏了方括号形式** `a[t(523){state}]=!0`。
改用 `\.state\s*=|\[[A-Za-z_$]\w*\(\s*523\s*\)` 重扫，B平 内共 **17 处** state 赋值。

关键的一块（@485130–485700）原文：

```js
_0x82046a = ("无" === 底玻 || "无" === 面玻)                  // 单玻
_0x2c9e12 = ("无" !== 底玻 && "无" !== 面玻)                  // 双玻

if (单玻) {
   Object.keys(parts).forEach(t => {
      if ((t.includes('玻璃宽') || t.includes('玻璃高')) && !t.includes('单玻')) {
         const x = t + '单玻'
         parts[x] ? (parts[t].state = false, parts[x].state = true) : parts[t].state = true
      }
   })
}
if (双玻) {
   Object.keys(parts).forEach(e => {
      e.includes('单玻') && (parts[e].state = false)
      !e.includes('单玻') && e.includes('玻璃') && (parts[e].state = true)
   })
}
```

**两个块里都没有 `!includes('亮窗')` / `LiangChuang` 排除。** B吊（@500508 一带）同样没有。

⇒ `上亮窗玻璃宽/高`（**名字里带「亮窗」**）在平开里：
- 单玻：`(玻璃宽||玻璃高) && !单玻` 成立 → 无 `+单玻` 变体时 `state = true` → **激活**；
- 双玻：`!单玻 && 玻璃` 成立 → **激活**。

### 51.2 我们错在哪

`applyPartState` 的单玻/双玻块里写着：

```ts
if (!k.includes('亮窗') && !k.includes('LiangChuang') && (玻璃宽||玻璃高) && !单玻) …
if (k.includes('亮窗') || k.includes('LiangChuang')) continue
```

这两条排除来自 §30 那份规格（**该规格在这一处是错的**），我照抄了。

### 51.3 已修并 E2E 验证

删除两处排除。重跑平开 E2E（夹具部件名 `上亮窗玻璃宽/高`）：

```
修复前：上亮横 ✓  压线宽 ✓  压线高 ✓   …（无上亮窗玻璃件）
修复后：上亮横:900*1  上亮窗玻璃宽:900*1  上亮窗玻璃高:500*1  压线宽:900*1  压线高:500*1
```

`上亮窗玻璃高 = 500` = `h1 − h − v` = 2500−2000−0 ✓ 数值正确。

### 51.4 教训（第三次同类）

**`.state=` 的方括号形式漏扫**导致我误判「B平只有 3 条规则」并据此下了错误结论。
⇒ 本项目里凡「统计某模式出现次数」的扫描，**必须同时覆盖点号与方括号两种形态**。
（同类前科：§47 用错 accessor 表、§46.9 误信 formatted 字面量。）

---

## §52 八引擎 state 规则逐套抽取 + 差异矩阵

来源：`legacy/js/Hui-d088417c.js`（原始 chunk）。
扫描正则**同时覆盖两种赋值形态**（吸取 team-lead 上一轮的教训）：
`\.state\s*=` **或** `\[[A-Za-z_$]\w*\(\s*523\s*\)\]\s*=` **或** `\["state"\]\s*=`。
脚本：`/tmp/huidrive/state_scan.py`（块定位+计数）、`/tmp/huidrive/state_rules.py`（逐条抽规则）、`/tmp/huidrive/block_diff.py`（跨引擎归一化比对）。
数据：`/tmp/huidrive/state_rules.json`、`/tmp/huidrive/blocks_norm.json`。

### 52.0 先勘误：team-lead 给的「部件表变量」有 4 个是错的

部件表 = `JSON.parse(JSON.stringify(<公式>.diao))` 的**深拷贝目标**（§30.0-①）。实测赋值点：

| 入口 | 平开 部件表 | 赋值偏移 | 吊趟 部件表 | 赋值偏移 |
|---|---|---|---|---|
| 玻璃合片单 `_0x4f7790` | **`_0x4128ff`** | @457576 | **`_0x2e92e0`** | @467473 |
| 生产单 `_0x32bd6f` | `_0x31280d` | @483341 | `_0x37fd28` | @499370 |
| 生产单定制 `_0x320f0e` | **`_0x497f7d`** | @524224 | **`_0x7da398`** | @538368 |
| 平开门生产单(定制) `_0x15ef6c` | `_0x1bc7b7` | @562344 | `_0x3556ef` | @572403 |
| 玻璃订单 `_0x509b06` | `_0x432374` | @412232 | `_0x342a31` | @434281 |
| 生产标签 `_0x2e25b8` | `_0x4134a4` | @378146 | `_0x3b79ec` | @388687 |

team-lead 表里的 `_0x58f027` / `_0x20ce72` / `_0x1f6573` / `_0x27f541` **是 `calculationResults`（输出映射），不是部件表**，
它们是「只收 `state===true`」的产物（如 @463123 `_0x4128ff[e] → _0x58f027`），改它们不生效。

### 52.1 ★ 差异矩阵（主表）：各引擎 7 个 `Object.keys(部件表)` 块的**偏移 : state 规则条数**

顺序即执行顺序，**后面的覆盖前面的**。

| 引擎(部件表) | ① | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | 合计 |
|---|---|---|---|---|---|---|---|---|
| **A平** `_0x4128ff` | 459385:3 | 459630:2 | 459798:3 | 460911:1 | 461804:2 | 462112:0 | 463123:0 | **11** |
| **A吊** `_0x2e92e0` | 468374:3 | 468698:0 | 469018:9 | 471502:1 | 472381:2 | 472699:0 | 473709:0 | **15** |
| **B平** `_0x31280d` | 485198:3 | 485439:2 | 485620:5 | 486888:2 | 487944:2 | 488262:0 | 489281:0 | **14** |
| **B吊** `_0x37fd28` | 500279:3 | 500608:0 | 500918:39 | 506013:2 | 507283:2 | 507590:0 | 508589:0 | **46** |
| **D平** `_0x497f7d` | 526101:3 | 526353:2 | 526532:5 | 528031:2 | 529146:2 | 529437:0 | 530428:0 | **14** |
| **D吊** `_0x7da398` | 539250:3 | 539565:0 | 539885:39 | 544938:2 | 546123:2 | 546424:0 | 547402:0 | **46** |
| **P1平** `_0x1bc7b7` | 564111:3 | 564360:2 | 564531:5 | 565809:1 | 566692:2 | 567010:0 | 567979:0 | **13** |
| **C吊** `_0x3556ef` | 573298:3 | 573595:0 | 573922:35 | 578045:1 | 578931:2 | 579241:0 | 580272:0 | **41** |
| **G平** `_0x432374` | 414181:3 | 414431:2 | 414613:3 | 415734:1 | 416658:2 | 416944:0 | 417963:0 | **11** |
| **G吊** `_0x342a31` | 435243:3 | 435563:0 | 435867:9 | 438329:1 | 439222:2 | 439507:0 | 440517:0 | **15** |
| **L1** `_0x4134a4` | 380102:3 | 380344:2 | 380526:5 | 381808:2 | 382891:2 | 383190:0 | 384183:0 | **14** |
| **L2** `_0x3b79ec` | 389645:3 | 389933:2 | **390239:3** | **390555:0** | **390870:39** | 395925:2 | 397118:2 | (+397419:0 / 398418:0) **51** |

推得的**族内分组**（见 52.3 的相似度佐证）：

- 平开：`{A平, G平}` = 11；`{B平, D平, L1}` = 14；`P1平` = 13
- 吊趟：`{A吊, G吊}` = 15；`{B吊, D吊}` = 46；`C吊` = 41；`L2` = 51（9 块结构）

### 52.2 覆盖率自证（防止"漏扫"）

| 函数 | 区间内 `.state=` 总数 | 归入 7 个 `Object.keys(部件表)` 块内 | 直接写 `部件表.state=` 的 |
|---|---|---|---|
| `_0x4f7790`（A平+A吊） | 26 | 11 + 15 = **26** ✅ | 0 |
| `_0x32bd6f`（B平+B吊） | 60 | 14 + 46 = **60** ✅ | 0 |

⇒ **没有任何规则绕过这 7 个块**；块计数即全量。

### 52.3 块级归一化相似度（把变量名/表名归一后逐字比对）

| 块 | 平开族 vs **B平** | | | | | 吊趟族 vs **B吊** | | | | |
|---|---|---|---|---|---|---|---|---|---|---|
|  | A平 | D平 | P1平 | G平 | L1 | A吊 | D吊 | C吊 | G吊 | L2 |
| ① | 0.93 | 0.93 | 0.91 | 0.80 | 0.84 | 0.51 | 0.62 | 0.75 | 0.72 | 0.28 |
| ② | 0.94 | 0.96 | 0.82 | 0.82 | 0.94 | 0.99 | 0.99 | 0.98 | 0.83 | 0.15 |
| ③ | **0.28** | **0.72** | **0.31** | **0.51** | **0.30** | **0.15** | **0.20** | **0.35** | **0.17** | 0.05 |
| ④ | 0.86 | 0.88 | 0.79 | 0.78 | 0.77 | **0.41** | **0.57** | **0.62** | 0.61 | 0.06 |
| ⑤ | 0.83 | 0.86 | 0.74 | 0.75 | 0.80 | 0.92 | 0.84 | 0.82 | 0.92 | 0.03 |
| ⑥ | 0.83 | 0.86 | 0.66 | 0.84 | 0.82 | 0.68 | 0.61 | 0.44 | 0.87 | 0.10 |
| ⑦ | 0.98 | 0.90 | 0.89 | 0.79 | 0.35 | 0.91 | 0.95 | 0.95 | 0.95 | 0.14 |

**结论：块 ③ 是各引擎差异最大的地方**（平开是 v 调整块，吊趟是主规则块）——**绝不能跨引擎套用**，团队 lead 的教训在此得到量化证实。

### 52.4 平开族逐条（① 单玻替换 / ② 双非无 / ③ v调整）

**① 单玻替换块** —— 六个平开引擎**逐字符相同**（仅变量名不同）：

```js
if (底玻==='无' || 面玻==='无') {                       // 双无/单玻
  Object.keys(MAP).forEach(name => {
    if ((name.includes('玻璃宽') || name.includes('玻璃高')) && !name.includes('单玻')) {
      const variant = name + '单玻'
      if (keys.includes(variant)) { MAP[name].state = false; MAP[variant].state = true }
      else                        { MAP[name].state = true }
    }
  })
}
```
证据：A平@459385、B平@485198、D平@526101、P1平@564111、G平@414181、L1@380102。
**`亮窗` 排除：无**（`亮窗` 在平开 7 块内共出现 2 次，全在块③的 `!includes('亮窗')` v 调整条件里）。

**② 双非无块** —— 六个平开引擎**逐字符相同**：

```js
if (底玻!=='无' && 面玻!=='无') {
  Object.keys(MAP).forEach(name => {
    if (name.includes('单玻'))                                       MAP[name].state = false
    if (!name.includes('单玻') && name.includes('玻璃'))              MAP[name].state = true
  })
}
```
证据：A平@459630、B平@485439、D平@526353、P1平@564360、G平@414431、L1@380344。

**③ v 调整块 —— 三套不同**（这是平开族唯一的实质差异）：

三者共有（逐字符同）：
```js
name.includes('上下方')                    → v = (Number(v)||0) + Δ上下方
name.includes('光企高') && !name.includes('亮窗') → v = (Number(v)||0) + Δ光企高
name.includes('玻璃高') && Number(行.封板高)>0 && !name.includes('亮窗') → v = Number(行.封板高) + v
if (!name.includes('玻璃宽') && !name.includes('玻璃高')) {
    行.墙厚>0 ? state=true : (含扣板 [?] 含压线?) ? state=false : state=true
}
```

| 变体 | `扣板/压线` 禁用分支 | 封板追加规则 | 证据 |
|---|---|---|---|
| **变体甲** `{A平, G平}` | `含'扣板' \|\| 含'压线'` → false | **无**（块到此结束） | A平@459798、G平@414613 |
| **变体乙** `{B平, L1}` | **仅** `含'扣板'` → false（**无压线**） | 有 | B平@485620、L1@380526 |
| **变体丙** `{D平, P1平}` | `含'扣板' \|\| 含'压线'` → false | 有 | D平@526532、P1平@564531 |

封板追加规则（变体乙/丙共有）：
```js
name.includes('封板') && 0 == Number(行.封板高)   → state = false
name.includes('封板高') && Number(行.封板高) > 0  → state = true, v = Number(行.封板高) - v
```

### 52.5 吊趟族逐条

**① 活扇块 —— 两套**：

| 变体 | 规则① | 规则② | 规则③ | 证据 |
|---|---|---|---|---|
| **`{A吊, G吊}`** | `name.includes(扇数) && name.includes('玻璃宽')` → true | `name.includes('玻璃高') && part.track===行.轨道种类 && name.includes(扇数)` → true | `行.亮窗总高>0 && name.includes('玻璃')` → true | A吊@468374、G吊@435243 |
| **`{B吊, D吊, C吊}`** | `name.includes('活') && !name.includes('玻璃高')` → true | 同上 | 同上 | B吊@500279、D吊@539250、C吊@573298 |

**② 块** = `some(t => t.includes(e) && t.includes('单玻'))` 的**只读判据**，0 条 state 写入（A吊@468698、B吊@500608、D吊@539565、C吊@573595、G吊@435563）。

**③ 主规则块 —— 三套，差异巨大**：

**③-A `{A吊 @469018, G吊 @435867}`（9 条，两个引擎逐字符同）**，按序：

| # | 条件 | state | 备注 |
|---|---|---|---|
| 1 | `t && !c && name.includes(e) && name.includes('单玻')` | `false` | `c = 底玻==='无'\|\|面玻==='无'`；`e`,`t` 为单玻变体循环量 |
| 2 | `else if (n && t && name.includes(e))` | `= name.includes('单玻')` | `n = !扇数.includes('活') && c` |
| 3 | `else if (name.includes(扇数) && name.includes('方'))` | `true` | |
| 4 | `name.includes(扇数) && name.includes('上下方')` | — | `v=(Number(v)\|\|0)+x`，置 `a=1` |
| 5 | `name.includes(扇数) && name.includes('玻璃')` | `true` | + `含'玻璃高' && Number(封板高)>0` → `v=Number(封板高)+v` |
| 6 | `含'光企' && part.track===行.轨道种类 && 含(扇数)` | `true` | ★轨道种类门控 |
| 7 | `含'勾企' && track===轨道种类 && 含(扇数)` | `true` | ★ |
| 8 | `含'合页' && track===轨道种类 && 含(扇数)` | `true` | ★ |
| 9 | `含'锁' && track===轨道种类 && 含(扇数)` | `true` | ★ |
| 10 | `行.亮窗数量>0`：`s=亮窗数量+'格亮窗'`；`含(s)` | `true` | + `含(s+'玻璃宽')` → `v=(Number(v)\|\|0)-x` |

**③-B `{B吊 @500918, D吊 @539885}`（39 条）**：= ③-A 的 1–9 条（顺序略有差别，B吊把 白玻/单玻 两条放在最前且带 `return`）
**再追加 30 条**：`固定 / 移动 / 封板 / 扣板厚(a===1 时 v-=x) / 盖板 / 扇数.substring(0,2)前缀 / 边封(门洞高>亮窗总高 && 含'无') / 上横(门洞高<亮窗总高) / 边封(门洞高<亮窗总高 && !含'无') / 包宽 / 包高(无 h1+，亮窗<洞高) / 包高(有 h1+，亮窗>洞高) / 墙厚>0&&亮窗总高===0 的{F槽宽,扣板宽,F槽高(非亮窗),扣板高(非亮窗),扣板厚×2} / 墙厚>0&&亮窗总高>0 的{F槽宽,扣板宽,亮窗F槽高,亮窗扣板高,扣板厚×2} / 收口×7`。
完整逐条见 §30.3（那一节即 B吊 的 39 条清单）。

**③-C `C吊 @573922`（35 条）**：与 ③-B 同族；**已逐条比对，见 §52.5b** —— 比 `B吊` 少 3 条（`固定`/`移动`/`收口+单轨2扇`），另有 1 处「包高」三元→`||` 改写（语义等价）。


### 52.5b `C吊` ③-C（@573922，35 条）与 `B吊` ③-B（@500918，39 条）的逐条差集

**结论：`C吊` 比 `B吊` 真正少 3 条规则；第 4 条差数是「包高」的三元被改写成 `||`（state 写入 2 次→1 次，语义等价）。**
39 − 3 − 1 = 35 ✅

#### `C吊` ③-C 完整 35 条（按源码顺序；`c`=部件对象，`l`=部件名，`a`=局部状态位，`x`/`_`=开间扣减量）

| # | 偏移 | 条件 | state | 改 `v` |
|---|---|---|---|---|
| 1 | 574129 | `t && !n && l.includes(e) && l.includes('单玻')` | `false`（`return void`） | |
| 2 | 574177 | `d && t && l.includes(e)` | `= l.includes('单玻')`（`return void`） | |
| 3 | 574241 | `l.includes(扇数) && l.includes('方')` | `true` | |
| — | @574395前 | `l.includes(扇数) && l.includes('上下方')` | **无 state** | `v=(Number(v)\|\|0)+x`，置 `a=1` |
| 4 | 574395 | `l.includes(扇数) && l.includes('封板') && Number(封板高)>0` | `true` | 同条内：含`封板高`→`v=Number(封板高)-v`；含`封板宽`(o(1e3)) `&& 1===a`→`v-=x` |
| 5 | 574554 | `l.includes(扇数) && l.includes('玻璃')` | `true` | 含`玻璃高`&&`Number(封板高)>0`→`v=Number(封板高)+v` |
| 6 | 574694 | `l.includes(扇数) && l.includes('盖板')` | `true` | |
| 7 | 574809 | `r=扇数.substring(0,2); r.length===2 && l.includes(r) && !l.includes('扇') && !l.includes('扣板')` | `true` | `1===a && _>0 && (含上滑\|上轨\|下滑\|左右盖板\|上下盖板\|轨道盖板)`→`v=(Number(v)\|\|0)-_` |
| 8 | 575044 | `l.includes('光企') && c.track===行.轨道种类 && l.includes(扇数)` | `true` | |
| 9 | 575129 | `l.includes('勾企') && c.track===行.轨道种类 && l.includes(扇数)` | `true` | |
| 10 | 575215 | `l.includes('合页') && c.track===行.轨道种类 && l.includes(扇数)` | `true` | |
| 11 | 575300 | `l.includes('锁') && c.track===行.轨道种类 && l.includes(扇数)` | `true` | |
| 12 | 575385 | `l.includes('边封') && 门洞高 > 亮窗总高 && l.includes('无')` | `true` | |
| 13 | 575454 | `l.includes('上横') && 门洞高 < 亮窗总高` | `true` | `1===a && _>0`→`v-=_` |
| 14 | 575577 | `l.includes('边封') && 门洞高 < 亮窗总高 && !l.includes('无')` | `true` | |
| 15 | 575641 | `l.includes('包宽') && c.track===行.套线种类` | `true` | |
| 16 | 575881 | `(含'包高' && !formula.includes('h1+') && track===套线种类 && 亮窗总高<门洞高) \|\| (含'包高' && formula.includes('h1+') && track===套线种类 && 亮窗总高>门洞高)` | `true`（**单个** `&&(c.state=!0)`） | |
| 17 | 575959 | `墙厚>0 && 亮窗总高===0` 且 `l.includes('F槽宽')` | `true` | |
| 18 | 575993 | 同上块：`l.includes('扣板宽')` | `true` | |
| 19 | 576045 | 同上块：`l.includes('F槽高') && !l.includes('亮窗')` | `true` | |
| 20 | 576099 | 同上块：`l.includes('扣板高') && !l.includes('亮窗')` | `true` | |
| 21 | 576162 | 同上块：`含'扣板厚' && l.includes(r) && c.title===''` | `true` | |
| 22 | 576258 | 同上块：`含'扣板厚' && l.includes(r) && c.title!=='' && c.track===套线种类` | `true` | |
| 23 | 576335 | `墙厚>0 && 亮窗总高>0` 且 `l.includes('F槽宽')` | `true` | |
| 24 | 576369 | 同上块：`l.includes('扣板宽')` | `true` | |
| 25 | 576404 | 同上块：`l.includes('亮窗F槽高')` | `true` | |
| 26 | 576437 | 同上块：`l.includes('亮窗扣板高')` | `true` | |
| 27 | 576502 | 同上块：`含'扣板厚' && l.includes(r) && c.title===''` | `true` | |
| 28 | 576596 | 同上块：`含'扣板厚' && l.includes(r) && c.title!=='' && c.track===套线种类` | `true` | |
| 29 | 576681 | `亮窗数量>0`：`s=亮窗数量+'格亮窗'`；`l.includes(s)` | `true` | `l.includes(s+'玻璃宽')`→`v=(Number(v)\|\|0)-x` |
| 30 | 576808 | `l.includes('收口') && 扇数.includes('4扇') && !扇数.includes('折叠')` | `true` | |
| 31 | 576924 | `含'收口' && 扇数.includes('3扇') && 扇数.includes('折叠') && !开向.includes('0')` | `true` | |
| 32 | 577038 | 同上，`'4扇' && '折叠'` | `true` | |
| 33 | 577154 | 同上，`'5扇' && '折叠'` | `true` | |
| 34 | 577268 | 同上，`'6扇' && '折叠'` | `true` | |
| 35 | 577325 | `l.includes('收口') && 扇数.includes('2轨3扇')` | `true` | |

#### 与 `B吊` 39 条的逐条对照

| B吊 # | B吊 偏移 | 规则 | C吊 对等 # | 偏移 | 判定 |
|---|---|---|---|---|---|
| 1 | 501136 | 单玻→false | 1 | 574129 | ✅ 对等 |
| 2 | 501182 | `d&&t`→`=含单玻` | 2 | 574177 | ✅ |
| 3 | 501249 | `方`→true | 3 | 574241 | ✅ |
| **4** | **501373** | **`固定`→true** | — | — | ❌ **C吊 无** |
| **5** | **501427** | **`移动`→true** | — | — | ❌ **C吊 无** |
| 6 | 501509 | `封板` | 4 | 574395 | ✅ |
| 7 | 501670 | `玻璃` | 5 | 574554 | ✅ |
| 8 | 501807 | `盖板` | 6 | 574694 | ✅ |
| 9 | 501922 | `r`前缀 | 7 | 574809 | ✅ |
| 10 | 502154 | `光企`+track | 8 | 575044 | ✅ |
| 11 | 502238 | `勾企`+track | 9 | 575129 | ✅ |
| 12 | 502322 | `合页`+track | 10 | 575215 | ✅ |
| 13 | 502406 | `锁`+track | 11 | 575300 | ✅ |
| 14 | 502492 | `边封`(>) | 12 | 575385 | ✅ |
| 15 | 502561 | `上横` | 13 | 575454 | ✅ |
| 16 | 502685 | `边封`(<) | 14 | 575577 | ✅ |
| 17 | 502749 | `包宽` | 15 | 575641 | ✅ |
| **18** | **502875** | **`包高` 三元分支A（`?c.state=!0`）** | 16 | 575881 | ⚠️ **改写**：C吊 合并成 `\|\|` 单条 |
| **19** | **503000** | **`包高` 三元分支B（`:…&&(c.state=!0)`）** | ↑ 同 16 | 575881 | ⚠️ 同上（写入次数 2→1，**语义等价**） |
| 20 | 503075 | 墙厚&亮窗0：F槽宽 | 17 | 575959 | ✅ |
| 21 | 503107 | 扣板宽 | 18 | 575993 | ✅ |
| 22 | 503158 | F槽高 | 19 | 576045 | ✅ |
| 23 | 503212 | 扣板高 | 20 | 576099 | ✅ |
| 24 | 503277 | 扣板厚(title='') | 21 | 576162 | ✅ |
| 25 | 503374 | 扣板厚(title≠'') | 22 | 576258 | ✅ |
| 26 | 503449 | 墙厚&亮窗>0：F槽宽 | 23 | 576335 | ✅ |
| 27 | 503483 | 扣板宽 | 24 | 576369 | ✅ |
| 28 | 503517 | 亮窗F槽高 | 25 | 576404 | ✅ |
| 29 | 503552 | 亮窗扣板高 | 26 | 576437 | ✅ |
| 30 | 503617 | 扣板厚(title='') | 27 | 576502 | ✅ |
| 31 | 503711 | 扣板厚(title≠'') | 28 | 576596 | ✅ |
| 32 | 503796 | 亮窗数量 | 29 | 576681 | ✅ |
| 33 | 503925 | 收口 4扇非折叠 | 30 | 576808 | ✅ |
| 34 | 504040 | 收口 3扇折叠 | 31 | 576924 | ✅ |
| 35 | 504153 | 收口 4扇折叠 | 32 | 577038 | ✅ |
| 36 | 504267 | 收口 5扇折叠 | 33 | 577154 | ✅ |
| 37 | 504380 | 收口 6扇折叠 | 34 | 577268 | ✅ |
| **38** | **504440** | **收口 2轨3扇** | 35 | 577325 | ✅ |
| **39** | **504499** | **收口 单轨2扇** | — | — | ❌ **C吊 无** |

#### 差集汇总（可直接照此改代码）

**`C吊` 比 `B吊` 少 3 条真规则：**

1. `l.includes(扇数) && l.includes('固定')` → `state = true`（B吊 @501427… 实为 @501373 之后一条；B吊 有，C吊 **无**）
2. `l.includes(扇数) && l.includes('移动')` → `state = true`（B吊 @501427；C吊 **无**）
3. `l.includes('收口') && 扇数.includes('单轨2扇')` → `state = true`（B吊 @504499；C吊 **无**）

**外加 1 处改写（不是缺失）：**「包高」B吊 用三元 `?c[state]=!0 : ...&&(c.state=!0)`（**2 次 state 写入**，@502875 / @503000），`C吊` 用 `(A || B) && (c[state]=!0)`（**1 次写入**，@575881）——**语义等价**，条数差 1 由此而来。

**关键字存在性交叉验证**（整块文本计数，B吊 块 vs C吊 块）：
`固定 1:0`、`移动 1:0`、`单轨2扇 1:0`、`收口 7:6`、`扇 8:7` —— 其余 40 个候选关键字（`包高`/`h1+`/`墙厚`/`亮窗总高`/`亮窗数量`/`F槽宽`/`F槽高`/`扣板宽`/`扣板高`/`扣板厚`/`亮窗F槽高`/`亮窗扣板高`/`光企`/`勾企`/`合页`/`锁`/`边封`/`上横`/`方`/`上下方`/`封板`/`封板高`/`玻璃`/`玻璃高`/`单玻`/`上滑`/`上轨`/`下滑`/`左右盖板`/`上下盖板`/`轨道盖板`/`3扇`/`4扇`/`5扇`/`6扇`/`折叠`/`盖板`/`2轨3扇`/`包宽`/`亮窗`）**计数完全一致**。
⇒ 除上述 3 条 + 1 处改写外，`C吊` ③-C 与 `B吊` ③-B **逐条对等**。

#### 任务 2：`C吊` 第二遍 eval（@578931）**没有 `<1` 阈值**

@579747 原文（已解码）：

```js
const _0x4ca8ce = eval(...), _0x31f931 = Math.round(_0x4ca8ce);
_0x31f931 < 0 ? (_0x4e85d7.state = false, _0x4e85d7.result = 0)
              : (_0x4e85d7.result = _0x31f931, delete _0x4e85d7.needsSecondPass)
} catch { _0x4e85d7.result = 'error', _0x4e85d7.state = false }
```

对该块区间 `[578900, 580300]` 全段检索：**`"<1"` 命中 0 次、`滑` 0 次、`单轨` 0 次**。
⇒ **`C吊` 的第二遍只判 `< 0`**，与 `{A平,B平,D平,P1平,G平,L1}` 同；**只有 `B吊`(@506843) 与 `L2`(@396756) 有 `<1 && !滑 && !单轨`**。

（`C吊` 主 eval 块 @578045 亦为 `<0`，见 @578785。）

### 52.6 通用规则（12 个映射全都有）

| 规则 | 条件 | 动作 | 证据（每引擎一处） |
|---|---|---|---|
| 主 eval | `if(part.state)` → eval formula → `round<0` | `state=false; result=0` | A平@462892 A吊@473498 B平@489067 B吊@508395 D平@530214 D吊@547211 P1平@567778 C吊@580051 G平@417742 G吊@440303 L1@383973 L2@398197 |
| 第二遍 eval（`state && needsSecondPass`） | `round<0` | `state=false; result=0` | A平@463080 A吊@473676 B平@489238 B吊@508546 D平@530385 D吊@547369 P1平@567936 C吊@580239 G平@417920 G吊@440474 L1@384151 L2@398375 |
| 扣板厚负值联动 | 主 eval 里 `含'扣板厚'` 且 `round<0` → 置标志；之后 `round>=0` 的部件若 `含'扣板' \|\| 含'压条'` | `state=false` | B平@487605、D平@528787、L1@382539；B吊在第二遍：@506843 |

**`<1 && !滑 && !单轨`**：只实测命中 **B吊 第二遍 @506843**（`state===true && round<1 && !含'滑' && !含'单轨'` → `state=false, result=0, quantity=0`）与 **L2 @396756**；
`C吊` 的第二遍 @578931 规则数为 2（与 B吊 同形），是否含 `<1` 未逐字确认。
**平开各族（A平/B平/D平/P1平/G平/L1）的第二遍块规则数均为 2 且无 `<1`** —— 与 §30.0-③ 一致。

### 52.7 差异矩阵（按"规则族"逐格，每格带偏移；「无」= 扫了该引擎全部 7 块未命中）

| 规则族 | A平 | B平 | D平 | P1平 | G平 | L1 | A吊 | B吊 | D吊 | C吊 | G吊 | L2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 单玻替换（`+单玻` 变体） | @459385 | @485198 | @526101 | @564111 | @414181 | @380102 | 并入③-1/2 | 并入③-1/2 | 并入③-1/2 | 并入③-1/2 | 并入③-1/2 | @389645 |
| 双非无（单玻false/玻璃true） | @459630 | @485439 | @526353 | @564360 | @414431 | @380344 | 并入③ | 并入③ | 并入③ | 并入③ | 并入③ | @389933 |
| `上下方` v+ / `光企高` v+ / `玻璃高` v+ | @459798 | @485620 | @526532 | @564531 | @414613 | @380526 | ③-4 | ③-4 | ③-4 | ③-4 | ③-4 | @390239 |
| `扣板\|\|压线` → false | @459798 | **无压线** @485620 | @526532 | @564531 | @414613 | **无压线** @380526 | 无 | 无 | 无 | 无 | 无 | @390239 |
| `封板/封板高` | **无** | @485620 | @526532 | @564531 | **无** | @380526 | 无 | @501509/@501670 | @540199 | @574177 | 无 | 无 |
| `方` → true | 无 | 无 | 无 | 无 | 无 | 无 | ③-3 | ③-3 | ③-3 | ③-3 | ③-3 | @391316 |
| `固定` → true | 无 | 无 | 无 | 无 | 无 | 无 | **无** | @5019xx | @5402xx | 无 | **无** | @391372 |
| `移动` → true | 无 | 无 | 无 | 无 | 无 | 无 | **无** | @5019xx | @5402xx | 无 | **无** | @391455 |
| `盖板` → true | 无 | 无 | 无 | 无 | 无 | 无 | **无** | @5019xx | @5402xx | 无 | **无** | @391757/@391873 |
| `光企/勾企/合页/锁` + `track===轨道种类` | 无 | 无 | 无 | 无 | 无 | 无 | ③-6..9 | ③-6..9 | @541106/@541190/@541276 | @575044/@575129 | ③-6..9 | @3921xx |
| `边封`（门洞高 vs 亮窗总高，「无」/非「无」） | 无 | 无 | 无 | 无 | 无 | 无 | **无** | @502492/@502561 | @541447/@541515 | 无 | **无** | @392631 |
| `上横`（门洞高<亮窗总高） | 无 | 无 | 无 | 无 | 无 | 无 | **无** | @502xxx | @541xxx | 无 | **无** | @3926xx |
| `包宽` / `包高`（含 `h1+` 分支） | 无 | 无 | 无 | 无 | 无 | 无 | **无** | @503107 | @542055 | @575641/@575993 | **无** | @392815/@393052 |
| `墙厚>0` × 亮窗 两套（F槽宽/扣板宽/F槽高/扣板高/扣板厚） | 无 | 无 | 无 | 无 | 无 | 无 | **无** | @5027xx–@5034xx | @5417xx–@5424xx | 无 | **无** | @393213–@393717 |
| `亮窗数量` `{N}格亮窗` | 无 | 无 | 无 | 无 | 无 | 无 | ③-10 | ③-10 | ③-10 | ③-10 | ③-10 | @392442/@392510 |
| `收口` ×7（4扇/3扇折叠/4扇折叠/5扇折叠/6扇折叠/2轨3扇/单轨2扇） | 无 | 无 | 无 | 无 | 无 | 无 | **无** | @503925–@504499 | @543095–@543439 | @577038–@577325 | **无** | @393960–@394416 |
| `活` 相关（活扇块） | 无 | 无 | 无 | 无 | 无 | 无 | @468374 | @500279 | @539250 | @573298 | @435243 | @390432 |
| **`LiangChuang` 排除词** | **无** | **无** | **无** | **无** | **无** | **无** | **无** | **无** | **无** | **无** | **无** | **@389645 / @389933（全文件仅此 2 处）** |

> 表中 `@5019xx` 一类是我在 §30 抽取时未记录精确偏移、只确认了存在的格子；精确偏移可从 `/tmp/huidrive/state_rules.json` 取。

### 52.8 「无」的明证

- **平开引擎（A平/B平/D平/P1平/G平/L1）没有扇数规则**：`_0x2f4e51` / `_0x3879a6` / `_0x520f23` / `_0x55a27e` 对其 `["扇数"]` 的引用次数**全为 0**（`_0x2c0817`(G平) 同）——已对每个行变量做全文件正则计数。同样，它们的 7 个块内 `亮窗` 仅出现 2 次且都在 v 调整的排除位。
- **`LiangChuang` 只在 L2**：全文件 `grep -c LiangChuang` = **1**（该字符串出现 2 次但同一行），位于 L2 的 ②块 @389933 与 ①块 @389645。
  ⇒ **绝不能把 L2 的 `!includes('亮窗') && !includes('LiangChuang')` 套到别的引擎上** —— 这正是 team-lead 上一轮踩的坑，现在有了确证。


### 52.8b `L2`（部件表 `_0x3b79ec`，函数 `_0x2e25b8`）9 块结构专节

`L2` 是 **`lableForProduct`（product10 / 生产标签）** 的移门部件表；`_0x8c791d` 是它的输出行数组。

#### 52.8b.1 九块逐块定性

| # | 起 | 止 | state | 定性 | 依据（块头） |
|---|---|---|---|---|---|
| ① | 389645 | 389918 | 3 | **单玻替换** | `Object.keys(_0x3b79ec); e.forEach(t=>{ if(!t.includes("亮窗") && !t.includes("LiangChuang") && (t.includes("玻璃宽")\|\|t.includes("玻璃高")) && !t.includes("单玻")) { const x=t+"单玻"; keys.includes(x) ? (MAP[t].state=false, MAP[x].state=true) : MAP[t].state=true } })` |
| ② | 389933 | 390153 | 2 | **双非无** | `Object.keys(MAP).forEach(e=>{ e.includes("亮窗")\|\|e.includes("LiangChuang")\|\|( e.includes("单玻")&&(MAP[e].state=false), !e.includes("单玻")&&e.includes("玻璃")&&(MAP[e].state=true) ) })` |
| ③ | 390239 | 390515 | 3 | **活扇块** | `name.includes("活")&&!name.includes("玻璃高")→true；name.includes("玻璃高")&&track===行.轨道种类&&name.includes(扇数)→true；行.亮窗总高>0&&(name.includes("玻璃")\|\|name.includes("亮窗"))→true` |
| ④ | 390555 | 390869 | 0 | **单玻变体判据 + 扣减量计算**（非 state 块） | `Object.keys(MAP).some(t=>t.includes(e)&&t.includes("单玻")); let a=0,x=0,_=0; if((0!==_0x387737\|\|0!==_0x522616) && 2!==Number(行.边封数)){ const m=扇数.match(/(\d+)扇/); if(m){ const n=Number(m[1]); 0!==_0x387737&&(x=_0x387737/n); 0!==_0x522616&&(_=_0x522616) } }` |
| ⑤ | 390870 | 394426 | **39** | **主规则块** | 与 `B吊` ③-B **逐字符等价**（见 52.8b.3） |
| ⑥ | 395925 | 397114 | 2 | **主 eval** | `if(part.state) → eval → `**`round<1 && !name.includes("滑") && !name.includes("单轨")`** → `state=false, result=0, quantity=0`，并置扣板厚标志（@396683） |
| ⑦ | 397118 | 398395 | 2 | **二次 eval** | `if(part.state && part.needsSecondPass) → eval → round<0 → state=false, result=0` |
| ⑧ | 397419 | 397830 | 0 | **二次 eval 的子集替换** | `...if(_0x49dc19.includes(a)){ ... Object.entries(MAP).filter(([k,v])=>k.includes(e)&&v.state===true) ... }` |
| ⑨ | 398418 | 399108 | 0 | **结果映射组装（含数量修正/覆盖）** | `if(true===part.state){ let x=part.result\|\|0, _=part.quantity\|\|0; ... _0x3aca5c[name]={materialName,result:x,quantity:_} }` |

#### 52.8b.2 ③ / ④ 是什么（回答任务 2）

- **③ @390239 = 活扇块**，与 `{B吊,D吊,C吊}` 的 ①（@500279 / @539250 / @573298）**同型**（3 条规则：`活`、`玻璃高`+track+扇数、`亮窗总高>0`）。
- **④ @390555 = 0 条 state**，它是 `some(...)` **只读判据**（判断是否存在 `xxx+单玻` 变体）+ **扣减量 `x`/`_` 的计算**（来自 `边封数` 与 `扇数.match(/(\d+)扇/)`）。这两件事在 `B吊` 里被压在同一个块（@500608）内，**不是新增类别**。

⇒ **L2 的 9 块 = `B吊` 的 7 块 + 前面多出的 ①②（单玻替换 / 双非无）。**
对应关系：

| L2 | B吊 | 内容 |
|---|---|---|
| ① @389645 | — | 单玻替换（**L2 独有**） |
| ② @389933 | — | 双非无（**L2 独有**） |
| ③ @390239 | ① @500279 | 活扇块 |
| ④ @390555 | ② @500608 | `some` 判据 + 扣减量 |
| ⑤ @390870 | ③ @500918 | 主规则（39） |
| ⑥ @395925 | ④ @506013 | 主 eval |
| ⑦ @397118 | ⑤ @507283 | 二次 eval |
| ⑧ @397419 | ⑥ @507590 | 子集替换 |
| ⑨ @398418 | ⑦ @508589 | 结果映射组装 |

#### 52.8b.3 ★ 主规则块：L2 ⑤ 与 B吊 ③ **逐条完全等价**

归一化（变量名/表名/别名统一，`obj["x"]` 与 `obj[x(N)]` 统一成 `obj.x`，token 解码为字符串）后：

```
len(L2 ⑤) = 3137    len(B吊 ③) = 3137    similarity = 1.0000    diff ops = 0
```

⇒ **39 条一一对应，无任何差异**（不是"相似"，是**逐字符相同**）。
⚠️ 注意：L2 的 ⑤ 里**仍然包含**「单玻→false / `state=includes('单玻')`」这两条（③-B 的 1、2 条），与 L2 自己的 ① ② **功能重复**，但代码照旧存在（顺序上 ①② 先跑，⑤ 再跑一遍，幂等）。

#### 52.8b.4 L2 与 B吊 的**全部**差异

| # | 差异 | L2 | B吊 |
|---|---|---|---|
| 1 | 块结构 | **9 块**（多 ①单玻替换、②双非无） | 7 块 |
| 2 | 主规则块 | @390870，39 条 | @500918，39 条 —— **完全相同** |
| 3 | 单玻/双非无 的**排除词** | ① `!includes('亮窗') && !includes('LiangChuang')`；② `includes('亮窗') \|\| includes('LiangChuang')` 短路 | **两处都没有**（B吊 把单玻逻辑折在主规则块里，无排除词） |
| 4 | **`<1 && !滑 && !单轨`** | **有**，在**主 eval @395925**（@396683） | **有**，在**主 eval @506013**（@506811） |
| 5 | ⑨ 组装块 | @398418 **含数量修正与覆盖**：`边封→quantity=行.边封数`；`行.轨道长>0 && (含滑\|左右盖板\|轨道盖板) → result=行.轨道长`；`含玻璃&&!含亮窗`：`(底/面玻=无)&&!含单玻→quantity/=2`、`扇数==='一固一活'→=1`、`扇数==='双活'→=2`；`含玻璃&&含亮窗&&(底/面玻=无)&&!含单玻→/=2`；最后 `quantity *= 行.数量\|\|1` | @508589 **只有** `_0x33f426[e]={materialName, result, quantity}`，**无任何覆盖/修正** |

> 差异 #5 的下游影响未验证：B吊 的 ÷2 / 一固一活 / 双活 修正在 §16 的 doorframe/windows 渲染层出现；L2 在结果映射层就做了。**L2 的消费方（product10 的 GlassSize 等）是否会因此二次折算，未确定** —— 建议改代码前实测一次。

#### 52.8b.5 顺带更正：`<1 && !滑 && !单轨` 的**位置与分布**（修正 §30.6 / §52.6）

我此前把 `B吊 @506843` 写成「第二遍 eval」——**错了**，@506843 在 **主 eval 块 @506013** 内（该块的 guard 是 `if(part.state)`；第二遍的 guard 是 `if(part.state && part.needsSecondPass)`，在 @507283，**不含 `<1`**）。

全文件逐字扫描（`<\s*1` 且 260 字内出现 state 赋值且含 `滑`/`单轨`）——**只有 2 处**：`@396683`（L2 主eval）与 `@506811`（B吊 主eval）。

**吊趟族主 eval 阈值实为三种**：

| 引擎 | 主 eval 偏移 | 阈值 | 滑/单轨豁免 | `quantity=0` | 扣板厚联动 |
|---|---|---|---|---|---|
| A吊 | 471502 | `<0` | 无 | ✗ | ✗ |
| **B吊** | 506013（@506811） | **`<1`** | ✅ | ✅ | ✅ |
| **D吊** | 544938（@545704） | **`<0`** | ✅（**仅此一例**） | ✅ | ✅ |
| C吊 | 578045 | `<0` | 无 | ✗ | ✗ |
| G吊 | 438329 | `<0` | 无 | ✗ | ✗ |
| **L2** | 395925（@396683） | **`<1`** | ✅ | ✅ | ✅ |

**平开族主 eval（A平@460911 / B平@486888 / D平@528031 / P1平@566692 / G平@415734 / L1@381808）一律 `<0`，无豁免。**

### 52.9 未确定

- ~~**`C吊` 的 ③-C 35 条**与 `B吊` 39 条的逐条差集未列出~~ → **已补：见 §52.5b**。结论 = 少 3 条（`固定`/`移动`/`收口+单轨2扇`）+ 1 处「包高」三元→`\|\|` 改写（语义等价）。
- ~~**`L2` 的 9 块结构**未展开~~ → **已补：见 §52.8b**。结论 = `B吊` 7 块 + L2 独有的 ①②（单玻替换 / 双非无）；主规则块 ⑤ 与 `B吊` ③ **归一化后 similarity 1.0000（逐字符相同）**。
- 平开族第二遍 eval 块（规则数 2）**是否真的完全没有 `<1`**：我只逐字读了 B吊 的 @506843 与 L2 的 @396756，其余引擎未逐字确认（但规则数均为 2，与"仅 `<0` 一处 + `delete needsSecondPass`"的形态一致）。
- 表中 `@5019xx` 等**粗粒度偏移**：我从 §30 的清单回填，未重新逐条取精确偏移。


---

## 53. 第三十九轮：**按引擎拆分算料**（架构级改动）

用户要求「全部都对齐，所有的，不要靠猜」。§52 的矩阵证明**各引擎规则确有差异**，故改为**按引擎分别算料**。

### 53.1 原版结构（为什么必须拆）

原版**每个打印入口各跑一套引擎**：点「玻璃合片单」跑 `calculateGlass`、点「生产单」跑 `calculateReceipt`，
**各自产出自己的部件集**。⇒ **同一订单行在不同单据上的部件集本来就可能不同**。

我们此前是「算一次 → 存 `l.parts` → 所有模板共用」，等于用**一套规则**冒充 12 套。

### 53.2 落地

**新增引擎 id 与 `computeParts`**：

```ts
type EngineId = 'A' | 'B' | 'D' | 'P1' | 'C'
// A=玻璃合片单  B=生产单  D=生产单定制  P1=平开门定制(平开)  C=平开门定制(吊趟)

function computeParts(l: Line, engine: EngineId = 'B'): PartPreview[] {
  // 同步实现：公式取自已载入的 formulas；公式缺失时回退 l.parts
  // 克隆 → applyWidthIncrement → applyHinge → applyPartState(parts, l, engine)
  //      → 逐序 eval（只算 state===true）→ 数值禁用 → 只收 state===true
}
```

**各 builder 各取自己的引擎**：

| builder | 模板 | 引擎 |
|---|---|---|
| `glassProduces` | glass | **A** |
| `productionProduces` | product / product4–9 | **B** |
| `doorsheetText`/`doorframeText`/`windowsText`（经 `oldSheetProduce`） | product2/3 | **D** |
| `product1Produces` | product1 | **P1**（平开）/ **C**（吊趟） |

`doorsheetText` / `doorframeText` / `windowsText` 的签名由 `oldSheetEngine: boolean` 改为 `engine: EngineId`
（内部 `oldSheetEngine = engine === 'D'`），并各自 `computeParts(l, engine)` —— **列文本与部件集来自同一引擎**。

### 53.3 `applyPartState` 的引擎差异（按 §52.7 矩阵落地）

**平开**（§52.4/52.7）：

| 规则 | A平 | B平 | D平 | P1平 | G平 | L1 |
|---|---|---|---|---|---|---|
| 单玻替换 / 双非无 / v调整 | ✅ 六引擎逐字符同 | | | | | |
| `扣板\|压线 → false` | ✅ | **仅扣板** | ✅ | ✅ | ✅ | **仅扣板** |
| `封板/封板高` | **无** | ✅ | ✅ | ✅ | **无** | ✅ |

实现：`pingYaxian = engine ∈ {A, D, P1}`；`pingSealBoard = engine !== 'A'`。

**吊趟**（§52.5）：

| 块 | A吊/G吊（9 条） | B吊/D吊（39 条） | C吊（35 条） |
|---|---|---|---|
| 活扇块（3 条） | `name.includes(扇数) && 玻璃宽` … | `name.includes('活') && !玻璃高` … | 同 B |
| 主规则块 | **仅** 方·上下方·玻璃·光企·勾企·合页·锁·亮窗数量 | 再追加 固定/移动/封板/盖板/前缀/边封/上横/包边/墙厚两套/收口 ×30 | 同 B 族但少 4 条 |

实现：`richDiao = engine !== 'A'` 门控 固定/移动/封板/盖板/扇数前缀/边封/上横/包边/墙厚两套/收口。
（**C吊 的 35 条已逐条抽出，见 §52.5b** —— 比 §30.3 的 B吊 39 条少 `固定`/`移动`/`收口+单轨2扇`，且「包高」为 `||` 合成写法。）

### 53.4 验证

拆分后重跑平开 E2E（夹具，跑完已删）：**生产单预览结果与拆分前逐字一致** ✅
（`上下方:900*2  玻璃宽:900*1  门框高:2500*4  上亮窗玻璃宽:900*1  压线高:500*1 …`）

### 53.5 性能：已加算料缓存

`computeParts` 每次都会克隆部件表并跑完整规则，而**一张单据页会被 17 个模板各取一次数据** ⇒ 逐次重算会明显卡（行多时尤甚）。

已加**签名键控缓存**：

```ts
function partsSig(l: Line): string   // 拼接所有影响算料的行字段
const partsCache = new WeakMap<Line, Map<EngineId, { sig: string; val: PartPreview[] }>>()
// 命中同签名 → 直接返回；否则 computePartsUncached 后写入
```

签名覆盖：`formula_id / line_type / 门洞宽高 / 亮窗总高 / 墙厚 / 吊脚 / 轨道长 / 底玻 / 面玻 / 玻璃厚 /
扇数 / 开向 / 轨道种类 / 套线种类 / 边封数 / 封板高 / 前包加长 / 后包加长 / 五金 / 数量`。
用 `WeakMap` 以行对象为键，行被丢弃时缓存自动回收。

**验证**：加缓存后重跑平开 E2E，输出与加缓存前**逐字一致** ✅

### 53.6 C吊 差异落地（§52.5b 补抽结果）

`C吊` = `B吊` **− 3 条** + 1 处等价改写：

| # | 缺失规则 | B吊 偏移 |
|---|---|---|
| 1 | `name.includes(扇数) && includes('固定')` → true | @501373 之后 |
| 2 | `name.includes(扇数) && includes('移动')` → true | @501427 |
| 3 | `includes('收口') && 扇数.includes('单轨2扇')` → true | @504499 |

（「包高」B吊 用三元 `?state=!0 : …&&(state=!0)`（2 次写入）、C吊 用 `(A\|\|B)&&(state=!0)`（1 次写入）—— **语义等价**。）

已实现：`cDiao = engine === 'C'`，门控 `固定` / `移动` / `收口 单轨2扇`。

### 53.7 `<1` 数值阈值：**只有 B吊 有**（已自查确认）

| 引擎 | 块④（主 eval） | 块⑤（第二遍） |
|---|---|---|
| **B吊** | **`<1 && !滑 && !单轨`（1 处）** | `<0` |
| A吊 / D吊 / C吊 | 仅 `<0` | 仅 `<0` |
| 各平开引擎 | 仅 `<0` | 仅 `<0` |

（自查方式：对每个引擎的 ④/⑤ 块做 `<1` 与 `<0` 的正则计数 —— 我起先取错范围（只查块⑤）得出「全都没有」，
按 §52.1 的块起点重查后才对。**又一次「范围取错」的风险点**。）

已实现：`engine === 'B' && diao && r < 1 && !含滑 && !含单轨` → 禁用。
（B吊 的该判定作用于**所有 state===true 的部件**，不限于 `needsSecondPass` —— 已读原文确认。）

**回归**：改动后重跑平开 E2E，引擎B 路径输出**逐字不变** ✅

### 53.8 尚未完成

- **L1/L2/G平/G吊**（本系统无对应模板入口）未实现专属规则，仍走 B 族近似。


---

## 54. 第四十轮：三路小分队普查结果落地

用户指令「派遣小分队把引擎/模板/行顺序全部完整分析一遍，一行一行地抠」。三份独立报告：

- `docs/2026-09-11-engine-exhaustive.md`（12 引擎 × 控制项）
- `docs/2026-09-11-template-exhaustive.md`（17 模板 × 每个元素）
- `docs/2026-09-11-row-order-exhaustive.md`（排序/过滤/分组/分页）

### 54.1 模板路：**模板层无未实现特性**

- 模板里**没有** `formatter` / `rowspan>1` / `colspan>1` / `fixed:true`（145 列 rowspan/colspan 全 1、fixed 全 false）
- 我们「没显式处理但被使用」的：`checked:false`（6 列）、`tableTextType`（33 列，如 `glass.OrderID` 渲染成二维码）、
  `maxRows`（product 4 / receipt 7 / product2·3 各 2）、`lHeight`、`testData`（78 元素，**传了 data 就永不参与**）
- **已修**：`templatePayload` 原按 **mode 名**硬编码分叉 → 改为**按列特征**判别
  （product1 看 `doorSize/glassSize/sheetHeigth/kouWidth`；glass 看「无 doorframe/windows 且有 door/client」；
  product3 看有没有 `oldSheet1`；标签看有没有 `GlassSize`）。17/17 判对且与原来逐字一致。

### 54.2 引擎路：三条结构性新发现

1. **`hinge` 只在 6 个平开引擎**（A平/B平/D平/P1平/G平/L平）；**6 个吊趟引擎一律不读**；
2. **`widthIncrement` 只在 4 个吊趟引擎**（A吊/B吊/D吊/L吊）；平开没有，**C吊/G吊 也没有**；
3. **`L1/L2`（product10）的结果映射自带数量修正 + `×行数量`**（边封→行.边封数、滑/盖板→行.轨道长、单玻÷2、
   一固一活→1、双活→2）—— 与其它 10 引擎最大的结构差异。

**本轮已修**：
| 项 | 原版 | 改前 |
|---|---|---|
| `hinge` / `widthIncrement` 的调用 | 各只对特定门型 | 对所有引擎 |
| 吊趟 doorsheet 折半 | `q/2` **不取整** | `Math.round` |
| `partsSig` 缓存签名 | 应含公式类型 | 缺 `formula_type`（diamond↔parentSubsidiary 切换会命中旧缓存）|
| 白名单 | 44 家 **+ 硬编码「鸿程鑫派门窗」** | 缺那一家 |
| `glassInfoProduces` B1/B2 | 各有**外层 else**，两条路径**都推 1 行** | 只推 if 分支 → **单玻少 1 行、diamond 少 2 行** |

> B1/B2 那条是**行数错误**：现在 普通/单玻/双玻 各 2 行、**diamond 5 行**（B1.d+B2.d+B4×3）。

### 54.3 行顺序路：**所有生产类单据的行序我们都不对**

原版每一族 produces 构造器统一：

```
① 平开块在前、吊趟块在后（ping<i> / diao<i>）
② 块内按 formulaid → 颜色 排序（**玻璃合片单入口不排**）
③ 过滤：丢弃无公式/查不到公式的行；吊趟另丢弃无扇数的行
④ 收尾：smartdoor_sort_method==='order' 时把 ping+diao 合起来按**单号数字前缀**升序；
   否则保持 ②（原版按 produce.timestamp 升序，而 timestamp 就是 ② 迭代时写入的，等价）
```

我们此前**四个 producer 全部按 `lines.value` 原序**。

**已修**：新增共用的 `orderedLines(sortByFormula)` + `sortMethod`（读 `localStorage.smartdoor_sort_method`，默认 `'profile'`），
接入 `productionProduces` / `oldSheetProduces` / `product1Produces`（`true`）与 `glassProduces`（`false`）。
排序键用**行自己的单号 `link_no`**（原版排的是 `行.单号`）。

### 54.4 第二轮落地（D8 / D7 / D3 / D14）

| # | 项 | 落地 |
|---|---|---|
| **D8** | product10 分组限量 | 新增 `groupProduct10()`：按 `orderID + "_" + GlassSize` 分组，每组保留 `min(组内行数, glass含「单玻」?1:2)` 行。**原版预览用分组版、打印用未分组版**（自身不一致）→ 我们按原样复刻：`templatePayload(tpl, mode, forPreview)`，仅预览路径传 `true`。<br>另核对：复制份数 N 的判据（`_0x143606` 是**调用方传入**的 `[BoLiKuan, BoLiGao]`，§12.4 的 `Mc` 入口）—— 我们原实现等价 ✅ |
| **D7** | lable 收尾排序 | 新增：**无条件**按 `orderID` 的首个「数字-」段升序，无 orderID/首段非数字 → `Infinity` 排尾 |
| **D3** | glassHole 排序 | `smartdoor_sort_method === 'order'` 时按 `OrderID` 数字前缀升序（此前只有 thickness 过滤） |
| **D14** | glassHole thickness 过滤 | **已在**（小分队看的可能是旧版本），确认无误 ✅ |

**回归**：改动后 E2E 输出逐字不变 ✅（单行场景不触发排序/分组）

### 54.5 第三轮落地（D12 / E3 / E9）

| # | 项 | 落地 |
|---|---|---|
| **D12** | 「排序方式」UI | 新增菜单项 + 对话框（`sortMethodOpen`/`sortMethodDraft`/`openSortMethod`/`saveSortMethod`），保存写 `localStorage.smartdoor_sort_method`，取值 `profile`(默认,型材优先) / `order`(序号优先)。与原版 `_0xff1972`(打开)/`_0x2a0b61`(保存) 对应。`orderedLines()` 读它。 |
| **E3** | 吊趟**没有独立的单玻替换块** | 原版吊趟的 ① 是 `if (扇数.includes('活')) {活扇块} else {主规则块}`；单玻变体判定在主规则块里（Q3.1/Q3.2，用 `e = 扇数+'玻璃'`）。已改为：ping 的 ①/② 块加 `&& !diao`；吊趟主规则块补 Q3.1/Q3.2 两条。 |
| **E9** | 活扇块两变体 | B/D/C 的 `①=活扇块、③=主规则块` 是 **if/else** —— **活扇行不跑主规则块**。已加 `runMain = !(richDiao && 扇数含「活」)`；A吊/G吊 两块并列，不受影响。 |

**回归**：三轮改动后 E2E 输出**逐字不变** ✅（夹具为单行平开，不触发这些吊趟分支）

### 54.6 第四轮落地（E10 / E4）

| # | 项 | 落地 |
|---|---|---|
| **E10** | product10 走自己的引擎（L1/L2） | 新增 `product10Parts(l)`：以**引擎B** 的部件集为底（§52.1 确认 **L1 ∈ B平 族**、14 条规则），再套 L1/L2 的**专用结果映射**（原版 @399457）：<br>· 名含「边封」且 行.边封数 有值 → `quantity = 行.边封数`；<br>· 行.轨道长>0 且 名含 滑/左右盖板/轨道盖板 → `result = 行.轨道长`；<br>· 名含「玻璃」且不含「亮窗」：单玻且名不含「单玻」→ `q/2`；扇数=一固一活→1；双活→2；<br>· 名含「玻璃」且含「亮窗」：单玻且名不含「单玻」→ `q/2`；<br>· 最后 `q *= 行.数量`。<br>接入 `product10Row`（GlassSize）与 `product10Copies`（复制份数）。<br>⚠️ **L2（吊趟支）独立成族（9 块 51 条）未实现**，吊趟行仍以引擎B 近似。 |
| **E4** | 扣板厚负值联动的杀件名 | 原文：**平开** `名含'扣板' \|\| 名含'压条'`（@487868）；**吊趟** `名含'扣板高' \|\| 名含'扣板宽'`（@507050）。我们此前用**两者并集**通吃 → 已按门型分别实现。 |

**回归**：改动后 E2E 输出逐字不变 ✅

### 54.7 D11 落地：**跨订单按客户分组 → 对我们不适用**，但发现 brand 后缀差异

用 Home chunk 的表（`/tmp/huidrive/tokens_home_dr.json`）解出原版回执族的完整逻辑：

```js
// ReceiptList（Ci，ic=6）与 FinalReceipt（pi，ic=12）都是**跨订单**：
//   源 = 页面上**所有已保存订单** `Object.keys(gn).map(k => ({...gn[k].customerInfo, brand, receipt: gn[k].hui_picture}))`
//   `groupByClient(arr)`：
//     按 `client || '未知客户'` 分组；
//     组内只有 1 单 → 原样（并给每行补 `date = 行.date || 单.date`）；
//     组内多单 → 合并为 `{client, total:Σ, deposit:Σ, balance:total-deposit, 门数:Σ, receipt:[...各组行]}`
//   另：**brand 后缀逐模板不同** ——
//     FinalReceipt：`brand.replace('回执单','收据单')`
//     ReceiptList ：`brand.replace('回执单','订货清单')`
```

**为何不适用**：我们一次只编辑**一个订单**（`order` + `lines`），没有「页面上多张已保存订单」这个数据模型。
分组在单订单下恒等于 1 组 1 单 → **无行为差异**。若将来做了「多单合并打印」才需要它。

**已落地**：`brand` 后缀逐模板区分 —— `receiptPrintData(brandSuffix)`，
`templatePayload` 按**列特征**判别（有 `payment` → 订货清单；有 `profile2` → 回执单；否则 → 收据单）。
实测三张模板判对：`receipt→回执单` / `FinalReceipt→收据单` / `ReceiptList→订货清单` ✅

### 54.8 L1/L2 落地（product10 的独立引擎）

`EngineId` 扩展为 `'A'|'B'|'D'|'P1'|'C'|'L1'|'L2'`，`product10Parts` 平开走 **L1**、移门走 **L2**。

| 点 | L1（平开） | L2（移门） | 我们 |
|---|---|---|---|
| state 规则数 | 14 条（7 块） | **51 条（9 块）** | 平开走通用 ping 支、吊趟走 rich 支 |
| 独立单玻替换块 | 无（同 ping 族） | **有**，且**无条件**替换、**带** `亮窗`/`LiangChuang` 排除 | 已按 L2 特例实现（`LiangChuang` 全文件仅此一处） |
| `hinge` | **有** | **无** | 门控 `!diao` → 自动对上 ✅ |
| `widthIncrement` | **无** | **有** | 门控 `diao && engine!=='C'` → 自动对上 ✅ |
| `<1 && !滑 && !单轨` | 无 | **有**（@396683） | 已加 `engine === 'L2'` |
| 结果映射 | 自带数量修正 + `×行.数量` | 同 L1，**多一条「亮窗玻璃 ÷2」** | 已在 `product10Parts` 实现 |

**回归**：E2E 输出逐字不变 ✅（夹具为平开，product10 未直接覆盖）

### 54.9 第四十一轮：**两遍求值**（`needsSecondPass`）落地 + 一次**误报**的澄清

#### 真修复：分两遍 eval

原版（@471828 / @566136 等）：

```js
if (part.state) try {
  let f = part.formula
  if (f) {
    if (f.startsWith('=')) f = f.substring(1)
    if (f.includes('.result')) return void (part.needsSecondPass = true)   // ← 含跨部件引用 → 跳第二遍
    ...第一遍 eval...
  }
}
// 第二遍：再算 needsSecondPass 的那些
```

**第一遍只算「公式里不含 `.result`」的部件**，第二遍才算引用型的。
⇒ 我们此前是**单遍按 `Object.entries` 顺序**求值 —— 而 **PostgreSQL `jsonb` 不保留键顺序**（按长度+字节序重排），
一旦引用方排在被引用方之前，`computed[ref]` 取不到 → 引用得 `0`。

已按原版实现：`secondPass` 数组 + `evalOne(name, withLt1)`，第一遍 `withLt1=false`、第二遍才启用 `<1` 阈值
（对应 §52.6「`<1` 在第二遍」）。

#### 一次**误报**的澄清（重要）

用户报「生产标签只显示了尺寸/方向/颜色/底玻面玻，其他没显示」「玻璃高没算出来」。
排查后确认：**症状由我的测试台造成，不是应用缺陷** ——
测试脚本填 `吊脚/亮窗` 单元格时**填错了格**，把 **吊脚填成 2500**（而非亮窗总高）。
于是 `光企高 = h - v - j = 2000 - 2500 = -500` → **负数被禁用** → 引用它的 `玻璃高` 取到 0。

修正测试台（吊脚=0）后实测：

```
光企高=2000   玻璃高=2000   玻璃宽=900     ← 全部正确
```

⇒ **「玻璃高=0」是「吊脚 > 门洞高」下的正确行为**（原版同样会禁用负值部件）。
用户侧若仍复现，需确认该行**吊脚是否填了较大值**。

> 另：两遍求值本身**即使在这个夹具下不是必需的**（`jsonb` 的字母序恰好让被引用方在前），
> 但原版明确如此实现、且顺序不可控 —— 属于**必要的忠实还原**。

### 54.10 移门（推拉）为何「缺玻璃高/光企」—— 源码层面的判定条件

用户报「推拉还没有玻璃高、光企等」。用**真实公式数据**（`legacy/data/original-formulas.json` 的「推拉」）核对：

真实移门公式的部件名**带扇数前缀**，且部分件带 `track`：

| 部件 | track | 说明 |
|---|---|---|
| `2轨2扇上下方` | `''` | |
| `2轨2扇玻璃宽` / `2轨2扇玻璃高` | `''` | |
| `2轨2扇光企高` / `2轨2扇勾企高` | **`标配`** | |
| `2轨3扇*` / `2轨4扇*` / `3轨3扇*` | 同上 | 各自一套 |
| `无亮窗单包宽/高` | `单包` | |
| `无亮窗双包宽/高` | `双包` | |
| `扣板宽/高`、`F槽宽/高`、`无亮窗边封` | `''` | 无扇数前缀 |

对应到我们的规则（§52.5 ③-B）：

| 部件 | 激活条件 | 没满足会怎样 |
|---|---|---|
| `2轨2扇玻璃高` | `名.includes(扇数) && 名.includes('玻璃')` | **只要行的「扇数」选成 `2轨2扇` 就该出** |
| `2轨2扇光企高` | `名.includes('光企') && 部件.track === 行.轨道种类 && 名.includes(扇数)` | **行的「轨道种类」必须等于该件的 track（`标配`），否则不出** |
| `2轨2扇上下方` | `名.includes(扇数) && 名.includes('方')` | 扇数匹配即可 |
| `2轨上滑/下滑` | `扇数前2字（`2轨`）前缀 && !含'扇' && !含'扣板'` | |
| `无亮窗边封` | `门洞高 > 亮窗总高 && 名.includes('无')` | 亮窗总高 ≥ 门洞高时不出 |
| `扣板宽/高`、`F槽宽/高` | `墙厚 > 0 && 亮窗总高 === 0` | **不填墙厚则不出**（原版一致） |

⇒ **「光企不显示」最常见的原因是「轨道种类」没填/与部件 track 不符** —— 这一点**旧版同样如此**。
「玻璃高不显示」则不在这些条件内（只需扇数匹配）；若确实不出，需按行提供
**公式名 / 扇数 / 轨道种类 / 底玻 / 面玻 / 门洞尺寸** 才能定位。

> ⚠️ **自动化未覆盖**：移门的 headless 驱动始终没跑通（算料点击后无反应；且前端 profile 的 localStorage 字段历史会残留已删除的公式名，
> 干扰候选列表）。**本节结论来自源码与真实数据核对，非实测。**

### 54.11 移门测试台跑通（两个真原因）+ 一次由测试引发的 404

#### 测试台终于跑通

`GET /api/v1/formulas/57` → 404「公式不存在」是**测试残留**：验证期间建过多个临时公式并删除，
用户浏览器的草稿（`localStorage.smartdoor_last_order`）里仍存着已删公式的 `id`。**已清理，公式表恢复为原 6 条。**

**已加容错**（`calcSingleRow`）：取公式失败时**清掉 `l.formula_id` → 按型材名重新匹配**；
仍匹配不到才提示「该行引用的公式已不存在，请重新选择型材」。不再反复打 404 且用户有事可做。

#### 移门测试台此前跑不通的两个原因（都是测试脚本的坑，非应用缺陷）

1. **Naive 的下拉是虚拟滚动** —— 只渲染可见项。必须**先向搜索框输入过滤**，目标项才会进 DOM。
   （平开的测试台一直有这步，移门的漏了，所以平开能跑、移门不能。）
2. **浏览器 profile 里存着上次的草稿**（`smartdoor_last_order`）被页面自动导入 → 表里有 **16 行**；
   脚本填的是**最后一行**，而「算料」按钮按全局查找点到的是**第一行**（型材为空 → `calcSingleRow` 直接 return）。
   ⇒ 修法：**测试前清草稿** + **「算料」按行内查找**。

#### 跑通后的移门实测（夹具用**真实「推拉」公式**的部件命名）

输入：门洞高 2000 / 宽 900 / 墙厚 100、扇数 `2轨2扇`、轨道种类 `标配`、面玻=白玻、底玻=无（单玻）。

```
光企高:2000*2   勾企高:2000*2   上下方:450*4   玻璃高:2000*2   玻璃宽:450*2
上滑:900*1   标配下滑:900*1   边封:2000*2   F槽宽:900*2   F槽高:2000*2
扣板宽:900*100*1   扣板高:2000*100*2
```

**逐值核对全部正确**：

| 部件 | 实测 | 公式 |
|---|---|---|
| 光企高 | `2000*2` | `=h-v` ✓ |
| 上下方 | `450*4` | `=w/2+v` = 450 ✓ |
| 玻璃高 | `2000*2` | `2轨2扇光企高.result` = 2000，×0.5(单玻) ✓ |
| **标配下滑** | `900*1` | 下滑**前置轨道种类** ✓ |
| 扣板宽 | `900*100*1` | 拼**扣板厚** ✓ |

⇒ **移门算料链路（激活规则 → 两遍 eval → 四列分组 → 真渲染）实测正确**，
`玻璃高`/`光企高`/`勾企高` **都能正常出现**。

### 54.12 「轨道种类怎么选都能算」—— track 门控加**回退**

**问题**（用户实测）：真实公式 `推拉` 里同一扇数下，光企与勾企的 `track` **填得不一致**：

| 部件 | track |
|---|---|
| `2轨2扇光企高` | 极简轨 |
| `2轨2扇勾企高` | **钢轨** |
| `2轨4扇光企高` / `勾企高` | 标配 |

而原版是**严格相等** `part.track === 行.轨道种类`（已逐字核实，5 个吊趟引擎一致；全文件 15 处「光企」中，
**只有 5 处是状态规则、且全部带该门控**，「扇数前缀」那条因名字含「扇」字也救不了它们）。
⇒ 选任何**公式里没有的**轨道种类（如下拉里历史残留的 `钢轨`）时，光企/勾企会**整个消失**，什么都算不出。

**改法**（用户要求「无论选什么轨道种类都能计算出」）：

```ts
// 该关键词下若有 track 匹配的件 → 只取匹配的（保留原版多轨道变体语义）
// 一个都没匹配上            → 退回该扇数的全部候选（保证任何轨道种类都有结果）
const trackMatched = (kw) => keys.some(k => k.includes(kw) && k.includes(fans) && parts[k].track === track)
const trackOk = (k, kw) => !trackMatched(kw) || parts[k].track === track
```

应用于 **光企 / 勾企 / 合页 / 锁** 四条规则。

**实测**（取用户库里的 `推拉`，扇数 `2轨2扇`、轨道种类 **`钢轨`** —— 与光企的「极简轨」不匹配）：

```
门扇:     光企高:2000*2  勾企高:2000*2  上下方:450*4  玻璃高:2000*2  玻璃宽:450*2
外框:     上滑:900*1  钢轨下滑:900*1  边封:2000*2
亮窗/扣板: F槽宽:900*2  F槽高:2000*2  扣板宽:900*100*1  扣板高:2000*100*2
```

光企高按回退规则出现 ✓、勾企高按 track 匹配出现 ✓、下滑前置「钢轨」✓

> ⚠️ 这是**有意偏离原版**的一处（原版会隐藏）。理由：原版语义在「同一扇数下多个 track 变体」时才需要该门控；
> 而实际公式常只写一个变体（track 只是标签），此时严格相等会让用户**换个轨道种类就什么都算不出**。
> 回退只在「一个都没匹配上」时生效，不影响原版的多变体选择行为。

### 54.13 仍未做

| # | 项 | 说明 |
|---|---|---|
| D8 | **product10 的分组/限量** | 原版：按 `BoLiKuan` 值复制 N 份 → 再按 `orderID+'_'+GlassSize` **分组、每组 ≤1(单玻)/2 行**；`GlassSize` 只留前两段 |
| D7 | lable 收尾排序 | **无条件**按 `orderID` 首数字段升序（缺→排尾） |
| D3/D14 | glassHole 行级过滤/排序 | `0 !== Number(thickness)` 过滤 + `order` 时的 OrderID 前缀排序 |
| D11 | 回执**跨订单按客户分组** | FinalReceipt 金额清零版 / ReceiptList 不清零版两套载荷 |
| D12 | 「排序方式」UI | 原版有对话框（型材优先/序号优先），写入 `smartdoor_sort_method` |
| E10 | `L1/L2` 引擎 | product10 应走自己的引擎（含自带数量修正），现在读的是引擎B 结果 |
| E3/E4/E9 | 吊趟单玻块 / 扣板厚联动差异 / 活扇块两变体 | 局部偏差 |

### 54.5 文档纠错

小分队还发现我旧文档里的**过时结论**：§9 第 8 条称「我们给 ReceiptList 逐行填了 date/payment」——
现已不再提供（与原版一致），该条作废。

---

## 55. §9 差异清单 triage 结果（2026-09-14）

> **背景**：§9 的 38 条清单写于早期轮次，此后历经 §11–§54 的更正与落地，**标记已整体滞后**。
> 本轮对 38 条**逐条对照当前代码**重新判定，结论如下。
>
> **读法**：本文档其余位置的 ❌/⚠️ 是**各轮次的历史记录**（含已被后续轮次推翻的），
> **权威状态以本表为准**。§9 原表保留不改，作为历史留档。

| # | 判定 | 依据（当前代码）|
|---|---|---|
| 1 | ✅ 已修 | `doorsheetText(l, engine)` 已抽为共用函数 |
| 2 | ✅ 已修 | `oldSheetGlass()` 三态分支完整 |
| 3 | ✅ 已修 | `basicInfoText()` 用 `<br>` + 引擎 A/B/C 三分支 |
| 4 | ✅ 已修 | `basicInfoText()` 尾部用 `l.direction`（原始开向）—— 2026-09-14 修 |
| 5 | ✅ 已修 | 回执 `brand` 首项改 `order.brand` —— 2026-09-14 修 |
| 6 | ✅ 已修 | 回执 `TotalBalance` 改回 `""`（原版无财务接口时的值）—— 2026-09-14 修 |
| 7 | ✅ **已修** | 2026-09-14。原文机制解出：`getImage('qrcode')`（`index-c3b16e3f.js` 的 `L` @3999）对 **`id==='qrcode'` 走本地分支** —— `y.images.get('qrcode')` → 返回 `{imageUrl: await I(n.imageBlob)}`（token 494='qrcode'、462='imageBlob'、497='imageUrl' 均已解码）；写入见 @5345 `y.images.put({id:'qrcode', imageBlob:r})`，即**服务端存图 → 客户端下载缓存到本地**。<br>我们无服务端图片库，但**本地那半与 `imageStore`（IndexedDB 按 id 存）完全同构** ⇒ 用固定键 `'qrcode'` 存/取：新增 `loadPayQrcode()` 预取到 `payQrcodeUrl`（照 `hydrateRowImages` 的模式，不把 `receiptPrintData` 改 async）、菜单新增「收款码设置」弹窗（上传/删除）。<br>验证：播种一张图到 IndexedDB 键 `qrcode` 后预览收据单，**该图 base64 出现在渲染结果中** |
| 8 | ✅ 已修 | 回执行对象不含 `date`/`payment` |
| 9 | ✅ 已修 | 回执 remark 前后包 `join(' ')` |
| 10 | ✅ 已修 | 回执 remark 打折分支 `+0 → 口袋门` |
| 11 | ✅ 已修 | `pricingDetail()` 显式 `=== '套'` / `=== '方'` 分支 |
| 12 | ✅ 已修 | `produceRemark()` 墙型用 `<br>` |
| 13 | ✅ 已修 | 引擎B 平开/吊趟 remark 组装；**吊趟不加墙型** |
| 14 | ✅ 已修 | `templatePayload` 对 glass 模板走 `glassProduces()`，与 product 分开取数 |
| 15 | ✅ 已修 | `product1Produces()` 内联自己的 remark |
| 16 | ✅ 已修 | product1 `lockway` = `l.direction` |
| 17 | ✅ 已修 | product1 `glassSize` = 玻璃高×玻璃宽 |
| 18 | ✅ 已修 | product1 前/后框拼接已实现 |
| 19 | ✅ 已修 | `lableRow` remark `join('<br>')` |
| 20 | ✅ 已修 | glassHole remark `<br>` + 置空开关 |
| 21 | ✅ 已修 | glassHole 亮窗行 `doorImg` 恒 `''` |
| 22 | ✅ 已修 | 子母玻璃分支（`ft === 'parentSubsidiary'`）|
| 23 | ✅ 已修 | product10 `GlassSize` 按部件配对 |
| 24 | ⛔ **本条作废（文档自相矛盾）** | 称「mode 11（product4 料标签）未实现」。但**证据显示不该实现**：<br>① `legacy/templates/print-templates-source-raw.json` 里 `product4Template`–`product9Template` **六份完全相同**（md5 `106a9a986d`，3196B），我们库里也一致；<br>② 其表格字段 = `OrderID/basicInfo/door/doorImg/doorframe/doorsheet/lockImg/produces/remark/windows`，**与 `productTemplate` 完全一致**（生产单表）；`lableTemplate` 才是标签形状；<br>③ 文档 mode 表称「11 = 料标签 = product4 = `lableForMaterial`」，而 `lableForMaterial` 产出的**是标签行**（`t=4` 硬覆盖、`remark="备注:"+备注`、`lockway` 无「开向:」前缀）—— 喂给 product4 会**整张渲染为空白**。<br>⇒ 我们把 product4–9 路由到 `productionProduces()` 与模板形状**匹配**，现状正确。`lableForMaterial` 该配哪张模板**无证据，不猜** |
| 25 | ✅ 已修 | `oldSheetSize()` 平开/吊趟分叉 |
| 26 | ✅ 已修 | `oldSheetProduce` lockway：原始开向 + 哑口套/门套 抑制 |
| 27 | ✅ 已修 | doorsheet 数量修正（逐 producer 核实零分歧）|
| 28 | ⚠️ **部分仍存在** | `sheetWidth` 追加封板宽 ✅、晟斐 `kouHeigth=套线种类` ✅；但**晟斐 `kouWidth` 应为行图片**（`getImage(行.图片ID)`，原文 @569254），我们恒 `''` |
| 29 | ⛔ **本条作废** | 称「原版 `total` 用 `Math.round` 取整」。**原文实为两位小数**：`receiptBuilder` 导出 `gs` 逐字写 `total: Math.round(100*r)/100`（r = ping_hui+diao_hui 的 `金额` 求和）。我们的 `round2` **本就一致**，无需改动。另据同句修正 `balance`：原版是 `Math.round(100*(r-定金))/100`（**先减定金再取整**），我们原先先取整再减，已改为一致 |
| 30 | ✅ 已修 | 新增 `getOriginalOpenDirection()` 并在 `lineLockImage()` 里归一化 —— 2026-09-14 修 |
| 31 | ⛔ **本条作废** | 称「回执行应补排序」。实测 `receiptBuilder-76e5b538.js` 全文 `.sort(` **0 处**、`formulaid` **0 次**；`Home-d6b13b9a.js` 的 3 处 `.sort(` 全是仪表盘（业务员列表/最近10单/客户金额Top8），与回执无关。**回执确实不排序**，以 `2026-09-11-row-order-exhaustive.md` 为准 |
| 32 | ✅ 已修 | `installAddresses` computed：行级回退 + 去重 `_` 连接 |
| 33 | ✅ **已修** | 2026-09-14：`printProductionCustom(mode)` 参数化，新增菜单「生产单3打印（双联）」→ `printByMode('product3', oldSheetProduces(true))`。product3 需**配对**（原版 `_0x1ebfe1`：相邻两行合一张、第二行键加 `1` 后缀，模板里的 `oldSheet1` 表正是为此）。<br>实测两行时 `oldSheet` 与 `oldSheet1` 两块**均被填满** |
| 34 | ✅ 已修 | `wallTypeLabel()` 有 `== null` 早退 |
| 35 | ✅ 已修 | `oldSheetRemark()` `join('-')` + 空格加配 + `-` 墙型 |
| 36 | ✅ 已修 | glassHole `filter(r => Number(r.thickness) !== 0)` |
| 37 | ✅ 已修 | glassHole `sortMethod === 'order'` 时按单号前缀排序 |
| 38 | ⛔ **本条作废** | 称「亮窗行应为两条独立 if、前缀 `亮窗底玻-`/`亮窗面璃-`」。原文 G平 @431300 为**单行**、前缀恒 `亮窗玻璃-`；G吊 @453381 为单行、按「扇数含活」分叉（非活扇才用 `亮窗面璃-`，错字照抄）。**两处我们均已按原文实现**（平开 `Hui.vue` B3 块 / 移门 D3 块）|

### 55.1 汇总

| 状态 | 条数 |
|---|---|
| ✅ 已修 | 31（另 #28 于 2026-09-14 补齐后半）|
| ⛔ 文档有误 / 作废 | 4（#31、#38、#29、#24）|
| ❌ 仍存在（含部分）| 0 |
| ⚠️ 待决策 | 0（#29 已作废）|

其中 #7 / #28 依赖**图片库**，#24 / #33 是**缺整块功能** —— 三类都不是"写错"，是依赖或功能缺失。
