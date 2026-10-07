-- Hesap ağacı: parent_id kuralları, gruplayıcı hesaplara kayıt engeli, alt ağaç dahil bakiyeler.

-- Üst hesap: aynı grup, aynı tip, sistem hesabı değil; bilanço hesaplarında aynı sahip ve para birimi; döngü yok.
CREATE FUNCTION accounts_check_parent() RETURNS trigger AS $$
DECLARE
    p   accounts%ROWTYPE;
    cur uuid;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'account cannot be its own parent' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO p FROM accounts WHERE id = NEW.parent_id;
    IF NOT FOUND OR p.group_id <> NEW.group_id OR p.type <> NEW.type OR p.system_key IS NOT NULL THEN
        RAISE EXCEPTION 'invalid parent account' USING ERRCODE = '23514';
    END IF;
    IF NEW.type IN ('asset', 'liability', 'equity')
       AND (p.owner_member_id IS DISTINCT FROM NEW.owner_member_id OR p.currency IS DISTINCT FROM NEW.currency) THEN
        RAISE EXCEPTION 'parent must have the same owner and currency' USING ERRCODE = '23514';
    END IF;
    cur := p.parent_id;
    WHILE cur IS NOT NULL LOOP
        IF cur = NEW.id THEN
            RAISE EXCEPTION 'account tree cycle' USING ERRCODE = '23514';
        END IF;
        SELECT parent_id INTO cur FROM accounts WHERE id = cur;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER accounts_parent_chk
    BEFORE INSERT OR UPDATE OF parent_id, type, currency, owner_member_id ON accounts
    FOR EACH ROW EXECUTE FUNCTION accounts_check_parent();

-- Gruplayıcı (is_placeholder) hesaba kayıt atılamaz.
CREATE FUNCTION journal_lines_no_placeholder() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM accounts WHERE id = NEW.account_id AND is_placeholder) THEN
        RAISE EXCEPTION 'cannot post to a placeholder account' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER journal_lines_placeholder_chk
    BEFORE INSERT ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION journal_lines_no_placeholder();

REVOKE EXECUTE ON FUNCTION accounts_check_parent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION journal_lines_no_placeholder() FROM PUBLIC, anon, authenticated;

-- Her hesap için kendisi + tüm alt hesapları dahil bakiye. Kategorilerde para birimi karışabilir:
-- orada net_base_amount kullanılır. RLS çağıranın yetkisiyle işler.
CREATE VIEW account_tree_balances WITH (security_invoker = true) AS
WITH RECURSIVE tree AS (
    SELECT id AS root_id, id AS node_id FROM accounts
    UNION ALL
    SELECT t.root_id, a.id FROM tree t JOIN accounts a ON a.parent_id = t.node_id
)
SELECT t.root_id AS account_id,
       COALESCE(SUM(b.net_amount), 0)::bigint      AS net_amount,
       COALESCE(SUM(b.net_base_amount), 0)::bigint AS net_base_amount
FROM tree t
LEFT JOIN account_balances b ON b.account_id = t.node_id
GROUP BY t.root_id;

GRANT SELECT ON account_tree_balances TO authenticated;
