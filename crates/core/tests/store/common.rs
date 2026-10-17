//! Shared setup of the store tests: a small world (two commodities, two accounts) and builders.
pub use aa_core::{
    ids::new_id, DocId, DocKind, DriftReason, Error, Id, ImportedRevision, NewRevision, RevisionId,
    RuleCode, Store,
};
pub use serde_json::json;

pub fn rev(
    kind: DocKind,
    doc: DocId,
    parent: Option<RevisionId>,
    body: serde_json::Value,
) -> NewRevision {
    NewRevision {
        doc_kind: kind,
        doc_id: doc,
        parent_id: parent,
        author_id: new_id(),
        created_at_ms: 1_000,
        body: body.to_string(),
    }
}

pub fn account_body(
    name: &str,
    commodity: DocId,
    parent: Option<DocId>,
    archived: bool,
) -> serde_json::Value {
    json!({"name": name, "parent": parent.map(|p| p.to_string()), "kind": "asset", "commodity": commodity.to_string(), "archived": archived})
}

pub struct World {
    pub store: Store,
    pub try_id: DocId,
    pub eur_id: DocId,
    pub cash: DocId,
    pub food: DocId,
}

pub fn world() -> World {
    let mut store = Store::open_in_memory().unwrap();
    let (try_id, eur_id, cash, food) = (DocId::new(), DocId::new(), DocId::new(), DocId::new());
    store
        .write_revision(rev(
            DocKind::Commodity,
            try_id,
            None,
            json!({"code": "TRY", "scale": 2}),
        ))
        .unwrap();
    store
        .write_revision(rev(
            DocKind::Commodity,
            eur_id,
            None,
            json!({"code": "EUR", "scale": 2}),
        ))
        .unwrap();
    store
        .write_revision(rev(
            DocKind::Account,
            cash,
            None,
            account_body("Cash", try_id, None, false),
        ))
        .unwrap();
    store
        .write_revision(rev(
            DocKind::Account,
            food,
            None,
            account_body("Food", try_id, None, false),
        ))
        .unwrap();
    World {
        store,
        try_id,
        eur_id,
        cash,
        food,
    }
}

pub fn entry_body(w: &World, status: &str, amounts: &[(DocId, i64)]) -> serde_json::Value {
    let lines: Vec<_> =
        amounts.iter().map(|(a, v)| json!({"account": a.to_string(), "commodity": w.try_id.to_string(), "quantity": v, "base_value": v})).collect();
    json!({"date": "2026-10-13", "memo": "lunch", "no": null, "status": status, "lines": lines})
}

pub fn count(store: &Store, sql: &str) -> i64 {
    store
        .raw_connection()
        .query_row(sql, [], |row| row.get(0))
        .unwrap()
}

pub fn post(w: &mut World, amounts: &[(DocId, i64)]) -> (DocId, RevisionId) {
    let entry = DocId::new();
    let revision = w
        .store
        .write_revision(rev(
            DocKind::Entry,
            entry,
            None,
            entry_body(w, "posted", amounts),
        ))
        .unwrap();
    (entry, revision)
}

pub fn hex(id: impl Into<Id>) -> String {
    id.into()
        .as_bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// An entry body from `(account, commodity, quantity, base_value)` tuples, for lines in other commodities.
pub fn lines_body(status: &str, lines: &[(DocId, DocId, i64, i64)]) -> serde_json::Value {
    let lines: Vec<_> = lines
        .iter()
        .map(|(account, commodity, quantity, base)| {
            json!({"account": account.to_string(), "commodity": commodity.to_string(), "quantity": quantity, "base_value": base})
        })
        .collect();
    json!({"date": "2026-10-13", "memo": "fx", "no": null, "status": status, "lines": lines})
}

/// Adds an account in `commodity` to the world and returns its id.
pub fn add_account(w: &mut World, name: &str, commodity: DocId) -> DocId {
    let id = DocId::new();
    w.store
        .write_revision(rev(
            DocKind::Account,
            id,
            None,
            account_body(name, commodity, None, false),
        ))
        .unwrap();
    id
}

/// A temporary directory removed when dropped, also when the test fails.
pub struct TempDir(std::path::PathBuf);

impl TempDir {
    pub fn new() -> TempDir {
        let dir = std::env::temp_dir().join(format!("aa-core-{}", new_id()));
        std::fs::create_dir_all(&dir).unwrap();
        TempDir(dir)
    }

    pub fn path(&self) -> &std::path::Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
