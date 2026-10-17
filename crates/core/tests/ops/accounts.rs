//! Commodities and accounts through the operations: the author and the time are stamped by the
//! ledger, names change as new revisions, and archiving is a revision, never a delete.

use super::common::*;

#[test]
fn an_operation_stamps_the_author_and_the_time() {
    // Arrange
    let mut b = book();
    b.clock.set(5_000);
    // Act
    let created = b.ledger.create_account(account("Bank", b.try_id)).unwrap();
    // Assert
    let history = b.ledger.history(created.doc_id).unwrap();
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].revision_id, created.revision_id);
    assert_eq!(history[0].author_id, b.author);
    assert_eq!(history[0].created_at_ms, 5_000);
}

#[test]
fn renaming_an_account_adds_a_revision_and_keeps_the_old_one() {
    // Arrange
    let mut b = book();
    b.clock.set(2_000);
    // Act
    let renamed = b.ledger.rename_account(b.cash, "Wallet").unwrap();
    // Assert
    let history = b.ledger.history(b.cash).unwrap();
    assert_eq!(history.len(), 2);
    assert_eq!(history[1].revision_id, renamed.revision_id);
    assert_eq!(history[1].created_at_ms, 2_000);
}

#[test]
fn renaming_an_unknown_account_is_a_missing_reference() {
    // Arrange
    let mut b = book();
    // Act
    let result = b.ledger.rename_account(DocId::new(), "Ghost");
    // Assert
    assert!(matches!(result, Err(Error::MissingReference { .. })));
}

#[test]
fn an_account_with_an_unknown_commodity_is_a_missing_reference() {
    // Arrange
    let mut b = book();
    // Act
    let result = b.ledger.create_account(account("Bank", DocId::new()));
    // Assert
    assert!(matches!(result, Err(Error::MissingReference { .. })));
}

#[test]
fn an_archived_account_takes_no_new_entry_and_can_come_back() {
    // Arrange
    let mut b = book();
    b.ledger.set_account_archived(b.food, true).unwrap();
    let lines = vec![line(b.food, "10.00"), line(b.cash, "-10.00")];
    // Act
    let refused = b.ledger.post_entry(entry(lines.clone()));
    b.ledger.set_account_archived(b.food, false).unwrap();
    let accepted = b.ledger.post_entry(entry(lines));
    // Assert
    assert!(matches!(
        refused,
        Err(Error::Rule(RuleCode::AccountArchived))
    ));
    assert!(accepted.is_ok());
}

#[test]
fn a_commodity_code_can_be_used_once() {
    // Arrange
    let mut b = book();
    // Act
    let result = b.ledger.create_commodity("TRY", 2);
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::CommodityCodeTaken))
    ));
}

#[test]
fn a_child_account_can_be_created_under_a_parent() {
    // Arrange
    let mut b = book();
    let mut input = account("Pocket", b.try_id);
    input.parent = Some(b.cash);
    // Act
    let result = b.ledger.create_account(input);
    // Assert
    assert!(result.is_ok());
}

#[test]
fn naming_a_wrong_kind_of_document_as_an_account_is_a_missing_reference() {
    // Arrange
    let mut b = book();
    // Act
    let result = b.ledger.rename_account(b.try_id, "Not an account");
    // Assert
    assert!(matches!(result, Err(Error::MissingReference { .. })));
}

#[test]
fn opening_a_book_opens_a_locked_rounding_account() {
    // Arrange
    let b = book();
    // Act
    let rounding = b.ledger.system_account("rounding").unwrap();
    // Assert
    let view = b.ledger.account(rounding).unwrap();
    assert_eq!(view.name, "Rounding");
    assert!(view.locked);
    assert_eq!(view.system_key.as_deref(), Some("rounding"));
    assert_eq!(view.commodity, b.try_id);
}

#[test]
fn a_locked_account_is_refused_a_rename_an_archive_and_an_undo() {
    // Arrange
    let mut b = book();
    let rounding = b.ledger.system_account("rounding").unwrap();
    // Act
    let renamed = b.ledger.rename_account(rounding, "Mine");
    let archived = b.ledger.set_account_archived(rounding, true);
    let undone = b.ledger.undo(rounding);
    // Assert
    for result in [renamed, archived, undone] {
        assert!(matches!(result, Err(Error::Rule(RuleCode::AccountLocked))));
    }
}

#[test]
fn an_ordinary_account_has_no_system_key_and_is_not_locked() {
    // Arrange
    let b = book();
    // Act
    let view = b.ledger.account(b.cash).unwrap();
    // Assert
    assert!(!view.locked);
    assert_eq!(view.system_key, None);
}
