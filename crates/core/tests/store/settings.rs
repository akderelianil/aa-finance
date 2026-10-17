//! The settings document: one revisioned document under a fixed id whose projection holds the base currency; the base currency is locked once an entry exists (ADR-0021, K21 and K22).

use super::common::*;
use aa_core::body::SETTINGS_DOC;

fn settings_body(commodity: DocId) -> serde_json::Value {
    json!({ "base_commodity": commodity.to_string() })
}

fn write_settings(
    w: &mut World,
    commodity: DocId,
    parent: Option<RevisionId>,
) -> aa_core::Result<RevisionId> {
    w.store.write_revision(rev(
        DocKind::Settings,
        SETTINGS_DOC,
        parent,
        settings_body(commodity),
    ))
}

fn base_of_projection(w: &World) -> DocId {
    w.store
        .raw_connection()
        .query_row(
            "SELECT c.uuid FROM settings s JOIN commodity c ON c.id = s.base_commodity_id",
            [],
            |row| row.get(0),
        )
        .unwrap()
}

#[test]
fn the_settings_document_projects_the_base_currency() {
    // Arrange
    let mut w = world();
    let try_id = w.try_id;
    // Act
    write_settings(&mut w, try_id, None).unwrap();
    // Assert
    assert_eq!(count(&w.store, "SELECT count(*) FROM settings"), 1);
    assert_eq!(base_of_projection(&w), try_id);
}

#[test]
fn settings_that_name_an_unknown_commodity_are_a_missing_reference() {
    // Arrange
    let mut w = world();
    // Act
    let result = write_settings(&mut w, DocId::new(), None);
    // Assert
    assert!(matches!(result, Err(Error::MissingReference { .. })));
    assert_eq!(count(&w.store, "SELECT count(*) FROM settings"), 0);
}

#[test]
fn settings_under_any_other_document_id_are_refused() {
    // Arrange
    let mut w = world();
    let body = settings_body(w.try_id);
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Settings, DocId::new(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::SettingsIdFixed))
    ));
    assert_eq!(count(&w.store, "SELECT count(*) FROM settings"), 0);
}

#[test]
fn the_base_currency_can_change_until_the_first_entry_exists() {
    // Arrange
    let mut w = world();
    let (try_id, eur_id) = (w.try_id, w.eur_id);
    let first = write_settings(&mut w, try_id, None).unwrap();
    // Act
    write_settings(&mut w, eur_id, Some(first)).unwrap();
    // Assert
    assert_eq!(base_of_projection(&w), eur_id);
}

#[test]
fn the_base_currency_is_locked_once_an_entry_exists() {
    // Arrange
    let mut w = world();
    let (try_id, eur_id, food, cash) = (w.try_id, w.eur_id, w.food, w.cash);
    let first = write_settings(&mut w, try_id, None).unwrap();
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    // Act
    let result = write_settings(&mut w, eur_id, Some(first));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::BaseCurrencyLocked))
    ));
}

#[test]
fn a_draft_entry_locks_the_base_currency_too() {
    // Arrange
    let mut w = world();
    let (try_id, eur_id, food) = (w.try_id, w.eur_id, w.food);
    let first = write_settings(&mut w, try_id, None).unwrap();
    let draft = entry_body(&w, "draft", &[(food, 5000)]);
    w.store
        .write_revision(rev(DocKind::Entry, DocId::new(), None, draft))
        .unwrap();
    // Act
    let result = write_settings(&mut w, eur_id, Some(first));
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::BaseCurrencyLocked))
    ));
}

#[test]
fn a_new_settings_revision_with_the_same_base_is_allowed_after_entries() {
    // Arrange
    let mut w = world();
    let (try_id, food, cash) = (w.try_id, w.food, w.cash);
    let first = write_settings(&mut w, try_id, None).unwrap();
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    // Act
    let second = write_settings(&mut w, try_id, Some(first)).unwrap();
    // Assert
    assert_eq!(
        w.store.current_revision(SETTINGS_DOC).unwrap(),
        Some(second)
    );
}

#[test]
fn a_refused_base_change_leaves_the_settings_as_they_were() {
    // Arrange
    let mut w = world();
    let (try_id, eur_id, food, cash) = (w.try_id, w.eur_id, w.food, w.cash);
    let first = write_settings(&mut w, try_id, None).unwrap();
    post(&mut w, &[(food, 5000), (cash, -5000)]);
    // Act
    let _ = write_settings(&mut w, eur_id, Some(first));
    // Assert
    assert_eq!(base_of_projection(&w), try_id);
    assert_eq!(w.store.current_revision(SETTINGS_DOC).unwrap(), Some(first));
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn only_the_projector_writes_the_settings_table() {
    // Arrange
    let mut w = world();
    let try_id = w.try_id;
    write_settings(&mut w, try_id, None).unwrap();
    // Act
    let result = w
        .store
        .raw_connection()
        .execute("DELETE FROM settings", [])
        .map_err(Error::from);
    // Assert
    assert!(matches!(
        result,
        Err(Error::Rule(RuleCode::ProjectionClosed))
    ));
}

#[test]
fn verify_projection_finds_a_changed_base_currency() {
    // Arrange
    let mut w = world();
    let try_id = w.try_id;
    write_settings(&mut w, try_id, None).unwrap();
    w.store
        .tamper("UPDATE settings SET base_commodity_id = (SELECT id FROM commodity WHERE uuid <> (SELECT uuid FROM commodity WHERE id = base_commodity_id) LIMIT 1)")
        .unwrap();
    // Act
    let drift = w.store.verify_projection().unwrap();
    // Assert
    assert_eq!(drift.len(), 1);
    assert_eq!(drift[0].doc_kind, DocKind::Settings);
    assert_eq!(drift[0].reason, DriftReason::DiffersFromRevision);
}

#[test]
fn a_rebuild_restores_the_settings() {
    // Arrange
    let mut w = world();
    let try_id = w.try_id;
    write_settings(&mut w, try_id, None).unwrap();
    w.store.tamper("DELETE FROM settings").unwrap();
    assert_eq!(w.store.verify_projection().unwrap().len(), 1);
    // Act
    w.store.rebuild_projection().unwrap();
    // Assert
    assert_eq!(base_of_projection(&w), try_id);
    assert!(w.store.verify_projection().unwrap().is_empty());
}
