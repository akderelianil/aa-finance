---
owner: product-lead
status: active
---

# Continuous integration

Two workflows in `.github/workflows/`, and a deliberately small policy while the project is in fast development
and the repository is private (Actions minutes are limited and macOS counts ten times, Windows twice).

| Workflow | Runs | Where |
|---|---|---|
| `ci.yml` | on a push to `main` or a pull request that changes code (not only `docs/`, `.stories/`, `.claude/`, `*.md`); and by hand | repo scripts and test catalog, Rust core on Ubuntu |
| `ci.yml`, started by hand | `gh workflow run ci.yml` (or Actions -> CI -> Run workflow) | Rust core on Ubuntu, Windows and macOS |
| `legacy.yml` | only when something under `legacy/` changes; and by hand | prototype web checks, prototype Rust tests, Playwright smoke path |
| Dependabot | monthly | npm and cargo in `legacy/`, cargo in the workspace, GitHub Actions |

The local pre-commit hook (`npm run hooks:install`) runs the same checks plus the prototype web checks before
every commit, so a documentation commit costs no CI minutes and a code commit is checked twice.

## When the repository is public
Standard runners are free in a public repository, macOS and Windows included. Then:
1. Remove `paths-ignore` from the push trigger if you want every commit checked, and set the matrix to all
   three systems on every push (the `os:` expression in `ci.yml`).
2. Run `legacy.yml` on every push, or delete it with `legacy/` at the end of `core-rebuild-9`.
3. Keep `permissions: contents: read` and require approval for workflows from first-time contributors
   (Settings -> Actions -> General).

Story `release-and-quality-1` adds coverage floors, mutation testing and fuzz jobs on top of this.
