-- Every table except the two logs carries the same audit columns: created_at, updated_at, created_by,
-- updated_by, deleted_at, deleted_by. This adds the missing ones (settings and fx_rates lose their created_* in
-- 0006; currencies never had them; deleted_by is new everywhere). Backfill: the creator and deleter come from
-- the audit_log rows, else from updated_by; currencies belong to System (actor 1).
-- Settings and currencies are still never deleted: their triggers block it.

PRAGMA defer_foreign_keys = ON;

DROP TRIGGER currencies_no_delete;
DROP TRIGGER actors_no_delete;
DROP TRIGGER accounts_no_delete;
DROP TRIGGER entries_no_delete;
DROP TRIGGER lines_no_delete;
DROP TRIGGER currencies_no_update;
DROP TRIGGER actors_deleted;
DROP TRIGGER accounts_insert;
DROP TRIGGER accounts_update;
DROP TRIGGER entries_insert;
DROP TRIGGER entries_update;
DROP TRIGGER entries_number;
DROP TRIGGER entries_date_sync;
DROP TRIGGER entries_soft_delete;
DROP TRIGGER lines_insert;
DROP TRIGGER lines_update;
DROP TRIGGER accounts_audit_insert;
DROP TRIGGER accounts_audit_update;
DROP TRIGGER entries_audit_insert;
DROP TRIGGER entries_audit_update;
DROP TRIGGER lines_audit_insert;
DROP TRIGGER lines_audit_update;
DROP TRIGGER actors_insert_role;
DROP TRIGGER actors_update_role;
DROP TRIGGER actors_last_admin;
DROP TRIGGER entries_owner;
DROP TRIGGER actors_audit_insert;
DROP TRIGGER actors_audit_update;
DROP TRIGGER settings_no_delete;
DROP TRIGGER fx_rates_no_delete;
DROP TRIGGER fx_rates_deleted;
DROP TRIGGER settings_insert;
DROP TRIGGER settings_update;
DROP TRIGGER settings_audit_insert;
DROP TRIGGER settings_audit_update;
DROP TRIGGER fx_rates_audit_insert;
DROP TRIGGER fx_rates_audit_update;
DROP TRIGGER settings_admin;

-- currencies
CREATE TABLE currencies_old AS SELECT * FROM currencies;
DROP TABLE currencies;
CREATE TABLE currencies (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  created_by INTEGER NOT NULL REFERENCES actors (id),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES actors (id),
  code TEXT NOT NULL UNIQUE CHECK (code GLOB '[A-Z][A-Z][A-Z]'),
  name TEXT NOT NULL,
  minor_unit INTEGER NOT NULL CHECK (minor_unit BETWEEN 0 AND 4),
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
) STRICT;
INSERT INTO currencies (id, created_at, updated_at, created_by, updated_by, deleted_at, deleted_by, code, name, minor_unit)
SELECT o.id, CAST(unixepoch('subsec') * 1000 AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER), 1, 1, NULL, NULL, o.code, o.name, o.minor_unit
FROM currencies_old o ORDER BY o.id;
DROP TABLE currencies_old;

-- actors
CREATE TABLE actors_old AS SELECT * FROM actors;
DROP TABLE actors;
CREATE TABLE actors (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  created_by INTEGER NOT NULL REFERENCES actors (id),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES actors (id),
  kind TEXT NOT NULL CHECK (kind IN ('user', 'plugin', 'system')),
  name TEXT NOT NULL CHECK (trim(name) <> '')
, role TEXT CHECK (role IN ('admin', 'member')), color TEXT CHECK (color IS NULL OR (length(color) BETWEEN 1 AND 20)),
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
) STRICT;
INSERT INTO actors (id, created_at, updated_at, created_by, updated_by, deleted_at, deleted_by, kind, name, role, color)
SELECT o.id, o.created_at, o.updated_at, o.created_by, o.updated_by, o.deleted_at, CASE WHEN o.deleted_at IS NOT NULL THEN coalesce((SELECT actor_id FROM audit_log WHERE table_name = 'actors' AND row_id = o.id AND op = 'delete' ORDER BY id DESC LIMIT 1), o.updated_by) END, o.kind, o.name, o.role, o.color
FROM actors_old o ORDER BY o.id;
DROP TABLE actors_old;

