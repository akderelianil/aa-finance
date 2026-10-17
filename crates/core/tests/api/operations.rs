//! A whole session through the named operations, every answer held to the contract.
use super::common::*;
use serde_json::{json, Value};

fn id(value: &Value, key: &str) -> Value {
    value[key].clone()
}

#[test]
fn a_session_through_every_operation_fits_the_contract() {
    // Arrange
    let mut l = ledger();
    // Act
    let book = run(
        &mut l,
        "open_book",
        json!({"base_code": "TRY", "base_scale": 2}),
    )
    .unwrap();
    let settings = run(&mut l, "settings", json!({})).unwrap();
    let usd = run(
        &mut l,
        "create_commodity",
        json!({"code": "USD", "scale": 2}),
    )
    .unwrap();
    let account = |name: &str| json!({"name": name, "parent": null, "kind": "asset", "commodity": book["doc_id"]});
    let cash = run(&mut l, "create_account", account("Cash")).unwrap();
    let food = run(&mut l, "create_account", account("Food")).unwrap();
    run(
        &mut l,
        "rename_account",
        json!({"account": id(&food, "doc_id"), "name": "Groceries"}),
    )
    .unwrap();
    run(
        &mut l,
        "set_account_archived",
        json!({"account": id(&food, "doc_id"), "archived": false}),
    )
    .unwrap();
    let entry_input = |amount: &str, minus: &str| {
        json!({"date": "2026-10-17", "memo": null, "no": null, "lines": [
            {"account": cash["doc_id"], "amount": minus},
            {"account": food["doc_id"], "amount": amount},
        ]})
    };
    let posted = run(&mut l, "post_entry", entry_input("12.50", "-12.50")).unwrap();
    let entry = id(&posted, "doc_id");
    run(
        &mut l,
        "edit_entry",
        json!({"entry": entry, "input": entry_input("15.00", "-15.00")}),
    )
    .unwrap();
    run(&mut l, "undo", json!({"doc": entry})).unwrap();
    run(&mut l, "redo", json!({"doc": entry})).unwrap();
    let shown = run(&mut l, "entry", json!({"entry": entry})).unwrap();
    run(&mut l, "account", json!({"account": cash["doc_id"]})).unwrap();
    let rounding = run(&mut l, "system_account", json!({"key": "rounding"})).unwrap();
    let history = run(&mut l, "history", json!({"doc": entry})).unwrap();
    run(&mut l, "delete_entry", json!({"entry": entry})).unwrap();
    run(
        &mut l,
        "set_base_currency",
        json!({"commodity": usd["doc_id"]}),
    )
    .unwrap_err();
    let version = run(&mut l, "api_version", json!({})).unwrap();
    // Assert
    assert_eq!(settings["base_code"], "TRY");
    assert_eq!(shown["lines"][1]["amount"], "15.00");
    assert!(rounding["doc_id"].is_string());
    assert_eq!(history.as_array().unwrap().len(), 4);
    assert_eq!(version["version"], "1");
}

#[test]
fn rule_failures_come_back_with_codes_the_contract_lists() {
    // Arrange
    let mut l = ledger();
    let book = run(
        &mut l,
        "open_book",
        json!({"base_code": "TRY", "base_scale": 2}),
    )
    .unwrap();
    let cash = run(
        &mut l,
        "create_account",
        json!({"name": "Cash", "parent": null, "kind": "asset", "commodity": book["doc_id"]}),
    )
    .unwrap();
    let one_line =
        json!({"date": "2026-10-17", "lines": [{"account": cash["doc_id"], "amount": "1.00"}]});
    // Act
    let reopened = run(
        &mut l,
        "open_book",
        json!({"base_code": "USD", "base_scale": 2}),
    );
    let single = run(&mut l, "post_entry", one_line);
    let nothing = run(&mut l, "undo", json!({"doc": cash["doc_id"]}));
    let redo = run(&mut l, "redo", json!({"doc": cash["doc_id"]}));
    // Assert
    assert_eq!(reopened.unwrap_err(), "book_already_open");
    assert_eq!(single.unwrap_err(), "entry_unbalanced");
    assert_eq!(nothing.unwrap_err(), "nothing_to_undo");
    assert_eq!(redo.unwrap_err(), "nothing_to_redo");
}
