//! The store: one SQLite file, revisions as truth, the projection rebuilt in the same transaction.

use crate::error::{Error, Result};
use crate::ids::{new_id, Id};
use crate::migrate::{migrate, SCHEMA_VERSION};
use crate::{projection, RULES_VERSION};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use std::path::Path;

/// The kinds of documents that have revisions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum DocKind {
    Commodity,
    Account,
    Entry,
}

impl DocKind {
    /// Every kind, in the order a full rebuild replays them.
    pub const ALL: [DocKind; 3] = [DocKind::Commodity, DocKind::Account, DocKind::Entry];

    /// The kind with this stored name, or `None` for a name this build does not know.
    pub fn from_name(name: &str) -> Option<DocKind> {
        DocKind::ALL.into_iter().find(|kind| kind.as_str() == name)
    }

    /// The name stored in the `revision` table.
    pub fn as_str(self) -> &'static str {
        match self {
            DocKind::Commodity => "commodity",
            DocKind::Account => "account",
            DocKind::Entry => "entry",
        }
    }
}

/// A local revision to write. `body` is JSON until the canonical encoding is frozen (ADR-0012).
/// `parent_id` must be the current head of the document, or `None` for its first revision.
#[derive(Debug, Clone)]
pub struct NewRevision {
    pub doc_kind: DocKind,
    pub doc_id: Id,
    pub parent_id: Option<Id>,
    pub author_id: Id,
    pub created_at_ms: i64,
    pub body: String,
}

/// A revision that arrives from elsewhere (sync): it keeps its id and may fork a document.
#[derive(Debug, Clone)]
pub struct ImportedRevision {
    pub id: Id,
    pub server_seq: Option<i64>,
    pub revision: NewRevision,
}

/// A stored revision, as read back.
#[derive(Debug, Clone)]
pub struct RevisionRecord {
    pub id: Id,
    pub doc_kind: DocKind,
    pub doc_id: Id,
    pub parent_id: Option<Id>,
    pub author_id: Id,
    pub created_at_ms: i64,
    pub body: String,
}

/// One ledger file: revisions, the projection and its verification.
pub struct Store {
    conn: Connection,
}

impl Store {
    /// Opens (and migrates) a ledger file: WAL, foreign keys on, full synchronous writes.
    pub fn open(path: &Path) -> Result<Store> {
        Self::prepare(Connection::open(path)?, true)
    }

    /// Opens a private in-memory ledger (tests and tools).
    pub fn open_in_memory() -> Result<Store> {
        Self::prepare(Connection::open_in_memory()?, false)
    }

    fn prepare(mut conn: Connection, file: bool) -> Result<Store> {
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        conn.pragma_update(None, "foreign_keys", true)?;
        let foreign_keys: i64 = conn.query_row("PRAGMA foreign_keys", [], |row| row.get(0))?;
        if foreign_keys != 1 {
            return Err(Error::Internal("foreign keys could not be enabled"));
        }
        if file {
            let mode = conn.pragma_update_and_check(None, "journal_mode", "WAL", |row| {
                row.get::<_, String>(0)
            })?;
            if !mode.eq_ignore_ascii_case("wal") {
                return Err(Error::Internal("the file system does not support WAL mode"));
            }
            conn.pragma_update(None, "synchronous", "FULL")?;
        }
        migrate(&mut conn)?;
        Ok(Store { conn })
    }

    /// Writes one local revision and rebuilds the projection of its document, in one transaction.
    pub fn write_revision(&mut self, rev: NewRevision) -> Result<Id> {
        let mut ids = self.write_revisions(vec![rev])?;
        ids.pop().ok_or(Error::Internal("no revision was written"))
    }

    /// Writes local revisions in one transaction: all or nothing. Each must continue the current head of its document.
    pub fn write_revisions(&mut self, revs: Vec<NewRevision>) -> Result<Vec<Id>> {
        let batch = revs
            .into_iter()
            .map(|revision| (new_id(), None, revision, true))
            .collect();
        self.insert_all(batch)
    }

    /// Stores revisions that arrive from elsewhere, keeping their ids. A document may fork; the head follows server order.
    pub fn import_revisions(&mut self, revs: Vec<ImportedRevision>) -> Result<Vec<Id>> {
        let batch = revs
            .into_iter()
            .map(|r| (r.id, r.server_seq, r.revision, false))
            .collect();
        self.insert_all(batch)
    }

