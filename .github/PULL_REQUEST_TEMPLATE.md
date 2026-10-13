## What and why

## Checks
- [ ] `npm test && npx tsc --noEmit && npm run lint` pass
- [ ] `cargo test` passes (if `src-tauri/` changed)
- [ ] New `src/core/` logic has tests first
- [ ] Rules still live in the database (trigger + stable error code); the API only checks for clear messages
- [ ] New migration added as `src/core/migrations/NNNN_name.sql` (no applied migration edited)
- [ ] UI text added in both `tr` and `en`
- [ ] Docs / ADR updated if a decision or API changed
