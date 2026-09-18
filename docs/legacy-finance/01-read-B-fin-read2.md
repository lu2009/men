# 旧系统财务模块 · 读取口径（逆向取证）

取证对象（只读，未做任何修改）：

- `/Users/aaa/Downloads/server/src/modules/finance/finance.service.ts`（887 行，下称 `svc`）
- `/Users/aaa/Downloads/server/src/modules/finance/finance.repository.ts`（98 行）
- `/Users/aaa/Downloads/server/prisma/schema.prisma`（378 行）

调用入口补充（用于确认「对外字段」到底长什么样）：

- `src/modules/finance/finance.routes.ts`（REST）
- `src/modules/legacy-dispatch.ts:840-909`（旧客户端兼容层，同名 handler 映射）
- `src/modules/legacy-dispatch.ts:518-613`（`projectCustomerStatement`，唯一消费 `getCustomerStatement` 的地方）

标记约定：**[C]** = CONFIRMED（源码直读，引用到行）；**[U]** = UNCERTAIN（有歧义，见 §13）。

---

## 0. 一句话总纲

**旧系统财务读数 = 从 `finance_orders` 的 3 个存量列（`allocatedAmount` / `unpaidAmount` / `orderAdjustTotal`）直接求和，外加 2 张流水表（`order_adjustments` / `customer_adjustments`）的求和；`payments` 表只用于「明细列表」，从不参与任何合计；`customer_balances` 只有 `prepaidBalance` / `totalTopup` 两个列被读出来当「未分配余额 / 实收金额」，而它俩跟订单收款完全无关。**

正文里「实时聚合」专指：读的时候对某张表做 `reduce` 求和。「存量列」专指：读某一行的某一列。

---

## 1. 对外字段总表

| 对外字段 | 出现位置 | 值来源 | 性质 |
|---|---|---|---|
| `已分配金额` | `svc:294`, `svc:718`, `svc:767` | `finance_orders.allocatedAmount` | 存量列，逐单读 / 跨单求和 |
| `未收金额` | `svc:293`, `svc:720` | `finance_orders.unpaidAmount` | 存量列，逐单读 |
| `订单调整金额` | `svc:295`, `svc:721` | `finance_orders.orderAdjustTotal` | 存量列，逐单读 |
| `订单调整合计` | `svc:770` | `order_adjustments.adjustAmount` 求和 | **实时聚合流水表**（注意与上一行不是同一个源） |
| `客户调整合计` | `svc:766` | `customer_adjustments.adjustAmount` 求和 | 实时聚合流水表 |
| `订单总额` | `svc:769` | Σ(allocatedAmount + unpaidAmount + orderAdjustTotal) | 存量列求和，**不用** `orders.totalAmount` |
| `客户余额` | `svc:763` | `max(0, ΣunpaidAmount − ΣcustomerAdjustments)` | 纯计算，**不落库** |
| `未分配余额` | `svc:768` | `customer_balances.prepaidBalance` | 存量列 |
| `实收金额` | `svc:762` | `customer_balances.totalTopup` | 存量列 |
| `总价`（订单详情） | `svc:719` | allocated + unpaid + orderAdjustTotal | 存量列求和 |
| `总价`（分配预览行） | `svc:190`, `svc:210` | `orderTotal()` → `orders.totalAmount`，**为 0/空时**回退到存量列求和 | 混合，见 §2.9 |
| `分配金额` / `优惠金额` / `分配后余额` | `svc:192-194`, `svc:212-214` | 预览期内存计算，不落库 | 纯计算 |
| `statusText` | `svc:311` | `finance_orders.statusText` | 存量列，**原样透出，不重算** |

`getCustomerBalance` **不返回** `未收金额`；`unpaidTotal` 只在该函数内部参与算「客户余额」（`svc:749`, `svc:763`）。这点是坑：新系统若按「客户余额页应该有未收金额」去实现，就与旧版不符。

---

## 2. Helpers 逐条（`svc:5-279`）

### 2.1 `toNum` — `svc:5-8` [C]

```ts
function toNum(val) {
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(n) ? 0 : n;
}
```

- 全模块唯一的数值入口，**不做任何舍入**，保留 IEEE754 全精度。
- `null` → `Number(null)` = `0`；`undefined` → `NaN` → `0`；`''` → `parseFloat('')` = `NaN` → `0`。
- 字符串前缀数字会被吃掉：`'12abc'` → `12`；`'1,234'` → `1`。
- Prisma `Decimal`（decimal.js 实例，`typeof === 'object'`）走 `Number(val)` → `valueOf()` → 正确转成 number，无精度声明。
- 布尔 `true` → `1`（本模块不会遇到）。

### 2.2 `dsFilter` — `svc:10-12` [C]

```ts
{ databaseName: ds }
```

finance 模块**直接使用 `req.user.databaseName`**，不经 `parseDs()` 归一化（对比 `order.service.ts` 用 `parseDs(ds)`）。所以调用方传什么字符串，就按什么字符串精确匹配。

### 2.3 `dateText` — `svc:22-26` [C]

```ts
if (!val) return '';                       // 0 / '' / null / undefined / NaN 全部 → ''
const d = val instanceof Date ? val : new Date(String(val));
return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
```

**用 UTC 取日期，不是本地时区**。东八区下本地 2026-09-18 07:00 的 `Date` 会输出 `'2026-09-17'`。

### 2.4 `textValue` — `svc:28-30` [C]

```ts
val === null || val === undefined ? '' : String(val).trim()
```

`0` → `'0'`；`false` → `'false'`；只对 `null/undefined` 返回空串。**空串不做兜底**（见 §11.3 的 `??` 陷阱）。

### 2.5 `parseJsonRecord` — `svc:32-41` [C]

对象且非数组 → 原样返回；非字符串或空白串 → `{}`；`JSON.parse` 失败或结果非对象 → `{}`。

