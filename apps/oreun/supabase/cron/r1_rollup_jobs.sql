-- OPTIONAL after the dedicated R1 database is created and Supabase Cron is enabled.
-- This does NOT call Roblox. External collection remains in the protected collector runner.
-- Keep DB-local jobs short and observable.

select cron.schedule(
  'r1-rollup-refresh',
  '*/10 * * * *',
  $$ select public.r1_refresh_rollups(now() - interval '2 hours', now()) $$
);

select cron.schedule(
  'r1-retention-cleanup',
  '17 3 * * *',
  $$ select public.r1_apply_retention() $$
);

-- Supabase cron.job_run_details does not auto-clean itself.
select cron.schedule(
  'r1-cron-history-cleanup',
  '41 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$
);
