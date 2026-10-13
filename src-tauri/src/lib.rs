mod backup;
mod db;

use std::sync::Mutex;
use tauri::Manager;

/// The UI sends text to the terminal (L0 spike results). Remove with the spike page.
#[tauri::command]
fn dev_log(msg: String) {
    eprintln!("{msg}");
}

pub fn run() {
    tauri::Builder::default()
        // A second start would write the same file from another process: focus the first window instead.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = db::open(&dir.join("aa-finance.sqlite"))?;
            app.manage(db::Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::db_query,
            db::db_batch,
            backup::backup_dir,
            backup::backup_to,
            backup::backup_auto,
            backup::restore_from,
            backup::reset_data,
            dev_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
