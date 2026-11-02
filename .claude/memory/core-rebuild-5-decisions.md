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
