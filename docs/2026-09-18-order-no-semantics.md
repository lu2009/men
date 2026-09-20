# 「回执单号 / 单号 / 单号集」的区别（逆向定案）

> 起因：用户问「搞清楚 回执单号 单号 单号集 等的区别 新版还没做」。
> 本文是逆向结论，**先落纸**；拍板后再动代码（项目既定做法）。
>
> 证据来源三处，互相独立且结论一致：
> - **前端**：`legacy/js/Home.formatted.js` + `Hui.formatted.js`（由 `docs/home-audit/legacy-slice.mjs`
>   与 `legacy/decode-stringmap.mjs` 反解码；关键函数**切出来真跑**，不靠读）
> - **旧服务端**：`/Users/aaa/Downloads/server`（⚠️ 见 §7.1 的前提说明）
> - **旧版生产数据**：对 `param1=getTableData` / `param1=detail` 做**只读 GET** 取真实样本核对
>   （17 单；**未写任何东西、未触碰凭据**）。凡标「生产实测」的即此项。

---

## 0. 一句话

三个词分属**两个层级**、**两种编号**：

| 词 | 是什么 |
|---|---|
| `回执单号` | **订单头**的身份 = 数据库 `orders.order_no` |
| `单号` | **明细行**的编号（每一扇门一个）—— **订单头上根本没有这个字段** |
| `单号集` | 该订单**所有明细行「单号」的去重集合**，用 `_` 连接 |

⚠️ **我们 `backend/migrations/0018` 的注释是错的**，原文：

> `单号（order_no）不单设列：新版 receipt_no 已承担「回执单号/单号」双重角色`

前半句**对**（`回执单号` 确实 = `order_no` = 我们的 `receipt_no`）；
后半句**错** —— 不是「一个字段担两个角色」，而是**两个层级上的两个不同东西**：`单号` 压根不是订单头概念，把它塞进 `receipt_no` 是层级搞混了。

---

## 1. 对照表

| | `回执单号` | `单号` | `单号集` |
|---|---|---|---|
| **层级** | 订单头 | **明细行**（每扇门） | 订单头 |
| **存储** | `orders.order_no` `VARCHAR(100)`，`@@unique([database_name, order_no])` | `door_specs` JSON 里 `ping_hui[]`/`diao_hui[]` 每行的 `单号` | `doorSpecs.customerInfo['单号集']` |
| **格式** | **13 位毫秒时间戳**（= 建单时刻的 `Date.now()`），如 `1789625443854` | `N-YY/MM/DD`，如 `85-26/09/14` | 上面那些串去重后 `_` 连接 |
| **谁生成** | 开单时**前端**给（服务端原样收） | `ensureLineNumbers()` 惰性补号 | `buildReceiptNoSet()` 派生 |
| **唯一性** | 每租户唯一 | 同年全库递增；**无唯一约束** | 派生物 |
| **主表列** | 不直接显示（排序/身份用） | 不显示（印在生产单/玻璃单上） | 「单号集」列 |
| **「查单号」** | — | 匹配的**内容** | 被搜索的**集合** |

---

## 2. 证据

### 2.1 前端（Home bundle）

**① 头对象里只有 `回执单号`，没有 `单号`**

所有订单头对象字面量 —— `:8125`、`:9146`、`:9172`、`:9200`、`:11003`、`:11358` —— **一个 `单号` 都没有**。
全文件 `["单号"]` 的出现处（`:683`、`:9486`、`:9528`、`:9678`、`:9720`）**全在明细行上**：
`bl()`（`:683`）读的是 `亮窗总高 / 门洞高 / 门洞宽 / 墙厚 / 扇数 / 开向 / 金额` —— 都是行级字段。

**② `单号集` 用下划线拆**（`Uo`，`:7694`）

```js
Uo = e => { const l = String(e ?? "").trim(); return l ? l.split("_").map(x => x.trim()).filter(Boolean) : [] }
So = e => Uo(e?.["单号集"])
```

**③ 前端从**不写** `单号集`** —— 全文件共 **7 处**（字面量 4 处：`:7697` `So`、`:11150` 判未审核、`:11365` 列定义、`:11367` 列头；**另有 3 处走混淆调用 `dr(1362)`**：`:7714` `Yo` 的匹配谓词、`:11161` 与 `:11171` `ps` 的两条筛选分支），**全部是读，零处赋值**。它由服务端在开单/合并时派生。

