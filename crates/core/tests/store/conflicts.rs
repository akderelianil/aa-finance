//! Server order and conflicts: the earliest server sequence is the head, a sibling is kept as a branch, and a stale parent is a conflict (ADR-0012).

use super::common::*;

#[test]
fn the_server_sequence_is_set_once() {
    // Arrange
    let w = world();
    let conn = w.store.raw_connection();
    // Act
    let first = conn.execute("UPDATE revision SET server_seq = 1 WHERE seq = 1", []);
    let second = conn
        .execute("UPDATE revision SET server_seq = 2 WHERE seq = 1", [])
        .map_err(Error::from);
    // Assert
    assert!(first.is_ok());
    assert!(matches!(
        second,
        Err(Error::Rule(RuleCode::RevisionImmutable))
    ));
}

#[test]
fn a_stale_parent_or_a_second_root_is_a_conflict() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, first) = post(&mut w, &[(food, 5000), (cash, -5000)]);
    w.store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            Some(first),
            entry_body(&w, "draft", &[(food, 1)]),
        ))
        .unwrap();
    // Act
    let stale = w.store.write_revision(rev(
        DocKind::Entry,
        entry,
        Some(first),
        entry_body(&w, "draft", &[(food, 2)]),
    ));
    let second_root = w.store.write_revision(rev(
        DocKind::Entry,
        entry,
        None,
        entry_body(&w, "draft", &[(food, 3)]),
    ));
    // Assert
    assert!(matches!(stale, Err(Error::Conflict { .. })));
    assert!(matches!(second_root, Err(Error::Conflict { .. })));
    assert!(w.store.conflicts(entry).unwrap().is_empty());
}

#[test]
fn the_earliest_server_sequence_is_the_head_and_the_sibling_is_kept() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, root) = post(&mut w, &[(food, 100), (cash, -100)]);
    let (id_a, id_b) = (RevisionId::new(), RevisionId::new());
    let branch = |id, seq, amount| ImportedRevision {
        id,
        server_seq: Some(seq),
        revision: rev(
            DocKind::Entry,
            entry,
            Some(root),
            entry_body(&w, "draft", &[(food, amount)]),
        ),
    };
    // Act
    w.store
        .import_revisions(vec![branch(id_a, 41, 200), branch(id_b, 42, 300)])
        .unwrap();
    // Assert
    assert_eq!(w.store.current_revision(entry).unwrap(), Some(id_a));
    assert_eq!(w.store.conflicts(entry).unwrap(), vec![id_b]);
    assert_eq!(count(&w.store, "SELECT max(quantity) FROM line"), 200);
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn recording_a_server_sequence_can_change_the_head_and_the_projection_follows() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, root) = post(&mut w, &[(food, 100), (cash, -100)]);
    let (local, remote) = (RevisionId::new(), RevisionId::new());
    let branch = |id, amount| ImportedRevision {
        id,
        server_seq: None,
        revision: rev(
            DocKind::Entry,
            entry,
            Some(root),
            entry_body(&w, "draft", &[(food, amount)]),
        ),
    };
    w.store
        .import_revisions(vec![branch(local, 200), branch(remote, 300)])
        .unwrap();
    // Act
    w.store.set_server_seq(remote, 1).unwrap();
    // Assert
    assert_eq!(w.store.current_revision(entry).unwrap(), Some(remote));
    assert_eq!(count(&w.store, "SELECT max(quantity) FROM line"), 300);
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn a_server_sequence_can_be_recorded_for_any_kind_of_document() {
    // Arrange
    let mut w = world();
    let commodity = w.store.current_revision(w.try_id).unwrap().unwrap();
    let account = w.store.current_revision(w.cash).unwrap().unwrap();
    // Act
    w.store.set_server_seq(commodity, 1).unwrap();
    w.store.set_server_seq(account, 2).unwrap();
    // Assert
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn a_server_sequence_for_an_unknown_revision_is_a_missing_reference() {
    // Arrange
    let mut w = world();
    // Act
    let result = w.store.set_server_seq(RevisionId::new(), 1);
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "revision",
            ..
        })
    ));
}

fn sibling(
    w: &World,
    entry: DocId,
    root: RevisionId,
    id: RevisionId,
    server_seq: Option<i64>,
    created_at_ms: i64,
    amount: i64,
) -> ImportedRevision {
    ImportedRevision {
        id,
        server_seq,
        revision: NewRevision {
            created_at_ms,
            ..rev(
                DocKind::Entry,
                entry,
                Some(root),
                entry_body(w, "draft", &[(w.food, amount)]),
            )
        },
    }
}

#[test]
fn siblings_without_a_server_order_follow_creation_time_then_arrival() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, root) = post(&mut w, &[(food, 100), (cash, -100)]);
    let (late, early, same_time) = (RevisionId::new(), RevisionId::new(), RevisionId::new());
    // Act: the later-created sibling arrives first.
    w.store
        .import_revisions(vec![
            sibling(&w, entry, root, late, None, 3_000, 200),
            sibling(&w, entry, root, early, None, 2_000, 300),
        ])
        .unwrap();
    // Assert: the earlier creation time is the head.
    assert_eq!(w.store.current_revision(entry).unwrap(), Some(early));
    // Act: a third sibling with the same time as the head arrives later.
    w.store
        .import_revisions(vec![sibling(&w, entry, root, same_time, None, 2_000, 400)])
        .unwrap();
    // Assert: equal times keep the one that arrived first.
    assert_eq!(w.store.current_revision(entry).unwrap(), Some(early));
    // Three siblings: one head, two branches kept.
    assert_eq!(w.store.conflicts(entry).unwrap().len(), 2);
}

#[test]
fn a_sequenced_branch_beats_an_unsequenced_one_whatever_their_times() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, root) = post(&mut w, &[(food, 100), (cash, -100)]);
    let (local, server) = (RevisionId::new(), RevisionId::new());
    // Act: the local branch is much older, the server branch has an order.
    w.store
        .import_revisions(vec![
            sibling(&w, entry, root, local, None, 500, 200),
            sibling(&w, entry, root, server, Some(7), 9_000, 300),
        ])
        .unwrap();
    // Assert
    assert_eq!(w.store.current_revision(entry).unwrap(), Some(server));
    // Two siblings: one head, one branch kept.
    assert_eq!(w.store.conflicts(entry).unwrap().len(), 1);
}

#[test]
fn a_revision_of_a_kind_this_build_does_not_know_is_an_internal_error() {
    // Arrange: a damaged file with a kind the CHECK would normally refuse.
    let mut w = world();
    let id = RevisionId::new();
    w.store
        .raw_connection()
        .execute_batch(&format!(
            "PRAGMA ignore_check_constraints = ON;
             INSERT INTO revision (id, doc_kind, doc_id, parent_id, author_id, created_at_ms, rules_version,
                                   schema_version, core_version, body)
             VALUES (X'{}', 'zzz', randomblob(16), NULL, randomblob(16), 1, 1, 1, 'x', '{{}}');
             PRAGMA ignore_check_constraints = OFF;",
            hex(id)
        ))
        .unwrap();
    // Act
    let result = w.store.set_server_seq(id, 5);
    // Assert
    assert!(matches!(result, Err(Error::Internal(m)) if m.contains("kind")));
}
