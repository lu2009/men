# 旧系统财务模块 —— 写入口径（逆向取证）

范围：**写入路径**。读取口径见同目录 `01-read.md`（他人负责），本文只在必须解释写入结果时才引用读取代码。

## 0. 出处简写表

| 简写 | 绝对路径 |
|---|---|
| `svc` | `/Users/aaa/Downloads/server/src/modules/finance/finance.service.ts` |
| `routes` | `/Users/aaa/Downloads/server/src/modules/finance/finance.routes.ts` |
| `repo` | `/Users/aaa/Downloads/server/src/modules/finance/finance.repository.ts` |
| `schema` | `/Users/aaa/Downloads/server/prisma/schema.prisma` |
| `dispatch` | `/Users/aaa/Downloads/server/src/modules/legacy-dispatch.ts` |
| `error.mw` | `/Users/aaa/Downloads/server/src/middleware/error.ts` |
| `order.svc` | `/Users/aaa/Downloads/server/src/modules/order/order.service.ts` |
| `client.svc` | `/Users/aaa/Downloads/server/src/modules/client/client.service.ts` |
| `progress.svc` | `/Users/aaa/Downloads/server/src/modules/progress/progress.service.ts` |

**重要前提**：`svc` 里的所有 helper 都是模块私有（非 export），全仓 `grep` 确认**没有任何模块外调用者**，唯一入口是 `routes` 的 Express 路由和 `dispatch` 的旧版 `param1` 分发（`dispatch:851-909`）。所以本文对 helper 的语义结论不受外部调用影响。

---

## 1. 写操作涉及的列（事实基线）

| 表 | 列 | 类型/默认 | 出处 |
|---|---|---|---|
| `finance_orders` | `allocated_amount` | `Decimal? @default(0)` | `schema:141` |
| | `unpaid_amount` | `Decimal? @default(0)` | `schema:142` |
| | `order_adjust_total` | `Decimal? @default(0)` | `schema:143` |
| | `status_text` | `String?`（无默认） | `schema:145` |
| | `customer_name` / `order_id` / `order_no` | | `schema:138-140` |
| | 唯一键 | `@@unique([databaseName, orderNo])` | `schema:150` |
| `orders` | `paid_amount` / `unpaid_amount` | `Decimal? @default(0)` | `schema:77-78` |
| | `total_amount` | `Decimal?`（**财务写路径从不改它**） | `schema:76` |
| `payments` | `amount` / `order_id` / `finance_order_id` / `payment_date` / `payment_method` / `notes` | 无唯一约束、无幂等键 | `schema:156-173` |
| `customer_balances` | `prepaid_balance` / `total_topup` / `total_spent` | `Decimal? @default(0)` | `schema:205-207` |
| | 唯一键 | `@@unique([databaseName, clientCode])` | `schema:211` |
| `customer_fund_flows` | `amount`(非空) / `flow_type` / `payment_id` / `client_code` | | `schema:181-188` |
| `customer_adjustments` | `adjust_amount`(非空) / `adjust_type` | | `schema:222-223` |
| `order_adjustments` | `adjust_amount`(非空) / `adjust_type` / `order_no` | | `schema:235-238` |

---

## 2. 存量冗余列的维护方式（问题 1）

### 结论：**既不是 `increment`，也不是「重算后覆盖」，而是「读快照 → JS 里算 → 覆盖写」**

证据：
- **全仓没有一处 Prisma 原子自增**。`grep -rn "increment\|decrement" src` 只命中 `order/line-number.service.ts:112,181` 的两处**注释**，无任何 `{ increment: ... }`。
- 财务写路径的每一次存量列变更，都是先 `findFirst` 拿到整行，在 JS 里 `toNum(旧值) + delta`，再 `update` 一个**绝对值**：
  - `svc:123-124`（`nextAllocated` / `nextUnpaid`）
  - `svc:234-235`（`nextAdjust` / `nextUnpaid`）
  - `svc:251-257`（`prepaidBalance + amount` / `totalTopup + topupDelta`）
  - `svc:348-349`、`svc:372-373`（`addPayment` 两个分支，内联复刻同一算法）
  - `svc:397-398`（收款尾部分支的余额）
  - `svc:826-827`、`svc:843-844`（预付款分配）
  - `svc:881`、`svc:883`（批量清账）

**直接后果**：所有存量列的写入都是**丢失更新（lost update）**语义。两个并发请求各自读到旧值，后写的把先写的覆盖掉。这是新系统必须避免照抄的头号问题。

### 各列的变化规则

| 列 | 谁写 | 变化量 | 钳制 |
|---|---|---|---|
| `finance_orders.allocated_amount` | `addPayment` 两支 / `addOrderPayment` / `executePrepaymentAllocation` / `clearSelectedOrders` | `+= 本次分配额`（红冲时为负） | **无下限钳制** —— 红冲可以把它写成负数（`svc:348`、`svc:123`、`svc:372`、`svc:826`） |
| `finance_orders.unpaid_amount` | 同上 + `addOrderAdjustment` | 见各表 | 每处都 `Math.max(0, ...)`（`svc:124`、`svc:235`、`svc:349`、`svc:373`、`svc:827`） |
| `finance_orders.order_adjust_total` | `addOrderAdjustment` | `+= 调整金额`（正负不钳制，`svc:234`） | 无 |
| `finance_orders.status_text` | 所有财务写路径 | 由 `statusText(新 unpaid)` 重算 | 见 §8 |
| `orders.paid_amount` | `syncOrderAmounts` + 两处内联 | **= `finance_orders.allocated_amount` 的新值**（不是增量） | 无 |
| `orders.unpaid_amount` | 同上 | **= `finance_orders.unpaid_amount` 的新值** | 无 |
| `customer_balances.prepaid_balance` | `addPayment` 尾部 / `executePrepaymentAllocation` | `+= prepaidDelta` / `-= totalAllocated` | 分配那侧 `Math.max(0, ...)`（`svc:843`），加款那侧不钳制（`svc:397`） |
| `customer_balances.total_topup` | `addPayment` 尾部 | `+= max(prepaidDelta, 0)` —— **只有正数才计入**（`svc:398`、`svc:409`） | 负 delta 完全不影响 `total_topup` |
| `customer_balances.total_spent` | `executePrepaymentAllocation` | `+= totalAllocated`（`svc:844`） | 无 |
| `customer_balances.*` 其余写路径 | —— | **`addCustomerAdjustment` 完全不碰余额**（见 §3.3） | |

