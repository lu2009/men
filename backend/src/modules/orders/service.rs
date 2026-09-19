use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;
use sqlx::PgPool;

use crate::core::error::{ApiError, ApiResult};

use super::model::{
    OrderDto, OrderHeadPatch, OrderLineDto, OrderLineInput, OrderRequest, OrderSearchQuery,
    OrderSummaryDto,
};

/// 订单头 SELECT 列（与 OrderHeaderRow 一一对应）。截止日期由「下单日期 + 生产天数 + 1」推导。
const HEADER_COLUMNS: &str = "id, receipt_no, client_code, client_name, phone, brand, \
     to_char(order_date, 'YYYY-MM-DD') AS order_date, production_days, \
     to_char(order_date + production_days + 1, 'YYYY-MM-DD') AS due_date, \
     total_price, deposit, remark, salesperson, order_no_set, install_address, \
     production_status, creator_name, lock_direction, door_count, \
     to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, \
     to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at";

/// 订单行 SELECT 列（与 OrderLineRow 一一对应）。
const LINE_COLUMNS: &str = "id, line_type, row_index, profile, color, direction, fans, track, \
     casing, hardware, bottom_glass, face_glass, glass_thickness, \
     door_width, door_height, light_window_height, wall_thickness, jiao, mother_door_width, \
     quantity, unit_price, price_type, discount, square, custom_square, other_fee, \
     casing_price, casing_amount, amount, parts, markup, formula_id, remark, install_address, \
     open_img, edge_seal_count, seal_board_height, track_length, front_casing_add, back_casing_add, \
     double_ding, light_window_count, image_id, image_url, progress, hole_size, line_no, \
     procedure_slots";

#[derive(sqlx::FromRow)]
pub(crate) struct OrderHeaderRow {
    pub(crate) id: i64,
    pub(crate) receipt_no: String,
    pub(crate) client_code: String,
    pub(crate) client_name: String,
    pub(crate) phone: String,
    pub(crate) brand: String,
    pub(crate) order_date: String,
    pub(crate) production_days: i32,
    pub(crate) due_date: String,
    pub(crate) total_price: f64,
    pub(crate) deposit: f64,
    pub(crate) remark: String,
    pub(crate) salesperson: String,
    pub(crate) order_no_set: String,
    pub(crate) install_address: String,
    pub(crate) production_status: String,
    pub(crate) creator_name: String,
    pub(crate) lock_direction: String,
    pub(crate) door_count: i32,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
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
    double_ding: Option<String>,
    light_window_count: i32,
    image_id: Option<String>,
    image_url: Option<String>,
    progress: String,
    hole_size: String,
    /// 行级「单号」（`N-YY/MM/DD`）。见 `migrations/0020_order_line_no.sql`。
    line_no: String,
    /// 行级工序槽 `{"工序1":"下料_张三_2026-09-19", …}`。见 `migrations/0021_progress.sql`。
    procedure_slots: serde_json::Value,
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
        order_no_set: row.order_no_set,
        install_address: row.install_address,
        production_status: row.production_status,
        creator_name: row.creator_name,
        lock_direction: row.lock_direction,
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
        double_ding: row.double_ding,
        light_window_count: row.light_window_count,
        image_id: row.image_id,
        image_url: row.image_url,
        progress: row.progress,
        hole_size: row.hole_size,
        line_no: row.line_no,
        procedure_slots: row.procedure_slots,
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

/// 文本过滤条件归一：缺省/空串/纯空白 → `None`（该条件不过滤）。
fn text_filter(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

/// `YYYY-MM-DD` 的结构 + 日历校验（不引时间库；闰年按公历规则）。
/// 只做形状与「这一天是否真实存在」，不判可用范围。
fn is_valid_iso_date(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return false;
    }
    // 形状已定，下面按字节切分就是按字符切分（全是 ASCII）。
    if b.iter()
        .enumerate()
        .any(|(i, c)| i != 4 && i != 7 && !c.is_ascii_digit())
    {
        return false;
    }
    let year: i32 = s[0..4].parse().unwrap_or(0);
    let month: u32 = s[5..7].parse().unwrap_or(0);
    let day: u32 = s[8..10].parse().unwrap_or(0);
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };
    year > 0 && day >= 1 && day <= max_day
}

/// 日期过滤条件归一：缺省/空串 → `None`；格式或日历非法 → 400。
///
/// 有意在入库前拦掉非法日期：SQL 里是 `NULLIF($n,'')::date`，把 `2026-02-30`
/// 这类串直接丢给 PG 会抛错变成 500，前端只能看到「数据库错误」。
fn parse_date_filter(raw: Option<&str>) -> ApiResult<Option<String>> {
    let Some(s) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if !is_valid_iso_date(s) {
        return Err(ApiError::bad_request("日期格式不合法，应为 YYYY-MM-DD"));
    }
    Ok(Some(s.to_string()))
}

