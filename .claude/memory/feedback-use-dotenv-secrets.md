---
name: feedback-use-dotenv-secrets
description: "Get tokens/secrets from the root .env file, load it per command, never print values"
metadata:
  type: feedback
---

Use the repo-root `.env` (gitignored; template `.env.example`) as the source for tokens and secrets (SUPABASE_ACCESS_TOKEN etc.) instead of asking the user or hunting in User env vars.

**Why:** User asked 2026-10-07 to learn using .env after repeated token-visibility problems (setx value not seen by Claude session, MCP Unauthorized).

**How to apply:** Load before CLI/API calls (`set -a; . ./.env; set +a` in bash). Never cat/Read `.env` or echo values; check presence with `[ -n "$VAR" ]`, list keys with `sed -E 's/=.*/=<hidden>/'`. If `.env` is missing, tell the user to copy `.env.example` and fill it; don't write secrets into it myself. Frontend vars live separately in `web/.env.local` (VITE_* only). MCP reads `${SUPABASE_ACCESS_TOKEN}` from process env, not .env. Details: `docs/DEVELOPMENT.md`.

See [[project-aa-finance-stack]].
