//! 角色授权层：**在 router 层**按角色放行/拦截，不在每个 handler 里各判一遍。
//!
//! ## 为什么要有
//!
//! 扫码账号（`role = 'scanner'`）是发给车间工人、装在他们自己手机上扫码用的。
//! 在加这一层之前，全后端**只有** `auth/service.rs` 的登录/改密两处按用户身份行事，
//! 没有任何地方按 `role` 拦权限 ⇒ 一个扫码账号能调**所有**端点：
//! 删订单、动财务、改设置、读客户资料。这是实打实的权限漏洞，不是理论风险。
//!
//! 旧版靠 `userinfo.defaulted`（1=车间主账号 / 2=扫码账号 / 3=终端账号）做前端门控，
//! 服务端 `requireAuth` 只验令牌不验角色 —— 新版用 `role` 表达同一件事，
//! 并且**把门控放到服务端**（前端门控只能防误点，防不住直接打接口）。
//!
//! ## deny-by-default 是怎么保证的
//!
//! 两道互相独立的性质，任何一条单独成立就足够拦住：
//!
//! 1. **路由分组默认封闭**：`app.rs` 里只有 `guarded` 那棵子树套了本中间件，
//!    而各业务模块**默认往 `guarded` 里 merge**（加模块时不会有人特意往 `public` 里放）。
//!    落进 `guarded` 的路径，只要不在白名单（`SELF_SERVICE` / `SCANNER_ALLOWED`）里，
//!    就只认 `admin`。⇒ **新模块忘了归类 = 被拦住**，不是被放行。
//! 2. **白名单是「方法 + 完整路径」的精确匹配**，不是前缀匹配。
//!    例如 `/api/v1/progress/update` 放行，并不代表 `/api/v1/progress`（全量读）
//!    或以后新加的 `/api/v1/progress/delete` 也放行 —— 同前缀的别的端点照样要 admin。
//!    ⇒ **老模块里新加的端点也默认拦住**。
//!    ★ 路径**参数**也算「完整路径」的一部分：`/api/v1/print-templates/{mode}` 那条路由，
//!    白名单只写了 `.../lable` ⇒ 只有 `mode = lable` 放行，别的 mode 照样 403
//!    （匹配的是 `req.uri().path()`，不是路由模板）。
//!
//! 另有两处「白名单之外」的兜底（防路由错挂）：账号管理这类提权端点，
//! handler 里再调一次 [`require_admin`]（见 `modules/scanner`）。
//!
//! ## 为什么放行的白名单里只有这些
//!
//! 扫码工的手机上只有扫码生产页（`/Qrscanner`）：读**自己扫到的**行 → 提交工序 → 打标签
//! → 看**自己范围内**的统计。旧版同一个页面对 `defaulted=2` 关掉的按钮（设置工序）
//! 这里同样不放行，见 `docs/2026-09-19-qrscanner-analysis.md` §6.3。
//! ⇒ 判据是「**这页上那颗按钮真的要用它吗**」：工人点得到的走这条白名单，
//! 只有 PC 端才碰的（全量读、改配置、账号管理）一概不放。
//!
//! ⚠️ **读的那两条必须是窄接口**（`/v1/scan/qrcode`、`/v1/scan/stats`），
//! **不是** `GET /v1/progress` 这种全量接口 —— 全量 = 把整厂门行发到每台扫码手机。
//! 2026-09-19 从白名单里删掉的就是那两条全量的，理由见 `modules/progress/mod.rs`。
//!
//! 公开路由（`/api/v1/auth/login`、`/api/v1/public/receipts`、`/api/v1/health`）
//! **不经过本层**，它们由 `app.rs` 单独 merge 成 `public` 子树。

use axum::extract::{Request, State};
use axum::http::Method;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use super::auth::{bearer_token, CurrentUser};
use super::error::{ApiError, ApiResult};
use super::AppState;

/// 管理员角色：全部端点放行。
pub const ROLE_ADMIN: &str = "admin";

/// 扫码账号角色（旧版 `isDefaultPw = 2` + `mutilUser = 1` 那类账号）。
pub const ROLE_SCANNER: &str = "scanner";

