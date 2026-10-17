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
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body));
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
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body));
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
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body))
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

#[test]
fn a_posted_entry_balances_on_base_value_not_on_quantity() {
    // Arrange: 34.00 TRY of food paid with 1.00 EUR, which is 34.00 in the book currency.
    let mut w = world();
    let eur = w.eur_id;
    let eur_cash = add_account(&mut w, "EUR cash", eur);
    let (food, try_id, eur_id) = (w.food, w.try_id, w.eur_id);
    // Act
    let balanced_on_base = w.store.write_revision(rev(
        DocKind::Entry,
        DocId::new(),
        None,
        lines_body(
            "posted",
            &[(food, try_id, 3400, 3400), (eur_cash, eur_id, -100, -3400)],
        ),
    ));
    let balanced_on_quantity = w.store.write_revision(rev(
        DocKind::Entry,
        DocId::new(),
        None,
        lines_body(
            "posted",
            &[(food, try_id, 100, 100), (eur_cash, eur_id, -100, -50)],
        ),
    ));
    // Assert
    assert!(balanced_on_base.is_ok());
    assert!(matches!(
        balanced_on_quantity,
        Err(Error::Rule(RuleCode::EntryUnbalanced))
    ));
}

#[test]
fn an_entry_that_is_one_unit_off_is_unbalanced() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let off = entry_body(&w, "posted", &[(food, 5), (cash, -4)]);
    let exact_body = entry_body(&w, "posted", &[(food, 5), (cash, -5)]);
    // Act
    let off_by_one = w
        .store
        .write_revision(rev(DocKind::Entry, DocId::new(), None, off));
    let exact = w
        .store
        .write_revision(rev(DocKind::Entry, DocId::new(), None, exact_body));
    // Assert
    assert!(matches!(
        off_by_one,
        Err(Error::Rule(RuleCode::EntryUnbalanced))
    ));
    assert!(exact.is_ok());
}

#[test]
fn a_line_whose_base_value_has_the_other_sign_is_refused_with_a_code() {
    // Arrange: the base values cancel, but the first line is +100 with base -100.
    let mut w = world();
    let (food, cash, try_id) = (w.food, w.cash, w.try_id);
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Entry,
        DocId::new(),
        None,
        lines_body(
            "posted",
            &[(food, try_id, 100, -100), (cash, try_id, 100, 100)],
        ),
    ));
    // Assert
    assert!(matches!(result, Err(Error::Rule(RuleCode::LineBaseSign))));
}

#[test]
fn a_line_with_neither_quantity_nor_base_value_is_refused_with_a_code() {
    // Arrange
    let mut w = world();
    let (food, cash, try_id) = (w.food, w.cash, w.try_id);
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Entry,
        DocId::new(),
        None,
        lines_body("draft", &[(food, try_id, 0, 0), (cash, try_id, 0, 0)]),
    ));
    // Assert
    assert!(matches!(result, Err(Error::Rule(RuleCode::LineEmpty))));
}

#[test]
fn a_posted_entry_goes_back_to_draft_and_is_posted_again_with_its_history() {
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
    // Act: fix the draft and post it again, then correct a posted entry directly.
    let third = w
        .store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            Some(draft),
            entry_body(&w, "posted", &[(food, 4000), (cash, -4000)]),
        ))
        .unwrap();
    let fourth = w
        .store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            Some(third),
            entry_body(&w, "posted", &[(food, 300), (cash, -300)]),
        ))
        .unwrap();
    // Assert
    let revisions = format!(
        "SELECT count(*) FROM revision WHERE doc_id = X'{}'",
        hex(entry)
    );
    assert_eq!(count(&w.store, &revisions), 4);
    assert_eq!(w.store.current_revision(entry).unwrap(), Some(fourth));
    assert_eq!(count(&w.store, "SELECT max(quantity) FROM line"), 300);
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn lines_of_a_posted_entry_cannot_be_added_or_removed_directly() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    // Act
    let insert = w.store.tamper(
        "INSERT INTO line (entry_id, line_no, account_id, commodity_id, quantity, base_value)
         SELECT entry_id, 9, account_id, commodity_id, 7, 7 FROM line LIMIT 1",
    );
    let delete = w.store.tamper("DELETE FROM line WHERE line_no = 1");
    // Assert
    assert!(matches!(
        insert,
        Err(Error::Rule(RuleCode::EntryUnbalanced))
    ));
    assert!(matches!(
        delete,
        Err(Error::Rule(RuleCode::EntryTooFewLines))
    ));
    assert_eq!(count(&w.store, "SELECT count(*) FROM line"), 2);
}

#[test]
fn a_draft_cannot_be_posted_directly_when_it_does_not_balance() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let body = entry_body(&w, "draft", &[(food, 5000), (cash, -4000)]);
    w.store
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body))
        .unwrap();
    // Act
    let result = w.store.tamper("UPDATE entry SET status = 'posted'");
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::EntryUnbalanced))
    ));
}

#[test]
fn an_entry_cannot_be_inserted_as_posted_without_its_lines() {
    // Arrange
    let w = world();
    // Act
    let result = w.store.tamper(
        "INSERT INTO entry (uuid, current_revision_id, date, status)
         VALUES (randomblob(16), (SELECT id FROM revision LIMIT 1), '2026-01-01', 'posted')",
    );
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::EntryMustStartAsDraft))
    ));
}
