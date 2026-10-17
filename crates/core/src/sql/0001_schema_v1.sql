-- Schema v1 (ADR-0010, ADR-0011, ADR-0012). Revisions are the truth; the projection tables hold the current state.
-- Only the core's projector may write the projection: it opens projection_session inside its own transaction.

CREATE TABLE revision (
  seq INTEGER PRIMARY KEY,
  id BLOB NOT NULL UNIQUE CHECK (length(id) = 16),
  doc_kind TEXT NOT NULL CHECK (doc_kind IN ('commodity', 'account', 'entry', 'settings')),
  doc_id BLOB NOT NULL CHECK (length(doc_id) = 16),
  parent_id BLOB CHECK (parent_id IS NULL OR length(parent_id) = 16),
  author_id BLOB NOT NULL CHECK (length(author_id) = 16),
  created_at_ms INTEGER NOT NULL,
  rules_version INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  core_version TEXT NOT NULL,
  server_seq INTEGER,
  body TEXT NOT NULL CHECK (json_valid(body))
) STRICT;

CREATE INDEX revision_doc ON revision (doc_id, created_at_ms);
CREATE INDEX revision_parent ON revision (parent_id);

CREATE TRIGGER revision_parent_same_doc BEFORE INSERT ON revision
WHEN NEW.parent_id IS NOT NULL
 AND (SELECT doc_id FROM revision WHERE id = NEW.parent_id) IS NOT NEW.doc_id
BEGIN SELECT RAISE(ABORT, 'revision_parent_mismatch'); END;

-- All revisions of one document have one kind (an account never becomes an entry).
CREATE TRIGGER revision_kind_consistent BEFORE INSERT ON revision
WHEN EXISTS (SELECT 1 FROM revision WHERE doc_id = NEW.doc_id AND doc_kind <> NEW.doc_kind)
BEGIN SELECT RAISE(ABORT, 'revision_kind_mismatch'); END;

CREATE TRIGGER revision_immutable BEFORE UPDATE ON revision
WHEN NEW.seq IS NOT OLD.seq OR NEW.id IS NOT OLD.id OR NEW.doc_kind IS NOT OLD.doc_kind
  OR NEW.doc_id IS NOT OLD.doc_id OR NEW.parent_id IS NOT OLD.parent_id OR NEW.author_id IS NOT OLD.author_id
  OR NEW.created_at_ms IS NOT OLD.created_at_ms OR NEW.rules_version IS NOT OLD.rules_version
  OR NEW.schema_version IS NOT OLD.schema_version OR NEW.core_version IS NOT OLD.core_version
  OR NEW.body IS NOT OLD.body OR OLD.server_seq IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'revision_immutable'); END;

-- INSERT OR REPLACE removes the old row without firing delete triggers, so a repeated id or seq is refused here.
CREATE TRIGGER revision_no_overwrite BEFORE INSERT ON revision
WHEN EXISTS (SELECT 1 FROM revision WHERE id = NEW.id)
  OR (NEW.seq IS NOT NULL AND EXISTS (SELECT 1 FROM revision WHERE seq = NEW.seq))
BEGIN SELECT RAISE(ABORT, 'revision_immutable'); END;

CREATE TRIGGER revision_no_delete BEFORE DELETE ON revision
BEGIN SELECT RAISE(ABORT, 'revision_immutable'); END;

-- open: the projector is writing. carry: the line being inserted was already in the previous head of its entry.
CREATE TABLE projection_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  open INTEGER NOT NULL CHECK (open IN (0, 1)),
  carry INTEGER NOT NULL CHECK (carry IN (0, 1))
) STRICT;
INSERT INTO projection_session (id, open, carry) VALUES (1, 0, 0);

CREATE TRIGGER projection_session_no_delete BEFORE DELETE ON projection_session
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER projection_session_no_insert BEFORE INSERT ON projection_session
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TABLE commodity (
  id INTEGER PRIMARY KEY,
  uuid BLOB NOT NULL UNIQUE CHECK (length(uuid) = 16),
  current_revision_id BLOB NOT NULL REFERENCES revision (id),
  code TEXT NOT NULL UNIQUE,
  scale INTEGER NOT NULL CHECK (scale BETWEEN 0 AND 18)
) STRICT;

