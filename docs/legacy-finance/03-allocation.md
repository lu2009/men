# 旧系统资金分配 / 预付款 / 清账 —— 逆向取证

> 取证对象：`/Users/aaa/Downloads/server`（旧系统后端，Node + Express + Prisma + PostgreSQL）
> 取证日期：2026-09-18
> 本文所有结论均带 `文件:行号` 出处。**CONFIRMED** = 直接读到的代码事实；**UNCERTAIN** = 需要进一步验证（见 §11）。

## 0. 文件别名

| 别名 | 绝对路径 |
|---|---|
| `svc:` | `/Users/aaa/Downloads/server/src/modules/finance/finance.service.ts` |
| `repo:` | `/Users/aaa/Downloads/server/src/modules/finance/finance.repository.ts` |
| `routes:` | `/Users/aaa/Downloads/server/src/modules/finance/finance.routes.ts` |
| `disp:` | `/Users/aaa/Downloads/server/src/modules/legacy-dispatch.ts` |
| `schema:` | `/Users/aaa/Downloads/server/prisma/schema.prisma` |

除特别说明外，行号均指上表文件。

## 1. 两个入口：REST 与 legacy dispatch（先搞清走哪条）

旧系统前端**不是**走 REST，而是走单点分发入口：

- `app.all('/1', ...)` → `legacyDispatch(req, res)`（`app.ts:43-60`）
- legacy 请求用 query/body 的 `param1` 选 action（`disp:1104-1114`），`param2` 或 body 的 `ds` 是数据库名（`disp:1144`），业务参数整个放在 **body** 里（`disp:1154`）。
- 本文涉及 4 个 action 与 service 函数的对应（`disp:894-909`）：

| `param1` | ACTION_MAP 归一化（`disp:196-204`） | 调用的 service 函数 |
|---|---|---|
| `finance_previewAllocation` | `finance_previewallocation` | `previewAllocation`（`disp:896`） |
| `finance_previewPrepaymentAllocation` | `finance_previewprepaymentallocation` | `previewPrepaymentAllocation`（`disp:900`） |
| `finance_executePrepaymentAllocation` | `finance_executeprepaymentallocation` | `executePrepaymentAllocation`（`disp:904`） |
| `clearSelectedOrders` | `clearselectedorders` | `clearSelectedOrders`（`disp:908`） |

REST 侧另有 5 个路由挂在 `/api/v1/finance`（`app.ts:90`），其中 4 个与本文相关（`routes:168-229`）。

⚠️ **CONFIRMED — REST 路由与 legacy 分发行为不一致（bug）**：`routes:184-197` 的 `POST /preview-prepayment-allocation` 注释写的是预览预付款分配，但函数体调用的是 **`previewAllocation`**（`routes:192`），不是 `previewPrepaymentAllocation`。走 legacy dispatch 的旧前端不受影响（`disp:900` 调的是对的），**只有 REST 调用方会拿到错的语义**（不会按预付款余额封顶）。

**结论**：`previewPrepaymentAllocation` 并非死代码，它只对 legacy 入口生效。

## 2. 涉及的数据表

| 表 | Prisma model | 关键字段 | 出处 |
|---|---|---|---|
| `finance_orders` | `FinanceOrder` | `orderNo`(唯一, 随 ds)、`orderId`、`customerName`、`allocatedAmount`、`unpaidAmount`、`orderAdjustTotal`、`statusText` | `schema:133-154` |
| `orders` | `Order` | `paidAmount`、`unpaidAmount`、`totalAmount`、`orderDate`、`clientId` | `schema:64-96` |
| `payments` | `Payment` | `financeOrderId`、`orderId`、`amount`、`paymentDate`、`paymentMethod`、`notes` | `schema:156-173` |
| `customer_balances` | `CustomerBalance` | `prepaidBalance`、`totalTopup`、`totalSpent`，唯一键 `(databaseName, clientCode)` | `schema:197-213` |
| `customer_fund_flows` | `CustomerFundFlow` | `clientCode`、`amount`、`flowType`、`paymentId` | `schema:175-195` |
| `order_adjustments` | `OrderAdjustment` | `orderNo`、`adjustAmount`、`adjustType` | `schema:230-243` |

所有金额列是 `Decimal(12,2)`（`schema:141-143` 等），但**服务层全程用 JS `number` 运算**（`toNum`，`svc:5-8`），没有 decimal 库。`toNum` 对 `undefined`/非数字返回 `0`（`svc:5-8`）。

状态文案只有两态（`svc:52-55`）：

```
statusText(unpaid) = unpaid <= 0 ? '已结清' : '部分付款'
```

## 3. 候选订单集合：来源与排序（决定贪心顺序）

分配算法的输入由 `unpaidOrdersForCustomer` 提供（`svc:169-172`）：

```
unpaidOrdersForCustomer(ds, customerCode):
  client = findClient(ds, customerCode)          // svc:66-80
  return financeOrdersForCustomer(ds, customerCode, client, { unpaidAmount: { gt: 0 } })
```

`financeOrdersForCustomer`（`svc:142-167`）的两段查询：

```pseudo
function financeOrdersForCustomer(ds, customerCode, client, extraWhere = {}):
  baseWhere = { databaseName: ds, ...extraWhere }

  # ── 第一段（主查询，svc:149-156）
  primary = financeOrder.findMany({
      where: { ...baseWhere,
               ...(client ? { order: { clientId: client.id } }      # A 支路
                         : { customerName: customerCode }) },       # B 支路
      include: { order: true },
      orderBy: [ { order: { orderDate: 'asc' } },                    # ① 订单日期升序
                 { createdAt:  'asc' } ]                             # ② 再按本行创建时间升序
  })
  if (primary.length > 0 || !client?.name) return primary            # svc:157

  # ── 第二段（回退查询，仅当主查询空 且 client.name 非空，svc:159-166）
  return financeOrder.findMany({
      where: { ...baseWhere, customerName: client.name },
      include: { order: true },
      orderBy: [ { order: { orderDate: 'asc' } }, { createdAt: 'asc' } ]   # 完全相同的排序
  })
```

要点（全部 CONFIRMED）：

