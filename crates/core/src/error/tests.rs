//! The mapping of database messages to stable rule codes, and of other errors to their variants.

use super::*;

/// Every rule code. `listed` below stops compiling when a variant is added, so this list cannot be forgotten.
const ALL: [RuleCode; 36] = [
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
    RuleCode::NothingToUndo,
    RuleCode::NothingToRedo,
    RuleCode::EntryMustStartAsDraft,
    RuleCode::BaseCurrencyLocked,
    RuleCode::SettingsIdFixed,
    RuleCode::BookAlreadyOpen,
    RuleCode::AccountLocked,
    RuleCode::SystemKeyTaken,
    RuleCode::NameEmpty,
    RuleCode::AccountParentArchived,
    RuleCode::AccountParentKindMismatch,
    RuleCode::AccountNameTaken,
    RuleCode::EntryDeletedHasLines,
    RuleCode::EntryDeleted,
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
            | RuleCode::LineEmpty
            | RuleCode::NothingToUndo
            | RuleCode::NothingToRedo
            | RuleCode::EntryMustStartAsDraft
            | RuleCode::BaseCurrencyLocked
            | RuleCode::SettingsIdFixed
            | RuleCode::BookAlreadyOpen
            | RuleCode::AccountLocked
            | RuleCode::SystemKeyTaken
            | RuleCode::NameEmpty
            | RuleCode::AccountParentArchived
            | RuleCode::AccountParentKindMismatch
            | RuleCode::AccountNameTaken
            | RuleCode::EntryDeletedHasLines
            | RuleCode::EntryDeleted => true,
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

#[test]
fn every_rule_code_has_a_distinct_text_in_both_languages() {
    let mut seen = std::collections::HashSet::new();
    for code in ALL {
        let tr = code.message(Lang::Tr);
        let en = code.message(Lang::En);
        assert!(!tr.is_empty() && !en.is_empty(), "{}", code.as_str());
        assert_ne!(
            tr,
            en,
            "{} has the same text in both languages",
            code.as_str()
        );
        assert!(
            seen.insert(tr),
            "duplicate Turkish text for {}",
            code.as_str()
        );
        assert!(
            seen.insert(en),
            "duplicate English text for {}",
            code.as_str()
        );
    }
}

#[test]
fn a_rule_error_exposes_the_rule_code_as_its_api_code() {
    let err = Error::Rule(RuleCode::EntryUnbalanced);
    assert_eq!(err.code(), "entry_unbalanced");
    assert_eq!(
        err.message(Lang::En),
        RuleCode::EntryUnbalanced.message(Lang::En)
    );
}

#[test]
fn other_errors_have_fixed_codes() {
    let id = crate::ids::DocId::new();
    assert_eq!(Error::Conflict { doc_id: id }.code(), "conflict");
    assert_eq!(Error::InvalidBody("x".into()).code(), "invalid_body");
    assert_eq!(
        Error::MissingReference {
            kind: "account",
            what: "x".into()
        }
        .code(),
        "missing_reference"
    );
    assert_eq!(Error::ForeignDatabase.code(), "foreign_database");
    assert_eq!(Error::Internal("x").code(), "internal");
    assert_eq!(
        Error::NewerDatabase {
            found: 2,
            supported: 1
        }
        .code(),
        "newer_database"
    );
    assert_eq!(
        Error::Sqlite(rusqlite::Error::QueryReturnedNoRows).code(),
        "database"
    );
}

#[test]
fn api_messages_never_carry_database_or_internal_text() {
    let secret = "SELECT secret FROM sqlite_master /tmp/ledger.db";
    let errors = [
        Error::Sqlite(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(1),
            Some(secret.to_string()),
        )),
        Error::InvalidBody(secret.to_string()),
        Error::Internal("secret internal detail"),
        Error::MissingReference {
            kind: "account",
            what: secret.to_string(),
        },
    ];
    for err in errors {
        for lang in [Lang::Tr, Lang::En] {
            let text = err.message(lang);
            assert!(!text.is_empty());
            assert!(!text.contains("secret"), "{text}");
            assert!(!text.contains("/tmp"), "{text}");
        }
    }
}
