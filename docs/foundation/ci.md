---
owner: product-lead
status: active
---

# Continuous integration

One workflow, `.github/workflows/ci.yml`, and a deliberately small policy. The owner decided on 2026-10-14 to keep
it small **also after the repository is public**, until the product has matured: the code changes every day, the
local pre-commit hook already runs the same checks, and a cross-system run on every push adds noise and minutes.

| Run | When | What |
|---|---|---|
| Automatic | a push to `main` or a pull request that changes code (not only `docs/`, `.stories/`, `.claude/`, `*.md`) | repo scripts and test catalog; Rust core on Ubuntu (fmt, clippy, tests) |
| By hand | `gh workflow run ci.yml` (or Actions -> CI -> Run workflow) | the same, with the Rust core on Ubuntu, Windows and macOS |
| Dependabot | monthly | cargo in the workspace and GitHub Actions |

The local pre-commit hook (`npm run hooks:install`) runs `npm run verify` and `cargo test --workspace` before every
commit, so a documentation commit costs no CI and a code commit is checked twice. Start the by-hand run before a
release and after changes that touch files, paths, line endings or other system-specific behavior.

## When the product has matured
Standard runners are free in a public repository, macOS and Windows included. Then:
1. Remove `paths-ignore` from the triggers if every commit should be checked, and set the matrix to all three
   systems on every push (the `os:` expression in `ci.yml`).
2. Keep `permissions: contents: read`, and require approval for workflows from first-time contributors
   (Settings -> Actions -> General).

Story `release-and-quality-1` adds coverage floors, mutation testing and fuzz jobs on top of this.
