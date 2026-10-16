//! Behavior of the named-operation layer: `Ledger` stamps author and time, takes amounts as canonical
//! strings and writes revisions through the store (ADR-0008, ADR-0009, ADR-0012).
//! One test binary; each module covers one topic, described at the top of its file.

mod accounts;
mod common;
mod entries;
mod undo;
