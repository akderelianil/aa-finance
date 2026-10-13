---
owner: backend-engineer
status: active
---

# Backup and restore

Data safety. Database rules: [rules](../database/rules.md).

- The database is `aa-finance.sqlite` in the app data folder. One user per file. The profile name is the local `user` actor (`settings.update` `userName`).
- Backup copy: `VACUUM INTO` (a consistent copy while the app runs). It never overwrites the open file.
- Automatic: on the first start each day, `backups/aa-finance-<date>.sqlite`. The last 10 are kept.
- Manual: Settings → Data → "Back up now" writes a copy where the user picks (save dialog, `tauri-plugin-dialog`).
- Restore: the file must pass `quick_check`, have the core tables and a `user_version` not newer than the app (`not_a_backup`, `backup_too_new`). The live data goes to `backups/before-restore-<stamp>.sqlite` first. Then the SQLite backup API copies the file into the open connection, and the UI reloads (migrations run).
- Danger zone (Settings, admin only, typed confirmation): `entries.deleteAll` soft deletes every entry and keeps accounts, members, rates and settings (a locked period stops it). `reset_data` copies the live data to `backups/before-reset-<stamp>.sqlite`, drops every table, view and trigger and sets `user_version` to 0; the UI then reloads into setup (delete the ledger).
- There is no JSON export or import: the SQLite file holds everything, including `audit_log` and `activity_log`.
- Plain-browser dev mode: backup is a download and restore is an upload, served by the Vite plugin (`scripts/dev-db.ts`, same checks, no automatic backup).
