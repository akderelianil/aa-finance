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
            dev_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
