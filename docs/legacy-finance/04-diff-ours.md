# 旧服务端 vs 新后端：财务口径差异（自查稿）

> **状态：这是我（主会话）自己逐行读 `/Users/aaa/Downloads/server` 得到的，尚未与
> `01-read.md` / `02-write.md` / `03-allocation.md` 三份 agent 文档对表，也尚未做对抗验证。**
> 三份文档齐了之后要合并成一份定稿，本节标题改成「已核」。
>
> 来源统一简写：`svc:N` = `/Users/aaa/Downloads/server/src/modules/finance/finance.service.ts:N`。

---

## 0. 架构差异（先看这条，否则后面每一条都会误判）

| | 旧服务端 | 新后端 |
|---|---|---|
| 余额 | **存成冗余列 + 增量维护**：`FinanceOrder.allocatedAmount/unpaidAmount`、`CustomerBalance.{prepaidBalance,totalTopup,totalSpent}`、`Order.{paidAmount,unpaidAmount}` | **纯追加流水表 + 每次实时聚合**：`finance_payments` / `finance_allocations` / `finance_order_adjustments` / `finance_customer_adjustments` |
| 维护者 | `updateFinanceOrderAmounts`(svc:122) 按 **delta** 加减；`syncOrderAmounts`(svc:111) 把结果**覆盖**写到 `orders` 上 | 无（不存派生值） |

⇒ 对账时**不能只比公式**：同一个字段两边算法完全不同是正常的，
**要比的是「同一个业务动作之后，两边给出的数是否相同」**。

⚠️ 旧版的增量维护本身会漂移（我们删除红冲踩的坑同源）。**不代表旧版是「对的」** ——
遇到两边不一致时，先判断是「我们算错」还是「旧版漂了」。

---

## 1. ⭐ `getCustomerBalance`（svc:730-778）—— 字段语义基本对不上

旧版实现（逐行读出）：

```js
orderTotalAmount  = Σ (fo.allocatedAmount + fo.unpaidAmount + fo.orderAdjustTotal)   // svc:748
allocated         = Σ fo.allocatedAmount                                            // svc:749
unpaidTotal       = Σ fo.unpaidAmount                                               // svc:750
orderAdjustTotal  = Σ orderAdjustments.adjustAmount                                 // svc:751
customerAdjustTotal = Σ customerAdjustments.adjustAmount                            // svc:752
```

对外字段：

| 响应字段 | 旧服务端 | 新后端现在 | 判断 |
|---|---|---|---|
| `实收金额` | `CustomerBalance.totalTopup`（**存量列**，svc:762） | `Σ finance_payments.amount` | 口径待定 |
| `未分配余额` | `CustomerBalance.prepaidBalance`（**存量列**，svc:766） | `实收 − (订单级收款 + Σallocations)` | 口径待定 |
| **`客户余额`** | **`max(0, unpaidTotal − customerAdjustTotal)`（svc:763）** | `订单总额 − 实收 − 订单调整 − 客户调整`（**可负**） | ⛔ **语义相反** |
| `订单总额` | `Σ(allocated + unpaid + orderAdjustTotal)`（svc:748） | `Σ orders.total_price` | 口径待定 |
| `已分配金额` | `Σ fo.allocatedAmount`（svc:749） | `Σ 订单级收款 + Σ allocations` | 口径待定 |
| `订单调整合计` | `Σ orderAdjustments.adjustAmount` | 同 | ✅ 一致 |
| `客户调整合计` | `Σ customerAdjustments.adjustAmount` | 同 | ✅ 一致 |

### ⛔ 最要紧的一条：`客户余额` 两边含义相反

- **旧版**：`客户余额` = **客户还欠多少**（≥0）。已多付时它是 0，多付的钱在 `未分配余额` 里。
- **新版**：`客户余额` = 客户账上的**净额**，**可以为负**（负 = 客户有钱在我们这儿）。