1. **排序比较器 = `orderDate` 升序，然后 `financeOrder.createdAt` 升序**（`svc:155`、`svc:165`）。**不是**按单号、**不是**按金额。最早日期的欠款单先被填。
2. `orderDate` 是关联表 `orders.order_date`（`schema:73`），可以为 `null`；排序时走的是数据库的 NULL 排序规则，代码里没有显式 `nulls first/last`。见 §11 UNCERTAIN-1。
3. **过滤条件是 `financeOrder.unpaidAmount > 0`**（`svc:171`），过滤作用在 `finance_orders` 上，不是 `orders` 上。
4. 找客户的匹配是 `clientCode` 精确匹配 **或** `id` 等于该纯数字串（`svc:66-80`，`findClient`），多命中时取 `id` 最小的（`orderBy: { id: 'asc' }`，`svc:78`）。
5. **当 client 被找到时，主查询完全按 `order.clientId` 过滤**（`svc:152`）——`finance_orders.orderId` 为 `null` 的行（关联订单被删或从没关联过）**永远不会进入分配候选**，即使它的 `customerName` 与该客户一致。
6. 回退查询只在「主查询空 + client 有 name」时触发（`svc:157`），按 `customerName = client.name` 匹配。这意味着**同一个客户可能因为这两条支路拿到不同的订单集合**，取决于主查询是否恰好为空。
7. `include: { order: true }`（`svc:154`）是行里 `日期` / `总价` 能算出来的前提。

## 4. `buildAllocationPreview` —— 算法核心（`svc:174-229`）

签名：`buildAllocationPreview(orders, amount, discountRate = 0)`。`orders` 就是 §3 排好序的数组，函数**内部不再排序**。

### 4.1 逐行伪码

```pseudo
function buildAllocationPreview(orders, amount, discountRate = 0):      # svc:174
  isRefund  = (amount < 0)                                              # svc:175
  remaining = amount                                                    # svc:176
  totalDiscount = 0                                                     # svc:177
  rows = []                                                             # svc:178

  # ═══════════ 分支 A：红冲 / 退款（amount < 0）  svc:179-198 ═══════════
  if isRefund:
    toRefund = abs(amount)                                              # svc:181
    for fo in orders:                        # 顺序 = §3 的 orderDate asc
      if toRefund <= 0: break                                           # svc:183
      allocated = toNum(fo.allocatedAmount)                             # svc:184
      if allocated <= 0: continue        # ← 按「已分配」筛，不是按「未收」  # svc:185
      refund = min(toRefund, allocated)                                 # svc:186
      rows.push({ '回执单号': fo.orderNo || '',
                  '日期': dateText(fo.order?.orderDate),
                  '总价': orderTotal(fo),
                  '已分配金额': allocated,          # ← 注意：字段名与 A 分支不同
                  '分配金额': -refund,              # ← 负数
                  '优惠金额': 0,                    # ← 红冲不产生优惠
                  '分配后余额': allocated - refund })                # svc:187-195
      toRefund -= refund                                                # svc:196
    remaining = -toRefund          # 负值 = 没能退掉的剩余                    # svc:198

  # ═══════════ 分支 B：正常分配（amount >= 0）  svc:200-218 ═══════════
  else:
    for fo in orders:                        # 顺序 = §3 的 orderDate asc
      if remaining <= 0: break                                          # svc:202
      unpaid = toNum(fo.unpaidAmount)                                   # svc:203
      if unpaid <= 0: continue                                          # svc:204
      alloc = min(remaining, unpaid)       # ← 贪心：能吃多少吃多少         # svc:205
      discount = discountRate > 0
                   ? min( unpaid - alloc,                                    # ★ 上限
                          round(alloc * discountRate * 100) / 100 )          # ★ 二位小数
                   : 0                                                  # svc:206
      rows.push({ '回执单号': fo.orderNo || '',
                  '日期': dateText(fo.order?.orderDate),
                  '总价': orderTotal(fo),
                  '未收金额': unpaid,          # ← B 分支独有字段
                  '分配金额': alloc,             # ← 正数
                  '优惠金额': discount,
                  '分配后余额': max(0, unpaid - alloc - discount) })   # svc:207-215
      remaining -= alloc                 # ★ 只减 alloc，不减 discount       # svc:216
      totalDiscount += discount                                         # svc:217

  return {                                                              # svc:220-228
    '分配列表': rows, allocations: rows,          # 同一数组两个键
    '剩余金额': remaining, unallocated: remaining,
    '合计分配金额': amount - remaining,
    '合计优惠金额': totalDiscount,
    '资金池剩余': remaining,
  }
```

### 4.2 逐条语义（CONFIRMED）

| 问题 | 答案 | 出处 |
|---|---|---|
| 按什么顺序挑订单 | `orderDate` 升序 → `createdAt` 升序；**不按金额、不按单号** | `svc:155`、`svc:165` |
| 每单分配多少 | `min(本次剩余金额, 该单未收金额)`，即能填满就填满 | `svc:205` |
| 「未收」怎么算 | 直接读 `finance_orders.unpaidAmount`，**不是** `总价 - 已分配` | `svc:203` |
| 什么时候停 | `remaining <= 0`（钱分完），或订单列表走完 | `svc:202` |
| 跳过哪些单 | `unpaidAmount <= 0` 的单（分支 B）；`allocatedAmount <= 0` 的单（分支 A） | `svc:204`、`svc:185` |
| 剩余金额 | `amount - Σ分配金额`。分支 B 下 ≥ 0；分支 A 下 ≤ 0 | `svc:216`、`svc:198` |
| 是否内部排序 | **否**，完全依赖入参顺序 | `svc:174-229` 无 sort |
| 是否落库 | **否**，纯函数，只读入参 | 同上 |

### 4.3 关键陷阱：**优惠只可能落在「最后一单被部分覆盖」的那一单上**

`discount = min(unpaid - alloc, round(alloc*rate*100)/100)`（`svc:206`）。因为 `alloc = min(remaining, unpaid)`（`svc:205`）：

