//! The named-operation API (ADR-0008, ADR-0023): `call(name, json)` returns json.
//! The contract in `api/v1/api.json` is the authority; the tests hold this file to it.

use crate::error::{Error, Lang, Result};
use crate::ids::DocId;
use crate::ops::{AccountInput, EntryInput, Ledger};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};

/// The version of the contract this build speaks.
pub const API_VERSION: &str = "1";

/// Every operation of the contract, in the order of the contract file.
pub const OPERATIONS: [&str; 17] = [
    "open_book",
    "settings",
    "set_base_currency",
    "create_commodity",
    "create_account",
    "rename_account",
    "set_account_archived",
    "post_entry",
    "edit_entry",
    "delete_entry",
    "undo",
    "redo",
    "history",
    "system_account",
    "account",
    "entry",
    "api_version",
];

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Empty {}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OpenBook {
    base_code: String,
    base_scale: u8,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CommodityRef {
    commodity: DocId,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CreateCommodity {
    code: String,
    scale: u8,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RenameAccount {
    account: DocId,
    name: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ArchiveAccount {
    account: DocId,
    archived: bool,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EditEntry {
    entry: DocId,
    input: EntryInput,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EntryRef {
    entry: DocId,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AccountRef {
    account: DocId,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DocRefInput {
    doc: DocId,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SystemKey {
    key: String,
}

fn parse<T: DeserializeOwned>(input: Value) -> Result<T> {
    serde_json::from_value(input).map_err(|err| Error::InvalidInput(err.to_string()))
}

fn output<T: serde::Serialize>(value: T) -> Result<Value> {
    serde_json::to_value(value).map_err(|_| Error::Internal("an output could not be serialized"))
}

impl Ledger {
    /// Runs one named operation. The input is a JSON object, the output a JSON value; every
    /// failure is an `Error` with a stable code (see [`error_json`]).
    pub fn call(&mut self, operation: &str, input: Value) -> Result<Value> {
        match operation {
            "open_book" => {
                let i: OpenBook = parse(input)?;
                output(self.open_book(&i.base_code, i.base_scale)?)
            }
            "settings" => {
                parse::<Empty>(input)?;
                output(self.settings()?)
            }
            "set_base_currency" => {
                let i: CommodityRef = parse(input)?;
                output(self.set_base_currency(i.commodity)?)
            }
            "create_commodity" => {
                let i: CreateCommodity = parse(input)?;
                output(self.create_commodity(&i.code, i.scale)?)
            }
            "create_account" => output(self.create_account(parse::<AccountInput>(input)?)?),
            "rename_account" => {
                let i: RenameAccount = parse(input)?;
                output(self.rename_account(i.account, &i.name)?)
            }
            "set_account_archived" => {
                let i: ArchiveAccount = parse(input)?;
                output(self.set_account_archived(i.account, i.archived)?)
            }
            "post_entry" => output(self.post_entry(parse::<EntryInput>(input)?)?),
            "edit_entry" => {
                let i: EditEntry = parse(input)?;
                output(self.edit_entry(i.entry, i.input)?)
            }
            "delete_entry" => output(self.delete_entry(parse::<EntryRef>(input)?.entry)?),
            "undo" => output(self.undo(parse::<DocRefInput>(input)?.doc)?),
            "redo" => output(self.redo(parse::<DocRefInput>(input)?.doc)?),
            "history" => output(self.history(parse::<DocRefInput>(input)?.doc)?),
            "system_account" => {
                let i: SystemKey = parse(input)?;
                Ok(json!({ "doc_id": self.system_account(&i.key)? }))
            }
            "account" => output(self.account(parse::<AccountRef>(input)?.account)?),
            "entry" => output(self.entry(parse::<EntryRef>(input)?.entry)?),
            "api_version" => {
                parse::<Empty>(input)?;
                Ok(json!({ "version": API_VERSION }))
            }
            other => Err(Error::UnknownOperation(other.to_string())),
        }
    }
}

/// The error as it crosses the API: a stable code and fixed text in the asked language.
pub fn error_json(error: &Error, lang: Lang) -> Value {
    json!({ "error": { "code": error.code(), "message": error.message(lang) } })
}
