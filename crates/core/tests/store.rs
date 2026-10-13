//! Behavior of the revision store, the projection and `verify_projection` (ADR-0011, ADR-0012).
use aa_core::{ids::new_id, DocKind, Error, Id, ImportedRevision, NewRevision, RuleCode, Store};
use serde_json::json;

fn rev(kind: DocKind, doc: Id, parent: Option<Id>, body: serde_json::Value) -> NewRevision {
    NewRevision {
        doc_kind: kind,
        doc_id: doc,
        parent_id: parent,
        author_id: new_id(),
        created_at_ms: 1_000,
        body: body.to_string(),
    }
}

fn account_body(
    name: &str,
    commodity: Id,
    parent: Option<Id>,
    archived: bool,
) -> serde_json::Value {
    json!({"name": name, "parent": parent.map(|p| p.to_string()), "kind": "asset", "commodity": commodity.to_string(), "archived": archived})
}

struct World {
    store: Store,
    try_id: Id,
    eur_id: Id,
    cash: Id,
    food: Id,
}

fn world() -> World {
    let mut store = Store::open_in_memory().unwrap();
    let (try_id, eur_id, cash, food) = (new_id(), new_id(), new_id(), new_id());
    store
        .write_revision(rev(
            DocKind::Commodity,
            try_id,
            None,
            json!({"code": "TRY", "scale": 2}),
        ))
        .unwrap();
    store
        .write_revision(rev(
            DocKind::Commodity,
            eur_id,
            None,
            json!({"code": "EUR", "scale": 2}),
        ))
        .unwrap();
    store
        .write_revision(rev(
            DocKind::Account,
            cash,
            None,
            account_body("Cash", try_id, None, false),
        ))
        .unwrap();
    store
        .write_revision(rev(
            DocKind::Account,
            food,
            None,
            account_body("Food", try_id, None, false),
        ))
        .unwrap();
    World {
        store,
        try_id,
        eur_id,
        cash,
        food,
    }
}

fn entry_body(w: &World, status: &str, amounts: &[(Id, i64)]) -> serde_json::Value {
    let lines: Vec<_> =
        amounts.iter().map(|(a, v)| json!({"account": a.to_string(), "commodity": w.try_id.to_string(), "quantity": v, "base_value": v})).collect();
    json!({"date": "2026-10-13", "memo": "lunch", "no": null, "status": status, "lines": lines})
}

fn count(store: &Store, sql: &str) -> i64 {
    store
        .raw_connection()
        .query_row(sql, [], |row| row.get(0))
        .unwrap()
}

fn post(w: &mut World, amounts: &[(Id, i64)]) -> (Id, Id) {
    let entry = new_id();
    let revision = w
        .store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            None,
            entry_body(w, "posted", amounts),
        ))
        .unwrap();
    (entry, revision)
}

fn hex(id: Id) -> String {
    id.as_bytes().iter().map(|b| format!("{b:02x}")).collect()
}

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
fn an_archived_account_takes_no_new_lines() {
    // Arrange
    let mut w = world();
    let current = w.store.current_revision(w.food).unwrap();
    w.store
        .write_revision(rev(
            DocKind::Account,
            w.food,
            current,
            account_body("Food", w.try_id, None, true),
        ))
        .unwrap();
    let body = entry_body(&w, "posted", &[(w.food, 5000), (w.cash, -5000)]);
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::AccountArchived))
    ));
}

#[test]
fn an_old_entry_on_an_archived_account_can_still_be_corrected() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, first) = post(&mut w, &[(food, 5000), (cash, -5000)]);
    let current = w.store.current_revision(food).unwrap();
    w.store
        .write_revision(rev(
            DocKind::Account,
            food,
            current,
            account_body("Food", w.try_id, None, true),
        ))
        .unwrap();
    let mut corrected = entry_body(&w, "posted", &[(food, 5000), (cash, -5000)]);
    corrected["memo"] = json!("fixed memo");
    // Act
    let ok = w
        .store
        .write_revision(rev(DocKind::Entry, entry, Some(first), corrected));
    let changed = w.store.write_revision(rev(
        DocKind::Entry,
        entry,
        ok.as_ref().ok().copied(),
        entry_body(&w, "posted", &[(food, 6000), (cash, -6000)]),
    ));
    // Assert
    assert!(ok.is_ok());
    assert!(matches!(
        changed,
        Err(Error::Rule(RuleCode::AccountArchived))
    ));
}

#[test]
fn a_line_must_use_the_commodity_of_its_account() {
    // Arrange
    let mut w = world();
    let body = json!({"date": "2026-10-13", "status": "draft", "lines": [
        {"account": w.food.to_string(), "commodity": w.eur_id.to_string(), "quantity": 10, "base_value": 10}]});
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::LineCommodityMismatch))
    ));
}

#[test]
fn the_commodity_of_an_account_in_use_cannot_change() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    let current = w.store.current_revision(food).unwrap();
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Account,
        food,
        current,
        account_body("Food", w.eur_id, None, false),
    ));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::AccountCommodityLocked))
    ));
}

#[test]
fn the_scale_of_a_commodity_in_use_cannot_change() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    let current = w.store.current_revision(w.try_id).unwrap();
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Commodity,
        w.try_id,
        current,
        json!({"code": "TRY", "scale": 3}),
    ));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::CommodityScaleLocked))
    ));
}

