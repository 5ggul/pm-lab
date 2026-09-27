-- Service-role-only release auth readiness.
-- Used by release preflight to prove that Google Auth has produced a real
-- identity and that an active Google-backed admin exists before release.

create or replace function public.r1_release_auth_readiness()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'google_identity_count',
    (
      select count(*)::integer
      from auth.identities as identity_row
      where identity_row.provider = 'google'
    ),
    'active_admin_count',
    (
      select count(*)::integer
      from private.user_roles as role_row
      join private.user_status as status_row
        on status_row.user_id = role_row.user_id
      where role_row.role = 'admin'
        and status_row.status = 'active'
        and status_row.age_confirmed_14_plus = true
    ),
    'active_google_admin_count',
    (
      select count(distinct role_row.user_id)::integer
      from private.user_roles as role_row
      join private.user_status as status_row
        on status_row.user_id = role_row.user_id
      join auth.identities as identity_row
        on identity_row.user_id = role_row.user_id
       and identity_row.provider = 'google'
      where role_row.role = 'admin'
        and status_row.status = 'active'
        and status_row.age_confirmed_14_plus = true
    )
  );
$$;

revoke all on function public.r1_release_auth_readiness()
from public, anon, authenticated;
grant execute on function public.r1_release_auth_readiness()
to service_role;