### 2.6 `statusText` — `svc:52-55` [C]

```ts
unpaid <= 0 ? '已结清' : '部分付款'
```

**只被写侧调用**。注意与 `orders` 模块的用词不一致（见 §9.3），读侧 `checkOrderPayment` 原样透出。

### 2.7 `orderTotal` — `svc:57-60` [C]

```ts
const order = fo.order ?? {};
return toNum(order.totalAmount) || (toNum(fo.allocatedAmount) + toNum(fo.unpaidAmount) + toNum(fo.orderAdjustTotal));
```

- 优先 `orders.totalAmount`；**为 0 时也会回退**（`||` 对 0 敏感，不只是 null）。
- 仅被 `buildAllocationPreview` 使用（`svc:190`, `svc:210`）。`getOrderDetail` / `getCustomerBalance` **不用它**，直接用存量列求和 —— 这是同一个「总价」在两条读路径上的口径分叉。

### 2.8 `customerCodeFromBody` — `svc:62-64` [C]

```ts
textValue(body['客户编号'] ?? body['customerCode'] ?? body['clientCode'])
```

`??` 只跳过 `null/undefined`。若请求体显式带 `'客户编号': ''`，不会再去看 `customerCode`，直接得到 `''` → `findClient('')` 返回 `null` → 一路降级成「按名字匹配」甚至 `getCustomerBalance` 直接返回 `null`。

### 2.9 `findClient` — `svc:66-80` [C]

```ts
if (!customerCode) return null;                       // ''/undefined → null
const numericId = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
findFirst({ where: { databaseName: ds, OR: [ {clientCode: trimmed}, ...(isFinite(numericId) ? [{id: numericId}] : []) ] },
            orderBy: { id: 'asc' } });
```

- 纯数字客户编号会**同时**按 `clientCode` 和主键 `id` 匹配，命中 id 更小的那条。
- 匹配不到就是 `null`，**不会回退到按名字找客户**（回退逻辑在 `financeOrdersForCustomer` 里，见 2.12）。

### 2.10 `resolveCustomerIdentity` — `svc:82-89` [C]

```ts
{ client, balanceCode: client?.clientCode || customerCode, customerName: client?.name || '' }
```

`balanceCode` 是「客户编号归一化」的唯一出口：找到客户就用客户档案里的 `clientCode`，否则用调用方给的字符串。

### 2.11 `ensureCustomerBalance` — `svc:91-109` [C]

按 `(databaseName, clientCode)` upsert：不存在则以**全 0** 建行（`prepaidBalance: 0, totalTopup: 0, totalSpent: 0`，`svc:100-102`）；已存在时 **`update` 分支只写 `clientId` / `customerName`**（`svc:104-107`），三个金额列一个都不碰。也就是说这是一个「读之前顺手建个空行」的副作用函数。

### 2.12 `financeOrdersForCustomer` — `svc:142-167` [C]（客户维度的订单集怎么选的）

```ts
primary = financeOrder.findMany({ where: { databaseName, ...extraWhere,
    ...(client ? { order: { clientId: client.id } } : { customerName: customerCode }) },
  include: { order: true },
  orderBy: [{ order: { orderDate: 'asc' } }, { createdAt: 'asc' }] });

if (primary.length > 0 || !client?.name) return primary;      // ← 关键
return financeOrder.findMany({ where: { databaseName, ...extraWhere, customerName: client.name }, ... });
```

- 有客户档案时，**只认 `orders.clientId` 关联**；`finance_orders.orderId` 为 null 的订单被排除。
- 兜底（按 `customerName = 客户名` 找）**仅在主查询一条都没命中时才启动**。所以「部分订单已关联、部分没关联」的客户，会静默漏掉没关联那部分。**[C]**

### 2.13 `fundFlowPaymentRow` — `svc:261-279` [C]

把资金流水伪装成一条 payment：

```ts
{ id: `fund-${flow.id}`, amount: flow.amount, paymentDate, paymentMethod,
  notes: flow.notes || flow.flowType || '',     // 备注为空 → 用 flowType 顶上
  financeOrderId: null, orderId: null, financeOrder: null }
```

`id` 是**字符串**，而真 payment 行的 `id` 是**数字**，两者被塞进同一个数组（`svc:605`, `svc:683`）。

---

## 3. `getCustomerBalance` — `svc:730-774`（最重要）

### 3.1 前置 [C]

```ts
const client = customerId ? await findClient(ds, customerId) : null;
if (customerId && !client) return { code:200, data:null, message:'ok' };   // svc:732
const canonicalCustomerCode = client?.clientCode || customerId || '';      // svc:733
```

客户编号找不到客户档案 → **整个接口返回 `data: null`**，不做任何名字兜底。（旧兼容层把 `data === null` 翻译成 500「客户不存在」，`legacy-dispatch.ts:886-893`。）

### 3.2 取数与求和 [C]

```ts
const balance = customerId ? await ensureCustomerBalance(ds, canonicalCustomerCode, client?.name)
                           : await prisma.customerBalance.findFirst({ where: { databaseName: ds } });   // svc:734-736  ← 无 orderBy
const financeOrders = customerId ? await financeOrdersForCustomer(ds, customerId, client)
                                 : await prisma.financeOrder.findMany({ where:{databaseName: ds}, include:{order:true} });  // svc:737-739
const customerAdjustments = await prisma.customerAdjustment.findMany({
  where: { databaseName: ds, ...(customerId ? { clientCode: canonicalCustomerCode } : {}) } });          // svc:740-742
const orderNos = financeOrders.map(r => r.orderNo).filter(Boolean);
const orderAdjustments = orderNos.length
  ? await prisma.orderAdjustment.findMany({ where: { databaseName: ds, orderNo: { in: orderNos } } })
  : [];                                                                                                  // svc:743-746

const orderTotalAmount   = Σ (toNum(r.allocatedAmount) + toNum(r.unpaidAmount) + toNum(r.orderAdjustTotal));  // svc:747
const allocated          = Σ toNum(r.allocatedAmount);                                                        // svc:748
const unpaidTotal        = Σ toNum(r.unpaidAmount);                                                           // svc:749
const orderAdjustTotal   = Σ toNum(a.adjustAmount)   // ← 来自 order_adjustments 表                          // svc:750
const customerAdjustTotal= Σ toNum(a.adjustAmount);   // ← 来自 customer_adjustments 表                       // svc:751
```