- 若 `remaining >= unpaid` → `alloc = unpaid` → `unpaid - alloc = 0` → **`discount = 0`**（⚠️ 完全付清的单拿不到优惠）
- 若 `remaining < unpaid` → `alloc = remaining` → 上限为还差的那部分，且因为 `remaining <= 0` 后循环 break（`svc:202`），该单必然是**最后一单**

**推论**：整个分配过程中，**最多只有一行**的 `优惠金额 > 0`，就是最后一单。前面所有被完全付清的单优惠恒为 0。

数值示例（rate = 0.05）：

| 场景 | 结果 |
|---|---|
| A 欠 1000，B 欠 500，收款 800 | A：分配 800，优惠 **40**，余额 160；B 不动。合计优惠 40 |
| A 欠 1000，B 欠 500，收款 1500 | A：分配 1000，优惠 **0**；B：分配 500，优惠 **0**。合计优惠 0 |
| A 欠 1000，B 欠 500，收款 1200 | A：分配 1000，优惠 **0**；B：分配 200，优惠 **10**，余额 290 |

### 4.4 优惠是「两笔钱」

`totalDiscount` 单独累加（`svc:217`），**不从 `remaining` 里扣**（`svc:216` 只减 `alloc`）。响应里 `合计分配金额` 与 `合计优惠金额` 是两个独立字段（`svc:226-227`）。

所以：优惠是**店家让利 / 核销**，不由本次收款出钱；但被优惠的那张单，`未收金额` 会按 `alloc + discount` 减少（`svc:214`）。**一笔收款 + 一笔让利，共两笔钱**，只是命中同一张单。

### 4.5 行对象的字段名在两个分支里不同（新系统对齐时务必注意）

| 字段 | 分支 B（正常） | 分支 A（红冲） |
|---|---|---|
| `回执单号` | ✔ | ✔ |
| `日期` | ✔ | ✔ |
| `总价` | ✔ | ✔ |
| `未收金额` | ✔ | ✘（无此键） |
| `已分配金额` | ✘（无此键） | ✔ |
| `分配金额` | 正数 | 负数 |
| `优惠金额` | ≥ 0 | 恒为 0 |
| `分配后余额` | `max(0, 未收 - 分配 - 优惠)` | `已分配 - |分配金额|` |

出处：`svc:207-215`（B）对比 `svc:187-195`（A）。

### 4.6 `总价` 的算法（`orderTotal`，`svc:57-60`）

```
orderTotal(fo) = toNum(fo.order.totalAmount)
                 || (toNum(fo.allocatedAmount) + toNum(fo.unpaidAmount) + toNum(fo.orderAdjustTotal))
```

- 优先用 `orders.total_amount`（`schema:76`）；
- 若为 `0`/`null`/`NaN`（`||` 是 falsy 判断，所以**订单总价为 0 时会走回退公式**），回退成 `已分配 + 未收 + 订单调整`。
- ⚠️ 因为 `||` 的存在，**总价真的是 0 的订单会被算成回退值**。这是个已知的 `||` vs `??` 陷阱。

### 4.7 红冲分支的额外限制

`unpaidOrdersForCustomer` 已经把候选限制为 `unpaidAmount > 0`（`svc:171`），而红冲分支又只处理 `allocatedAmount > 0` 的单（`svc:185`）。

**CONFIRMED 后果**：一张**已结清**（`unpaidAmount = 0`、`allocatedAmount > 0`）的单**根本进不了候选集**，因此**无法通过 `preview-allocation` 做红冲**。红冲只能作用于「既欠着钱、又已经付过一部分」的单。

## 5. 三条预览 / 执行服务函数

### 5.1 `previewAllocation`（`svc:778-784`）

```pseudo
customerCode = body['客户编号'] ?? body['customerCode'] ?? body['clientCode']   # svc:62-64
amount  = toNum(body['收款金额'] ?? body['分配金额'] ?? body.amount)            # svc:780
orders  = unpaidOrdersForCustomer(ds, customerCode)                            # svc:781
data    = buildAllocationPreview(orders, amount, toNum(body['优惠比例']))       # svc:782
return { code:200,
         data: { customerCode, totalAmount: amount,
                 allocated: data['合计分配金额'], ...data },                     # svc:783
         message: 'ok' }
```

- `优惠比例` 是**小数比率**（`0.05` = 5%），不是百分数。见 §11 UNCERTAIN-2。
- 没有对 `amount` 做任何上限校验（不像预付款版本会按余额封顶）。
- 展开顺序 `{...固定键, ...data}`：`data` 在后，但 `data` 里没有 `customerCode`/`totalAmount`/`allocated` 三个键（`svc:220-228`），所以无覆盖冲突。

### 5.2 `previewPrepaymentAllocation`（`svc:788-801`）

与 `previewAllocation` 的**唯一区别**：

```pseudo
customerIdentity = resolveCustomerIdentity(ds, customerCode)      # svc:790 → svc:82-89
balanceCode      = customerIdentity.balanceCode || customerCode   # svc:791（优先用 client.clientCode）
requestedAmount  = toNum(body['分配金额'] ?? body['收款金额'] ?? body.amount)  # svc:792  ★ 顺序相反！
balance    = customerBalance.findFirst({ ds, clientCode: balanceCode })       # svc:793-795
available  = max(0, toNum(balance?.prepaidBalance))                           # svc:796
amount     = min(max(0, requestedAmount), available)               # ★ 双重截断  # svc:797
orders     = unpaidOrdersForCustomer(ds, customerCode)                        # svc:798
data       = buildAllocationPreview(orders, amount, toNum(body['优惠比例']))   # svc:799
return { code:200,
         data: { customerCode, totalAmount: amount, requestedAmount,
                 availableBalance: available,
                 allocated: data['合计分配金额'], ...data },                     # svc:800
         message: 'ok' }
```

差异清单：

| 维度 | `previewAllocation` | `previewPrepaymentAllocation` |
|---|---|---|
| 金额字段优先级 | `收款金额` → `分配金额` → `amount` | **`分配金额` → `收款金额`** → `amount` |
| 金额上限 | 无 | `min(max(0,请求额), 预付款余额)`（`svc:797`） |
| 负数（红冲） | 允许（走分支 A） | **不允许**，`max(0, ...)` 吃掉负号 → `amount ≥ 0` |
| 客户码归一化 | 不归一 | `balanceCode = client.clientCode || customerCode`（`svc:791`） |
| 余额字段 | 无 | 多返回 `requestedAmount`、`availableBalance` |
| 是否读 `customer_balances` | 否 | 是（`svc:793-795`） |

