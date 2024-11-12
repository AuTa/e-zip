use std::{fs, path::PathBuf, sync::Mutex};

use tauri::{App, AppHandle, Manager, State};

use crate::config;

const CONFIG_FILE_NAME: &str = "config.toml";

fn config_file_path(app_handle: &AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_config_dir()
        .unwrap()
        .join(CONFIG_FILE_NAME)
}

pub fn setup_handler(app: &mut App) -> Result<(), Box<dyn std::error::Error + 'static>> {
    let app_handle = app.app_handle();
    let config_dir = app_handle.path().app_config_dir().unwrap();
    if !config_dir.exists() {
        fs::create_dir(&config_dir).unwrap()
    }
    let file_path = config_dir.join(CONFIG_FILE_NAME);
    let app_config = config::AppConfig::load_from_file(&file_path);
    if !file_path.exists() {
        app_config.save_to_file(&file_path).unwrap();
    }

    app.manage(Mutex::new(app_config));

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn init_config(
    state: State<'_, Mutex<config::AppConfig>>,
) -> Result<config::AppConfig, String> {
    let app_config = state.lock().unwrap();
    Ok(app_config.clone())
}

#[tauri::command]
#[specta::specta]
pub async fn update_config(
    app_handle: AppHandle,
    state: State<'_, Mutex<config::AppConfig>>,
    app_config: config::AppConfig,
) -> Result<(), String> {
    let mut app_config_state = state.lock().unwrap();
    if *app_config_state != app_config {
        app_config
            .save_to_file(config_file_path(&app_handle))
            .unwrap();
        *app_config_state = app_config.clone();
    }
    Ok(())
}
