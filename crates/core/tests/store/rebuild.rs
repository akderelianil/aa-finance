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
    let (parent, child) = (DocId::new(), DocId::new());
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
    let (a, b, c) = (DocId::new(), DocId::new(), DocId::new());
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
    let (parent, child) = (DocId::new(), DocId::new());
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

/// The whole projection as text, with documents named by their uuid (surrogate ids may differ after a rebuild).
fn dump(store: &Store) -> Vec<String> {
    let conn = store.raw_connection();
    let queries = [
        "SELECT 'c', hex(uuid), hex(current_revision_id), code, scale FROM commodity ORDER BY uuid",
        "SELECT 'a', hex(a.uuid), hex(a.current_revision_id), a.name, coalesce(hex(p.uuid), ''), a.kind,
                hex(c.uuid), a.archived
         FROM account a LEFT JOIN account p ON p.id = a.parent_id JOIN commodity c ON c.id = a.commodity_id
         ORDER BY a.uuid",
        "SELECT 'e', hex(uuid), hex(current_revision_id), date, coalesce(memo, ''), coalesce(no, ''), status
         FROM entry ORDER BY uuid",
        "SELECT 'l', hex(e.uuid), l.line_no, hex(a.uuid), hex(c.uuid), l.quantity, l.base_value
         FROM line l JOIN entry e ON e.id = l.entry_id JOIN account a ON a.id = l.account_id
         JOIN commodity c ON c.id = l.commodity_id ORDER BY e.uuid, l.line_no",
    ];
    let mut out = Vec::new();
    for sql in queries {
        let mut stmt = conn.prepare(sql).unwrap();
        let columns = stmt.column_count();
        let rows = stmt
            .query_map([], |row| {
                let mut parts = Vec::new();
                for i in 0..columns {
                    parts.push(format!("{:?}", row.get::<_, rusqlite::types::Value>(i)?));
                }
                Ok(parts.join("|"))
            })
            .unwrap();
        out.extend(rows.map(|r| r.unwrap()));
    }
    out
}

#[test]
fn a_rebuild_reproduces_the_incremental_projection_exactly() {
    // Arrange: a history with edits, a draft, an archived account, a rename and a conflict branch.
    let mut w = world();
    let (food, cash, try_id) = (w.food, w.cash, w.try_id);
    let spare = add_account(&mut w, "Spare", try_id);
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
    w.store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            Some(draft),
            entry_body(&w, "posted", &[(food, 4000), (cash, -4000)]),
        ))
        .unwrap();
    let spare_head = w.store.current_revision(spare).unwrap();
    w.store
        .write_revision(rev(
            DocKind::Account,
            spare,
            spare_head,
            account_body("Spare", try_id, Some(cash), true),
        ))
        .unwrap();
    let other = post(&mut w, &[(food, 700), (cash, -700)]);
    w.store
        .import_revisions(vec![ImportedRevision {
            id: RevisionId::new(),
            server_seq: Some(3),
            revision: rev(
                DocKind::Entry,
                other.0,
                Some(other.1),
                entry_body(&w, "draft", &[(food, 1)]),
            ),
        }])
        .unwrap();
    let before = dump(&w.store);
    // Act
    w.store.rebuild_projection().unwrap();
    let once = dump(&w.store);
    w.store.rebuild_projection().unwrap();
    let twice = dump(&w.store);
    // Assert
    assert!(before.len() > 8, "the history is not trivial");
    assert_eq!(once, before);
    assert_eq!(twice, before);
    assert!(w.store.verify_projection().unwrap().is_empty());
}
