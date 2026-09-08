use serde_json::Value;
use sqlx::PgPool;

use crate::core::error::{ApiError, ApiResult};

use super::model::{
    OrderDto, OrderLineDto, OrderLineInput, OrderRequest, OrderSummaryDto,
};

/// 订单头 SELECT 列（与 OrderHeaderRow 一一对应）。截止日期由「下单日期 + 生产天数 + 1」推导。
const HEADER_COLUMNS: &str = "id, receipt_no, client_code, client_name, phone, brand, \
     to_char(order_date, 'YYYY-MM-DD') AS order_date, production_days, \
     to_char(order_date + production_days + 1, 'YYYY-MM-DD') AS due_date, \
     total_price, deposit, remark, salesperson, door_count, \
     to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, \
     to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at";

/// 订单行 SELECT 列（与 OrderLineRow 一一对应）。
const LINE_COLUMNS: &str = "id, line_type, row_index, profile, color, direction, fans, track, \
     casing, edge_binding, hardware, bottom_glass, face_glass, glass_thickness, \
     door_width, door_height, light_window_height, wall_thickness, jiao, mother_door_width, \
     quantity, unit_price, price_type, discount, square, custom_square, other_fee, \
     casing_price, casing_amount, amount, parts, markup, formula_id, remark, install_address, \
     open_img, edge_seal_count, seal_board_height, track_length, front_casing_add, back_casing_add, \
     link_no, double_ding, light_window_count, image_id, image_url, progress, hole_size, markup_raw";

#[derive(sqlx::FromRow)]
struct OrderHeaderRow {
    id: i64,
    receipt_no: String,
    client_code: String,
    client_name: String,
    phone: String,
    brand: String,
    order_date: String,
    production_days: i32,
    due_date: String,
    total_price: f64,
    deposit: f64,
    remark: String,
    salesperson: String,
    door_count: i32,
    created_at: String,
    updated_at: String,
}