/// Home「查询更多」（旧版 `getMoreTableDate`）：按客户 / 安装地址 / 日期范围取订单头。
///
/// 旧版坐标 `legacy/js/Home.formatted.js:11074-11090`（`ys`）。旧版是「动作式」端点 +
/// 前端把结果并进主表 `_l`，这里只负责**取数**，合并留在前端（见 `Home.vue` 的 `submitQuery`）。
///
/// 与旧版的已知差异（旧版服务端不可见，只能按 UI 语义定）：
///   · 客户 / 安装地址用 **ILIKE 子串**（与 `clients::list` 的 `search` 同口径）；
///   · 日期为**闭区间**（`>= 起始 AND <= 结束`），含首尾两天；
///   · 排序沿用 `list` 的 `id DESC`（旧版返回顺序不可见）。
pub async fn search(
    pool: &PgPool,
    tenant_id: i64,
    q: &OrderSearchQuery,
) -> ApiResult<Vec<OrderSummaryDto>> {
    let client = text_filter(q.client_name.as_deref()).unwrap_or_default();
    let address = text_filter(q.install_address.as_deref()).unwrap_or_default();
    let start = parse_date_filter(q.start_date.as_deref())?.unwrap_or_default();
    let end = parse_date_filter(q.end_date.as_deref())?.unwrap_or_default();

    // `NULLIF($n,'')::date` 不能换写成 `$n::date`：OR 不保证短路，空串那一支会被求值成非法日期。
    let sql = format!(
        "SELECT {HEADER_COLUMNS} FROM orders \
         WHERE tenant_id = $1 \
         AND ($2 = '' OR client_name ILIKE '%' || $2 || '%') \
         AND ($3 = '' OR install_address ILIKE '%' || $3 || '%') \
         AND ($4 = '' OR order_date >= NULLIF($4, '')::date) \
         AND ($5 = '' OR order_date <= NULLIF($5, '')::date) \
         ORDER BY id DESC"
    );
    let rows: Vec<OrderHeaderRow> = sqlx::query_as(&sql)
        .bind(tenant_id)
        .bind(client)
        .bind(address)
        .bind(start)
        .bind(end)
        .fetch_all(pool)
        .await?;
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
        order_no_set: header.order_no_set,
        install_address: header.install_address,
        production_status: header.production_status,
        creator_name: header.creator_name,
        lock_direction: header.lock_direction,
        door_count: header.door_count,
        created_at: header.created_at,
        updated_at: header.updated_at,
        lines,
    })
}

/// 按回执单号取详情（`orders(tenant_id, receipt_no)` 上有部分唯一索引：非空单号本租户内唯一）。
/// 电子回执单是唯一以「单号」而非「id」定位订单的入口。
pub async fn get_by_receipt_no(
    pool: &PgPool,
    tenant_id: i64,
    receipt_no: &str,
) -> ApiResult<OrderDto> {
    let sql = format!(
        "SELECT {HEADER_COLUMNS} FROM orders WHERE receipt_no = $1 AND tenant_id = $2"
    );
    let header: OrderHeaderRow = sqlx::query_as(&sql)
        .bind(receipt_no)
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::not_found("订单不存在"))?;

    let lines = fetch_lines(pool, header.id).await?;
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
        order_no_set: header.order_no_set,
        install_address: header.install_address,
        production_status: header.production_status,
        creator_name: header.creator_name,
        lock_direction: header.lock_direction,
        door_count: header.door_count,
        created_at: header.created_at,
        updated_at: header.updated_at,
        lines,
    })
}

