# Contributing

Thank you for looking at aa-finance. The project is in early development and the foundation is changing
quickly, so please open an issue to discuss a change before you spend time on a large pull request.

## Developer Certificate of Origin
Contributions are accepted under the [Developer Certificate of Origin](https://developercertificate.org/).
There is no contributor license agreement. Sign every commit with `git commit -s`, which adds a line:

```
Signed-off-by: Your Name <you@example.com>
```

By signing off you state that you wrote the change or have the right to submit it under the project license
(MIT for clients and the core; AGPL for the future sync server).

## How we work
- Read [CLAUDE.md](CLAUDE.md) for the engineering rules and [docs/README.md](docs/README.md) for the documents.
- Tests come first for new logic. Run `cargo test --workspace` and `npm run verify` before you push.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`,
  `test:`, `chore:`).
- Decisions that are hard to reverse are recorded as an ADR in [docs/adr/](docs/adr/README.md); an ADR is
  superseded by a new one, not rewritten.
- Money is exact: scaled integers and decimal text, never floating point.

## Reporting a vulnerability
Do not open a public issue. Use a private security advisory on this repository (see [SECURITY.md](SECURITY.md)).
