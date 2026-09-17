use serde::Serialize;

use crate::modules::orders::model::OrderLineDto;

/// 电子回执单载荷（`ReceiptMobile` 渲染所需的一切）。
///
/// ⚠️ 这里**只下发原始数据**，不下发渲染后的「回执行」——旧版就是前端构造的
/// （`receiptBuilder` 导出 `ps`/`gs`，见 `legacy/js/receiptBuilder-76e5b538.js`）。
/// 前端构造的原因很实在：开向图、自定义开向命名、亮窗/吊脚等文案都依赖前端资源。
#[derive(Debug, Serialize)]
pub struct ReceiptDto {
    pub receipt_no: String,
    pub client_name: String,
    pub phone: String,
    pub brand: String,
    pub order_date: String,
    pub due_date: String,
    pub production_days: i32,
    pub install_address: String,
    pub remark: String,
    pub salesperson: String,
    pub creator_name: String,
    /// 合计金额（= Σ 行金额）。
    pub total_price: f64,
    /// 定金（订单头原义）。
    pub deposit: f64,
    pub door_count: i32,
    /// 已分配金额（财务口径）—— 回执「已付款」用它覆盖定金。
    pub allocated_amount: f64,
    /// 未收金额（财务口径）—— 回执「待付款」用它覆盖 `总价 - 定金`。
    pub unpaid_amount: f64,
    pub tenant_name: String,
    /// 订单须知（旧版 = `租户.declaration || "含安装费"`）。
    pub declaration: String,
    pub lines: Vec<OrderLineDto>,
}

/// 分享链接签发结果。链接由前端用 `token` + 当前 origin 拼出，后端不猜部署域名。
#[derive(Debug, Serialize)]
pub struct ShareTokenDto {
    pub receipt_no: String,
    pub token: String,
    /// Unix 秒。前端按此提示「链接有效期至 …」。
    pub expires_at: i64,
}
