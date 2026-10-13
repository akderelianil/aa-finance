# ADR-0005: Soft delete only, with an audit trail

**Date**: 2026-10-13 (recorded from the schema and `schema.test.ts`)
**Status**: superseded by [ADR-0012](0012-revisions-as-truth.md)
**Deciders**: product owner

## Context
Accounting records must be traceable. Users need to correct mistakes, and a family book has several authors. Entry numbers must never be reused.

## Decision
No table allows `DELETE` (a test asserts it). Rows get `deleted_at` and `deleted_by`. Posted entries change only through draft and keep their number. Triggers write `audit_log` (who changed which row); the API writes `activity_log` (who did what, including failures). Both logs are append-only; `activity_log` is pruned only after `activity_log_days`. An optional `lock_date` freezes a closed period (`period_locked`).

## Alternatives Considered
### Hard delete with a backup
- **Pros**: smaller file.
- **Cons**: breaks numbering and history.
- **Why not**: fails the traceability goal.

### Immutable ledger with reversing entries only
- **Pros**: classic accounting practice.
- **Cons**: heavier flow for a family app.
- **Why not**: records stay editable; the audit trail records every change.

## Consequences
### Positive
- Full history, stable numbers, safe admin fixes.

### Negative
- Queries must filter `deleted_at`; the file only grows.

### Risks
- Every new table needs the six audit columns and triggers (a test checks this).
