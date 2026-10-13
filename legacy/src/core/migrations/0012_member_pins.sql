-- PIN gate: one live row per member that has a PIN. No row = "PIN not set" (every member before this migration).
-- App gate, not encryption: the file stays readable by anyone who can open it. The hash lives in its own table
-- and has no audit trigger, so it never enters audit_log JSON. A reset soft-deletes the row (deleted_at/deleted_by);
-- the next first-time set inserts a new row. failed_count and wait_until survive a restart.
CREATE TABLE member_pins (
  id INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
  created_by INTEGER NOT NULL REFERENCES actors (id),
  updated_by INTEGER NOT NULL REFERENCES actors (id),
  deleted_at INTEGER,
  deleted_by INTEGER REFERENCES actors (id),
  member_id INTEGER NOT NULL REFERENCES actors (id),
  -- PBKDF2-SHA256: hash and salt as hex, iterations kept per row so the cost can rise later.
  hash TEXT NOT NULL CHECK (hash <> ''),
  salt TEXT NOT NULL CHECK (salt <> ''),
  iterations INTEGER NOT NULL CHECK (iterations > 0),
  -- Wrong tries since the last good PIN or the last wait; wait_until is epoch ms (NULL = no wait).
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  wait_until INTEGER,
  CHECK ((deleted_at IS NULL) = (deleted_by IS NULL))
) STRICT;

CREATE UNIQUE INDEX member_pins_member ON member_pins (member_id) WHERE deleted_at IS NULL;

CREATE TRIGGER member_pins_no_delete BEFORE DELETE ON member_pins BEGIN SELECT RAISE(ABORT, 'no_delete'); END;

-- Only a user actor can hold a PIN.
CREATE TRIGGER member_pins_insert BEFORE INSERT ON member_pins
BEGIN
  SELECT CASE
    WHEN NEW.deleted_at IS NOT NULL THEN RAISE(ABORT, 'row_deleted')
    WHEN NOT EXISTS (SELECT 1 FROM actors WHERE id = NEW.member_id AND kind = 'user' AND deleted_at IS NULL)
      THEN RAISE(ABORT, 'member_not_found')
  END;
END;

CREATE TRIGGER member_pins_update BEFORE UPDATE ON member_pins
BEGIN
  SELECT CASE
    WHEN NEW.member_id <> OLD.member_id THEN RAISE(ABORT, 'row_deleted')
    WHEN OLD.deleted_at IS NOT NULL THEN RAISE(ABORT, 'row_deleted')
  END;
END;
