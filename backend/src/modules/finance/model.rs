use serde::{Deserialize, Serialize};

// 财务子系统 DTO（新财务 Ht）。口径见 docs/2026-09-17-home-analysis.md §5/§7.3/§8.2。
// 新后端用英文 REST key，订单用 order_id 定位，客户用 customer_code 定位；receipt_no 仅冗余展示。

/// 分配项（客户收款 / 预付款分配时，把资金分配到具体订单）。
// 多余字段（order_date/total_price/remaining_after）为前端回显约定，后端不读。
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct AllocationInput {
    pub order_id: i64,
    #[serde(default)]
    pub receipt_no: String,
    #[serde(default)]
    pub order_date: String,
    #[serde(default)]
    pub total_price: f64,
    pub amount: f64,
    #[serde(default)]
    pub remaining_after: f64,
}

/// 本单收款（finance_addOrderPayment）。
#[derive(Debug, Deserialize)]
pub struct AddOrderPayment {
    #[serde(default)]
    pub customer_code: String,
    #[serde(default)]
    pub customer_name: String,
    pub order_id: i64,
    #[serde(default)]
    pub receipt_no: String,
    pub amount: f64,
    #[serde(default)]
    pub pay_date: String,
    #[serde(default)]
    pub method: String,
    #[serde(default)]
    pub remark: String,
    #[serde(default)]
    pub use_prepay_discount: bool,
    #[serde(default)]
    pub discount_rate: f64,
}

/// 订单抹零/冲销（finance_addOrderAdjustment）。
#[derive(Debug, Deserialize)]
pub struct AddOrderAdjustment {
    pub order_id: i64,
    #[serde(default)]
    pub receipt_no: String,
    #[serde(default)]
    pub customer_code: String,
    #[serde(default)]
    pub customer_name: String,
    pub amount: f64,
    #[serde(default, rename = "type")]
    pub adjust_type: String,
    #[serde(default)]
    pub remark: String,
}

/// 客户收款（finance_addPayment），带分配列表。
#[derive(Debug, Deserialize)]
pub struct AddCustomerPayment {
    #[serde(default)]
    pub customer_code: String,
    #[serde(default)]
    pub customer_name: String,
    pub amount: f64,
    #[serde(default)]
    pub pay_date: String,
    #[serde(default)]
    pub method: String,
    #[serde(default)]
    pub remark: String,
    #[serde(default)]
    pub allocations: Vec<AllocationInput>,
}

/// 客户抹零/冲销（finance_addCustomerAdjustment）。
#[derive(Debug, Deserialize)]
pub struct AddCustomerAdjustment {
    #[serde(default)]
    pub customer_code: String,
    #[serde(default)]
    pub customer_name: String,
    pub amount: f64,
    #[serde(default, rename = "type")]
    pub adjust_type: String,
    #[serde(default)]
    pub remark: String,
}

/// 分配预览（finance_previewAllocation）：入参客户 + 拟收款金额。
#[derive(Debug, Deserialize)]
pub struct PreviewAllocation {
    #[serde(default)]
    pub customer_code: String,
    pub amount: f64,
}

/// 预付款分配预览（finance_previewPrepaymentAllocation）。
#[derive(Debug, Deserialize)]
pub struct PreviewPrepaymentAllocation {
    #[serde(default)]
    pub customer_code: String,
    pub allocate_amount: f64,
    #[serde(default)]
    pub discount_rate: f64,
}

/// 删除/冲销前校验（finance_checkOrderPayment）：批量传订单号。
#[derive(Debug, Deserialize)]
pub struct CheckOrderPayment {
    #[serde(default)]
    pub order_ids: Vec<i64>,
}

/// 校验结果项：每单已分配/订单调整 + 客户定位（供删除红冲用）。
#[derive(Debug, Serialize)]
pub struct CheckOrderPaymentItem {
    pub order_id: i64,
    pub allocated_amount: f64,
    pub adjustment_amount: f64,
    pub customer_code: String,
    pub customer_name: String,
}

/// 预付款分配执行（finance_executePrepaymentAllocation）。
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ExecutePrepaymentAllocation {
    #[serde(default)]
    pub customer_code: String,
    pub allocate_amount: f64,
    #[serde(default)]
    pub discount_rate: f64,
    #[serde(default)]
    pub remark: String,
}

// ---------------------------------------------------------------------------
// 响应
// ---------------------------------------------------------------------------

/// 订单财务摘要（finance_getOrderFinanceSummary 项）。
#[derive(Debug, Serialize)]
pub struct OrderFinance {
    pub total_price: f64,
    pub allocated_amount: f64,
    pub adjustment_amount: f64,
    pub unpaid_amount: f64,
}

/// 订单财务单条记录（收款/分配/抹零）。
#[derive(Debug, Serialize)]
pub struct FinanceRecord {
    pub kind: String,
    pub date: String,
    pub amount: f64,
    pub remark: String,
}

/// 订单财务明细（finance_getOrderDetail）：totals + 分配明细 + 调整记录。
#[derive(Debug, Serialize)]
pub struct OrderFinanceDetail {
    pub total_price: f64,
    pub allocated_amount: f64,
    pub adjustment_amount: f64,
    pub unpaid_amount: f64,
    pub payment_records: Vec<FinanceRecord>,
    pub adjustment_records: Vec<FinanceRecord>,
}

/// 客户余额（finance_getCustomerBalance）。
#[derive(Debug, Serialize)]
pub struct CustomerBalance {
    pub customer_code: String,
    pub customer_name: String,
    pub order_total: f64,
    pub paid_amount: f64,
    pub customer_balance: f64,
    pub unallocated_balance: f64,
    pub order_adjust_total: f64,
    pub customer_adjust_total: f64,
}

/// 对账流水项（finance_getCustomerStatement）。
#[derive(Debug, Serialize)]
pub struct StatementItem {
    pub kind: String,
    pub receipt_no: String,
    pub date: String,
    pub amount: f64,
    pub install_address: String,
    pub remark: String,
}

/// 分配预览结果（finance_previewAllocation）。
#[derive(Debug, Serialize)]
pub struct AllocationPreview {
    pub allocations: Vec<AllocationItem>,
    pub remaining_unallocated: f64,
}

/// 分配预览里的单条分配结果。
#[derive(Debug, Serialize)]
pub struct AllocationItem {
    pub order_id: i64,
    pub receipt_no: String,
    pub order_date: String,
    pub total_price: f64,
    pub allocated_amount: f64,
    pub remaining_after: f64,
}

/// 预付款分配预览结果（finance_previewPrepaymentAllocation）。
#[derive(Debug, Serialize)]
pub struct PrepaymentAllocationPreview {
    pub allocations: Vec<AllocationItem>,
    pub total_allocated: f64,
    pub total_discount: f64,
    pub pool_remaining: f64,
}
