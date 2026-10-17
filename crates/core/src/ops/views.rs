//! What the operations hand back: plain data with amounts as canonical strings (ADR-0009).

use crate::body::{AccountBody, AccountKind};
use crate::ids::{DocId, Id, RevisionId};
use crate::{Restore, RevisionRecord};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct HistoryItem {
    pub revision_id: RevisionId,
    pub parent_id: Option<RevisionId>,
    pub author_id: Id,
    pub created_at_ms: i64,
    /// Set when this revision only brought an earlier version back (undo or redo).
    pub restore: Option<Restore>,
    /// The revision the document shows now.
    pub head: bool,
    /// On a branch that lost the race (written elsewhere) and is kept for the user to see
    /// (ADR-0012): not on the way from the head back to the first revision.
    pub conflict: bool,
}

impl HistoryItem {
    pub(crate) fn from_record(record: RevisionRecord, head: bool, conflict: bool) -> HistoryItem {
        HistoryItem {
            revision_id: record.id,
            parent_id: record.parent_id,
            author_id: record.author_id,
            created_at_ms: record.created_at_ms,
            restore: record.restore,
            head,
            conflict,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AccountView {
    pub name: String,
    pub parent: Option<DocId>,
    pub kind: AccountKind,
    pub commodity: DocId,
    pub archived: bool,
    pub locked: bool,
    pub system_key: Option<String>,
}

impl From<AccountBody> for AccountView {
    fn from(body: AccountBody) -> AccountView {
        AccountView {
            name: body.name,
            parent: body.parent,
            kind: body.kind,
            commodity: body.commodity,
            archived: body.archived,
            locked: body.locked,
            system_key: body.system_key,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LineView {
    pub account: DocId,
    pub commodity: DocId,
    pub amount: String,
    pub base: String,
    /// The rate the base value came from; none for a line in the base currency.
    pub rate: Option<String>,
}

/// The settings of the book, with the base currency spelled out.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SettingsView {
    pub base_commodity: DocId,
    pub base_code: String,
    pub base_scale: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct EntryView {
    /// True after a delete; the lines are still shown, the books do not count them.
    pub deleted: bool,
    pub date: String,
    pub memo: Option<String>,
    pub no: Option<String>,
    pub lines: Vec<LineView>,
}
