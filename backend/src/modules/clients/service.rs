use sqlx::PgPool;

use crate::core::error::{ApiError, ApiResult};

use super::model::{ClientDto, ClientRequest};

/// SELECT 列顺序（与 ClientRow 一一对应）。
const COLUMNS: &str = "id, tenant_id, code, name, brand, contact, phone, delivery_phone, \
     address, logistics, logistics_phone, \
     to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, \
     to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at";

#[derive(sqlx::FromRow)]
struct ClientRow {
    id: i64,
    tenant_id: i64,
    code: String,
    name: String,
    brand: String,
    contact: String,
    phone: String,
    delivery_phone: String,
    address: String,
    logistics: String,
    logistics_phone: String,
    created_at: String,
    updated_at: String,
}

fn row_to_dto(row: ClientRow) -> ClientDto {
    ClientDto {
        id: row.id,
        tenant_id: row.tenant_id,
        code: row.code,
        name: row.name,
        brand: row.brand,
        contact: row.contact,
        phone: row.phone,
        delivery_phone: row.delivery_phone,
        address: row.address,
        logistics: row.logistics,
        logistics_phone: row.logistics_phone,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

async fn fetch_row(pool: &PgPool, tenant_id: i64, id: i64) -> ApiResult<ClientDto> {
    let sql = format!("SELECT {COLUMNS} FROM clients WHERE id = $1 AND tenant_id = $2");
    let row: ClientRow = sqlx::query_as(&sql)
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("客户不存在"))?;
    Ok(row_to_dto(row))
}

/// 列表：按客户/联系人/电话/地址模糊搜索（空串=全部），按编号升序。
pub async fn list(pool: &PgPool, tenant_id: i64, search: &str) -> ApiResult<Vec<ClientDto>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM clients \
         WHERE tenant_id = $1 AND ($2 = '' OR name ILIKE '%' || $2 || '%' \
             OR contact ILIKE '%' || $2 || '%' \
             OR phone ILIKE '%' || $2 || '%' \
             OR address ILIKE '%' || $2 || '%') \
         ORDER BY NULLIF(code, '')::bigint, id"
    );
    let rows: Vec<ClientRow> = sqlx::query_as(&sql)
        .bind(tenant_id)
        .bind(search)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(row_to_dto).collect())
}

pub async fn get(pool: &PgPool, tenant_id: i64, id: i64) -> ApiResult<ClientDto> {
    fetch_row(pool, tenant_id, id).await
}

pub async fn create(
    pool: &PgPool,
    tenant_id: i64,
    user_id: i64,
    req: ClientRequest,
) -> ApiResult<ClientDto> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err(ApiError::bad_request("请输入客户名称"));
    }

    // 客户编号：按租户自增（旧版「编号」用于更新/删除与终端链接的算术）。
    let next: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(NULLIF(code, '')::bigint), 0) + 1 \
         FROM clients WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await?;
    let code = next.to_string();

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO clients (tenant_id, code, name, brand, contact, phone, delivery_phone, \
         address, logistics, logistics_phone, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id",
    )
    .bind(tenant_id)
    .bind(&code)
    .bind(name)
    .bind(&req.brand)
    .bind(&req.contact)
    .bind(&req.phone)
    .bind(&req.delivery_phone)
    .bind(&req.address)
    .bind(&req.logistics)
    .bind(&req.logistics_phone)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    fetch_row(pool, tenant_id, id).await
}

pub async fn update(
    pool: &PgPool,
    tenant_id: i64,
    id: i64,
    req: ClientRequest,
) -> ApiResult<ClientDto> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err(ApiError::bad_request("请输入客户名称"));
    }

    let result = sqlx::query(
        "UPDATE clients SET name = $1, brand = $2, contact = $3, phone = $4, \
         delivery_phone = $5, address = $6, logistics = $7, \
         logistics_phone = $8, updated_at = now() \
         WHERE id = $9 AND tenant_id = $10",
    )
    .bind(name)
    .bind(&req.brand)
    .bind(&req.contact)
    .bind(&req.phone)
    .bind(&req.delivery_phone)
    .bind(&req.address)
    .bind(&req.logistics)
    .bind(&req.logistics_phone)
    .bind(id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("客户不存在"));
    }

    fetch_row(pool, tenant_id, id).await
}

pub async fn delete(pool: &PgPool, tenant_id: i64, id: i64) -> ApiResult<()> {
    let result = sqlx::query("DELETE FROM clients WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(tenant_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("客户不存在"));
    }

    Ok(())
}
