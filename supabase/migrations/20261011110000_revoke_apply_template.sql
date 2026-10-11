-- The 2-argument apply_account_template (20261011100000) lost the REVOKE of the old signature.
-- Only Edge Functions (direct Postgres connection) call it.
REVOKE EXECUTE ON FUNCTION apply_account_template(uuid, boolean) FROM PUBLIC, anon, authenticated;