/// 合并订单。语义照旧版 `Ii`（`Home.formatted.js:9190-9219`）。
///
/// ## 与旧版的**有意偏离**（重要）
///
/// 旧版把存活单的选择**完全交给客户端**：前端按 `parseInt(回执单号)` 升序排、取最小那条当
/// `merged`，然后 POST `{merged, record}`；**服务端不比较、不校验、不看日期**
/// （`order.service.ts:403` 直接采信）。前端传错 → 服务端照做 → **源订单已被物理删除，无法回滚**。
///
/// 新版：客户端**只传要合并的订单 id 列表**，存活单由**服务端**按回执单号数值取最小算出来。
/// 行为上与旧版正常路径一致（都取最早的那条），但把「传错就毁数据」这条路堵掉了。
///
/// 旧版前端那句确认文案是「…合并后将以最早的回执单号为准，合并后不可恢复。」
/// —— 服务端既然也这么算，文案就名副其实了。
///
/// ## 合并规则（逐条对齐旧版）
/// · 至少 2 条，且**必须同一客户**（旧版按客户编号校验，文案 `dr(574)`）
/// · 存活单 = 回执单号数值最小
/// · `总价`/`定金`/`门数` **累加**（旧版累加的是**订单头**的值）
/// · `日期`/`截止日期` 取**更早**的
/// · `安装地址`/`订单备注`/`打单人`/`业务员` 各字段**去重后用 `"; "` 拼接**
/// · `打单操作` 置 **`"合并单"`**
/// · 被并入单的**明细行搬到存活单**，行自己的 `单号` **原样保留**
/// · 源订单**物理删除**（旧版也是，不可恢复）—— 连带把指向它们的财务记录改挂到存活单
/// · `单号集` 按合并后的全部行重算（`refresh_order_no_set`）
pub async fn combine(pool: &PgPool, tenant_id: i64, order_ids: &[i64]) -> ApiResult<OrderDto> {
    let ids: Vec<i64> = {
        let mut v: Vec<i64> = order_ids.to_vec();
        v.sort_unstable();
        v.dedup();
        v
    };
    if ids.len() < 2 {
        return Err(ApiError::bad_request("请选择至少两条订单进行合并"));
    }

    let mut tx = pool.begin().await?;

    #[derive(sqlx::FromRow)]
    struct Head {
        id: i64,
        receipt_no: String,
        client_code: String,
        order_date: String,
        total_price: f64,
        deposit: f64,
        door_count: i32,
        install_address: String,
        remark: String,
        creator_name: String,
        salesperson: String,
    }
    let heads: Vec<Head> = sqlx::query_as(
        "SELECT id, receipt_no, client_code, \
         to_char(order_date, 'YYYY-MM-DD') AS order_date, \
         total_price, deposit, door_count, install_address, remark, creator_name, salesperson \
         FROM orders WHERE tenant_id = $1 AND id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&ids)
    .fetch_all(&mut *tx)
    .await?;

    if heads.len() != ids.len() {
        return Err(ApiError::not_found("有订单不存在（可能已被删除），请刷新后重试"));
    }
    let first_client = &heads[0].client_code;
    if heads.iter().any(|h| &h.client_code != first_client) {
        return Err(ApiError::bad_request("只能合并同一客户的订单（客户编号必须相同）"));
    }

    // 存活单：回执单号**数值**最小（= 最早）。取不到数值的排在最后（旧版 parseInt 得 NaN）。
    let target = heads
        .iter()
        .min_by_key(|h| receipt_no_numeric(&h.receipt_no))
        .expect("heads 非空")
        .id;
    let sources: Vec<i64> = ids.iter().copied().filter(|i| *i != target).collect();

    // 累加（旧版累加的是订单头字段）。
    let total: f64 = heads.iter().map(|h| h.total_price).sum();
    let deposit: f64 = heads.iter().map(|h| h.deposit).sum();
    let door_count: i32 = heads.iter().map(|h| h.door_count).sum();
    // 日期取更早（ISO 串直接比大小即可）。
    let earliest_date = heads.iter().map(|h| h.order_date.as_str()).min().unwrap_or("").to_string();

    // 那几个文本字段：去重 + `"; "` 拼接（旧版就这个口径）。
    let join_unique = |pick: fn(&Head) -> &str| -> String {
        let mut seen: Vec<String> = Vec::new();
        for h in &heads {
            let v = pick(h).trim();
            if !v.is_empty() && !seen.iter().any(|s| s == v) {
                seen.push(v.to_string());
            }
        }
        seen.join("; ")
    };
    let install_address = join_unique(|h| &h.install_address);
    let remark = join_unique(|h| &h.remark);
    let creator_name = join_unique(|h| &h.creator_name);
    let salesperson = join_unique(|h| &h.salesperson);

    // 行搬到存活单：按「源单顺序 → 原 row_index」重排，保证顺序稳定。
    let mut next_row: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(row_index), -1) + 1 FROM order_lines WHERE order_id = $1")
        .bind(target)
        .fetch_one(&mut *tx)
        .await?;
    for src in &sources {
        let line_ids: Vec<i64> =
            sqlx::query_scalar("SELECT id FROM order_lines WHERE order_id = $1 ORDER BY row_index, id")
                .bind(src)
                .fetch_all(&mut *tx)
                .await?;
        for lid in line_ids {
            sqlx::query("UPDATE order_lines SET order_id = $1, row_index = $2 WHERE id = $3")
                .bind(target)
                .bind(next_row)
                .bind(lid)
                .execute(&mut *tx)
                .await?;
            next_row += 1;
        }
    }

    // 财务记录改挂到存活单（旧版同样把付款记录 reassign 给目标单）。
    // ⚠️ 不 reassign 的话，它们会指向马上要被删掉的订单 id —— 变成悬空引用。
    for src in &sources {
        for table in ["finance_payments", "finance_order_adjustments", "finance_allocations"] {
            sqlx::query(&format!("UPDATE {table} SET order_id = $1 WHERE order_id = $2 AND tenant_id = $3"))
                .bind(target)
                .bind(src)
                .bind(tenant_id)
                .execute(&mut *tx)
                .await?;
        }
    }

    sqlx::query(
        "UPDATE orders SET total_price = $1, deposit = $2, door_count = $3, \
         order_date = COALESCE(NULLIF($4, '')::date, order_date), \
         install_address = $5, remark = $6, creator_name = $7, salesperson = $8, \
         production_status = $9, updated_at = now() \
         WHERE id = $10 AND tenant_id = $11",
    )
    .bind(round2(total))
    .bind(deposit)
    .bind(door_count)
    .bind(&earliest_date)
    .bind(&install_address)
    .bind(&remark)
    .bind(&creator_name)
    .bind(&salesperson)
    .bind("合并单")
    .bind(target)
    .bind(tenant_id)
    .execute(&mut *tx)
    .await?;

    // 源订单物理删除（行已搬走）。
    sqlx::query("DELETE FROM orders WHERE tenant_id = $1 AND id = ANY($2)")
        .bind(tenant_id)
        .bind(&sources)
        .execute(&mut *tx)
        .await?;

    refresh_order_no_set(&mut tx, target).await?;
    tx.commit().await?;

    get(pool, tenant_id, target).await
}