> `orders.total_amount` 在整条财务写路径里**从不被修改**。财务侧只写 `paid_amount` / `unpaid_amount`。这是「订单总价」与「财务三元组」会漂移的根源（见 §7）。

---

## 3. 逐个写操作的「进出账」表

### 3.1 `addPayment`（`svc:325-434`）—— 最复杂，两个互斥分支 + 一个公共尾部

**入参解析**（全部在事务外）：`svc:326-333`
- `amount = toNum(body['收款金额'])`（`svc:326`，缺省/非法 → `0`，见 `toNum` `svc:5-8`）
- `paymentDate`（`svc:327`，缺省 `nowDate()` `svc:14-20`，**本地时区当日零点**）
- `paymentMethod` 缺省 `'转账'`（`svc:328`）
- `rows = allocationRows(body)`（`svc:331` → `svc:137-140`，认 `分配列表` / `allocations` / `allocationList`，只保留纯对象元素）
- `receiptNo = 回执单号 ?? orderNo`（`svc:332`）
- `customerIdentity`（`svc:333` → `svc:82-89`，事务外一次 DB 读）

#### 分支 A：`receiptNo && rows.length === 0`（`svc:339-359`）

| 表 | 列 | 变化量 | 条件 |
|---|---|---|---|
| `payments` | 插入整行 | `amount = 收款金额`（**原样，可为负**） | 无条件（`svc:342-344`） |
| `finance_orders` | `allocated_amount` | `= 旧值 + amount` | 无条件（`svc:348`） |
| `finance_orders` | `unpaid_amount` | `= max(0, 旧值 + deltaUnpaid)`，`deltaUnpaid = amount ≥ 0 ? −(amount + 优惠) : |amount|`（`svc:347,349`） |
| `finance_orders` | `status_text` | `已结清` / `部分付款` | 无条件（`svc:352`） |
| `orders` | `paid_amount` | `= 新 allocated_amount` | `fo.orderId != null`（`svc:354-356`） |
| `orders` | `unpaid_amount` | `= 新 unpaid_amount` | 同上 |
| `customer_balances` / `customer_fund_flows` | —— | **不写** | 该分支 `return`（`svc:358`），尾部被跳过 |

- 校验：订单必须存在，否则 `throw new Error(\`订单 ${receiptNo} 不存在\`)`（`svc:341`）。
- `优惠` 的计算：`discount = Math.max(0, amount) * toNum(body['优惠比例'])`（`svc:346`）—— 注意**入参是「比例」不是金额**，且 `amount < 0` 时 `discount` 恒为 0。
- `allocatedAmount` 无钳制，红冲（`amount < 0`）可写成负数。

#### 分支 B：`rows.length > 0`（`svc:361-382`），逐行循环

| 表 | 列 | 变化量 | 条件 |
|---|---|---|---|
| `payments` | 每行插一条 | `amount = 行.分配金额` | `行.回执单号` 非空 **且** `分配金额 ≠ 0`（`svc:364`） |
| `finance_orders` | `allocated_amount` | `= 旧值 + 行.分配金额` | 同上 + 订单存在（`svc:372`） |
| `finance_orders` | `unpaid_amount` | `= max(0, 旧值 − 行.分配金额 − 行.优惠金额)` | 同上（`svc:373`） |
| `finance_orders` | `status_text` | 重算 | 同上（`svc:376`） |
| `orders` | `paid_amount` / `unpaid_amount` | `= 对应新值` | `fo.orderId != null`（`svc:378-380`） |

- `行.优惠金额` 是**绝对金额**（`svc:371`），与分支 A 的「比例」不是一个量纲。
- 订单不存在时**静默跳过**（`svc:366` `if (!fo) continue`），不报错。
- `paymentId` 每轮被覆盖（`svc:370`），返回值里只有**最后一条** payment 的 id。

#### 公共尾部：预付款（`svc:384-428`），两个分支之后（分支 A 已提前 return）

| 表 | 列 | 变化量 | 条件 |
|---|---|---|---|
| —— | `prepaidDelta` | `= 收款金额 − Σ已分配` | `Math.abs(prepaidDelta) > 0.005` 才继续（`svc:384-385`） |
| `payments` | 插入一条 | `amount = prepaidDelta`，**`orderId`、`financeOrderId` 均为 null** | 同上（`svc:388-390`） |
| `customer_balances` | `prepaid_balance` | `= 旧值 + prepaidDelta` | 记录已存在（`svc:393-400`） |
| `customer_balances` | `total_topup` | `= 旧值 + (prepaidDelta > 0 ? prepaidDelta : 0)` | 同上 |
| `customer_balances` | 插入整行 | `prepaidBalance = prepaidDelta`, `totalTopup = max(prepaidDelta,0)`, `totalSpent = 0` | 记录不存在（`svc:401-413`） |
| `customer_fund_flows` | 插入整行 | `amount = prepaidDelta`, `flow_type = prepaidDelta ≥ 0 ? '预付款' : '预付款冲销'` | 同上（`svc:414-427`） |

- `balanceCode = customerIdentity?.balanceCode || ''`；为空则 `throw new Error('客户编号不能为空')`（`svc:386-387`）。
- 余额分支不走 `ensureCustomerBalance`，是**手写的 findFirst + update/create**（`svc:392-413`），与 `svc:91-109` 的 upsert 是两份独立实现。