#[test]
fn a_commodity_can_be_renamed_without_breaking_old_entries() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    let current = w.store.current_revision(w.try_id).unwrap();
    // Act
    w.store
        .write_revision(rev(
            DocKind::Commodity,
            w.try_id,
            current,
            json!({"code": "TL", "scale": 2}),
        ))
        .unwrap();
    w.store.rebuild_projection().unwrap();
    // Assert
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn a_duplicate_commodity_code_scale_range_and_amount_bound_have_codes() {
    // Arrange
    let mut w = world();
    let amount = json!({"date": "2026-10-13", "status": "draft", "lines": [
        {"account": w.food.to_string(), "commodity": w.try_id.to_string(), "quantity": 4_611_686_018_427_387_905_i64, "base_value": 1}]});
    // Act
    let dup = w.store.write_revision(rev(
        DocKind::Commodity,
        new_id(),
        None,
        json!({"code": "TRY", "scale": 2}),
    ));
    let scale = w.store.write_revision(rev(
        DocKind::Commodity,
        new_id(),
        None,
        json!({"code": "ABC", "scale": 19}),
    ));
    let big = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, amount));
    let date = w.store.write_revision(rev(
        DocKind::Entry,
        new_id(),
        None,
        json!({"date": "2026-99-99", "status": "draft", "lines": []}),
    ));
    // Assert
    assert!(matches!(
        dup,
        Err(Error::Rule(RuleCode::CommodityCodeTaken))
    ));
    assert!(matches!(
        scale,
        Err(Error::Rule(RuleCode::CommodityScaleInvalid))
    ));
    assert!(matches!(big, Err(Error::Rule(RuleCode::AmountOutOfRange))));
    assert!(matches!(date, Err(Error::Rule(RuleCode::DateInvalid))));
}

#[test]
fn a_summed_overflow_is_an_amount_error_not_an_opaque_one() {
    // Arrange
    let mut w = world();
    let big = 4_611_686_018_427_387_904_i64;
    let body = entry_body(
        &w,
        "posted",
        &[(w.food, big), (w.cash, big), (w.food, big), (w.cash, big)],
    );
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::AmountOutOfRange))
    ));
}

#[test]
fn a_missing_account_reference_is_reported() {
    // Arrange
    let mut w = world();
    let body = entry_body(&w, "draft", &[(new_id(), 5000)]);
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "account",
            ..
        })
    ));
}

#[test]
fn malformed_unknown_or_misspelled_bodies_are_refused() {
    // Arrange
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let good = entry_body(&w, "posted", &[(food, 100), (cash, -100)]);
    let mut typo_field = good.clone();
    typo_field["memoo"] = json!("rent");
    let mut typo_status = good.clone();
    typo_status["status"] = json!("Posted");
    // Act
    let nonsense = w.store.write_revision(rev(
        DocKind::Entry,
        new_id(),
        None,
        json!({"nonsense": true}),
    ));
    let field = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, typo_field));
    let status = w
        .store
        .write_revision(rev(DocKind::Entry, new_id(), None, typo_status));
    // Assert
    assert!(matches!(nonsense, Err(Error::InvalidBody(_))));
    assert!(matches!(field, Err(Error::InvalidBody(_))));
    assert!(matches!(status, Err(Error::InvalidBody(_))));
}

#[test]
fn an_account_cannot_become_its_own_ancestor() {
    // Arrange
    let mut w = world();
    let (a, b) = (new_id(), new_id());
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
    let current = w.store.current_revision(a).unwrap();
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Account,
        a,
        current,
        account_body("A", w.try_id, Some(b), false),
    ));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::AccountParentCycle))
    ));
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
    let result = w.store.write_revisions(vec![good.clone(), bad, good]);
    // Assert
    assert!(result.is_err());
    assert_eq!(count(&w.store, "SELECT count(*) FROM revision"), before);
    assert_eq!(count(&w.store, "SELECT count(*) FROM entry"), 0);
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
fn a_file_database_uses_wal_and_foreign_keys() {
    // Arrange
    let dir = std::env::temp_dir().join(format!("aa-core-{}", new_id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("ledger.db");
    // Act
    let store = Store::open(&path).unwrap();
    // Assert
    let mode: String = store
        .raw_connection()
        .query_row("PRAGMA journal_mode", [], |r| r.get(0))
        .unwrap();
    let fk: i64 = store
        .raw_connection()
        .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
        .unwrap();
    assert_eq!(mode, "wal");
    assert_eq!(fk, 1);
    drop(store);
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn two_connections_write_the_same_file_without_losing_a_revision() {
    // Arrange
    let dir = std::env::temp_dir().join(format!("aa-core-{}", new_id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("ledger.db");
    drop(Store::open(&path).unwrap());
    let writer = |path: std::path::PathBuf| {
        std::thread::spawn(move || {
            let mut store = Store::open(&path).unwrap();
            for _ in 0..25 {
                let code = new_id().to_string();
                store
                    .write_revision(rev(
                        DocKind::Commodity,
                        new_id(),
                        None,
                        json!({"code": code, "scale": 2}),
                    ))
                    .unwrap();
            }
        })
    };
    // Act
    let (a, b) = (writer(path.clone()), writer(path.clone()));
    a.join().unwrap();
    b.join().unwrap();
    // Assert
    let store = Store::open(&path).unwrap();
    assert_eq!(count(&store, "SELECT count(*) FROM revision"), 50);
    assert!(store.verify_projection().unwrap().is_empty());
    drop(store);
    std::fs::remove_dir_all(dir).unwrap();
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
