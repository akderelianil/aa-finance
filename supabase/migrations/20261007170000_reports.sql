-- Rapor fonksiyonları (salt okuma). security invoker: RLS çağıranın grubuyla sınırlar.
-- Tutarlar grup ana para biriminde (base_amount). Silinmiş kayıtlar hariç. Tarih sınırları dahil, NULL = sınırsız.

-- Hesap + kaydın sahibi üye bazında borç/alacak toplamları. Gelir tablosu (dönem), bilanço (p_from NULL,
-- p_to = tarih) ve mizan bu tek kaynaktan türetilir; üye filtresi istemcide yapılır.
CREATE FUNCTION report_totals(p_from date, p_to date)
RETURNS TABLE (member_id uuid, account_id uuid, debit bigint, credit bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
    SELECT e.member_id, l.account_id,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'debit'), 0)::bigint,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'credit'), 0)::bigint
    FROM journal_lines l
    JOIN journal_entries e ON e.id = l.entry_id
    WHERE e.deleted_at IS NULL
      AND (p_from IS NULL OR e.entry_date >= p_from)
      AND (p_to IS NULL OR e.entry_date <= p_to)
    GROUP BY e.member_id, l.account_id
$$;

-- Nakit akışı: nakit/banka hesaplarına giren ve çıkan para (kendi hesaplar arası aktarım, döviz alım/satımı ve açılış bakiyesi hariç).
CREATE FUNCTION report_cash_flow(p_from date, p_to date)
RETURNS TABLE (member_id uuid, inflow bigint, outflow bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
    SELECT e.member_id,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'debit'), 0)::bigint,
           COALESCE(SUM(l.base_amount) FILTER (WHERE l.direction = 'credit'), 0)::bigint
    FROM journal_lines l
    JOIN journal_entries e ON e.id = l.entry_id
    JOIN accounts a ON a.id = l.account_id
    WHERE e.deleted_at IS NULL
      AND a.subtype IN ('cash', 'bank')
      AND COALESCE(e.source_type, '') NOT IN ('transfer', 'opening_balance', 'fx_exchange')
      AND (p_from IS NULL OR e.entry_date >= p_from)
      AND (p_to IS NULL OR e.entry_date <= p_to)
    GROUP BY e.member_id
$$;

REVOKE EXECUTE ON FUNCTION report_totals(date, date), report_cash_flow(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION report_totals(date, date), report_cash_flow(date, date) TO authenticated;