CREATE TABLE account (
  id INTEGER PRIMARY KEY,
  uuid BLOB NOT NULL UNIQUE CHECK (length(uuid) = 16),
  current_revision_id BLOB NOT NULL REFERENCES revision (id),
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES account (id),
  kind TEXT NOT NULL CHECK (kind IN ('asset', 'liability', 'equity', 'income', 'expense')),
  commodity_id INTEGER NOT NULL REFERENCES commodity (id),
  archived INTEGER NOT NULL CHECK (archived IN (0, 1)),
  locked INTEGER NOT NULL CHECK (locked IN (0, 1)),
  system_key TEXT UNIQUE CHECK (system_key IS NULL OR system_key <> '')
) STRICT;

CREATE TABLE entry (
  id INTEGER PRIMARY KEY,
  uuid BLOB NOT NULL UNIQUE CHECK (length(uuid) = 16),
  current_revision_id BLOB NOT NULL REFERENCES revision (id),
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(date) IS date),
  memo TEXT,
  no TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'posted', 'deleted'))
) STRICT;

CREATE INDEX entry_date ON entry (date, id);

CREATE TABLE line (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES entry (id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  account_id INTEGER NOT NULL REFERENCES account (id),
  commodity_id INTEGER NOT NULL REFERENCES commodity (id),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN -4611686018427387904 AND 4611686018427387904),
  base_value INTEGER NOT NULL CHECK (base_value BETWEEN -4611686018427387904 AND 4611686018427387904),
  CONSTRAINT line_not_empty CHECK (quantity <> 0 OR base_value <> 0),
  CONSTRAINT line_base_sign CHECK ((quantity >= 0 AND base_value >= 0) OR (quantity <= 0 AND base_value <= 0)),
  UNIQUE (entry_id, line_no)
) STRICT;

CREATE INDEX line_account ON line (account_id, commodity_id, quantity, base_value);

CREATE TRIGGER commodity_insert_gate BEFORE INSERT ON commodity
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER commodity_update_gate BEFORE UPDATE ON commodity
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER commodity_delete_gate BEFORE DELETE ON commodity
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

-- The one row of the settings document (a fixed document id). Only fields that a rule or a query
-- needs are columns; the rest of the settings stay in the revision body.
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  uuid BLOB NOT NULL UNIQUE CHECK (length(uuid) = 16),
  current_revision_id BLOB NOT NULL REFERENCES revision (id),
  base_commodity_id INTEGER NOT NULL REFERENCES commodity (id)
) STRICT;

CREATE TRIGGER settings_insert_gate BEFORE INSERT ON settings
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER settings_update_gate BEFORE UPDATE ON settings
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER settings_delete_gate BEFORE DELETE ON settings
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

-- The base currency is fixed once any entry has a revision, also a draft or a deleted one.
CREATE TRIGGER settings_base_locked BEFORE UPDATE OF base_commodity_id ON settings
WHEN NEW.base_commodity_id <> OLD.base_commodity_id
  AND EXISTS (SELECT 1 FROM revision WHERE doc_kind = 'entry')
BEGIN SELECT RAISE(ABORT, 'base_currency_locked'); END;

CREATE TRIGGER account_insert_gate BEFORE INSERT ON account
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER account_update_gate BEFORE UPDATE ON account
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER account_delete_gate BEFORE DELETE ON account
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER entry_insert_gate BEFORE INSERT ON entry
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER entry_update_gate BEFORE UPDATE ON entry
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER entry_delete_gate BEFORE DELETE ON entry
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER line_insert_gate BEFORE INSERT ON line
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER line_update_gate BEFORE UPDATE ON line
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

CREATE TRIGGER line_delete_gate BEFORE DELETE ON line
WHEN (SELECT open FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'projection_closed'); END;

-- Invariants. A posted entry has at least two lines and sums to exactly zero on base_value (no tolerance).
CREATE TRIGGER entry_posted_balances BEFORE UPDATE OF status ON entry
WHEN NEW.status = 'posted' AND OLD.status <> 'posted'
BEGIN
  SELECT RAISE(ABORT, 'entry_too_few_lines') WHERE (SELECT count(*) FROM line WHERE entry_id = NEW.id) < 2;
  SELECT RAISE(ABORT, 'entry_unbalanced') WHERE (SELECT sum(base_value) FROM line WHERE entry_id = NEW.id) <> 0;
END;

