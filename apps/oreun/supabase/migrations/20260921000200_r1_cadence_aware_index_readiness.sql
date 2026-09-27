-- Make launch readiness respect each collector target's expected cadence.
-- A value remains current for up to two expected collection cycles, with a
-- minimum 20-minute window. Regional/provider unavailable rows remain blocked.

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
    and state.fetched_at >= now() - (
      greatest(20, coalesce(target.cadence_minutes, 10) * 2)
      * interval '1 minute'
    )
  ) as current_data_recent,
  (
    char_length(trim(game.description_ko)) >= 80
  ) as has_editorial_description,
  (
    game.index_state in ('candidate','indexable')
    and state.freshness_state = 'fresh'
    and state.playing is not null
    and state.fetched_at is not null
    and state.fetched_at >= now() - (
      greatest(20, coalesce(target.cadence_minutes, 10) * 2)
      * interval '1 minute'
    )
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
left join public.collector_targets as target
  on target.universe_id = game.universe_id
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
  target.cadence_minutes,
  enrichment.hero_image_url;

revoke all on public.r1_game_index_readiness from public, anon, authenticated;
grant select on public.r1_game_index_readiness to service_role;