    fn insert_all(&mut self, batch: Vec<(Id, Option<i64>, NewRevision, bool)>) -> Result<Vec<Id>> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let mut ids = Vec::with_capacity(batch.len());
        {
            let mut insert = tx.prepare_cached(
                "INSERT INTO revision (id, doc_kind, doc_id, parent_id, author_id, created_at_ms, rules_version, schema_version, core_version, server_seq, body)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            )?;
            for (id, server_seq, rev, strict) in batch {
                if strict {
                    let head = projection::head(&tx, rev.doc_id)?.map(|(head_id, _)| head_id);
                    if head != rev.parent_id {
                        return Err(Error::Conflict { doc_id: rev.doc_id });
                    }
                }
                insert.execute(params![
                    id,
                    rev.doc_kind.as_str(),
                    rev.doc_id,
                    rev.parent_id,
                    rev.author_id,
                    rev.created_at_ms,
                    RULES_VERSION,
                    SCHEMA_VERSION,
                    env!("CARGO_PKG_VERSION"),
                    server_seq,
                    rev.body
                ])?;
                projection::rebuild(&tx, rev.doc_kind, rev.doc_id, false)?;
                ids.push(id);
            }
        }
        tx.commit()?;
        Ok(ids)
    }

    /// Records the order the server gave a revision (allowed once) and re-projects its document, because the head may change.
    pub fn set_server_seq(&mut self, revision_id: Id, server_seq: i64) -> Result<()> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let (kind, doc_id): (String, Id) = tx
            .query_row(
                "SELECT doc_kind, doc_id FROM revision WHERE id = ?1",
                params![revision_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?
            .ok_or_else(|| Error::MissingReference {
                kind: "revision",
                what: revision_id.to_string(),
            })?;
        tx.execute(
            "UPDATE revision SET server_seq = ?2 WHERE id = ?1",
            params![revision_id, server_seq],
        )?;
        let kind = DocKind::from_name(&kind).ok_or(Error::Internal(
            "a revision has a document kind this build does not know",
        ))?;
        projection::rebuild(&tx, kind, doc_id, false)?;
        tx.commit()?;
        Ok(())
    }

    /// The head revision of a document: among the leaves, the earliest by server order, then local time.
    pub fn current_revision(&self, doc_id: Id) -> Result<Option<Id>> {
        Ok(projection::head(&self.conn, doc_id)?.map(|(id, _)| id))
    }

    /// One revision by id.
    pub fn revision(&self, revision_id: Id) -> Result<Option<RevisionRecord>> {
        self.query_revisions("WHERE id = ?1", revision_id)
            .map(|mut found| found.pop())
    }

    /// Every revision of a document in the order it was stored, branches included.
    pub fn history(&self, doc_id: Id) -> Result<Vec<RevisionRecord>> {
        self.query_revisions("WHERE doc_id = ?1 ORDER BY seq", doc_id)
    }

    fn query_revisions(&self, filter: &str, key: Id) -> Result<Vec<RevisionRecord>> {
        let sql = format!(
            "SELECT id, doc_kind, doc_id, parent_id, author_id, created_at_ms, body FROM revision {filter}"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params![key], |row| {
            Ok((
                row.get::<_, Id>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Id>(2)?,
                row.get::<_, Option<Id>>(3)?,
                row.get::<_, Id>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, String>(6)?,
            ))
        })?;
        rows.map(|row| {
            let (id, kind, doc_id, parent_id, author_id, created_at_ms, body) = row?;
            let doc_kind = DocKind::from_name(&kind).ok_or(Error::Internal(
                "a revision has a document kind this build does not know",
            ))?;
            Ok(RevisionRecord {
                id,
                doc_kind,
                doc_id,
                parent_id,
                author_id,
                created_at_ms,
                body,
            })
        })
        .collect()
    }

    /// The conflict branches of a document: leaves that are not its head.
    pub fn conflicts(&self, doc_id: Id) -> Result<Vec<Id>> {
        projection::conflicts(&self.conn, doc_id)
    }

    /// Lists documents whose projection disagrees with what the revisions say (ADR-0012).
    pub fn verify_projection(&self) -> Result<Vec<crate::Drift>> {
        projection::verify(&self.conn)
    }

    /// Empties the projection and rebuilds all of it from the revisions.
    pub fn rebuild_projection(&mut self) -> Result<()> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        projection::rebuild_all(&tx)?;
        tx.commit()?;
        Ok(())
    }

    /// Test support: the raw connection, for tests that must break rules on purpose.
    #[cfg(feature = "test-support")]
    pub fn raw_connection(&self) -> &Connection {
        &self.conn
    }

    /// Test support: runs SQL with the projection session open, as a faulty writer would.
    #[cfg(feature = "test-support")]
    pub fn tamper(&self, sql: &str) -> Result<()> {
        self.conn
            .execute("UPDATE projection_session SET open = 1", [])?;
        let result = self.conn.execute(sql, []);
        self.conn
            .execute("UPDATE projection_session SET open = 0, carry = 0", [])?;
        result?;
        Ok(())
    }
}
