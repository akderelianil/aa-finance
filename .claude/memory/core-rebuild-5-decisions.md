---
name: core-rebuild-5-decisions
description: Owner decisions of 2026-10-17 for CR-4 (scenario engine, core-rebuild-5)
metadata:
  type: project
---

Decided with the owner before coding core-rebuild-5:
- Expression language: our own minimal grammar (no CEL); scaled-integer arithmetic only, no float, no loops.
- Split lines: a repeating "line list" input type (account + amount) with Remaining/Excess check in the engine.
- Contact (Rehber): scenarios take a contact id as an input only; Rehber CRUD and open-balance query are a separate story. Borç tests use a fake contact id.
- Calculators: registry mechanism plus only currency convert/cross rate in v1; instalment, interest, lots later (YAGNI).
- API: two steps. `scenario.list/describe` gives the form; `scenario.draft(inputs)` returns a draft entry plus preview and writes nothing; saving goes through the existing entry-post operation.
- Account input is typed and filtered; a typed new name yields a "create account" output the core performs atomically. Scenarios never open accounts themselves.
- Packs: built in (include_str), unsigned in v1; format carries a schema version and content hash so signing can come later.
- Preview sentence: scenario returns label keys plus variables; the core builds the sentence from tr/en strings and the book-country number/date format.

**Why:** keeps CR-4 inside 8 points and keeps rules in one place ([[core-rebuild-4-decisions]]).
**How to apply:** write an ADR note for the grammar choice (acceptance criterion 1), then tests first.

Second round, 2026-11-02 (owner picked every recommended option):
- Contact on a line: a minimal `contact` document kind (name only) and `create_contact` now; the database checks a line's contact id. Rehber story adds edit, archive and open balance later.
- Borç direction: a `choice` input whose options carry their own values (sign, system group); no `if` in the grammar.
- Grammar v1: integer amounts, `+`, `-`, unary `-`, `sum(list.field)`, comparisons, `and`/`or`/`not`; no `*` or `/` (currency conversion is a calculator).
- Foreign currency: rate or base amount is required on a foreign line; the draft returns a field error. A suggested rate comes with the price history.
- Contact document (2026-11-02): name plus kind (individual/brand/business, fixed after creation); names unique ignoring case, with the normalized name computed by the core (Turkish İ/ı), `contact_name_taken`; a line may carry a contact on any account (the scenario decides; only Borç in v1).