同一张单，同一笔钱，**界面会显示成两个不同的数**。这是财务抽屉上直接可见的字段。

⚠️ 还要注意：`getCustomerBalance` 会调 `ensureCustomerBalance`(svc:91) ——
**一个「读」接口里 upsert 了一张表**（不存在就建全 0 的行）。

---

## 2. ⭐ 优惠（discount）：旧版**有三套**公式，我们还有第四套

| # | 路径 | 公式 | 记账 |
|---|---|---|---|
| ① | `buildAllocationPreview`(svc:206) | `min(unpaid − alloc, round(alloc × rate × 100)/100)` | ✅ 写 `orderAdjustments`，`adjustType:'预付款优惠'`(svc:836-840) |
| ② | `addPayment` 单张单分支(svc:346) | `max(0, amount) × rate` —— **无上限、无四舍五入** | ❌ **不写任何调整**，只改 `unpaidAmount` |
| ③ | `addPayment` 带分配列表(svc:371) | **直接取客户端传的 `优惠金额`** | ❌ 同上 |
| ④ | **我们** | `round2(unpaid × rate/100)`，再 `.min(资金池余额)` | 写进 `finance_allocations.amount`（`amount = alloc + disc`） |

### 最关键的分歧：优惠**是不是从资金池出的钱**

- **旧版**：优惠记成**订单调整**（`orderAdjustments`，类型 `预付款优惠`）；
  预付款余额**只减 `Σalloc`，不减优惠**（`newPrepaid = prepaidBalance − totalAllocated`，svc:843）。
  ⇒ 优惠是**店家让利**，不是资金流动。
- **我们**：优惠塞进 `finance_allocations.amount`（`amount = alloc + disc`），
  且 `pool_remaining = 未分配 − 申请额 − 优惠`。
  ⇒ 优惠被当成**从客户池子转出**。

数值后果（未收 1000、分 500、rate 10%）：

| | 订单未收 | 客户余额 | 资金池 |
|---|---|---|---|
| 旧版 | 1000−500−50 = **450** ✅ | −450 | 只减 **500** |
| 我们 | 1000−550−0 = **450** ✅ | **−500** ✗ | 减 **550** ✗ |

订单层碰巧一样（我们靠 `amount` 里塞优惠、旧版靠 `orderAdjustments`），
**客户侧差一个优惠额**。

### 另外三处

- **优惠上限**：旧版 ① 有 `min(unpaid − alloc, …)`；我们**没有**。
- **资金池上限**：旧版 `amount = min(requested, CustomerBalance.prepaidBalance)`（svc:798 / svc:816）；
  我们**完全不封顶**。
- **`优惠比例` 的单位**：旧版是**小数**（0.05 = 5%，svc:782 直接乘）；
  我们前端发**百分数**（10），后端除 100。
  两边各自自洽 ✅，但**接口契约不同**，将来对接/迁移要注意。

---

## 3. `资金池剩余`：同名不同物

- 旧版 `buildAllocationPreview` 返回的 `资金池剩余` = `remaining` = **本次拟分配里没分掉的部分**（svc:227）。
- 我们 `preview_prepayment_allocation` 返回的 `pool_remaining` = `未分配余额 − 申请额 − 优惠`。

同一个字段名，一个是「本次剩下的」，一个是「客户池子还剩多少」。

---

## 4. 分配顺序（两边一致 ✅）

- 旧版 `financeOrdersForCustomer`：`orderBy: [{order:{orderDate:'asc'}}, {createdAt:'asc'}]`（svc:158/166），
  且 `unpaidOrdersForCustomer` 过滤 `unpaidAmount > 0`（svc:170-172）。
- 我们：`ORDER BY order_date, id`（`service.rs` 的 `preview_allocation`）。

⚠️ 细节差异：旧版同日单按 **`FinanceOrder.createdAt`**（财务行创建时间），我们按 **`orders.id`**。
绝大多数情况同序，**但不保证**。待定级。

