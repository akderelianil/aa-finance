//! Builds a large ledger file and verifies it: `cargo run --release -p aa-core --example gen_fixture -- fixture.db 1000000`.
use aa_core::{fixture, Store};
use std::{path::PathBuf, time::Instant};

fn main() {
    let mut args = std::env::args().skip(1);
    let path = PathBuf::from(args.next().expect("usage: gen_fixture <path> <entries>"));
    let entries: usize = args
        .next()
        .expect("usage: gen_fixture <path> <entries>")
        .parse()
        .expect("entries must be a number");
    let mut store = Store::open(&path).expect("open");
    let start = Instant::now();
    fixture::generate(&mut store, entries).expect("generate");
    println!(
        "generated {entries} entries in {:.1}s",
        start.elapsed().as_secs_f64()
    );
    let start = Instant::now();
    let drift = store.verify_projection().expect("verify");
    println!(
        "verify_projection: {} drifts in {:.1}s",
        drift.len(),
        start.elapsed().as_secs_f64()
    );
}