### 3.3 六个对外字段的精确公式 [C]

```ts
const b = balance || { totalTopup:0, prepaidBalance:0, totalSpent:0,
                       customerName: client?.name || '', clientCode: customerId || '' };   // svc:752-758

data = {
  实收金额:     toNum(b.totalTopup),                              // svc:762  存量列
  客户余额:     Math.max(0, unpaidTotal - customerAdjustTotal),    // svc:763  纯计算，不落库
  客户名称:     b.customerName || '',                              // svc:764
  客户编号:     b.clientCode,                                      // svc:765  未做空值兜底
  客户调整合计: customerAdjustTotal,                               // svc:766
  已分配金额:   allocated,                                         // svc:767
  未分配余额:   toNum(b.prepaidBalance),                           // svc:768  存量列
  订单总额:     orderTotalAmount,                                  // svc:769
  订单调整合计: orderAdjustTotal,                                  // svc:770
}
```

四条必须记住的语义：

1. **`实收金额` ≠ 历史收款总额**。它读的是 `customer_balances.totalTopup`，而这个列**只在预付款路径被加分**（`svc:398`, `svc:409`；`executePrepaymentAllocation` 甚至不加，`svc:843-845` 只写 `prepaidBalance`/`totalSpent`）。订单收款（`addPayment` 的分配路径、`addOrderPayment`、`clearSelectedOrders`、终端收款）**一个字节都不写 `totalTopup`**。所以「从没充过预付款的客户，实收金额恒为 0」。[C]
2. **`客户余额` = 未收 − 客户调整**，与 `customer_balances.prepaidBalance` **毫无关系**。名字叫「余额」，实际是「这个客户还欠多少（经客户级调整后）」。取 `max(0, …)`，负值被夹到 0。
3. **`未分配余额` = `customer_balances.prepaidBalance`，没有 `max(0, …)`**（对比预览侧 `svc:796` 有 `Math.max(0, …)`）。因为 `addPayment` 的预付款差额可以是负数（`prepaidDelta = amount - allocatedTotal`，`svc:384`），这个列**可以是负的**。[C]
4. **`订单总额` 不是 `orders.totalAmount`**，而是「该客户名下所有 `finance_orders` 的 三个存量列之和 再求和」（`svc:747`）。**`订单调整合计` 却是流水表求和**（`svc:750`）。两者源不同，见 §10.2 的必然分叉。

### 3.4 无 `customerId` 时的行为 [C]

- `balance` = `databaseName` 下的**任意一条**（`findFirst` 无 `orderBy`，Postgres 通常是最小 id）→ `实收金额` / `未分配余额` / `客户名称` / `客户编号` 都会是**某个随机客户**的值。
- `customerAdjustments` 不再按 `clientCode` 过滤 → **全库客户调整**都算进「客户调整合计」和「客户余额」。
- `financeOrders` 是全库订单 → 其余金额是全库合计。
- 这个「半客户、半全库」的混合口径在没有 `customerId` 时必然自相矛盾。[C]（是否真有调用方这么调，见 [U-6]）

---

## 4. `getOrderDetail` — `svc:688-726`

```ts
const fo = await prisma.financeOrder.findFirst({ where: { databaseName: ds, orderNo: receiptNo } });
if (!fo) return { code:200, data:null, message:'ok' };                                  // svc:690

const payments = await prisma.payment.findMany({ where: { databaseName: ds, financeOrderId: fo.id } });  // svc:691  ← 只看 financeOrderId，无排序、无日期范围
const adjustments = await prisma.orderAdjustment.findMany({ where: { databaseName: ds, orderNo: receiptNo } });  // svc:692
```

输出（`svc:712-725`）：

```ts
{
  分配明细: payments.map(p => ({
      id: p.id, payment_id: p.id,
      分配金额: toNum(p.amount),
      备注: p.notes || '',
      收款方式: p.paymentMethod || '',
      收款日期: p.paymentDate ? p.paymentDate.toISOString().split('T')[0] : '',   // UTC 日期
  })),                                                                             // svc:694-701
  回执单号: receiptNo,                                                             // svc:716 回显入参，非 fo.orderNo
  客户: fo.customerName || '',
  已分配金额: toNum(fo.allocatedAmount),                                           // 存量列
  总价: toNum(fo.allocatedAmount) + toNum(fo.unpaidAmount) + toNum(fo.orderAdjustTotal),  // svc:719 不用 orderTotal()
  未收金额: toNum(fo.unpaidAmount),                                                // 存量列
  订单调整金额: toNum(fo.orderAdjustTotal),                                        // 存量列
  调整记录: adjustments.map(a => ({ id, 调整金额: toNum(a.adjustAmount), 调整类型: a.adjustType || '',
      备注: a.notes || '', 调整日期: createdAt 的 UTC 日期, 日期: 同上 })),
}
```

要点：

- **`分配明细` 只认 `payments.financeOrderId`**。`progress.service.ts:421-427` 创建的收款记录只填了 `orderId`，`financeOrderId` 为 null → **在订单详情里完全不可见**。[C]
- `调整记录` 无分页无排序（Prisma 默认物理序），日期列用的是 `createdAt`（`OrderAdjustment` 没有业务日期列，`schema.prisma:230-243`）。
- `总价` 的定义跟 `orders.totalAmount` 无关。

---

## 5. `getOrderSummary` — `svc:283-298`

