use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// `parts`/`markup` 缺省为空数组而非 null，与 JSONB 列默认值保持一致。
fn empty_json_array() -> Value {
    json!([])
}

/// 订单行请求体。算料结果 `parts` 与加价项 `markup` 由前端 formulaEngine 计算后整体传入。
#[derive(Debug, Deserialize)]
pub struct OrderLineInput {
    #[serde(default)]
    pub line_type: String,
    #[serde(default)]
    pub profile: String,
    #[serde(default)]
    pub color: String,
    #[serde(default)]
    pub direction: String,
    #[serde(default)]
    pub fans: String,
    #[serde(default)]
    pub track: String,
    #[serde(default)]
    pub casing: String,
    #[serde(default)]
    pub hardware: String,
    #[serde(default)]
    pub bottom_glass: String,
    #[serde(default)]
    pub face_glass: String,
    #[serde(default)]
    pub glass_thickness: String,
    #[serde(default)]
    pub door_width: f64,
    #[serde(default)]
    pub door_height: f64,
    #[serde(default)]
    pub light_window_height: f64,
    #[serde(default)]
    pub wall_thickness: f64,
    #[serde(default)]
    pub jiao: f64,
    #[serde(default)]
    pub mother_door_width: f64,
    #[serde(default)]
    pub quantity: i32,
    #[serde(default)]
    pub unit_price: f64,
    #[serde(default)]
    pub price_type: String,
    #[serde(default)]
    pub discount: f64,
    #[serde(default)]
    pub square: f64,
    #[serde(default)]
    pub custom_square: f64,
    #[serde(default)]
    pub other_fee: f64,
    #[serde(default)]
    pub casing_price: f64,
    #[serde(default)]
    pub casing_amount: f64,
    #[serde(default)]
    pub amount: f64,
    #[serde(default = "empty_json_array")]
    pub parts: Value,
    #[serde(default = "empty_json_array")]
    pub markup: Value,
    #[serde(default)]
    pub formula_id: Option<i64>,
    #[serde(default)]
    pub remark: String,
    #[serde(default)]
    pub install_address: String,
    #[serde(default)]
    pub open_img: String,
    #[serde(default)]
    pub edge_seal_count: Option<f64>,
    #[serde(default)]
    pub seal_board_height: f64,
    #[serde(default)]
    pub track_length: f64,
    #[serde(default)]
    pub front_casing_add: Option<f64>,
    #[serde(default)]
    pub back_casing_add: Option<f64>,
    #[serde(default)]
    pub double_ding: Option<String>,
    #[serde(default)]
    pub light_window_count: i32,
    #[serde(default)]
    pub image_id: Option<String>,
    #[serde(default)]
    pub image_url: Option<String>,
    #[serde(default)]
    pub progress: String,
    #[serde(default)]
    pub hole_size: String,
    /// 行级「单号」（`N-YY/MM/DD`）。⚠️ 前端**必须回传** —— `#[serde(default)]` 下漏传 =
    /// 空串 = 把已有的单号抹掉。见 `migrations/0020_order_line_no.sql`。
    #[serde(default)]
    pub line_no: String,
    /// 行级工序槽 `{"工序1":"下料_张三_2026-09-19", …}`（15 个扁平槽，空槽可为空串/缺键）。
    ///
    /// 见 `migrations/0021_progress.sql` 与 `docs/2026-09-19-progress-analysis.md`。
    /// ⚠️ **当前是「只读列」**：`update_line` / `insert_line` 的列清单里**没有它**，
    ///    所以整单保存**不会碰它**（原样保留），传了也是空转。
    ///    · 新建行 → 拿 0021 的 `DEFAULT '{}'`。
    ///    · ⚠️ **等做「更新进度」时**，必须**同时**把它加进那两处写路径，
    ///      并按 `line_no` 的口径处理（全字段替换下，漏传即抹空）。
    #[serde(default = "empty_slots")]
    pub procedure_slots: Value,
}

/// `procedure_slots` 的 serde 默认值：**空对象 `{}`**（不是 null）。
/// 与 0021 里那一列的 `DEFAULT {}` 对齐。
fn empty_slots() -> Value {
    Value::Object(serde_json::Map::new())
}

/// 新建/更新订单请求体：订单头 + 行列表。
#[derive(Debug, Deserialize)]
pub struct OrderRequest {
    #[serde(default)]
    pub receipt_no: String,
    #[serde(default)]
    pub client_code: String,
    #[serde(default)]
    pub client_name: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub brand: String,
    #[serde(default)]
    pub order_date: String,
    #[serde(default)]
    pub production_days: i32,
    #[serde(default)]
    pub deposit: f64,
    #[serde(default)]
    pub remark: String,
    #[serde(default)]
    pub salesperson: String,
    // ⚠️ 这里**没有** `order_no_set` —— 它是**服务端派生值**（= 本单各行 `line_no` 去重后
    //    `_` 连接），不接受客户端传入，见 `service.rs` 的 `refresh_order_no_set`。
    //    客户端仍可发这个键（serde 默认忽略未知字段），但**别把它加回来**：
    //    让客户端能写它，就会重现「漏传即抹空」那个坑。
    #[serde(default)]
    pub install_address: String,
    #[serde(default)]
    pub production_status: String,
    #[serde(default)]
    pub lock_direction: String,
    #[serde(default)]
    pub lines: Vec<OrderLineInput>,
}

