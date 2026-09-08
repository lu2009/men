use serde_json::{json, Value};
use sqlx::PgPool;

use crate::core::error::{ApiError, ApiResult};

use super::model::{AddPriceItemDto, AddPriceItemInput};

// ===== 加价项目 =====

#[derive(sqlx::FromRow)]
struct PriceItemRow {
    id: i64,
    name: String,
    price: f64,
    unit: String,
}

fn row_to_item(r: PriceItemRow) -> AddPriceItemDto {
    AddPriceItemDto { id: r.id, name: r.name, price: r.price, unit: r.unit }
}

/// 列表：加价项目（租户级），按更新时间倒序。
pub async fn list_price_items(pool: &PgPool, tenant_id: i64) -> ApiResult<Vec<AddPriceItemDto>> {
    let rows: Vec<PriceItemRow> = sqlx::query_as(
        "SELECT id, name, price, unit FROM add_price_items WHERE tenant_id = $1 ORDER BY id",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(row_to_item).collect())
}

/// 新增（同步保存）：name+price+unit 唯一，冲突时返回已存在（视为成功）。
pub async fn create_price_item(
    pool: &PgPool,
    tenant_id: i64,
    input: &AddPriceItemInput,
) -> ApiResult<AddPriceItemDto> {
    let row: PriceItemRow = sqlx::query_as(
        "INSERT INTO add_price_items (tenant_id, name, price, unit) VALUES ($1,$2,$3,$4) \
         ON CONFLICT (tenant_id, name, price, unit) DO UPDATE SET updated_at = now() \
         RETURNING id, name, price, unit",
    )
    .bind(tenant_id)
    .bind(&input.name)
    .bind(input.price)
    .bind(&input.unit)
    .fetch_one(pool)
    .await?;
    Ok(row_to_item(row))
}

/// 删除。
pub async fn delete_price_item(pool: &PgPool, tenant_id: i64, id: i64) -> ApiResult<()> {
    let result = sqlx::query("DELETE FROM add_price_items WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(tenant_id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("加价项目不存在"));
    }
    Ok(())
}

/// 读取列显隐配置：无记录时返回空对象（前端视为全部显示）。
pub async fn get_column_config(pool: &PgPool, tenant_id: i64) -> ApiResult<(Value, Value)> {
    let row = sqlx::query_as::<_, (Value, Value)>(
        "SELECT ping_columns, diao_columns FROM column_configs WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?;

    Ok(match row {
        Some((p, d)) => (p, d),
        None => (json!({}), json!({})),
    })
}

/// 保存（upsert）列显隐配置。
pub async fn upsert_column_config(
    pool: &PgPool,
    tenant_id: i64,
    ping_columns: Value,
    diao_columns: Value,
) -> ApiResult<()> {
    let result = sqlx::query(
        "INSERT INTO column_configs (tenant_id, ping_columns, diao_columns) \
         VALUES ($1, $2, $3) \
         ON CONFLICT (tenant_id) \
         DO UPDATE SET ping_columns = $2, diao_columns = $3, updated_at = now()",
    )
    .bind(tenant_id)
    .bind(&ping_columns)
    .bind(&diao_columns)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::internal("保存列配置失败"));
    }
    Ok(())
}
