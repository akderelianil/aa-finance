//! The projection: the current state rebuilt from revisions, and its verification (ADR-0012).
//! Only this module opens `projection_session`; triggers refuse any other writer. The gate stops faulty
//! writers, not hostile ones: anyone holding the raw connection can open it.

use crate::error::{Error, Result, RuleCode};
use crate::ids::Id;
use crate::store::DocKind;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};

/// Leaves of a document ordered so that the head comes first: server order, then local time, then arrival.
const HEAD_ORDER: &str = "r.server_seq IS NULL, r.server_seq, r.created_at_ms, r.seq";
const MAX_PARENT_DEPTH: usize = 10_000;

/// A document whose projection disagrees with what its revisions say.
#[derive(Debug, Clone, PartialEq, Eq)]
#[non_exhaustive]
pub struct Drift {
    pub doc_kind: DocKind,
    pub doc_id: Id,
    pub reason: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CommodityBody {
    code: String,
    scale: i64,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
enum AccountKind {
    Asset,
    Liability,
    Equity,
    Income,
    Expense,
}

impl AccountKind {
    fn as_str(self) -> &'static str {
        match self {
            AccountKind::Asset => "asset",
            AccountKind::Liability => "liability",
            AccountKind::Equity => "equity",
            AccountKind::Income => "income",
            AccountKind::Expense => "expense",
        }
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AccountBody {
    name: String,
    parent: Option<Id>,
    kind: AccountKind,
    commodity: Id,
    archived: bool,
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
enum EntryStatus {
    Draft,
    Posted,
}

impl EntryStatus {
    fn as_str(self) -> &'static str {
        match self {
            EntryStatus::Draft => "draft",
            EntryStatus::Posted => "posted",
        }
    }
}

#[derive(Deserialize, PartialEq, Eq, Debug)]
#[serde(deny_unknown_fields)]
struct LineBody {
    account: Id,
    commodity: Id,
    quantity: i64,
    base_value: i64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EntryBody {
    date: String,
    memo: Option<String>,
    no: Option<String>,
    status: EntryStatus,
    lines: Vec<LineBody>,
}

pub(crate) fn head(conn: &Connection, doc_id: Id) -> Result<Option<(Id, String)>> {
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
pub(crate) fn conflicts(conn: &Connection, doc_id: Id) -> Result<Vec<Id>> {
    let sql = format!(
        "SELECT r.id FROM revision r WHERE r.doc_id = ?1
         AND NOT EXISTS (SELECT 1 FROM revision c WHERE c.parent_id = r.id)
         ORDER BY {HEAD_ORDER} LIMIT -1 OFFSET 1"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![doc_id], |row| row.get::<_, Id>(0))?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn commodity_id(conn: &Connection, uuid: Id) -> Result<i64> {
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

fn account_id(conn: &Connection, uuid: Id) -> Result<i64> {
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
pub(crate) fn rebuild(conn: &Connection, kind: DocKind, doc_id: Id, carry_all: bool) -> Result<()> {
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
            if retry.len() == before {
                return Err(last_missing.unwrap_or(Error::Internal("rebuild made no progress")));
            }
            pending = retry;
        }
    }
    Ok(())
}

fn docs_of(conn: &Connection, kind: DocKind) -> Result<Vec<Id>> {
    let mut stmt = conn.prepare(
        "SELECT doc_id FROM revision WHERE doc_kind = ?1 GROUP BY doc_id ORDER BY min(seq)",
    )?;
    let rows = stmt.query_map(params![kind.as_str()], |row| row.get::<_, Id>(0))?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn write_commodity(conn: &Connection, doc_id: Id, revision_id: Id, body: &str) -> Result<()> {
    let b: CommodityBody = serde_json::from_str(body)?;
    conn.execute(
        "INSERT INTO commodity (uuid, current_revision_id, code, scale) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (uuid) DO UPDATE SET current_revision_id = excluded.current_revision_id, code = excluded.code, scale = excluded.scale",
        params![doc_id, revision_id, b.code, b.scale],
    )?;
    Ok(())
}

fn assert_no_parent_cycle(conn: &Connection, doc_id: Id, parent: Option<Id>) -> Result<()> {
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
                |row| row.get::<_, Option<Id>>(0),
            )
            .optional()?
            .flatten();
    }
    Err(Error::Rule(RuleCode::AccountParentCycle))
}

fn write_account(conn: &Connection, doc_id: Id, revision_id: Id, body: &str) -> Result<()> {
    let b: AccountBody = serde_json::from_str(body)?;
    let commodity = commodity_id(conn, b.commodity)?;
    let parent = b.parent.map(|p| account_id(conn, p)).transpose()?;
    assert_no_parent_cycle(conn, doc_id, b.parent)?;
    conn.execute(
        "INSERT INTO account (uuid, current_revision_id, name, parent_id, kind, commodity_id, archived) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (uuid) DO UPDATE SET current_revision_id = excluded.current_revision_id, name = excluded.name,
           parent_id = excluded.parent_id, kind = excluded.kind, commodity_id = excluded.commodity_id, archived = excluded.archived",
        params![doc_id, revision_id, b.name, parent, b.kind.as_str(), commodity, b.archived],
    )?;
    Ok(())
}

type StoredLine = (i64, i64, i64, i64);

fn write_entry(
    conn: &Connection,
    doc_id: Id,
    revision_id: Id,
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
    let previous: HashSet<StoredLine> = {
        let mut stmt = conn.prepare_cached(
            "SELECT account_id, commodity_id, quantity, base_value FROM line WHERE entry_id = ?1",
        )?;
        let rows = stmt.query_map(params![entry_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })?;
        rows.collect::<std::result::Result<_, _>>()?
    };
    conn.execute("DELETE FROM line WHERE entry_id = ?1", params![entry_id])?;
    let mut insert = conn.prepare_cached(
        "INSERT INTO line (entry_id, line_no, account_id, commodity_id, quantity, base_value) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )?;
    let mut carrying = false;
    for (line_no, line) in b.lines.iter().enumerate() {
        let account = account_id(conn, line.account)?;
        let commodity = commodity_id(conn, line.commodity)?;
        let carried =
            carry_all || previous.contains(&(account, commodity, line.quantity, line.base_value));
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
    let mut found: BTreeMap<(DocKind, Id), String> = BTreeMap::new();
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

fn note(found: &mut BTreeMap<(DocKind, Id), String>, kind: DocKind, doc: Id, reason: &str) {
    found
        .entry((kind, doc))
        .or_insert_with(|| reason.to_string());
}

fn check_pointers(
    conn: &Connection,
    kind: DocKind,
    table: &str,
    found: &mut BTreeMap<(DocKind, Id), String>,
) -> Result<()> {
    let missing = format!(
        "WITH leaf AS (
           SELECT r.doc_id, r.id, ROW_NUMBER() OVER (PARTITION BY r.doc_id ORDER BY {HEAD_ORDER}) AS rn
           FROM revision r WHERE r.doc_kind = ?1 AND NOT EXISTS (SELECT 1 FROM revision c WHERE c.parent_id = r.id))
         SELECT l.doc_id FROM leaf l LEFT JOIN {table} p ON p.uuid = l.doc_id
         WHERE l.rn = 1 AND (p.uuid IS NULL OR p.current_revision_id IS NOT l.id)"
    );
    for doc in query_ids(conn, &missing, kind.as_str())? {
        note(
            found,
            kind,
            doc,
            "the projection does not point at the head revision",
        );
    }
    let orphans = format!("SELECT p.uuid FROM {table} p WHERE NOT EXISTS (SELECT 1 FROM revision r WHERE r.doc_id = p.uuid AND r.doc_kind = ?1)");
    for doc in query_ids(conn, &orphans, kind.as_str())? {
        note(
            found,
            kind,
            doc,
            "the projection has a row without a revision of its kind",
        );
    }
    Ok(())
}

fn query_ids(conn: &Connection, sql: &str, kind: &str) -> Result<Vec<Id>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params![kind], |row| row.get::<_, Id>(0))?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

fn check_commodities(conn: &Connection, found: &mut BTreeMap<(DocKind, Id), String>) -> Result<()> {
    let mut stmt = conn.prepare("SELECT c.uuid, c.code, c.scale, r.body FROM commodity c JOIN revision r ON r.id = c.current_revision_id")?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, Id>(0)?,
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
                "the commodity differs from its revision",
            ),
        }
    }
    Ok(())
}

fn check_accounts(conn: &Connection, found: &mut BTreeMap<(DocKind, Id), String>) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT a.uuid, a.name, a.kind, a.archived, c.uuid, p.uuid, r.body
         FROM account a JOIN commodity c ON c.id = a.commodity_id LEFT JOIN account p ON p.id = a.parent_id
         JOIN revision r ON r.id = a.current_revision_id",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, Id>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, bool>(3)?,
            row.get::<_, Id>(4)?,
            row.get::<_, Option<Id>>(5)?,
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
                "the account differs from its revision",
            ),
        }
    }
    Ok(())
}

fn check_entries(conn: &Connection, found: &mut BTreeMap<(DocKind, Id), String>) -> Result<()> {
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
            row.get::<_, Id>(1)?,
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
                        "a posted entry breaks its invariants",
                    );
                }
            }
            _ => note(
                found,
                DocKind::Entry,
                uuid,
                "the entry or its lines differ from its revision",
            ),
        }
    }
    Ok(())
}
