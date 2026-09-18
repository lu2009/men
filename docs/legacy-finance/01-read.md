# 旧系统财务模块 — 读取口径逐行取证（01-read）

取证对象：`/Users/aaa/Downloads/server`（Node + Express + Prisma，兼容层 `legacy-dispatch.ts` 对外暴露旧 action 名）。
取证范围：**只读路径**。写操作（`addPayment` / `addOrderPayment` / `addOrderAdjustment` / `addCustomerAdjustment` /
`executePrepaymentAllocation` / `clearSelectedOrders` / `updateOrderCustomer`）只在「谁维护存量列」里点名，不展开。

配套前端证据：`legacy/js/Home.formatted.js`（混淆码已用 `legacy/decode-token.mjs` 解开，文中给出 token 值）；
既有前端侧结论：`docs/2026-09-17-home-analysis.md`。

**标号约定**：`CONFIRMED` = 源码直接读到；`UNCERTAIN` = 需要推断/有歧义，集中列在 §11。

---

## 0. 入口与信封（读口径之前必须先定死这一层）

旧 action 名有两条对外通路，**同一条 service 代码，对外形状不同**：

| 通路 | 位置 | ds 来源 | 信封 |
|---|---|---|---|
| A 旧兼容 | `POST/GET /1?param1=finance_xxx&param2=<ds>` → `legacy-dispatch.ts:48,55,63` | `legacy-dispatch.ts:1144`：`query.param2 \|\| body.param2 \|\| body.ds \|\| ''`（**无鉴权**，见 §12） | `applyLegacyContract()`（`:326-350`）+ `mapResponseFields()`（`:1214-1282`） |
| B REST | `finance.routes.ts:12-229` → `ok(res, data)` | `req.user!.databaseName`（`:15` 等，`router.use(requireAuth)` `:9`） | `middleware/response.ts:3-8`：`{code:200, data:<service 返回值>}` |

- `LEGACY_CONTRACTS`（`legacy-dispatch.ts:249-301`）**没有任何 `finance_*` 条目** ⇒ 全部走默认
  `mapFields = true`、`responseShape = 'auto'`、无 `requiredParams`。CONFIRMED
- 通路 B 对 `getOrderSummary`/`checkSystem`/`getCustomerBalance` 这类**已经返回 `{code,data,message}`** 的函数会二次包裹，
  变成 `{code:200, data:{code:200, data:…, message:'ok'}}`。CONFIRMED（`finance.routes.ts:27`、`:161` + `response.ts:3`）

### 0.1 `mapResponseFields` 的触发条件（决定中英文 key 到底哪个到客户端）

```ts
// legacy-dispatch.ts:1214-1230
mapResponseFields(x):
  if Array.isArray(x) → x.map(mapResponseFields)          // 逐元素递归
  if (!x || typeof x !== 'object') → x
  if ('data' in x && Array.isArray(x['data'])) → {…x, data: x.data.map(mapResponseFields)}   // 只递归「data 是数组」这一种
  hasEnglish = x 的直接 key 里含 name/phone/clientCode/customerName/orderNo/procedureName/databaseName/createdAt 之一
  if (!hasEnglish) → x 原样返回
  …否则按 engToCn（:1233-1251）改名，未登记的 key 原样保留（丢掉 id/clientId/orderId/financeOrderId/*At/databaseName）
```

⇒ **`data` 是对象时不会递归**。这条直接决定了下面每个端点的对外 key：CONFIRMED

| 端点 | service 返回值 | 顶层是否命中 hasEnglish | 结论（到客户端的形状） |
|---|---|---|---|
| `getOrderSummary` | `{code,data:{…},message}` | 否（key 只有 code/data/message） | 原样：`data[回执单号] = {已分配金额,未收金额,订单调整金额}` |
| `checkOrderPayment` | 数组 | **是**（元素有 orderNo/customerName） | 逐元素改名为 `{回执单号,客户,已分配金额,未付,statusText,payments}`，再包 `{code:200,data:[…]}` |
| `checkSystem` | `{code,data:{hasNewFinance},message}` | 否 | 原样 |
| `getOrderDetail` | `{code,data:{中文…},message}` | 否 | 原样 |
| `getCustomerBalance` | `{code,data:{中文…},message}` | 否 | 原样 |
| `getPaymentStats` | `{code,data:{monthly,payments,yearly},message}` | 否（data 是对象不递归） | 原样 |
| `getCustomerStatement` | `{orders,payments,adjustments}`（**无 code/data**） | — | 先 `projectCustomerStatement()`（`:518-613`）→ `{code:200,data:[…]}`；行 key 全是中文，二次 map 不改动 |

---

## 1. 数据模型：哪些是存量、哪些是流水（`prisma/schema.prisma`）

### 1.1 `FinanceOrder`（`:133-154`，表 `finance_orders`，DDL `prisma/migrations/20260626062201_init/migration.sql:105-120`）

| 列 | 类型 | 语义 | 性质 |
|---|---|---|---|
| `orderId` | `Int?` → `Order?`（`:147`，`onDelete: Cascade`） | 关联订单；可为 NULL | 关联 |
| `orderNo` | `String?`（`:139`） | 回执单号 | 业务主键（`@@unique([databaseName, orderNo])` `:150`） |
| `customerName` | `String?`（`:140`） | 客户名**冗余**（订单改名后靠写路径同步） | 冗余 |
| `allocatedAmount` | `Decimal? @default(0)`（`:141`） | **已分配金额**：本单已收（含池分配） | **存量（读取唯一来源）** |
| `unpaidAmount` | `Decimal? @default(0)`（`:142`） | **未收金额** | **存量** |
| `orderAdjustTotal` | `Decimal? @default(0)`（`:143`） | **订单调整金额**（抹零/优惠/补贴/冲销的累计） | **存量** |
| `monthTag` | `String?`（`:144`） | `YYYY-MM`，建单时写入 | **只写不读**：全库无任何读点（`grep monthTag` → 只有 `order.service.ts:571`、`client.service.ts:542` 两处写）CONFIRMED |
| `statusText` | `String?`（`:145`） | 结清状态文案 | 存量，读路径**原样透传**（见 §5.3 两套词表） |

**没有 DB 触发器**（migration 里只有 DDL，无 `CREATE TRIGGER`/`CREATE FUNCTION`），存量列全靠应用层维护。CONFIRMED

### 1.2 `Payment`（`:156-173`，表 `payments`）— **流水**

`amount Decimal? @default(0)`（`:163`）正=收款、负=红冲；`orderId`/`financeOrderId` 均可为 NULL；
`paymentDate @db.Date`；`paymentMethod`；`notes`。**没有任何存量汇总列**。
注意 `financeOrderId = NULL` 是合法的：`addPayment` 为「客户级预付款」单独建一条无归属 Payment（`finance.service.ts:388-390`）。

