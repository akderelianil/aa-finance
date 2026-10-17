//! Opening a book and the base currency through the operations: `open_book` writes the base currency and the settings together, the settings are read back from the file, and the base currency is locked by the first entry (ADR-0021, K21).

use super::common::*;

fn empty_ledger() -> Ledger {
    let store = aa_core::Store::open_in_memory().unwrap();
    Ledger::new(store, new_id(), Box::new(TestClock(Default::default())))
}

#[test]
fn opening_a_book_creates_the_base_currency_and_the_settings() {
    // Arrange
    let mut ledger = empty_ledger();
    // Act
    let opened = ledger.open_book("TRY", 2).unwrap();
    // Assert
    let settings = ledger.settings().unwrap();
    assert_eq!(settings.base_commodity, opened.doc_id);
    assert_eq!(settings.base_code, "TRY");
    assert_eq!(settings.base_scale, 2);
}

#[test]
fn a_book_can_be_opened_only_once() {
    // Arrange
    let mut ledger = empty_ledger();
    ledger.open_book("TRY", 2).unwrap();
    // Act
    let again = ledger.open_book("USD", 2);
    // Assert
    assert!(matches!(again, Err(Error::Rule(RuleCode::BookAlreadyOpen))));
}

#[test]
fn a_book_with_an_invalid_base_currency_is_not_opened() {
    // Arrange
    let mut ledger = empty_ledger();
    // Act
    let result = ledger.open_book("TRY", 19);
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::CommodityScaleInvalid))
    ));
    assert!(ledger.settings().is_err());
}

#[test]
fn a_book_without_settings_has_no_base_currency_to_read() {
    // Arrange
    let ledger = empty_ledger();
    // Act
    let result = ledger.settings();
    // Assert
    assert!(matches!(result, Err(Error::MissingReference { .. })));
}

#[test]
fn a_ledger_opened_over_the_same_file_finds_the_base_currency() {
    // Arrange
    let dir = std::env::temp_dir().join(format!("aa-core-ops-{}", new_id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("book.db");
    let mut first = Ledger::new(
        aa_core::Store::open(&path).unwrap(),
        new_id(),
        Box::new(TestClock(Default::default())),
    );
    let opened = first.open_book("EUR", 2).unwrap();
    drop(first);
    // Act
    let second = Ledger::new(
        aa_core::Store::open(&path).unwrap(),
        new_id(),
        Box::new(TestClock(Default::default())),
    );
    let settings = second.settings();
    drop(second);
    std::fs::remove_dir_all(&dir).unwrap();
    // Assert
    assert_eq!(settings.unwrap().base_commodity, opened.doc_id);
}

#[test]
fn the_base_currency_can_change_until_the_first_entry() {
    // Arrange
    let mut b = book();
    // Act
    b.ledger.set_base_currency(b.usd_id).unwrap();
    b.ledger.set_base_currency(b.try_id).unwrap();
    // Assert
    assert_eq!(b.ledger.settings().unwrap().base_commodity, b.try_id);
}

#[test]
fn the_base_currency_is_locked_by_the_first_entry() {
    // Arrange
    let mut b = book();
    b.ledger
        .post_entry(entry(vec![line(b.food, "5"), line(b.cash, "-5")]))
        .unwrap();
    // Act
    let result = b.ledger.set_base_currency(b.usd_id);
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::BaseCurrencyLocked))
    ));
    assert_eq!(b.ledger.settings().unwrap().base_commodity, b.try_id);
}

#[test]
fn the_base_currency_must_be_a_commodity() {
    // Arrange
    let mut b = book();
    // Act
    let result = b.ledger.set_base_currency(b.cash);
    // Assert
    assert!(matches!(result, Err(Error::MissingReference { .. })));
}
