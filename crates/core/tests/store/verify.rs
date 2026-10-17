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
    assert_eq!(drift[0].reason, DriftReason::DiffersFromRevision);
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
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body))
        .unwrap();
    // Act
    let drift = w.store.verify_projection().unwrap();
    // Assert
    assert_eq!(drift.len(), 1);
    assert_eq!(drift[0].reason, DriftReason::PostedInvariantBroken);
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

#[test]
fn the_projection_session_cannot_be_removed_or_replaced_to_open_the_gates() {
    // Arrange
    let w = world();
    let conn = w.store.raw_connection();
    // Act
    let delete = conn
        .execute("DELETE FROM projection_session", [])
        .map_err(Error::from);
    let replace = conn
        .execute(
            "INSERT OR REPLACE INTO projection_session (id, open, carry) VALUES (1, 1, 1)",
            [],
        )
        .map_err(Error::from);
    // Assert
    assert!(matches!(
        delete,
        Err(Error::Rule(RuleCode::ProjectionClosed))
    ));
    assert!(matches!(
        replace,
        Err(Error::Rule(RuleCode::ProjectionClosed))
    ));
}

#[test]
fn a_missing_session_row_keeps_the_projection_closed() {
    // Arrange: the guard on the session table removed, then the row deleted (a faulty writer).
    let w = world();
    let conn = w.store.raw_connection();
    conn.execute_batch(
        "DROP TRIGGER projection_session_no_delete; DELETE FROM projection_session;",
    )
    .unwrap();
    // Act
    let insert = conn
        .execute("INSERT INTO commodity (uuid, current_revision_id, code, scale) VALUES (randomblob(16), randomblob(16), 'X', 2)", [])
        .map_err(Error::from);
    // Assert
    assert!(matches!(
        insert,
        Err(Error::Rule(RuleCode::ProjectionClosed))
    ));
}

#[test]
fn verify_projection_finds_a_pointer_to_an_older_revision_with_the_same_content() {
    // Arrange: two revisions with identical bodies, so only the pointer check can see the difference.
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, first) = post(&mut w, &[(food, 100), (cash, -100)]);
    w.store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            Some(first),
            entry_body(&w, "posted", &[(food, 100), (cash, -100)]),
        ))
        .unwrap();
    w.store
        .tamper(&format!(
            "UPDATE entry SET current_revision_id = X'{}' WHERE uuid = X'{}'",
            hex(first),
            hex(entry)
        ))
        .unwrap();
    // Act
    let drift = w.store.verify_projection().unwrap();
    // Assert
    assert_eq!(drift.len(), 1);
    assert_eq!(
        (drift[0].doc_kind, drift[0].doc_id, drift[0].reason),
        (DocKind::Entry, entry, DriftReason::NotAtHead)
    );
}

#[test]
fn verify_projection_finds_a_document_whose_projection_row_is_missing() {
    // Arrange: one case per kind; the entry is a draft so its removal fires no posted trigger.
    let cases = [
        (
            "DELETE FROM commodity WHERE code = 'EUR'",
            DocKind::Commodity,
        ),
        ("DELETE FROM account WHERE name = 'Food'", DocKind::Account),
        ("DELETE FROM entry", DocKind::Entry),
    ];
    for (sql, kind) in cases {
        let mut w = world();
        let body = entry_body(&w, "draft", &[]);
        w.store
            .write_revision(rev(DocKind::Entry, DocId::new(), None, body))
            .unwrap();
        w.store.tamper(sql).unwrap();
        // Act
        let drift = w.store.verify_projection().unwrap();
        // Assert
        assert_eq!(drift.len(), 1, "{sql}");
        assert_eq!(
            (drift[0].doc_kind, drift[0].reason),
            (kind, DriftReason::NotAtHead),
            "{sql}"
        );
    }
}

#[test]
fn verify_projection_finds_an_orphan_row_that_looks_like_a_real_document() {
    // Arrange: the orphan copies a real draft entry in every field, so only the pointer check sees it.
    let mut w = world();
    let body = entry_body(&w, "draft", &[]);
    w.store
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body))
        .unwrap();
    w.store
        .tamper(
            "INSERT INTO entry (uuid, current_revision_id, date, memo, no, status)
             SELECT randomblob(16), current_revision_id, date, memo, no, status FROM entry LIMIT 1",
        )
        .unwrap();
    // Act
    let drift = w.store.verify_projection().unwrap();
    // Assert
    assert_eq!(drift.len(), 1);
    assert_eq!(
        (drift[0].doc_kind, drift[0].reason),
        (DocKind::Entry, DriftReason::OrphanRow)
    );
}

