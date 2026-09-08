use serde_json::{json, Value};
use sqlx::PgPool;

use crate::core::base64;
use crate::core::error::{ApiError, ApiResult};

use super::model::{FormulaDto, FormulaImageDto, FormulaRequest, ImageRequest};

/// SELECT 列顺序（与 FormulaRow 元组一一对应）。
const COLUMNS: &str = "id, tenant_id, name, formula_type, template_key, door_width, door_height, \
     light_window_height, wall_thickness, jiao, mother_door_width, square, parts, remark, extra, \
     to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, \
     to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at";

#[derive(sqlx::FromRow)]
struct FormulaRow {
    id: i64,
    tenant_id: i64,
    name: String,
    formula_type: String,
    template_key: String,
    door_width: String,
    door_height: String,
    light_window_height: String,
    wall_thickness: String,
    jiao: String,
    mother_door_width: String,
    square: String,
    parts: Value,
    remark: String,
    extra: Value,
    created_at: String,
    updated_at: String,
}

fn row_to_dto(row: FormulaRow) -> FormulaDto {
    FormulaDto {
        id: row.id,
        tenant_id: row.tenant_id,
        name: row.name,
        formula_type: row.formula_type,
        template_key: row.template_key,
        door_width: row.door_width,
        door_height: row.door_height,
        light_window_height: row.light_window_height,
        wall_thickness: row.wall_thickness,
        jiao: row.jiao,
        mother_door_width: row.mother_door_width,
        square: row.square,
        parts: row.parts,
        extra: row.extra,
        remark: row.remark,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

async fn fetch_row(pool: &PgPool, tenant_id: i64, id: i64) -> ApiResult<FormulaDto> {
    let sql = format!("SELECT {COLUMNS} FROM formulas WHERE id = $1 AND tenant_id = $2");
    let row: FormulaRow = sqlx::query_as(&sql)
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("公式不存在"))?;
    Ok(row_to_dto(row))
}

/// 列表：按名称模糊搜索（空串=全部），按更新时间倒序。
pub async fn list(pool: &PgPool, tenant_id: i64, search: &str) -> ApiResult<Vec<FormulaDto>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM formulas \
         WHERE tenant_id = $1 AND ($2 = '' OR name ILIKE '%' || $2 || '%') \
         ORDER BY updated_at DESC"
    );
    let rows: Vec<FormulaRow> = sqlx::query_as(&sql)
        .bind(tenant_id)
        .bind(search)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(row_to_dto).collect())
}

pub async fn get(pool: &PgPool, tenant_id: i64, id: i64) -> ApiResult<FormulaDto> {
    fetch_row(pool, tenant_id, id).await
}

pub async fn create(
    pool: &PgPool,
    tenant_id: i64,
    user_id: i64,
    req: FormulaRequest,
) -> ApiResult<FormulaDto> {
    let parts = req.parts.unwrap_or_else(|| json!({}));
    let extra = req.extra.unwrap_or_else(|| json!({}));
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO formulas (tenant_id, name, formula_type, template_key, door_width, door_height, \
         light_window_height, wall_thickness, jiao, mother_door_width, square, parts, extra, remark, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id",
    )
    .bind(tenant_id)
    .bind(&req.name)
    .bind(&req.formula_type)
    .bind(&req.template_key)
    .bind(&req.door_width)
    .bind(&req.door_height)
    .bind(&req.light_window_height)
    .bind(&req.wall_thickness)
    .bind(&req.jiao)
    .bind(&req.mother_door_width)
    .bind(&req.square)
    .bind(parts)
    .bind(extra)
    .bind(&req.remark)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    fetch_row(pool, tenant_id, id).await
}

