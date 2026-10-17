//! Shared setup of the API tests: the contract file, a validator per schema and a checked `call`.
use aa_core::api::error_json;
use aa_core::ops::{Clock, Ledger};
use aa_core::{Lang, Store};
use serde_json::{json, Value};
use std::collections::BTreeSet;

pub struct Fixed;

impl Clock for Fixed {
    fn now_ms(&self) -> i64 {
        1_000
    }
}

pub fn contract() -> Value {
    let text = include_str!("../../../../api/v1/api.json");
    serde_json::from_str(text).expect("the contract is valid JSON")
}

/// A validator for the schema at `pointer` in the contract (such as `/operations/undo/input`).
fn validator(pointer: &str) -> jsonschema::Validator {
    let whole = contract();
    let schema = json!({
        "$ref": format!("#{pointer}"),
        "operations": whole["operations"],
        "$defs": whole["$defs"],
    });
    jsonschema::validator_for(&schema).expect("the contract schema compiles")
}

pub fn assert_valid(pointer: &str, value: &Value) {
    let errors: Vec<String> = validator(pointer)
        .iter_errors(value)
        .map(|e| e.to_string())
        .collect();
    assert!(errors.is_empty(), "{pointer} rejects {value}: {errors:?}");
}

pub fn is_valid(pointer: &str, value: &Value) -> bool {
    validator(pointer).is_valid(value)
}

/// The codes an operation may return: its own and the global ones.
pub fn allowed_errors(operation: &str) -> BTreeSet<String> {
    let whole = contract();
    let own = &whole["operations"][operation]["errors"];
    let global = &whole["global_errors"];
    own.as_array()
        .unwrap()
        .iter()
        .chain(global.as_array().unwrap())
        .map(|code| code.as_str().unwrap().to_string())
        .collect()
}

pub fn ledger() -> Ledger {
    Ledger::new(
        Store::open_in_memory().unwrap(),
        aa_core::ids::new_id(),
        Box::new(Fixed),
    )
}

/// Calls an operation with a contract-valid input, and holds the answer to the contract: a success
/// must fit the output schema; a failure must be an error envelope whose code the operation lists.
pub fn run(ledger: &mut Ledger, operation: &str, input: Value) -> Result<Value, String> {
    assert_valid(&format!("/operations/{operation}/input"), &input);
    match ledger.call(operation, input) {
        Ok(output) => {
            assert_valid(&format!("/operations/{operation}/output"), &output);
            Ok(output)
        }
        Err(error) => {
            let envelope = error_json(&error, Lang::En);
            assert_valid("/$defs/Error", &envelope);
            let code = error.code().to_string();
            assert!(
                allowed_errors(operation).contains(&code),
                "{operation} returned {code}, which its contract does not list"
            );
            Err(code)
        }
    }
}
