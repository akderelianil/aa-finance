//! A database that breaks in the middle of an operation: each case damages the schema, then the operation must return an error and change nothing.

use super::common::*;

fn sabotaged(sql: &str) -> World {
    let w = world();
    w.store.raw_connection().execute_batch(sql).unwrap();
    w
}

fn post_lunch(w: &mut World) -> aa_core::Result<RevisionId> {
    let body = entry_body(w, "posted", &[(w.food, 100), (w.cash, -100)]);
    w.store
        .write_revision(rev(DocKind::Entry, DocId::new(), None, body))
}

#[test]
fn a_broken_database_is_an_error_when_verifying_never_a_clean_report() {
    // Each case damages one table or column, then asks for the verification.
    let cases = [
        "ALTER TABLE account RENAME COLUMN archived TO archived_gone;",
        "ALTER TABLE entry RENAME COLUMN memo TO memo_gone;",
        "ALTER TABLE line RENAME TO line_gone;",
    ];
    for sql in cases {
        let w = sabotaged(sql);
        assert!(
            matches!(w.store.verify_projection(), Err(Error::Sqlite(_))),
            "{sql}"
        );
    }
}

#[test]
fn a_broken_database_is_an_error_when_rebuilding_the_projection() {
    // The projector must report a failure to open or close its session, not carry on.
    let cases = [
        "CREATE TRIGGER boom BEFORE UPDATE ON projection_session WHEN NEW.open = 1 BEGIN SELECT RAISE(ABORT, 'boom'); END;",
        "CREATE TRIGGER boom BEFORE UPDATE ON projection_session WHEN NEW.open = 0 BEGIN SELECT RAISE(ABORT, 'boom'); END;",
        "ALTER TABLE revision RENAME COLUMN doc_kind TO doc_kind_gone;",
    ];
    for sql in cases {
        let mut w = sabotaged(sql);
        assert!(
            matches!(w.store.rebuild_projection(), Err(Error::Sqlite(_))),
            "{sql}"
        );
    }
}

#[test]
fn a_broken_database_is_an_error_when_writing_an_entry_and_nothing_is_stored() {
    let cases = [
        "ALTER TABLE line RENAME TO line_gone;",
        "ALTER TABLE line RENAME COLUMN line_no TO line_gone;",
        "CREATE TRIGGER vanish AFTER INSERT ON entry BEGIN DELETE FROM entry WHERE id = NEW.id; END;",
    ];
    for sql in cases {
        let mut w = sabotaged(sql);
        let revisions = count(&w.store, "SELECT count(*) FROM revision");
        let result = post_lunch(&mut w);
        assert!(matches!(result, Err(Error::Sqlite(_))), "{sql}");
        assert_eq!(
            count(&w.store, "SELECT count(*) FROM revision"),
            revisions,
            "{sql}"
        );
    }
}
