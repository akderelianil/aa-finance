//! Edges of scenario drafts (ADR-0024): every input type refuses a value of the wrong shape, rows
//! name their faults, typed names are reused or refused by kind, rates are asked for exactly where
//! a conversion or a base value needs one, and a pack's own faults come back as errors.

use super::common::*;
use aa_core::body::AccountKind::{Asset, Expense};
use aa_core::scenario::draft::{draft as draft_with, DraftInput, Language};
use serde_json::{json, Value};

fn expense(b: &Book, market: DocId) -> Value {
    json!({
        "amount": "5.00", "payment": pick(b.cash), "date": "2026-11-02",
        "items": [{ "expense": pick(market), "part": "5.00" }],
    })
}

fn debt(b: &Book) -> Value {
    json!({
        "direction": "lend", "person": { "new": "Ayşe" }, "money": pick(b.cash),
        "amount": "5.00", "date": "2026-11-02",
    })
}

fn set(mut inputs: Value, key: &str, value: Value) -> Value {
    inputs[key] = value;
    inputs
}

fn only_error(b: &Book, scenario: &str, inputs: Value) -> (Option<String>, String) {
    let draft = draft(b, scenario, inputs);
    let errors = errors(&draft);
    assert_eq!(errors.len(), 1, "{errors:?}");
    errors[0].clone()
}

#[test]
fn every_input_type_refuses_a_value_of_the_wrong_shape() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let base = expense(&b, market);
    let cases = [
        ("payment_rate", json!("abc")),
        ("date", json!(20261102)),
        ("memo", json!(5)),
        ("items", json!("market")),
        ("payment", json!("cash")),
    ];
    for (key, value) in cases {
        // Act
        let error = only_error(&b, "expense", set(base.clone(), key, value));
        // Assert
        assert_eq!(error, (Some(key.into()), "invalid".into()), "{key}");
    }
    let debt = debt(&b);
    assert_eq!(
        only_error(&b, "debt", set(debt.clone(), "direction", json!("steal"))),
        (Some("direction".into()), "invalid".into())
    );
    assert_eq!(
        only_error(&b, "debt", set(debt.clone(), "person", json!(["Ayşe"]))),
        (Some("person".into()), "invalid".into())
    );
    assert_eq!(
        only_error(&b, "debt", set(debt.clone(), "person", pick(DocId::new()))),
        (Some("person".into()), "unknown".into())
    );
    assert_eq!(
        only_error(&b, "debt", set(debt, "person", json!({ "new": "  " }))),
        (Some("person".into()), "required".into())
    );
}

#[test]
fn a_row_names_its_own_faults() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let base = expense(&b, market);
    let cases = [
        (json!(["market"]), "items.0", "invalid"),
        (
            json!([{ "expense": pick(market), "part": "5.00", "note": "x" }]),
            "items.0.note",
            "unknown_field",
        ),
        (
            json!([{ "expense": pick(market) }]),
            "items.0.part",
            "required",
        ),
        (
            json!([{ "expense": { "new": " " }, "part": "5.00" }]),
            "items.0.expense",
            "required",
        ),
        (
            json!([{ "expense": { "new": "cash" }, "part": "5.00" }]),
            "items.0.expense",
            "account_kind",
        ),
    ];
    for (items, field, code) in cases {
        // Act
        let error = only_error(&b, "expense", set(base.clone(), "items", items));
        // Assert
        assert_eq!(error, (Some(field.into()), code.into()), "{field}");
    }
}

#[test]
fn an_archived_account_is_refused_and_a_typed_contact_name_is_reused() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let old = open(&mut b.ledger, "Old", Asset, b.try_id);
    b.ledger.set_account_archived(old, true).unwrap();
    let ayse = b
        .ledger
        .create_contact(aa_core::ops::ContactInput {
            name: "Ayşe".into(),
            kind: aa_core::body::ContactKind::Individual,
        })
        .unwrap()
        .doc_id;
    // Act
    let archived = only_error(
        &b,
        "expense",
        set(expense(&b, market), "payment", pick(old)),
    );
    let reused = draft(
        &b,
        "debt",
        set(debt(&b), "person", json!({ "new": "AYŞE" })),
    );
    // Assert
    assert_eq!(
        archived,
        (Some("payment".into()), "account_archived".into())
    );
    let entry = reused.entry.unwrap();
    assert!(entry.create_contacts.is_empty());
    assert_eq!(entry.lines[1].contact, Some(ayse));
}

