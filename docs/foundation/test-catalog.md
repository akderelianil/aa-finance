# Test catalog

Generated from the Rust test sources by `npm run test:catalog`; do not edit by hand. `npm run verify` fails when this file is out of date.
What a topic covers is the `//!` comment at the top of its file; each test name reads as a sentence.

Total: 106 tests.

## core: integration tests (crates/core/tests)

### store/accounts.rs (9)
Accounts and commodities: archived accounts, the commodity and scale of an account in use, the account tree (cycles and depth) and account kinds (ADR-0010, ADR-0012).

- An archived account takes no new lines
- An old entry on an archived account can still be corrected
- A line must use the commodity of its account
- The commodity of an account in use cannot change
- The scale of a commodity in use cannot change
- A commodity can be renamed without breaking old entries
- An account cannot become its own ancestor
- Every account kind is accepted and an unknown one is refused
- An account tree deeper than the limit is refused like a cycle

### store/conflicts.rs (6)
Server order and conflicts: the earliest server sequence is the head, a sibling is kept as a branch, and a stale parent is a conflict (ADR-0012).

- The server sequence is set once
- A stale parent or a second root is a conflict
- The earliest server sequence is the head and the sibling is kept
- Recording a server sequence can change the head and the projection follows
- A server sequence can be recorded for any kind of document
- A server sequence for an unknown revision is a missing reference

### store/entries.rs (7)
Posting entries: an entry balances to exactly zero, a revision replaces its lines and keeps history, and a faulty writer cannot unbalance a posted entry (ADR-0004, ADR-0010, ADR-0012).

- A balanced posted entry projects its lines
- An unbalanced posted entry is refused and nothing is stored
- A posted entry needs two lines
- A draft entry may be unbalanced
- A new revision replaces the lines and keeps the history
- A posted entry can go back to draft and be posted again
- A faulty writer cannot unbalance a posted entry

### store/failures.rs (3)
A database that breaks in the middle of an operation: each case damages the schema, then the operation must return an error and change nothing.

- A broken database is an error when verifying never a clean report
- A broken database is an error when rebuilding the projection
- A broken database is an error when writing an entry and nothing is stored

### store/rebuild.rs (5)
Rebuilding the projection from the revisions: it repairs drift, replays parents before children and archived accounts, and stops with a clear error on damaged input.

- Rebuilding the projection repairs drift
- Rebuilding replays parents before children and archived accounts
- Rebuilding retries an account whose new parent was created later
- A revision body that cannot be read stops a rebuild and leaves the projection alone
- A rebuild that cannot find a parent account reports the missing reference

### store/revisions.rs (4)
Revisions are immutable and chain correctly: no edit or delete, a parent belongs to the same document, a document never changes kind, and a failed batch changes nothing (ADR-0012).

- A revision cannot be changed or deleted
- A parent must belong to the same document
- A document never changes kind
- A failed batch leaves revisions and projection unchanged

### store/storage.rs (5)
The ledger file: WAL and foreign keys, two connections writing one file, a file that is not ours, and a drive without WAL support.

- A file database uses wal and foreign keys
- Two connections write the same file without losing a revision
- A ledger file that is not ours is refused and errors read in plain words
- An in memory store reports journal mode memory
- A ledger file must support wal or it is refused

### store/validation.rs (5)
Input checks and stable error codes: duplicate codes, scale and amount bounds, missing references and malformed bodies are refused with a code, never an opaque database error.

- A duplicate commodity code scale range and amount bound have codes
- A summed overflow is an amount error not an opaque one
- A missing account reference is reported
- A missing commodity reference is reported
- Malformed unknown or misspelled bodies are refused

### store/verify.rs (7)
verify_projection: only the projector writes the projection tables, and every kind of drift (a tampered line, a wrong pointer, an orphan, a broken posted invariant) is found; the generated fixture verifies clean (ADR-0012).

- Only the projector writes projection tables
- Verify projection finds a tampered line and a tampered posted invariant
- Verify projection finds a wrong pointer and an orphan
- Verify projection finds a changed commodity and account
- Verify projection finds a posted entry that broke its invariants
- Verify projection reports a posted entry whose invariants were never enforced
- The generated fixture verifies clean and balances to zero

## core: unit tests (crates/core/src)

### amount/tests.rs (15)
Reading and writing amounts: the canonical form and both separator styles, every scale, the stored bounds, and refused text (ADR-0010).

- The rule helper reports only rule errors
- Parses the canonical form at every scale
- Parses both separator styles
- Refuses text that is not an amount in every style and scale
- Refuses misplaced group marks
- Group marks and zero forms read as expected
- Refuses digits that the scale cannot hold but accepts trailing zeros
- Stored bounds are exact
- The stored bounds are exact at every scale
- Refuses a scale the schema would refuse
- Formats with exactly the scale in every style
- Format then parse returns the same value
- Parsing text built from the tricky characters never panics and reparses
- Canonical text parses to the exact scaled integer
- Formatting never panics for any value

### error/tests.rs (2)
The mapping of database messages to stable rule codes, and of other errors to their variants.

- Every trigger code maps back from its own message
- A json error becomes an invalid body and other sqlite errors stay opaque

### ids/tests.rs (2)
Identifiers: time-ordered UUIDv7 values and their text form (ADR-0011).

- Ids are version seven and increase over time
- The short id is twelve hex digits from the random tail

### migrate/tests.rs (3)
The migration framework: every file applied once, the schema version recorded, newer and foreign databases refused.

- Migrate applies every file once and sets user version
- Migrate refuses a database newer than the app
- Migrate refuses a foreign database without a schema version

### projection/tests.rs (1)
Guards of the projector that the public API cannot reach, tested from inside the crate.

- Rebuilding a document without revisions is an internal error

### rate/tests.rs (32)
Rates and base values: the rounding rule checked against an independent calculation, derived rates, the resolution order, the Rounding line and its limits (ADR-0010).

- The code helper reports only rule errors
- A rate is normalised decimal text
- A rate refuses anything that is not positive decimal text
- Converts with one rounding rule half away from zero
- A result beyond the stored bounds is refused not wrapped
- Derives the rate from an amount and a base
- An implied rate needs same sign nonzero amounts and at least 1e 12
- A stored rate is used when nothing is given
- A given base beats the stored rate and the rate follows from it
- A given rate beats the stored rate
- A given rate and a given base must agree
- Scales and bounds are checked on every path
- A line with no rate anywhere is refused
- A base of zero or of the wrong sign is refused
- Rounding differences go to a line but real imbalance is refused
- The prototype cases hold
- An implied rate rounds half away in both signs and both scale directions
- A quantity beyond the stored bounds is refused on every path
- A rate text has exact edges
- The resolution order holds for every combination
- A given base at a different scale implies the right rate
- Rounding line edge cases
- A rate of one at equal scales changes nothing
- A power of ten rate only moves the decimal point
- The result is the nearest integer with ties away from zero
- Conversion is monotonic
- Conversion is symmetric around zero
- A value that fits is never refused
- The text of a rate parses back to the same rate
- Parsing a rate never panics
- The rounding line always balances the entry
- Large sums never wrap
