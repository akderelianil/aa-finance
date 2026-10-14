//! Rebuilding the projection from the revisions: it repairs drift, replays parents before children and archived accounts, and stops with a clear error on damaged input.

use super::common::*;

#[test]
fn rebuilding_the_projection_repairs_drift() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    w.store
        .tamper("UPDATE line SET quantity = quantity + 1 WHERE line_no = 0")
        .unwrap();
    // Act
    w.store.rebuild_projection().unwrap();
    // Assert
    assert!(w.store.verify_projection().unwrap().is_empty());
    assert_eq!(count(&w.store, "SELECT count(*) FROM line"), 2);
}

#[test]
fn rebuilding_replays_parents_before_children_and_archived_accounts() {
    // Arrange
    let mut w = world();
    let (parent, child) = (new_id(), new_id());
    w.store
        .write_revision(rev(
            DocKind::Account,
            parent,
            None,
            account_body("Parent", w.try_id, None, false),
        ))
        .unwrap();
    w.store
        .write_revision(rev(
            DocKind::Account,
            child,
            None,
            account_body("Child", w.try_id, Some(parent), false),
        ))
        .unwrap();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    let current = w.store.current_revision(food).unwrap();
    w.store
        .write_revision(rev(
            DocKind::Account,
            food,
            current,
            account_body("Food", w.try_id, None, true),
        ))
        .unwrap();
    // Act
    w.store.rebuild_projection().unwrap();
    // Assert
    assert!(w.store.verify_projection().unwrap().is_empty());
    assert_eq!(
        count(
            &w.store,
            "SELECT count(*) FROM account WHERE parent_id IS NOT NULL"
        ),
        1
    );
}

#[test]
fn rebuilding_retries_an_account_whose_new_parent_was_created_later() {
    // Arrange
    let mut w = world();
    let (a, b, c) = (new_id(), new_id(), new_id());
    w.store
        .write_revision(rev(
            DocKind::Account,
            a,
            None,
            account_body("A", w.try_id, None, false),
        ))
        .unwrap();
    w.store
        .write_revision(rev(
            DocKind::Account,
            b,
            None,
            account_body("B", w.try_id, Some(a), false),
        ))
        .unwrap();
    w.store
        .write_revision(rev(
            DocKind::Account,
            c,
            None,
            account_body("C", w.try_id, None, false),
        ))
        .unwrap();
    let current = w.store.current_revision(a).unwrap();
    w.store
        .write_revision(rev(
            DocKind::Account,
            a,
            current,
            account_body("A", w.try_id, Some(c), false),
        ))
        .unwrap();
    // Act
    w.store.rebuild_projection().unwrap();
    // Assert
    assert!(w.store.verify_projection().unwrap().is_empty());
    assert_eq!(
        count(
            &w.store,
            "SELECT count(*) FROM account WHERE parent_id IS NOT NULL"
        ),
        2
    );
}

#[test]
fn a_revision_body_that_cannot_be_read_stops_a_rebuild_and_leaves_the_projection_alone() {
    // Arrange: a stored revision damaged behind the core's back (the immutability trigger removed).
    let mut w = world();
    let conn = w.store.raw_connection();
    conn.execute_batch(
        "DROP TRIGGER revision_immutable;
         UPDATE revision SET body = '{\"nonsense\": true}' WHERE doc_kind = 'commodity';",
    )
    .unwrap();
    let before = count(&w.store, "SELECT count(*) FROM account");
    // Act
    let result = w.store.rebuild_projection();
    // Assert
    assert!(matches!(result, Err(Error::InvalidBody(_))));
    assert_eq!(count(&w.store, "SELECT count(*) FROM account"), before);
}

#[test]
fn a_rebuild_that_cannot_find_a_parent_account_reports_the_missing_reference() {
    // Arrange: a parent account whose revisions were lost behind the core's back.
    let mut w = world();
    let (parent, child) = (new_id(), new_id());
    w.store
        .write_revision(rev(
            DocKind::Account,
            parent,
            None,
            account_body("Parent", w.try_id, None, false),
        ))
        .unwrap();
    w.store
        .write_revision(rev(
            DocKind::Account,
            child,
            None,
            account_body("Child", w.try_id, Some(parent), false),
        ))
        .unwrap();
    let conn = w.store.raw_connection();
    conn.execute_batch("DROP TRIGGER revision_no_delete; PRAGMA foreign_keys = OFF;")
        .unwrap();
    conn.execute("DELETE FROM revision WHERE doc_id = ?1", [parent])
        .unwrap();
    // Act
    let result = w.store.rebuild_projection();
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "account",
            ..
        })
    ));
}
