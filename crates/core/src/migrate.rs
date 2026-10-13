//! Migrations: numbered SQL files applied in order, tracked by `PRAGMA user_version` (ADR-0008).
//! An applied migration is never edited once the first release exists; a new file is added.

use crate::error::{Error, Result};
use rusqlite::{Connection, TransactionBehavior};

const MIGRATIONS: &[&str] = &[include_str!("sql/0001_schema_v1.sql")];

/// The schema version this build writes.
pub const SCHEMA_VERSION: u32 = MIGRATIONS.len() as u32;

/// Brings the database to the latest schema. A database from a newer app, or a foreign SQLite file, is refused.
pub fn migrate(conn: &mut Connection) -> Result<()> {
    // Immediate, and the version is read inside it, so two processes opening an old file cannot both migrate.
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let found: u32 = tx.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if found > SCHEMA_VERSION {
        return Err(Error::NewerDatabase {
            found,
            supported: SCHEMA_VERSION,
        });
    }
    if found == 0 {
        let objects: i64 =
            tx.query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get(0))?;
        if objects > 0 {
            return Err(Error::ForeignDatabase);
        }
    }
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(found as usize) {
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", index as u32 + 1)?;
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
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
}
