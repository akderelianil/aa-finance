//! Reading the user's values: every input is turned into a checked value or a refusal on its field.
//! Accounts and contacts given by id must exist; a new name reuses a document of that name or
//! becomes one to create; amounts are read in the scale of their account's commodity.

use super::{Books, Code, Refusal};
use crate::amount::{parse_amount, Separators};
use crate::body::{AccountKind, ContactKind};
use crate::error::{Error, Result};
use crate::ids::DocId;
use crate::ops::{name_key, AccountInput, AccountView, ContactInput, NewAccount, NewContact};
use crate::rate::Rate;
use crate::scenario::expr::Quantity;
use crate::scenario::pack::{Input, InputKind, Scenario};
use serde_json::{Map, Value};
use std::collections::HashMap;

/// An account as a draft needs it.
#[derive(Debug, Clone)]
pub(super) struct Acc {
    pub id: DocId,
    pub name: String,
    pub kind: AccountKind,
    pub commodity: DocId,
    pub scale: u8,
    pub code: String,
}

/// One row of a `lines` input.
#[derive(Debug, Default)]
pub(super) struct Row {
    pub accounts: HashMap<String, Acc>,
    pub amounts: HashMap<String, Quantity>,
}

/// The checked values of one draft, by input name.
#[derive(Debug, Default)]
pub(super) struct Values {
    pub accounts: HashMap<String, Acc>,
    pub rows: HashMap<String, Vec<Row>>,
    pub amounts: HashMap<String, Quantity>,
    pub rates: HashMap<String, Rate>,
    pub contacts: HashMap<String, (DocId, String)>,
    pub choices: HashMap<String, usize>,
    pub texts: HashMap<String, String>,
    pub dates: HashMap<String, String>,
}

/// How an account or contact input names its document.
enum Reference {
    Id(DocId),
    New(String),
}

pub(super) struct Reader<'a> {
    pub books: &'a dyn Books,
    pub scenario: &'a Scenario,
    pub base: DocId,
    pub base_scale: u8,
    base_code: String,
    pub refusals: Vec<Refusal>,
    pub new_accounts: Vec<NewAccount>,
    pub new_contacts: Vec<NewContact>,
}

