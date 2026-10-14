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
    let result = w.store.write_revisions(vec![good, bad]);
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::EntryUnbalanced))
    ));
    assert_eq!(count(&w.store, "SELECT count(*) FROM revision"), before);
    assert_eq!(count(&w.store, "SELECT count(*) FROM entry"), 0);
}

#[test]
fn a_conflict_in_the_middle_of_a_batch_rolls_the_whole_batch_back() {
    // Arrange: the second revision names a parent that is not the head of its document.
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, first) = post(&mut w, &[(food, 100), (cash, -100)]);
    let before = count(&w.store, "SELECT count(*) FROM revision");
    let fresh = rev(DocKind::Entry, new_id(), None, entry_body(&w, "draft", &[]));
    let stale = rev(
        DocKind::Entry,
        entry,
        None,
        entry_body(&w, "draft", &[(food, 1)]),
    );
    // Act
    let result = w.store.write_revisions(vec![fresh, stale]);
    // Assert
    assert!(matches!(result, Err(Error::Conflict { .. })));
    assert_eq!(count(&w.store, "SELECT count(*) FROM revision"), before);
    assert_eq!(w.store.current_revision(entry).unwrap(), Some(first));
}

#[test]
fn every_column_of_a_revision_is_immutable() {
    // Arrange
    let w = world();
    let conn = w.store.raw_connection();
    let columns = [
        ("seq", "seq + 100"),
        ("id", "randomblob(16)"),
        ("doc_kind", "'account'"),
        ("doc_id", "randomblob(16)"),
        ("parent_id", "randomblob(16)"),
        ("author_id", "randomblob(16)"),
        ("created_at_ms", "created_at_ms + 1"),
        ("rules_version", "rules_version + 1"),
        ("schema_version", "schema_version + 1"),
        ("core_version", "'other'"),
        ("body", "'{}'"),
    ];
    for (column, value) in columns {
        // Act
        let result = conn
            .execute(
                &format!("UPDATE revision SET {column} = {value} WHERE seq = (SELECT min(seq) FROM revision)"),
                [],
            )
            .map_err(Error::from);
        // Assert
        assert!(
            matches!(result, Err(Error::Rule(RuleCode::RevisionImmutable))),
            "{column}"
        );
    }
}

#[test]
fn a_replace_cannot_rewrite_a_revision() {
    // Arrange: INSERT OR REPLACE deletes the old row without firing delete triggers.
    let w = world();
    let conn = w.store.raw_connection();
    // Act
    let result = conn
        .execute(
            "INSERT OR REPLACE INTO revision (seq, id, doc_kind, doc_id, parent_id, author_id, created_at_ms,
               rules_version, schema_version, core_version, server_seq, body)
             SELECT seq, id, doc_kind, doc_id, parent_id, author_id, created_at_ms,
               rules_version, schema_version, core_version, server_seq, '{\"code\":\"HACK\",\"scale\":2}'
             FROM revision LIMIT 1",
            [],
        )
        .map_err(Error::from);
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::RevisionImmutable))
    ));
    assert_eq!(
        count(
            &w.store,
            "SELECT count(*) FROM revision WHERE body LIKE '%HACK%'"
        ),
        0
    );
}