⚠️ **`previewPrepaymentAllocation` 永远不会产生红冲行**（`svc:797` 的 `max(0, ...)`）。

### 5.3 `executePrepaymentAllocation`（`svc:805-863`）—— 写了哪些表

```pseudo
customerCode     = 归一化后的客户码                                     # svc:806-808
requestedAmount  = toNum(body['分配金额'])      # ★ 只认「分配金额」        # svc:809
discountRate     = toNum(body['优惠比例'])                              # svc:810
balance          = customerBalance.findFirst({ ds, clientCode: balanceCode })   # svc:811-813
available        = max(0, toNum(balance?.prepaidBalance))               # svc:814
amount           = min(max(0, requestedAmount), available)              # svc:815
orders           = unpaidOrdersForCustomer(ds, customerCode)            # svc:816
preview          = buildAllocationPreview(orders, amount, discountRate) # svc:817 ★ 服务端重算

totalAllocated = 0
for row in preview['分配列表']:                                          # svc:819
    orderNo  = row['回执单号']; alloc = toNum(row['分配金额']); discount = toNum(row['优惠金额'])
    if !orderNo || alloc <= 0: continue                                 # svc:823
    fo = orders.find(o => o.orderNo === orderNo)      # ★ 在内存里按单号回查    # svc:824
    if !fo: continue                                                    # svc:825
    nextAllocated = toNum(fo.allocatedAmount) + alloc                   # svc:826
    nextUnpaid    = max(0, toNum(fo.unpaidAmount) - alloc - discount)   # svc:827

    [W1] financeOrder.update({ allocatedAmount: nextAllocated,
                               unpaidAmount: nextUnpaid,
                               statusText: statusText(nextUnpaid) })    # svc:828-831
    if fo.orderId:
      [W2] order.update({ paidAmount: nextAllocated, unpaidAmount: nextUnpaid })  # svc:832-834
    totalAllocated += alloc                                             # svc:835
    if discount > 0 && fo.orderNo:
      [W3] orderAdjustment.create({ orderNo, adjustAmount: discount,
                                    adjustType: '预付款优惠',
                                    notes: body['备注'] })               # svc:836-840

if balance:                                                             # svc:842
    newPrepaid = max(0, toNum(balance.prepaidBalance) - totalAllocated)  # svc:843
    newSpent   = toNum(balance.totalSpent) + totalAllocated              # svc:844
    [W4] customerBalance.update({ prepaidBalance: newPrepaid, totalSpent: newSpent })  # svc:845
    if totalAllocated > 0:
      [W5] customerFundFlow.create({ clientCode: balanceCode, clientId, customerName,
                                     amount: -totalAllocated,        # 负数
                                     flowType: '预付款分配',
                                     paymentDate: nowDate(),
                                     paymentMethod: null,
                                     notes: body['备注'] })          # svc:846-860

return { code:200,
         data: { success:true, requestedAmount, availableBalance: available,
                 totalAllocated, ...preview },                           # svc:862
         message:'分配成功' }
```

**写的表**：`finance_orders`（W1）、`orders`（W2）、`order_adjustments`（W3）、`customer_balances`（W4）、`customer_fund_flows`（W5）。
**不写的表**：`payments` —— 预付款分配**不创建任何 payment 记录**（这是与 `addPayment` 最大的落库差异）。

其他要点：

- **没有事务**：整个循环 5 张表的写操作各自独立提交（`svc:819-861` 无 `$transaction`）。中途抛错会留下半成品。
- **`alloc <= 0` 被跳过**（`svc:823`）：红冲行（负数）在这里被丢弃；不过 `amount` 已被 `max(0, ...)` 保证非负（`svc:815`），所以本来也不会产生红冲行。
- **优惠不扣预付款余额**：`newPrepaid` 只减 `totalAllocated`（= Σ `alloc`，`svc:843`），**不含 discount**。优惠以 `order_adjustments`（`adjustType='预付款优惠'`）单独记账（`svc:836-840`）。
- **`orderAdjustTotal` 没有被更新**：W3 只写 `order_adjustments` 表，**没有**调用 `applyOrderAdjustmentToFinance`（`svc:231-246`，那个函数会同步 `financeOrder.orderAdjustTotal`）。后果见 §11 UNCERTAIN-4。
- **`balance` 为空（客户没有 `customer_balances` 行）时**：分配照做，但 W4/W5 全跳过（`svc:842`）——**不扣余额、不记流水**，静默地「白送」一次分配。
- 预付款分配**没有 `payments` 记录**，也因此**不会出现在 `/payment-stats` 的 `payments` 列表里**（`getPaymentStats` 只查 `payments` + `customerFundFlow`，`svc:582-605`）——但会以 `fund-<id>` 形式出现在流水段（`svc:261-279`）。

## 6. `addPayment` —— 真正的「执行分配」入口（`svc:325-434`）

预览出来的 `分配列表` 要靠 `finance_addPayment` 落库（action 注册 `disp:199` → handler `disp:851-853`；REST 路由 `POST /api/v1/finance/add-payment`，`routes:50-63`）。这是预览→执行闭环的关键，所以本节纳入取证。

**分两条互斥路径**（`svc:339`）：

### 路径 1：`回执单号` 存在 **且** `分配列表` 为空（`svc:339-359`）—— 单笔定向收款

```pseudo
fo = financeOrder.findFirst({ ds, orderNo: receiptNo })      # svc:340
if !fo: throw `订单 ${receiptNo} 不存在`                       # svc:341
payment = payment.create({ ds, orderId, financeOrderId, amount, paymentDate, paymentMethod, notes })  # svc:342-344
discount   = max(0, amount) * toNum(body['优惠比例'])          # svc:346 ★ 无上限、无四舍五入
deltaUnpaid = amount >= 0 ? -(amount + discount) : abs(amount) # svc:347
nextAllocated = allocatedAmount + amount                       # svc:348
nextUnpaid    = max(0, unpaidAmount + deltaUnpaid)             # svc:349
financeOrder.update(...)                                       # svc:350-353
order.update({ paidAmount: nextAllocated, unpaidAmount: nextUnpaid })  # svc:354-356
allocatedTotal = amount; prepaidDelta = 0; return              # svc:357-358
```