#### 分支判定条件（问题 7 的直接回答）

判定式只有一条：`receiptNo && rows.length === 0`（`svc:339`）。

| 输入组合 | 走哪支 | 结果 |
|---|---|---|
| 有 `回执单号`，无 `分配列表`（或 `分配列表: []`） | A | 全额记到该单；不走预付款 |
| 有 `回执单号`，有非空 `分配列表` | B | **顶层 `receiptNo` 被完全忽略**，只用每行的 `回执单号` |
| 无 `回执单号`，有 `分配列表` | B | 逐行分配，余数进预付款 |
| 无 `回执单号`，无 `分配列表` | B（空循环） | `allocatedTotal = 0` → `prepaidDelta = amount` → 整笔进预付款 |
| 有 `分配列表` 但每行都被 `svc:364` 过滤掉 | B（空循环） | 同上一行：**整笔变成预付款**，不报错 |
| 金额字段缺失/非法 | 任意 | `amount = 0`（`svc:5-8`）；若 `prepaidDelta` 也是 0 则 `|0| > 0.005` 为假 → **一次写都不发生，返回 200 success**（`svc:433`，`paymentId: null`） |

**所以是**：客户级收款 = 分支 B + 尾部；带分配列表的收款 = 分支 B；预付款 = 尾部。分支 A 是「单指定订单收款」的特例，**它自己就吃掉了整笔钱，不可能产生预付款**。

### 3.2 `addOrderPayment`（`svc:438-455`）

事务外读 `fo`（`svc:446`），然后两次写：

| 表 | 列 | 变化量 | 条件 |
|---|---|---|---|
| `payments` | 插入整行 | `amount`（原样） | 无条件（`svc:449-451`） |
| `finance_orders` | `allocated_amount` | `= 旧值 + amount` | 无条件（`svc:123`） |
| `finance_orders` | `unpaid_amount` | `= max(0, 旧值 + (amount ≥ 0 ? −amount : |amount|))` | 无条件（`svc:124`、`svc:452`） |
| `finance_orders` | `status_text` | 重算 | 无条件（`svc:130`） |
| `orders` | `paid_amount` / `unpaid_amount` | `= 上述新值` | 仅 `fo.orderId` 非空（`svc:112`） |

- 入参别名：`回执单号 ?? orderNo ?? body.orderNo`（`svc:439`），`收款金额 ?? amount`（`svc:440`）。
- **无折扣、无预付款**路径，也不检查是否超收。

### 3.3 `addCustomerAdjustment`（`svc:459-473`）

| 表 | 列 | 变化量 | 条件 |
|---|---|---|---|
| `customer_adjustments` | 插入整行 | `adjust_amount = 调整金额`（原样，可正可负）、`client_code = client?.clientCode ?? 入参`、`adjust_type 默认 '人工调整'` | **无条件**（`svc:471`） |

- **不写 `customer_balances` 的任何列**，不写 `customer_fund_flows`，不动任何订单。它是一条纯流水。
- 它影响「客户余额」的唯一途径是读取端 `getCustomerBalance` 的推导式 `客户余额 = Math.max(0, unpaidTotal − customerAdjustTotal)`（`svc:763`）。
- **无任何校验**：客户不存在不报错，`client_code` 可以为空串。

### 3.4 `addOrderAdjustment`（`svc:560-575`）

| 表 | 列 | 变化量 | 条件 |
|---|---|---|---|
| `order_adjustments` | 插入整行 | `adjust_amount = 调整金额`、`adjust_type 默认 '订单调整'`、`order_no` | 无条件（`svc:572`） |
| `finance_orders` | `order_adjust_total` | `= 旧值 + amount` | 找到 `orderNo` 对应的 finance_order（`svc:232-234`） |
| `finance_orders` | `unpaid_amount` | `= max(0, 旧值 − amount)` | 同上（`svc:235`） |
| `finance_orders` | `status_text` | 重算 | 同上（`svc:241`） |
| `orders` | `paid_amount` / `unpaid_amount` | `= 新 allocated / 新 unpaid` | `fo.orderId` 非空（`svc:244`） |

- 唯一校验是 `回执单号` 非空（`svc:562`）。
- **`finance_orders` 找不到时 `applyOrderAdjustmentToFinance` 返回 `null`（`svc:233`），接口照样返回 200 成功**（`svc:574`，`order: null`），而 `order_adjustments` 那条流水已经落库 —— 悬空流水。
- 这是**唯一一条会写 `order_adjust_total` 的用户路径**。

### 3.5 `updateOrderCustomer`（`svc:477-556`）—— 唯一一个不碰金额的写操作

事务内（`svc:490-541`）：

| 表 | 列 | 变化量 | 条件 |
|---|---|---|---|
| `orders` | `client_id` | `= client.id` | 无条件（`svc:524`） |
| `orders` | `customer_name` | `= 客户` | 无条件（`svc:525`） |
| `orders` | `door_specs` | **整串重写**（JSON.stringify） | 无条件（`svc:509-519, 526`） |
| `finance_orders` | `order_id` / `customer_name` | `= order.id` / `= 客户` | 无条件（`svc:530-533`） |
| `progress_records` | `customer_name` | `= 客户` | `updateMany`，匹配 `{ds, orderId}`（`svc:535-538`） |

`door_specs` 的重写规则（`svc:497-519`）：
- `customerInfo['客户']` / `['客户编号']` 被覆盖（`svc:511-515`）；
- `ping_hui` / `diao_hui` / `progressData` 三个数组（**若存在且是数组**）里每个对象行的 `客户` / `客户编号` 被覆盖（`svc:499-507`，经 `updateCustomerFields` `svc:43-50`；非对象元素原样返回 `svc:44`）；
- 这三个键**原本不是数组时保持原值**（`svc:516-518` 的条件展开）。

**不写任何金额列**：`allocated_amount` / `unpaid_amount` / `order_adjust_total` 一律不动。