#[test]
fn split_rows_in_two_currencies_are_refused() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let travel = open(&mut b.ledger, "Travel", Expense, b.usd_id);
    let items = json!([
        { "expense": pick(market), "part": "3.00" },
        { "expense": pick(travel), "part": "2.00" },
    ]);
    // Act
    let error = only_error(&b, "expense", set(expense(&b, market), "items", items));
    // Assert
    assert_eq!(error, (Some("items".into()), "mixed_commodities".into()));
}

#[test]
fn a_foreign_expense_account_asks_for_its_own_rate_and_then_takes_it() {
    // Arrange
    let mut b = book();
    let travel = open(&mut b.ledger, "Travel", Expense, b.usd_id);
    let inputs = expense(&b, travel);
    // Act
    let without = only_error(&b, "expense", inputs.clone());
    let with = draft(&b, "expense", set(inputs, "expense_rate", json!("25")));
    // Assert
    assert_eq!(without, (Some("expense_rate".into()), "rate_needed".into()));
    assert_eq!(
        post_draft(&mut b, &with),
        vec![
            (travel, "0.20".into(), "5.00".into()),
            (b.cash, "-5.00".into(), "-5.00".into()),
        ]
    );
}

#[test]
fn a_transfer_between_two_foreign_currencies_asks_for_both_rates() {
    // Arrange
    let mut b = book();
    let eur = b.ledger.create_commodity("EUR", 2).unwrap().doc_id;
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    let euros = open(&mut b.ledger, "Euros", Asset, eur);
    // Act
    let draft = draft(
        &b,
        "transfer",
        json!({
            "amount": "10.00", "from": pick(dollars), "to": pick(euros),
            "amount_in": "9.00", "date": "2026-11-02",
        }),
    );
    // Assert
    assert_eq!(
        errors(&draft),
        vec![
            (Some("from_rate".into()), "rate_needed".into()),
            (Some("to_rate".into()), "rate_needed".into()),
        ]
    );
}

#[test]
fn a_fee_in_dollars_is_charged_to_the_fee_account_in_lira() {
    // Arrange
    let mut b = book();
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    let other = open(&mut b.ledger, "Other dollars", Asset, b.usd_id);
    let fees = b.ledger.system_account("bank_fee").unwrap();
    // Act
    let draft = draft(
        &b,
        "transfer",
        json!({
            "amount": "100.00", "from": pick(dollars), "to": pick(other), "fee": "1.00",
            "from_rate": "35", "date": "2026-11-02", "memo": "wire",
        }),
    );
    // Assert
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (dollars, "-100.00".into(), "-3500.00".into()),
            (other, "100.00".into(), "3500.00".into()),
            (dollars, "-1.00".into(), "-35.00".into()),
            (fees, "35.00".into(), "35.00".into()),
        ]
    );
}

/// A pack with one scenario and the given lines over an amount and two accounts.
fn pack_with(lines: Value) -> aa_core::scenario::pack::Pack {
    let text = json!({
        "schema": 1, "id": "edges",
        "scenarios": [{
            "id": "s", "title": "t", "date": "date",
            "inputs": [
                { "name": "amount", "type": "amount", "of": "here", "label": "t" },
                { "name": "here", "type": "account", "kinds": ["asset"], "label": "t" },
                { "name": "there", "type": "account", "kinds": ["asset"], "label": "t" },
                { "name": "date", "type": "date", "label": "t" }
            ],
            "lines": lines,
            "preview": "t"
        }],
        "strings": { "tr": { "t": "{amount} {here" }, "en": { "t": "t" } }
    });
    aa_core::scenario::pack::load(&text.to_string()).unwrap()
}

fn run(
    b: &Book,
    pack: &aa_core::scenario::pack::Pack,
    there: DocId,
) -> aa_core::scenario::draft::Draft {
    let input = DraftInput {
        scenario: "s".into(),
        language: Language::Tr,
        inputs: json!({
            "amount": "5.00", "here": pick(b.cash), "there": pick(there), "date": "2026-11-02",
        })
        .as_object()
        .unwrap()
        .clone(),
    };
    draft_with(pack, &b.ledger, &input).unwrap()
}

