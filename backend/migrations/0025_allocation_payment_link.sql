-- `finance_allocations.payment_id`：把「这笔分配是从哪笔收款里出的」记下来。
--
-- ## 为什么需要它：`实收金额` 的口径对不齐
--
-- 旧版 `实收金额 = CustomerBalance.totalTopup`（`finance.service.ts:762`），累加规则是
--
--     totalTopup += (prepaidDelta > 0 ? prepaidDelta : 0)          // svc:398 / :409
--     const prepaidDelta = amount - allocatedTotal;                // svc:384
--
-- `allocatedTotal` = **这一笔收款**分给订单的合计（`:359-383` 那个 for 循环里累加）。
-- 关键在：旧版**写入时就相减了** —— 它那条「客户级收款行」的 `amount` 本身就是 `prepaidDelta`，
-- 所以「Σ 客户级正数行的 amount」在旧版数据上恰好等于 `totalTopup`。
--
-- ⚠️ 我们的写入路径不一样：`add_customer_payment` 把**全额**记进客户级收款行，
-- 分配另记在 `finance_allocations` 里。于是「Σ 客户级正数行」会**虚高** ——
-- 夹具实测：同一套业务（池子 300 全分给 A、另给 B 直接收 200），旧版 `实收金额` = 0，我们 = 300。
--
-- 补上那步相减需要把分配**归到具体某笔收款**上，而且必须**逐笔相减、逐笔夹零**：
-- 聚合相减会算错 —— 收 300 却分配 400、另收 200 未分配时，
-- 旧版是 `max(0,300-400) + max(0,200-0) = 0 + 200 = 200`，聚合相减是 `max(0,500-400) = 100`。
-- 本表原来只有 `order_id`，表达不了这种归属 ⇒ 加 `payment_id`。
--
-- ## ⚠️ 只有「收款时的那种分配」该写 payment_id
--
-- 写 `finance_allocations` 的一共三处，**只有第 1 处**要写：
--
-- | 写入点 | 对应旧版的什么 | payment_id |
-- |---|---|---|
-- | `add_customer_payment`（收款 + 按分配列表落单） | `addPayment` 的 rows 分支（`:359-383`） | **写**（= 该笔客户级收款的行 id） |
-- | `execute_prepayment_allocation`（把池子分给订单） | `executePrepaymentAllocation`（`:805`） | **NULL** |
-- | `reverse_order_allocation`（红冲写的负分配） | 无对应（这是我们「新写法」的一环） | **NULL** |
--
-- 后两处必须留 NULL，理由各不相同、都不是漏改：
--
--   · **预付款分配不参与**：旧版那个函数只改 `prepaidBalance` / `totalSpent`（`:838-857`），
--     **压根不碰 `totalTopup`** —— 池子分给订单不会让「累计充值」变小。
--   · **红冲的负分配更不能参与**：若给它挂上 `payment_id`，一笔「收 300 全分给 A」的收款
--     在红冲后会算成 `max(0, 300 - (300-300)) = 300`，把实收**加回去**；
--     而旧版的 `totalTopup` **永不因红冲增长**（它只加正数）。
--
-- ## 不设外键
--
-- 与 0019 的既定做法一致（那几张表都不指向 `orders`）：财务记录要能独立于被引用对象存续。
-- 这里也不加指向 `finance_payments` 的外键 —— 收款行目前没有删除路径，但没必要为此
-- 引入一条会拦住删除的约束。
--
-- ## 不回溯历史数据（用户 2026-09-20 拍板：接受新旧不一致）
--
-- 本迁移**不 UPDATE 任何行**。库里已有的分配行归不到来源：无法判断哪几行是「收款时分配」
-- （该挂 `payment_id`）、哪几行是「预付款分配」（该保持 NULL）—— 硬猜就是编数据。
--
-- 写这条时库里的实际状况（已核）：`finance_allocations` 6 行，全部 `order_id = 424`；
-- 其中 id 78 的 `discount = 1.6`，那正是「预付款优惠」（只有 `execute_prepayment_allocation`
-- 会写非零 discount，`add_customer_payment` 硬编码 0）⇒ **至少有一行确定属于后者**。
--
-- 后果（如实记）：这批历史行 `payment_id` 为 NULL ⇒ 计算 `实收金额` 时**不减**
-- ⇒ 它们维持改动前的值。**同一客户、改动前后写入的数据会不一致**，这是本次接受的代价。

ALTER TABLE finance_allocations ADD COLUMN IF NOT EXISTS payment_id BIGINT;

-- 计算 `实收金额` 时按 `payment_id` 聚合（见 `finance/service.rs` 的 `customer_balance`）。
CREATE INDEX IF NOT EXISTS idx_finance_alloc_payment
    ON finance_allocations(payment_id);

COMMENT ON COLUMN finance_allocations.payment_id IS
  '这笔分配是从哪一笔收款里出的（指向 finance_payments.id）。'
  '只由 add_customer_payment 写入 —— 它对应旧版 addPayment 的「收款 + 分配列表」分支'
  '（finance.service.ts:359-383），那里的 allocatedTotal 就是按这笔收款累加的。'
  '⚠️ 另外两处写 finance_allocations 的（execute_prepayment_allocation、'
  'reverse_order_allocation）**必须留 NULL**，理由见迁移 0025 的文件头 —— '
  '预付款分配在旧版里不改 totalTopup，红冲的负分配若参与相减会把实收加回去。'
  '见迁移 0025。';
