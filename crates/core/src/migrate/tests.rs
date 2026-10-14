//! The migration framework: every file applied once, the schema version recorded, newer and foreign databases refused.

use super::*;

fn version(conn: &Connection) -> u32 {
    conn.query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap()
}

#[test]
fn migrate_applies_every_file_once_and_sets_user_version() {
    // Arrange
    let mut conn = Connection::open_in_memory().unwrap();
    // Act
    migrate(&mut conn).unwrap();
    migrate(&mut conn).unwrap();
    // Assert
    assert_eq!(version(&conn), SCHEMA_VERSION);
    let tables: u32 = conn
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = 'revision'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(tables, 1);
}

#[test]
fn migrate_refuses_a_database_newer_than_the_app() {
    // Arrange
    let mut conn = Connection::open_in_memory().unwrap();
    conn.pragma_update(None, "user_version", SCHEMA_VERSION + 1)
        .unwrap();
    // Act
    let result = migrate(&mut conn);
    // Assert
    assert!(matches!(result, Err(Error::NewerDatabase { .. })));
}

#[test]
fn migrate_refuses_a_foreign_database_without_a_schema_version() {
    // Arrange
    let mut conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("CREATE TABLE notes (id INTEGER)")
        .unwrap();
    // Act
    let result = migrate(&mut conn);
    // Assert
    assert!(matches!(result, Err(Error::ForeignDatabase)));
}
