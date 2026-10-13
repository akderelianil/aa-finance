//! The shared core of aa-finance: ledger rules, scenarios, amounts, revisions, keys and sync.
//! This crate is a skeleton; the first real code arrives with story `core-rebuild-2` (ADR-0008, ADR-0012).

/// The version of the named-operation API this build speaks.
pub const API_VERSION: u32 = 0;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_version_starts_at_zero_before_the_first_release() {
        // Arrange / Act / Assert
        assert_eq!(API_VERSION, 0);
    }
}