```ts
const financeOrders = await prisma.financeOrder.findMany({ where: { databaseName: ds }, include: { order: true } });  // include 未被使用
for (const fo of financeOrders) {
  if (!fo.orderNo) continue;                                        // svc:290 无单号的订单被跳过
  result[fo.orderNo] = { 已分配金额: toNum(fo.allocatedAmount),      // svc:292
                         未收金额:   toNum(fo.unpaidAmount),         // svc:293
                         订单调整金额: toNum(fo.orderAdjustTotal) }; // svc:294
}
```

- **纯存量列直读**，零聚合、零计算、零舍入。
- 返回 `{ 单号: {...} }` 的字典（不是数组），单号是 key。
- `(databaseName, orderNo)` 有唯一约束（`schema.prisma:150`），不会重复覆盖。
- 这里叫 `订单调整金额`，客户余额页叫 `订单调整合计`（`svc:770`），同一个存量列两个名字。

## 5.1 `checkOrderPayment` — `svc:302-314`

```ts
findMany({ where: { databaseName: ds, orderNo: { in: orderNos } },
           include: { payments: { select: { id, amount, paymentDate, paymentMethod, notes } } } });
return fo => ({ orderNo, customerName,
   allocatedAmount: toNum(fo.allocatedAmount), unpaidAmount: toNum(fo.unpaidAmount),
   statusText: fo.statusText,                                    // svc:311 原样，不按 unpaidAmount 重算
   payments: [{ id, amount: toNum(p.amount), paymentDate, method: p.paymentMethod, notes: p.notes }] });
```

- `orderNos` 为空数组时直接返回 `[]`（`svc:303`）。
- `payments` 走 `financeOrderId` 关联（同 §4 的漏读问题）。
- **`statusText` 与 `unpaidAmount` 可能自相矛盾**：写侧有两套词表（`部分付款` vs `未付清`，见 §9.3）。读侧不做一致性校验。

## 5.2 `checkSystem` — `svc:318-321`

```ts
const count = await prisma.financeOrder.count({ where: { databaseName: ds } });
return { code:200, data:{ hasNewFinance: count > 0 } };
```

纯粹的「这个库有没有财务数据」探针，不涉及金额。

---

## 6. `getPaymentStats` — `svc:579-641`

### 6.1 取数 [C]

```ts
const client = customerId ? await findClient(ds, customerId) : null;
const canonicalCustomerCode = client?.clientCode || customerId || '';                       // svc:581

const payments = await prisma.payment.findMany({
  where: { databaseName: ds, ...(customerId ? { OR: [
      { financeOrder: { order: { clientId: client?.id ?? -1 } } },                          // svc:588
      { financeOrder: { customerName: client?.name || customerId } },                       // svc:589
    ] } : {}) },
  orderBy: { paymentDate: 'desc' }, take: 200,                                              // svc:594-595
  include: { financeOrder: { select: { customerName: true } } },
});

const fundFlows = customerId
  ? await prisma.customerFundFlow.findMany({ where: { databaseName: ds, clientCode: canonicalCustomerCode },
                                             orderBy: { paymentDate: 'desc' }, take: 200 })  // svc:598-604
  : [];                                                                                      // svc:604
const paymentRows = [...payments, ...fundFlows.map(fundFlowPaymentRow)];                      // svc:605
```

三条硬口径：

1. **带 `customerId` 时，`OR` 的两个分支都走 `financeOrder` 关系**，所以 `financeOrderId === null` 的收款记录（预付款那一笔，`svc:388-390`；终端收款那一笔，`progress.service.ts:421`）**被整体排除**。预付款之所以还能出现在统计里，是因为它同时写了一条资金流水（`svc:414-427`）。终端收款那笔（只有 `orderId`）在**带客户和不带客户两种模式下都丢失**——不带客户时它在 200 条里占位，但没有任何标识能归属到客户。
2. **`take: 200` 是硬截断**，而且按月/按年聚合是**在这个截断后的集合上算的**（`svc:610-624`）。`orderBy: { paymentDate: 'desc' }` + PostgreSQL 默认 `DESC = NULLS FIRST`（`schema.prisma:5-7` 确认是 postgresql）→ **`paymentDate` 为 null 的记录排在最前面**，会优先吃掉 200 个名额，然后被 `if (!p.paymentDate) continue`（`svc:611`）跳过。所以：**`monthly` / `yearly` 不是全量历史，是「最近 200 条（含 null 日期占位）」的聚合。** [C]
3. 不带 `customerId` 时 `fundFlows = []`，且 `payments` 不带 OR → 全库前 200 条。**两条路径的取数集合完全不同**，同一客户在两个模式下的数不一定对得上。

### 6.2 聚合 [C]

```ts
for (const p of paymentRows) {
  if (!p.paymentDate) continue;
  const ym = `${p.paymentDate.getFullYear()}-${String(p.paymentDate.getMonth()+1).padStart(2,'0')}`;  // 本地时区
  const y  = String(p.paymentDate.getFullYear());                                                     // 本地时区
  const amt = toNum(p.amount);
  if (amt >= 0) { monthMap[ym].收款 += amt; yearMap[y].收款 += amt; }
  else          { monthMap[ym].红冲 += Math.abs(amt); yearMap[y].红冲 += Math.abs(amt); }             // svc:617-623
}
```

- **正负号即分类**：`amt >= 0` 一律计入「收款」（含 `amt === 0`），`amt < 0` 一律计入「红冲」并取绝对值。
- 月份/年份用 `getFullYear/getMonth`（**本地时区**）；同一批数据的 `payments[].日期` 用 `toISOString()`（**UTC**，`svc:628`）。东八区下，本地 9 月 1 日凌晨的收款会落进 `2026-09` 月桶、却在列表里显示 `2026-08-31`。**同一响应内两个日期口径不一致。** [C]
- 没有去重：如果一条资金流水恰好也有一条 `financeOrderId` 非空的 payment 命中同一集合，会被计两次。**当前代码下不会发生**（预付款那笔 payment 的 `financeOrderId` 恒为 null，被 OR 排除），依据 `svc:388-390` + `svc:588-589`。[C]
- `executePrepaymentAllocation` 只写资金流水（`amount: -totalAllocated`，`flowType: '预付款分配'`，`svc:847-859`），不写 payment。它会被当成**红冲**计入。

