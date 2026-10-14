//! The ledger file: WAL and foreign keys, two connections writing one file, a file that is not ours, and a drive without WAL support.

use super::common::*;

#[test]
fn a_file_database_uses_wal_and_foreign_keys() {
    // Arrange
    let dir = TempDir::new();
    let path = dir.path().join("ledger.db");
    // Act
    let store = Store::open(&path).unwrap();
    // Assert
    let mode: String = store
        .raw_connection()
        .query_row("PRAGMA journal_mode", [], |r| r.get(0))
        .unwrap();
    let fk: i64 = store
        .raw_connection()
        .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
        .unwrap();
    assert_eq!(mode, "wal");
    assert_eq!(fk, 1);
    drop(store);
}

#[test]
fn two_connections_write_the_same_file_without_losing_a_revision() {
    // Arrange
    let dir = TempDir::new();
    let path = dir.path().join("ledger.db");
    drop(Store::open(&path).unwrap());
    let writer = |path: std::path::PathBuf| {
        std::thread::spawn(move || {
            let mut store = Store::open(&path).unwrap();
            for _ in 0..25 {
                let code = new_id().to_string();
                store
                    .write_revision(rev(
                        DocKind::Commodity,
                        new_id(),
                        None,
                        json!({"code": code, "scale": 2}),
                    ))
                    .unwrap();
            }
        })
    };
    // Act
    let (a, b) = (writer(path.clone()), writer(path.clone()));
    a.join().unwrap();
    b.join().unwrap();
    // Assert
    let store = Store::open(&path).unwrap();
    assert_eq!(count(&store, "SELECT count(*) FROM revision"), 50);
    assert!(store.verify_projection().unwrap().is_empty());
    drop(store);
}

#[test]
fn a_ledger_file_that_is_not_ours_is_refused_and_errors_read_in_plain_words() {
    // Arrange
    let dir = TempDir::new();
    let path = dir.path().join("other.db");
    write_foreign_file(&path);
    // Act
    let result = Store::open(&path);
    // Assert
    let err = result.err().unwrap();
    assert!(matches!(err, Error::ForeignDatabase));
    assert!(err.to_string().contains("not an aa-finance ledger"));
    assert!(Error::Rule(RuleCode::EntryUnbalanced)
        .to_string()
        .contains("entry_unbalanced"));
    assert!(Error::NewerDatabase {
        found: 9,
        supported: 1
    }
    .to_string()
    .contains("newer"));
    assert!(Error::Internal("x").to_string().contains("internal"));
    assert!(Error::MissingReference {
        kind: "account",
        what: "a".into()
    }
    .to_string()
    .contains("does not exist"));
    assert!(Error::Conflict { doc_id: new_id() }
        .to_string()
        .contains("conflict"));
}

/// Writes a small SQLite file that is not a ledger, as a foreign application would leave it.
fn write_foreign_file(path: &std::path::Path) {
    let conn = rusqlite::Connection::open(path).unwrap();
    conn.execute_batch("CREATE TABLE notes (id INTEGER)")
        .unwrap();
}

#[test]
fn an_in_memory_store_reports_journal_mode_memory() {
    // Arrange
    let w = world();
    // Act / Assert: an in-memory store reports journal mode memory, never WAL, and opens fine
    let mode: String = w
        .store
        .raw_connection()
        .query_row("PRAGMA journal_mode", [], |r| r.get(0))
        .unwrap();
    assert_eq!(mode, "memory");
}

#[test]
fn a_ledger_file_must_support_wal_or_it_is_refused() {
    // ":memory:" opens an in-memory database that cannot use WAL, like a drive that does not support it.
    let result = Store::open(std::path::Path::new(":memory:"));
    assert!(matches!(result, Err(Error::Internal(m)) if m.contains("WAL")));
}
