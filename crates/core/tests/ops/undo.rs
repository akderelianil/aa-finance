//! Undo is a new revision that restores the previous body; nothing is removed and the history keeps both.

use super::common::*;

#[test]
fn undo_restores_the_previous_version_as_a_new_revision() {
    // Arrange
    let mut b = book();
    let posted = b
        .ledger
        .post_entry(entry(vec![line(b.food, "12.50"), line(b.cash, "-12.50")]))
        .unwrap();
    b.ledger
        .edit_entry(
            posted.doc_id,
            entry(vec![line(b.food, "15.00"), line(b.cash, "-15.00")]),
        )
        .unwrap();
    // Act
    b.ledger.undo(posted.doc_id).unwrap();
    // Assert
    let detail = b.ledger.entry(posted.doc_id).unwrap();
    assert_eq!(detail.lines[0].amount, "12.50");
    assert_eq!(b.ledger.history(posted.doc_id).unwrap().len(), 3);
}

#[test]
fn undoing_twice_brings_the_edit_back() {
    // Arrange
    let mut b = book();
    let posted = b
        .ledger
        .post_entry(entry(vec![line(b.food, "12.50"), line(b.cash, "-12.50")]))
        .unwrap();
    b.ledger
        .edit_entry(
            posted.doc_id,
            entry(vec![line(b.food, "15.00"), line(b.cash, "-15.00")]),
        )
        .unwrap();
    // Act
    b.ledger.undo(posted.doc_id).unwrap();
    b.ledger.undo(posted.doc_id).unwrap();
    // Assert
    let detail = b.ledger.entry(posted.doc_id).unwrap();
    assert_eq!(detail.lines[0].amount, "15.00");
}

#[test]
fn a_document_with_one_revision_has_nothing_to_undo() {
    // Arrange
    let mut b = book();
    // Act
    let result = b.ledger.undo(b.cash);
    // Assert
    assert!(matches!(result, Err(Error::Rule(RuleCode::NothingToUndo))));
}

#[test]
fn undoing_an_unknown_document_is_a_missing_reference() {
    // Arrange
    let mut b = book();
    // Act
    let result = b.ledger.undo(new_id());
    // Assert
    assert!(matches!(result, Err(Error::MissingReference { .. })));
}

#[test]
fn undo_of_a_rename_restores_the_old_name() {
    // Arrange
    let mut b = book();
    b.ledger.rename_account(b.cash, "Wallet").unwrap();
    // Act
    b.ledger.undo(b.cash).unwrap();
    // Assert
    assert_eq!(b.ledger.account(b.cash).unwrap().name, "Cash");
}
