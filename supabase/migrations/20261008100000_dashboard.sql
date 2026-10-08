-- Home dashboard. p_member NULL = whole family/group. With a member ("Bireysel"):
--   * balance sheet accounts (asset/liability/equity) count when the account owner is that member,
--   * income/expense lines count when the entry was posted by that member.
-- Same shape as account_period_totals. Caller's RLS applies (security invoker).
CREATE FUNCTION dashboard_totals(p_from date, p_to date, p_member uuid)
RETURNS TABLE (account_id uuid, before_debit bigint, before_credit bigint, debit bigint, credit bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
    SELECT l.account_id,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'debit'  AND e.entry_date <  p_from), 0)::bigint,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'credit' AND e.entry_date <  p_from), 0)::bigint,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'debit'  AND (p_from IS NULL OR e.entry_date >= p_from)), 0)::bigint,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'credit' AND (p_from IS NULL OR e.entry_date >= p_from)), 0)::bigint
    FROM journal_lines l
    JOIN journal_entries e ON e.id = l.entry_id
    JOIN accounts a ON a.id = l.account_id
    WHERE e.deleted_at IS NULL AND e.entry_date <= p_to
      AND (p_member IS NULL
           OR (a.type IN ('asset', 'liability', 'equity') AND a.owner_member_id = p_member)
           OR (a.type IN ('income', 'expense') AND e.member_id = p_member))
    GROUP BY l.account_id;
$$;

-- Income and expense per month (base currency), months with entries only.
CREATE FUNCTION dashboard_monthly(p_from date, p_to date, p_member uuid)
RETURNS TABLE (month date, income bigint, expense bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
    SELECT date_trunc('month', e.entry_date)::date,
           COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.base_amount ELSE -l.base_amount END) FILTER (WHERE a.type = 'income'), 0)::bigint,
           COALESCE(SUM(CASE WHEN l.direction = 'debit'  THEN l.base_amount ELSE -l.base_amount END) FILTER (WHERE a.type = 'expense'), 0)::bigint
    FROM journal_lines l
    JOIN journal_entries e ON e.id = l.entry_id
    JOIN accounts a ON a.id = l.account_id
    WHERE e.deleted_at IS NULL AND a.type IN ('income', 'expense')
      AND e.entry_date BETWEEN p_from AND p_to
      AND (p_member IS NULL OR e.member_id = p_member)
    GROUP BY 1 ORDER BY 1;
$$;

REVOKE EXECUTE ON FUNCTION dashboard_totals(date, date, uuid), dashboard_monthly(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION dashboard_totals(date, date, uuid), dashboard_monthly(date, date, uuid) TO authenticated;
