//! The pack built into the core (ADR-0024): Gider, Gelir, Transfer and Borç. It is read once and
//! checked like any other pack; a fault in it is a bug of the core, reported as an internal error.

use crate::error::{Error, Result};
use crate::scenario::pack::{load, Pack};
use std::sync::OnceLock;

const TEXT: &str = include_str!("builtin.json");

/// The built-in pack, loaded on first use.
pub fn builtin() -> Result<&'static Pack> {
    static PACK: OnceLock<Option<Pack>> = OnceLock::new();
    PACK.get_or_init(|| load(TEXT).ok())
        .as_ref()
        .ok_or(Error::Internal("the built-in scenario pack does not load"))
}

#[cfg(test)]
mod tests;
