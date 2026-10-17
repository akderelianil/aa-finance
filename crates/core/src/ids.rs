//! Global ids (ADR-0011): UUIDv7 stored as 16-byte blobs.
//!
//! A document and a revision have their own id types, so one cannot be passed where the other is
//! expected:
//!
//! ```compile_fail
//! use aa_core::{DocId, RevisionId};
//! fn takes_a_document(_: DocId) {}
//! takes_a_document(RevisionId::new());
//! ```

use rusqlite::types::{FromSql, FromSqlResult, ToSql, ToSqlOutput, ValueRef};
use serde::{Deserialize, Serialize};
use std::fmt::{self, Write};
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

/// Declares an id type that wraps a UUID, is stored as a blob and is plain UUID text in JSON.
macro_rules! typed_id {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(Id);

        impl $name {
            /// A new time-ordered id.
            #[allow(clippy::new_without_default)] // a default id would be a random one: misleading
            pub fn new() -> Self {
                Self(new_id())
            }

            pub const fn from_uuid(id: Id) -> Self {
                Self(id)
            }

            pub fn as_uuid(self) -> Id {
                self.0
            }

            /// The short id shown to people.
            pub fn short(&self) -> String {
                short(&self.0)
            }
        }

        impl From<$name> for Id {
            fn from(id: $name) -> Id {
                id.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                self.0.fmt(f)
            }
        }

        impl ToSql for $name {
            fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
                self.0.to_sql()
            }
        }

        impl FromSql for $name {
            fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
                Uuid::column_result(value).map(Self)
            }
        }
    };
}

typed_id!(
    /// The id of a document: a commodity, an account or an entry. It never changes; its revisions do.
    DocId
);
typed_id!(
    /// The id of one immutable revision of a document.
    RevisionId
);

#[cfg(test)]
mod tests;
