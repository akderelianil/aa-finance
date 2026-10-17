# Test catalog

Generated from the Rust test sources by `npm run test:catalog`; do not edit by hand. `npm run verify` fails when this file is out of date.
What a topic covers is the `//!` comment at the top of its file; each test name reads as a sentence.

Total: 179 tests.

## core: integration tests (crates/core/tests)

### ops/accounts.rs (8)
Commodities and accounts through the operations: the author and the time are stamped by the ledger, names change as new revisions, and archiving is a revision, never a delete.

- An operation stamps the author and the time
- Renaming an account adds a revision and keeps the old one
- Renaming an unknown account is a missing reference
- An account with an unknown commodity is a missing reference
- An archived account takes no new entry and can come back
- A commodity code can be used once
- A child account can be created under a parent
- Naming a wrong kind of document as an account is a missing reference

### ops/entries.rs (15)
Posting and editing entries through the operations: amounts arrive as canonical strings in the scale of each account's commodity, and a foreign line needs a rate or a base value (ADR-0009, ADR-0010).

- A balanced entry is posted from canonical strings
- An unbalanced entry is refused with a rule code
- An amount with too many decimals is refused
- An amount that is not a number is refused
- An entry on an unknown account is a missing reference
- A foreign line takes its base value from the given rate
- A foreign line without rate or base cannot be valued
- A foreign line takes the base value the user gives
- Editing an entry replaces its lines and keeps the history
- Editing something that is not an entry is refused
- A ledger without a base commodity cannot post
- A rate other than one on a base currency line is refused
- A zero line and a bad date are refused with codes
- A failed edit leaves the entry as it was
- The base currency cannot be swapped for another

### ops/undo.rs (5)
Undo is a new revision that restores the previous body; nothing is removed and the history keeps both.

- Undo restores the previous version as a new revision
- Undoing twice brings the edit back
- A document with one revision has nothing to undo
- Undoing an unknown document is a missing reference
- Undo of a rename restores the old name

### store/accounts.rs (11)
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
- A duplicate of a carried line is a new use of an archived account
- An account cannot be its own parent

### store/conflicts.rs (9)
Server order and conflicts: the earliest server sequence is the head, a sibling is kept as a branch, and a stale parent is a conflict (ADR-0012).

- The server sequence is set once
- A stale parent or a second root is a conflict
- The earliest server sequence is the head and the sibling is kept
- Recording a server sequence can change the head and the projection follows
- A server sequence can be recorded for any kind of document
- A server sequence for an unknown revision is a missing reference
- Siblings without a server order follow creation time then arrival
- A sequenced branch beats an unsequenced one whatever their times
- A revision of a kind this build does not know is an internal error

### store/entries.rs (15)
Posting entries: an entry balances to exactly zero, a revision replaces its lines and keeps history, and a faulty writer cannot unbalance a posted entry (ADR-0004, ADR-0010, ADR-0012).

- A balanced posted entry projects its lines
- An unbalanced posted entry is refused and nothing is stored
- A posted entry needs two lines
- A draft entry may be unbalanced
- A new revision replaces the lines and keeps the history
- A posted entry can go back to draft and be posted again
- A faulty writer cannot unbalance a posted entry
- A posted entry balances on base value not on quantity
- An entry that is one unit off is unbalanced
- A line whose base value has the other sign is refused with a code
- A line with neither quantity nor base value is refused with a code
- A posted entry goes back to draft and is posted again with its history
- Lines of a posted entry cannot be added or removed directly
- A draft cannot be posted directly when it does not balance
- An entry cannot be inserted as posted without its lines

### store/failures.rs (3)
A database that breaks in the middle of an operation: each case damages the schema, then the operation must return an error and change nothing.

- A broken database is an error when verifying never a clean report
- A broken database is an error when rebuilding the projection
- A broken database is an error when writing an entry and nothing is stored

### store/rebuild.rs (6)
Rebuilding the projection from the revisions: it repairs drift, replays parents before children and archived accounts, and stops with a clear error on damaged input.

- Rebuilding the projection repairs drift
- Rebuilding replays parents before children and archived accounts
- Rebuilding retries an account whose new parent was created later
- A revision body that cannot be read stops a rebuild and leaves the projection alone
- A rebuild that cannot find a parent account reports the missing reference
- A rebuild reproduces the incremental projection exactly

### store/revisions.rs (7)
Revisions are immutable and chain correctly: no edit or delete, a parent belongs to the same document, a document never changes kind, and a failed batch changes nothing (ADR-0012).

- A revision cannot be changed or deleted
- A parent must belong to the same document
- A document never changes kind
- A failed batch leaves revisions and projection unchanged
- A conflict in the middle of a batch rolls the whole batch back
- Every column of a revision is immutable
- A replace cannot rewrite a revision

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

### store/verify.rs (15)
verify_projection: only the projector writes the projection tables, and every kind of drift (a tampered line, a wrong pointer, an orphan, a broken posted invariant) is found; the generated fixture verifies clean (ADR-0012).

- Only the projector writes projection tables
- Verify projection finds a tampered line and a tampered posted invariant
- Verify projection finds a wrong pointer and an orphan
- Verify projection finds a changed commodity and account
- Verify projection finds a posted entry that broke its invariants
- Verify projection reports a posted entry whose invariants were never enforced
- The generated fixture verifies clean and balances to zero
- The projection session cannot be removed or replaced to open the gates
- A missing session row keeps the projection closed
- Verify projection finds a pointer to an older revision with the same content
- Verify projection finds a document whose projection row is missing
- Verify projection finds an orphan row that looks like a real document
- Verify projection finds every kind of changed field
- Verify projection reports a posted entry with one line even when it sums to zero
- Every posted entry of the fixture sums to zero and a rebuild keeps it clean

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

### body/tests.rs (6)
The typed revision bodies: what is written is what is read back, and nothing unknown gets in.

- Every body reads back exactly as written
- The json of a body is deterministic
- A body with an unknown field is refused
- A body of the wrong kind is refused
- An unknown account kind is refused
- A body knows its document kind

### error/tests.rs (9)
The mapping of database messages to stable rule codes, and of other errors to their variants.

- The list of all codes covers every variant
- Every trigger code maps back from its own message
- A json error becomes an invalid body and other sqlite errors stay opaque
- Rule code names are unique
- Every error a trigger raises in the schema is a trigger code and the other way round
- Every rule code has a distinct text in both languages
- A rule error exposes the rule code as its api code
- Other errors have fixed codes
- Api messages never carry database or internal text

### ids/tests.rs (6)
Identifiers: time-ordered UUIDv7 values and their text form (ADR-0011).

- Ids are version seven and increase over time
- Typed ids are version seven and increase over time
- A typed id keeps its uuid and prints as the uuid text
- A typed id is stored as a sixteen byte blob and read back
- A typed id is plain uuid text in json
- The short id is twelve hex digits from the random tail

### migrate/tests.rs (5)
The migration framework: every file applied once, the schema version recorded, newer and foreign databases refused.

- Migrate applies every file once and sets user version
- Migrate refuses a database newer than the app
- Migrate refuses a foreign database without a schema version
- Migrate refuses a file of another application even with a schema version
- Migrate marks the file as a ledger

### projection/tests.rs (2)
Guards of the projector that the public API cannot reach, tested from inside the crate.

- Rebuilding a document without revisions is an internal error
- Every drift reason has its own stable code

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
- A refusal is always the out of range code and a result is always in bounds
- The text of a rate parses back to the same rate
- Parsing a rate never panics
- The rounding line always balances the entry
- Large sums never wrap
