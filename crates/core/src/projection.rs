//! The projection: the current state rebuilt from revisions, and its verification (ADR-0012).
//! Only this module opens `projection_session`; triggers refuse any other writer. The gate stops faulty
//! writers, not hostile ones: anyone holding the raw connection can open it.

use crate::body::{AccountBody, CommodityBody, EntryBody, EntryStatus, LineBody};
use crate::error::{Error, Result, RuleCode};
use crate::ids::{DocId, RevisionId};
use crate::store::DocKind;
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::{BTreeMap, HashMap};

/// Leaves of a document ordered so that the head comes first: server order, then local time, then arrival.
const HEAD_ORDER: &str = "r.server_seq IS NULL, r.server_seq, r.created_at_ms, r.seq";
const MAX_PARENT_DEPTH: usize = 10_000;

/// Why a document counts as drifted. A stable code, so the UI can translate it and a repair can match on it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[non_exhaustive]
pub enum DriftReason {
    /// The projection has no row for the document, or its row points at a revision that is not the head.
    NotAtHead,
    /// The projection has a row for which no revision of that kind exists.
    OrphanRow,
    /// The row (or its lines) differs from what the head revision says.
    DiffersFromRevision,
    /// A posted entry has fewer than two lines or does not sum to zero on base value.
    PostedInvariantBroken,
}

impl DriftReason {
    /// The code as a string, for logs and for the UI to translate.
    pub fn as_str(self) -> &'static str {
        match self {
            DriftReason::NotAtHead => "not_at_head",
            DriftReason::OrphanRow => "orphan_row",
            DriftReason::DiffersFromRevision => "differs_from_revision",
            DriftReason::PostedInvariantBroken => "posted_invariant_broken",
        }
    }
}

/// A document whose projection disagrees with what its revisions say.
#[derive(Debug, Clone, PartialEq, Eq)]
#[non_exhaustive]
pub struct Drift {
    pub doc_kind: DocKind,
    pub doc_id: DocId,
    pub reason: DriftReason,
}

type Found = BTreeMap<(DocKind, DocId), DriftReason>;

