//! Guards of the projector that the public API cannot reach, tested from inside the crate.

use super::*;
use crate::ids::DocId;
use crate::migrate::migrate;

#[test]
fn rebuilding_a_document_without_revisions_is_an_internal_error() {
    // Arrange: the public API never asks for this; the guard protects against a caller bug.
    let mut conn = Connection::open_in_memory().unwrap();
    migrate(&mut conn).unwrap();
    // Act
    let result = rebuild(&conn, DocKind::Entry, DocId::new(), false);
    // Assert
    assert!(matches!(result, Err(Error::Internal(m)) if m.contains("without revisions")));
}

#[test]
fn every_drift_reason_has_its_own_stable_code() {
    // Arrange
    let reasons = [
        DriftReason::NotAtHead,
        DriftReason::OrphanRow,
        DriftReason::DiffersFromRevision,
        DriftReason::PostedInvariantBroken,
    ];
    // Act
    let mut names: Vec<_> = reasons.iter().map(|reason| reason.as_str()).collect();
    names.sort_unstable();
    names.dedup();
    // Assert
    assert_eq!(names.len(), reasons.len());
    assert!(names
        .iter()
        .all(|name| !name.is_empty() && !name.contains(' ')));
}
