-- Google-only new-account gate for hosted Supabase Auth.
-- Existing email/password users can still sign in because this hook runs only
-- before creation of a brand-new auth user.
--
-- After this migration is applied, enable this Postgres function in:
-- Authentication -> Hooks (Beta) -> Before User Created.
-- The hosted Auth hook configuration itself is intentionally not stored in SQL.

create or replace function public.r1_before_user_created_google_only(event jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case
    when coalesce(event->'user'->'app_metadata'->>'provider', '') = 'google'
      then '{}'::jsonb
    else jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'New accounts must be created with Google.'
      )
    )
  end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.r1_before_user_created_google_only(jsonb)
to supabase_auth_admin;

revoke execute on function public.r1_before_user_created_google_only(jsonb)
from public, anon, authenticated;

comment on function public.r1_before_user_created_google_only(jsonb) is
'Before User Created Auth hook: allow new Google users only; existing legacy email users remain able to sign in.';