-- Delete is a status, never a removal: a deleted entry keeps no lines in the projection, so no balance or report sees it.
CREATE TRIGGER entry_deleted_has_no_lines BEFORE UPDATE OF status ON entry
WHEN NEW.status = 'deleted' AND EXISTS (SELECT 1 FROM line WHERE entry_id = NEW.id)
BEGIN SELECT RAISE(ABORT, 'entry_deleted_has_lines'); END;

CREATE TRIGGER line_not_on_deleted_entry BEFORE INSERT ON line
WHEN (SELECT status FROM entry WHERE id = NEW.entry_id) = 'deleted'
BEGIN SELECT RAISE(ABORT, 'entry_deleted_has_lines'); END;

CREATE TRIGGER entry_starts_as_draft BEFORE INSERT ON entry
WHEN NEW.status <> 'draft'
BEGIN SELECT RAISE(ABORT, 'entry_must_start_as_draft'); END;

-- An archived account takes no new use; a line carried over unchanged from the previous head of its entry is allowed.
CREATE TRIGGER line_account_not_archived BEFORE INSERT ON line
WHEN (SELECT archived FROM account WHERE id = NEW.account_id) = 1 AND (SELECT carry FROM projection_session) IS NOT 1
BEGIN SELECT RAISE(ABORT, 'account_archived'); END;

CREATE TRIGGER line_commodity_matches_account BEFORE INSERT ON line
WHEN NEW.commodity_id <> (SELECT commodity_id FROM account WHERE id = NEW.account_id)
BEGIN SELECT RAISE(ABORT, 'line_commodity_mismatch'); END;

-- A locked account (opened by the system, such as Rounding) keeps every field it was opened with.
CREATE TRIGGER account_locked BEFORE UPDATE ON account
WHEN OLD.locked = 1 AND (NEW.name IS NOT OLD.name OR NEW.parent_id IS NOT OLD.parent_id OR NEW.kind IS NOT OLD.kind
  OR NEW.commodity_id IS NOT OLD.commodity_id OR NEW.archived IS NOT OLD.archived OR NEW.locked IS NOT OLD.locked
  OR NEW.system_key IS NOT OLD.system_key)
BEGIN SELECT RAISE(ABORT, 'account_locked'); END;

CREATE TRIGGER account_commodity_locked BEFORE UPDATE OF commodity_id ON account
WHEN NEW.commodity_id <> OLD.commodity_id AND EXISTS (SELECT 1 FROM line WHERE account_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'account_commodity_locked'); END;

-- Lines of a posted entry cannot change on their own: the projector first sets the entry back to draft.
CREATE TRIGGER line_posted_insert AFTER INSERT ON line
WHEN (SELECT status FROM entry WHERE id = NEW.entry_id) = 'posted'
BEGIN
  SELECT RAISE(ABORT, 'entry_too_few_lines') WHERE (SELECT count(*) FROM line WHERE entry_id = NEW.entry_id) < 2;
  SELECT RAISE(ABORT, 'entry_unbalanced') WHERE (SELECT sum(base_value) FROM line WHERE entry_id = NEW.entry_id) <> 0;
END;

CREATE TRIGGER line_posted_update AFTER UPDATE ON line
WHEN (SELECT status FROM entry WHERE id = NEW.entry_id) = 'posted'
BEGIN
  SELECT RAISE(ABORT, 'entry_too_few_lines') WHERE (SELECT count(*) FROM line WHERE entry_id = NEW.entry_id) < 2;
  SELECT RAISE(ABORT, 'entry_unbalanced') WHERE (SELECT sum(base_value) FROM line WHERE entry_id = NEW.entry_id) <> 0;
END;

CREATE TRIGGER line_posted_delete AFTER DELETE ON line
WHEN (SELECT status FROM entry WHERE id = OLD.entry_id) = 'posted'
BEGIN
  SELECT RAISE(ABORT, 'entry_too_few_lines') WHERE (SELECT count(*) FROM line WHERE entry_id = OLD.entry_id) < 2;
  SELECT RAISE(ABORT, 'entry_unbalanced') WHERE (SELECT sum(base_value) FROM line WHERE entry_id = OLD.entry_id) <> 0;
END;

CREATE TRIGGER commodity_scale_locked BEFORE UPDATE OF scale ON commodity
WHEN NEW.scale <> OLD.scale AND EXISTS (SELECT 1 FROM line WHERE commodity_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'commodity_scale_locked'); END;