-- settings
CREATE TABLE settings_old AS SELECT * FROM settings;
DROP TABLE settings;
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  created_by INTEGER NOT NULL REFERENCES actors (id),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES actors (id),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  CHECK (key <> 'lock_date' OR value IS NULL OR date(value) IS value),
  CHECK (key <> 'activity_log_days' OR value IS NULL OR (value NOT GLOB '*[^0-9]*' AND value <> '')),
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
) STRICT;
INSERT INTO settings (id, created_at, updated_at, created_by, updated_by, deleted_at, deleted_by, key, value)
SELECT o.id, coalesce((SELECT at FROM audit_log WHERE table_name = 'settings' AND row_id = o.id AND op = 'insert' ORDER BY id ASC LIMIT 1), o.updated_at), o.updated_at, coalesce((SELECT actor_id FROM audit_log WHERE table_name = 'settings' AND row_id = o.id AND op = 'insert' ORDER BY id ASC LIMIT 1), o.updated_by), o.updated_by, NULL, NULL, o.key, o.value
FROM settings_old o ORDER BY o.id;
DROP TABLE settings_old;

-- fx_rates
CREATE TABLE fx_rates_old AS SELECT * FROM fx_rates;
DROP TABLE fx_rates;
CREATE TABLE fx_rates (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  created_by INTEGER NOT NULL REFERENCES actors (id),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES actors (id),
  date TEXT NOT NULL CHECK (date(date) IS date),
  currency_id INTEGER NOT NULL REFERENCES currencies (id),
  -- 1 unit of the currency = rate units of the base currency.
  rate TEXT NOT NULL CHECK (
    rate GLOB '[0-9]*' AND rate NOT GLOB '*[^0-9.]*' AND rate NOT GLOB '*.*.*' AND rate NOT GLOB '*.'
    AND CAST(rate AS REAL) > 0
  ),
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
) STRICT;
INSERT INTO fx_rates (id, created_at, updated_at, created_by, updated_by, deleted_at, deleted_by, date, currency_id, rate)
SELECT o.id, coalesce((SELECT at FROM audit_log WHERE table_name = 'fx_rates' AND row_id = o.id AND op = 'insert' ORDER BY id ASC LIMIT 1), o.updated_at), o.updated_at, coalesce((SELECT actor_id FROM audit_log WHERE table_name = 'fx_rates' AND row_id = o.id AND op = 'insert' ORDER BY id ASC LIMIT 1), o.updated_by), o.updated_by, o.deleted_at, CASE WHEN o.deleted_at IS NOT NULL THEN coalesce((SELECT actor_id FROM audit_log WHERE table_name = 'fx_rates' AND row_id = o.id AND op = 'delete' ORDER BY id DESC LIMIT 1), o.updated_by) END, o.date, o.currency_id, o.rate
FROM fx_rates_old o ORDER BY o.id;
DROP TABLE fx_rates_old;
CREATE UNIQUE INDEX fx_rates_currency_date ON fx_rates (currency_id, date) WHERE deleted_at IS NULL;