/// 回执单号 → 可比较的数值。旧版用 `parseInt(回执单号)`：
/// 取**开头连续数字**，取不到则 `i64::MAX`（排最后，与 `parseInt` 得 NaN 的意图一致 —
/// 旧版 NaN 比较会让排序结果无定义，这里给个确定的兜底）。
fn receipt_no_numeric(s: &str) -> i64 {
    let t = s.trim();
    let digits: String = t.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().unwrap_or(i64::MAX)
}

/// 「填入单号」：给本单里**还没单号**的明细行补上 `N-YY/MM/DD`，返回 `{行id → 单号}`。
///
/// 复刻旧版 `ensureLineNumbers()`（`server/src/modules/order/line-number.service.ts:120-235`）
/// 的规则：
///   · 格式 `N-YY/MM/DD`（日期后缀取**下单日期**；旧版还有「取该行自己的日期」的分支，
///     我们没有行级日期字段，故只按订单日期）
///   · `N` = **本租户该年份**全库行单号的最大值 + 1，**按年重置**（不是按日）
///   · **永不覆盖已有值** —— 已有单号的行走 `continue`，原样返回
///   · 前端只负责搬运，序号一律服务端算（旧版亦然，见 order-no-semantics.md §2.4）
///
/// ⚠️ **已知不确定**：「按年全局 max+1」是从**重写版**服务端读出来的，而生产实测有反例
///    （同年出现两个「1 号」，`docs/2026-09-18-order-no-semantics.md` §7.5）。可能是
///    用户手改了单号、也可能另有一条分配通路。这里按重写版实现，**不与旧版逐字对齐**。
///
/// 旧版由 `param1=getDiaoFormulas` 那个接口兼着返回（同一个响应里还有 `data.formulas`），
/// 新版拆成独立端点 —— **有意偏离**，理由：那个接口在旧版还有写副作用，混在一起既难测也危险。
pub async fn fill_line_numbers(pool: &PgPool, tenant_id: i64, order_id: i64) -> ApiResult<Value> {
    let mut tx = pool.begin().await?;

    // 下单日期（决定日期后缀与「哪一年」）。
    let order_date: String = sqlx::query_scalar(
        "SELECT COALESCE(to_char(order_date, 'YYYY-MM-DD'), to_char(CURRENT_DATE, 'YYYY-MM-DD')) \
         FROM orders WHERE id = $1 AND tenant_id = $2",
    )
    .bind(order_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::not_found("订单不存在"))?;

    let (year2, mm, dd) = date_suffix_parts(&order_date);
    let date_suffix = format!("{year2}/{mm}/{dd}");

    // 行（按行序，保证补号顺序稳定）。
    let rows: Vec<(i64, String)> = sqlx::query_as(
        "SELECT id, line_no FROM order_lines WHERE order_id = $1 ORDER BY row_index, id",
    )
    .bind(order_id)
    .fetch_all(&mut *tx)
    .await?;

    // 本租户该年份的当前最大值。扫描所有行的 line_no，取形如 `N-YY/...` 且年份匹配的最大 N。
    let all: Vec<String> = sqlx::query_scalar("SELECT line_no FROM order_lines WHERE tenant_id = $1")
        .bind(tenant_id)
        .fetch_all(&mut *tx)
        .await?;
    let mut next = all
        .iter()
        .filter_map(|v| parse_line_no(v))
        .filter(|(_, y)| *y == year2)
        .map(|(n, _)| n)
        .max()
        .unwrap_or(0);

    let mut map = serde_json::Map::new();
    for (id, existing) in &rows {
        if !existing.trim().is_empty() {
            // 永不覆盖：已有的原样回填进 map（旧版同样把已有值放进返回里）。
            map.insert(id.to_string(), Value::String(existing.clone()));
            continue;
        }
        next += 1;
        let no = format!("{next}-{date_suffix}");
        sqlx::query("UPDATE order_lines SET line_no = $1 WHERE id = $2")
            .bind(&no)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        map.insert(id.to_string(), Value::String(no));
    }

    // 补完号 ⇒ 派生的「单号集」跟着重算。
    refresh_order_no_set(&mut tx, order_id).await?;
    tx.commit().await?;

    Ok(Value::Object(map))
}

