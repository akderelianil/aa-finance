-- Book settings (language, lock date, log days, group name, country) are admin only.
CREATE TRIGGER settings_admin BEFORE UPDATE ON settings
WHEN (SELECT role FROM actors WHERE id = NEW.updated_by) = 'member'
BEGIN SELECT RAISE(ABORT, 'admin_only'); END;