⚠️ **这条路径的优惠公式与 `buildAllocationPreview` 不同**：这里是 `amount * rate` **没有任何上限**（`svc:346`），而预览里是 `min(unpaid - alloc, alloc*rate)`（`svc:206`）。两者会算出不同的数。且**不产生 `order_adjustments` 记录**。

### 路径 2：按客户端下发的 `分配列表` 逐行落库（`svc:361-382`）

```pseudo
for row in allocationRows(body):        # svc:137-140: body['分配列表'] ?? body['allocations'] ?? body['allocationList']
    rowOrderNo = row['回执单号'] ?? row.orderNo                       # svc:362
    alloc      = toNum(row['分配金额'] ?? row.allocAmount ?? row.amount)  # svc:363
    if !rowOrderNo || alloc === 0: continue        # ★ 负数不跳过（红冲走这里）  # svc:364
    fo = financeOrder.findFirst({ ds, orderNo: rowOrderNo })          # svc:365
    if !fo: continue                                # ★ 静默跳过，不报错        # svc:366
    payment.create({ ..., amount: alloc, ... })                       # svc:367-369
    discount = max(0, toNum(row['优惠金额']))       # ★ 直接信客户端给的值      # svc:371
    nextAllocated = allocatedAmount + alloc                           # svc:372
    nextUnpaid    = max(0, unpaidAmount - alloc - discount)           # svc:373
    financeOrder.update(...)                                          # svc:374-377
    order.update({ paidAmount: nextAllocated, unpaidAmount: nextUnpaid })  # svc:378-380
    allocatedTotal += alloc                                           # svc:381

prepaidDelta = amount - allocatedTotal                                # svc:384
if abs(prepaidDelta) > 0.005:                                         # svc:385
    if !balanceCode: throw '客户编号不能为空'                            # svc:386-387
    payment.create({ ds, amount: prepaidDelta, ... })   # 无 financeOrderId  # svc:388-390
    customerBalance 增 prepaidBalance += prepaidDelta；totalTopup += max(0, prepaidDelta)  # svc:392-413
    customerFundFlow.create({ amount: prepaidDelta,
                              flowType: prepaidDelta >= 0 ? '预付款' : '预付款冲销' })      # svc:414-427
```

**写的表**：`payments`、`finance_orders`、`orders`、`customer_balances`、`customer_fund_flows`。整个事务包在 `prisma.$transaction` 里（`svc:335`）。

关键差异（对比 `executePrepaymentAllocation`）：

| | `addPayment`（路径 2） | `executePrepaymentAllocation` |
|---|---|---|
| 分配列表来源 | **客户端下发**，逐行照做 | **服务端用 `buildAllocationPreview` 重算** |
| 写 `payments` | ✔（每行一条） | ✘ |
| 写 `customer_balances` | 只在有剩余（`prepaidDelta`）时 | 总是（`balance` 非空时） |
| 余额方向 | `+=` 剩余（充值） | `-=` 已分配（消费） |
| 写 `customer_fund_flows` | ✔ `flowType` = `预付款`/`预付款冲销` | ✔ `flowType` = `预付款分配`，金额为负 |
| 写 `order_adjustments` | **✘ 从不写**（优惠只改 `unpaidAmount`） | ✔ 优惠 > 0 时写 `预付款优惠` |
| 事务 | ✔ `$transaction`（`svc:335`） | ✘ |
| 单号不存在时 | **静默跳过**（`svc:366`） | 不会发生（单号来自自己的候选集） |

## 7. `clearSelectedOrders` —— 批量清账（`svc:867-887`）

```pseudo
rows = body['rows'] ?? body['data'] ?? body['selected'] ?? []          # svc:868
orderNos = rows.map(r => r.orderNo ?? r.回执单号 ?? r).filter(Boolean)  # svc:869 ★ 支持字符串数组
cleared = 0
for orderNo in orderNos:                                               # svc:871  ★ 逐单，不分组
    fo = financeOrder.findFirst({ ds, orderNo })                       # svc:872
    if !fo: continue                                                   # svc:873 静默跳过
    unpaid = toNum(fo.unpaidAmount)
    if unpaid <= 0: continue                                           # svc:875 静默跳过
    payment.create({ ds, orderId: fo.orderId, financeOrderId: fo.id,
                     amount: unpaid,                 # ★ 金额 = 当前未收全额
                     paymentDate: nowDate(),         # ★ 今天（svc:14-20，本地零点）
                     paymentMethod: '清账',
                     notes: '批量清账' })             # svc:876-878
    financeOrder.update({ allocatedAmount: allocatedAmount + unpaid,
                          unpaidAmount: 0,
                          statusText: '已结清' })     # svc:879-882
    syncOrderAmounts(fo.orderId, allocatedAmount + unpaid, 0)          # svc:883 → svc:111-120
    cleared++                                                          # svc:884
return { code:200, data:{ success:true, clearedOrders: cleared }, message:'ok' }  # svc:886
```

回答题目 4 的四个子问题（全部 CONFIRMED）：

1. **按客户分组吗？** 否。**一次一单，逐个循环**（`svc:871`）。入参是一个扁平的单号列表，没有任何 `客户编号` 参与，也不读 `customer_balances`。
2. **生成什么记录？** 每张单一条 `payments` 行：`paymentMethod='清账'`、`notes='批量清账'`、`amount = 该单未收金额`（`svc:876-878`）。**不生成** `customer_fund_flows`，**不生成** `order_adjustments`，**不改** `customer_balances`。
3. **金额怎么算？** `= 当前 finance_orders.unpaidAmount`（`svc:874`），即把剩余未收一次性「视作已收」，`unpaidAmount` 直接置 0。**不产生优惠**，也**不校验客户是否有预付款**。
4. **返回值**：`{ code:200, data:{ success:true, clearedOrders:<实际改动的单数> }, message:'ok' }`（`svc:886`）。不存在的单、已结清的单都被静默跳过（`svc:873`、`svc:875`），所以 `clearedOrders ≤ orderNos.length`，且**调用方无法得知哪些被跳过**。