### 6.3 输出 [C]

```ts
payments: paymentRows.map(p => ({ 方式: p.paymentMethod || '',
                                  日期: p.paymentDate ? p.paymentDate.toISOString().split('T')[0] : '',
                                  金额: toNum(p.amount) }));     // svc:626-630
monthly: 按 月份 localeCompare 升序；yearly: 按 年份 升序。     // svc:635-637
```

无总计字段；`payments` 列表最坏情况 200（payment）+ 200（流水）= 400 行，其中 payment 行的 `金额` 可为负。

---

## 7. `getCustomerStatement` — `svc:645-684`

### 7.1 入参 [C]

`_days`（形参名带下划线，`svc:645`）**全程未被使用** —— 这个接口**没有任何日期范围过滤**。REST 侧 `finance.routes.ts` 仍会传 `days`，旧兼容层传 `p.param4`（`legacy-dispatch.ts:872-878`），**全部被丢弃**。`getCustomerBalance` 的 `_days`（`svc:730`）同理。

### 7.2 取数 [C]

```ts
financeOrderWhere.OR = [ ...(client ? [{ order: { clientId: client.id } }] : []),
                         { customerName: client?.name || customerId } ];              // svc:653-656
paymentWhere.OR      = [ ...(client ? [{ financeOrder: { order: { clientId: client.id } } }] : []),
                         { financeOrder: { customerName: client?.name || customerId } } ];  // svc:657-660
adjustmentWhere.clientCode = canonicalCustomerCode;                                   // svc:661  ← 只按编号，无名字兜底
orderAdjustmentWhere.orderNo = { in: (该客户的 financeOrder 单号列表) };               // svc:662-667
```

与 `getCustomerBalance` 的口径差异（同一个「客户」，三个接口三种选法）：

| | 订单集选法 |
|---|---|
| `financeOrdersForCustomer`（余额页用） | `order.clientId` 优先，**空集才**回退按 `customerName = 客户名` |
| `getCustomerStatement` 订单集 | `order.clientId` **OR** `customerName = 客户名`（并集，不要求主查询为空） |
| `getCustomerStatement` 收款集 | `financeOrder.order.clientId` **OR** `financeOrder.customerName = 客户名` |

`customer_adjustments` 只有 `clientCode` 一个匹配键（`svc:661`），`clientCode` 为 null 的行（`schema.prisma:220` 可空）**在单客户模式下永远读不到**，在全库模式下又全都被算进去。

### 7.3 输出（**不是 `{code,data}` 包装**）[C]

```ts
return { orders: financeOrders,                                        // svc:683  原始 Prisma 行（含 order，Decimal 序列化成字符串）
         payments: [...payments, ...fundFlows.map(fundFlowPaymentRow)],
         adjustments: [...adjustments, ...orderAdjustments] };         // svc:683  ← 两张结构不同的表混在一个数组
```

- `orders` 是原始行，**没有做任何字段改名**（与其它接口的中文字段风格不同）。
- `payments` 数组里**两种行结构**：真 payment 有 `financeOrderId/orderId/databaseName`，资金流水行是 `{id:'fund-N', amount, paymentDate, paymentMethod, notes, financeOrderId:null, orderId:null, financeOrder:null}`（`svc:269-278`）。
- `adjustments` 数组里**两种行结构**：客户调整有 `clientCode/customerName`，订单调整有 `orderNo/orderNumber`（`schema.prisma:215-243`）。**没有类型字段**，消费方只能靠字段名猜。
- 唯一消费方 `projectCustomerStatement`（`legacy-dispatch.ts:518-613`）正是这么做的：订单行 `类型: '订单'`、金额取 `orders.totalAmount ?? customerInfo['总价'] ?? financeOrder.allocatedAmount`（`legacy-dispatch.ts:580-581`）；收款行 `类型: '收款'`、金额 `payment.amount`（`:584-595`）；调整行 `类型: adjustType ?? '调整'`（`:596-611`）。资金流水行因为 `financeOrderId: null`，`foMap.get(null)` 命不中 → `单据号` 为空串、`安装地址` 为空。[C]

---

## 8. 数据模型：谁是真相、谁是存量

（`schema.prisma` 行号见括号）

### 8.1 `FinanceOrder`（`:133-154`）—— 订单财务的**存量视图**

| 列 | 语义 | 谁维护 |
|---|---|---|
| `allocatedAmount` | 该单已分配/已收金额 | 写侧散落在 5 处：`svc:350-353`、`svc:374-377`、`svc:828-831`、`svc:879-882`、`svc:122-135`（addOrderPayment）；另 `order.service.ts:561-578`（合并单 upsert）、`order.service.ts:704-711`、`order.service.ts:812-820`（改明细行）、`client.service.ts:532-` （客户端导入 upsert）、`progress.service.ts:397-405`（终端收款，用 `Math.max(旧值, 新值)`） |
| `unpaidAmount` | 该单未收金额 | 同上各处，写侧一律 `Math.max(0, …)` 夹底 |
| `orderAdjustTotal` | 该单调整累计 | **只有** `svc:236-243`（`addOrderAdjustment`）会加；建单时初始化为 0（`order.service.ts:570`、`client.service.ts:541`）。`progress.service.ts:409-418` 建行时不带此列（取默认 0） |
| `statusText` | 结清状态字符串 | 词表不统一，见 §9.3 |
| `monthTag` | 建单月份 | 建单时写 |
| `orderId` | 指向 `orders` | 可能为 null（历史数据 / 终端收款路径），**null 会让客户维度读不到这一单**（§2.12） |

