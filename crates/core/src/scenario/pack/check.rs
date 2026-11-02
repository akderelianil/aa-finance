//! Turns the raw pack into the checked model. Every name is checked against the grammar and for
//! uniqueness, every reference against the kind of thing it must name, every string in both
//! languages, and every expression is compiled with its type. The first fault refuses the pack.

use super::raw;
use super::{
    AccountRef, Check, ChoiceOption, Fault, Input, InputKind, Line, LineAccount, LineSign,
    OptionValue, PackError, Scenario, Sign, SystemKey, LANGUAGES,
};
use crate::scenario::expr::{compile, Expr, Names, Type as ExprType};
use std::collections::{BTreeMap, HashMap, HashSet};

type Strings = BTreeMap<String, BTreeMap<String, String>>;

/// The longest name a pack may use.
const MAX_NAME: usize = 64;
/// Words of the expression grammar, which cannot be names.
const RESERVED: [&str; 4] = ["and", "or", "not", "sum"];
/// The length of a text input when the pack does not say.
const DEFAULT_TEXT_MAX: usize = 200;
/// The longest text input a pack may ask for.
const MAX_TEXT: usize = 1000;

fn fault(at: &str, fault: Fault) -> PackError {
    PackError::Fault {
        at: at.to_string(),
        fault,
    }
}

