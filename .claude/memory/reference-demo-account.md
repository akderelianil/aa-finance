---
name: reference-demo-account
description: Permanent dev demo account demo@aa-finance.test with 3 months of entries; seed script, password in .env
metadata:
  type: reference
---

`demo@aa-finance.test` (group "Demo Ailesi", recommended chart, 129 entries 2026-07-12 → 2026-10-11). Password: `DEV_TEST_PASSWORD` in root `.env` (never print). Seed/complete: `node scripts/dev/seed-test-account.mjs` (resumable). Keep it when cleaning test users.

Seen 2026-10-11: `journal-post` returned an intermittent 500 ("internal") every ~40 calls during seeding; a rerun succeeded. Cause not found (function logs not queried). Check it if users report random failures.

See [[project-core-accounts]].