> 📌 更正：初版本文写「只出现 4 次」——漏了那 3 处 `dr(1362)` 的混淆调用（正则只匹配了字面量 `"单号集"`）。**结论（前端从不写）不变**。

**④ 「查单号」的补年份**（`Yo`，`:7701`）

```js
t = (e => { const l = String(e||"").trim()
            return l ? (/-\d{2}\b/.test(l) ? l : l + "-" + String(new Date().getFullYear()).slice(-2)) : "" })(fo.value)
```

输入 `199` → 补成 `199-26`（**当前年份**的两位，今天 2026 ⇒ `-26`）。这就解释了 `dr(1387)`「可只输入单号『-』前数字即可，如199.」。把这段原样切出来跑过：

```
"199" → "199-26"      "155" → "155-26"      "85" → "85-26"
"199-25" → "199-25"（已含 -YY 就原样保留）    "199-26/07/17" → 原样保留
```

匹配是对每行 `单号集` 拆出的段做 **`startsWith`**（`To`/`Yo` 两处一致，**不是 `includes`**）；查不到报 `查不到「199-26」单号！`。

> ⚠️ **实务后果（跨年查不到）**：补的是**当年**后缀，所以用裸序号查**去年**的单永远失败 ——
> 输入 `155` 变 `155-26`，而那张单的段是 `155-25/…`，`startsWith` 不命中。
> 要查去年的必须自己把 `-25` 写全。这是旧版既有行为，照抄。
>
> 📌 更正：初版本文举的例子写成 `199-25` —— 那是**按 2025 年算的**，今天是 2026，实际补 `-26`。
> 例子本身不是重点，但**跨年查不到**这条结论是重点，补上。

**⑤ 初载按 `回执单号` 数值降序排**（`:7898`）

```js
_l.value = n["main-content"].tableData.map(...).sort((t, l) => parseInt(l["回执单号"]) - parseInt(t["回执单号"]))
```

> ⚠️ 这条对我们的 `receipt_no` 格式有直接影响，见 §5。

### 2.2 旧服务端

**① `orders` 表没有「单号」列** —— `prisma/migrations/20260626062201_init/migration.sql:47-71` 全列：
`id / database_name / client_id / order_no / customer_name / brand / order_date / delivery_date / status / total_amount / paid_amount / unpaid_amount / door_type / door_count / door_specs / operator_name / salesperson / formula_data / notes`。
`grep -rn 单号 prisma/` = **0 命中** —— 中文 key 从不落进任何数据库列，只活在 `door_specs` 的 JSON 里。

**② `回执单号` = `order_no`**，两处独立证实：

- `src/utils/serializer.ts:25` `result.回执单号 = result.orderNo;`
- `src/modules/legacy-dispatch.ts:472` `'回执单号': row.orderNo ?? customerInfo['回执单号'] ?? ''`

**③ `单号集` = 明细行「单号」去重后 `_` 连接**（`src/modules/order/order.service.ts:117-127`）

```ts
function buildReceiptNoSet(specs) {
  const lineNos = doorRowsFromSpecs(specs).map(row => row['单号'])   // ← 明细行的 单号
    .filter(v => v != null && String(v).trim() !== '').map(v => String(v).trim());
  const unique = [...new Set(lineNos)];
  if (unique.length > 0) return unique.join('_');                    // ← 去重 + 下划线连接
  const existing = customerInfo['单号集'];                            // ← 没有行单号时**保住旧值**
  return existing != null ? String(existing).trim() : '';
}
```

> ⚠️ **函数名 `buildReceiptNoSet` 有误导性** —— 它装的**不是回执单号**，是行单号。读代码时别被名字骗了。

分隔符 `_` 在 7 份重复实现里完全一致（`order.service.ts:124`、`:134`、`line-number.service.ts:73`、`progress.service.ts:90`、`formula.service.ts:52`、`client.service.ts:382`、`legacy-dispatch.ts:455`）。

**④ 真正有生成规则的是「单号」**（`src/modules/order/line-number.service.ts:120-235` `ensureLineNumbers()`）

- 格式 `` `${nextNumber}-${dateSuffix}` ``（`:214`），`dateSuffix` = `YY/MM/DD`（`:41-50`）⇒ 如 `5-25/07/17`
- `N` = **同年、全库所有订单**明细行单号的最大值 +1（`:185-197` 扫全库）；`:181` 注释明说**按年重置、不是按日**
- **永不覆盖已有单号**（`:208-212`）
- 触发点：`progress.service.ts:667`、`formula.service.ts:201`