**没有流水可以推导出这三个数**：`payments` 表里存在 `financeOrderId` 为 null 的记录（`progress.service.ts:421`），所以 `Σpayments.amount` 与 `allocatedAmount` **不保证相等**。要定死口径只能承认：**这三个存量列就是真相**。[C]

### 8.2 `Payment`（`:156-173`）—— 收款流水

- 一条 payment = 一次分配动作。`amount` 有符号（负数 = 冲回，见 §10.1）。
- `financeOrderId` 可空（`:162`）：**预付款那一笔**（`svc:388-390`，只有 `databaseName`）、**终端收款那一笔**（`progress.service.ts:421`，只有 `orderId`）都是 null。
- 读侧三个消费点全部走 `financeOrderId`：`getOrderDetail:691`、`checkOrderPayment:306`、`getPaymentStats:588-589`。→ 上述两类记录在这三处**不可见**（在 `getPaymentStats` 全库模式下可见但无客户归属）。
- `paymentDate` 可空（`:164`），且 `getPaymentStats` 用 `DESC` 排序时 null 排最前（§6.1）。

### 8.3 `CustomerBalance`（`:197-213`）—— 预付款存量，**与订单收款无关**

| 列 | 语义 | 谁维护 |
|---|---|---|
| `prepaidBalance` | 未分配的预付款余额 | `svc:397`/`svc:408`（`addPayment` 预付款差额，**可为负**）、`svc:843`（预付款分配后扣减，`Math.max(0,…)`）。`ensureCustomerBalance` 不碰它 |
| `totalTopup` | 累计充值 | **只在 `addPayment` 预付款差额为正时加**（`svc:398`, `svc:409`）。`executePrepaymentAllocation` 不加 |
| `totalSpent` | 累计消费 | `svc:844`（预付款分配时加 `totalAllocated`）；建行时 0。**没有任何读接口返回它** [C] |

- ⚠️ `addToCustomerBalance`（`svc:248-259`）**定义了但全项目零调用点**（grep 确认）→ 死代码，不要拿它当口径依据。[C]
- `ensureCustomerBalance`（`svc:104-107`）在已存在的行上只更新 `clientId`/`customerName`，**不会把一个旧编号的行迁移到规范编号下**。所以历史上以数字别名建的余额行会一直挂在别名 `clientCode` 下。[C]

### 8.4 `CustomerFundFlow`（`:175-195`）—— 预付款的资金流水

三条写入路径，符号即类型：

| `flowType` | `amount` | 位置 |
|---|---|---|
| `'预付款'` | 正（`prepaidDelta >= 0`） | `svc:414-427`（`flowType: prepaidDelta >= 0 ? '预付款' : '预付款冲销'`，`svc:422`） |
| `'预付款冲销'` | 负 | 同上 |
| `'预付款分配'` | 负（`-totalAllocated`） | `svc:847-859` |

注意 `paymentId` 只在第一种情况下有值（`svc:420`）。读侧把它伪装成 payment 行时 `notes` 会回退到 `flowType`（`svc:274`）。

### 8.5 `CustomerAdjustment`（`:215-228`）—— 客户级调整流水

- 唯一写入点 `svc:459-473`（`addCustomerAdjustment`），**只插一行，不改任何存量列**。`adjustAmount` 符号由调用方决定，服务端不归一化（`svc:467`）。
- 只在 `getCustomerBalance`（按 `clientCode = 规范编号` 求和）和 `getCustomerStatement`（同）被读。
- 读侧口径：**`客户余额 = max(0, 未收 − 客户调整合计)`** → **正数表示「减少客户欠款」**（客户视角的贷方）。[C]（UI 实际发正还是发负见 [U-3]）

### 8.6 `OrderAdjustment`（`:230-243`）—— 订单级调整流水

- 写入点两处：`svc:572`（`addOrderAdjustment`，随后同步存量列 `svc:236-243`）、`svc:837-839`（`executePrepaymentAllocation`，`adjustType: '预付款优惠'`，**不**同步存量列）。
- 读侧口径：正数 = 减免（`applyOrderAdjustmentToFinance` 里 `nextUnpaid = max(0, unpaid - amount)`，`svc:235`）。
- 没有业务日期列，读侧只能拿 `createdAt` 当日期（`svc:708-709`）。

---

## 9. 舍入

1. **全模块只有一处显式舍入**：`svc:206` [C]
   ```ts
   const discount = discountRate > 0 ? Math.min(unpaid - alloc, Math.round(alloc * discountRate * 100) / 100) : 0;
   ```
   舍的是**优惠额**（四舍五入到分），而且是个**上限**：不得超过 `未收 − 本次分配`。全额付清（`alloc === unpaid`）时上限为 0 → **优惠只能在「部分付款」时产生**。
2. `toNum` 不做任何舍入（`svc:5-8`），所有求和都是 IEEE754 浮点直接相加。
3. 落库侧有 Postgres `numeric(12,2)` 兜底量化（`schema.prisma:141-143`, `:163`, `:184`, `:205-207`, `:222`, `:237`），**读侧不再量化**。所以 `已分配金额`/`未收金额`/`订单总额` 这类求和结果理论上可能出现 `x.xx000000000000001` 形态的尾数。
4. `buildAllocationPreview` 里 `alloc = Math.min(remaining, unpaid)`（`svc:205`）**不舍入**，`remaining` 的浮点残差会一路传到 `剩余金额`/`资金池剩余`（`svc:223-227`）。
5. 阈值判断有一处用了 0.005：`if (Math.abs(prepaidDelta) > 0.005)`（`svc:385`）—— 小于半分钱的差额被静默丢弃，不写预付款流水。

---

## 10. 正负号约定

### 10.1 收款 / 红冲 [C]

