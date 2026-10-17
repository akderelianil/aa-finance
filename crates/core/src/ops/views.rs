//! What the operations hand back: plain data with amounts as canonical strings (ADR-0009).

use crate::body::{AccountBody, AccountKind};
use crate::ids::{DocId, Id, RevisionId};
use crate::RevisionRecord;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct HistoryItem {
    pub revision_id: RevisionId,
    pub parent_id: Option<RevisionId>,
    pub author_id: Id,
    pub created_at_ms: i64,
}

impl From<RevisionRecord> for HistoryItem {
    fn from(record: RevisionRecord) -> HistoryItem {
        HistoryItem {
            revision_id: record.id,
            parent_id: record.parent_id,
            author_id: record.author_id,
            created_at_ms: record.created_at_ms,
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
}

impl From<AccountBody> for AccountView {
    fn from(body: AccountBody) -> AccountView {
        AccountView {
            name: body.name,
            parent: body.parent,
            kind: body.kind,
            commodity: body.commodity,
            archived: body.archived,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LineView {
    pub account: DocId,
    pub commodity: DocId,
    pub amount: String,
    pub base: String,
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
    pub date: String,
    pub memo: Option<String>,
    pub no: Option<String>,
    pub lines: Vec<LineView>,
}
