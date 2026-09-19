// 生产进度（旧版 `/Progress` 页）的传输结构。
// 逆向见 docs/2026-09-19-progress-{analysis,server,shell}.md。

use serde::{Deserialize, Serialize};

/// 一户租户的工序名清单 —— **15 个扁平槽**。
///
/// 旧版 `GetProcedures` 返回的就是这个形状（`{工序1:"下料", 工序2:"组装", …}`），
/// 前端拿到后**丢掉空槽、按槽号排序**。
///
/// ⚠️ 旧版这张表按 **`registrant`** 查（配置表的租户键），业务表按 `ds` 查 ——
/// 两把键、列名都叫 `database_name`，传错**不报错只静默降级**（15 槽全空）。
/// 新版只有一把 `tenant_id`，见迁移 `0021_progress.sql` 的头注。
#[derive(Debug, Serialize)]
pub struct ProcedureSlotDto {
    /// `'工序1'` .. `'工序15'`
    pub slot: String,
    pub name: String,
    /// 该槽的颜色，**空串 = 没配过**（不是「白色」）。
    ///
    /// 旧版没有这个字段 —— 颜色存在浏览器 localStorage 的 `procedure_name_color_map` 里，
    /// 键是**工序名**（改名即丢色）且不分租户。新版落在 `procedures.color`，见迁移 `0022`。
    pub color: String,
}

/// `GET /v1/procedures` 的返回：按槽号排好序的数组。
///
/// 之所以给数组而不是 `{工序1:…}` 这种对象：JSON 对象的键序在 JS 里**不保证**，
/// 而前端要「按槽号升序」—— 排序这件事放在服务端做一次，两边都不必再操心。
#[derive(Debug, Serialize)]
pub struct ProceduresDto {
    pub slots: Vec<ProcedureSlotDto>,
}

/// `POST /v1/procedures` 的请求体 —— **整体 upsert**。
///
/// 对应旧版 `param1=SetProcedures`（`param2`=registrant、body=`{工序1:名字, …}`）。
/// 区别有两点：
///
/// · 旧版 body 是**裸的 槽→名 对象**，槽名是 JSON 的键；新版包一层 `slots` 数组，
///   顺序可控、且新增的 `color` 有地方放（旧版颜色根本没上过服务端）。
/// · 旧版按 `registrant` 查租户；新版从登录态取 `tenant_id`。
#[derive(Debug, Deserialize)]
pub struct ProceduresInput {
    pub slots: Vec<ProcedureSlotInput>,
}

/// 请求体里的一个槽。
#[derive(Debug, Deserialize)]
pub struct ProcedureSlotInput {
    /// `'工序1'` .. `'工序15'`。**野槽名直接 400**（与 `progress/update` 同口径）。
    pub slot: String,
    /// 该槽的工序名。空串 = 该槽没名字（`GET` 里照样返回，只是名字为空）。
    pub name: String,
    /// 该槽的颜色。允许缺省（缺省 = 空串 = 没配过），前端只改名字时可以不带。
    #[serde(default)]
    pub color: String,
}

/// `POST /v1/scan/labels` 的请求体 —— 标签云打印的数据。
///
/// 对应旧版 `param1=getLabelData&param2={ds}`，body = `["单号", …]`（**裸数组**）。
/// 新版包一层 `line_nos`：与 `POST /v1/procedures` 包 `slots` 同理，
/// 裸数组做 body 以后想加参数就没地方放。
///
/// ⚠️ 这里的「单号」是**行级** `单号`（= `order_lines.line_no`），不是订单号 —— 见 `service::label_data`。
#[derive(Debug, Deserialize)]
pub struct LabelDataInput {
    /// 要打标签的**行级单号**（= 页面上勾选的那批，也是二维码里装的那个）。
    #[serde(default)]
    pub line_nos: Vec<String>,
}

/// `GET /v1/scan/qrcode` 的查询串 —— 扫码 / 手动查单。
///
/// 旧版是 `param1=getScanQRcode&param3={扫到的文本}`（`progress.service.ts:511`）。
/// 这里只有一个 `code`：旧版 `param3` 是单个值（dispatch 那条），
/// 逗号分隔的形态由 `service::scan_qrcode` 内部拆（旧 REST 路由就是这么发的）。
///
/// 缺省 = 空串 ⇒ **200 + 空列表**（旧版空入参那一支），不是 400。
#[derive(Debug, Deserialize)]
pub struct ScanQrCodeQuery {
    #[serde(default)]
    pub code: String,
}

/// `GET /v1/scan/stats` 的查询串 —— 扫码统计。
///
/// 旧版是 `param1=getProcessCounts&param3={员工}&param4={当天|本周|本月|"起,止"}`。
///
/// · `employee`：员工名；哨兵值 `1` = **全部员工**（旧版 `operatorName !== '1'` 那个判断）。
/// · `range`：三个日期档位标签，或 `"起,止"`（`YYYY-MM-DD`，闭区间；只给一个日期时起止同天）。
///
/// 两个都**必填**（缺/空 → 400）。旧版是 500 + 一段裸 HTML（`missing params`）——
/// 那是事故现场不是契约，见 `service::scan_stats` 的偏离说明。
#[derive(Debug, Deserialize)]
pub struct ScanStatsQuery {
    #[serde(default)]
    pub employee: String,
    #[serde(default)]
    pub range: String,
}

/// `POST /v1/progress/update` 的请求体。
///
/// 对应旧版 `param1=updataProgress`（`param3`=槽名、`param4`=要写的值、body=行 id 列表）。
/// 新版把三样都放进 JSON —— 旧版那个 `param3`/`param4` 混在 query 里的口径不好读。
///
/// ## 「改哪几行」有两个字段，**至少给一个**（都给就取并集）
///
/// 旧版 body 是一组 ref，`normalizeRefs` + `rowRefs` **id 和单号都认**；新版把这两种粒度
/// 拆成两个各自明确的字段（见 `service::update_progress` 的注释与那处「有意比旧版窄」）：
///
/// · `line_ids` —— `order_lines.id`（PC 端 `/Progress` 手里就是行 id）
/// · `line_nos` —— **行级**单号 `order_lines.line_no`（`/Qrscanner` 手里只有扫出来的单号）
#[derive(Debug, serde::Deserialize)]
pub struct ProgressUpdateInput {
    /// 要改的**行**（`order_lines.id`）。
    ///
    /// ⚠️ `#[serde(default)]` 是**必须的**：只给 `line_nos` 的调用方（扫码端）不会带这个键，
    /// 少了它整条请求会**反序列化失败**（422），而不是走到 handler。
    #[serde(default)]
    pub line_ids: Vec<i64>,
    /// 要改的**行级单号**（= 二维码里装的那个，如 `12-26/09/19`）。
    ///
    /// ⚠️ **不是**订单的回执单号 —— 旧版把回执单号也当 ref 收（传订单号 = 改整单所有行），
    /// 新版只认行级单号，见 `service::update_progress`。
    /// 本租户内一个都没对上的单号会在响应的 `missing` 里回给调用方。
    #[serde(default)]
    pub line_nos: Vec<String>,
    /// `'工序1'` .. `'工序15'`
    pub slot: String,
    /// 要写进这个槽的值。旧版格式是 `工序名[_操作员]_YYYY-MM-DD`，但**服务端不校验格式**
    /// （它只当字符串存），所以新版也不校验 —— 谁拼谁负责。
    pub value: String,
}
