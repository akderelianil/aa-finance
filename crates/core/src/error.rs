//! Errors of the core. Rule violations carry a stable code that the UI turns into a message.

use crate::ids::Id;

/// Stable codes of broken rules. The names are the codes raised by triggers in the schema.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[non_exhaustive]
pub enum RuleCode {
    ProjectionClosed,
    RevisionImmutable,
    RevisionParentMismatch,
    EntryTooFewLines,
    EntryUnbalanced,
    AccountArchived,
    CommodityScaleLocked,
    AmountOutOfRange,
    DateInvalid,
    CommodityScaleInvalid,
    CommodityCodeTaken,
    AccountParentCycle,
    LineCommodityMismatch,
    AccountCommodityLocked,
    RevisionKindMismatch,
    AmountInvalid,
    AmountTooPrecise,
    RateInvalid,
    RateMissing,
    LineBaseSign,
    RateBaseConflict,
    LineEmpty,
}

impl RuleCode {
    /// The code as a string, as raised by the database and shown in logs.
    pub fn as_str(self) -> &'static str {
        match self {
            RuleCode::ProjectionClosed => "projection_closed",
            RuleCode::RevisionImmutable => "revision_immutable",
            RuleCode::RevisionParentMismatch => "revision_parent_mismatch",
            RuleCode::EntryTooFewLines => "entry_too_few_lines",
            RuleCode::EntryUnbalanced => "entry_unbalanced",
            RuleCode::AccountArchived => "account_archived",
            RuleCode::CommodityScaleLocked => "commodity_scale_locked",
            RuleCode::AmountOutOfRange => "amount_out_of_range",
            RuleCode::DateInvalid => "date_invalid",
            RuleCode::CommodityScaleInvalid => "commodity_scale_invalid",
            RuleCode::CommodityCodeTaken => "commodity_code_taken",
            RuleCode::AccountParentCycle => "account_parent_cycle",
            RuleCode::LineCommodityMismatch => "line_commodity_mismatch",
            RuleCode::AccountCommodityLocked => "account_commodity_locked",
            RuleCode::RevisionKindMismatch => "revision_kind_mismatch",
            RuleCode::AmountInvalid => "amount_invalid",
            RuleCode::AmountTooPrecise => "amount_too_precise",
            RuleCode::RateInvalid => "rate_invalid",
            RuleCode::RateMissing => "rate_missing",
            RuleCode::LineBaseSign => "line_base_sign",
            RuleCode::RateBaseConflict => "rate_base_conflict",
            RuleCode::LineEmpty => "line_empty",
        }
    }

    pub(crate) const TRIGGER_CODES: [RuleCode; 10] = [
        RuleCode::ProjectionClosed,
        RuleCode::RevisionImmutable,
        RuleCode::RevisionParentMismatch,
        RuleCode::EntryTooFewLines,
        RuleCode::EntryUnbalanced,
        RuleCode::AccountArchived,
        RuleCode::CommodityScaleLocked,
        RuleCode::LineCommodityMismatch,
        RuleCode::AccountCommodityLocked,
        RuleCode::RevisionKindMismatch,
    ];
}

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    /// A rule of the ledger was broken.
    #[error("rule broken: {}", .0.as_str())]
    Rule(RuleCode),
    /// The caller wrote from a stale view: the parent is not the current head of the document.
    #[error("conflict: revision of {doc_id} does not continue the current head")]
    Conflict { doc_id: Id },
    #[error("database error: {0}")]
    Sqlite(rusqlite::Error),
    #[error("invalid revision body: {0}")]
    InvalidBody(String),
    #[error("a referenced {kind} does not exist: {what}")]
    MissingReference { kind: &'static str, what: String },
    #[error("this file is not an aa-finance ledger (it has tables but no schema version)")]
    ForeignDatabase,
    #[error("internal error: {0}")]
    Internal(&'static str),
    #[error(
        "the database is newer (version {found}) than this app supports (version {supported})"
    )]
    NewerDatabase { found: u32, supported: u32 },
}

impl From<rusqlite::Error> for Error {
    fn from(err: rusqlite::Error) -> Self {
        if let rusqlite::Error::SqliteFailure(failure, Some(message)) = &err {
            if failure.code == rusqlite::ErrorCode::ConstraintViolation {
                if let Some(code) = RuleCode::TRIGGER_CODES
                    .iter()
                    .find(|c| c.as_str() == message)
                {
                    return Error::Rule(*code);
                }
                let by_message = [
                    ("quantity BETWEEN", RuleCode::AmountOutOfRange),
                    ("base_value BETWEEN", RuleCode::AmountOutOfRange),
                    ("date(date) IS date", RuleCode::DateInvalid),
                    ("scale BETWEEN", RuleCode::CommodityScaleInvalid),
                    ("line_base_sign", RuleCode::LineBaseSign),
                    ("line_not_empty", RuleCode::LineEmpty),
                    (
                        "UNIQUE constraint failed: commodity.code",
                        RuleCode::CommodityCodeTaken,
                    ),
                ];
                if let Some((_, code)) = by_message
                    .iter()
                    .find(|(needle, _)| message.contains(needle))
                {
                    return Error::Rule(*code);
                }
            }
            if message == "integer overflow" {
                return Error::Rule(RuleCode::AmountOutOfRange);
            }
        }
        Error::Sqlite(err)
    }
}

impl From<serde_json::Error> for Error {
    fn from(err: serde_json::Error) -> Self {
        Error::InvalidBody(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, Error>;

#[cfg(test)]
mod tests;
