-- Explicit deny policies on private Sprint 02 tables.
-- SECURITY DEFINER helpers remain the only application path.

drop policy if exists "deny direct user status" on private.user_status;
create policy "deny direct user status"
on private.user_status for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "deny direct user roles" on private.user_roles;
create policy "deny direct user roles"
on private.user_roles for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "deny direct ugc rate limits" on private.ugc_rate_limits;
create policy "deny direct ugc rate limits"
on private.ugc_rate_limits for all
to anon, authenticated
using (false)
with check (false);