### 1.3 `CustomerFundFlow`（`:175-195`，表 `customer_fund_flows`）— **流水（资金池）**

`amount Decimal`（**非空**，`:184`）、`flowType`（`:185` 默认 `'预付款'`）、`paymentId`（`:183`，可空，指向 Payment）、
`clientId`/`clientCode`/`customerName`。**没有存量列**。
写点只有两处：`finance.service.ts:414-427`（`预付款` / `预付款冲销`）、`:847-859`（`预付款分配`，amount 为负）。

### 1.4 `CustomerBalance`（`:197-213`，表 `customer_balances`，`@@unique([databaseName, clientCode])`）— **存量汇总**

| 列 | 语义 | 谁维护（只点名） |
|---|---|---|
| `prepaidBalance`（`:205`） | **未分配余额**（资金池余额） | `finance.service.ts:252-258`、`:394-400`、`:402-412`、`:845` |
| `totalTopup`（`:206`） | **实收金额**（累计充值，只在 amount>0 时加） | 同上（`:251`、`:398`、`:409`）、`ensureCustomerBalance:100` 建行时置 0 |
| `totalSpent`（`:207`） | 累计消费 | **只写不读**（唯一读点 `:844` 是自增，读路径从不返回它）CONFIRMED |

`ensureCustomerBalance`（`:91-109`）在 upsert 的 update 分支只改 `clientId`/`customerName`，**不动三个金额列**。CONFIRMED

### 1.5 `CustomerAdjustment`（`:215-228`）— **流水**

`clientCode`（`:220` 可空）、`adjustAmount Decimal NOT NULL`（`:222`）、`adjustType`（`:223` 默认 `'人工调整'`）。
**只写不参与任何存量列**：`addCustomerAdjustment`（`:459-473`）只 insert 一行，不动 `CustomerBalance`，
它的影响**只体现在 `getCustomerBalance` 的实时聚合里**（§5）。

### 1.6 `OrderAdjustment`（`:230-243`）— **流水**

`orderNo`（`:235` 可空）、`orderNumber`（`:236`，**只写不读** CONFIRMED）、`adjustAmount NOT NULL`、`adjustType`（默认 `'订单调整'`）。
与 `FinanceOrder.orderAdjustTotal` 是**同一事实的两份记录**（流水 vs 存量），由 `addOrderAdjustment:573→applyOrderAdjustmentToFinance:231-246` 同时写。

### 1.7 真相在哪一份

- **未收金额 / 已分配金额 / 订单调整金额（单据级）**：读**存量列** `finance_orders`。流水表 `payments` **不参与**这三个数的计算。CONFIRMED
- **订单调整合计（客户级）**：读**流水表** `order_adjustments` 求和。**注意它与「订单调整金额」不同源**（§6.2 第 4 条）。
- **未分配余额 / 实收金额（客户级）**：读**存量列** `customer_balances`。
- **客户余额 / 客户调整合计 / 订单总额**：**实时聚合**。
- 存量列与流水表之间**没有任何一致性校验或对账逻辑**（全库无 reconcile）。CONFIRMED

### 1.8 死代码（读这份代码时的两个坑）

- `finance.repository.ts` **整文件无人 import**（`grep -rn "finance.repository\|financeRepository" src` → 只有它自己的定义行）。CONFIRMED
- `addToCustomerBalance`（`finance.service.ts:248-259`）**零调用点**。CONFIRMED

---

## 2. `getOrderSummary`（`finance.service.ts:283-298`）

```ts
// 等价伪码
rows = prisma.financeOrder.findMany({ where: { databaseName: ds }, include: { order: true } })
out = {}
for (fo of rows) {
  if (!fo.orderNo) continue                      // null / '' 直接丢
  out[fo.orderNo] = {
    已分配金额:   toNum(fo.allocatedAmount),      // 存量列
    未收金额:     toNum(fo.unpaidAmount),         // 存量列
    订单调整金额: toNum(fo.orderAdjustTotal),     // 存量列
  }
}
return { code: 200, data: out, message: 'ok' }
```

- **纯存量列读取**，零聚合、零计算、零过滤（除 `databaseName`）。
- `include: { order: true }`（`:286`）**结果里完全没用到**（循环体不碰 `fo.order`）。CONFIRMED
- 入参**只有 ds**：`legacy-dispatch.ts:844` 传 `p.ds`，**`param3`(days=60) / `param4`(start) / `param5`(end) 全部被丢弃**（**UNCERTAIN-2**）。
- 前端契约对得上：`Home.formatted.js:7911` 拼 `…&param3=<days>&param4=<start>&param5=<end>`（token `1170`=`` &param3= ``, `680`=`` &param4= ``, `1135`=`` &param5= ``），`:7914-7921` 读 `r.data[回执单号]["已分配金额"/"订单调整金额"/"未收金额"]`。CONFIRMED 对齐

---

## 3. `checkOrderPayment`（`finance.service.ts:302-314`）

```ts
if (!orderNos.length) return []                 // ← 裸数组，无 {code,data} 信封
rows = prisma.financeOrder.findMany({
  where: { databaseName: ds, orderNo: { in: orderNos } },
  include: { payments: { select: { id: true, amount: true, paymentDate: true, paymentMethod: true, notes: true } } },
})
return rows.map(fo => ({
  orderNo:         fo.orderNo,
  customerName:    fo.customerName,
  allocatedAmount: toNum(fo.allocatedAmount),          // 存量列
  unpaidAmount:    toNum(fo.unpaidAmount),             // 存量列
  statusText:      fo.statusText,                      // 原样透传，不重算
  payments:        fo.payments.map(p => ({ id: p.id, amount: toNum(p.amount), paymentDate: p.paymentDate,
                                           method: p.paymentMethod, notes: p.notes })),
}))
```

- **不含** `adjustmentAmount`，**不含** `customerId`，**不返回** `data.orders` 这种按单号索引的 map。
- 不按入参 `orderNos` 的顺序输出，也不为查不到的单号补空位（缺哪个少哪个）。
- `payments` **没有 `orderBy`** ⇒ 顺序未定义（**UNCERTAIN-5**）。

### 3.1 ⚠️ 与前端契约**不符**（本次取证最重要的发现之一）

旧前端（`Home.formatted.js:9237-9270`，解码表 `dr`）读的是：

```js
// Home.formatted.js:9242-9248（token：554=data, 1175=code, 955=orders, 889=allocatedAmount,
//                               863=adjustmentAmount, 904=customerId）
if (200 === u.code && u.data?.orders) {          // ← 期望 data.orders —— 而 service 返回数组
  s = u.data.orders                              //   ⇒ s 恒为 {}
  Object.entries(s).forEach(([k, t]) => {
    if (t.allocatedAmount  > 0) a += t.allocatedAmount;    // 汇总「已分配收款」
    if (t.adjustmentAmount > 0) i += t.adjustmentAmount;   // 汇总「订单抹零」
    if (t.customerId && (t.allocatedAmount > 0 || t.adjustmentAmount > 0)) c.push(t.customerId);
  });
}
```

