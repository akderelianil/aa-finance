//! Backups of the one database file: a copy on demand, one automatic copy per day (the last
//! KEEP are kept), and a restore in place. The UI picks paths and names; rules stay simple here.

use crate::db::Db;
use rusqlite::backup::Backup;
use rusqlite::{Connection, OpenFlags};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

const KEEP: usize = 10;
const AUTO: &str = "aa-finance-";

fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?.join("backups");
    std::fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

/// A file name part from the UI (a date or a time stamp): no path characters.
fn safe(name: &str) -> Result<&str, String> {
    if !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        Ok(name)
    } else {
        Err(format!("bad backup name: {name}"))
    }
}

/// A consistent copy of the live database. VACUUM INTO refuses an existing file, so an
/// existing target (the save dialog already asked) is removed first; never the live file.
fn copy_to(conn: &Connection, path: &Path) -> Result<(), String> {
    let live = conn.path().and_then(|p| Path::new(p).canonicalize().ok());
    if path.exists() {
        if live.is_some() && path.canonicalize().ok() == live {
            return Err("cannot overwrite the open database".into());
        }
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    conn.execute("VACUUM INTO ?1", [path.to_string_lossy()])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn backup_dir(app: AppHandle) -> Result<String, String> {
    Ok(dir(&app)?.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn backup_to(db: State<'_, Db>, path: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    copy_to(&conn, Path::new(&path))
}

/// Today's automatic copy, once per day; then drop all but the newest KEEP.
#[tauri::command]
pub async fn backup_auto(app: AppHandle, db: State<'_, Db>, day: String) -> Result<(), String> {
    let d = dir(&app)?;
    let path = d.join(format!("{AUTO}{}.sqlite", safe(&day)?));
    if path.exists() {
        return Ok(());
    }
    copy_to(&*db.0.lock().map_err(|e| e.to_string())?, &path)?;
    let mut autos: Vec<PathBuf> = std::fs::read_dir(&d)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            let n = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            n.starts_with(AUTO) && n.ends_with(".sqlite")
        })
        .collect();
    autos.sort();
    let extra = autos.len().saturating_sub(KEEP);
    for p in &autos[..extra] {
        let _ = std::fs::remove_file(p);
    }
    Ok(())
}

/// Replaces the live database with a backup file. The current data is copied to
/// backups/before-restore-<stamp>.sqlite first. The UI reloads after it (migrations run again).
#[tauri::command]
pub async fn restore_from(
    app: AppHandle,
    db: State<'_, Db>,
    path: String,
    stamp: String,
    max_version: i64,
) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let before = dir(&app)?.join(format!("before-restore-{}.sqlite", safe(&stamp)?));
    restore_into(&mut conn, Path::new(&path), max_version, &before)
}

/// Checks the file is our database (not newer than the app), copies the live data to
/// `before`, then copies the file page by page into the live connection.
fn restore_into(conn: &mut Connection, path: &Path, max_version: i64, before: &Path) -> Result<(), String> {
    let not_ours = |_| "not_a_backup".to_string();
    let src = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(not_ours)?;
    let check: String = src.query_row("PRAGMA quick_check", [], |r| r.get(0)).map_err(not_ours)?;
    let ours: i64 = src
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN ('settings', 'entries', 'lines')",
            [],
            |r| r.get(0),
        )
        .map_err(not_ours)?;
    if check != "ok" || ours != 3 {
        return Err("not_a_backup".into());
    }
    let version: i64 = src.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(not_ours)?;
    if version > max_version {
        return Err("backup_too_new".into());
    }
    copy_to(conn, before)?;
    Backup::new(&src, conn)
        .and_then(|b| b.run_to_completion(1000, Duration::ZERO, None))
        .map_err(|e| e.to_string())
}

/// Writes a text file the user picked in a save dialog (the JSON export).
#[tauri::command]
pub async fn write_text(path: String, text: String) -> Result<(), String> {
    std::fs::write(path, text).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn book(path: &Path, rows: i64) -> Connection {
        let c = crate::db::open(path).unwrap();
        c.execute_batch("CREATE TABLE settings (x); CREATE TABLE entries (x); CREATE TABLE lines (x); PRAGMA user_version = 2;")
            .unwrap();
        for i in 0..rows {
            c.execute("INSERT INTO lines VALUES (?1)", [i]).unwrap();
        }
        c
    }
    const COUNT: &str = "SELECT count(*) FROM lines";

    #[test]
    fn backup_and_restore_round_trip() {
        let d = std::env::temp_dir().join(format!("aa-backup-test-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        let mut live = book(&d.join("live.sqlite"), 3);

        // A backup never overwrites the open file.
        assert!(copy_to(&live, &d.join("live.sqlite")).is_err());
        copy_to(&live, &d.join("b1.sqlite")).unwrap();
        live.execute("INSERT INTO lines VALUES (99)", []).unwrap();

        restore_into(&mut live, &d.join("b1.sqlite"), 2, &d.join("before.sqlite")).unwrap();
        assert_eq!(live.query_row(COUNT, [], |r| r.get::<_, i64>(0)).unwrap(), 3);
        let before = Connection::open(d.join("before.sqlite")).unwrap();
        assert_eq!(before.query_row(COUNT, [], |r| r.get::<_, i64>(0)).unwrap(), 4);

        // Too new, not ours, not SQLite: refused, live data unchanged.
        assert_eq!(restore_into(&mut live, &d.join("b1.sqlite"), 1, &d.join("x.sqlite")), Err("backup_too_new".into()));
        drop(Connection::open(d.join("other.sqlite")).unwrap().execute_batch("CREATE TABLE t (x)"));
        assert_eq!(restore_into(&mut live, &d.join("other.sqlite"), 2, &d.join("x.sqlite")), Err("not_a_backup".into()));
        std::fs::write(d.join("junk.sqlite"), "not a database at all, just text that is long enough").unwrap();
        assert_eq!(restore_into(&mut live, &d.join("junk.sqlite"), 2, &d.join("x.sqlite")), Err("not_a_backup".into()));
        assert_eq!(live.query_row(COUNT, [], |r| r.get::<_, i64>(0)).unwrap(), 3);
        std::fs::remove_dir_all(&d).unwrap();
    }
}