pub(crate) fn head(conn: &Connection, doc_id: DocId) -> Result<Option<(RevisionId, String)>> {
    let sql = format!(
        "SELECT r.id, r.body FROM revision r WHERE r.doc_id = ?1
         AND NOT EXISTS (SELECT 1 FROM revision c WHERE c.parent_id = r.id)
         ORDER BY {HEAD_ORDER} LIMIT 1"
    );
    Ok(conn
        .query_row(&sql, params![doc_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .optional()?)
}

/// The leaves of a document that are not its head: revisions kept as conflict branches.
pub(crate) fn conflicts(conn: &Connection, doc_id: DocId) -> Result<Vec<RevisionId>> {
    let sql = format!(
        "SELECT r.id FROM revision r WHERE r.doc_id = ?1
         AND NOT EXISTS (SELECT 1 FROM revision c WHERE c.parent_id = r.id)
         ORDER BY {HEAD_ORDER} LIMIT -1 OFFSET 1"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![doc_id], |row| row.get::<_, RevisionId>(0))?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn commodity_id(conn: &Connection, uuid: DocId) -> Result<i64> {
    conn.query_row(
        "SELECT id FROM commodity WHERE uuid = ?1",
        params![uuid],
        |row| row.get(0),
    )
    .optional()?
    .ok_or_else(|| Error::MissingReference {
        kind: "commodity",
        what: uuid.to_string(),
    })
}

fn account_id(conn: &Connection, uuid: DocId) -> Result<i64> {
    conn.query_row(
        "SELECT id FROM account WHERE uuid = ?1",
        params![uuid],
        |row| row.get(0),
    )
    .optional()?
    .ok_or_else(|| Error::MissingReference {
        kind: "account",
        what: uuid.to_string(),
    })
}

/// Opens the projection session for the duration of `work` and restores the previous state afterwards.
fn with_session<T>(conn: &Connection, carry: bool, work: impl FnOnce() -> Result<T>) -> Result<T> {
    let (was_open, was_carry): (i64, i64) =
        conn.query_row("SELECT open, carry FROM projection_session", [], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?;
    conn.execute(
        "UPDATE projection_session SET open = 1, carry = ?1",
        params![carry],
    )?;
    let result = work();
    conn.execute(
        "UPDATE projection_session SET open = ?1, carry = ?2",
        params![was_open, was_carry],
    )?;
    result
}

/// Rebuilds the projection of one document from its head revision, inside the caller's transaction.
/// `carry_all` allows lines on archived accounts (a full rebuild replays history).
pub(crate) fn rebuild(
    conn: &Connection,
    kind: DocKind,
    doc_id: DocId,
    carry_all: bool,
) -> Result<()> {
    let Some((revision_id, body)) = head(conn, doc_id)? else {
        return Err(Error::Internal("rebuild of a document without revisions"));
    };
    with_session(conn, false, || match kind {
        DocKind::Commodity => write_commodity(conn, doc_id, revision_id, &body),
        DocKind::Account => write_account(conn, doc_id, revision_id, &body),
        DocKind::Entry => write_entry(conn, doc_id, revision_id, &body, carry_all),
    })
}

/// Empties the projection and rebuilds all of it from the revisions: commodities, then accounts (parents first), then entries.
pub(crate) fn rebuild_all(conn: &Connection) -> Result<()> {
    with_session(conn, true, || {
        conn.execute_batch("UPDATE entry SET status = 'draft'; DELETE FROM line; DELETE FROM entry; UPDATE account SET parent_id = NULL; DELETE FROM account; DELETE FROM commodity;")?;
        Ok(())
    })?;
    for kind in [DocKind::Commodity, DocKind::Account, DocKind::Entry] {
        let mut pending = docs_of(conn, kind)?;
        while !pending.is_empty() {
            let before = pending.len();
            let mut retry = Vec::new();
            let mut last_missing = None;
            for doc in pending {
                match rebuild(conn, kind, doc, true) {
                    Ok(()) => {}
                    Err(missing @ Error::MissingReference { .. }) if kind == DocKind::Account => {
                        retry.push(doc);
                        last_missing = Some(missing);
                    }
                    Err(other) => return Err(other),
                }
            }
            // Every document that failed on a missing parent left one error behind, so a pass that
            // retries all of them made no progress and that error is the reason.
            if let Some(missing) = last_missing.filter(|_| retry.len() == before) {
                return Err(missing);
            }
            pending = retry;
        }
    }
    Ok(())
}

fn docs_of(conn: &Connection, kind: DocKind) -> Result<Vec<DocId>> {
    let mut stmt = conn.prepare(
        "SELECT doc_id FROM revision WHERE doc_kind = ?1 GROUP BY doc_id ORDER BY min(seq)",
    )?;
    let rows = stmt.query_map(params![kind.as_str()], |row| row.get::<_, DocId>(0))?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn write_commodity(
    conn: &Connection,
    doc_id: DocId,
    revision_id: RevisionId,
    body: &str,
) -> Result<()> {
    let b: CommodityBody = serde_json::from_str(body)?;
    conn.execute(
        "INSERT INTO commodity (uuid, current_revision_id, code, scale) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (uuid) DO UPDATE SET current_revision_id = excluded.current_revision_id, code = excluded.code, scale = excluded.scale",
        params![doc_id, revision_id, b.code, b.scale],
    )?;
    Ok(())
}

fn assert_no_parent_cycle(conn: &Connection, doc_id: DocId, parent: Option<DocId>) -> Result<()> {
    let mut current = parent;
    for _ in 0..MAX_PARENT_DEPTH {
        let Some(id) = current else { return Ok(()) };
        if id == doc_id {
            return Err(Error::Rule(RuleCode::AccountParentCycle));
        }
        current = conn
            .query_row(
                "SELECT p.uuid FROM account a LEFT JOIN account p ON p.id = a.parent_id WHERE a.uuid = ?1",
                params![id],
                |row| row.get::<_, Option<DocId>>(0),
            )
            .optional()?
            .flatten();
    }
    Err(Error::Rule(RuleCode::AccountParentCycle))
}

fn write_account(
    conn: &Connection,
    doc_id: DocId,
    revision_id: RevisionId,
    body: &str,
) -> Result<()> {
    let b: AccountBody = serde_json::from_str(body)?;
    let commodity = commodity_id(conn, b.commodity)?;
    assert_no_parent_cycle(conn, doc_id, b.parent)?;
    let parent = b.parent.map(|p| account_id(conn, p)).transpose()?;
    conn.execute(
        "INSERT INTO account (uuid, current_revision_id, name, parent_id, kind, commodity_id, archived) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (uuid) DO UPDATE SET current_revision_id = excluded.current_revision_id, name = excluded.name,
           parent_id = excluded.parent_id, kind = excluded.kind, commodity_id = excluded.commodity_id, archived = excluded.archived",
        params![doc_id, revision_id, b.name, parent, b.kind.as_str(), commodity, b.archived],
    )?;
    Ok(())
}

type StoredLine = (i64, i64, i64, i64);

/// Uses up one carried-over copy of `line`, if the previous head had one left.
fn take_carried(previous: &mut HashMap<StoredLine, usize>, line: StoredLine) -> bool {
    match previous.get_mut(&line) {
        Some(left) if *left > 0 => {
            *left -= 1;
            true
        }
        _ => false,
    }
}

fn write_entry(
    conn: &Connection,
    doc_id: DocId,
    revision_id: RevisionId,
    body: &str,
    carry_all: bool,
) -> Result<()> {
    let b: EntryBody = serde_json::from_str(body)?;
    conn.execute(
        "INSERT INTO entry (uuid, current_revision_id, date, memo, no, status) VALUES (?1, ?2, ?3, ?4, ?5, 'draft')
         ON CONFLICT (uuid) DO UPDATE SET current_revision_id = excluded.current_revision_id, date = excluded.date,
           memo = excluded.memo, no = excluded.no, status = 'draft'",
        params![doc_id, revision_id, b.date, b.memo, b.no],
    )?;
    let entry_id: i64 = conn.query_row(
        "SELECT id FROM entry WHERE uuid = ?1",
        params![doc_id],
        |row| row.get(0),
    )?;
    // A multiset: a line carried over counts once, so a duplicate of it is a new use.
    let mut previous: HashMap<StoredLine, usize> = HashMap::new();
    {
        let mut stmt = conn.prepare_cached(
            "SELECT account_id, commodity_id, quantity, base_value FROM line WHERE entry_id = ?1",
        )?;
        let rows = stmt.query_map(params![entry_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })?;
        for line in rows {
            *previous.entry(line?).or_insert(0) += 1;
        }
    }
    conn.execute("DELETE FROM line WHERE entry_id = ?1", params![entry_id])?;
    let mut insert = conn.prepare_cached(
        "INSERT INTO line (entry_id, line_no, account_id, commodity_id, quantity, base_value) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )?;
    let mut carrying = false;
    for (line_no, line) in b.lines.iter().enumerate() {
        let account = account_id(conn, line.account)?;
        let commodity = commodity_id(conn, line.commodity)?;
        let carried = carry_all
            || take_carried(
                &mut previous,
                (account, commodity, line.quantity, line.base_value),
            );
        if carried != carrying {
            conn.execute("UPDATE projection_session SET carry = ?1", params![carried])?;
            carrying = carried;
        }
        insert.execute(params![
            entry_id,
            line_no as i64,
            account,
            commodity,
            line.quantity,
            line.base_value
        ])?;
    }
    if b.status == EntryStatus::Posted {
        conn.execute(
            "UPDATE entry SET status = ?2 WHERE id = ?1",
            params![entry_id, b.status.as_str()],
        )?;
    }
    Ok(())
}

/// Compares the projection with what the head revisions say. Returns one drift per damaged document.
pub(crate) fn verify(conn: &Connection) -> Result<Vec<Drift>> {
    // One read transaction, so a writer that commits in between cannot show drift that is not there.
    let tx = conn.unchecked_transaction()?;
    let conn = &*tx;
    let mut found: Found = BTreeMap::new();
    for (kind, table) in [
        (DocKind::Commodity, "commodity"),
        (DocKind::Account, "account"),
        (DocKind::Entry, "entry"),
    ] {
        check_pointers(conn, kind, table, &mut found)?;
    }
    check_commodities(conn, &mut found)?;
    check_accounts(conn, &mut found)?;
    check_entries(conn, &mut found)?;
    Ok(found
        .into_iter()
        .map(|((doc_kind, doc_id), reason)| Drift {
            doc_kind,
            doc_id,
            reason,
        })
        .collect())
}

fn note(found: &mut Found, kind: DocKind, doc: DocId, reason: DriftReason) {
    found.entry((kind, doc)).or_insert(reason);
}

fn check_pointers(conn: &Connection, kind: DocKind, table: &str, found: &mut Found) -> Result<()> {
    let missing = format!(
        "WITH leaf AS (
           SELECT r.doc_id, r.id, ROW_NUMBER() OVER (PARTITION BY r.doc_id ORDER BY {HEAD_ORDER}) AS rn
           FROM revision r WHERE r.doc_kind = ?1 AND NOT EXISTS (SELECT 1 FROM revision c WHERE c.parent_id = r.id))
         SELECT l.doc_id FROM leaf l LEFT JOIN {table} p ON p.uuid = l.doc_id
         WHERE l.rn = 1 AND (p.uuid IS NULL OR p.current_revision_id IS NOT l.id)"
    );
    for doc in query_ids(conn, &missing, kind.as_str())? {
        note(found, kind, doc, DriftReason::NotAtHead);
    }
    let orphans = format!("SELECT p.uuid FROM {table} p WHERE NOT EXISTS (SELECT 1 FROM revision r WHERE r.doc_id = p.uuid AND r.doc_kind = ?1)");
    for doc in query_ids(conn, &orphans, kind.as_str())? {
        note(found, kind, doc, DriftReason::OrphanRow);
    }
    Ok(())
}

fn query_ids(conn: &Connection, sql: &str, kind: &str) -> Result<Vec<DocId>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params![kind], |row| row.get::<_, DocId>(0))?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn check_commodities(conn: &Connection, found: &mut Found) -> Result<()> {
    let mut stmt = conn.prepare("SELECT c.uuid, c.code, c.scale, r.body FROM commodity c JOIN revision r ON r.id = c.current_revision_id")?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, DocId>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, String>(3)?,
        ))
    })?;
    for row in rows {
        let (uuid, code, scale, body) = row?;
        match serde_json::from_str::<CommodityBody>(&body) {
            Ok(b) if b.code == code && b.scale == scale => {}
            _ => note(
                found,
                DocKind::Commodity,
                uuid,
                DriftReason::DiffersFromRevision,
            ),
        }
    }
    Ok(())
}

