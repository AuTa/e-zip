use std::{
    path::PathBuf,
    sync::{mpsc, Mutex},
    thread,
};

use serde::{Deserialize, Serialize};
use sevenz::{
    fs_tree::{ArchiveTree, FsTreeNode},
    Archive,
};
use specta::Type;
use specta_typescript::Typescript;
use tauri::{ipc::Channel, AppHandle, Emitter, Manager, State};
use tauri_specta::{collect_commands, collect_events, Builder, Event};

mod config;
mod sevenz;

#[tauri::command]
#[specta::specta]
fn check_7z_version(app: AppHandle) -> Result<String, sevenz::error::SevenzError> {
    let config_dir = app.path().app_config_dir().unwrap();
    sevenz::check_7z_version(&config_dir)
}

#[tauri::command]
#[specta::specta]
async fn download_7z(app: AppHandle) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().unwrap();
    match sevenz::download_7z(&config_dir).await {
        Ok(_) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
#[specta::specta]
async fn show_archives_contents(
    app: AppHandle,
    app_config: State<'_, Mutex<config::AppConfig>>,
    paths: Vec<PathBuf>,
    password: String,
) -> Result<(), String> {
    let app_config = app_config.lock().unwrap().clone();
    for path in paths {
        let result = sevenz::show_archive_content(&path, &password, None, &app_config);
        app.emit("drag_drop_file_contents", &result).unwrap();
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn refresh_archive_contents(
    app: AppHandle,
    app_config: State<'_, Mutex<config::AppConfig>>,
    archive: Archive,
    password: String,
) -> Result<(), String> {
    let app_config = app_config.lock().unwrap().clone();
    println!("{:?} extract", archive);

    let result =
        sevenz::show_archive_content(&archive.path, &password, archive.codepage, &app_config);
    app.emit("drag_drop_file_contents", &result).unwrap();
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct UnzipedArchiveEvent((PathBuf, sevenz::unzip::UnzipedArchiveStatus));

#[tauri::command]
#[specta::specta]
async fn unzip_archives(
    app: AppHandle,
    app_config: State<'_, Mutex<config::AppConfig>>,
    archives: Vec<Archive>,
    target_dir: PathBuf,
    global_password: Option<String>,
) -> Result<(), String> {
    let app_config = app_config.lock().unwrap().clone();
    let (tx, rx) = mpsc::channel();
    let handle = thread::spawn(move || {
        for res in rx {
            UnzipedArchiveEvent(res).emit(&app).unwrap();
        }
    });
    for archive in archives {
        sevenz::unzip::unzip(archive, &target_dir, &global_password, &app_config, &tx);
    }

    drop(tx);

    handle.join().unwrap();

    Ok(())
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct DeletedArchiveEvent((PathBuf, Option<String>));

#[tauri::command]
#[specta::specta]
async fn delete_archives(paths: Vec<PathBuf>, on_event: Channel<DeletedArchiveEvent>) {
    for path in paths {
        let result = sevenz::delete::delete_archive(&path);
        match result {
            Ok(_) => on_event.send(DeletedArchiveEvent((path, None))).unwrap(),
            Err(err) => {
                on_event
                    .send(DeletedArchiveEvent((path, Some(err.to_string()))))
                    .unwrap();
            }
        }
    }
}

#[derive(Debug, Serialize)]
pub struct DragDropFileContents<'a> {
    path: &'a PathBuf,
    result: Result<sevenz::fs_tree::FsTree, sevenz::error::SevenzError>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new()
        // Then register them (separated by a comma)
        .commands(collect_commands![
            check_7z_version,
            download_7z,
            unzip_archives,
            delete_archives,
            show_archives_contents,
            refresh_archive_contents,
            config::tauri::init_config,
            config::tauri::update_config,
        ])
        .events(collect_events![UnzipedArchiveEvent])
        .typ::<FsTreeNode>()
        .typ::<ArchiveTree>();

    #[cfg(debug_assertions)] // <- Only export on non-release builds
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            config::tauri::setup_handler(app).unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
