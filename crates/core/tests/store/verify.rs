//! verify_projection: only the projector writes the projection tables, and every kind of drift (a tampered line, a wrong pointer, an orphan, a broken posted invariant) is found; the generated fixture verifies clean (ADR-0012).

use super::common::*;

#[test]
fn only_the_projector_writes_projection_tables() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    // Act
    let result = w
        .store
        .raw_connection()
        .execute("DELETE FROM line", [])
        .map_err(Error::from);
    let insert = w
        .store
        .raw_connection()
        .execute("INSERT INTO commodity (uuid, current_revision_id, code, scale) VALUES (randomblob(16), randomblob(16), 'X', 2)", [])
        .map_err(Error::from);
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::ProjectionClosed))
    ));
    assert!(matches!(
        insert,
        Err(Error::Rule(RuleCode::ProjectionClosed))
    ));
}

#[test]
fn verify_projection_finds_a_tampered_line_and_a_tampered_posted_invariant() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    w.store
        .tamper("UPDATE line SET quantity = quantity + 1 WHERE line_no = 0")
        .unwrap();
    // Act
    let drift = w.store.verify_projection().unwrap();
    // Assert
    assert_eq!(drift.len(), 1);
    assert_eq!(drift[0].doc_kind, DocKind::Entry);
}

#[test]
fn verify_projection_finds_a_wrong_pointer_and_an_orphan() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, first) = post(&mut w, &[(food, 100), (cash, -100)]);
    w.store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            Some(first),
            entry_body(&w, "draft", &[(food, 200)]),
        ))
        .unwrap();
    w.store
        .tamper(&format!(
            "UPDATE entry SET current_revision_id = X'{}' WHERE uuid = X'{}'",
            hex(first),
            hex(entry)
        ))
        .unwrap();
    w.store
        .tamper("INSERT INTO entry (uuid, current_revision_id, date, status) SELECT randomblob(16), current_revision_id, '2026-01-01', 'draft' FROM entry LIMIT 1")
        .unwrap();
    // Act
    let drift = w.store.verify_projection().unwrap();
    // Assert
    assert_eq!(drift.len(), 2);
}

#[test]
fn verify_projection_finds_a_changed_commodity_and_account() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    w.store
        .tamper("UPDATE commodity SET code = 'ZZZ' WHERE code = 'EUR'")
        .unwrap();
    w.store
        .tamper("UPDATE account SET name = 'Tampered' WHERE name = 'Food'")
        .unwrap();
    // Act
    let drift = w.store.verify_projection().unwrap();
    // Assert
    let kinds: Vec<_> = drift.iter().map(|d| d.doc_kind).collect();
    assert_eq!(kinds, vec![DocKind::Commodity, DocKind::Account]);
}

#[test]
fn verify_projection_finds_a_posted_entry_that_broke_its_invariants() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    w.store
        .raw_connection()
        .execute_batch("DROP TRIGGER line_posted_update; DROP TRIGGER line_posted_delete;")
        .unwrap();
    w.store
        .tamper("DELETE FROM line WHERE line_no = 1")
        .unwrap();
    // Act
    let drift = w.store.verify_projection().unwrap();
    // Assert
    assert_eq!(drift.len(), 1);
    assert_eq!(
        drift[0].reason,
        "the entry or its lines differ from its revision"
    );
}

#[test]
fn verify_projection_reports_a_posted_entry_whose_invariants_were_never_enforced() {
    // Arrange
    let mut w = world();
    w.store
        .raw_connection()
        .execute_batch("DROP TRIGGER entry_posted_balances; DROP TRIGGER line_posted_insert; DROP TRIGGER line_posted_update; DROP TRIGGER line_posted_delete;")
        .unwrap();
    let body = entry_body(&w, "posted", &[(w.food, 5000), (w.cash, -4000)]);
    w.store
        .write_revision(rev(DocKind::Entry, new_id(), None, body))
        .unwrap();
    // Act
    let drift = w.store.verify_projection().unwrap();
    // Assert
    assert_eq!(drift.len(), 1);
    assert_eq!(drift[0].reason, "a posted entry breaks its invariants");
}

#[test]
fn the_generated_fixture_verifies_clean_and_balances_to_zero() {
    // Arrange
    let mut store = Store::open_in_memory().unwrap();
    // Act
    aa_core::fixture::generate(&mut store, 2_000).unwrap();
    // Assert
    assert_eq!(count(&store, "SELECT count(*) FROM entry"), 2_000);
    assert_eq!(count(&store, "SELECT sum(base_value) FROM line"), 0);
    assert!(store.verify_projection().unwrap().is_empty());
}