---

## 5. `statusText`（svc:52-55）

`unpaid <= 0 ? '已结清' : '部分付款'` —— **只有两个值**。我们没这个字段，待定是否要补。

---

## 6. `orderTotal(fo)`（svc:57-60）

```js
toNum(order.totalAmount) || (allocatedAmount + unpaidAmount + orderAdjustTotal)
```
⚠️ 注意是 `||` 不是 `??` —— **`totalAmount` 为 0 时也会走回退分支**。

---

## 7. 事务边界（初步，待 `02-write.md` 补全）

- `executePrepaymentAllocation`(svc:805-865)：**逐单顺序 await，没有 `$transaction`** ⇒
  中途失败会留下「前几单已分配、池子未扣」的半成品。
- `clearSelectedOrders`(svc:867-887)：**没有事务**，逐单 create payment + update。
- `addPayment`(svc:325+)：**有事务**（`tx`）。

⇒ 旧版自己就不一致。我们**不该照抄「没有事务」**，但要知道旧版的失败形态。

---

## 8. ⭐ 存量列是怎么维护的（决定「我们架构要不要改」）

这是**最要紧的一条结构结论**。旧版那两个关键存量列由 `addToCustomerBalance`(svc:248-259) 维护：

```js
const topupDelta = amount > 0 ? amount : 0;
prepaidBalance += amount                 // 正负都加
totalTopup     += topupDelta             // ★ 负数**不减** —— 只增
```

`addPayment` 里的落库（svc:386-427）同构：

```js
const prepaidDelta = amount - allocatedTotal;          // svc:386「没分到具体订单的那部分」= 池子充值
prepaidBalance += prepaidDelta
totalTopup     += (prepaidDelta > 0 ? prepaidDelta : 0)
customerFundFlow.create({ amount: prepaidDelta, flowType: prepaidDelta >= 0 ? '预付款' : '预付款冲销' })   // svc:414-427
```

### ⇒ 三条结论

1. **`CustomerFundFlow` 与 `prepaidDelta` 一一对应**（同一个数），
   所以 `prepaidBalance = Σ flow.amount`、`totalTopup = Σ max(0, flow.amount)` ——
   **存量列可以从流水完整推导**。
   ⇒ **我们的「纯追加流水 + 实时聚合」架构不用改**，改公式即可。
2. ⭐ **`实收金额` 是「累计充值」，不是「净收款」** —— 红冲**不减它**
   （`totalTopup += max(0, delta)`，svc:257/398/409）。
   我们的 `Σ finance_payments.amount` **是净额、红冲会减** ⇒ **口径不同，要改**。
3. `prepaidDelta` 的定义：**本次收款里没有分配到具体订单的那部分**（svc:386）——
   这正是我们 `finance_allocations` 之外那笔「客户级收款」的对应物。

## 9. 事务边界（补全，svc 实读）

| 函数 | 事务 | 失败形态 |
|---|---|---|
| `addPayment`(:325) | ✅ `tx` | 全回滚 |
| `executePrepaymentAllocation`(:805) | ❌ 逐个 await | 可能「前几单已分配、池子未扣」 |
| `clearSelectedOrders`(:867) | ❌ 逐个 await | 可能只清了一部分 |

⇒ 旧版自己不一致。**不该照抄「没有事务」**，但要记下旧版的失败形态，
我们这边可以用事务做得更强（属有意的改进，写进注释）。

## 10. 待办

- [ ] 等 `01-read.md` / `02-write.md` / `03-allocation.md`，与本稿对表，冲突处回源码裁决
- [ ] 对关键结论做**对抗验证**（派独立 agent 试着推翻）
- [ ] 定级：哪些必须改（钱错的）、哪些是契约差异（要拍板）、哪些是旧版自身瑕疵（不照抄）
- [ ] `客户余额` 语义、优惠归属 —— 这两条要请用户拍板后再动代码