-- accounts
CREATE TABLE accounts_old AS SELECT * FROM accounts;
DROP TABLE accounts;
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  created_by INTEGER NOT NULL REFERENCES actors (id),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES actors (id),
  parent_id INTEGER REFERENCES accounts (id),
  -- For a system_key account the UI shows a translated name; this one is the English fallback.
  name TEXT NOT NULL CHECK (trim(name) <> ''),
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  currency_id INTEGER NOT NULL REFERENCES currencies (id),
  is_placeholder INTEGER NOT NULL DEFAULT 0 CHECK (is_placeholder IN (0, 1)),
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1)),
  system_key TEXT UNIQUE,
  archived_at INTEGER,
  -- Only the five locked roots have no parent.
  CHECK (parent_id IS NOT NULL OR (locked = 1 AND system_key = type)),
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
) STRICT;
INSERT INTO accounts (id, created_at, updated_at, created_by, updated_by, deleted_at, deleted_by, parent_id, name, type, currency_id, is_placeholder, locked, system_key, archived_at)
SELECT o.id, o.created_at, o.updated_at, o.created_by, o.updated_by, o.deleted_at, CASE WHEN o.deleted_at IS NOT NULL THEN coalesce((SELECT actor_id FROM audit_log WHERE table_name = 'accounts' AND row_id = o.id AND op = 'delete' ORDER BY id DESC LIMIT 1), o.updated_by) END, o.parent_id, o.name, o.type, o.currency_id, o.is_placeholder, o.locked, o.system_key, o.archived_at
FROM accounts_old o ORDER BY o.id;
DROP TABLE accounts_old;
CREATE INDEX accounts_parent ON accounts (parent_id);
CREATE UNIQUE INDEX accounts_sibling_name ON accounts (parent_id, name) WHERE deleted_at IS NULL;

-- entries
CREATE TABLE entries_old AS SELECT * FROM entries;
DROP TABLE entries;
CREATE TABLE entries (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  created_by INTEGER NOT NULL REFERENCES actors (id),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES actors (id),
  entry_date TEXT NOT NULL CHECK (date(entry_date) IS entry_date),
  -- Assigned by a trigger on the first post. Never changed, never reused.
  year INTEGER,
  number INTEGER,
  reference TEXT,
  description TEXT,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'posted')),
  CHECK ((year IS NULL) = (number IS NULL)),
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
) STRICT;
INSERT INTO entries (id, created_at, updated_at, created_by, updated_by, deleted_at, deleted_by, entry_date, year, number, reference, description, state)
SELECT o.id, o.created_at, o.updated_at, o.created_by, o.updated_by, o.deleted_at, CASE WHEN o.deleted_at IS NOT NULL THEN coalesce((SELECT actor_id FROM audit_log WHERE table_name = 'entries' AND row_id = o.id AND op = 'delete' ORDER BY id DESC LIMIT 1), o.updated_by) END, o.entry_date, o.year, o.number, o.reference, o.description, o.state
FROM entries_old o ORDER BY o.id;
DROP TABLE entries_old;
CREATE UNIQUE INDEX entries_number ON entries (year, number) WHERE number IS NOT NULL;
CREATE INDEX entries_date ON entries (entry_date, id) WHERE deleted_at IS NULL;