**⑤ `回执单号` 服务端不生成、不校验、不排序** —— `order_no` 是 `VARCHAR(100)`，**重写版服务端**无序列、无格式规则。前端那套「补 `-YY`」是纯前端行为。

**⑥ 真实格式是「毫秒时间戳」—— 用只读 GET 打旧版生产接口实测（17 单）**

订单头返回的字段**总共只有 14 个**：

```
["业务员","单号集","回执单号","安装地址","定金","客户","客户编号","总价","截止日期","打单人","打单操作","日期","订单备注","门数"]
```

`'单号' in row` → **false**（订单头确实没有这个字段）。

`回执单号` **17/17 命中 `/^\d{13}$/`**，且与建单日期对得上：

```
1789625443854 → 2026-09-17T06:10:43.854Z   日期 = 2026-09-17
1789378702509 → 2026-09-14T09:38:22.509Z   日期 = 2026-09-14
```

⇒ **`回执单号` 就是建单时刻的 `Date.now()` 毫秒戳。** 这解释了 §2.1 ⑤ 那个「按 `parseInt` 排序」为什么成立（13 位纯数字，天然单调，数值序 = 时间序）。

**⑦ `单号集` 的派生规则，生产数据 17/17 逐单验过**：`单号集 == 明细行单号去重后 "_" 连接`，一致 17 / 不一致 0。真值样本：

```
"84-26/09/09"
"85-26/09/14_86-26/09/14"
"41-26/08/13_…_62-26/08/13"（22 段）
```

明细行（`detail` 接口）同一行**两个字段并存**，正好印证「层级不同」：

```
ping_hui  单号="85-26/09/14"  回执单号="1789378702509"
diao_hui  单号="86-26/09/14"  回执单号="1789378702509"
```

⚠️ 两处口径细节：**空值是 `null` 不是 `""`**（17 单里 2 单，其明细行 `单号` 全空）；17 单所有 `单号集` 里出现的非字母数字字符**只有 `-` 和 `_`**。

---

### 2.3 「单号」的 4 个别名 —— 做打印时最容易踩的坑

`单号` 在旧版里换了 4 个马甲，**都指行级单号**：

| 别名 | 出现处 | 实际值 |
|---|---|---|
| `OrderID` / `orderID` | Hui `:10028/:10042/:10057/:10087/…` 十余处（`e["OrderID"] = row["单号"]`）；`:6287` 那列 label 就叫「单号」 | **`单号`** |
| `qrcode` | Hui `:9075`/`:9346`（`a.qrcode = String(e["单号"])`） | **`单号`** ← **二维码扫出来是「哪一樘门」，不是订单号** |
| `orderNo` | Home `:683` `bl()`（`orderNo: row["单号"]`） | **`单号`** |
| `订单号` | 标签打印模板字段 label（`Ca(328)`） | **`单号`** |

⚠️ **`orderNo` 在旧版里是**两义**的**，不能一律映射到 `receipt_no`：

- 上面那个 `bl()` 里的 `orderNo` = **行级单号**
- 但 `receiptNo`（`dr(1286)`，路由/深链 `&receiptNo=`）与**收据单2** 的 `customerInfo.orderNo`（Home `:9467`）= **回执单号**；设置面板管这个字段叫「编号」

### 2.4 「单号」的**首写方是服务端**，前端一次都不生成 —— CONFIRMED

前端全部写入 `单号` 的位置共 14 处（Hui 侧；Home 侧 0 处），其中 **12 处形状完全一样**，就是纯搬运：

```js
row.id && data.orderNumbers[row.id] && (row["单号"] = data.orderNumbers[row.id])
```

`data` 来自 Hui `:8491` 那颗「**填入单号**」按钮：

```
POST …?param1=getDiaoFormulas&param2={registrant}&param3={ds}
body: { formula: [...distinct(row.formulaid)], id: [...distinct(row.id)] }
```

同一接口兼两职：`data.formulas`（型材公式）+ **`data.orderNumbers`（行 id → 单号 映射）**。
（这段搬运逻辑已逐字切出来真跑：服务端给什么写什么，**前端不做任何序号/日期计算**。）

⇒ 所以 **`N-YY/MM/DD` 的分配规则完全在服务端**，bundle 观测不到。
另有两处是**人工手改**（Hui `:2602`/`:5413` 的 `el-input` 列，label 就叫「单号」）。

