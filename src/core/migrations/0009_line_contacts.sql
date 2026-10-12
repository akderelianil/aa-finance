-- A line may point to a Rehber record (who the debt is with). Nullable: most lines have none.
ALTER TABLE lines ADD COLUMN contact_id INTEGER REFERENCES contacts (id);
CREATE INDEX lines_contact ON lines (contact_id) WHERE contact_id IS NOT NULL AND deleted_at IS NULL;

-- The contact must be live when the line is written.
CREATE TRIGGER lines_contact_insert BEFORE INSERT ON lines
WHEN NEW.contact_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM contacts WHERE id = NEW.contact_id AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'contact_deleted')
  END;
END;

-- A contact with entry lines cannot be removed (the history would lose its name).
CREATE TRIGGER contacts_has_lines BEFORE UPDATE OF deleted_at ON contacts
WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM lines WHERE contact_id = OLD.id AND deleted_at IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'contact_has_lines');
END;

-- The audit rows now carry contact_id.
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
    'contact_id', NEW.contact_id
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
    'contact_id', OLD.contact_id
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
    'contact_id', NEW.contact_id
  ), NEW.updated_by);
END;
