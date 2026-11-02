//! The form of a scenario as every platform renders it (ADR-0024, docs/foundation/scenario-format.md):
//! the inputs in pack order with labels in the asked language, and no expressions. This shape is
//! part of the API contract, so it changes only with the contract.

use crate::body::AccountKind;
use crate::error::{Error, Result};
use crate::scenario::draft::Language;
use crate::scenario::pack::{AccountRef, Input, InputKind, Pack};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ScenarioList {
    /// The id of the pack the scenarios come from.
    pub pack: String,
    /// SHA-256 of the pack text.
    pub hash: String,
    pub scenarios: Vec<ScenarioSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScenarioSummary {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScenarioForm {
    pub id: String,
    pub title: String,
    pub inputs: Vec<FormInput>,
}

/// One input of a form. Only the fields of its type are present.
#[derive(Debug, Clone, Serialize)]
pub struct FormInput {
    pub name: String,
    #[serde(rename = "type")]
    pub ty: &'static str,
    pub label: String,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub of: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kinds: Option<Vec<AccountKind>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<FormOption>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub columns: Option<Vec<FormInput>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_if_commodity_differs: Option<(String, String)>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FormOption {
    pub id: String,
    pub label: String,
}

/// The scenarios of a pack with their titles.
pub fn list(pack: &Pack, language: Language) -> ScenarioList {
    ScenarioList {
        pack: pack.id.clone(),
        hash: pack.hash.clone(),
        scenarios: pack
            .scenarios
            .iter()
            .map(|scenario| ScenarioSummary {
                id: scenario.id.clone(),
                title: text(pack, language, &scenario.title),
            })
            .collect(),
    }
}

/// The form of one scenario.
pub fn describe(pack: &Pack, id: &str, language: Language) -> Result<ScenarioForm> {
    let scenario = pack.scenario(id).ok_or_else(|| Error::MissingReference {
        kind: "scenario",
        what: id.to_string(),
    })?;
    Ok(ScenarioForm {
        id: scenario.id.clone(),
        title: text(pack, language, &scenario.title),
        inputs: scenario
            .inputs
            .iter()
            .map(|input| form_input(pack, language, input))
            .collect(),
    })
}

/// A pack string; the loader made sure every key exists in both languages.
fn text(pack: &Pack, language: Language, key: &str) -> String {
    pack.strings
        .get(language.as_str())
        .and_then(|table| table.get(key))
        .cloned()
        .unwrap_or_else(|| key.to_string())
}

fn form_input(pack: &Pack, language: Language, input: &Input) -> FormInput {
    let mut form = FormInput {
        name: input.name.clone(),
        ty: "",
        label: text(pack, language, &input.label),
        required: input.required,
        of: None,
        kinds: None,
        new: None,
        default_system: None,
        options: None,
        columns: None,
        default: None,
        show_if_commodity_differs: None,
        max: None,
    };
    match &input.kind {
        InputKind::Amount {
            of,
            default,
            show_if_commodity_differs,
        } => {
            form.ty = "amount";
            form.of = Some(of.clone());
            form.default = default.clone();
            form.show_if_commodity_differs = show_if_commodity_differs.clone();
        }
        InputKind::Account {
            kinds,
            allow_new,
            default_system,
        } => {
            form.ty = "account";
            form.kinds = Some(kinds.clone());
            form.new = Some(*allow_new);
            form.default_system = default_system.clone();
        }
        InputKind::Rate { of } => {
            form.ty = "rate";
            form.of = Some(match of {
                AccountRef::Input(name) => name.clone(),
                AccountRef::Column { list, column } => format!("{list}.{column}"),
            });
        }
        InputKind::Contact => form.ty = "contact",
        InputKind::Choice { options } => {
            form.ty = "choice";
            form.options = Some(
                options
                    .iter()
                    .map(|option| FormOption {
                        id: option.id.clone(),
                        label: text(pack, language, &option.label),
                    })
                    .collect(),
            );
        }
        InputKind::Lines { columns } => {
            form.ty = "lines";
            form.columns = Some(
                columns
                    .iter()
                    .map(|column| form_input(pack, language, column))
                    .collect(),
            );
        }
        InputKind::Date => form.ty = "date",
        InputKind::Text { max } => {
            form.ty = "text";
            form.max = Some(*max);
        }
    }
    form
}