> ⚠️ **安全提醒**：`getDiaoFormulas` **很可能有写副作用** —— 重写版服务端
> `formula.service.ts:201 → ensureLineNumbers()` 补完空单号会 `prisma.order.update`。
> 所以**没有**在旧版生产上调这个接口（一调就可能给那 2 张单号集为空的真单写上单号）。

---

## 3. 合并订单：三者怎么变

**前端**（`Ii`，`:9191`）：选 ≥2 条且同客户 → 按 `parseInt(回执单号)` **升序**排 → 取最小那条作 `merged`，其余作 `record`（数组，存各自回执单号）→ 累加总价/定金/门数，地址/备注/打单人/业务员 用 `"; "` 拼 → `打单操作` 置 **`"合并单"`** → `POST { merged, record }`。

**服务端**（`order.service.ts:400-598` `combine()`）：

- `record` 里的回执单号**不写进任何独立字段** —— 那些订单的**明细行被搬进目标订单**的 `doorSpecs`，每行经 `retargetRows()` 把 `回执单号` 与 `OrderID/orderID/orderId/orderNo/order_no` 5 个别名一起改写成**目标**回执单号
- **行自己的 `单号` 原样保留**（不重新生成）
- `单号集` 用合并后的**全部**行重算
- **源订单被物理删除**（`:591-593`，连带 progress / financeOrder；payment 改挂到目标）

> ⚠️ **「以最早的回执单号为准」是纯前端逻辑，服务端零兜底**：`order.service.ts:403` 直接采信客户端传来的 `merged['回执单号']`，不比较、不校验。
> 前端传错目标号 → 服务端照做 → **源订单已删，无法回滚**。

---

## 4. 新版现状（逐条对）

> ⚠️ 这一节是**动代码之前**的盘点。**A/B/C/D 已于 2026-09-18 全做**，
> 下面这些「没做」现在都已落地 —— 现状看 §6，这里保留是为了记录「当初缺什么」。

| 概念 | 新版落点 | 状态（改之前） |
|---|---|---|
| `回执单号` | `orders.receipt_no` | ✅ **对** —— 语义正确，就是订单头身份 |
| `单号`（明细行） | **曾不存在** | ❌ 当时 `order_lines` 无任何编号列 → **现已由迁移 0020 补上** |
| `单号集` | `orders.order_no_set` | ⚠️ 列建了但**零写入点** → **现已改为服务端派生** |
| 合并订单 | 无 | ❌ 完全没做 → **现已实现** |
| 「查单号」补 `-YY` / `startsWith` 匹配 | `Home.vue` 已做 | ⚠️ 组件对、**没有数据喂它** → 行级单号补上后**功能已能生效**（`00-summary.md` 的 ✅ 可恢复） |
| 初载按回执单号**数值降序** | 后端 `ORDER BY id DESC` | ⚠️ 见 §5.2 → `receipt_no` 改毫秒戳后，若要严格对齐可改 `ORDER BY receipt_no::bigint DESC` |

### 4.1 由「行级单号缺失」连带出来的错误落点

> ✅ **2026-09-18 已全部修掉**（见本页 §6）。下表保留为当时的盘点记录。

| 位置 | 现状（改之前） | 旧版真身 |
|---|---|---|
| `Hui.vue` 「单号」列 | 有一列**叫「单号」**，但显示的是 `order.receipt_no`，且**只读** → **已改取 `line.line_no`** | 列名对、值错：旧版是**行级单号**且**可编辑**（`Hui.formatted.js:2597-2602`，列 label `:6287`）。⚠️ 「是否恢复可编辑」仍待定 |
| `printPayloads.ts` 的 `OrderID`/`orderID`（9 处） | 全用 `ctx.order.receipt_no` → **已改取 `lineNoOf(l)`** | 旧版这些位置取的都是**行级单号**（Hui `:10028/10057/10087/10131/…` 十余处 `X["OrderID"] = row["单号"]`） |
| `printPayloads.ts` 的 `qrcode`（3 处） | `String(ctx.order.receipt_no)` → **已改** | 旧版 `qrcode = String(row["单号"])`（Hui `:9075`）⇒ 原先是**厂里扫码定位到「哪一樘门」，却扫出订单号** |
| `printPayloads.ts` 的 `orderPrefix()` | `parseInt(receipt_no.split('-')[0])` ⇒ `parseInt` 得 NaN ⇒ **恒 0** → **已改为按行级单号** | 旧版按 `parseInt(单号.split("-")[0])`（Hui `:9659`/`:10570`）⇒ 原先是「序号优先」这个设置项**静默失效** |

