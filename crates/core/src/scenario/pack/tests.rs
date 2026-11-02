//! Loading a scenario pack (ADR-0024, docs/foundation/scenario-format.md): a pack loads whole or not
//! at all, every name, reference, string and expression is checked at load, and its hash is stable.

use super::*;
use crate::scenario::expr::CompileError;
use serde_json::{json, Value};

fn strings() -> Value {
    let keys = [
        "t.title",
        "t.amount",
        "t.from",
        "t.to",
        "t.rate",
        "t.items",
        "t.person",
        "t.direction",
        "t.lend",
        "t.borrow",
        "t.date",
        "t.memo",
        "t.split",
    ];
    let mut map = serde_json::Map::new();
    for key in keys {
        map.insert(key.to_string(), json!(key));
    }
    map.insert("t.preview".to_string(), json!("{from} → {to}: {amount}"));
    json!({ "tr": map.clone(), "en": map })
}

/// A pack with one scenario that uses every input type and every kind of line.
fn pack() -> Value {
    json!({
        "schema": 1,
        "id": "test",
        "scenarios": [{
            "id": "move",
            "title": "t.title",
            "date": "date",
            "memo": "memo",
            "distinct": [["from", "to"]],
            "inputs": [
                {"name": "amount", "type": "amount", "of": "from", "label": "t.amount"},
                {"name": "from", "type": "account", "kinds": ["asset"], "label": "t.from"},
                {"name": "to", "type": "account", "kinds": ["expense"], "new": true, "label": "t.to"},
                {"name": "amount_in", "type": "amount", "of": "to", "default": "amount",
                 "show_if_commodity_differs": ["from", "to"], "label": "t.amount"},
                {"name": "from_rate", "type": "rate", "of": "from", "label": "t.rate"},
                {"name": "items", "type": "lines", "label": "t.items", "columns": [
                    {"name": "expense", "type": "account", "kinds": ["expense"], "label": "t.to"},
                    {"name": "part", "type": "amount", "of": "from", "label": "t.amount"}
                ]},
                {"name": "item_rate", "type": "rate", "of": "items.expense", "label": "t.rate"},
                {"name": "person", "type": "contact", "required": false, "label": "t.person"},
                {"name": "direction", "type": "choice", "label": "t.direction", "options": [
                    {"id": "lend", "label": "t.lend", "values": {"money": "-", "group": "receivable"}},
                    {"id": "borrow", "label": "t.borrow", "values": {"money": "+", "group": "payable"}}
                ]},
                {"name": "date", "type": "date", "label": "t.date"},
                {"name": "memo", "type": "text", "required": false, "max": 200, "label": "t.memo"}
            ],
            "checks": [{"rule": "sum(items.part) = amount", "field": "items", "message": "t.split"}],
            "lines": [
                {"id": "spend", "each": "items", "account": "expense", "amount": "part",
                 "convert": true, "rate": "item_rate", "when": "part > 0"},
                {"id": "pay", "account": "from", "amount": "amount", "sign": "-", "rate": "from_rate"},
                {"id": "debt", "account": {"system": "direction.group", "commodity_of": "from"},
                 "amount": "amount", "sign": "direction.money", "contact": "person", "base_of": "pay"}
            ],
            "preview": "t.preview"
        }],
        "strings": strings()
    })
}

fn load_value(value: &Value) -> Result<Pack, PackError> {
    load(&value.to_string())
}

/// Changes the value at `pointer` and returns the fault the pack is refused with.
fn fault_after(pointer: &str, new: Value) -> Fault {
    let mut value = pack();
    *value
        .pointer_mut(pointer)
        .unwrap_or_else(|| panic!("{pointer}")) = new;
    match load_value(&value) {
        Err(PackError::Fault { fault, .. }) => fault,
        other => panic!("{pointer}: expected a fault, got {other:?}"),
    }
}

fn input(name: &str) -> String {
    let index = pack()["scenarios"][0]["inputs"]
        .as_array()
        .unwrap()
        .iter()
        .position(|input| input["name"] == name)
        .unwrap();
    format!("/scenarios/0/inputs/{index}")
}

