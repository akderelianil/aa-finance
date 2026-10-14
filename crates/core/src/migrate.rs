//! Migrations: numbered SQL files applied in order, tracked by `PRAGMA user_version` (ADR-0008).
//! An applied migration is never edited once the first release exists; a new file is added.

use crate::error::{Error, Result};
use rusqlite::{Connection, TransactionBehavior};

pub(crate) const MIGRATIONS: &[&str] = &[include_str!("sql/0001_schema_v1.sql")];

/// Stored in the file header ("AAFI") so another application's SQLite file is not mistaken for a ledger.
const APPLICATION_ID: i64 = 0x4141_4649;

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
    } else {
        let application: i64 = tx.query_row("PRAGMA application_id", [], |row| row.get(0))?;
        if application != APPLICATION_ID {
            return Err(Error::ForeignDatabase);
        }
    }
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(found as usize) {
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", index as u32 + 1)?;
    }
    if found == 0 {
        tx.pragma_update(None, "application_id", APPLICATION_ID)?;
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests;
