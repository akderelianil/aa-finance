-- Faster RLS: a user has one group (members_one_group_per_user), so policies compare group_id with
-- (SELECT my_group_id()). Postgres evaluates it once per query (initplan) instead of
-- is_group_member(group_id) once per row (SECURITY DEFINER functions are not inlined).

CREATE FUNCTION my_group_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT group_id FROM members WHERE user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION my_group_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_group_id() TO authenticated;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['accounts', 'audit_log', 'brand_businesses', 'contact_bank_accounts', 'contacts',
                             'entry_tags', 'fx_rates', 'group_invites', 'journal_entries', 'member_access',
                             'members', 'tags']
    LOOP
        EXECUTE format('DROP POLICY %I ON %I', t || '_select', t);
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (group_id = (SELECT my_group_id()))',
                       t || '_select', t);
    END LOOP;
END $$;

DROP POLICY groups_select ON groups;
CREATE POLICY groups_select ON groups FOR SELECT TO authenticated USING (id = (SELECT my_group_id()));

DROP POLICY journal_lines_select ON journal_lines;
CREATE POLICY journal_lines_select ON journal_lines FOR SELECT TO authenticated USING (
    entry_id IN (SELECT id FROM journal_entries WHERE group_id = (SELECT my_group_id())));

DROP POLICY profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (
    id = (SELECT auth.uid())
    OR id IN (SELECT user_id FROM members WHERE group_id = (SELECT my_group_id())));

-- Avatars: private. A user reads their own files and the files of their group and its members.
-- Paths: users/<user_id>/<file>, groups/<group_id>/<file>. The app uses signed URLs.
UPDATE storage.buckets SET public = false WHERE id = 'avatars';
CREATE POLICY avatars_objects_select ON storage.objects FOR SELECT TO authenticated USING (
    bucket_id = 'avatars' AND (
        (storage.foldername(name))[1] = 'users' AND (
            (storage.foldername(name))[2] = (SELECT auth.uid())::text
            OR (storage.foldername(name))[2] IN (
                SELECT user_id::text FROM public.members WHERE group_id = (SELECT public.my_group_id())))
        OR (storage.foldername(name))[1] = 'groups'
           AND (storage.foldername(name))[2] = (SELECT public.my_group_id())::text));

-- Leftovers of deleted flows: attachments bucket (table dropped in 20261008110000) and contact notes (no code uses them).
DROP POLICY attachments_objects_select ON storage.objects;
DROP TABLE member_contact_notes;