#[test]
fn a_valid_pack_loads_with_its_scenarios_inputs_and_lines() {
    // Arrange
    let value = pack();
    // Act
    let pack = load_value(&value).unwrap();
    // Assert
    assert_eq!(pack.id, "test");
    let scenario = pack.scenario("move").unwrap();
    assert_eq!(scenario.inputs.len(), 11);
    assert_eq!(scenario.lines.len(), 3);
    assert_eq!(
        scenario.distinct,
        vec![("from".to_string(), "to".to_string())]
    );
    assert!(matches!(
        scenario.inputs[2].kind,
        InputKind::Account {
            allow_new: true,
            ..
        }
    ));
    assert!(matches!(
        &scenario.lines[2].account,
        LineAccount::System { key: SystemKey::Choice { choice, value }, commodity_of }
            if choice == "direction" && value == "group" && commodity_of == "from"
    ));
    assert_eq!(scenario.lines[1].sign, LineSign::Fixed(Sign::Credit));
    assert!(pack.scenario("nothing").is_none());
}

#[test]
fn the_hash_is_the_sha256_of_the_text_and_changes_with_it() {
    // Arrange
    let text = pack().to_string();
    let other = text.replacen("\"test\"", "\"test2\"", 1);
    // Act
    let first = load(&text).unwrap().hash;
    let again = load(&text).unwrap().hash;
    let changed = load(&other).unwrap().hash;
    // Assert
    assert_eq!(first.len(), 64);
    assert!(first.chars().all(|c| c.is_ascii_hexdigit()));
    assert_eq!(first, again);
    assert_ne!(first, changed);
}

#[test]
fn a_pack_that_is_not_the_format_is_refused() {
    // Arrange
    let mut extra = pack();
    extra["scenarios"][0]["inputs"][0]["colour"] = json!("red");
    // Act / Assert
    assert!(matches!(load("not json"), Err(PackError::Format(_))));
    assert!(matches!(load_value(&extra), Err(PackError::Format(_))));
}

#[test]
fn an_unknown_schema_version_is_refused() {
    // Arrange
    let mut value = pack();
    value["schema"] = json!(2);
    // Act / Assert
    assert!(matches!(load_value(&value), Err(PackError::Schema(2))));
}

#[test]
fn a_pack_larger_than_the_limit_is_refused_before_it_is_read() {
    // Arrange
    let text = " ".repeat(MAX_PACK_BYTES + 1);
    // Act / Assert
    assert!(matches!(load(&text), Err(PackError::TooLarge)));
}

