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
| `实收金额` | `CustomerBalance.totalTopup`（**存量列**，svc:762） | 「累计充值」：客户级收款**逐笔减掉本笔的分配**、逐笔夹零后求和 | ✅ 已对齐（改动 5 + 2026-09-20 的第二处修正，见 §9.8） |
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
   我们的 `Σ finance_payments.amount` **是净额、红冲会减** ⇒ **口径不同**。
   已改（改动 5 去掉净额里的负数，2026-09-20 再补上「减掉本笔分配」那一步，见 §9.8）。
3. `prepaidDelta` 的定义：**本次收款里没有分配到具体订单的那部分**（svc:386）——
   即「这一笔收款减掉它自己的分配额」。
   ⚠️ **不要**把它当成我们那张「客户级收款行」的对应物：我们记的是**全额** `amount`，
   分配另存在 `finance_allocations` 里；旧版则是**写入时就减好**、客户级行的 `amount`
   本身就是余额。两者的差值恰恰要靠 `finance_allocations.payment_id` 才能补回来（§9.8）。

## 9. 事务边界（补全，svc 实读）

| 函数 | 事务 | 失败形态 |
|---|---|---|
| `addPayment`(:325) | ✅ `tx` | 全回滚 |
| `executePrepaymentAllocation`(:805) | ❌ 逐个 await | 可能「前几单已分配、池子未扣」 |
| `clearSelectedOrders`(:867) | ❌ 逐个 await | 可能只清了一部分 |

⇒ 旧版自己不一致。**不该照抄「没有事务」**，但要记下旧版的失败形态，
我们这边可以用事务做得更强（属有意的改进，写进注释）。

## 9.5 ⭐ 实测证据（差分台跑出来的，不是读出来的）

`05-diff-alloc.mjs`（分配/优惠）与 `06-diff-balance.mjs`（余额/实收）：
左边跑**旧服务端的真代码**（函数原样切出来跑，Prisma 换成桩），右边打**我们的真接口**。

### 优惠（三张单 1000/500/300，优惠 10%）

| 收款额 | 旧版优惠 | 新版优惠 |
|---|---|---|
| 800（只部分覆盖第一单） | 80 | 80 ✅ |
| **1000（正好付清第一单）** | **0** | **100** ⛔ |
| 1500 | **0** | **150** ⛔ |
| 1800 | **0** | **180** ⛔ |
| 1500 @5% | **0** | **75** ⛔ |

⇒ **在「收款刚好覆盖整单」这个最常见场景下，我们给出了旧系统从没给过的优惠。**
（`unpaid − alloc` 那条上限：整单付清时它恰好是 0。）

### 余额/实收（6 个场景，11 处不一致）

| 场景 | 字段 | 旧版 | 新版 |
|---|---|---|---|
| 池子打 1000（未分配） | `客户余额` | **1000** | **0** ⛔ |
| 再分配 600 | `客户余额` | **400** | **0** ⛔ |
| 预付款优惠 50 | `客户余额` | **350** | **−50** ⛔ |
| 池子红冲后为负 | `实收金额` | **1000** | **−200** ⛔ |
| 池子红冲后为负 | `客户余额` | **1000** | **1200** ⛔ |
| 客户抹零 80 | 全部 | — | ✅ 碰巧一致 |

`未分配余额`、`订单总额`、两项调整合计 **全部一致 ✅** ——
说明我们的**池子算法本身是对的**，错的是 `客户余额` / `实收金额` 这两个字段的**定义**。

## 9.6 ⭐⭐ 执行后的落库效果（`07-diff-execute.mjs`）—— 比预估的严重

比的是**跑完之后两边的状态**（旧版跑真代码 + 记账桩；新版打真接口再读回库）。
夹具：订单 A 未收 1000、B 未收 500，客户池子里有 `pool`。

| 场景 | | 资金池变化 | 池子余额 | A 未收 | B 未收 | 订单调整记录 |
|---|---|---|---|---|---|---|
| ③ 池子 1000<br>分配 600 优惠 10% | 旧版 | **−600** | 400 | 340 | 500 | `+60 预付款优惠` |
| | 新版 | **−660** ⛔ | 340 | 340 ✅ | 500 ✅ | **无** ⛔ |
| ③b 池子 1000<br>分配 **1500** | 旧版 | **−1000**（封顶） | **0** | 0 | 500 | 无 |
| | 新版 | **−1650** ⛔ | **−650** ⛔ | **−100** ⛔ | **−50** ⛔ | 无 |
| ④ **池子 0**<br>分配 600 | 旧版 | **0**（啥也不做） | 0 | 1000 | 500 | 无 |
| | 新版 | **−660** ⛔ | **−660** ⛔ | 340 ⛔ | 500 | 无 |