随后（`:9254-9290`）只有当 `d = a + i > 0` 时才弹「删除订单时将自动进行红冲」（token `1411`），
并按 `c`（客户 id 集合）逐客户发 `finance_addPayment`（负收款，token `1347`=`` • 已分配收款 ¥ ``）
与 `finance_addCustomerAdjustment`（负抹零，token `1082`=`` • 订单抹零 ¥ ``）。

⇒ 用本仓库这份 service，`data.orders` 恒为 `undefined`，**删除订单的红冲静默不执行**（不报错、不提示）。
本仓库 service 的返回形状与旧前端契约**不兼容**。CONFIRMED（两侧源码都直接读到）

> 需要 `customerId`（`Order.clientId`）和 `adjustmentAmount`（订单级调整合计）才能满足契约，
> 而 `FinanceOrder` 表里**没有** `customerId` 列，`orderAdjustTotal` 也没被这个端点读取。

---

## 4. `checkSystem`（`finance.service.ts:318-321`）

```ts
count = prisma.financeOrder.count({ where: { databaseName: ds } })
return { code: 200, data: { hasNewFinance: count > 0 }, message: 'ok' }
```
只判「该 ds 是否有任何 finance_orders 行」。无其他条件。CONFIRMED

---

## 5. `getOrderDetail`（`finance.service.ts:688-726`）

```ts
fo = prisma.financeOrder.findFirst({ where: { databaseName: ds, orderNo: receiptNo } })
if (!fo) return { code: 200, data: null, message: 'ok' }        // :690
        // → legacy-dispatch.ts:879-885 把它翻成 HTTP 404 {code:404,data:null,message:'订单不存在'}

payments    = prisma.payment.findMany({ where: { databaseName: ds, financeOrderId: fo.id } })   // 无 orderBy
adjustments = prisma.orderAdjustment.findMany({ where: { databaseName: ds, orderNo: receiptNo } }) // 无 orderBy

分配明细[i] = { id: p.id, payment_id: p.id,
                分配金额: toNum(p.amount),
                备注: p.notes || '', 收款方式: p.paymentMethod || '',
                收款日期: p.paymentDate ? p.paymentDate.toISOString().split('T')[0] : '' }

调整记录[i] = { id: a.id, 调整金额: toNum(a.adjustAmount), 调整类型: a.adjustType || '', 备注: a.notes || '',
                调整日期: a.createdAt ? a.createdAt.toISOString().split('T')[0] : '',
                日期:     同上 }

data = {
  分配明细,
  回执单号:     receiptNo,                                          // ← 回显入参，不是 fo.orderNo
  客户:         fo.customerName || '',
  已分配金额:   toNum(fo.allocatedAmount),                          // 存量列
  总价:         toNum(allocatedAmount) + toNum(unpaidAmount) + toNum(orderAdjustTotal),   // :719 存量三列相加
  未收金额:     toNum(fo.unpaidAmount),                             // 存量列
  订单调整金额: toNum(fo.orderAdjustTotal),                         // 存量列
  调整记录,
}
```

关键点（全部 CONFIRMED）：

1. **`总价` 不读 `orders.total_amount`**，是 `已分配 + 未收 + 订单调整` 三个存量列之和
   （与 `orderTotal()` 助手 `:57-60` **不同**：那个优先 `order.totalAmount`，见 §10 的 `orderTotal` 行）。零兜底：三列都是 0 时 `总价 = 0`。
2. **`Σ分配明细.分配金额 ≠ 已分配金额`**：`executePrepaymentAllocation`（`:828-834`）只改存量列、**不建 Payment 行**，
   所以资金池分配进来的钱**不在 `分配明细` 里**。
3. 两个明细查询都**无 `orderBy`** ⇒ 顺序未定义；`financeOrderId` 为 NULL 的 Payment 不出现（符合预期）。
4. `分配明细` 这个字段旧前端**根本不读**：`grep "分配明细" Home.formatted.js` → 0 命中。前端读的是
   `c["已分配金额"]`（`:1529`）与 `c["调整记录"]`（`:1668`），对象由 `Object.assign(c, a.data)` 灌入
   （`:1097-1108`，解码表 `To`：`537`=`` ?param1=finance_getOrderDetail&param2= ``, `412`=`data`）。CONFIRMED

---

## 6. `getCustomerBalance`（`finance.service.ts:730-774`）— 本次取证的核心

```ts
client = customerId ? await findClient(ds, customerId) : null
if (customerId && !client) return { code: 200, data: null, message: 'ok' }   // :732
        // → legacy-dispatch.ts:886-893 翻成 HTTP 500 {code:500,data:null,message:'客户不存在'}

canonical = client?.clientCode || customerId || ''

balance = customerId
  ? await ensureCustomerBalance(ds, canonical, client?.name)      // :735 ★ UPSERT：GET 接口会写库
  : await prisma.customerBalance.findFirst({ where: { databaseName: ds } })   // :736 ★ 任意一行

financeOrders = customerId
  ? await financeOrdersForCustomer(ds, customerId, client)                        // :738
  : await prisma.financeOrder.findMany({ where: { databaseName: ds }, include: { order: true } })  // :739

customerAdjustments = prisma.customerAdjustment.findMany({
  where: { databaseName: ds, ...(customerId ? { clientCode: canonical } : {}) },   // :740-742
})

orderNos = financeOrders.map(r => r.orderNo).filter(Boolean)                        // :743
orderAdjustments = orderNos.length
  ? prisma.orderAdjustment.findMany({ where: { databaseName: ds, orderNo: { in: orderNos } } })   // :744-746
  : []

orderTotalAmount = Σ ( toNum(allocatedAmount) + toNum(unpaidAmount) + toNum(orderAdjustTotal) )   // :747 存量列
allocated        = Σ toNum(allocatedAmount)                                                      // :748 存量列
unpaidTotal      = Σ toNum(unpaidAmount)                                                         // :749 存量列
orderAdjustTotal = Σ toNum(orderAdjustments.adjustAmount)      // :750 ★ 流水表 order_adjustments
customerAdjustTotal = Σ toNum(customerAdjustments.adjustAmount) // :751 ★ 流水表 customer_adjustments

b = balance ?? { totalTopup: 0, prepaidBalance: 0, totalSpent: 0,
                 customerName: client?.name || '', clientCode: customerId || '' }   // :752-758

data = {
  实收金额:     toNum(b.totalTopup),                       // ★ 存量列 customer_balances.total_topup
  客户余额:     Math.max(0, unpaidTotal - customerAdjustTotal),   // ★ 实时聚合，且夹到 ≥0
  客户名称:     b.customerName || '',
  客户编号:     b.clientCode,                              // ★ 来自 balance 行，不是入参
  客户调整合计: customerAdjustTotal,                        // ★ 实时 Σ customer_adjustments
  已分配金额:   allocated,                                  // ★ 实时 Σ 存量列
  未分配余额:   toNum(b.prepaidBalance),                    // ★ 存量列，**不夹零，可为负**
  订单总额:     orderTotalAmount,                           // ★ 实时 Σ(三存量列)
  订单调整合计: orderAdjustTotal,                           // ★ 实时 Σ order_adjustments（≠ 订单调整金额）
}
```

