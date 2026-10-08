-- R1 ingestion accounting invariants.
-- Apply after correcting any pre-fix Preview test rows.
alter table public.ingestion_runs
  add constraint ingestion_runs_accounting_check
  check (
    status = 'running'
    or requested_count = success_count + failure_count
  );

alter table public.ingestion_runs
  add constraint ingestion_runs_rate_limit_check
  check (
    rate_limit_count <= failure_count
  );
