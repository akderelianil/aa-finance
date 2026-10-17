//! Identifiers: time-ordered UUIDv7 values and their text form (ADR-0011).

use super::*;

#[test]
fn ids_are_version_seven_and_increase_over_time() {
    // Arrange / Act
    let first = new_id();
    let second = new_id();
    // Assert
    assert_eq!(first.get_version_num(), 7);
    assert!(second > first);
}

#[test]
fn typed_ids_are_version_seven_and_increase_over_time() {
    // Arrange / Act
    let (doc_a, doc_b) = (DocId::new(), DocId::new());
    let (rev_a, rev_b) = (RevisionId::new(), RevisionId::new());
    // Assert
    assert_eq!(doc_a.as_uuid().get_version_num(), 7);
    assert_eq!(rev_a.as_uuid().get_version_num(), 7);
    assert!(doc_b > doc_a);
    assert!(rev_b > rev_a);
}

#[test]
fn a_typed_id_keeps_its_uuid_and_prints_as_the_uuid_text() {
    // Arrange
    let raw = new_id();
    // Act
    let doc = DocId::from_uuid(raw);
    // Assert
    assert_eq!(doc.as_uuid(), raw);
    assert_eq!(doc.to_string(), raw.to_string());
    assert_eq!(doc.short(), short(&raw));
}

#[test]
fn a_typed_id_is_stored_as_a_sixteen_byte_blob_and_read_back() {
    // Arrange
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch("CREATE TABLE t (id BLOB NOT NULL) STRICT;")
        .unwrap();
    let id = RevisionId::new();
    // Act
    conn.execute("INSERT INTO t (id) VALUES (?1)", [id])
        .unwrap();
    let (length, back): (i64, RevisionId) = conn
        .query_row("SELECT length(id), id FROM t", [], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .unwrap();
    // Assert
    assert_eq!(length, 16);
    assert_eq!(back, id);
}

#[test]
fn a_typed_id_is_plain_uuid_text_in_json() {
    // Arrange
    let id = DocId::new();
    // Act
    let json = serde_json::to_string(&id).unwrap();
    let back: DocId = serde_json::from_str(&json).unwrap();
    // Assert
    assert_eq!(json, format!("\"{id}\""));
    assert_eq!(back, id);
}

#[test]
fn the_short_id_is_twelve_hex_digits_from_the_random_tail() {
    // Arrange
    let id = Uuid::from_bytes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf]);
    // Act / Assert
    assert_eq!(short(&id), "0a0b0c0d0e0f");
}