⚠️ **没有事务**（`svc:871-885`），逐单独立提交；中途失败会留下「清了一半」的状态。

⚠️ 入参容错：`r.orderNo || r.回执单号 || r`（`svc:869`）——**元素是字符串时直接用字符串**，所以 `{"rows": ["R001","R002"]}` 和 `{"rows":[{"orderNo":"R001"}]}` 都合法。

## 8. 预览与执行的一致性（题目 5）

| 入口 | 预览算出的分配列表，执行时 | 若不一致会怎样 |
|---|---|---|
| `executePrepaymentAllocation` | **服务端完全重算**（`svc:816-817`），客户的预览结果**一律忽略** | 客户端看到的预览可能与实际落库不同（两次查询之间他人收款、或客户余额变化）。重算结果会随响应 `...preview` 返回（`svc:862`），但**客户端不校验**就出错账 |
| `addPayment` | **原样落库**，客户端下发的 `分配列表` 就是权威（`svc:361-382`） | 服务端不拿它跟当前 `unpaidAmount` 复核。见下 |

**`addPayment` 的漂移风险（CONFIRMED，代码层面可证）**：

- `nextUnpaid = max(0, unpaid - alloc - discount)`（`svc:373`）—— 有 0 下限**保护**
- `nextAllocated = allocatedAmount + alloc`（`svc:372`）—— **没有任何上限**。若客户端下发的 `alloc` 大于实际未收，`unpaidAmount` 归 0，但 `allocatedAmount` 会**超过订单总额**，进而让 `orderTotal` 的回退公式（`svc:59`）与 `getOrderDetail` 的 `总价`（`svc:719`）一起被抬高。
- `payment` 记录的 `amount` 直接等于客户端给的 `alloc`（`svc:368`），因此**收款流水金额也不受未收额约束**。
- 单号不存在 → **静默 `continue`**（`svc:366`），客户端不会收到任何错误。

`buildAllocationPreview` 里 `fo.orderNo` 为空串的行会生成 `'回执单号': ''`（`svc:208`、`svc:188`），落库时被 `if (!rowOrderNo) continue` 丢掉（`svc:364` / `svc:823`）——但预览把这行**照常返回并计入 `合计分配金额`**（`svc:226`），所以**预览的合计可能大于实际落库的合计**。见 §11 UNCERTAIN-3。

## 9. 请求 / 响应字段表

响应信封：`ok(res, data)` 产出 `{ code: 200, data: <service 返回值> }`（`middleware/response.ts:3-9` 的 `ok`；`fail` 在 `:11-14`）。注意 **service 函数本身也返回 `{code, data, message}`**，所以走 REST 路由时会被**双层包裹**（见下）。

### 9.1 `POST /api/v1/finance/preview-allocation`（`routes:168-181` → `svc:778-784`）

请求 `req.body`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `客户编号` / `customerCode` / `clientCode` | string | 是（空则候选集为空） | 取值优先级见 `svc:62-64`；纯数字串会同时按 `Client.id` 匹配（`svc:69-76`） |
| `收款金额` / `分配金额` / `amount` | number | 是 | 负数 = 红冲（`svc:780`、`svc:175`） |
| `优惠比例` | number（小数比率） | 否，默认 0 | `0.05` = 5%（`svc:782`、`svc:206`） |

`ds` 来自登录态（`req.user.databaseName`，`routes:170`），或 legacy 的 `param2`（`disp:1144`）。

响应（REST，双层）：

```json
{ "code": 200,
  "data": {
    "code": 200,
    "data": {
      "customerCode": "C001",
      "totalAmount": 800,
      "allocated": 800,
      "分配列表": [ { "回执单号":"R001","日期":"2026-01-05","总价":1000,
                     "未收金额":1000,"分配金额":800,"优惠金额":40,"分配后余额":160 } ],
      "allocations": [ /* 同上，同一数组 */ ],
      "剩余金额": 0,
      "unallocated": 0,
      "合计分配金额": 800,
      "合计优惠金额": 40,
      "资金池剩余": 0
    },
    "message": "ok"
  }
}
```

| 响应字段 | 类型 | 说明 |
|---|---|---|
| `customerCode` | string | 原样回显（**未做 client 归一化**） |
| `totalAmount` | number | 传入的 `amount`（含负数） |
| `allocated` | number | = `合计分配金额` |
| `分配列表` / `allocations` | array | 同一数组的两个键（`svc:221-222`） |
| `剩余金额` / `unallocated` / `资金池剩余` | number | 三个键同一个值（`svc:223-227`） |
| `合计分配金额` | number | `amount - remaining`（`svc:226`） |
| `合计优惠金额` | number | Σ discount（`svc:227`） |

### 9.2 `POST /api/v1/finance/preview-prepayment-allocation`（`routes:184-197`）

⚠️ **REST 路由实际调用 `previewAllocation`（`routes:192`）**，因此请求/响应**与 §9.1 完全相同**，`availableBalance` 等字段**不会出现**。

Legacy 入口 `finance_previewPrepaymentAllocation`（`disp:898-901` → `svc:788-801`）才是真语义：

| 请求字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `客户编号` / `customerCode` / `clientCode` | string | 是 | 会归一化成 `client.clientCode`（`svc:790-791`） |
| `分配金额` / `收款金额` / `amount` | number | 是 | **`分配金额` 优先**（`svc:792`，与 §9.1 相反） |
| `优惠比例` | number | 否 | 同上 |

| 响应字段（在 §9.1 基础上多出） | 类型 | 说明 |
|---|---|---|
| `requestedAmount` | number | 客户端请求额（截断前） |
| `availableBalance` | number | `max(0, prepaidBalance)`（`svc:796`） |
| `totalAmount` | number | **截断后**的实际参与分配额（`svc:800`） |

### 9.3 `POST /api/v1/finance/execute-prepayment-allocation`（`routes:200-213` → `svc:805-863`）

