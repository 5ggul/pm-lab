-- Defense-in-depth for private helper functions.
-- Revoke PostgreSQL's default PUBLIC EXECUTE, then expose only the helpers
-- that RLS/public invoker wrappers need for authenticated callers.

revoke execute on all functions in schema private
  from public, anon, authenticated;

grant execute on function private.r1_is_active_user()
  to authenticated;
grant execute on function private.r1_is_moderator()
  to authenticated;
grant execute on function private.r1_current_permissions()
  to authenticated;
grant execute on function private.r1_set_age_confirmation_private(boolean)
  to authenticated;
