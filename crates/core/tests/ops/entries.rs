//! Posting and editing entries through the operations: amounts arrive as canonical strings in the
//! scale of each account's commodity, and a foreign line needs a rate or a base value (ADR-0009, ADR-0010).

use super::common::*;

#[test]
fn a_balanced_entry_is_posted_from_canonical_strings() {
    // Arrange
    let mut b = book();
    // Act
    let posted = b
        .ledger
        .post_entry(entry(vec![line(b.food, "12.50"), line(b.cash, "-12.50")]));
    // Assert
    let detail = b.ledger.entry(posted.unwrap().doc_id).unwrap();
    assert_eq!(detail.lines.len(), 2);
    assert_eq!(detail.lines[0].amount, "12.50");
    assert_eq!(detail.lines[1].amount, "-12.50");
    assert_eq!(detail.date, "2026-10-16");
}

#[test]
fn an_unbalanced_entry_is_refused_with_a_rule_code() {
    // Arrange
    let mut b = book();
    // Act
    let result = b
        .ledger
        .post_entry(entry(vec![line(b.food, "12.50"), line(b.cash, "-12.00")]));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::EntryUnbalanced))
    ));
}

#[test]
fn an_amount_with_too_many_decimals_is_refused() {
    // Arrange
    let mut b = book();
    // Act
    let result = b
        .ledger
        .post_entry(entry(vec![line(b.food, "12.505"), line(b.cash, "-12.505")]));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::AmountTooPrecise))
    ));
}

#[test]
fn an_amount_that_is_not_a_number_is_refused() {
    // Arrange
    let mut b = book();
    // Act
    let result = b
        .ledger
        .post_entry(entry(vec![line(b.food, "twelve"), line(b.cash, "-12")]));
    // Assert
    assert!(matches!(result, Err(Error::Rule(RuleCode::AmountInvalid))));
}

#[test]
fn an_entry_on_an_unknown_account_is_a_missing_reference() {
    // Arrange
    let mut b = book();
    // Act
    let result = b
        .ledger
        .post_entry(entry(vec![line(new_id(), "5"), line(b.cash, "-5")]));
    // Assert
    assert!(matches!(result, Err(Error::MissingReference { .. })));
}

#[test]
fn a_foreign_line_takes_its_base_value_from_the_given_rate() {
    // Arrange
    let mut b = book();
    let dollars = b
        .ledger
        .create_account(account("Dollars", b.usd_id))
        .unwrap()
        .doc_id;
    let mut usd_line = line(dollars, "10.00");
    usd_line.rate = Some("40".to_string());
    // Act
    let posted = b
        .ledger
        .post_entry(entry(vec![usd_line, line(b.cash, "-400.00")]));
    // Assert
    let detail = b.ledger.entry(posted.unwrap().doc_id).unwrap();
    assert_eq!(detail.lines[0].amount, "10.00");
    assert_eq!(detail.lines[0].base, "400.00");
}

#[test]
fn a_foreign_line_without_rate_or_base_cannot_be_valued() {
    // Arrange
    let mut b = book();
    let dollars = b
        .ledger
        .create_account(account("Dollars", b.usd_id))
        .unwrap()
        .doc_id;
    // Act
    let result = b
        .ledger
        .post_entry(entry(vec![line(dollars, "10.00"), line(b.cash, "-400.00")]));
    // Assert
    assert!(matches!(result, Err(Error::Rule(RuleCode::RateMissing))));
}

#[test]
fn a_foreign_line_takes_the_base_value_the_user_gives() {
    // Arrange
    let mut b = book();
    let dollars = b
        .ledger
        .create_account(account("Dollars", b.usd_id))
        .unwrap()
        .doc_id;
    let mut usd_line = line(dollars, "10.00");
    usd_line.base = Some("395.50".to_string());
    // Act
    let posted = b
        .ledger
        .post_entry(entry(vec![usd_line, line(b.cash, "-395.50")]));
    // Assert
    let detail = b.ledger.entry(posted.unwrap().doc_id).unwrap();
    assert_eq!(detail.lines[0].base, "395.50");
}

#[test]
fn editing_an_entry_replaces_its_lines_and_keeps_the_history() {
    // Arrange
    let mut b = book();
    let posted = b
        .ledger
        .post_entry(entry(vec![line(b.food, "12.50"), line(b.cash, "-12.50")]))
        .unwrap();
    // Act
    b.ledger
        .edit_entry(
            posted.doc_id,
            entry(vec![line(b.food, "15.00"), line(b.cash, "-15.00")]),
        )
        .unwrap();
    // Assert
    let detail = b.ledger.entry(posted.doc_id).unwrap();
    assert_eq!(detail.lines[0].amount, "15.00");
    assert_eq!(b.ledger.history(posted.doc_id).unwrap().len(), 2);
}

#[test]
fn editing_something_that_is_not_an_entry_is_refused() {
    // Arrange
    let mut b = book();
    // Act
    let result = b
        .ledger
        .edit_entry(b.cash, entry(vec![line(b.food, "1"), line(b.cash, "-1")]));
    // Assert
    assert!(matches!(result, Err(Error::MissingReference { .. })));
}

#[test]
fn a_ledger_without_a_base_commodity_cannot_post() {
    // Arrange
    let store = aa_core::Store::open_in_memory().unwrap();
    let mut ledger = Ledger::new(store, new_id(), Box::new(TestClock(Default::default())));
    // Act
    let result = ledger.post_entry(entry(vec![]));
    // Assert
    assert!(matches!(result, Err(Error::MissingReference { .. })));
}

#[test]
fn a_rate_other_than_one_on_a_base_currency_line_is_refused() {
    // Arrange
    let mut b = book();
    let mut base_line = line(b.food, "10.00");
    base_line.rate = Some("40".to_string());
    // Act
    let result = b
        .ledger
        .post_entry(entry(vec![base_line, line(b.cash, "-10.00")]));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::RateBaseConflict))
    ));
}

#[test]
fn a_zero_line_and_a_bad_date_are_refused_with_codes() {
    // Arrange
    let mut b = book();
    let zero = entry(vec![line(b.food, "0.00"), line(b.cash, "0.00")]);
    let mut bad_date = entry(vec![line(b.food, "1"), line(b.cash, "-1")]);
    bad_date.date = "2026-13-45".to_string();
    // Act
    let zero_result = b.ledger.post_entry(zero);
    let date_result = b.ledger.post_entry(bad_date);
    // Assert
    assert!(matches!(zero_result, Err(Error::Rule(RuleCode::LineEmpty))));
    assert!(matches!(
        date_result,
        Err(Error::Rule(RuleCode::DateInvalid))
    ));
}

#[test]
fn a_failed_edit_leaves_the_entry_as_it_was() {
    // Arrange
    let mut b = book();
    let posted = b
        .ledger
        .post_entry(entry(vec![line(b.food, "12.50"), line(b.cash, "-12.50")]))
        .unwrap();
    // Act
    let result = b.ledger.edit_entry(
        posted.doc_id,
        entry(vec![line(b.food, "9"), line(b.cash, "-8")]),
    );
    // Assert
    assert!(result.is_err());
    assert_eq!(b.ledger.history(posted.doc_id).unwrap().len(), 1);
    assert_eq!(
        b.ledger.entry(posted.doc_id).unwrap().lines[0].amount,
        "12.50"
    );
}

#[test]
fn the_base_currency_cannot_be_swapped_for_another() {
    // Arrange
    let mut b = book();
    // Act
    let result = b.ledger.set_base_commodity(b.usd_id);
    // Assert
    assert!(result.is_err());
}
