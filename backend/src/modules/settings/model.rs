use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// 列显隐配置：平开/移门各自的「字段名 → 是否显示」。
#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnConfigDto {
    #[serde(default = "empty_obj")]
    pub ping_columns: Value,
    #[serde(default = "empty_obj")]
    pub diao_columns: Value,
}

fn empty_obj() -> Value {
    json!({})
}

// ===== 加价项目 =====

#[derive(Debug, Serialize)]
pub struct AddPriceItemDto {
    pub id: i64,
    pub name: String,
    pub price: f64,
    pub unit: String,
}

#[derive(Debug, Deserialize)]
pub struct AddPriceItemInput {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub price: f64,
    #[serde(default)]
    pub unit: String,
}
