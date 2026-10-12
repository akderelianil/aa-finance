-- rls_auto_enable() is an event-trigger function (SECURITY DEFINER) created outside the migrations.
-- API roles must not call it (advisors 0028/0029).
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
