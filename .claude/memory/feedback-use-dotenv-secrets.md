---
name: feedback-use-dotenv-secrets
description: Tokens and secrets come from the gitignored root .env; load per command, never print values
metadata:
  type: feedback
---

If a task needs a token, read it from the repo-root `.env` (gitignored), not from the user or User env vars. v1 needs none (the Supabase tokens are retired).

**Why:** the owner asked (2026-10-07) after repeated token-visibility problems.
**How to apply:** `set -a; . ./.env; set +a` per command. Never cat or Read `.env` or echo values; check presence with `[ -n "$VAR" ]`, list keys with `sed -E 's/=.*/=<hidden>/' .env`. Do not write secrets into the file myself.
