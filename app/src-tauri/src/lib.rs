// 桌面端入口。业务后端是独立的 axum 服务，本壳只负责承载前端页面；
// 需要系统能力时，再通过 `#[tauri::command]` 在此暴露命令给前端调用。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
