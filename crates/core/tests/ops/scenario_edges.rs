//! Edges of scenario drafts (ADR-0024): every input type refuses a value of the wrong shape, rows
//! name their faults, typed names are reused or refused by kind, rates are asked for exactly where
//! a conversion or a base value needs one, and a pack's own faults come back as errors.

use super::common::*;
use aa_core::body::AccountKind::{Asset, Expense};
use aa_core::scenario::draft::{draft as draft_with, DraftInput, Language};
use serde_json::{json, Value};

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
    let entry = reused.entry().cloned().unwrap();
    assert!(entry.create_contacts.is_empty());
    assert_eq!(entry.lines[1].contact, Some(ayse));
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
    assert_eq!(draft.entry().cloned().unwrap().lines[0].account, fees);
    assert_eq!(draft.preview().cloned().unwrap().text, "5,00 TRY {here");
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
        assert!(draft.errors().is_empty(), "{date}");
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
    let entry = draft.entry().cloned().unwrap();
    assert_eq!(entry.lines.len(), 2);
    assert!(
        entry.create_accounts.is_empty(),
        "no account opens for a line that is left out"
    );
}

#[test]
fn a_negative_split_row_is_refused() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let items = json!([
        { "expense": pick(market), "part": "7.00" },
        { "expense": pick(market), "part": "-2.00" },
    ]);
    // Act
    let error = only_error(&b, "expense", set(expense(&b, market), "items", items));
    // Assert
    assert_eq!(error, (Some("items.1.part".into()), "invalid".into()));
}

#[test]
fn a_fault_in_a_row_after_a_broken_row_names_its_own_index() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let items = json!(["broken", { "expense": pick(market), "part": "five" }]);
    // Act
    let draft = draft(&b, "expense", set(expense(&b, market), "items", items));
    // Assert
    assert_eq!(
        errors(&draft),
        vec![
            (Some("items.0".into()), "invalid".into()),
            (Some("items.1.part".into()), "invalid".into()),
        ]
    );
}

#[test]
fn an_amount_for_an_optional_account_left_empty_is_refused_not_dropped() {
    // Arrange
    let b = book();
    let text = json!({
        "schema": 1, "id": "optional",
        "scenarios": [{
            "id": "s", "title": "t", "date": "date",
            "inputs": [
                { "name": "tip", "type": "amount", "of": "jar", "required": false, "label": "t" },
                { "name": "jar", "type": "account", "kinds": ["asset"], "required": false, "label": "t" },
                { "name": "date", "type": "date", "label": "t" }
            ],
            "lines": [
                { "id": "a", "account": "jar", "amount": "tip" },
                { "id": "b", "account": "jar", "amount": "tip", "sign": "-" }
            ],
            "preview": "t"
        }],
        "strings": { "tr": { "t": "t" }, "en": { "t": "t" } }
    });
    let pack = aa_core::scenario::pack::load(&text.to_string()).unwrap();
    let input = DraftInput {
        scenario: "s".into(),
        language: Language::Tr,
        inputs: json!({ "tip": "5.00", "date": "2026-11-02" })
            .as_object()
            .unwrap()
            .clone(),
    };
    // Act
    let draft = draft_with(&pack, &b.ledger, &input).unwrap();
    // Assert
    assert_eq!(
        errors(&draft),
        vec![(Some("jar".into()), "required".into())]
    );
}

#[test]
fn an_overflow_in_a_line_amount_is_an_error_not_an_entry() {
    // Arrange
    let b = book();
    let pack = pack_with(json!([
        { "id": "a", "account": "here", "amount": "amount + amount + amount" },
        { "id": "b", "account": "there", "amount": "amount", "sign": "-" }
    ]));
    let input = DraftInput {
        scenario: "s".into(),
        language: Language::Tr,
        inputs: json!({
            "amount": "40000000000000000.00", "here": pick(b.cash), "there": pick(b.food),
            "date": "2026-11-02",
        })
        .as_object()
        .unwrap()
        .clone(),
    };
    // Act
    let draft = draft_with(&pack, &b.ledger, &input).unwrap();
    // Assert
    assert_eq!(errors(&draft), vec![(None, "calculation".into())]);
}
