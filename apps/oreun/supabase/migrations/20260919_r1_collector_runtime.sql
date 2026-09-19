-- R1 / Oreun Sprint 01 collector runtime extension.
-- Apply only to a dedicated R1 Supabase project after 20260918_r1_data_foundation.sql.

alter table public.game_snapshots
  add column if not exists expected_interval_minutes integer not null default 60
  check (expected_interval_minutes between 1 and 1440);

alter table public.game_rollups_hourly
  add column if not exists source_data_source_id bigint references public.data_sources(id),
  add column if not exists calculation_version text not null default 'rollup_v1';

alter table public.game_rollups_daily
  add column if not exists source_data_source_id bigint references public.data_sources(id),
  add column if not exists calculation_version text not null default 'rollup_v1';

create table if not exists public.collector_targets (
  universe_id bigint primary key references public.games(universe_id) on delete cascade,
  tier text not null default 'longtail'
    check (tier in ('hot','active','normal','longtail')),
  cadence_minutes integer not null default 120
    check (cadence_minutes between 1 and 1440),
  next_due_at timestamptz not null default now(),
  failure_count integer not null default 0 check (failure_count >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  lease_token uuid,
  leased_until timestamptz,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists collector_targets_due_idx
  on public.collector_targets(next_due_at)
  where enabled;

alter table public.collector_targets enable row level security;

insert into public.data_sources (
  provider,
  source_class,
  endpoint,
  endpoint_version,
  stability,
  auth_mode,
  enabled,
  purge_group
)
values (
  'roblox_public_games',
  'ROBLOX_PUBLIC_API',
  'https://games.roblox.com/v1/games',
  'public-v1',
  'documented-public-web-api',
  'none',
  true,
  'roblox_public_games'
)
on conflict (provider, endpoint) do update
set
  source_class = excluded.source_class,
  endpoint_version = excluded.endpoint_version,
  stability = excluded.stability,
  auth_mode = excluded.auth_mode,
  enabled = excluded.enabled,
  purge_group = excluded.purge_group;

create or replace function public.r1_claim_due_games(
  p_limit integer,
  p_lease_token uuid,
  p_lease_seconds integer default 180
)
returns table (
  universe_id bigint,
  failure_count integer,
  cadence_minutes integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with due as (
    select target.universe_id
    from public.collector_targets as target
    where target.enabled
      and target.next_due_at <= now()
      and (target.leased_until is null or target.leased_until < now())
    order by target.next_due_at asc, target.universe_id asc
    for update skip locked
    limit greatest(1, least(p_limit, 500))
  )
  update public.collector_targets as target
  set
    lease_token = p_lease_token,
    leased_until = now() + make_interval(secs => greatest(30, p_lease_seconds)),
    updated_at = now()
  from due
  where target.universe_id = due.universe_id
  returning target.universe_id, target.failure_count, target.cadence_minutes;
end;
$$;

create or replace function public.r1_persist_game_observations(
  p_ingestion_run_id uuid,
  p_data_source_id bigint,
  p_lease_token uuid,
  p_observations jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  observation jsonb;
  v_universe_id bigint;
  v_root_place_id bigint;
  v_fetched_at timestamptz;
  v_cadence integer;
  v_saved integer := 0;
begin
  for observation in
    select value from jsonb_array_elements(coalesce(p_observations, '[]'::jsonb))
  loop
    v_universe_id := (observation->>'universe_id')::bigint;
    v_root_place_id := (observation->>'root_place_id')::bigint;
    v_fetched_at := (observation->>'fetched_at')::timestamptz;
    v_cadence := greatest(1, least(1440, (observation->>'cadence_minutes')::integer));

    if not exists (
      select 1
      from public.collector_targets as target
      where target.universe_id = v_universe_id
        and target.lease_token = p_lease_token
        and target.leased_until >= now()
    ) then
      continue;
    end if;

    if exists (
      select 1
      from public.games as game
      where game.universe_id = v_universe_id
        and game.root_place_id <> v_root_place_id
    ) then
      insert into public.data_quality_flags (
        universe_id, ingestion_run_id, flag_type, severity, details
      )
      values (
        v_universe_id,
        p_ingestion_run_id,
        'root_place_mismatch',
        'error',
        jsonb_build_object('provider_root_place_id', v_root_place_id)
      );
    end if;

    insert into public.game_provider_state (
      universe_id,
      data_source_id,
      ingestion_run_id,
      name,
      description,
      creator_name,
      playing,
      visits,
      favorites,
      source_updated_at,
      fetched_at,
      freshness_state
    )
    values (
      v_universe_id,
      p_data_source_id,
      p_ingestion_run_id,
      coalesce(observation->>'name', ''),
      coalesce(observation->>'description', ''),
      observation->>'creator_name',
      (observation->>'playing')::bigint,
      (observation->>'visits')::bigint,
      (observation->>'favorites')::bigint,
      (observation->>'source_updated_at')::timestamptz,
      v_fetched_at,
      coalesce(observation->>'freshness_state', 'fresh')
    )
    on conflict (universe_id) do update
    set
      data_source_id = excluded.data_source_id,
      ingestion_run_id = excluded.ingestion_run_id,
      name = excluded.name,
      description = excluded.description,
      creator_name = excluded.creator_name,
      playing = excluded.playing,
      visits = excluded.visits,
      favorites = excluded.favorites,
      source_updated_at = excluded.source_updated_at,
      fetched_at = excluded.fetched_at,
      freshness_state = excluded.freshness_state
    where excluded.fetched_at >= public.game_provider_state.fetched_at;

    insert into public.game_snapshots (
      universe_id,
      captured_at,
      playing,
      visits,
      favorites,
      data_source_id,
      ingestion_run_id,
      fetched_at,
      raw_or_derived,
      expected_interval_minutes
    )
    values (
      v_universe_id,
      v_fetched_at,
      (observation->>'playing')::bigint,
      (observation->>'visits')::bigint,
      (observation->>'favorites')::bigint,
      p_data_source_id,
      p_ingestion_run_id,
      v_fetched_at,
      'raw',
      v_cadence
    )
    on conflict (universe_id, captured_at) do nothing;

    update public.collector_targets
    set
      tier = case
        when v_cadence <= 5 then 'hot'
        when v_cadence <= 15 then 'active'
        when v_cadence <= 30 then 'normal'
        else 'longtail'
      end,
      cadence_minutes = v_cadence,
      next_due_at = v_fetched_at + make_interval(mins => v_cadence),
      failure_count = 0,
      last_success_at = v_fetched_at,
      last_error = null,
      lease_token = null,
      leased_until = null,
      updated_at = now()
    where universe_id = v_universe_id
      and lease_token = p_lease_token;

    v_saved := v_saved + 1;
  end loop;

  return v_saved;
end;
$$;

create or replace function public.r1_mark_targets_failed(
  p_universe_ids bigint[],
  p_lease_token uuid,
  p_error text,
  p_retry_after_seconds integer default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.collector_targets as target
  set
    failure_count = target.failure_count + 1,
    tier = case when target.failure_count + 1 >= 3 then 'longtail' else target.tier end,
    cadence_minutes = case
      when target.failure_count + 1 >= 3 then greatest(target.cadence_minutes, 120)
      else target.cadence_minutes
    end,
    next_due_at = now() + make_interval(
      secs => coalesce(
        nullif(greatest(0, p_retry_after_seconds), 0),
        least(3600, greatest(60, (60 * power(2, least(target.failure_count, 5)))::integer))
      )
    ),
    last_failure_at = now(),
    last_error = left(p_error, 500),
    lease_token = null,
    leased_until = null,
    updated_at = now()
  where target.universe_id = any(p_universe_ids)
    and target.lease_token = p_lease_token;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.r1_refresh_rollups(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hourly integer := 0;
  v_daily integer := 0;
begin
  with hourly_grouped as (
    select
      snapshot.universe_id,
      date_trunc('hour', snapshot.captured_at) as bucket_at,
      min(snapshot.playing) as playing_min,
      max(snapshot.playing) as playing_max,
      avg(snapshot.playing) as playing_avg,
      (array_agg(snapshot.playing order by snapshot.captured_at desc)
        filter (where snapshot.playing is not null))[1] as playing_last,
      (array_agg(snapshot.visits order by snapshot.captured_at desc)
        filter (where snapshot.visits is not null))[1] as visits_last,
      (array_agg(snapshot.favorites order by snapshot.captured_at desc)
        filter (where snapshot.favorites is not null))[1] as favorites_last,
      count(snapshot.playing)::integer as sample_count,
      greatest(
        1,
        ceil(60.0 / greatest(avg(snapshot.expected_interval_minutes), 1))
      )::integer as expected_samples,
      case
        when count(distinct snapshot.data_source_id) = 1 then min(snapshot.data_source_id)
        else null
      end as source_data_source_id
    from public.game_snapshots as snapshot
    where snapshot.captured_at >= date_trunc('hour', p_from)
      and snapshot.captured_at <= p_to
    group by snapshot.universe_id, date_trunc('hour', snapshot.captured_at)
  ),
  upserted as (
    insert into public.game_rollups_hourly (
      universe_id,
      bucket_at,
      playing_min,
      playing_max,
      playing_avg,
      playing_last,
      visits_last,
      favorites_last,
      sample_count,
      expected_samples,
      coverage_ratio,
      calculated_at,
      source_data_source_id,
      calculation_version
    )
    select
      grouped.universe_id,
      grouped.bucket_at,
      grouped.playing_min,
      grouped.playing_max,
      grouped.playing_avg,
      grouped.playing_last,
      grouped.visits_last,
      grouped.favorites_last,
      grouped.sample_count,
      grouped.expected_samples,
      least(1::numeric, grouped.sample_count::numeric / grouped.expected_samples),
      now(),
      grouped.source_data_source_id,
      'rollup_v1'
    from hourly_grouped as grouped
    on conflict (universe_id, bucket_at) do update
    set
      playing_min = excluded.playing_min,
      playing_max = excluded.playing_max,
      playing_avg = excluded.playing_avg,
      playing_last = excluded.playing_last,
      visits_last = excluded.visits_last,
      favorites_last = excluded.favorites_last,
      sample_count = excluded.sample_count,
      expected_samples = excluded.expected_samples,
      coverage_ratio = excluded.coverage_ratio,
      calculated_at = excluded.calculated_at,
      source_data_source_id = excluded.source_data_source_id,
      calculation_version = excluded.calculation_version
    returning 1
  )
  select count(*) into v_hourly from upserted;

  with daily_grouped as (
    select
      snapshot.universe_id,
      date_trunc('day', snapshot.captured_at) as bucket_at,
      min(snapshot.playing) as playing_min,
      max(snapshot.playing) as playing_max,
      avg(snapshot.playing) as playing_avg,
      (array_agg(snapshot.playing order by snapshot.captured_at desc)
        filter (where snapshot.playing is not null))[1] as playing_last,
      (array_agg(snapshot.visits order by snapshot.captured_at desc)
        filter (where snapshot.visits is not null))[1] as visits_last,
      (array_agg(snapshot.favorites order by snapshot.captured_at desc)
        filter (where snapshot.favorites is not null))[1] as favorites_last,
      count(snapshot.playing)::integer as sample_count,
      greatest(
        1,
        ceil(1440.0 / greatest(avg(snapshot.expected_interval_minutes), 1))
      )::integer as expected_samples,
      case
        when count(distinct snapshot.data_source_id) = 1 then min(snapshot.data_source_id)
        else null
      end as source_data_source_id
    from public.game_snapshots as snapshot
    where snapshot.captured_at >= date_trunc('day', p_from)
      and snapshot.captured_at <= p_to
    group by snapshot.universe_id, date_trunc('day', snapshot.captured_at)
  ),
  upserted as (
    insert into public.game_rollups_daily (
      universe_id,
      bucket_at,
      playing_min,
      playing_max,
      playing_avg,
      playing_last,
      visits_last,
      favorites_last,
      sample_count,
      expected_samples,
      coverage_ratio,
      calculated_at,
      source_data_source_id,
      calculation_version
    )
    select
      grouped.universe_id,
      grouped.bucket_at,
      grouped.playing_min,
      grouped.playing_max,
      grouped.playing_avg,
      grouped.playing_last,
      grouped.visits_last,
      grouped.favorites_last,
      grouped.sample_count,
      grouped.expected_samples,
      least(1::numeric, grouped.sample_count::numeric / grouped.expected_samples),
      now(),
      grouped.source_data_source_id,
      'rollup_v1'
    from daily_grouped as grouped
    on conflict (universe_id, bucket_at) do update
    set
      playing_min = excluded.playing_min,
      playing_max = excluded.playing_max,
      playing_avg = excluded.playing_avg,
      playing_last = excluded.playing_last,
      visits_last = excluded.visits_last,
      favorites_last = excluded.favorites_last,
      sample_count = excluded.sample_count,
      expected_samples = excluded.expected_samples,
      coverage_ratio = excluded.coverage_ratio,
      calculated_at = excluded.calculated_at,
      source_data_source_id = excluded.source_data_source_id,
      calculation_version = excluded.calculation_version
    returning 1
  )
  select count(*) into v_daily from upserted;

  return jsonb_build_object('hourly_upserts', v_hourly, 'daily_upserts', v_daily);
end;
$$;

create or replace function public.r1_apply_retention()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_raw integer := 0;
  v_hourly integer := 0;
begin
  delete from public.game_snapshots
  where captured_at < now() - interval '7 days';
  get diagnostics v_raw = row_count;

  delete from public.game_rollups_hourly
  where bucket_at < now() - interval '180 days';
  get diagnostics v_hourly = row_count;

  return jsonb_build_object(
    'raw_deleted', v_raw,
    'hourly_deleted', v_hourly,
    'daily_retention', 'long-term'
  );
end;
$$;

revoke all on public.collector_targets from anon, authenticated;
grant all on public.collector_targets to service_role;

grant all on public.data_sources to service_role;
grant all on public.ingestion_runs to service_role;
grant all on public.game_provider_state to service_role;
grant all on public.game_snapshots to service_role;
grant all on public.game_rollups_hourly to service_role;
grant all on public.game_rollups_daily to service_role;
grant all on public.data_quality_flags to service_role;
grant all on public.games to service_role;
grant all on public.game_aliases to service_role;
grant all on public.game_slug_history to service_role;
grant all on public.trend_scores to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke execute on function public.r1_claim_due_games(integer, uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.r1_persist_game_observations(uuid, bigint, uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function public.r1_mark_targets_failed(bigint[], uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function public.r1_refresh_rollups(timestamptz, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.r1_apply_retention()
  from public, anon, authenticated;

grant execute on function public.r1_claim_due_games(integer, uuid, integer)
  to service_role;
grant execute on function public.r1_persist_game_observations(uuid, bigint, uuid, jsonb)
  to service_role;
grant execute on function public.r1_mark_targets_failed(bigint[], uuid, text, integer)
  to service_role;
grant execute on function public.r1_refresh_rollups(timestamptz, timestamptz)
  to service_role;
grant execute on function public.r1_apply_retention()
  to service_role;