-- lines
CREATE TABLE lines_old AS SELECT * FROM lines;
DROP TABLE lines;
CREATE TABLE lines (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  created_by INTEGER NOT NULL REFERENCES actors (id),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES actors (id),
  entry_id INTEGER NOT NULL REFERENCES entries (id),
  account_id INTEGER NOT NULL REFERENCES accounts (id),
  -- Copy of entries.entry_date, kept in sync by triggers, for the balance index.
  entry_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  base_amount INTEGER NOT NULL CHECK (base_amount <> 0 AND (base_amount > 0) = (amount > 0)),
  -- Set only when the account currency is not the base currency.
  rate TEXT CHECK (
    rate IS NULL OR (
      rate GLOB '[0-9]*' AND rate NOT GLOB '*[^0-9.]*' AND rate NOT GLOB '*.*.*' AND rate NOT GLOB '*.'
      AND CAST(rate AS REAL) > 0
    )
  ),
  memo TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
) STRICT;
INSERT INTO lines (id, created_at, updated_at, created_by, updated_by, deleted_at, deleted_by, entry_id, account_id, entry_date, amount, base_amount, rate, memo, position)
SELECT o.id, o.created_at, o.updated_at, o.created_by, o.updated_by, o.deleted_at, CASE WHEN o.deleted_at IS NOT NULL THEN coalesce((SELECT actor_id FROM audit_log WHERE table_name = 'lines' AND row_id = o.id AND op = 'delete' ORDER BY id DESC LIMIT 1), o.updated_by) END, o.entry_id, o.account_id, o.entry_date, o.amount, o.base_amount, o.rate, o.memo, o.position
FROM lines_old o ORDER BY o.id;
DROP TABLE lines_old;
CREATE INDEX lines_account ON lines (account_id, entry_date, amount, base_amount, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX lines_entry ON lines (entry_id);

-- Triggers. The audit rows now carry all six audit columns.

CREATE TRIGGER currencies_no_delete BEFORE DELETE ON currencies BEGIN SELECT RAISE(ABORT, 'no_delete'); END;

CREATE TRIGGER actors_no_delete BEFORE DELETE ON actors BEGIN SELECT RAISE(ABORT, 'no_delete'); END;

CREATE TRIGGER accounts_no_delete BEFORE DELETE ON accounts BEGIN SELECT RAISE(ABORT, 'no_delete'); END;

CREATE TRIGGER entries_no_delete BEFORE DELETE ON entries BEGIN SELECT RAISE(ABORT, 'no_delete'); END;

CREATE TRIGGER lines_no_delete BEFORE DELETE ON lines BEGIN SELECT RAISE(ABORT, 'no_delete'); END;

CREATE TRIGGER currencies_no_update BEFORE UPDATE ON currencies BEGIN SELECT RAISE(ABORT, 'currency_fixed'); END;

CREATE TRIGGER actors_deleted BEFORE UPDATE ON actors WHEN OLD.deleted_at IS NOT NULL BEGIN SELECT RAISE(ABORT, 'row_deleted'); END;

CREATE TRIGGER accounts_insert BEFORE INSERT ON accounts
BEGIN
  SELECT CASE
    WHEN NEW.parent_id IS NULL THEN NULL
    WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE id = NEW.parent_id AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'account_parent_missing')
    WHEN (SELECT type FROM accounts WHERE id = NEW.parent_id) IS NOT NEW.type
      THEN RAISE(ABORT, 'account_parent_type')
  END;
END;

CREATE TRIGGER accounts_update BEFORE UPDATE ON accounts
BEGIN
  SELECT CASE
    WHEN OLD.deleted_at IS NOT NULL THEN RAISE(ABORT, 'row_deleted')
    WHEN OLD.locked = 1 THEN RAISE(ABORT, 'account_locked')
    WHEN NEW.locked IS NOT OLD.locked OR NEW.system_key IS NOT OLD.system_key OR NEW.type IS NOT OLD.type
      THEN RAISE(ABORT, 'account_field_fixed')
    WHEN NEW.parent_id IS NOT OLD.parent_id
      AND NOT EXISTS (SELECT 1 FROM accounts WHERE id = NEW.parent_id AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'account_parent_missing')
    WHEN NEW.parent_id IS NOT OLD.parent_id AND (SELECT type FROM accounts WHERE id = NEW.parent_id) IS NOT NEW.type
      THEN RAISE(ABORT, 'account_parent_type')
    WHEN NEW.parent_id IS NOT OLD.parent_id AND EXISTS (
      WITH RECURSIVE up (id) AS (
        SELECT NEW.parent_id
        UNION SELECT a.parent_id FROM accounts a JOIN up ON a.id = up.id WHERE a.parent_id IS NOT NULL
      )
      SELECT 1 FROM up WHERE id = NEW.id
    ) THEN RAISE(ABORT, 'account_parent_cycle')
    WHEN (NEW.currency_id IS NOT OLD.currency_id OR (NEW.is_placeholder = 1 AND OLD.is_placeholder = 0)
        OR NEW.deleted_at IS NOT NULL)
      AND EXISTS (SELECT 1 FROM lines WHERE account_id = OLD.id AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'account_has_lines')
    WHEN NEW.deleted_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM accounts WHERE parent_id = OLD.id AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'account_has_children')
  END;
END;

CREATE TRIGGER entries_insert BEFORE INSERT ON entries
BEGIN
  SELECT CASE
    WHEN NEW.state <> 'draft' OR NEW.number IS NOT NULL OR NEW.deleted_at IS NOT NULL
      THEN RAISE(ABORT, 'entry_insert_draft')
    WHEN NEW.entry_date <= (SELECT value FROM settings WHERE key = 'lock_date')
      THEN RAISE(ABORT, 'period_locked')
  END;
END;

