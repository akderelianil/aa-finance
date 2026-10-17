//! A generated ledger for tests and measurements: one commodity, a few accounts, N balanced entries.
//! The 1,000,000-entry file of the plan comes from `examples/gen_fixture.rs`.

use crate::error::Result;
use crate::ids::{new_id, DocId, Id};
use crate::store::{DocKind, NewRevision, Store};

const CHUNK: usize = 5_000;
const ACCOUNTS: usize = 40;

fn revision(kind: DocKind, doc_id: DocId, author: Id, body: String) -> NewRevision {
    NewRevision {
        doc_kind: kind,
        doc_id,
        parent_id: None,
        author_id: author,
        created_at_ms: 1_000,
        body,
    }
}

/// Fills an empty store with `entries` balanced posted entries over 40 accounts (TRY, scale 2).
pub fn generate(store: &mut Store, entries: usize) -> Result<()> {
    let author = new_id();
    let try_id = DocId::new();
    let mut setup = vec![revision(
        DocKind::Commodity,
        try_id,
        author,
        r#"{"code":"TRY","scale":2}"#.to_string(),
    )];
    let accounts: Vec<DocId> = (0..ACCOUNTS).map(|_| DocId::new()).collect();
    for (i, id) in accounts.iter().enumerate() {
        let kind = if i % 2 == 0 { "asset" } else { "expense" };
        setup.push(revision(
            DocKind::Account,
            *id,
            author,
            format!(r#"{{"name":"Account {i}","parent":null,"kind":"{kind}","commodity":"{try_id}","archived":false}}"#),
        ));
    }
    store.write_revisions(setup)?;
    let mut seed: u64 = 0x9E37_79B9_7F4A_7C15;
    let mut next = move || {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        seed
    };
    let mut done = 0;
    while done < entries {
        let take = CHUNK.min(entries - done);
        let mut batch = Vec::with_capacity(take);
        for i in done..done + take {
            let (a, b, c) = (
                next() as usize % ACCOUNTS,
                next() as usize % ACCOUNTS,
                next() as usize % ACCOUNTS,
            );
            let total = 100 + (next() % 100_000) as i64;
            let date = format!(
                "{:04}-{:02}-{:02}",
                2016 + i % 10,
                1 + (i / 10) % 12,
                1 + (i / 120) % 28
            );
            let lines = if i % 5 == 0 {
                let part = total / 2;
                vec![
                    (accounts[a], part),
                    (accounts[b], total - part),
                    (accounts[c], -total),
                ]
            } else {
                vec![(accounts[a], total), (accounts[b], -total)]
            };
            let lines: Vec<String> = lines
                .iter()
                .map(|(id, v)| format!(r#"{{"account":"{id}","commodity":"{try_id}","quantity":{v},"base_value":{v}}}"#))
                .collect();
            let body = format!(
                r#"{{"date":"{date}","memo":null,"no":null,"status":"posted","lines":[{}]}}"#,
                lines.join(",")
            );
            batch.push(revision(DocKind::Entry, DocId::new(), author, body));
        }
        store.write_revisions(batch)?;
        done += take;
    }
    Ok(())
}