### 6.1 逐字段定死

| 对外字段 | 公式 | 性质 |
|---|---|---|
| `已分配金额` | `Σ finance_orders.allocated_amount`（该客户全部单） | 聚合存量列 |
| `未收金额`（**本端点不返回**，但参与下面两行） | `Σ finance_orders.unpaid_amount` | 聚合存量列 |
| `订单总额` | `Σ (allocated_amount + unpaid_amount + order_adjust_total)` | 聚合存量列 |
| `订单调整合计` | `Σ order_adjustments.adjust_amount`（按 `orderNo ∈ 该客户 financeOrders` 圈定） | **实时读流水表** |
| `客户调整合计` | `Σ customer_adjustments.adjust_amount`（按 `client_code = canonical`） | **实时读流水表** |
| `客户余额` | `max(0, Σ unpaid_amount − Σ customer_adjustments.adjust_amount)` | **实时**，夹到 ≥0 |
| `实收金额` | `customer_balances.total_topup` | **存量列** |
| `未分配余额` | `customer_balances.prepaid_balance` | **存量列**，不夹零 |
| `客户名称` / `客户编号` | `balance` 行的 `customer_name` / `client_code` | 存量列 |

### 6.2 本端点的坑（全部 CONFIRMED）

1. **GET 会写库**：`:735` 走 `ensureCustomerBalance` 的 upsert（`:91-109`）——客户不存在余额行时**建一行**。
2. **`未分配余额` 可为负**（`:768` 无 `Math.max`），前端自己夹：`Home.formatted.js:987` `max(0, Number(s["未分配余额"] ?? 0))`（token `598`=`max`）。CONFIRMED
3. **`客户余额` 夹零**：`:763` `Math.max(0, …)` ⇒ 客户多付了也不会在 `客户余额` 上显示负数（负数落在 `未分配余额`）。
4. **`订单调整合计` 与 `订单总额` 不同源**：前者读流水表，后者读存量列 `order_adjust_total`。
   只要写路径保证了两者同步（现在靠 `applyOrderAdjustmentToFinance:231-246` 同时写），
   `订单总额` 就等于**原总价**（`unpaid` 减多少、`orderAdjustTotal` 加多少）。但 `:235` 的
   `Math.max(0, unpaid − amount)` **一旦触发夹零，这个恒等式就破了**，`订单总额` 会被抬高。CONFIRMED（代码行为）/ **UNCERTAIN-6**（是否有意）
5. **无 `customerId` 时是「全局聚合 + 任意一行余额」**：`:736` 取该 ds 的**第一条** `customer_balances`
   （无 `orderBy`），却用它的 `total_topup`/`prepaid_balance` 配全量 `finance_orders` 的求和 ⇒
   `实收金额`/`未分配余额`/`客户编号` 只有那一条余额行的值。语义不明，**UNCERTAIN-3**。
6. **`客户编号` 不是入参回显**：是 `balance.clientCode`（有 client 时已被 canonical 化）。
7. `addCustomerAdjustment` 不动 `finance_orders.unpaid_amount` ⇒ 客户抹零**只**通过 `客户余额` 这一条公式体现。
8. **`_days`（`:730` 形参）完全未使用**（同理 `getCustomerStatement` 的 `:645`）。CONFIRMED

---

## 7. `getPaymentStats`（`finance.service.ts:579-641`）

```ts
client = customerId ? await findClient(ds, customerId) : null
canonical = client?.clientCode || customerId || ''

payments = prisma.payment.findMany({
  where: { databaseName: ds, ...(customerId ? { OR: [
      { financeOrder: { order: { clientId: client?.id ?? -1 } } },     // 没有 client 时用 -1 ⇒ 恒不命中
      { financeOrder: { customerName: client?.name || customerId } },
  ]} : {}) },
  orderBy: { paymentDate: 'desc' }, take: 200,
  include: { financeOrder: { select: { customerName: true } } },        // 查了但输出里没用到
})

fundFlows = customerId
  ? prisma.customerFundFlow.findMany({ where: { databaseName: ds, clientCode: canonical },
                                       orderBy: { paymentDate: 'desc' }, take: 200 })
  : []                                                                  // ← 无客户 ⇒ 一条资金流水都不取

rows = [...payments, ...fundFlows.map(fundFlowPaymentRow)]

monthMap = {}; yearMap = {}
for (p of rows) {
  if (!p.paymentDate) continue                     // 无日期：不进月度/年度，但**仍进 payments 列表**
  ym = `${p.paymentDate.getFullYear()}-${pad(getMonth()+1)}`   // ★ 本地时区取年月
  y  = `${p.paymentDate.getFullYear()}`                        // ★ 本地时区取年
  amt = toNum(p.amount)
  amt >= 0 ? (收款 += amt) : (红冲 += Math.abs(amt))            // ★ 只按符号分桶
}

payments 列表 = rows.map(p => ({
  方式: p.paymentMethod || '',
  日期: p.paymentDate ? p.paymentDate.toISOString().split('T')[0] : '',   // ★ UTC 取日期
  金额: toNum(p.amount),
}))

return { code: 200, data: { monthly: 按月份字典序升序, payments: paymentsList, yearly: 按年份字典序升序 }, message: 'ok' }
```

`fundFlowPaymentRow`（`:261-279`）：`{ id: 'fund-'+flow.id, amount, paymentDate, paymentMethod,
notes: flow.notes || flow.flowType || '', financeOrderId: null, orderId: null, financeOrder: null }`
—— **`notes` 在为空时回落到 `flowType`**（这是唯一的「字段缺失回退另一来源」之一）。CONFIRMED

要点：

1. **`take: 200` 且无分页/无 total** ⇒ 每源最多 200 行，客户视图最多 400 行。历史数据会被截断。CONFIRMED
2. **有/无 `customerId` 是两套数据源**：无客户只看 `payments`；有客户时 `payments` 被
   `financeOrder` 关系过滤，**`financeOrderId = NULL` 的客户级预付款 Payment 被两个 OR 分支同时排除**
   （`financeOrder` 为 null，关系条件不成立），由对应的 `CustomerFundFlow` 代表。
   正常路径下不重不漏（`addPayment:388-427` 是成对写的），**UNCERTAIN-7**（其他写路径是否也成对，本次未审）。