校验（全在事务外，`svc:483-488`）：`回执单号` / `客户编号` / `客户` 非空，且 `客户编号` 必须能 `findClient` 到。

> ⚠️ `parseJsonRecord` 对无法解析的 `door_specs` 返回 `{}`（`svc:32-41`），随后 `svc:509-519` 会用这个 `{}` 作为基底重建字符串 —— **格式损坏的 `door_specs` 会被静默清空**。见 UNCERTAIN-4。

### 3.6 `executePrepaymentAllocation`（`svc:805-863`）

| 表 | 列 | 变化量 | 条件 |
|---|---|---|---|
| `finance_orders` | `allocated_amount` | `= 旧值 + alloc` | 每行，`alloc > 0` 且订单在 `unpaidOrders` 里（`svc:823-831`） |
| `finance_orders` | `unpaid_amount` | `= max(0, 旧值 − alloc − discount)` | 同上（`svc:827`） |
| `finance_orders` | `status_text` | 重算 | 同上（`svc:830`） |
| `orders` | `paid_amount` / `unpaid_amount` | `= 对应新值` | `fo.orderId` 非空（`svc:832-834`） |
| `order_adjustments` | 插入整行 | `adjust_amount = discount`, `adjust_type = '预付款优惠'` | `discount > 0`（`svc:836-840`） |
| `customer_balances` | `prepaid_balance` | `= max(0, 旧值 − totalAllocated)` | `balance` 非空（`svc:842-845`） |
| `customer_balances` | `total_spent` | `= 旧值 + totalAllocated` | 同上 |
| `customer_fund_flows` | 插入整行 | `amount = −totalAllocated`, `flow_type = '预付款分配'`, `payment_method = null` | `totalAllocated > 0`（`svc:846-860`） |

- **不创建 `payments` 行**（与 `addPayment` 相反）。
- 金额被静默钳制：`amount = Math.min(Math.max(0, requestedAmount), available)`（`svc:815`），`available = max(0, balance.prepaidBalance)`（`svc:814`）。
- **完全没有任何校验和报错**：余额不足就少分，没有订单可分就空转，返回 `分配成功`（`svc:862`）。

### 3.7 `clearSelectedOrders`（`svc:867-887`）

| 表 | 列 | 变化量 | 条件 |
|---|---|---|---|
| `payments` | 插入整行 | `amount = 未收金额`, `payment_method = '清账'`, `notes = '批量清账'`, `paymentDate = nowDate()` | 每个 `unpaid > 0` 的订单（`svc:874-878`） |
| `finance_orders` | `allocated_amount` | `= 旧值 + unpaid` | 同上（`svc:881`） |
| `finance_orders` | `unpaid_amount` | `= 0`（硬编码） | 同上（`svc:881`） |
| `finance_orders` | `status_text` | `= '已结清'`（**硬编码，不走 `statusText()`**） | 同上（`svc:881`） |
| `orders` | `paid_amount` / `unpaid_amount` | `= 旧 allocated + unpaid` / `= 0` | `fo.orderId` 非空（`svc:883` → `svc:113`） |

- 入参 `rows` / `data` / `selected`，元素可以是字符串、`{orderNo}` 或 `{回执单号}`（`svc:868-869`）。
- 订单不存在或 `unpaid <= 0` 时 `continue`（`svc:873, 875`）—— 这构成了**天然的重复执行保护**（第二次跑时 `unpaid` 已是 0）。

---

## 4. `syncOrderAmounts` vs `updateFinanceOrderAmounts`（问题 2）

```ts
// svc:111-120
async function syncOrderAmounts(orderId, allocatedAmount, unpaidAmount) {
  if (!orderId) return;                    // orderId 为空 → 静默跳过
  await prisma.order.update({ where: { id: orderId },
    data: { paidAmount: allocatedAmount, unpaidAmount } });
}

// svc:122-135
async function updateFinanceOrderAmounts(fo, deltaAllocated, deltaUnpaid) {
  const nextAllocated = toNum(fo.allocatedAmount) + deltaAllocated;
  const nextUnpaid = Math.max(0, toNum(fo.unpaidAmount) + deltaUnpaid);
  const updated = await prisma.financeOrder.update({ where: { id: fo.id },
    data: { allocatedAmount: nextAllocated, unpaidAmount: nextUnpaid, statusText: statusText(nextUnpaid) } });
  await syncOrderAmounts(fo.orderId, nextAllocated, nextUnpaid);
  return updated;
}
```

| | `syncOrderAmounts` | `updateFinanceOrderAmounts` |
|---|---|---|
| 写哪张表 | **只写 `orders`** | 先写 `finance_orders`，再转调 `syncOrderAmounts` 写 `orders` |
| 记账方式 | **绝对覆盖**：把 `orders.paid_amount` / `unpaid_amount` 直接设成传入值 | **增量输入 → 绝对值写入**（`fo` 快照 + delta） |
| 钳制 | 无 | 只钳 `unpaid`（`Math.max(0, …)`），`allocated` 不钳 |
| `status_text` | 不涉及 | 重算 |
| `orderId` 为空 | 静默 return（`svc:112`） | 同样经 `syncOrderAmounts` 静默跳过 |
| 调用点 | `svc:133`（被上面那个调）、`svc:244`（订单调整）、`svc:883`（批量清账） | **仅 `svc:452`**（`addOrderPayment`） |

**两者不冲突**，但**它们的调用者会互相打架**：

1. `updateFinanceOrderAmounts` 唯一调用者是 `addOrderPayment`，而 `fo` 是 `svc:446` 在**事务外**读的快照。两次并发 `addOrderPayment` 会各拿一份旧快照 → 后者覆盖前者（丢失更新）。
2. `addPayment` 的两个分支**没有复用** `updateFinanceOrderAmounts`，而是在 `svc:348-356` / `svc:372-380` 内联复刻了「+delta 再覆盖」的等价逻辑。三处算法等价但彼此独立，**改一处不会同步另外两处**。
3. `syncOrderAmounts` 在 `svc:244` 被传入 `toNum(updated.allocatedAmount)` —— `updated` 是刚 update 完的 FinanceOrder 返回值，这一步是对的；但 `addOrderAdjustment` 整体**不在事务里**（见 §5），所以 `finance_orders` 写成功、`orders` 写失败时，两张表会永久不一致。

