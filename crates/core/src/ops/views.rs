//! What the operations hand back: plain data with amounts as canonical strings (ADR-0009).

use crate::body::{AccountBody, AccountKind};
use crate::ids::Id;
use crate::RevisionRecord;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct HistoryItem {
    pub revision_id: Id,
    pub parent_id: Option<Id>,
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
    pub parent: Option<Id>,
    pub kind: AccountKind,
    pub commodity: Id,
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
    pub account: Id,
    pub commodity: Id,
    pub amount: String,
    pub base: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct EntryView {
    pub date: String,
    pub memo: Option<String>,
    pub no: Option<String>,
    pub lines: Vec<LineView>,
}
