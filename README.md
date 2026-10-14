# aa-finance

Personal and family finance for people who know no accounting, built on a strict double-entry ledger.
Free and private on your own device. Paid, end-to-end encrypted sync is planned for later; the app and its
protocols stay open source.

> **Status: early development.** The foundation is being rebuilt (Rust core, Electron app). There is nothing to
> install yet. The earlier prototype (Tauri, SQLite, TypeScript) was removed from `main` and is kept in the git tag [`prototype-final`](https://github.com/akderelianil/aa-finance/tree/prototype-final).

## What it is for
A person with no accounting knowledge can run every money decision of daily life with it, in plain words, while
the books underneath follow professional double-entry rules. One ledger belongs to one family of up to ten
people. It is not for businesses, tax filing or e-invoicing.

## Principles
- **Your data is yours.** An open, documented schema, CSV export of everything, a separate full backup.
- **Never lose a record.** Append-only revisions, undo instead of delete, conflicts kept and shown.
- **Private by default.** No telemetry; crash reports only with your consent.
- **Honest accounting underneath, daily words on top.**
- **Quality over speed.** Data integrity first, then privacy and security, then compatibility and performance.

The full vision is in [docs/foundation/vision.md](docs/foundation/vision.md); the plan is in
[docs/ROADMAP.md](docs/ROADMAP.md) and the decisions are in [docs/adr/](docs/adr/README.md).

## Repository layout
| Path | Content |
|---|---|
| `crates/core/` | The shared Rust core: revisions, projection, exact amounts and rates |
| `docs/` | Vision, decisions (ADR), design, test catalog; see [docs/README.md](docs/README.md) |
| `scripts/` | Repository tools (changelog, story ledger, test catalog) |
| `.stories/` | Work tracking: epics, stories, sprints |

## Build and test
You need Rust (stable) and Node.js 24.

```sh
cargo test --workspace      # the Rust core
npm run verify              # repository scripts and the test catalog
```

## License and contributing
Clients and the core are under the [MIT License](LICENSE). The future sync server will be AGPL. Contributions
are welcome under the Developer Certificate of Origin; see [CONTRIBUTING.md](CONTRIBUTING.md). Security
reports: see [SECURITY.md](SECURITY.md).