#[derive(sqlx::FromRow)]
struct OrderLineRow {
    id: i64,
    line_type: String,
    row_index: i32,
    profile: String,
    color: String,
    direction: String,
    fans: String,
    track: String,
    casing: String,
    edge_binding: String,
    hardware: String,
    bottom_glass: String,
    face_glass: String,
    glass_thickness: String,
    door_width: f64,
    door_height: f64,
    light_window_height: f64,
    wall_thickness: f64,
    jiao: f64,
    mother_door_width: f64,
    quantity: i32,
    unit_price: f64,
    price_type: String,
    discount: f64,
    square: f64,
    custom_square: f64,
    other_fee: f64,
    casing_price: f64,
    casing_amount: f64,
    amount: f64,
    parts: Value,
    markup: Value,
    formula_id: Option<i64>,
    remark: String,
    install_address: String,
    open_img: String,
    edge_seal_count: Option<f64>,
    seal_board_height: f64,
    track_length: f64,
    front_casing_add: Option<f64>,
    back_casing_add: Option<f64>,
    link_no: Option<String>,
    double_ding: Option<String>,
    light_window_count: i32,
    image_id: Option<String>,
    image_url: Option<String>,
    progress: String,
    hole_size: String,
    markup_raw: String,
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

fn header_to_summary(row: OrderHeaderRow) -> OrderSummaryDto {
    OrderSummaryDto {
        id: row.id,
        receipt_no: row.receipt_no,
        client_code: row.client_code,
        client_name: row.client_name,
        phone: row.phone,
        brand: row.brand,
        order_date: row.order_date,
        production_days: row.production_days,
        due_date: row.due_date,
        total_price: row.total_price,
        deposit: row.deposit,
        remark: row.remark,
        salesperson: row.salesperson,
        door_count: row.door_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn line_to_dto(row: OrderLineRow) -> OrderLineDto {
    OrderLineDto {
        id: row.id,
        line_type: row.line_type,
        row_index: row.row_index,
        profile: row.profile,
        color: row.color,
        direction: row.direction,
        fans: row.fans,
        track: row.track,
        casing: row.casing,
        edge_binding: row.edge_binding,
        hardware: row.hardware,
        bottom_glass: row.bottom_glass,
        face_glass: row.face_glass,
        glass_thickness: row.glass_thickness,
        door_width: row.door_width,
        door_height: row.door_height,
        light_window_height: row.light_window_height,
        wall_thickness: row.wall_thickness,
        jiao: row.jiao,
        mother_door_width: row.mother_door_width,
        quantity: row.quantity,
        unit_price: row.unit_price,
        price_type: row.price_type,
        discount: row.discount,
        square: row.square,
        custom_square: row.custom_square,
        other_fee: row.other_fee,
        casing_price: row.casing_price,
        casing_amount: row.casing_amount,
        amount: row.amount,
        parts: row.parts,
        markup: row.markup,
        formula_id: row.formula_id,
        remark: row.remark,
        install_address: row.install_address,
        open_img: row.open_img,
        edge_seal_count: row.edge_seal_count,
        seal_board_height: row.seal_board_height,
        track_length: row.track_length,
        front_casing_add: row.front_casing_add,
        back_casing_add: row.back_casing_add,
        link_no: row.link_no,
        double_ding: row.double_ding,
        light_window_count: row.light_window_count,
        image_id: row.image_id,
        image_url: row.image_url,
        progress: row.progress,
        hole_size: row.hole_size,
        markup_raw: row.markup_raw,
    }
}

async fn fetch_lines(pool: &PgPool, order_id: i64) -> ApiResult<Vec<OrderLineDto>> {
    let sql = format!(
        "SELECT {LINE_COLUMNS} FROM order_lines WHERE order_id = $1 ORDER BY row_index, id"
    );
    let rows: Vec<OrderLineRow> = sqlx::query_as(&sql).bind(order_id).fetch_all(pool).await?;
    Ok(rows.into_iter().map(line_to_dto).collect())
}

async fn fetch_header(
    pool: &PgPool,
    tenant_id: i64,
    id: i64,
) -> ApiResult<OrderHeaderRow> {
    let sql = format!("SELECT {HEADER_COLUMNS} FROM orders WHERE id = $1 AND tenant_id = $2");
    sqlx::query_as(&sql)
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("订单不存在"))
}

/// 列表：订单头（不含行），按创建时间倒序。
pub async fn list(pool: &PgPool, tenant_id: i64) -> ApiResult<Vec<OrderSummaryDto>> {
    let sql = format!(
        "SELECT {HEADER_COLUMNS} FROM orders WHERE tenant_id = $1 ORDER BY id DESC"
    );
    let rows: Vec<OrderHeaderRow> = sqlx::query_as(&sql).bind(tenant_id).fetch_all(pool).await?;
    Ok(rows.into_iter().map(header_to_summary).collect())
}

/// 详情：订单头 + 行。
pub async fn get(pool: &PgPool, tenant_id: i64, id: i64) -> ApiResult<OrderDto> {
    let header = fetch_header(pool, tenant_id, id).await?;
    let lines = fetch_lines(pool, id).await?;
    Ok(OrderDto {
        id: header.id,
        receipt_no: header.receipt_no,
        client_code: header.client_code,
        client_name: header.client_name,
        phone: header.phone,
        brand: header.brand,
        order_date: header.order_date,
        production_days: header.production_days,
        due_date: header.due_date,
        total_price: header.total_price,
        deposit: header.deposit,
        remark: header.remark,
        salesperson: header.salesperson,
        door_count: header.door_count,
        created_at: header.created_at,
        updated_at: header.updated_at,
        lines,
    })
}

/// 新建：订单头 + 行（事务）。回执单号缺省自动生成，总价/门数由行汇总。
pub async fn create(
    pool: &PgPool,
    tenant_id: i64,
    user_id: i64,
    req: OrderRequest,
) -> ApiResult<OrderDto> {
    let mut tx = pool.begin().await?;

    let receipt_no = req.receipt_no.trim().to_string();

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO orders (tenant_id, receipt_no, client_code, client_name, phone, brand, \
         order_date, production_days, deposit, remark, salesperson, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE(NULLIF($7, '')::date, CURRENT_DATE), \
         $8, $9, $10, $11, $12) RETURNING id",
    )
    .bind(tenant_id)
    .bind(&receipt_no)
    .bind(&req.client_code)
    .bind(&req.client_name)
    .bind(&req.phone)
    .bind(&req.brand)
    .bind(&req.order_date)
    .bind(req.production_days)
    .bind(req.deposit)
    .bind(&req.remark)
    .bind(&req.salesperson)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    // 回执单号缺省时，用自增 id 生成全局唯一值（空串不受唯一索引约束，生成后再回填）。
    if receipt_no.is_empty() {
        let generated = format!("HT{id:08}");
        sqlx::query("UPDATE orders SET receipt_no = $1 WHERE id = $2")
            .bind(&generated)
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }

    let mut total = 0.0_f64;
    let mut door_count = 0_i32;
    for (idx, line) in req.lines.iter().enumerate() {
        insert_line(&mut tx, tenant_id, id, idx as i32, line).await?;
        total += line.amount;
        door_count += line.quantity.max(0);
    }

    sqlx::query("UPDATE orders SET total_price = $1, door_count = $2 WHERE id = $3")
        .bind(round2(total))
        .bind(door_count)
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    get(pool, tenant_id, id).await
}

/// 更新：整单替换（头 + 行，事务）。
pub async fn update(
    pool: &PgPool,
    tenant_id: i64,
    id: i64,
    req: OrderRequest,
) -> ApiResult<OrderDto> {
    let mut tx = pool.begin().await?;

    let receipt_no = req.receipt_no.trim().to_string();

    let result = sqlx::query(
        "UPDATE orders SET receipt_no = $1, client_code = $2, client_name = $3, phone = $4, \
         brand = $5, order_date = COALESCE(NULLIF($6, '')::date, CURRENT_DATE), \
         production_days = $7, deposit = $8, remark = $9, salesperson = $10, updated_at = now() \
         WHERE id = $11 AND tenant_id = $12",
    )
    .bind(&receipt_no)
    .bind(&req.client_code)
    .bind(&req.client_name)
    .bind(&req.phone)
    .bind(&req.brand)
    .bind(&req.order_date)
    .bind(req.production_days)
    .bind(req.deposit)
    .bind(&req.remark)
    .bind(&req.salesperson)
    .bind(id)
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("订单不存在"));
    }

    sqlx::query("DELETE FROM order_lines WHERE order_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    let mut total = 0.0_f64;
    let mut door_count = 0_i32;
    for (idx, line) in req.lines.iter().enumerate() {
        insert_line(&mut tx, tenant_id, id, idx as i32, line).await?;
        total += line.amount;
        door_count += line.quantity.max(0);
    }

    sqlx::query("UPDATE orders SET total_price = $1, door_count = $2 WHERE id = $3")
        .bind(round2(total))
        .bind(door_count)
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    get(pool, tenant_id, id).await
}

