//! Bad calls fail with a stable code in the error envelope, never with internal text.
use super::common::*;
use aa_core::api::error_json;
use aa_core::Lang;
use serde_json::json;

#[test]
fn an_unknown_operation_is_refused_with_its_code() {
    // Arrange
    let mut ledger = ledger();
    // Act
    let error = ledger.call("post_everything", json!({})).unwrap_err();
    // Assert
    assert_eq!(error.code(), "unknown_operation");
    assert_valid("/$defs/Error", &error_json(&error, Lang::Tr));
}

#[test]
fn an_input_the_contract_rejects_is_refused_by_the_dispatcher_too() {
    // Arrange
    let mut ledger = ledger();
    let wrong = [
        ("rename_account", json!({"account": "nope", "name": "x"})),
        (
            "undo",
            json!({"doc": "00000000-0000-7000-8000-000000000000", "extra": 1}),
        ),
        ("open_book", json!({"base_code": "TRY"})),
        ("settings", json!({"anything": true})),
    ];
    for (operation, input) in wrong {
        // Act
        let contract_says = is_valid(&format!("/operations/{operation}/input"), &input);
        let error = ledger.call(operation, input).unwrap_err();
        // Assert
        assert!(!contract_says, "{operation}");
        assert_eq!(error.code(), "invalid_input", "{operation}");
    }
}

#[test]
fn an_error_message_does_not_repeat_what_the_caller_sent() {
    // Arrange
    let mut ledger = ledger();
    let secret = "SELECT secret FROM sqlite_master";
    // Act
    let error = ledger
        .call("rename_account", json!({"account": secret, "name": "x"}))
        .unwrap_err();
    // Assert
    let text = error_json(&error, Lang::En).to_string();
    assert!(!text.contains("secret"), "{text}");
}