/// **任何已登录角色**都能调的自助端点：只碰自己那一行，不碰租户数据。
///
/// 放在这里的是「不给自己就等于把人锁在门外」的那几条：登录后第一件事就是
/// `GET /auth/me`（导航/落地页要按 `role` 判），以及改自己的密码 ——
/// 旧版 `auth.routes.ts` 里任何登录用户都能改自己的密码，新版不因为角色而收回。
///
/// 不是提权路径：`change-password` 只认令牌里的 `user.user_id`，改不到别人头上，
/// 也不会动 `role`（旧版改密会把 `isDefaultPw` 置 0，那会把扫码账号降级成普通 PC 账号，
/// 是旧版的毛病，新版不抄，见 `docs/2026-08-21-auth-design.md`）。
const SELF_SERVICE: &[(&str, &str)] = &[
    ("GET", "/api/v1/auth/me"),
    ("POST", "/api/v1/auth/logout"),
    ("POST", "/api/v1/auth/change-password"),
];

/// scanner 额外可以调的端点，**精确到方法 + 完整路径**（自助端点见 [`SELF_SERVICE`]）。
///
/// 加条目时问自己：车间工人手机上那个扫码页**真的**要用它吗？
/// 拿不准就不加 —— 加错了是漏洞，少加了只是扫码页少个功能（会报 403）。
const SCANNER_ALLOWED: &[(&str, &str)] = &[
    // 扫码生产页：**只拿自己扫到的那几行** → 提交工序 → 取标签数据
    //
    // ⚠️ `GET /api/v1/progress` 与 `GET /api/v1/progress/more` **已从这里删掉**
    // （2026-09-19）。它们是**全量**接口：扫码账号放行等于把整厂门行（客户名/金额/
    // 安装地址）发到车间工人自己的手机上。扫码页要的两件事各有**窄**接口
    // （`/v1/scan/qrcode` 只回命中行、`/v1/scan/stats` 只回范围内行），
    // 见 `modules/progress/mod.rs` 的模块头注释。
    ("GET", "/api/v1/scan/qrcode"),
    ("GET", "/api/v1/scan/stats"),
    // 提交工序。**收行 id 也收行级单号**（`line_nos`）—— 扫码端手里只有扫出来的单号，
    // 为了拿行 id 去拉全量正是本次要删掉的那件事，见 `modules/progress/service.rs`。
    ("POST", "/api/v1/progress/update"),
    ("POST", "/api/v1/scan/labels"),
    // 「打印标签」要的那一个模板。扫码页四颗主按钮之一（扫一批 → 勾选 → 打印标签），
    // 而 `/qrscanner` 正是扫码账号**登录后的落地页** ⇒ 不放行的话工人一点就是 403。
    //
    // ★ **只放这一条，别顺手把整个 `print-templates` 模块放进来。**
    // 路由那边是 `/api/v1/print-templates/{mode}`（**路径参数**），而本白名单按
    // `req.uri().path()`（**具体路径**）精确匹配 ⇒ 写死 `lable` 就只放行 `lable` 这一个 mode，
    // `/print-templates/something-else` 照样 403。
    //
    // 风险面：回的是**打印模板 JSON**（版式配置），不含客户/金额/地址这类业务数据 ——
    // 与「全量门行」不是一个量级。旧版同一个页面对 `defaulted = 2` 也是能打印标签的。
    ("GET", "/api/v1/print-templates/lable"),
    // 工序槽名（页面要把槽号显示成「下料」这类名字）。**只读**：
    // `POST /api/v1/procedures`（= 旧版「设置工序」）不放行 —— 旧版那颗按钮对
    // `defaulted = 2`（扫码账号）本来就是不显示的（§6.2 `sa` 里 `1 === defaulted` 才让进）。
    ("GET", "/api/v1/procedures"),
];

fn in_list(list: &[(&str, &str)], method: &Method, path: &str) -> bool {
    list.iter()
        .any(|(m, p)| *m == method.as_str() && *p == path)
}

/// 任何已登录角色都能调的自助端点（见 [`SELF_SERVICE`]）。
pub fn self_service_allowed(method: &Method, path: &str) -> bool {
    in_list(SELF_SERVICE, method, path)
}

/// scanner 是否能调这个方法 + 路径。**精确匹配**，见模块头注释第 2 条。
pub fn scanner_allowed(method: &Method, path: &str) -> bool {
    self_service_allowed(method, path) || in_list(SCANNER_ALLOWED, method, path)
}

/// 校验这个请求，通过则返回解析好的用户。
///
/// 401 = 没登录/令牌过期；403 = 登录了但角色不够。
///
/// 入参是**拆开的** token / 方法 / 路径，而不是 `&Request` ——
/// `axum::body::Body` 是 `Send` 但**不是** `Sync`，把 `&Request` 跨 `await` 持有
/// 会让整个中间件的 future 变成 `!Send`，`Router::layer` 直接编不过（踩过）。
pub async fn authorize(
    state: &AppState,
    token: Option<String>,
    method: &Method,
    path: &str,
) -> ApiResult<CurrentUser> {
    let token = token.ok_or_else(|| ApiError::unauthorized("未提供认证令牌"))?;
    let user = CurrentUser::resolve(&state.pool, &token)
        .await?
        .ok_or_else(|| ApiError::unauthorized("令牌无效或已过期"))?;

    if allowed_for(&user, method, path) {
        Ok(user)
    } else if user.role == ROLE_SCANNER {
        Err(ApiError::forbidden(format!(
            "扫码账号只能使用扫码生产功能（{path}）"
        )))
    } else {
        Err(ApiError::forbidden(format!(
            "当前角色无权访问该功能（{path}）"
        )))
    }
}