/// 下单日期 `YYYY-MM-DD` → `(YY, MM, DD)`；解析不了就用当天（旧版同样是「取不到就用现在」）。
fn date_suffix_parts(iso: &str) -> (String, String, String) {
    let p: Vec<&str> = iso.split('-').collect();
    if p.len() == 3 && p[0].len() == 4 {
        return (p[0][2..].to_string(), p[1].to_string(), p[2].to_string());
    }
    let now = time_parts_now();
    now
}

/// 现在的时间 → `(YY, MM, DD)`（仅用于日期解析失败时的兜底）。
fn time_parts_now() -> (String, String, String) {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // 用 UTC 拆（与 `date_suffix_parts` 的降级路径一致即可，不追求时区精确）。
    let days = secs / 86_400;
    let (y, m, d) = civil_from_days(days as i64);
    (format!("{:02}", y % 100), format!("{m:02}"), format!("{d:02}"))
}

/// 天数（1970-01-01 起）→ 公历年月日。Howard Hinnant 的 `civil_from_days`。
fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// 解析行单号 `N-YY/MM/DD`（也接受 `N-YY`）→ `(N, YY)`。
/// 与旧版 `lineNoNumber()` 的正则等价：`/^(\d+)-(\d{2})(?:\/(\d{2})\/(\d{2}))?\b/`。
fn parse_line_no(v: &str) -> Option<(i64, String)> {
    let s = v.trim();
    let (num, rest) = s.split_once('-')?;
    let n: i64 = num.parse().ok()?;
    if rest.len() < 2 || !rest.as_bytes()[..2].iter().all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some((n, rest[..2].to_string()))
}

/// 重算 `orders.order_no_set` = 该单所有明细行 `line_no` **去重**后按**下划线**连接。
///
/// 对齐旧版 `buildReceiptNoSet()`（`server/src/modules/order/order.service.ts:117-127`）：
///   · 分隔符是 **`_`**（旧服务端 7 份重复实现完全一致；`0018` 注释写的「空格串」是错的）
///   · 内容是**行级单号**，**不是回执单号**（函数名有误导性，见 order-no-semantics.md §2.2 ③）
///   · 按行序首次出现去重
///   · ⚠️ **全部行都为空时保留旧值，不清空** —— 旧版那条 fallback 的用意是
///     「已有单号集、但行单号还没补」时不至于把值冲掉。
///
/// 该字段**服务端独占**：`PUT` / `PATCH` 的 SET 列表里都已移除，客户端传什么都不作数。
async fn refresh_order_no_set(conn: &mut sqlx::PgConnection, order_id: i64) -> ApiResult<()> {
    let line_nos: Vec<String> = sqlx::query_scalar(
        "SELECT line_no FROM order_lines WHERE order_id = $1 ORDER BY row_index, id",
    )
    .bind(order_id)
    .fetch_all(&mut *conn)
    .await?;

    let mut seen = std::collections::HashSet::new();
    let mut uniq: Vec<&str> = Vec::new();
    for v in &line_nos {
        let t = v.trim();
        if t.is_empty() || !seen.insert(t) {
            continue;
        }
        uniq.push(t);
    }
    if uniq.is_empty() {
        return Ok(()); // 保留旧值（旧版 fallback）
    }

    sqlx::query("UPDATE orders SET order_no_set = $1 WHERE id = $2")
        .bind(uniq.join("_"))
        .bind(order_id)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

/// 回执单号缺省值的生成规则：**建单时刻的毫秒时间戳**（13 位纯数字）。
///
/// ## 为什么是毫秒戳（不是好看的 `HT00000067`）
///
/// 旧系统的 `回执单号` 就是建单时的 `Date.now()` —— 生产实测 17/17 命中 `/^\d{13}$/`，
/// 且与建单日期一一对得上（`docs/2026-09-18-order-no-semantics.md` §2.2 ⑥）。
///
/// 关键**不在**长得像，而在：13 位纯数字**天然单调** ⇒ 旧版两条按
/// `parseInt(回执单号)` 排序的规则直接成立：
///   · 主表初载按回执单号**数值降序**（`Home.formatted.js:7896`）
///   · 合并订单时取**数值最小**的那条当存活单（`:9199`，即「以最早的回执单号为准」）
///
/// 我们原先用的 `HT{id:08}` 让 `parseInt` 得 **NaN**，上面两条全废
/// （观感上被 `ORDER BY id DESC` 掩盖了，一旦做合并就会露馅）。
///
/// ⚠️ **同毫秒碰撞**：同一毫秒内建两张单会撞 `(tenant_id, receipt_no)` 的部分唯一索引。
/// 这里往后挪一毫秒直到避开（最多 1000 次，够用）。旧版**没有这层保护**（纯 `Date.now()`）
/// —— 这里是**有意比旧版严**，理由：新版是并发 HTTP 服务，旧版是单页面前端，
/// 撞了会直接 500 而不是静默出错。
async fn assign_generated_receipt_no(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: i64,
    id: i64,
) -> ApiResult<()> {
    let mut millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    for _ in 0..1000 {
        let candidate = millis.to_string();
        let taken: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM orders WHERE tenant_id = $1 AND receipt_no = $2)",
        )
        .bind(tenant_id)
        .bind(&candidate)
        .fetch_one(&mut **tx)
        .await?;
        if !taken {
            // 并发下仍可能被抢先：唯一索引会报错，接住往后挪一毫秒重试。
            match sqlx::query("UPDATE orders SET receipt_no = $1 WHERE id = $2")
                .bind(&candidate)
                .bind(id)
                .execute(&mut **tx)
                .await
            {
                Ok(_) => return Ok(()),
                Err(_) => {
                    millis += 1;
                    continue;
                }
            }
        }
        millis += 1;
    }
    Err(ApiError::internal("回执单号生成失败：连续 1000 毫秒都被占用"))
}

