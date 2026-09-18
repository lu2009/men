use sqlx::PgPool;

use crate::core::error::{ApiError, ApiResult};

use super::model::*;

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

/// 订单头（财务所需的最小字段集）。
struct OrderHead {
    id: i64,
    receipt_no: String,
    order_date: String,
    total_price: f64,
}

async fn fetch_order(pool: &PgPool, tenant_id: i64, order_id: i64) -> ApiResult<OrderHead> {
    let row: Option<(String, String, f64)> = sqlx::query_as(
        "SELECT receipt_no, to_char(order_date, 'YYYY-MM-DD'), total_price \
         FROM orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?;

    row.map(|(receipt_no, order_date, total_price)| OrderHead {
        id: order_id,
        receipt_no,
        order_date,
        total_price,
    })
    .ok_or_else(|| ApiError::not_found("订单不存在"))
}

// ---------------------------------------------------------------------------
// 口径（docs/2026-09-17-home-analysis.md §7.1/§7.3；与旧服务端的逐条对照与依据见
// docs/legacy-finance/08-fix-plan.md，源码简写 `svc:N` = 旧版 finance.service.ts 第 N 行）：
//   已分配金额 = 本单收款(orders 级 finance_payments) + 预付款/客户收款分配(finance_allocations)
//   订单调整金额 = Σ finance_order_adjustments.amount（正=减免，负=冲销）
//   未收金额   = max(0, 总价 − 已分配金额 − 订单调整金额)      ← 夹零，见改动 1（svc:827/829）
//   订单总额   = Σ orders.total_price（按客户）
//   实收金额   = Σ **客户级**(order_id IS NULL)且为**正**的收款 = 「累计充值」，红冲不减（svc:257/398/409）
//   订单调整合计 = Σ finance_order_adjustments.amount（按客户）
//   客户调整合计 = Σ finance_customer_adjustments.amount（按客户）
//   客户余额   = max(0, Σ 逐单未收 − 客户调整合计) = **客户还欠多少**（svc:763）
//   未分配余额 = 实收净额 − 已分配总额（= 资金池里还能分配的钱；含红冲负数，**可负**）
//
// ⚠️ 「客户余额」与「未分配余额」是两个方向的钱，旧版就这么定义的，别互相替代：
//    客户余额 = 客户还欠我们多少（≥0）；未分配余额 = 客户放在我们这儿的钱（可负）。
// ---------------------------------------------------------------------------

/// 订单财务摘要。
/// 订单的两段「已分配」拆开取：`(本单直接收款, 资金池分配)`。
///
/// 口径与 `order_finance` 里的两条 SQL **同源**（那里加起来当 `allocated_amount`），
/// 但删除订单红冲必须知道**哪一段是哪一段**，所以单独抽出来 —— 见 `reverse_order_allocation`。
///
/// ⚠️ 只读财务表，**不查 `orders`**：调用方可能已把订单删了（红冲晚于删除时）。
pub async fn order_allocated_parts(
    pool: &PgPool,
    tenant_id: i64,
    order_id: i64,
) -> ApiResult<(f64, f64)> {
    let paid: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM finance_payments \
         WHERE tenant_id = $1 AND order_id = $2",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_one(pool)
    .await?;

    let alloc: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM finance_allocations \
         WHERE tenant_id = $1 AND order_id = $2",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_one(pool)
    .await?;

    Ok((round2(paid), round2(alloc)))
}

pub async fn order_finance(pool: &PgPool, tenant_id: i64, order_id: i64) -> ApiResult<OrderFinance> {
    let head = fetch_order(pool, tenant_id, order_id).await?;

    let (paid, alloc) = order_allocated_parts(pool, tenant_id, order_id).await?;

    let adj: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM finance_order_adjustments \
         WHERE tenant_id = $1 AND order_id = $2",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_one(pool)
    .await?;

    let allocated = round2(paid + alloc);
    let adjustment = round2(adj);
    let unpaid = round2(head.total_price - allocated - adjustment);
    // 改动 1（旧版 svc:827/829 的 `Math.max(0, fo.unpaidAmount − alloc − discount)`）：
    // 未收**永远不为负**。旧版每写一次未收都夹零（:235/:349/:373/:827），所以存量列里不可能出现
    // 负数；而我们是实时聚合，只要多分配/多抹零就会算出负数 —— 那不是「客户倒欠」，
    // 是账目错误（实测：池子 0 也能分配，未收被算成 −100/−50，见 04-diff-ours.md §9.6）。
    // 用 `<=` 顺带把 `round2` 可能产生的 −0.0 归一成 0.0。
    let unpaid = if unpaid <= 0.0 { 0.0 } else { unpaid };

    Ok(OrderFinance {
        total_price: round2(head.total_price),
        allocated_amount: allocated,
        adjustment_amount: adjustment,
        unpaid_amount: unpaid,
    })
}

/// 订单财务明细（finance_getOrderDetail）：totals + 收款/分配记录 + 调整记录。
pub async fn order_finance_detail(
    pool: &PgPool,
    tenant_id: i64,
    order_id: i64,
) -> ApiResult<OrderFinanceDetail> {
    let of = order_finance(pool, tenant_id, order_id).await?;

    // 收款记录（本单收款，负=红冲）。
    let pays: Vec<(String, f64, String)> = sqlx::query_as(
        "SELECT COALESCE(NULLIF(pay_date, ''), to_char(created_at, 'YYYY-MM-DD')), amount, remark \
         FROM finance_payments WHERE tenant_id = $1 AND order_id = $2 ORDER BY created_at",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_all(pool)
    .await?;

    let mut payment_records: Vec<FinanceRecord> = pays
        .into_iter()
        .map(|(date, amount, remark)| FinanceRecord {
            kind: if amount < 0.0 { "红冲".into() } else { "收款".into() },
            date,
            amount: round2(amount),
            remark,
        })
        .collect();

    // 分配记录（预付款/客户收款分配到本单）。
    let allocs: Vec<(String, f64)> = sqlx::query_as(
        "SELECT to_char(created_at, 'YYYY-MM-DD'), amount \
         FROM finance_allocations WHERE tenant_id = $1 AND order_id = $2 ORDER BY created_at",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_all(pool)
    .await?;
    for (date, amount) in allocs {
        payment_records.push(FinanceRecord {
            kind: "分配".into(),
            date,
            amount: round2(amount),
            remark: String::new(),
        });
    }

    // 调整记录（订单抹零/冲销）。
    let adjs: Vec<(String, f64, String, String)> = sqlx::query_as(
        "SELECT to_char(created_at, 'YYYY-MM-DD'), amount, type, remark \
         FROM finance_order_adjustments WHERE tenant_id = $1 AND order_id = $2 ORDER BY created_at",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_all(pool)
    .await?;

    let adjustment_records: Vec<FinanceRecord> = adjs
        .into_iter()
        .map(|(date, amount, typ, remark)| FinanceRecord {
            kind: if typ.is_empty() { "抹零".into() } else { typ },
            date,
            amount: round2(amount),
            remark,
        })
        .collect();

    Ok(OrderFinanceDetail {
        total_price: of.total_price,
        allocated_amount: of.allocated_amount,
        adjustment_amount: of.adjustment_amount,
        unpaid_amount: of.unpaid_amount,
        payment_records,
        adjustment_records,
    })
}

/// 客户余额。
pub async fn customer_balance(
    pool: &PgPool,
    tenant_id: i64,
    customer_code: &str,
) -> ApiResult<CustomerBalance> {
    let (order_total, order_name): (f64, String) = sqlx::query_as(
        "SELECT COALESCE(SUM(total_price), 0.0), COALESCE(MAX(client_name), '') \
         FROM orders WHERE tenant_id = $1 AND client_code = $2",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_one(pool)
    .await?;

    // 实收净额（含红冲负数，可负）—— 只给「未分配余额」用，**不是**对外的 `实收金额`。
    let paid: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM finance_payments \
         WHERE tenant_id = $1 AND customer_code = $2",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_one(pool)
    .await?;

    // 改动 5：对外 `实收金额` = **累计充值**，不是净收款。
    // 旧版 `totalTopup += (prepaidDelta > 0 ? prepaidDelta : 0)`（svc:257/398/409）——
    // 只累加**正数**，红冲不减它；且只统计**客户级**那部分（`prepaidDelta` = 本次收款里没分到
    // 具体订单的钱，svc:384-386），本单收款（order_id 非空）从来不计入 totalTopup。
    // 我们先前是「Σ 全部收款（净额）」，池子被红冲后会把实收打成负数（实测 1000 → −200）。
    // ⚠️ 与下面的 `paid`（净额）**分母不同，别合并**：`未分配余额` 必须用净额。
    let paid_amount: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM finance_payments \
         WHERE tenant_id = $1 AND customer_code = $2 AND order_id IS NULL AND amount > 0",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_one(pool)
    .await?;

    let order_adj: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM finance_order_adjustments \
         WHERE tenant_id = $1 AND customer_code = $2",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_one(pool)
    .await?;

    let cust_adj: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM finance_customer_adjustments \
         WHERE tenant_id = $1 AND customer_code = $2",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_one(pool)
    .await?;

    // 已分配总额 = 本单收款 + 分配。
    let order_paid: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM finance_payments \
         WHERE tenant_id = $1 AND customer_code = $2 AND order_id IS NOT NULL",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_one(pool)
    .await?;

    let alloc: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM finance_allocations \
         WHERE tenant_id = $1 AND customer_code = $2",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_one(pool)
    .await?;

    // 改动 4：`客户余额` = **客户还欠多少**（旧版 svc:763 `Math.max(0, Σ unpaidAmount − Σ 客户调整)`）。
    // 逐单未收用一条 SQL 算，公式与 `order_finance` 同源（含改动 1 的夹零）：
    //   未收 = max(0, 总价 − 本单收款 − 池分配 − 订单调整)
    // 只有**还存在的订单**参与（JOIN orders）——订单删掉后它就不该再算欠款，与旧版的
    // financeOrder 行随订单消失同构。注意这里**不减** `订单调整合计`：订单调整已经逐单减进
    // 未收里了，再减一次会重复（旧版 `客户余额` 里也没有 orderAdjust 这一项）。
    let unpaid_total: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(GREATEST(0.0::float8, \
                o.total_price - COALESCE(p.paid, 0.0) - COALESCE(a.alloc, 0.0) - COALESCE(j.adj, 0.0))), 0.0) \
         FROM orders o \
         LEFT JOIN (SELECT order_id, SUM(amount) AS paid FROM finance_payments \
                    WHERE tenant_id = $1 GROUP BY order_id) p ON p.order_id = o.id \
         LEFT JOIN (SELECT order_id, SUM(amount) AS alloc FROM finance_allocations \
                    WHERE tenant_id = $1 GROUP BY order_id) a ON a.order_id = o.id \
         LEFT JOIN (SELECT order_id, SUM(amount) AS adj FROM finance_order_adjustments \
                    WHERE tenant_id = $1 GROUP BY order_id) j ON j.order_id = o.id \
         WHERE o.tenant_id = $1 AND o.client_code = $2",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_one(pool)
    .await?;

    let allocated_total = round2(order_paid + alloc);
    let unallocated = round2(paid - allocated_total);
    // 客户调整是**客户级**的减免，直接减欠款；夹零：多抹了也不会变成「客户倒欠」。
    let balance = round2(unpaid_total - cust_adj);
    let customer_balance = if balance <= 0.0 { 0.0 } else { balance };

    Ok(CustomerBalance {
        customer_code: customer_code.to_string(),
        customer_name: order_name,
        order_total: round2(order_total),
        paid_amount: round2(paid_amount),
        customer_balance,
        unallocated_balance: unallocated,
        order_adjust_total: round2(order_adj),
        customer_adjust_total: round2(cust_adj),
    })
}

/// 本单收款（finance_addOrderPayment）。校验规则照 §5.4。
pub async fn add_order_payment(
    pool: &PgPool,
    tenant_id: i64,
    req: AddOrderPayment,
) -> ApiResult<()> {
    let amount = round2(req.amount);
    if amount.abs() < 0.005 {
        return Err(ApiError::bad_request("收款金额不能为零"));
    }

    let of = order_finance(pool, tenant_id, req.order_id).await?;
    let cb = customer_balance(pool, tenant_id, &req.customer_code).await?;

    let mut discount = 0.0_f64;
    if req.use_prepay_discount {
        if amount < 0.0 {
            return Err(ApiError::bad_request("启用预付优惠时不支持负数红冲"));
        }
        discount = round2((of.unpaid_amount * req.discount_rate / 100.0).min(cb.unallocated_balance));
        if discount <= 0.0 {
            return Err(ApiError::bad_request("当前没有可用预付款用于优惠抵扣"));
        }
        if amount + discount > of.unpaid_amount + 0.005 {
            return Err(ApiError::bad_request("收款金额+优惠抵扣不能超过本单未收"));
        }
    }
    if amount > of.unpaid_amount + 0.005 {
        return Err(ApiError::bad_request("收款金额不能大于未收金额"));
    }
    if amount < 0.0 && amount.abs() > of.allocated_amount + 0.005 {
        return Err(ApiError::bad_request("红冲金额绝对值不能超过本单已分配金额"));
    }
    // 护栏：收款不能超过「客户还欠多少」。旧版 `addOrderPayment`(svc:438-457) 一条校验都没有，
    // 这是我们有意加的（08-fix-plan.md「不做的」第 3 条）；改动 4 之后 `客户余额` 的语义正是
    // 「还欠多少」，所以这条依然成立，只是文案得跟着改（别再叫它「客户余额」，那会让人以为是净额）。
    if amount > cb.customer_balance + 0.005 {
        return Err(ApiError::bad_request("收款金额不能超过客户未收合计"));
    }

    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO finance_payments \
         (tenant_id, customer_code, customer_name, order_id, receipt_no, amount, pay_date, method, remark, kind) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'order_payment')",
    )
    .bind(tenant_id)
    .bind(&req.customer_code)
    .bind(&req.customer_name)
    .bind(req.order_id)
    .bind(&req.receipt_no)
    .bind(amount)
    .bind(&req.pay_date)
    .bind(&req.method)
    .bind(&req.remark)
    .execute(&mut *tx)
    .await?;

    // 预付优惠抵扣 G：从客户未分配资金池扣减，落到该订单。
    // G 全部为「优惠」，故 amount=discount=G（迁移列 discount 语义即「优惠抵扣金额」）。
    // 入账方式为 INTERPRETED：旧版服务端计算，bundle 内不可见（见逆向结论 B4）。
    if discount > 0.0 {
        sqlx::query(
            "INSERT INTO finance_allocations \
             (tenant_id, customer_code, order_id, receipt_no, amount, discount) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(tenant_id)
        .bind(&req.customer_code)
        .bind(req.order_id)
        .bind(&req.receipt_no)
        .bind(discount)
        .bind(discount)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

/// 订单抹零/冲销（finance_addOrderAdjustment）。校验照 §5.4。
pub async fn add_order_adjustment(
    pool: &PgPool,
    tenant_id: i64,
    req: AddOrderAdjustment,
) -> ApiResult<()> {
    let amount = round2(req.amount);
    let of = order_finance(pool, tenant_id, req.order_id).await?;
    let cb = customer_balance(pool, tenant_id, &req.customer_code).await?;

    if amount > 0.0 && amount > of.unpaid_amount + 0.005 {
        return Err(ApiError::bad_request("抹零金额不能超过本单未收"));
    }
    if amount > 0.0 && amount > cb.customer_balance + 0.005 {
        return Err(ApiError::bad_request("抹零金额超过客户余额"));
    }
    if amount < 0.0 && amount.abs() > of.adjustment_amount + 0.005 {
        return Err(ApiError::bad_request("冲销金额不能超过订单调整合计"));
    }

    sqlx::query(
        "INSERT INTO finance_order_adjustments \
         (tenant_id, customer_code, customer_name, order_id, receipt_no, amount, type, remark) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(tenant_id)
    .bind(&req.customer_code)
    .bind(&req.customer_name)
    .bind(req.order_id)
    .bind(&req.receipt_no)
    .bind(amount)
    .bind(&req.adjust_type)
    .bind(&req.remark)
    .execute(pool)
    .await?;

    Ok(())
}

/// 客户收款（finance_addPayment）：收款入资金池 + 按分配列表落到各订单。
pub async fn add_customer_payment(
    pool: &PgPool,
    tenant_id: i64,
    req: AddCustomerPayment,
) -> ApiResult<()> {
    let amount = round2(req.amount);
    if amount.abs() < 0.005 {
        return Err(ApiError::bad_request("收款金额不能为零"));
    }

    let mut tx = pool.begin().await?;

    let payment_id: i64 = sqlx::query_scalar(
        "INSERT INTO finance_payments \
         (tenant_id, customer_code, customer_name, order_id, receipt_no, amount, pay_date, method, remark, kind) \
         VALUES ($1, $2, $3, NULL, '', $4, $5, $6, $7, 'customer_payment') RETURNING id",
    )
    .bind(tenant_id)
    .bind(&req.customer_code)
    .bind(&req.customer_name)
    .bind(amount)
    .bind(&req.pay_date)
    .bind(&req.method)
    .bind(&req.remark)
    .fetch_one(&mut *tx)
    .await?;

    for a in &req.allocations {
        sqlx::query(
            "INSERT INTO finance_allocations \
             (tenant_id, customer_code, order_id, receipt_no, amount, discount) \
             VALUES ($1, $2, $3, $4, $5, 0)",
        )
        .bind(tenant_id)
        .bind(&req.customer_code)
        .bind(a.order_id)
        .bind(&a.receipt_no)
        .bind(round2(a.amount))
        .execute(&mut *tx)
        .await?;
    }

    let _ = payment_id;
    tx.commit().await?;
    Ok(())
}

/// 客户抹零/冲销（finance_addCustomerAdjustment）。校验照 §5.4。
pub async fn add_customer_adjustment(
    pool: &PgPool,
    tenant_id: i64,
    req: AddCustomerAdjustment,
) -> ApiResult<()> {
    let amount = round2(req.amount);
    let cb = customer_balance(pool, tenant_id, &req.customer_code).await?;

    if amount > 0.0 && amount > cb.customer_balance + 0.005 {
        return Err(ApiError::bad_request("抹零金额超过客户余额"));
    }
    // 「删除订单冲销」是删除红冲专用类型，不约束于客户调整合计（§A3）。
    if amount < 0.0 && req.adjust_type != "删除订单冲销" && amount.abs() > cb.customer_adjust_total + 0.005 {
        return Err(ApiError::bad_request("冲销金额不能超过客户调整合计"));
    }

    sqlx::query(
        "INSERT INTO finance_customer_adjustments \
         (tenant_id, customer_code, customer_name, amount, type, remark) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(tenant_id)
    .bind(&req.customer_code)
    .bind(&req.customer_name)
    .bind(amount)
    .bind(&req.adjust_type)
    .bind(&req.remark)
    .execute(pool)
    .await?;

    Ok(())
}

/// 对账流水（finance_getCustomerStatement）：收款 + 订单抹零 + 客户抹零 合并，按日期倒序。
pub async fn customer_statement(
    pool: &PgPool,
    tenant_id: i64,
    customer_code: &str,
) -> ApiResult<Vec<StatementItem>> {
    #[derive(sqlx::FromRow)]
    struct Row {
        kind: String,
        receipt_no: String,
        date: String,
        amount: f64,
        install_address: String,
        remark: String,
    }

    let rows: Vec<Row> = sqlx::query_as(
        "SELECT CASE WHEN p.amount < 0 THEN '红冲单' ELSE '收款' END AS kind, \
                p.receipt_no, p.pay_date AS date, p.amount, \
                COALESCE(o.install_address, '') AS install_address, p.remark \
         FROM finance_payments p \
         LEFT JOIN orders o ON o.id = p.order_id AND o.tenant_id = p.tenant_id \
         WHERE p.tenant_id = $1 AND p.customer_code = $2 \
         UNION ALL \
         SELECT '订单抹零' AS kind, a.receipt_no, to_char(a.created_at, 'YYYY-MM-DD') AS date, -a.amount, \
                COALESCE(o.install_address, '') AS install_address, a.remark \
         FROM finance_order_adjustments a \
         LEFT JOIN orders o ON o.id = a.order_id AND o.tenant_id = a.tenant_id \
         WHERE a.tenant_id = $1 AND a.customer_code = $2 \
         UNION ALL \
         SELECT '客户抹零' AS kind, '' AS receipt_no, to_char(c.created_at, 'YYYY-MM-DD') AS date, -c.amount, \
                '' AS install_address, c.remark \
         FROM finance_customer_adjustments c \
         WHERE c.tenant_id = $1 AND c.customer_code = $2 \
         ORDER BY date DESC",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| StatementItem {
            kind: r.kind,
            receipt_no: r.receipt_no,
            date: r.date,
            amount: round2(r.amount),
            install_address: r.install_address,
            remark: r.remark,
        })
        .collect())
}

/// 订单财务摘要表（finance_getOrderFinanceSummary）：近 N 天内的订单 → {order_id: {…}}。
pub async fn order_finance_summary(
    pool: &PgPool,
    tenant_id: i64,
    days: i64,
) -> ApiResult<Vec<(i64, OrderFinance)>> {
    let ids: Vec<i64> = sqlx::query_scalar(
        "SELECT id FROM orders WHERE tenant_id = $1 \
         AND order_date >= (CURRENT_DATE - $2::int) ORDER BY id",
    )
    .bind(tenant_id)
    .bind(days)
    .fetch_all(pool)
    .await?;

    let mut out = Vec::with_capacity(ids.len());
    for id in ids {
        out.push((id, order_finance(pool, tenant_id, id).await?));
    }
    Ok(out)
}

/// 删除校验（finance_checkOrderPayment）：各订单 {allocated, adjustment, 客户} 供删除红冲用。
pub async fn check_order_payment(
    pool: &PgPool,
    tenant_id: i64,
    order_ids: &[i64],
) -> ApiResult<Vec<CheckOrderPaymentItem>> {
    let mut out = Vec::with_capacity(order_ids.len());
    for &id in order_ids {
        let of = order_finance(pool, tenant_id, id).await?;
        // 拆开的两段：删除时红冲要**按来源分别入账**，见 `reverse_order_allocation`。
        let (order_paid_amount, allocation_amount) = order_allocated_parts(pool, tenant_id, id).await?;
        let (customer_code, customer_name): (String, String) = sqlx::query_as(
            "SELECT client_code, client_name FROM orders WHERE id = $1 AND tenant_id = $2",
        )
        .bind(id)
        .bind(tenant_id)
        .fetch_one(pool)
        .await?;
        out.push(CheckOrderPaymentItem {
            order_id: id,
            allocated_amount: of.allocated_amount,
            order_paid_amount,
            allocation_amount,
            adjustment_amount: of.adjustment_amount,
            customer_code,
            customer_name,
        });
    }
    Ok(out)
}

/// 冲销订单的「资金池分配」（**删除订单红冲**的一部分，见 `app/src/views/Home.vue` 的 `deleteSelected`）。
///
/// ## 为什么必须单独有这一条
///
/// 删除订单时前端要「先红冲再删」。旧版把整笔 `已分配收款` 写成**一条客户级负收款**
/// （`order_id = NULL`）。在我们的账务模型里那样会**同一笔钱扣两次**：
///
/// ```text
/// 未分配余额 = 实收金额 − 已分配总额
/// 实收金额   = Σ finance_payments（按客户，含红冲负数）          ← 负收款减的是它
/// 已分配总额 = Σ finance_payments(order_id IS NOT NULL) + Σ finance_allocations
///                                            ↑ 只认带 order_id 的收款，减不到
/// ```
///
/// ⇒ 负收款让 `实收` 掉了 A，而被删订单对 `已分配总额` 的贡献 A 仍在（`order_paid` 与
/// `alloc` 都按 `order_id` 聚合，订单删了行还留着），净效果是**多扣 2A**。
/// 实测（事务内 `ROLLBACK`，见 `docs/home-audit/`）：池分配 300 的订单删掉后
/// 未分配余额 700 → 400，正确应为 1000。
///
/// 所以红冲按**来源**拆成两条腿：
///   · 本单直接收款 → 负的 `finance_payments`（**带 `order_id`**）⇒ `实收` 与
///     `已分配总额` 同时降 d，未分配余额不变（正确：那笔钱本来就不在池子里）；
///   · 资金池分配   → 负的 `finance_allocations`（**本函数**）⇒ `已分配总额` 降 a、
///     `实收` 不动，那 a 回到池子里（正确）。
///
/// ## 行为
///
/// 取该订单当前的 `finance_allocations` 合计（**服务端自己算**，不接受客户端传金额，
/// 免得两边对不上），写一条等额负数。没有分配时**不写**、返回 0。
///
/// ⚠️ **不查 `orders`**：调用方可能把红冲排在删除之后。也正因如此，本函数**不校验订单存在**。
/// ⚠️ **不做幂等**：连调两次会冲两次（-2a）。与 `add_order_payment` 一致（那条同样是纯追加）。
///    要幂等得引入「已冲销」标记，超出本次范围。
pub async fn reverse_order_allocation(
    pool: &PgPool,
    tenant_id: i64,
    order_id: i64,
) -> ApiResult<f64> {
    let (_, alloc) = order_allocated_parts(pool, tenant_id, order_id).await?;
    if alloc.abs() < 0.005 {
        return Ok(0.0);
    }

    let (customer_code, receipt_no): (String, String) = sqlx::query_as(
        "SELECT COALESCE(MAX(customer_code), ''), COALESCE(MAX(receipt_no), '') \
         FROM finance_allocations WHERE tenant_id = $1 AND order_id = $2",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_one(pool)
    .await?;

    sqlx::query(
        "INSERT INTO finance_allocations \
         (tenant_id, customer_code, order_id, receipt_no, amount, discount) \
         VALUES ($1, $2, $3, $4, $5, 0)",
    )
    .bind(tenant_id)
    .bind(&customer_code)
    .bind(order_id)
    .bind(&receipt_no)
    .bind(-alloc)
    .execute(pool)
    .await?;

    Ok(alloc)
}

/// 该客户的可分配订单，顺序照旧版 `financeOrdersForCustomer`
/// （`orderBy: [{order:{orderDate:'asc'}}, {createdAt:'asc'}]`，svc:155/165）。
///
/// 改动 7：旧版的第二排序键是 **finance_orders 行（财务行）的 `createdAt`**，我们没建单独的
/// 财务行，只能拿 `orders.created_at` 当替代 —— 这是**近似，不是精确等价**：旧系统里财务行
/// 是订单落库时一并建的，两者顺序通常一致，但同日补录/导入的订单可能反序。
/// 末尾补 `id` 只为让顺序**确定**（旧版没这个兜底，同日同秒的行顺序由数据库给）。
async fn fetch_allocatable_orders(
    pool: &PgPool,
    tenant_id: i64,
    customer_code: &str,
) -> ApiResult<Vec<OrderHead>> {
    let rows: Vec<(i64, String, String, f64)> = sqlx::query_as(
        "SELECT id, receipt_no, to_char(order_date, 'YYYY-MM-DD'), total_price \
         FROM orders WHERE tenant_id = $1 AND client_code = $2 \
         ORDER BY order_date, created_at, id",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(id, receipt_no, order_date, total_price)| OrderHead {
            id,
            receipt_no,
            order_date,
            total_price,
        })
        .collect())
}

/// 贪心分配（旧版 `buildAllocationPreview` svc:201-218 的**非红冲分支**）：订单日期从早到晚，
/// 每单最多分到「它还没收的部分」。返回 `(分配行, 该行优惠金额)`。
///
/// `rate` 是**小数**（旧版口径，0.1 = 10%）；我们对外接口收百分数，换算在调用方做一次。
///
/// 优惠公式（旧版 svc:206）：
/// ```text
/// discount = rate > 0 ? min(未收 − 分配额, round(分配额 × rate, 2)) : 0
/// ```
/// ⚠️ `未收 − 分配额` 这个上限是**关键**：整单被这次分配付清时它恰好是 0 ⇒ **优惠恒为 0**。
/// 我们先前没有这道上限，于是在「收款刚好覆盖整单」这个最常见场景下给出了旧系统从没给过的
/// 优惠（实测：收 1000 付清整单，旧版 0 / 我们 100，见 04-diff-ours.md §9.5）。
async fn build_allocation_rows(
    pool: &PgPool,
    tenant_id: i64,
    customer_code: &str,
    amount: f64,
    rate: f64,
) -> ApiResult<(Vec<(AllocationItem, f64)>, f64)> {
    let mut remaining = amount;
    let mut allocations: Vec<(AllocationItem, f64)> = Vec::new();
    let mut total_discount = 0.0_f64;
    for o in fetch_allocatable_orders(pool, tenant_id, customer_code).await? {
        if remaining <= 0.005 {
            break;
        }
        let of = order_finance(pool, tenant_id, o.id).await?;
        let unpaid = of.unpaid_amount;
        // 旧版是在 SQL 里 `unpaidAmount > 0` 过滤的（svc:171），我们的未收是实时算的，所以在这儿跳。
        if unpaid <= 0.005 {
            continue;
        }
        let a = round2(unpaid.min(remaining));
        let discount = if rate > 0.0 {
            round2(a * rate).min(round2(unpaid - a)).max(0.0)
        } else {
            0.0
        };
        allocations.push((
            AllocationItem {
                order_id: o.id,
                receipt_no: o.receipt_no,
                order_date: o.order_date,
                total_price: round2(o.total_price),
                allocated_amount: a,
                remaining_after: round2(unpaid - a),
            },
            discount,
        ));
        total_discount = round2(total_discount + discount);
        remaining = round2(remaining - a);
    }
    Ok((allocations, total_discount))
}

/// 分配预览（finance_previewAllocation）：按「未收 > 0 的订单，最早优先」贪心分配拟收款。
pub async fn preview_allocation(
    pool: &PgPool,
    tenant_id: i64,
    req: PreviewAllocation,
) -> ApiResult<AllocationPreview> {
    let amount = round2(req.amount);
    // 客户收款预览：拟收款额**不按池子封顶**（旧版 `previewAllocation` svc:778-783 也没封）——
    // 它预览的是「即将收进来的这笔钱怎么摊」，钱还没进池子。同理不给优惠（rate 0）。
    let (allocations, _) =
        build_allocation_rows(pool, tenant_id, &req.customer_code, amount, 0.0).await?;
    let allocated: f64 = allocations.iter().map(|(r, _)| r.allocated_amount).sum();

    Ok(AllocationPreview {
        allocations: allocations.into_iter().map(|(r, _)| r).collect(),
        remaining_unallocated: round2(amount - allocated),
    })
}

/// 预付款分配计划 = 旧版 `previewPrepaymentAllocation`(svc:788-801) 与
/// `executePrepaymentAllocation`(svc:805-863) 的**公共前段**。
/// 预览与执行共用同一份，避免「预览显示的数」和「执行落库的数」各算各的。
struct PrepaymentPlan {
    /// 封顶后的分配金额（旧版预览里的 `totalAmount`）。
    amount: f64,
    /// 客户资金池可用额（旧版 `availableBalance`，svc:800/862）。
    available: f64,
    /// 逐单分配行 + 该行的优惠金额。优惠**不在分配行里**，单独记订单调整（见 execute）。
    rows: Vec<(AllocationItem, f64)>,
    total_discount: f64,
    customer_name: String,
}

async fn prepayment_plan(
    pool: &PgPool,
    tenant_id: i64,
    req: &PreviewPrepaymentAllocation,
) -> ApiResult<PrepaymentPlan> {
    // 改动 1（旧版 svc:796-797 / svc:814-815）：先按客户资金池封顶。
    // `amount = min(max(0, 请求额), max(0, 池子可用额))` —— 池子里没钱就**一分也分不出去**。
    // 我们先前完全没有这道闸：池子为 0 也能分配出 660，把池子扣成负数（实测见
    // 04-diff-ours.md §9.6 场景④/③b）。这不是数字对不上，是**能凭空造出钱**。
    let cb = customer_balance(pool, tenant_id, &req.customer_code).await?;
    let available = if cb.unallocated_balance > 0.0 {
        cb.unallocated_balance
    } else {
        0.0
    };
    let amount = round2(req.allocate_amount.max(0.0).min(available));
    // 优惠比例：旧版收的是**小数**（0.05 = 5%，svc:782 直接乘），我们对外收百分数，这里换算一次。
    let rate = req.discount_rate / 100.0;
    let (rows, total_discount) =
        build_allocation_rows(pool, tenant_id, &req.customer_code, amount, rate).await?;
    Ok(PrepaymentPlan {
        amount,
        available,
        rows,
        total_discount,
        customer_name: cb.customer_name,
    })
}

/// 把计划摊成对外响应（预览与执行返回的是同一份，旧版 svc:800/862 也是这么给的）。
fn plan_response(plan: &PrepaymentPlan) -> PrepaymentAllocationPreview {
    let allocated: f64 = plan.rows.iter().map(|(r, _)| r.allocated_amount).sum();
    PrepaymentAllocationPreview {
        allocations: plan.rows.iter().map(|(r, _)| r.clone()).collect(),
        total_allocated: round2(allocated),
        total_discount: plan.total_discount,
        // 改动 6：`资金池剩余` = **本次拟分配里没分掉的**（旧版 `buildAllocationPreview` 返回的
        // `remaining`，svc:227），不是「客户池子还剩多少」—— 后者是 `available_balance`。
        // 同名不同物曾是差异⑤（旧版 0 / 我们连字段都没有）。
        pool_remaining: round2(plan.amount - allocated),
        available_balance: plan.available,
    }
}

/// 预付款分配预览（finance_previewPrepaymentAllocation）。
/// 分配算法：订单日期从早到晚贪心 + 池子封顶 + 旧版的优惠上限，全部在 `prepayment_plan` 里。
pub async fn preview_prepayment_allocation(
    pool: &PgPool,
    tenant_id: i64,
    req: PreviewPrepaymentAllocation,
) -> ApiResult<PrepaymentAllocationPreview> {
    Ok(plan_response(&prepayment_plan(pool, tenant_id, &req).await?))
}

/// 预付款分配执行（finance_executePrepaymentAllocation）。
///
/// 落库两条（旧版 svc:819-861 的转写）：
///
/// ① `finance_allocations` 写 `amount = 分配额`、`discount = 优惠额`。
///    ⚠️ **`amount` 只写分配额，不含优惠**（改动 2）。我们的资金池是流水推导的
///    （`未分配余额 = 客户级收款 − 已分配总额`），把优惠塞进 `amount` 等于「优惠从客户池子
///    转出」；旧版口径是**店家让利**：`newPrepaid = prepaidBalance − totalAllocated` 只减
///    `Σalloc`（svc:843），优惠一分钱不碰池子。实测两边池子差一个优惠额（差 60，
///    见 04-diff-ours.md §9.6 场景③）。
///    `discount` 列保留只为**追溯**，**不参与任何计算**（历史行里还留着旧口径的
///    `amount = alloc + disc`，所以要改口径时不能拿它反推 amount）。
///
/// ② 优惠 > 0 时**另写一条** `finance_order_adjustments`（`type = 预付款优惠`，svc:836-840）——
///    优惠计入订单的「订单调整金额」，照样减未收，但不动资金池。这样
///    `未收 = 总价 − Σalloc − Σadj(含优惠)` 与旧版 `nextUnpaid`（svc:827）一致。
///
/// ③ 池子不需要显式扣减：它就是 ① 的流水实时聚合出来的。
///
/// 返回与预览同一份计划（旧版 svc:862 也是把 preview 整个摊在响应里）。
pub async fn execute_prepayment_allocation(
    pool: &PgPool,
    tenant_id: i64,
    req: ExecutePrepaymentAllocation,
) -> ApiResult<PrepaymentAllocationPreview> {
    let plan = prepayment_plan(
        pool,
        tenant_id,
        &PreviewPrepaymentAllocation {
            customer_code: req.customer_code.clone(),
            allocate_amount: req.allocate_amount,
            discount_rate: req.discount_rate,
        },
    )
    .await?;

    // 事务：旧版这里是逐单顺序 await、**没有事务**（svc:805-863），中途失败会留下
    // 「前几单已分配、池子没扣」的半成品；我们保持事务，是有意的改进，不照抄（见
    // 04-diff-ours.md §9 与 08-fix-plan.md「不做的」第 1 条）。
    let mut tx = pool.begin().await?;
    for (a, disc) in &plan.rows {
        sqlx::query(
            "INSERT INTO finance_allocations \
             (tenant_id, customer_code, order_id, receipt_no, amount, discount) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(tenant_id)
        .bind(&req.customer_code)
        .bind(a.order_id)
        .bind(&a.receipt_no)
        .bind(a.allocated_amount)
        .bind(*disc)
        .execute(&mut *tx)
        .await?;

        if *disc > 0.0 {
            sqlx::query(
                "INSERT INTO finance_order_adjustments \
                 (tenant_id, customer_code, customer_name, order_id, receipt_no, amount, type, remark) \
                 VALUES ($1, $2, $3, $4, $5, $6, '预付款优惠', $7)",
            )
            .bind(tenant_id)
            .bind(&req.customer_code)
            .bind(&plan.customer_name)
            .bind(a.order_id)
            .bind(&a.receipt_no)
            .bind(*disc)
            .bind(&req.remark)
            .execute(&mut *tx)
            .await?;
        }
    }
    tx.commit().await?;

    Ok(plan_response(&plan))
}

/// 收款趋势（finance_getPaymentStats）：每月/年 拆分 收款(正) 与 红冲(负的绝对值)。
pub async fn payment_stats(
    pool: &PgPool,
    tenant_id: i64,
    customer_code: &str,
) -> ApiResult<serde_json::Value> {
    // (period, 收款, 红冲)：pay_date 存 'YYYY-MM-DD' 或 'YYYY-MM-DD HH:mm:ss'，取前 7/4 位即可。
    let monthly: Vec<(String, f64, f64)> = sqlx::query_as(
        "SELECT left(pay_date, 7) AS m, \
                COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0.0), \
                COALESCE(SUM(-amount) FILTER (WHERE amount < 0), 0.0) \
         FROM finance_payments WHERE tenant_id = $1 AND customer_code = $2 AND pay_date <> '' \
         GROUP BY m ORDER BY m",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_all(pool)
    .await?;

    let yearly: Vec<(String, f64, f64)> = sqlx::query_as(
        "SELECT left(pay_date, 4) AS y, \
                COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0.0), \
                COALESCE(SUM(-amount) FILTER (WHERE amount < 0), 0.0) \
         FROM finance_payments WHERE tenant_id = $1 AND customer_code = $2 AND pay_date <> '' \
         GROUP BY y ORDER BY y",
    )
    .bind(tenant_id)
    .bind(customer_code)
    .fetch_all(pool)
    .await?;

    Ok(serde_json::json!({
        "monthly": monthly.into_iter().map(|(m, r, f)| serde_json::json!({"month": m, "receipt": round2(r), "refund": round2(f)})).collect::<Vec<_>>(),
        "yearly": yearly.into_iter().map(|(y, r, f)| serde_json::json!({"year": y, "receipt": round2(r), "refund": round2(f)})).collect::<Vec<_>>(),
    }))
}
