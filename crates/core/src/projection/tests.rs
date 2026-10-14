//! Guards of the projector that the public API cannot reach, tested from inside the crate.

use super::*;
use crate::ids::new_id;
use crate::migrate::migrate;

#[test]
fn rebuilding_a_document_without_revisions_is_an_internal_error() {
    // Arrange: the public API never asks for this; the guard protects against a caller bug.
    let mut conn = Connection::open_in_memory().unwrap();
    migrate(&mut conn).unwrap();
    // Act
    let result = rebuild(&conn, DocKind::Entry, new_id(), false);
    // Assert
    assert!(matches!(result, Err(Error::Internal(m)) if m.contains("without revisions")));
}
