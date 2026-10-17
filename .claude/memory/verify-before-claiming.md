---
name: verify-before-claiming
description: "Search by behavior and check git and the rules before saying something is missing, untracked or unrule-bound; own wrong claims of 2026-10-17"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5aeb85f2-b754-4425-a5c1-3a02130e9db4
  modified: 2026-10-17T12:34:30.495Z
---

Before stating that a test, file, rule or tracking does not exist, check it in more than one way, and say plainly when an earlier claim of mine turns out wrong.

Mistakes of 2026-10-17 and what would have prevented them:
- I said the draft-start trigger had no test after grepping for the trigger name; a test pinned the behavior under another name and failed on the change. Search tests by behavior (the SQL it runs, the code it expects), not only by name.
- I said the memory files were not in git; `git status` showed them tracked. Run the command before describing repository state.
- I wrote a finding (K3 "has no test of its own") that the test list contradicted. Check the test list before writing a finding into a document.
- I edited story files directly although CLAUDE.md says to write them through `ledger.js`. Re-read the project rule before touching a managed file; if the ledger has no command for the change (progress notes), say so and check `npm run story -- status` for drift afterwards.

**Why:** the owner puts data integrity first and reads claims as facts; a wrong claim in a decision document or an ADR table gets built on. The owner also valued hearing about my slips straight away.
**How to apply:** for "does not exist" claims run a behavior search and a git check; for documents, verify each named test, code and file with a command (the `kernel:check` script does this for ADR-0021); report a corrected claim in the next message without being asked. See [[owner-wants-pushback]] and [[workflow-notes]].
