//! Shared setup of the operation tests: a ledger with a fixed clock, a base currency and two accounts.
pub use aa_core::ids::new_id;
pub use aa_core::ops::{AccountInput, Clock, EntryInput, Ledger, LineInput};
pub use aa_core::{DocId, Error, Id, RestoreKind, RuleCode};
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
        contact: None,
    }
}

pub fn entry(lines: Vec<LineInput>) -> EntryInput {
    EntryInput {
        date: "2026-10-16".to_string(),
        memo: Some("lunch".to_string()),
        no: None,
        lines,
        create_accounts: Vec::new(),
        create_contacts: Vec::new(),
    }
}

/// An account of the given kind in the given commodity, at the top of the chart.
pub fn open(
    ledger: &mut Ledger,
    name: &str,
    kind: aa_core::body::AccountKind,
    commodity: DocId,
) -> DocId {
    let mut input = account(name, commodity);
    input.kind = kind;
    ledger.create_account(input).unwrap().doc_id
}

/// `{"id": ...}`, the value of an account or contact input that names an existing document.
pub fn pick(id: DocId) -> serde_json::Value {
    serde_json::json!({ "id": id.to_string() })
}

/// The draft of a built-in scenario, in Turkish.
pub fn draft(
    b: &Book,
    scenario: &str,
    inputs: serde_json::Value,
) -> aa_core::scenario::draft::Draft {
    let input = aa_core::scenario::draft::DraftInput {
        scenario: scenario.to_string(),
        language: aa_core::scenario::draft::Language::Tr,
        inputs: inputs.as_object().unwrap().clone(),
    };
    b.ledger.scenario_draft(input).unwrap()
}

/// Posts a draft that has no errors and returns the stored lines as (account, amount, base).
pub fn post_draft(
    b: &mut Book,
    draft: &aa_core::scenario::draft::Draft,
) -> Vec<(DocId, String, String)> {
    assert!(draft.errors().is_empty(), "{:?}", draft.errors());
    let entry = draft
        .entry()
        .cloned()
        .expect("a draft without errors has an entry");
    let posted = b.ledger.post_entry(entry).unwrap();
    b.ledger
        .entry(posted.doc_id)
        .unwrap()
        .lines
        .into_iter()
        .map(|line| (line.account, line.amount, line.base))
        .collect()
}

/// The (field, code) pairs of a draft's errors.
pub fn errors(draft: &aa_core::scenario::draft::Draft) -> Vec<(Option<String>, String)> {
    draft
        .errors()
        .iter()
        .map(|error| (error.field.clone(), error.code.clone()))
        .collect()
}

/// Inputs of a one-row cash Gider and helpers for scenario drafts.
pub fn expense(b: &Book, market: DocId) -> serde_json::Value {
    serde_json::json!({
        "amount": "5.00", "payment": pick(b.cash), "date": "2026-11-02",
        "items": [{ "expense": pick(market), "part": "5.00" }],
    })
}

pub fn debt(b: &Book) -> serde_json::Value {
    serde_json::json!({
        "direction": "lend", "person": { "new": "Ayşe" }, "money": pick(b.cash),
        "amount": "5.00", "date": "2026-11-02",
    })
}

pub fn set(
    mut inputs: serde_json::Value,
    key: &str,
    value: serde_json::Value,
) -> serde_json::Value {
    inputs[key] = value;
    inputs
}

pub fn only_error(b: &Book, scenario: &str, inputs: serde_json::Value) -> (Option<String>, String) {
    let draft = draft(b, scenario, inputs);
    let errors = errors(&draft);
    assert_eq!(errors.len(), 1, "{errors:?}");
    errors[0].clone()
}
