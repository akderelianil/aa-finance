---
name: reference-demo-account
description: "Permanent dev demo account demo@aa-finance.test with 3 months of entries; seed script, password in .env"
metadata:
  node_type: memory
  type: reference
  originSessionId: 6a8f3080-834d-4a60-9e79-01dc63f30795
  modified: 2026-10-12T07:25:29.001Z
---

`demo@aa-finance.test` (group "Demo Ailesi", recommended chart, 129 entries 2026-07-12 → 2026-10-11). Password: `DEV_TEST_PASSWORD` in root `.env` (never print). Seed/complete: `node scripts/dev/seed-test-account.mjs` (resumable). Keep it when cleaning test users.

Members (same password): demo.elif@ (Elif, spouse: salary, own bank + card) and demo.can@ (Can, student: allowance, cash), seeded by `scripts/dev/seed-demo-members.mjs`.

The intermittent `journal-post` 500 (2026-10-11) was Postgres `53300` (connection slots full). Fixed 2026-10-12: functions use secret `DB_POOL_URL` (transaction pooler, host `aws-1-eu-central-1`, not `aws-0`). 40 parallel calls → 0 errors.

Throwaway user `audit-probe@aa-finance.test` (own group "Probe Ailesi") was made 2026-10-12 for a cross-group check; safe to delete.

See [[project-core-accounts]].
