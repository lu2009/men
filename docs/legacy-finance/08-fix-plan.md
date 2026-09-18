# 财务口径补齐：改动清单（定稿，照此实施）

> 依据：`01-read.md` / `02-write.md` / `03-allocation.md` 三份逆向 + 主会话自查 `04-diff-ours.md`，
> 全部差异都有**实测**支撑（`05-diff-alloc.mjs` / `06-diff-balance.mjs` / `07-diff-execute.mjs`）。
> 源码简写 `svc:N` = `/Users/aaa/Downloads/server/src/modules/finance/finance.service.ts:N`。
>
> **验收 = 三台差分台全绿**（它们跑的是旧版真代码，不是「我觉得对」）。

---

## 改动 1 ⛔⛔ 池子封顶 + 未收夹零（第 6 条，能凭空造钱）

**旧版**（两道闸，我们一道都没有）：
```js
const amount     = Math.min(Math.max(0, requestedAmount), available)   // svc:816  available = max(0, prepaidBalance)
const nextUnpaid = Math.max(0, fo.unpaidAmount - alloc - discount)     // svc:829
```

**改**（`backend/src/modules/finance/service.rs`）：

1. `order_finance(...)`：`unpaid_amount` 加下界
   ```rust
   let unpaid = round2(head.total_price - allocated - adjustment);
   let unpaid = if unpaid < 0.0 { 0.0 } else { unpaid };   // ← 新增
   ```
   ⚠️ 这条会影响所有读 `unpaid_amount` 的地方（Home 的未收列、`preview_allocation` 的过滤、
   `add_order_payment` 的校验）—— 是**想要**的，旧版就是这个口径。

2. `preview_prepayment_allocation` / `execute_prepayment_allocation`：`allocate_amount` 先封顶
   ```rust
   let cb = customer_balance(pool, tenant_id, &req.customer_code).await?;
   let available = cb.unallocated_balance.max(0.0);
   let amount = req.allocate_amount.max(0.0).min(available);
   ```
   并把 `available` 作为 `available_balance` 返回（旧版 `previewPrepaymentAllocation` 返回它，svc:803）。

---

## 改动 2 ⛔ 优惠归属：记订单调整，不扣资金池

**旧版**（`executePrepaymentAllocation`，svc:826-845）：
```js
const nextAllocated = fo.allocatedAmount + alloc
const nextUnpaid    = Math.max(0, fo.unpaidAmount - alloc - discount)
if (discount > 0) orderAdjustment.create({ orderNo, adjustAmount: discount, adjustType: '预付款优惠', notes })
const newPrepaid = Math.max(0, prepaidBalance - totalAllocated)   // ★ 只减 alloc，不减 discount
```

**我们现在的错**：`finance_allocations.amount = alloc + disc` 且池子按 `alloc + disc` 扣。

**改**（`execute_prepayment_allocation`）：
- `finance_allocations` 写 `amount = alloc`、`discount = disc`（`discount` 列保留，供追溯，**不参与任何计算**）
- `disc > 0` 时**另写一条** `finance_order_adjustments`：
  `{ order_id, receipt_no, amount: disc, type: '预付款优惠', remark: 备注 }`
- 池子只按 `Σ alloc` 减少（我们的表是流水，`unallocated = paid − (order_paid + Σalloc)`，
  所以「amount 不再含 disc」自动实现）

✅ 这样 `unpaid = total − (Σalloc) − (Σadj 含 disc)` 与旧版 `nextUnpaid` 一致。

---

## 改动 3 ⛔ 优惠上限（我们多给优惠）

**旧版**（`buildAllocationPreview`，svc:206）：
```js
const discount = discountRate > 0 ? Math.min(unpaid - alloc, Math.round(alloc * discountRate * 100) / 100) : 0
```
⚠️ `unpaid - alloc` 这个上限意味着**整单被付清时优惠恒为 0**。

**改**：`preview_prepayment_allocation` 的逐单优惠算成
```rust
// rate 用小数（旧版口径）。我们的接口收百分数 ⇒ rate = discount_rate / 100
let disc = if rate > 0.0 {
    let raw = round2(alloc * rate);                 // round2 = 四舍五入到分
    raw.min(round2(unpaid - alloc)).max(0.0)
} else { 0.0 };
```
**不封顶资金池**（旧版这里也不封）。

---

## 改动 4 ⛔ `客户余额` 改成旧版定义

**旧版**（svc:763）：`客户余额 = Math.max(0, Σ unpaidAmount − Σ customerAdjustments.adjustAmount)`
—— 含义是「**客户还欠多少**」。