fn is_name(text: &str) -> bool {
    let mut chars = text.chars();
    text.len() <= MAX_NAME
        && !RESERVED.contains(&text)
        && matches!(chars.next(), Some('a'..='z'))
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

fn name(text: &str) -> Result<(), Fault> {
    if is_name(text) {
        Ok(())
    } else {
        Err(Fault::BadName(text.to_string()))
    }
}

fn required<T>(value: Option<T>, field: &'static str) -> Result<T, Fault> {
    value.ok_or(Fault::MissingField(field))
}

pub(super) fn scenarios(
    raws: Vec<raw::Scenario>,
    strings: &Strings,
) -> Result<Vec<Scenario>, PackError> {
    let mut seen = HashSet::new();
    let mut scenarios = Vec::with_capacity(raws.len());
    for raw in raws {
        name(&raw.id).map_err(|f| fault(&raw.id, f))?;
        if !seen.insert(raw.id.clone()) {
            return Err(fault(&raw.id, Fault::Duplicate(raw.id.clone())));
        }
        scenarios.push(Builder::index(&raw)?.build(raw, strings)?);
    }
    Ok(scenarios)
}

/// The names of one scenario, known before its parts are checked, so references may point forward.
struct Builder {
    id: String,
    top: HashMap<String, raw::Type>,
    columns: HashMap<String, HashMap<String, raw::Type>>,
    /// The values the first option of each choice sets; every option sets the same kinds.
    choices: HashMap<String, BTreeMap<String, OptionValue>>,
}

impl Builder {
    fn index(raw: &raw::Scenario) -> Result<Builder, PackError> {
        let mut builder = Builder {
            id: raw.id.clone(),
            top: HashMap::new(),
            columns: HashMap::new(),
            choices: HashMap::new(),
        };
        let mut all = HashSet::new();
        for input in &raw.inputs {
            let at = format!("{}.inputs.{}", raw.id, input.name);
            builder.claim(&mut all, &input.name, &at)?;
            builder.top.insert(input.name.clone(), input.ty);
            let mut columns = HashMap::new();
            for column in input.columns.iter().flatten() {
                let at = format!("{at}.{}", column.name);
                builder.claim(&mut all, &column.name, &at)?;
                columns.insert(column.name.clone(), column.ty);
            }
            if input.ty == raw::Type::Lines {
                builder.columns.insert(input.name.clone(), columns);
            }
        }
        Ok(builder)
    }

    fn claim(&self, all: &mut HashSet<String>, text: &str, at: &str) -> Result<(), PackError> {
        name(text).map_err(|f| fault(at, f))?;
        if !all.insert(text.to_string()) {
            return Err(fault(at, Fault::Duplicate(text.to_string())));
        }
        Ok(())
    }

    fn build(mut self, raw: raw::Scenario, strings: &Strings) -> Result<Scenario, PackError> {
        let id = self.id.clone();
        let mut inputs = Vec::with_capacity(raw.inputs.len());
        for input in raw.inputs {
            let at = format!("{id}.inputs.{}", input.name);
            inputs.push(self.input(input, &at, false)?);
        }
        let on = |field: &str| format!("{id}.{field}");
        self.expect(&raw.date, raw::Type::Date)
            .map_err(|f| fault(&on("date"), f))?;
        if let Some(memo) = &raw.memo {
            self.expect(memo, raw::Type::Text)
                .map_err(|f| fault(&on("memo"), f))?;
        }
        for (a, b) in &raw.distinct {
            self.expect(a, raw::Type::Account)
                .and_then(|()| self.expect(b, raw::Type::Account))
                .map_err(|f| fault(&on("distinct"), f))?;
        }
        let checks = raw
            .checks
            .into_iter()
            .map(|check| self.check(check))
            .collect::<Result<Vec<_>, _>>()?;
        let lines = self.lines(raw.lines)?;
        let scenario = Scenario {
            id: id.clone(),
            title: raw.title,
            date: raw.date,
            memo: raw.memo,
            distinct: raw.distinct,
            inputs,
            checks,
            lines,
            preview: raw.preview,
        };
        self.strings(&scenario, strings)
            .map_err(|f| fault(&on("strings"), f))?;
        Ok(scenario)
    }

    /// A name of the scenario's own inputs, of the type given.
    fn expect(&self, text: &str, ty: raw::Type) -> Result<(), Fault> {
        match self.top.get(text) {
            None => Err(Fault::UnknownName(text.to_string())),
            Some(found) if *found != ty => Err(Fault::WrongKind(text.to_string())),
            Some(_) => Ok(()),
        }
    }

    fn account_ref(&self, text: &str) -> Result<AccountRef, Fault> {
        let Some((list, column)) = text.split_once('.') else {
            self.expect(text, raw::Type::Account)?;
            return Ok(AccountRef::Input(text.to_string()));
        };
        match self
            .columns
            .get(list)
            .and_then(|columns| columns.get(column))
        {
            None => Err(Fault::UnknownName(text.to_string())),
            Some(raw::Type::Account) => Ok(AccountRef::Column {
                list: list.to_string(),
                column: column.to_string(),
            }),
            Some(_) => Err(Fault::WrongKind(text.to_string())),
        }
    }

    /// `choice.value`, where the value is a sign (`want_sign`) or a system key.
    fn choice_value(&self, text: &str, want_sign: bool) -> Result<(String, String), Fault> {
        let unknown = || Fault::UnknownName(text.to_string());
        let (choice, value) = text.split_once('.').ok_or_else(unknown)?;
        self.expect(choice, raw::Type::Choice)
            .map_err(|_| Fault::WrongKind(text.to_string()))?;
        let found = self
            .choices
            .get(choice)
            .and_then(|values| values.get(value))
            .ok_or_else(unknown)?;
        if matches!(found, OptionValue::Sign(_)) != want_sign {
            return Err(Fault::WrongKind(text.to_string()));
        }
        Ok((choice.to_string(), value.to_string()))
    }

    fn input(&mut self, raw: raw::Input, at: &str, in_list: bool) -> Result<Input, PackError> {
        let on = |f| fault(at, f);
        let allowed: &[&str] = match raw.ty {
            raw::Type::Amount => &["of", "default", "show_if_commodity_differs"],
            raw::Type::Account => &["kinds", "new", "default_system"],
            raw::Type::Rate => &["of"],
            raw::Type::Choice => &["options"],
            raw::Type::Lines => &["columns"],
            raw::Type::Text => &["max"],
            raw::Type::Contact | raw::Type::Date => &[],
        };
        if let Some(field) = raw
            .present_fields()
            .into_iter()
            .find(|field| !allowed.contains(field))
        {
            return Err(on(Fault::FieldNotAllowed(field)));
        }
        if in_list && !matches!(raw.ty, raw::Type::Account | raw::Type::Amount) {
            return Err(on(Fault::WrongKind(raw.name)));
        }
        let kind = match raw.ty {
            raw::Type::Amount => self.amount(&raw).map_err(on)?,
            raw::Type::Account => account(&raw).map_err(on)?,
            raw::Type::Rate => InputKind::Rate {
                of: self
                    .account_ref(required(raw.of.as_deref(), "of").map_err(on)?)
                    .map_err(on)?,
            },
            raw::Type::Contact => InputKind::Contact,
            raw::Type::Date => InputKind::Date,
            raw::Type::Text => {
                let max = raw.max.unwrap_or(DEFAULT_TEXT_MAX);
                if max == 0 || max > MAX_TEXT {
                    return Err(on(Fault::BadMax));
                }
                InputKind::Text { max }
            }
            raw::Type::Choice => {
                let options = required(raw.options, "options").map_err(on)?;
                InputKind::Choice {
                    options: self.options(&raw.name, options, at)?,
                }
            }
            raw::Type::Lines => {
                let columns = required(raw.columns, "columns").map_err(on)?;
                let columns = columns
                    .into_iter()
                    .map(|column| {
                        let at = format!("{at}.{}", column.name);
                        self.input(column, &at, true)
                    })
                    .collect::<Result<Vec<_>, _>>()?;
                InputKind::Lines { columns }
            }
        };
        Ok(Input {
            name: raw.name,
            label: raw.label,
            required: raw.required.unwrap_or(true),
            kind,
        })
    }

    fn amount(&self, raw: &raw::Input) -> Result<InputKind, Fault> {
        let of = required(raw.of.clone(), "of")?;
        self.expect(&of, raw::Type::Account)?;
        if let Some(default) = &raw.default {
            self.expect(default, raw::Type::Amount)?;
        }
        if let Some((a, b)) = &raw.show_if_commodity_differs {
            self.expect(a, raw::Type::Account)?;
            self.expect(b, raw::Type::Account)?;
        }
        Ok(InputKind::Amount {
            of,
            default: raw.default.clone(),
            show_if_commodity_differs: raw.show_if_commodity_differs.clone(),
        })
    }

    fn options(
        &mut self,
        choice: &str,
        raws: Vec<raw::ChoiceOption>,
        at: &str,
    ) -> Result<Vec<ChoiceOption>, PackError> {
        let on = |f| fault(at, f);
        if raws.is_empty() {
            return Err(on(Fault::NoOptions));
        }
        let mut ids = HashSet::new();
        let mut options: Vec<ChoiceOption> = Vec::with_capacity(raws.len());
        for raw in raws {
            name(&raw.id).map_err(on)?;
            if !ids.insert(raw.id.clone()) {
                return Err(on(Fault::Duplicate(raw.id)));
            }
            let values = raw
                .values
                .into_iter()
                .map(|(key, value)| Ok((key.clone(), option_value(&key, value)?)))
                .collect::<Result<BTreeMap<_, _>, Fault>>()
                .map_err(on)?;
            if let Some(first) = options.first() {
                if shape(&first.values) != shape(&values) {
                    return Err(on(Fault::OptionValuesDiffer));
                }
            }
            options.push(ChoiceOption {
                id: raw.id,
                label: raw.label,
                values,
            });
        }
        self.choices
            .insert(choice.to_string(), options[0].values.clone());
        Ok(options)
    }

    fn names(&self) -> Names {
        let mut names = Names::default();
        for (input, ty) in &self.top {
            if *ty == raw::Type::Amount {
                names = names.scalar(input, ExprType::Amount);
            }
        }
        for (list, columns) in &self.columns {
            for (column, ty) in columns {
                if *ty == raw::Type::Amount {
                    names = names.list_field(list, column);
                }
            }
        }
        names
    }

    /// The names of a line that repeats over `list`: the scenario's names and the row's amounts.
    fn row_names(&self, list: &str) -> Names {
        let mut names = self.names();
        for (column, ty) in self.columns.get(list).into_iter().flatten() {
            if *ty == raw::Type::Amount {
                names = names.scalar(column, ExprType::Amount);
            }
        }
        names
    }

    fn check(&self, raw: raw::Check) -> Result<Check, PackError> {
        let at = format!("{}.checks.{}", self.id, raw.field);
        if !self.top.contains_key(&raw.field) {
            return Err(fault(&at, Fault::UnknownName(raw.field)));
        }
        let rule = typed(&raw.rule, &self.names(), ExprType::Bool).map_err(|f| fault(&at, f))?;
        Ok(Check {
            rule,
            field: raw.field,
            message: raw.message,
        })
    }

    fn lines(&self, raws: Vec<raw::Line>) -> Result<Vec<Line>, PackError> {
        let mut ids = HashSet::new();
        for line in &raws {
            let at = format!("{}.lines.{}", self.id, line.id);
            name(&line.id).map_err(|f| fault(&at, f))?;
            if !ids.insert(line.id.clone()) {
                return Err(fault(&at, Fault::Duplicate(line.id.clone())));
            }
        }
        raws.into_iter().map(|raw| self.line(raw, &ids)).collect()
    }

    fn line(&self, raw: raw::Line, ids: &HashSet<String>) -> Result<Line, PackError> {
        let at = |field: &str| format!("{}.lines.{}.{field}", self.id, raw.id);
        let on = |field: &'static str| move |f| fault(&at(field), f);
        if let Some(list) = &raw.each {
            self.expect(list, raw::Type::Lines).map_err(on("each"))?;
        }
        let account = self
            .line_account(&raw.account, raw.each.as_deref())
            .map_err(on("account"))?;
        let names = match &raw.each {
            Some(list) => self.row_names(list),
            None => self.names(),
        };
        let amount = typed(&raw.amount, &names, ExprType::Amount).map_err(on("amount"))?;
        let when = raw
            .when
            .as_deref()
            .map(|text| typed(text, &names, ExprType::Bool))
            .transpose()
            .map_err(on("when"))?;
        let sign = self.sign(raw.sign.as_deref()).map_err(on("sign"))?;
        if let Some(rate) = &raw.rate {
            self.expect(rate, raw::Type::Rate).map_err(on("rate"))?;
        }
        if let Some(contact) = &raw.contact {
            self.expect(contact, raw::Type::Contact)
                .map_err(on("contact"))?;
        }
        if let Some(other) = &raw.base_of {
            if !ids.contains(other) {
                return Err(fault(&at("base_of"), Fault::UnknownName(other.clone())));
            }
        }
        Ok(Line {
            id: raw.id,
            each: raw.each,
            account,
            amount,
            sign,
            convert: raw.convert,
            rate: raw.rate,
            base_of: raw.base_of,
            contact: raw.contact,
            when,
        })
    }

    fn line_account(
        &self,
        raw: &raw::LineAccount,
        each: Option<&str>,
    ) -> Result<LineAccount, Fault> {
        match raw {
            raw::LineAccount::Input(text) => {
                let column = each
                    .and_then(|list| self.columns.get(list))
                    .and_then(|columns| columns.get(text));
                match column {
                    Some(raw::Type::Account) => {}
                    Some(_) => return Err(Fault::WrongKind(text.clone())),
                    None => self.expect(text, raw::Type::Account)?,
                }
                Ok(LineAccount::Input(text.clone()))
            }
            raw::LineAccount::System(system) => {
                let key = if system.system.contains('.') {
                    let (choice, value) = self.choice_value(&system.system, false)?;
                    SystemKey::Choice { choice, value }
                } else {
                    name(&system.system)?;
                    SystemKey::Fixed(system.system.clone())
                };
                self.expect(&system.commodity_of, raw::Type::Account)?;
                Ok(LineAccount::System {
                    key,
                    commodity_of: system.commodity_of.clone(),
                })
            }
        }
    }

    fn sign(&self, text: Option<&str>) -> Result<LineSign, Fault> {
        match text {
            None | Some("+") => Ok(LineSign::Fixed(Sign::Debit)),
            Some("-") => Ok(LineSign::Fixed(Sign::Credit)),
            Some(text) if text.contains('.') => {
                let (choice, value) = self.choice_value(text, true)?;
                Ok(LineSign::Choice { choice, value })
            }
            Some(text) => Err(Fault::BadValue(text.to_string())),
        }
    }

    /// Every string the scenario names exists in every language, and the preview names inputs.
    fn strings(&self, scenario: &Scenario, strings: &Strings) -> Result<(), Fault> {
        let mut keys = vec![&scenario.title, &scenario.preview];
        let mut inputs: Vec<&Input> = scenario.inputs.iter().collect();
        while let Some(input) = inputs.pop() {
            keys.push(&input.label);
            match &input.kind {
                InputKind::Choice { options } => keys.extend(options.iter().map(|o| &o.label)),
                InputKind::Lines { columns } => inputs.extend(columns.iter()),
                _ => {}
            }
        }
        keys.extend(scenario.checks.iter().map(|check| &check.message));
        for language in LANGUAGES {
            let table = strings.get(language);
            for key in &keys {
                if table.and_then(|table| table.get(*key)).is_none() {
                    return Err(Fault::MissingString {
                        key: (*key).clone(),
                        language: language.to_string(),
                    });
                }
            }
            let preview = table
                .and_then(|table| table.get(&scenario.preview))
                .map_or("", String::as_str);
            for placeholder in placeholders(preview) {
                if !self.top.contains_key(placeholder) {
                    return Err(Fault::UnknownName(placeholder.to_string()));
                }
            }
        }
        Ok(())
    }
}

fn account(raw: &raw::Input) -> Result<InputKind, Fault> {
    let kinds = required(raw.kinds.clone(), "kinds")?;
    if kinds.is_empty() {
        return Err(Fault::NoKinds);
    }
    let allow_new = raw.new.unwrap_or(false);
    if allow_new && kinds.len() != 1 {
        return Err(Fault::NewNeedsOneKind);
    }
    if let Some(key) = &raw.default_system {
        name(key)?;
    }
    Ok(InputKind::Account {
        kinds,
        allow_new,
        default_system: raw.default_system.clone(),
    })
}

fn option_value(key: &str, value: String) -> Result<OptionValue, Fault> {
    name(key)?;
    match value.as_str() {
        "+" => Ok(OptionValue::Sign(Sign::Debit)),
        "-" => Ok(OptionValue::Sign(Sign::Credit)),
        _ if is_name(&value) => Ok(OptionValue::System(value)),
        _ => Err(Fault::BadValue(value)),
    }
}

/// The value names of an option and whether each is a sign.
fn shape(values: &BTreeMap<String, OptionValue>) -> Vec<(&String, bool)> {
    values
        .iter()
        .map(|(key, value)| (key, matches!(value, OptionValue::Sign(_))))
        .collect()
}

fn typed(text: &str, names: &Names, want: ExprType) -> Result<Expr, Fault> {
    let expr = compile(text, names).map_err(Fault::Expr)?;
    if expr.ty() != want {
        return Err(Fault::WrongType);
    }
    Ok(expr)
}

/// The `{name}` placeholders of a preview text.
fn placeholders(text: &str) -> impl Iterator<Item = &str> {
    text.split('{')
        .skip(1)
        .filter_map(|part| part.split_once('}').map(|(name, _)| name))
}