| 场景 | `Payment.amount` | 存量列变化 | 位置 |
|---|---|---|---|
| 收款（单据路径，无分配列表） | `+amount` | `allocated += amount`；`unpaid = max(0, unpaid − amount − discount)` | `svc:342-353` |
| 收款（分配列表路径，逐行） | `+alloc` | `allocated += alloc`；`unpaid = max(0, unpaid − alloc − discount)` | `svc:367-377` |
| 红冲（`amount < 0` 的单据路径） | `−amount`（负） | `allocated += amount`（减少）；`unpaid = unpaid + |amount|`（**回涨**） | `svc:347-349` |
| 红冲（预览里按已分配倒冲，逐行） | `分配金额: -refund` | `unpaid = max(0, unpaid + refund)` | `svc:187-195`、`svc:373` |
| 预付款差额 | `+prepaidDelta`（可负） | 不碰订单列，改 `customer_balances.prepaidBalance` | `svc:384-428` |
| 预付款分配 | **不写 payment** | 只减 `prepaidBalance`，写负的资金流水 | `svc:842-860` |
| 批量清账 | `+unpaid`（正） | `allocated += unpaid`，`unpaid = 0` | `svc:876-882` |
| 终端收款调整 | **`Math.abs(delta)` 恒正** | 覆盖式写 `allocated = max(旧, 新)` | `progress.service.ts:404-427` |

两个必须记住的坑：

- **红冲的 `unpaid` 增量与 `allocated` 减量不对称**：单据路径下 `unpaid` 按 `|amount|` 回涨，`allocated` 按 `amount` 减少 —— 若原单带过优惠（`discount > 0`），一次「收款 + 红冲」往返**不会回到原值**，差额恰好是当初的优惠额。[C]
- **终端收款调整把向下修正记成正数收款**（`Math.abs(delta)`，`progress.service.ts:424`），所以「收款额从 5000 改成 3000」在 `payments` 里留下一条 `+2000` 的收款，会让 `getPaymentStats` 的「收款」虚增。[C]

### 10.2 优惠 / 调整 [C]

| 字段 | 正数含义 | 依据 |
|---|---|---|
| `OrderAdjustment.adjustAmount` | 减免（应缴减少）：`unpaid = max(0, unpaid − amount)` | `svc:235` |
| `CustomerAdjustment.adjustAmount` | 减免（客户余额减少）：`客户余额 = max(0, unpaid − Σadjust)` | `svc:763` |
| `previewAllocation.合计优惠金额` / 行内 `优惠金额` | 恒 ≥ 0 的额度，直接从 `unpaid` 里扣 | `svc:206`, `svc:214`, `svc:371-373` |
| `buildAllocationPreview` 行内 `分配金额` | 收款为正、红冲为负 | `svc:192` vs `svc:212` |

**「抹零」这个概念在本模块不存在**：全项目 grep `抹零` 零命中（finance / order 全模块）。最接近的是「批量清账」（`clearSelectedOrders`，`svc:867-887`），但它是把 `unpaid` 全额记为收款、不做任何减免。[C]

### 10.3 ⚠️ 由符号约定推出的必然分叉 [C]

`订单总额`（`svc:747`，用存量列 `orderAdjustTotal`）与 `订单调整合计`（`svc:750`，用 `order_adjustments` 流水表）**在代码上就可能不相等**，两条路径会让流水表多出存量列没记的调整：

1. `executePrepaymentAllocation` 写 `OrderAdjustment('预付款优惠')`（`svc:837-839`）但**不**更新 `fo.orderAdjustTotal`（`svc:828-831` 只写 `allocatedAmount`/`unpaidAmount`/`statusText`）。
2. `addPayment` 的逐行优惠（`svc:371`）直接扣 `unpaid`，**既不写 `OrderAdjustment` 也不动 `orderAdjustTotal`**。

因此在这两种操作之后：

```
订单总额 ≠ 已分配金额 + 未收金额 + 订单调整合计
```

（第 2 种情况下差值方向相反：`订单总额` 因为 `unpaid` 被扣而变小，而 `订单调整合计` 完全不动。）

新系统若要「自洽」，必须二选一：要么统一用存量列 `orderAdjustTotal`，要么统一用流水表 —— **照抄旧代码会照抄这个不自洽**。

---

## 11. 边界与兜底

### 11.1 `null` / `undefined` / 空串 / 0

| 输入 | 处理 | 位置 |
|---|---|---|
| 任何金额列为 `null` | `toNum` → `0` | `svc:5-8` |
| `orderNo` 为 `null` 的 `FinanceOrder` | `getOrderSummary` **跳过**；`getCustomerBalance` 的 `orderNos` **`filter(Boolean)` 过滤掉**（→ 该单的 `OrderAdjustment` 也不会被算进「订单调整合计」） | `svc:290`, `svc:743` |
| `orderAdjustments` 查询命中空单号集 | 直接不查，得 `[]` | `svc:744-746` |
| `payments.paymentDate` 为 `null` | 统计里跳过；列表里 `日期: ''`；但**占 `take: 200` 名额且排最前** | `svc:611`, `svc:628` |
| `orders.totalAmount` 为 `0` | `orderTotal()` 认为「没有」→ 回退到存量列求和（`||` 的 0 陷阱） | `svc:59` |
| `body['客户编号'] = ''` | `??` 不跳过空串 → 不再看 `customerCode`/`clientCode` 别名 | `svc:63` |
| `customerBalance` 行不存在 | `getCustomerBalance` 用 0 值兜底对象；`getPaymentStats`/`getCustomerStatement` 直接用 null/空数组 | `svc:752-758` |

### 11.2 兜底链（有的话）

