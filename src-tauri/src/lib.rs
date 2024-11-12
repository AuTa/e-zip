use std::path::PathBuf;

use sevenz::fs_tree::FsTreeNode;
use specta_typescript::Typescript;
use tauri::{DragDropEvent, Emitter, WindowEvent};
use tauri_specta::{collect_commands, Builder};

mod sevenz;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
#[specta::specta]
fn check_7z_version() -> String {
    sevenz::check_7z_version()
}

#[derive(Debug, serde::Serialize)]
pub struct DragDropFileContents<'a> {
    path: &'a PathBuf,
    result: Result<sevenz::fs_tree::FsTree, sevenz::SevenzError>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new()
        // Then register them (separated by a comma)
        .commands(collect_commands![check_7z_version,])
        .typ::<FsTreeNode>();

    #[cfg(debug_assertions)] // <- Only export on non-release builds
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                for path in paths {
                    let result = sevenz::show_archive_content(path);
                    let payload = result;
                    window.emit("drag_drop_file_contents", &payload).unwrap();
                }
            }
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet,])
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