/// 新建：订单头 + 行（事务）。回执单号缺省自动生成，总价/门数由行汇总。
pub async fn create(
    pool: &PgPool,
    tenant_id: i64,
    user_id: i64,
    creator_name: &str,
    req: OrderRequest,
) -> ApiResult<OrderDto> {
    let mut tx = pool.begin().await?;

    let receipt_no = req.receipt_no.trim().to_string();

    let id: i64 = sqlx::query_scalar(
        "INSERT INTO orders (tenant_id, receipt_no, client_code, client_name, phone, brand, \
         order_date, production_days, deposit, remark, salesperson, \
         install_address, production_status, creator_name, lock_direction, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE(NULLIF($7, '')::date, CURRENT_DATE), \
         $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id",
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
    // `order_no_set` 不进 INSERT：列有 DEFAULT ''，随后由 `refresh_order_no_set` 填（服务端派生）。
    .bind(&req.install_address)
    .bind(&req.production_status)
    .bind(creator_name)
    .bind(&req.lock_direction)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    // 回执单号缺省时自动生成（空串不受唯一索引约束，所以先生成再回填）。
    if receipt_no.is_empty() {
        assign_generated_receipt_no(&mut tx, tenant_id, id).await?;
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

    // 行写完之后重算派生值「单号集」（= 各行 line_no 去重后 `_` 连接）。
    refresh_order_no_set(&mut tx, id).await?;

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
         production_days = $7, deposit = $8, remark = $9, salesperson = $10, \
         install_address = $11, production_status = $12, \
         lock_direction = $13, updated_at = now() \
         WHERE id = $14 AND tenant_id = $15",
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
    // ⚠️ `order_no_set` 不在这里 SET —— 派生值，见 `refresh_order_no_set`。
    .bind(&req.install_address)
    .bind(&req.production_status)
    .bind(&req.lock_direction)
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

    // 行写完之后重算派生值「单号集」（= 各行 line_no 去重后 `_` 连接）。
    refresh_order_no_set(&mut tx, id).await?;

    tx.commit().await?;
    get(pool, tenant_id, id).await
}

/// 就地编辑订单头（不动行）。Home 主表内联编辑/改日期/改客户名走这里，避免整单替换的
/// 「先删行再插行」副作用。打单人/创建人保持不变。
pub async fn update_head(
    pool: &PgPool,
    tenant_id: i64,
    id: i64,
    patch: OrderHeadPatch,
) -> ApiResult<OrderDto> {
    // ⚠️ `order_no_set` **刻意不在这里 SET** —— 它是**派生值**（= 该单各行 `line_no` 去重后
    //    `_` 连接），由 `refresh_order_no_set` 在明细行变化时重算。让客户端能直接写它会
    //    造成两个问题：① 客户端漏传时被 `#[serde(default)]` 抹空（Hui 那个坑）；
    //    ② 派生值与真实行单号不一致。所以这里**服务端独占**这个字段。
    let result = sqlx::query(
        "UPDATE orders SET client_code = $1, client_name = $2, phone = $3, brand = $4, \
         order_date = COALESCE(NULLIF($5, '')::date, CURRENT_DATE), production_days = $6, \
         deposit = $7, remark = $8, salesperson = $9, \
         install_address = $10, production_status = $11, creator_name = $12, lock_direction = $13, \
         updated_at = now() \
         WHERE id = $14 AND tenant_id = $15",
    )
    .bind(&patch.client_code)
    .bind(&patch.client_name)
    .bind(&patch.phone)
    .bind(&patch.brand)
    .bind(&patch.order_date)
    .bind(patch.production_days)
    .bind(patch.deposit)
    .bind(&patch.remark)
    .bind(&patch.salesperson)
    .bind(&patch.install_address)
    .bind(&patch.production_status)
    .bind(&patch.creator_name)
    .bind(&patch.lock_direction)
    .bind(id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("订单不存在"));
    }
    get(pool, tenant_id, id).await
}

/// 更新单行（在订单内，按 line_id）。数量/折扣做与插入一致的防御性归一。
pub async fn update_line(
    pool: &PgPool,
    tenant_id: i64,
    order_id: i64,
    line_id: i64,
    line: &OrderLineInput,
) -> ApiResult<()> {
    let quantity = line.quantity.max(1);
    let discount = if line.discount == 0.0 { 1.0 } else { line.discount };

    let result = sqlx::query(
        "UPDATE order_lines SET \
         line_type=$1, profile=$2, color=$3, direction=$4, fans=$5, track=$6, casing=$7, \
         hardware=$8, bottom_glass=$9, face_glass=$10, glass_thickness=$11, \
         door_width=$12, door_height=$13, light_window_height=$14, wall_thickness=$15, jiao=$16, \
         mother_door_width=$17, quantity=$18, unit_price=$19, price_type=$20, discount=$21, \
         square=$22, custom_square=$23, other_fee=$24, casing_price=$25, casing_amount=$26, amount=$27, \
         parts=$28, markup=$29, formula_id=$30, remark=$31, install_address=$32, open_img=$33, \
         edge_seal_count=$34, seal_board_height=$35, track_length=$36, front_casing_add=$37, \
         back_casing_add=$38, double_ding=$39, light_window_count=$40, \
         image_id=$41, image_url=$42, progress=$43, hole_size=$44, line_no=$45, \
         updated_at = now() \
         WHERE id=$46 AND order_id=$47 AND tenant_id=$48",
    )
    .bind(&line.line_type)
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
    .bind(&line.double_ding)
    .bind(line.light_window_count)
    .bind(&line.image_id)
    .bind(&line.image_url)
    .bind(&line.progress)
    .bind(&line.hole_size)
    // ⚠️ 行级单号**允许被此行覆盖** —— 旧版「单号」列本来就是可编辑输入框，
    //    `ensureLineNumbers` 的「永不覆盖」只管**自动补号**那条路，不拦用户手改。
    //    ⚠️ 但前端 **必须把该字段回传**：`OrderLineInput` 是 `#[serde(default)]`，
    //       漏传 = 反序列化成 `""` = 每次改行都把单号抹掉（与 Hui 头字段那个坑同型）。
    .bind(&line.line_no)
    .bind(line_id)
    .bind(order_id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("订单行不存在"));
    }
    recompute_header(pool, order_id).await
}

