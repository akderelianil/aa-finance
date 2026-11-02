//! Building the entry: the pack's checks over the values, then each line with its account, amount,
//! sign, conversion, rate and base value. A line in a foreign commodity takes its base value from
//! its rate, or from the line it is `base_of`; if neither gives one the user is asked for a rate.

use super::read::{Acc, Reader, Row, Values};
use super::{Code, Refusal};
use crate::amount::{format_amount, Separators};
use crate::error::Result;
use crate::ids::DocId;
use crate::ops::{EntryInput, LineInput};
use crate::rate::{to_base, Rate};
use crate::scenario::calc::{convert, Side};
use crate::scenario::expr::{Env, Quantity, Value};
use crate::scenario::pack::{
    AccountRef, InputKind, Line, LineAccount, LineSign, OptionValue, Scenario, Sign, SystemKey,
};
use std::collections::HashMap;

/// The values an expression sees: the scenario's, and the amounts of one row for a repeated line.
struct Scope<'a> {
    values: &'a Values,
    row: Option<&'a Row>,
}

impl Env for Scope<'_> {
    fn amount(&self, name: &str) -> Option<Quantity> {
        self.row
            .and_then(|row| row.amounts.get(name))
            .or_else(|| self.values.amounts.get(name))
            .copied()
    }

    fn flag(&self, _name: &str) -> Option<bool> {
        None
    }

    fn list(&self, list: &str, field: &str) -> Option<Vec<Quantity>> {
        let rows = self.values.rows.get(list)?;
        rows.iter()
            .map(|row| row.amounts.get(field).copied())
            .collect()
    }
}

/// The pack's checks that fail, each on its field. A check that gives no boolean is a fault of
/// the core's loader, not of the user.
pub(super) fn checks(scenario: &Scenario, values: &Values) -> Result<Vec<Refusal>> {
    let scope = Scope { values, row: None };
    let mut refusals: Vec<Refusal> = Vec::new();
    for check in &scenario.checks {
        let refusal = match check.rule.eval(&scope) {
            Ok(Value::Bool(true)) => continue,
            Ok(Value::Bool(false)) => (
                Some(check.field.clone()),
                Code::Check(check.message.clone()),
            ),
            Ok(Value::Amount(_)) => {
                return Err(crate::Error::Internal("a scenario check gave an amount"));
            }
            Err(_) => (None, Code::Calculation),
        };
        if !refusals.contains(&refusal) {
            refusals.push(refusal);
        }
    }
    Ok(refusals)
}

/// A line before its base value is known.
struct Built {
    id: String,
    account: Acc,
    value: i64,
    rate: Option<Rate>,
    base_of: Option<String>,
    rate_field: Option<String>,
    contact: Option<DocId>,
}

type Drafted = std::result::Result<EntryInput, Vec<Refusal>>;

/// The entry of the draft, or the refusals that keep it from being one.
pub(super) fn entry(reader: &mut Reader<'_>, values: &Values) -> Result<Drafted> {
    let scenario = reader.scenario;
    let rates = match commodity_rates(scenario, values) {
        Ok(rates) => rates,
        Err(refusal) => return Ok(Err(vec![refusal])),
    };
    let mut built = Vec::new();
    for line in &scenario.lines {
        let rows: Vec<Option<&Row>> = match &line.each {
            Some(list) => values
                .rows
                .get(list)
                .map(|rows| rows.iter().map(Some).collect())
                .unwrap_or_default(),
            None => vec![None],
        };
        let mut running = Running::default();
        for row in rows {
            match one_line(reader, values, &rates, line, row, &mut running)? {
                Ok(Some(line)) => built.push(line),
                Ok(None) => {}
                Err(refusals) => return Ok(Err(refusals)),
            }
        }
    }
    if built.len() < 2 {
        return Ok(Err(vec![(None, Code::TooFewLines)]));
    }
    let bases = match bases(reader, &built) {
        Ok(bases) => bases,
        Err(refusals) => return Ok(Err(refusals)),
    };
    // Only the accounts and contacts a line uses are opened; a left-out line opens nothing.
    let lines: Vec<LineInput> = built
        .iter()
        .zip(bases)
        .map(|(line, base)| line_input(reader, line, base))
        .collect();
    let date = values
        .dates
        .get(&scenario.date)
        .cloned()
        .ok_or(crate::Error::Internal("a draft without errors has no date"))?;
    Ok(Ok(EntryInput {
        date,
        memo: scenario
            .memo
            .as_ref()
            .and_then(|memo| values.texts.get(memo))
            .cloned(),
        no: None,
        create_accounts: reader
            .new_accounts
            .iter()
            .filter(|new| lines.iter().any(|line| line.account == new.id))
            .cloned()
            .collect(),
        create_contacts: reader
            .new_contacts
            .iter()
            .filter(|new| lines.iter().any(|line| line.contact == Some(new.id)))
            .cloned()
            .collect(),
        lines,
    }))
}

type LineResult = std::result::Result<Option<Built>, Vec<Refusal>>;

