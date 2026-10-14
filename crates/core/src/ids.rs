//! Global ids (ADR-0011): UUIDv7 stored as 16-byte blobs.

use std::fmt::Write;
use uuid::Uuid;

/// A global id.
pub type Id = Uuid;

/// A new time-ordered id.
pub fn new_id() -> Id {
    Uuid::now_v7()
}

/// The short id shown to people: the random tail of the id, never the timestamp head.
pub fn short(id: &Id) -> String {
    id.as_bytes()[10..16]
        .iter()
        .fold(String::with_capacity(12), |mut out, byte| {
            let _ = write!(out, "{byte:02x}");
            out
        })
}

#[cfg(test)]
mod tests;
