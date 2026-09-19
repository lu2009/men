use sqlx::PgPool;

use crate::core::error::ApiResult;

use super::model::{ProcedureSlotDto, ProceduresDto};

/// 工序槽总数。旧版是**写死的 15**（服务端 `buildProgressText` 里
/// `for (let i = 1; i <= 15; i++)`，前端 `GetProcedures` 也是 15 个扁平槽）。
/// 新版沿用 15 —— 库里没配的槽返回空名，**不省略**，这样前端拿到的一定是 15 项。
const SLOT_COUNT: usize = 15;

/// 槽号（1-based）→ `'工序N'`。前端与服务端都用这个拼法，别在别处再写一遍。
pub fn slot_name(i: usize) -> String {
    format!("工序{i}")
}

/// 读某租户的工序名清单。
///
/// **返回恒为 15 项**（库里没配的给空名），顺序按槽号 —— 见 `ProceduresDto` 的注释。
pub async fn get_procedures(pool: &PgPool, tenant_id: i64) -> ApiResult<ProceduresDto> {
    // 只取有名字的，剩下的在下面补空 —— 这样「库里一行都没有」也能返回 15 个空槽。
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT slot, name FROM procedures WHERE tenant_id = $1 AND name <> ''",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await?;

    let find = |slot: &str| rows.iter().find(|(s, _)| s == slot).map(|(_, n)| n.clone());

    let slots = (1..=SLOT_COUNT)
        .map(|i| {
            let s = slot_name(i);
            let name = find(&s).unwrap_or_default();
            ProcedureSlotDto { slot: s, name }
        })
        .collect();

    Ok(ProceduresDto { slots })
}