/// What the rows of one line have converted so far. Each row converts the running total and takes
/// the step from the last one, so the rows always add up to the converted total of their amounts
/// and rounding never splits across rows.
#[derive(Default)]
struct Running {
    source: i64,
    converted: i64,
}

fn one_line(
    reader: &mut Reader<'_>,
    values: &Values,
    rates: &HashMap<DocId, (Rate, String)>,
    line: &Line,
    row: Option<&Row>,
    running: &mut Running,
) -> Result<LineResult> {
    let scope = Scope { values, row };
    if let Some(when) = &line.when {
        match when.eval(&scope) {
            Ok(Value::Bool(true)) => {}
            Ok(_) => return Ok(Ok(None)),
            Err(_) => return Ok(Err(vec![(None, Code::Calculation)])),
        }
    }
    let Some(account) = line_account(reader, values, line, row)? else {
        return Ok(Ok(None));
    };
    let Ok(Value::Amount(quantity)) = line.amount.eval(&scope) else {
        return Ok(Err(vec![(None, Code::Calculation)]));
    };
    let value = match quantity.commodity {
        Some(from) if from != account.commodity => {
            if !line.convert {
                return Ok(Err(vec![(None, Code::Calculation)]));
            }
            let from = match side(reader, values, rates, from)? {
                Ok(side) => side,
                Err(refusal) => return Ok(Err(vec![refusal])),
            };
            let to = match side(reader, values, rates, account.commodity)? {
                Ok(side) => side,
                Err(refusal) => return Ok(Err(vec![refusal])),
            };
            let source = running.source.checked_add(quantity.value);
            let total = source.and_then(|source| convert(source, from, to, reader.base_scale).ok());
            let (Some(source), Some(total)) = (source, total) else {
                return Ok(Err(vec![(None, Code::Calculation)]));
            };
            let Some(step) = total.checked_sub(running.converted) else {
                return Ok(Err(vec![(None, Code::Calculation)]));
            };
            *running = Running {
                source,
                converted: total,
            };
            step
        }
        _ => quantity.value,
    };
    let Some(sign) = sign(reader.scenario, values, &line.sign) else {
        return Ok(Err(vec![(None, Code::Calculation)]));
    };
    let value = match sign {
        Sign::Debit => Some(value),
        Sign::Credit => value.checked_neg(),
    };
    let Some(value) = value else {
        return Ok(Err(vec![(None, Code::Calculation)]));
    };
    if value == 0 {
        return Ok(Ok(None));
    }
    let rate = if account.commodity == reader.base {
        None
    } else {
        line.rate
            .as_ref()
            .and_then(|input| values.rates.get(input))
            .copied()
    };
    Ok(Ok(Some(Built {
        id: line.id.clone(),
        account,
        value,
        rate,
        base_of: line.base_of.clone(),
        rate_field: line.rate.clone(),
        contact: line
            .contact
            .as_ref()
            .and_then(|input| values.contacts.get(input))
            .map(|(id, _)| *id),
    })))
}

/// One end of a conversion; a foreign commodity without a rate asks for one.
fn side(
    reader: &Reader<'_>,
    values: &Values,
    rates: &HashMap<DocId, (Rate, String)>,
    commodity: DocId,
) -> Result<std::result::Result<Side, Refusal>> {
    if commodity == reader.base {
        return Ok(Ok(Side::BASE));
    }
    let Some((rate, _)) = rates.get(&commodity) else {
        let field = rate_input_of(reader.scenario, values, commodity);
        return Ok(Err((field, Code::RateNeeded)));
    };
    let (_, scale) = reader.books.commodity(commodity)?;
    Ok(Ok(Side::foreign(scale, *rate)))
}

fn line_account(
    reader: &mut Reader<'_>,
    values: &Values,
    line: &Line,
    row: Option<&Row>,
) -> Result<Option<Acc>> {
    match &line.account {
        LineAccount::Input(name) => Ok(row
            .and_then(|row| row.accounts.get(name))
            .or_else(|| values.accounts.get(name))
            .cloned()),
        LineAccount::System { key, commodity_of } => {
            let key = match key {
                SystemKey::Fixed(key) => Some(key.clone()),
                SystemKey::Choice { choice, value } => {
                    match chosen(reader.scenario, values, choice, value) {
                        Some(OptionValue::System(key)) => Some(key.clone()),
                        _ => None,
                    }
                }
            };
            let (Some(key), Some(target)) = (key, values.accounts.get(commodity_of)) else {
                return Ok(None);
            };
            reader.system_account(&key, target.commodity).map(Some)
        }
    }
}

fn chosen<'a>(
    scenario: &'a Scenario,
    values: &Values,
    choice: &str,
    value: &str,
) -> Option<&'a OptionValue> {
    let index = *values.choices.get(choice)?;
    let options = scenario.inputs.iter().find_map(|input| match &input.kind {
        InputKind::Choice { options } if input.name == choice => Some(options),
        _ => None,
    })?;
    options.get(index)?.values.get(value)
}

