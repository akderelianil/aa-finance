-- Permission triggers also ignore a removed (soft-deleted) actor: a removed admin or member keeps no power.
-- 0013 is left as it was; these triggers replace its eight permission triggers.
DROP TRIGGER accounts_permission_insert;
DROP TRIGGER accounts_permission_update;
DROP TRIGGER fx_rates_permission_insert;
DROP TRIGGER fx_rates_permission_update;
DROP TRIGGER contacts_permission_insert;
DROP TRIGGER contacts_permission_update;
DROP TRIGGER brand_businesses_permission_insert;
DROP TRIGGER brand_businesses_permission_update;

CREATE TRIGGER accounts_permission_insert BEFORE INSERT ON accounts
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.created_by AND deleted_at IS NULL AND (kind <> 'user' OR role = 'admin' OR can_manage_accounts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER accounts_permission_update BEFORE UPDATE ON accounts
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.updated_by AND deleted_at IS NULL AND (kind <> 'user' OR role = 'admin' OR can_manage_accounts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER fx_rates_permission_insert BEFORE INSERT ON fx_rates
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.created_by AND deleted_at IS NULL AND (kind <> 'user' OR role = 'admin' OR can_manage_rates = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER fx_rates_permission_update BEFORE UPDATE ON fx_rates
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.updated_by AND deleted_at IS NULL AND (kind <> 'user' OR role = 'admin' OR can_manage_rates = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER contacts_permission_insert BEFORE INSERT ON contacts
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.created_by AND deleted_at IS NULL AND (kind <> 'user' OR role = 'admin' OR can_manage_contacts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER contacts_permission_update BEFORE UPDATE ON contacts
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.updated_by AND deleted_at IS NULL AND (kind <> 'user' OR role = 'admin' OR can_manage_contacts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER brand_businesses_permission_insert BEFORE INSERT ON brand_businesses
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.created_by AND deleted_at IS NULL AND (kind <> 'user' OR role = 'admin' OR can_manage_contacts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;

CREATE TRIGGER brand_businesses_permission_update BEFORE UPDATE ON brand_businesses
WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.updated_by AND deleted_at IS NULL AND (kind <> 'user' OR role = 'admin' OR can_manage_contacts = 1))
BEGIN SELECT RAISE(ABORT, 'permission_denied'); END;
