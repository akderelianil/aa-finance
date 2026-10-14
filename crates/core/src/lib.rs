//! The shared core of aa-finance (ADR-0008): revisions as truth (ADR-0012), global ids (ADR-0011).
//! Writing an entry, an account or a commodity means writing an immutable revision; the core rebuilds the
//! projection (the current state) in the same transaction. The store verifies itself; `amount` and `rate`
//! hold the exact money arithmetic (ADR-0010). Scenarios and the named-operation API follow.

pub mod amount;
pub mod error;
pub mod fixture;
pub mod ids;
pub mod migrate;
mod projection;
pub mod rate;
mod store;

pub use error::{Error, Result, RuleCode};
pub use ids::Id;
pub use projection::{Drift, DriftReason};
pub use store::{DocKind, ImportedRevision, NewRevision, Store};

/// The version of the named-operation API this build speaks.
pub const API_VERSION: u32 = 0;

/// The version of the rules that validated a revision when it was written.
pub const RULES_VERSION: u32 = 1;
