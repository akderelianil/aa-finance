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
    let (id_a, id_b) = (new_id(), new_id());
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
    let (local, remote) = (new_id(), new_id());
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
    let result = w.store.set_server_seq(new_id(), 1);
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "revision",
            ..
        })
    ));
}
