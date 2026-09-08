use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn empty_array() -> Value {
    json!([])
}

fn empty_object() -> Value {
    json!({})
}

// ===== 型材价格 =====

#[derive(Debug, Deserialize)]
pub struct ProfilePriceInput {
    #[serde(default)]
    pub line_type: String,
    #[serde(default)]
    pub profile: String,
    #[serde(default)]
    pub price_type: String,
    #[serde(default)]
    pub unit_price: f64,
    pub casing_price: Option<f64>,
    #[serde(default = "empty_array")]
    pub lock_rules: Value,
    #[serde(default)]
    pub client_code: String,
    #[serde(default)]
    pub remark: String,
}

#[derive(Debug, Serialize)]
pub struct ProfilePriceDto {
    pub id: i64,
    pub line_type: String,
    pub profile: String,
    pub price_type: String,
    pub unit_price: f64,
    pub casing_price: Option<f64>,
    pub lock_rules: Value,
    pub client_code: String,
    pub remark: String,
    pub created_at: String,
    pub updated_at: String,
}

// ===== 公式匹配 =====

#[derive(Debug, Deserialize)]
pub struct FormulaMatchInput {
    #[serde(default)]
    pub line_type: String,
    #[serde(default)]
    pub profile: String,
    #[serde(default)]
    pub fans: String,
    pub formula_id: i64,
    #[serde(default)]
    pub priority: i32,
    #[serde(default)]
    pub remark: String,
}

#[derive(Debug, Serialize)]
pub struct FormulaMatchDto {
    pub id: i64,
    pub line_type: String,
    pub profile: String,
    pub fans: String,
    pub formula_id: i64,
    pub priority: i32,
    pub remark: String,
    pub created_at: String,
    pub updated_at: String,
}

// ===== 打印模板 =====

#[derive(Debug, Deserialize)]
pub struct PrintTemplateInput {
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub name: String,
    #[serde(default = "default_paper")]
    pub paper: String,
    #[serde(default = "empty_object")]
    pub template: Value,
    #[serde(default)]
    pub remark: String,
}

fn default_paper() -> String {
    "A4".to_string()
}

#[derive(Debug, Serialize)]
pub struct PrintTemplateDto {
    pub id: i64,
    pub mode: String,
    pub name: String,
    pub paper: String,
    pub template: Value,
    pub remark: String,
    pub created_at: String,
    pub updated_at: String,
}

// ===== 批量导入请求 =====

#[derive(Debug, Deserialize)]
pub struct ImportPricesRequest {
    pub items: Vec<ProfilePriceInput>,
}

#[derive(Debug, Deserialize)]
pub struct ImportFormulaMatchesRequest {
    pub items: Vec<FormulaMatchInput>,
}

#[derive(Debug, Deserialize)]
pub struct ImportPrintTemplatesRequest {
    pub items: Vec<PrintTemplateInput>,
}
