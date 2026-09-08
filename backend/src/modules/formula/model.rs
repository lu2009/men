use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 新建/更新公式请求体。`name` 必填，其余字段缺省为空串/空对象。
#[derive(Debug, Deserialize)]
pub struct FormulaRequest {
    pub name: String,
    #[serde(default)]
    pub formula_type: String,
    #[serde(default)]
    pub template_key: String,
    #[serde(default)]
    pub door_width: String,
    #[serde(default)]
    pub door_height: String,
    #[serde(default)]
    pub light_window_height: String,
    #[serde(default)]
    pub wall_thickness: String,
    #[serde(default)]
    pub jiao: String,
    #[serde(default)]
    pub mother_door_width: String,
    #[serde(default)]
    pub square: String,
    #[serde(default)]
    pub parts: Option<Value>,
    #[serde(default)]
    pub extra: Option<Value>,
    #[serde(default)]
    pub remark: String,
}

#[derive(Debug, Serialize)]
pub struct FormulaDto {
    pub id: i64,
    pub tenant_id: i64,
    pub name: String,
    pub formula_type: String,
    pub template_key: String,
    pub door_width: String,
    pub door_height: String,
    pub light_window_height: String,
    pub wall_thickness: String,
    pub jiao: String,
    pub mother_door_width: String,
    pub square: String,
    pub parts: Value,
    pub extra: Value,
    pub remark: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ImageRequest {
    #[serde(default)]
    pub direction: String,
    #[serde(default)]
    pub mirrored: bool,
    pub data_url: String,
}

#[derive(Debug, Serialize)]
pub struct FormulaImageDto {
    pub id: i64,
    pub formula_id: i64,
    pub direction: String,
    pub mirrored: bool,
    pub data_url: String,
}
