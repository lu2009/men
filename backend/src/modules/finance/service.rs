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
// 口径（docs/2026-09-17-home-analysis.md §7.1/§7.3）：
//   已分配金额 = 本单收款(orders 级 finance_payments) + 预付款/客户收款分配(finance_allocations)
//   订单调整金额 = Σ finance_order_adjustments.amount（正=减免，负=冲销）
//   未收金额   = 总价 − 已分配金额 − 订单调整金额
//   订单总额   = Σ orders.total_price（按客户）
//   实收金额   = Σ finance_payments.amount（按客户，含红冲负数）
//   订单调整合计 = Σ finance_order_adjustments.amount（按客户）
//   客户调整合计 = Σ finance_customer_adjustments.amount（按客户）
//   客户余额   = 订单总额 − 实收金额 − 订单调整合计 − 客户调整合计
//   未分配余额 = 实收金额 − 已分配总额（= 已分配到订单的资金，含本单收款+分配）
// ---------------------------------------------------------------------------

/// 订单财务摘要。
pub async fn order_finance(pool: &PgPool, tenant_id: i64, order_id: i64) -> ApiResult<OrderFinance> {
    let head = fetch_order(pool, tenant_id, order_id).await?;

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

    let paid: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM finance_payments \
         WHERE tenant_id = $1 AND customer_code = $2",
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

    let allocated_total = round2(order_paid + alloc);
    let unallocated = round2(paid - allocated_total);
    let balance = round2(order_total - paid - order_adj - cust_adj);

    Ok(CustomerBalance {
        customer_code: customer_code.to_string(),
        customer_name: order_name,
        order_total: round2(order_total),
        paid_amount: round2(paid),
        customer_balance: balance,
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
    if amount > cb.customer_balance + 0.005 {
        return Err(ApiError::bad_request("收款金额超过客户余额"));
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
            adjustment_amount: of.adjustment_amount,
            customer_code,
            customer_name,
        });
    }
    Ok(out)
}

/// 分配预览（finance_previewAllocation）：按「未收 > 0 的订单，最早优先」贪心分配拟收款。
pub async fn preview_allocation(
    pool: &PgPool,
    tenant_id: i64,
    req: PreviewAllocation,
) -> ApiResult<AllocationPreview> {
    let amount = round2(req.amount);
    let orders: Vec<OrderHead> = {
        let rows: Vec<(i64, String, String, f64)> = sqlx::query_as(
            "SELECT id, receipt_no, to_char(order_date, 'YYYY-MM-DD'), total_price \
             FROM orders WHERE tenant_id = $1 AND client_code = $2 ORDER BY order_date, id",
        )
        .bind(tenant_id)
        .bind(&req.customer_code)
        .fetch_all(pool)
        .await?;
        rows.into_iter()
            .map(|(id, receipt_no, order_date, total_price)| OrderHead {
                id,
                receipt_no,
                order_date,
                total_price,
            })
            .collect()
    };

    let mut remaining = amount;
    let mut allocations = Vec::new();
    for o in orders {
        if remaining <= 0.005 {
            break;
        }
        let of = order_finance(pool, tenant_id, o.id).await?;
        let unpaid = of.unpaid_amount;
        if unpaid <= 0.005 {
            continue;
        }
        let a = unpaid.min(remaining);
        allocations.push(AllocationItem {
            order_id: o.id,
            receipt_no: o.receipt_no,
            order_date: o.order_date,
            total_price: round2(o.total_price),
            allocated_amount: round2(a),
            remaining_after: round2(unpaid - a),
        });
        remaining = round2(remaining - a);
    }

    Ok(AllocationPreview {
        allocations,
        remaining_unallocated: round2(remaining),
    })
}

/// 预付款分配预览（finance_previewPrepaymentAllocation）。
/// 分配算法旧版为服务端计算（bundle 内不可见），此处按「订单日期从早到晚」贪心分配，
/// 优惠金额 = 分配金额 × 优惠比例/100。INTERPRETED。
pub async fn preview_prepayment_allocation(
    pool: &PgPool,
    tenant_id: i64,
    req: PreviewPrepaymentAllocation,
) -> ApiResult<PrepaymentAllocationPreview> {
    let preview = preview_allocation(
        pool,
        tenant_id,
        PreviewAllocation {
            customer_code: req.customer_code.clone(),
            amount: req.allocate_amount,
        },
    )
    .await?;

    let total_allocated: f64 = preview.allocations.iter().map(|a| a.allocated_amount).sum();
    let total_discount = round2(total_allocated * req.discount_rate / 100.0);
    let cb = customer_balance(pool, tenant_id, &req.customer_code).await?;
    // 资金池剩余 = 未分配余额 − 分配金额 − 优惠金额（优惠同样从池扣）。
    let pool_remaining = round2(cb.unallocated_balance - req.allocate_amount - total_discount);

    Ok(PrepaymentAllocationPreview {
        allocations: preview.allocations,
        total_allocated: round2(total_allocated),
        total_discount,
        pool_remaining,
    })
}

/// 预付款分配执行（finance_executePrepaymentAllocation）：按预览结果落分配记录。
/// 每单 amount = 分配金额 + 优惠金额，discount = 优惠金额。
pub async fn execute_prepayment_allocation(
    pool: &PgPool,
    tenant_id: i64,
    req: ExecutePrepaymentAllocation,
) -> ApiResult<()> {
    let preview = preview_prepayment_allocation(
        pool,
        tenant_id,
        PreviewPrepaymentAllocation {
            customer_code: req.customer_code.clone(),
            allocate_amount: req.allocate_amount,
            discount_rate: req.discount_rate,
        },
    )
    .await?;

    let mut tx = pool.begin().await?;
    for a in &preview.allocations {
        let disc = round2(a.allocated_amount * req.discount_rate / 100.0);
        sqlx::query(
            "INSERT INTO finance_allocations \
             (tenant_id, customer_code, order_id, receipt_no, amount, discount) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(tenant_id)
        .bind(&req.customer_code)
        .bind(a.order_id)
        .bind(&a.receipt_no)
        .bind(round2(a.allocated_amount + disc))
        .bind(disc)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
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
