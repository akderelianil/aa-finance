//! What a scenario draft refuses and what it can never do (ADR-0024): bad or missing values come
//! back as field errors in the user's language, a draft writes nothing, and a faulty pack yields at
//! worst an entry the ledger refuses, so it cannot corrupt the books.

use super::common::*;
use aa_core::body::AccountKind::Expense;
use aa_core::scenario::draft::{draft as draft_with, DraftInput, Language};
use serde_json::{json, Value};

fn expense(b: &Book, market: DocId) -> Value {
    json!({
        "amount": "5.00", "payment": pick(b.cash), "date": "2026-11-02",
        "items": [{ "expense": pick(market), "part": "5.00" }],
    })
}

fn with(mut inputs: Value, key: &str, value: Value) -> Value {
    if value.is_null() {
        inputs.as_object_mut().unwrap().remove(key);
    } else {
        inputs[key] = value;
    }
    inputs
}

#[test]
fn missing_bad_and_unknown_values_are_field_errors() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let base = expense(&b, market);
    let cases = [
        ("amount", Value::Null, "amount", "required"),
        ("amount", json!("five"), "amount", "invalid"),
        ("amount", json!(5), "amount", "invalid"),
        ("date", json!("2026-02-30"), "date", "invalid"),
        ("payment", pick(DocId::new()), "payment", "unknown"),
        ("payment", json!({ "new": "Wallet" }), "payment", "invalid"),
        ("memo", json!("x".repeat(201)), "memo", "too_long"),
        ("colour", json!("red"), "colour", "unknown_field"),
    ];
    for (key, value, field, code) in cases {
        // Act
        let draft = draft(&b, "expense", with(base.clone(), key, value));
        // Assert
        assert_eq!(
            errors(&draft),
            vec![(Some(field.into()), code.into())],
            "{key}"
        );
        assert!(draft.entry().is_none() && draft.preview().is_none());
    }
}

#[test]
fn a_row_error_names_the_row_and_the_column() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let inputs = with(
        expense(&b, market),
        "items",
        json!([{ "expense": pick(market), "part": "5.00" }, { "part": "1.00" }]),
    );
    // Act
    let draft = draft(&b, "expense", inputs);
    // Assert
    assert_eq!(
        errors(&draft),
        vec![(Some("items.1.expense".into()), "required".into())]
    );
}

#[test]
fn errors_and_the_preview_come_in_the_language_asked_for() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let english = |inputs: Value| DraftInput {
        scenario: "expense".into(),
        language: Language::En,
        inputs: inputs.as_object().unwrap().clone(),
    };
    // Act
    let good = b
        .ledger
        .scenario_draft(english(expense(&b, market)))
        .unwrap();
    let bad = b
        .ledger
        .scenario_draft(english(with(expense(&b, market), "amount", Value::Null)))
        .unwrap();
    // Assert
    assert_eq!(
        good.preview().cloned().unwrap().text,
        "Cash −5.00 TRY → Market"
    );
    assert_eq!(bad.errors()[0].text, "This field is required.");
}

#[test]
fn an_unknown_scenario_is_a_missing_reference() {
    // Arrange
    let b = book();
    let input = DraftInput {
        scenario: "lottery".into(),
        language: Language::Tr,
        inputs: serde_json::Map::new(),
    };
    // Act
    let result = b.ledger.scenario_draft(input);
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "scenario",
            ..
        })
    ));
}

#[test]
fn an_overflow_while_drafting_is_an_error_not_a_crash() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let huge = "40000000000000000.00";
    let inputs = with(
        with(expense(&b, market), "amount", json!(huge)),
        "items",
        json!([
            { "expense": pick(market), "part": huge },
            { "expense": pick(market), "part": huge },
            { "expense": pick(market), "part": huge },
        ]),
    );
    // Act
    let draft = draft(&b, "expense", inputs);
    // Assert
    assert_eq!(errors(&draft), vec![(None, "calculation".into())]);
}

#[test]
fn drafting_writes_nothing() {
    // Arrange
    let mut b = book();
    let market = open(&mut b.ledger, "Market", Expense, b.try_id);
    let inputs = with(
        expense(&b, market),
        "items",
        json!([{ "expense": { "new": "Sigara" }, "part": "5.00" }]),
    );
    // Act
    let draft = draft(&b, "expense", inputs);
    // Assert
    let new = draft.entry().cloned().unwrap().create_accounts[0].id;
    assert!(matches!(
        b.ledger.account(new),
        Err(Error::MissingReference { .. })
    ));
}

/// A pack whose only scenario debits twice: it loads, because the loader cannot know the sums.
fn faulty_pack() -> aa_core::scenario::pack::Pack {
    let text = json!({
        "schema": 1, "id": "faulty",
        "scenarios": [{
            "id": "twice", "title": "t", "date": "date",
            "inputs": [
                { "name": "amount", "type": "amount", "of": "where", "label": "t" },
                { "name": "where", "type": "account", "kinds": ["asset"], "label": "t" },
                { "name": "date", "type": "date", "label": "t" }
            ],
            "lines": [
                { "id": "one", "account": "where", "amount": "amount" },
                { "id": "two", "account": "where", "amount": "amount" }
            ],
            "preview": "t"
        }],
        "strings": { "tr": { "t": "t" }, "en": { "t": "t" } }
    });
    aa_core::scenario::pack::load(&text.to_string()).unwrap()
}

#[test]
fn a_faulty_scenario_cannot_corrupt_the_books() {
    // Arrange
    let mut b = book();
    let pack = faulty_pack();
    let input = DraftInput {
        scenario: "twice".into(),
        language: Language::Tr,
        inputs: json!({ "amount": "5.00", "where": pick(b.cash), "date": "2026-11-02" })
            .as_object()
            .unwrap()
            .clone(),
    };
    // Act
    let draft = draft_with(&pack, &b.ledger, &input).unwrap();
    let posted = b.ledger.post_entry(draft.entry().cloned().unwrap());
    // Assert
    assert!(matches!(
        posted,
        Err(Error::Rule(RuleCode::EntryUnbalanced))
    ));
    assert!(b.ledger.store_mut().verify_projection().unwrap().is_empty());
}
