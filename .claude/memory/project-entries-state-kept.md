---
name: project-entries-state-kept
description: Why entries.state (draft/posted) stays in the schema; do not propose removing it again
metadata:
  node_type: memory
  type: project
  originSessionId: 0e913cf6-28b3-453a-8370-db03013daadd
  modified: 2026-10-12T16:24:03.826Z
---

`entries.state` stays. SQLite has no deferred or statement-level triggers, so the DB cannot check "≥2 lines and debit = credit" while lines arrive one by one. The draft → posted update is the commit point where `entries_update` checks line count and balance, and `entries_number` assigns the number. Editing a posted entry goes back to draft (number kept), swaps the lines, and posts again.

**Why:** Every replacement tried (a `line_count` column checked on the last line, a `number IS NULL` marker, an "open" flag) either keeps an equivalent marker or weakens the rule (partial entries pass; a lone line soft-delete passes). Checked 2026-10-12 after the uid removal ([local-first](project-local-first.md)).

**How to apply:** If simplifying the schema, leave `state` alone. Revisit only if the engine changes or deferred constraints become available.