CREATE TRIGGER entries_update BEFORE UPDATE ON entries
BEGIN
  SELECT CASE
    WHEN OLD.deleted_at IS NOT NULL THEN RAISE(ABORT, 'row_deleted')
    WHEN OLD.entry_date <= (SELECT value FROM settings WHERE key = 'lock_date')
      OR NEW.entry_date <= (SELECT value FROM settings WHERE key = 'lock_date')
      THEN RAISE(ABORT, 'period_locked')
    -- Only the numbering trigger fills year and number, once, right after the first post.
    WHEN (NEW.year IS NOT OLD.year OR NEW.number IS NOT OLD.number)
      AND NOT (OLD.number IS NULL AND OLD.state = 'posted')
      THEN RAISE(ABORT, 'entry_number_fixed')
    WHEN OLD.state = 'posted' AND NEW.state = 'posted' AND NEW.entry_date IS NOT OLD.entry_date
      THEN RAISE(ABORT, 'entry_posted')
    WHEN OLD.state = 'draft' AND NEW.state = 'posted'
      AND (SELECT count(*) FROM lines WHERE entry_id = OLD.id AND deleted_at IS NULL) < 2
      THEN RAISE(ABORT, 'entry_too_few_lines')
    WHEN OLD.state = 'draft' AND NEW.state = 'posted'
      AND (SELECT sum(base_amount) FROM lines WHERE entry_id = OLD.id AND deleted_at IS NULL) <> 0
      THEN RAISE(ABORT, 'entry_unbalanced')
  END;
END;

CREATE TRIGGER entries_number AFTER UPDATE OF state ON entries
WHEN NEW.state = 'posted' AND NEW.number IS NULL
BEGIN
  UPDATE entries
  SET year = CAST(substr(NEW.entry_date, 1, 4) AS INTEGER),
      -- One index seek: "number IS NOT NULL" matches the partial index, and ORDER BY ... LIMIT 1
      -- reads its last key (max() here would scan the whole year).
      number = coalesce((
        SELECT number FROM entries
        WHERE year = CAST(substr(NEW.entry_date, 1, 4) AS INTEGER) AND number IS NOT NULL
        ORDER BY number DESC LIMIT 1
      ), 0) + 1
  WHERE id = NEW.id;
END;

CREATE TRIGGER entries_date_sync AFTER UPDATE OF entry_date ON entries
WHEN NEW.entry_date IS NOT OLD.entry_date
BEGIN
  UPDATE lines SET entry_date = NEW.entry_date WHERE entry_id = NEW.id AND deleted_at IS NULL;
END;

CREATE TRIGGER entries_soft_delete AFTER UPDATE OF deleted_at ON entries
WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
BEGIN
  UPDATE lines SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by, updated_at = NEW.updated_at, updated_by = NEW.updated_by
  WHERE entry_id = NEW.id AND deleted_at IS NULL;
END;

CREATE TRIGGER lines_insert BEFORE INSERT ON lines
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM entries WHERE id = NEW.entry_id AND state = 'draft' AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'entry_not_draft')
    WHEN NEW.deleted_at IS NOT NULL THEN RAISE(ABORT, 'line_insert_deleted')
    WHEN NEW.entry_date IS NOT (SELECT entry_date FROM entries WHERE id = NEW.entry_id)
      THEN RAISE(ABORT, 'line_date_mismatch')
    WHEN (SELECT deleted_at FROM accounts WHERE id = NEW.account_id) IS NOT NULL THEN RAISE(ABORT, 'account_deleted')
    WHEN (SELECT archived_at FROM accounts WHERE id = NEW.account_id) IS NOT NULL THEN RAISE(ABORT, 'account_archived')
    WHEN (SELECT is_placeholder FROM accounts WHERE id = NEW.account_id) = 1 THEN RAISE(ABORT, 'account_placeholder')
    WHEN NOT EXISTS (SELECT 1 FROM settings WHERE key = 'base_currency') THEN RAISE(ABORT, 'base_currency_missing')
    WHEN (SELECT a.currency_id FROM accounts a WHERE a.id = NEW.account_id)
      = (SELECT c.id FROM currencies c JOIN settings s ON s.value = c.code WHERE s.key = 'base_currency')
      THEN CASE WHEN NEW.base_amount <> NEW.amount OR NEW.rate IS NOT NULL THEN RAISE(ABORT, 'line_base_mismatch') END
    WHEN NEW.rate IS NULL THEN RAISE(ABORT, 'line_rate_required')
  END;
