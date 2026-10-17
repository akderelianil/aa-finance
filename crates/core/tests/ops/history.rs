//! The history marks the head and keeps a lost branch visible as a conflict (ADR-0012).

use super::common::*;
use aa_core::{ImportedRevision, NewRevision};

#[test]
fn the_last_revision_of_a_straight_history_is_the_head_and_nothing_conflicts() {
    // Arrange
    let mut b = book();
    let posted = b
        .ledger
        .post_entry(entry(vec![line(b.food, "5.00"), line(b.cash, "-5.00")]))
        .unwrap();
    b.ledger.delete_entry(posted.doc_id).unwrap();
    // Act
    let history = b.ledger.history(posted.doc_id).unwrap();
    // Assert
    let heads: Vec<bool> = history.iter().map(|item| item.head).collect();
    assert_eq!(heads, [false, true]);
    assert!(history.iter().all(|item| !item.conflict));
}

#[test]
fn a_branch_written_elsewhere_is_kept_as_a_conflict_and_the_head_stays() {
    // Arrange
    let mut b = book();
    let posted = b
        .ledger
        .post_entry(entry(vec![line(b.food, "5.00"), line(b.cash, "-5.00")]))
        .unwrap();
    let first = b.ledger.history(posted.doc_id).unwrap()[0].revision_id;
    let record = b.ledger.store_mut().revision(first).unwrap().unwrap();
    let sibling = ImportedRevision {
        id: aa_core::RevisionId::new(),
        server_seq: None,
        revision: NewRevision {
            doc_kind: record.doc_kind,
            doc_id: record.doc_id,
            parent_id: None,
            author_id: new_id(),
            created_at_ms: 9_000,
            body: record.body.clone(),
            restore: None,
        },
    };
    let sibling_id = sibling.id;
    b.ledger
        .store_mut()
        .import_revisions(vec![sibling])
        .unwrap();
    // Act
    let history = b.ledger.history(posted.doc_id).unwrap();
    // Assert
    let lost = history
        .iter()
        .find(|item| item.revision_id == sibling_id)
        .unwrap();
    let kept = history
        .iter()
        .find(|item| item.revision_id == first)
        .unwrap();
    assert!(lost.conflict && !lost.head);
    assert!(kept.head && !kept.conflict);
}
