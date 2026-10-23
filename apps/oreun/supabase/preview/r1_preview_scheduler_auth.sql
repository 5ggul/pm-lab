-- R1 Preview-only scheduler/auth layer. Do not copy this preview schedule to Production blindly.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.r1_validate_collector_token(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets as secret
    where secret.name = 'r1_collector_token'
      and secret.decrypted_secret = p_token
  );
$$;

revoke execute on function public.r1_validate_collector_token(text)
  from public, anon, authenticated;
grant execute on function public.r1_validate_collector_token(text)
  to service_role;