pub async fn delete(pool: &PgPool, tenant_id: i64, id: i64) -> ApiResult<()> {
    let result = sqlx::query("DELETE FROM orders WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(tenant_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("订单不存在"));
    }
    Ok(())
}

/// 插入单行（在调用方事务内）。数量/折扣做防御性归一：数量≥1、折扣 0 视为 1。
async fn insert_line(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: i64,
    order_id: i64,
    row_index: i32,
    line: &OrderLineInput,
) -> ApiResult<()> {
    let quantity = line.quantity.max(1);
    let discount = if line.discount == 0.0 { 1.0 } else { line.discount };

    sqlx::query(
        "INSERT INTO order_lines (order_id, tenant_id, line_type, row_index, \
         profile, color, direction, fans, track, casing, hardware, bottom_glass, \
         face_glass, glass_thickness, door_width, door_height, light_window_height, \
         wall_thickness, jiao, mother_door_width, quantity, unit_price, price_type, \
         discount, square, custom_square, other_fee, casing_price, casing_amount, amount, \
         parts, markup, formula_id, remark, install_address, \
         open_img, edge_seal_count, seal_board_height, track_length, front_casing_add, back_casing_add, \
         link_no, double_ding, light_window_count, image_id, image_url, progress, hole_size, markup_raw, \
         edge_binding) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, \
         $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35, \
         $36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50)",
    )
    .bind(order_id)
    .bind(tenant_id)
    .bind(&line.line_type)
    .bind(row_index)
    .bind(&line.profile)
    .bind(&line.color)
    .bind(&line.direction)
    .bind(&line.fans)
    .bind(&line.track)
    .bind(&line.casing)
    .bind(&line.hardware)
    .bind(&line.bottom_glass)
    .bind(&line.face_glass)
    .bind(&line.glass_thickness)
    .bind(line.door_width)
    .bind(line.door_height)
    .bind(line.light_window_height)
    .bind(line.wall_thickness)
    .bind(line.jiao)
    .bind(line.mother_door_width)
    .bind(quantity)
    .bind(line.unit_price)
    .bind(&line.price_type)
    .bind(discount)
    .bind(line.square)
    .bind(line.custom_square)
    .bind(line.other_fee)
    .bind(line.casing_price)
    .bind(line.casing_amount)
    .bind(line.amount)
    .bind(&line.parts)
    .bind(&line.markup)
    .bind(line.formula_id)
    .bind(&line.remark)
    .bind(&line.install_address)
    .bind(&line.open_img)
    .bind(line.edge_seal_count)
    .bind(line.seal_board_height)
    .bind(line.track_length)
    .bind(line.front_casing_add)
    .bind(line.back_casing_add)
    .bind(&line.link_no)
    .bind(&line.double_ding)
    .bind(line.light_window_count)
    .bind(&line.image_id)
    .bind(&line.image_url)
    .bind(&line.progress)
    .bind(&line.hole_size)
    .bind(&line.markup_raw)
    .bind(&line.edge_binding)
    .execute(&mut **tx)
    .await?;

    Ok(())
}