/// Home「查询更多」的过滤条件 —— 旧版 `getMoreTableDate`（旧版唯一按日期范围查单的入口）。
///
/// 旧版坐标：`legacy/js/Home.formatted.js:11074`（`ys`）拼的 URL
/// `?param1=getMoreTableDate&param2={ds}&param3={客户}&param4={安装地址}&param5={起始日期}&param6={结束日期}`。
/// 四个条件全部可缺省，空串/缺省 = 该条件不过滤（与旧版「不填就不传」等价）。
#[derive(Debug, Deserialize)]
pub struct OrderSearchQuery {
    /// 旧版 param3：客户名（弹窗里 autocomplete 选中的值）。子串匹配。
    #[serde(default)]
    pub client_name: Option<String>,
    /// 旧版 param4：安装地址。子串匹配。
    #[serde(default)]
    pub install_address: Option<String>,
    /// 旧版 param5：起始日期 `YYYY-MM-DD`，**含当日**。
    #[serde(default)]
    pub start_date: Option<String>,
    /// 旧版 param6：结束日期 `YYYY-MM-DD`，**含当日**。
    #[serde(default)]
    pub end_date: Option<String>,
}

/// 订单头就地编辑（Home 主表内联编辑/改日期/改客户名）。只动头字段，不碰行。
/// 前端已有整行，直接提交全量头字段即可，无需逐字段 PATCH。
#[derive(Debug, Deserialize)]
pub struct OrderHeadPatch {
    #[serde(default)]
    pub client_code: String,
    #[serde(default)]
    pub client_name: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub brand: String,
    #[serde(default)]
    pub order_date: String,
    #[serde(default)]
    pub production_days: i32,
    #[serde(default)]
    pub deposit: f64,
    #[serde(default)]
    pub remark: String,
    #[serde(default)]
    pub salesperson: String,
    // ⚠️ 这里**没有** `order_no_set` —— 它是**服务端派生值**（= 本单各行 `line_no` 去重后
    //    `_` 连接），不接受客户端传入，见 `service.rs` 的 `refresh_order_no_set`。
    //    客户端仍可发这个键（serde 默认忽略未知字段），但**别把它加回来**：
    //    让客户端能写它，就会重现「漏传即抹空」那个坑。
    #[serde(default)]
    pub install_address: String,
    #[serde(default)]
    pub production_status: String,
    #[serde(default)]
    pub creator_name: String,
    #[serde(default)]
    pub lock_direction: String,
}

#[derive(Debug, Serialize)]
pub struct OrderLineDto {
    pub id: i64,
    pub line_type: String,
    pub row_index: i32,
    pub profile: String,
    pub color: String,
    pub direction: String,
    pub fans: String,
    pub track: String,
    pub casing: String,
    pub hardware: String,
    pub bottom_glass: String,
    pub face_glass: String,
    pub glass_thickness: String,
    pub door_width: f64,
    pub door_height: f64,
    pub light_window_height: f64,
    pub wall_thickness: f64,
    pub jiao: f64,
    pub mother_door_width: f64,
    pub quantity: i32,
    pub unit_price: f64,
    pub price_type: String,
    pub discount: f64,
    pub square: f64,
    pub custom_square: f64,
    pub other_fee: f64,
    pub casing_price: f64,
    pub casing_amount: f64,
    pub amount: f64,
    pub parts: Value,
    pub markup: Value,
    pub formula_id: Option<i64>,
    pub remark: String,
    pub install_address: String,
    pub open_img: String,
    pub edge_seal_count: Option<f64>,
    pub seal_board_height: f64,
    pub track_length: f64,
    pub front_casing_add: Option<f64>,
    pub back_casing_add: Option<f64>,
    pub double_ding: Option<String>,
    pub light_window_count: i32,
    pub image_id: Option<String>,
    pub image_url: Option<String>,
    pub progress: String,
    pub hole_size: String,
    /// 行级「单号」（`N-YY/MM/DD`）—— 旧版印在玻璃单/生产单上、也是二维码的内容。
    pub line_no: String,
    /// 行级工序槽 `{"工序1":"下料_张三_2026-09-19", …}`。见 `migrations/0021_progress.sql`。
    pub procedure_slots: Value,
}

/// 列表用订单头（不含行）。
#[derive(Debug, Serialize)]
pub struct OrderSummaryDto {
    pub id: i64,
    pub receipt_no: String,
    pub client_code: String,
    pub client_name: String,
    pub phone: String,
    pub brand: String,
    pub order_date: String,
    pub production_days: i32,
    pub due_date: String,
    pub total_price: f64,
    pub deposit: f64,
    pub remark: String,
    pub salesperson: String,
    pub order_no_set: String,
    pub install_address: String,
    pub production_status: String,
    pub creator_name: String,
    pub lock_direction: String,
    pub door_count: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// 订单详情（头 + 行）。
#[derive(Debug, Serialize)]
pub struct OrderDto {
    pub id: i64,
    pub receipt_no: String,
    pub client_code: String,
    pub client_name: String,
    pub phone: String,
    pub brand: String,
    pub order_date: String,
    pub production_days: i32,
    pub due_date: String,
    pub total_price: f64,
    pub deposit: f64,
    pub remark: String,
    pub salesperson: String,
    pub order_no_set: String,
    pub install_address: String,
    pub production_status: String,
    pub creator_name: String,
    pub lock_direction: String,
    pub door_count: i32,
    pub created_at: String,
    pub updated_at: String,
    pub lines: Vec<OrderLineDto>,
}
