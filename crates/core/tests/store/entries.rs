//! Posting entries: an entry balances to exactly zero, a revision replaces its lines and keeps history, and a faulty writer cannot unbalance a posted entry (ADR-0004, ADR-0010, ADR-0012).

use super::common::*;

#[test]
fn a_balanced_posted_entry_projects_its_lines() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    // Act
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    // Assert
    assert_eq!(count(&w.store, "SELECT count(*) FROM line"), 2);
    assert_eq!(count(&w.store, "SELECT sum(base_value) FROM line"), 0);
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn an_unbalanced_posted_entry_is_refused_and_nothing_is_stored() {
    // Arrange
    let mut w = world();
    let body = entry_body(&w, "posted", &[(w.food, 5000), (w.cash, -4999)]);
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::EntryUnbalanced))
    ));
    assert_eq!(
        count(
            &w.store,
            "SELECT count(*) FROM revision WHERE doc_kind = 'entry'"
        ),
        0
    );
}

#[test]
fn a_posted_entry_needs_two_lines() {
    // Arrange
    let mut w = world();
    let body = entry_body(&w, "posted", &[(w.food, 5000)]);
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::EntryTooFewLines))
    ));
}

#[test]
fn a_draft_entry_may_be_unbalanced() {
    // Arrange
    let mut w = world();
    let body = entry_body(&w, "draft", &[(w.food, 5000)]);
    // Act / Assert
    w.store
        .write_revision(rev(DocKind::Entry, new_id(), None, body))
        .unwrap();
}

#[test]
fn a_new_revision_replaces_the_lines_and_keeps_the_history() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, first) = post(&mut w, &[(food, 5000), (cash, -5000)]);
    // Act
    w.store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            Some(first),
            entry_body(&w, "posted", &[(food, 7000), (cash, -7000)]),
        ))
        .unwrap();
    // Assert
    assert_eq!(
        count(
            &w.store,
            "SELECT count(*) FROM revision WHERE doc_kind = 'entry'"
        ),
        2
    );
    assert_eq!(count(&w.store, "SELECT count(*) FROM line"), 2);
    assert_eq!(count(&w.store, "SELECT max(quantity) FROM line"), 7000);
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn a_posted_entry_can_go_back_to_draft_and_be_posted_again() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, first) = post(&mut w, &[(food, 5000), (cash, -5000)]);
    let draft = w
        .store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            Some(first),
            entry_body(&w, "draft", &[(food, 5000), (cash, -4000)]),
        ))
        .unwrap();
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Entry,
        entry,
        Some(draft),
        entry_body(&w, "posted", &[(food, 5000), (cash, -4000)]),
    ));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::EntryUnbalanced))
    ));
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn a_faulty_writer_cannot_unbalance_a_posted_entry() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    // Act
    let result = w
        .store
        .tamper("UPDATE line SET base_value = base_value + 1 WHERE line_no = 0");
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::EntryUnbalanced))
    ));
}