请求 `req.body`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `客户编号` / `customerCode` / `clientCode` | string | **是** | 归一化后作 `balanceCode`（`svc:806-808`） |
| `分配金额` | number | 是 | **只认这一个键**，无 `收款金额`/`amount` 别名（`svc:809`） |
| `优惠比例` | number | 否 | `svc:810` |
| `备注` | string | 否 | 写进 `order_adjustments.notes`（`svc:838`）与 `customer_fund_flows.notes`（`svc:857`） |

响应（`svc:862`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | number | 恒 200（即使一张单都没分配） |
| `message` | string | 恒 `'分配成功'` |
| `data.success` | boolean | 恒 `true` |
| `data.requestedAmount` | number | 请求额 |
| `data.availableBalance` | number | 执行时读到的预付款余额 |
| `data.totalAllocated` | number | Σ 实际分配额（**不含 discount**） |
| `data.分配列表` / `allocations` | array | **服务端重算**的分配行 |
| `data.剩余金额` / `unallocated` / `资金池剩余` | number | 截断后金额中未分掉的部分 |
| `data.合计分配金额` | number | 同 `totalAllocated`（恒等） |
| `data.合计优惠金额` | number | Σ discount |

⚠️ **恒返回 `code:200` / `'分配成功'`**：客户不存在、无余额、无可分配订单，都返回成功。失败只能靠 `totalAllocated === 0` 判断。

### 9.4 `POST /api/v1/finance/clear-selected-orders`（`routes:216-229` → `svc:867-887`）

请求 `req.body`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `rows` / `data` / `selected` | array | 是 | 取值优先级见 `svc:868` |
| ↳ 元素 | string \| object | — | object 取 `orderNo` 或 `回执单号`（`svc:869`） |

