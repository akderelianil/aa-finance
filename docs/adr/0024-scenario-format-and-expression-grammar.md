# ADR-0024: Scenario format and a minimal expression grammar of our own

**Date**: 2026-11-02
**Status**: accepted
**Deciders**: product owner, in the sessions of 2026-10-17 and 2026-11-02

**Relation**: Settles the open point of [ADR-0016](0016-scenarios-and-plugins.md) (CEL "to be verified", fallback a grammar of our own). Entries a scenario drafts pass the same rules as any entry ([ADR-0021](0021-sealed-ledger-kernel.md)); the operations join the contract of [ADR-0023](0023-api-contract-is-the-authority.md).

## Context
Scenarios (Gider, Gelir, Transfer, Borç first) are JSON data, so the community can add packs without touching the core. They need a few derived values: a total, the remaining part of a split, an amount plus a fee, and checks over the inputs. The language for these must be safe to run on data we did not write, exact (scaled integers, never float), small enough that Claude Code can keep it legible, and the same on every platform because it runs in the core.

## Decision
**Grammar: our own, minimal.** Not CEL. The four scenarios need sums and comparisons only; CEL brings strings, maps, macros, floats and a dependency whose licence and release cadence would need watching. The grammar (v1):

```
expr    = or
or      = and ("or" and)*
and     = not ("and" not)*
not     = "not" not | compare
compare = sum (("=" | "!=" | "<" | "<=" | ">" | ">=") sum)?
sum     = unary (("+" | "-") unary)*
unary   = "-" unary | atom
atom    = "0" | name | "sum" "(" name "." name ")" | "(" expr ")"
name    = [a-z][a-z0-9_]*
```

- Two types: amount (a scaled integer in one commodity) and boolean. The pack loader checks types and names; an expression with an unknown name, a wrong type, more than 256 characters or nesting deeper than 16 does not load.
- The only literal is `0`. Other constants come from inputs or choice values.
- `+`, `-` and comparisons need both sides in the same commodity; mixing is a draft error, not a silent conversion. Arithmetic is checked: an overflow is an error, never a wrap.
- No `*`, `/`, `if`, loops, strings, functions other than `sum`, or access to anything outside the inputs. Currency conversion and cross rates are official calculators in Rust (registry; v1 has convert and cross rate only). Multiplication with a named rounding mode comes when instalments or interest need it.

**Scenario document.** A scenario has an id, a schema version, typed inputs, derived values, checks, output lines, a preview sentence key and locale strings. Input types are a small fixed set: amount, account (with a filter on kind and group), date, text, contact, choice, and a repeating line list (account plus amount) for splits. A choice option carries its own values (for Borç: the sign and the system group), so direction needs no conditional. An account input may receive a new name; the draft then lists an account to create and the core creates it in the same write. A scenario never opens accounts or contacts on its own.

**Two steps, nothing written by a draft.** `scenario_list` and `scenario_describe` give the form (stable, documented, rendered natively by every platform). `scenario_draft(id, inputs)` returns the entry input, the accounts to create, the preview (label key, variables, and the sentence built in Turkish or English with the book's number and date format) and field errors; it writes nothing. Saving goes through `post_entry`, so a faulty scenario cannot write anything the ledger rules refuse.

**Foreign currency.** A line in a commodity other than the base needs a rate or a base amount from the user; without one the draft returns a field error. A suggested rate waits for the price history.

**Contacts.** Borç binds the debt line to a contact. A minimal `contact` document (name only) and `create_contact` arrive with this work so the database can check the line's contact id; the Rehber story adds editing, archiving and the open balance.

**Packs.** The first pack is built into the core (`include_str!`), unsigned in v1. The format carries a schema version and a content hash so signatures can be added without a format change.

## Alternatives Considered
### CEL (`cel` crate)
- **Pros**: A known language, non-Turing complete, a Rust interpreter exists
- **Cons**: Far more than four scenarios need (strings, maps, floats, macros); a dependency to vet and track; float semantics must be blocked by hand
- **Why not**: Rejected for v1; revisit only if packs need far more than sums and checks

### A conditional operator in the grammar
- **Pros**: One expression can switch direction
- **Cons**: A bigger language and more ways for a scenario to be wrong
- **Why not**: Choice options carry values instead

### Four separate Borç scenarios
- **Pros**: No new input type
- **Cons**: Repeated data in the pack
- **Why not**: Rejected

## Consequences
### Positive
- The language is small enough to test fully (95 percent floor: ADR-0020) and cannot loop, allocate without bound or touch the ledger.
- A wrong scenario can at worst produce a draft the ledger refuses.

### Negative
- Pack authors get only sums and checks until a need for more is shown.

### Risks
- A later need (interest, instalments) forces a grammar change; it is additive, so packs written for v1 stay valid.
