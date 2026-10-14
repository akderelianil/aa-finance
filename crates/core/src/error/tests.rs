//! The mapping of database messages to stable rule codes, and of other errors to their variants.

use super::*;

#[test]
fn every_trigger_code_maps_back_from_its_own_message() {
    // Arrange
    let all = [
        RuleCode::ProjectionClosed,
        RuleCode::RevisionImmutable,
        RuleCode::RevisionParentMismatch,
        RuleCode::EntryTooFewLines,
        RuleCode::EntryUnbalanced,
        RuleCode::AccountArchived,
        RuleCode::CommodityScaleLocked,
        RuleCode::AmountOutOfRange,
        RuleCode::DateInvalid,
        RuleCode::CommodityScaleInvalid,
        RuleCode::CommodityCodeTaken,
        RuleCode::AccountParentCycle,
        RuleCode::LineCommodityMismatch,
        RuleCode::AccountCommodityLocked,
        RuleCode::RevisionKindMismatch,
        RuleCode::AmountInvalid,
        RuleCode::AmountTooPrecise,
        RuleCode::RateInvalid,
        RuleCode::RateMissing,
        RuleCode::LineBaseSign,
        RuleCode::RateBaseConflict,
    ];
    // Act / Assert
    for code in all {
        assert!(!code.as_str().is_empty());
        let failure = rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT_TRIGGER);
        let mapped = Error::from(rusqlite::Error::SqliteFailure(
            failure,
            Some(code.as_str().to_string()),
        ));
        if RuleCode::TRIGGER_CODES.contains(&code) {
            assert!(matches!(mapped, Error::Rule(c) if c == code));
        }
    }
}

#[test]
fn a_json_error_becomes_an_invalid_body_and_other_sqlite_errors_stay_opaque() {
    // Arrange
    let json_err = serde_json::from_str::<u32>("x").unwrap_err();
    // Act
    let invalid = Error::from(json_err);
    let opaque = Error::from(rusqlite::Error::QueryReturnedNoRows);
    // Assert
    assert!(matches!(invalid, Error::InvalidBody(_)));
    assert!(matches!(opaque, Error::Sqlite(_)));
}
