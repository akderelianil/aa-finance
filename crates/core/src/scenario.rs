//! Scenarios as data (ADR-0016, ADR-0024): typed inputs, a small expression language and output
//! lines that become a draft entry. A draft writes nothing; saving goes through `post_entry`.

pub mod builtin;
pub mod calc;
pub mod expr;

pub mod draft;
pub mod pack;
