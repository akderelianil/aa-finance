//! Errors of the core. Rule violations carry a stable code that the UI turns into a message.

use crate::ids::DocId;

mod messages;

/// The languages the core has texts for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lang {
    Tr,
    En,
}

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
    NothingToUndo,
    EntryMustStartAsDraft,
    BaseCurrencyLocked,
    SettingsIdFixed,
    BookAlreadyOpen,
    AccountLocked,
    SystemKeyTaken,
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
            RuleCode::NothingToUndo => "nothing_to_undo",
            RuleCode::EntryMustStartAsDraft => "entry_must_start_as_draft",
            RuleCode::BaseCurrencyLocked => "base_currency_locked",
            RuleCode::SettingsIdFixed => "settings_id_fixed",
            RuleCode::BookAlreadyOpen => "book_already_open",
            RuleCode::AccountLocked => "account_locked",
            RuleCode::SystemKeyTaken => "system_key_taken",
        }
    }

    pub(crate) const TRIGGER_CODES: [RuleCode; 13] = [
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
        RuleCode::EntryMustStartAsDraft,
        RuleCode::BaseCurrencyLocked,
        RuleCode::AccountLocked,
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
    Conflict { doc_id: DocId },
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

impl Error {
    /// The stable code that crosses the API. Rule violations use their rule code.
    pub fn code(&self) -> &'static str {
        match self {
            Error::Rule(code) => code.as_str(),
            Error::Conflict { .. } => "conflict",
            Error::Sqlite(_) => "database",
            Error::InvalidBody(_) => "invalid_body",
            Error::MissingReference { .. } => "missing_reference",
            Error::ForeignDatabase => "foreign_database",
            Error::Internal(_) => "internal",
            Error::NewerDatabase { .. } => "newer_database",
        }
    }

    /// A message that is safe to show or send over the API: fixed text only, never the text of the
    /// database or of an internal error (those stay in `Display` for logs).
    pub fn message(&self, lang: Lang) -> &'static str {
        let (tr, en) = match self {
            Error::Rule(code) => return code.message(lang),
            Error::Conflict { .. } => (
                "Bu kayıt sen bakarken başka yerde değişti. Yenile ve tekrar dene.",
                "This record changed elsewhere while you were looking. Refresh and try again.",
            ),
            Error::Sqlite(_) => (
                "Veri dosyasında bir sorun oluştu. Bir şey kaydedilmedi.",
                "There was a problem with the data file. Nothing was saved.",
            ),
            Error::InvalidBody(_) => (
                "Kaydın içeriği geçerli değil.",
                "The content of the record is not valid.",
            ),
            Error::MissingReference { .. } => (
                "Kayıt, var olmayan bir hesaba veya para birimine bağlı.",
                "The record points to an account or currency that does not exist.",
            ),
            Error::ForeignDatabase => (
                "Bu dosya bir aa-finance defteri değil.",
                "This file is not an aa-finance ledger.",
            ),
            Error::Internal(_) => (
                "Beklenmeyen bir iç hata oluştu.",
                "An unexpected internal error occurred.",
            ),
            Error::NewerDatabase { .. } => (
                "Bu defter, uygulamanın daha yeni bir sürümüyle yazılmış. Uygulamayı güncelleyin.",
                "This ledger was written by a newer version of the app. Update the app.",
            ),
        };
        match lang {
            Lang::Tr => tr,
            Lang::En => en,
        }
    }
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
                        "UNIQUE constraint failed: account.system_key",
                        RuleCode::SystemKeyTaken,
                    ),
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