### ⛔⛔ 新发现的第 6 条（比前 5 条都严重）：**池子不封顶 + 未收不夹零**

- **旧版**：`amount = min(requested, prepaidBalance)`（svc:816）⇒ **池子里没钱就一分也分不出去**；
  且 `nextUnpaid = Math.max(0, …)`（svc:829）⇒ 未收**永远不为负**。
- **我们**：两个都没有 ⇒
  - 场景④：**池子为 0 也能凭空分配出 660**，把池子扣成 −660；
  - 场景③b：**分配额可以超过池子余额**，池子变负；
  - 且**订单未收变成负数**（−100 / −50）—— 未收金额为负是账目错误。

⇒ 这不只是「数字对不上」，是**能凭空造出钱来**。任何人点一次「预付款分配」手输一个大数，
就能把客户池子打成负数、把订单未收打成负数。

### 差异③ 的直接证据

场景③：两边 **A 未收都是 340 ✅**（我们靠 allocation 的 `amount = 660`，旧版靠
`allocated 600` + `orderAdjustment 60`），但**资金池差 60 —— 正好是优惠额**。
⇒ 证实「我们把优惠当成从客户池子转出」，旧版把它当**店家让利**。

差异⑤也一并暴露：`资金池剩余` 旧版返回 0（=本次没分掉的），新版连字段都没返（`undefined`）。

## 9.7 ✅ 已补齐（2026-09-18）

按 `08-fix-plan.md` 实施完毕，**7 条改动全部落地**。验收是三台差分台**我自己跑的**：
```
05-diff-alloc   ✓ 所有场景优惠一致
06-diff-balance ✓ 全部一致（6 个字段 × 6 个场景）
07-diff-execute ✓ 三个场景的落库效果全部一致
```

> **2026-09-20 补记**：这四台（含 09）**此前一直没进任何统一入口** —— 收集正则匹配不到
> `05-diff-alloc.mjs` 这种命名，于是「改财务口径」这类改动最该被它们抓的场景，它们全程没参与。
> 这次一并收进 `docs/home-audit/run-all.mjs`（库绑定同时改成 `DB_NAME` 那套环境变量），
> 在 `npm run verify` 里重跑：**33/33 全绿**，其中 `06-diff-balance` 的 `实收金额` 在
> 场景 ②③④⑥ 仍是**两侧同为 1000**（不是 0 比 0 的空转）—— 即 2026-09-20 那笔
> `paid_amount` 对齐**没有**破坏它。见 `docs/verification.md` 第 4 节。
> `08-verify-live.mjs` 仍不收（只读、要真实数据 + 人工传客户编号），理由同上。

| 差异 | 处置 |
|---|---|
| ⑥ 池子不封顶 + 未收不夹零 | ✅ 改动 1（`unpaid` 夹零 + `amount = min(请求额, max(0,池子))`） |
| ③ 优惠扣资金池 | ✅ 改动 2（`amount` 只写分配额；优惠另写 `finance_order_adjustments`） |
| ③ 优惠多给 | ✅ 改动 3（补 `min(unpaid−alloc, round(alloc×rate))` 上限） |
| ① `客户余额` 语义 | ✅ 改动 4（`max(0, Σ逐单未收 − 客户调整合计)`，只算**还存在的订单**） |
| ② `实收金额` | ✅ 改动 5（= 累计充值：只算客户级且只累加正数） |
| ⑤ `资金池剩余` | ✅ 改动 6（= `amount − Σalloc`），并补返回 `available_balance` |
| 排序第二键 | ✅ 改动 7（`order_date, created_at, id`，注释标明是**近似**） |

**有意不做的**（见 `08-fix-plan.md`）：不照抄旧版「没有事务」；不照抄 `addPayment` 那两套
互相打架的优惠；保留我们比旧版多的入参校验。

### ⚠️ 遗留的契约缺口（**未判定**，差分台会一直提示）

旧版 `getCustomerBalance` 还返回一个 `已分配金额`，我们没返回。
**两边前端都不读它**（只在**订单级**用 `已分配金额`，那是另一个接口），
所以本轮**不补** —— 加了没人读，是虚的接口面。要补是补 `CustomerBalance`，不是放松差分台。

