//! Shared setup of the operation tests: a ledger with a fixed clock, a base currency and two accounts.
pub use aa_core::ids::new_id;
pub use aa_core::ops::{AccountInput, Clock, EntryInput, Ledger, LineInput};
pub use aa_core::{DocId, Error, Id, RuleCode};
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;

/// A clock the test moves by hand.
#[derive(Clone)]
pub struct TestClock(pub Arc<AtomicI64>);

impl TestClock {
    pub fn set(&self, ms: i64) {
        self.0.store(ms, Ordering::SeqCst);
    }
}

impl Clock for TestClock {
    fn now_ms(&self) -> i64 {
        self.0.load(Ordering::SeqCst)
    }
}

pub struct Book {
    pub ledger: Ledger,
    pub clock: TestClock,
    pub author: Id,
    pub try_id: DocId,
    pub usd_id: DocId,
    pub cash: DocId,
    pub food: DocId,
}

pub fn book() -> Book {
    let clock = TestClock(Arc::new(AtomicI64::new(1_000)));
    let author = new_id();
    let store = aa_core::Store::open_in_memory().unwrap();
    let mut ledger = Ledger::new(store, author, Box::new(clock.clone()));
    let try_id = ledger.open_book("TRY", 2).unwrap().doc_id;
    let usd_id = ledger.create_commodity("USD", 2).unwrap().doc_id;
    let cash = ledger
        .create_account(account("Cash", try_id))
        .unwrap()
        .doc_id;
    let food = ledger
        .create_account(account("Food", try_id))
        .unwrap()
        .doc_id;
    Book {
        ledger,
        clock,
        author,
        try_id,
        usd_id,
        cash,
        food,
    }
}

pub fn account(name: &str, commodity: DocId) -> AccountInput {
    AccountInput {
        name: name.to_string(),
        parent: None,
        kind: aa_core::body::AccountKind::Asset,
        commodity,
    }
}

pub fn line(account: DocId, amount: &str) -> LineInput {
    LineInput {
        account,
        amount: amount.to_string(),
        rate: None,
        base: None,
    }
}

pub fn entry(lines: Vec<LineInput>) -> EntryInput {
    EntryInput {
        date: "2026-10-16".to_string(),
        memo: Some("lunch".to_string()),
        no: None,
        lines,
    }
}