⚠️ **`receiptPrintData.orderNo` 不在上表里，它本来就对**（回执族表头 = 订单级回执单号，旁证：`ReceiptMobile` 拿它当 `finance_getOrderFinanceSummary` 的入参）。代码里已就地写死注释，防止以后被「一把 grep 全改」误伤。

> ⚠️ 但 **`ReceiptEditDialog.vue` 的「单号」标签是**对**的** —— 收据单2 走的 `orderNo` 在旧版就是**回执单号**
> （旁证：`ReceiptMobile` 拿 `orderNo` 当 `finance_getOrderFinanceSummary` 的键，而该接口的键就是回执单号）。
> 见 §2.3 的「`orderNo` 两义」—— **不能一把 grep 全改**。

---

## 5. 由此暴露的既有问题

### 5.1 `0018` 的注释写错了两处

1. 「单号集 -> order_no_set 合并订单后多个单号的**空格串**」—— **分隔符是 `_`，不是空格**。
2. 「receipt_no 已承担『回执单号/单号』双重角色」—— **层级搞混**，见 §0。

> ⛔ **`0018` 这个文件不能改**：`backend/src/main.rs:23` 用的是 `sqlx::migrate!("./migrations")`，
> sqlx 会对**已应用的**迁移文件做校验和比对 —— 改一个字符都会让后端启动直接报 checksum mismatch。
> 更正只能落在**本文档** + 将来新加的迁移里（用 `COMMENT ON COLUMN`）。

### 5.2 我们的 `receipt_no` 格式与旧版语义不符（已查明旧版是什么）

旧版 `回执单号` = **13 位毫秒时间戳**（§2.2 ⑥，生产 17/17 实测），所以：

- 初载按 `parseInt(回执单号)` **数值降序**排（`:7896`）**天然成立** —— 13 位纯数字，数值序 = 建单时间序
- §3 合并时「取 `parseInt` 最小的那条当存活单」= **取建单最早的那条**

我们的 `receipt_no` 是后端生成的 `HT{id:08}`（`orders/service.rs:418-426`：建单时若为空则 `format!("HT{id:08}")`）。`parseInt("HT00000067")` = **NaN** ⇒ 上面两条规则**全部失效**。

后端现在是 `ORDER BY id DESC`（`orders/service.rs:210`），观感上碰巧与「越新越靠前」一致，所以现在看不出来；但**一旦真做合并就会直接坏掉**。

➡️ **待拍板（见 §6.D）**：把 `receipt_no` 缺省生成改成毫秒戳，即可与原版同序且无需改排序代码。

### 5.3 「在 Hui 里存一次，Home 写的四个头字段被抹空」（已修）

排查 `order_no_set` 为什么恒空时**顺带发现的真 bug**，与本题相关（它抹的正是 `order_no_set`）：

`PUT /orders/{id}` 是**整头覆盖**（`orders/service.rs:456-465` 无条件 `SET ... order_no_set=$11, install_address=$12, production_status=$13, lock_direction=$14`），而 `model.rs` 那四个字段是 `#[serde(default)]` ⇒ 载荷缺键 = 反序列化成 `""` = **抹空**。
`Hui.vue` 的保存载荷**恰好缺这四个键**，且 `loadOrder` 也没读回来 ⇒ **界面上完全察觉不到**。

实测（`docs/home-audit/hui-save-clobber-check.mjs`，真发一次 PUT）：

```
① Home 写完：order_no_set/install_address/production_status/lock_direction 四个哨兵值都在
② Hui 存一次：四个全部 → ""
```

⇒ **在 Home 标过「打单操作」的单，去 Hui 载入后保存一次，进度就被抹掉。** 已修（Hui 补读回 + 补回传），并加了静态断言 + 运行时断言，做过变异测试。

### 5.4 复核时一并翻出来的其它偏离（**未改代码**，仅记录）