---

## 5. 事务边界与半成品状态（问题 3）

### 用了 `$transaction` 的（仅 2 处）

| 函数 | 范围 | 出处 |
|---|---|---|
| `addPayment` | 覆盖分支 A、分支 B 循环、预付款尾部**全部写操作**（`payments` + `finance_orders` + `orders` + `customer_balances` + `customer_fund_flows`） | `svc:335-431` |
| `updateOrderCustomer` | 覆盖 `orders` + `finance_orders` + `progress_records` | `svc:490-541` |

`addPayment` 的事务内抛出的两个错误（`订单 X 不存在` `svc:341`、`客户编号不能为空` `svc:387`）会**整体回滚**，包括循环里已经写进去的 payment 和订单更新。这是全模块唯一一处真正原子的资金操作。

### **没有** `$transaction` 的（全部其余写路径）

| 函数 | 写序列（每步一次独立提交） | 失败时的半成品状态 |
|---|---|---|
| `addOrderPayment`（`svc:438-455`） | ① `payments.create`（`svc:449`）→ ② `finance_orders.update`（`svc:125`）→ ③ `orders.update`（`svc:113`） | ②失败 → **孤儿 payment**（钱记了、订单没动）。③失败 → `finance_orders` 与 `orders` 永久不一致 |
| `addOrderAdjustment`（`svc:560-575`） | ① `order_adjustments.create`（`svc:572`）→ ② `finance_orders.update`（`svc:236`）→ ③ `orders.update`（`svc:244`） | ②③失败 → **悬空调整流水**；`orderNo` 不存在时更是**必然**留下悬空流水（`svc:233` 返回 null，接口仍返 200） |
| `addCustomerAdjustment`（`svc:459-473`） | 只有 ① `customer_adjustments.create`（`svc:471`） | 单步写，无半成品问题 |
| `executePrepaymentAllocation`（`svc:805-863`） | 逐单：① `finance_orders.update`（`svc:828`）→ ② `orders.update`（`svc:833`）→ ③ 可能 `order_adjustments.create`（`svc:837`）；**全部订单跑完之后**才 ④ `customer_balances.update`（`svc:845`）→ ⑤ `customer_fund_flows.create`（`svc:847`） | **最危险的一处**：④之前任何一步失败，订单已标记为已收，但 `prepaid_balance` 没扣 → **预付款被重复使用（双花）**。即使④成功⑤失败，资金流水会缺失，但余额已扣 |
| `clearSelectedOrders`（`svc:867-887`） | 每个订单：① `payments.create`（`svc:876`）→ ② `finance_orders.update`（`svc:879`）→ ③ `orders.update`（`svc:883`）；循环 N 个订单 | 中途失败 → 前几个订单已清账、后面没清；某个订单内部失败 → 孤儿 payment（`allocated_amount` 未加、`unpaid` 未清） |

### 额外的事务时序问题（不是「有没有事务」，是「事务包没包住读」）

- `addPayment` 的 `customerIdentity`（`svc:333`）和 `fo` 查询（`svc:340` / `svc:365`）—— 前者在事务外，后者在事务内但**未加锁**（Prisma 默认隔离级别下 `findFirst` 不阻塞并发写）。
- `addOrderPayment` 的 `fo` 读在事务外（`svc:446`），写时才进——事实上连事务都没有。
- `executePrepaymentAllocation` 的 `balance` 读（`svc:811-814`）在**任何事务之外**且远离写点（`svc:845`），并发执行时两份请求都会读到同一 `prepaidBalance`，各自扣一次，**余额被扣两次但只够扣一次**。
- `addPayment` 用 Prisma 交互式事务，默认 `timeout` 5s / `maxWait` 2s（Prisma 默认值，非本仓库配置 —— 见 UNCERTAIN-5）。批量清账/大分配列表若走 `addPayment` 分支 B，有超时整体回滚的风险。

---

## 6. 校验与错误文案（问题 4）

### 服务层抛出的原文（`svc`）

| 函数 | 文案 | 行 |
|---|---|---|
| `addPayment` 分支 A | `` `订单 ${receiptNo} 不存在` `` | `svc:341` |
| `addPayment` 预付款尾部 | `客户编号不能为空` | `svc:387` |
| `addOrderPayment` | `orderNo 不能为空` | `svc:445` |
| `addOrderPayment` | `` `订单 ${orderNo} 不存在` `` | `svc:447` |
| `updateOrderCustomer` | `回执单号不能为空` | `svc:483` |
| `updateOrderCustomer` | `客户编号不能为空` | `svc:484` |
| `updateOrderCustomer` | `客户不能为空` | `svc:485` |
| `updateOrderCustomer` | `` `客户 ${customerCode} 不存在` `` | `svc:488` |
| `updateOrderCustomer` | `` `订单 ${orderNo} 不存在` `` | `svc:495` |
| `addOrderAdjustment` | `回执单号不能为空` | `svc:562` |

### 路由/分发层的前置校验

| 位置 | 文案 |
|---|---|
| `routes:39` | `参数错误: orders 必须是一个数组` |
| `routes:56, 72, 88, 104, 174, 190, 206, 222` | `参数错误: 请求体不能为空` |
| `routes:144` | `参数错误: orderNo 不能为空` |
| `dispatch:852` | `缺少 ds/客户编号/收款金额/收款日期`（仅检查 body 非空对象，`dispatch:374-376`） |
| `dispatch:856, 860, 864, 868` | `缺少必要参数` |
| `dispatch:847` | `请求体为空或格式错误` |
| `dispatch:895` | `缺少 ds / 客户编号 / 收款金额` |
| `dispatch:899, 903` | `缺少 ds/客户编号/分配金额` |
| `dispatch:387` | `bad request`（`clearselectedorders`，`dispatch:906-907`） |