/// 删除单行（在订单内，按 line_id）。
pub async fn delete_line(
    pool: &PgPool,
    tenant_id: i64,
    order_id: i64,
    line_id: i64,
) -> ApiResult<()> {
    let result = sqlx::query("DELETE FROM order_lines WHERE id = $1 AND order_id = $2 AND tenant_id = $3")
        .bind(line_id)
        .bind(order_id)
        .bind(tenant_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("订单行不存在"));
    }
    recompute_header(pool, order_id).await
}

/// 单行增删改后重算订单头总价/门数，保持列表与详情一致；顺带重算派生的「单号集」。
async fn recompute_header(pool: &PgPool, order_id: i64) -> ApiResult<()> {
    let (total, door_count): (f64, i64) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount), 0.0)::float8, COALESCE(SUM(quantity), 0)::int8 \
         FROM order_lines WHERE order_id = $1",
    )
    .bind(order_id)
    .fetch_one(pool)
    .await?;

    sqlx::query("UPDATE orders SET total_price = $1, door_count = $2, updated_at = now() WHERE id = $3")
        .bind(round2(total))
        .bind(door_count as i32)
        .bind(order_id)
        .execute(pool)
        .await?;

    let mut conn = pool.acquire().await?;
    refresh_order_no_set(&mut conn, order_id).await?;
    Ok(())
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
         double_ding, light_window_count, image_id, image_url, progress, hole_size, line_no) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, \
         $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35, \
         $36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48)",
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
    .bind(&line.double_ding)
    .bind(line.light_window_count)
    .bind(&line.image_id)
    .bind(&line.image_url)
    .bind(&line.progress)
    .bind(&line.hole_size)
    .bind(&line.line_no)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_filter_treats_blank_as_no_filter() {
        assert_eq!(text_filter(None), None);
        assert_eq!(text_filter(Some("")), None);
        assert_eq!(text_filter(Some("   ")), None);
        assert_eq!(text_filter(Some(" 张三 ")), Some("张三".to_string()));
    }

    #[test]
    fn date_filter_treats_blank_as_no_filter() {
        assert_eq!(parse_date_filter(None).unwrap(), None);
        assert_eq!(parse_date_filter(Some("")).unwrap(), None);
        assert_eq!(parse_date_filter(Some("   ")).unwrap(), None);
        // 前后空白照旧裁掉（前端 date-picker 不会给，但空串判定与 text_filter 保持同一口径）。
        assert_eq!(
            parse_date_filter(Some(" 2026-09-18 ")).unwrap(),
            Some("2026-09-18".to_string())
        );
    }

    #[test]
    fn date_filter_rejects_bad_shape() {
        for bad in [
            "2026/09/18",
            "26-09-18",
            "20260918",
            "2026-9-18",
            "2026-09-18x",
            "abcd-ef-gh",
            "2026-09-1",
        ] {
            assert!(parse_date_filter(Some(bad)).is_err(), "应拒绝 {bad}");
        }
    }

    #[test]
    fn date_filter_rejects_impossible_calendar_days() {
        for bad in [
            "2026-02-30",
            "2026-04-31",
            "2026-13-01",
            "2026-00-10",
            "2026-09-00",
            "2026-09-32",
            "0000-01-01",
        ] {
            assert!(parse_date_filter(Some(bad)).is_err(), "应拒绝 {bad}");
        }
    }

    #[test]
    fn date_filter_handles_leap_years() {
        assert_eq!(
            parse_date_filter(Some("2024-02-29")).unwrap(),
            Some("2024-02-29".to_string())
        );
        assert_eq!(
            parse_date_filter(Some("2000-02-29")).unwrap(),
            Some("2000-02-29".to_string())
        );
        assert!(parse_date_filter(Some("2026-02-29")).is_err());
        assert!(parse_date_filter(Some("1900-02-29")).is_err());
    }
}

