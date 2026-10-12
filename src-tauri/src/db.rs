//! The whole Rust side of the database: open the file, run one query, run a batch in one
//! transaction. Rules live in SQL (triggers); logic lives in TypeScript (src/core).
//! Contract shared with src/core/test/node-db.ts.

use rusqlite::types::{Value as Sql, ValueRef};
use rusqlite::{params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value as Json;
use std::path::Path;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

/// JavaScript numbers hold integers exactly only up to 2^53 - 1.
const MAX_SAFE: i64 = (1 << 53) - 1;

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )?;
    Ok(conn)
}

#[derive(Serialize)]
pub struct QueryResult {
    columns: Vec<String>,
    rows: Vec<Vec<Json>>,
}

#[derive(Deserialize)]
pub struct Statement {
    sql: String,
    #[serde(default)]
    params: Vec<Json>,
}

fn to_sql(v: &Json) -> Result<Sql, String> {
    match v {
        Json::Null => Ok(Sql::Null),
        Json::String(s) => Ok(Sql::Text(s.clone())),
        Json::Number(n) => match n.as_i64() {
            Some(i) if (-MAX_SAFE..=MAX_SAFE).contains(&i) => Ok(Sql::Integer(i)),
            Some(i) => Err(format!("integer out of safe range: {i}")),
            None => n.as_f64().map(Sql::Real).ok_or_else(|| format!("bad number: {n}")),
        },
        other => Err(format!("unsupported parameter: {other}")),
    }
}

fn to_json(v: ValueRef) -> Result<Json, String> {
    match v {
        ValueRef::Null => Ok(Json::Null),
        ValueRef::Integer(i) if (-MAX_SAFE..=MAX_SAFE).contains(&i) => Ok(Json::from(i)),
        ValueRef::Integer(i) => Err(format!("integer out of safe range: {i}")),
        ValueRef::Real(f) => Ok(Json::from(f)),
        ValueRef::Text(t) => Ok(Json::from(String::from_utf8_lossy(t))),
        ValueRef::Blob(_) => Err("blob columns are not supported".into()),
    }
}

fn bind(list: &[Json]) -> Result<Vec<Sql>, String> {
    list.iter().map(to_sql).collect()
}

#[tauri::command]
pub fn db_query(db: tauri::State<Db>, sql: String, params: Vec<Json>) -> Result<QueryResult, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let columns: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();
    let n = columns.len();
    let mut rows = stmt
        .query(params_from_iter(bind(&params)?))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut r = Vec::with_capacity(n);
        for i in 0..n {
            r.push(to_json(row.get_ref(i).map_err(|e| e.to_string())?)?);
        }
        out.push(r);
    }
    Ok(QueryResult { columns, rows: out })
}

/// All statements in one transaction. A statement without params may hold several
/// statements (migrations). Any error rolls back all (the transaction drops uncommitted).
#[tauri::command]
pub fn db_batch(db: tauri::State<Db>, statements: Vec<Statement>) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for s in &statements {
        let p = bind(&s.params)?;
        if p.is_empty() {
            tx.execute_batch(&s.sql)
        } else {
            tx.prepare_cached(&s.sql).and_then(|mut st| st.execute(params_from_iter(p)).map(|_| ()))
        }
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}
