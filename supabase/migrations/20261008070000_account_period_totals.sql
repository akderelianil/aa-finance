-- Reports (trial balance, balance sheet, income statement): per account debit and credit totals in the base
-- currency before the period and inside it. p_from NULL = from the start. Caller's RLS applies (security invoker).
CREATE FUNCTION account_period_totals(p_from date, p_to date)
RETURNS TABLE (account_id uuid, before_debit bigint, before_credit bigint, debit bigint, credit bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
    SELECT l.account_id,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'debit'  AND e.entry_date <  p_from), 0)::bigint,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'credit' AND e.entry_date <  p_from), 0)::bigint,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'debit'  AND (p_from IS NULL OR e.entry_date >= p_from)), 0)::bigint,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'credit' AND (p_from IS NULL OR e.entry_date >= p_from)), 0)::bigint
    FROM journal_lines l
    JOIN journal_entries e ON e.id = l.entry_id
    WHERE e.deleted_at IS NULL AND e.entry_date <= p_to
    GROUP BY l.account_id;
$$;

REVOKE EXECUTE ON FUNCTION account_period_totals(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION account_period_totals(date, date) TO authenticated;
