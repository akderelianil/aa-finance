---
name: feedback-audit-columns-everywhere
description: Every table except audit_log and activity_log carries all six audit columns; do not slim them per table
metadata:
  type: feedback
---

Every table except `audit_log` and `activity_log` has `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `deleted_by`. This includes `currencies`, `settings` and any table added later.

**Why:** The owner said professional systems carry full audit data on every table, without exceptions. I dropped unused audit columns from `settings` and `fx_rates` (0006); the owner called it a wrong move and 0007 restored them.

**How to apply:** A new table gets the same six columns, a `CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))` and audit triggers. Do not propose removing audit columns to simplify. A table that is never deleted keeps the columns; a trigger blocks the delete.