impl<'a> Reader<'a> {
    pub fn new(books: &'a dyn Books, scenario: &'a Scenario) -> Result<Reader<'a>> {
        let (base, base_scale) = books.base()?;
        let (base_code, _) = books.commodity(base)?;
        Ok(Reader {
            books,
            scenario,
            base,
            base_scale,
            base_code,
            refusals: Vec::new(),
            new_accounts: Vec::new(),
            new_contacts: Vec::new(),
        })
    }

    fn refuse(&mut self, field: &str, code: Code) {
        self.refusals.push((Some(field.to_string()), code));
    }

    fn refused(&self, field: &str) -> bool {
        self.refusals
            .iter()
            .any(|(refused, _)| refused.as_deref() == Some(field))
    }

    pub fn read(&mut self, inputs: &Map<String, Value>) -> Result<Values> {
        let scenario = self.scenario;
        let mut values = Values::default();
        for key in inputs.keys() {
            if !scenario.inputs.iter().any(|input| &input.name == key) {
                self.refuse(key, Code::UnknownField);
            }
        }
        for input in &scenario.inputs {
            self.input(input, given(inputs.get(&input.name)), &mut values)?;
        }
        // Amounts come last: they need their account, and a default needs the amount it copies.
        let (plain, defaulted): (Vec<&Input>, Vec<&Input>) = scenario
            .inputs
            .iter()
            .filter(|input| matches!(input.kind, InputKind::Amount { .. }))
            .partition(|input| {
                matches!(&input.kind, InputKind::Amount { default, .. } if default.is_none())
            });
        for input in plain.into_iter().chain(defaulted) {
            self.amount(input, given(inputs.get(&input.name)), &mut values);
        }
        for input in &scenario.inputs {
            if let InputKind::Lines { columns } = &input.kind {
                self.row_amounts(&input.name, columns, inputs.get(&input.name), &mut values);
            }
        }
        for (a, b) in &scenario.distinct {
            let same = match (values.accounts.get(a), values.accounts.get(b)) {
                (Some(a), Some(b)) => a.id == b.id,
                _ => false,
            };
            if same {
                self.refuse(b, Code::SameAccount);
            }
        }
        Ok(values)
    }

    fn input(&mut self, input: &Input, value: Option<&Value>, values: &mut Values) -> Result<()> {
        let field = input.name.as_str();
        if matches!(input.kind, InputKind::Amount { .. }) {
            // Read after the accounts, by `amount`, which also knows its defaults.
            return Ok(());
        }
        if value.is_none() && input.required && !has_default(input) {
            self.refuse(field, Code::Required);
            return Ok(());
        }
        match &input.kind {
            InputKind::Amount { .. } => {}
            InputKind::Account {
                kinds,
                allow_new,
                default_system,
            } => {
                let account = match (value, default_system) {
                    (None, Some(key)) => Some(self.acc(self.books.system_account(key)?)?),
                    (None, None) => None,
                    (Some(value), _) => self.account(value, kinds, *allow_new, field)?,
                };
                if let Some(account) = account {
                    values.accounts.insert(field.to_string(), account);
                }
            }
            InputKind::Contact => {
                if let Some(value) = value {
                    if let Some(contact) = self.contact(value, field)? {
                        values.contacts.insert(field.to_string(), contact);
                    }
                }
            }
            InputKind::Rate { .. } => {
                if let Some(value) = value {
                    match value.as_str().map(Rate::parse) {
                        Some(Ok(rate)) => {
                            values.rates.insert(field.to_string(), rate);
                        }
                        _ => self.refuse(field, Code::Invalid),
                    }
                }
            }
            InputKind::Choice { options } => {
                if let Some(value) = value {
                    let chosen = value
                        .as_str()
                        .and_then(|id| options.iter().position(|option| option.id == id));
                    match chosen {
                        Some(index) => {
                            values.choices.insert(field.to_string(), index);
                        }
                        None => self.refuse(field, Code::Invalid),
                    }
                }
            }
            InputKind::Date => {
                if let Some(value) = value {
                    match value.as_str().filter(|text| is_date(text)) {
                        Some(date) => {
                            values.dates.insert(field.to_string(), date.to_string());
                        }
                        None => self.refuse(field, Code::Invalid),
                    }
                }
            }
            InputKind::Text { max } => {
                if let Some(value) = value {
                    match value.as_str() {
                        Some(text) if text.chars().count() > *max => {
                            self.refuse(field, Code::TooLong);
                        }
                        Some(text) => {
                            values.texts.insert(field.to_string(), text.to_string());
                        }
                        None => self.refuse(field, Code::Invalid),
                    }
                }
            }
            InputKind::Lines { columns } => {
                if let Some(value) = value {
                    let rows = self.rows(field, columns, value)?;
                    values.rows.insert(field.to_string(), rows);
                }
            }
        }
        Ok(())
    }

    /// The rows of a `lines` input with their accounts; their amounts are read later.
    fn rows(&mut self, list: &str, columns: &[Input], value: &Value) -> Result<Vec<Row>> {
        let Some(items) = value.as_array() else {
            self.refuse(list, Code::Invalid);
            return Ok(Vec::new());
        };
        let mut rows = Vec::with_capacity(items.len());
        for (index, item) in items.iter().enumerate() {
            let at = format!("{list}.{index}");
            let Some(cells) = item.as_object() else {
                self.refuse(&at, Code::Invalid);
                // A placeholder keeps the indexes of the rows that follow.
                rows.push(Row::default());
                continue;
            };
            for key in cells.keys() {
                if !columns.iter().any(|column| &column.name == key) {
                    self.refuse(&format!("{at}.{key}"), Code::UnknownField);
                }
            }
            let mut row = Row::default();
            for column in columns {
                let InputKind::Account {
                    kinds, allow_new, ..
                } = &column.kind
                else {
                    continue;
                };
                let field = format!("{at}.{}", column.name);
                match given(cells.get(&column.name)) {
                    None if column.required => self.refuse(&field, Code::Required),
                    None => {}
                    Some(value) => {
                        if let Some(account) = self.account(value, kinds, *allow_new, &field)? {
                            row.accounts.insert(column.name.clone(), account);
                        }
                    }
                }
            }
            rows.push(row);
        }
        Ok(rows)
    }

    fn amount(&mut self, input: &Input, value: Option<&Value>, values: &mut Values) {
        let InputKind::Amount {
            of,
            default,
            show_if_commodity_differs,
        } = &input.kind
        else {
            return;
        };
        let Some(account) = values.accounts.get(of).cloned() else {
            // An amount without its account cannot be placed; say so unless the account is
            // already refused.
            if value.is_some() && !self.refused(of) {
                self.refuse(of, Code::Required);
            }
            return;
        };
        let differs = show_if_commodity_differs.as_ref().is_some_and(|(a, b)| {
            match (values.accounts.get(a), values.accounts.get(b)) {
                (Some(a), Some(b)) => a.commodity != b.commodity,
                _ => false,
            }
        });
        let hidden_copy = default
            .as_ref()
            .filter(|_| show_if_commodity_differs.is_some() && !differs)
            .and_then(|source| values.amounts.get(source).copied());
        let quantity = match value {
            Some(value) => {
                let given = self.quantity(value, &account, &input.name);
                // A hidden copy of another amount must not differ from it.
                match (given, hidden_copy) {
                    (Some(given), Some(copy)) if given.value != copy.value => {
                        self.refuse(&input.name, Code::Invalid);
                        None
                    }
                    _ => given,
                }
            }
            None => match default {
                Some(source) if !differs => values.amounts.get(source).copied(),
                _ if input.required => {
                    self.refuse(&input.name, Code::Required);
                    None
                }
                _ => Some(Quantity::of(0, account.commodity)),
            },
        };
        if let Some(quantity) = quantity {
            values.amounts.insert(input.name.clone(), quantity);
        }
    }

    fn row_amounts(
        &mut self,
        list: &str,
        columns: &[Input],
        value: Option<&Value>,
        values: &mut Values,
    ) {
        let items = value.and_then(Value::as_array).cloned().unwrap_or_default();
        let Some(mut rows) = values.rows.remove(list) else {
            return;
        };
        for (index, (row, item)) in rows.iter_mut().zip(&items).enumerate() {
            if !item.is_object() {
                // Refused when the rows were read; its placeholder has no amounts.
                continue;
            }
            for column in columns {
                let InputKind::Amount { of, .. } = &column.kind else {
                    continue;
                };
                let Some(account) = values.accounts.get(of).cloned() else {
                    continue;
                };
                let field = format!("{list}.{index}.{}", column.name);
                let quantity = match given(item.get(&column.name)) {
                    Some(value) => match self.quantity(value, &account, &field) {
                        // A row is a part of a total; a negative part is not one.
                        Some(part) if part.value < 0 => {
                            self.refuse(&field, Code::Invalid);
                            None
                        }
                        part => part,
                    },
                    None if column.required => {
                        self.refuse(&field, Code::Required);
                        None
                    }
                    None => Some(Quantity::of(0, account.commodity)),
                };
                if let Some(quantity) = quantity {
                    row.amounts.insert(column.name.clone(), quantity);
                }
            }
        }
        values.rows.insert(list.to_string(), rows);
    }

    fn quantity(&mut self, value: &Value, account: &Acc, field: &str) -> Option<Quantity> {
        let parsed = value
            .as_str()
            .map(|text| parse_amount(text, account.scale, Separators::CANONICAL));
        match parsed {
            Some(Ok(value)) => Some(Quantity::of(value, account.commodity)),
            _ => {
                self.refuse(field, Code::Invalid);
                None
            }
        }
    }

    fn account(
        &mut self,
        value: &Value,
        kinds: &[AccountKind],
        allow_new: bool,
        field: &str,
    ) -> Result<Option<Acc>> {
        let (id, view) = match reference(value) {
            Some(Reference::Id(id)) => match self.books.account(id) {
                Ok(view) => (id, view),
                Err(Error::MissingReference { .. }) => {
                    self.refuse(field, Code::Unknown);
                    return Ok(None);
                }
                Err(error) => return Err(error),
            },
            Some(Reference::New(name)) if allow_new => {
                return self.new_account(&name, kinds[0], field);
            }
            _ => {
                self.refuse(field, Code::Invalid);
                return Ok(None);
            }
        };
        if !kinds.contains(&view.kind) {
            self.refuse(field, Code::AccountKind);
            return Ok(None);
        }
        if view.archived {
            self.refuse(field, Code::AccountArchived);
            return Ok(None);
        }
        self.acc_from(id, view).map(Some)
    }

    /// A typed name: the top account of that name, one this draft already opens, or a new one.
    fn new_account(&mut self, name: &str, kind: AccountKind, field: &str) -> Result<Option<Acc>> {
        let name = name.trim();
        if name.is_empty() {
            self.refuse(field, Code::Required);
            return Ok(None);
        }
        let key = name_key(name);
        for id in self.books.child_accounts(None)? {
            let view = self.books.account(id)?;
            if name_key(&view.name) == key {
                if view.kind != kind || view.archived {
                    self.refuse(field, Code::AccountKind);
                    return Ok(None);
                }
                return self.acc_from(id, view).map(Some);
            }
        }
        let pending = self
            .new_accounts
            .iter()
            .find(|new| new.account.parent.is_none() && name_key(&new.account.name) == key)
            .map(|new| (new.id, new.account.name.clone()));
        let (id, name) = match pending {
            Some(found) => found,
            None => {
                let id = DocId::new();
                self.new_accounts.push(NewAccount {
                    id,
                    account: AccountInput {
                        name: name.to_string(),
                        parent: None,
                        kind,
                        commodity: self.base,
                    },
                });
                (id, name.to_string())
            }
        };
        Ok(Some(Acc {
            id,
            name,
            kind,
            commodity: self.base,
            scale: self.base_scale,
            code: self.base_code.clone(),
        }))
    }

    fn contact(&mut self, value: &Value, field: &str) -> Result<Option<(DocId, String)>> {
        match reference(value) {
            Some(Reference::Id(id)) => match self.books.contact(id) {
                Ok(view) => Ok(Some((id, view.name))),
                Err(Error::MissingReference { .. }) => {
                    self.refuse(field, Code::Unknown);
                    Ok(None)
                }
                Err(error) => Err(error),
            },
            Some(Reference::New(name)) => {
                let name = name.trim().to_string();
                if name.is_empty() {
                    self.refuse(field, Code::Required);
                    return Ok(None);
                }
                let key = name_key(&name);
                if let Some(found) = self
                    .books
                    .contacts()?
                    .into_iter()
                    .find(|(_, other)| name_key(other) == key)
                {
                    return Ok(Some(found));
                }
                let id = DocId::new();
                self.new_contacts.push(NewContact {
                    id,
                    contact: ContactInput {
                        name: name.clone(),
                        kind: ContactKind::Individual,
                    },
                });
                Ok(Some((id, name)))
            }
            None => {
                self.refuse(field, Code::Invalid);
                Ok(None)
            }
        }
    }

    pub fn acc(&self, id: DocId) -> Result<Acc> {
        let view = self.books.account(id)?;
        self.acc_from(id, view)
    }

    fn acc_from(&self, id: DocId, view: AccountView) -> Result<Acc> {
        let (code, scale) = self.books.commodity(view.commodity)?;
        Ok(Acc {
            id,
            name: view.name,
            kind: view.kind,
            commodity: view.commodity,
            scale,
            code,
        })
    }

    /// The system group `key` if it is in `commodity`, else its child in that commodity, else a
    /// child to open, named by the commodity code.
    pub fn system_account(&mut self, key: &str, commodity: DocId) -> Result<Acc> {
        let group = self.acc(self.books.system_account(key)?)?;
        if group.commodity == commodity {
            return Ok(group);
        }
        for id in self.books.child_accounts(Some(group.id))? {
            let view = self.books.account(id)?;
            if view.commodity == commodity && !view.archived {
                return self.acc_from(id, view);
            }
        }
        let (code, scale) = self.books.commodity(commodity)?;
        let pending = self
            .new_accounts
            .iter()
            .find(|new| new.account.parent == Some(group.id) && new.account.commodity == commodity)
            .map(|new| new.id);
        let id = match pending {
            Some(id) => id,
            None => {
                let id = DocId::new();
                self.new_accounts.push(NewAccount {
                    id,
                    account: AccountInput {
                        name: code.clone(),
                        parent: Some(group.id),
                        kind: group.kind,
                        commodity,
                    },
                });
                id
            }
        };
        Ok(Acc {
            id,
            name: code.clone(),
            kind: group.kind,
            commodity,
            scale,
            code,
        })
    }
}

