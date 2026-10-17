//! Typed revision bodies (ADR-0012). The store keeps them as JSON until the canonical encoding is
//! frozen (release-and-quality-5); everything above the store writes and reads these types instead.

use crate::error::Result;
use crate::ids::DocId;
use crate::store::DocKind;
use serde::{Deserialize, Serialize};

/// A currency or other unit; `scale` is its number of decimal places.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CommodityBody {
    pub code: String,
    pub scale: i64,
}

/// The id every book gives its one settings document. It is the same in every book, so two devices
/// that open a book on their own write revisions of the same document and a clash shows up as a
/// visible conflict instead of two settings documents.
pub const SETTINGS_DOC: DocId = DocId::from_uuid(uuid::Uuid::from_u128(
    0x0000_0000_0000_7000_8000_0000_0000_0001,
));

/// The settings of a book that the whole family shares. Personal and device settings live outside
/// the ledger. A field becomes a column of the projection only when a rule or a query needs it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SettingsBody {
    /// The currency every entry balances in; fixed once the first entry exists.
    pub base_commodity: DocId,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccountKind {
    Asset,
    Liability,
    Equity,
    Income,
    Expense,
}

impl AccountKind {
    pub fn as_str(self) -> &'static str {
        match self {
            AccountKind::Asset => "asset",
            AccountKind::Liability => "liability",
            AccountKind::Equity => "equity",
            AccountKind::Income => "income",
            AccountKind::Expense => "expense",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AccountBody {
    pub name: String,
    pub parent: Option<DocId>,
    pub kind: AccountKind,
    pub commodity: DocId,
    pub archived: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryStatus {
    Draft,
    Posted,
}

impl EntryStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            EntryStatus::Draft => "draft",
            EntryStatus::Posted => "posted",
        }
    }
}

/// One line of an entry. `quantity` is in the commodity's scale, `base_value` in the base currency's.
/// `rate` is the canonical text of the rate the base value came from; a line in the base currency has
/// none. Nothing in the database reads it (the base value is what balances), so it stays in the body.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LineBody {
    pub account: DocId,
    pub commodity: DocId,
    pub quantity: i64,
    pub base_value: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EntryBody {
    pub date: String,
    pub memo: Option<String>,
    pub no: Option<String>,
    pub status: EntryStatus,
    pub lines: Vec<LineBody>,
}

/// The body of a revision, by document kind.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Body {
    Commodity(CommodityBody),
    Account(AccountBody),
    Entry(EntryBody),
    Settings(SettingsBody),
}

impl Body {
    pub fn kind(&self) -> DocKind {
        match self {
            Body::Commodity(_) => DocKind::Commodity,
            Body::Account(_) => DocKind::Account,
            Body::Entry(_) => DocKind::Entry,
            Body::Settings(_) => DocKind::Settings,
        }
    }

    /// The JSON text the store keeps. Field order is the declaration order, so it is deterministic.
    pub fn to_json(&self) -> Result<String> {
        Ok(match self {
            Body::Commodity(b) => serde_json::to_string(b)?,
            Body::Account(b) => serde_json::to_string(b)?,
            Body::Entry(b) => serde_json::to_string(b)?,
            Body::Settings(b) => serde_json::to_string(b)?,
        })
    }

    /// Reads the JSON of a revision of the given kind; unknown fields and wrong shapes are refused.
    pub fn from_json(kind: DocKind, json: &str) -> Result<Body> {
        Ok(match kind {
            DocKind::Commodity => Body::Commodity(serde_json::from_str(json)?),
            DocKind::Account => Body::Account(serde_json::from_str(json)?),
            DocKind::Entry => Body::Entry(serde_json::from_str(json)?),
            DocKind::Settings => Body::Settings(serde_json::from_str(json)?),
        })
    }
}

#[cfg(test)]
mod tests;