pub async fn update(
    pool: &PgPool,
    tenant_id: i64,
    id: i64,
    req: FormulaRequest,
) -> ApiResult<FormulaDto> {
    let parts = req.parts.unwrap_or_else(|| json!({}));
    let extra = req.extra.unwrap_or_else(|| json!({}));
    let result = sqlx::query(
        "UPDATE formulas SET name = $1, formula_type = $2, template_key = $3, door_width = $4, door_height = $5, \
         light_window_height = $6, wall_thickness = $7, jiao = $8, mother_door_width = $9, \
         square = $10, parts = $11, extra = $12, remark = $13, updated_at = now() \
         WHERE id = $14 AND tenant_id = $15",
    )
    .bind(&req.name)
    .bind(&req.formula_type)
    .bind(&req.template_key)
    .bind(&req.door_width)
    .bind(&req.door_height)
    .bind(&req.light_window_height)
    .bind(&req.wall_thickness)
    .bind(&req.jiao)
    .bind(&req.mother_door_width)
    .bind(&req.square)
    .bind(parts)
    .bind(extra)
    .bind(&req.remark)
    .bind(id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("公式不存在"));
    }

    fetch_row(pool, tenant_id, id).await
}

pub async fn delete(pool: &PgPool, tenant_id: i64, id: i64) -> ApiResult<()> {
    let result = sqlx::query("DELETE FROM formulas WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(tenant_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("公式不存在"));
    }

    Ok(())
}

// ---------- 挖孔图图片（formula_images） ----------

pub async fn list_images(
    pool: &PgPool,
    tenant_id: i64,
    formula_id: i64,
) -> ApiResult<Vec<FormulaImageDto>> {
    let rows: Vec<(i64, i64, String, bool, String, Vec<u8>)> = sqlx::query_as(
        "SELECT id, formula_id, direction, mirrored, mime, data \
         FROM formula_images WHERE formula_id = $1 AND tenant_id = $2 ORDER BY id",
    )
    .bind(formula_id)
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(image_row_to_dto).collect())
}

pub async fn add_image(
    pool: &PgPool,
    tenant_id: i64,
    formula_id: i64,
    req: ImageRequest,
) -> ApiResult<FormulaImageDto> {
    let exists: Option<i64> =
        sqlx::query_scalar("SELECT id FROM formulas WHERE id = $1 AND tenant_id = $2")
            .bind(formula_id)
            .bind(tenant_id)
            .fetch_optional(pool)
            .await?;
    if exists.is_none() {
        return Err(ApiError::not_found("公式不存在"));
    }

    let (mime, bytes) = parse_data_url(&req.data_url)?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO formula_images (formula_id, tenant_id, direction, mirrored, mime, data) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(formula_id)
    .bind(tenant_id)
    .bind(&req.direction)
    .bind(req.mirrored)
    .bind(&mime)
    .bind(&bytes)
    .fetch_one(pool)
    .await?;

    Ok(FormulaImageDto {
        id,
        formula_id,
        direction: req.direction,
        mirrored: req.mirrored,
        data_url: format!("data:{};base64,{}", mime, base64::encode(&bytes)),
    })
}

pub async fn delete_image(
    pool: &PgPool,
    tenant_id: i64,
    formula_id: i64,
    image_id: i64,
) -> ApiResult<()> {
    let result = sqlx::query(
        "DELETE FROM formula_images WHERE id = $1 AND formula_id = $2 AND tenant_id = $3",
    )
    .bind(image_id)
    .bind(formula_id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("图片不存在"));
    }

    Ok(())
}

fn image_row_to_dto(row: (i64, i64, String, bool, String, Vec<u8>)) -> FormulaImageDto {
    FormulaImageDto {
        id: row.0,
        formula_id: row.1,
        direction: row.2,
        mirrored: row.3,
        data_url: format!("data:{};base64,{}", row.4, base64::encode(&row.5)),
    }
}

fn parse_data_url(data_url: &str) -> ApiResult<(String, Vec<u8>)> {
    let rest = data_url
        .strip_prefix("data:")
        .ok_or_else(|| ApiError::bad_request("无效的图片数据"))?;
    let (mime, b64) = rest
        .split_once(";base64,")
        .ok_or_else(|| ApiError::bad_request("无效的图片数据"))?;
    let bytes =
        base64::decode(b64.trim()).map_err(|_| ApiError::bad_request("无效的 base64 数据"))?;
    if bytes.is_empty() {
        return Err(ApiError::bad_request("图片数据为空"));
    }
    Ok((mime.to_string(), bytes))
}
