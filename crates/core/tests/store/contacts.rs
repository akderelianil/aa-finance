//! Contacts (ADR-0024): the projection of a contact document, its fixed kind, and the contact a line
//! may carry, which must exist and is checked by `verify_projection`.

use crate::common::*;

fn contact_body(name: &str, kind: &str) -> serde_json::Value {
    json!({"name": name, "kind": kind})
}

fn add_contact(w: &mut World, name: &str) -> (DocId, RevisionId) {
    let id = DocId::new();
    let revision = w
        .store
        .write_revision(rev(
            DocKind::Contact,
            id,
            None,
            contact_body(name, "individual"),
        ))
        .unwrap();
    (id, revision)
}

fn entry_with_contact(w: &World, contact: DocId) -> serde_json::Value {
    let mut body = entry_body(w, "posted", &[(w.food, 500), (w.cash, -500)]);
    body["lines"][1]["contact"] = json!(contact.to_string());
    body
}

#[test]
fn a_contact_is_projected_with_its_name_and_kind() {
    // Arrange
    let mut w = world();
    // Act
    let (id, revision) = add_contact(&mut w, "Ahmet");
    // Assert
    let (name, kind, head): (String, String, Vec<u8>) = w
        .store
        .raw_connection()
        .query_row(
            "SELECT name, kind, current_revision_id FROM contact WHERE uuid = ?1",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!((name.as_str(), kind.as_str()), ("Ahmet", "individual"));
    assert_eq!(head, Id::from(revision).as_bytes().to_vec());
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn a_contact_of_an_unknown_kind_is_refused() {
    // Arrange
    let mut w = world();
    // Act
    let result = w.store.write_revision(rev(
        DocKind::Contact,
        DocId::new(),
        None,
        contact_body("Ahmet", "friend"),
    ));
    // Assert
    assert!(matches!(result, Err(Error::InvalidBody(_))));
}

#[test]
fn a_contact_can_be_renamed_but_its_kind_never_changes() {
    // Arrange
    let mut w = world();
    let (id, first) = add_contact(&mut w, "Ahmet");
    // Act
    let renamed = w
        .store
        .write_revision(rev(
            DocKind::Contact,
            id,
            Some(first),
            contact_body("Ahmet Y.", "individual"),
        ))
        .unwrap();
    let rekinded = w.store.write_revision(rev(
        DocKind::Contact,
        id,
        Some(renamed),
        contact_body("Ahmet Y.", "business"),
    ));
    // Assert
    assert!(matches!(
        rekinded,
        Err(Error::Rule(RuleCode::ContactKindFixed))
    ));
    assert_eq!(w.store.current_revision(id).unwrap(), Some(renamed));
}

#[test]
fn a_line_keeps_its_contact_in_the_projection_and_after_a_rebuild() {
    // Arrange
    let mut w = world();
    let (ahmet, _) = add_contact(&mut w, "Ahmet");
    let body = entry_with_contact(&w, ahmet);
    // Act
    w.store
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body))
        .unwrap();
    w.store.rebuild_projection().unwrap();
    // Assert
    let linked = count(
        &w.store,
        "SELECT count(*) FROM line l JOIN contact c ON c.id = l.contact_id WHERE c.name = 'Ahmet'",
    );
    assert_eq!(linked, 1);
    assert_eq!(
        count(
            &w.store,
            "SELECT count(*) FROM line WHERE contact_id IS NULL"
        ),
        1
    );
    assert!(w.store.verify_projection().unwrap().is_empty());
}

#[test]
fn a_line_cannot_point_to_a_contact_that_does_not_exist() {
    // Arrange
    let mut w = world();
    let body = entry_with_contact(&w, DocId::new());
    // Act
    let result = w
        .store
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body));
    // Assert
    assert!(matches!(
        result,
        Err(Error::MissingReference {
            kind: "contact",
            ..
        })
    ));
}

#[test]
fn verify_reports_a_line_whose_contact_differs_from_the_revision() {
    // Arrange
    let mut w = world();
    let (ahmet, _) = add_contact(&mut w, "Ahmet");
    add_contact(&mut w, "Ayşe");
    let entry = DocId::new();
    w.store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            None,
            entry_with_contact(&w, ahmet),
        ))
        .unwrap();
    // Act
    w.store
        .tamper("UPDATE line SET contact_id = (SELECT id FROM contact WHERE name = 'Ayşe') WHERE contact_id IS NOT NULL")
        .unwrap();
    // Assert
    let drift = w.store.verify_projection().unwrap();
    assert_eq!(drift.len(), 1);
    assert_eq!(drift[0].doc_id, entry);
    assert_eq!(drift[0].reason, DriftReason::DiffersFromRevision);
}

#[test]
fn verify_reports_a_contact_row_that_differs_from_its_revision() {
    // Arrange
    let mut w = world();
    let (ahmet, _) = add_contact(&mut w, "Ahmet");
    // Act
    w.store
        .tamper("UPDATE contact SET name = 'Mehmet'")
        .unwrap();
    // Assert
    let drift = w.store.verify_projection().unwrap();
    assert_eq!(drift.len(), 1);
    assert_eq!(drift[0].doc_id, ahmet);
    assert_eq!(drift[0].reason, DriftReason::DiffersFromRevision);
}

#[test]
fn an_entry_body_without_contacts_reads_as_before() {
    // Arrange
    let mut w = world();
    // Act
    let (food, cash) = (w.food, w.cash);
    post(&mut w, &[(food, 100), (cash, -100)]);
    // Assert
    assert_eq!(
        count(
            &w.store,
            "SELECT count(*) FROM line WHERE contact_id IS NULL"
        ),
        2
    );
    assert!(w.store.verify_projection().unwrap().is_empty());
}