⚠️ `hasBodyKeys` 只判「body 是非空对象」（`dispatch:374-376`），所以这些「缺少 XX」的文案对**字段级缺失毫无保护**。

### 错误最终以什么形态到达客户端 —— **两条入口完全不同**

1. **旧版 `param1` 分发**（`dispatch:1181-1185`）：`catch` 后
   ```js
   res.status(200).json({ code: 400, message: msg });
   ```
   → **HTTP 200，body 里 `code: 400`**，`msg` 就是上表 `svc` 的原始文案。旧前端靠 body 里的 `code` 判错。

2. **Express REST 路由**（`routes:17` 等一律 `next(err)`）：进入 `errorHandler`（`error.mw:14-22`），而 `svc` 抛的是普通 `Error` 不是 `AppError` → 走 `error.mw:20-21`：
   ```js
   console.error('Unhandled error:', err);
   res.status(500).json({ code: 500, message: '服务器内部错误' });
   ```
   → **HTTP 500 + `服务器内部错误`**，上面那些具体文案**全部被吞掉**。

### 校验的**缺失**（同样是口径的一部分）

- `addCustomerAdjustment`：**零校验**（客户可不存在、金额可任意）。
- `executePrepaymentAllocation`：**零校验**，余额不足静默少分。
- `clearSelectedOrders`：**零校验**。
- 所有写路径：**没有金额上限/下限校验**，没有「余额是否够」校验，没有「是否超收」校验（`unpaid` 一律钳到 0，超出部分凭空消失到 `allocated` 里）。
- 所有写路径：**没有检查 `orders.unpaid_amount` / `finance_orders.unpaid_amount` 是否一致**。

---

## 7. 正负号口径（问题 5）

约定：**红冲 / 抹零 / 优惠全部走「正数入参 + 反向 delta」或「负数入参」两种不同机制，各写路径不统一。**

| 场景 | 入参符号 | `allocated_amount` | `unpaid_amount` | `order_adjust_total` | 出处 |
|---|---|---|---|---|---|
| 正常收款（单订单） | `amount > 0` | `+amount` | `−(amount + 优惠)` | 不变 | `svc:346-349` |
| 正常收款（分配列表） | 行 `分配金额 > 0` | `+alloc` | `−(alloc + 优惠金额)` | 不变 | `svc:371-373` |
| **红冲**（单订单） | `amount < 0` | `+amount`（负，**可成负数**） | `+|amount|`（增加） | 不变 | `svc:347-349` |
| **红冲**（分配列表，由 `previewAllocation` 生成） | 行 `分配金额 < 0` | `+alloc`（负） | `−alloc`（增加） | 不变 | `svc:187-196`, `svc:372-373` |
| **优惠 / 抹零** | **正数**（`优惠金额` 或 `优惠比例`） | 不变 | `−优惠`（减少） | **不变** | `svc:373` / `svc:346-347` |
| **订单调整** | **正数** | 不变 | `−amount` | `+amount` | `svc:234-235` |
| 订单调整（反做） | 负数 | 不变 | `+|amount|` | `−|amount|` | 同上 |
| **预付款优惠** | 正数 | 不变 | `−discount` | **不改，改的是 `order_adjustments` 流水** | `svc:827, 836-840` |
| 预付款充值 | `prepaidDelta > 0` | —— | —— | —— | `prepaid_balance += `, `total_topup += `（`svc:397-398`） |
| 预付款冲销 | `prepaidDelta < 0` | —— | —— | —— | `prepaid_balance += `（减），`total_topup` **不动**（`svc:398`），流水 `flow_type='预付款冲销'`（`svc:422`） |
| 预付款分配 | 内部 `totalAllocated > 0` | 各单 `+alloc` | 各单 `−(alloc+discount)` | 写 `order_adjustments` | `svc:826-845` |
| 批量清账 | 内部 `unpaid > 0` | `+unpaid` | `= 0` | 不变 | `svc:879-882` |

### 三条必须记住的符号/恒等式结论

1. **只有 `order_adjust_total` 能保住「订单总价」**：`getOrderDetail` 算总价用 `allocated + unpaid + orderAdjustTotal`（`svc:719`，以及 `orderTotal` `svc:57-60`）。订单调整把 `unpaid` 挪进 `orderAdjustTotal`，恒等式不破。
2. **`addPayment` 的优惠是「凭空消失」的**：两个分支（`svc:346-347`、`svc:371-373`）都只减 `unpaid`，**从不写 `order_adjustments`**。所以走 `addPayment` 给的优惠会让 `allocated + unpaid + orderAdjustTotal` 永久变小 —— **订单总价缩水**。同样给优惠，`executePrepaymentAllocation` 会补一条 `order_adjustments`（`svc:837-839`），`addPayment` 不会。这是两条路径的实质差异。
3. **红冲会破坏所有下游的「总价」视图**：`allocated_amount` 被写成负数后，`allocated + unpaid + orderAdjustTotal` 不再是订单原价。

---

## 8. `status_text` 的口径分裂（写路径的副作用）

`svc` 的 `statusText()`（`svc:52-55`）：`unpaid <= 0 → '已结清'`，否则 `'部分付款'`。

但**同一列**在别的模块里被写成另一套值：

| 出处 | 写入值 |
|---|---|
| `svc:130, 241, 352, 376` | `已结清` / `部分付款` |
| `svc:881`（批量清账） | 硬编码 `已结清` |
| `order.svc:572, 579`（`combine` 合并订单） | `已结清` / `未付清` |
| `order.svc:708`（`deleteRow`） | `已结清` / `未付清` |
| `order.svc:816`（`persistUpdatedOrder`） | `已结清` / `未付清` |
| `client.svc:543, 550`（保存订单） | `已结清` / `未付清` |
| `progress.svc:397-410`（`updatePaymentCollection`，`progress.svc:365`） | **完全不写 `status_text`**（只写 `allocatedAmount` / `unpaidAmount` / `orderId` / `customerName`） |

