-- settings and fx_rates lose columns nothing reads: created_at and created_by (audit_log keeps the insert
-- row with its actor) and, for settings, deleted_at (settings are never deleted).
-- Same rebuild as 0005: drop the triggers, copy through a _old table, recreate.

PRAGMA defer_foreign_keys = ON;

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

-- settings
CREATE TABLE settings_old AS SELECT * FROM settings;
DROP TABLE settings;
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  CHECK (key <> 'lock_date' OR value IS NULL OR date(value) IS value),
  CHECK (key <> 'activity_log_days' OR value IS NULL OR (value NOT GLOB '*[^0-9]*' AND value <> ''))
) STRICT;
INSERT INTO settings (id, updated_at, updated_by, key, value) SELECT id, updated_at, updated_by, key, value FROM settings_old ORDER BY id;
DROP TABLE settings_old;

-- fx_rates
CREATE TABLE fx_rates_old AS SELECT * FROM fx_rates;
DROP TABLE fx_rates;
CREATE TABLE fx_rates (
  id INTEGER PRIMARY KEY,
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  date TEXT NOT NULL CHECK (date(date) IS date),
  currency_id INTEGER NOT NULL REFERENCES currencies (id),
  -- 1 unit of the currency = rate units of the base currency.
  rate TEXT NOT NULL CHECK (
    rate GLOB '[0-9]*' AND rate NOT GLOB '*[^0-9.]*' AND rate NOT GLOB '*.*.*' AND rate NOT GLOB '*.'
    AND CAST(rate AS REAL) > 0
  )
) STRICT;
INSERT INTO fx_rates (id, updated_at, updated_by, deleted_at, date, currency_id, rate) SELECT id, updated_at, updated_by, deleted_at, date, currency_id, rate FROM fx_rates_old ORDER BY id;
DROP TABLE fx_rates_old;
CREATE UNIQUE INDEX fx_rates_currency_date ON fx_rates (currency_id, date) WHERE deleted_at IS NULL;

-- Triggers, unchanged except the audit rows lose the dropped columns.

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
  END;
END;

CREATE TRIGGER settings_audit_insert AFTER INSERT ON settings BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('settings', NEW.id, 'insert', json_object(
    'updated_at', NEW.updated_at, 'updated_by', NEW.updated_by, 'key', NEW.key, 'value', NEW.value
  ), NEW.updated_by);
END;

CREATE TRIGGER settings_audit_update AFTER UPDATE ON settings BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('settings', NEW.id, 'update', json_object(
    'updated_at', OLD.updated_at, 'updated_by', OLD.updated_by, 'key', OLD.key, 'value', OLD.value
  ), json_object(
    'updated_at', NEW.updated_at, 'updated_by', NEW.updated_by, 'key', NEW.key, 'value', NEW.value
  ), NEW.updated_by);
END;

CREATE TRIGGER fx_rates_audit_insert AFTER INSERT ON fx_rates BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('fx_rates', NEW.id, 'insert', json_object(
    'updated_at', NEW.updated_at, 'updated_by', NEW.updated_by, 'deleted_at', NEW.deleted_at, 'date', NEW.date, 'currency_id', NEW.currency_id,
    'rate', NEW.rate
  ), NEW.updated_by);
END;

CREATE TRIGGER fx_rates_audit_update AFTER UPDATE ON fx_rates BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('fx_rates', NEW.id, CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
  json_object(
    'updated_at', OLD.updated_at, 'updated_by', OLD.updated_by, 'deleted_at', OLD.deleted_at, 'date', OLD.date, 'currency_id', OLD.currency_id,
    'rate', OLD.rate
  ), json_object(
    'updated_at', NEW.updated_at, 'updated_by', NEW.updated_by, 'deleted_at', NEW.deleted_at, 'date', NEW.date, 'currency_id', NEW.currency_id,
    'rate', NEW.rate
  ), NEW.updated_by);
END;

CREATE TRIGGER settings_admin BEFORE UPDATE ON settings
WHEN (SELECT role FROM actors WHERE id = NEW.updated_by) = 'member'
BEGIN SELECT RAISE(ABORT, 'admin_only'); END;

