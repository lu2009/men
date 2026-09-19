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
//   · `GET /v1/progress/more` ✅ 「查询更多」：按客户/安装地址/日期范围取一批（同 `build_row`）
//   · `POST /v1/progress/update` ✅ 给若干行写某个工序槽
//   · `POST /v1/scan/labels` ✅ 标签云打印的数据（按**行级单号**取门行）
//   · `GET /v1/scan/qrcode`  ✅ 扫码/手动查单：**只回命中的行**（旧版 `getScanQRcode`）
//   · `GET /v1/scan/stats`   ✅ 扫码统计：**只回范围内的行**（旧版 `getProcessCounts`）
//   · 其余写接口（删除进度、收款）   ⏳ 待做
//
// ⚠️ **`/v1/scan/*` 为什么必须是窄接口**（2026-09-19 纠正）：
// 第一版把「扫码查单」和「扫码统计」做成「前端拉 `GET /v1/progress` 全量 + 客户端过滤」。
// 那是错的 —— `/Qrscanner` 装在**车间工人自己手机上**，拉全量等于把整厂门行
// （客户名/金额/安装地址）发到每台扫码手机，而工人这一次只该看到他扫到的那几行。
// 旧版两条接口本来就是窄的（扫码一次只回命中行、统计一次只回范围内行），这两条即**回到旧版形状**。
// ⇒ 扫码账号的白名单里**已删掉** `GET /v1/progress` 与 `GET /v1/progress/more`
//   （`core/guard.rs`），只留 `/v1/scan/qrcode`、`/v1/scan/stats` 这两条窄的。
//
// ⚠️ 「扫码日期 / 扫码员工」是**读时现推**（`service::derive_scan_marker`），不是列：
// 从 `procedure_slots` 里用旧版 `parseScanMarker` 那个正则推（加列只在「下一次写入」时才填得上，
// 历史行永远是空）。**推导只在服务端做这一份** —— 前端不再自己推，免得两处各推一份。
// `扫码员工` 只作筛选键、不上屏，所以行里**不带**它；`扫码日期` 带（26 列的详情里有一列就是它）。
//
// ⚠️ **「查询更多」的客户候选不必另开端点** —— 旧版是 `param1=getClientsInfo&param2={ds}`，
// 落到 `clientServ.getClients(ds)` = **本租户全部客户**（`client.service.ts:219`）。
// 那正是 `GET /api/v1/clients?search=` 空搜索时的结果 ⇒ 前端调现成的 `api.listClients()` 即可，
// 按 `{ name: c.name, tel: c.phone, address: c.address, id: c.code }` 映射成下拉项
// （旧版前端读的 `客户/电话/地址/编号` 四个中文键见 `-analysis.md` §3.3）。
// 唯一差异：旧版按 `createdAt desc` 给，`/v1/clients` 按 `客户编号` 升序 —— 下拉带本地过滤，
// **不改** `/v1/clients` 的排序（它还被别的页面用着）。
//
// ⚠️ **「扫码录单提交」不需要新端点，但 update 得收单号** —— 旧版 `param1=updataProgress`
// （`param3`=槽号、`param4`=拼好的值、body=**id 或 单号**）落到的就是上面那条
// `POST /v1/progress/update`（见 `docs/2026-09-19-qrscanner-analysis.md` §8.5）。
//
// ★ 2026-09-19 第二版：扫码端手里**只有扫出来的单号**，原先它靠 `GET /v1/progress` 拉全量
// 建「单号 → 行 id」的表 —— 那条已经 403（见上），而「确认」是这页最核心的按钮。
// ⇒ 让 `POST /v1/progress/update` **直接收行级单号**（`line_nos`，与 `line_ids` 二选一、
// 都给取并集），服务端在 WHERE 里按 `tenant_id` 解析 —— 与旧版两条路都认的形态一致，
// 又**不必**为扫码端另开端点、也不多暴露一行数据。
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
        // 「查询更多」的路径是 `/progress/more`（静态段），与 `/progress/update` 一样
        // 排在 `/progress` 之外 —— axum 0.8 里静态段互不冲突，顺序无关。
        .route("/api/v1/progress/more", get(handler::more_progress))
        .route("/api/v1/progress/update", post(handler::update_progress))
        // 标签数据（旧版 `/Qrscanner` 页的「打印标签」）—— 放在本模块是因为它和
        // `GET /v1/progress` **返回同一种行**（`service::build_row`）。另起模块的话，
        // 那个行构造器要么复制一份、要么还是得 import 过来，多一层不值得。
        .route("/api/v1/scan/labels", post(handler::label_data))
        // 扫码专用**窄**接口（旧版 `getScanQRcode` / `getProcessCounts`）：扫码账号的手机
        // 只该拿到「他扫到的 / 他范围内」的那几行，见模块头注释。放本模块是因为它们与
        // `GET /v1/progress` **返回同一种行**（同一个 `build_row`）。
        .route("/api/v1/scan/qrcode", get(handler::scan_qrcode))
        .route("/api/v1/scan/stats", get(handler::scan_stats))
}

#[cfg(test)]
mod tests {
    /// `/progress`（静态）/ `/progress/more`、`/progress/update`（静态子段）同层。
    /// axum 在 `.route()` 那一刻就把路径插进 matchit，插不进会直接 panic —— 这个测试钉住
    /// 「三者能共存」，免得以后有人挪了顺序才发现。与 `orders::tests` 那条同理。
    #[test]
    fn router_registers_more_and_update_alongside_progress() {
        let _ = super::router();
    }
}
