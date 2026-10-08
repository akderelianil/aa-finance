-- Who may change whose journal entries. Everyone in a group reads every entry; the owner (journal_entries.member_id)
-- and the group admin always edit and delete. The admin can give another member more rights on one member's entries:
-- 'edit' = edit, 'delete' = edit and delete. No row = view only. Enforced by journal-post (direct connection).
CREATE TABLE member_access (
    group_id         uuid NOT NULL REFERENCES groups(id),
    member_id        uuid NOT NULL,   -- who gets the right
    target_member_id uuid NOT NULL,   -- whose entries it applies to
    level            text NOT NULL CHECK (level IN ('edit', 'delete')),
    PRIMARY KEY (member_id, target_member_id),
    FOREIGN KEY (member_id, group_id) REFERENCES members(id, group_id),
    FOREIGN KEY (target_member_id, group_id) REFERENCES members(id, group_id),
    CHECK (member_id <> target_member_id)
);
CREATE INDEX member_access_group_idx ON member_access (group_id);

ALTER TABLE member_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_access_select ON member_access FOR SELECT TO authenticated
    USING ((SELECT is_group_member(group_id)));
GRANT SELECT ON member_access TO authenticated;
CREATE TRIGGER member_access_audit AFTER INSERT OR UPDATE OR DELETE ON member_access
    FOR EACH ROW EXECUTE FUNCTION audit_row();

-- Revert 20261008120000: the account owner is a label only (docs/ARCHITECTURE.md), so changing it on an
-- account with lines breaks no rule. Back to the guard on type, currency and placeholder.
CREATE OR REPLACE FUNCTION accounts_check_used() RETURNS trigger AS $$
BEGIN
    IF (NEW.type <> OLD.type OR NEW.currency IS DISTINCT FROM OLD.currency OR (NEW.is_placeholder AND NOT OLD.is_placeholder))
       AND EXISTS (SELECT 1 FROM journal_lines WHERE account_id = NEW.id) THEN
        RAISE EXCEPTION 'account has records' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER accounts_used_chk ON accounts;
CREATE TRIGGER accounts_used_chk
    BEFORE UPDATE OF type, currency, is_placeholder ON accounts
    FOR EACH ROW EXECUTE FUNCTION accounts_check_used();