#[test]
fn verify_projection_finds_every_kind_of_changed_field() {
    // Each case changes one column of an otherwise healthy projection and expects exactly one drift.
    let cases = [
        ("UPDATE commodity SET scale = 3 WHERE code = 'EUR'", DocKind::Commodity),
        ("UPDATE account SET kind = 'liability' WHERE name = 'Spare'", DocKind::Account),
        ("UPDATE account SET archived = 1 WHERE name = 'Spare'", DocKind::Account),
        ("UPDATE account SET commodity_id = (SELECT id FROM commodity WHERE code = 'EUR') WHERE name = 'Spare'", DocKind::Account),
        ("UPDATE account SET parent_id = (SELECT id FROM account WHERE name = 'Cash') WHERE name = 'Spare'", DocKind::Account),
        ("UPDATE entry SET date = '2020-01-01'", DocKind::Entry),
        ("UPDATE entry SET memo = 'changed'", DocKind::Entry),
        ("UPDATE entry SET no = '7'", DocKind::Entry),
        ("UPDATE entry SET status = 'draft'", DocKind::Entry),
        ("UPDATE line SET line_no = line_no + 5", DocKind::Entry),
    ];
    for (sql, kind) in cases {
        // Arrange
        let mut w = world();
        let try_id = w.try_id;
        add_account(&mut w, "Spare", try_id);
        let (food, cash) = (w.food, w.cash);
        post(&mut w, &[(food, 5000), (cash, -5000)]);
        w.store.tamper(sql).unwrap();
        // Act
        let drift = w.store.verify_projection().unwrap();
        // Assert
        assert_eq!(drift.len(), 1, "{sql}");
        assert_eq!(
            (drift[0].doc_kind, drift[0].reason),
            (kind, DriftReason::DiffersFromRevision),
            "{sql}"
        );
    }
}

#[test]
fn verify_projection_reports_a_posted_entry_with_one_line_even_when_it_sums_to_zero() {
    // Arrange: no trigger stops the faulty writer; the sum is 0 but there is only one line.
    let mut w = world();
    w.store
        .raw_connection()
        .execute_batch("DROP TRIGGER entry_posted_balances; DROP TRIGGER line_posted_insert; DROP TRIGGER line_posted_update; DROP TRIGGER line_posted_delete;")
        .unwrap();
    let (food, try_id) = (w.food, w.try_id);
    w.store
        .write_revision(rev(
            DocKind::Entry,
            DocId::new(),
            None,
            lines_body("posted", &[(food, try_id, 5, 0)]),
        ))
        .unwrap();
    // Act
    let drift = w.store.verify_projection().unwrap();
    // Assert
    assert_eq!(drift.len(), 1);
    assert_eq!(drift[0].reason, DriftReason::PostedInvariantBroken);
}

#[test]
fn every_posted_entry_of_the_fixture_sums_to_zero_and_a_rebuild_keeps_it_clean() {
    // Arrange
    let mut store = Store::open_in_memory().unwrap();
    aa_core::fixture::generate(&mut store, 500).unwrap();
    let unbalanced = "SELECT count(*) FROM (SELECT entry_id FROM line GROUP BY entry_id HAVING sum(base_value) <> 0)";
    let three_lines =
        "SELECT count(*) FROM (SELECT entry_id FROM line GROUP BY entry_id HAVING count(*) = 3)";
    // Act
    store.rebuild_projection().unwrap();
    // Assert
    assert_eq!(count(&store, unbalanced), 0);
    assert!(
        count(&store, three_lines) > 0,
        "the fixture has entries of three lines"
    );
    assert_eq!(count(&store, "SELECT count(*) FROM entry"), 500);
    assert!(store.verify_projection().unwrap().is_empty());
}

#[test]
fn a_rate_kept_in_the_body_of_a_line_is_not_drift_and_survives_a_rebuild() {
    // Arrange
    let mut w = world();
    let eur = w.eur_id;
    let dollars = add_account(&mut w, "Dollars", eur);
    let mut body = lines_body(
        "posted",
        &[
            (dollars, w.eur_id, 1000, 40_000),
            (w.cash, w.try_id, -40_000, -40_000),
        ],
    );
    body["lines"][0]["rate"] = serde_json::json!("40");
    let entry = DocId::new();
    w.store
        .write_revision(rev(DocKind::Entry, entry, None, body))
        .unwrap();
    // Act
    let before = w.store.verify_projection().unwrap();
    w.store.rebuild_projection().unwrap();
    let after = w.store.verify_projection().unwrap();
    // Assert
    assert!(before.is_empty());
    assert!(after.is_empty());
}