#[test]
fn names_must_follow_the_grammar_and_be_unique() {
    // Act / Assert
    assert_eq!(
        fault_after(&format!("{}/name", input("amount")), json!("Amount")),
        Fault::BadName("Amount".to_string())
    );
    assert_eq!(
        fault_after(&format!("{}/name", input("memo")), json!("sum")),
        Fault::BadName("sum".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/1/id", json!(&"a".repeat(65))),
        Fault::BadName("a".repeat(65))
    );
    assert_eq!(
        fault_after(&format!("{}/name", input("memo")), json!("amount")),
        Fault::Duplicate("amount".to_string())
    );
    assert_eq!(
        fault_after(
            &format!("{}/columns/1/name", input("items")),
            json!("amount")
        ),
        Fault::Duplicate("amount".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/1/id", json!("spend")),
        Fault::Duplicate("spend".to_string())
    );
    let mut twice = pack();
    let copy = twice["scenarios"][0].clone();
    twice["scenarios"].as_array_mut().unwrap().push(copy);
    assert!(matches!(
        load_value(&twice),
        Err(PackError::Fault { fault: Fault::Duplicate(name), .. }) if name == "move"
    ));
}

#[test]
fn every_reference_must_name_an_input_of_the_right_type() {
    // Act / Assert
    let amount = input("amount");
    assert_eq!(
        fault_after(&format!("{amount}/of"), json!("nowhere")),
        Fault::UnknownName("nowhere".to_string())
    );
    assert_eq!(
        fault_after(&format!("{amount}/of"), json!("memo")),
        Fault::WrongKind("memo".to_string())
    );
    assert_eq!(
        fault_after(&format!("{}/of", input("item_rate")), json!("items.part")),
        Fault::WrongKind("items.part".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/date", json!("memo")),
        Fault::WrongKind("memo".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/memo", json!("date")),
        Fault::WrongKind("date".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/distinct/0/1", json!("amount")),
        Fault::WrongKind("amount".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/checks/0/field", json!("ghost")),
        Fault::UnknownName("ghost".to_string())
    );
}

#[test]
fn every_line_reference_must_name_the_right_thing() {
    // Act / Assert
    assert_eq!(
        fault_after("/scenarios/0/lines/1/account", json!("amount")),
        Fault::WrongKind("amount".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/1/rate", json!("amount")),
        Fault::WrongKind("amount".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/2/contact", json!("from")),
        Fault::WrongKind("from".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/2/base_of", json!("ghost")),
        Fault::UnknownName("ghost".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/0/each", json!("amount")),
        Fault::WrongKind("amount".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/2/sign", json!("direction.group")),
        Fault::WrongKind("direction.group".to_string())
    );
    assert_eq!(
        fault_after(
            "/scenarios/0/lines/2/account/system",
            json!("direction.money")
        ),
        Fault::WrongKind("direction.money".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/2/sign", json!("direction.nothing")),
        Fault::UnknownName("direction.nothing".to_string())
    );
}

#[test]
fn a_system_account_may_be_named_by_its_key() {
    // Arrange
    let mut value = pack();
    value["scenarios"][0]["lines"][2]["account"]["system"] = json!("bank_fee");
    // Act
    let pack = load_value(&value).unwrap();
    // Assert
    assert!(matches!(
        &pack.scenario("move").unwrap().lines[2].account,
        LineAccount::System { key: SystemKey::Fixed(key), .. } if key == "bank_fee"
    ));
}

#[test]
fn an_input_takes_only_the_fields_of_its_type() {
    // Arrange
    let mut value = pack();
    value["scenarios"][0]["inputs"][1]["of"] = json!("from");
    // Act
    let result = load_value(&value);
    // Assert
    assert!(matches!(
        result,
        Err(PackError::Fault {
            fault: Fault::FieldNotAllowed("of"),
            ..
        })
    ));
    assert_eq!(
        fault_after(&format!("{}/columns/0/type", input("items")), json!("date")),
        Fault::FieldNotAllowed("kinds")
    );
}

#[test]
fn account_choice_and_text_inputs_are_checked() {
    // Act / Assert
    assert_eq!(
        fault_after(&format!("{}/kinds", input("from")), json!([])),
        Fault::NoKinds
    );
    assert_eq!(
        fault_after(
            &format!("{}/kinds", input("to")),
            json!(["expense", "income"])
        ),
        Fault::NewNeedsOneKind
    );
    let direction = input("direction");
    assert_eq!(
        fault_after(&format!("{direction}/options"), json!([])),
        Fault::NoOptions
    );
    assert_eq!(
        fault_after(
            &format!("{direction}/options/1/values"),
            json!({"money": "+"})
        ),
        Fault::OptionValuesDiffer
    );
    assert_eq!(
        fault_after(&format!("{direction}/options/1/values/money"), json!("*")),
        Fault::BadValue("*".to_string())
    );
    assert_eq!(
        fault_after(&format!("{direction}/options/1/id"), json!("lend")),
        Fault::Duplicate("lend".to_string())
    );
    assert_eq!(
        fault_after(&format!("{}/max", input("memo")), json!(0)),
        Fault::BadMax
    );
}

#[test]
fn a_string_missing_in_either_language_is_refused() {
    // Arrange
    let mut value = pack();
    value["strings"]["en"]
        .as_object_mut()
        .unwrap()
        .remove("t.lend");
    // Act
    let result = load_value(&value);
    // Assert
    assert!(matches!(
        result,
        Err(PackError::Fault { fault: Fault::MissingString { key, language }, .. })
            if key == "t.lend" && language == "en"
    ));
}

#[test]
fn a_preview_placeholder_must_name_an_input() {
    // Arrange
    let mut value = pack();
    value["strings"]["tr"]["t.preview"] = json!("{ghost} {amount}");
    // Act
    let result = load_value(&value);
    // Assert
    assert!(matches!(
        result,
        Err(PackError::Fault { fault: Fault::UnknownName(name), .. }) if name == "ghost"
    ));
}

#[test]
fn expressions_are_compiled_and_typed_at_load() {
    // Act / Assert
    assert_eq!(
        fault_after("/scenarios/0/checks/0/rule", json!("amount + 0")),
        Fault::WrongType
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/1/amount", json!("amount > 0")),
        Fault::WrongType
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/0/when", json!("part")),
        Fault::WrongType
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/1/amount", json!("part")),
        Fault::Expr(CompileError::UnknownName("part".to_string()))
    );
    assert!(matches!(
        fault_after("/scenarios/0/checks/0/rule", json!("amount >")),
        Fault::Expr(CompileError::Syntax { .. })
    ));
}

#[test]
fn the_fault_says_where_it_is() {
    // Arrange
    let mut value = pack();
    value["scenarios"][0]["lines"][1]["rate"] = json!("amount");
    // Act
    let error = load_value(&value).unwrap_err();
    // Assert
    assert_eq!(
        error.to_string(),
        "move.lines.pay.rate: amount is the wrong kind of name"
    );
}

#[test]
fn defaults_and_conditions_of_an_amount_must_name_inputs_of_the_right_type() {
    // Act / Assert
    let amount_in = input("amount_in");
    assert_eq!(
        fault_after(&format!("{amount_in}/default"), json!("from")),
        Fault::WrongKind("from".to_string())
    );
    assert_eq!(
        fault_after(
            &format!("{amount_in}/show_if_commodity_differs"),
            json!(["from", "memo"])
        ),
        Fault::WrongKind("memo".to_string())
    );
    assert_eq!(
        fault_after(
            &format!("{amount_in}/show_if_commodity_differs"),
            json!(["date", "to"])
        ),
        Fault::WrongKind("date".to_string())
    );
    let mut value = pack();
    value["scenarios"][0]["inputs"][0]
        .as_object_mut()
        .unwrap()
        .remove("of");
    assert!(matches!(
        load_value(&value),
        Err(PackError::Fault {
            fault: Fault::MissingField("of"),
            ..
        })
    ));
}

#[test]
fn a_scenario_without_a_memo_loads() {
    // Arrange
    let mut value = pack();
    value["scenarios"][0]
        .as_object_mut()
        .unwrap()
        .remove("memo");
    // Act
    let pack = load_value(&value).unwrap();
    // Assert
    assert_eq!(pack.scenario("move").unwrap().memo, None);
}

#[test]
fn columns_are_accounts_or_amounts_and_are_named_by_their_list() {
    // Act / Assert
    assert_eq!(
        fault_after(
            &format!("{}/columns/0", input("items")),
            json!({"name": "who", "type": "contact", "label": "t.person"})
        ),
        Fault::WrongKind("who".to_string())
    );
    assert_eq!(
        fault_after(&format!("{}/of", input("item_rate")), json!("items.ghost")),
        Fault::UnknownName("items.ghost".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/0/account", json!("part")),
        Fault::WrongKind("part".to_string())
    );
    assert_eq!(
        fault_after("/scenarios/0/lines/1/sign", json!("x")),
        Fault::BadValue("x".to_string())
    );
}

#[test]
fn every_fault_has_its_own_text() {
    // Arrange
    let faults = [
        Fault::BadName("a".into()),
        Fault::Duplicate("a".into()),
        Fault::UnknownName("a".into()),
        Fault::WrongKind("a".into()),
        Fault::FieldNotAllowed("of"),
        Fault::MissingField("of"),
        Fault::NoKinds,
        Fault::NewNeedsOneKind,
        Fault::NoOptions,
        Fault::OptionValuesDiffer,
        Fault::BadValue("a".into()),
        Fault::BadMax,
        Fault::MissingString {
            key: "k".into(),
            language: "tr".into(),
        },
        Fault::Expr(CompileError::TooLong),
        Fault::WrongType,
    ];
    // Act
    let texts: std::collections::HashSet<String> = faults.iter().map(ToString::to_string).collect();
    // Assert
    assert_eq!(texts.len(), faults.len());
    assert!(texts.iter().all(|text| !text.is_empty()));
}

#[test]
fn an_account_input_may_default_to_a_system_account() {
    // Arrange
    let value = pack_with_default("bank_fee");
    // Act
    let pack = load_value(&value).unwrap();
    // Assert
    assert!(matches!(
        &pack.scenario("move").unwrap().inputs[2].kind,
        InputKind::Account { default_system: Some(key), .. } if key == "bank_fee"
    ));
    let mut bad = pack_with_default("Bank Fee");
    assert!(matches!(
        load_value(&bad),
        Err(PackError::Fault { fault: Fault::BadName(name), .. }) if name == "Bank Fee"
    ));
    bad = pack_with_default("bank_fee");
    bad["scenarios"][0]["inputs"][0]["default_system"] = json!("bank_fee");
    assert!(matches!(
        load_value(&bad),
        Err(PackError::Fault {
            fault: Fault::FieldNotAllowed("default_system"),
            ..
        })
    ));
}

fn pack_with_default(key: &str) -> Value {
    let mut value = pack();
    value["scenarios"][0]["inputs"][2]["default_system"] = json!(key);
    value
}

#[test]
fn a_line_that_takes_its_base_from_another_line_takes_no_rate() {
    // Arrange
    let mut value = pack();
    value["scenarios"][0]["lines"][2]["rate"] = json!("from_rate");
    // Act
    let result = load_value(&value);
    // Assert
    assert!(matches!(
        result,
        Err(PackError::Fault { at, fault: Fault::FieldNotAllowed("rate") }) if at == "move.lines.debt.rate"
    ));
}
