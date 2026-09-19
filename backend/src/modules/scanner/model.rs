use serde::{Deserialize, Serialize};

/// 开一个扫码账号：`{ suffix, password }`。
///
/// 只收**后缀**（员工名），完整账号名由服务端拼 `租户名 + 后缀` —— 见 `service::compose_username`。
/// 旧版是前端拼好完整用户名当 `param4` 传上来的（`legacy-dispatch.ts:1075`），
/// 那等于让调用方自选账号名；新版把拼接收到服务端，调用方只能定后缀。
#[derive(Debug, Deserialize)]
pub struct CreateScannerRequest {
    pub suffix: String,
    pub password: String,
}

/// 删除用 `?suffix=`。字段是 `Option`，缺参时由 handler 给出统一形状的错误体
/// （直接用 `String` 的话 axum 会吐一个非 JSON 的 400，前端只能拿到 "HTTP 400"）。
#[derive(Debug, Deserialize)]
pub struct DeleteScannerQuery {
    pub suffix: Option<String>,
}

/// 开户成功后的返回。
///
/// 前端要弹「账号 + 密码」给管理员抄走（旧版 `ElMessageBox.alert` 明文显示并复制剪贴板），
/// 密码是调用方自己传上来的，不回显；这里只回拼好的账号名。
#[derive(Debug, Serialize)]
pub struct ScannerAccountDto {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub role: String,
}
