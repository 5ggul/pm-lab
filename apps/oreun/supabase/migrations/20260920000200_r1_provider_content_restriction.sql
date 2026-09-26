create or replace function public.r1_mark_target_unavailable(
  p_universe_id bigint,
  p_lease_token uuid,
  p_data_source_id bigint,
  p_ingestion_run_id uuid,
  p_reason text,
  p_retry_minutes integer default 360
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
  v_now timestamptz := now();
  v_retry integer := greatest(30, least(1440, coalesce(p_retry_minutes, 360)));
begin
  if not exists (
    select 1
    from public.collector_targets as target
    where target.universe_id = p_universe_id
      and target.lease_token = p_lease_token
      and target.leased_until >= v_now
  ) then
    return false;
  end if;

  update public.game_provider_state
  set
    data_source_id = p_data_source_id,
    ingestion_run_id = p_ingestion_run_id,
    playing = null,
    fetched_at = v_now,
    freshness_state = 'unavailable'
  where universe_id = p_universe_id;

  update public.collector_targets
  set
    tier = 'longtail',
    cadence_minutes = v_retry,
    next_due_at = v_now + make_interval(mins => v_retry),
    failure_count = 0,
    last_error = left(coalesce(p_reason, 'provider current state unavailable'), 500),
    lease_token = null,
    leased_until = null,
    updated_at = v_now
  where universe_id = p_universe_id
    and lease_token = p_lease_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.r1_mark_target_unavailable(
  bigint, uuid, bigint, uuid, text, integer
) from public, anon, authenticated;
grant execute on function public.r1_mark_target_unavailable(
  bigint, uuid, bigint, uuid, text, integer
) to service_role;

create or replace view public.r1_game_index_readiness
with (security_invoker = true)
as
select
  game.universe_id,
  game.canonical_slug,
  game.index_state,
  state.fetched_at,
  count(hourly.bucket_at) filter (
    where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
  )::integer as hourly_buckets_24h,
  coalesce(
    avg(hourly.coverage_ratio) filter (
      where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
    ),
    0
  )::numeric as avg_coverage_24h,
  (
    state.freshness_state = 'fresh'
    and state.playing is not null
    and state.fetched_at is not null
    and state.fetched_at >= now() - interval '20 minutes'
  ) as current_data_recent,
  (
    char_length(trim(game.description_ko)) >= 80
  ) as has_editorial_description,
  (
    game.index_state in ('candidate','indexable')
    and state.freshness_state = 'fresh'
    and state.playing is not null
    and state.fetched_at is not null
    and state.fetched_at >= now() - interval '20 minutes'
    and char_length(trim(game.description_ko)) >= 80
    and enrichment.hero_image_url is not null
    and count(hourly.bucket_at) filter (
      where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
    ) >= 24
    and count(hourly.bucket_at) filter (
      where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
        and hourly.coverage_ratio >= 0.70
    ) >= 18
    and coalesce(
      avg(hourly.coverage_ratio) filter (
        where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
      ),
      0
    ) >= 0.70
  ) as data_ready_for_index_review,
  count(hourly.bucket_at) filter (
    where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
      and hourly.coverage_ratio >= 0.70
  )::integer as trusted_hourly_buckets_24h,
  (enrichment.hero_image_url is not null) as has_official_hero,
  (
    count(hourly.bucket_at) filter (
      where hourly.bucket_at >= date_trunc('hour', now() - interval '24 hours')
        and hourly.coverage_ratio >= 0.70
    ) >= 18
    or exists (
      select 1
      from public.game_update_events update_event
      where update_event.universe_id = game.universe_id
        and update_event.event_kind = 'provider_update_detected'
    )
    or exists (
      select 1
      from public.game_codes code
      where code.universe_id = game.universe_id
        and code.visibility = 'published'
    )
    or exists (
      select 1
      from public.game_guides guide
      where guide.universe_id = game.universe_id
        and guide.content_status = 'published'
    )
  ) as has_independent_value,
  state.freshness_state,
  state.playing as current_playing,
  (
    state.freshness_state = 'fresh'
    and state.playing is not null
  ) as current_data_available
from public.games as game
left join public.game_provider_state as state
  on state.universe_id = game.universe_id
left join public.game_enrichment as enrichment
  on enrichment.universe_id = game.universe_id
left join public.game_rollups_hourly as hourly
  on hourly.universe_id = game.universe_id
group by
  game.universe_id,
  game.canonical_slug,
  game.index_state,
  game.description_ko,
  state.fetched_at,
  state.freshness_state,
  state.playing,
  enrichment.hero_image_url;

revoke all on public.r1_game_index_readiness from public, anon, authenticated;
grant select on public.r1_game_index_readiness to service_role;
