use serde_json::Value;
use sqlx::PgPool;

use crate::core::error::ApiResult;

use super::model::{
    FormulaMatchDto, FormulaMatchInput, FormulaMatchResolveDto, PriceResolveDto, PrintTemplateDto,
    PrintTemplateInput, ProfilePriceDto, ProfilePriceInput,
};

const PRICE_COLUMNS: &str = "id, line_type, profile, price_type, unit_price, casing_price, \
     lock_rules, client_code, remark, \
     to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, \
     to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at";

const MATCH_COLUMNS: &str = "id, line_type, profile, fans, formula_id, priority, remark, \
     to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, \
     to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at";

const TEMPLATE_COLUMNS: &str = "id, mode, name, paper, template, remark, \
     to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, \
     to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at";

#[derive(sqlx::FromRow)]
struct PriceRow {
    id: i64,
    line_type: String,
    profile: String,
    price_type: String,
    unit_price: f64,
    casing_price: Option<f64>,
    lock_rules: Value,
    client_code: String,
    remark: String,
    created_at: String,
    updated_at: String,
}

#[derive(sqlx::FromRow)]
struct MatchRow {
    id: i64,
    line_type: String,
    profile: String,
    fans: String,
    formula_id: i64,
    priority: i32,
    remark: String,
    created_at: String,
    updated_at: String,
}

#[derive(sqlx::FromRow)]
struct TemplateRow {
    id: i64,
    mode: String,
    name: String,
    paper: String,
    template: Value,
    remark: String,
    created_at: String,
    updated_at: String,
}

fn price_to_dto(r: PriceRow) -> ProfilePriceDto {
    ProfilePriceDto {
        id: r.id,
        line_type: r.line_type,
        profile: r.profile,
        price_type: r.price_type,
        unit_price: r.unit_price,
        casing_price: r.casing_price,
        lock_rules: r.lock_rules,
        client_code: r.client_code,
        remark: r.remark,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }
}

fn match_to_dto(r: MatchRow) -> FormulaMatchDto {
    FormulaMatchDto {
        id: r.id,
        line_type: r.line_type,
        profile: r.profile,
        fans: r.fans,
        formula_id: r.formula_id,
        priority: r.priority,
        remark: r.remark,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }
}

fn template_to_dto(r: TemplateRow) -> PrintTemplateDto {
    PrintTemplateDto {
        id: r.id,
        mode: r.mode,
        name: r.name,
        paper: r.paper,
        template: r.template,
        remark: r.remark,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }
}

// ===== 型材价格 =====

pub async fn list_prices(pool: &PgPool, tenant_id: i64) -> ApiResult<Vec<ProfilePriceDto>> {
    let sql = format!(
        "SELECT {PRICE_COLUMNS} FROM profile_prices \
         WHERE tenant_id = $1 ORDER BY line_type, profile, client_code"
    );
    let rows: Vec<PriceRow> = sqlx::query_as(&sql).bind(tenant_id).fetch_all(pool).await?;
    Ok(rows.into_iter().map(price_to_dto).collect())
}

