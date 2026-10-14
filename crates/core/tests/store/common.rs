//! Shared setup of the store tests: a small world (two commodities, two accounts) and builders.
pub use aa_core::{
    ids::new_id, DocKind, Error, Id, ImportedRevision, NewRevision, RuleCode, Store,
};
pub use serde_json::json;

pub fn rev(kind: DocKind, doc: Id, parent: Option<Id>, body: serde_json::Value) -> NewRevision {
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
    commodity: Id,
    parent: Option<Id>,
    archived: bool,
) -> serde_json::Value {
    json!({"name": name, "parent": parent.map(|p| p.to_string()), "kind": "asset", "commodity": commodity.to_string(), "archived": archived})
}

pub struct World {
    pub store: Store,
    pub try_id: Id,
    pub eur_id: Id,
    pub cash: Id,
    pub food: Id,
}

pub fn world() -> World {
    let mut store = Store::open_in_memory().unwrap();
    let (try_id, eur_id, cash, food) = (new_id(), new_id(), new_id(), new_id());
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

pub fn entry_body(w: &World, status: &str, amounts: &[(Id, i64)]) -> serde_json::Value {
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

pub fn post(w: &mut World, amounts: &[(Id, i64)]) -> (Id, Id) {
    let entry = new_id();
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

pub fn hex(id: Id) -> String {
    id.as_bytes().iter().map(|b| format!("{b:02x}")).collect()
}
