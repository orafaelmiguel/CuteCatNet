// main.rs
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod scanner;

#[tauri::command]
async fn scan_network() -> Result<Vec<scanner::Device>, String> {
    scanner::perform_scan().await.map_err(|e| e.to_string())
}

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![scan_network])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
