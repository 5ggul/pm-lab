-- R1 PREVIEW ONLY.
-- Scheduler wakes every minute; per-game next_due_at preserves 5/15/30/120m cadence.\n-- Collector Edge Function authenticates with a random token stored only in Supabase Vault.

select cron.schedule(
  'r1-preview-edge-collector',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://galfwxoytdcndjihdnyg.supabase.co/functions/v1/r1-collector',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-r1-collector-token',
      (select decrypted_secret
       from vault.decrypted_secrets
       where name = 'r1_collector_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  )
  $$
);

select cron.schedule(
  'r1-preview-retention',
  '17 3 * * *',
  $$ select public.r1_apply_retention() $$
);

select cron.schedule(
  'r1-preview-cron-history-cleanup',
  '41 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$
);
