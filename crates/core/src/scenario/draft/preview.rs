//! The preview sentence: the pack's text in the asked language, with every `{input}` replaced by
//! the value the user gave, amounts and dates written the way the language writes them.

use super::read::Values;
use super::{Language, Preview};
use crate::amount::{format_amount, Separators};
use crate::scenario::pack::{InputKind, Pack, Scenario};
use std::collections::BTreeMap;

pub(super) fn preview(
    pack: &Pack,
    scenario: &Scenario,
    values: &Values,
    language: Language,
) -> Preview {
    let separators = match language {
        Language::Tr => Separators::COMMA_DECIMAL,
        Language::En => Separators::DOT_DECIMAL,
    };
    let strings = pack.strings.get(language.as_str());
    let mut vars = BTreeMap::new();
    for input in &scenario.inputs {
        let name = input.name.as_str();
        let text = match &input.kind {
            InputKind::Amount { of, .. } => {
                let (Some(amount), Some(account)) =
                    (values.amounts.get(name), values.accounts.get(of))
                else {
                    continue;
                };
                let amount = format_amount(amount.value, account.scale, separators);
                format!("{amount} {}", account.code)
            }
            InputKind::Account { .. } => match values.accounts.get(name) {
                Some(account) => account.name.clone(),
                None => continue,
            },
            InputKind::Lines { columns } => {
                let Some(column) = columns
                    .iter()
                    .find(|column| matches!(column.kind, InputKind::Account { .. }))
                else {
                    continue;
                };
                let rows = values.rows.get(name).map(Vec::as_slice).unwrap_or_default();
                rows.iter()
                    .filter_map(|row| row.accounts.get(&column.name))
                    .map(|account| account.name.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            }
            InputKind::Contact => match values.contacts.get(name) {
                Some((_, contact)) => contact.clone(),
                None => continue,
            },
            InputKind::Choice { options } => {
                let label = values
                    .choices
                    .get(name)
                    .and_then(|index| options.get(*index))
                    .and_then(|option| strings.and_then(|table| table.get(&option.label)));
                match label {
                    Some(label) => label.clone(),
                    None => continue,
                }
            }
            InputKind::Date => match values.dates.get(name) {
                Some(date) => written_date(date, language),
                None => continue,
            },
            InputKind::Text { .. } => match values.texts.get(name) {
                Some(text) => text.clone(),
                None => continue,
            },
            InputKind::Rate { .. } => match values.rates.get(name) {
                Some(rate) => rate.to_text(),
                None => continue,
            },
        };
        vars.insert(name.to_string(), text);
    }
    let template = strings
        .and_then(|table| table.get(&scenario.preview))
        .map_or("", String::as_str);
    Preview {
        key: scenario.preview.clone(),
        text: fill(template, &vars),
        vars,
    }
}

/// `2026-11-02` as `02.11.2026` in Turkish; English keeps the civil form.
fn written_date(date: &str, language: Language) -> String {
    match (language, date.split('-').collect::<Vec<_>>().as_slice()) {
        (Language::Tr, [year, month, day]) => format!("{day}.{month}.{year}"),
        _ => date.to_string(),
    }
}

/// The template with each `{name}` replaced by its value; a name without a value becomes empty.
fn fill(template: &str, vars: &BTreeMap<String, String>) -> String {
    let mut text = String::with_capacity(template.len());
    let mut rest = template;
    while let Some(open) = rest.find('{') {
        text.push_str(&rest[..open]);
        let after = &rest[open + 1..];
        match after.find('}') {
            Some(close) => {
                if let Some(value) = vars.get(&after[..close]) {
                    text.push_str(value);
                }
                rest = &after[close + 1..];
            }
            None => {
                text.push_str(&rest[open..]);
                rest = "";
            }
        }
    }
    text.push_str(rest);
    text
}
