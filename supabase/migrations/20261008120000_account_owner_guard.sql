-- An account with lines keeps its owner: lines were checked against the owner when they were posted
-- (journal_lines_check), so changing the owner afterwards would break that rule.
CREATE OR REPLACE FUNCTION accounts_check_used() RETURNS trigger AS $$
BEGIN
    IF (NEW.type <> OLD.type OR NEW.currency IS DISTINCT FROM OLD.currency
        OR NEW.owner_member_id IS DISTINCT FROM OLD.owner_member_id
        OR (NEW.is_placeholder AND NOT OLD.is_placeholder))
       AND EXISTS (SELECT 1 FROM journal_lines WHERE account_id = NEW.id) THEN
        RAISE EXCEPTION 'account has records' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER accounts_used_chk ON accounts;
CREATE TRIGGER accounts_used_chk
    BEFORE UPDATE OF type, currency, owner_member_id, is_placeholder ON accounts
    FOR EACH ROW EXECUTE FUNCTION accounts_check_used();