END;

CREATE TRIGGER lines_update BEFORE UPDATE ON lines
WHEN NOT (
  OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
  AND (SELECT deleted_at FROM entries WHERE id = OLD.entry_id) IS NOT NULL
)
BEGIN
  SELECT CASE
    WHEN OLD.deleted_at IS NOT NULL THEN RAISE(ABORT, 'row_deleted')
    WHEN NOT EXISTS (SELECT 1 FROM entries WHERE id = OLD.entry_id AND state = 'draft' AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'entry_not_draft')
    WHEN NEW.entry_id IS NOT OLD.entry_id THEN RAISE(ABORT, 'line_entry_fixed')
    WHEN NEW.entry_date IS NOT (SELECT entry_date FROM entries WHERE id = NEW.entry_id)
      THEN RAISE(ABORT, 'line_date_mismatch')
    WHEN NEW.account_id IS NOT OLD.account_id
      AND (SELECT deleted_at FROM accounts WHERE id = NEW.account_id) IS NOT NULL THEN RAISE(ABORT, 'account_deleted')
    WHEN NEW.account_id IS NOT OLD.account_id
      AND (SELECT archived_at FROM accounts WHERE id = NEW.account_id) IS NOT NULL THEN RAISE(ABORT, 'account_archived')
    WHEN NEW.account_id IS NOT OLD.account_id
      AND (SELECT is_placeholder FROM accounts WHERE id = NEW.account_id) = 1 THEN RAISE(ABORT, 'account_placeholder')
    WHEN (SELECT a.currency_id FROM accounts a WHERE a.id = NEW.account_id)
      = (SELECT c.id FROM currencies c JOIN settings s ON s.value = c.code WHERE s.key = 'base_currency')
      THEN CASE WHEN NEW.base_amount <> NEW.amount OR NEW.rate IS NOT NULL THEN RAISE(ABORT, 'line_base_mismatch') END
    WHEN NEW.rate IS NULL THEN RAISE(ABORT, 'line_rate_required')
  END;
END;

CREATE TRIGGER actors_insert_role BEFORE INSERT ON actors
BEGIN
  SELECT CASE
    WHEN NEW.kind = 'user' AND NEW.role IS NULL THEN RAISE(ABORT, 'member_role_missing')
    WHEN NEW.kind <> 'user' AND NEW.role IS NOT NULL THEN RAISE(ABORT, 'actor_role_invalid')
    WHEN (SELECT role FROM actors WHERE id = NEW.created_by) = 'member' THEN RAISE(ABORT, 'admin_only')
  END;
END;

CREATE TRIGGER actors_update_role BEFORE UPDATE ON actors
BEGIN
  SELECT CASE
    WHEN NEW.kind IS NOT OLD.kind THEN RAISE(ABORT, 'actor_kind_fixed')
    WHEN OLD.kind = 'user' AND NEW.role IS NULL THEN RAISE(ABORT, 'member_role_missing')
    WHEN (SELECT role FROM actors WHERE id = NEW.updated_by) = 'member'
      AND (NEW.id <> NEW.updated_by OR NEW.role IS NOT OLD.role OR NEW.deleted_at IS NOT OLD.deleted_at)
      THEN RAISE(ABORT, 'admin_only')
  END;
END;

CREATE TRIGGER actors_last_admin AFTER UPDATE OF role, deleted_at ON actors
WHEN OLD.role = 'admin'
  AND NOT EXISTS (SELECT 1 FROM actors WHERE role = 'admin' AND deleted_at IS NULL)
BEGIN SELECT RAISE(ABORT, 'last_admin'); END;

CREATE TRIGGER entries_owner BEFORE UPDATE ON entries
WHEN NEW.updated_by IS NOT OLD.created_by
  AND (SELECT role FROM actors WHERE id = NEW.updated_by) = 'member'
