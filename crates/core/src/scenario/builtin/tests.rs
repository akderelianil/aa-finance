//! The built-in pack (ADR-0024): it loads, and it holds Gider, Gelir, Transfer and Borç.

use super::*;

#[test]
fn the_built_in_pack_loads_with_the_four_v1_scenarios() {
    // Act
    let pack = builtin().unwrap();
    // Assert
    let ids: Vec<&str> = pack.scenarios.iter().map(|s| s.id.as_str()).collect();
    assert_eq!(ids, ["expense", "income", "transfer", "debt"]);
    assert_eq!(pack.hash.len(), 64);
}

#[test]
fn the_built_in_pack_is_loaded_once() {
    // Act / Assert
    assert!(std::ptr::eq(builtin().unwrap(), builtin().unwrap()));
}
