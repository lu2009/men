// 生产进度（旧版 `/Progress` 页）。
//
// 逆向文档：`docs/2026-09-19-progress-analysis.md`（前端看到什么）、
// `-server.md`（服务端怎么算怎么存）、`-shell.md`（外壳/设置/看板）。
// 「设置工序」的读写见 `docs/2026-09-19-qrscanner-analysis.md` §4 / §8。
//
// 端点清单（分步做，✅ = 已实现）：
//   · `GET /v1/procedures`   ✅ 15 槽 + 名字 + 颜色（迁移 `0022_procedure_color.sql`）
//   · `POST /v1/procedures`  ✅ 整体 upsert（名字 + 颜色），槽名非法 400
//   · `GET /v1/progress`     ✅ 全量（行结构见 `-analysis.md` §11）
//   · `POST /v1/progress/update` ✅ 给若干行写某个工序槽
//   · `POST /v1/scan/labels` ✅ 标签云打印的数据（按**行级单号**取门行）
//   · 其余写接口（删除进度、收款）   ⏳ 待做
//
// ⚠️ **两条旧接口有意不做**：
//   · `getScanQRcode`（扫码查单）—— 纯过滤，`GET /v1/progress` 已给全量门行 + `单号`，
//     前端**客户端过滤**即可（前端已按这个方案定）。
//   · `getProcessCounts`（扫码统计看板）—— 它筛的是 `扫码日期`/`扫码员工`，
//     而这两格新栈**从来不写**（`update_progress` 的注释里写着「等做看板时再定」）。
//     要不要落这两个字段是**模型决定**，评估结论见分析文档 §8.6(b)。
//
// ⚠️ **「扫码录单提交」不需要新端点** —— 旧版 `param1=updataProgress`
// （`param3`=槽号、`param4`=拼好的值、body=单号数组）落到的就是上面这条
// `POST /v1/progress/update`（见 `docs/2026-09-19-qrscanner-analysis.md` §8.5）。
// 前端手里有行级「单号 → 行」的映射（`GET /v1/progress` 的行里带 `id` = `order_lines.id`），
// 直接拿它拼 `line_ids` 即可，**别为扫码端另开一条接口**。
mod handler;
mod model;
mod service;

use axum::routing::{get, post};
use axum::Router;

use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/procedures",
            get(handler::get_procedures).post(handler::set_procedures),
        )
        .route("/api/v1/progress", get(handler::get_progress))
        .route("/api/v1/progress/update", post(handler::update_progress))
        // 标签数据（旧版 `/Qrscanner` 页的「打印标签」）—— 放在本模块是因为它和
        // `GET /v1/progress` **返回同一种行**（`service::build_row`）。另起模块的话，
        // 那个行构造器要么复制一份、要么还是得 import 过来，多一层不值得。
        .route("/api/v1/scan/labels", post(handler::label_data))
}