3. `红冲` 桶把三种负数**混在一起**：订单收款红冲、`预付款冲销`、`预付款分配`（负数）。仅凭 monthly 无法区分。CONFIRMED
4. **月度/年度用本地时区、`日期` 列用 UTC** ⇒ 服务器时区为负偏移时同一行的年月与日期可能差一天。CONFIRMED（代码事实；具体偏移 **UNCERTAIN-8**）
5. 前端契约对得上：`Home.formatted.js:1159` `oe.monthly = a.data.monthly; oe.yearly = a.data.yearly`
   （解码表 `To`：`501`=`monthly`,`349`=`yearly`,`677`=`` 获取收款统计失败 ``）。`payments` 数组**前端未使用**。CONFIRMED

---

## 8. `getCustomerStatement`（`finance.service.ts:645-684`）+ 投影层（`legacy-dispatch.ts:518-613`）

### 8.1 service 层：四张表原样返回，零聚合

```ts
client = customerId ? await findClient(ds, customerId) : null
canonical = client?.clientCode || customerId || ''

financeOrderWhere = paymentWhere = adjustmentWhere = orderAdjustmentWhere = { databaseName: ds }

if (customerId) {
  financeOrderWhere.OR = [ ...(client ? [{ order: { clientId: client.id } }] : []),
                           { customerName: client?.name || customerId } ]
  paymentWhere.OR     = [ ...(client ? [{ financeOrder: { order: { clientId: client.id } } }] : []),
                          { financeOrder: { customerName: client?.name || customerId } } ]
  adjustmentWhere.clientCode = canonical
  orderAdjustmentWhere.orderNo = { in: (financeOrder.findMany({ where: financeOrderWhere, select: { orderNo } })
                                          .map(r => r.orderNo).filter(Boolean)) }      // :662-667 二次查询
}

financeOrders    = findMany({ financeOrderWhere, include: { order: true }, orderBy: { createdAt: 'desc' } })
payments         = findMany({ paymentWhere, orderBy: { paymentDate: 'desc' } })
fundFlows        = customerId ? findMany({ databaseName, clientCode: canonical, orderBy: { paymentDate: 'desc' } }) : []
adjustments      = findMany({ adjustmentWhere, orderBy: { createdAt: 'desc' } })          // CustomerAdjustment
orderAdjustments = findMany({ orderAdjustmentWhere, orderBy: { createdAt: 'desc' } })     // OrderAdjustment

return { orders: financeOrders,
         payments: [...payments, ...fundFlows.map(fundFlowPaymentRow)],   // ★ 资金流水伪装成收款行
         adjustments: [...adjustments, ...orderAdjustments] }              // ★ 客户调整 + 订单调整混在一个数组
```

**与 `getCustomerBalance` 的关键差异**：这里 `client` 为 null 时**不返回 null**，而是继续用
`customerName = customerId` 兜底查（`:655,659`）。CONFIRMED

无 `code`/`data` 键 ⇒ 兼容层 `legacy-dispatch.ts:875-877` 判定要走 `projectCustomerStatement`。
无 `days` 过滤、无分页。CONFIRMED

### 8.2 投影层（对外的「流水行」）CONFIRMED

```ts
// legacy-dispatch.ts:518-613
先建三张映射（:524-554）：
  foMap:        financeOrder.id  → { orderNo: 单据号, address: 安装地址 }
  单据号 docNo  = ping_hui/diao_hui 各行的 '单号' 里第一个非空（Set 插入序）
                  || customerInfo['单号集']（:534-545）
  安装地址 addr = customerInfo['安装地址'] ?? customerInfo['地址'] ?? ''（:532）
  orderNoMap:   docNo → addr（:547-549）
  receiptToDocNo: 回执单号 → docNo（:550-553）

orderRows = financeOrders
  .filter(r => isRecord(r.order))                    // ★ order 关系为 null 的行被整行丢弃
  .map(r => ({
    单据号:   docNo,
    备注:     r.order.notes ?? customerInfo['订单备注'] ?? '',      // 注意是 ??，不是 ||
    安装地址: customerInfo['安装地址'] ?? customerInfo['地址'] ?? '',
    收款方式: null,
    日期:     dateText(r.order.orderDate ?? customerInfo['日期']),
    类型:     '订单',
    金额:     numberValue(r.order.totalAmount ?? customerInfo['总价'] ?? r.allocatedAmount),  // ★ 三档回退
  }))

paymentRows = payments.map(p => ({
  单据号:   foMap.get(p.financeOrderId)?.orderNo ?? '',    // financeOrderId 为 null（资金流水）⇒ ''
  备注:     p.notes ?? '', 安装地址: foMap.get(p.financeOrderId)?.address ?? '',
  收款方式: p.paymentMethod ?? null, 日期: dateText(p.paymentDate), 类型: '收款', 金额: numberValue(p.amount),
}))

adjustmentRows = adjustments.map(a => ({
  单据号:   a.orderNo ? (receiptToDocNo.get(a.orderNo) || a.orderNo) : '',   // 客户调整无 orderNo ⇒ ''
  备注:     a.notes ?? '', 安装地址: orderNoMap.get(a.orderNo) ?? '',         // ★ 见下
  收款方式: null, 日期: dateText(a.createdAt), 类型: a.adjustType ?? '调整', 金额: numberValue(a.adjustAmount),
}))

return { code: 200, data: [...orderRows, ...paymentRows, ...adjustmentRows], message: 'ok' }
```

投影层的三个确定行为：

1. **`安装地址` 查错了 map**：`orderNoMap` 的键是**单据号 docNo**（`:547`），却拿 **`a.orderNo`（回执单号）** 去查（`:598`）。
   两个 id 空间不同 ⇒ 只有当 `单号 == 回执单号` 时才有值，否则恒为 `''`。
   同一行的 `单据号` 却正确地走了 `receiptToDocNo`（`:601`）。CONFIRMED（代码事实；实际影响取决于数据，**UNCERTAIN-9**）
2. **资金流水行**（`fundFlowPaymentRow`）的 `financeOrderId` 是 `null` ⇒ 它的 `单据号`/`安装地址` 恒为 `''`，
   但 `收款方式`/`金额`/`日期` 正常。CONFIRMED
3. **`order` 关系为 null 的 financeOrder 整行消失**（`:558`），不进流水。CONFIRMED
4. `金额` 用的是 `??`（`:581`），所以 `total_amount = 0` 会**保留 0**，不会回退到 `customerInfo['总价']`
   —— 与 §10 的 `orderTotal()` 用 `||` 是**相反**的语义。CONFIRMED

---

## 9. 只读预览（不写库，但公式属于读取口径）

### 9.1 `previewAllocation`（`:778-784`）
```ts
customerCode = customerCodeFromBody(body)                      // 客户编号 ?? customerCode ?? clientCode
amount = toNum(body['收款金额'] ?? body['分配金额'] ?? body.amount)
unpaidOrders = unpaidOrdersForCustomer(ds, customerCode)       // = 该客户 unpaid_amount > 0 的单，按 orderDate asc, createdAt asc
data = buildAllocationPreview(unpaidOrders, amount, toNum(body['优惠比例']))
```

