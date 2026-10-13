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
mod tests {
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
    fn the_short_id_is_twelve_hex_digits_from_the_random_tail() {
        // Arrange
        let id = Uuid::from_bytes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf]);
        // Act / Assert
        assert_eq!(short(&id), "0a0b0c0d0e0f");
    }
}