| # | 事项 | 现状 vs 旧版 |
|---|---|---|
| 1 | **`receipt_no` 自动补号** | 新版建单时为空则 `format!("HT{id:08}")`（`orders/service.rs:418-426`）。旧版**没有回执单号就不落库**（`client.service.ts:443-448` 直接 `return { se: '录入成功' }`，静默什么都不写）。新版行为更合理，但**这是一处有意偏离、此前没记档** |
| 2 | **`回执单号` 的编辑入口** | 旧版 Hui 里它是一列**可编辑输入**（`Hui.formatted.js:4505-4514`）；新版整个拿掉了（`Hui.vue:75` 只读展示） |
| 3 | **重复 `receipt_no` 会冒 500** | `0009_orders.sql:26` 有部分唯一索引，但 `backend/src/core/error.rs` **没有 23505 → 400 的映射** ⇒ 客户端传重复值会冒成 500「数据库错误」 |
| 4 | **`单号2` 是死串** | Hui 字符串表里有 `单号2`，但打包文件里搜不到任何调用 ⇒ 无引用。可能是某个模板用过后来删了，**没能接到任何 UI 上** |

### 5.5 本条还有一个「测试自身不可信」的隐患（已加守卫）

`docs/home-audit/orderno-logiccheck.mjs` 的「新版实现」是**脚本内照抄的一份**（文件头自己写明了）——
所以它跑绿**不代表 `app/src/views/Home.vue` 没漂**：函数改名、`_` 改空格、`startsWith` 改 `includes`，
它照样全绿。

已补一层**源码级漂移守卫**：直接从 `Home.vue` 真身抠出 `splitOrderNos` / `orderNoCell` /
补年份那段 / `po` 筛选谓词，把关键判据钉死。变异测试确认两类都能抓住：

> ⚠️ **2026-09-20 位置更正（纯搬迁，逻辑逐字未改）**：上面四段里 `splitOrderNos` 的**声明**已归位到
> `app/src/utils/homeOrderNo.ts` ⇒ `orderno-logiccheck.mjs` 里抠它的那一处**已改指向新文件**。
> 另外三件 —— `orderNoCell`、补年份那段（`confirmOrderNoQuery`）、`po` 筛选谓词 —— **仍留在
> `Home.vue`**（`orderNoCell` 与 `confirmOrderNoQuery` 归 Task 7，谓词在 `filtered` 里、归 Task 6），
> 所以它们**仍然从 `Home.vue` 真身抠**。本句行号级指针按 Ruling 173 未重编。

```
把 splitOrderNos 的 split('_') 改成 split(' ')   → ✗ 漂移守卫报警 + 行为对照挂 1 条
把 orderNoCell 的 startsWith 改成 includes        → ✗ 漂移守卫报警 + 行为对照挂 2 条
```

（119 条对照全过。这类「测试比的是自己抄的一份」的坑，凡是自建差分台都可能踩 —— 值得挨个查。）

---

## 6. 拍板结果与落地（**2026-09-18：A/B/C/D 全做**）

| # | 问题 | 决定 | 落地位置 |
|---|---|---|---|
| A | `单号` 建列 | **加** | 迁移 **`0020_order_line_no.sql`**：`order_lines.line_no TEXT NOT NULL DEFAULT ''`（+ `(tenant_id, line_no)` 索引）。⚠️ `0017`/`0018` 是已应用迁移、`sqlx::migrate!` 有校验和，**不能改**，所以更正走新迁移 |
| A2 | 单号生成器 | **做** | `POST /v1/orders/{id}/fill-line-numbers`（`service::fill_line_numbers`），规则见 §2.4 / 后端注释；前端入口在 Hui 表格工具条「填入单号」 |
| B | `单号集` 派生 | **改为服务端派生** | `service::refresh_order_no_set`：建单 / PUT / 单行增删改后重算；**全部行单号为空时保住旧值**。并且 `PUT`/`PATCH` 的 SET 列表**移除了** `order_no_set`，请求体结构体里也没有它 ⇒ 客户端**写不进去**（比「前端记得回传」硬得多） |
| C | 合并订单 | **做，服务端自己算存活单** | `POST /v1/orders/combine`（`service::combine`），**有意偏离**见下 |
| D | `receipt_no` 格式 | **改成毫秒戳** | `service::assign_generated_receipt_no`，同毫秒碰撞往后挪（比旧版严） |

### C 的**有意偏离**（重要，别被「照抄旧版」误导）

旧版把存活单的选择**完全交给客户端**（前端算好 `{merged, record}` 递过去，服务端不比较、不校验）；
前端传错 → 服务端照做 → **源订单已被物理删除，无法回滚**。

新版：客户端只传 **id 列表**，存活单由**服务端**按回执单号数值取最小算出来。
正常路径下两者结果相同（都取最早那条），但「传错就毁数据」这条路堵掉了。
所以前端确认文案里那句「以最早的回执单号为准」现在**名副其实** —— 服务端真的这么算。