#[test]
fn a_pack_with_one_line_or_an_unconverted_mix_gets_an_error_not_an_entry() {
    // Arrange
    let mut b = book();
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    let one = pack_with(json!([{ "id": "a", "account": "here", "amount": "amount" }]));
    let mixed = pack_with(json!([
        { "id": "a", "account": "here", "amount": "amount" },
        { "id": "b", "account": "there", "amount": "amount", "sign": "-" }
    ]));
    // Act
    let single = run(&b, &one, dollars);
    let unconverted = run(&b, &mixed, dollars);
    // Assert
    assert_eq!(errors(&single), vec![(None, "too_few_lines".into())]);
    assert_eq!(errors(&unconverted), vec![(None, "calculation".into())]);
}

#[test]
fn a_fixed_system_account_and_an_unclosed_brace_in_the_preview_are_handled() {
    // Arrange
    let b = book();
    let fees = b.ledger.system_account("bank_fee").unwrap();
    let pack = pack_with(json!([
        { "id": "a", "account": { "system": "bank_fee", "commodity_of": "here" }, "amount": "amount" },
        { "id": "b", "account": "here", "amount": "amount", "sign": "-" }
    ]));
    // Act
    let draft = run(&b, &pack, b.food);
    // Assert
    assert_eq!(draft.entry.unwrap().lines[0].account, fees);
    assert_eq!(draft.preview.unwrap().text, "5,00 TRY {here");
}

#[test]
fn borrowing_dollars_gives_the_payable_line_a_negative_base_value() {
    // Arrange
    let mut b = book();
    let dollars = open(&mut b.ledger, "Dollars", Asset, b.usd_id);
    let inputs = json!({
        "direction": "borrow", "person": { "new": "Ahmet" }, "money": pick(dollars),
        "money_rate": "35", "amount": "100.00", "date": "2026-11-02",
    });
    // Act
    let draft = draft(&b, "debt", inputs);
    // Assert
    let child = draft.entry.as_ref().unwrap().create_accounts[0].id;
    assert_eq!(
        post_draft(&mut b, &draft),
        vec![
            (dollars, "100.00".into(), "3500.00".into()),
            (child, "-100.00".into(), "-3500.00".into()),
        ]
    );
}

#[test]
fn an_empty_required_input_of_any_type_is_required() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    for key in ["payment", "items", "date"] {
        // Act
        let error = only_error(&b, "expense", set(expense(&b, market), key, json!(null)));
        // Assert
        assert_eq!(error, (Some(key.into()), "required".into()), "{key}");
    }
    for key in ["direction", "person"] {
        let error = only_error(&b, "debt", set(debt(&b), key, json!("")));
        assert_eq!(error, (Some(key.into()), "required".into()), "{key}");
    }
}

#[test]
fn a_date_must_exist_in_the_calendar() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let valid = ["2024-02-29", "2000-02-29", "2026-12-31", "2026-04-30"];
    let invalid = [
        "2023-02-29",
        "1900-02-29",
        "2026-04-31",
        "2026-13-01",
        "2026-00-10",
        "2026-1-01",
        "20x6-01-01",
        "2026/01/01",
        "0000-01-01",
        "2026-01-32",
    ];
    // Act / Assert
    for date in valid {
        let draft = draft(&b, "expense", set(expense(&b, market), "date", json!(date)));
        assert!(draft.errors.is_empty(), "{date}");
    }
    for date in invalid {
        let error = only_error(&b, "expense", set(expense(&b, market), "date", json!(date)));
        assert_eq!(error, (Some("date".into()), "invalid".into()), "{date}");
    }
}

#[test]
fn a_split_row_of_zero_adds_no_line() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let items = json!([
        { "expense": pick(market), "part": "5.00" },
        { "expense": { "new": "Spare" }, "part": "0.00" },
    ]);
    // Act
    let draft = draft(&b, "expense", set(expense(&b, market), "items", items));
    // Assert
    let entry = draft.entry.unwrap();
    assert_eq!(entry.lines.len(), 2);
    assert!(
        entry.create_accounts.is_empty(),
        "no account opens for a line that is left out"
    );
}
