# Security

aa-finance is a local, single-device app: one SQLite file, no server, no network sync, no accounts in the cloud.

## Scope
- The 6-digit member PIN is an **app gate**, not encryption. Anyone with the file can read it. Use disk encryption for confidentiality.
- Rules (balanced entries, roles, locked periods) are enforced by database triggers and the named API; the UI never runs SQL.
- No secrets in v1. If a token is ever needed it goes in the gitignored root `.env`.

## Reporting
Open a private security advisory on this repository (Security tab) or contact the owner directly. Do not file public issues for vulnerabilities.

## Dependencies
Dependabot watches npm, cargo and GitHub Actions monthly; security updates arrive as soon as an advisory is published.
