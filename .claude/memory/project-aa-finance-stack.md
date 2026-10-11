---
name: project-aa-finance-stack
description: "aa-finance stack and Ubuntu/WSL2 machine gotchas; commands and debt live in docs/DEVELOPMENT.md"
metadata:
  type: project
---

Stack (decided 2026-10-07): Supabase `ckwigjohcdsfqglmmzdq` (dev only) + TypeScript Edge Functions + React/Vite desktop app on ReUI (shadcn Base UI underneath, shadcn MCP/skill removed 2026-10-11), Cloudflare Pages later. Decisions: `docs/ARCHITECTURE.md`; commands, secrets, status, release tasks: `docs/DEVELOPMENT.md` (read at session start). Product state: [[project-ledger-core-pivot]].

Gotchas not worth rediscovering:
- Dev is Ubuntu on WSL2 since 2026-10-08, bash only (no Windows/PowerShell). Work in `~/aa-finance`, never `/mnt/c`. Use npm / `npx supabase`.
- Load root `.env` per command (`set -a; . ./.env; set +a`), never print values; Supabase MCP is read-only and often Unauthorized, use the CLI ([[feedback-use-dotenv-secrets]]).
- Pin `npm:@supabase/supabase-js@2.117.2` in functions (2.117.3 tarball missing).
- postgres.js returns `date` as JS Date: cast `::text` before string compares.
- Deps are very new (react-router 8, vite 8, tailwind 4, TS 6): check context7.
- Minimal check: `cd web && npm run lint && npm run build`.
- No git remote: commit only, never push ([[project-no-git-remote]]).