### 单号的**分配时机**：打印时自动补（已查实并落地）

用户实测报「新建了订单 看不到单号」。查证结论 —— **旧版也不在建单时分配**：

- 旧服务端 `ensureLineNumbers` 全服务端只有 **2 个调用点**（`progress.service.ts:667` 改打印状态前、
  `formula.service.ts:201` 公式接口里），**建单/保存路径都不是调用方**
  （`client.service.ts:414` 只是 `'单号': firstNonBlank(row['单号'], '')` 原样收下客户端给的）。
- 前端 `getDiaoFormulas` 有 **6 处调用**（`Hui.formatted.js:9219/9852/10607/11037/11632/12195`），
  形状全是「取这批行的 `formulaid` + `id` → 拿回 `data.orderNumbers` → 逐行搬运」，
  **全在单据生成路径上**。

⇒ **旧版是「一打印就顺带把单号补上」**，建单不补。
新版对应落地：`useOrderPrint.ts` 的 `ensureLineNumbersForPrint()`，
在 `loadPrintPrereqs()` 开头调用 —— 那是四条打印链路
（`PrintPreviewDialog` / `ReceiptOtherDialog` / `Receipt2Dialog` / `DocSheetDialog`）的**共同入口**，
且各链路随后都用**同一批行对象**去 `buildBatchPayload`，所以就地改 `line_no` 四处一起生效。
⚠️ 该函数**有副作用（就地改行对象）**，代码注释里写明了。
补号失败**不拦打印**（与旧版一致）。手动「填入单号」按钮保留，用于**提前**拿号。

### 打印链路（`printPayloads.ts`）同步改完

`OrderID` / `orderID` / `qrcode`（共 12 处）改用行级单号；`orderPrefix` 改用行级单号前缀。
**`receiptPrintData.orderNo` 保持回执单号不动**（它本来就对）。

验收：`docs/home-audit/print-lineno-check.mjs`（**20 条全过**）——
esbuild 把 `printPayloads.ts` 打进 node 直接跑（不是手抄一份），用一条**每行单号都不同**的订单
遍历全部 builders，断言其中**没有一处**出现回执单号；并单独钉住回执族表头那个 `orderNo`
**就是**回执单号。变异测试通过（把 `lineNoOf` 改成回退回执单号 ⇒ 7 个 builder 全红）。
「序号优先」实测已能重排：`7-/3-/11-` → `3-/7-/11-`。

⚠️ 夹具必须给**真 `formula_id`** —— `orderedLines` 的 `keep()` 会剔掉没有公式的行，
给 null 的话生产单/合片单/自绘单据/product1 全都出不了行，「有没有用错单号」根本测不到（第一版就这么假绿）。

### 验收

`docs/home-audit/lineno-logiccheck.mjs`（**21 条全过**）：左边把旧服务端源码
`buildReceiptNoSet` / `lineDateSuffix` / `lineNoNumber` **原样切出来跑**，右边打真后端。
做过变异测试（把 `join("_")` 改成 `join("-")` ⇒ 3 条转红）。

⚠️ **覆盖不到**：`ensureLineNumbers` 整个函数碰 Prisma，切不出来也跑不了，
所以「按年全局 max+1」只做了行为抽样，没逐字对跑（且它本来就有反例，见 §7.5）。

---

## 6bis. 原「待拍板」清单（存档）

| # | 问题 | 选项 |
|---|---|---|
| A | `单号`（明细行级）要不要建列？ | ① 加 `order_lines.line_no TEXT`，照旧版 `N-YY/MM/DD` 规则惰性补号；② 不做（则生产单/玻璃单上永远没有门编号） |
| B | `单号集` 要不要变成派生值？ | ① 保留 `orders.order_no_set` 列，在开单/存行时用 `buildReceiptNoSet` 等价逻辑重算（照旧版，含「无单号时保住旧值」）；② 不落列，读时现算 |
| C | 合并订单做不做？ | 旧版**物理删除源订单**且服务端零兜底，风险高。若做，建议服务端自己按回执单号取最小（比旧版更稳），并写进文档作为**有意偏离** |
| D | `receipt_no` 缺省生成要不要改成原版口径？ | 原版 = 13 位毫秒戳（§5.2）。**建议改成毫秒戳**：与旧版同序、合并的「取最早」直接可用，且不用动排序代码。保持 `HT{id:08}` 则必须另想办法判「哪单最早」 |