→ `status_text` 的取值集合实际是 `{已结清, 部分付款, 未付清, null}`，取决于最后写它的是哪个模块。任何依赖 `status_text` 做判断的读取逻辑都不可靠。

---

## 9. 幂等性（问题 6）

**结论：全模块零幂等设计。**

- 没有任何去重键：`payments` 表只有 `@@index([databaseName])`（`schema:171`），**无唯一约束**；`customer_fund_flows` 同理（`schema:192-194`）；`order_adjustments` 只有普通索引（`schema:241`）。
- 没有任何「已处理」标记位，没有请求 id / 幂等键字段（`schema:156-243` 全部字段已列）。
- `addPayment` / `addOrderPayment` / `addOrderAdjustment` / `addCustomerAdjustment` / `executePrepaymentAllocation` **重复提交 = 重复扣加**：多一条 `payments` 行，`allocated_amount` 再加一次，`unpaid_amount` 再减一次。
- `addPayment` 的预付款尾部还会额外产生一条 `customer_fund_flows`，`prepaid_balance` 再加一次。
- **唯一的例外是 `clearSelectedOrders`**（`svc:874-875`）：因为条件是 `unpaid > 0` 才处理，第二次执行时 `unpaid` 已是 0 → 跳过。这是**副作用带来的偶然幂等**，不是设计出来的。
- `executePrepaymentAllocation` 是**最不能被重复提交**的：重复执行会按剩余未收继续分配并再次扣减 `prepaid_balance`（`svc:845`）。

---

## 10. 会与财务写路径打架的「外部写入者」

财务列并非只有 `finance` 模块在写。以下每一处都与 §2 的增量模型冲突：

| 出处 | 写什么 | 用的公式 / 口径 | 冲突点 |
|---|---|---|---|
| `order.svc:561-581`（`combine`，`order.svc:400`） | `finance_orders` upsert：`allocated = paidAmount`, `unpaid = unpaidAmount`；**create 分支额外写 `orderAdjustTotal: 0`（`order.svc:570`），update 分支不写该列** | 从合并载荷的 `定金`/`总价` 重算 | 目标订单号**原本没有** finance 行时，历史调整合计被清零；已有行时该列保留。`status_text` 用 `未付清`（`order.svc:572, 579`） |
| `order.svc:583-592` | `payments` 重指到新 `orderId`/`financeOrderId` | —— | 合并后历史收款记录归属改变，但 `finance_orders.allocated_amount` 用的是载荷里的 `paidAmount`，两者可能不等 |
| `order.svc:691-692, 704-712`（`deleteRow`，`order.svc:603`） | `finance_orders.unpaid_amount = max(0, totalAmount − order.paidAmount)`，`status_text` | **整表重算式** | 与财务模块的「增量」模型不同源；`addPayment` 给过的优惠（未落 `order_adjustments`）会在这里被**还原**回 unpaid —— 优惠静默消失 |
| `order.svc:798-799, 812-819`（`persistUpdatedOrder`，`order.svc:772`） | 同上 | 同上 | 同上 |
| `client.svc:532-551` | `finance_orders` upsert，`allocated = paidAmount`, `unpaid = unpaidAmount`, `orderAdjustTotal = 0` | 从客户端载荷重算 | **`orderAdjustTotal` 被清零** |
| `progress.svc:392-412`（`updatePaymentCollection`，`progress.svc:365`） | `finance_orders.allocated = max(旧 allocated, newAmount)`；`unpaid = max(0, totalAmount − newAmount − orderAdjustTotal)` | **单调不减 + 按总价重算** | `max(旧, 新)` **完全抹掉红冲**（负的 allocated 会被拉回 0 或更高）；同时**不写 `status_text`** |
| `progress.svc:419-427` | `payments.create`，`paymentMethod='手动收款调整'`，**不写 `financeOrderId`** | 只在 `delta != 0` 时 | 这条收款流水**不会出现在 `getOrderDetail` 的「分配明细」里**（读取端按 `financeOrderId` 过滤，`svc:691`），但会出现在 `getPaymentStats` 里（`svc:582-596` 不按 `financeOrderId` 过滤）→ **两个读取口径对不上** |
| `client.svc:628-633` / `order.repository.ts:74` / `settings.service.ts:297-300` | `finance_orders` / `customer_balances` **deleteMany** | —— | 删客户/删订单/清库时余额行一并删除，**无任何补偿流水** |

**给新系统的启示**：如果新系统要保留 `allocated / unpaid / orderAdjustTotal` 这套冗余列，必须先把「谁是唯一写入者」定死，否则照抄旧版的多写者模型必然复现上述漂移。

---

## 11. `addToCustomerBalance`（`svc:248-259`）—— **死代码，但记录了设计意图**

```ts
async function addToCustomerBalance(ds, customerCode, amount, customerName?) {
  if (!customerCode || amount === 0) return;
  const balance = await ensureCustomerBalance(ds, customerCode, customerName);
  const topupDelta = amount > 0 ? amount : 0;
  await prisma.customerBalance.update({ where: { id: balance.id },
    data: { prepaidBalance: toNum(balance.prepaidBalance) + amount,
            totalTopup: toNum(balance.totalTopup) + topupDelta } });
}
```

- **全仓无任何调用点**（只有 `svc:248` 的定义自身）。`addPayment` 的尾部（`svc:392-413`）是它的内联副本。
- 它的存在说明「余额写入」本该是一个共用 helper；实际被复制成了两份（`svc:248-259` 与 `svc:392-413`）外加 `ensureCustomerBalance`（`svc:91-109`）的 upsert 共三份。
- `ensureCustomerBalance` 的**唯一活调用点在读取端**：`getCustomerBalance`（`svc:735`）。也就是说 **`GET /customer-balance` 会 upsert 一行 `customer_balances`** —— 一个 GET 请求产生写操作，且 `update` 分支会回填 `clientId` / `customerName`（`svc:104-107`）。