/// A value the user gave: absent, null and empty text count as not given.
fn given(value: Option<&Value>) -> Option<&Value> {
    value.filter(|value| !value.is_null() && value.as_str() != Some(""))
}

fn has_default(input: &Input) -> bool {
    matches!(
        &input.kind,
        InputKind::Account {
            default_system: Some(_),
            ..
        }
    )
}

fn reference(value: &Value) -> Option<Reference> {
    let object = value.as_object().filter(|object| object.len() == 1)?;
    if let Some(id) = object.get("id") {
        return serde_json::from_value(id.clone()).ok().map(Reference::Id);
    }
    object
        .get("new")
        .and_then(Value::as_str)
        .map(|name| Reference::New(name.to_string()))
}

/// A civil date `YYYY-MM-DD` that exists in the Gregorian calendar.
fn is_date(text: &str) -> bool {
    let bytes = text.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    let number = |range: std::ops::Range<usize>| -> Option<u32> {
        let part = &text[range];
        if part.bytes().all(|b| b.is_ascii_digit()) {
            part.parse().ok()
        } else {
            None
        }
    };
    let (Some(year), Some(month), Some(day)) = (number(0..4), number(5..7), number(8..10)) else {
        return false;
    };
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };
    year >= 1 && (1..=days).contains(&day)
}
