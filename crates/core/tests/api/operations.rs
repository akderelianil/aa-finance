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
        json!({"account": food["doc_id"], "archived": true}),
    )
    .unwrap();
    let archived = run(&mut l, "account", json!({"account": food["doc_id"]})).unwrap();
    run(
        &mut l,
        "set_account_archived",
        json!({"account": food["doc_id"], "archived": false}),
    )
    .unwrap();
    let renamed = run(&mut l, "account", json!({"account": food["doc_id"]})).unwrap();
    let dollars = run(
        &mut l,
        "create_account",
        json!({"name": "Dollars", "parent": null, "kind": "asset", "commodity": usd["doc_id"]}),
    )
    .unwrap();
    let dollars_view = run(&mut l, "account", json!({"account": dollars["doc_id"]})).unwrap();
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
    let rounding_view = run(&mut l, "account", json!({"account": rounding["doc_id"]})).unwrap();
    run(&mut l, "delete_entry", json!({"entry": entry})).unwrap();
    let deleted = run(&mut l, "entry", json!({"entry": entry})).unwrap();
    let locked_base = run(
        &mut l,
        "set_base_currency",
        json!({"commodity": usd["doc_id"]}),
    );
    let locked_rename = run(
        &mut l,
        "rename_account",
        json!({"account": rounding["doc_id"], "name": "x"}),
    );
    let unknown_entry = run(
        &mut l,
        "entry",
        json!({"entry": "00000000-0000-7000-8000-000000000000"}),
    );
    let no_key = run(&mut l, "system_account", json!({"key": "nothing"}));
    let version = run(&mut l, "api_version", json!({})).unwrap();
    let ahmet = run(
        &mut l,
        "create_contact",
        json!({"name": "Ahmet", "kind": "individual"}),
    )
    .unwrap();
    let ahmet_view = run(&mut l, "contact", json!({"contact": ahmet["doc_id"]})).unwrap();
    let same_name = run(
        &mut l,
        "create_contact",
        json!({"name": "AHMET", "kind": "business"}),
    );
    let lent = run(
        &mut l,
        "post_entry",
        json!({"date": "2026-10-17", "lines": [
            {"account": cash["doc_id"], "amount": "-5.00"},
            {"account": cash["doc_id"], "amount": "5.00", "contact": ahmet["doc_id"]},
        ]}),
    )
    .unwrap();
    let lent_view = run(&mut l, "entry", json!({"entry": lent["doc_id"]})).unwrap();
    // Assert
    assert_eq!(ahmet_view["kind"], "individual");
    assert_eq!(same_name.unwrap_err(), "contact_name_taken");
    assert_eq!(lent_view["lines"][0]["contact"], Value::Null);
    assert_eq!(lent_view["lines"][1]["contact"], ahmet["doc_id"]);
    assert_eq!(settings["base_code"], "TRY");
    assert_eq!(archived["archived"], true);
    assert_eq!(renamed["name"], "Groceries");
    assert_eq!(renamed["archived"], false);
    assert_eq!(dollars_view["commodity"], usd["doc_id"]);
    assert_eq!(rounding_view["name"], "Rounding");
    assert_eq!(rounding_view["locked"], true);
    assert_eq!(deleted["deleted"], true);
    assert_eq!(locked_base.unwrap_err(), "base_currency_locked");
    assert_eq!(locked_rename.unwrap_err(), "account_locked");
    assert_eq!(unknown_entry.unwrap_err(), "missing_reference");
    assert_eq!(no_key.unwrap_err(), "missing_reference");
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

#[test]
fn an_entry_that_opens_an_account_and_a_contact_fits_the_contract() {
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
    let receivable =
        run(&mut l, "system_account", json!({"key": "receivable"})).unwrap()["doc_id"].clone();
    let (account, contact) = (
        aa_core::DocId::new().to_string(),
        aa_core::DocId::new().to_string(),
    );
    let lend = json!({
        "date": "2026-11-02",
        "lines": [
            {"account": account, "amount": "20.00", "contact": contact},
            {"account": cash["doc_id"], "amount": "-20.00"},
        ],
        "create_accounts": [{"id": account, "account": {
            "name": "Friends", "parent": receivable, "kind": "asset", "commodity": book["doc_id"]}}],
        "create_contacts": [{"id": contact, "contact": {"name": "Ayşe", "kind": "individual"}}],
    });
    // Act
    let lent = run(&mut l, "post_entry", lend.clone()).unwrap();
    let again = run(&mut l, "post_entry", lend);
    // Assert
    let view = run(&mut l, "entry", json!({"entry": lent["doc_id"]})).unwrap();
    assert_eq!(view["lines"][0]["account"], json!(account));
    assert_eq!(view["lines"][0]["contact"], json!(contact));
    let friends = run(&mut l, "account", json!({"account": account})).unwrap();
    assert_eq!(friends["parent"], receivable);
    assert_eq!(again.unwrap_err(), "account_name_taken");
}

#[test]
fn scenarios_are_listed_described_and_drafted_through_the_contract() {
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
    // Act
    let list = run(&mut l, "scenario_list", json!({"language": "tr"})).unwrap();
    let form = run(
        &mut l,
        "scenario_describe",
        json!({"scenario": "expense", "language": "en"}),
    )
    .unwrap();
    let debt_form = run(
        &mut l,
        "scenario_describe",
        json!({"scenario": "debt", "language": "tr"}),
    )
    .unwrap();
    let missing = run(
        &mut l,
        "scenario_describe",
        json!({"scenario": "lottery", "language": "tr"}),
    );
    let draft = run(
        &mut l,
        "scenario_draft",
        json!({"scenario": "expense", "language": "tr", "inputs": {
            "amount": "5.00", "payment": {"id": cash["doc_id"]}, "date": "2026-11-02",
            "items": [{"expense": {"new": "Market"}, "part": "5.00"}],
        }}),
    )
    .unwrap();
    let refused = run(
        &mut l,
        "scenario_draft",
        json!({"scenario": "expense", "language": "en", "inputs": {}}),
    )
    .unwrap();
    let posted = run(&mut l, "post_entry", draft["entry"].clone()).unwrap();
    // Assert
    let titles: Vec<&str> = list["scenarios"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| s["title"].as_str().unwrap())
        .collect();
    assert_eq!(titles, ["Gider", "Gelir", "Transfer", "Borç"]);
    assert_eq!(list["hash"].as_str().unwrap().len(), 64);
    assert_eq!(form["title"], "Expense");
    assert_eq!(form["inputs"][0]["type"], "amount");
    assert_eq!(form["inputs"][0]["of"], "payment");
    assert_eq!(form["inputs"][3]["columns"][0]["new"], true);
    assert_eq!(form["inputs"][4]["of"], "items.expense");
    assert_eq!(debt_form["inputs"][0]["options"][3]["label"], "Ödeme");
    assert_eq!(missing.unwrap_err(), "missing_reference");
    assert_eq!(draft["preview"]["text"], "Cash −5,00 TRY → Market");
    assert_eq!(refused["entry"], Value::Null);
    assert_eq!(refused["errors"][0]["text"], "This field is required.");
    assert!(posted["doc_id"].is_string());
}