1. **客户订单集**：`orders.clientId` 关联 → 若**一条都没有**且客户档案有名字 → 按 `finance_orders.customerName = 客户名` 再查一次（`svc:157-166`，见 §2.12 的漏读风险）。
2. **客户编号**：`findClient` 先按 `clientCode`，纯数字时并带主键 `id`（`svc:69-77`）；`resolveCustomerIdentity` 把命中结果归一化成档案里的 `clientCode`（`svc:86`）。
3. **总价**：`orderTotal()` 先 `orders.totalAmount`，为 0/空回退存量列求和（`svc:59`）—— 仅分配预览用。
4. **资金流水备注**：`notes || flowType`（`svc:274`）。

### 11.3 明确**没有**的兜底

- `findClient` 失败后，`getCustomerBalance` **直接返回 `data: null`**（`svc:732`），不会按名字再试。
- `getCustomerStatement` 的 `customerAdjustments` **只按 `clientCode` 匹配**，没有名字兜底（`svc:661`）。
- `checkOrderPayment` / `getOrderDetail` 的 `payments` **只按 `financeOrderId` 关联**，没有按 `orderId` 或 `orderNo` 的兜底（`svc:306`, `svc:691`）。
- `_days` 参数被完全忽略，**没有时间范围兜底**（`svc:645`, `svc:730`）。

---

## 12. 写侧顺带发现（影响读数的，注明出处）

1. `finance.routes.ts` 的 `POST /preview-prepayment-allocation` 调的是 `previewAllocation`（**不是** `previewPrepaymentAllocation`），REST 路径下的「预付款分配预览」返回的是**普通收款分配预览**（不带 `availableBalance`、不做 `min(请求额, 预付款余额)` 夹取）。旧兼容层 `legacy-dispatch.ts:898-901` 调的才是 `previewPrepaymentAllocation`。[C]
2. `CustomerBalance.totalSpent` 全项目**只写不读**（写：`svc:410`, `svc:844`；读：无）。`legacy-dispatch.ts:1248` 虽然把 `totalSpent` 映射成「累计消费」，但没有任何 finance 接口会返回这个字段。[C]
3. `addToCustomerBalance`（`svc:248-259`）零调用点。[C]

---

## 13. UNCERTAIN（卡在哪）

- **[U-1] `statusText` 的权威词表**：写侧有两套 —— finance 模块写 `'部分付款'`（`svc:52-55`, 写出点 `svc:130/241/352/376/830`），order/client 模块写 `'未付清'`（`order.service.ts:572/579/708/816`、`client.service.ts:543/550`）。读侧 `checkOrderPayment:311` 原样透出。**卡在**：无法从服务端判断旧前端认哪个词（`'部分付款'` 还是 `'未付清'`）作为「未结清」的判据 —— 需要旧客户端源码或真实数据分布，两者本地都没有（`/Users/aaa/Downloads` 下只有 server，无前端）。是「两种状态」还是「同一个状态两种写法」，我读不出来。
- **[U-2] 双重计数是否真实存在**：逻辑上我确认当前代码**不会**重复计（§6.1 第 1 点，依据 `svc:388-390` 与 `svc:588-589`）。但由于历史数据里可能存在 `financeOrderId` 非空、同时又有资金流水的支付行（例如 `order.service.ts:584-590` 的合并单重挂），**存量数据是否会双计，只能查库确认**。我没有连库权限，也没读 `.env`。
- **[U-3] `CustomerAdjustment.adjustAmount` 的 UI 符号习惯**：服务端只把它当成「减少客户欠款」（`svc:763`）且不归一化符号（`svc:467`）。**卡在**：旧前端提交「客户优惠」时发的是正数还是负数，服务端无从判断；若前端发负数，则「客户余额」会**变大**。需前端源码或样本数据。
- **[U-4] `getPaymentStats` 月份桶的时区**：`getFullYear/getMonth`（本地，`svc:612-613`）与 `toISOString()`（UTC，`svc:628`）并存。**卡在**：服务器进程的 `TZ` 是多少，我读不到（不读 `.env`，也没读部署脚本/容器配置）。`TZ=UTC` 时两者一致；`TZ=Asia/Shanghai` 时月初/月末的收款会出现「列表日期与月份桶差一天」。
- **[U-5] `orders.totalAmount` 与三存量列之和是否恒等**：`getOrderDetail:719` 与 `getCustomerBalance:747` 用的是后者。两条路径在 `client.service.ts:478-480` 的建单口径（`totalAmount` 与 `paidAmount`/`unpaidAmount` 各自独立取值）下未必相等。**卡在**：需要真实数据比对，静态读码无法判定「历史上是否已经不等」。
- **[U-6] 无 `customerId` 调用 `getCustomerBalance` 是否是真实用例**：代码路径存在（`svc:736`, `svc:739`），行为自相矛盾（§3.4）。**卡在**：旧前端是否真的不带 `customerId` 调这个接口 —— 无前端源码。
- **[U-7] `financeOrdersForCustomer` 的「空集才回退」是否有意为之**（`svc:157`）：可能是有意的（避免名字撞车重复计数），也可能是漏读 bug。**卡在**：只有原作者的注释/提交历史能判断，服务端无注释。

---

## 14. 复现命令

```bash
# 关键行号抽查
sed -n '730,774p' /Users/aaa/Downloads/server/src/modules/finance/finance.service.ts   # getCustomerBalance
sed -n '283,321p' /Users/aaa/Downloads/server/src/modules/finance/finance.service.ts   # summary / check*
sed -n '579,684p' /Users/aaa/Downloads/server/src/modules/finance/finance.service.ts   # stats / statement
sed -n '133,243p' /Users/aaa/Downloads/server/prisma/schema.prisma                      # 财务五表

# 「抹零」不存在
grep -rn '抹零' /Users/aaa/Downloads/server/src
# statusText 两套词表
grep -rn "'部分付款'\|'未付清'" /Users/aaa/Downloads/server/src
# 总价/调整的源分叉
grep -rn 'orderAdjustTotal' /Users/aaa/Downloads/server/src
```