BEGIN SELECT RAISE(ABORT, 'entry_not_owner'); END;

CREATE TRIGGER settings_no_delete BEFORE DELETE ON settings BEGIN SELECT RAISE(ABORT, 'no_delete'); END;

CREATE TRIGGER fx_rates_no_delete BEFORE DELETE ON fx_rates BEGIN SELECT RAISE(ABORT, 'no_delete'); END;

CREATE TRIGGER fx_rates_deleted BEFORE UPDATE ON fx_rates WHEN OLD.deleted_at IS NOT NULL BEGIN SELECT RAISE(ABORT, 'row_deleted'); END;

CREATE TRIGGER settings_insert BEFORE INSERT ON settings
WHEN NEW.key = 'base_currency' AND NOT EXISTS (SELECT 1 FROM currencies WHERE code = NEW.value)
BEGIN SELECT RAISE(ABORT, 'currency_unknown'); END;

CREATE TRIGGER settings_update BEFORE UPDATE ON settings
BEGIN
  SELECT CASE
    WHEN NEW.key IS NOT OLD.key THEN RAISE(ABORT, 'setting_key_fixed')
    WHEN OLD.key = 'base_currency' AND NEW.value IS NOT OLD.value THEN RAISE(ABORT, 'base_currency_fixed')
    WHEN NEW.deleted_at IS NOT NULL THEN RAISE(ABORT, 'no_delete')
  END;
END;

CREATE TRIGGER settings_admin BEFORE UPDATE ON settings
WHEN (SELECT role FROM actors WHERE id = NEW.updated_by) = 'member'
BEGIN SELECT RAISE(ABORT, 'admin_only'); END;

CREATE TRIGGER actors_audit_insert AFTER INSERT ON actors BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('actors', NEW.id, 'insert',
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'kind', NEW.kind,
    'name', NEW.name,
    'role', NEW.role,
    'color', NEW.color
  ), NEW.updated_by);
END;

CREATE TRIGGER actors_audit_update AFTER UPDATE ON actors BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('actors', NEW.id, CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
  json_object(
    'id', OLD.id,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'created_by', OLD.created_by,
    'updated_by', OLD.updated_by,
    'deleted_at', OLD.deleted_at,
    'deleted_by', OLD.deleted_by,
    'kind', OLD.kind,
    'name', OLD.name,
    'role', OLD.role,
    'color', OLD.color
  ),
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'kind', NEW.kind,
    'name', NEW.name,
    'role', NEW.role,
    'color', NEW.color
  ), NEW.updated_by);
END;

CREATE TRIGGER settings_audit_insert AFTER INSERT ON settings BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('settings', NEW.id, 'insert',
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'key', NEW.key,
    'value', NEW.value
  ), NEW.updated_by);
END;

CREATE TRIGGER settings_audit_update AFTER UPDATE ON settings BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('settings', NEW.id, CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
  json_object(
    'id', OLD.id,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'created_by', OLD.created_by,
    'updated_by', OLD.updated_by,
    'deleted_at', OLD.deleted_at,
    'deleted_by', OLD.deleted_by,
    'key', OLD.key,
    'value', OLD.value
  ),
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'key', NEW.key,
    'value', NEW.value
  ), NEW.updated_by);
END;

CREATE TRIGGER fx_rates_audit_insert AFTER INSERT ON fx_rates BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('fx_rates', NEW.id, 'insert',
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'date', NEW.date,
    'currency_id', NEW.currency_id,
    'rate', NEW.rate
  ), NEW.updated_by);
END;

CREATE TRIGGER fx_rates_audit_update AFTER UPDATE ON fx_rates BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('fx_rates', NEW.id, CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
  json_object(
    'id', OLD.id,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'created_by', OLD.created_by,
    'updated_by', OLD.updated_by,
    'deleted_at', OLD.deleted_at,
    'deleted_by', OLD.deleted_by,
    'date', OLD.date,
    'currency_id', OLD.currency_id,
    'rate', OLD.rate
  ),
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'date', NEW.date,
    'currency_id', NEW.currency_id,
    'rate', NEW.rate
  ), NEW.updated_by);
