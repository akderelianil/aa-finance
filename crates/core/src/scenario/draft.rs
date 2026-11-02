//! The draft (ADR-0024, docs/foundation/scenario-format.md): a scenario and the user's values become
//! an entry input with the accounts and contacts it opens, a preview sentence, and field errors.
//! Nothing is written; the entry goes unchanged to `post_entry`, which checks it like any entry.

use crate::error::Result;
use crate::ids::DocId;
use crate::ops::{AccountView, ContactView, EntryInput};
use crate::scenario::pack::Pack;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

mod build;
mod preview;
mod read;

/// What a draft reads from the books. `Ledger` is the one implementation outside the tests.
pub trait Books {
    /// The book currency and its scale.
    fn base(&self) -> Result<(DocId, u8)>;
    fn account(&self, id: DocId) -> Result<AccountView>;
    fn system_account(&self, key: &str) -> Result<DocId>;
    /// The accounts directly under `parent` (`None`: the top of the chart).
    fn child_accounts(&self, parent: Option<DocId>) -> Result<Vec<DocId>>;
    /// The code and scale of a commodity.
    fn commodity(&self, id: DocId) -> Result<(String, u8)>;
    fn contact(&self, id: DocId) -> Result<ContactView>;
    fn contacts(&self) -> Result<Vec<(DocId, String)>>;
}

/// The language of the preview and of the error texts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Tr,
    En,
}

impl Language {
    pub fn as_str(self) -> &'static str {
        match self {
            Language::Tr => "tr",
            Language::En => "en",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DraftInput {
    pub scenario: String,
    pub language: Language,
    /// Input name to value, in the shapes of the format's input table.
    pub inputs: Map<String, Value>,
}

/// A draft: an entry with its preview, or the errors that keep it from being one, never both.
/// On the wire it is one object with `entry`, `preview` and `errors` (the contract's `Draft`).
#[derive(Debug, Clone)]
pub enum Draft {
    Ready {
        entry: EntryInput,
        preview: Preview,
    },
    /// At least one error.
    Refused {
        errors: Vec<FieldError>,
    },
}

impl Draft {
    pub fn entry(&self) -> Option<&EntryInput> {
        match self {
            Draft::Ready { entry, .. } => Some(entry),
            Draft::Refused { .. } => None,
        }
    }

    pub fn preview(&self) -> Option<&Preview> {
        match self {
            Draft::Ready { preview, .. } => Some(preview),
            Draft::Refused { .. } => None,
        }
    }

    pub fn errors(&self) -> &[FieldError] {
        match self {
            Draft::Ready { .. } => &[],
            Draft::Refused { errors } => errors,
        }
    }
}

impl Serialize for Draft {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut out = serializer.serialize_struct("Draft", 3)?;
        out.serialize_field("entry", &self.entry())?;
        out.serialize_field("preview", &self.preview())?;
        out.serialize_field("errors", self.errors())?;
        out.end()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Preview {
    pub key: String,
    pub vars: BTreeMap<String, String>,
    pub text: String,
}

/// A problem with the user's values. `field` is an input name, `list.row.column` for a row, or
/// `None` for the draft as a whole.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FieldError {
    pub field: Option<String>,
    pub code: String,
    pub text: String,
}

/// Why a value was refused, before it is put in words.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Code {
    Required,
    Invalid,
    Unknown,
    UnknownField,
    AccountKind,
    AccountArchived,
    SameAccount,
    RateNeeded,
    TooLong,
    Calculation,
    TooFewLines,
    MixedCommodities,
    /// A failed check of the pack, with the key of its message.
    Check(String),
}

impl Code {
    fn as_str(&self) -> &str {
        match self {
            Code::Required => "required",
            Code::Invalid => "invalid",
            Code::Unknown => "unknown",
            Code::UnknownField => "unknown_field",
            Code::AccountKind => "account_kind",
            Code::AccountArchived => "account_archived",
            Code::SameAccount => "same_account",
            Code::RateNeeded => "rate_needed",
            Code::TooLong => "too_long",
            Code::Calculation => "calculation",
            Code::TooFewLines => "too_few_lines",
            Code::MixedCommodities => "mixed_commodities",
            Code::Check(key) => key,
        }
    }

    /// The core's own words for its codes; a check speaks with the pack's strings.
    fn text(&self, pack: &Pack, language: Language) -> String {
        let (tr, en) = match self {
            Code::Required => ("Bu alan zorunlu.", "This field is required."),
            Code::Invalid => ("Bu değer geçerli değil.", "This value is not valid."),
            Code::Unknown => ("Bu kayıt bulunamadı.", "This record does not exist."),
            Code::UnknownField => (
                "Bu senaryoda böyle bir alan yok.",
                "This scenario has no such field.",
            ),
            Code::AccountKind => (
                "Bu alana bu türde bir hesap seçilemez.",
                "An account of this kind cannot be used here.",
            ),
            Code::AccountArchived => ("Bu hesap arşivde.", "This account is archived."),
            Code::SameAccount => (
                "İki hesap aynı olamaz.",
                "The two accounts cannot be the same.",
            ),
            Code::RateNeeded => ("Kur girilmeli.", "Enter the rate."),
            Code::TooLong => ("Metin çok uzun.", "The text is too long."),
            Code::Calculation => (
                "Tutarlar hesaplanamadı.",
                "The amounts cannot be calculated.",
            ),
            Code::TooFewLines => (
                "Kayıt en az iki satır olmalı.",
                "An entry needs at least two lines.",
            ),
            Code::MixedCommodities => (
                "Satırlar aynı para biriminde olmalı.",
                "The lines must be in one currency.",
            ),
            Code::Check(key) => {
                return pack
                    .strings
                    .get(language.as_str())
                    .and_then(|table| table.get(key))
                    .cloned()
                    .unwrap_or_else(|| key.clone());
            }
        };
        match language {
            Language::Tr => tr.to_string(),
            Language::En => en.to_string(),
        }
    }
}

/// A refusal on the way to a draft: the field it belongs to and why.
pub(crate) type Refusal = (Option<String>, Code);

/// Drafts a scenario of `pack` with the user's values.
pub fn draft(pack: &Pack, books: &dyn Books, input: &DraftInput) -> Result<Draft> {
    let scenario =
        pack.scenario(&input.scenario)
            .ok_or_else(|| crate::Error::MissingReference {
                kind: "scenario",
                what: input.scenario.clone(),
            })?;
    let refused = |refusals: Vec<Refusal>| Draft::Refused {
        errors: refusals
            .into_iter()
            .map(|(field, code)| FieldError {
                field,
                code: code.as_str().to_string(),
                text: code.text(pack, input.language),
            })
            .collect(),
    };
    let mut reader = read::Reader::new(books, scenario)?;
    let values = reader.read(&input.inputs)?;
    if !reader.refusals.is_empty() {
        return Ok(refused(std::mem::take(&mut reader.refusals)));
    }
    let refusals = build::checks(scenario, &values)?;
    if !refusals.is_empty() {
        return Ok(refused(refusals));
    }
    let entry = match build::entry(&mut reader, &values)? {
        Ok(entry) => entry,
        Err(refusals) => return Ok(refused(refusals)),
    };
    let preview = preview::preview(pack, scenario, &values, input.language);
    Ok(Draft::Ready { entry, preview })
}