### 9.2 `buildAllocationPreview`（`:174-229`）—— 分配 / 优惠公式

```ts
isRefund = amount < 0
remaining = amount; totalDiscount = 0; rows = []

if (isRefund) {                                   // 红冲：反分配
  toRefund = Math.abs(amount)
  for (fo of orders) {                            // ★ orders 是「unpaid>0」的集合，见下
    if (toRefund <= 0) break
    allocated = toNum(fo.allocatedAmount); if (allocated <= 0) continue
    refund = Math.min(toRefund, allocated)
    rows.push({ 回执单号: fo.orderNo||'', 日期: dateText(fo.order?.orderDate), 总价: orderTotal(fo),
                已分配金额: allocated, 分配金额: -refund, 优惠金额: 0, 分配后余额: allocated - refund })
    toRefund -= refund
  }
  remaining = -toRefund                            // 剩余（负）＝退不掉的部分
} else {                                          // 正常分配：FIFO，先老单
  for (fo of orders) {
    if (remaining <= 0) break
    unpaid = toNum(fo.unpaidAmount); if (unpaid <= 0) continue
    alloc = Math.min(remaining, unpaid)
    discount = discountRate > 0
      ? Math.min(unpaid - alloc, Math.round(alloc * discountRate * 100) / 100)   // ★ 全库唯一的显式舍入
      : 0
    rows.push({ 回执单号: fo.orderNo||'', 日期: dateText(fo.order?.orderDate), 总价: orderTotal(fo),
                未收金额: unpaid, 分配金额: alloc, 优惠金额: discount,
                分配后余额: Math.max(0, unpaid - alloc - discount) })
    remaining -= alloc                             // ★ 优惠不抵扣 remaining（优惠是白送的，不占现金）
    totalDiscount += discount
  }
}
return { 分配列表: rows, allocations: rows,
         剩余金额: remaining, unallocated: remaining,
         合计分配金额: amount - remaining,          // 现金口径
         合计优惠金额: totalDiscount,
         资金池剩余: remaining }
```

- **红冲预览的候选集是错的（或至少反直觉）**：候选来自 `unpaidOrdersForCustomer`（`unpaid_amount > 0`），
  但红冲分支要求 `allocated > 0` —— **已结清的单（unpaid=0）永远不会出现在红冲预览里**。CONFIRMED（代码事实；是否有意 **UNCERTAIN-10**）
- `优惠比例` 是**小数**（`Math.round(alloc * rate * 100)/100`，配合 `docs/2026-09-17-home-analysis.md:263` 的 ÷100 结论），上限是 `unpaid − alloc`。
- 该函数是 `previewAllocation` 与 `previewPrepaymentAllocation` 共用的。

### 9.3 `previewPrepaymentAllocation`（`:788-801`）
```ts
available = Math.max(0, toNum(balance?.prepaidBalance))        // 存量列，夹零
amount    = Math.min(Math.max(0, requestedAmount), available)  // ★ 夹到 [0, available]
data      = buildAllocationPreview(unpaidOrders, amount, 优惠比例)
```
注意 `legacy-dispatch.ts:898-901` 把 `finance_previewPrepaymentAllocation` 也指向 `previewPrepaymentAllocation`，
**而 REST 路由 `finance.routes.ts:184-197` 把 `preview-prepayment-allocation` 错误地指向了 `previewAllocation`**
（不读资金池余额、不夹 `available`）。CONFIRMED（两条通路行为不一致）

---

## 10. Helper 逐个定死

| helper | 行 | 语义（CONFIRMED） |
|---|---|---|
| `toNum(val)` | `:5-8` | `typeof val === 'string' ? parseFloat(val) : Number(val)`；`isNaN` → `0`。**不抛错、不舍入**。`null`→`0`（`Number(null)=0`）、`undefined`→`0`、`''`→`0`、`'12abc'`→`12`、`'1,234.5'`→`1` |
| `dsFilter(ds)` | `:10-12` | `{ databaseName: ds }`，只用于 `getOrderSummary:285` 与 `checkSystem:319` |
| `nowDate()` | `:14-20` | 本地时区当天 00:00 的 `Date`（用本地年月日拼 `YYYY-MM-DD` 再 `new Date`） |
| `dateText(val)` | `:22-26` | `!val → ''`（**`0` 也是 falsy ⇒ `0 → ''`**）；能转 Date 就 `toISOString().split('T')[0]`（**UTC**），否则 `''` |
| `textValue(val)` | `:28-30` | `null/undefined → ''`，否则 `String(val).trim()` |
| `parseJsonRecord(v)` | `:32-41` | 已是对象（非数组）→ 原样；字符串 → `JSON.parse`，非对象/解析失败 → `{}` |
| `updateCustomerFields` | `:43-50` | 写路径专用（`updateOrderCustomer:500-507`），读取路径不用 |
| `statusText(unpaid)` | `:52-55` | `unpaid <= 0 → '已结清'`，否则 **`'部分付款'`** |
| `orderTotal(fo)` | `:57-60` | `toNum(order.totalAmount) \|\| (allocated + unpaid + orderAdjustTotal)` —— **`\|\|` 语义**：`totalAmount` 为 `0`/`null`/缺失都会回退到三列之和。**只在 `buildAllocationPreview` 用**（预览的「总价」列），**不在任何真正的读端点用** |
| `customerCodeFromBody(body)` | `:62-64` | `textValue(body['客户编号'] ?? body['customerCode'] ?? body['clientCode'])`。**`??` 只在 null/undefined 时下探**：`{'客户编号': ''}` 会得到 `''`，不会回退到 `customerCode` |
| `findClient(ds, code)` | `:66-80` | 无 code → `null`；否则 `findFirst({databaseName: ds, OR: [{clientCode: trimmed}, ...(纯数字时 {id: Number})]}, orderBy: {id:'asc'})` |
| `resolveCustomerIdentity` | `:82-89` | `{ client, balanceCode: client?.clientCode \|\| customerCode, customerName: client?.name \|\| '' }` |
| `ensureCustomerBalance` | `:91-109` | 按 `(databaseName, clientCode)` upsert；update 分支**只改 `clientId`/`customerName`**，不动金额列 |
| `syncOrderAmounts(orderId, a, u)` | `:111-120` | `order.update({ where: { id: orderId }, data: { paidAmount: a, unpaidAmount: u } })` —— **无 `databaseName` 条件**（见 §12） |
| `updateFinanceOrderAmounts` | `:122-135` | `nextAllocated = allocated + Δ`（**不夹零**）；`nextUnpaid = max(0, unpaid + Δ)`（**夹零**）；同时回写 `orders` |
| `allocationRows(body)` | `:137-140` | `body['分配列表'] ?? body['allocations'] ?? body['allocationList'] ?? []`，只留非数组对象项 |
| `financeOrdersForCustomer` | `:142-167` | 主查：`{databaseName, ...extraWhere, client ? {order:{clientId}} : {customerName: customerCode}}`，`orderBy [order.orderDate asc, createdAt asc]`；**若结果为空且 client 有 name**，再用 `customerName: client.name` 重查一次 |
| `unpaidOrdersForCustomer` | `:169-172` | `financeOrdersForCustomer(ds, code, client, { unpaidAmount: { gt: 0 } })` |
| `fundFlowPaymentRow` | `:261-279` | 见 §7 |