---

## 7. 前提与不确定

### 7.1 旧服务端是**重写版**，不是原始 Flask 源码

`/Users/aaa/Downloads/server/package.json:3` 写着 `"TypeScript rewrite"`，`serializer.ts:3` 注释 `Mirrors the original Flask serializer behavior.`，本机无任何 `.py`。

⇒ **存储结构/键名可信**（作者有 `scripts/compare-production-contract.ts` 对生产做契约比对），**生成格式存疑**。

### 7.2 仍然读不出来的

1. ~~生产里 `回执单号` 的真实格式~~ → **已查明**：13 位毫秒时间戳（§2.2 ⑥）。
2. ~~开单那一刻「单号」谁先算~~ → **已查明**：**服务端**（`getDiaoFormulas` → `data.orderNumbers`，前端只搬运，§2.4）。
   ⚠️ 但**序号的分配规则仍不确定** —— 见下面第 5 条的反例。
3. **`单号集` 的 7 份实现有分叉**：`order.service.ts:129 buildCurrentReceiptNoSet` 在「没有行单号」时**不回落、直接写空串**（= 清空），其余 6 份回落保住旧值。是有意还是 bug，源码无注释；删明细行路径走的是「清空」那支。
4. **并发撞号**：`ensureLineNumbers` 的「扫全库取最大」与写回之间**无事务无锁**。
5. **⚠️ 「全局按年 max+1」这条规则有反例，别当定论。**
   生产观测：序号按年递增（26 年从 1 到 88）、跨订单不重复。**但是**订单 `1784290511162` 的
   `单号集 = "8-26/07/17_9-26/07/17_1-26/07/17"` —— 前面已到 8、9 却冒出 `1-26/07/17`；
   另一单也有 `1-26/07/06`。同年两个「1 号」不符合「全局最大值 +1」。
   可能解释（均 INTERPRETED）：① 那行是**用户手改**的（`单号` 列本来就是可编辑输入框）；
   ② 存在**第二条分配通路**（自助下单 / 终端）用了不同的计数器。
6. **`单号` 的日期后缀取自哪个日期**（建单日期 / 该行 `日期` / 填入那天的日期）——
   数据上每行 `单号` 的日期 == 该行 `日期` 字段，但**无法区分因果**。
7. **`getDiaoFormulas` 在旧版生产上到底有没有写副作用** —— 因为不敢调，**没验证**（重写版有）。
8. **`单号` 是否总带 `/MM/DD`** —— `/-\d{2}\b/` 只钉住 `-YY`。17 单 88 个样本全是 `N-YY/MM/DD`，
   但只是**一个租户一个年份**，不能排除历史数据里有 `N-YY` 形态。
9. **`打单操作` 与 `单号集` 的写入先后** —— 观测到「`单号集` 有值而 `打单操作` 为 `null`」的单，
   所以「只有打单时才分派单号」**不成立**；反方向无样本。

---

## 附：一句话记忆法

- **回执单号** = 这张**单子**的号（订单头，客户手里那张回执上的号）
- **单号** = 这**扇门**的号（明细行，印在生产单/玻璃单上）
- **单号集** = 这张单子**包含的所有门的号**（派生的，给「查单号」反查用）

---

## 补记 2026-09-19：补号时机加了一个**显式例外**（算料不补）

用户实测发现：**在 Home 展开行点一下「算料」，那单的行就被悄悄分配了单号。**

原因：Home 的算料预览复用了 `PrintPreviewDialog` → `loadPrintPrereqs` → 第一行就是
`ensureLineNumbersForPrint(orders)`，而那是**写库**。旧版 `In`/`Un`（算料）**不补号**
（`Home.formatted.js:8221-8263` 只调 `calculateReceipt` + `buildPrintData`）——
补号是**打印时**才做的，与本文件前面记的分配时机一致。

处置：`loadPrintPrereqs(orders, opts?: { autoLineNumbers?: boolean })`，
**默认 `true`**（打印面四个调用点行为不变），只有 Home 的算料显式传 `false`
（`PrintPreviewDialog` 加 `autoLineNumbers` prop 透传；`Home.vue` 的
`previewAutoLineNumbers` 在算料那条路置 `false`、`onOpenMode` 里置回 `true`）。

守卫：`docs/home-audit/print-lineno-check.mjs` 的 **④b**（两条）——
关掉开关后走一遍不许补号 / 不传开关时仍然补号。做过变异测试（把开关短路 → 报红）。
