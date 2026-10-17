# ADR-0022: The book settings document

**Date**: 2026-10-17
**Status**: accepted
**Deciders**: product owner (core-rebuild-4 talk)

**Relation**: Applies [ADR-0012](0012-revisions-as-truth.md) (every user-made thing is a revisioned document) to the settings of a book and adds two rows to the kernel of [ADR-0021](0021-sealed-ledger-kernel.md) (K21, K22). The base currency rule follows [ADR-0010](0010-amounts-commodities-balancing.md).

## Context
The base currency lived in the memory of a session, so a file did not know its own base currency. Other settings were going to follow, and the owner asked where each kind of setting belongs and who may change it.

## Decision
**Three levels.** A setting belongs to the book, to the person, or to the device.

| Level | Examples | Where it lives | Who changes it |
|---|---|---|---|
| Book (shared by the family) | base currency | the settings document in the ledger, revisioned, synced later | the admin only |
| Person | interface language, display currency or unit (USD, EUR, gold), privacy mode | outside the ledger, per person | that person |
| Device | theme, window size, PIN | on the device only | whoever uses the device |

A member without the admin role changes only person and device settings. Roles arrive with core-rebuild-7; until then every book setting is written through one operation (`Ledger::set_base_currency`), which is where the admin check is added.

**One document, one fixed id.** The book has one settings document. Its id is the same constant in every book (`SETTINGS_DOC`), so two devices that open a book alone write revisions of the same document and a clash becomes a visible conflict, not two settings documents.

**Opening a book.** `open_book(base code, scale)` writes the base commodity and the settings in one batch, or nothing. A book without settings is not a usable state, so `settings()` on an unopened file is a missing reference and `open_book` on an open book is refused with `book_already_open`.

**Body is JSON, the projection has columns only where a rule needs them.** The revision body is the source of truth and stays flexible JSON (unknown fields are refused, like every body). The projection row `settings` carries `base_commodity_id` as a real column because a trigger enforces the lock and every posting reads it. A new setting starts in the body only and becomes a column when a rule or a query needs it. There is no second JSON column in the projection: it would be a copy to keep in step.

**Base currency lock.** The base currency can change until any entry document has a revision (a draft or a deleted entry counts). After that the database refuses it with `base_currency_locked`. Moving to another base currency later is the "carry over as a new book" feature (backlog), not a setting change.

**Not in v1.** Book country and number format, book name, lock date, cost method. They are added to the body when their feature arrives, before the body form is frozen in release-and-quality-5 where possible.

## Alternatives Considered
### Base currency as a special field outside the revisions
- **Pros**: smaller first step
- **Cons**: the first exception to "every user-made thing is a revision"; each later setting repeats the work
- **Why not**: one general document costs little more.

### A random settings id with a "one row" check
- **Pros**: no well-known constant
- **Cons**: a second device that opens the book alone creates a second document, and sync would have to reject it as an error
- **Why not**: a fixed id turns that case into an ordinary conflict. Each book is its own ledger on the server, so the shared constant does not collide.

### A JSON column in the projection for flexible fields
- **Pros**: new settings need no column
- **Cons**: a second copy of the body; triggers and foreign keys cannot use it
- **Why not**: the body already is the flexible store.

## Consequences
### Positive
- A ledger file knows its base currency; the session no longer carries it.
- Adding a setting is a body field first, a column later.
### Negative
- A change of base currency before the first entry stays possible; accounts already made keep their own commodities.
### Risks
- The admin check does not exist until core-rebuild-7. Mitigation: one write path, and an acceptance criterion in that story.
