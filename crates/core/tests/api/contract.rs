//! The contract file and the dispatcher list the same operations, and every listed code is real.
use super::common::*;
use aa_core::api::{API_VERSION, OPERATIONS};
use std::collections::BTreeSet;

#[test]
fn the_contract_lists_exactly_the_operations_the_core_has() {
    // Arrange
    let whole = contract();
    // Act
    let in_contract: BTreeSet<&str> = whole["operations"]
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    // Assert
    assert_eq!(in_contract, OPERATIONS.into_iter().collect::<BTreeSet<_>>());
}

#[test]
fn the_contract_and_the_core_speak_the_same_version() {
    assert_eq!(contract()["api_version"], API_VERSION);
}

#[test]
fn every_error_an_operation_lists_is_a_known_code() {
    // Arrange
    let whole = contract();
    let known: BTreeSet<&str> = whole["$defs"]["ErrorCode"]["enum"]
        .as_array()
        .unwrap()
        .iter()
        .map(|code| code.as_str().unwrap())
        .collect();
    // Act
    let mut listed: Vec<&str> = whole["global_errors"]
        .as_array()
        .unwrap()
        .iter()
        .map(|code| code.as_str().unwrap())
        .collect();
    for operation in whole["operations"].as_object().unwrap().values() {
        listed.extend(
            operation["errors"]
                .as_array()
                .unwrap()
                .iter()
                .map(|code| code.as_str().unwrap()),
        );
    }
    // Assert
    for code in listed {
        assert!(known.contains(code), "{code} is not in ErrorCode");
    }
}

#[test]
fn every_operation_has_a_summary_an_input_and_an_output() {
    // Arrange
    let whole = contract();
    // Act and assert
    for (name, operation) in whole["operations"].as_object().unwrap() {
        assert!(!operation["summary"].as_str().unwrap().is_empty(), "{name}");
        assert!(operation.get("input").is_some(), "{name}");
        assert!(operation.get("output").is_some(), "{name}");
    }
}
