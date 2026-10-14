//! The mapping of database messages to stable rule codes, and of other errors to their variants.

use super::*;

/// Every rule code. `listed` below stops compiling when a variant is added, so this list cannot be forgotten.
const ALL: [RuleCode; 22] = [
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
    RuleCode::LineEmpty,
];

#[test]
fn the_list_of_all_codes_covers_every_variant() {
    fn listed(code: RuleCode) -> bool {
        match code {
            RuleCode::ProjectionClosed
            | RuleCode::RevisionImmutable
            | RuleCode::RevisionParentMismatch
            | RuleCode::EntryTooFewLines
            | RuleCode::EntryUnbalanced
            | RuleCode::AccountArchived
            | RuleCode::CommodityScaleLocked
            | RuleCode::AmountOutOfRange
            | RuleCode::DateInvalid
            | RuleCode::CommodityScaleInvalid
            | RuleCode::CommodityCodeTaken
            | RuleCode::AccountParentCycle
            | RuleCode::LineCommodityMismatch
            | RuleCode::AccountCommodityLocked
            | RuleCode::RevisionKindMismatch
            | RuleCode::AmountInvalid
            | RuleCode::AmountTooPrecise
            | RuleCode::RateInvalid
            | RuleCode::RateMissing
            | RuleCode::LineBaseSign
            | RuleCode::RateBaseConflict
            | RuleCode::LineEmpty => true,
        }
    }
    assert!(ALL.iter().all(|code| listed(*code)));
}

#[test]
fn every_trigger_code_maps_back_from_its_own_message() {
    // Arrange
    let all = ALL;
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
        } else {
            // A named CHECK may map to its own code, otherwise it stays a database error; it never
            // turns into another code.
            assert!(!matches!(mapped, Error::Rule(other) if other != code));
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

#[test]
fn rule_code_names_are_unique() {
    // Arrange
    let mut names: Vec<_> = ALL.iter().map(|code| code.as_str()).collect();
    // Act
    names.sort_unstable();
    let before = names.len();
    names.dedup();
    // Assert
    assert_eq!(names.len(), before);
}

#[test]
fn every_error_a_trigger_raises_in_the_schema_is_a_trigger_code_and_the_other_way_round() {
    // Arrange: the text between RAISE(ABORT, ' and the closing quote, in every migration file.
    let mut raised: Vec<String> = Vec::new();
    for sql in crate::migrate::MIGRATIONS {
        for part in sql.split("RAISE(ABORT, '").skip(1) {
            raised.push(part.split('\'').next().unwrap().to_string());
        }
    }
    raised.sort_unstable();
    raised.dedup();
    let mut known: Vec<String> = RuleCode::TRIGGER_CODES
        .iter()
        .map(|code| code.as_str().to_string())
        .collect();
    known.sort_unstable();
    // Act / Assert
    assert_eq!(raised, known);
}
