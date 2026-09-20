mod handler;
pub(crate) mod model;
pub(crate) mod service;

use axum::routing::get;
use axum::Router;

use crate::core::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/orders", get(handler::list).post(handler::create))
        // Home「查询更多」（旧版 `getMoreTableDate`）。静态段必须排在 `/{id}` 之前登记吗？
        // 不必：axum 0.8 的 matchit 对静态段有优先级，`/orders/search` 不会被 `/{id}` 吃掉。
        .route("/api/v1/orders/search", get(handler::search))
        .route(
            "/api/v1/orders/{id}",
            get(handler::get)
                .put(handler::update)
                .patch(handler::update_head)
                .delete(handler::delete),
        )
        .route(
            "/api/v1/orders/{id}/lines/{line_id}",
            axum::routing::put(handler::update_line).delete(handler::delete_line),
        )
        // 合并订单（旧版 `param1=combine`，存活单由服务端算 —— 有意偏离，见 handler）。
        .route(
            "/api/v1/orders/combine",
            axum::routing::post(handler::combine),
        )
        // 「填入单号」（旧版 Hui 的那颗按钮；旧版走 getDiaoFormulas 顺带返回）。
        .route(
            "/api/v1/orders/{id}/fill-line-numbers",
            axum::routing::post(handler::fill_line_numbers),
        )
}

#[cfg(test)]
mod tests {
    /// `/orders/search`（静态）与 `/orders/{id}`（动态）同层。axum 在 `.route()` 那一刻就把路径
    /// 插进 matchit，插不进会直接 panic —— 这个测试钉住「两者能共存」，免得以后有人挪了顺序才发现。
    #[test]
    fn router_registers_search_alongside_id_route() {
        let _ = super::router();
    }
}
