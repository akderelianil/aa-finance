//! Accounts and commodities: archived accounts, the commodity and scale of an account in use, the account tree (cycles and depth) and account kinds (ADR-0010, ADR-0012).

use super::common::*;

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
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body));
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
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body));
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
fn an_account_cannot_become_its_own_ancestor() {
    // Arrange
    let mut w = world();
    let (a, b) = (DocId::new(), DocId::new());
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
fn every_account_kind_is_accepted_and_an_unknown_one_is_refused() {
    // Arrange
    let mut w = world();
    let body = |kind: &str| {
        let mut b = account_body("X", w.try_id, None, false);
        b["kind"] = json!(kind);
        rev(DocKind::Account, DocId::new(), None, b)
    };
    let valid: Vec<_> = ["asset", "liability", "equity", "income", "expense"]
        .iter()
        .map(|k| body(k))
        .collect();
    let unknown = body("treasure");
    // Act
    let accepted = w.store.write_revisions(valid);
    let refused = w.store.write_revision(unknown);
    // Assert
    assert!(accepted.is_ok());
    assert!(matches!(refused, Err(Error::InvalidBody(_))));
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn an_account_tree_deeper_than_the_limit_is_refused_like_a_cycle() {
    // Arrange: a chain of 10,001 accounts written straight into the projection.
    let mut w = world();
    w.store
        .tamper(
            "WITH RECURSIVE base(b) AS (SELECT coalesce(max(id), 0) FROM account),
                  n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 10001)
             INSERT INTO account (uuid, current_revision_id, name, parent_id, kind, commodity_id, archived, locked)
             SELECT randomblob(16), (SELECT id FROM revision LIMIT 1), 'chain' || i,
                    CASE WHEN i = 1 THEN NULL ELSE (SELECT b FROM base) + i - 1 END,
                    'asset', (SELECT id FROM commodity LIMIT 1), 0, 0
             FROM n ORDER BY i",
        )
        .unwrap();
    let deepest: DocId = w
        .store
        .raw_connection()
        .query_row(
            "SELECT uuid FROM account WHERE name = 'chain10001'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Account,
        DocId::new(),
        None,
        account_body("Too deep", w.try_id, Some(deepest), false),
    ));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::AccountParentCycle))
    ));
}

#[test]
fn a_duplicate_of_a_carried_line_is_a_new_use_of_an_archived_account() {
    // Arrange: an entry uses Food; Food is archived; the entry is then revised with Food twice.
    let mut w = world();
    let (food, cash) = (w.food, w.cash);
    let (entry, first) = post(&mut w, &[(food, 100), (cash, -100)]);
    let food_head = w.store.current_revision(food).unwrap();
    w.store
        .write_revision(rev(
            DocKind::Account,
            food,
            food_head,
            account_body("Food", w.try_id, None, true),
        ))
        .unwrap();
    let still_one = w.store.write_revision(rev(
        DocKind::Entry,
        entry,
        Some(first),
        entry_body(&w, "posted", &[(food, 100), (cash, -100)]),
    ));
    let head = w.store.current_revision(entry).unwrap();
    // Act
    let duplicated = w.store.write_revision(rev(
        DocKind::Entry,
        entry,
        head,
        entry_body(&w, "posted", &[(food, 100), (food, 100), (cash, -200)]),
    ));
    // Assert
    assert!(still_one.is_ok(), "the carried line is still allowed");
    assert!(matches!(
        duplicated,
        Err(Error::Rule(RuleCode::AccountArchived))
    ));
}

#[test]
fn an_account_cannot_be_its_own_parent() {
    // Arrange
    let mut w = world();
    let id = DocId::new();
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Account,
        id,
        None,
        account_body("Self", w.try_id, Some(id), false),
    ));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::AccountParentCycle))
    ));
}

fn locked_account_body(name: &str, commodity: DocId, key: &str) -> serde_json::Value {
    let mut body = account_body(name, commodity, None, false);
    body["locked"] = serde_json::json!(true);
    body["system_key"] = serde_json::json!(key);
    body
}

#[test]
fn a_locked_account_cannot_be_renamed_archived_or_unlocked() {
    // Arrange
    let mut w = world();
    let sys = DocId::new();
    let first = w
        .store
        .write_revision(rev(
            DocKind::Account,
            sys,
            None,
            locked_account_body("Rounding", w.try_id, "rounding"),
        ))
        .unwrap();
    let mut renamed = locked_account_body("Other", w.try_id, "rounding");
    let mut archived = locked_account_body("Rounding", w.try_id, "rounding");
    archived["archived"] = serde_json::json!(true);
    let mut unlocked = account_body("Rounding", w.try_id, None, false);
    unlocked["system_key"] = serde_json::json!("rounding");
    // Act
    let results: Vec<_> = [renamed.take(), archived, unlocked]
        .into_iter()
        .map(|body| {
            w.store
                .write_revision(rev(DocKind::Account, sys, Some(first), body))
        })
        .collect();
    // Assert
    for result in results {
        assert!(matches!(result, Err(Error::Rule(RuleCode::AccountLocked))));
    }
    assert_eq!(w.store.current_revision(sys).unwrap(), Some(first));
}

#[test]
fn a_system_key_belongs_to_one_account() {
    // Arrange
    let mut w = world();
    w.store
        .write_revision(rev(
            DocKind::Account,
            DocId::new(),
            None,
            locked_account_body("Rounding", w.try_id, "rounding"),
        ))
        .unwrap();
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Account,
        DocId::new(),
        None,
        locked_account_body("Rounding 2", w.try_id, "rounding"),
    ));
    // Assert
    assert!(matches!(result, Err(Error::Rule(RuleCode::SystemKeyTaken))));
}

#[test]
fn a_locked_account_survives_a_rebuild_and_verifies_clean() {
    // Arrange
    let mut w = world();
    w.store
        .write_revision(rev(
            DocKind::Account,
            DocId::new(),
            None,
            locked_account_body("Rounding", w.try_id, "rounding"),
        ))
        .unwrap();
    // Act
    w.store.rebuild_projection().unwrap();
    // Assert
    assert!(w.store.verify_projection().unwrap().is_empty());
    assert_eq!(
        count(
            &w.store,
            "SELECT count(*) FROM account WHERE locked = 1 AND system_key = 'rounding'"
        ),
        1
    );
}
