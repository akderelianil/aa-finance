//! The pack as written: plain serde shapes that refuse unknown fields. `check` turns them into the
//! checked model.

use crate::body::AccountKind;
use serde::Deserialize;
use std::collections::BTreeMap;

/// Only the schema version, read first so that a newer format is named as such.
#[derive(Deserialize)]
pub(super) struct Head {
    pub schema: u32,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Pack {
    #[allow(dead_code)]
    pub schema: u32,
    pub id: String,
    pub scenarios: Vec<Scenario>,
    pub strings: BTreeMap<String, BTreeMap<String, String>>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Scenario {
    pub id: String,
    pub title: String,
    pub date: String,
    pub memo: Option<String>,
    #[serde(default)]
    pub distinct: Vec<(String, String)>,
    pub inputs: Vec<Input>,
    #[serde(default)]
    pub checks: Vec<Check>,
    pub lines: Vec<Line>,
    pub preview: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(super) enum Type {
    Amount,
    Account,
    Rate,
    Contact,
    Choice,
    Lines,
    Date,
    Text,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Input {
    pub name: String,
    #[serde(rename = "type")]
    pub ty: Type,
    pub label: String,
    pub required: Option<bool>,
    pub of: Option<String>,
    pub kinds: Option<Vec<AccountKind>>,
    pub new: Option<bool>,
    pub options: Option<Vec<ChoiceOption>>,
    pub columns: Option<Vec<Input>>,
    pub default: Option<String>,
    pub show_if_commodity_differs: Option<(String, String)>,
    pub max: Option<usize>,
}

impl Input {
    /// The optional fields this input sets, by their names in the format.
    pub fn present_fields(&self) -> Vec<&'static str> {
        [
            ("of", self.of.is_some()),
            ("kinds", self.kinds.is_some()),
            ("new", self.new.is_some()),
            ("options", self.options.is_some()),
            ("columns", self.columns.is_some()),
            ("default", self.default.is_some()),
            (
                "show_if_commodity_differs",
                self.show_if_commodity_differs.is_some(),
            ),
            ("max", self.max.is_some()),
        ]
        .into_iter()
        .filter(|(_, present)| *present)
        .map(|(name, _)| name)
        .collect()
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ChoiceOption {
    pub id: String,
    pub label: String,
    pub values: BTreeMap<String, String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Check {
    pub rule: String,
    pub field: String,
    pub message: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Line {
    pub id: String,
    pub each: Option<String>,
    pub account: LineAccount,
    pub amount: String,
    pub sign: Option<String>,
    #[serde(default)]
    pub convert: bool,
    pub rate: Option<String>,
    pub base_of: Option<String>,
    pub contact: Option<String>,
    pub when: Option<String>,
}

#[derive(Deserialize)]
#[serde(untagged)]
pub(super) enum LineAccount {
    Input(String),
    System(SystemAccount),
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct SystemAccount {
    pub system: String,
    pub commodity_of: String,
}