---

## 12. 一处路由 bug（影响写入前置）

`routes:184-197` 的 `POST /preview-prepayment-allocation` 调用的是 `financeService.previewAllocation`（`routes:192`），**不是** `previewPrepaymentAllocation`。

而旧版分发路径 `dispatch:898-901` 调用的是**正确的** `previewPrepaymentAllocation`（`svc:788-801`）。

→ 同一个业务动作，走 REST 路由时 **不返回 `availableBalance` / `requestedAmount`，也不按余额钳制金额**，走旧版 `param1` 分发时才是对的。新系统若参考 REST 路由会抄错。

（`previewPrepaymentAllocation` 因此**不是死代码**，见 UNCERTAIN-2 的说明。）

---

## 13. UNCERTAIN（无法从这份源码单独确证）

1. **`preview-prepayment-allocation` 的 REST 路由是否有真实调用方**。
   `routes:192` 的写法在旧版分发路径上不存在（`dispatch:900` 是对的），所以结论「REST 路由写错了」是 CONFIRMED；但「这个错误是否被实际触发过」取决于有没有客户端调 REST 版本的该路由 —— 配置文件与客户端代码不在本次范围内。**建议**：新系统以 `dispatch:900` 的语义为准。

2. **前端实际发送的 body 形状**（尤其 `优惠比例` 的量纲、红冲是否真的靠传负数）。
   我无法读到旧前端调用方（`/Users/aaa/Downloads/` 下只有 `server`，仓库 `legacy/` 里也没有财务页面的 bundle）。因此：
   - 「`优惠比例` 是比例（0–1）还是百分数（如 5 表示 5%）」**UNCERTAIN**。`svc:346` 只做乘法不除 100，`buildAllocationPreview` 里也是 `alloc * discountRate`（`svc:206`）。若前端传 `5`，优惠会是分配额的 5 倍，然后被 `Math.max(0, unpaid − alloc − discount)` 钳成 0。**建议对新系统显式定义并做上限校验。**
   - 「红冲是不是就是传负数收款金额」**UNCERTAIN**：`svc:179` 的 `isRefund = amount < 0` 强烈暗示是，但没有前端证据。

3. **`status_text` 各取值的消费方**。
   我只能证明写入值集合是 `{已结清, 部分付款, 未付清, null}`（§8）。哪种值被哪个读取端当成什么，属于读取口径，本次未查。

4. **`door_specs` JSON 损坏是否真实发生**。
   `parseJsonRecord`（`svc:32-41`）对坏 JSON 返回 `{}`，`updateOrderCustomer`（`svc:509-519`）会据此重写整串 —— **代码路径上会静默清空 `door_specs`**（CONFIRMED 的代码行为）。但现实中该列是否存在坏 JSON，需要查数据，本次未查。

5. **Prisma 交互式事务的超时数值**。
   `svc:335` 的 `$transaction` 未传 options，因此适用 Prisma 默认（`maxWait` 2s / `timeout` 5s）。仓库内没有覆盖配置（未查到相关 PrismaClient 构造参数）。这属于**框架默认值**而非本仓库明文，故列为 UNCERTAIN。

6. **`combine` 合并时的 `unpaidAmount` 具体来源**。
   `order.svc:561-581` 用的 `paidAmount` / `unpaidAmount` 变量，我只读到 `order.svc:462`（`paidAmount = numberValue(merged['定金'])`）与 `totalAmount`（`order.svc:461`），`unpaidAmount` 的赋值行未逐行核对（合并路径超出本次范围）。上表 §10 对 `combine` 的描述中「create 分支写 `orderAdjustTotal: 0`」是 CONFIRMED（`order.svc:570`），但 `unpaidAmount` 与 `totalAmount` 的具体算式**UNCERTAIN**。

7. **`GET /customer-balance` 的写副作用是否有意为之**（§11）。
   代码事实 CONFIRMED（`svc:735 → svc:93` 的 upsert），设计意图 UNCERTAIN。

---

## 14. CONFIRMED 摘要（新系统可直接采信）

- 存量冗余列全部是「读快照 + JS 计算 + 绝对覆盖写」，**无一处原子自增**（§2）。
- 只有 `addPayment` 与 `updateOrderCustomer` 有 `$transaction`；其余 5 个写路径无事务（§5）。
- `addPayment` 的预付款尾部在**分支 A 被提前 return 跳过**（`svc:358`）→ 指定订单收款不可能产生预付款（§3.1）。
- `addPayment` 的优惠**不落 `order_adjustments`** → 订单总价缩水；`executePrepaymentAllocation` 的优惠**落流水** → 总价守恒（§7）。
- `addOrderAdjustment` 在没有对应 `finance_orders` 行时**仍返回 200 并留下悬空流水**（`svc:233, 573-574`）（§3.4）。
- `executePrepaymentAllocation` 的余额扣减在**所有订单更新之后**、且**无事务**（`svc:842-845`）→ 可双花（§5）。
- 零幂等设计，重复提交必然重复记账；唯一天然保护是 `clearSelectedOrders` 的 `unpaid > 0` 前提（§9）。
- 所有服务层校验失败，在**旧版分发路径上**是 `HTTP 200 + {code:400, message: 原文}`（`dispatch:1184`），在 **REST 路由上**被 `error.mw:20-21` 吞成 `HTTP 500 + 服务器内部错误`（§6）。
- `finance_orders.status_text` 的写入值在模块间不统一（§8）。
- `addToCustomerBalance`（`svc:248-259`）是死代码；`ensureCustomerBalance` 在 GET 端被调用并产生写（§11）。
