---
name: project-audit-2026-10-12
description: "Ponytail audit 2026-10-12 done (security, pooler, paging, RLS, private avatars); what is deferred to release"
metadata:
  node_type: memory
  type: project
  originSessionId: 6a8f3080-834d-4a60-9e79-01dc63f30795
  modified: 2026-10-12T07:57:18.381Z
---

Ponytail audit and fixes finished 2026-10-12 (ROADMAP row A1). All applied and verified live.

Deferred by the user's decision:
- Before go-live: Auth Site URL/redirects, custom SMTP, Turnstile CAPTCHA, session inactivity timeout (list in docs/DEVELOPMENT.md "Before release").
- `ALLOWED_ORIGINS` for the production origin: wait until there is one.
- Leaked-password protection: needs the Pro plan; project is Free.

**Why:** the project is still in development; release settings need the real domain and an SMTP account.
**How to apply:** do not re-propose these as new findings; bring them up when the user prepares the release.

Open check: compare `account_tree_balances` mean time in `extensions.pg_stat_statements` (was 93 ms before the RLS change).
Throwaway user `audit-probe@aa-finance.test` (own group) exists for cross-group tests. See [[reference-demo-account]].