**改**（`customer_balance`）：
```rust
// Σ unpaid：逐单未收之和（用改动 1 的夹零口径）
let unpaid_total: f64 = /* SELECT SUM(...) per-order 未收 */;
let customer_balance = round2(unpaid_total - cust_adj);
let customer_balance = if customer_balance < 0.0 { 0.0 } else { customer_balance };
```
⚠️ **连带**：`add_order_payment` 里 `if amount > cb.customer_balance` 那条校验，
语义随之变成「收款金额不能超过客户还欠多少」—— 这条**保留**（是我们的护栏，不是错的），
但要改文案，别再说「超过客户余额」。

---

## 改动 5 ⚠️ `实收金额` 改成「累计充值」（只增不减）

**旧版**（svc:257 / 398 / 409）：`totalTopup += (delta > 0 ? delta : 0)` —— **红冲不减**。
只统计**客户级**（`prepaidDelta` = 未分配到订单的那部分）的充值。

**改**（`customer_balance`）：
```rust
// 只算客户级（order_id IS NULL）、且只累加正数
let paid_amount: f64 = "SELECT COALESCE(SUM(amount), 0.0) FROM finance_payments
                        WHERE tenant_id=$1 AND customer_code=$2 AND order_id IS NULL AND amount > 0";
```
⚠️ `unallocated_balance` 仍是**净额**（`Σ 全部客户级收款`，含负数）—— 两者分母不同，别合并。

✅ **已核实**：`totalTopup` 全文件只有两处会加，`svc:256` 与 `svc:398/409`；
而 `svc:256` 所在的 `addToCustomerBalance`（svc:248-259）**全文件零调用 —— 是死函数**。
⇒ 唯一活的写入口就是 `addPayment` 的 `prepaidDelta` 分支，即**客户级**那部分。本改动成立。

---

## 改动 6 ⚠️ `资金池剩余` 语义对齐

**旧版**（`buildAllocationPreview` 返回值，svc:227）：`资金池剩余 = remaining = amount − Σ alloc`
（= **本次拟分配里没分掉的**），不是「客户池子还剩多少」。

**改**：`preview_prepayment_allocation` 的 `pool_remaining` 改成 `amount − Σalloc`。
另外旧版还返回 `available_balance`（客户池子可用的钱），一并加上（改动 1 已算）。

---

## 改动 7 ⚠️ 分配排序：同日单按财务行创建时间

**旧版**：`orderBy: [{order:{orderDate:'asc'}}, {createdAt:'asc'}]`（svc:158/166），
`createdAt` 是 **finance_orders 行**的创建时间。
**我们**：`ORDER BY order_date, id`。

**改**：`ORDER BY o.order_date, o.created_at, o.id`（用订单行的 `created_at` 近似；
我们没建单独的 finance_order 行，`orders.created_at` 是可比的最接近量）。
⚠️ 这条**不是精确等价** —— 旧版按财务行创建时间，旧系统里财务行是订单落库时一并建的，
顺序通常一致。**写进注释标「近似」**，别声称一致。

---

## 不做的（有意，写进注释）

- **不照抄「没有事务」**：旧版 `executePrepaymentAllocation` / `clearSelectedOrders` 无事务
  （`04-diff-ours.md` §9）。我们保持事务，更安全。
- **不照抄 `addPayment` 的第三套优惠**（svc:346 `max(0,amount)*rate` 无上限无记账；
  svc:371 直接信客户端）—— 那是旧版自己不一致，不是我们要学的东西。
- **`addOrderPayment`（svc:438-457）旧版无任何校验**；我们的校验是护栏，保留，
  但**要确认它们不会挡住合法流程**（尤其改动 1 夹零之后 `unpaid` 变小，别把正常收款挡掉）。

---

## 验收（硬门槛）

```bash
cd backend && cargo build
DATABASE_URL=postgres://smartdoor:smartdoor@localhost:5432/smartdoor PORT=3999 \
  ./target/debug/smartdoor-backend &
node docs/legacy-finance/05-diff-alloc.mjs      # 优惠：应全绿
node docs/legacy-finance/06-diff-balance.mjs    # 余额/实收：应全绿
node docs/legacy-finance/07-diff-execute.mjs    # 落库效果：应全绿
cd app && npm run build && npx vue-tsc --noEmit
```

⚠️ 差分台的**夹具**若与改动后的口径不符，改夹具要**说明理由**，不许为了让测试变绿而改。