END;

CREATE TRIGGER accounts_audit_insert AFTER INSERT ON accounts BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('accounts', NEW.id, 'insert',
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'parent_id', NEW.parent_id,
    'name', NEW.name,
    'type', NEW.type,
    'currency_id', NEW.currency_id,
    'is_placeholder', NEW.is_placeholder,
    'locked', NEW.locked,
    'system_key', NEW.system_key,
    'archived_at', NEW.archived_at
  ), NEW.updated_by);
END;

CREATE TRIGGER accounts_audit_update AFTER UPDATE ON accounts BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('accounts', NEW.id, CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
  json_object(
    'id', OLD.id,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'created_by', OLD.created_by,
    'updated_by', OLD.updated_by,
    'deleted_at', OLD.deleted_at,
    'deleted_by', OLD.deleted_by,
    'parent_id', OLD.parent_id,
    'name', OLD.name,
    'type', OLD.type,
    'currency_id', OLD.currency_id,
    'is_placeholder', OLD.is_placeholder,
    'locked', OLD.locked,
    'system_key', OLD.system_key,
    'archived_at', OLD.archived_at
  ),
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'parent_id', NEW.parent_id,
    'name', NEW.name,
    'type', NEW.type,
    'currency_id', NEW.currency_id,
    'is_placeholder', NEW.is_placeholder,
    'locked', NEW.locked,
    'system_key', NEW.system_key,
    'archived_at', NEW.archived_at
  ), NEW.updated_by);
END;

CREATE TRIGGER entries_audit_insert AFTER INSERT ON entries BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('entries', NEW.id, 'insert',
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'entry_date', NEW.entry_date,
    'year', NEW.year,
    'number', NEW.number,
    'reference', NEW.reference,
    'description', NEW.description,
    'state', NEW.state
  ), NEW.updated_by);
END;

CREATE TRIGGER entries_audit_update AFTER UPDATE ON entries BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('entries', NEW.id, CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
  json_object(
    'id', OLD.id,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'created_by', OLD.created_by,
    'updated_by', OLD.updated_by,
    'deleted_at', OLD.deleted_at,
    'deleted_by', OLD.deleted_by,
    'entry_date', OLD.entry_date,
    'year', OLD.year,
    'number', OLD.number,
    'reference', OLD.reference,
    'description', OLD.description,
    'state', OLD.state
  ),
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'entry_date', NEW.entry_date,
    'year', NEW.year,
    'number', NEW.number,
    'reference', NEW.reference,
    'description', NEW.description,
    'state', NEW.state
  ), NEW.updated_by);
END;

CREATE TRIGGER lines_audit_insert AFTER INSERT ON lines BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('lines', NEW.id, 'insert',
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'entry_id', NEW.entry_id,
    'account_id', NEW.account_id,
    'entry_date', NEW.entry_date,
    'amount', NEW.amount,
    'base_amount', NEW.base_amount,
    'rate', NEW.rate,
    'memo', NEW.memo,
    'position', NEW.position
  ), NEW.updated_by);
END;

CREATE TRIGGER lines_audit_update AFTER UPDATE ON lines BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('lines', NEW.id, CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
  json_object(
    'id', OLD.id,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'created_by', OLD.created_by,
    'updated_by', OLD.updated_by,
    'deleted_at', OLD.deleted_at,
    'deleted_by', OLD.deleted_by,
    'entry_id', OLD.entry_id,
    'account_id', OLD.account_id,
    'entry_date', OLD.entry_date,
    'amount', OLD.amount,
    'base_amount', OLD.base_amount,
    'rate', OLD.rate,
    'memo', OLD.memo,
    'position', OLD.position
  ),
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'entry_id', NEW.entry_id,
    'account_id', NEW.account_id,
    'entry_date', NEW.entry_date,
    'amount', NEW.amount,
    'base_amount', NEW.base_amount,
    'rate', NEW.rate,
    'memo', NEW.memo,
    'position', NEW.position
  ), NEW.updated_by);
END;