/// 批量导入（upsert）。冲突键：tenant_id + line_type + profile + client_code。
pub async fn import_prices(
    pool: &PgPool,
    tenant_id: i64,
    user_id: i64,
    items: Vec<ProfilePriceInput>,
) -> ApiResult<usize> {
    let count = items.len();
    let mut tx = pool.begin().await?;
    for it in items {
        sqlx::query(
            "INSERT INTO profile_prices (tenant_id, line_type, profile, price_type, unit_price, \
             casing_price, lock_rules, client_code, remark, created_by) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) \
             ON CONFLICT (tenant_id, line_type, profile, client_code) \
             DO UPDATE SET price_type = EXCLUDED.price_type, unit_price = EXCLUDED.unit_price, \
             casing_price = EXCLUDED.casing_price, lock_rules = EXCLUDED.lock_rules, \
             remark = EXCLUDED.remark, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(&it.line_type)
        .bind(&it.profile)
        .bind(&it.price_type)
        .bind(it.unit_price)
        .bind(it.casing_price)
        .bind(&it.lock_rules)
        .bind(&it.client_code)
        .bind(&it.remark)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(count)
}

// ===== 取价 resolve（型材关键字 → 单价）=====

/// 按型材关键字匹配一条价格：优先「客户专属价」，其次「通用价」；关键字越精确（越长/完全相等）越先。
/// 匹配规则复刻旧版 getPingPrice/getDiaoPrice：`型材.includes(关键字)`。
pub async fn resolve_price(
    pool: &PgPool,
    tenant_id: i64,
    line_type: &str,
    profile: &str,
    client_code: &str,
) -> ApiResult<Option<PriceResolveDto>> {
    let profile = profile.trim();
    if profile.is_empty() {
        return Ok(None);
    }
    let sql = format!(
        "SELECT {PRICE_COLUMNS} FROM profile_prices WHERE tenant_id = $1 AND line_type = $2"
    );
    let rows: Vec<PriceRow> = sqlx::query_as(&sql)
        .bind(tenant_id)
        .bind(line_type)
        .fetch_all(pool)
        .await?;

    // 排序键：(是否客户专属, 精确度)。精确度：完全相等 → 关键字长度（越长越具体）。
    let mut best: Option<((i32, i32), &PriceRow)> = None;
    for r in &rows {
        let kw = r.profile.trim();
        if kw.is_empty() || !profile.contains(kw) {
            continue;
        }
        let specificity = if kw == profile {
            i32::MAX
        } else {
            kw.chars().count() as i32
        };
        let client_specific = if !client_code.is_empty() && r.client_code == client_code {
            1
        } else {
            0
        };
        let key = (client_specific, specificity);
        if best.map_or(true, |(k, _)| key > k) {
            best = Some((key, r));
        }
    }

    Ok(best.map(|(_, r)| PriceResolveDto {
        unit_price: r.unit_price,
        price_type: r.price_type.clone(),
        casing_price: r.casing_price,
        lock_rules: r.lock_rules.clone(),
        matched_profile: r.profile.clone(),
    }))
}

// ===== 公式匹配 =====

pub async fn list_matches(pool: &PgPool, tenant_id: i64) -> ApiResult<Vec<FormulaMatchDto>> {
    let sql = format!(
        "SELECT {MATCH_COLUMNS} FROM formula_matches \
         WHERE tenant_id = $1 ORDER BY line_type, profile, fans, priority DESC"
    );
    let rows: Vec<MatchRow> = sqlx::query_as(&sql).bind(tenant_id).fetch_all(pool).await?;
    Ok(rows.into_iter().map(match_to_dto).collect())
}

/// 批量导入（upsert）。冲突键：tenant_id + line_type + profile + fans + formula_id。
pub async fn import_matches(
    pool: &PgPool,
    tenant_id: i64,
    items: Vec<FormulaMatchInput>,
) -> ApiResult<usize> {
    let count = items.len();
    let mut tx = pool.begin().await?;
    for it in items {
        sqlx::query(
            "INSERT INTO formula_matches (tenant_id, line_type, profile, fans, formula_id, priority, remark) \
             VALUES ($1,$2,$3,$4,$5,$6,$7) \
             ON CONFLICT (tenant_id, line_type, profile, fans, formula_id) \
             DO UPDATE SET priority = EXCLUDED.priority, remark = EXCLUDED.remark, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(&it.line_type)
        .bind(&it.profile)
        .bind(&it.fans)
        .bind(it.formula_id)
        .bind(it.priority)
        .bind(&it.remark)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(count)
}

/// 按型材 + 扇数匹配公式：型材关键字越具体（越长/完全相等）越先，扇数完全匹配优先于任意扇数，同档按 priority 降序。
pub async fn resolve_match(
    pool: &PgPool,
    tenant_id: i64,
    line_type: &str,
    profile: &str,
    fans: &str,
) -> ApiResult<Option<FormulaMatchResolveDto>> {
    let profile = profile.trim();
    if profile.is_empty() {
        return Ok(None);
    }
    let sql = format!(
        "SELECT {MATCH_COLUMNS} FROM formula_matches WHERE tenant_id = $1 AND line_type = $2"
    );
    let rows: Vec<MatchRow> = sqlx::query_as(&sql)
        .bind(tenant_id)
        .bind(line_type)
        .fetch_all(pool)
        .await?;

    // 排序键：(扇数是否完全匹配, 型材精确度, priority)。
    let mut best: Option<((i32, i32, i32), &MatchRow)> = None;
    for r in &rows {
        let kw = r.profile.trim();
        if kw.is_empty() || !profile.contains(kw) {
            continue;
        }
        if !r.fans.is_empty() && r.fans != fans {
            continue;
        }
        let fans_exact = if r.fans == fans { 1 } else { 0 };
        let specificity = if kw == profile {
            i32::MAX
        } else {
            kw.chars().count() as i32
        };
        let key = (fans_exact, specificity, r.priority);
        if best.map_or(true, |(k, _)| key > k) {
            best = Some((key, r));
        }
    }

    Ok(best.map(|(_, r)| FormulaMatchResolveDto {
        formula_id: r.formula_id,
        matched_profile: r.profile.clone(),
        matched_fans: r.fans.clone(),
    }))
}

// ===== 打印模板 =====

pub async fn list_templates(pool: &PgPool, tenant_id: i64) -> ApiResult<Vec<PrintTemplateDto>> {
    let sql = format!(
        "SELECT {TEMPLATE_COLUMNS} FROM print_templates \
         WHERE tenant_id = $1 ORDER BY mode, name"
    );
    let rows: Vec<TemplateRow> = sqlx::query_as(&sql).bind(tenant_id).fetch_all(pool).await?;
    Ok(rows.into_iter().map(template_to_dto).collect())
}

pub async fn list_templates_by_mode(
    pool: &PgPool,
    tenant_id: i64,
    mode: &str,
) -> ApiResult<Vec<PrintTemplateDto>> {
    let sql = format!(
        "SELECT {TEMPLATE_COLUMNS} FROM print_templates \
         WHERE tenant_id = $1 AND mode = $2 ORDER BY name"
    );
    let rows: Vec<TemplateRow> = sqlx::query_as(&sql)
        .bind(tenant_id)
        .bind(mode)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(template_to_dto).collect())
}

/// 批量导入（upsert）。冲突键：tenant_id + mode + name。
pub async fn import_templates(
    pool: &PgPool,
    tenant_id: i64,
    items: Vec<PrintTemplateInput>,
) -> ApiResult<usize> {
    let count = items.len();
    let mut tx = pool.begin().await?;
    for it in items {
        sqlx::query(
            "INSERT INTO print_templates (tenant_id, mode, name, paper, template, remark) \
             VALUES ($1,$2,$3,$4,$5,$6) \
             ON CONFLICT (tenant_id, mode, name) \
             DO UPDATE SET paper = EXCLUDED.paper, template = EXCLUDED.template, \
             remark = EXCLUDED.remark, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(&it.mode)
        .bind(&it.name)
        .bind(&it.paper)
        .bind(&it.template)
        .bind(&it.remark)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(count)
}