**`financeOrdersForCustomer` 的三条边界（CONFIRMED）**：
1. `client === null` 时用 **`customerName = customerCode`（原样入参）** 匹配 —— 传客户名也能查到；传查不到的编号会得到空集。
2. 兜底重查**只在 `client.name` 非空时**发生；`client` 存在但 name 为空且按 `clientId` 查不到时，**不兜底**。
3. `extraWhere` 直接展开进 `where`，所以 `{ unpaidAmount: { gt: 0 } }` 是**在 SQL 里过滤**（`Decimal` 列比较），不是 JS 过滤。

---

## 11. UNCERTAIN（卡在哪）

| # | 事项 | 卡在哪 |
|---|---|---|
| 1 | **本仓库这份 service 是不是「旧系统」的权威读取口径** | `checkOrderPayment` 返回数组、无 `data.orders`/`adjustmentAmount`/`customerId`，与 `legacy/js/Home.formatted.js:9242-9248` 的契约直接冲突（§3.1）。本次**没有**核对原始 PHP/线上服务端；`~/Downloads/server` 究竟是原系统还是 Node 重写，从仓库内看不出来 |
| 2 | `finance_getOrderFinanceSummary` 的 `param3/param4/param5`（days=60/start/end）被丢弃 | 前端确实传（`Home.formatted.js:7911`，token `1170/680/1135`），service 签名只有 ds（`finance.service.ts:283`）。是「有意全量」还是漏实现，源码里无注释可判 |
| 3 | `getCustomerBalance` 无 `customerId` 分支取「任意一行 `customer_balances`」 | `:736` `findFirst` 无 `orderBy`，却用它配全量聚合。该分支给谁用、期望哪一行，无从判断 |
| 4 | `statusText` 两套词表 | 本文件写 `'部分付款'`（`:54`），而 `order.service.ts:572,579`、`client.service.ts:543,550` 建行时写 `'未付清'`。读端点**原样透传**，所以同一列会返回两种文案。哪个是对外口径，无法判定 |
| 5 | `checkOrderPayment` 里 `payments` 的顺序 | 无 `orderBy`（`:306`），顺序由 PG 决定 |
| 6 | `applyOrderAdjustmentToFinance` 的 `Math.max(0, unpaid - amount)` 夹零 | `:235`。夹零会破坏「`allocated+unpaid+orderAdjustTotal` = 原总价」的恒等式，使 `订单总额` 虚高。是有意防负还是漏判，源码无说明 |
| 7 | `payments` 与 `customer_fund_flows` 是否**永远成对** | 只有 `addPayment:388-427` 是成对写的；其余写路径（含 `executePrepaymentAllocation:847-859` 造了 fund flow 却没有 Payment）本次未审。若不成对，`getPaymentStats(customerId)` 会漏计或重复计 |
| 8 | 月度分桶的时区偏移 | `:612-613` 用本地 getter，`:628` 用 UTC。服务器 TZ 未知（**.env 禁读**），实际差几天无法判定 |
| 9 | `projectCustomerStatement` 里 `安装地址` 用 `orderNoMap`（键=单据号）配 `回执单号` 查 | `legacy-dispatch.ts:596-599`。代码事实确定，但 `单号 == 回执单号` 在老数据里是否普遍成立，需要真实数据才能定量 |
| 10 | 红冲预览的候选集 | `buildAllocationPreview` 的负数分支只在 `unpaidOrdersForCustomer`（unpaid>0）里选，导致已结清单不进红冲预览（`:182-197`）。前端「红冲不能超过本单已分配金额」的校验（`Home.formatted.js:1227`）暗示界面上是能选到已分配的单的，两者对不上 |
| 11 | `checkOrderPayment` 返回空数组时 | `:303` 返回裸 `[]`，经 `applyLegacyContract` 后变成 `{code:200,data:[]}`（`:342`）——与「查不到单号时返回空 map/空对象」的期望形状不同 |
| 12 | 其余读取端点的前端消费形状 | 已核实：summary（`:7911-7921`）、checkOrderPayment（`:9242-9248`）、paymentStats（`:1159`）、orderDetail（`:1097-1108`）、customerBalance（`:1112-1114`）。**未核实**：`finance_getCustomerStatement` 的行消费者（endpoint 字符串被混淆，未定位） |

---

## 12. 多租户（`ds`）隔离核查

- 通路 A：`ds` 来自 **`legacy-dispatch.ts:1144`**（`req.query.param2 || req.body.param2 || req.body.ds || ''`）——`app.ts:42` 的 `/1` 路由**没有任何鉴权中间件**（`app.ts:26-28` 只有 cors/json/urlencoded），
  即**旧通路的 `ds` 完全由调用方指定**：租户隔离在该通路上仅靠「客户端不说谎」。
  通路 B：`ds = req.user!.databaseName`（`finance.routes.ts:15` 等，`router.use(requireAuth)` 在 `:9`）。CONFIRMED
- **所有读取查询都带 `databaseName: ds`**，逐条核对过：`getOrderSummary:285`、`checkOrderPayment:305`、
  `checkSystem:319`、`getOrderDetail:689,691,692`、`getCustomerBalance:736,739,741,745`、
  `getPaymentStats:583,600`、`getCustomerStatement:648-651,662,669,674,676,681,682`、
  `findClient:72`、`financeOrdersForCustomer:148,161`、`ensureCustomerBalance:94`、`unpaidOrdersForCustomer`（透传）。
  **没有发现读路径漏 `ds`**。CONFIRMED
- **写路径有两处按主键直接更新、不带 `databaseName`**：
  `syncOrderAmounts`（`:113-119`，写 `orders`）与 `updateFinanceOrderAmounts`/`applyOrderAdjustmentToFinance`
  （`:125-132`、`:236-243`，写 `finance_orders`），以及 `addPayment` 事务内的 `tx.financeOrder.update({where:{id}})`（`:350`、`:374`）。
  它们的 id 都来自**本次请求已按 ds 过滤出来的行**，所以实际不可跨租户；但这是「靠调用方自觉」的模式，
  新系统若照搬需要在 SQL 层补 tenant_id（新后端已补，见 `backend/src/modules/finance/service.rs:21-24`）。
