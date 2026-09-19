-- R1 DB hardening after Supabase advisors.
alter extension pg_trgm set schema extensions;

create index if not exists data_quality_flags_ingestion_run_idx
  on public.data_quality_flags(ingestion_run_id);
create index if not exists data_quality_flags_universe_idx
  on public.data_quality_flags(universe_id);
create index if not exists game_provider_state_data_source_idx
  on public.game_provider_state(data_source_id);
create index if not exists game_provider_state_ingestion_run_idx
  on public.game_provider_state(ingestion_run_id);
create index if not exists game_rollups_daily_source_idx
  on public.game_rollups_daily(source_data_source_id);
create index if not exists game_rollups_hourly_source_idx
  on public.game_rollups_hourly(source_data_source_id);
create index if not exists game_snapshots_data_source_idx
  on public.game_snapshots(data_source_id);
create index if not exists game_snapshots_ingestion_run_idx
  on public.game_snapshots(ingestion_run_id);
create index if not exists ingestion_runs_data_source_idx
  on public.ingestion_runs(data_source_id);

create policy "deny public collector targets"
on public.collector_targets for all to anon, authenticated
using (false) with check (false);
create policy "deny public data quality flags"
on public.data_quality_flags for all to anon, authenticated
using (false) with check (false);
create policy "deny public data sources"
on public.data_sources for all to anon, authenticated
using (false) with check (false);
create policy "deny public slug history"
on public.game_slug_history for all to anon, authenticated
using (false) with check (false);
create policy "deny public raw snapshots"
on public.game_snapshots for all to anon, authenticated
using (false) with check (false);
create policy "deny public ingestion runs"
on public.ingestion_runs for all to anon, authenticated
using (false) with check (false);
