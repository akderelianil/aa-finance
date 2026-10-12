-- Members: one file is one group. A user actor is a member with a role and a profile color.
-- Rules: at least one admin; a member changes only own name and color; only an admin adds members;
-- a member updates (edits, deletes) only own entries, an admin all.

ALTER TABLE actors ADD COLUMN role TEXT CHECK (role IN ('admin', 'member'));
ALTER TABLE actors ADD COLUMN color TEXT CHECK (color IS NULL OR (length(color) BETWEEN 1 AND 20));

-- Existing files: the first user is the admin, other users are members.
UPDATE actors SET role = CASE WHEN id = (SELECT min(id) FROM actors WHERE kind = 'user') THEN 'admin' ELSE 'member' END
WHERE kind = 'user';

-- Existing files: group name from the profile name, no country.
INSERT INTO settings (uid, created_by, updated_by, key, value)
SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-7' || substr(hex(randomblob(2)), 2) || '-8'
         || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
       a.id, a.id, k.key, CASE k.key WHEN 'group_name' THEN a.name END
FROM (SELECT id, name FROM actors WHERE kind = 'user' ORDER BY id LIMIT 1) a
JOIN (SELECT 'group_name' AS key UNION ALL SELECT 'country') k;

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

-- Audit the new columns too.
DROP TRIGGER actors_audit_insert;
DROP TRIGGER actors_audit_update;

CREATE TRIGGER actors_audit_insert AFTER INSERT ON actors BEGIN
  INSERT INTO audit_log (table_name, row_id, op, new, actor_id)
  VALUES ('actors', NEW.id, 'insert', json_object(
    'uid', NEW.uid, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'created_by', NEW.created_by,
    'updated_by', NEW.updated_by, 'deleted_at', NEW.deleted_at, 'kind', NEW.kind, 'name', NEW.name,
    'role', NEW.role, 'color', NEW.color
  ), NEW.updated_by);
END;

CREATE TRIGGER actors_audit_update AFTER UPDATE ON actors BEGIN
  INSERT INTO audit_log (table_name, row_id, op, old, new, actor_id)
  VALUES ('actors', NEW.id, CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete' ELSE 'update' END,
  json_object(
    'uid', OLD.uid, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'created_by', OLD.created_by,
    'updated_by', OLD.updated_by, 'deleted_at', OLD.deleted_at, 'kind', OLD.kind, 'name', OLD.name,
    'role', OLD.role, 'color', OLD.color
  ), json_object(
    'uid', NEW.uid, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at, 'created_by', NEW.created_by,
    'updated_by', NEW.updated_by, 'deleted_at', NEW.deleted_at, 'kind', NEW.kind, 'name', NEW.name,
    'role', NEW.role, 'color', NEW.color
  ), NEW.updated_by);
END;