- 另两处语义缺口（非泄漏）：`getCustomerBalance:736` 与 `:757` 的 `clientCode: customerId` 回退会把
  **未经校验的入参**当作客户编号落进返回体；`getOrderSummary` 无分页，返回该 ds 全量单据。CONFIRMED

---

## 13. 舍入与精度

- **读路径没有任何显式舍入**。`toNum`（`:5-8`）只做类型转换 + `NaN→0`。
- 所有求和都是 **JS double 累加**（`:747-751`、`:610-624`、`buildAllocationPreview`），
  `Decimal(12,2)` 经 Prisma 取回后转成 number，累加可能出 `0.30000000000000004` 这类尾差。
- 全库唯一的显式舍入在**预览**里：`Math.round(alloc * discountRate * 100) / 100`（`:206`）。
- 夹零点（等价于隐式阈值）：`Math.max(0, unpaidTotal - customerAdjustTotal)`（`:763`）、
  `Math.max(0, available)`（`:796`、`:814`）、`Math.max(0, nextUnpaid)`（`:124`、`:235`、`:349`、`:373`、`:827`）。
  **`未分配余额`（`:768`）和 `finance_orders.allocated_amount`（`:123`）不夹零**，可以是负数。
- `Math.abs(prepaidDelta) > 0.005`（`:385`）是写路径里唯一的浮点容差判断。

---

## 14. 边界与兜底清单

| 场景 | 行为 | 行 |
|---|---|---|
| `fo.orderNo` 为 `null`/`''` | `getOrderSummary` 跳过该行 | `:290` |
| `getOrderDetail` 查不到单 | `data: null` → 兼容层 HTTP 404 | `:690` / `legacy-dispatch.ts:879-885` |
| `getCustomerBalance` 客户查不到 | `data: null` → 兼容层 HTTP 500「客户不存在」 | `:732` / `:886-893` |
| `getCustomerStatement` 客户查不到 | **不返回 null**，按 `customerName = customerId` 兜底继续 | `:655,659` |
| `checkOrderPayment` 空入参 | 返回裸 `[]` | `:303` |
| `financeOrder.order` 关系为 null | `getCustomerStatement` 的投影**整行丢弃** | `legacy-dispatch.ts:558` |
| `paymentDate` 为 null | 不进 monthly/yearly，但**进 `payments` 列表**（`日期: ''`） | `:611`、`:628` |
| `finance_orders` 三列全 0 | `总价 = 0`，**不回退** `orders.total_amount` | `:719` |
| 金额列 `NULL` | `toNum(null) = 0` | `:5-8` |
| `销售金额` 字段缺失 | `orderTotal()` 用 `\|\|` 回退三列之和；投影层用 `??` **不回退** | `:59` vs `legacy-dispatch.ts:581` |
| 资金流水 `notes` 为空 | 回退到 `flowType` | `:274` |
| `客户编号` 为空串 | `customerCodeFromBody` **不会**下探到 `customerCode`/`clientCode`（`??` 语义） | `:63` |
| 无 `customerId` 的 `getPaymentStats` | 一条资金流水都不取（`fundFlows = []`） | `:598-604` |

---

## 15. 金额正负号约定（CONFIRMED）

| 业务 | 正负 | 落点 | 行 |
|---|---|---|---|
| 收款 | **正** | `payments.amount` → `allocated_amount += amount`、`unpaid_amount -= amount` | `:347-349` |
| 红冲（收款冲销） | **负** | `payments.amount`；`unpaid_amount += \|amount\|` | `:347`（`amount >= 0 ? -(amount+discount) : Math.abs(amount)`） |
| 抹零/优惠/补贴 | **正 = 减免** | `order_adjustments.adjust_amount`；`order_adjust_total += amount`、`unpaid_amount -= amount` | `:234-235`、`:838` |
| 订单调整冲销 | **负** | 同上（`adjustAmount` 为负） | 前端 `docs/2026-09-17-home-analysis.md:263` |
| 客户抹零 | **正 = 减客户余额** | `customer_adjustments.adjust_amount`；仅在 `客户余额 = max(0, Σ未收 − Σ客户调整)` 里生效 | `:751`、`:763` |
| 预付款充值 | **正** | `customer_fund_flows.amount`，`flowType='预付款'`；`prepaid_balance += amount`、`total_topup += amount` | `:414-427` |
| 预付款冲销 | **负** | 同上，`flowType='预付款冲销'`；`total_topup` **不加** | `:422`、`:398` |
| 预付款分配（池→单） | **负** | `customer_fund_flows.amount = -totalAllocated`，`flowType='预付款分配'`；`prepaid_balance -= totalAllocated` | `:843-859` |
| 清账 | **正** | `payments.amount = unpaid`，`paymentMethod='清账'` | `:876-877` |
| `getPaymentStats` 分桶 | `amount >= 0` → `收款`；`< 0` → `红冲 += abs` | — | `:617-623` |

**`客户余额` 是唯一的「减法型」对外字段**：`Σ未收 − Σ客户抹零`（`:763`）。其余字段都是加法累计。

---

## 16. 一页速查：每个对外字段的真相来源

| 对外字段 | 出处 | 公式 | 性质 |
|---|---|---|---|
| 已分配金额（单） | `getOrderSummary:292`、`getOrderDetail:718`、`checkOrderPayment:310` | `finance_orders.allocated_amount` | 存量 |
| 未收金额（单） | `:293`、`:720`、`:310` | `finance_orders.unpaid_amount` | 存量 |
| 订单调整金额（单） | `:294`、`:721` | `finance_orders.order_adjust_total` | 存量 |
| 总价（单） | `getOrderDetail:719` | `allocated + unpaid + order_adjust_total` | 存量三列之和 |
| 已分配金额（客） | `getCustomerBalance:748,767` | `Σ allocated_amount` | 聚合存量 |
| 订单总额（客） | `:747,769` | `Σ (allocated + unpaid + order_adjust_total)` | 聚合存量 |
| 订单调整合计（客） | `:750,770` | `Σ order_adjustments.adjust_amount` | **实时流水** |
| 客户调整合计（客） | `:751,766` | `Σ customer_adjustments.adjust_amount` | **实时流水** |
| 客户余额（客） | `:763` | `max(0, Σ unpaid_amount − Σ customer_adjustments.adjust_amount)` | **实时** |
| 实收金额（客） | `:762` | `customer_balances.total_topup` | 存量 |
| 未分配余额（客） | `:768` | `customer_balances.prepaid_balance` | 存量 |
| 收款/红冲（统计） | `:610-624` | `payments` + `customer_fund_flows` 按 `amount` 符号分桶 | **实时流水** |
| 流水行（对账单） | `:669-683` + `legacy-dispatch.ts:518-613` | 四张表原样读取后投影 | **实时流水** |