### ⚠️ 历史数据注意

`finance_allocations` 的**历史行**里，`amount` 是旧口径的 `alloc + discount`。
改动 2 之后新行是 `amount = alloc`。**不能拿 `discount` 反推历史行的 `amount`**。
（写这段时库里财务表是空的。**2026-09-20 复核：已经不空了** ——
`finance_allocations` 6 行、`finance_payments` 9 行，都是开发库里的测试数据，
用户明确说过不需要清。它们对 §9.8 的影响见那一节。）

## 9.8 ⭐ `实收金额` 的**第二处**口径分歧（2026-09-20 已对齐）

§9.5 那张表里有一行「池子红冲后为负 | `实收金额` | 旧版 1000 | 新版 −200 ⛔」——
那是**改动 5 之前**的快照，改动 5 把它改成「只算客户级 + 只累加正数」之后就绿了。
但**同一个字段还有第二处分歧**，改动 5 没碰到，2026-09-20 才查出来：

| | 旧版 | 改动 5 之后的我们 |
|---|---|---|
| 一笔「收款 + 分配列表」的收款 | 客户级行的 `amount` **就是** `prepaidDelta`（写入时已相减，svc:384/398） | 客户级行的 `amount` 是**全额**，分配另存在 `finance_allocations` |
| ⇒ 同一套业务 | `totalTopup` 只加上「没分掉的那部分」 | 我们加上了**全额** ⇒ **虚高** |

夹具（`docs/home-audit/finance-reversal-e2e.mjs`）：客户往池子打 300 并全分给订单 A、
另直接给 B 收 200 ⇒ **旧版 `实收金额` = 0，我们 = 300**。

### 怎么修的

1. 加 `finance_allocations.payment_id`（迁移 `0025_allocation_payment_link.sql`），
   记下「这笔分配是从哪笔收款里出的」。表原来只有 `order_id`，表达不了这个归属。
2. `customer_balance` 的 `paid_amount` 改成**逐笔相减、逐笔夹零**：
   `Σ GREATEST(0, p.amount − 该 p 名下分配合计)`，只取客户级收款。
   ⚠️ 不能聚合相减：收 300 却分配 400、另收 200 未分配时，
   旧版 `max(0,300−400) + max(0,200−0) = 200`，聚合相减是 `max(0,500−400) = 100`。
3. **只有 `add_customer_payment` 写 `payment_id`**。另两处写 `finance_allocations` 的
   必须留 NULL：`execute_prepayment_allocation`（旧版那个函数**压根不动 `totalTopup`**）
   与 `reverse_order_allocation`（红冲的负分配若参与相减，会把实收**加回去**，
   而旧版 `totalTopup` **永不因红冲增长**）。
4. **不回溯历史数据**（用户 2026-09-20 拍板）：已有的分配行归不到来源 ——
   无法判断哪行是「收款时分配」（该挂 `payment_id`）、哪行是「预付款分配」（该留 NULL），
   硬猜就是编数据。后果如实记：这批历史行 `payment_id` 为 NULL ⇒ **不减** ⇒
   它们维持改动前的值，**同一客户、改动前后写入的数据会不一致**。这是接受的代价。
   （上面那 6 行里，id 78 的 `discount = 1.6` —— 只有 `execute_prepayment_allocation`
   会写非零 discount，`add_customer_payment` 硬编码 0 ⇒ 至少有一行确定属于「该留 NULL」那类，
   正好说明「归不到来源」不是推测。）

### 证据边界（别记混）

- ✅ **正证据**：`docs/home-audit/finance-reversal-e2e.mjs`（它真 POST 了一笔带分配的收款）。
- ❌ **不是证据**：`06-diff-balance.mjs` —— 它把旧版 `totalTopup` / `prepaidBalance`
  的**存量列当输入直接喂**（`scen.cb.totalTopup` 直接插成一笔**没有分配**的客户级收款），
  相减那一步在它这里恒等于不减。**它绿只说明没改坏。**
  同一句也适用于 `05` / `07` / `09`。

## 10. 待办

- [ ] 等 `01-read.md` / `02-write.md` / `03-allocation.md`，与本稿对表，冲突处回源码裁决
- [ ] 对关键结论做**对抗验证**（派独立 agent 试着推翻）
- [ ] 定级：哪些必须改（钱错的）、哪些是契约差异（要拍板）、哪些是旧版自身瑕疵（不照抄）
- [ ] `客户余额` 语义、优惠归属 —— 这两条要请用户拍板后再动代码
