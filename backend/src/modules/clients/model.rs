use serde::{Deserialize, Serialize};

/// 新建/更新客户请求体。`name` 必填，其余字段缺省为空串。
#[derive(Debug, Deserialize)]
pub struct ClientRequest {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub brand: String,
    #[serde(default)]
    pub contact: String,
    #[serde(default)]
    pub phone: String,
    #[serde(default)]
    pub delivery_phone: String,
    #[serde(default)]
    pub address: String,
    #[serde(default)]
    pub logistics: String,
    #[serde(default)]
    pub logistics_phone: String,
}

#[derive(Debug, Serialize)]
pub struct ClientDto {
    pub id: i64,
    pub tenant_id: i64,
    pub code: String,
    pub name: String,
    pub brand: String,
    pub contact: String,
    pub phone: String,
    pub delivery_phone: String,
    pub address: String,
    pub logistics: String,
    pub logistics_phone: String,
    pub created_at: String,
    pub updated_at: String,
}