响应：

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` / `message` | number / string | `200` / `'ok'` |
| `data.success` | boolean | 恒 `true` |
| `data.clearedOrders` | number | 实际改动的单数（不存在/已结清的不计） |

### 9.5 legacy dispatch 入口（旧前端实际走的）

`param1` 用 §1 表；`param2`（或 body 的 `ds`）传数据库名（`disp:1144-1149`）；业务字段放 **body**（`disp:1154`）。

响应**单层**包裹：`{ code:200, data:{...}, message:'...' }`。

原因链（CONFIRMED）：
- 本文 4 个 action **没有** `LEGACY_CONTRACTS` 条目（`disp:249-318` 里不存在 finance/clear/allocation 相关键）；
- 无条目 → `contract.mapFields` 为 `undefined` ≠ `false` → **会执行 `mapResponseFields`**（`disp:328`）；
- 但 `mapResponseFields` 只在对象含 `name`/`phone`/`clientCode`/`customerName`/`orderNo`/`procedureName`/`databaseName`/`createdAt` 之一时才重写（`disp:1229-1230`），而顶层是 `{code, data, message}`，`data` 不是数组（`disp:1223-1227` 不递归）→ **原样返回**；
- 再走 `shape === 'auto'`：对象含 `code` → 原样返回（`disp:343-349`）。

⚠️ **同一份业务数据，REST 是双层 `data`，legacy 是单层 `data`。** 新系统对接时以哪条为准必须定死。

## 10. 其余相关服务的口径（供交叉核对）

- `getOrderDetail`（`svc:688-726`）：`总价 = allocatedAmount + unpaidAmount + orderAdjustTotal`（`svc:719`）——**与 `orderTotal` 的回退分支一致，但不读 `orders.total_amount`**。同一个「总价」有两条算法。
- `getCustomerBalance`（`svc:730-774`）：`客户余额 = max(0, unpaidTotal - customerAdjustTotal)`（`svc:763`），`未分配余额 = prepaidBalance`（`svc:768`）。注意 `客户余额` 用的是**未收合计**，和「预付款余额」是两回事。
- `addOrderAdjustment`（`svc:560-575`）→ `applyOrderAdjustmentToFinance`（`svc:231-246`）：**这个**函数会同步 `financeOrder.orderAdjustTotal += amount` 且 `unpaidAmount -= amount`（`svc:234-235`）。`executePrepaymentAllocation` 的优惠**没有**走它（§5.3）。
- `finance.repository.ts` 全文（`repo:1-98`）：只是 `prisma` 的薄封装，导出 `financeRepository`。**全仓库没有任何文件 import 它**（已 grep 确认）。本文涉及的所有分配逻辑都直接用 `prisma`。→ **死模块，新系统不必复刻。**

## 11. UNCERTAIN（需要进一步验证）

**UNCERTAIN-1：`orderDate` 为 NULL 的排序位置。**
`orderBy: [{ order: { orderDate: 'asc' } }, ...]`（`svc:155`）依赖 PostgreSQL 默认的 `NULLS LAST`（升序时 NULL 排最后）。代码里没有显式声明，也没有证据表明线上库的排序规则被改过。**影响**：`order_date` 为空的欠款单会被排到最后，只有在钱没分完时才会被碰到。若要逐字节复刻，需要在真实库上验证。

**UNCERTAIN-2：`优惠比例` 是小数还是百分数，无任何界面/校验佐证。**
代码只做 `toNum` 后直接相乘（`svc:206`、`svc:346`、`svc:782`）。若旧前端传的是 `5`（表示 5%），那 `round(alloc * 5 * 100)/100 = alloc * 5`，优惠会是本金的 5 倍——但因为 `min(unpaid - alloc, ...)` 上限（`svc:206`）在**预览**里会被吃掉一部分，**在 `addPayment` 路径 1 里则没有上限**（`svc:346`），会直接把 `unpaidAmount` 打到 0 并让 `allocatedAmount` 少算。这是**风险最高的一个未定项**，建议从旧前端源码或线上数据反查。

**UNCERTAIN-3：`orderNo` 为空的 `finance_orders` 行会污染预览合计。**
`buildAllocationPreview` 不检查 `fo.orderNo` 是否为空（`svc:208`、`svc:188`），照样计入 `合计分配金额`（`svc:226`）；但执行侧（`svc:364`、`svc:823`）会用 `if (!rowOrderNo) continue` 丢掉。因此**预览的 `合计分配金额` 可能大于实际落库额**。`schema:150` 的 `@@unique([databaseName, orderNo])` 对 `orderNo` 为 `null` 的行不生效（Postgres 里多个 NULL 互不冲突），所以这种行**是可以存在的**。线上是否真有，未验证。

**UNCERTAIN-4：`executePrepaymentAllocation` 的优惠让 `总价` 自相矛盾。**
它在 `order_adjustments` 里写了 `预付款优惠`（`svc:836-840`），但**没有**同步 `financeOrder.orderAdjustTotal`（对比 `svc:234`）。而 `getOrderDetail` 的 `总价 = allocated + unpaid + orderAdjustTotal`（`svc:719`）会因此**少算 discount**。这是否是旧版有意为之（「优惠不进订单调整合计」）无从判断，因为**旧版前端源码不在本次取证范围内**。

**UNCERTAIN-5：`addPayment` 路径 1 与预览的优惠公式不一致，哪个是「正确」的。**
预览用 `min(unpaid - alloc, alloc*rate)`（`svc:206`，有上限、四舍五入到分）；`addPayment` 路径 1 用 `amount * rate`（`svc:346`，无上限、不四舍五入）。同一笔收款，走「先预览再逐行提交」和走「只传回执单号」会落到**不同的优惠额**。哪个是旧版真实行为，需要旧前端调用方式佐证。

**UNCERTAIN-6：`clearSelectedOrders` 是否有意不动预付款。**
清账把 `unpaidAmount` 置 0 并造一条「清账」收款流水，但不碰 `customer_balances`（`svc:871-885`）。若客户账上挂着预付款，清账后预付款**仍然挂在账上**（`prepaidBalance` 不变），可以再拿去分配给别的单。这看起来是对的（清账是「记账清零」而非「动用预付款」），但没有文档或注释佐证，**无法确认是有意设计还是漏写**。

**UNCERTAIN-7：`previewPrepaymentAllocation` 在旧前端是否真的被调用。**
虽然 ACTION_MAP 和 HANDLER_MAP 都注册了（`disp:198`、`disp:898-901`），但没有旧前端源码证明它被调用过。若从未被调用，则 REST 路由把 `previewAllocation` 写错（`routes:192`）这件事就**没有任何实际影响**——但那也意味着「预付款分配预览」这条能力在线上可能从没跑过。

**UNCERTAIN-8：并发下的双花。**
`executePrepaymentAllocation` 无事务、无行锁（`svc:805-863`）。两个并发请求可能读到同一个 `prepaidBalance`，各自扣减，造成**预付款被分配两次**（`svc:811-815` 读、`svc:843-845` 写，中间隔着整个循环）。旧版是否有前端互斥或单机部署规避，未验证。

## 11.5 取证边界：哪些是直读、哪些是推导

这一节是给「拿本文去定死账务口径」的人看的。**直读**= 代码里逐字写着的；**推导**= 我从直读事实往下推的一步，逻辑可查但源码没直接写；**非源码**= 依赖外部知识或工具结论。

| 内容 | 性质 | 依据 |
|---|---|---|
| §3 排序比较器、§4 伪码与公式、§5-§7 各函数的读写表 | **直读** | 各条已标行号 |
| §4.3 三行数值示例表 | **推导（纯算术）** | 由 `svc:205-206` 的公式手算，非源码中的 fixture。公式若被误读，示例会一起错 |
| §4.4「优惠是店家让利 / 核销」 | **推导（业务解读）** | 公式事实有出处（`svc:216-217`）；「让利」这个业务命名是我的解读，源码只叫它 `优惠` |
| §4.6「总价为 0 会走回退公式」 | **直读** | `\|\|` 的 falsy 语义 + `svc:59` |
| §8「`nextAllocated` 无上限 → 顶穿订单总额 → 抬高 `总价`」 | **推导链** | 前半（无 clamp、有 0 下限）是直读 `svc:372-373`；「顶穿」和「抬高总价」是沿 `svc:59`、`svc:719` 往下推的两步 |
| §9.1/§9.5 REST 双层 vs legacy 单层 | **直读** | `ok` 源码 + `disp:326-350` 契约分支 |
| §9.5「无 finance 契约 → 会跑 mapResponseFields 但结果不变」 | **直读** | `disp:249-318` 无相关键 + `disp:1229-1230` 的触发条件 |
| §10「`finance.repository.ts` 是死模块」 | **非源码（缺席证明）** | 全仓 grep 无 import。这是「没找到」而非「某行写着没有」，若存在动态 import 则会被推翻 |
| §1「旧前端不是走 REST，而是走 legacy 分发」 | **推导** | 直读事实是 `/1` 分发入口存在且注释为 legacy 兼容（`app.ts:42-43`）；「前端实际走哪条」我没有旧前端源码佐证 → 已并入 UNCERTAIN-7 |
| §11 UNCERTAIN-1 的 `NULLS LAST` | **非源码（PG 常识）** | 代码没写 `nulls` 选项；这是 PostgreSQL 升序默认行为，未在真实库验证 |

除上表所列，本文第 §3–§9 的每一条事实性结论均带 `文件:行号`。

## 12. 给新系统的最小对齐清单（结论速查）

1. 贪心顺序 = `订单日期 asc, 本行 createdAt asc`（`svc:155`），只吃 `unpaidAmount > 0` 的单（`svc:171`）。
2. 每单 `alloc = min(剩余, 未收)`（`svc:205`），`剩余 == 0` 立即停（`svc:202`）。
3. 优惠 = `min(未收 - alloc, round(alloc * rate * 100)/100)`（`svc:206`）→ **只有最后那张被部分覆盖的单能拿到优惠**。
4. 优惠 **不占** 收款金额；它是让利，单独计量（`svc:216-217`、`svc:226-227`）。
5. 预付款分配 = 服务端重算 + 扣 `prepaidBalance` + 写 `预付款分配` 流水，**不写 payments**（`svc:816-860`）。
6. 清账 = 逐单把 `unpaidAmount` 变 0，写一条 `paymentMethod='清账'` 的收款，**按单不按客户**，无事务（`svc:871-885`）。
7. `finance.repository.ts` 是死模块，不用复刻。
