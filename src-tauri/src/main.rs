// main.rs
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod scanner;
mod oui_db;
mod stresser;

use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

// Global state for the stress test engine
struct AppState {
    stress_engine: Mutex<stresser::StressTestEngine>,
}

#[tauri::command]
async fn scan_network() -> Result<Vec<scanner::Device>, String> {
    scanner::perform_scan().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn validate_stress_target(ip: String, state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let engine = state.stress_engine.lock().await;
    match engine.validate_target_ip(&ip).await {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn start_stress_test(
    config: stresser::StressTestConfig,
    state: tauri::State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let mut engine = state.stress_engine.lock().await;

    let test_result = engine.start_stress_test(config.clone()).await;

    // Drop the engine guard early to avoid lifetime issues
    drop(engine);

    match test_result {
        Ok(test_id) => {
            // For now, skip the real-time updates to avoid lifetime issues
            // This can be implemented later using a different approach
            Ok(test_id)
        }
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn stop_stress_test(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let engine = state.stress_engine.lock().await;
    engine.stop_current_test().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_stress_test_status(state: tauri::State<'_, AppState>) -> Result<stresser::TestStatus, String> {
    let engine = state.stress_engine.lock().await;
    Ok(engine.get_current_status().await)
}

#[tauri::command]
async fn get_stress_test_metrics(state: tauri::State<'_, AppState>) -> Result<stresser::TestMetrics, String> {
    let engine = state.stress_engine.lock().await;
    Ok(engine.get_current_metrics().await)
}

#[tauri::command]
async fn get_current_stress_test(state: tauri::State<'_, AppState>) -> Result<Option<stresser::TestResult>, String> {
    let engine = state.stress_engine.lock().await;
    Ok(engine.get_current_test().await)
}

#[tauri::command]
async fn confirm_stress_alive(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let engine = state.stress_engine.lock().await;
    engine.confirm_alive().await;
    Ok(())
}

fn main() {
    env_logger::init();

    let app_state = AppState {
        stress_engine: Mutex::new(stresser::StressTestEngine::new()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            scan_network,
            validate_stress_target,
            start_stress_test,
            stop_stress_test,
            get_stress_test_status,
            get_stress_test_metrics,
            get_current_stress_test,
            confirm_stress_alive
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
