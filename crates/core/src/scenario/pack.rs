//! Scenario packs (ADR-0024, docs/foundation/scenario-format.md): one JSON document of scenarios
//! and their strings. `load` checks every name, reference, string and expression and refuses the
//! whole pack on the first fault, so a loaded scenario can only fail on the user's values.

use crate::body::AccountKind;
use crate::scenario::expr::{CompileError, Expr};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fmt;

mod check;
mod raw;

/// The pack format this core reads.
pub const SCHEMA: u32 = 1;
/// The largest pack text the core reads, in bytes.
pub const MAX_PACK_BYTES: usize = 1 << 20;
/// The languages every pack string must exist in.
pub const LANGUAGES: [&str; 2] = ["tr", "en"];

/// A loaded pack. Its fields are crate-private, so a pack can only come from `load`, which checks
/// every name, reference, string and expression.
#[derive(Debug, Clone)]
pub struct Pack {
    pub(crate) id: String,
    /// SHA-256 of the pack text, lower-case hex.
    pub(crate) hash: String,
    pub(crate) scenarios: Vec<Scenario>,
    /// Language, then key, then text.
    pub(crate) strings: BTreeMap<String, BTreeMap<String, String>>,
}

impl Pack {
    /// The id the pack gives itself.
    pub fn id(&self) -> &str {
        &self.id
    }

    /// SHA-256 of the pack text, lower-case hex.
    pub fn hash(&self) -> &str {
        &self.hash
    }

    pub fn scenario(&self, id: &str) -> Option<&Scenario> {
        self.scenarios.iter().find(|scenario| scenario.id == id)
    }
}

#[derive(Debug, Clone)]
pub struct Scenario {
    pub(crate) id: String,
    pub(crate) title: String,
    /// The date input of the entry.
    pub(crate) date: String,
    /// The text input that becomes the memo of the entry.
    pub(crate) memo: Option<String>,
    /// Pairs of account inputs that may not name the same account.
    pub(crate) distinct: Vec<(String, String)>,
    pub(crate) inputs: Vec<Input>,
    pub(crate) checks: Vec<Check>,
    pub(crate) lines: Vec<Line>,
    pub(crate) preview: String,
}

#[derive(Debug, Clone)]
pub struct Input {
    pub(crate) name: String,
    pub(crate) label: String,
    pub(crate) required: bool,
    pub(crate) kind: InputKind,
}

#[derive(Debug, Clone)]
pub enum InputKind {
    Amount {
        /// The account input whose commodity the amount is in.
        of: String,
        default: Option<String>,
        show_if_commodity_differs: Option<(String, String)>,
    },
    Account {
        kinds: Vec<AccountKind>,
        allow_new: bool,
        /// The system account the draft uses when the input is left empty.
        default_system: Option<String>,
    },
    Rate {
        of: AccountRef,
    },
    Contact,
    Choice {
        options: Vec<ChoiceOption>,
    },
    Lines {
        columns: Vec<Input>,
    },
    Date,
    Text {
        max: usize,
    },
}

/// An account input, or the account column of a `lines` input.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AccountRef {
    Input(String),
    Column { list: String, column: String },
}

#[derive(Debug, Clone)]
pub struct ChoiceOption {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) values: BTreeMap<String, OptionValue>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OptionValue {
    Sign(Sign),
    System(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sign {
    Debit,
    Credit,
}

#[derive(Debug, Clone)]
pub struct Check {
    pub(crate) rule: Expr,
    pub(crate) field: String,
    pub(crate) message: String,
}

#[derive(Debug, Clone)]
pub struct Line {
    pub(crate) id: String,
    /// The `lines` input the line repeats over.
    pub(crate) each: Option<String>,
    pub(crate) account: LineAccount,
    pub(crate) amount: Expr,
    pub(crate) sign: LineSign,
    pub(crate) convert: bool,
    pub(crate) rate: Option<String>,
    pub(crate) base_of: Option<String>,
    pub(crate) contact: Option<String>,
    pub(crate) when: Option<Expr>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LineAccount {
    /// An account input, or an account column of the line's `each` list.
    Input(String),
    /// A system group, or its child in the commodity of `commodity_of`.
    System {
        key: SystemKey,
        commodity_of: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SystemKey {
    Fixed(String),
    Choice { choice: String, value: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LineSign {
    Fixed(Sign),
    Choice { choice: String, value: String },
}

/// Why a pack does not load.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum PackError {
    #[error("the pack is larger than {MAX_PACK_BYTES} bytes")]
    TooLarge,
    #[error("the pack does not follow the format: {0}")]
    Format(String),
    #[error("the pack schema {0} is not known")]
    Schema(u32),
    #[error("{at}: {fault}")]
    Fault { at: String, fault: Fault },
}

/// What is wrong at a place in a pack.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fault {
    BadName(String),
    Duplicate(String),
    UnknownName(String),
    WrongKind(String),
    FieldNotAllowed(&'static str),
    MissingField(&'static str),
    NoKinds,
    NewNeedsOneKind,
    NoOptions,
    OptionValuesDiffer,
    BadValue(String),
    BadMax,
    MissingString { key: String, language: String },
    Expr(CompileError),
    WrongType,
}

impl fmt::Display for Fault {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Fault::BadName(name) => write!(f, "{name} is not a valid name"),
            Fault::Duplicate(name) => write!(f, "{name} is used twice"),
            Fault::UnknownName(name) => write!(f, "{name} is not defined"),
            Fault::WrongKind(name) => write!(f, "{name} is the wrong kind of name"),
            Fault::FieldNotAllowed(field) => write!(f, "{field} does not belong to this type"),
            Fault::MissingField(field) => write!(f, "{field} is required for this type"),
            Fault::NoKinds => write!(f, "an account input needs at least one kind"),
            Fault::NewNeedsOneKind => write!(f, "a new account needs exactly one kind"),
            Fault::NoOptions => write!(f, "a choice needs at least one option"),
            Fault::OptionValuesDiffer => write!(f, "the options of a choice set different values"),
            Fault::BadValue(value) => write!(f, "{value} is not a sign or a system key"),
            Fault::BadMax => write!(f, "the text length is out of range"),
            Fault::MissingString { key, language } => {
                write!(f, "the string {key} is missing in {language}")
            }
            Fault::Expr(error) => write!(f, "{error}"),
            Fault::WrongType => write!(f, "the expression has the wrong type"),
        }
    }
}

/// Loads a pack from its text.
pub fn load(text: &str) -> Result<Pack, PackError> {
    if text.len() > MAX_PACK_BYTES {
        return Err(PackError::TooLarge);
    }
    let head: raw::Head = serde_json::from_str(text).map_err(format_error)?;
    if head.schema != SCHEMA {
        return Err(PackError::Schema(head.schema));
    }
    let raw: raw::Pack = serde_json::from_str(text).map_err(format_error)?;
    let scenarios = check::scenarios(raw.scenarios, &raw.strings)?;
    Ok(Pack {
        id: raw.id,
        hash: hex(&Sha256::digest(text.as_bytes())),
        scenarios,
        strings: raw.strings,
    })
}

fn format_error(error: serde_json::Error) -> PackError {
    PackError::Format(error.to_string())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests;
