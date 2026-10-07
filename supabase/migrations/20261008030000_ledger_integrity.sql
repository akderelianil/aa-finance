-- Ledger integrity, modeled on GnuCash (transactions → splits → accounts).
-- GnuCash split: `quantity` in the account commodity, `value` in the transaction currency; splits balance on value.
-- Here: journal_lines.amount (account currency) and base_amount (group base currency); entries balance on base_amount.
-- These rules hold for every writer, so the Edge Functions do not repeat them.

-- Line rules: no posting to a placeholder; the account is in the entry's group; a balance-sheet account belongs
-- to the entry owner and the line is in its currency; a base-currency line has amount = base_amount.
CREATE FUNCTION journal_lines_check() RETURNS trigger AS $$
DECLARE
    a accounts%ROWTYPE;
    e journal_entries%ROWTYPE;
    base char(3);
BEGIN
    SELECT * INTO a FROM accounts WHERE id = NEW.account_id;
    SELECT * INTO e FROM journal_entries WHERE id = NEW.entry_id;
    SELECT base_currency INTO base FROM groups WHERE id = e.group_id;
    IF a.is_placeholder THEN
        RAISE EXCEPTION 'cannot post to a placeholder account' USING ERRCODE = '23514';
    END IF;
    IF a.group_id <> e.group_id THEN
        RAISE EXCEPTION 'line account is in another group' USING ERRCODE = '23514';
    END IF;
    IF a.owner_member_id IS NOT NULL AND a.owner_member_id <> e.member_id THEN
        RAISE EXCEPTION 'line account belongs to another member' USING ERRCODE = '23514';
    END IF;
    IF a.currency IS NOT NULL AND a.currency <> NEW.currency THEN
        RAISE EXCEPTION 'line currency must match the account currency' USING ERRCODE = '23514';
    END IF;
    IF NEW.currency = base AND NEW.amount <> NEW.base_amount THEN
        RAISE EXCEPTION 'base-currency line must have amount = base_amount' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER journal_lines_placeholder_chk ON journal_lines;
DROP FUNCTION journal_lines_no_placeholder();

CREATE TRIGGER journal_lines_chk
    BEFORE INSERT OR UPDATE OF entry_id, account_id, currency, amount, base_amount ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION journal_lines_check();

-- An account with lines keeps its type and currency, and cannot become a placeholder.
CREATE FUNCTION accounts_check_used() RETURNS trigger AS $$
BEGIN
    IF (NEW.type <> OLD.type OR NEW.currency IS DISTINCT FROM OLD.currency OR (NEW.is_placeholder AND NOT OLD.is_placeholder))
       AND EXISTS (SELECT 1 FROM journal_lines WHERE account_id = NEW.id) THEN
        RAISE EXCEPTION 'account has records' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER accounts_used_chk
    BEFORE UPDATE OF type, currency, is_placeholder ON accounts
    FOR EACH ROW EXECUTE FUNCTION accounts_check_used();

REVOKE EXECUTE ON FUNCTION journal_lines_check() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION accounts_check_used() FROM PUBLIC, anon, authenticated;
