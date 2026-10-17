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

/// One entry with three versions: 10.00, 20.00, 30.00.
fn three_versions(b: &mut Book) -> DocId {
    let posted = b
        .ledger
        .post_entry(entry(vec![line(b.food, "10.00"), line(b.cash, "-10.00")]))
        .unwrap();
    for amount in ["20.00", "30.00"] {
        let minus = format!("-{amount}");
        b.ledger
            .edit_entry(
                posted.doc_id,
                entry(vec![line(b.food, amount), line(b.cash, &minus)]),
            )
            .unwrap();
    }
    posted.doc_id
}

fn amount(b: &Book, doc: DocId) -> String {
    b.ledger.entry(doc).unwrap().lines[0].amount.clone()
}

#[test]
fn undoing_twice_walks_back_two_versions() {
    // Arrange
    let mut b = book();
    let doc = three_versions(&mut b);
    // Act
    b.ledger.undo(doc).unwrap();
    b.ledger.undo(doc).unwrap();
    // Assert
    assert_eq!(amount(&b, doc), "10.00");
}

#[test]
fn undo_stops_at_the_first_version() {
    // Arrange
    let mut b = book();
    let doc = three_versions(&mut b);
    b.ledger.undo(doc).unwrap();
    b.ledger.undo(doc).unwrap();
    // Act
    let result = b.ledger.undo(doc);
    // Assert
    assert!(matches!(result, Err(Error::Rule(RuleCode::NothingToUndo))));
}

#[test]
fn redo_brings_back_what_undo_took_away_one_step_at_a_time() {
    // Arrange
    let mut b = book();
    let doc = three_versions(&mut b);
    b.ledger.undo(doc).unwrap();
    b.ledger.undo(doc).unwrap();
    // Act
    b.ledger.redo(doc).unwrap();
    let after_one = amount(&b, doc);
    b.ledger.redo(doc).unwrap();
    // Assert
    assert_eq!(after_one, "20.00");
    assert_eq!(amount(&b, doc), "30.00");
}

#[test]
fn redo_with_nothing_undone_is_refused() {
    // Arrange
    let mut b = book();
    let doc = three_versions(&mut b);
    // Act
    let fresh = b.ledger.redo(doc);
    b.ledger.undo(doc).unwrap();
    b.ledger.redo(doc).unwrap();
    let spent = b.ledger.redo(doc);
    // Assert
    assert!(matches!(fresh, Err(Error::Rule(RuleCode::NothingToRedo))));
    assert!(matches!(spent, Err(Error::Rule(RuleCode::NothingToRedo))));
}

#[test]
fn a_new_edit_after_an_undo_drops_the_redo() {
    // Arrange
    let mut b = book();
    let doc = three_versions(&mut b);
    b.ledger.undo(doc).unwrap();
    b.ledger
        .edit_entry(
            doc,
            entry(vec![line(b.food, "99.00"), line(b.cash, "-99.00")]),
        )
        .unwrap();
    // Act
    let redo = b.ledger.redo(doc);
    b.ledger.undo(doc).unwrap();
    // Assert
    assert!(matches!(redo, Err(Error::Rule(RuleCode::NothingToRedo))));
    assert_eq!(amount(&b, doc), "20.00");
}

#[test]
fn undo_after_a_redo_goes_back_again() {
    // Arrange
    let mut b = book();
    let doc = three_versions(&mut b);
    b.ledger.undo(doc).unwrap();
    b.ledger.undo(doc).unwrap();
    b.ledger.redo(doc).unwrap();
    // Act
    b.ledger.undo(doc).unwrap();
    // Assert
    assert_eq!(amount(&b, doc), "10.00");
    b.ledger.redo(doc).unwrap();
    assert_eq!(amount(&b, doc), "20.00");
}

#[test]
fn the_history_marks_the_revisions_that_only_restore() {
    // Arrange
    let mut b = book();
    let doc = three_versions(&mut b);
    let second = b.ledger.history(doc).unwrap()[1].revision_id;
    // Act
    b.ledger.undo(doc).unwrap();
    b.ledger.redo(doc).unwrap();
    // Assert
    let history = b.ledger.history(doc).unwrap();
    assert_eq!(history.len(), 5);
    assert!(history[..3].iter().all(|item| item.restore.is_none()));
    let undo = history[3].restore.unwrap();
    assert_eq!((undo.kind, undo.from), (RestoreKind::Undo, second));
    assert_eq!(history[4].restore.unwrap().kind, RestoreKind::Redo);
}

#[test]
fn a_locked_account_cannot_be_redone() {
    // Arrange
    let mut b = book();
    let rounding = b.ledger.system_account("rounding").unwrap();
    // Act
    let result = b.ledger.redo(rounding);
    // Assert
    assert!(matches!(result, Err(Error::Rule(RuleCode::AccountLocked))));
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
    let result = b.ledger.undo(DocId::new());
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
