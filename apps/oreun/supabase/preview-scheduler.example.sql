-- R1 / Oreun PREVIEW scheduler bootstrap example.
-- This is intentionally NOT a migration: the Edge Function URL is project-specific.
-- Apply only to a dedicated R1 Preview project after the schema migrations and after
-- deploying the r1-collector Edge Function.
-- Replace <PROJECT_REF> with the target Supabase project ref before executing.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'r1_collector_token'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'r1_collector_token',
      'R1 preview collector cron token'
    );
  end if;
end
$$;

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

select cron.schedule(
  'r1-preview-edge-collector',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/r1-collector',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-r1-collector-token',
      (select decrypted_secret
       from vault.decrypted_secrets
       where name='r1_collector_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  )
  $cron$
);

select cron.schedule(
  'r1-preview-retention',
  '17 3 * * *',
  $$ select public.r1_apply_retention() $$
);

select cron.schedule(
  'r1-preview-cron-history-cleanup',
  '41 3 * * *',
  $$ delete from cron.job_run_details
     where end_time < now() - interval '7 days' $$
);
