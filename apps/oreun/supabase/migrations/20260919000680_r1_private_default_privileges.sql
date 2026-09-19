-- Keep private trigger/helper functions non-callable by default.
-- Trigger execution does not require end-user EXECUTE privileges.

alter default privileges for role postgres in schema private
  revoke execute on functions
  from public, anon, authenticated, service_role;

revoke execute on function private.r1_guard_notification_update()
  from public, anon, authenticated;
revoke execute on function private.r1_guard_report_update()
  from public, anon, authenticated;