/// 角色 + 方法 + 路径 → 放不放行。独立成纯函数，便于在测试里逐个角色钉住。
pub fn allowed_for(user: &CurrentUser, method: &Method, path: &str) -> bool {
    match user.role.as_str() {
        ROLE_ADMIN => true,
        ROLE_SCANNER => scanner_allowed(method, path),
        // 其它角色（`users.role` 的默认值是 `staff`）：只放开自助端点，
        // 业务端点一律拦 —— deny-by-default。
        _ => self_service_allowed(method, path),
    }
}

/// 提权端点专用的兜底检查：账号管理等 handler 里再判一次。
///
/// 正常情况下 router 层已经拦掉了，这里是**防路由错挂**的第二道锁
/// （比如以后有人把 `scanner::router()` 误 merge 进 public 子树）。
pub fn require_admin(user: &CurrentUser) -> ApiResult<()> {
    if user.role == ROLE_ADMIN {
        Ok(())
    } else {
        Err(ApiError::forbidden("该功能仅限管理员"))
    }
}

/// 中间件：套在 `guarded` 路由子树上（见 `app.rs`）。
///
/// 放行时把已解析的用户塞进请求扩展，handler 里的 `CurrentUser` 提取器直接用，
/// 不再查第二次会话（`core/auth.rs` 的 `from_request_parts` 会先看扩展）。
pub async fn require_role(State(state): State<AppState>, mut req: Request, next: Next) -> Response {
    // 先把请求上要用的东西取出来（见 `authorize` 的注释：`&Request` 不能跨 await 持有）
    let token = bearer_token(req.headers());
    let method = req.method().clone();
    let path = req.uri().path().to_string();

    match authorize(&state, token, &method, &path).await {
        Ok(user) => {
            req.extensions_mut().insert(user);
            next.run(req).await
        }
        Err(e) => e.into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user(role: &str) -> CurrentUser {
        CurrentUser {
            user_id: 1,
            tenant_id: 1,
            username: "u".into(),
            name: "n".into(),
            role: role.into(),
        }
    }

    /// scanner 能用的就是这几条，一条不多。
    #[test]
    fn scanner_can_use_scan_surface() {
        for (m, p) in [
            (Method::GET, "/api/v1/auth/me"),
            (Method::POST, "/api/v1/auth/logout"),
            (Method::POST, "/api/v1/auth/change-password"),
            (Method::GET, "/api/v1/scan/qrcode"),
            (Method::GET, "/api/v1/scan/stats"),
            (Method::POST, "/api/v1/progress/update"),
            (Method::POST, "/api/v1/scan/labels"),
            (Method::GET, "/api/v1/print-templates/lable"),
            (Method::GET, "/api/v1/procedures"),
        ] {
            assert!(scanner_allowed(&m, p), "{m} {p} 应当放行 scanner");
        }
    }

    /// ★ 打印模板只放行 **`lable` 这一个 mode**。
    ///
    /// 那条路由是 `/api/v1/print-templates/{mode}`（路径参数），而白名单按**具体路径**
    /// 精确匹配 —— 这条测试就是钉住「写死 lable ≠ 放行整个模块」。
    /// 要是有人以后顺手改成 `GET /api/v1/print-templates`（列表，含全部模板）或
    /// 加个前缀匹配，这里会红。
    #[test]
    fn scanner_gets_only_the_lable_print_template() {
        assert!(scanner_allowed(
            &Method::GET,
            "/api/v1/print-templates/lable"
        ));
        for p in [
            "/api/v1/print-templates",           // 列表：一次给全部模板
            "/api/v1/print-templates/xiaopiao",  // 别的 mode
            "/api/v1/print-templates/import",    // 导入（写）
            "/api/v1/print-templates/lable/x",   // 同前缀的别的路径
        ] {
            assert!(!scanner_allowed(&Method::GET, p), "{p} 不该放行 scanner");
        }
        // 写方法一律不放（万一以后有人给这个路径加上 PUT/POST）
        assert!(!scanner_allowed(
            &Method::POST,
            "/api/v1/print-templates/lable"
        ));
    }

    /// ★ 本次纠正的钉子：**全量读**那条接口，扫码账号一律进不去。
    ///
    /// 扫码页要的两件事各有窄接口（`/v1/scan/*`），全量接口只给 PC 端。
    /// 这条断言要是红了，说明有人把全量读又放回了白名单 —— 那就是把整厂门行
    /// （客户名/金额/安装地址）重新发到每台扫码手机上。
    #[test]
    fn scanner_cannot_read_the_full_progress_table() {
        assert!(!scanner_allowed(&Method::GET, "/api/v1/progress"));
        assert!(!scanner_allowed(&Method::GET, "/api/v1/progress/more"));
        // POST 那条（写工序槽）是放行的 —— 别把「删了 /progress」误读成「删了整块」
        assert!(scanner_allowed(&Method::POST, "/api/v1/progress/update"));
    }

    /// deny-by-default：敏感模块、同前缀的新端点、以及**没归类的新路径**，全部拦住。
    #[test]
    fn scanner_is_denied_everywhere_else() {
        // 敏感模块
        assert!(!scanner_allowed(&Method::GET, "/api/v1/orders"));
        assert!(!scanner_allowed(&Method::DELETE, "/api/v1/orders/1"));
        assert!(!scanner_allowed(
            &Method::GET,
            "/api/v1/finance/orders/summary"
        ));
        assert!(!scanner_allowed(&Method::GET, "/api/v1/receipts/R1"));
        assert!(!scanner_allowed(&Method::GET, "/api/v1/column-configs"));
        assert!(!scanner_allowed(&Method::GET, "/api/v1/prices"));
        assert!(!scanner_allowed(&Method::GET, "/api/v1/formulas"));
        assert!(!scanner_allowed(&Method::GET, "/api/v1/clients"));
        // 账号管理本身（那是 admin 的）
        assert!(!scanner_allowed(&Method::POST, "/api/v1/scanner-accounts"));
        assert!(!scanner_allowed(
            &Method::DELETE,
            "/api/v1/scanner-accounts"
        ));
        // 同一个前缀下的**别的**端点：白名单是精确匹配，不是前缀匹配
        assert!(!scanner_allowed(&Method::POST, "/api/v1/progress/delete"));
        assert!(!scanner_allowed(&Method::POST, "/api/v1/procedures"));
        assert!(!scanner_allowed(&Method::POST, "/api/v1/scan/whatever"));
        // 读接口也分窄的与全量的：`/scan/qrcode` 放行不代表 `/scan/qrcode/x` 放行
        assert!(!scanner_allowed(&Method::POST, "/api/v1/scan/qrcode"));
        assert!(!scanner_allowed(&Method::GET, "/api/v1/scan/qrcode/x"));
        assert!(!scanner_allowed(&Method::GET, "/api/v1/scan/stats/all"));
        // 大小写/尾斜杠不做模糊匹配
        assert!(!scanner_allowed(&Method::GET, "/api/v1/progress/"));
        assert!(!scanner_allowed(&Method::GET, "/api/v1/Progress"));
    }

    #[test]
    fn roles_gate_as_documented() {
        let admin = user(ROLE_ADMIN);
        let scanner = user(ROLE_SCANNER);
        let staff = user("staff");

        assert!(allowed_for(&admin, &Method::DELETE, "/api/v1/orders/1"));
        // scanner 走的是**窄**接口；全量读连角色判定这一层都不放
        assert!(allowed_for(&scanner, &Method::GET, "/api/v1/scan/qrcode"));
        assert!(allowed_for(&scanner, &Method::GET, "/api/v1/scan/stats"));
        assert!(!allowed_for(&scanner, &Method::GET, "/api/v1/progress"));
        assert!(!allowed_for(&scanner, &Method::GET, "/api/v1/orders"));
        // 未知角色（users.role 默认值就是 staff）：自助端点放开，业务端点一律拦
        assert!(allowed_for(&staff, &Method::GET, "/api/v1/auth/me"));
        assert!(allowed_for(
            &staff,
            &Method::POST,
            "/api/v1/auth/change-password"
        ));
        assert!(!allowed_for(&staff, &Method::GET, "/api/v1/progress"));
        assert!(!allowed_for(&staff, &Method::GET, "/api/v1/procedures"));
        assert!(!allowed_for(&staff, &Method::GET, "/api/v1/orders"));

        // 兜底检查与中间件同一口径
        assert!(require_admin(&admin).is_ok());
        assert!(require_admin(&scanner).is_err());
        assert!(require_admin(&staff).is_err());
    }
}