fn check_accounts(conn: &Connection, found: &mut Found) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT a.uuid, a.name, a.kind, a.archived, c.uuid, p.uuid, r.body
         FROM account a JOIN commodity c ON c.id = a.commodity_id LEFT JOIN account p ON p.id = a.parent_id
         JOIN revision r ON r.id = a.current_revision_id",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, DocId>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, bool>(3)?,
            row.get::<_, DocId>(4)?,
            row.get::<_, Option<DocId>>(5)?,
            row.get::<_, String>(6)?,
        ))
    })?;
    for row in rows {
        let (uuid, name, kind, archived, commodity, parent, body) = row?;
        match serde_json::from_str::<AccountBody>(&body) {
            Ok(b)
                if b.name == name
                    && b.kind.as_str() == kind
                    && b.archived == archived
                    && b.commodity == commodity
                    && b.parent == parent => {}
            _ => note(
                found,
                DocKind::Account,
                uuid,
                DriftReason::DiffersFromRevision,
            ),
        }
    }
    Ok(())
}

fn check_entries(conn: &Connection, found: &mut Found) -> Result<()> {
    let mut entries = conn.prepare(
        "SELECT e.id, e.uuid, e.date, e.memo, e.no, e.status, r.body FROM entry e JOIN revision r ON r.id = e.current_revision_id",
    )?;
    let mut lines = conn.prepare(
        "SELECT l.line_no, a.uuid, c.uuid, l.quantity, l.base_value FROM line l JOIN account a ON a.id = l.account_id
         JOIN commodity c ON c.id = l.commodity_id WHERE l.entry_id = ?1 ORDER BY l.line_no",
    )?;
    let rows = entries.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, DocId>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
        ))
    })?;
    for row in rows {
        let (entry_id, uuid, date, memo, no, status, body) = row?;
        let stored = lines
            .query_map(params![entry_id], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    LineBody {
                        account: r.get(1)?,
                        commodity: r.get(2)?,
                        quantity: r.get(3)?,
                        base_value: r.get(4)?,
                    },
                ))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        let numbered = stored
            .iter()
            .enumerate()
            .all(|(i, (no, _))| *no == i as i64);
        let actual: Vec<LineBody> = stored.into_iter().map(|(_, line)| line).collect();
        let sum: i128 = actual.iter().map(|l| i128::from(l.base_value)).sum();
        match serde_json::from_str::<EntryBody>(&body) {
            Ok(b)
                if b.date == date
                    && b.memo == memo
                    && b.no == no
                    && b.status.as_str() == status
                    && b.lines == actual
                    && numbered =>
            {
                if status == "posted" && (actual.len() < 2 || sum != 0) {
                    note(
                        found,
                        DocKind::Entry,
                        uuid,
                        DriftReason::PostedInvariantBroken,
                    );
                }
            }
            _ => note(
                found,
                DocKind::Entry,
                uuid,
                DriftReason::DiffersFromRevision,
            ),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests;
