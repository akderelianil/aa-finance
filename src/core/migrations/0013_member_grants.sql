-- Grants: the admin decides which members may change shared data. Default 0 (none); an admin always may.
-- can_manage_accounts: accounts. can_manage_rates: exchange rates. can_manage_contacts: contacts and their links.
-- Only an admin changes these columns (trigger admin_only), and audit_log records every change.
ALTER TABLE actors ADD COLUMN can_manage_accounts INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_accounts IN (0, 1));
ALTER TABLE actors ADD COLUMN can_manage_rates INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_rates IN (0, 1));
ALTER TABLE actors ADD COLUMN can_manage_contacts INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_contacts IN (0, 1));

DROP TRIGGER actors_update_role;
CREATE TRIGGER actors_update_role BEFORE UPDATE ON actors
BEGIN
  SELECT CASE
    WHEN NEW.kind IS NOT OLD.kind THEN RAISE(ABORT, 'actor_kind_fixed')
    WHEN OLD.kind = 'user' AND NEW.role IS NULL THEN RAISE(ABORT, 'member_role_missing')
    WHEN (SELECT role FROM actors WHERE id = NEW.updated_by) = 'member'
      AND (NEW.id <> NEW.updated_by OR NEW.role IS NOT OLD.role OR NEW.deleted_at IS NOT OLD.deleted_at
        OR NEW.can_manage_accounts IS NOT OLD.can_manage_accounts
        OR NEW.can_manage_rates IS NOT OLD.can_manage_rates
        OR NEW.can_manage_contacts IS NOT OLD.can_manage_contacts)
      THEN RAISE(ABORT, 'admin_only')
  END;
END;

DROP TRIGGER actors_audit_insert;
DROP TRIGGER actors_audit_update;
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
    'color', NEW.color,
    'can_manage_accounts', NEW.can_manage_accounts,
    'can_manage_rates', NEW.can_manage_rates,
    'can_manage_contacts', NEW.can_manage_contacts
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
    'color', OLD.color,
    'can_manage_accounts', OLD.can_manage_accounts,
    'can_manage_rates', OLD.can_manage_rates,
    'can_manage_contacts', OLD.can_manage_contacts
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
    'color', NEW.color,
    'can_manage_accounts', NEW.can_manage_accounts,
    'can_manage_rates', NEW.can_manage_rates,
    'can_manage_contacts', NEW.can_manage_contacts
  ), NEW.updated_by);
END;

CREATE TRIGGER accounts_permission_insert BEFORE INSERT ON accounts
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.created_by AND (kind <> 'user' OR role = 'admin' OR can_manage_accounts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER accounts_permission_update BEFORE UPDATE ON accounts
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.updated_by AND (kind <> 'user' OR role = 'admin' OR can_manage_accounts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER fx_rates_permission_insert BEFORE INSERT ON fx_rates
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.created_by AND (kind <> 'user' OR role = 'admin' OR can_manage_rates = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER fx_rates_permission_update BEFORE UPDATE ON fx_rates
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.updated_by AND (kind <> 'user' OR role = 'admin' OR can_manage_rates = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER contacts_permission_insert BEFORE INSERT ON contacts
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.created_by AND (kind <> 'user' OR role = 'admin' OR can_manage_contacts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER contacts_permission_update BEFORE UPDATE ON contacts
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.updated_by AND (kind <> 'user' OR role = 'admin' OR can_manage_contacts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER brand_businesses_permission_insert BEFORE INSERT ON brand_businesses
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.created_by AND (kind <> 'user' OR role = 'admin' OR can_manage_contacts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER brand_businesses_permission_update BEFORE UPDATE ON brand_businesses
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.updated_by AND (kind <> 'user' OR role = 'admin' OR can_manage_contacts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;