fn sign(scenario: &Scenario, values: &Values, sign: &LineSign) -> Option<Sign> {
    match sign {
        LineSign::Fixed(sign) => Some(*sign),
        LineSign::Choice { choice, value } => match chosen(scenario, values, choice, value)? {
            OptionValue::Sign(sign) => Some(*sign),
            OptionValue::System(_) => None,
        },
    }
}

/// The rates the user gave, by the commodity of the account each one values. Rows of a list share
/// one commodity in v1.
fn commodity_rates(
    scenario: &Scenario,
    values: &Values,
) -> std::result::Result<HashMap<DocId, (Rate, String)>, Refusal> {
    let mut rates = HashMap::new();
    for input in &scenario.inputs {
        let InputKind::Rate { of } = &input.kind else {
            continue;
        };
        let commodity = commodity_of(values, of)?;
        if let (Some(commodity), Some(rate)) = (commodity, values.rates.get(&input.name)) {
            match rates.get(&commodity) {
                // Two rates for one currency must agree; the draft cannot pick one.
                Some((first, _)) if first != rate => {
                    return Err((Some(input.name.clone()), Code::Invalid));
                }
                Some(_) => {}
                None => {
                    rates.insert(commodity, (*rate, input.name.clone()));
                }
            }
        }
    }
    Ok(rates)
}

fn commodity_of(values: &Values, of: &AccountRef) -> std::result::Result<Option<DocId>, Refusal> {
    match of {
        AccountRef::Input(name) => Ok(values.accounts.get(name).map(|acc| acc.commodity)),
        AccountRef::Column { list, column } => {
            let rows = values.rows.get(list).map(Vec::as_slice).unwrap_or_default();
            let mut commodities = rows
                .iter()
                .filter_map(|row| row.accounts.get(column).map(|acc| acc.commodity));
            let first = commodities.next();
            if commodities.any(|other| Some(other) != first) {
                return Err((Some(list.clone()), Code::MixedCommodities));
            }
            Ok(first)
        }
    }
}

/// The rate input that values accounts of `commodity`, to point the user at.
fn rate_input_of(scenario: &Scenario, values: &Values, commodity: DocId) -> Option<String> {
    scenario.inputs.iter().find_map(|input| match &input.kind {
        InputKind::Rate { of } if commodity_of(values, of).ok().flatten() == Some(commodity) => {
            Some(input.name.clone())
        }
        _ => None,
    })
}

/// The base value of every line: its own, or the one of the line it is `base_of`, with its sign.
fn bases(reader: &Reader<'_>, built: &[Built]) -> std::result::Result<Vec<i64>, Vec<Refusal>> {
    let calculation = || vec![(None, Code::Calculation)];
    let mut bases = built
        .iter()
        .map(|line| {
            if line.account.commodity == reader.base {
                Ok(Some(line.value))
            } else if let Some(rate) = &line.rate {
                to_base(line.value, line.account.scale, rate, reader.base_scale)
                    .map(Some)
                    .map_err(|_| calculation())
            } else {
                Ok(None)
            }
        })
        .collect::<std::result::Result<Vec<_>, _>>()?;
    for _ in 0..built.len() {
        for (index, line) in built.iter().enumerate() {
            let (None, Some(target)) = (bases[index], &line.base_of) else {
                continue;
            };
            let targets: Option<Vec<i64>> = built
                .iter()
                .zip(&bases)
                .filter(|(other, _)| &other.id == target)
                .map(|(_, base)| *base)
                .collect();
            let Some(targets) = targets.filter(|targets| !targets.is_empty()) else {
                continue;
            };
            let total = targets
                .iter()
                .try_fold(0i64, |sum, base| sum.checked_add(*base))
                .and_then(i64::checked_abs)
                .ok_or_else(calculation)?;
            bases[index] = Some(total * line.value.signum());
        }
    }
    let unresolved = |id: &String| {
        built
            .iter()
            .zip(&bases)
            .any(|(other, base)| &other.id == id && base.is_none())
    };
    let mut refusals: Vec<Refusal> = Vec::new();
    for (line, base) in built.iter().zip(&bases) {
        // A line that takes its base from an unresolved line adds nothing to that line's refusal.
        if line.base_of.as_ref().is_some_and(unresolved) {
            continue;
        }
        let refusal = (line.rate_field.clone(), Code::RateNeeded);
        if base.is_none() && !refusals.contains(&refusal) {
            refusals.push(refusal);
        }
    }
    if !refusals.is_empty() {
        return Err(refusals);
    }
    Ok(bases.into_iter().flatten().collect())
}

fn line_input(reader: &Reader<'_>, line: &Built, base: i64) -> LineInput {
    let foreign = line.account.commodity != reader.base;
    LineInput {
        account: line.account.id,
        amount: format_amount(line.value, line.account.scale, Separators::CANONICAL),
        rate: line.rate.filter(|_| foreign).map(|rate| rate.to_text()),
        base: (foreign && line.rate.is_none())
            .then(|| format_amount(base, reader.base_scale, Separators::CANONICAL)),
        contact: line.contact,
    }
}
