-- Güvenlik/performans uyarılarının giderilmesi.

-- handle_new_user yalnız auth.users trigger'ı olarak çalışır; RPC olarak çağrılamasın.
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;

-- is_group_member RLS politikalarında authenticated için gerekli; anon çağıramasın.
REVOKE EXECUTE ON FUNCTION is_group_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_group_member(uuid) TO authenticated;

-- auth.uid() satır başına yeniden değerlendirilmesin (initplan).
DROP POLICY profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (
    id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM members a JOIN members b ON a.group_id = b.group_id
               WHERE a.user_id = (SELECT auth.uid()) AND b.user_id = profiles.id)
);