/// `order_lines` 的一行 + 它属于哪张单（`LINE_COLUMNS` 里没有 `order_id`）。
#[derive(sqlx::FromRow)]
struct OwnedLineRow {
    order_id: i64,
    #[sqlx(flatten)]
    line: OrderLineRow,
}

/// 取本租户**全部订单 + 各自明细**（给「生产进度」页用）。
///
/// 为什么放在 orders 里而不是让 progress 自己写 SQL：`LINE_COLUMNS` / `line_to_dto` /
/// `OrderHeaderRow` 都是本模块的私有件，外面重写一遍列清单迟早和这里漂。
///
/// ⚠️ 一次性全量返回（不分页）—— 与旧版 `getProgress` 一致：旧版也是**一次拉全量、
/// 前端自己筛选/分页**（它确实不重新请求，见 `progress-analysis.md` §4.1）。
/// 数据量大了要改成分页，那时两边一起改。
pub async fn list_with_lines(
    pool: &PgPool,
    tenant_id: i64,
) -> ApiResult<Vec<(OrderHeaderRow, Vec<OrderLineDto>)>> {
    let header_sql =
        format!("SELECT {HEADER_COLUMNS} FROM orders WHERE tenant_id = $1 ORDER BY id ASC");
    let headers: Vec<OrderHeaderRow> =
        sqlx::query_as(&header_sql).bind(tenant_id).fetch_all(pool).await?;

    // 明细一次取完再按 order_id 分组，避免 N+1。
    let line_sql = format!(
        "SELECT {LINE_COLUMNS} FROM order_lines WHERE tenant_id = $1 ORDER BY order_id, row_index, id"
    );
    let line_rows: Vec<OwnedLineRow> = {
        // `LINE_COLUMNS` 里没有 order_id，所以这条查询单独前置一列；
        // 用 `#[sqlx(flatten)]` 把行字段摊平进外层 struct（元组不行：`OrderLineRow`
        // 只 derive 了 `FromRow`，没有 `Decode`）。
        let sql = format!(
            "SELECT order_id, {LINE_COLUMNS} FROM order_lines WHERE tenant_id = $1 ORDER BY order_id, row_index, id"
        );
        sqlx::query_as(&sql).bind(tenant_id).fetch_all(pool).await?
    };
    let _ = line_sql;

    let mut by_order: std::collections::HashMap<i64, Vec<OrderLineDto>> =
        std::collections::HashMap::new();
    for r in line_rows {
        by_order.entry(r.order_id).or_default().push(line_to_dto(r.line));
    }

    Ok(headers
        .into_iter()
        .map(|h| {
            let lines = by_order.remove(&h.id).unwrap_or_default();
            (h, lines)
        })
        .collect())
}
