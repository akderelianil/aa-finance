//! Revisions are immutable and chain correctly: no edit or delete, a parent belongs to the same document, a document never changes kind, and a failed batch changes nothing (ADR-0012).

use super::common::*;

#[test]
fn a_revision_cannot_be_changed_or_deleted() {
    // Arrange
    let w = world();
    let conn = w.store.raw_connection();
    // Act
    let update = conn
        .execute("UPDATE revision SET body = '{}'", [])
        .map_err(Error::from);
    let delete = conn
        .execute("DELETE FROM revision", [])
        .map_err(Error::from);
    // Assert
    assert!(matches!(
        update,
        Err(Error::Rule(RuleCode::RevisionImmutable))
    ));
    assert!(matches!(
        delete,
        Err(Error::Rule(RuleCode::RevisionImmutable))
    ));
}

#[test]
fn a_parent_must_belong_to_the_same_document() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (_, parent) = post(&mut w, &[(food, 1), (cash, -1)]);
    let other = new_id();
    // Act
    let result = w.store.import_revisions(vec![ImportedRevision {
        id: new_id(),
        server_seq: None,
        revision: rev(
            DocKind::Entry,
            other,
            Some(parent),
            entry_body(&w, "draft", &[(w.food, 1)]),
        ),
    }]);
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::RevisionParentMismatch))
    ));
}

#[test]
fn a_document_never_changes_kind() {
    // Arrange
    let mut w = world();
    let current = w.store.current_revision(w.food).unwrap();
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Entry,
        w.food,
        current,
        entry_body(&w, "draft", &[(w.food, 1)]),
    ));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::RevisionKindMismatch))
    ));
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn a_failed_batch_leaves_revisions_and_projection_unchanged() {
    // Arrange
    let mut w = world();
    let before = count(&w.store, "SELECT count(*) FROM revision");
    let good = rev(
        DocKind::Entry,
        new_id(),
        None,
        entry_body(&w, "posted", &[(w.food, 100), (w.cash, -100)]),
    );
    let bad = rev(
        DocKind::Entry,
        new_id(),
        None,
        entry_body(&w, "posted", &[(w.food, 100), (w.cash, -99)]),
    );
    // Act
    let result = w.store.write_revisions(vec![good.clone(), bad, good]);
    // Assert
    assert!(result.is_err());
    assert_eq!(count(&w.store, "SELECT count(*) FROM revision"), before);
    assert_eq!(count(&w.store, "SELECT count(*) FROM entry"), 0);
}
