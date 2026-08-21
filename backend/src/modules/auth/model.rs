use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub old_password: String,
    pub new_password: String,
}

#[derive(Debug, Serialize)]
pub struct UserDto {
    pub id: i64,
    pub tenant_id: i64,
    pub username: String,
    pub name: String,
    pub role: String,
}

#[derive(Debug, Serialize)]
pub struct TenantDto {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserDto,
    pub tenant: TenantDto,
}
