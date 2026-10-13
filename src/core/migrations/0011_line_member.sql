-- A line may name the member it belongs to (who paid, whose money went in). Nullable: then the account's
-- owner counts, and with none the line is Ortak. Effective owner = coalesce(lines.member_id, accounts.owner_id).
ALTER TABLE lines ADD COLUMN member_id INTEGER REFERENCES actors (id);
CREATE INDEX lines_member ON lines (member_id) WHERE member_id IS NOT NULL AND deleted_at IS NULL;

-- The member must be live when the line is written.
CREATE TRIGGER lines_member_insert BEFORE INSERT ON lines
WHEN NEW.member_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.member_id AND kind = 'user' AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'member_not_found')
  END;
END;

-- The audit rows now carry member_id.
DROP TRIGGER lines_audit_insert;
DROP TRIGGER lines_audit_update;

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
    'position', NEW.position,
    'contact_id', NEW.contact_id,
    'member_id', NEW.member_id
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
    'position', OLD.position,
    'contact_id', OLD.contact_id,
    'member_id', OLD.member_id
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
    'position', NEW.position,
    'contact_id', NEW.contact_id,
    'member_id', NEW.member_id
  ), NEW.updated_by);
END;
