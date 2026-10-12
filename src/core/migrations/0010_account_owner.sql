-- An account may belong to one member (a personal wallet). No owner means shared by the family.
-- Reports and lists filter by it: Aile (all), one Kişi (their accounts), Ortak (no owner).
ALTER TABLE accounts ADD COLUMN owner_id INTEGER REFERENCES actors (id);
CREATE INDEX accounts_owner ON accounts (owner_id) WHERE owner_id IS NOT NULL AND deleted_at IS NULL;

-- The owner must be a live member.
CREATE TRIGGER accounts_owner_insert BEFORE INSERT ON accounts
WHEN NEW.owner_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.owner_id AND kind = 'user' AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'member_not_found')
  END;
END;

CREATE TRIGGER accounts_owner_update BEFORE UPDATE OF owner_id ON accounts
WHEN NEW.owner_id IS NOT NULL AND NEW.owner_id IS NOT OLD.owner_id
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.owner_id AND kind = 'user' AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'member_not_found')
  END;
END;

-- The audit rows now carry owner_id.
DROP TRIGGER accounts_audit_insert;
DROP TRIGGER accounts_audit_update;

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
    'archived_at', NEW.archived_at,
    'owner_id', NEW.owner_id
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
    'archived_at', OLD.archived_at,
    'owner_id', OLD.owner_id
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
    'archived_at', NEW.archived_at,
    'owner_id', NEW.owner_id
  ), NEW.updated_by);
END;
