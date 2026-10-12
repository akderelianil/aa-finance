-- Rehber (Directory): contacts and the many-to-many link between brands and businesses.
-- kind: individual = Kişi, brand = Marka, business = Firma. A business owns many brands; a brand belongs to
-- many businesses. Only brand <-> business links exist. A contact may suggest an income and an expense account.
-- Same audit columns and rules as the other tables: rows are never deleted, deleted_at/deleted_by mark a soft delete.

CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  created_by INTEGER NOT NULL REFERENCES actors (id),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES actors (id),
  kind TEXT NOT NULL CHECK (kind IN ('individual', 'brand', 'business')),
  name TEXT NOT NULL CHECK (trim(name) <> ''),
  default_income_account_id INTEGER REFERENCES accounts (id),
  default_expense_account_id INTEGER REFERENCES accounts (id),
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
) STRICT;

-- One name once in the Rehber, whatever the kind.
CREATE UNIQUE INDEX contacts_name ON contacts (lower(name)) WHERE deleted_at IS NULL;

CREATE TABLE brand_businesses (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  created_by INTEGER NOT NULL REFERENCES actors (id),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES actors (id),
  brand_id INTEGER NOT NULL REFERENCES contacts (id),
  business_id INTEGER NOT NULL REFERENCES contacts (id),
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
) STRICT;

CREATE UNIQUE INDEX brand_businesses_pair ON brand_businesses (brand_id, business_id) WHERE deleted_at IS NULL;
CREATE INDEX brand_businesses_business ON brand_businesses (business_id) WHERE deleted_at IS NULL;

CREATE TRIGGER contacts_no_delete BEFORE DELETE ON contacts BEGIN SELECT RAISE(ABORT, 'no_delete'); END;
CREATE TRIGGER brand_businesses_no_delete BEFORE DELETE ON brand_businesses BEGIN SELECT RAISE(ABORT, 'no_delete'); END;

-- The default accounts take lines: an income account and an expense account, no group, not archived or deleted.
CREATE TRIGGER contacts_insert BEFORE INSERT ON contacts
BEGIN
  SELECT CASE
    WHEN NEW.deleted_at IS NOT NULL THEN RAISE(ABORT, 'contact_insert_deleted')
    WHEN NEW.default_income_account_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM accounts WHERE id = NEW.default_income_account_id AND type = 'income'
        AND is_placeholder = 0 AND archived_at IS NULL AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'contact_account_type')
    WHEN NEW.default_expense_account_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM accounts WHERE id = NEW.default_expense_account_id AND type = 'expense'
        AND is_placeholder = 0 AND archived_at IS NULL AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'contact_account_type')
  END;
END;

CREATE TRIGGER contacts_update BEFORE UPDATE ON contacts
BEGIN
  SELECT CASE
    WHEN OLD.deleted_at IS NOT NULL THEN RAISE(ABORT, 'row_deleted')
    WHEN NEW.kind IS NOT OLD.kind THEN RAISE(ABORT, 'contact_kind_fixed')
    WHEN NEW.default_income_account_id IS NOT OLD.default_income_account_id
      AND NEW.default_income_account_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM accounts WHERE id = NEW.default_income_account_id AND type = 'income'
        AND is_placeholder = 0 AND archived_at IS NULL AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'contact_account_type')
    WHEN NEW.default_expense_account_id IS NOT OLD.default_expense_account_id
      AND NEW.default_expense_account_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM accounts WHERE id = NEW.default_expense_account_id AND type = 'expense'
        AND is_placeholder = 0 AND archived_at IS NULL AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'contact_account_type')
  END;
END;

-- A removed contact takes its links with it.
CREATE TRIGGER contacts_soft_delete AFTER UPDATE OF deleted_at ON contacts
WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
BEGIN
  UPDATE brand_businesses
  SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by, updated_at = NEW.updated_at, updated_by = NEW.updated_by
  WHERE (brand_id = NEW.id OR business_id = NEW.id) AND deleted_at IS NULL;
END;

CREATE TRIGGER brand_businesses_insert BEFORE INSERT ON brand_businesses
BEGIN
  SELECT CASE
    WHEN NEW.deleted_at IS NOT NULL THEN RAISE(ABORT, 'contact_insert_deleted')
    WHEN NOT EXISTS (SELECT 1 FROM contacts WHERE id = NEW.brand_id AND kind = 'brand' AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'contact_link_kind')
    WHEN NOT EXISTS (SELECT 1 FROM contacts WHERE id = NEW.business_id AND kind = 'business' AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'contact_link_kind')
  END;
END;

CREATE TRIGGER brand_businesses_update BEFORE UPDATE ON brand_businesses
BEGIN
  SELECT CASE
    WHEN OLD.deleted_at IS NOT NULL THEN RAISE(ABORT, 'row_deleted')
    WHEN NEW.brand_id IS NOT OLD.brand_id OR NEW.business_id IS NOT OLD.business_id THEN RAISE(ABORT, 'contact_link_fixed')
  END;
END;

CREATE TRIGGER contacts_audit_insert AFTER INSERT ON contacts BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('contacts', NEW.id, 'insert',
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
    'default_income_account_id', NEW.default_income_account_id,
    'default_expense_account_id', NEW.default_expense_account_id
  ), NEW.updated_by);
END;

CREATE TRIGGER contacts_audit_update AFTER UPDATE ON contacts BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('contacts', NEW.id, CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
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
    'default_income_account_id', OLD.default_income_account_id,
    'default_expense_account_id', OLD.default_expense_account_id
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
    'default_income_account_id', NEW.default_income_account_id,
    'default_expense_account_id', NEW.default_expense_account_id
  ), NEW.updated_by);
END;

CREATE TRIGGER brand_businesses_audit_insert AFTER INSERT ON brand_businesses BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('brand_businesses', NEW.id, 'insert',
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'brand_id', NEW.brand_id,
    'business_id', NEW.business_id
  ), NEW.updated_by);
END;

CREATE TRIGGER brand_businesses_audit_update AFTER UPDATE ON brand_businesses BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('brand_businesses', NEW.id, CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
  json_object(
    'id', OLD.id,
    'created_at', OLD.created_at,
    'updated_at', OLD.updated_at,
    'created_by', OLD.created_by,
    'updated_by', OLD.updated_by,
    'deleted_at', OLD.deleted_at,
    'deleted_by', OLD.deleted_by,
    'brand_id', OLD.brand_id,
    'business_id', OLD.business_id
  ),
  json_object(
    'id', NEW.id,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by,
    'deleted_at', NEW.deleted_at,
    'deleted_by', NEW.deleted_by,
    'brand_id', NEW.brand_id,
    'business_id', NEW.business_id
  ), NEW.updated_by);
END;
